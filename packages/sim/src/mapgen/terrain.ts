// Terrain polygons (island shore, grass, rivers) derived deterministically from MapData.
// Client and simulation both call this, so it must only depend on MapData.
// Behaviour follows survev shared/utils/terrainGen.ts and shared/utils/river.ts.
import { type Bounds, createRng, math, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { clampToBounds, pointInPolygon, polygonBounds, rayPolygonIntersect } from "../geom/polygon.ts";
import { Spline } from "../geom/spline.ts";
import type { MapData, RiverData, TerrainShape } from "../view.ts";

/** Subdivisions along one edge of the shore (survev terrainGen.ts). */
const SHORE_DIVISIONS = 64;

/** A river (or lake when `looped`) with its polygons and the spline used to query it. */
export interface River {
    waterWidth: number;
    shoreWidth: number;
    looped: boolean;
    spline: Spline;
    /** average of the spline points (the island centre of a lake) */
    center: Vec2;
    waterPoly: Vec2[];
    shorePoly: Vec2[];
    /** water half width at each spline point (rivers widen near their ends) */
    waterWidths: number[];
    shoreWidths: number[];
    /** bounds of the shore polygon */
    aabb: Bounds;
}

export interface Terrain {
    width: number;
    height: number;
    shore: Vec2[];
    grass: Vec2[];
    rivers: River[];
    shoreBounds: Bounds;
    grassBounds: Bounds;
}

export type TerrainInput = Pick<MapData, "width" | "height" | "shoreInset" | "grassInset" | "rivers" | "seed">;

/** Island outline: a rectangle with jagged edges, counter-clockwise from the lower left corner. */
function jaggedAabbPoints(min: Vec2, max: Vec2, divisions: number, variation: number, rng: Rng): Vec2[] {
    const spanX = (max.x - min.x) / (divisions + 1);
    const spanY = (max.y - min.y) / (divisions + 1);
    const jitter = () => rng.range(-variation, variation);
    const points: Vec2[] = [];
    points.push({ x: min.x, y: min.y });
    for (let i = 1; i <= divisions; i++) points.push({ x: min.x + spanX * i, y: min.y + jitter() });
    points.push({ x: max.x, y: min.y });
    for (let i = 1; i <= divisions; i++) points.push({ x: max.x + jitter(), y: min.y + spanY * i });
    points.push({ x: max.x, y: max.y });
    for (let i = 1; i <= divisions; i++) points.push({ x: max.x - spanX * i, y: max.y + jitter() });
    points.push({ x: min.x, y: max.y });
    for (let i = 1; i <= divisions; i++) points.push({ x: min.x + jitter(), y: max.y - spanY * i });
    return points;
}

/** Shortens `dir` so that `pt + dir` stays inside `poly` (used where a river ends inside another one). */
function clipRayToPoly(pt: Vec2, dir: Vec2, poly: Vec2[]): Vec2 {
    if (!pointInPolygon(v2.add(pt, dir), poly)) {
        const t = rayPolygonIntersect(pt, dir, poly);
        if (t !== undefined) return v2.mul(dir, t);
    }
    return dir;
}

/** Builds water and riverbank polygons around a river centre line (survev river.ts). */
export function createRiver(desc: RiverData, otherRivers: readonly River[], mapBounds: Bounds): River {
    const pts = desc.points;
    const spline = new Spline(pts, desc.looped);
    const waterWidth = desc.width;
    // riverbank width (survev river.ts)
    const baseShoreWidth = math.clamp(waterWidth * 0.75, 4, 8);

    let center = { x: 0, y: 0 };
    for (const p of spline.points) center = v2.add(center, p);
    center = v2.div(center, spline.points.length);
    let avgDistToCenter = 0;
    for (const p of spline.points) avgDistToCenter += v2.distance(p, center);
    avgDistToCenter /= spline.points.length;

    const mapCenter = v2.mul(v2.add(mapBounds.min, mapBounds.max), 0.5);
    const waterA: Vec2[] = [];
    const waterB: Vec2[] = [];
    const shoreA: Vec2[] = [];
    const shoreB: Vec2[] = [];
    const waterWidths: number[] = [];
    const shoreWidths: number[] = [];
    const n = pts.length;

    for (let i = 0; i < n; i++) {
        const vert = pts[i];
        let norm = spline.getNormal(i / (n - 1));
        const isEnd = i === 0 || i === n - 1;

        // Endpoints on the map edge get a normal parallel to the edge, so the polygon ends flush with it.
        let nearMapEdge = false;
        if (!desc.looped && isEnd) {
            const e = v2.sub(vert, mapCenter);
            let edgePos: Vec2;
            let edgeNorm: Vec2;
            if (Math.abs(e.x) > Math.abs(e.y)) {
                edgePos = { x: e.x > 0 ? mapBounds.max.x : mapBounds.min.x, y: vert.y };
                edgeNorm = { x: e.x > 0 ? 1 : -1, y: 0 };
            } else {
                edgePos = { x: vert.x, y: e.y > 0 ? mapBounds.max.y : mapBounds.min.y };
                edgeNorm = { x: 0, y: e.y > 0 ? 1 : -1 };
            }
            if (v2.distanceSqr(edgePos, vert) < 1) {
                let perpNorm = v2.perp(edgeNorm);
                if (v2.dot(norm, perpNorm) < 0) perpNorm = v2.neg(perpNorm);
                norm = perpNorm;
                nearMapEdge = true;
            }
        }

        // Rivers widen towards their ends.
        let localWater = waterWidth;
        if (!desc.looped) {
            const end = 2 * (Math.max(1 - i / n, i / n) - 0.5);
            localWater = (1 + end ** 3 * 1.5) * waterWidth;
        }
        waterWidths.push(localWater);

        // Match the bank width of larger nearby rivers; detect ending inside another river.
        let shoreWidth = baseShoreWidth;
        let boundingRiver: River | null = null;
        for (const other of otherRivers) {
            const p = other.spline.getPos(other.spline.getClosestT(vert));
            const len = v2.distance(p, vert);
            if (len < other.waterWidth * 2) shoreWidth = Math.max(shoreWidth, other.shoreWidth);
            if (isEnd && len < 1.5 && !nearMapEdge) boundingRiver = other;
        }
        if (i > 0) shoreWidth = (shoreWidths[i - 1] + shoreWidth) / 2;
        shoreWidths.push(shoreWidth);
        const localShore = shoreWidth + localWater;

        let wa: Vec2;
        let wb: Vec2;
        let sa: Vec2;
        let sb: Vec2;
        if (desc.looped) {
            const dist = v2.distance(vert, center);
            const toVert = dist > 0.0001 ? v2.div(v2.sub(vert, center), dist) : { x: 1, y: 0 };
            // the inner edge of a lake ring shrinks towards the island
            const interiorWater = math.lerp(
                Math.min(localWater / avgDistToCenter, 1) ** 0.5,
                localWater,
                (1 - (avgDistToCenter - localWater) / dist) * dist,
            );
            const interiorShore = math.lerp(
                Math.min(localShore / avgDistToCenter, 1) ** 0.5,
                localShore,
                (1 - (avgDistToCenter - localShore) / dist) * dist,
            );
            wa = v2.add(vert, v2.mul(toVert, localWater));
            wb = v2.add(vert, v2.mul(toVert, -interiorWater));
            sa = v2.add(vert, v2.mul(toVert, localShore));
            sb = v2.add(vert, v2.mul(toVert, -interiorShore));
        } else {
            let rayWa = v2.mul(norm, localWater);
            let rayWb = v2.mul(norm, -localWater);
            let raySa = v2.mul(norm, localShore);
            let raySb = v2.mul(norm, -localShore);
            if (boundingRiver) {
                rayWa = clipRayToPoly(vert, rayWa, boundingRiver.waterPoly);
                rayWb = clipRayToPoly(vert, rayWb, boundingRiver.waterPoly);
                raySa = clipRayToPoly(vert, raySa, boundingRiver.shorePoly);
                raySb = clipRayToPoly(vert, raySb, boundingRiver.shorePoly);
            }
            wa = v2.add(vert, rayWa);
            wb = v2.add(vert, rayWb);
            sa = v2.add(vert, raySa);
            sb = v2.add(vert, raySb);
        }
        waterA.push(clampToBounds(wa, mapBounds));
        waterB.push(clampToBounds(wb, mapBounds));
        shoreA.push(clampToBounds(sa, mapBounds));
        shoreB.push(clampToBounds(sb, mapBounds));
    }

    const waterPoly = waterA.concat(waterB.reverse());
    const shorePoly = shoreA.concat(shoreB.reverse());
    return {
        waterWidth,
        shoreWidth: baseShoreWidth,
        looped: desc.looped,
        spline,
        center,
        waterPoly,
        shorePoly,
        waterWidths,
        shoreWidths,
        aabb: polygonBounds(shorePoly),
    };
}

/** Water half width of a river at spline parameter `t` (survev River.getWaterWidth). */
export function riverWaterWidthAt(river: River, t: number): number {
    const count = river.spline.points.length;
    const idx = math.clamp(Math.floor(t * count), 0, count - 1);
    return river.waterWidths[idx];
}

/** Full terrain (with river splines) for simulation and map generation. */
export function createTerrain(map: TerrainInput): Terrain {
    const rng = createRng(map.seed);
    const shoreMin = { x: map.shoreInset, y: map.shoreInset };
    const shoreMax = { x: map.width - map.shoreInset, y: map.height - map.shoreInset };
    const shore = jaggedAabbPoints(shoreMin, shoreMax, SHORE_DIVISIONS, GameConfig.map.shoreVariation, rng);

    // The grass outline insets every shore point towards the map centre; the beach lies between them.
    const center = { x: map.width * 0.5, y: map.height * 0.5 };
    const grassVariation = GameConfig.map.grassVariation;
    const grass = shore.map((pos) => {
        const toCenter = v2.normalize(v2.sub(center, pos));
        const inset = map.grassInset + rng.range(-grassVariation, grassVariation);
        return v2.add(pos, v2.mul(toCenter, inset));
    });

    const mapBounds = { min: { x: 0, y: 0 }, max: { x: map.width, y: map.height } };
    const rivers: River[] = [];
    for (const desc of map.rivers) {
        if (desc.points.length < 2) continue;
        rivers.push(createRiver(desc, rivers, mapBounds));
    }
    return {
        width: map.width,
        height: map.height,
        shore,
        grass,
        rivers,
        shoreBounds: polygonBounds(shore),
        grassBounds: polygonBounds(grass),
    };
}

/** Plain terrain polygons for rendering (the client and server share this function). */
export function terrainToShape(terrain: Terrain): TerrainShape {
    return {
        shore: terrain.shore.map((p) => v2.copy(p)),
        grass: terrain.grass.map((p) => v2.copy(p)),
        rivers: terrain.rivers.map((r) => ({
            width: r.waterWidth,
            looped: r.looped,
            center: r.spline.points.map((p) => v2.copy(p)),
            waterPoly: r.waterPoly.map((p) => v2.copy(p)),
            shorePoly: r.shorePoly.map((p) => v2.copy(p)),
        })),
    };
}

/**
 * Terrain polygons derived deterministically from MapData: jagged shore, grass inset and river polygons.
 * River `center` lines are the MapData river points, which map generation already samples from a
 * Catmull-Rom spline; the polygon normals come from the spline through them.
 */
export function buildTerrain(map: MapData): TerrainShape {
    return terrainToShape(createTerrain(map));
}
