// The legacy aim (motor model "legacy", wave 1): the aim angle turns towards the wanted direction at a limited rate,
// plus an error angle that wanders (re-drawn every `errorPeriod`, smoothed), larger against moving targets and right
// after acquiring a target. The bot pulls the trigger once its aim reaches where it believes it should aim (within
// legacyTolerance); the error is what makes it miss. Kept byte for byte so legacy runs replay exactly.
import type { Rng } from "@rebirth/core";
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import type { DifficultyParams } from "../difficulty.ts";
import { angleDelta } from "../geom.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { gaussian } from "./noise.ts";

const DEG = Math.PI / 180;

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

/** Legacy aim tolerance for firing (radians): the target's body plus part of the weapon's spread. */
export function legacyTolerance(weapon: string, dist: number): number {
    const base = Math.atan2(1.1, Math.max(dist, 1));
    if (!weapon || !hasDef(weapon)) return base;
    const def = GameObjectDefs[weapon];
    if (def.type === "melee") return 35 * DEG;
    const info = gunInfo(weapon);
    const spread = info && info.def.bulletCount > 1 ? info.def.shotSpread * 0.4 * DEG : 0;
    return Math.min(25 * DEG, Math.max(1.2 * DEG, base + spread));
}

function clampAbs(v: number, max: number): number {
    return v > max ? max : v < -max ? -max : v;
}
