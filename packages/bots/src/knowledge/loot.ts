// Loot valuation: how much a bot wants an item given what it carries. Weapons come first while it has none (namu.md
// /팁: "grab any weapon first"), then ammo for its guns, armour and backpack upgrades, heals and boosts, scopes and
// grenades. Values are 0..100; 0 means "leave it".
import { GameConfig, GameObjectDefs, hasDef, WeaponSlot } from "@rebirth/defs";
import type { SelfState } from "../perception/world.ts";
import { type GunInfo, gunInfo } from "./weapons.ts";

const SCOPES = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];
const GOOD_THROWABLES: Readonly<Record<string, number>> = { frag: 18, mirv: 22, smoke: 10 };
const HEALS: Readonly<Record<string, number>> = { bandage: 18, healthkit: 32, soda: 20, painkiller: 26 };

function level(id: string): number {
    if (!id || !hasDef(id)) return 0;
    return (GameObjectDefs[id] as { level?: number }).level ?? 0;
}

/** Bag capacity of `item` with the bot's backpack. */
export function capacityOf(self: SelfState, item: string): number {
    const sizes = GameConfig.bagSizes[item];
    if (!sizes) return 0;
    return sizes[Math.min(level(self.backpack), sizes.length - 1)];
}

/** The bot's guns (primary and secondary) with their knowledge. */
export function heldGuns(self: SelfState): Array<{ slot: number; info: GunInfo; ammo: number }> {
    const out: Array<{ slot: number; info: GunInfo; ammo: number }> = [];
    for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
        const w = self.weapons[slot];
        const info = w ? gunInfo(w.type) : undefined;
        if (w && info) out.push({ slot, info, ammo: w.ammo });
    }
    return out;
}

function gunValue(self: SelfState, type: string): number {
    const info = gunInfo(type);
    if (!info || info.score <= 0) return 0;
    const guns = heldGuns(self).filter((g) => g.info.score > 0);
    const ammoBonus = (self.inventory[info.ammo] ?? 0) > 0 ? 8 : 0;
    if (guns.length === 0) return 95 + ammoBonus * 0.5;
    if (guns.some((g) => g.info.id === type)) {
        // the same pistol again becomes its dual version; any other duplicate is worthless
        const dual = info.def.dualWieldType ? gunInfo(info.def.dualWieldType) : undefined;
        const gain = dual ? dual.score - info.score : 0;
        return gain > 5 ? Math.min(60, 25 + gain / 3) : 0;
    }
    if (guns.length === 1) {
        const held = guns[0].info;
        if (held.id === info.id) return 0;
        // a second gun of another class completes the loadout (medium range + close range)
        const closeHeld = held.cls === "shotgun" || held.cls === "smg" || held.cls === "pistol";
        const closeNew = info.cls === "shotgun" || info.cls === "smg" || info.cls === "pistol";
        const complement = closeHeld !== closeNew ? 20 : 0;
        return Math.min(85, 35 + complement + info.score / 6 + ammoBonus);
    }
    const worst = guns.reduce((a, b) => (a.info.score <= b.info.score ? a : b));
    // upgrading a full loadout: replace the weaker gun when the new one is clearly better
    const gain = info.score - worst.info.score;
    if (gain < 12) return 0;
    return Math.min(80, 25 + gain / 3 + ammoBonus);
}

function ammoValue(self: SelfState, item: string): number {
    const cap = capacityOf(self, item);
    const have = self.inventory[item] ?? 0;
    if (have >= cap) return 0;
    const users = heldGuns(self).filter((g) => g.info.ammo === item && g.info.score > 0);
    if (users.length === 0) return 3;
    const clip = Math.max(...users.map((g) => g.info.def.maxClip));
    if (have < clip) return 60;
    if (have < clip * 3) return 35;
    return 12;
}

function gearValue(self: SelfState, item: string, kind: "helmet" | "chest" | "backpack"): number {
    const diff = level(item) - level(self[kind]);
    if (diff <= 0) return 0;
    return kind === "backpack" ? 38 + diff * 10 : 42 + diff * 14;
}

/** How much the bot wants `item` (0..100). */
export function lootValue(self: SelfState, item: string): number {
    if (!hasDef(item)) return 0;
    const def = GameObjectDefs[item];
    switch (def.type) {
        case "gun":
            return gunValue(self, item);
        case "ammo":
            return ammoValue(self, item);
        case "helmet":
        case "chest":
        case "backpack":
            return gearValue(self, item, def.type);
        case "heal":
        case "boost": {
            const have = self.inventory[item] ?? 0;
            if (have >= capacityOf(self, item)) return 0;
            const base = HEALS[item] ?? 10;
            return have === 0 ? base + 12 : base;
        }
        case "scope": {
            const better = SCOPES.indexOf(item) > SCOPES.indexOf(self.scope);
            return better && !(self.inventory[item] > 0) ? 18 + 4 * SCOPES.indexOf(item) : 0;
        }
        case "throwable": {
            const base = GOOD_THROWABLES[item] ?? 0;
            if (!base || (self.inventory[item] ?? 0) >= capacityOf(self, item)) return 0;
            return base;
        }
        case "melee":
            return self.weapons[WeaponSlot.Melee]?.type === "fists" ? 10 : 0;
        default:
            return 0;
    }
}

/** Slot a picked-up gun would replace when both gun slots are full: the weaker gun. */
export function slotToReplace(self: SelfState): number | null {
    const guns = heldGuns(self);
    if (guns.length < 2) return null;
    return guns.reduce((a, b) => (a.info.score <= b.info.score ? a : b)).slot;
}
