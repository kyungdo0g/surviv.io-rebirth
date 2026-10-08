// Underground navigation (BrainFeatures.basements): 0.8.82 maps have no upper floors; every structure with walkable
// stairs leads to one underground layer (bunkers, the mansion and saloon cellars, the club's bathhouse, the barn
// basement; bridge stairs are loot-only). Each such structure gets a small layer-1 grid of its own (an UndergroundGrid:
// the floors of its layer-1 buildings, their walls and doors) and its stairs become portals between that grid and the
// ground NavGrid: a walkable ground point just past the stair's top end and an underground point just past its bottom
// end. The path follower plans hierarchically (nav/layered.ts): ground A* to a portal's top, along the stair axis, local
// A* underground, and the way back. The ground grid, its A* and its per-tick plan budget are unchanged; underground
// plans spend a budget of their own. Built only from MapData (what every client receives), shared by every bot of a
// game: one per ground grid (NavGrid.forMap), a later game's a copy of the map's pristine one (grid.ts PerGame).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { type BuildingDef, getMapObjectDef, hasMapObjectDef, type StructureDef } from "@rebirth/defs";
import type { MapData, MapObjectSpawn, ObstacleView } from "@rebirth/sim";
import { colliderBounds, obstacleCollider, pointInBounds, rotateOri, transformCollider } from "../geom.ts";
import { CellGrid, NavTerrain, walkThroughDoor } from "./cellGrid.ts";
import { DEFAULT_CLEARANCE, NavGrid, PerGame } from "./grid.ts";

/** A* nodes all bots of a map may expand underground in one simulation tick (the ground budget is separate). */
export const UNDERGROUND_PLAN_BUDGET = 6000;
/** Empty cells around an underground grid's floors. */
const GRID_PAD = 3;
/** Portal points lie this far past the stair's ends, snapped to a walkable cell within PORTAL_SNAP. */
const PORTAL_OUT = 1.6;
const PORTAL_SNAP = 2.5;
const SQRT2 = Math.SQRT2;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

/** One walkable stair: the way between the ground and one underground grid. */
export interface StairPortal {
    /** index in UndergroundNav.portals */
    id: number;
    region: UndergroundGrid;
    /** map object id of the structure */
    structureId: number;
    /** the stair box (world) */
    box: Bounds;
    center: Vec2;
    /** unit direction down the stairs */
    down: Vec2;
    /** half the stair length along `down`, half its width across */
    halfLen: number;
    halfWidth: number;
    /** walkable ground point just past the top end, null when the ground grid has none there */
    top: Vec2 | null;
    /** walkable underground point just past the bottom end, null when the underground grid has none there */
    bottom: Vec2 | null;
}

interface Layout {
    ox: number;
    oy: number;
    w: number;
    h: number;
    floors: Bounds[];
    stairs: Array<{ box: Bounds; down: Vec2 }>;
}

function union(boxes: readonly Bounds[]): Bounds {
    const b = { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } };
    for (const x of boxes) {
        b.min.x = Math.min(b.min.x, x.min.x);
        b.min.y = Math.min(b.min.y, x.min.y);
        b.max.x = Math.max(b.max.x, x.max.x);
        b.max.y = Math.max(b.max.y, x.max.y);
    }
    return b;
}

function grow(b: Bounds, m: number): Bounds {
    return { min: { x: b.min.x - m, y: b.min.y - m }, max: { x: b.max.x + m, y: b.max.y + m } };
}

function floorsOf(def: BuildingDef, pos: Vec2, ori: number): Bounds[] {
    const out: Bounds[] = [];
    for (const s of def.floor.surfaces) {
        for (const box of s.collision) {
            const b = colliderBounds(transformCollider(box, pos, ori, 1));
            if (b.max.x - b.min.x > 0.01 && b.max.y - b.min.y > 0.01) out.push(b);
        }
    }
    return out;
}

/** Floors (the structure's underground buildings and the layer-1 buildings inside them) and stairs of a structure. */
function layoutOf(spawn: MapObjectSpawn, def: StructureDef, map: MapData): Layout | null {
    const stairs = def.stairs
        .filter((s) => !s.lootOnly)
        .map((s) => ({
            box: colliderBounds(transformCollider(s.collision, spawn.pos, spawn.ori, 1)),
            down: v2.normalizeSafe(rotateOri(s.downDir, spawn.ori)),
        }));
    if (stairs.length === 0) return null;
    const floors: Bounds[] = [];
    def.layers.forEach((l, i) => {
        if (i === 0 || !hasMapObjectDef(l.type)) return;
        const b = getMapObjectDef(l.type);
        if (b.type !== "building") return;
        floors.push(...floorsOf(b, v2.add(spawn.pos, rotateOri(l.pos, spawn.ori)), (l.ori + spawn.ori) % 4));
    });
    const masks = def.mask.map((m) => colliderBounds(transformCollider(m, spawn.pos, spawn.ori, 1)));
    if (floors.length === 0 && masks.length === 0) return null;
    const extent = grow(union([...floors, ...masks, ...stairs.map((s) => s.box)]), 1);
    // the rooms inside: every layer-1 building of the map within that extent
    for (const o of map.objects) {
        if ((o.layer & 1) !== 1 || !hasMapObjectDef(o.type) || !pointInBounds(o.pos, extent)) continue;
        const b = getMapObjectDef(o.type);
        if (b.type === "building") floors.push(...floorsOf(b, o.pos, o.ori));
    }
    floors.push(...masks);
    const all = grow(union([...floors, ...stairs.map((s) => s.box)]), GRID_PAD);
    const ox = Math.floor(all.min.x);
    const oy = Math.floor(all.min.y);
    return { ox, oy, w: Math.ceil(all.max.x) - ox, h: Math.ceil(all.max.y) - oy, floors, stairs };
}

/** The layer-1 floor of one structure. */
export class UndergroundGrid extends CellGrid {
    /** index in UndergroundNav.regions */
    readonly id: number;
    readonly structureId: number;
    readonly type: string;
    /** world bounds of the grid */
    readonly bounds: Bounds;
    /** the bounds grown by 2: obstacles positioned in here concern this grid */
    readonly area: Bounds;
    /** 1 for cells on the underground floor (everything else is permanently blocked) */
    readonly floor: Uint8Array;
    readonly portals: StairPortal[] = [];
    private readonly owner: UndergroundNav;
    private readonly spawn: MapObjectSpawn;
    private readonly layout: Layout;
    private readonly fields = new Map<number, { version: number; dist: Float64Array }>();

    /** Builds the floor of `spawn` from `map`, or only its geometry for a copy (`map` null: copyFor). */
    constructor(owner: UndergroundNav, id: number, spawn: MapObjectSpawn, layout: Layout, map: MapData | null) {
        super(layout.ox, layout.oy, layout.w, layout.h, 1, DEFAULT_CLEARANCE, NavTerrain.Ground, owner.learnsSealed);
        this.owner = owner;
        this.spawn = spawn;
        this.layout = layout;
        this.id = id;
        this.structureId = spawn.id;
        this.type = spawn.type;
        this.bounds = { min: { x: this.ox, y: this.oy }, max: { x: this.ox + this.w, y: this.oy + this.h } };
        this.area = grow(this.bounds, 2);
        this.floor = new Uint8Array(this.w * this.h);
        for (const f of layout.floors) {
            this.forCells({ type: 1, min: f.min, max: f.max }, 0, (i) => {
                this.floor[i] = 1;
            });
        }
        if (!map) return;
        for (let i = 0; i < this.floor.length; i++) if (!this.floor[i]) this.blockForever(i);
        // the stairs are the way up, never part of an underground path
        layout.stairs.forEach((s, k) => {
            this.stamp(-(k + 1), { type: 1, min: s.box.min, max: s.box.max });
        });
        for (const o of map.objects) {
            if ((o.layer & 1) !== 1 || !pointInBounds(o.pos, this.area) || !hasMapObjectDef(o.type)) continue;
            const def = getMapObjectDef(o.type);
            if (def.type !== "obstacle") continue;
            this.known.add(o.id);
            if (!def.collidable) continue;
            const col = obstacleCollider(def, o.pos, o.ori, o.scale);
            if (walkThroughDoor(def)) {
                this.addDoor(o.id, o.type, def, col, o.ori);
                continue;
            }
            // the bathhouse vault, the chrys and eye vaults: walls (until a snapshot shows them open, cellGrid.ts)
            if (def.door && this.learnsSealed) {
                this.addSealedDoor(o.id, col);
                continue;
            }
            this.stamp(o.id, col);
        }
        this.labelComponents();
    }

    /** A copy of this grid (cells, stamps, doors, labels) for the navigation `owner` of another game. */
    copyFor(owner: UndergroundNav): UndergroundGrid {
        const g = new UndergroundGrid(owner, this.id, this.spawn, this.layout, null);
        g.copyFrom(this);
        return g;
    }

    /** Players underground collide with layers 1 and 3. */
    protected collidesWith(layer: number): boolean {
        return (layer & 1) === 1;
    }

    protected concerns(view: ObstacleView): boolean {
        return this.collidesWith(view.layer) && pointInBounds(view.pos, this.area);
    }

    /** Whether `p` is on this grid's floor (or within `slack` of it). */
    onFloor(p: Vec2, slack = 0): boolean {
        const b = this.bounds;
        if (p.x < b.min.x - slack || p.y < b.min.y - slack || p.x > b.max.x + slack || p.y > b.max.y + slack)
            return false;
        const c = this.cellOf(p);
        if (this.floor[c]) return true;
        if (slack <= 0) return false;
        const r = Math.ceil(slack);
        const cx = c % this.w;
        const cy = Math.floor(c / this.w);
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (this.inside(x, y) && this.floor[y * this.w + x]) return true;
            }
        }
        return false;
    }

    /** Underground plan budget shared by every underground grid of the map. */
    planBudget(now: number): number {
        return this.owner.planBudget(now);
    }

    spendPlanBudget(nodes: number): void {
        this.owner.spendPlanBudget(nodes);
    }

    /**
     * Walking cost (about world units) between the portal's bottom and `p`: from the portal to `p`, or with `toPortal`
     * from `p` to the portal (they differ across one-way doors); Infinity when there is no way.
     */
    costToPortal(portal: StairPortal, p: Vec2, toPortal = false): number {
        if (!portal.bottom) return Number.POSITIVE_INFINITY;
        const dist = this.field(portal, toPortal);
        const c = this.nearestWalkable(p, 3);
        return c < 0 ? Number.POSITIVE_INFINITY : dist[c];
    }

    /**
     * Dijkstra distances over this grid from a portal's bottom (or, `reverse`, to it), cached until the grid changes.
     */
    private field(portal: StairPortal, reverse: boolean): Float64Array {
        const key = portal.id * 2 + (reverse ? 1 : 0);
        const cached = this.fields.get(key);
        if (cached && cached.version === this.version) return cached.dist;
        const n = this.w * this.h;
        const dist = cached?.dist ?? new Float64Array(n);
        dist.fill(Number.POSITIVE_INFINITY);
        const start = portal.bottom ? this.nearestWalkable(portal.bottom, PORTAL_SNAP) : -1;
        if (start >= 0) {
            // small grids: a plain binary heap of (cost, cell)
            const heap: number[] = [];
            const push = (c: number, d: number) => {
                heap.push(d, c);
                let i = heap.length / 2 - 1;
                while (i > 0) {
                    const p = (i - 1) >> 1;
                    if (heap[2 * p] <= heap[2 * i]) break;
                    [heap[2 * p], heap[2 * i]] = [heap[2 * i], heap[2 * p]];
                    [heap[2 * p + 1], heap[2 * i + 1]] = [heap[2 * i + 1], heap[2 * p + 1]];
                    i = p;
                }
            };
            const pop = (): [number, number] => {
                const top: [number, number] = [heap[0], heap[1]];
                const lastC = heap.pop() as number;
                const lastD = heap.pop() as number;
                if (heap.length > 0) {
                    heap[0] = lastD;
                    heap[1] = lastC;
                    let i = 0;
                    const m = heap.length / 2;
                    for (;;) {
                        const l = 2 * i + 1;
                        if (l >= m) break;
                        const r = l + 1;
                        const c = r < m && heap[2 * r] < heap[2 * l] ? r : l;
                        if (heap[2 * c] >= heap[2 * i]) break;
                        [heap[2 * c], heap[2 * i]] = [heap[2 * i], heap[2 * c]];
                        [heap[2 * c + 1], heap[2 * i + 1]] = [heap[2 * i + 1], heap[2 * c + 1]];
                        i = c;
                    }
                }
                return top;
            };
            dist[start] = 0;
            push(start, 0);
            while (heap.length > 0) {
                const [d, cur] = pop();
                if (d > dist[cur]) continue;
                const cx = cur % this.w;
                const cy = (cur - cx) / this.w;
                for (let k = 0; k < 8; k++) {
                    const nx = cx + DX[k];
                    const ny = cy + DY[k];
                    if (!this.inside(nx, ny)) continue;
                    const ni = ny * this.w + nx;
                    if (!this.passable(ni)) continue;
                    let step = 1;
                    if (k >= 4) {
                        if (!this.passable(cy * this.w + nx) || !this.passable(ny * this.w + cx)) continue;
                        step = SQRT2;
                    }
                    // walking the reverse field's edges backwards: the real step is ni -> cur
                    if (reverse ? !this.oneWayAllows(ni, cur) : !this.oneWayAllows(cur, ni)) continue;
                    const nd = d + step * this.cost(reverse ? cur : ni);
                    if (nd < dist[ni]) {
                        dist[ni] = nd;
                        push(ni, nd);
                    }
                }
            }
        }
        this.fields.set(key, { version: this.version, dist });
        return dist;
    }
}

/** the underground navigation of a map's games, one per kind of ground grid (NavOptions.sealedDoors) */
const navs = new WeakMap<MapData, PerGame<UndergroundNav>>();
const sealedNavs = new WeakMap<MapData, PerGame<UndergroundNav>>();

/** Every underground grid and stair portal of a map. */
export class UndergroundNav {
    readonly regions: UndergroundGrid[] = [];
    readonly portals: StairPortal[] = [];
    private budgetTime = Number.NaN;
    private budgetLeft = 0;

    /**
     * The underground navigation going with a ground grid (one per game, NavGrid.forMap), of the same kind: learning
     * sealed doors with a ground grid that does (the puzzle bots', NavOptions.sealedDoors), else not. A later game's is
     * a copy of the map's pristine one (stair portals placed on the pristine ground grid).
     */
    static forMap(map: MapData, ground: NavGrid = NavGrid.forMap(map)): UndergroundNav {
        const sealed = ground.learnsSealed;
        const store = sealed ? sealedNavs : navs;
        let per = store.get(map);
        if (!per) {
            per = new PerGame<UndergroundNav>();
            store.set(map, per);
        }
        return per.get(
            ground,
            () => new UndergroundNav(map, ground),
            (pristine) => new UndergroundNav(map, ground, pristine),
            () => new UndergroundNav(map, NavGrid.pristine(map, { sealedDoors: sealed })),
        );
    }

    /** whether its grids learn sealed doors (like the ground grid it was built with) */
    readonly learnsSealed: boolean;

    /** Builds the underground grids and stair portals of `map`, or copies `from` (another game's on the same map). */
    constructor(map: MapData, ground: NavGrid, from?: UndergroundNav) {
        this.learnsSealed = ground.learnsSealed;
        if (from) {
            for (const r of from.regions) this.regions.push(r.copyFor(this));
            for (const p of from.portals) {
                const region = this.regions[p.region.id];
                const q: StairPortal = { ...p, region };
                this.portals.push(q);
                region.portals.push(q);
            }
            return;
        }
        for (const o of map.objects) {
            if ((o.layer & 1) !== 0 || !hasMapObjectDef(o.type)) continue;
            const def = getMapObjectDef(o.type);
            if (def.type !== "structure") continue;
            const layout = layoutOf(o, def, map);
            if (!layout) continue;
            const region = new UndergroundGrid(this, this.regions.length, o, layout, map);
            this.regions.push(region);
            for (const s of layout.stairs) {
                const center = { x: (s.box.min.x + s.box.max.x) / 2, y: (s.box.min.y + s.box.max.y) / 2 };
                const ext = { x: (s.box.max.x - s.box.min.x) / 2, y: (s.box.max.y - s.box.min.y) / 2 };
                const halfLen = Math.abs(s.down.x) * ext.x + Math.abs(s.down.y) * ext.y;
                const halfWidth = Math.abs(s.down.y) * ext.x + Math.abs(s.down.x) * ext.y;
                const topCell = ground.nearestWalkable(
                    v2.sub(center, v2.mul(s.down, halfLen + PORTAL_OUT)),
                    PORTAL_SNAP,
                );
                const botCell = region.nearestWalkable(
                    v2.add(center, v2.mul(s.down, halfLen + PORTAL_OUT)),
                    PORTAL_SNAP,
                );
                const portal: StairPortal = {
                    id: this.portals.length,
                    region,
                    structureId: o.id,
                    box: s.box,
                    center,
                    down: s.down,
                    halfLen,
                    halfWidth,
                    top: topCell >= 0 ? ground.center(topCell) : null,
                    bottom: botCell >= 0 ? region.center(botCell) : null,
                };
                this.portals.push(portal);
                region.portals.push(portal);
            }
        }
    }

    planBudget(now: number): number {
        if (now !== this.budgetTime) {
            this.budgetTime = now;
            this.budgetLeft = UNDERGROUND_PLAN_BUDGET;
        }
        return this.budgetLeft;
    }

    spendPlanBudget(nodes: number): void {
        this.budgetLeft -= nodes;
    }

    /** The underground grid whose floor holds `p` (within `slack` units), or null. */
    regionAt(p: Vec2, slack = 1): UndergroundGrid | null {
        for (const r of this.regions) if (r.onFloor(p, slack)) return r;
        return null;
    }

    /** The portal whose stair box holds `p` (grown by `slack`), or null. */
    portalAt(p: Vec2, slack = 0): StairPortal | null {
        for (const s of this.portals) {
            const b = s.box;
            if (p.x >= b.min.x - slack && p.x <= b.max.x + slack && p.y >= b.min.y - slack && p.y <= b.max.y + slack) {
                return s;
            }
        }
        return null;
    }

    /**
     * Whether underground navigation knows where a player at `pos` on `layer` is: on stairs (layers 2/3) or on an
     * underground floor (layer 1). Then the path follower can lead it anywhere, and planLayerEscape need not.
     */
    handles(pos: Vec2, layer: number): boolean {
        if (layer === 0) return false;
        return this.portalAt(pos, 1.5) !== null || ((layer & 1) === 1 && this.regionAt(pos, 1.5) !== null);
    }

    /** Learns from an obstacle in a snapshot (doors, destroyed obstacles), like NavGrid.observeObstacle. */
    observeObstacle(view: ObstacleView): void {
        if ((view.layer & 1) !== 1) return;
        for (const r of this.regions) if (pointInBounds(view.pos, r.area)) r.observeObstacle(view);
    }

    /**
     * Whether a walk from `from` on `fromLayer` to `to` on `toLayer` (0 ground, 1 underground; stairs count as the floor
     * they lead to) probably exists: grid components and portal reachability, no search.
     */
    canPathTo(ground: NavGrid, from: Vec2, fromLayer: number, to: Vec2, toLayer: number): boolean {
        const fromUnder = (fromLayer & 1) === 1;
        const toUnder = (toLayer & 1) === 1;
        if (!fromUnder && !toUnder) return ground.reachable(from, to);
        const src = fromUnder ? (this.regionAt(from, 1.5) ?? this.portalAt(from, 1.5)?.region ?? null) : null;
        const dst = toUnder ? this.regionAt(to, 1.5) : null;
        if ((fromUnder && !src) || (toUnder && !dst)) return false;
        if (src && dst && src === dst) {
            // one floor: a direct way, or out and back in through two of its stairs
            if (src.reachable(from, to)) return true;
        }
        // leave the source region, cross the ground, enter the destination region
        const exits = src ? src.portals.filter((p) => p.top && Number.isFinite(src.costToPortal(p, from, true))) : null;
        const entries = dst ? dst.portals.filter((p) => p.top && Number.isFinite(dst.costToPortal(p, to))) : null;
        if ((exits && exits.length === 0) || (entries && entries.length === 0)) return false;
        const starts = exits ? exits.map((p) => p.top as Vec2) : [from];
        const ends = entries ? entries.map((p) => p.top as Vec2) : [to];
        return starts.some((a) => ends.some((b) => ground.reachable(a, b)));
    }
}
