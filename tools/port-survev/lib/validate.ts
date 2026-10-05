// Reference check over the ported data; the problems end up in provenance.json and the summary.
import {
    mapDefRoleRefs,
    mapDefSpawnRefs,
    mapObjectChildIds,
    mapObjectClosure,
    mapObjectLootRefs,
    perkModeRoles,
} from "../../../packages/defs/src/refs.ts";

type Defs = Record<string, any>;

const GAME_OBJECT_REFS: Record<string, Array<[string, string | undefined]>> = {
    gun: [
        ["bulletType", "bullet"],
        ["bulletTypeBonus", "bullet"],
        ["ammo", "ammo"],
        ["dualWieldType", "gun"],
        ["projType", undefined],
    ],
    throwable: [
        ["explosionType", "explosion"],
        ["heavyType", "throwable"],
        ["splitType", "throwable"],
    ],
    explosion: [["shrapnelType", "bullet"]],
    bullet: [["onHit", "explosion"]],
};

/** ammo names of special guns that have no ammo def in the original client either */
export const PSEUDO_AMMO = new Set([
    "9mm_cursed", // m9_cursed (ammoInfinite)
    "bugle_ammo", // bugle, the bugler role's noDrop weapon
]);

export interface ValidationResult {
    /** broken references in data that can be used by a map */
    problems: string[];
    /** broken references in defs no map can spawn (dead data kept as in the original client) */
    deadRefs: string[];
}

export function validate(gameObjects: Defs, mapObjects: Defs, maps: Defs): ValidationResult {
    const problems: string[] = [];
    const deadRefs: string[] = [];
    const goRef = (owner: string, field: string, id: unknown, type?: string) => {
        if (typeof id !== "string" || id === "") return;
        const def = gameObjects[id];
        if (!def) problems.push(`${owner}.${field} -> ${id}: missing game object`);
        else if (type && def.type !== type)
            problems.push(`${owner}.${field} -> ${id}: is ${def.type}, expected ${type}`);
    };
    for (const [id, def] of Object.entries(gameObjects)) {
        for (const [field, type] of GAME_OBJECT_REFS[def.type] ?? []) {
            if (field === "ammo" && PSEUDO_AMMO.has(def.ammo)) continue;
            goRef(id, field, def[field], type);
        }
        if (def.type === "explosion" && def.decalType && !(def.decalType in mapObjects)) {
            problems.push(`${id}.decalType -> ${def.decalType}: missing map object`);
        }
        for (const perk of def.type === "role" ? (def.perks ?? []) : []) goRef(id, "perks", perk, "perk");
        goRef(id, "perk", def.perk, "perk");
    }

    const roles = perkModeRoles(Object.values(maps));
    for (const [id, def] of Object.entries(mapObjects)) {
        for (const child of mapObjectChildIds(def, roles)) {
            if (!(child in mapObjects)) problems.push(`mapObject ${id} -> ${child}: missing map object`);
        }
        for (const item of mapObjectLootRefs(def).items) goRef(`mapObject ${id}`, "loot", item);
        goRef(`mapObject ${id}`, "explosion", def.explosion, "explosion");
    }

    const spawnable = new Set<string>();
    for (const [name, map] of Object.entries(maps)) {
        const spawns = mapDefSpawnRefs(map);
        for (const { id, where } of spawns) {
            if (!(id in mapObjects)) problems.push(`map ${name} ${where} -> ${id}: missing map object`);
        }
        for (const role of mapDefRoleRefs(map)) goRef(`map ${name}`, "role", role, "role");
        const table: Record<string, any[]> = map.lootTable ?? {};
        for (const [tier, entries] of Object.entries(table)) {
            for (const e of entries) {
                if (e.name === "") continue;
                if (e.name.startsWith("tier_")) {
                    if (!(e.name in table)) problems.push(`map ${name} ${tier} -> ${e.name}: missing loot table`);
                } else goRef(`map ${name} ${tier}`, "name", e.name);
            }
        }
        // every tier a spawnable object drops must exist in this map's loot table
        for (const id of mapObjectClosure(
            spawns.map((s) => s.id),
            mapObjects,
            roles,
        )) {
            spawnable.add(id);
            for (const tier of mapObjectLootRefs(mapObjects[id] ?? {}).tiers) {
                if (!(tier in table)) problems.push(`map ${name}: ${id} drops ${tier}, not in its loot table`);
            }
        }
    }
    for (const [id, def] of Object.entries(mapObjects)) {
        if (spawnable.has(id)) continue;
        for (const tier of mapObjectLootRefs(def).tiers) {
            if (!Object.values(maps).some((m) => tier in (m.lootTable ?? {}))) {
                deadRefs.push(`mapObject ${id} (spawned by no map) drops ${tier}, which no map defines`);
            }
        }
    }
    return { problems: [...new Set(problems)], deadRefs };
}
