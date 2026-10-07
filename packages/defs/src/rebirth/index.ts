// The rebirth defs layer: deliberate deviations from v0.8.82 requested by the user, applied to the generated defs when
// @rebirth/defs loads (data.ts), before the id registries are built. Generated JSON is never edited by hand
// (tools/port-survev regenerates it); everything the rebirth changes or adds lives here, in code, with its reason.
// docs/research/rebirth-deviations.md is the cited list.
import type { ExplosionDef, GameObjectDef, MapObjectDef } from "../types/index.ts";
import { rebirthOnlyDefs, rebirthOnlyMapObjects } from "./defs.ts";
import { applyBalanceDeviations, type DefDeviation } from "./deviations.ts";

export * from "./airstrikeVariants.ts";
export { type DefDeviation, FRAG_DECAL_TYPE, FRAG_RADIUS_MULT } from "./deviations.ts";

export interface RebirthDefs {
    /** generated game objects with the deviations applied, then the rebirth-only ones (in registry order) */
    gameObjects: Record<string, GameObjectDef>;
    /** generated map objects, then the rebirth-only ones (in registry order) */
    mapObjects: Record<string, MapObjectDef>;
    /** balance deviations applied to generated defs */
    deviations: DefDeviation[];
    /** ids of the rebirth-only game objects, appended after every generated id */
    addedGameObjects: string[];
    /** ids of the rebirth-only map objects, appended after every generated id */
    addedMapObjects: string[];
}

/** Adds `extra` after the ids of `defs`; a clash with an existing id throws. */
function append<T>(defs: Record<string, T>, extra: Record<string, T>): string[] {
    for (const [id, def] of Object.entries(extra)) {
        if (Object.hasOwn(defs, id)) throw new Error(`rebirth def "${id}" clashes with a generated def`);
        defs[id] = def;
    }
    return Object.keys(extra);
}

/** Applies the rebirth layer to the generated game and map objects (which are left untouched). */
export function applyRebirthDefs(
    generatedGameObjects: Readonly<Record<string, GameObjectDef>>,
    generatedMapObjects: Readonly<Record<string, MapObjectDef>>,
): RebirthDefs {
    const gameObjects: Record<string, GameObjectDef> = { ...generatedGameObjects };
    const mapObjects: Record<string, MapObjectDef> = { ...generatedMapObjects };
    const deviations = applyBalanceDeviations(gameObjects);
    const addedGameObjects = append(gameObjects, rebirthOnlyDefs(generatedGameObjects));
    const addedMapObjects = append(mapObjects, rebirthOnlyMapObjects(generatedMapObjects));
    // every scorch decal an explosion leaves must exist (the rebirth ones point at the rebirth decals)
    for (const [id, def] of Object.entries(gameObjects)) {
        const decal = def.type === "explosion" ? (def as ExplosionDef).decalType : "";
        if (decal && mapObjects[decal]?.type !== "decal") throw new Error(`${id}: decal "${decal}" is not a decal`);
    }
    return { gameObjects, mapObjects, deviations, addedGameObjects, addedMapObjects };
}
