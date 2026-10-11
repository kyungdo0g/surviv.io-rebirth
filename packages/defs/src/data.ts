// The game object, map object and map records every consumer reads: the generated defs (tools/port-survev: v0.8.82
// plus the survev-only content of its policy.json) with the rebirth layer applied (rebirth/index.ts: user-requested
// deviations, rebirth-only defs and loot tables).
// index.ts exposes them typed and registry.ts numbers the objects for the wire, so both always agree.
import gameObjectsJson from "./generated/gameObjects.json" with { type: "json" };
import mapObjectsJson from "./generated/mapObjects.json" with { type: "json" };
import mapsJson from "./generated/maps.json" with { type: "json" };
import { REBIRTH_BUILDING_SPAWNS } from "./rebirth/buildings.ts";
import { applyRebirthDefs, applyRebirthMaps, grassSpawn } from "./rebirth/index.ts";
import { applyRebirthMapRivers } from "./rebirth/mapRivers.ts";
import { playerAreaFactor, REBIRTH_MAP_SCALE, scaleMapDef } from "./rebirth/mapScale.ts";
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
const playerMaps = new Map<string, MapDef>();
/**
 * The map def a game of `maxPlayers` plays on (rebirth/mapScale.ts playerAreaFactor): the map's own def (the same
 * object) when the cap is absent or at most the design count, else a copy grown from the def before REBIRTH_MAP_SCALE
 * by that knob times the square root of the area factor, rounded once. Spawn counts follow the land area as
 * REBIRTH_MAP_SCALE's do; the rebirth buildings keep theirs, so a building a scheduled unlock opens stays single. Only
 * the map generation differs: gameMode, gameConfig and the loot table are the map's own objects. Built once per map and
 * factor.
 */
export function mapDefForPlayers(name: string, maxPlayers?: number): MapDef {
    const base = Object.hasOwn(mapsData, name) ? mapsData[name] : undefined;
    if (!base) throw new Error(`unknown map "${name}"`);
    const f = playerAreaFactor(base, maxPlayers);
    if (f === 1) return base;
    const key = `${name}:${f}`;
    const known = playerMaps.get(key);
    if (known) return known;
    const fixed = new Set(Object.keys(REBIRTH_BUILDING_SPAWNS[name] ?? {}));
    const onGrass = grassSpawn(rebirth.mapObjects);
    const k = (REBIRTH_MAP_SCALE[name] ?? 1) * Math.sqrt(f);
    const grown = scaleMapDef(unscaledMapDef(name), k, (type) => !fixed.has(type) && onGrass(type));
    // the map's own gameMode, gameConfig and loot table (a cap changes only the generation)
    const def: MapDef = { ...base, mapGen: grown.mapGen };
    playerMaps.set(key, def);
    return def;
}
/** balance deviations from the generated defs (rebirth/deviations.ts) */
export const rebirthDeviations = rebirth.deviations;
/** map def deviations from the generated maps (id: the map; rebirth/mapRivers.ts); the map sizes are mapScale.ts's */
export const rebirthMapDeviations = applyRebirthMapRivers(
    mapsJson as unknown as Readonly<Record<string, MapDef>>,
).deviations;
/** ids of the rebirth-only game objects, after every generated id */
export const rebirthOnlyIds: readonly string[] = rebirth.addedGameObjects;
/** ids of the rebirth-only map objects (scorch decals, air drop tier crates), after every generated id */
export const rebirthOnlyMapObjectIds: readonly string[] = rebirth.addedMapObjects;
