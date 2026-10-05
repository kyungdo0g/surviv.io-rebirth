// Game objects, map objects and GameConfig: original client values, with survev filling only what the original
// client lacks (map objects a ported map needs, server-only GameConfig keys).
import {
    mapDefSpawnRefs,
    mapObjectChildIds,
    mapObjectClosure,
    perkModeRoles,
} from "../../../packages/defs/src/refs.ts";
import { clone, diffKeys, isPlainObject, type KeyDiff, mergeWinner } from "./util.ts";

export interface Fixup {
    id: string;
    field: string;
    value: unknown;
    reason: string;
}

/** Every original client game object, in client order. Untyped explosions get `type: "explosion"` (from survev). */
export function portGameObjects(
    live: Record<string, any>,
    survev: Record<string, any>,
): { defs: Record<string, any>; fixups: Fixup[]; excluded: string[] } {
    const defs: Record<string, any> = {};
    const fixups: Fixup[] = [];
    for (const [id, def] of Object.entries(live)) {
        let out = clone(def);
        if (typeof out.type !== "string") {
            const type = survev[id]?.type;
            if (typeof type !== "string") throw new Error(`game object ${id} has no type in either source`);
            out = { type, ...out };
            fixups.push({
                id,
                field: "type",
                value: type,
                reason: "missing in the original client def; taken from survev",
            });
        }
        defs[id] = out;
    }
    const excluded = Object.keys(survev).filter((id) => !(id in live));
    return { defs, fixups, excluded };
}

export interface MapObjectPort {
    defs: Record<string, any>;
    status: Record<string, "original" | "survev-only">;
    fixups: Fixup[];
    lootRemovals: Array<{ mapObject: string; item: string; reason: string }>;
    excluded: string[];
    missing: string[];
}

// survev renamed the original `obstacleType` / `structureType` fields to `category`
const CATEGORY_FIELD: Record<string, string> = { obstacle: "obstacleType", structure: "structureType" };

function renameKey(obj: Record<string, any>, from: string, to: string): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of Object.keys(obj)) out[k === from ? to : k] = obj[k];
    return out;
}

/**
 * All original client map objects in client order, then every survev-only map object reachable from a ported map
 * (spawns, crates, unlocks) or from another included map object, in survev order.
 */
export function portMapObjects(
    live: Record<string, any>,
    survev: Record<string, any>,
    maps: Record<string, any>,
    gameObjects: Record<string, unknown>,
): MapObjectPort {
    const defs: Record<string, any> = {};
    const status: Record<string, "original" | "survev-only"> = {};
    for (const [id, def] of Object.entries(live)) {
        defs[id] = clone(def);
        status[id] = "original";
    }
    const roles = perkModeRoles(Object.values(maps));
    const roots: string[] = [];
    for (const map of Object.values(maps)) roots.push(...mapDefSpawnRefs(map).map((r) => r.id));
    for (const def of Object.values(live)) roots.push(...mapObjectChildIds(def, roles));
    const reachable = new Set(mapObjectClosure(roots, { ...survev, ...live }, roles));
    const missing = [...reachable].filter((id) => !(id in live) && !(id in survev)).sort();

    const fixups: Fixup[] = [];
    const lootRemovals: MapObjectPort["lootRemovals"] = [];
    for (const [id, def] of Object.entries(survev)) {
        if (id in live || !reachable.has(id)) continue;
        let out = clone(def);
        const field = CATEGORY_FIELD[out.type];
        if (field && "category" in out && !(field in out)) {
            out = renameKey(out, "category", field);
            fixups.push({
                id,
                field,
                value: out[field],
                reason: "survev `category` renamed to the original field name",
            });
        }
        if (Array.isArray(out.loot)) {
            out.loot = out.loot.filter((l: any) => {
                const bad = typeof l?.type === "string" && l.type !== "" && !(l.type in gameObjects);
                if (bad) lootRemovals.push({ mapObject: id, item: l.type, reason: "item not in the original client" });
                return !bad;
            });
        }
        defs[id] = out;
        status[id] = "survev-only";
    }
    const excluded = Object.keys(survev).filter((id) => !(id in defs));
    return { defs, status, fixups, lootRemovals, excluded, missing };
}

export interface GameConfigPort {
    config: Record<string, any>;
    diffs: KeyDiff[];
    prunes: Array<{ path: string; reason: string }>;
}

/** All dot paths (objects only; arrays are leaves) of an object. */
export function objectPaths(v: unknown, prefix = "", out = new Set<string>()): Set<string> {
    if (!isPlainObject(v)) return out;
    for (const k of Object.keys(v)) {
        const p = prefix ? `${prefix}.${k}` : k;
        out.add(p);
        objectPaths(v[k], p, out);
    }
    return out;
}

/** survev GameConfig deep-merged under the original client GameConfig; item-keyed tables pruned to known items. */
export function portGameConfig(
    live: Record<string, any>,
    survev: Record<string, any>,
    gameObjects: Record<string, unknown>,
): GameConfigPort {
    const config = mergeWinner(live, survev);
    const diffs = diffKeys(live, survev);
    const prunes: GameConfigPort["prunes"] = [];
    const itemTables: Array<[string, Record<string, unknown> | undefined]> = [
        ["bagSizes", config.bagSizes],
        ["player.defaultItems.inventory", config.player?.defaultItems?.inventory],
    ];
    for (const [path, table] of itemTables) {
        for (const key of Object.keys(table ?? {})) {
            if (key in gameObjects) continue;
            delete table![key];
            prunes.push({ path: `${path}.${key}`, reason: "item not in the original client's game objects" });
        }
    }
    return { config, diffs, prunes };
}
