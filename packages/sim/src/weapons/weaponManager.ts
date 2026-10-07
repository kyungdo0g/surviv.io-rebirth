// Weapon slots, switching, fire modes, reloads and melee scheduling of one player.
// Behaviour follows survev server/src/game/weaponManager.ts (setCurWeapIndex, setWeapon, gunUpdate, meleeUpdate,
// tryReload, reload) and docs/research/items/guns.md "Shared firing, switching and reload rules".
import { GameConfig, GameObjectDefs, type GunDef, getDef, hasDef, type MeleeDef, WeaponSlot } from "@rebirth/defs";
import { isBagItem, THROWABLE_LIST } from "../items/inventory.ts";
import { addPerk, removePerksWhere } from "../perks/perks.ts";
import type { SimContext } from "../world/context.ts";
import type { Player } from "../world/player.ts";
import { fireGun } from "./gun.ts";
import { meleeDamage } from "./melee.ts";
import { throwThrowable, updateThrowable } from "./throwable.ts";

/** Float tolerance for timers that are decremented by dt every tick (0.1 - 10 * 0.01 is not exactly 0). */
export const TIME_EPS = 1e-9;

/**
 * Whether a weapon whose cooldown was just decremented is ready, and if so how far (<= 0) past its ready time the
 * current tick is: the remainder when it became ready during this tick, 0 when it was already idle before.
 */
export function readyCarry(cooldown: number, dt: number): number | null {
    if (cooldown > TIME_EPS) return null;
    return cooldown > -dt + TIME_EPS ? Math.min(cooldown, 0) : 0;
}

/** The perk a weapon gives while carried, "" for none. */
function weaponPerk(type: string): string {
    const def = getDef(type);
    return (def.type === "melee" && (def as MeleeDef).perk) || "";
}

export interface WeaponSlotState {
    type: string;
    /** rounds in the magazine (guns only) */
    ammo: number;
    /** seconds until the weapon may fire/attack again; negative once ready */
    cooldown: number;
    /** first-shot accuracy timer: the next shot has no deviation once it reaches 0 */
    recoilTime: number;
}

export function gunDef(type: string): GunDef | undefined {
    if (!type || !hasDef(type)) return undefined;
    const def = GameObjectDefs[type];
    return def.type === "gun" ? def : undefined;
}

export class WeaponManager {
    readonly player: Player;
    readonly weapons: WeaponSlotState[] = [];
    curWeapIdx: number = WeaponSlot.Melee;
    lastWeaponIdx = 0;
    /** pending burst shots: seconds until each fires */
    readonly bursts: number[] = [];
    /** pending melee hits of the current swing: seconds until each lands */
    readonly meleeAttacks: number[] = [];
    /** dual guns alternate barrels */
    offHand = false;
    /** reload as soon as the weapon cooldown has run out */
    scheduledReload = false;
    /** a free (baseSwitchDelay) switch is available while this is negative */
    freeSwitchTimer = 0;
    /** seconds since the last shot or switch (first-shot accuracy) */
    recoilTicker = 0;
    /** seconds the held throwable has been cooking */
    cookTicker = 0;
    /** a new throw may start once this is <= 0 (GameConfig.player.throwTime after each throw) */
    throwableCooldown = 0;

    constructor(player: Player, loadout: ReadonlyArray<{ type: string; ammo: number }>) {
        this.player = player;
        for (let i = 0; i < WeaponSlot.Count; i++) {
            const item = loadout[i] ?? { type: "", ammo: 0 };
            const type = item.type || (GameConfig.WeaponType[i] === "melee" ? "fists" : "");
            this.weapons.push({ type, ammo: item.ammo, cooldown: 0, recoilTime: Number.POSITIVE_INFINITY });
        }
    }

    get activeWeapon(): string {
        return this.weapons[this.curWeapIdx].type;
    }

    get activeSlot(): WeaponSlotState {
        return this.weapons[this.curWeapIdx];
    }

    /** A throwable is being cooked (the cook animation runs; survev cookingThrowable). */
    get cooking(): boolean {
        return this.player.animType === "cook";
    }

    /** Equips a slot with the switch delay rules (survev setCurWeapIndex). */
    setCurWeapIndex(idx: number, forceSwitch = false): void {
        const player = this.player;
        if (!this.activeWeapon && !this.weapons[idx].type) {
            idx = WeaponSlot.Melee;
            if (!this.weapons[idx].type) {
                this.weapons[idx].type = "fists";
                this.weapons[idx].cooldown = 0;
            }
            forceSwitch = true;
        }
        if (idx === this.curWeapIdx || !this.weapons[idx].type) return;
        const curDef = getDef(this.activeWeapon || "fists");
        // a burst cannot be interrupted by a switch
        if (curDef.type === "gun" && curDef.fireMode === "burst" && this.bursts.length && !forceSwitch) return;
        // switching away while cooking drops the throwable at the feet (survev setCurWeapIndex)
        if (this.cooking && idx !== WeaponSlot.Throwable) throwThrowable(player.ctx, player, true);

        player.cancelAnim();
        player.shotSlowdownTimer = 0;
        this.bursts.length = 0;
        this.meleeAttacks.length = 0;
        this.scheduledReload = false;
        this.recoilTicker = 0;

        const cur = this.weapons[this.curWeapIdx];
        const next = this.weapons[idx];
        const nextDef = getDef(next.type);
        if (cur.type && next.type) {
            const toGun = nextDef.type === "gun";
            let delay = toGun ? nextDef.switchDelay : 0;
            // one cheap switch per freeSwitchCooldown (1 s)
            if (this.freeSwitchTimer < 0) {
                delay = GameConfig.player.baseSwitchDelay;
                this.freeSwitchTimer = GameConfig.player.freeSwitchCooldown;
            }
            const curGroup = curDef.type === "gun" ? curDef.deployGroup : undefined;
            if (
                toGun &&
                nextDef.deployGroup !== undefined &&
                curGroup !== undefined &&
                nextDef.deployGroup === curGroup &&
                cur.cooldown > 0
            ) {
                // same deploy group (m870 <-> spas12) while the current one still cycles: full switch delay
                delay = nextDef.switchDelay;
            } else if (nextDef.type === "melee") {
                delay = Math.max(next.cooldown, nextDef.switchDelay);
            }
            next.cooldown = delay;
        }

        this.lastWeaponIdx = this.curWeapIdx;
        this.curWeapIdx = idx;
        player.cancelAction();
        player.wearingPan = this.weapons[WeaponSlot.Melee].type === "pan" && this.activeWeapon !== "pan";
        if (GameConfig.WeaponType[idx] === "gun" && this.weapons[idx].ammo <= 0) this.scheduledReload = true;
        if (GameConfig.WeaponType[idx] === "gun") this.offHand = false;
    }

    swapWeaponSlots(): void {
        const primary = { ...this.weapons[WeaponSlot.Primary] };
        this.weapons[WeaponSlot.Primary] = { ...this.weapons[WeaponSlot.Secondary] };
        this.weapons[WeaponSlot.Secondary] = primary;
        if (this.curWeapIdx === WeaponSlot.Primary || this.curWeapIdx === WeaponSlot.Secondary) {
            this.lastWeaponIdx = this.curWeapIdx;
            this.curWeapIdx ^= 1;
        }
    }

    /** Puts an item into a slot (pickups, drops); a new weapon starts with its switch delay (survev setWeapon). */
    setWeapon(idx: number, type: string, ammo: number): void {
        const player = this.player;
        const def = type && hasDef(type) ? getDef(type) : undefined;
        if (this.weapons[idx].type === "pan") player.wearingPan = false;
        if (type === "pan" && this.curWeapIdx !== WeaponSlot.Melee) player.wearingPan = true;
        const slot = this.weapons[idx];
        // a weapon's perk is held while the weapon is carried (survev weaponManager.ts setWeapon: the Gold Cutlass)
        const oldPerk = slot.type && hasDef(slot.type) ? weaponPerk(slot.type) : "";
        const newPerk = type && hasDef(type) ? weaponPerk(type) : "";
        if (oldPerk && oldPerk !== newPerk) removePerksWhere(player, (s) => s.fromGear && s.type === oldPerk);
        if (newPerk && newPerk !== oldPerk) addPerk(player, newPerk, { fromGear: true });
        slot.type = type;
        slot.ammo = ammo;
        slot.cooldown = def?.type === "gun" || def?.type === "melee" ? def.switchDelay : 0;
        if (def?.type === "gun") slot.recoilTime = def.recoilTime;
        if (idx === this.curWeapIdx) this.bursts.length = 0;
        if (!this.activeWeapon) this.setCurWeapIndex(WeaponSlot.Melee, true);
    }

    /** Shows the next held throwable type in the throwable slot, or empties it (survev showNextThrowable). */
    showNextThrowable(): void {
        const slot = WeaponSlot.Throwable;
        const start = THROWABLE_LIST.indexOf(this.weapons[slot].type) + 1;
        for (let i = start; i < start + THROWABLE_LIST.length; i++) {
            const type = THROWABLE_LIST[i % THROWABLE_LIST.length];
            if (this.player.inv.has(type)) {
                this.setWeapon(slot, type, 0);
                return;
            }
        }
        if (this.curWeapIdx === slot) {
            this.setCurWeapIndex(this.weapons[this.lastWeaponIdx].type ? this.lastWeaponIdx : WeaponSlot.Melee);
        }
        this.setWeapon(slot, "", 0);
    }

    ammoStats(def: GunDef): { maxClip: number; maxReload: number; maxReloadAlt?: number } {
        if (this.player.hasPerk("firepower")) {
            return { maxClip: def.extendedClip, maxReload: def.extendedReload, maxReloadAlt: def.extendedReloadAlt };
        }
        return { maxClip: def.maxClip, maxReload: def.maxReload, maxReloadAlt: def.maxReloadAlt };
    }

    isInfinite(def: GunDef): boolean {
        return !def.ignoreEndlessAmmo && (!!def.ammoInfinite || this.player.hasPerk("endless_ammo"));
    }

    update(ctx: SimContext, dt: number): void {
        this.freeSwitchTimer -= dt;
        this.recoilTicker += dt;
        this.throwableCooldown -= dt;
        for (const w of this.weapons) {
            w.cooldown -= dt;
            w.recoilTime -= dt;
        }
        for (let i = 0; i < this.bursts.length; i++) this.bursts[i] -= dt;
        for (let i = 0; i < this.meleeAttacks.length; i++) this.meleeAttacks[i] -= dt;
        const def = getDef(this.activeWeapon || "fists");
        if (def.type === "gun") this.gunUpdate(ctx, def, dt);
        else if (def.type === "melee") this.meleeUpdate(ctx, def, dt);
        updateThrowable(ctx, this.player, dt);
    }

    /**
     * Fire modes. A weapon is ready on the tick its cooldown reaches 0, and the sub-tick remainder carries into
     * the next cooldown, so a held trigger fires exactly every fireDelay on average. survev instead resets the
     * cooldown to fireDelay and compares with <= 0 (auto) / < 0 (single, burst), which with a fixed dt adds a tick
     * of float residue to many intervals (tools/oracle README "Fixed-step float residue").
     */
    private gunUpdate(ctx: SimContext, def: GunDef, dt: number): void {
        const player = this.player;
        const weapon = this.activeSlot;
        if (weapon.cooldown <= TIME_EPS && this.scheduledReload) {
            this.scheduledReload = false;
            this.tryReload();
        }
        const carry = readyCarry(weapon.cooldown, dt);
        switch (def.fireMode) {
            case "auto":
                if (player.shootHold && carry !== null) {
                    fireGun(ctx, player, this.offHand, def.fireDelay + carry);
                    this.offHand = !this.offHand;
                }
                break;
            case "single":
                // one shot per click
                if (player.shootStart && carry !== null) {
                    fireGun(ctx, player, this.offHand, def.fireDelay + carry);
                    this.offHand = !this.offHand;
                }
                break;
            case "burst": {
                const count = def.burstCount ?? 1;
                const delay = def.burstDelay ?? 0;
                if (player.shootHold && carry !== null && this.bursts.length === 0) {
                    for (let i = 0; i < count; i++) this.bursts.push(carry + i * delay);
                    // the next burst may start fireDelay after the last shot of this one
                    weapon.cooldown = carry + (count - 1) * delay + def.fireDelay;
                    this.offHand = !this.offHand;
                }
                while (this.bursts.length && this.bursts[0] <= TIME_EPS) {
                    const due = this.bursts.shift() ?? 0;
                    // every shot restarts the cooldown, so a burst cut short by an empty magazine can reload
                    // fireDelay after its last real shot (survev fireWeapon sets cooldown = fireDelay)
                    const shotCarry = due > -dt + TIME_EPS ? Math.min(due, 0) : 0;
                    fireGun(ctx, player, this.offHand, def.fireDelay + shotCarry);
                }
                break;
            }
        }
    }

    private meleeUpdate(ctx: SimContext, def: MeleeDef, dt: number): void {
        const player = this.player;
        const weapon = this.activeSlot;
        const attack = def.attack;
        const carry = readyCarry(weapon.cooldown, dt);
        if (
            player.animType !== "melee" &&
            (player.shootStart || (player.shootHold && def.autoAttack)) &&
            carry !== null
        ) {
            player.cancelAction();
            player.playAnim("melee", attack.cooldownTime + carry);
            weapon.cooldown = attack.cooldownTime + carry;
            this.meleeAttacks.length = 0;
            // hits land damageTimes after the swing starts
            for (const t of attack.damageTimes) this.meleeAttacks.push(t + carry);
        }
        for (let i = 0; i < this.meleeAttacks.length; i++) {
            if (this.meleeAttacks[i] > TIME_EPS) continue;
            this.meleeAttacks.splice(i--, 1);
            meleeDamage(ctx, player, def);
        }
    }

    /**
     * Starts a reload action when allowed (survev tryReload): gun slot, not full, ammo in the bag (or infinite).
     * An empty Mosin with more than one reload's worth of ammo does the alternate full-clip reload.
     * `elapsed` pre-advances the action (a chained shell reload carries the remainder of the previous tick).
     */
    tryReload(elapsed = 0): boolean {
        const player = this.player;
        if (player.action.type !== "none") return false;
        if (this.curWeapIdx === WeaponSlot.Melee || this.curWeapIdx === WeaponSlot.Throwable) return false;
        const def = gunDef(this.activeWeapon);
        if (!def) return false;
        let invAmmo = Number.POSITIVE_INFINITY;
        if (!this.isInfinite(def)) {
            // pseudo ammo outside the bag (9mm_cursed, bugle_ammo) is never reloaded from the inventory
            if (!isBagItem(def.ammo)) return false;
            invAmmo = player.inv.get(def.ammo);
            if (invAmmo <= 0) return false;
        }
        const weapon = this.activeSlot;
        const stats = this.ammoStats(def);
        if (weapon.ammo >= stats.maxClip) return false;
        let duration = def.reloadTime;
        let type: "reload" | "reloadAlt" = "reload";
        if (def.reloadTimeAlt && weapon.ammo === 0 && invAmmo > stats.maxReload) {
            duration = def.reloadTimeAlt;
            type = "reloadAlt";
        }
        player.doAction(this.activeWeapon, type, duration);
        player.action.time = elapsed;
        return true;
    }

    /**
     * Completes a reload action: moves rounds from the bag into the magazine. Returns true when a shell-by-shell
     * gun should immediately load the next round (survev reloadAgain).
     */
    reload(): boolean {
        const player = this.player;
        const weapon = this.activeSlot;
        const def = gunDef(weapon.type);
        if (!def) return false;
        const stats = this.ammoStats(def);
        const maxReload =
            player.action.type === "reloadAlt" && stats.maxReloadAlt ? stats.maxReloadAlt : stats.maxReload;
        const space = stats.maxClip - weapon.ammo;
        if (space <= 0) return false;
        let amount = Math.min(maxReload, space);
        const infinite = this.isInfinite(def);
        if (!infinite && isBagItem(def.ammo)) {
            amount = player.inv.take(def.ammo, amount);
            if (amount <= 0) return false;
        }
        weapon.ammo += amount;
        this.bursts.length = 0;
        return weapon.ammo < stats.maxClip && (infinite || player.inv.has(def.ammo));
    }
}
