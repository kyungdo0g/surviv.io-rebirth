// Coarse walkability grid built from MapData (what every client receives on join): blocking obstacles and building
// walls inflated by the player's clearance, closed-but-usable doors as passable "door" cells, terrain cost (rivers
// and lakes are slow, the sea is avoided), and structure stairs blocked so bots stay on the ground floor (layer 0;
// nav/underground.ts plans the way down for bots with the basements feature).
// The grid is shared by every bot of a map (WeakMap cache) and updated from what bots observe: obstacles seen dead
// are cleared, collidable obstacles that MapData did not list (air drop crates) are added, doors update their panel.
import { getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import { createTerrain, type MapData } from "@rebirth/sim";
import { obstacleCollider, transformCollider } from "../geom.ts";
import { CellGrid, NavTerrain, walkThroughDoor } from "./cellGrid.ts";
import { type RasterGrid, rasterBounds, rasterPolygon } from "./raster.ts";

export { type NavDoor, NavTerrain } from "./cellGrid.ts";

/**
 * Cells whose centre is closer than this to a collider are blocked: the player radius (1), so gaps narrower than a
 * player (outhouse doors, porch columns) never look passable; 4-unit doorways keep a band of 2 free cells.
 */
export const DEFAULT_CLEARANCE = 1;
export const DEFAULT_CELL_SIZE = 1;
/** A* nodes all bots of a map may expand in one simulation tick (~6 ms worst case); later plans wait a snapshot. */
export const PLAN_BUDGET_PER_TICK = 15000;
/** Cells this close to the map border are blocked. */
const EDGE_MARGIN = 1.5;

export interface NavOptions {
    cellSize?: number;
    clearance?: number;
}

/** Layer test of the simulation for a player on the ground floor (layers 0 and 2 collide with it). */
export function onGroundLayer(layer: number): boolean {
    return (layer & 1) === 0;
}

const cache = new WeakMap<MapData, NavGrid>();

export class NavGrid extends CellGrid implements RasterGrid {
    readonly width: number;
    readonly height: number;
    private budgetTime = Number.NaN;
    private budgetLeft = 0;

    /** The shared grid of a map (built on first use). */
    static forMap(map: MapData, opts: NavOptions = {}): NavGrid {
        let grid = cache.get(map);
        if (!grid) {
            grid = new NavGrid(map, opts);
            cache.set(map, grid);
        }
        return grid;
    }

    constructor(map: MapData, opts: NavOptions = {}) {
        const cellSize = opts.cellSize ?? DEFAULT_CELL_SIZE;
        super(
            0,
            0,
            Math.ceil(map.width / cellSize),
            Math.ceil(map.height / cellSize),
            cellSize,
            opts.clearance ?? DEFAULT_CLEARANCE,
            NavTerrain.Sea,
        );
        this.width = map.width;
        this.height = map.height;
        this.buildTerrain(map);
        this.buildObjects(map);
        this.blockEdges();
        this.labelComponents();
    }

    protected collidesWith(layer: number): boolean {
        return onGroundLayer(layer);
    }

    /** A* nodes left for simulation time `now` (shared by every bot planning on this grid in the same tick). */
    planBudget(now: number): number {
        if (now !== this.budgetTime) {
            this.budgetTime = now;
            this.budgetLeft = PLAN_BUDGET_PER_TICK;
        }
        return this.budgetLeft;
    }

    spendPlanBudget(nodes: number): void {
        this.budgetLeft -= nodes;
    }

    private buildTerrain(map: MapData): void {
        const terrain = createTerrain(map);
        rasterPolygon(this, terrain.shore, (i) => {
            this.terrain[i] = NavTerrain.Ground;
        });
        for (const river of terrain.rivers) {
            rasterPolygon(this, river.waterPoly, (i) => {
                this.terrain[i] = NavTerrain.Water;
            });
        }
        // building floors (bridges, docks, pools) override the terrain underneath
        for (const obj of map.objects) {
            if (!onGroundLayer(obj.layer) || !hasMapObjectDef(obj.type)) continue;
            const def = getMapObjectDef(obj.type);
            if (def.type !== "building") continue;
            for (const surface of def.floor.surfaces) {
                const cls = surface.type === "water" ? NavTerrain.Water : NavTerrain.Ground;
                for (const box of surface.collision) {
                    const col = transformCollider(box, obj.pos, obj.ori, obj.scale);
                    if (col.type !== 1) continue;
                    rasterBounds(this, col, (i) => {
                        this.terrain[i] = cls;
                    });
                }
            }
        }
    }

    private buildObjects(map: MapData): void {
        for (const obj of map.objects) {
            if (!hasMapObjectDef(obj.type)) continue;
            const def = getMapObjectDef(obj.type);
            if (def.type === "structure") {
                // stairs lead to the underground floor: v1 bots stay on the ground
                def.stairs.forEach((stair, i) => {
                    if (stair.lootOnly || !onGroundLayer(obj.layer)) return;
                    const col = transformCollider(stair.collision, obj.pos, obj.ori, obj.scale);
                    this.stamp(-(obj.id * 8 + i + 1), col);
                });
                continue;
            }
            if (def.type !== "obstacle") continue;
            this.known.add(obj.id);
            if (!def.collidable || !onGroundLayer(obj.layer)) continue;
            const col = obstacleCollider(def, obj.pos, obj.ori, obj.scale);
            if (walkThroughDoor(def)) {
                this.addDoor(obj.id, obj.type, def, col, obj.ori);
                continue;
            }
            this.stamp(obj.id, col);
        }
    }

    private blockEdges(): void {
        const m = Math.ceil(EDGE_MARGIN / this.cellSize);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (x < m || y < m || x >= this.w - m || y >= this.h - m) this.blockForever(y * this.w + x);
            }
        }
    }
}
