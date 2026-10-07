// The new-gun beta switch (server GUN_BETA, off by default; SimRules.gunBeta): for testing on the owner's server, the
// new guns and the survev-only guns become common floor loot on every map, so they can be found and tried without
// waiting for an air drop (the owner could not find the Barrett: it only comes from gold drops, and on Savannah).
// The sheet's own placements (rebirth/newGunLoot.ts) apply either way. The beta adds two things, built from the map's
// final tables when a game asks for them:
// - GUN_BETA_FLOOR_COPIES copies of every beta gun the map allows, laid at the map's floor gun spots when its loot
//   spawns (sim loot/gunBeta.ts), so each one is on every map: about 45 floor gun rolls per main map cannot give 35
//   guns each (with the share alone any given gun was missing from about half of the maps);
// - tier_guns rows taking GUN_BETA_FLOOR_SHARE of the floor gun rolls, split evenly between those guns.
// The map's loot bans and ground classes still hold (Savannah gets no shotguns, LMGs or assault rifles, Woods only
// shotguns and LMGs), launchers excepted.
import type { LootTableEntry } from "../types/index.ts";
import { type AmmoOf, airdropAllowed, newGunMapRules } from "./newGunLoot.ts";
import { NEW_GUN_IDS } from "./newGuns.ts";

/** survev-only guns the beta puts on the floor too (the PMG-134 and the winter skins stay where survev has them). */
export const GUN_BETA_SURVEV_GUNS = ["barrett", "ash12", "sw500", "imbel", "spas16"] as const;
/** Guns the beta puts on the floor: the new guns but the duals (two singles make them), then the survev-only ones. */
export const GUN_BETA_GUNS: readonly string[] = [
    ...NEW_GUN_IDS.filter((id) => !id.endsWith("_dual")),
    ...GUN_BETA_SURVEV_GUNS,
];
/** Share of a map's floor gun rolls (tier_guns) that give a beta gun, split evenly between the beta guns it allows. */
export const GUN_BETA_FLOOR_SHARE = 0.5;
/** Floor copies of every beta gun a map allows, on top of the share: each lies on every map at least this often. */
export const GUN_BETA_FLOOR_COPIES = 2;

/** Rounded to 1e-6 (weights are shown in docs and tests). */
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

type Tables = Readonly<Record<string, readonly LootTableEntry[]>>;

/** The beta guns a map allows (its bans and ground classes; launchers everywhere); none without a tier_guns table. */
export function gunBetaGuns(mapName: string, tables: Tables, ammoOf: AmmoOf): string[] {
    if (!tables.tier_guns) return [];
    const rules = newGunMapRules(mapName, tables, ammoOf);
    return GUN_BETA_GUNS.filter((g) => airdropAllowed(rules, g));
}

/**
 * A map's loot tables with the beta's floor rows appended to tier_guns (a copy; maps without tier_guns are returned
 * as a copy unchanged).
 */
export function gunBetaLootTables(mapName: string, tables: Tables, ammoOf: AmmoOf): Record<string, LootTableEntry[]> {
    const out: Record<string, LootTableEntry[]> = {};
    for (const [tier, entries] of Object.entries(tables)) out[tier] = [...entries];
    const floor = tables.tier_guns;
    const guns = gunBetaGuns(mapName, tables, ammoOf);
    if (!floor || guns.length === 0) return out;
    const total = floor.reduce((s, e) => s + e.weight, 0);
    const weight = round6((total * GUN_BETA_FLOOR_SHARE) / (1 - GUN_BETA_FLOOR_SHARE) / guns.length);
    out.tier_guns = [...floor, ...guns.map((name) => ({ name, count: 1, weight }))];
    return out;
}
