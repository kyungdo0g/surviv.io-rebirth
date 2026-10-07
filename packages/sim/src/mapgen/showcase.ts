// Building showcase (rebirth test mode, owner request in docs/handoff/survev-content.md "Owner requests"): a small
// map holding a single building or structure and nothing else, for walking through each one in the sandbox
// (`?building=<type>`). The map def is the first map that spawns the type (biome, loot tables, spawn replacements of
// its children); a lake centre keeps its lake, a bridge, river shack or river cabin gets one river, a building facing the sea
// stands on the beach (survev map.ts genOnWaterEdge), everything else stands in the middle.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapDef, getMapObjectDef, hasMapObjectDef, type MapDef, MapDefs } from "@rebirth/defs";
import type { MapData } from "../view.ts";
import { getBoundingAabb } from "./bounds.ts";
import type { GenerateMapResult } from "./generate.ts";
import { type GeneratedObject, MapGenerator } from "./generator.ts";
import { genBridge, genOnWaterEdge, genRiverCabin } from "./placement.ts";
import { subRng } from "./random.ts";
import { generateRivers, type RiverGenContext } from "./rivers.ts";
import { createTerrain } from "./terrain.ts";

/** Maps whose spawns are not real content. */
const SKIPPED_MAPS: ReadonlySet<string> = new Set(["test_normal", "test_faction"]);
/** Open ground around the object, on each side. */
const MARGIN = 48;
/** River water widths of the bridge sizes (survev map.ts generateBridges: medium 4-9, large 8-20, xlarge 20+). */
const BRIDGE_RIVER_WIDTH = { medium: 6, large: 12, xlarge: 24 } as const;

export interface ShowcaseEntry {
    type: string;
    /** the first map (MapDefs order) that spawns it */
    mapName: string;
}

export interface ShowcaseResult {
    generation: GenerateMapResult;
    mapName: string;
    type: string;
    /** the showcased object (top level, its children follow it in `generation.objects`) */
    object: GeneratedObject;
    /** half the larger side of its bounds: players stand outside this radius around `object.pos` */
    radius: number;
}

/** Top-level buildings and structures a map's generation can spawn, after its spawn replacements. */
function spawnedTypes(def: MapDef): string[] {
    const g = def.mapGen;
    const repl = g.spawnReplacements[0] ?? {};
    const types = [
        ...g.customSpawnRules.locationSpawns.map((s) => s.type),
        ...g.map.rivers.lakes.map((l) => l.centerObj ?? ""),
        ...Object.keys(g.fixedSpawns[0] ?? {}),
        ...g.randomSpawns.flatMap((r) => r.spawns),
        ...g.customSpawnRules.placeSpawns,
        ...Object.keys(g.densitySpawns[0] ?? {}),
        ...Object.values(g.bridgeTypes),
        ...(g.map.rivers.spawnCabins ? ["cabin_01"] : []),
    ];
    return types
        .map((t) => repl[t] ?? t)
        .filter((t) => {
            if (!t || !hasMapObjectDef(t)) return false;
            const kind = getMapObjectDef(t).type;
            return kind === "building" || kind === "structure";
        });
}

let entries: ShowcaseEntry[] | null = null;

/** Every building and structure some map spawns at the top level, grouped by the first map that spawns it. */
export function showcaseEntries(): readonly ShowcaseEntry[] {
    if (entries) return entries;
    const seen = new Set<string>();
    const out: ShowcaseEntry[] = [];
    for (const mapName of Object.keys(MapDefs)) {
        if (SKIPPED_MAPS.has(mapName)) continue;
        for (const type of spawnedTypes(MapDefs[mapName])) {
            if (seen.has(type)) continue;
            seen.add(type);
            out.push({ type, mapName });
        }
    }
    entries = out;
    return out;
}

/** The map a showcased type is shown on: the first that spawns it, else main (a building only reached as a child). */
export function showcaseMapOf(type: string): string {
    return showcaseEntries().find((e) => e.type === type)?.mapName ?? "main";
}

/** The map's river cabin (cabin_01 after the map's spawn replacements). */
function cabinOf(def: MapDef): string {
    return def.mapGen.spawnReplacements[0]?.cabin_01 ?? "cabin_01";
}

/** River width for a bridge (by the map's bridge sizes), a shack or cabin by the river, else 0 (no river). */
function riverWidthFor(type: string, def: MapDef): number {
    // wide enough for the cabin's dock (survev map.ts genCabinDock: rivers 8 and wider)
    if (type === cabinOf(def)) return BRIDGE_RIVER_WIDTH.large;
    const terrain = getMapObjectDef(type).terrain;
    if (!terrain?.bridge && !terrain?.nearbyRiver) return 0;
    const sizes = def.mapGen.bridgeTypes;
    if (sizes.medium === type) return BRIDGE_RIVER_WIDTH.medium;
    if (sizes.xlarge === type) return BRIDGE_RIVER_WIDTH.xlarge;
    return BRIDGE_RIVER_WIDTH.large;
}

/** The map def of a showcase: the home map's, cut to `size` with only the object's lake or river. */
function showcaseDef(base: MapDef, type: string, size: number, riverWidth: number): MapDef {
    const cfg = base.mapGen.map;
    const lakes = cfg.rivers.lakes
        .filter((l) => l.centerObj === type)
        .slice(0, 1)
        .map((l) => ({ ...l, odds: 1, riverMaskRad: undefined, spawnBound: { pos: { x: 0.5, y: 0.5 }, rad: 0 } }));
    return {
        ...base,
        mapGen: {
            ...base.mapGen,
            places: [],
            map: {
                ...cfg,
                baseWidth: size,
                baseHeight: size,
                scale: { small: 1, large: 1 },
                extension: 0,
                rivers: {
                    lakes,
                    weights: riverWidth > 0 ? [{ weight: 1, widths: [riverWidth] }] : [],
                    smoothness: cfg.rivers.smoothness,
                    masks: [],
                    spawnCabins: false,
                },
            },
        },
    };
}

/**
 * Generates the showcase map of one building or structure. Deterministic per (type, seed, map). The result plugs
 * into GameInit.generation; its MapData keeps the home map's name (biome, rules) at the showcase's own size.
 */
export function generateShowcase(type: string, seed = 1, mapName = showcaseMapOf(type)): ShowcaseResult {
    if (!hasMapObjectDef(type)) throw new Error(`generateShowcase: unknown map object ${type}`);
    const base = getMapDef(mapName);
    const objDef = getMapObjectDef(type);
    const cfg = base.mapGen.map;
    const b = getBoundingAabb(type);
    const radius = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / 2;
    const lake = cfg.rivers.lakes.find((l) => l.centerObj === type);
    const riverWidth = riverWidthFor(type, base);
    const waterEdge = objDef.terrain?.waterEdge;
    // room for the object (turned any way), its lake, its beach distance, and open ground around it
    let inner = radius * 2.9 + MARGIN * 2;
    if (lake) inner = Math.max(inner, lake.outerRad * 2.6 + MARGIN * 2);
    if (waterEdge) inner += waterEdge.distMax * 2;
    if (riverWidth) inner = Math.max(inner, 320);
    const size = Math.ceil((inner + 2 * (Math.max(cfg.shoreInset, 0) + cfg.grassInset)) / 32) * 32;
    const def = showcaseDef(base, type, size, riverWidth);

    const rng = subRng(seed, `showcase:${mapName}:${type}`);
    const gen = new MapGenerator(mapName, def, seed, 1, rng);
    const riverCtx: RiverGenContext = {
        width: gen.width,
        height: gen.height,
        shoreInset: gen.shoreInset,
        grassInset: gen.grassInset,
        rng,
        masks: gen.masks,
        factionMode: gen.factionMode,
        factionSplitOri: 0,
        warnings: gen.warnings,
    };
    const riverDescs = generateRivers(riverCtx, def.mapGen.map.rivers);
    gen.riverDescs = riverDescs;
    gen.terrain = createTerrain({
        width: gen.width,
        height: gen.height,
        shoreInset: gen.shoreInset,
        grassInset: gen.grassInset,
        seed,
        rivers: riverDescs.map((r) => ({ width: r.width, looped: r.looped, points: r.points })),
    });

    const ori = objDef.type === "building" || objDef.type === "structure" ? (objDef.ori ?? 0) : 0;
    const lakeRiver = gen.rivers.find((r) => r.looped);
    if (lake && lakeRiver) gen.genAuto(type, lakeRiver.center, 0, 0, 1, 0, true);
    else if (riverWidth && type === cabinOf(base)) genRiverCabin(gen);
    else if (riverWidth) genBridge(gen, type);
    else if (waterEdge) genOnWaterEdge(gen, type);
    // anything not placed by its terrain rule (or without one) stands in the middle
    if (!gen.objects.some((o) => o.parentId === 0 && o.type === type))
        gen.genAuto(type, gen.center, 0, ori, 1, 0, true);
    const object = gen.objects.find((o) => o.parentId === 0 && o.type === type);
    if (!object) throw new Error(`generateShowcase: ${type} was not created`);

    const mapData: MapData = {
        mapName,
        seed,
        width: gen.width,
        height: gen.height,
        shoreInset: gen.shoreInset,
        grassInset: gen.grassInset,
        rivers: riverDescs.map((r) => ({ width: r.width, looped: r.looped, points: r.points.map((p) => v2.copy(p)) })),
        places: [],
        groundPatches: gen.groundPatches,
        objects: gen.objects.map((o) => ({
            id: o.id,
            type: o.type,
            pos: v2.copy(o.pos),
            ori: o.ori,
            scale: o.scale,
            layer: o.layer,
        })),
    };
    const generation: GenerateMapResult = {
        mapData,
        terrain: gen.terrain,
        objects: gen.objects,
        lootSpawns: gen.lootSpawns,
        warnings: [...gen.warnings],
        skipped: [...gen.skipped],
        spawnStats: [],
        scale: gen.scale,
        shoreArea: 0,
        grassArea: 0,
        riverAreas: [],
        factionSplitOri: 0,
    };
    return { generation, mapName, type, object, radius };
}

/** Spots around the showcased object, nearest first: `radius + 4` outwards in rings of 16 directions. */
export function showcaseSpawnSpots(show: ShowcaseResult): Vec2[] {
    const out: Vec2[] = [];
    const { width, height } = show.generation.mapData;
    for (let r = show.radius + 4; r < Math.max(width, height); r += 4) {
        for (let a = 0; a < 16; a++) {
            // start below the object (the camera looks at its front first)
            const ang = -Math.PI / 2 + (a / 16) * Math.PI * 2;
            const p = { x: show.object.pos.x + Math.cos(ang) * r, y: show.object.pos.y + Math.sin(ang) * r };
            if (p.x > 8 && p.y > 8 && p.x < width - 8 && p.y < height - 8) out.push(p);
        }
    }
    return out;
}
