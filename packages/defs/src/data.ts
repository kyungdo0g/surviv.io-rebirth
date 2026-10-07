// The game object, map object and map records every consumer reads: the generated v0.8.82 defs (tools/port-survev)
// with the rebirth layer applied (rebirth/index.ts: user-requested deviations, rebirth-only defs and loot tables).
// index.ts exposes them typed and registry.ts numbers the objects for the wire, so both always agree.
import gameObjectsJson from "./generated/gameObjects.json" with { type: "json" };
import mapObjectsJson from "./generated/mapObjects.json" with { type: "json" };
import mapsJson from "./generated/maps.json" with { type: "json" };
import { applyRebirthDefs, applyRebirthMaps } from "./rebirth/index.ts";
import type { GameObjectDef, MapDef, MapObjectDef } from "./types/index.ts";

const rebirth = applyRebirthDefs(
    gameObjectsJson as unknown as Readonly<Record<string, GameObjectDef>>,
    mapObjectsJson as unknown as Readonly<Record<string, MapObjectDef>>,
);

export const gameObjectsData: Readonly<Record<string, GameObjectDef>> = rebirth.gameObjects;
export const mapObjectsData: Readonly<Record<string, MapObjectDef>> = rebirth.mapObjects;
/** generated map defs whose loot tables carry the rebirth air drop tier tables */
export const mapsData: Readonly<Record<string, MapDef>> = applyRebirthMaps(
    mapsJson as unknown as Readonly<Record<string, MapDef>>,
    rebirth.mapObjects,
);
/** balance deviations from the generated defs (rebirth/deviations.ts) */
export const rebirthDeviations = rebirth.deviations;
/** ids of the rebirth-only game objects, after every generated id */
export const rebirthOnlyIds: readonly string[] = rebirth.addedGameObjects;
/** ids of the rebirth-only map objects (scorch decals, air drop tier crates), after every generated id */
export const rebirthOnlyMapObjectIds: readonly string[] = rebirth.addedMapObjects;
