// River centre lines and lakes for MapData.rivers, deterministic per seed.
// Behaviour follows survev server/src/game/riverCreator.ts and map.ts (generateRiverMasks / generateTerrain).
import { type Bounds, type Collider, collider, math, type Rng, type Vec2, v2 } from "@rebirth/core";
import type { MapDef } from "@rebirth/defs";
import { clampToBounds, intersectSegmentSegment, pointInBounds } from "../geom/polygon.ts";
import { catmullRomPoint } from "../geom/spline.ts";
import { overlaps } from "../geom/transform.ts";
import type { RiverData } from "../view.ts";
import { randomPointInCircle, randomPointOnMapEdge, trySpawn } from "./random.ts";

type RiverConfig = MapDef["mapGen"]["map"]["rivers"];
type LakeDef = RiverConfig["lakes"][number];

/** Default number of placement attempts (survev map.ts trySpawn). */
export const SPAWN_ATTEMPTS = 500;
/** survev riverCreator.ts divides the midpoint offset by 7 for the default smoothness of 0.45. */
const OFFSET_PER_SMOOTHNESS = 1 / (7 * 0.45);

export interface RiverGenContext {
    width: number;
    height: number;
    shoreInset: number;
    grassInset: number;
    rng: Rng;
    /** circles and boxes rivers must avoid; lakes and place spawns add to it */
    masks: Collider[];
    factionMode: boolean;
    /** 0: horizontal split (river runs left-right), 1: vertical split */
    factionSplitOri: 0 | 1;
    warnings: string[];
}

export interface RiverDesc extends RiverData {
    noRiverObjs: boolean;
    /** lake centre object ("" for none) */
    centerObj: string;
    /** lake centre (spawn point of the centre object) */
    lakeCenter?: Vec2;
}

function mapBounds(ctx: RiverGenContext): Bounds {
    return { min: { x: 0, y: 0 }, max: { x: ctx.width, y: ctx.height } };
}

function manhattan(a: Vec2, b: Vec2): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** River masks from the map def: fixed circles, or random circles (optionally on the map edge). */
export function generateRiverMasks(ctx: RiverGenContext, masks: RiverConfig["masks"]): void {
    for (const mask of masks) {
        if (mask.pos) {
            ctx.masks.push(collider.createCircle({ x: mask.pos.x * ctx.width, y: mask.pos.y * ctx.height }, mask.rad));
            continue;
        }
        const min = { x: ctx.shoreInset + mask.rad, y: ctx.shoreInset + mask.rad };
        const max = { x: ctx.width - ctx.shoreInset - mask.rad, y: ctx.height - ctx.shoreInset - mask.rad };
        const ok = trySpawn(SPAWN_ATTEMPTS, () => {
            let pos = { x: ctx.rng.range(min.x, max.x), y: ctx.rng.range(min.y, max.y) };
            if (mask.genOnShore) pos = randomPointOnMapEdge(ctx.rng, ctx.width, ctx.height, mask.rad);
            const circle = collider.createCircle(pos, mask.rad);
            if (ctx.masks.some((m) => overlaps(m, circle))) return false;
            ctx.masks.push(circle);
            return true;
        });
        if (!ok) ctx.warnings.push("failed to place a river mask");
    }
}

function riverStart(ctx: RiverGenContext, faction: boolean): Vec2 {
    if (faction) {
        return ctx.factionSplitOri === 0 ? { x: 0, y: ctx.height / 2 } : { x: ctx.width / 2, y: 0 };
    }
    return randomPointOnMapEdge(ctx.rng, ctx.width, ctx.height);
}

function riverEnd(ctx: RiverGenContext, start: Vec2, faction: boolean): Vec2 {
    if (faction) {
        return ctx.factionSplitOri === 0 ? { x: ctx.width, y: ctx.height / 2 } : { x: ctx.width / 2, y: ctx.height };
    }
    const corners = [
        { x: 0, y: 0 },
        { x: 0, y: ctx.height },
        { x: ctx.width, y: ctx.height },
        { x: ctx.width, y: 0 },
    ];
    const tileSize = ctx.width / 4;
    const startNearCorner = corners.some((c) => manhattan(c, start) < tileSize);
    for (let attempt = 0; attempt < 1000; attempt++) {
        const end = randomPointOnMapEdge(ctx.rng, ctx.width, ctx.height);
        if (manhattan(start, end) <= ctx.width) continue;
        // a river that starts near a corner may not end near one
        if (startNearCorner && corners.some((c) => manhattan(c, end) < tileSize)) continue;
        return end;
    }
    return { x: ctx.width / 2, y: ctx.height };
}

/** Chops the new river at its first crossing with an existing river, creating a junction. */
function joinExistingRivers(points: Vec2[], existing: readonly RiverDesc[]): void {
    for (let r = 1; r < points.length; r++) {
        for (const river of existing) {
            const other = river.points;
            for (let j = 1; j < other.length; j++) {
                const hit = intersectSegmentSegment(points[r - 1], points[r], other[j - 1], other[j]);
                if (hit) {
                    points[r - 1] = hit;
                    points.splice(r);
                    return;
                }
            }
        }
    }
}

/** One river attempt: midpoint-displaced polyline smoothed with Catmull-Rom; [] when rejected. */
function createRiverPoints(
    ctx: RiverGenContext,
    width: number,
    smoothness: number,
    faction: boolean,
    existing: readonly RiverDesc[],
): Vec2[] {
    const bounds = mapBounds(ctx);
    const start = riverStart(ctx, faction);
    const end = riverEnd(ctx, start, faction);
    // midpoints are offset perpendicular to the start-end direction
    const slopeAngle = Math.atan((end.y - start.y) / (end.x - start.x));
    const offsetAngle = slopeAngle + Math.PI / 2;
    const offsetDir = { x: Math.cos(offsetAngle), y: Math.sin(offsetAngle) };
    const offsetScale = smoothness * OFFSET_PER_SMOOTHNESS;

    const points: Vec2[] = [start, end];
    const passes = 4;
    for (let pass = 0; pass < passes; pass++) {
        for (let j = 1; j < points.length; j += 2) {
            const a = points[j - 1];
            const b = points[j];
            let mid: Vec2;
            if (faction && pass === 0) {
                // keeps the faction river close to the map centre line
                mid = v2.add(v2.lerp(0.5, a, b), randomPointInCircle(ctx.rng, 16));
            } else {
                let offset = ctx.rng.next() * v2.distance(a, b) * offsetScale;
                if (ctx.rng.next() < 0.5) offset = -offset;
                mid = v2.add(v2.lerp(0.5, a, b), v2.mul(offsetDir, offset));
            }
            points.splice(j, 0, clampToBounds(mid, bounds));
        }
    }

    // Too many points outside the grass means the river slides along the map edge: discard it.
    let maxOutside = Math.max((ctx.shoreInset + ctx.grassInset) / 9, 3);
    if (faction) maxOutside *= 2;
    const inset = ctx.shoreInset + ctx.grassInset;
    const grassBounds = { min: { x: inset, y: inset }, max: { x: ctx.width - inset, y: ctx.height - inset } };
    let outside = 0;
    for (const p of points) {
        if (!pointInBounds(p, grassBounds) && ++outside > maxOutside) return [];
    }

    joinExistingRivers(points, existing);
    if (points.length < 10) return [];

    const smooth: Vec2[] = new Array(points.length * (faction ? 4 : 2));
    for (let i = 0; i < smooth.length; i++) {
        smooth[i] = clampToBounds(catmullRomPoint(i / (smooth.length - 1), points, false), bounds);
    }
    for (const mask of ctx.masks) {
        for (const p of smooth) {
            if (overlaps(collider.createCircle(p, width * 2), mask)) return [];
        }
    }
    return smooth;
}

/** One lake attempt: a jittered ring smoothed into a closed spline; null when it hits a mask. */
function createLake(ctx: RiverGenContext, lake: LakeDef): (RiverDesc & { bounds: Bounds }) | null {
    const center = v2.add(
        { x: ctx.width * lake.spawnBound.pos.x, y: ctx.height * lake.spawnBound.pos.y },
        randomPointInCircle(ctx.rng, lake.spawnBound.rad),
    );
    const width = (lake.outerRad - lake.innerRad) / 2;
    const len = lake.innerRad + width;
    const ring: Vec2[] = [];
    for (let i = 0; i < 20; i++) {
        const rot = (i / 20) * Math.PI * 2;
        const r = len * ctx.rng.range(0.9, 1.2);
        ring.push({ x: center.x + Math.cos(rot) * r, y: center.y + Math.sin(rot) * r });
    }
    ring.push(v2.copy(ring[0]));
    for (const mask of ctx.masks) {
        for (const p of ring) {
            if (overlaps(collider.createCircle(p, width * 2), mask)) return null;
        }
    }
    const smooth: Vec2[] = [];
    for (let i = 0; i < 33; i++) smooth.push(catmullRomPoint(i / 32, ring, true));
    smooth.push(v2.copy(ring[0]));
    const bounds = {
        min: { x: Math.min(...smooth.map((p) => p.x)), y: Math.min(...smooth.map((p) => p.y)) },
        max: { x: Math.max(...smooth.map((p) => p.x)), y: Math.max(...smooth.map((p) => p.y)) },
    };
    return {
        width,
        looped: true,
        points: smooth,
        noRiverObjs: !!lake.noRiverObjs,
        centerObj: lake.centerObj ?? "",
        lakeCenter: center,
        bounds,
    };
}

/** Lakes first, then rivers with one weighted set of widths (survev map.ts generateTerrain). */
export function generateRivers(ctx: RiverGenContext, config: RiverConfig): RiverDesc[] {
    const descs: RiverDesc[] = [];
    const lakeBounds: Bounds[] = [];

    for (const lakeDef of config.lakes) {
        if (ctx.rng.next() > lakeDef.odds) continue;
        const ok = trySpawn(SPAWN_ATTEMPTS, () => {
            const lake = createLake(ctx, lakeDef);
            if (!lake) return false;
            for (const other of lakeBounds) {
                if (collider.aabbOverlap(lake.bounds, other)) return false;
            }
            if (lakeDef.riverMaskRad) {
                const mask = collider.createCircle(lake.lakeCenter!, lakeDef.riverMaskRad);
                if (ctx.masks.some((m) => overlaps(mask, m))) return false;
                ctx.masks.push(mask);
            }
            lakeBounds.push(lake.bounds);
            const { bounds: _bounds, ...desc } = lake;
            descs.push(desc);
            return true;
        });
        if (!ok) ctx.warnings.push(`failed to place a lake (${lakeDef.centerObj ?? "no centre object"})`);
    }

    if (config.weights.length === 0) return descs;
    const widths = ctx.rng.weighted(config.weights, (w) => w.weight).widths;
    for (let i = 0; i < widths.length; i++) {
        const width = widths[i];
        // in faction mode the first width is the river splitting the two teams
        const faction = ctx.factionMode && i === 0;
        const ok = trySpawn(SPAWN_ATTEMPTS, () => {
            const points = createRiverPoints(ctx, width, config.smoothness, faction, descs);
            if (points.length < 12) return false;
            descs.push({ width, looped: false, points, noRiverObjs: false, centerObj: "" });
            return true;
        });
        if (!ok) ctx.warnings.push(`failed to place a river of width ${width}`);
    }
    return descs;
}

/** Clamp helper shared with map generation. */
export function clampToMap(pos: Vec2, width: number, height: number, rad = 0): Vec2 {
    return { x: math.clamp(pos.x, rad, width - rad), y: math.clamp(pos.y, rad, height - rad) };
}
