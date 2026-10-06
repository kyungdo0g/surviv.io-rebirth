// Fire discipline and grenade throws. Single-fire guns are clicked at their fire rate plus a human click delay
// (guns with first-shot accuracy are paced by their recoil time at range); automatic guns spray up close and fire
// bursts with pauses at range; burst guns and melee are held. Grenades: select, cook (hold the trigger), release with
// the mouse distance that lands them on the target.
// With the human motor model (motor/human.ts) the trigger finger has its own timing (updateHuman): the cursor is on
// target when its ray passes within hitR x triggerLooseness of the lead point as the bot perceives it (the same delayed
// percept the hand follows), the first click follows a confirmation delay, single-fire guns sometimes click in
// anticipation of the crossing cursor, and automatics keep spraying a moment after the cursor slid off the target.
import type { Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, WeaponSlot } from "@rebirth/defs";
import type { DifficultyParams } from "../difficulty.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { gaussian } from "../motor/noise.ts";
import type { SelfState } from "../perception/world.ts";
import type { ThrowPlan } from "./context.ts";

export interface TriggerOut {
    shootStart: boolean;
    shootHold: boolean;
}

/** Automatic guns spray without pauses inside this distance. */
const SPRAY_DIST = 14;
const MELEE_SWING_PERIOD = 0.25;
const DEG = Math.PI / 180;
/** Human trigger: radius around the lead point that counts as on target before looseness (the legacy tolerance). */
export const TRIGGER_HIT_R = 1.1;
/** Single-fire guns click early this often when the cursor will cross the target within ANTICIPATE_S. */
const ANTICIPATE_P = 0.3;
const ANTICIPATE_S = 0.04;
/** A pending confirmation survives the cursor slipping off the target for this long (s): no restart on a wobble. */
const CONFIRM_GRACE = 0.08;
/**
 * Automatics keep holding this long after the cursor left the target (s). Shorter than a full reaction (80-150 ms):
 * at that length the extra off-target bullets cost the hard preset ~3 points of hit rate (scripts/aimbench.ts).
 */
const HOLD_OVER: [number, number] = [0.03, 0.06];
const MELEE_TOLERANCE = 35 * DEG;
/** A cooked grenade whose aim has not settled is released this long after its planned cook anyway (s). */
const COOK_OVERDUE = 0.6;

/** What the trigger finger sees of the aim (human motor): all vectors relative to the player, world units. */
export interface AimSense {
    /** direction the input carries (cursor plus tremor), unit */
    dir: Vec2;
    /** the hand's cursor and its velocity (units/s) */
    cursor: Vec2;
    cursorVel: Vec2;
    /** the aim point as perceived (HumanMotor.aim) and its velocity; null: nothing to aim at */
    aim: Vec2 | null;
    aimVel: Vec2;
    /** acquisition counter of the motor: a new one restarts the confirmation */
    acquisition: number;
}

/** Distance from `p` to the ray from the player along `dir` (unit): how far the shot passes from `p`. */
export function rayMiss(dir: Vec2, p: Vec2): number {
    const along = v2.dot(p, dir);
    return along <= 0 ? v2.length(p) : Math.abs(v2.det(dir, p));
}

/**
 * Human trigger tolerance: how far from the perceived lead point (world units at its distance `dist`) the cursor ray
 * may pass, or for melee the angle (radians). Shotguns add 40% of their spread, like the legacy tolerance.
 */
export function humanTolerance(weapon: string, dist: number, looseness: number): { miss: number; angle: number } {
    const miss = TRIGGER_HIT_R * looseness;
    if (!weapon || !hasDef(weapon)) return { miss, angle: Number.POSITIVE_INFINITY };
    if (GameObjectDefs[weapon].type === "melee") return { miss: Number.POSITIVE_INFINITY, angle: MELEE_TOLERANCE };
    const info = gunInfo(weapon);
    const spread = info && info.def.bulletCount > 1 ? info.def.shotSpread * 0.4 * DEG : 0;
    return { miss: miss + Math.max(dist, 1) * Math.tan(spread), angle: Number.POSITIVE_INFINITY };
}

function onTargetNow(dir: Vec2, aim: Vec2, tol: { miss: number; angle: number }): boolean {
    if (tol.angle < Number.POSITIVE_INFINITY) {
        const cos = v2.dot(dir, v2.normalizeSafe(aim, dir));
        return Math.acos(Math.max(-1, Math.min(1, cos))) <= tol.angle;
    }
    return rayMiss(dir, aim) <= tol.miss;
}

export class TriggerController {
    private holding = false;
    private burstEnd = 0;
    private pauseUntil = 0;
    private lastClick = Number.NEGATIVE_INFINITY;
    private gap = 0;
    private readonly params: DifficultyParams;
    private readonly rng: Rng;
    // human trigger finger
    private onTgt = false;
    private offAt = Number.NEGATIVE_INFINITY;
    private confirmAt = Number.POSITIVE_INFINITY;
    private anticipate: boolean | null = null;
    private holdUntil = Number.NEGATIVE_INFINITY;
    private spraying = false;
    private acquisition = -1;

    constructor(params: DifficultyParams, rng: Rng) {
        this.params = params;
        this.rng = rng;
    }

    release(): TriggerOut {
        this.holding = false;
        return { shootStart: false, shootHold: false };
    }

    /**
     * Human motor: fires when the cursor ray is on the perceived lead point (`sense.aim`), after the confirmation delay
     * N(confirmDelay, 0.3 confirmDelay) from the moment it got there (kept through slips shorter than CONFIRM_GRACE);
     * single-fire guns click early on 30% of the approaches that will cross the target within 40 ms; automatics hold
     * on HOLD_OVER after leaving it. The fire rate, click delays and bursts are the legacy ones (update). Every draw
     * comes from this controller's rng (the motor's stream for human bots).
     */
    updateHuman(now: number, fire: boolean, sense: AimSense, weapon: string, dist: number): TriggerOut {
        if (sense.acquisition !== this.acquisition) {
            this.acquisition = sense.acquisition;
            this.onTgt = false;
            this.confirmAt = Number.POSITIVE_INFINITY;
            this.anticipate = null;
        }
        const tol = humanTolerance(weapon, dist, this.params.motor.triggerLooseness);
        const aim = sense.aim;
        const on = aim !== null && onTargetNow(sense.dir, aim, tol);
        if (on && !this.onTgt) {
            if (this.confirmAt === Number.POSITIVE_INFINITY || now - this.offAt > CONFIRM_GRACE) {
                const mu = this.params.motor.confirmDelay;
                this.confirmAt = now + Math.max(0, mu + 0.3 * mu * gaussian(this.rng));
            }
            this.anticipate = null;
        } else if (!on && this.onTgt) {
            this.offAt = now;
        }
        this.onTgt = on;
        if (!fire || !aim || !weapon || !hasDef(weapon)) {
            this.spraying = false;
            this.holdUntil = Number.NEGATIVE_INFINITY;
            return this.release();
        }
        const confirmed = on && now >= this.confirmAt;
        if (GameObjectDefs[weapon].type === "melee") return this.update(now, confirmed, weapon, dist);
        const info = gunInfo(weapon);
        if (!info) return this.release();
        if (info.def.fireMode === "single") {
            let want = confirmed;
            if (!on && this.anticipate !== false && this.willCross(sense, tol)) {
                this.anticipate ??= this.rng.bool(ANTICIPATE_P);
                want = this.anticipate;
            }
            return want ? this.update(now, true, weapon, dist) : { shootStart: false, shootHold: false };
        }
        if (confirmed) {
            this.spraying = true;
            this.holdUntil = Number.POSITIVE_INFINITY;
        } else if (this.spraying && this.holdUntil === Number.POSITIVE_INFINITY) {
            this.holdUntil = now + this.rng.range(HOLD_OVER[0], HOLD_OVER[1]);
        }
        if (!confirmed && now >= this.holdUntil) this.spraying = false;
        return this.update(now, this.spraying, weapon, dist);
    }

    /** The cursor, carried by its velocity, will be on the target within ANTICIPATE_S (or sweep across it). */
    private willCross(sense: AimSense, tol: { miss: number; angle: number }): boolean {
        const aim = sense.aim;
        if (!aim || v2.length(sense.cursorVel) < 1) return false;
        const c1 = v2.add(sense.cursor, v2.mul(sense.cursorVel, ANTICIPATE_S));
        const a1 = v2.add(aim, v2.mul(sense.aimVel, ANTICIPATE_S));
        const d1 = v2.normalizeSafe(c1, sense.dir);
        if (onTargetNow(d1, a1, tol)) return true;
        const side0 = v2.det(sense.cursor, aim);
        const side1 = v2.det(c1, a1);
        return side0 * side1 < 0 && v2.dot(d1, a1) > 0 && v2.dot(sense.dir, aim) > 0;
    }

    update(now: number, want: boolean, weapon: string, dist: number): TriggerOut {
        if (!want || !weapon || !hasDef(weapon)) return this.release();
        const def = GameObjectDefs[weapon];
        if (def.type === "melee") {
            const start = now - this.lastClick >= MELEE_SWING_PERIOD;
            if (start) this.lastClick = now;
            return { shootStart: start, shootHold: true };
        }
        const info = gunInfo(weapon);
        if (!info) return this.release();
        const gun = info.def;
        if (gun.fireMode === "single") {
            let interval = Math.max(gun.fireDelay, 0.05) + this.gap;
            if (dist > 18 && gun.recoilTime < 2 && this.params.name !== "easy")
                interval = Math.max(interval, gun.recoilTime);
            if (now - this.lastClick < interval) return { shootStart: false, shootHold: false };
            this.lastClick = now;
            const [lo, hi] = this.params.clickDelay;
            this.gap = this.rng.range(lo, hi);
            return { shootStart: true, shootHold: true };
        }
        const wasHolding = this.holding;
        if (gun.fireMode === "burst" || dist < SPRAY_DIST) {
            this.holding = true;
        } else if (this.holding) {
            if (now >= this.burstEnd) {
                this.holding = false;
                const [lo, hi] = this.params.burstPause;
                this.pauseUntil = now + this.rng.range(lo, hi);
            }
        } else if (now >= this.pauseUntil) {
            const [lo, hi] = this.params.burstShots;
            this.holding = true;
            this.burstEnd = now + this.rng.int(lo, hi) * gun.fireDelay;
        }
        return { shootStart: this.holding && !wasHolding, shootHold: this.holding };
    }
}

export interface ThrowOut extends TriggerOut {
    useItem: string;
    aim: Vec2 | null;
    mouseLen: number;
}

/**
 * Mouse distance that lands a throwable `dist` units away. The throw speed scales linearly with the mouse distance up
 * to GameConfig.player.throwableMaxMouseDist (18); flight plus ground slide carry a full-strength frag about 30 units
 * and a smoke grenade about 22 from the hand, 0.5 ahead of the player (calibrated against the simulation in
 * test/throw.test.ts).
 */
export function throwMouseLen(item: string, dist: number): number {
    const max = GameConfig.player.throwableMaxMouseDist;
    const fullRange = item === "smoke" ? 22.4 : 30;
    return Math.max(0, Math.min(max, ((dist - 0.5) / (fullRange - 0.5)) * max));
}

export class ThrowController {
    plan: ThrowPlan | null = null;
    private phase: "idle" | "equip" | "cook" | "release" = "idle";
    private phaseAt = 0;
    private lastSelect = Number.NEGATIVE_INFINITY;
    /** throws completed (diagnostics) */
    throws = 0;

    get active(): boolean {
        return this.phase !== "idle";
    }

    /** The thrower should stand still: the last moments of the cook and the release (its motion adds to the throw). */
    holdStill(now: number): boolean {
        const plan = this.plan;
        if (!plan) return false;
        return this.phase === "release" || (this.phase === "cook" && now - this.phaseAt >= plan.cook - 0.3);
    }

    start(plan: ThrowPlan, now: number): void {
        this.plan = plan;
        this.phase = "equip";
        this.phaseAt = now;
        this.lastSelect = Number.NEGATIVE_INFINITY;
    }

    cancel(): void {
        this.phase = "idle";
        this.plan = null;
    }

    /**
     * One tick of the throw. `aimReady` (human motor: the cursor rests on the throw point) lets the cook end; a throw
     * whose aim never settles is released COOK_OVERDUE seconds late anyway. The legacy aim is always ready.
     */
    update(now: number, self: SelfState, aimReady = true): ThrowOut {
        const out: ThrowOut = { useItem: "", aim: null, mouseLen: 0, shootStart: false, shootHold: false };
        const plan = this.plan;
        if (!plan || this.phase === "idle") return out;
        out.aim = plan.pos;
        out.mouseLen = throwMouseLen(plan.item, v2.distance(self.pos, plan.pos));
        switch (this.phase) {
            case "equip": {
                const ready =
                    self.curWeapIdx === WeaponSlot.Throwable && self.weapons[WeaponSlot.Throwable]?.type === plan.item;
                if (ready) {
                    this.phase = "cook";
                    this.phaseAt = now;
                    out.shootStart = true;
                    out.shootHold = true;
                } else if (now - this.phaseAt > 1.2 || (self.inventory[plan.item] ?? 0) <= 0) {
                    this.cancel();
                } else if (now - this.lastSelect > 0.4) {
                    this.lastSelect = now;
                    out.useItem = plan.item;
                }
                return out;
            }
            case "cook": {
                const cooked = now - this.phaseAt;
                const due = (cooked >= plan.cook && aimReady) || cooked >= plan.cook + COOK_OVERDUE;
                if (due || self.curWeapIdx !== WeaponSlot.Throwable) {
                    this.phase = "release";
                    this.phaseAt = now;
                    return out;
                }
                out.shootHold = true;
                return out;
            }
            case "release":
                if (now - this.phaseAt > 0.25) {
                    this.throws++;
                    this.cancel();
                }
                return out;
        }
        return out;
    }
}
