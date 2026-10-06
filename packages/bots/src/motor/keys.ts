// Human movement keys (motor model "human"): a player walks with 8 WASD directions and holds a key combination for a
// while, so the bot picks the octant of its wanted heading with hysteresis (it changes to another octant only once the
// heading is HYSTERESIS past the current octant's edge) and holds every key state at least U(80, 160) ms. In a fight a
// reversal (a strafe flip, a dodge) may come after U(70, 120) ms, as quick as people do it; outside fights a reversal
// waits until it has been wanted for U(150, 300) ms, so a brain flipping between two goals every decision does not
// make the bot spin on the spot (people commit to a direction). A key direction that presses into an obstacle close by
// is left, after the quick hold, for the free octant nearest the heading (people steer round what they bump into).
// Path following steers at a carrot point a little ahead on the leg the follower walks, so the 8-way motion zig-zags
// along the line (like a person tapping two keys on a long diagonal) instead of drifting away from it. Every draw comes
// from the motor's rng stream. The legacy model keeps its per-tick dithering (Bot.keys).
import type { Collider, Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { angleDelta, distanceToCollider } from "../geom.ts";

const OCTANT = Math.PI / 4;
/** The heading must be this far past the current octant's edge to change keys. */
const HYSTERESIS = (10 * Math.PI) / 180;
/** Minimum hold of a key state (s), and of a reversal (three or more octants away) in a fight or off an obstacle. */
const HOLD: readonly [number, number] = [0.08, 0.16];
const REVERSAL_HOLD: readonly [number, number] = [0.07, 0.12];
/** Outside fights a reversal must be wanted this long first (s). */
const COMMIT: readonly [number, number] = [0.15, 0.3];
/** Look-ahead of the carrot on the path leg (world units). */
export const CARROT_LOOKAHEAD = 2.5;
/** A key direction is blocked when the point PROBE ahead comes closer than BLOCK_DIST to an obstacle (radius 1). */
const PROBE = 0.6;
const BLOCK_DIST = 0.95;

/** Unit direction of an octant. */
export function octantDir(octant: number): Vec2 {
    return { x: Math.cos(octant * OCTANT), y: Math.sin(octant * OCTANT) };
}

/**
 * Whether walking towards `octant` from `pos` runs into one of `colliders` (the obstacles close by): sliding along a
 * wall is free, pressing into it is not.
 */
export function octantFree(pos: Vec2, octant: number, colliders: readonly Collider[]): boolean {
    if (colliders.length === 0) return true;
    const p = v2.add(pos, v2.mul(octantDir(octant), PROBE));
    for (const c of colliders) if (distanceToCollider(p, c) < BLOCK_DIST) return false;
    return true;
}

/** Keys of an octant (0 = right, counter-clockwise, -1 = none) as PlayerInput movement flags. */
export function octantKeys(octant: number): { right: boolean; left: boolean; up: boolean; down: boolean } {
    if (octant < 0) return { right: false, left: false, up: false, down: false };
    const a = octant * OCTANT;
    const x = Math.cos(a);
    const y = Math.sin(a);
    return { right: x > 0.3, left: x < -0.3, up: y > 0.3, down: y < -0.3 };
}

export class KeyStick {
    /** current key octant, -1 when no key is held */
    octant = -1;
    /** key state changes (diagnostics) */
    changes = 0;
    private changedAt = Number.NEGATIVE_INFINITY;
    private holdFor = 0;
    private reverseFor = 0;
    private commitFor = 0;
    /** the octant wanted lately, and since when */
    private wanted = -1;
    private wantedSince = Number.NEGATIVE_INFINITY;
    private readonly rng: Rng;

    constructor(rng: Rng) {
        this.rng = rng;
    }

    /**
     * The octant to hold at `now` for the wanted heading `dir` (null: stand still). `fight`: the heading comes from a
     * fight (strafing, dodging, backing off), where quick reversals are what people do.
     */
    update(dir: Vec2 | null, now: number, fight = false, free?: (octant: number) => boolean): number {
        const blocked = dir !== null && this.octant >= 0 && free !== undefined && !free(this.octant);
        const want = dir ? this.pick(dir, blocked ? free : undefined) : -1;
        if (want !== this.wanted) {
            this.wanted = want;
            this.wantedSince = now;
        }
        if (want === this.octant) return this.octant;
        const held = now - this.changedAt;
        const reversal = want >= 0 && this.octant >= 0 && octantDistance(want, this.octant) >= 3;
        if ((reversal && fight) || blocked) {
            if (held < Math.min(this.reverseFor, this.holdFor)) return this.octant;
        } else if (held < this.holdFor || (reversal && now - this.wantedSince < this.commitFor)) {
            return this.octant;
        }
        this.octant = want;
        this.changedAt = now;
        this.changes++;
        this.holdFor = this.rng.range(HOLD[0], HOLD[1]);
        this.reverseFor = this.rng.range(REVERSAL_HOLD[0], REVERSAL_HOLD[1]);
        this.commitFor = this.rng.range(COMMIT[0], COMMIT[1]);
        return this.octant;
    }

    /**
     * Octant of `dir`, staying in the current one until the heading is HYSTERESIS past its edge. With `free` (the
     * current octant is blocked) the free octant nearest the heading, at most 90 degrees off (sliding round).
     */
    private pick(dir: Vec2, free?: (octant: number) => boolean): number {
        const h = Math.atan2(dir.y, dir.x);
        const nearest = (((Math.round(h / OCTANT) % 8) + 8) % 8) as number;
        if (free) {
            const side = angleDelta(nearest * OCTANT, h) >= 0 ? 1 : 7;
            // nearest, the other octant beside the heading, then one further on each side
            for (const k of [nearest, nearest + side, nearest + 8 - side, nearest + 2 * side]) {
                const o = k % 8;
                if (free(o)) return o;
            }
            return nearest;
        }
        if (this.octant >= 0 && Math.abs(angleDelta(this.octant * OCTANT, h)) <= OCTANT / 2 + HYSTERESIS)
            return this.octant;
        return nearest;
    }
}

function octantDistance(a: number, b: number): number {
    const d = Math.abs(a - b) % 8;
    return Math.min(d, 8 - d);
}

/**
 * Pure pursuit along the follower's current leg: the follower heads for waypoint `points[i]` (its direction is exactly
 * towards it), the leg runs from where the bot was when that waypoint became the target; the carrot sits
 * CARROT_LOOKAHEAD along the leg past the bot's projection on it (the waypoint itself near the leg's end).
 */
export class PathCarrot {
    private wp: Vec2 | null = null;
    private legStart: Vec2 = { x: 0, y: 0 };

    /** Heading towards the carrot; `dir` itself when the follower is not heading for a waypoint (sidestep, stairs). */
    heading(pos: Vec2, points: readonly Vec2[], dir: Vec2): Vec2 {
        let wp: Vec2 | null = null;
        for (const p of points) {
            const to = v2.sub(p, pos);
            const len = v2.length(to);
            if (len > 1e-6 && Math.abs(to.x / len - dir.x) < 1e-6 && Math.abs(to.y / len - dir.y) < 1e-6) {
                wp = p;
                break;
            }
        }
        if (!wp) {
            this.wp = null;
            return dir;
        }
        if (!this.wp || this.wp.x !== wp.x || this.wp.y !== wp.y) {
            this.wp = v2.copy(wp);
            this.legStart = v2.copy(pos);
        }
        const leg = v2.sub(wp, this.legStart);
        const len = v2.length(leg);
        if (len < 1e-6) return dir;
        const u = v2.div(leg, len);
        const t = Math.max(0, Math.min(len, v2.dot(v2.sub(pos, this.legStart), u)));
        const carrot = v2.add(this.legStart, v2.mul(u, Math.min(len, t + CARROT_LOOKAHEAD)));
        return v2.normalizeSafe(v2.sub(carrot, pos), dir);
    }

    clear(): void {
        this.wp = null;
    }
}
