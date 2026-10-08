// Perks on a player (M7a): the perk list with where each perk came from (loot, role, helmet, trick-or-treat roll),
// adding and removing a perk with its immediate effects, size and the adrenaline floor, haste (speed bursts).
// Behaviour follows survev server/src/game/objects/player.ts addPerk / removePerk / recalculateScale /
// recalculateMinBoost / giveHaste and docs/research/items/perks.md "How perks are held, picked up and dropped".
import { math } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { isBagItem } from "../items/inventory.ts";
import { playerDropLoot } from "../loot/drops.ts";
import { defaultRules, type SimRules } from "../rules.ts";
import type { HasteName, PerkView } from "../view.ts";
import { gunDef } from "../weapons/weaponManager.ts";
import type { Player } from "../world/player.ts";

/** Size limits (net.ts PlayerMinScale / PlayerMaxScale, same in 0.8.82). */
export const PLAYER_MIN_SCALE = 0.75;
export const PLAYER_MAX_SCALE = 2;

/** Where a perk of the list came from. */
export interface PerkSource {
    type: string;
    /** a loot perk: dropped from the HUD or on death */
    droppable: boolean;
    /** granted by the player's role (removed with it) */
    fromRole: boolean;
    /** granted by the worn helmet (removed with it) */
    fromGear: boolean;
    /** dropped in its place on death (a rolled trick-or-treat perk drops back as halloween_mystery) */
    replaceOnDeath: string;
}

export interface AddPerkOptions {
    droppable?: boolean;
    fromRole?: boolean;
    fromGear?: boolean;
    replaceOnDeath?: string;
}

let fallbackRules: SimRules | null = null;
/** Rules of the player's game (defaults for a player outside a game, e.g. in unit tests). */
export function rulesOf(player: Player): SimRules {
    if (player.ctx) return player.ctx.rules;
    fallbackRules ??= defaultRules();
    return fallbackRules;
}

/**
 * Gives `player` a perk (survev addPerk): immediate effects (Dev Troll Special's cursed M9), then size and the
 * adrenaline floor are recomputed. Perks beyond the net limit (8) are ignored. Returns whether it was added.
 */
export function addPerk(player: Player, type: string, opts: AddPerkOptions = {}): boolean {
    const rules = rulesOf(player);
    if (player.perks.length >= rules.perks.maxPerks) return false;
    player.perks.push(type);
    player.perkSources.push({
        type,
        droppable: opts.droppable ?? false,
        fromRole: opts.fromRole ?? false,
        fromGear: opts.fromGear ?? false,
        replaceOnDeath: opts.replaceOnDeath ?? "",
    });
    switch (type) {
        case "trick_m9": {
            // Dev Troll Special: a full cursed M9 replaces the secondary gun without dropping it (perks.md trick_m9)
            const def = gunDef("m9_cursed");
            if (def) player.weaponManager.setWeapon(WeaponSlot.Secondary, "m9_cursed", def.maxClip);
            break;
        }
        case "fabricate":
            player.fabricateTicker = 0;
            player.fabricateQueue = [];
            break;
    }
    recalcScale(player);
    return true;
}

/**
 * Takes one `type` perk away (survev removePerk): the cursed M9 and the bugle leave their slot, a Firepower loss
 * clamps loaded magazines back to the normal clip (rules.perks.firepowerExcess), then size is recomputed.
 */
export function removePerk(player: Player, type: string): boolean {
    const i = player.perks.indexOf(type);
    if (i < 0) return false;
    player.perks.splice(i, 1);
    const s = player.perkSources.findIndex((p) => p.type === type);
    if (s >= 0) player.perkSources.splice(s, 1);
    const wm = player.weaponManager;
    switch (type) {
        case "trick_m9":
        case "inspiration": {
            const weapon = type === "trick_m9" ? "m9_cursed" : "bugle";
            const slot = wm.weapons.findIndex((w) => w.type === weapon);
            if (slot >= 0) wm.setWeapon(slot, "", 0);
            break;
        }
        case "firepower":
            clampMagazines(player);
            break;
        case "fabricate":
            player.fabricateTicker = 0;
            player.fabricateQueue = [];
            break;
        case "flak_jacket":
            // the bag room it gave goes: the excess frags and MIRVs drop (survev enforceMaxCapacity)
            for (const item of Object.keys(rulesOf(player).perks.flakJacketBonuses)) {
                const excess = player.inv.get(item) - player.inv.capacity(item);
                if (excess <= 0) continue;
                player.inv.set(item, player.inv.capacity(item));
                if (player.ctx) playerDropLoot(player.ctx, player, item, excess);
            }
            break;
    }
    recalcScale(player);
    return true;
}

/** Removes every perk matching `pred` (role perks on a role change, a helmet's perk when it is taken off). */
export function removePerksWhere(player: Player, pred: (s: PerkSource) => boolean): void {
    for (const s of [...player.perkSources]) if (pred(s)) removePerk(player, s.type);
}

/** Loaded rounds above the normal magazine are deleted, or returned to the bag (survev clampGunsAmmo). */
function clampMagazines(player: Player): void {
    const wm = player.weaponManager;
    const toBag = rulesOf(player).perks.firepowerExcess === "inventory";
    for (const w of wm.weapons) {
        const def = gunDef(w.type);
        if (!def) continue;
        const max = wm.ammoStats(def).maxClip;
        const extra = w.ammo - max;
        if (extra <= 0) continue;
        w.ammo = max;
        if (toBag && isBagItem(def.ammo)) player.inv.give(def.ammo, extra);
    }
}

/** The droppable flag of each held perk, in list order (perks pushed without a source are not droppable). */
export function perkViews(player: Player): PerkView[] {
    const used = new Set<PerkSource>();
    return player.perks.map((type) => {
        const src = player.perkSources.find((s) => s.type === type && !used.has(s));
        if (src) used.add(src);
        return { type, droppable: src?.droppable ?? false };
    });
}

/** The droppable (loot) perk, if any. */
export function droppablePerk(player: Player): PerkSource | undefined {
    return player.perkSources.find((s) => s.droppable);
}

/**
 * Size from the perks, the Last Breath buff and Spud Gun hits, summed and clamped to 0.75..2 (survev recalculateScale; fandom's
 * "size perks override Small Arms" is not modelled, survev sums them).
 */
export function recalcScale(player: Player): void {
    const rules = rulesOf(player).perks;
    let scale = 1;
    for (const p of player.perks) scale += rules.scales[p] ?? 0;
    if (player.lastBreathTicker > 0) scale += rules.lastBreathScale;
    scale += player.fat.mod;
    scale = math.clamp(scale, PLAYER_MIN_SCALE, PLAYER_MAX_SCALE);
    if (scale === player.scale) return;
    player.scale = scale;
    player.bounds = player.computeBounds();
    player.ctx?.world.updateBounds(player);
}

/** Lowest adrenaline the perks allow (survev recalculateMinBoost: the highest minBoost; Leadership 100). */
export function perkMinBoost(player: Player): number {
    const table = rulesOf(player).perks.minBoost;
    let min = 0;
    for (const p of player.perks) min = Math.max(min, table[p] ?? 0);
    return min;
}

/** Starts a speed burst; a new one replaces the current one (survev giveHaste). */
export function giveHaste(player: Player, type: HasteName, duration: number): void {
    player.haste.type = type;
    player.haste.ticker = duration;
    player.haste.seq++;
}

/** Runs down the current haste (survev update "Haste logic"). */
export function updateHaste(player: Player, dt: number): void {
    const h = player.haste;
    if (h.type === "none") return;
    h.ticker -= dt;
    if (h.ticker > 1e-9) return;
    h.type = "none";
    h.ticker = 0;
    h.seq++;
}

/** Ends the haste without a new one (death). */
export function clearHaste(player: Player): void {
    if (player.haste.type === "none") return;
    player.haste.type = "none";
    player.haste.ticker = 0;
    player.haste.seq++;
}

/** Spud Gun hits: +0.06 size each up to +0.6, shrinking again 2.5 s after the last hit (survev incrementFat). */
export function incrementFat(player: Player): void {
    player.fat.ticker = FAT_HOLD;
    if (player.fat.mod > FAT_MAX) return;
    player.fat.mod += FAT_STEP;
    recalcScale(player);
}

/** After the hold time the extra size shrinks by 0.2 per second (survev update). */
export function updateFat(player: Player, dt: number): void {
    if (player.fat.mod <= 0) return;
    player.fat.ticker -= dt;
    if (player.fat.ticker >= 0) return;
    player.fat.mod = Math.max(0, player.fat.mod - FAT_SHRINK * dt);
    recalcScale(player);
}

const FAT_STEP = 0.06;
const FAT_MAX = 0.6;
const FAT_HOLD = 2.5;
const FAT_SHRINK = 0.2;
