// Puzzle sites of a map (BrainFeatures.puzzles): every building of the knowledge table (knowledge/puzzles.ts) found in
// MapData (what every client receives on join: the minimap), with its pieces' obstacle ids and positions, the doors
// the solution moves, the rooms behind them and the containers inside. Built once per map and shared by every bot;
// what the bot then does with a site goes through its snapshots (brain/puzzle.ts presses only pieces it sees).
// Each piece also gets a front: a walkable spot about 1.6 units off the face a player stands at to use it, with no
// wall between, preferring faces from which Use reaches no other piece (Use presses everything in reach: sim
// world/interact.ts interactableObstacles). Where something stands in front of the face (the saloon's bottles on their
// bar counters) the player presses from farther out, still within the piece's reach.
import { type Bounds, type Collider, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import type { MapData, MapObjectSpawn } from "@rebirth/sim";
import {
    colliderBounds,
    colliderCenter,
    distanceToCollider,
    obstacleCollider,
    obstacleDef,
    rotateOri,
    segmentHits,
    transformCollider,
} from "../geom.ts";
import { codeOf, PUZZLES, type PuzzleEntry } from "../knowledge/puzzles.ts";
import type { CellGrid } from "../nav/cellGrid.ts";
import { doorShape } from "../nav/doorGeom.ts";
import type { WorldModel } from "../perception/world.ts";

const PLAYER_RAD = GameConfig.player.radius;
/** A player's centre stands this far from the face when it walks up to a piece (then steps in to press it). */
const STAND_OFF = 1.6;
/** Map objects of a room building are looked for this far from the site building (child rooms, structure cellars). */
const ROOM_SEARCH = 90;
/** Obstacles this close to a piece are checked when choosing its front. */
const NEAR_PIECE = 6;
/**
 * A press point blocked at the face (a counter in front of it) slides out and along the face in these steps, up to this
 * much short of the piece's reach; a slid point keeps the whole body (radius 1) clear, so a body pressed against the
 * counter there is in reach. Each unit off costs SLIDE_COST: one step (2) outweighs any snap of the stand spot (at most
 * about 1.5), so a face the player can step right up to, at its middle, wins whenever there is one.
 */
const SLIDE_STEP = 0.1;
const SLIDE_SHORT = 0.15;
const SLIDE_COST = 20;
/** A spawned child sits exactly where the def puts it (sim mapgen addAdjust); this much float slack. */
const MATCH_EPS = 0.05;
/**
 * Breakable furniture closer than this to a door's closed panel, in front of it, leaves no room for a player (radius 1)
 * to get through: the bookshelf hiding the club's secret door (0.7 units), the screen across the chrys bunker's
 * corridor (2.05) ...
 */
const BLOCKER_GAP = 3;
/** ... when it covers this much of the doorway's width. */
const BLOCKER_COVER = 1;
/** Furniture is low (walls and windows stand 10 high): only it is broken out of the way. */
const FURNITURE_HEIGHT = 1;

export interface SitePiece {
    id: number;
    type: string;
    label: string;
    pos: Vec2;
    layer: number;
    col: Collider;
    /** interactionRad: Use reaches it from a player whose circle comes this close */
    reach: number;
    /** a door piece (the bank's vault door): its closed panel's normal (perception/drawn.ts two probes), else null */
    normal: Vec2 | null;
}

export interface SiteDoor {
    id: number;
    type: string;
    pos: Vec2;
    layer: number;
    /** a door's closed panel normal (perception/drawn.ts: drawn when either side shows), null for a blocker */
    normal: Vec2 | null;
}

export interface SiteRoom {
    bounds: Bounds;
    layer: number;
    center: Vec2;
    /** obstacle ids of the breakable containers inside (deposit boxes, the ring case, crates, gun mounts) */
    containers: number[];
}

export interface PuzzleSite {
    /** index in puzzleSites(map) */
    index: number;
    entry: PuzzleEntry;
    /** map object id of the site building */
    buildingId: number;
    pos: Vec2;
    ori: number;
    layer: number;
    /** the code on this map, [] for panels and doors */
    code: readonly string[];
    pieces: SitePiece[];
    doors: SiteDoor[];
    rooms: SiteRoom[];
    /** collidable map obstacles close to the pieces (front checks) */
    near: Array<{ col: Collider; layer: number }>;
    /**
     * Breakable obstacles standing in front of the doors, outside the rooms (the bookshelf hiding the club's secret
     * door leaves 0.7 units: it must be broken to get in)
     */
    blockers: SiteDoor[];
}

/**
 * Where to stand for a piece: `spot` to walk to, `face` the unit direction from the piece out to it, and `lean` the
 * point the last steps head for (the face's middle; for a press point slid out past something in front of the face,
 * the piece's nearest point to it: the body stops against that something, within the reach).
 */
export interface PieceFront {
    spot: Vec2;
    face: Vec2;
    lean: Vec2;
}

const siteCache = new WeakMap<MapData, PuzzleSite[]>();
const frontCache = new WeakMap<CellGrid, Map<number, PieceFront | null>>();

function sameFloor(a: number, b: number): boolean {
    return (a & 1) === (b & 1);
}

/** The map object of `type` spawned at `p` (a building's child), or undefined. */
function spawnAt(map: MapData, type: string, p: Vec2): MapObjectSpawn | undefined {
    for (const o of map.objects) {
        if (o.type === type && Math.abs(o.pos.x - p.x) < MATCH_EPS && Math.abs(o.pos.y - p.y) < MATCH_EPS) return o;
    }
    return undefined;
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

function inside(p: Vec2, b: Bounds, slack: number): boolean {
    return p.x >= b.min.x - slack && p.x <= b.max.x + slack && p.y >= b.min.y - slack && p.y <= b.max.y + slack;
}

/** A container worth breaking (scavenge.ts breakable, from the def alone). */
function isContainer(type: string): boolean {
    const d = obstacleDef(type);
    return !!d && d.destructible && d.collidable && d.loot.length > 0 && !d.explosion && !d.door && !d.button;
}

function roomOf(map: MapData, site: MapObjectSpawn, spec: PuzzleEntry["rooms"][number]): SiteRoom | null {
    let bounds: Bounds | null = null;
    let layer = site.layer;
    if (spec.box) {
        bounds = colliderBounds(transformCollider({ type: 1, ...spec.box }, site.pos, site.ori, 1));
    } else if (spec.building) {
        let best: MapObjectSpawn | undefined;
        let bestD = ROOM_SEARCH;
        for (const o of map.objects) {
            if (o.type !== spec.building) continue;
            const d = v2.distance(o.pos, site.pos);
            if (d < bestD) {
                bestD = d;
                best = o;
            }
        }
        if (!best || !hasMapObjectDef(best.type)) return null;
        const def = getMapObjectDef(best.type);
        if (def.type !== "building") return null;
        const boxes: Bounds[] = [];
        for (const z of def.ceiling.zoomRegions) {
            if (z.zoomIn) boxes.push(colliderBounds(transformCollider(z.zoomIn, best.pos, best.ori, 1)));
        }
        if (boxes.length === 0) return null;
        bounds = union(boxes);
        layer = best.layer;
    }
    if (!bounds) return null;
    const containers: number[] = [];
    for (const o of map.objects) {
        if (!sameFloor(o.layer, layer) || !inside(o.pos, bounds, 0.3) || !isContainer(o.type)) continue;
        containers.push(o.id);
    }
    const center = { x: (bounds.min.x + bounds.max.x) / 2, y: (bounds.min.y + bounds.max.y) / 2 };
    return { bounds, layer, center, containers };
}

/** The closed panel normal of a door spawn (doorGeom.ts), null for anything else. */
function doorNormal(o: MapObjectSpawn): Vec2 | null {
    const def = obstacleDef(o.type);
    return def?.door ? (doorShape(o.id, def, o.pos, o.ori, o.scale)?.normal ?? null) : null;
}

function resolve(map: MapData, b: MapObjectSpawn, entry: PuzzleEntry, index: number): PuzzleSite | null {
    if (entry.pieces.length === 0) return null;
    const pieces: SitePiece[] = [];
    for (const p of entry.pieces) {
        const at = v2.add(b.pos, rotateOri(p.pos, b.ori));
        const o = spawnAt(map, p.type, at);
        const def = o ? obstacleDef(o.type) : undefined;
        if (!o || !def) return null;
        pieces.push({
            id: o.id,
            type: o.type,
            label: p.label,
            pos: v2.copy(o.pos),
            layer: o.layer,
            col: obstacleCollider(def, o.pos, o.ori, o.scale),
            reach: p.reach,
            normal: doorNormal(o),
        });
    }
    const doors: SiteDoor[] = [];
    for (const d of entry.opens) {
        const o = spawnAt(map, d.type, v2.add(b.pos, rotateOri(d.pos, b.ori)));
        if (o && obstacleDef(o.type)?.door) {
            doors.push({ id: o.id, type: o.type, pos: v2.copy(o.pos), layer: o.layer, normal: doorNormal(o) });
        }
    }
    const rooms: SiteRoom[] = [];
    for (const spec of entry.rooms) {
        const r = roomOf(map, b, spec);
        if (r) rooms.push(r);
    }
    const blockers: SiteDoor[] = [];
    for (const d of doors) {
        const dd = obstacleDef(d.type);
        const ds = map.objects.find((o) => o.id === d.id);
        if (!dd || !ds) continue;
        const dcol = obstacleCollider(dd, ds.pos, ds.ori, ds.scale);
        for (const o of map.objects) {
            if (!sameFloor(o.layer, d.layer) || v2.distance(o.pos, d.pos) > 12) continue;
            if (blockers.some((x) => x.id === o.id)) continue;
            // breakable furniture only (the walls and windows beside a door are no blockers)
            const def = obstacleDef(o.type);
            if (!def?.collidable || !def.destructible || def.height >= FURNITURE_HEIGHT) continue;
            if (def.door || def.button || def.explosion || def.armorPlated || def.stonePlated) continue;
            if (rooms.some((r) => sameFloor(r.layer, o.layer) && inside(o.pos, r.bounds, 0))) continue;
            const ob = colliderBounds(obstacleCollider(def, o.pos, o.ori, o.scale));
            const db = colliderBounds(dcol);
            // in front of the doorway: across most of its width, and too close to its panel for a body to pass
            const alongX = db.max.y - db.min.y > db.max.x - db.min.x;
            const cover = alongX
                ? Math.min(ob.max.y, db.max.y) - Math.max(ob.min.y, db.min.y)
                : Math.min(ob.max.x, db.max.x) - Math.max(ob.min.x, db.min.x);
            const gap = alongX
                ? Math.max(db.min.x - ob.max.x, ob.min.x - db.max.x)
                : Math.max(db.min.y - ob.max.y, ob.min.y - db.max.y);
            if (cover > BLOCKER_COVER && gap < BLOCKER_GAP) {
                blockers.push({ id: o.id, type: o.type, pos: v2.copy(o.pos), layer: o.layer, normal: null });
            }
        }
    }
    const pieceIds = new Set(pieces.map((p) => p.id));
    const near: PuzzleSite["near"] = [];
    for (const o of map.objects) {
        if (pieceIds.has(o.id)) continue;
        if (!pieces.some((p) => sameFloor(p.layer, o.layer) && v2.distance(p.pos, o.pos) < NEAR_PIECE + 15)) continue;
        const def = obstacleDef(o.type);
        if (!def?.collidable) continue;
        const col = obstacleCollider(def, o.pos, o.ori, o.scale);
        if (pieces.some((p) => sameFloor(p.layer, o.layer) && distanceToCollider(p.pos, col) < NEAR_PIECE)) {
            near.push({ col, layer: o.layer });
        }
    }
    return {
        index,
        entry,
        buildingId: b.id,
        pos: v2.copy(b.pos),
        ori: b.ori,
        layer: b.layer,
        code: codeOf(entry, map.mapName),
        pieces,
        doors,
        rooms,
        near,
        blockers,
    };
}

/** Every puzzle site of a map (cached per map; [] on maps without any). */
export function puzzleSites(map: MapData): PuzzleSite[] {
    let sites = siteCache.get(map);
    if (sites) return sites;
    sites = [];
    for (const o of map.objects) {
        const entry = PUZZLES.get(o.type);
        if (!entry) continue;
        const site = resolve(map, o, entry, sites.length);
        if (site) sites.push(site);
    }
    siteCache.set(map, sites);
    return sites;
}

/** The point of a collider nearest `p`. */
function nearestOn(col: Collider, p: Vec2): Vec2 {
    if (col.type === 0) return v2.add(col.pos, v2.mul(v2.normalizeSafe(v2.sub(p, col.pos)), col.rad));
    return { x: Math.min(Math.max(p.x, col.min.x), col.max.x), y: Math.min(Math.max(p.y, col.min.y), col.max.y) };
}

/** Half the size of a collider along the unit axis `n` (boxes: their support; circles: the radius). */
function extentAlong(col: Collider, n: Vec2): number {
    if (col.type === 0) return col.rad;
    return Math.abs(n.x) * (col.max.x - col.min.x) * 0.5 + Math.abs(n.y) * (col.max.y - col.min.y) * 0.5;
}

const AXES: readonly Vec2[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
];

/**
 * The front of a piece on `grid` (the ground grid, or the underground grid of its floor): of its four faces, one with
 * a walkable spot STAND_OFF out and nothing between the spot and the press point (the player's centre against the
 * face, or slid out within the reach when something stands in front of the face: the saloon's bottles stand on bar
 * counters, review of the interactions), preferring a face from which Use reaches no other piece of the site, then the
 * press point closest to the face. Null when no face is open. Cached per grid and piece (static geometry: map walls
 * never move).
 */
export function pieceFront(site: PuzzleSite, piece: SitePiece, grid: CellGrid): PieceFront | null {
    let cache = frontCache.get(grid);
    if (!cache) {
        cache = new Map();
        frontCache.set(grid, cache);
    }
    const hit = cache.get(piece.id);
    if (hit !== undefined) return hit;
    const c = colliderCenter(piece.col);
    let best: PieceFront | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    const walls = site.near.filter((o) => sameFloor(o.layer, piece.layer));
    for (const n of AXES) {
        const ext = extentAlong(piece.col, n);
        const front = faceSpot(site, piece, grid, walls, c, n, ext);
        if (!front) continue;
        const { spot, want, press, off } = front;
        // Use presses every piece in reach: a face that reaches a neighbour is a last resort
        const others = site.pieces.filter(
            (p) =>
                p.id !== piece.id &&
                sameFloor(p.layer, piece.layer) &&
                distanceToCollider(press, p.col) < p.reach + PLAYER_RAD,
        ).length;
        const cost = others * 100 + off * SLIDE_COST + v2.distance(spot, want);
        if (cost < bestCost) {
            bestCost = cost;
            // (a box's face middle; a circle's centre)
            const lean = off === 0 ? v2.add(c, v2.mul(n, piece.col.type === 1 ? ext : 0)) : nearestOn(piece.col, press);
            best = { spot, face: n, lean };
        }
    }
    cache.set(piece.id, best);
    return best;
}

/**
 * The stand spot off one face (unit normal `n`, the piece's extent `ext` along it): the press point nearest the piece
 * with room for the body and a walkable spot STAND_OFF - PLAYER_RAD farther out with no wall between: the body against
 * the face's middle when that is free, else slid out (and along the face) within the reach. `off`: how far the press
 * point is off the face (beyond the body's radius) plus how far it is moved along the face. Null: none.
 */
function faceSpot(
    site: PuzzleSite,
    piece: SitePiece,
    grid: CellGrid,
    walls: PuzzleSite["near"],
    c: Vec2,
    n: Vec2,
    ext: number,
): { spot: Vec2; want: Vec2; press: Vec2; off: number } | null {
    const maxSlide = Math.max(0, piece.reach - SLIDE_SHORT);
    const perp = { x: -n.y, y: n.x };
    const side = extentAlong(piece.col, perp) + Math.sqrt((PLAYER_RAD + maxSlide) ** 2 - PLAYER_RAD ** 2);
    let best: { spot: Vec2; want: Vec2; press: Vec2; off: number } | null = null;
    for (let k = 0; k <= maxSlide + 1e-9; k += SLIDE_STEP) {
        for (let i = 0; SLIDE_STEP * Math.floor((i + 1) / 2) <= side + 1e-9; i++) {
            const t = SLIDE_STEP * Math.ceil(i / 2) * (i % 2 === 0 ? -1 : 1);
            const press = v2.add(v2.add(c, v2.mul(n, ext + PLAYER_RAD + k)), v2.mul(perp, t));
            // within the reach (the server's: a circle of interactionRad + the player's radius touching the collider)
            const slid = Math.max(0, distanceToCollider(press, piece.col) - PLAYER_RAD);
            if (slid > maxSlide + 1e-9) continue;
            const off = slid + Math.abs(t) < 1e-6 ? 0 : slid + Math.abs(t);
            if (best && off >= best.off) continue;
            // room for the body at the press point (against the face a little give; slid out the whole body)
            const room = off === 0 ? PLAYER_RAD - 0.1 : PLAYER_RAD + 0.05;
            if (walls.some((o) => distanceToCollider(press, o.col) < room)) continue;
            const want = v2.add(press, v2.mul(n, STAND_OFF - PLAYER_RAD));
            if (!grid.covers(want)) continue;
            const cell = grid.nearestWalkable(want, 0.8);
            if (cell < 0) continue;
            const spot = grid.center(cell);
            // never from inside the room it opens (a vault door's inner face)
            if (site.rooms.some((r) => sameFloor(r.layer, piece.layer) && inside(spot, r.bounds, -0.5))) continue;
            // a wall between the spot and the press point
            if (walls.some((o) => segmentHits(o.col, spot, press))) continue;
            best = { spot, want, press, off };
            if (off === 0) return best;
        }
    }
    return best;
}

/** The navigation grid of a floor at `p`: the ground grid, or the underground grid there (basements), else null. */
export function floorGrid(model: WorldModel, layer: number, p: Vec2): CellGrid | null {
    if ((layer & 1) === 0) return model.nav;
    return model.underground?.regionAt(p, 2) ?? null;
}

/** Whether a site needs underground navigation (a piece, a door or a room off the ground floor). */
export function siteUnderground(site: PuzzleSite): boolean {
    return (
        site.pieces.some((p) => (p.layer & 1) === 1) ||
        site.rooms.some((r) => (r.layer & 1) === 1) ||
        site.doors.some((d) => (d.layer & 1) === 1)
    );
}
