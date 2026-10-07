// Human movement keys (motor model "human"): a player walks with 8 WASD directions and holds a key combination for a
// while, so the bot picks the octant of its wanted heading with hysteresis (it changes to another octant only once the
// heading is HYSTERESIS past the current octant's edge) and holds every key state at least HOLD. A reversal (three or
// more octants: a strafe flip) needs the current keys held REVERSAL_HOLD first in a fight, and only a dodge (Intent
// urgent) reverses within ~100 ms; outside fights a reversal waits until it has been wanted for COMMIT, so a brain
// flipping between two goals every decision does not make the bot spin on the spot (people commit to a direction). A
// key direction that presses into an obstacle close by is left, after the quick hold, for the free octant nearest the
// heading (people steer round what they bump into). Path following steers at a carrot point a little ahead on the leg
// the follower walks, so the 8-way motion zig-zags along the line (like a person tapping two keys on a long diagonal)
// instead of drifting away from it. Calm travel lifts the keys now and then (motor/rhythm.ts). Every draw comes from
// the motor's rng stream. The legacy model keeps its per-tick dithering (Bot.keys).
//
// Round 5 (user report 36, "bot-typical stiff movement"): the owner's gameplay videos (1934 s, the player's motion from
// the background scroll at 30 Hz, a key direction per frame within 15 degrees of an octant) against bots of the same
// build (solo population matches, positions at 30 Hz, the same analysis: src/metrics/moveStats.ts, scripts/movestats.ts):
//
//   statistic                                     human          bots before    bots after
//   key hold (one direction) p50 / p90 (s)        0.27 / 0.87    0.20 / 0.60    0.30 / 0.80
//   direction changes per moving second           2.1            3.2            2.3
//   reversals (>= 135 deg) per moving minute      16             37 (fights 87) 22 (fights 32)
//   per-10 s window reversals/min p50 / p90       6.9 / 24       18 / 63        12 / 30
//
// so the holds, the hysteresis, the carrot and the reversal holds grew (were 80-160 ms, 10 degrees, 2.5 units and
// 70-120 ms in fights), a goal a few steps away is still lined up with short taps (StickMode.fine), only dodges,
// evasions and the first turn into a fight reverse at once (StickMode.urgent, engage: the aim bench's first shot), and
// the fight strafe legs got longer (brain/tactics.ts).
// test/movestats.test.ts pins the bands.
import type { Collider, Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { angleDelta, distanceToCollider } from "../geom.ts";
import { WalkRhythm } from "./rhythm.ts";

const OCTANT = Math.PI / 4;
/** The heading must be this far past the current octant's edge to change keys. */
export const HYSTERESIS_DEG = 15;
const HYSTERESIS = (HYSTERESIS_DEG * Math.PI) / 180;
/** Minimum hold of a key state (s). */
const HOLD: readonly [number, number] = [0.12, 0.24];
/** A reversal (three or more octants away) in a fight needs the current keys held this long first (s)... */
const REVERSAL_HOLD: readonly [number, number] = [0.4, 0.85];
/** ...a dodge (Intent.urgent), a slide off an obstacle or a tap lining up on a close goal only this long. */
const QUICK_HOLD: readonly [number, number] = [0.07, 0.12];
/** Outside fights a reversal must be wanted this long first (s). */
const COMMIT: readonly [number, number] = [0.3, 0.55];
/** A stop this recent still counts the keys before it for a reversal (s). */
const RECENT_STOP = 1;
/** Look-ahead of the carrot on the path leg (world units). */
export const CARROT_LOOKAHEAD = 3.5;
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

/** How the wanted heading comes about (KeyStick.update). */
export interface StickMode {
    /** calm travel: the keys are lifted now and then (motor/rhythm.ts) */
    calm?: boolean;
    /** a dodge: a reversal may come within ~100 ms */
    urgent?: boolean;
    /** strafing with a gun out: stop, shoot, move on (motor/rhythm.ts) */
    stutter?: boolean;
    /** a few steps from the goal: short taps to line up on it (a crate's corner, a cover spot, an item) */
    fine?: boolean;
    /** the bot engages an enemy (the "fight" behaviour): its first reversal out of other keys is no strafe flip */
    engage?: boolean;
}

export class KeyStick {
    /** current key octant, -1 when no key is held */
    octant = -1;
    /** key state changes (diagnostics) */
    changes = 0;
    /** the stop-and-go rhythm of calm travel */
    readonly rhythm: WalkRhythm;
    private changedAt = Number.NEGATIVE_INFINITY;
    private holdFor = 0;
    private reverseFor = 0;
    private quickFor = 0;
    private commitFor = 0;
    /** the octant wanted lately, and since when */
    private wanted = -1;
    private wantedSince = Number.NEGATIVE_INFINITY;
    /** the last octant held while moving (a turn after a lift is judged against it), and the octant last picked */
    private lastMoving = -1;
    private raw = -1;
    /** the keys held were chosen in an engagement (StickMode.engage: a reversal from them is a strafe flip) */
    private engagedKeys = false;
    private readonly rng: Rng;

    constructor(rng: Rng) {
        this.rng = rng;
        this.rhythm = new WalkRhythm(rng);
    }

    /**
     * The octant to hold at `now` for the wanted heading `dir` (null: stand still). `fight`: the heading comes from a
     * fight (strafing, backing off), where reversals come after REVERSAL_HOLD instead of a committed want.
     */
    update(
        dir: Vec2 | null,
        now: number,
        fight = false,
        free?: (octant: number) => boolean,
        mode: StickMode = {},
    ): number {
        const blocked = dir !== null && this.octant >= 0 && free !== undefined && !free(this.octant);
        let want = dir ? this.pick(dir, blocked ? free : undefined) : -1;
        // a new heading two or more octants off the last keys held (a turn a person often takes with lifted fingers)
        const turn =
            want !== this.raw && want >= 0 && this.lastMoving >= 0 && octantDistance(want, this.lastMoving) >= 2;
        this.raw = want;
        const stutter = !!mode.stutter && !mode.urgent;
        const calm = !!mode.calm && !fight && !mode.fine;
        if (this.rhythm.paused(now, want >= 0, calm, turn, stutter)) want = -1;
        if (want !== this.wanted) {
            this.wanted = want;
            this.wantedSince = now;
        }
        if (want === this.octant) return this.octant;
        const held = now - this.changedAt;
        // (just stopped: a turn is still judged against the keys held before the stop)
        const base = this.octant >= 0 ? this.octant : held < RECENT_STOP ? this.lastMoving : -1;
        const reversal = want >= 0 && base >= 0 && octantDistance(want, base) >= 3;
        // (the first turn into a fight is no strafe flip: the reaction to the enemy already delayed the keys, bot.ts
        // gateReaction; holding the travel keys on would walk the bot off its first shot)
        const engaging = !!mode.engage && !this.engagedKeys;
        if (blocked || mode.fine || (reversal && (mode.urgent || engaging))) {
            if (held < Math.min(this.quickFor, this.holdFor)) return this.octant;
        } else if (reversal && fight) {
            if (held < this.reverseFor) return this.octant;
        } else if (want >= 0 && (held < this.holdFor || (reversal && now - this.wantedSince < this.commitFor))) {
            return this.octant;
        }
        this.octant = want;
        if (want >= 0) {
            this.lastMoving = want;
            this.engagedKeys = !!mode.engage;
        }
        this.changedAt = now;
        this.changes++;
        this.holdFor = this.rng.range(HOLD[0], HOLD[1]);
        this.reverseFor = this.rng.range(REVERSAL_HOLD[0], REVERSAL_HOLD[1]);
        this.quickFor = this.rng.range(QUICK_HOLD[0], QUICK_HOLD[1]);
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
