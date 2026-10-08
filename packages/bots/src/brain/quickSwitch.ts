// Quick-switching (bot round 6, user report 44; BrainFeatures.quickSwitch, expert tier only: "strong players do it, the
// owner can't, nor can lower tiers"). After a shot with a slow-cycling gun (a bolt sniper, a pump shotgun, a slow DMR:
// its fireDelay longer than the cheap switch), an expert swaps to its other loaded gun instead of waiting out the cycle,
// and fires that. Only what the sim lets any human do (survev server weaponManager setCurWeapIndex, sim
// weapons/weaponManager.ts): a switch costs the new gun's switchDelay, except one cheap switch (baseSwitchDelay,
// 0.25 s) per freeSwitchCooldown (1 s); two guns of one deploy group (m870 <-> spas12) switch at the full delay while
// the current one still cycles. So the bot quick-switches only when the cheap switch is ready (the snapshot's free
// switch clock, LocalPlayerState.cooldowns.freeSwitch, and its own last switch) and the other gun is of another deploy
// group with a round in its magazine, and then holds the other gun for QUICK_HOLD (the brain's stale slot must not
// pull the slow gun back at the full delay before the other gun has fired).
// The order matters: the sim handles a tick's actions before its shot (sim world/player.ts update), so a switch sent
// with the click would cancel the shot. The click only arms the switch; the key goes out once the shot shows in the
// snapshot (a round left the magazine), like a player who sees the shot and presses the key. The trigger is then rearmed
// for the other gun when its cheap switch is over (its click interval is that gun's own), and clicks again when a
// click came too early and fired nothing.
import { GameConfig, GameObjectDefs, type GunDef, hasDef, Input, WeaponSlot } from "@rebirth/defs";
import { gunInfo } from "../knowledge/weapons.ts";
import type { SelfState } from "../perception/world.ts";

const CHEAP_SWITCH = GameConfig.player.baseSwitchDelay;
const FREE_EVERY = GameConfig.player.freeSwitchCooldown;
/** A gun is slow when its fireDelay beats the cheap switch by this much (worth skipping). */
const SLOW_MARGIN = 0.15;
/** After a quick switch the other gun stays in hand this long (or until it fired). */
export const QUICK_HOLD = 1;
/** The armed switch is dropped when no round left the magazine this long after the click (the click was lost). */
const SHOT_WAIT = 0.25;
/** The other gun's first click comes this long after the switch key (the cheap switch and a tick or two). */
export const QUICK_CLICK = CHEAP_SWITCH + 0.04;
/** A click on the other gun that fired nothing (it was still switching) is repeated after this long. */
const RECLICK = 0.12;

/** The trigger finger as the quick switch drives it (brain/trigger.ts TriggerController). */
export interface QuickTrigger {
    rearm(at: number): void;
    readonly lastClickAt: number;
}

function gunDef(id: string): GunDef | undefined {
    return id && hasDef(id) && GameObjectDefs[id].type === "gun" ? (GameObjectDefs[id] as GunDef) : undefined;
}

/** Whether a gun cycles slower than a cheap switch (worth quick-switching after a shot). */
export function slowCycling(id: string): boolean {
    const def = gunDef(id);
    return !!def && def.fireMode === "single" && def.fireDelay >= CHEAP_SWITCH + SLOW_MARGIN;
}

export class QuickSwitch {
    /** when the next cheap switch is ready (own clock), from the snapshot and the bot's own switches */
    private freeAt = Number.NEGATIVE_INFINITY;
    /** until when the other gun is held after a quick switch */
    holdUntil = Number.NEGATIVE_INFINITY;
    /** quick switches made (diagnostics, tests) */
    count = 0;
    /** a click with a slow gun: its slot, the rounds in its magazine then and when */
    private armed: { slot: number; ammo: number; at: number } | null = null;
    /** the other gun after a quick switch, until it fired */
    private follow: { slot: number; ammo: number; from: number } | null = null;

    /** The snapshot's free switch clock (seconds until the next cheap switch), at own time `now`. */
    observe(now: number, freeSwitch: number | undefined): void {
        if (freeSwitch !== undefined) this.freeAt = Math.max(this.freeAt, now + freeSwitch);
    }

    /** Any switch the bot asks for: a cheap one when ready, which starts the clock again (the sim's rule). */
    noteSwitch(now: number): void {
        if (now >= this.freeAt) this.freeAt = now + FREE_EVERY;
    }

    /** The slot to quick-switch to from the gun in hand now, or null (see the header). */
    target(now: number, self: SelfState): number | null {
        if (now < this.freeAt) return null;
        const cur = self.curWeapIdx;
        if (cur !== WeaponSlot.Primary && cur !== WeaponSlot.Secondary) return null;
        const curId = self.weapons[cur]?.type ?? "";
        if (!slowCycling(curId)) return null;
        const other = cur === WeaponSlot.Primary ? WeaponSlot.Secondary : WeaponSlot.Primary;
        const o = self.weapons[other];
        const oDef = gunDef(o?.type ?? "");
        if (!oDef || (o?.ammo ?? 0) <= 0 || (gunInfo(o.type)?.score ?? 0) <= 0) return null;
        const curGroup = gunDef(curId)?.deployGroup;
        if (curGroup !== undefined && curGroup === oDef.deployGroup) return null;
        return other;
    }

    /**
     * Once per input, after the trigger: arms on a click (`clicked`) with a slow gun; returns the equip action (defs
     * Input) when an armed shot has left the magazine, and rearms `trigger` for the other gun.
     */
    step(now: number, self: SelfState, trigger: QuickTrigger, clicked: boolean): number | null {
        const out = this.poll(now, self, trigger);
        if (clicked && out === null && this.target(now, self) !== null) {
            const cur = self.curWeapIdx;
            this.armed = { slot: cur, ammo: self.weapons[cur]?.ammo ?? 0, at: now };
        }
        return out;
    }

    private poll(now: number, self: SelfState, trigger: QuickTrigger): number | null {
        const f = this.follow;
        if (f) {
            const shot = (self.weapons[f.slot]?.ammo ?? 0) < f.ammo;
            const switched = self.curWeapIdx === f.slot;
            if (shot || now >= this.holdUntil || (!switched && now > f.from + QUICK_CLICK)) this.follow = null;
            else if (switched && trigger.lastClickAt > f.from && now - trigger.lastClickAt > RECLICK)
                trigger.rearm(now);
        }
        const a = this.armed;
        if (!a) return null;
        if (now - a.at > SHOT_WAIT || self.curWeapIdx !== a.slot) {
            this.armed = null;
            return null;
        }
        // the shot has not shown in the snapshot yet
        if ((self.weapons[a.slot]?.ammo ?? 0) >= a.ammo) return null;
        this.armed = null;
        const other = this.target(now, self);
        if (other === null) return null;
        this.noteSwitch(now);
        this.holdUntil = now + QUICK_HOLD;
        this.count++;
        this.follow = { slot: other, ammo: self.weapons[other]?.ammo ?? 0, from: now };
        trigger.rearm(now + QUICK_CLICK);
        return other === WeaponSlot.Primary ? Input.EquipPrimary : Input.EquipSecondary;
    }
}
