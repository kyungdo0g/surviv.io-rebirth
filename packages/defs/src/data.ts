// The game object, map object and map records every consumer reads: the generated defs (tools/port-survev: v0.8.82
// plus the survev-only content of its policy.json) with the rebirth layer applied (rebirth/index.ts: user-requested
// deviations, rebirth-only defs and loot tables).
// index.ts exposes them typed and registry.ts numbers the objects for the wire, so both always agree.
import gameObjectsJson from "./generated/gameObjects.json" with { type: "json" };
import mapObjectsJson from "./generated/mapObjects.json" with { type: "json" };
import mapsJson from "./generated/maps.json" with { type: "json" };
import { applyRebirthDefs, applyRebirthMaps } from "./rebirth/index.ts";
import { applySurvevWikiSpecs } from "./survev/wikiSpecs.ts";
import type { GameObjectDef, MapDef, MapObjectDef } from "./types/index.ts";

// survev.wiki.gg specs of survev-only items where the wiki and survev's source differ (survev/wikiSpecs.ts)
const survevGameObjects: Record<string, GameObjectDef> = {
    ...(gameObjectsJson as unknown as Readonly<Record<string, GameObjectDef>>),
};
/** fields of survev-only items where the survev.wiki.gg spec replaced survev's source value */
export const survevWikiSpecs = applySurvevWikiSpecs(survevGameObjects);

const rebirth = applyRebirthDefs(
    survevGameObjects,
    mapObjectsJson as unknown as Readonly<Record<string, MapObjectDef>>,
);

export const gameObjectsData: Readonly<Record<string, GameObjectDef>> = rebirth.gameObjects;
export const mapObjectsData: Readonly<Record<string, MapObjectDef>> = rebirth.mapObjects;
/** generated map defs whose loot tables carry the rebirth rows (new guns, air drop tier tables, gold guns) */
export const mapsData: Readonly<Record<string, MapDef>> = applyRebirthMaps(
    mapsJson as unknown as Readonly<Record<string, MapDef>>,
    rebirth.mapObjects,
    rebirth.gameObjects,
);
let unscaledMaps: Readonly<Record<string, MapDef>> | null = null;
/**
 * A map def as it was before REBIRTH_MAP_SCALE (rebirth/mapScale.ts), with every other rebirth change: tests compare
 * the bigger maps' densities with it. Built on first use.
 */
export function unscaledMapDef(name: string): MapDef {
    unscaledMaps ??= applyRebirthMaps(
        mapsJson as unknown as Readonly<Record<string, MapDef>>,
        rebirth.mapObjects,
        rebirth.gameObjects,
        {},
    );
    const def = Object.hasOwn(unscaledMaps, name) ? unscaledMaps[name] : undefined;
    if (!def) throw new Error(`unknown map "${name}"`);
    return def;
}
/** balance deviations from the generated defs (rebirth/deviations.ts) */
export const rebirthDeviations = rebirth.deviations;
/** ids of the rebirth-only game objects, after every generated id */
export const rebirthOnlyIds: readonly string[] = rebirth.addedGameObjects;
/** ids of the rebirth-only map objects (scorch decals, air drop tier crates), after every generated id */
export const rebirthOnlyMapObjectIds: readonly string[] = rebirth.addedMapObjects;
