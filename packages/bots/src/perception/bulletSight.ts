// Bullets as a human sees them (bot overhaul COMBAT-1 and COMBAT-5): the snapshot reports every bullet whose drawn
// path crosses the snapshot view (sim match/reports.ts bulletEventsIn), with the shooter's exact muzzle position, but
// the client only shows the part of the tracer that crosses the 16:9 screen. A tracer that never crosses the screen is
// not seen; one fired from off screen is seen entering at the screen edge, and the shot is heard from its direction.
// So the bot gets the on-screen part only (`pos` moved to where the tracer enters, its distances shortened to keep the
// same end), and for an off-screen shooter an estimate of where it stands (`origin`): back along the tracer from the
// entry point, with a bearing error of up to 15 degrees and a distance off by -40%..+50% (diagnosis round 1 issue 1
// RC5: the threat board and the radar glances used the exact muzzle position). The noise is a deterministic hash of
// the shooter and a 2 s time bucket (no rng draw), so one burst gives one stable estimate. A shot fired under someone
// else's roof is treated the same way from where its tracer leaves the roof (the client draws bullets under ceilings).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import type { BulletEvent } from "@rebirth/sim";
import { humanScreen } from "./sight.ts";

/**
 * A bullet as the bot perceives it: the on-screen part of the tracer and where the shooter seems to be (both optional,
 * so hand-made BulletEvents in tests still fit: read them through bulletOrigin).
 */
export interface SeenBullet extends BulletEvent {
    /** the shooter's position: the start when it is on the screen, else an estimate behind the screen entry */
    origin?: Vec2;
    /** the start lies off the screen: `pos` is where the tracer enters it */
    clipped?: boolean;
}

/** Where the shooter of a perceived bullet seems to be (the start of a hand-made one). */
export function bulletOrigin(b: SeenBullet): Vec2 {
    return b.origin ?? b.pos;
}

/** A tracer still counts as on screen this close outside the edge (its width, the muzzle flash). */
const EDGE_SLACK = 0.5;
const MAX_BEARING_ERR = (15 * Math.PI) / 180;
const DIST_LO = 0.6;
const DIST_HI = 1.5;
/** An unseen shooter is never placed closer than this behind the screen edge. */
const MIN_BEHIND = 4;
const BUCKET = 2;

/** A uniform number in [0, 1) from integers (a fixed hash: same inputs, same number). */
export function hash01(a: number, b: number): number {
    let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
}

/**
 * Entry and exit parameters (0..1) of the segment a -> b inside the box centred on `c` with half extents `h`, or null
 * when it misses (Liang-Barsky).
 */
function clipSegment(a: Vec2, b: Vec2, c: Vec2, h: Vec2): [number, number] | null {
    let t0 = 0;
    let t1 = 1;
    const d = { x: b.x - a.x, y: b.y - a.y };
    for (const axis of ["x", "y"] as const) {
        const lo = c[axis] - h[axis] - a[axis];
        const hi = c[axis] + h[axis] - a[axis];
        const da = d[axis];
        if (Math.abs(da) < 1e-9) {
            if (lo > 0 || hi < 0) return null;
            continue;
        }
        let ta = lo / da;
        let tb = hi / da;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) return null;
    }
    return [t0, t1];
}

/**
 * Where an unseen shooter seems to be: `behind` units back along the tracer from `entry` (with the hashed distance
 * error), turned about the bot by the hashed bearing error. The error is the bearing as the bot sees it: turned about
 * the entry point instead, a 15 degree error shrank to about a third to two thirds of that seen from the bot, and return
 * fire at an unseen shooter was nearly as accurate as at a visible one (adversarial review).
 */
function estimateOrigin(entry: Vec2, dir: Vec2, behind: number, shooterId: number, now: number, self: Vec2): Vec2 {
    const bucket = Math.floor(now / BUCKET);
    const bearing = (hash01(shooterId, bucket) * 2 - 1) * MAX_BEARING_ERR;
    const scale = DIST_LO + (DIST_HI - DIST_LO) * hash01(shooterId ^ 0x5bd1e995, bucket);
    const onLine = v2.add(entry, v2.mul(v2.neg(dir), Math.max(MIN_BEHIND, behind * scale)));
    return v2.add(self, v2.rotate(v2.sub(onLine, self), bearing));
}

/** The parameter along a -> a + dir * t at which the ray leaves box `b` (it starts inside). */
function exitParam(a: Vec2, dir: Vec2, b: Bounds): number {
    let t = Number.POSITIVE_INFINITY;
    for (const axis of ["x", "y"] as const) {
        const d = dir[axis];
        if (d > 1e-9) t = Math.min(t, (b.max[axis] - a[axis]) / d);
        else if (d < -1e-9) t = Math.min(t, (b.min[axis] - a[axis]) / d);
    }
    return t;
}

function inBox(p: Vec2, b: Bounds): boolean {
    return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

/**
 * How far the tracer from `a` along `dir` runs under the roofs `roofs` before it shows (0 when it starts in the open):
 * the original client draws bullets under the ceilings (survev client bullet.ts zOrd 20, building.ts ceiling zOrd
 * 750 - zIdx), so a shot fired under someone else's roof shows only from where it leaves the building.
 */
function underRoof(a: Vec2, dir: Vec2, len: number, roofs: readonly Bounds[]): number {
    let s = 0;
    for (let i = 0; i < 8 && s < len; i++) {
        const p = v2.add(a, v2.mul(dir, s));
        let exit = -1;
        for (const b of roofs) if (inBox(p, b)) exit = Math.max(exit, s + exitParam(p, dir, b));
        if (exit < 0) return s;
        s = exit + 1e-3;
    }
    return Math.min(s, len);
}

/**
 * The bullets of a snapshot as a player at `selfPos` with `zoom` sees them: the bot's own bullets as they are, others
 * clipped to the screen (dropped when their tracer never crosses it).
 */
export function perceiveBullets(
    bullets: readonly BulletEvent[],
    selfId: number,
    selfPos: Vec2,
    zoom: number,
    now: number,
    roofs: readonly Bounds[] = [],
): SeenBullet[] {
    const out: SeenBullet[] = [];
    const h = humanScreen(zoom);
    const half = { x: h.x + EDGE_SLACK, y: h.y + EDGE_SLACK };
    for (const b of bullets) {
        if (b.shooterId === selfId) {
            out.push({ ...b, origin: b.pos, clipped: false });
            continue;
        }
        const len = b.endDist ?? b.maxDist;
        const end = v2.add(b.pos, v2.mul(b.dir, len));
        const span = clipSegment(b.pos, end, selfPos, half);
        if (!span) continue;
        // the part under someone else's roof does not show either
        const s = Math.max(span[0] * len, roofs.length ? underRoof(b.pos, b.dir, len, roofs) : 0);
        if (s >= span[1] * len - 1e-6) continue;
        if (s <= 1e-6) {
            out.push({ ...b, origin: b.pos, clipped: false });
            continue;
        }
        const entry = v2.add(b.pos, v2.mul(b.dir, s));
        out.push({
            ...b,
            pos: entry,
            maxDist: Math.max(0, b.maxDist - s),
            ...(b.endDist !== undefined ? { endDist: Math.max(0, b.endDist - s) } : {}),
            origin: estimateOrigin(entry, b.dir, s, b.shooterId, now, selfPos),
            clipped: true,
        });
    }
    return out;
}
