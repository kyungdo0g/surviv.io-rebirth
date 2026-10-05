// The bot's own weapons: guns with their magazine and reserve, which slot to hold for a fight at a given distance
// (suitability, loaded first: switching to a loaded gun beats reloading under fire) and which gun to carry otherwise.
import { WeaponSlot } from "@rebirth/defs";
import type { SelfState } from "../perception/world.ts";
import { type GunInfo, gunInfo, suitability } from "./weapons.ts";

export interface HeldGun {
    slot: number;
    info: GunInfo;
    /** rounds in the magazine */
    mag: number;
    /** rounds of its ammo in the bag */
    reserve: number;
}

export function heldGunsWithAmmo(self: SelfState): HeldGun[] {
    const out: HeldGun[] = [];
    for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
        const w = self.weapons[slot];
        const info = w ? gunInfo(w.type) : undefined;
        if (!w || !info || info.score <= 0) continue;
        out.push({ slot, info, mag: w.ammo, reserve: self.inventory[info.ammo] ?? 0 });
    }
    return out;
}

export function hasAmmo(g: HeldGun): boolean {
    return g.mag > 0 || g.reserve > 0;
}

/**
 * Slot to hold for a fight at `dist`: the most suitable gun, preferring loaded ones; the current slot is kept
 * unless another is clearly better (switching costs the deploy delay). Melee when no gun has ammo.
 */
export function fightSlot(self: SelfState, guns: readonly HeldGun[], dist: number): number {
    let best = -1;
    let bestScore = 0;
    let curScore = -1;
    for (const g of guns) {
        if (!hasAmmo(g)) continue;
        const s = suitability(g.info, dist) * (g.mag > 0 ? 1 : 0.45) + g.info.score / 2000;
        if (g.slot === self.curWeapIdx) curScore = s;
        if (s > bestScore) {
            bestScore = s;
            best = g.slot;
        }
    }
    if (best < 0) return WeaponSlot.Melee;
    if (curScore >= 0 && curScore >= bestScore - 0.15) return self.curWeapIdx;
    return best;
}

/** Slot to carry outside fights: the best-scoring gun with ammo, else melee. */
export function carrySlot(self: SelfState, guns: readonly HeldGun[]): number {
    let best = -1;
    let bestScore = -1;
    for (const g of guns) {
        if (!hasAmmo(g)) continue;
        const s = g.info.score + (g.slot === self.curWeapIdx ? 5 : 0);
        if (s > bestScore) {
            bestScore = s;
            best = g.slot;
        }
    }
    return best < 0 ? WeaponSlot.Melee : best;
}

/** Gun in the current slot, if any. */
export function currentGun(self: SelfState, guns: readonly HeldGun[]): HeldGun | undefined {
    return guns.find((g) => g.slot === self.curWeapIdx);
}
