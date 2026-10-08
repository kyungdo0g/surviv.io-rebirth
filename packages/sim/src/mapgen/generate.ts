// generateMap: map size, places, rivers, terrain and every static map object, deterministic per (map, seed, mode).
// Order follows survev server/src/game/map.ts init() and generateObjects().
import { type Collider, math, type Vec2, v2 } from "@rebirth/core";
import { getMapDef, getMapObjectDef, hasMapObjectDef, type MapDef } from "@rebirth/defs";
import { polygonArea } from "../geom/polygon.ts";
import { overlaps, transformOri } from "../geom/transform.ts";
import type { MapData } from "../view.ts";
import { getBoundingAabb } from "./bounds.ts";
import { type GeneratedObject, type LootSpawn, MapGenerator } from "./generator.ts";
import {
    generateBridges,
    genFromMapDef,
    genLocationSpawn,
    genOnRiver,
    genOnRiverShore,
    genRiverCabin,
    type PlaceSpawns,
} from "./placement.ts";
import { randomPointInBounds, subRng } from "./random.ts";
import { generateRiverMasks, generateRivers, type RiverDesc, type RiverGenContext } from "./rivers.ts";
import { createTerrain, type River, type Terrain } from "./terrain.ts";

/** Faction maps restart generation when the river bridges cannot be placed (survev map.ts generateObjects). */
const MAX_GENERATION_ATTEMPTS = 5;
/** River rocks and bushes per 1000 units² of river water, at most 30 each (survev map.ts generateObjects). */
const RIVER_OBJECTS: Readonly<Record<string, number>> = { stone_03: 0.9, bush_04: 0.4 };

export type SpawnSource = "location" | "fixed" | "random" | "density" | "lake" | "riverObject" | "cabin" | "bridge";

export interface SpawnStat {
    type: string;
    source: SpawnSource;
    requested: number;
    /** top-level objects (or loot spawners) created by this request */
    spawned: number;
}

export interface GenerateMapResult {
    mapData: MapData;
    terrain: Terrain;
    /** the objects of `mapData.objects` (same order and ids) with their kind and parent (0 = top level) */
    objects: GeneratedObject[];
    lootSpawns: LootSpawn[];
    warnings: string[];
    /**
     * Spawns left out by a placement rule rather than a failure (M7b), e.g. the crossing bunker on a map whose rivers
     * are all 8 wide or narrower (survev map.ts genBridge returns quietly)
     */
    skipped: string[];
    spawnStats: SpawnStat[];
    scale: "small" | "large";
    /** shore polygon area minus riverbank areas: the base of density spawn counts */
    shoreArea: number;
    grassArea: number;
    riverAreas: Array<{ water: number; shore: number }>;
    /** faction maps: 0 the river runs left-right (Red below), 1 top-bottom (Red left) (survev factionModeSplitOri) */
    factionSplitOri: 0 | 1;
}

interface MapSpawn {
    type: string;
    count: number;
    source: SpawnSource;
    location?: { pos: Vec2; rad: number; retryOnFailure: boolean };
}

function clampSwap(v: number, a: number, b: number): number {
    return a > b ? math.clamp(v, b, a) : math.clamp(v, a, b);
}

/** Reserves room for buildings near named places before rivers are generated (survev generatePlaceSpawns). */
function reservePlaceSpawns(gen: MapGenerator, def: MapDef): PlaceSpawns {
    const reserved: Array<{ type: string; pos: Vec2; ori: number }> = [];
    const positions = def.mapGen.places
        .filter((p) => !p.dontSpawnObjects)
        // place positions are stored with y pointing down
        .map((p) => ({ x: p.pos.x * gen.width, y: Math.abs(p.pos.y - 1) * gen.height }));
    for (const type of def.mapGen.customSpawnRules.placeSpawns) {
        if (!hasMapObjectDef(type)) {
            gen.warnOnce(`unknown place spawn type ${type}`);
            continue;
        }
        const bound = getBoundingAabb(type);
        const local: Collider = { type: 1, min: bound.min, max: bound.max };
        gen.trySpawn(`place_${type}`, () => {
            if (!positions.length) return false;
            const idx = gen.rng.int(0, positions.length - 1);
            const { ori } = gen.getOriAndScale(type);
            const rotated = transformOri(local, { x: 0, y: 0 }, ori, 1.15);
            if (rotated.type !== 1) return false;
            const w = rotated.max.x - rotated.min.x;
            const h = rotated.max.y - rotated.min.y;
            const offset = randomPointInBounds(gen.rng, v2.mul(rotated.min, 0.5), v2.mul(rotated.max, 0.5));
            const raw = v2.add(positions[idx], offset);
            const pos = {
                x: clampSwap(raw.x, gen.shoreInset + w, gen.width - gen.shoreInset - w),
                y: clampSwap(raw.y, gen.shoreInset + h, gen.height - gen.shoreInset - h),
            };
            const collision = transformOri(local, pos, ori, 1.15);
            if (gen.masks.some((m) => overlaps(m, collision))) return false;
            reserved.push({ type, pos, ori });
            gen.addCollider(collision, 0, "building");
            gen.masks.push(collision);
            positions.splice(idx, 1);
            return true;
        });
    }
    return {
        take(type: string) {
            const idx = reserved.findIndex((r) => r.type === type);
            if (idx < 0) return undefined;
            const [r] = reserved.splice(idx, 1);
            return { pos: r.pos, ori: r.ori };
        },
    };
}

/** The town bridge and two large bridges across the faction river; null when they do not fit. */
function generateFactionBridges(gen: MapGenerator): string[] | null {
    const river = gen.normalRivers[0];
    const xl = gen.def.mapGen.bridgeTypes.xlarge;
    const types = ["river_town_01", xl, xl].filter((t) => t && hasMapObjectDef(t));
    const ranges: Array<[number, number]> = [
        [0.45, 0.55],
        [0.2, 0.3],
        [0.7, 0.85],
    ];
    const placed: Array<{ type: string; pos: Vec2; ori: number }> = [];
    for (const type of types) {
        let found = false;
        for (let j = 0; j < ranges.length && !found; j++) {
            const [lo, hi] = ranges[j];
            found = gen.trySpawn(
                type,
                () => {
                    const t = math.clamp(gen.rng.range(lo, hi), 0, 1);
                    const pos = river.spline.getPos(t);
                    const norm = river.spline.getNormal(t);
                    // the river town has red on its left and blue on its right
                    const ori =
                        type === "river_town_01" ? gen.factionSplitOri ^ 1 : math.radToOri(Math.atan2(norm.y, norm.x));
                    if (!gen.canSpawn(type, pos, ori, 1)) return false;
                    placed.push({ type, pos, ori });
                    return true;
                },
                undefined,
                false,
            );
            if (found) ranges.splice(j, 1);
        }
        if (!found) return null;
    }
    for (const b of placed) gen.genAuto(b.type, b.pos, 0, b.ori);
    return placed.map((b) => b.type);
}

/** Records how many top-level objects each spawn request created. */
class SpawnRunner {
    readonly gen: MapGenerator;
    readonly stats: SpawnStat[] = [];

    constructor(gen: MapGenerator) {
        this.gen = gen;
    }

    private topLevelCount(): number {
        let n = 0;
        for (const o of this.gen.objects) if (o.parentId === 0) n++;
        for (const l of this.gen.lootSpawns) if (l.parentId === 0) n++;
        return n;
    }

    /** Runs `fn` and records how many top-level objects it created. */
    track(type: string, source: SpawnSource, requested: number, fn: () => void): number {
        const before = this.topLevelCount();
        fn();
        const spawned = this.topLevelCount() - before;
        this.stats.push({ type, source, requested, spawned });
        return spawned;
    }
}

function spawnSize(type: string): number {
    const b = getBoundingAabb(type);
    return (b.max.x - b.min.x) * (b.max.y - b.min.y);
}

function runGeneration(mapName: string, def: MapDef, seed: number, teamMode: 1 | 2 | 4, attempt: number) {
    const rng = subRng(seed, `mapgen:${mapName}:${attempt}`);
    const gen = new MapGenerator(mapName, def, seed, teamMode, rng);
    const mapGen = def.mapGen;
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

    generateRiverMasks(riverCtx, mapGen.map.rivers.masks);
    const places = reservePlaceSpawns(gen, def);
    if (gen.factionMode) {
        gen.factionSplitOri = rng.int(0, 1) as 0 | 1;
        riverCtx.factionSplitOri = gen.factionSplitOri;
    }
    const riverDescs: RiverDesc[] = generateRivers(riverCtx, mapGen.map.rivers);
    gen.riverDescs = riverDescs;
    gen.terrain = createTerrain({
        width: gen.width,
        height: gen.height,
        shoreInset: gen.shoreInset,
        grassInset: gen.grassInset,
        seed,
        rivers: riverDescs.map((r) => ({ width: r.width, looped: r.looped, points: r.points })),
    });

    let shoreArea = polygonArea(gen.terrain.shore);
    let grassArea = polygonArea(gen.terrain.grass);
    const riverAreas = gen.terrain.rivers.map((r) => {
        const shore = polygonArea(r.shorePoly);
        shoreArea -= shore;
        grassArea -= shore;
        return { shore, water: polygonArea(r.waterPoly) };
    });

    let factionBridges: string[] = [];
    if (gen.factionMode && gen.normalRivers.length) {
        const placed = generateFactionBridges(gen);
        if (!placed) return null;
        factionBridges = placed;
    }

    const runner = new SpawnRunner(gen);
    const stage1: MapSpawn[] = [];
    const stage2: MapSpawn[] = [];
    // Instances placed by location rules, as lake centres or as faction bridges count towards a type's fixed
    // spawn count: the ported v0.8.82 fixed spawns already list objects that survev places by those rules
    // (club_complex_01 on main, teapavilion_01w on woods, river_town_01 on faction).
    const preplaced = new Map<string, number>();
    const addPreplaced = (type: string) => preplaced.set(type, (preplaced.get(type) ?? 0) + 1);
    for (const type of factionBridges) addPreplaced(type);

    for (const rule of mapGen.customSpawnRules.locationSpawns) {
        stage1.push({ type: rule.type, count: 1, source: "location", location: rule });
        addPreplaced(rule.type);
    }
    for (const group of mapGen.randomSpawns) {
        const pool = [...group.spawns];
        for (let i = 0; i < group.choose && pool.length; i++) {
            const [type] = pool.splice(rng.int(0, pool.length - 1), 1);
            stage2.push({ type, count: 1, source: "random" });
        }
    }
    gen.riverDescs.forEach((desc) => {
        if (desc.centerObj) addPreplaced(desc.centerObj);
    });
    const fixed = mapGen.fixedSpawns[0] ?? {};
    for (const type of Object.keys(fixed)) {
        const spec = fixed[type];
        let count =
            typeof spec === "number" ? spec : "odds" in spec ? (rng.next() < spec.odds ? 1 : 0) : spec[gen.scale];
        count = Math.max(0, count - (preplaced.get(type) ?? 0));
        if (!hasMapObjectDef(type)) {
            gen.warnOnce(`unknown fixed spawn type ${type}`);
            continue;
        }
        const spawn: MapSpawn = { type, count, source: "fixed" };
        if (getMapObjectDef(type).terrain?.bridge || gen.isImportant(type)) stage1.push(spawn);
        else stage2.push(spawn);
    }

    // important spawns first (by their position in importantSpawns, as survev sorts), then larger objects
    const important = mapGen.importantSpawns;
    const sortFn = (a: MapSpawn, b: MapSpawn) => {
        const pa = important.indexOf(a.type) + 1;
        const pb = important.indexOf(b.type) + 1;
        if (pa !== pb) return pb - pa;
        const sa = hasMapObjectDef(a.type) ? spawnSize(a.type) : 0;
        const sb = hasMapObjectDef(b.type) ? spawnSize(b.type) : 0;
        return sb - sa;
    };
    const genSpawn = (spawn: MapSpawn, firstStage: boolean) => {
        if (!hasMapObjectDef(spawn.type)) {
            gen.warnOnce(`unknown spawn type ${spawn.type}`);
            return;
        }
        const loc = spawn.location;
        if (!loc) {
            runner.track(spawn.type, spawn.source, spawn.count, () =>
                genFromMapDef(gen, spawn.type, spawn.count, places),
            );
            return;
        }
        const spawned = runner.track(spawn.type, spawn.source, 1, () => {
            genLocationSpawn(gen, spawn.type, loc.pos, loc.rad);
        });
        if (firstStage && loc.retryOnFailure && spawned === 0) {
            stage2.push({ type: spawn.type, count: 1, source: "location" });
        }
    };

    // lake centre objects are forced onto a position, so they go first
    gen.terrain.rivers.forEach((river, i) => {
        const type = gen.riverDescs[i].centerObj;
        if (!river.looped || !type) return;
        runner.track(type, "lake", 1, () => gen.genAuto(type, river.center, 0, 0));
    });

    stage1.sort(sortFn);
    for (const spawn of stage1) genSpawn(spawn, true);
    stage2.sort(sortFn);

    if (gen.rivers.length) {
        const bridgeStat = runner.stats.length;
        let bridgeAttempts = 0;
        runner.track("bridges", "bridge", 0, () => {
            bridgeAttempts = generateBridges(gen);
        });
        runner.stats[bridgeStat].requested = bridgeAttempts;
        if (mapGen.map.rivers.spawnCabins) {
            let cabins = 1;
            for (const river of gen.normalRivers) {
                if (river.waterWidth >= 16) cabins += rng.int(1, 2);
                else if (river.waterWidth >= 6) cabins += rng.int(0, 1);
            }
            cabins = math.clamp(cabins, 1, 3);
            runner.track("cabin_01", "cabin", cabins, () => {
                for (let i = 0; i < cabins; i++) genRiverCabin(gen);
            });
        }
        gen.rivers.forEach((river: River, i) => {
            if (gen.riverDescs[i].noRiverObjs) return;
            const waterK = riverAreas[i].water / 1000;
            for (const type of Object.keys(RIVER_OBJECTS)) {
                const amount = Math.min(waterK * RIVER_OBJECTS[type], 30);
                const n = Math.ceil(amount);
                runner.track(type, "riverObject", n, () => {
                    for (let k = 0; k < amount; k++) genOnRiver(gen, type, river);
                });
            }
        });
    }

    for (const spawn of stage2) genSpawn(spawn, false);

    const density = mapGen.densitySpawns[0] ?? {};
    for (const type of Object.keys(density)) {
        if (!hasMapObjectDef(type)) {
            gen.warnOnce(`unknown density spawn type ${type}`);
            continue;
        }
        const terrain = getMapObjectDef(type).terrain;
        if (!terrain?.grass && terrain?.riverShore) {
            // river shore only objects: density per river bank area
            gen.rivers.forEach((river, i) => {
                const count = ((riverAreas[i].shore - riverAreas[i].water) / 15000) * density[type];
                runner.track(type, "density", Math.ceil(count), () => {
                    for (let k = 0; k < count; k++) genOnRiverShore(gen, type, river);
                });
            });
            continue;
        }
        const count = Math.round((density[type] * shoreArea) / 250000);
        runner.track(type, "density", count, () => genFromMapDef(gen, type, count, places));
    }

    return { gen, riverDescs, runner, shoreArea, grassArea, riverAreas };
}

/**
 * Buildings and structures of the fixed, random and location spawns that did not fit (a failed location spawn counts
 * when its retry failed too), river-dependent ones excepted (bridge shacks, the crossing bunker). Rebirth rule (M7b):
 * the map is then regenerated, so the landmarks of each mode (docks, bunkers, towns, complexes) always exist; KB
 * desert.md "the map is regenerated until they fit" for its important spawns. survev only logs the failure.
 */
function missingLandmarks(stats: readonly SpawnStat[]): string[] {
    const want = new Map<string, number>();
    const got = new Map<string, number>();
    for (const s of stats) {
        if (s.source !== "fixed" && s.source !== "random" && s.source !== "location") continue;
        if (!hasMapObjectDef(s.type)) continue;
        const def = getMapObjectDef(s.type);
        if ((def.type !== "building" && def.type !== "structure") || def.terrain?.bridge || def.terrain?.nearbyRiver) {
            continue;
        }
        // a location spawn and its retry request the same object once
        const requested = s.source === "location" ? 1 : s.requested;
        want.set(
            s.type,
            s.source === "location" ? Math.max(want.get(s.type) ?? 0, requested) : (want.get(s.type) ?? 0) + requested,
        );
        got.set(s.type, (got.get(s.type) ?? 0) + s.spawned);
    }
    return [...want].filter(([type, n]) => (got.get(type) ?? 0) < n).map(([type]) => type);
}

/**
 * Generates the full static map for a MapDefs key. `teamMode` selects the map scale (squads get the large map).
 * Deterministic: the same arguments always produce the same MapData. `def` replaces the key's def (tests: the map
 * before the rebirth map scale, defs unscaledMapDef).
 */
export function generateMap(
    mapName: string,
    seed: number,
    teamMode: 1 | 2 | 4 = 1,
    def: MapDef = getMapDef(mapName),
): GenerateMapResult {
    let result: ReturnType<typeof runGeneration> = null;
    const extraWarnings: string[] = [];
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && !result; attempt++) {
        result = runGeneration(mapName, def, seed, teamMode, attempt);
        if (!result) {
            extraWarnings.push(`faction bridges did not fit (attempt ${attempt + 1}); regenerating rivers`);
            continue;
        }
        const missing = missingLandmarks(result.runner.stats);
        if (missing.length > 0 && attempt < MAX_GENERATION_ATTEMPTS - 1) {
            extraWarnings.push(`${missing.join(", ")} did not fit (attempt ${attempt + 1}); regenerating`);
            result = null;
        }
    }
    if (!result) {
        throw new Error(`generateMap(${mapName}, ${seed}): faction bridges failed ${MAX_GENERATION_ATTEMPTS} times`);
    }
    const { gen, riverDescs, runner, shoreArea, grassArea, riverAreas } = result;
    const mapData: MapData = {
        mapName,
        seed,
        width: gen.width,
        height: gen.height,
        shoreInset: gen.shoreInset,
        grassInset: gen.grassInset,
        rivers: riverDescs.map((r) => ({ width: r.width, looped: r.looped, points: r.points.map((p) => v2.copy(p)) })),
        // place positions are fractions of the map size, y pointing down (as the original MapMsg)
        places: def.mapGen.places.map((p) => ({ name: p.name, pos: v2.copy(p.pos) })),
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
    return {
        mapData,
        terrain: gen.terrain,
        objects: gen.objects,
        lootSpawns: gen.lootSpawns,
        warnings: [...extraWarnings, ...gen.warnings],
        skipped: [...gen.skipped],
        spawnStats: runner.stats,
        scale: gen.scale,
        shoreArea,
        grassArea,
        riverAreas,
        factionSplitOri: gen.factionSplitOri,
    };
}
