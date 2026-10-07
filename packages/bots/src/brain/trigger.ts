// Fire discipline and grenade throws. Single-fire guns are clicked at their fire rate plus a human click delay
// (guns with first-shot accuracy are paced by their recoil time at range); automatic guns spray up close and fire
// bursts with pauses at range; burst guns and melee are held. Grenades: select, cook (hold the trigger), release with
// the mouse distance that lands them on the target.
// With the human motor model (motor/human.ts) the trigger finger has its own timing (updateHuman): the cursor is on
// target when its ray passes within hitR x triggerLooseness of the lead point as the bot perceives it (the same delayed
// percept the hand follows), the first click follows a confirmation delay, single-fire guns sometimes click in
// anticipation of the crossing cursor, and automatics keep spraying a moment after the cursor slid off the target.
// Human timing (bot overhaul COMBAT-3/12, diagnosis round 1 issue 1 RC2 and round 2 issue 2 RC3): a target stepping
// out of cover is not shot on the tick it shows (the confirmation starts over when the brain's fire comes back after
// such an exposure, on top of the brain's exposure reaction), and melee clicks come at the weapon's own cooldown plus a human click gap instead
// of a perfect 0.25 s rhythm. A started throw can be broken off (ThrowController.abort): before the cook nothing is
// lost; a cooking grenade is released at once at its planned point (switching away would drop it at the feet). A cooking
// frag is always released with brain/fragMath.ts HAND_SAFETY of fuse left (round 3 item 24).
import type { Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, type MeleeDef, WeaponSlot } from "@rebirth/defs";
import type { DifficultyParams } from "../difficulty.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { gaussian } from "../motor/noise.ts";
import type { SelfState } from "../perception/world.ts";
import type { ThrowPlan } from "./context.ts";
import { cookDeadline, runningThrowPoint } from "./fragMath.ts";

export interface TriggerOut {
    shootStart: boolean;
    shootHold: boolean;
}

/** Automatic guns spray without pauses inside this distance. */
const SPRAY_DIST = 14;
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
/**
 * A cooked grenade whose aim has not settled is released this long after its planned cook anyway (s); under the
 * frag metric's 0.5 s "held too long" line (evaluation F2: at 0.6 the frag burst early and short).
 */
const COOK_OVERDUE = 0.4;
/** An uncooked throw waits at most this long with the throwable in hand for the cursor before the pin is pulled. */
const AIM_WAIT = 0.6;
/**
 * A planned cook this short is an uncooked throw (escape 0, waste 0.1, smoke 0.15): it waits for the cursor before the
 * pin is pulled and then goes at once (evaluation F1: thrown on the run, the cursor never settled and escape frags were
 * held to the overdue, 0.3-0.7 s, only 38% left the hand uncooked).
 */
const QUICK_COOK = 0.15;
/** A cooked throw whose checked path is blocked at the release waits for it at most this long past its plan (s). */
const HOLD_BLOCKED = 0.4;

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
    /**
     * the target just stepped out of cover after the bot had reacted to it (a fresh exposure, brain/combatMemory.ts):
     * fire coming back then restarts the confirmation; a first sighting's reaction already covers the click
     */
    reexposed?: boolean;
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
    /** the brain's fire flag at the last update: the confirmation starts over when it comes back */
    private lastFire = false;
    /** click gap after the last melee swing (params.clickDelay) */
    private meleeGap = 0;

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
        // fire released: no confirmation runs; when it comes back with the cursor already on, the click waits a fresh
        // confirmation delay (no instant shot the moment a covered target's line of fire opens)
        const resumed = fire && !this.lastFire;
        this.lastFire = fire;
        if (resumed && on && this.onTgt && sense.reexposed) {
            const mu = this.params.motor.confirmDelay;
            this.confirmAt = now + Math.max(0, mu + 0.3 * mu * gaussian(this.rng));
            this.anticipate = null;
        }
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
            // the weapon's cooldown plus a human click gap: clicks during the swing are lost, a hand is not a metronome
            const period = (def as MeleeDef).attack.cooldownTime + this.meleeGap;
            const start = now - this.lastClick >= period;
            if (start) {
                this.lastClick = now;
                const [lo, hi] = this.params.clickDelay;
                this.meleeGap = this.rng.range(lo, hi);
            }
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

/**
 * Where the cursor goes for `plan` thrown from `pos` while moving at `vel`: the planned point, or for a throw on the
 * run (ThrowPlan.run, round 4) the point that allows for the share `comp` of the thrower's motion its hand manages.
 */
export function throwAimPoint(plan: ThrowPlan, pos: Vec2, vel: Vec2): Vec2 {
    return plan.run ? runningThrowPoint(plan.item, pos, plan.pos, vel, plan.comp ?? 0) : plan.pos;
}

export class ThrowController {
    plan: ThrowPlan | null = null;
    private phase: "idle" | "equip" | "cook" | "release" = "idle";
    private phaseAt = 0;
    private lastSelect = Number.NEGATIVE_INFINITY;
    /** throws completed (diagnostics) */
    throws = 0;
    /** cooking grenades broken off and released at their planned point early (abort; diagnostics, not in `throws`) */
    aborted = 0;
    /** checked throws called off before the pin was pulled because the path from the hand was blocked (round 4) */
    calledOff = 0;
    private breaking = false;
    /** when the throwable came into the hand in this throw's equip phase (-1: not yet) */
    private readyAt = -1;

    get active(): boolean {
        return this.phase !== "idle";
    }

    /**
     * The thrower should stand still: the last moments of the cook and the release (its motion adds to the throw);
     * a throw whose path the bot checked (ThrowPlan.check) the whole cook, so the path stays the one it checked; never
     * a throw on the run (round 4: a frag thrown back while escaping).
     */
    holdStill(now: number): boolean {
        const plan = this.plan;
        if (!plan || plan.run) return false;
        if (plan.check && this.phase === "cook") return true;
        return this.phase === "release" || (this.phase === "cook" && now - this.phaseAt >= plan.cook - 0.3);
    }

    start(plan: ThrowPlan, now: number): void {
        this.plan = plan;
        this.phase = "equip";
        this.phaseAt = now;
        this.lastSelect = Number.NEGATIVE_INFINITY;
        this.breaking = false;
        this.readyAt = -1;
    }

    cancel(): void {
        this.phase = "idle";
        this.plan = null;
    }

    /** The grenade is in the hand being cooked (from the first shootStart until the release). */
    get cooking(): boolean {
        return this.phase === "cook";
    }

    /**
     * Breaks the throw off (an enemy rushed in): before the cook it is simply cancelled; a cooking grenade is released
     * now towards its planned point (the release phase lets go of the trigger) rather than dropped at the feet.
     */
    abort(now: number): void {
        if (this.phase === "equip") this.cancel();
        else if (this.phase === "cook") {
            this.phase = "release";
            this.phaseAt = now;
            this.breaking = true;
        }
    }

    /**
     * One tick of the throw. `aimReady` (human motor: the cursor rests on the throw point) lets the cook end; a throw
     * whose aim never settles is released COOK_OVERDUE seconds late anyway. The legacy aim is always ready. `selfVel`
     * (the thrower's motion) matters only to a throw on the run (throwAimPoint). `clear` (round 4: the path from the
     * hand to ThrowPlan.check is free, Bot tests it) matters only to a checked throw: blocked when the pin would be
     * pulled, the throw is called off (the frag stays in the bag); blocked at the release, a cooked frag is held up to
     * HOLD_BLOCKED past its plan (an uncooked one or one thrown on the run goes anyway).
     */
    update(now: number, self: SelfState, aimReady = true, selfVel: Vec2 = { x: 0, y: 0 }, clear = true): ThrowOut {
        const out: ThrowOut = { useItem: "", aim: null, mouseLen: 0, shootStart: false, shootHold: false };
        const plan = this.plan;
        if (!plan || this.phase === "idle") return out;
        out.aim = throwAimPoint(plan, self.pos, selfVel);
        out.mouseLen = throwMouseLen(plan.item, v2.distance(self.pos, out.aim));
        switch (this.phase) {
            case "equip": {
                const ready =
                    self.curWeapIdx === WeaponSlot.Throwable && self.weapons[WeaponSlot.Throwable]?.type === plan.item;
                if (ready && this.readyAt < 0) this.readyAt = now;
                // an uncooked throw (cook 0: a frag thrown back on the run, round 4) pulls the pin once the cursor is on
                // the throw point (at most AIM_WAIT later), so it leaves the hand at once instead of burning its fuse
                const aimed = plan.cook > QUICK_COOK || aimReady || now - this.readyAt >= AIM_WAIT;
                if (ready && aimed && plan.check && !clear) {
                    this.calledOff++;
                    this.cancel();
                } else if (ready && aimed) {
                    this.phase = "cook";
                    this.phaseAt = now;
                    out.shootStart = true;
                    out.shootHold = true;
                } else if (ready) {
                    // in the hand, waiting for the cursor (an uncooked throw)
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
                // never past the fuse less HAND_SAFETY, whatever the aim (round 3 item 24: never in the hand)
                const deadline = cookDeadline(plan.item);
                // an uncooked throw waited for the cursor before the pin came out: it goes now
                const quick = plan.cook <= QUICK_COOK;
                const due =
                    (cooked >= plan.cook && (aimReady || quick)) ||
                    cooked >= plan.cook + COOK_OVERDUE ||
                    cooked >= deadline;
                // a checked throw whose path got blocked waits a moment for it to clear (never an uncooked one or one
                // thrown on the run: evaluation F2, 7 of the 10 frags held to the deadline were escape throws)
                const held =
                    !!plan.check &&
                    !clear &&
                    !quick &&
                    !plan.run &&
                    cooked < Math.min(deadline, plan.cook + HOLD_BLOCKED);
                if ((due && !held) || self.curWeapIdx !== WeaponSlot.Throwable) {
                    this.phase = "release";
                    this.phaseAt = now;
                    return out;
                }
                out.shootHold = true;
                return out;
            }
            case "release":
                if (now - this.phaseAt > 0.25) {
                    if (this.breaking) this.aborted++;
                    else this.throws++;
                    this.cancel();
                }
                return out;
        }
        return out;
    }
}
