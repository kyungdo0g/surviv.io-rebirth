// Loot valuation: how much a bot wants an item given what it carries. Weapons come first while it has none (namu.md
// /팁: "grab any weapon first"), then ammo for its guns, armour and backpack upgrades, heals and boosts, scopes and
// grenades. Values are 0..100; 0 means "leave it". Guns are valued by desire (knowledge/desire.ts: the shared tier
// list weighed by the bot's persona and skill, bot overhaul LOOT-8); the persona also scales scopes.
import { GameConfig, GameObjectDefs, hasDef, WeaponSlot } from "@rebirth/defs";
import type { SelfState } from "../perception/world.ts";
import { DEFAULT_TASTE, gunPickupValue, slotToReplaceByDesire, type Taste } from "./desire.ts";
import { type GunInfo, gunInfo } from "./weapons.ts";

const SCOPES = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];
// (the rebirth's Molotov flushes campers and denies doorways; its flashbang opens a push: brain/rebirthThrows.ts)
const GOOD_THROWABLES: Readonly<Record<string, number>> = { frag: 18, mirv: 22, smoke: 10, molotov: 16, flashbang: 12 };
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

function ammoValue(self: SelfState, item: string): number {
    const cap = capacityOf(self, item);
    const have = self.inventory[item] ?? 0;
    if (have >= cap) return 0;
    const users = heldGuns(self).filter((g) => g.info.ammo === item && g.info.score > 0);
    // spare ammo for the second gun it may find next, while the bag has room (lazy-loot RC6: people take it; 8 clears
    // the explore value floor of 6; unarmed bots look for a gun first, a full loadout leaves it)
    if (users.length === 0) return heldGuns(self).filter((g) => g.info.score > 0).length === 1 ? 8 : 3;
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

/**
 * How much the bot wants `item` (0..100), for a bot of this taste (persona and skill; default: none, normal).
 * `ammoKnown` (guns): ammo types known on the ground close by (default unknown; knowledge/desire.ts).
 */
export function lootValue(
    self: SelfState,
    item: string,
    taste: Readonly<Taste> = DEFAULT_TASTE,
    ammoKnown?: ReadonlySet<string>,
): number {
    if (!hasDef(item)) return 0;
    const def = GameObjectDefs[item];
    switch (def.type) {
        case "gun":
            return gunPickupValue(self, item, taste, ammoKnown);
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
            return better && !(self.inventory[item] > 0)
                ? (18 + 4 * SCOPES.indexOf(item)) * taste.persona.scopeAffinity
                : 0;
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

/**
 * Slot a picked-up gun (`item`) would replace when both gun slots are full: the swap that raises the loadout's worth
 * most (knowledge/desire.ts; redundant and empty guns go first, never a higher tier for a lower one), never by the old
 * DPS score (the M93R outranked the Mosin).
 */
export function slotToReplace(
    self: SelfState,
    taste: Readonly<Taste> = DEFAULT_TASTE,
    item = "",
    ammoKnown?: ReadonlySet<string>,
): number | null {
    return slotToReplaceByDesire(self, taste, item, ammoKnown);
}
