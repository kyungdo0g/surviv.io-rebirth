// Where the owner's loot weights of 2026-10-08 go (rebirth/ownerLootWeights.ts holds the numbers; deliberate rebirth
// deviations, user/2026-10-08-loot-speed). This module places three of them; the gold drop rows ride on the Barrett's
// (rebirth/survevGuns.ts) and the L86A2's tier 1 row on the air drop tier derivation (rebirth/airdropLoot.ts):
// - the classic floor: OWNER_LOOT_WEIGHTS.classicFloor appended to `tier_guns` of main and its spring / summer copies;
// - the bathhouse ring case (case_07, `tier_ring_case`; its only container is bathhouse_sideroom_02 inside
//   bathhouse_01 / club_structure_01 / club_complex_01): the owner's table replaces survev's on every map but the
//   potato modes, which keep theirs (potato and its spring copy roll their potato ring case; Potato vs Tomato has no
//   bathhouse). The map's loot bans remove rows (Savannah: no Groza-S or PKP; the PMG-134 is a special gun, not an
//   LMG), as the port does to every table; the ring case ignores the floor's class rules, as survev's does (woods'
//   case holds a Groza-S too). The M79 row follows the new guns' rule: they are normal loot without GUN_BETA
//   (rebirth/newGunLoot.ts places them on every map; GUN_BETA only adds floor rows and copies, rebirth/gunBeta.ts),
//   so the row is there whether the beta is on or off. The rest of the bathhouse (its ammo and military crates and
//   deposit boxes behind the switch_03 puzzle) keeps survev's loot;
// - the club's secret room (club_01, upstairs in club_structure_01: the 4-switch puzzle opens secret_door_club onto
//   club_vault, whose machete is unchanged, and two deposit boxes): each box is survev's weighted
//   `{ deposit_box_01: 3, deposit_box_02: 1 }`; club_01's copy here takes OWNER_LOOT_WEIGHTS.clubVaultBoxes and the
//   club's own gun box, deposit_box_02_club (a rebirth-only map object, appended after every generated one in
//   rebirth/defs.ts): deposit_box_02 whose `tier_guns` roll is CLUB_VAULT_TABLE, its tier_soviet 1-2 roll kept.
//   deposit_box_02 itself, shared with vault_01, vault_01b, the bathhouse and the Reserve vaults, is untouched.
//   `tier_club_vault` is the owner's table where the map's floor allows each gun (newGunLoot.ts floorAllowed: bans,
//   ground classes, ammo). The potato modes keep survev's gun roll: their `tier_club_vault` is one nested `tier_guns`
//   roll (club_01 is one building def for every map, so its box odds are the owner's there too);
// - the Panzerfaust on the floor: OWNER_LOOT_WEIGHTS.panzerfaustFloor appended to `tier_guns` of every map but the
//   potato modes whose floor has the flare gun (crates, pots and boxes roll it through tier_world); the map's loot
//   bans hold. It is normal loot like the other new guns (GUN_BETA only adds rows);
// - the gold drop's bonus roll: the gold crates (crate_11 and its desert, savannah, turkey and halloween variants)
//   roll GOLD_BONUS_TABLE once more after their own loot, OWNER_LOOT_WEIGHTS.goldBonus: the M202 FLASH sometimes,
//   else nothing. survev's gold crate has no bonus roll; its main gun stays the tier_airdrop_rare roll. The potato
//   modes' table holds only "nothing" (their gold drop is the potato guns).
import { LOOT_BANS } from "../gunClasses.ts";
import type { BuildingDef, LootSpawnDef, LootTableEntry, MapDef, MapObjectDef, ObstacleDef } from "../types/index.ts";
import { type AmmoOf, airdropAllowed, floorAllowed, newGunMapRules } from "./newGunLoot.ts";
import { OWNER_CLASSIC_FLOOR_MAPS, OWNER_LOOT_WEIGHTS } from "./ownerLootWeights.ts";

/** The floor gun table (survev's gun roll of deposit_box_02, and the classic floor rows' table). */
const FLOOR = "tier_guns";
/** The bathhouse ring case's table (case_07). */
export const RING_CASE_TABLE = "tier_ring_case";
/** The rebirth table of the club gun box's gun roll. */
export const CLUB_VAULT_TABLE = "tier_club_vault";
/** The building whose secret room holds the two deposit boxes. */
export const CLUB_VAULT_BUILDING = "club_01";
/** The deposit box the club's gun box copies (survev: tier_soviet 1-2 and tier_guns). */
export const CLUB_VAULT_BOX_BASE = "deposit_box_02";
/** The club's own gun box: a rebirth-only map object, deposit_box_02 rolling CLUB_VAULT_TABLE for its gun. */
export const CLUB_VAULT_BOX = "deposit_box_02_club";
/** survev's weighted type of each secret room box (club_01's two children at (-4.25, 29.55) and (1.25, 29.55)). */
export const SURVEV_CLUB_VAULT_BOXES: Readonly<Record<string, number>> = { deposit_box_01: 3, deposit_box_02: 1 };
/** The rebirth table of the gold crates' bonus roll. */
export const GOLD_BONUS_TABLE = "tier_airdrop_gold_bonus";
/** The gold air drop's inner crates (crate_11: main, its seasonal copies, snow, woods, potato...; and the variants). */
export const GOLD_BONUS_CRATES: readonly string[] = ["crate_11", "crate_11de", "crate_11sv", "crate_11tr", "crate_11h"];
/** The floor row the Panzerfaust's needs on a map: the flare gun's (survev tier_guns flare_gun 0.145). */
const PANZERFAUST_FLOOR_MARKER = "flare_gun";

/** Whether a map keeps survev's ring case and club gun roll: the potato modes (potato maps and Potato vs Tomato). */
export const keepsSurvevLoot = (def: MapDef): boolean => !!def.gameMode.potatoMode;

const rows = (weights: Readonly<Record<string, number>>, keep: (item: string) => boolean): LootTableEntry[] =>
    Object.entries(weights)
        .filter(([item]) => keep(item))
        .map(([name, weight]) => ({ name, count: 1, weight }));

/** A map's ring case with the owner's table: its rows the map's loot bans allow (survev's for the potato modes). */
export function ownerRingCase(name: string, def: MapDef): LootTableEntry[] {
    if (keepsSurvevLoot(def)) return (def.lootTable[RING_CASE_TABLE] ?? []).map((e) => ({ ...e }));
    const banned = new Set(LOOT_BANS[name] ?? []);
    return rows(OWNER_LOOT_WEIGHTS.ringCase, (g) => !banned.has(g));
}

/**
 * A map's club vault table: the owner's rows its floor allows (bans, ground classes and ammo read from its
 * `tier_guns`), or for the potato modes one nested roll of their own `tier_guns` (survev's roll, GUN_BETA rows
 * included).
 */
export function clubVaultTable(name: string, def: MapDef, ammoOf: AmmoOf): LootTableEntry[] {
    if (keepsSurvevLoot(def)) return [{ name: FLOOR, count: 1, weight: 1 }];
    const rules = newGunMapRules(name, def.lootTable, ammoOf);
    const table = rows(OWNER_LOOT_WEIGHTS.clubVault, (g) => floorAllowed(rules, g, ammoOf));
    if (table.length === 0) throw new Error(`${name}: no club vault gun is allowed on its floor`);
    return table;
}

/** A map's gold bonus table: the owner's rows its air drops allow, else nothing (only "nothing" in potato modes). */
export function goldBonusTable(name: string, def: MapDef, ammoOf: AmmoOf): LootTableEntry[] {
    const nothing: LootTableEntry = { name: "", count: 1, weight: 1 };
    if (keepsSurvevLoot(def)) return [nothing];
    const rules = newGunMapRules(name, def.lootTable, ammoOf);
    const table = rows(OWNER_LOOT_WEIGHTS.goldBonus, (g) => g === "" || airdropAllowed(rules, g));
    return table.some((e) => e.name !== "") ? table : [nothing];
}

/** The Panzerfaust's floor rows: every map but the potato modes whose floor has the flare gun, bans holding. */
export function panzerfaustFloorRows(name: string, def: MapDef): LootTableEntry[] {
    if (keepsSurvevLoot(def) || !def.lootTable[FLOOR]?.some((e) => e.name === PANZERFAUST_FLOOR_MARKER)) return [];
    const banned = new Set(LOOT_BANS[name] ?? []);
    return rows(OWNER_LOOT_WEIGHTS.panzerfaustFloor, (g) => !banned.has(g));
}

/**
 * The maps with the owner's rows (the input is not mutated): the classic floor rows and the Panzerfaust's floor rows,
 * the ring case replaced where a map has one, CLUB_VAULT_TABLE on every map with a `tier_guns` table (the club's gun
 * box is one map object for every map) and GOLD_BONUS_TABLE on every map (so are the gold crates).
 */
export function applyOwnerLoot(maps: Readonly<Record<string, MapDef>>, ammoOf: AmmoOf): Record<string, MapDef> {
    const out: Record<string, MapDef> = {};
    for (const [name, def] of Object.entries(maps)) {
        const tables: Record<string, LootTableEntry[]> = { ...def.lootTable };
        const floorRows = [
            ...(OWNER_CLASSIC_FLOOR_MAPS.includes(name) ? rows(OWNER_LOOT_WEIGHTS.classicFloor, () => true) : []),
            ...panzerfaustFloorRows(name, def),
        ];
        if (floorRows.length > 0) {
            const floor = tables[FLOOR];
            if (!floor) throw new Error(`owner loot: ${name} has no ${FLOOR}`);
            for (const e of floorRows)
                if (floor.some((f) => f.name === e.name)) throw new Error(`owner loot: ${name} ${FLOOR} has ${e.name}`);
            tables[FLOOR] = [...floor, ...floorRows];
        }
        if (tables[RING_CASE_TABLE]) tables[RING_CASE_TABLE] = ownerRingCase(name, def);
        if (tables[FLOOR]) {
            if (Object.hasOwn(tables, CLUB_VAULT_TABLE)) throw new Error(`${name}: ${CLUB_VAULT_TABLE} exists`);
            tables[CLUB_VAULT_TABLE] = clubVaultTable(name, def, ammoOf);
        }
        if (Object.hasOwn(tables, GOLD_BONUS_TABLE)) throw new Error(`${name}: ${GOLD_BONUS_TABLE} exists`);
        tables[GOLD_BONUS_TABLE] = goldBonusTable(name, def, ammoOf);
        out[name] = { ...def, lootTable: tables };
    }
    return out;
}

/** The club's gun box: deposit_box_02 whose `tier_guns` roll is CLUB_VAULT_TABLE (its tier_soviet roll stays). */
export function clubVaultBox(generated: Readonly<Record<string, MapObjectDef>>): ObstacleDef {
    const box = generated[CLUB_VAULT_BOX_BASE] as ObstacleDef;
    if (box?.type !== "obstacle") throw new Error(`club vault box base "${CLUB_VAULT_BOX_BASE}" is not an obstacle`);
    if (!box.loot.some((l) => l.tier === FLOOR)) throw new Error(`${CLUB_VAULT_BOX_BASE} rolls no ${FLOOR}`);
    const loot: LootSpawnDef[] = box.loot.map((l) => (l.tier === FLOOR ? { ...l, tier: CLUB_VAULT_TABLE } : { ...l }));
    return { ...box, loot };
}

/**
 * A copy of club_01 whose secret room boxes (the children of survev's weighted type SURVEV_CLUB_VAULT_BOXES) take
 * OWNER_LOOT_WEIGHTS.clubVaultBoxes; every other child is unchanged. Throws unless exactly the two boxes match.
 */
export function clubVaultBuilding(generated: Readonly<Record<string, MapObjectDef>>): Record<string, BuildingDef> {
    const club = generated[CLUB_VAULT_BUILDING] as BuildingDef;
    if (club?.type !== "building") throw new Error(`"${CLUB_VAULT_BUILDING}" is not a building`);
    const survev = JSON.stringify(SURVEV_CLUB_VAULT_BOXES);
    let boxes = 0;
    const mapObjects = club.mapObjects.map((child) => {
        if (typeof child.type === "string" || JSON.stringify(child.type) !== survev) return child;
        boxes++;
        return { ...child, type: { ...OWNER_LOOT_WEIGHTS.clubVaultBoxes } };
    });
    if (boxes !== 2) throw new Error(`${CLUB_VAULT_BUILDING}: ${boxes} secret room boxes, expected 2`);
    return { [CLUB_VAULT_BUILDING]: { ...club, mapObjects } };
}

/**
 * Copies of the GOLD_BONUS_CRATES (as `current` holds them: the rare throwables' copies, rebirth/strobeLoot.ts) with
 * one GOLD_BONUS_TABLE roll appended after their own loot, so their other rolls keep their order.
 */
export function goldBonusCrates(current: Readonly<Record<string, MapObjectDef>>): Record<string, ObstacleDef> {
    const out: Record<string, ObstacleDef> = {};
    for (const id of GOLD_BONUS_CRATES) {
        const crate = current[id] as ObstacleDef;
        if (crate?.type !== "obstacle") throw new Error(`gold bonus crate "${id}" is not an obstacle`);
        if (crate.loot[0]?.tier !== "tier_airdrop_rare") throw new Error(`${id} does not roll its gold gun first`);
        out[id] = { ...crate, loot: [...crate.loot, { tier: GOLD_BONUS_TABLE, min: 1, max: 1, props: {} }] };
    }
    return out;
}
