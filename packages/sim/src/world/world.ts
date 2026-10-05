// The live world: object registry, broadphase grid and ground queries shared by every system.
import { type Bounds, collider, Grid, type Vec2 } from "@rebirth/core";
import { pointInPolygon } from "../geom/polygon.ts";
import type { GenerateMapResult } from "../mapgen/generate.ts";
import type { Terrain } from "../mapgen/terrain.ts";
import { riverWaterAt } from "../mapgen/terrainQuery.ts";
import type { MapData } from "../view.ts";
import { Building, createMapEntity, type MapEntity, Obstacle, Structure } from "./entities.ts";
import type { Player } from "./player.ts";

export type Entity = MapEntity | Player;

/** Broadphase cell size (survev server grid.ts). */
const GRID_CELL_SIZE = 16;

/** Layers 0 ground / 1 underground / 2-3 stairs; stair layers see both floors (survev util.sameLayer). */
export function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

export class World {
    readonly mapData: MapData;
    readonly terrain: Terrain;
    readonly width: number;
    readonly height: number;
    readonly objects = new Map<number, Entity>();
    readonly grid: Grid<Entity>;
    readonly buildings: Building[] = [];
    private nextId: number;
    private readonly scratch: Entity[] = [];

    constructor(gen: GenerateMapResult) {
        this.mapData = gen.mapData;
        this.terrain = gen.terrain;
        this.width = gen.mapData.width;
        this.height = gen.mapData.height;
        this.grid = new Grid<Entity>(this.width, this.height, GRID_CELL_SIZE);
        let maxId = 0;
        for (const spawn of gen.objects) {
            const entity = createMapEntity(spawn);
            this.add(entity);
            if (entity instanceof Building) this.buildings.push(entity);
            maxId = Math.max(maxId, spawn.id);
        }
        // link children to their parents
        for (const spawn of gen.objects) {
            if (!spawn.parentId) continue;
            const parent = this.objects.get(spawn.parentId);
            if (parent instanceof Building) parent.childIds.push(spawn.id);
            else if (parent instanceof Structure) parent.layerObjIds.push(spawn.id);
        }
        this.nextId = maxId + 1;
    }

    allocId(): number {
        return this.nextId++;
    }

    add(entity: Entity): void {
        if (this.objects.has(entity.id)) throw new Error(`World.add: duplicate id ${entity.id}`);
        this.objects.set(entity.id, entity);
        this.grid.insert(entity, entity.bounds);
        if (entity instanceof Obstacle) {
            entity.onBoundsChanged = (o) => this.grid.update(o, o.bounds);
        }
    }

    remove(entity: Entity): void {
        this.objects.delete(entity.id);
        this.grid.remove(entity);
    }

    /** Re-registers an entity's current bounds in the broadphase (after it moved). */
    updateBounds(entity: Entity): void {
        this.grid.update(entity, entity.bounds);
    }

    get(id: number): Entity | undefined {
        return this.objects.get(id);
    }

    /** Entities whose broadphase bounds touch `bounds`; `out` is reused when given. */
    query(bounds: Bounds, out: Entity[] = []): Entity[] {
        return this.grid.query(bounds, out);
    }

    /**
     * Water test including decal and building floor surfaces (bridges are not water), then rivers and the sea
     * (survev map.ts isOnWater).
     */
    isOnWater(pos: Vec2, layer: number): boolean {
        const objs = this.grid.queryPoint(pos, this.scratch);
        for (const obj of objs) {
            if (obj.kind !== "decal" || !obj.surface) continue;
            if (sameLayer(obj.layer, layer) && collider.contains(obj.collider, pos)) return obj.surface === "water";
        }
        let surface: string | null = null;
        let zIdx = 0;
        const onStairs = (layer & 2) !== 0;
        for (const obj of objs) {
            if (obj.kind !== "building" || obj.zIdx < zIdx) continue;
            // on stairs, ground floor surfaces take priority
            if ((obj.layer !== layer && !onStairs) || (obj.layer === 1 && onStairs)) continue;
            for (const s of obj.surfaces) {
                if (s.colliders.some((c) => collider.contains(c, pos))) {
                    zIdx = obj.zIdx;
                    surface = s.type;
                    break;
                }
            }
        }
        if (surface !== null) return surface === "water";
        if (layer !== 1 && riverWaterAt(this.terrain, pos)) return true;
        return !pointInPolygon(pos, this.terrain.shore);
    }

    clampToMap(pos: Vec2, rad: number): Vec2 {
        return {
            x: Math.min(Math.max(pos.x, rad), this.width - rad),
            y: Math.min(Math.max(pos.y, rad), this.height - rad),
        };
    }
}
