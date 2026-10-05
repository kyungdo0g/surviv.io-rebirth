// Human-like aiming: the aim turns towards the wanted direction at a limited rate, plus an error angle that wanders
// (re-drawn every `errorPeriod`, smoothed), larger against moving targets and right after acquiring a target. The bot
// pulls the trigger once its aim reaches where it believes it should aim; the error is what makes it miss.
import type { Rng } from "@rebirth/core";
import type { DifficultyParams } from "../difficulty.ts";
import { angleDelta } from "../geom.ts";

const DEG = Math.PI / 180;

/** Standard normal sample (Box-Muller) from a seeded rng. */
export function gaussian(rng: Rng): number {
    const u = Math.max(rng.next(), 1e-9);
    const v = rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class AimController {
    /** current aim angle (radians) */
    angle = 0;
    private err = 0;
    private errGoal = 0;
    private errTimer = 0;
    private targetId = 0;
    private acquiredAt = 0;
    private readonly params: DifficultyParams;
    private readonly rng: Rng;

    constructor(params: DifficultyParams, rng: Rng) {
        this.params = params;
        this.rng = rng;
    }

    /**
     * Advances the aim by `dt` towards `wanted` (null: drift towards `idle`, the walking direction). Returns the
     * angle the bot believes is right (wanted plus its error) so callers can tell when the aim is on it.
     */
    update(
        dt: number,
        now: number,
        wanted: number | null,
        idle: number | null,
        targetId: number,
        targetSpeed: number,
    ): number {
        const p = this.params;
        const maxTurn = p.turnRateDeg * DEG * dt;
        if (wanted === null) {
            this.targetId = 0;
            if (idle !== null) this.angle += clampAbs(angleDelta(this.angle, idle), maxTurn * 0.5);
            return this.angle;
        }
        if (targetId !== this.targetId) {
            this.targetId = targetId;
            this.acquiredAt = now;
            this.errTimer = 0;
        }
        this.errTimer -= dt;
        if (this.errTimer <= 0) {
            this.errTimer = p.errorPeriod * this.rng.range(0.7, 1.3);
            const settle = Math.max(0, 1 - (now - this.acquiredAt) / Math.max(p.settleTime, 1e-3));
            const sigma = (p.aimErrorDeg + p.aimErrorPerSpeed * targetSpeed) * (1 + (p.acquireErrorMult - 1) * settle);
            this.errGoal = gaussian(this.rng) * sigma * DEG;
        }
        this.err += (this.errGoal - this.err) * Math.min(1, dt * 10);
        const goal = wanted + this.err;
        this.angle += clampAbs(angleDelta(this.angle, goal), maxTurn);
        return goal;
    }

    /** Whether the aim has reached `goal` within `tolerance` radians. */
    onTarget(goal: number, tolerance: number): boolean {
        return Math.abs(angleDelta(this.angle, goal)) <= tolerance;
    }
}

function clampAbs(v: number, max: number): number {
    return v > max ? max : v < -max ? -max : v;
}
