// Coarse walkability grid built from MapData (what every client receives on join): blocking obstacles and building
// walls inflated by the player's clearance, closed-but-usable doors as passable "door" cells, terrain cost (rivers
// and lakes are slow, the sea is avoided), and structure stairs blocked so bots stay on the ground floor (layer 0).
// The grid is shared by every bot of a map (WeakMap cache) and updated from what bots observe: obstacles seen dead
// are cleared, collidable obstacles that MapData did not list (air drop crates) are added.
import { type Collider, type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import { createTerrain, type MapData, type ObstacleView } from "@rebirth/sim";
import { obstacleCollider, obstacleDef, transformCollider } from "../geom.ts";
import { type RasterGrid, rasterBounds, rasterPolygon } from "./raster.ts";

/** Terrain cost classes per cell. */
export const NavTerrain = { Ground: 0, Water: 1, Sea: 2 } as const;
/** Movement cost multiplier per terrain class (water: 12 -> 9 u/s plus a margin; the sea is a last resort). */
const TERRAIN_COST = [1, 1.6, 8];
/** Passing a closed door costs a little more (it has to be opened). */
const DOOR_COST = 1.5;
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
function onGroundLayer(layer: number): boolean {
    return (layer & 1) === 0;
}

export interface NavDoor {
    id: number;
    type: string;
    collider: Collider;
}

const cache = new WeakMap<MapData, NavGrid>();

/** Stamp key of an open door's panel (obstacle ids are positive and below 2^24). */
function doorKey(id: number): number {
    return -(1 << 26) - id;
}

function sameCollider(a: Collider, b: Collider): boolean {
    if (a.type === 0 && b.type === 0) return a.pos.x === b.pos.x && a.pos.y === b.pos.y && a.rad === b.rad;
    if (a.type === 1 && b.type === 1) {
        return a.min.x === b.min.x && a.min.y === b.min.y && a.max.x === b.max.x && a.max.y === b.max.y;
    }
    return false;
}

export class NavGrid implements RasterGrid {
    readonly w: number;
    readonly h: number;
    readonly cellSize: number;
    readonly clearance: number;
    readonly width: number;
    readonly height: number;
    /** number of blocking stamps covering each cell (saturating) */
    readonly blocked: Uint8Array;
    /** NavTerrain class of each cell */
    readonly terrain: Uint8Array;
    /** 1 where a usable door's closed panel lies */
    readonly doorMask: Uint8Array;
    /** usable doors on the ground floor, by obstacle id */
    readonly doors = new Map<number, NavDoor>();
    /** stamped colliders by key (obstacle id; negative keys for stairs) */
    private readonly stamps = new Map<number, Collider>();
    /** obstacle ids already considered (stamped or deliberately left out) */
    private readonly known = new Set<number>();
    /** bumped on every change, so path caches can tell they are stale */
    version = 0;
    /**
     * Connected component of each walkable cell (0 for blocked cells), with the same moves as A*. Relabelled lazily
     * after enough changes, so it may be slightly stale: a hint that saves hopeless searches, never a hard rule.
     */
    private comp: Int32Array;
    private changesSinceLabel = 0;
    private queriesSinceLabel = 0;
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
        this.cellSize = opts.cellSize ?? DEFAULT_CELL_SIZE;
        this.clearance = opts.clearance ?? DEFAULT_CLEARANCE;
        this.width = map.width;
        this.height = map.height;
        this.w = Math.ceil(map.width / this.cellSize);
        this.h = Math.ceil(map.height / this.cellSize);
        const n = this.w * this.h;
        this.blocked = new Uint8Array(n);
        this.terrain = new Uint8Array(n).fill(NavTerrain.Sea);
        this.doorMask = new Uint8Array(n);
        this.comp = new Int32Array(n);
        this.buildTerrain(map);
        this.buildObjects(map);
        this.blockEdges();
        this.labelComponents();
    }

    /**
     * Labels the walkable cells with their connected component. Diagonal steps need both orthogonal neighbours free
     * (no corner cutting), so A*'s 8-connected moves connect exactly what 4-connectivity connects: a two-pass
     * union-find over rows (a few milliseconds for a 720 x 720 grid).
     */
    labelComponents(): void {
        const { w, h, blocked } = this;
        const comp = this.comp;
        const parent = new Int32Array(w * h + 1);
        let next = 1;
        const find = (a: number): number => {
            while (parent[a] !== a) {
                parent[a] = parent[parent[a]];
                a = parent[a];
            }
            return a;
        };
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (blocked[i] !== 0) {
                    comp[i] = 0;
                    continue;
                }
                const left = x > 0 ? comp[i - 1] : 0;
                const up = y > 0 ? comp[i - w] : 0;
                if (left === 0 && up === 0) {
                    parent[next] = next;
                    comp[i] = next++;
                } else if (left !== 0 && up !== 0) {
                    const a = find(left);
                    const b = find(up);
                    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
                    comp[i] = Math.min(a, b);
                } else {
                    comp[i] = left || up;
                }
            }
        }
        for (let i = 0; i < w * h; i++) if (comp[i] !== 0) comp[i] = find(comp[i]);
        this.changesSinceLabel = 0;
        this.queriesSinceLabel = 0;
    }

    /** Component label of a cell (0 when blocked); relabels first when the labels grew stale. */
    component(idx: number): number {
        if (this.changesSinceLabel >= 60 && ++this.queriesSinceLabel >= 600) this.labelComponents();
        return this.blocked[idx] === 0 ? this.comp[idx] : 0;
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

    /** Whether b can (probably) be reached from a: nearest walkable cells in the same component. */
    reachable(a: Vec2, b: Vec2, slack = 1.5): boolean {
        const ia = this.nearestWalkable(a, 4);
        if (ia < 0) return false;
        return this.nearestWalkable(b, slack, this.component(ia)) >= 0;
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
            const door = def.door;
            if (door && door.canUse && !door.locked) {
                this.doors.set(obj.id, { id: obj.id, type: obj.type, collider: col });
                this.markDoor(col);
                continue;
            }
            this.stamp(obj.id, col);
        }
    }

    private blockEdges(): void {
        const m = Math.ceil(EDGE_MARGIN / this.cellSize);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (x < m || y < m || x >= this.w - m || y >= this.h - m) this.blocked[y * this.w + x] = 255;
            }
        }
    }

    private markDoor(col: Collider): void {
        // the closed panel plus a little clearance: cells a player crosses while passing the doorway
        this.forCells(col, 0.5, (i) => {
            this.doorMask[i] = 1;
        });
    }

    /** Calls `fn` for each cell whose centre is within `margin` of the collider. */
    private forCells(col: Collider, margin: number, fn: (i: number) => void): void {
        const cs = this.cellSize;
        const b =
            col.type === 0
                ? {
                      min: { x: col.pos.x - col.rad, y: col.pos.y - col.rad },
                      max: { x: col.pos.x + col.rad, y: col.pos.y + col.rad },
                  }
                : col;
        const x0 = Math.max(0, Math.floor((b.min.x - margin) / cs));
        const x1 = Math.min(this.w - 1, Math.floor((b.max.x + margin) / cs));
        const y0 = Math.max(0, Math.floor((b.min.y - margin) / cs));
        const y1 = Math.min(this.h - 1, Math.floor((b.max.y + margin) / cs));
        const m2 = margin * margin;
        for (let y = y0; y <= y1; y++) {
            const cy = (y + 0.5) * cs;
            for (let x = x0; x <= x1; x++) {
                const cx = (x + 0.5) * cs;
                let inside: boolean;
                if (col.type === 0) {
                    const r = col.rad + margin;
                    inside = (cx - col.pos.x) ** 2 + (cy - col.pos.y) ** 2 < r * r;
                } else {
                    const dx = Math.max(col.min.x - cx, 0, cx - col.max.x);
                    const dy = Math.max(col.min.y - cy, 0, cy - col.max.y);
                    inside = dx * dx + dy * dy < m2 || (dx === 0 && dy === 0);
                }
                if (inside) fn(y * this.w + x);
            }
        }
    }

    /** Blocks the cells within the clearance of `col` under `key` (no-op when the key is already stamped). */
    stamp(key: number, col: Collider): void {
        if (this.stamps.has(key)) return;
        this.stamps.set(key, col);
        this.forCells(col, this.clearance, (i) => {
            if (this.blocked[i] < 254) this.blocked[i]++;
        });
        this.version++;
        this.changesSinceLabel++;
    }

    unstamp(key: number): void {
        const col = this.stamps.get(key);
        if (!col) return;
        this.stamps.delete(key);
        this.forCells(col, this.clearance, (i) => {
            if (this.blocked[i] > 0 && this.blocked[i] < 254) this.blocked[i]--;
        });
        this.version++;
        this.changesSinceLabel++;
    }

    isStamped(key: number): boolean {
        return this.stamps.has(key);
    }

    /**
     * Learns from an obstacle in a snapshot: a dead obstacle no longer blocks, a collidable obstacle MapData did not
     * list (air drop crates, test fixtures) starts blocking.
     */
    observeObstacle(view: ObstacleView): void {
        if (view.dead) {
            if (this.stamps.has(view.id)) this.unstamp(view.id);
            if (this.stamps.has(doorKey(view.id))) this.unstamp(doorKey(view.id));
            this.known.add(view.id);
            return;
        }
        if (view.door && this.doors.has(view.id)) this.observeDoor(view);
        if (this.known.has(view.id)) return;
        this.known.add(view.id);
        const def = obstacleDef(view.type);
        if (!def || !def.collidable || !onGroundLayer(view.layer)) return;
        const col = obstacleCollider(def, view.pos, view.ori, view.scale);
        if (def.door && def.door.canUse && !def.door.locked) {
            this.doors.set(view.id, { id: view.id, type: view.type, collider: col });
            this.markDoor(col);
            this.version++;
            return;
        }
        this.stamp(view.id, col);
    }

    /**
     * An open door's panel stands across the floor next to its doorway (a hinged door turns a quarter around its hinge,
     * a sliding door moves along the wall): it blocks while open and the doorway itself is free.
     */
    private observeDoor(view: ObstacleView): void {
        const key = doorKey(view.id);
        const stamped = this.stamps.get(key);
        if (!view.door?.open) {
            if (stamped) this.unstamp(key);
            return;
        }
        const def = obstacleDef(view.type);
        if (!def) return;
        const col = obstacleCollider(def, view.pos, view.ori, view.scale);
        if (stamped && sameCollider(stamped, col)) return;
        if (stamped) this.unstamp(key);
        this.stamp(key, col);
    }

    inside(cx: number, cy: number): boolean {
        return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h;
    }

    /** Cell index of a world position (clamped to the grid). */
    cellOf(p: Vec2): number {
        const cx = Math.min(this.w - 1, Math.max(0, Math.floor(p.x / this.cellSize)));
        const cy = Math.min(this.h - 1, Math.max(0, Math.floor(p.y / this.cellSize)));
        return cy * this.w + cx;
    }

    center(idx: number): Vec2 {
        const cs = this.cellSize;
        return { x: ((idx % this.w) + 0.5) * cs, y: (Math.floor(idx / this.w) + 0.5) * cs };
    }

    walkable(idx: number): boolean {
        return this.blocked[idx] === 0;
    }

    walkableAt(p: Vec2): boolean {
        return this.blocked[this.cellOf(p)] === 0;
    }

    isWaterAt(p: Vec2): boolean {
        return this.terrain[this.cellOf(p)] !== NavTerrain.Ground;
    }

    /** Cost multiplier of entering a cell. */
    cost(idx: number): number {
        return TERRAIN_COST[this.terrain[idx]] * (this.doorMask[idx] ? DOOR_COST : 1);
    }

    /**
     * Whether a straight walk from a to b stays on walkable cells and on terrain no worse than the worse endpoint
     * (so smoothing never cuts across a river the path went around).
     */
    lineWalkable(a: Vec2, b: Vec2): boolean {
        const cs = this.cellSize;
        const w = this.w;
        let x = Math.min(w - 1, Math.max(0, Math.floor(a.x / cs)));
        let y = Math.min(this.h - 1, Math.max(0, Math.floor(a.y / cs)));
        const tx = Math.min(w - 1, Math.max(0, Math.floor(b.x / cs)));
        const ty = Math.min(this.h - 1, Math.max(0, Math.floor(b.y / cs)));
        const allowed = Math.max(this.terrain[y * w + x], this.terrain[ty * w + tx]);
        // grid traversal (Amanatides & Woo): every cell the segment passes through
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        const tDeltaX = dx !== 0 ? Math.abs(cs / dx) : Number.POSITIVE_INFINITY;
        const tDeltaY = dy !== 0 ? Math.abs(cs / dy) : Number.POSITIVE_INFINITY;
        let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 : x) * cs - a.x) / dx : Number.POSITIVE_INFINITY;
        let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 : y) * cs - a.y) / dy : Number.POSITIVE_INFINITY;
        for (let n = 0; n < 4 * (this.w + this.h); n++) {
            const i = y * w + x;
            if (this.blocked[i] !== 0 || this.terrain[i] > allowed) return false;
            if (x === tx && y === ty) return true;
            if (tMaxX < tMaxY) {
                x += stepX;
                tMaxX += tDeltaX;
            } else {
                y += stepY;
                tMaxY += tDeltaY;
            }
            if (x < 0 || y < 0 || x >= w || y >= this.h) return false;
        }
        return false;
    }

    /** Nearest walkable cell within `maxRadius` world units of `p` (ring search), optionally in component `comp`. */
    nearestWalkable(p: Vec2, maxRadius = 6, comp = 0): number {
        const start = this.cellOf(p);
        if (this.blocked[start] === 0 && (comp === 0 || this.comp[start] === comp)) return start;
        const cx = start % this.w;
        const cy = Math.floor(start / this.w);
        const maxR = Math.ceil(maxRadius / this.cellSize);
        let best = -1;
        let bestD = Number.POSITIVE_INFINITY;
        for (let r = 1; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = cx + dx;
                    const y = cy + dy;
                    if (!this.inside(x, y)) continue;
                    const i = y * this.w + x;
                    if (this.blocked[i] !== 0 || (comp !== 0 && this.comp[i] !== comp)) continue;
                    const d = v2.distanceSqr(this.center(i), p) * (this.terrain[i] === NavTerrain.Ground ? 1 : 4);
                    if (d < bestD) {
                        bestD = d;
                        best = i;
                    }
                }
            }
            if (best >= 0) return best;
        }
        return -1;
    }
}
