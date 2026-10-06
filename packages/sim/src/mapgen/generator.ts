// Map generation state: placement grid, spawn checks and recursive object creation.
// Behaviour follows survev server/src/game/map.ts (canSpawn, genAuto, genBuilding, genStructure, addBounds).
import { type Bounds, type Collider, Grid, math, type Rng, type Vec2, v2 } from "@rebirth/core";
import {
    type BuildingDef,
    GameConfig,
    getMapObjectDef,
    hasMapObjectDef,
    type MapDef,
    type MapObjectDef,
    type MapObjectType,
} from "@rebirth/defs";
import { pointInBounds } from "../geom/polygon.ts";
import { boundsCorners, overlaps, toBounds, transformOri } from "../geom/transform.ts";
import type { GroundPatchData, MapObjectSpawn } from "../view.ts";
import {
    BUILDING_BOUND_SCALE,
    BUILDING_OBSTACLE_BOUND_SCALE,
    bridgeOverlapBounds,
    buildingSpawnBounds,
    getBoundingCollider,
    type LayeredCollider,
} from "./bounds.ts";
import { weightedKey } from "./random.ts";
import { clampToMap, type RiverDesc, SPAWN_ATTEMPTS } from "./rivers.ts";
import type { River, Terrain } from "./terrain.ts";
import { isAabbOnRiverShore, isAabbOnRiverWater, isTerrainWater, terrainSurfaceAt } from "./terrainQuery.ts";

/** Important spawns get ten times the attempts (survev map.ts trySpawn). */
const IMPORTANT_SPAWN_ATTEMPTS = 5000;

export type SpawnedKind = Exclude<MapObjectType, "loot_spawner">;

/** A generated map object; `parentId` is 0 for top-level objects. */
export interface GeneratedObject extends MapObjectSpawn {
    kind: SpawnedKind;
    parentId: number;
    /** puzzle piece label of a building child (BuildingChildDef.puzzlePiece; absent for other objects) */
    puzzlePiece?: string;
}

/** A loot spawner placed on the map (its loot is rolled by the loot system, not at generation). */
export interface LootSpawn {
    type: string;
    pos: Vec2;
    layer: number;
    parentId: number;
}

interface PlacementCollider {
    id: number;
    collision: Collider;
    layer: number;
    /** "obstacle" bounds block every object, "building" bounds only block buildings and structures */
    kind: "obstacle" | "building";
}

type BuildingOrStructureDef = Extract<MapObjectDef, { type: "building" | "structure" }>;

export class MapGenerator {
    readonly mapName: string;
    readonly def: MapDef;
    readonly seed: number;
    readonly scale: "small" | "large";
    readonly width: number;
    readonly height: number;
    readonly shoreInset: number;
    readonly grassInset: number;
    readonly center: Vec2;
    readonly grassBounds: Bounds;
    readonly beachBounds: Bounds;
    readonly factionMode: boolean;
    factionSplitOri: 0 | 1 = 0;
    readonly rng: Rng;
    readonly warnings: string[] = [];
    /** spawns a placement rule left out (GenerateMapResult.skipped) */
    readonly skipped: string[] = [];
    readonly objects: GeneratedObject[] = [];
    readonly lootSpawns: LootSpawn[] = [];
    readonly groundPatches: GroundPatchData[] = [];
    /** bridges placed so far (structures and buildings with bridge terrain) */
    readonly bridges: Array<{ type: string; pos: Vec2; ori: number }> = [];
    terrain!: Terrain;
    riverDescs: RiverDesc[] = [];
    readonly masks: Collider[] = [];
    private readonly grid: Grid<PlacementCollider>;
    private readonly queryScratch: PlacementCollider[] = [];
    private nextColliderId = 1;
    private nextId = 1;
    private readonly replacements: Readonly<Record<string, string>>;
    private readonly important: ReadonlySet<string>;
    private readonly warned = new Set<string>();

    constructor(mapName: string, def: MapDef, seed: number, teamMode: 1 | 2 | 4, rng: Rng) {
        this.mapName = mapName;
        this.def = def;
        this.seed = seed;
        this.rng = rng;
        this.scale = teamMode > 2 ? "large" : "small";
        const cfg = def.mapGen.map;
        this.width = cfg.baseWidth * cfg.scale[this.scale] + cfg.extension;
        this.height = cfg.baseHeight * cfg.scale[this.scale] + cfg.extension;
        this.shoreInset = cfg.shoreInset;
        this.grassInset = cfg.grassInset;
        this.center = { x: this.width / 2, y: this.height / 2 };
        const inset = this.shoreInset + this.grassInset;
        this.grassBounds = { min: { x: inset, y: inset }, max: { x: this.width - inset, y: this.height - inset } };
        this.beachBounds = {
            min: { x: this.shoreInset, y: this.shoreInset },
            max: { x: this.width - this.shoreInset, y: this.height - this.shoreInset },
        };
        this.factionMode = !!def.gameMode.factionMode;
        this.grid = new Grid<PlacementCollider>(this.width, this.height, 32);
        this.replacements = def.mapGen.spawnReplacements[0] ?? {};
        this.important = new Set(def.mapGen.importantSpawns);
    }

    get rivers(): River[] {
        return this.terrain.rivers;
    }

    get normalRivers(): River[] {
        return this.terrain.rivers.filter((r) => !r.looped);
    }

    warnOnce(msg: string): void {
        if (this.warned.has(msg)) return;
        this.warned.add(msg);
        this.warnings.push(msg);
    }

    isImportant(type: string): boolean {
        return this.important.has(type);
    }

    /** Retries `attempt` (500 times, 5000 for important spawns); records a warning on failure. */
    trySpawn(type: string, attempt: () => boolean, maxAttempts?: number, warnOnFailure = true): boolean {
        const attempts = maxAttempts ?? (this.important.has(type) ? IMPORTANT_SPAWN_ATTEMPTS : SPAWN_ATTEMPTS);
        for (let i = 0; i < attempts; i++) {
            if (attempt()) return true;
        }
        if (warnOnFailure) this.warnings.push(`failed to spawn ${type}`);
        return false;
    }

    addCollider(collision: Collider, layer: number, kind: "obstacle" | "building"): void {
        const entry: PlacementCollider = { id: this.nextColliderId++, collision, layer, kind };
        this.grid.insert(entry, toBounds(collision));
    }

    private query(collision: Collider): PlacementCollider[] {
        return this.grid.query(toBounds(collision), this.queryScratch);
    }

    getOriAndScale(type: string): { ori: number; scale: number } {
        const def = getMapObjectDef(type);
        if (def.type === "building" || def.type === "structure") {
            const oris = def.type === "building" ? def.oris : undefined;
            if (oris?.length) return { ori: this.rng.pick(oris), scale: 1 };
            return { ori: def.ori ?? this.rng.int(0, 3), scale: 1 };
        }
        if (def.type === "obstacle") {
            return { ori: 0, scale: this.rng.range(def.scale.createMin, def.scale.createMax) };
        }
        return { ori: 0, scale: 1 };
    }

    /** Terrain water at a point (map generation ignores building floors; bridges cannot overlap anyway). */
    isOnWater(pos: Vec2): boolean {
        return isTerrainWater(this.terrain, pos);
    }

    /** A box leaving the beach bounds or touching river water counts as on water. */
    isAabbOnWater(box: Bounds): boolean {
        const b = this.beachBounds;
        const inside = box.min.x >= b.min.x && box.min.y >= b.min.y && box.max.x <= b.max.x && box.max.y <= b.max.y;
        return !inside || isAabbOnRiverWater(this.terrain, box);
    }

    /** Whether a map object may spawn at the given transform (survev map.ts canSpawn). */
    canSpawn(type: string, pos: Vec2, ori: number, scale = 1): boolean {
        const def = getMapObjectDef(type);
        const terrain = def.terrain;

        if (!terrain?.river && !terrain?.waterEdge) {
            if (!pointInBounds(pos, terrain?.beach ? this.beachBounds : this.grassBounds)) return false;
        }

        let bounds: LayeredCollider[];
        if (def.type === "building" || def.type === "structure") {
            bounds = buildingSpawnBounds(type, 0, pos, ori);
            for (const b of bounds) {
                for (const other of this.query(b.collision)) {
                    // underground parts still collide with ground parts, not the other way round
                    if (b.layer === 0 && other.layer !== 0) continue;
                    if (overlaps(b.collision, other.collision)) return false;
                }
            }
        } else {
            const col = transformOri(getBoundingCollider(type), pos, ori, scale);
            bounds = [{ layer: 0, collision: col }];
            for (const other of this.query(col)) {
                if (other.layer !== 0 || other.kind !== "obstacle") continue;
                if (overlaps(col, other.collision)) return false;
            }
        }

        if ((def.type === "building" || def.type === "structure") && def.terrain.bridge) {
            if (!this.bridgeFits(type, def, pos, ori)) return false;
        }

        if (!terrain?.river && !terrain?.bridge) {
            for (const b of bounds) {
                if (b.layer !== 0) continue;
                const box = toBounds(b.collision);
                const blocked = terrain?.riverShore
                    ? isAabbOnRiverWater(this.terrain, box)
                    : isAabbOnRiverShore(this.terrain, box);
                if (blocked) return false;
            }
        }

        if (terrain?.river) {
            const inset = this.shoreInset / 2;
            const riverBound = { min: { x: inset, y: inset }, max: { x: this.width - inset, y: this.height - inset } };
            if (!pointInBounds(pos, riverBound)) return false;
            if (def.type === "obstacle" && !terrain.riverShore) {
                const box = toBounds(transformOri(def.collision, pos, ori, scale));
                for (const c of boundsCorners(box)) {
                    if (!this.isOnWater(c)) return false;
                }
            }
        }

        if (terrain?.beach && !terrain.grass) {
            if (terrainSurfaceAt(this.terrain, pos) === "grass") return false;
        }
        return true;
    }

    private bridgeFits(type: string, def: BuildingOrStructureDef, pos: Vec2, ori: number): boolean {
        const mine = bridgeOverlapBounds(type, pos, ori);
        for (const other of this.bridges) {
            const theirs = bridgeOverlapBounds(other.type, other.pos, other.ori);
            if (
                mine.min.x < theirs.max.x &&
                theirs.min.x < mine.max.x &&
                mine.min.y < theirs.max.y &&
                theirs.min.y < mine.max.y
            ) {
                return false;
            }
        }
        // land bounds must be on land, water bounds (corners and centre) in water
        for (const col of def.bridgeLandBounds ?? []) {
            if (this.isAabbOnWater(toBounds(transformOri(col, pos, ori, 1)))) return false;
        }
        for (const col of def.bridgeWaterBounds ?? []) {
            const box = toBounds(transformOri(col, pos, ori, 1));
            const pts = boundsCorners(box);
            pts.push(v2.mul(v2.add(box.min, box.max), 0.5));
            for (const p of pts) {
                if (!this.isOnWater(p)) return false;
            }
        }
        return true;
    }

    private addObject(
        kind: SpawnedKind,
        type: string,
        pos: Vec2,
        ori: number,
        scale: number,
        layer: number,
        parentId: number,
    ): GeneratedObject {
        const obj: GeneratedObject = { id: this.nextId++, kind, type, pos: v2.copy(pos), ori, scale, layer, parentId };
        this.objects.push(obj);
        return obj;
    }

    /**
     * Creates any map object (applying the map's spawn replacements) and, for buildings and structures, all of
     * their children. Returns the new object, or null for loot spawners and unknown types.
     */
    genAuto(
        type: string,
        pos: Vec2,
        layer = 0,
        ori?: number,
        scale?: number,
        parentId = 0,
        ignoreReplacement = false,
    ): GeneratedObject | null {
        const replacement = this.replacements[type];
        if (replacement && !ignoreReplacement) type = replacement;
        if (!hasMapObjectDef(type)) {
            this.warnOnce(`unknown map object type ${type}`);
            return null;
        }
        const def = getMapObjectDef(type);
        const p = clampToMap(pos, this.width, this.height);
        switch (def.type) {
            case "obstacle": {
                const s = scale ?? this.rng.range(def.scale.createMin, def.scale.createMax);
                const obj = this.addObject("obstacle", type, p, ori ?? 0, s, layer, parentId);
                this.addBounds(obj, def, parentId !== 0);
                return obj;
            }
            case "building":
                return this.genBuilding(type, p, layer, ori, parentId);
            case "structure":
                return this.genStructure(type, p, layer, ori, parentId);
            case "decal":
                return this.addObject("decal", type, p, ori ?? 0, scale ?? 1, layer, parentId);
            case "loot_spawner":
                this.lootSpawns.push({ type, pos: p, layer, parentId });
                for (const _entry of def.loot) {
                    this.addCollider({ type: 0, pos: v2.copy(p), rad: 3 }, layer, "obstacle");
                }
                return null;
        }
    }

    genBuilding(type: string, pos: Vec2, layer: number, ori: number | undefined, parentId: number): GeneratedObject {
        const def = getMapObjectDef(type) as BuildingDef;
        const o = ori ?? this.getOriAndScale(type).ori;
        const building = this.addObject("building", type, pos, o, 1, layer, parentId);

        for (const patch of def.mapGroundPatches ?? []) {
            const b = toBounds(transformOri(patch.bound, pos, o, 1));
            this.groundPatches.push({
                min: b.min,
                max: b.max,
                color: patch.color,
                roughness: patch.roughness ?? 0,
                offsetDist: patch.offsetDist ?? 0,
                order: patch.order ?? 0,
                useAsMapShape: patch.useAsMapShape ?? true,
            });
        }

        for (const child of def.mapObjects) {
            const partType = typeof child.type === "string" ? child.type : weightedKey(this.rng, child.type);
            if (!partType) continue;
            const partOri = child.inheritOri === false ? child.ori : (child.ori + o) % 4;
            const partPos = math.addAdjust(pos, child.pos, o);
            const part = this.genAuto(
                partType,
                partPos,
                layer,
                partOri,
                child.scale,
                building.id,
                child.ignoreMapSpawnReplacement,
            );
            if (part && child.puzzlePiece) part.puzzlePiece = child.puzzlePiece;
        }

        this.addBounds(building, def, parentId !== 0);
        return building;
    }

    genStructure(type: string, pos: Vec2, layer: number, ori: number | undefined, parentId: number): GeneratedObject {
        const def = getMapObjectDef(type);
        if (def.type !== "structure") throw new Error(`${type} is not a structure`);
        const o = ori ?? def.ori ?? this.rng.int(0, 3);
        const structure = this.addObject("structure", type, pos, o, 1, layer, parentId);
        def.layers.forEach((layerDef, i) => {
            const layerPos = math.addAdjust(pos, layerDef.pos, o);
            this.genBuilding(layerDef.type, layerPos, i, (layerDef.ori + o) % 4, structure.id);
        });
        this.addBounds(structure, def, parentId !== 0);
        return structure;
    }

    /**
     * Reserves the area of a new object in the placement grid. Child objects reserve nothing as obstacles
     * (their parent's bounds cover them), but child buildings still reserve building bounds (survev addBounds).
     */
    private addBounds(obj: GeneratedObject, def: MapObjectDef, hasParent: boolean): void {
        if (def.type === "decal" || def.type === "loot_spawner") return;
        const isBuilding = def.type === "building" || def.type === "structure";
        if (!hasParent) {
            if (def.mapObstacleBounds) {
                for (const col of def.mapObstacleBounds) {
                    this.addCollider(transformOri(col, obj.pos, obj.ori, obj.scale), obj.layer, "obstacle");
                }
            } else {
                const s = obj.scale * (isBuilding ? BUILDING_OBSTACLE_BOUND_SCALE : 1);
                this.addCollider(
                    transformOri(getBoundingCollider(obj.type), obj.pos, obj.ori, s),
                    obj.layer,
                    "obstacle",
                );
            }
        }
        if (!isBuilding) return;
        const s = obj.scale * BUILDING_BOUND_SCALE;
        this.addCollider(transformOri(getBoundingCollider(obj.type), obj.pos, obj.ori, s), obj.layer, "building");
        for (const col of def.bridgeLandBounds ?? []) {
            this.addCollider(transformOri(col, obj.pos, obj.ori, obj.scale), obj.layer, "building");
        }
    }

    /** Beach strip width used by beach placement (survev map.ts genOnBeach). */
    get beachSize(): number {
        return this.grassInset - GameConfig.map.grassVariation * 2;
    }
}
