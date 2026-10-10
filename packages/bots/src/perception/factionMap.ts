// The static 50v50 geography a player reads off the map (bot round 6): the main river that splits the faction map
// between Red and Blue (survev map.ts factionModeSplitOri and riverCreator.ts: the widest river runs from the middle of
// one edge to the middle of the opposite one; docs/research/modes/faction.md "Size, biome, rivers, places") and its
// bridges (the extra-large faction bridges and River Town's, survev map.ts:728-769). Built once per MapData; every
// query is a scan of the river's ~70 spline points, cheap enough for a decision.
// The water is as wide as the terrain makes it (sim mapgen/terrain.ts createRiver, survev river.ts): `width` on each
// side of the centre line in the middle, widening to 2.5 times that towards the river's ends, with a riverbank of
// `shoreWidth` (8 u on the faction river) beyond. Until owner report 2026-10-08 the bots took `width / 2` for the half
// width: every "bank" spot they held (10 u past it) lay in the water, which is where the faction's bots stood.
import { type Vec2, v2 } from "@rebirth/core";
import { MapDefs } from "@rebirth/defs";
import { createTerrain, type MapData } from "@rebirth/sim";

export interface FactionMap {
    /** centre line of the main river, in order */
    river: readonly Vec2[];
    /** coarse side grid (SIDE_CELL u cells, riverSide at each cell centre), built on first use */
    sideGrid?: Float32Array;
    /** the main river's water half width in its middle (its MapData width; the water widens towards the ends) */
    halfWidth: number;
    /** water half width at each river point (createRiver waterWidths) */
    water: readonly number[];
    /** water plus riverbank half width at each river point (waterWidths + shoreWidths) */
    bank: readonly number[];
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
/** Cell size of the coarse side grid; a cell this far (plus half a diagonal) from the widest water answers alone. */
const SIDE_CELL = 8;
const SIDE_SURE = SIDE_CELL;
/** The water is at most this many times the middle half width (createRiver: 2.5 at the ends). */
const WIDEST = 2.5;

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
        const { water, bank } = riverWidths(map, main);
        const geo: FactionMap = {
            river,
            halfWidth: main.width,
            water,
            bank,
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

/** Water and riverbank half widths at each point of the river `main` (the terrain's own river polygons). */
function riverWidths(map: MapData, main: MapData["rivers"][number]): { water: number[]; bank: number[] } {
    const n = main.points.length;
    // createTerrain skips rivers of fewer than two points: the main river's terrain index counts only the others
    let k = 0;
    for (const r of map.rivers) {
        if (r === main) break;
        if (r.points.length >= 2) k++;
    }
    const t = createTerrain(map).rivers[k];
    if (!t || t.waterWidths.length !== n) {
        // (no terrain river to read: the survev formula, widening to 2.5 times towards the ends, river.ts)
        const water = main.points.map((_, i) => (1 + (2 * (Math.max(1 - i / n, i / n) - 0.5)) ** 3 * 1.5) * main.width);
        return { water, bank: water.map((w) => w + Math.min(8, Math.max(4, main.width * 0.75))) };
    }
    return { water: [...t.waterWidths], bank: t.waterWidths.map((w, i) => w + t.shoreWidths[i]) };
}

/** The nearest point of the river line to `p`: the unit direction of that segment, the water and bank half widths. */
export function nearestRiverPoint(geo: FactionMap, p: Vec2): { point: Vec2; dir: Vec2; water: number; bank: number } {
    const pts = geo.river;
    let best = pts[0];
    let bestDir: Vec2 = { x: 1, y: 0 };
    let bestD = Number.POSITIVE_INFINITY;
    let bestI = 0;
    let bestT = 0;
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
            bestI = i;
            bestT = t;
        }
    }
    const lerp = (w: readonly number[]) =>
        w.length > bestI + 1 ? w[bestI] + (w[bestI + 1] - w[bestI]) * bestT : geo.halfWidth;
    return { point: best, dir: bestDir, water: lerp(geo.water), bank: lerp(geo.bank) };
}

/** Water half width of the main river at the river point nearest `p`. */
export function waterHalfAt(geo: FactionMap, p: Vec2): number {
    return nearestRiverPoint(geo, p).water;
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
    return Math.abs(g) > geo.halfWidth * WIDEST + SIDE_SURE ? g : riverSide(geo, p);
}

/** Whether `p` lies in the main river's water band (on neither bank: in the water or on a bridge over it). */
export function inRiver(geo: FactionMap, p: Vec2): boolean {
    const s = quickSide(geo, p);
    return Math.abs(s) <= geo.halfWidth * WIDEST && Math.abs(s) <= waterHalfAt(geo, p);
}

/** Whether going straight from `a` to `b` crosses the main river (bank to bank, the water or a bridge between). */
export function crossesRiver(geo: FactionMap, a: Vec2, b: Vec2): boolean {
    const sa = quickSide(geo, a);
    const sb = quickSide(geo, b);
    // a point in the water (or on a bridge) is on neither bank: going from it onto the far bank is a crossing too
    const wa = inRiver(geo, a);
    if (inRiver(geo, b)) return !wa || Math.sign(sa) !== Math.sign(sb);
    return Math.sign(sa) !== Math.sign(sb) || wa;
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
