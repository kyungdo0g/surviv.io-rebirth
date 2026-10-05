// Map defs: survev MapDefs (server data: gameConfig, lootTable, mapGen) with the client-visible parts replaced by
// the original client's map defs where the original has that map; plus loot table cleanup.
import { clone, diffKeys, isPlainObject, mergeWinner } from "./util.ts";

/** survev map key holding the original client's map def for each original mapId */
export const ORIGINAL_MAP_KEYS: Record<number, string> = {
    0: "main",
    1: "desert",
    2: "woods",
    3: "faction",
    4: "potato",
    5: "savannah",
    6: "halloween",
    7: "cobalt",
};

const CLIENT_KEYS = ["desc", "assets", "biome", "gameMode"] as const;

export interface MapProvenance {
    inOriginalClient: boolean;
    mapId: number;
    /** client-visible fields that differed and were replaced by the original value */
    clientFieldsOverridden?: string[];
    /** client-visible fields only survev has (kept) */
    survevOnlyClientFields?: string[];
}

export function portMaps(
    survevMaps: Record<string, any>,
    liveMaps: Map<number, any>,
    warnings: string[],
): { maps: Record<string, any>; provenance: Record<string, MapProvenance> } {
    const maps: Record<string, any> = {};
    const provenance: Record<string, MapProvenance> = {};
    const matched = new Set<number>();
    for (const [name, def] of Object.entries(survevMaps)) {
        const out = clone(def);
        const orig = ORIGINAL_MAP_KEYS[def.mapId] === name ? liveMaps.get(def.mapId) : undefined;
        if (!orig) {
            maps[name] = out;
            provenance[name] = { inOriginalClient: false, mapId: def.mapId };
            continue;
        }
        matched.add(orig.mapId);
        if (orig.desc?.name !== def.desc?.name) {
            warnings.push(`map ${name}: original desc.name ${orig.desc?.name} != survev ${def.desc?.name}`);
        }
        const overridden: string[] = [];
        const survevOnly: string[] = [];
        for (const k of CLIENT_KEYS) {
            if (!(k in orig)) continue;
            for (const d of diffKeys(orig[k], def[k], k)) {
                if (d.kind === "survevOnly") survevOnly.push(d.path);
                else overridden.push(d.path);
            }
            out[k] = mergeWinner(orig[k], def[k]);
        }
        out.mapId = orig.mapId;
        maps[name] = out;
        provenance[name] = {
            inOriginalClient: true,
            mapId: orig.mapId,
            clientFieldsOverridden: overridden,
            survevOnlyClientFields: survevOnly,
        };
    }
    for (const id of liveMaps.keys()) {
        if (!matched.has(id)) warnings.push(`original client map ${id} has no survev counterpart`);
    }
    return { maps, provenance };
}

/** Loot tiers survev renamed; the original client's map objects reference the original names. */
export const TIER_RENAMES: Record<string, string> = {
    // original loot_tier_sledgehammer (barn basement) -> tier_sledgehammer; survev: loot_tier_barn_melee -> tier_barn_melee
    tier_barn_melee: "tier_sledgehammer",
};

export function renameTiers(
    maps: Record<string, any>,
): Array<{ id: string; field: string; value: string; reason: string }> {
    const log: Array<{ id: string; field: string; value: string; reason: string }> = [];
    for (const [name, def] of Object.entries(maps)) {
        if (!isPlainObject(def.lootTable)) continue;
        const table: Record<string, any[]> = {};
        for (const [tier, entries] of Object.entries<any[]>(def.lootTable)) {
            const to = TIER_RENAMES[tier];
            if (to && !(to in def.lootTable)) {
                log.push({
                    id: `${name}.lootTable`,
                    field: tier,
                    value: to,
                    reason: "survev tier renamed back to the original name",
                });
            }
            for (const e of entries) if (TIER_RENAMES[e?.name]) e.name = TIER_RENAMES[e.name];
            table[to && !(to in def.lootTable) ? to : tier] = entries;
        }
        def.lootTable = table;
    }
    return log;
}

export interface LootRemoval {
    map: string;
    tier: string;
    item: string;
    reason: string;
}

/** Drops loot entries for items missing from the final game objects and xp_* drops (accounts are out of scope). */
export function cleanLootTables(maps: Record<string, any>, gameObjects: Record<string, unknown>): LootRemoval[] {
    const removals: LootRemoval[] = [];
    for (const [map, def] of Object.entries(maps)) {
        for (const [tier, entries] of Object.entries<any[]>(def.lootTable ?? {})) {
            if (!Array.isArray(entries) || entries.length === 0) continue;
            const kept = entries.filter((e) => {
                const name = String(e?.name ?? "");
                let reason: string | undefined;
                if (name.startsWith("xp_")) reason = "xp drop (accounts are out of scope)";
                else if (name !== "" && !name.startsWith("tier_") && !(name in gameObjects)) {
                    reason = "item not in the original client's game objects (fork-only)";
                }
                if (reason) removals.push({ map, tier, item: name, reason });
                return !reason;
            });
            if (kept.length === 0) {
                kept.push({ name: "", count: 1, weight: 1 });
                removals.push({ map, tier, item: "", reason: "table emptied: replaced with a single no-drop entry" });
            }
            def.lootTable[tier] = kept;
        }
    }
    return removals;
}

/** Drops `$weighted` role weapon options whose item does not exist (e.g. survev's potato_lmg). */
export function cleanRoleOverrides(maps: Record<string, any>, gameObjects: Record<string, unknown>) {
    const removals: Array<{ map: string; where: string; item: string; reason: string }> = [];
    const visit = (v: unknown, map: string, where: string) => {
        if (Array.isArray(v)) for (const [i, x] of v.entries()) visit(x, map, `${where}.${i}`);
        if (!isPlainObject(v)) return;
        if (Array.isArray(v.$weighted)) {
            v.$weighted = v.$weighted.filter((o: any) => {
                const bad = typeof o?.type === "string" && o.type !== "" && !(o.type in gameObjects);
                if (bad) removals.push({ map, where, item: o.type, reason: "item not in the original client" });
                return !bad;
            });
        }
        for (const [k, x] of Object.entries(v)) visit(x, map, `${where}.${k}`);
    };
    for (const [name, def] of Object.entries(maps)) {
        visit(def.gameConfig?.roles?.roleOverrides, name, "gameConfig.roles.roleOverrides");
    }
    return removals;
}

/** Per-map role overrides only make sense for roles that exist; reports the ones that don't. */
export function mapRoleProblems(maps: Record<string, any>, gameObjects: Record<string, any>): string[] {
    const out: string[] = [];
    for (const [name, def] of Object.entries(maps)) {
        const overrides = def.gameConfig?.roles?.roleOverrides;
        if (!isPlainObject(overrides)) continue;
        for (const role of Object.keys(overrides)) {
            if (gameObjects[role]?.type !== "role") out.push(`map ${name}: roleOverrides.${role} is not a role`);
        }
        const items: string[] = [];
        JSON.stringify(overrides, (key, value) => {
            const itemKey = ["type", "helmet", "chest", "backpack", "outfit"].includes(key);
            if (itemKey && typeof value === "string" && value !== "") items.push(value);
            return value;
        });
        for (const item of items)
            if (!(item in gameObjects)) out.push(`map ${name}: roleOverrides item ${item} missing`);
    }
    return out;
}
