// The cell grid shared by the ground navigation grid (nav/grid.ts, the whole map) and the small underground grids of
// basements and bunkers (nav/underground.ts): square cells from an origin, blocking stamps (colliders inflated by the
// player's clearance), door cells, terrain cost classes, connected components, grid line of sight and nearest
// walkable cell search. A* (nav/astar.ts) runs on any CellGrid; nav/components.ts keeps the component labels.
import { type Collider, type Vec2, v2 } from "@rebirth/core";
import type { ObstacleDef } from "@rebirth/defs";
import type { ObstacleView } from "@rebirth/sim";
import { obstacleCollider, obstacleDef, rotateOri } from "../geom.ts";
import { breakClassOf } from "./breakThrough.ts";
import { CellLabels } from "./components.ts";

/** Terrain cost classes per cell. */
export const NavTerrain = { Ground: 0, Water: 1, Sea: 2 } as const;
/** Movement cost multiplier per terrain class (water: 12 -> 9 u/s plus a margin; the sea is a last resort). */
const TERRAIN_COST = [1, 1.6, 8];
/** Passing a closed door costs a little more (it has to be opened). */
const DOOR_COST = 1.5;
/** Squeezing through a tight cell (see CellGrid.tight) costs this much more than open ground. */
const TIGHT_COST = 3;
/** Sub-points tested for tight cells: the cell centre's four quarter points (in cells). */
const SUB_X = [-0.25, 0.25, -0.25, 0.25];
const SUB_Y = [-0.25, -0.25, 0.25, 0.25];

export interface NavDoor {
    id: number;
    type: string;
    collider: Collider;
}

/** A door the navigation can walk through: usable and unlocked. */
export function walkThroughDoor(def: ObstacleDef): boolean {
    const door = def.door;
    return !!door && door.canUse && !door.locked;
}

/**
 * The direction a one-way automatic door lets players through, or null for any other door: bunker lab doors open only
 * for a player on their `openOneWay` side (1 / true: the door's local -x side, sim world/doors.ts autoOpenDoors and
 * playerSide), so they can be crossed towards +x only.
 */
export function oneWayPassage(def: ObstacleDef, ori: number): Vec2 | null {
    const door = def.door;
    if (!door?.autoOpen || !door.openOneWay) return null;
    const side = door.openOneWay === true ? 1 : Number(door.openOneWay);
    return rotateOri({ x: side > 0 ? 1 : -1, y: 0 }, ori);
}

/** Whether two layers collide (the simulation's sameLayer: same floor, or both on stairs). */
export function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

/** Stamp key of a door's panel (obstacle ids are positive and below 2^24). */
export function doorKey(id: number): number {
    return -(1 << 26) - id;
}

function sameCollider(a: Collider, b: Collider): boolean {
    if (a.type === 0 && b.type === 0) return a.pos.x === b.pos.x && a.pos.y === b.pos.y && a.rad === b.rad;
    if (a.type === 1 && b.type === 1) {
        return a.min.x === b.min.x && a.min.y === b.min.y && a.max.x === b.max.x && a.max.y === b.max.y;
    }
    return false;
}

export abstract class CellGrid {
    /** world position of the grid's (0, 0) corner */
    readonly ox: number;
    readonly oy: number;
    readonly w: number;
    readonly h: number;
    readonly cellSize: number;
    readonly clearance: number;
    /** number of blocking stamps covering each cell (saturating; 255 = permanently blocked) */
    readonly blocked: Uint8Array;
    /**
     * 1 for a cell whose centre is within the clearance of a collider but one of its quarter points is not: a player
     * fits through there (a 2.5-3 unit doorway, a shack's door, a gap between crates leaves no cell centre a full
     * clearance from both sides). A* may cross tight cells at a higher cost and components connect through them;
     * everything else (nearestWalkable, lineWalkable, walkable) treats them as blocked.
     */
    readonly tight: Uint8Array;
    /** stamps covering each cell's four quarter points (tight cells) */
    private readonly sub: Uint8Array;
    /** NavTerrain class of each cell */
    readonly terrain: Uint8Array;
    /** breakable stamps covering each cell by break class 1 and 2 (nav/breakThrough.ts BreakClass) */
    readonly brk: readonly [Uint8Array, Uint8Array];
    /** 1 where a usable door's closed panel lies */
    readonly doorMask: Uint8Array;
    /** usable doors of this grid's floor, by obstacle id */
    readonly doors = new Map<number, NavDoor>();
    /**
     * Doors only a switch, a puzzle or a scheduled unlock opens (def `canUse` false or `locked`: the club's secret door,
     * vault and cell doors, the Twins and arsenal lab doors), by obstacle id: their closed panel is a wall under
     * doorKey(id) until a snapshot shows them open (or unlocked), like an open door's panel (observeDoor). Only on a grid
     * that learns them (`learnsSealed`, BrainFeatures.puzzles); elsewhere they are stamped walls under their own id, for
     * good, as before the puzzles existed.
     */
    readonly sealedDoors = new Set<number>();
    /** whether this grid learns sealed doors (NavOptions.sealedDoors): the puzzle bots' grids only */
    readonly learnsSealed: boolean;
    /** one-way door cells: 0, or 1 + the index of their passage direction in `oneWayDirs` */
    readonly oneWay: Uint8Array;
    readonly oneWayDirs: Vec2[] = [];
    /** bumped on every change, so path caches can tell they are stale */
    version = 0;
    /** stamped colliders by key (obstacle id; negative keys for stairs and door panels) */
    protected readonly stamps = new Map<number, Collider>();
    /** the break class of breakable stamps by key (nav/breakThrough.ts) */
    protected readonly stampCls = new Map<number, number>();
    /** obstacle ids already considered (stamped or deliberately left out) */
    protected readonly known = new Set<number>();
    /**
     * Connected component of each walkable cell (0 for blocked cells), with the same moves as A*: cells an obstacle
     * frees join their component at once, an obstacle added relabels only after enough changes (components.ts). A hint
     * that saves hopeless searches, never a hard rule.
     */
    protected readonly labels: CellLabels;

    constructor(
        ox: number,
        oy: number,
        w: number,
        h: number,
        cellSize: number,
        clearance: number,
        terrain: number,
        learnsSealed = false,
    ) {
        this.learnsSealed = learnsSealed;
        this.ox = ox;
        this.oy = oy;
        this.w = w;
        this.h = h;
        this.cellSize = cellSize;
        this.clearance = clearance;
        const n = w * h;
        this.blocked = new Uint8Array(n);
        this.tight = new Uint8Array(n);
        this.sub = new Uint8Array(4 * n);
        this.terrain = new Uint8Array(n).fill(terrain);
        this.brk = [new Uint8Array(n), new Uint8Array(n)];
        this.doorMask = new Uint8Array(n);
        this.oneWay = new Uint8Array(n);
        this.labels = new CellLabels(w, h, this.blocked, this.tight);
    }

    /**
     * Takes over every cell, stamp, door and label of a grid of the same geometry (a new game's grid starts as a copy
     * of the map's pristine grid: nav/grid.ts NavGrid.forMap). Colliders and door records are shared (never mutated).
     */
    protected copyFrom(src: CellGrid): void {
        this.blocked.set(src.blocked);
        this.tight.set(src.tight);
        this.sub.set(src.sub);
        this.terrain.set(src.terrain);
        this.brk[0].set(src.brk[0]);
        this.brk[1].set(src.brk[1]);
        for (const [key, c] of src.stampCls) this.stampCls.set(key, c);
        this.doorMask.set(src.doorMask);
        this.oneWay.set(src.oneWay);
        this.oneWayDirs.push(...src.oneWayDirs);
        for (const [id, d] of src.doors) this.doors.set(id, d);
        for (const id of src.sealedDoors) this.sealedDoors.add(id);
        for (const [key, col] of src.stamps) this.stamps.set(key, col);
        for (const id of src.known) this.known.add(id);
        this.labels.copyFrom(src.labels);
        this.version = src.version;
    }

    /** Whether an object on `layer` collides with a player walking this grid's floor. */
    protected abstract collidesWith(layer: number): boolean;

    /** Labels the walkable cells with their connected component anew (components.ts). */
    labelComponents(): void {
        this.labels.label();
    }

    /** Full component labellings so far (diagnostics, tests). */
    get relabels(): number {
        return this.labels.relabels;
    }

    /** Bumped whenever components may have grown together (a crate across a corridor broke): see components.ts. */
    get joins(): number {
        return this.labels.joins;
    }

    /** Component label of a cell (0 when blocked); relabels first when the labels grew stale. */
    component(idx: number): number {
        return this.labels.of(idx);
    }

    /** A* may enter the cell: free, or tight. */
    passable(idx: number): boolean {
        return this.blocked[idx] === 0 || this.tight[idx] !== 0;
    }

    /** Whether b can (probably) be reached from a: nearest walkable cells in the same component. */
    reachable(a: Vec2, b: Vec2, slack = 1.5): boolean {
        const ia = this.nearestWalkable(a, 4);
        if (ia < 0) return false;
        return this.nearestWalkable(b, slack, this.component(ia)) >= 0;
    }

    /** Registers a usable door: passable door cells, one-way ones with their passage direction. */
    protected addDoor(id: number, type: string, def: ObstacleDef, col: Collider, ori: number): void {
        this.doors.set(id, { id, type, collider: col });
        // the closed panel plus a little clearance: cells a player crosses while passing the doorway
        const pass = oneWayPassage(def, ori);
        if (pass && this.oneWayDirs.length < 255) this.oneWayDirs.push(pass);
        const k = pass ? this.oneWayDirs.length : 0;
        this.forCells(col, 0.5, (i) => {
            this.doorMask[i] = 1;
            if (k) this.oneWay[i] = k;
        });
    }

    /** Registers a door players cannot open by hand: its closed panel blocks until a snapshot shows it open. */
    protected addSealedDoor(id: number, col: Collider): void {
        this.sealedDoors.add(id);
        this.stamp(doorKey(id), col);
    }

    /**
     * Whether the step between neighbour cells `from` -> `to` respects one-way doors: a step into a one-way door's
     * cells must go along its passage direction (sideways inside them is fine), never against it.
     */
    oneWayAllows(from: number, to: number): boolean {
        const b = this.oneWay[to];
        if (b === 0) return true;
        const d = this.oneWayDirs[b - 1];
        const w = this.w;
        const dot = ((to % w) - (from % w)) * d.x + (Math.floor(to / w) - Math.floor(from / w)) * d.y;
        return this.oneWay[from] === 0 ? dot > 0.5 : dot > -0.5;
    }

    /** Cells x0, y0, x1, y1 (clamped to the grid) of the collider's bounds grown by `margin` units and `pad` cells. */
    private cellBox(col: Collider, margin: number, pad: number): [number, number, number, number] {
        const cs = this.cellSize;
        const b =
            col.type === 0
                ? {
                      min: { x: col.pos.x - col.rad, y: col.pos.y - col.rad },
                      max: { x: col.pos.x + col.rad, y: col.pos.y + col.rad },
                  }
                : col;
        return [
            Math.max(0, Math.floor((b.min.x - margin - this.ox) / cs - pad)),
            Math.max(0, Math.floor((b.min.y - margin - this.oy) / cs - pad)),
            Math.min(this.w - 1, Math.floor((b.max.x + margin - this.ox) / cs + pad)),
            Math.min(this.h - 1, Math.floor((b.max.y + margin - this.oy) / cs + pad)),
        ];
    }

    /** Calls `fn` for each cell whose centre is within `margin` of the collider. */
    protected forCells(col: Collider, margin: number, fn: (i: number) => void): void {
        const cs = this.cellSize;
        const ox = this.ox;
        const oy = this.oy;
        const [x0, y0, x1, y1] = this.cellBox(col, margin, 0);
        const m2 = margin * margin;
        for (let y = y0; y <= y1; y++) {
            const cy = (y + 0.5) * cs + oy;
            for (let x = x0; x <= x1; x++) {
                const cx = (x + 0.5) * cs + ox;
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

    /**
     * Blocks the cells within the clearance of `col` under `key` (no-op when the key is already stamped); `cls` 1 or 2
     * marks it breakable for routing (nav/breakThrough.ts).
     */
    stamp(key: number, col: Collider, cls = 0): void {
        if (this.stamps.has(key)) return;
        this.stamps.set(key, col);
        const brk = cls ? this.brk[cls - 1] : null;
        if (brk) this.stampCls.set(key, cls);
        this.forCells(col, this.clearance, (i) => {
            if (this.blocked[i] < 254) this.blocked[i]++;
            if (brk && brk[i] < 255) brk[i]++;
        });
        this.stampSub(col, 1);
        this.version++;
        this.labels.added();
    }

    unstamp(key: number): void {
        const col = this.stamps.get(key);
        if (!col) return;
        this.stamps.delete(key);
        const cls = this.stampCls.get(key) ?? 0;
        const brk = cls ? this.brk[cls - 1] : null;
        this.stampCls.delete(key);
        this.forCells(col, this.clearance, (i) => {
            if (this.blocked[i] > 0 && this.blocked[i] < 254) this.blocked[i]--;
            if (brk && brk[i] > 0) brk[i]--;
        });
        this.stampSub(col, -1);
        this.version++;
        // the freed cells join the component they border now, and a corridor the obstacle blocked relabels the grid
        const [x0, y0, x1, y1] = this.cellBox(col, this.clearance, 0.5);
        this.labels.freed(x0, y0, x1, y1);
    }

    /** Counts `col` (inflated by the clearance) on the quarter points it covers, then refreshes the tight flags there. */
    private stampSub(col: Collider, delta: 1 | -1): void {
        const cs = this.cellSize;
        const margin = this.clearance;
        const [x0, y0, x1, y1] = this.cellBox(col, margin, 0.5);
        const m2 = margin * margin;
        const sub = this.sub;
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const i = y * this.w + x;
                for (let k = 0; k < 4; k++) {
                    const px = (x + 0.5 + SUB_X[k]) * cs + this.ox;
                    const py = (y + 0.5 + SUB_Y[k]) * cs + this.oy;
                    let inside: boolean;
                    if (col.type === 0) {
                        const r = col.rad + margin;
                        inside = (px - col.pos.x) ** 2 + (py - col.pos.y) ** 2 < r * r;
                    } else {
                        const dx = Math.max(col.min.x - px, 0, px - col.max.x);
                        const dy = Math.max(col.min.y - py, 0, py - col.max.y);
                        inside = dx * dx + dy * dy < m2 || (dx === 0 && dy === 0);
                    }
                    if (!inside) continue;
                    const j = 4 * i + k;
                    if (delta > 0) {
                        if (sub[j] < 255) sub[j]++;
                    } else if (sub[j] > 0 && sub[j] < 255) sub[j]--;
                }
                this.refreshTight(i);
            }
        }
    }

    /** Recomputes a cell's tight flag (permanently blocked cells, 255, are never tight). */
    protected refreshTight(i: number): void {
        const bl = this.blocked[i];
        const sub = this.sub;
        const j = 4 * i;
        this.tight[i] =
            bl !== 0 && bl < 254 && (sub[j] === 0 || sub[j + 1] === 0 || sub[j + 2] === 0 || sub[j + 3] === 0) ? 1 : 0;
    }

    /** Marks a cell permanently blocked (map border, outside an underground floor). */
    protected blockForever(i: number): void {
        this.blocked[i] = 255;
        this.tight[i] = 0;
    }

    /**
     * Relabel the components at the next query (something that sealed off a room is gone: the bookshelf in front of
     * the club's secret door was broken, brain/puzzleRoom.ts).
     */
    relabelSoon(): void {
        this.labels.soon();
    }

    isStamped(key: number): boolean {
        return this.stamps.has(key);
    }

    /** Whether this grid deals with the obstacle at all (its floor, its area). */
    protected concerns(view: ObstacleView): boolean {
        return this.collidesWith(view.layer);
    }

    /**
     * Learns from an obstacle in a snapshot: a dead obstacle no longer blocks, a collidable obstacle the map did not
     * list (air drop crates, test fixtures) starts blocking, doors update their panel.
     */
    observeObstacle(view: ObstacleView): void {
        if (view.dead) {
            if (this.stamps.has(view.id)) this.unstamp(view.id);
            if (this.stamps.has(doorKey(view.id))) this.unstamp(doorKey(view.id));
            this.known.add(view.id);
            return;
        }
        if (view.door && (this.doors.has(view.id) || this.sealedDoors.has(view.id))) this.observeDoor(view);
        if (this.known.has(view.id)) return;
        this.known.add(view.id);
        const def = obstacleDef(view.type);
        if (!def?.collidable || !this.concerns(view)) return;
        const col = obstacleCollider(def, view.pos, view.ori, view.scale);
        if (walkThroughDoor(def)) {
            this.addDoor(view.id, view.type, def, col, view.ori);
            this.version++;
            return;
        }
        if (def.door && this.learnsSealed) {
            this.addSealedDoor(view.id, col);
            if (view.door) this.observeDoor(view);
            return;
        }
        this.stamp(view.id, col, breakClassOf(def, view.type, false));
    }

    /**
     * An open door's panel stands across the floor next to its doorway (a hinged door turns a quarter around its hinge,
     * a sliding door moves along the wall): it blocks while open and the doorway itself is free. A closed door that
     * cannot be used (it opens once, by a switch or a puzzle; locked) blocks like a wall. Sealed doors (sealedDoors)
     * start out stamped closed and go through here too, so a puzzle door a snapshot shows open stops being a wall.
     */
    protected observeDoor(view: ObstacleView): void {
        const key = doorKey(view.id);
        const stamped = this.stamps.get(key);
        const door = view.door;
        const blocksClosed = !!door && !door.open && (!door.canUse || door.locked);
        // (a sealed door moving joins or cuts off a whole room: the component labels must not wait for 60 changes)
        const sealed = this.sealedDoors.has(view.id);
        if (!door?.open && !blocksClosed) {
            if (stamped) {
                this.unstamp(key);
                if (sealed) this.labels.soon();
            }
            return;
        }
        const def = obstacleDef(view.type);
        if (!def) return;
        const col = obstacleCollider(def, view.pos, view.ori, view.scale);
        if (stamped && sameCollider(stamped, col)) return;
        if (stamped) this.unstamp(key);
        this.stamp(key, col);
        if (sealed) this.labels.soon();
    }

    /** Cell coordinates inside the grid. */
    inside(cx: number, cy: number): boolean {
        return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h;
    }

    /** Whether a world position lies on the grid. */
    covers(p: Vec2): boolean {
        const x = (p.x - this.ox) / this.cellSize;
        const y = (p.y - this.oy) / this.cellSize;
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    /** Cell index of a world position (clamped to the grid). */
    cellOf(p: Vec2): number {
        const cx = Math.min(this.w - 1, Math.max(0, Math.floor((p.x - this.ox) / this.cellSize)));
        const cy = Math.min(this.h - 1, Math.max(0, Math.floor((p.y - this.oy) / this.cellSize)));
        return cy * this.w + cx;
    }

    center(idx: number): Vec2 {
        const cs = this.cellSize;
        return { x: ((idx % this.w) + 0.5) * cs + this.ox, y: (Math.floor(idx / this.w) + 0.5) * cs + this.oy };
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
        return (
            TERRAIN_COST[this.terrain[idx]] * (this.doorMask[idx] ? DOOR_COST : 1) * (this.tight[idx] ? TIGHT_COST : 1)
        );
    }

    /**
     * Whether a straight walk from a to b stays on walkable cells and on terrain no worse than the worse endpoint
     * (so smoothing never cuts across a river the path went around).
     */
    lineWalkable(a: Vec2, b: Vec2): boolean {
        const cs = this.cellSize;
        const w = this.w;
        const ox = this.ox;
        const oy = this.oy;
        let x = Math.min(w - 1, Math.max(0, Math.floor((a.x - ox) / cs)));
        let y = Math.min(this.h - 1, Math.max(0, Math.floor((a.y - oy) / cs)));
        const tx = Math.min(w - 1, Math.max(0, Math.floor((b.x - ox) / cs)));
        const ty = Math.min(this.h - 1, Math.max(0, Math.floor((b.y - oy) / cs)));
        const allowed = Math.max(this.terrain[y * w + x], this.terrain[ty * w + tx]);
        // grid traversal (Amanatides & Woo): every cell the segment passes through
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        const tDeltaX = dx !== 0 ? Math.abs(cs / dx) : Number.POSITIVE_INFINITY;
        const tDeltaY = dy !== 0 ? Math.abs(cs / dy) : Number.POSITIVE_INFINITY;
        let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 : x) * cs + ox - a.x) / dx : Number.POSITIVE_INFINITY;
        let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 : y) * cs + oy - a.y) / dy : Number.POSITIVE_INFINITY;
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

    /**
     * Whether every cell a straight line from a to b passes through is passable for A* (free or tight, any terrain):
     * a plan's leg is still open after the grid changed.
     */
    linePassable(a: Vec2, b: Vec2): boolean {
        const cs = this.cellSize;
        const w = this.w;
        let x = Math.min(w - 1, Math.max(0, Math.floor((a.x - this.ox) / cs)));
        let y = Math.min(this.h - 1, Math.max(0, Math.floor((a.y - this.oy) / cs)));
        const tx = Math.min(w - 1, Math.max(0, Math.floor((b.x - this.ox) / cs)));
        const ty = Math.min(this.h - 1, Math.max(0, Math.floor((b.y - this.oy) / cs)));
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        const tDeltaX = dx !== 0 ? Math.abs(cs / dx) : Number.POSITIVE_INFINITY;
        const tDeltaY = dy !== 0 ? Math.abs(cs / dy) : Number.POSITIVE_INFINITY;
        let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 : x) * cs + this.ox - a.x) / dx : Number.POSITIVE_INFINITY;
        let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 : y) * cs + this.oy - a.y) / dy : Number.POSITIVE_INFINITY;
        for (let n = 0; n < 4 * (this.w + this.h); n++) {
            const i = y * w + x;
            if (this.blocked[i] !== 0 && this.tight[i] === 0) return false;
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

    /** Whether `count` waypoints from `from` on and the legs between them are passable (a plan still open). */
    legsOpen(points: readonly Vec2[], from: number, count: number): boolean {
        const end = Math.min(points.length, from + count);
        for (let i = from; i < end; i++) {
            if (!this.covers(points[i]) || !this.passable(this.cellOf(points[i]))) return false;
            if (i > from && !this.linePassable(points[i - 1], points[i])) return false;
        }
        return true;
    }

    /** Nearest walkable cell within `maxRadius` world units of `p` (ring search), optionally in component `comp`. */
    nearestWalkable(p: Vec2, maxRadius = 6, comp = 0): number {
        const start = this.cellOf(p);
        const labels = this.labels.comp;
        if (this.blocked[start] === 0 && (comp === 0 || labels[start] === comp)) return start;
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
                    if (this.blocked[i] !== 0 || (comp !== 0 && labels[i] !== comp)) continue;
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
