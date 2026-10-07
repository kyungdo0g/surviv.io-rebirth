// Game objects, map objects and GameConfig: original client values, with survev filling only what the original
// client lacks (map objects a ported map needs, server-only GameConfig keys).
import {
    mapDefSpawnRefs,
    mapObjectChildIds,
    mapObjectClosure,
    perkModeRoles,
} from "../../../packages/defs/src/refs.ts";
import { type PortPolicy, portedSurvevIds } from "./policy.ts";
import { clone, deepEqual, diffKeys, isPlainObject, type KeyDiff, mergeWinner } from "./util.ts";

export interface Fixup {
    id: string;
    field: string;
    value: unknown;
    reason: string;
}

export type GameObjectStatus = "original" | "survev-only";

export interface GameObjectPort {
    defs: Record<string, any>;
    status: Record<string, GameObjectStatus>;
    fixups: Fixup[];
    excluded: string[];
}

/**
 * A survev reskin of an original def: the original def of `base` with every top-level field survev's skin changes
 * against survev's own base (its world image, `baseType`, `noPotatoSwap`), so the skin keeps the base's stats.
 */
function skinDef(id: string, base: string, live: Record<string, any>, survev: Record<string, any>): any {
    const skin = survev[id];
    if (!skin || !survev[base] || !live[base])
        throw new Error(`policy.json: skin ${id} of ${base} not in both sources`);
    const out = clone(live[base]);
    for (const k of Object.keys(skin)) if (!deepEqual(skin[k], survev[base][k])) out[k] = clone(skin[k]);
    return out;
}

/**
 * Every original client game object, in client order (untyped explosions get `type: "explosion"` from survev), then
 * the survev-only ids the policy ports, in survev order: listed ids as survev has them, skins via skinDef.
 */
export function portGameObjects(
    live: Record<string, any>,
    survev: Record<string, any>,
    policy: PortPolicy,
): GameObjectPort {
    const defs: Record<string, any> = {};
    const status: Record<string, GameObjectStatus> = {};
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
        status[id] = "original";
    }
    const ported = portedSurvevIds(policy);
    for (const id of ported) {
        if (id in live) throw new Error(`policy.json: ${id} is an original id, not survev-only`);
        if (!(id in survev)) throw new Error(`policy.json: ${id} is not a survev game object`);
    }
    for (const id of Object.keys(survev)) {
        if (!ported.has(id)) continue;
        const base = policy.survevSkins[id];
        defs[id] = base ? skinDef(id, base, live, survev) : clone(survev[id]);
        status[id] = "survev-only";
    }
    const excluded = Object.keys(survev).filter((id) => !(id in defs));
    return { defs, status, fixups, excluded };
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
    /** policy paths whose survev value replaced the original one */
    survev: Array<{ path: string; original: unknown; survev: unknown }>;
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

const pathGet = (o: any, path: string[]): any => path.reduce((a, k) => (isPlainObject(a) ? a[k] : undefined), o);

/**
 * survev GameConfig deep-merged under the original client GameConfig, except the `survevPaths` (policy.json
 * survevGameConfig), which take survev's value; an array is cut to the original's length (bags keep the original's
 * four levels). Item-keyed tables are pruned to known items.
 */
export function portGameConfig(
    live: Record<string, any>,
    survev: Record<string, any>,
    gameObjects: Record<string, unknown>,
    survevPaths: readonly string[] = [],
): GameConfigPort {
    const config = mergeWinner(live, survev);
    const diffs = diffKeys(live, survev);
    const taken: GameConfigPort["survev"] = [];
    for (const path of survevPaths) {
        const keys = path.split(".");
        const original = pathGet(live, keys);
        let value = clone(pathGet(survev, keys));
        if (value === undefined) throw new Error(`policy.json survevGameConfig: survev has no ${path}`);
        if (Array.isArray(value) && Array.isArray(original)) value = value.slice(0, original.length);
        const holder = pathGet(config, keys.slice(0, -1));
        if (!isPlainObject(holder)) throw new Error(`policy.json survevGameConfig: ${path} has no parent object`);
        holder[keys.at(-1)!] = value;
        taken.push({ path, original, survev: value });
    }
    const prunes: GameConfigPort["prunes"] = [];
    const itemTables: Array<[string, Record<string, unknown> | undefined]> = [
        ["bagSizes", config.bagSizes],
        ["player.defaultItems.inventory", config.player?.defaultItems?.inventory],
    ];
    for (const [path, table] of itemTables) {
        for (const key of Object.keys(table ?? {})) {
            if (key in gameObjects) continue;
            delete table![key];
            prunes.push({ path: `${path}.${key}`, reason: "item not in the ported game objects" });
        }
    }
    return { config, diffs, prunes, survev: taken };
}
