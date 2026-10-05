// Fire discipline and grenade throws. Single-fire guns are clicked at their fire rate plus a human click delay
// (guns with first-shot accuracy are paced by their recoil time at range); automatic guns spray up close and fire
// bursts with pauses at range; burst guns and melee are held. Grenades: select, cook (hold the trigger), release with
// the mouse distance that lands them on the target.
import type { Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, WeaponSlot } from "@rebirth/defs";
import type { DifficultyParams } from "../difficulty.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import type { SelfState } from "../perception/world.ts";
import type { ThrowPlan } from "./context.ts";

export interface TriggerOut {
    shootStart: boolean;
    shootHold: boolean;
}

/** Automatic guns spray without pauses inside this distance. */
const SPRAY_DIST = 14;
const MELEE_SWING_PERIOD = 0.25;

export class TriggerController {
    private holding = false;
    private burstEnd = 0;
    private pauseUntil = 0;
    private lastClick = Number.NEGATIVE_INFINITY;
    private gap = 0;
    private readonly params: DifficultyParams;
    private readonly rng: Rng;

    constructor(params: DifficultyParams, rng: Rng) {
        this.params = params;
        this.rng = rng;
    }

    release(): TriggerOut {
        this.holding = false;
        return { shootStart: false, shootHold: false };
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
            if (dist > 18 && gun.recoilTime < 2 && this.params.name !== "easy") interval = Math.max(interval, gun.recoilTime);
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
 * Mouse distance that lands a throwable `dist` units away. The throw speed scales with the mouse distance up to
 * GameConfig.player.throwableMaxMouseDist; the flight plus ground slide carries a full-strength frag about 26 units
 * (calibrated against the simulation in test/throw.test.ts).
 */
export function throwMouseLen(item: string, dist: number): number {
    const max = GameConfig.player.throwableMaxMouseDist;
    const fullRange = item === "smoke" ? 19 : 26;
    return Math.max(0, Math.min(max, (dist / fullRange) * max));
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

    update(now: number, self: SelfState): ThrowOut {
        const out: ThrowOut = { useItem: "", aim: null, mouseLen: 0, shootStart: false, shootHold: false };
        const plan = this.plan;
        if (!plan || this.phase === "idle") return out;
        out.aim = plan.pos;
        out.mouseLen = throwMouseLen(plan.item, v2.distance(self.pos, plan.pos));
        switch (this.phase) {
            case "equip": {
                const ready = self.curWeapIdx === WeaponSlot.Throwable && self.weapons[WeaponSlot.Throwable]?.type === plan.item;
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
            case "cook":
                if (now - this.phaseAt >= plan.cook || self.curWeapIdx !== WeaponSlot.Throwable) {
                    this.phase = "release";
                    this.phaseAt = now;
                    return out;
                }
                out.shootHold = true;
                return out;
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
