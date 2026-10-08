// The static 50v50 geography a player reads off the map (bot round 6): the main river that splits the faction map
// between Red and Blue (survev map.ts factionModeSplitOri and riverCreator.ts: the widest river runs from the middle of
// one edge to the middle of the opposite one; docs/research/modes/faction.md "Size, biome, rivers, places") and its
// bridges (the extra-large faction bridges and River Town's, survev map.ts:728-769). Built once per MapData; every
// query is a scan of the river's ~70 spline points, cheap enough for a decision.
import { type Vec2, v2 } from "@rebirth/core";
import { MapDefs } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";

export interface FactionMap {
    /** centre line of the main river, in order */
    river: readonly Vec2[];
    /** coarse side grid (SIDE_CELL u cells, riverSide at each cell centre), built on first use */
    sideGrid?: Float32Array;
    /** half the main river's water width */
    halfWidth: number;
    /** bridge centres over the main river (structure positions) */
    bridges: readonly Vec2[];
    /** map centre */
    centre: Vec2;
    width: number;
    height: number;
}

/** Bridge structures of the faction maps (survev factionDefs bridgeTypes, River Town's centre bridge). */
const BRIDGE_TYPES = new Set(["bridge_xlg_structure_01", "bridge_lg_structure_01", "bridge_md_structure_01"]);
/** A bridge belongs to the main river when its centre is this close to the river line. */
const BRIDGE_ON_RIVER = 12;
/** Cell size of the coarse side grid; a cell this far (plus half a diagonal) from the water answers alone. */
const SIDE_CELL = 8;
const SIDE_SURE = SIDE_CELL;

const cache = new WeakMap<MapData, FactionMap | null>();

/** Whether `map` plays 50v50 (MapDef gameMode.factionMode: faction, faction_potato). */
export function isFactionMap(map: MapData): boolean {
    return Object.hasOwn(MapDefs, map.mapName) && !!MapDefs[map.mapName].gameMode.factionMode;
}

/** The faction geography of `map`, or null when it is no faction map or has no river. */
export function factionMapOf(map: MapData): FactionMap | null {
    const hit = cache.get(map);
    if (hit !== undefined) return hit;
    let out: FactionMap | null = null;
    if (isFactionMap(map) && map.rivers.length) {
        let main = map.rivers[0];
        for (const r of map.rivers) if (r.width > main.width) main = r;
        const river = main.points.map((p) => v2.copy(p));
        const geo: FactionMap = {
            river,
            halfWidth: main.width / 2,
            bridges: [],
            centre: { x: map.width / 2, y: map.height / 2 },
            width: map.width,
            height: map.height,
        };
        const bridges: Vec2[] = [];
        for (const o of map.objects) {
            if (!BRIDGE_TYPES.has(o.type)) continue;
            if (Math.abs(riverSide(geo, o.pos)) < BRIDGE_ON_RIVER) bridges.push(v2.copy(o.pos));
        }
        out = { ...geo, bridges };
    }
    cache.set(map, out);
    return out;
}

/** The nearest point of the river line to `p`, with the unit direction of that segment. */
export function nearestRiverPoint(geo: FactionMap, p: Vec2): { point: Vec2; dir: Vec2 } {
    const pts = geo.river;
    let best = pts[0];
    let bestDir: Vec2 = { x: 1, y: 0 };
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const ab = v2.sub(pts[i + 1], a);
        const len2 = v2.lengthSqr(ab);
        if (len2 < 1e-9) continue;
        const t = Math.max(0, Math.min(1, v2.dot(v2.sub(p, a), ab) / len2));
        const q = v2.add(a, v2.mul(ab, t));
        const d = v2.distanceSqr(p, q);
        if (d < bestD) {
            bestD = d;
            best = q;
            bestDir = v2.div(ab, Math.sqrt(len2));
        }
    }
    return { point: best, dir: bestDir };
}

/**
 * Signed distance of `p` from the river line: positive on the river's left (the side its points turn
 * counter-clockwise to), negative on its right. Its sign tells the two banks apart.
 */
export function riverSide(geo: FactionMap, p: Vec2): number {
    const { point, dir } = nearestRiverPoint(geo, p);
    const off = v2.sub(p, point);
    const sign = v2.det(dir, off) >= 0 ? 1 : -1;
    return sign * v2.length(off);
}

/**
 * riverSide, fast: the coarse grid's value where the point is clearly on one bank (more than a cell from the water),
 * the exact distance near the water. Used by the per-decision crossing test of every faction bot.
 */
export function quickSide(geo: FactionMap, p: Vec2): number {
    const cols = Math.ceil(geo.width / SIDE_CELL);
    const rows = Math.ceil(geo.height / SIDE_CELL);
    if (!geo.sideGrid) {
        const grid = new Float32Array(cols * rows);
        for (let j = 0; j < rows; j++)
            for (let i = 0; i < cols; i++)
                grid[j * cols + i] = riverSide(geo, { x: (i + 0.5) * SIDE_CELL, y: (j + 0.5) * SIDE_CELL });
        geo.sideGrid = grid;
    }
    const i = Math.min(cols - 1, Math.max(0, Math.floor(p.x / SIDE_CELL)));
    const j = Math.min(rows - 1, Math.max(0, Math.floor(p.y / SIDE_CELL)));
    const g = geo.sideGrid[j * cols + i];
    return Math.abs(g) > geo.halfWidth + SIDE_SURE ? g : riverSide(geo, p);
}

/** Whether going straight from `a` to `b` crosses the main river (bank to bank, the water or a bridge between). */
export function crossesRiver(geo: FactionMap, a: Vec2, b: Vec2): boolean {
    const sa = quickSide(geo, a);
    const sb = quickSide(geo, b);
    // a point in the water (or on a bridge) is on neither bank: going from it onto the far bank is a crossing too
    const h = geo.halfWidth;
    if (Math.abs(sb) <= h) return Math.abs(sa) > h || Math.sign(sa) !== Math.sign(sb);
    return Math.sign(sa) !== Math.sign(sb) || Math.abs(sa) <= h;
}

/** The bridge nearest to `p`, or null on a map without one. */
export function nearestBridge(geo: FactionMap, p: Vec2): Vec2 | null {
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const b of geo.bridges) {
        const d = v2.distanceSqr(b, p);
        if (d < bestD) {
            bestD = d;
            best = b;
        }
    }
    return best;
}
