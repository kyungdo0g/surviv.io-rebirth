// The survev-only guns: the owner asked for every gun only survev.io has, with the specs of the survev.wiki.gg pages
// (2026-10-07, user/2026-10-07-survev-guns; docs/adr/0003-survev-baseline.md). tools/port-survev ports them from survev
// master c6185e31 as survev ships them (tools/port-survev/policy.json); this module holds what the rebirth layer
// changes on top, each with both sources:
// - WIKI_STAT_OVERRIDES: the fields where the wiki and survev's source differ. The wiki wins (the owner's decision).
// - the Barrett in the normal gold air drop: survev never spawns it on the classic map (only from the crimson air
//   drop, 50v50 military gold drops, Savannah tables and the desert pirate table); the owner named it, so the gold drop
//   of main and its seasonal copies gets it (docs/design/survev-content-and-new-guns.md section 2.1), and with it the
//   owner's SVD and SCAR-SSR (2026-10-08).
// Every other stat of these guns equals its wiki infobox (packages/defs/test/survevGuns.test.ts pins them all). The
// winter skins are the exception, kept on purpose and listed field by field in SKIN_WIKI_GAPS.
import type { GameObjectDef, LootTableEntry, MapDef } from "../types/index.ts";
import type { DefDeviation } from "./deviations.ts";
import { OWNER_LOOT_WEIGHTS } from "./ownerLootWeights.ts";

/** The survev-only guns (survev master c6185e31), in the order survev defines them. */
export const SURVEV_ONLY_GUNS = ["imbel", "spas16", "barrett", "sw500", "ash12", "potato_lmg"] as const;
/** survev's winter reskins (snow maps): the base's own def with survev's winter world image (gun-<base>-02). */
export const SURVEV_GUN_SKINS: Readonly<Record<string, string>> = {
    svd_winter: "svd",
    sv98_winter: "sv98",
    awc_winter: "awc",
};

export interface SkinWikiGap {
    /** the skin's id */
    id: string;
    /** dot path of the field; `bullet.` is the skin's bulletType def */
    field: string;
    /** survev.wiki.gg value (the base gun's page, the same as survev's source) */
    wiki: number;
    /** our value: the base gun's 0.8.82 value, which the skin shares */
    rebirth: number;
    wikiRef: string;
    survevRef: string;
}

/**
 * Not applied: the fields where the winter skins differ from survev.wiki.gg and survev's source (sweep of 2026-10-07;
 * every other infobox field matches). The wiki shows each skin as the "World image 2" of its base gun's page, and
 * survev builds it as its base plus that image (defineGunSkin, survev/shared/defs/gameObjects/gunDefs.ts:3643-3663),
 * so a skin hits like its base. Survev balance (ADR 0003 option B, tools/port-survev/policy.json survevBalance) gives
 * the base guns survev's gameplay values, which closed the SVD's headshot multiplier and `bullet_svd` damage and the
 * SV-98's headshot multiplier; what is left is the barrel length, presentation the bases keep from the original
 * client (survev lengthened the barrels). packages/defs/test/survevGuns.test.ts fails when a gap closes or a new one
 * appears, so this list stays exact.
 */
export const SKIN_WIKI_GAPS: readonly SkinWikiGap[] = [
    {
        id: "svd_winter",
        field: "barrelLength",
        wiki: 4.2,
        rebirth: 4,
        wikiRef: "wikigg/SVD-63 (rev 7355): Barrel length = 4.2",
        survevRef: "survev/shared/defs/gameObjects/gunDefs.ts:1681",
    },
    {
        id: "sv98_winter",
        field: "barrelLength",
        wiki: 4.1,
        rebirth: 3.5,
        wikiRef: "wikigg/SV-98 (rev 7360): Barrel length = 4.1",
        survevRef: "survev/shared/defs/gameObjects/gunDefs.ts:1533",
    },
    {
        id: "awc_winter",
        field: "barrelLength",
        wiki: 4,
        rebirth: 3.8,
        wikiRef: "wikigg/AWM-S (rev 7321): Barrel length = 4",
        survevRef: "survev/shared/defs/gameObjects/gunDefs.ts:1584",
    },
];

export interface WikiStatOverride {
    id: string;
    /** dot path of the field */
    field: string;
    /** survev.wiki.gg value (applied) */
    wiki: number;
    /** survev source value (the generated def's; the override throws if the port ever brings another) */
    survev: number;
    wikiRef: string;
    survevRef: string;
}

/**
 * Where survev.wiki.gg and survev's source differ for the survev-only guns (sweep of 2026-10-07; every other infobox
 * field matches the source). The wiki's other known slips are not stats: the Barrett page's armour example (45.5) is
 * arithmetic, and the Petite Potato page's explosion max radius 1.7 is contradicted by the newer PMG-134 page (1.75,
 * as the source), so the explosion keeps 1.75.
 */
export const WIKI_STAT_OVERRIDES: readonly WikiStatOverride[] = [
    {
        id: "potato_lmg",
        field: "barrelLength",
        wiki: 4.5,
        survev: 5,
        wikiRef: "wikigg/PMG-134 (rev 6674): Barrel length = 4.5",
        survevRef: "survev/shared/defs/gameObjects/gunDefs.ts:3543",
    },
    {
        id: "potato_lmgshot",
        field: "throwPhysics.velZ",
        wiki: 3,
        survev: 5,
        wikiRef: "wikigg/Petite_Potato (rev 4006): VelZ = 3",
        survevRef: "survev/shared/defs/gameObjects/throwableDefs.ts:762",
    },
];

/** `def` with the number at `path` replaced (new objects along the path; the input is never mutated). */
function withValue<T>(def: T, path: readonly string[], value: number): T {
    const [head, ...rest] = path;
    const node = def as Record<string, unknown>;
    return { ...node, [head]: rest.length ? withValue(node[head], rest, value) : value } as T;
}

function valueAt(def: unknown, path: readonly string[]): unknown {
    return path.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], def);
}

/** Applies WIKI_STAT_OVERRIDES to `defs` (a mutable copy of the generated record). Returns what changed. */
export function applyWikiStatOverrides(defs: Record<string, GameObjectDef>): DefDeviation[] {
    return WIKI_STAT_OVERRIDES.map((o) => {
        const path = o.field.split(".");
        const current = valueAt(defs[o.id], path);
        if (current !== o.survev) {
            throw new Error(
                `${o.id}.${o.field} is ${String(current)}, expected survev's ${o.survev}: re-check the wiki`,
            );
        }
        defs[o.id] = withValue(defs[o.id], path, o.wiki);
        return {
            id: o.id,
            field: o.field,
            original: o.survev,
            rebirth: o.wiki,
            reason: `survev.wiki.gg wins over the survev source (owner, 2026-10-07): ${o.wikiRef}; ${o.survevRef}`,
        };
    });
}

/** The gold air drop table (`airdrop_crate_02` -> `crate_11`) */
export const GOLD_DROP_TABLE = "tier_airdrop_rare";
/**
 * Rebirth guns added to the gold drop of these maps, with their weight: the Barrett at 1 against survev main's 22.68
 * (garand 6, awc 3, pkp 0.08, m249 0.1, m4a1 4, scorpion 5, ots38_dual 4.5; survev/shared/defs/maps/baseDefs.ts:612),
 * about 1 gold gun in 24; then the owner's SVD and SCAR-SSR "sometimes" (2026-10-08, user/2026-10-08-loot-speed; their
 * weights are OWNER_LOOT_WEIGHTS.goldDrop, rebirth/ownerLootWeights.ts): 0.5 each, 1 gold crate in 56 each with the new
 * guns' gold rows (28.01 in all). survev's classic gold drop has neither (Savannah's has the SCAR-SSR at 1.5,
 * survev/shared/defs/maps/savannahDefs.ts:110). The maps are main and its seasonal copies: spring, summer and snow (the
 * winter one, with awc_winter for the awc; its SVD row is the plain SVD, which snow's tier_snipers also holds). survev
 * builds all three from Main and they keep its "Normal" name and map id (survev/shared/defs/maps/mainSpringDefs.ts:102,
 * mainSummerDefs.ts:99, snowDefs.ts:298). The event maps (Halloween, Turkey, Birthday, Beach, Cobalt) are left out on
 * purpose, although their gold drop is main's: each is a mode of its own with its own name (desc.name), and plan
 * section 2.1 names only the classic map and its seasons.
 */
const CLASSIC_GOLD_GUNS: Readonly<Record<string, number>> = { barrett: 1, ...OWNER_LOOT_WEIGHTS.goldDrop };
export const REBIRTH_GOLD_GUNS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    main: CLASSIC_GOLD_GUNS,
    main_spring: CLASSIC_GOLD_GUNS,
    main_summer: CLASSIC_GOLD_GUNS,
    snow: CLASSIC_GOLD_GUNS,
};

/** The maps with the rebirth gold guns appended to copies of their gold tables (the input is never mutated). */
export function applyRebirthGoldGuns(maps: Readonly<Record<string, MapDef>>): Record<string, MapDef> {
    const out: Record<string, MapDef> = { ...maps };
    for (const [name, guns] of Object.entries(REBIRTH_GOLD_GUNS)) {
        const def = maps[name];
        const table = def?.lootTable[GOLD_DROP_TABLE];
        if (!table) throw new Error(`rebirth gold guns: ${name} has no ${GOLD_DROP_TABLE}`);
        const added: LootTableEntry[] = Object.entries(guns).map(([gun, weight]) => {
            if (table.some((e) => e.name === gun)) throw new Error(`rebirth gold guns: ${name} already drops ${gun}`);
            return { name: gun, count: 1, weight };
        });
        out[name] = { ...def, lootTable: { ...def.lootTable, [GOLD_DROP_TABLE]: [...table, ...added] } };
    }
    return out;
}
