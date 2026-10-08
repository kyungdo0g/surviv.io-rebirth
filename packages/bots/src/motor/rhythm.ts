// Stop-and-go rhythm of a person walking with WASD (motor model "human", round 5, user report 36: "bot-typical stiff
// movement"). Measured on the owner's gameplay videos (scratchpad video/, 1934 s; the player is centred, so its motion
// is the background scroll, by phase correlation at 30 Hz) against bots of the same build (population mix, solo
// matches, 30 Hz positions; src/metrics/moveStats.ts):
//
//   statistic                                               human        bots before   bots after
//   moving share                                            0.66         0.79          0.70
//   stops of 0.2 s or more per minute                       17.3         10.9          19.2
//   moving run between such stops, median / p90 (s)         0.83 / 4.6   1.87 / 10.8   1.3 / 5.2
//
// A person lifts the keys every few seconds even with nowhere urgent to go: to look around, read the minimap, line up a
// door or an item, change their mind. So while the bot travels calmly (no enemy in view, not under fire, no hurry:
// Bot decides "calm"), the keys are released now and then: after a walk of WALK_MIN..WALK_MAX seconds (skewed short),
// for PAUSE_MIN..PAUSE_MAX (median about 0.3 s, now and then a second or more); and a turn of 90 degrees or more is
// often taken with the fingers lifted for a moment (TURN_PAUSE). Anything not calm ends a pause at once. Strafing in a
// gunfight goes stop, shoot, move (STUTTER_*): people stop for a shot between strafe steps. Every draw comes from the
// motor's rng stream.
import type { Rng } from "@rebirth/core";

/** Calm walking between two pauses (s): WALK_MIN + (WALK_MAX - WALK_MIN) * u^WALK_SKEW. */
const WALK_MIN = 1;
const WALK_MAX = 6;
const WALK_SKEW = 1.8;
/** A pause (s): PAUSE_MIN + (PAUSE_MAX - PAUSE_MIN) * u^PAUSE_SKEW (median about 0.3 s). */
const PAUSE_MIN = 0.12;
const PAUSE_MAX = 1.6;
const PAUSE_SKEW = 3;
/** Strafing with a gun out: a stop to shoot after STUTTER_WALK (s), for STUTTER_PAUSE (s), both skewed short. */
const STUTTER_WALK: readonly [number, number] = [0.5, 2];
const STUTTER_PAUSE: readonly [number, number] = [0.1, 0.5];
/** A calm turn of 2+ octants: the chance of a lift, and its length (s). */
const TURN_PAUSE = 0.25;
const TURN_MIN = 0.06;
const TURN_MAX = 0.22;

export class WalkRhythm {
    /** pauses taken (diagnostics) */
    pauses = 0;
    private walked = 0;
    private walkFor = 0;
    private pauseUntil = Number.NEGATIVE_INFINITY;
    private last = Number.NaN;
    /** strafing: how long since the last stop, and the walk drawn until the next */
    private strafed = 0;
    private strafeFor = 0;
    private readonly rng: Rng;

    constructor(rng: Rng) {
        this.rng = rng;
        this.walkFor = this.drawWalk();
    }

    private drawWalk(): number {
        return WALK_MIN + (WALK_MAX - WALK_MIN) * this.rng.next() ** WALK_SKEW;
    }

    /**
     * Whether the keys are lifted at `now`. `moving`: the bot wants to move; `calm`: calm travel; `turn`: the wanted
     * octant just changed by two octants or more; `stutter`: strafing with a gun out (stop, shoot, move on).
     */
    paused(now: number, moving: boolean, calm: boolean, turn: boolean, stutter = false): boolean {
        const dt = Number.isNaN(this.last) ? 0 : Math.max(0, Math.min(0.1, now - this.last));
        this.last = now;
        if (stutter && moving) return this.stutter(now, dt);
        this.strafed = 0;
        if (!calm || !moving) {
            this.pauseUntil = Number.NEGATIVE_INFINITY;
            return false;
        }
        if (now < this.pauseUntil) return true;
        if (turn && this.rng.next() < TURN_PAUSE) {
            this.pauseUntil = now + this.rng.range(TURN_MIN, TURN_MAX);
            this.pauses++;
            return true;
        }
        this.walked += dt;
        if (this.walked < this.walkFor) return false;
        this.walked = 0;
        this.walkFor = this.drawWalk();
        this.pauseUntil = now + PAUSE_MIN + (PAUSE_MAX - PAUSE_MIN) * this.rng.next() ** PAUSE_SKEW;
        this.pauses++;
        return true;
    }

    /** The stop-and-shoot rhythm of a strafing gunfight. */
    private stutter(now: number, dt: number): boolean {
        if (now < this.pauseUntil) return true;
        if (this.strafed === 0) this.strafeFor = skewed(this.rng, STUTTER_WALK, 1.4);
        this.strafed += dt;
        if (this.strafed < this.strafeFor) return false;
        this.strafed = 0;
        this.pauseUntil = now + skewed(this.rng, STUTTER_PAUSE, 2);
        this.pauses++;
        return true;
    }
}

/** lo + (hi - lo) * u^k: skewed towards `lo`. */
function skewed(rng: Rng, [lo, hi]: readonly [number, number], k: number): number {
    return lo + (hi - lo) * rng.next() ** k;
}
