// Map ground drawn from the shared terrain polygons, in the original order (survev client/src/map.ts renderTerrain):
// ocean background -> beach -> grass -> order-0 ground patches -> riverbanks -> river water -> sea (the map
// rectangle minus the shore) -> faint grid -> order-1 ground patches. Colors come from MapDefs[mapName].biome.
import { createRng, type Vec2 } from "@rebirth/core";
import { GameConfig, getMapDef, type MapDef } from "@rebirth/defs";
import type { GroundPatchData, MapData, TerrainShape } from "@rebirth/sim";
import { Graphics } from "pixi.js";
import { PIXELS_PER_UNIT } from "../render/camera.ts";

/** ocean drawn around the map rectangle, world units (survev map.ts) */
const OCEAN_BORDER = 120;
const GRID_ALPHA = 0.15;

export type BiomeColors = MapDef["biome"]["colors"];

export interface TerrainDrawOptions {
    /** grid line width in world units; 0 disables the grid */
    gridThickness: number;
    /** minimap rendering: only ground patches flagged useAsMapShape, no ocean border */
    mapRender?: boolean;
}

function flat(points: readonly Vec2[]): number[] {
    const out = new Array<number>(points.length * 2);
    for (let i = 0; i < points.length; i++) {
        out[i * 2] = points[i].x;
        out[i * 2 + 1] = points[i].y;
    }
    return out;
}

/** Rectangle outline with jagged edges (ground patches; same idea as survev generateJaggedAabbPoints). */
function jaggedAabb(patch: GroundPatchData, seed: number): Vec2[] {
    const offset = Math.max(patch.offsetDist, 0.001);
    const rng = createRng(seed);
    const jitter = () => rng.range(-offset, offset);
    const { min, max } = patch;
    const divX = Math.round(((max.x - min.x) * patch.roughness) / offset);
    const divY = Math.round(((max.y - min.y) * patch.roughness) / offset);
    const spanX = (max.x - min.x) / (divX + 1);
    const spanY = (max.y - min.y) / (divY + 1);
    const pts: Vec2[] = [{ x: min.x, y: min.y }];
    for (let i = 1; i <= divX; i++) pts.push({ x: min.x + spanX * i, y: min.y + jitter() });
    pts.push({ x: max.x, y: min.y });
    for (let i = 1; i <= divY; i++) pts.push({ x: max.x + jitter(), y: min.y + spanY * i });
    pts.push({ x: max.x, y: max.y });
    for (let i = 1; i <= divX; i++) pts.push({ x: max.x - spanX * i, y: max.y + jitter() });
    pts.push({ x: min.x, y: max.y });
    for (let i = 1; i <= divY; i++) pts.push({ x: min.x + jitter(), y: max.y - spanY * i });
    return pts;
}

function drawPatches(g: Graphics, map: MapData, order: number, mapRender: boolean): void {
    map.groundPatches.forEach((patch, i) => {
        if (patch.order !== order || (mapRender && !patch.useAsMapShape)) return;
        g.poly(flat(jaggedAabb(patch, map.seed + i))).fill(patch.color);
    });
}

/**
 * Draws the terrain into `g` in world units with +y up (callers flip/scale the graphics, see createTerrainGraphics).
 */
export function drawTerrain(
    g: Graphics,
    map: MapData,
    terrain: TerrainShape,
    colors: BiomeColors,
    opts: TerrainDrawOptions,
): void {
    const { width, height } = map;
    const mapRender = !!opts.mapRender;
    if (!mapRender) {
        g.rect(-OCEAN_BORDER, -OCEAN_BORDER, width + OCEAN_BORDER * 2, height + OCEAN_BORDER * 2).fill(
            colors.background,
        );
    }
    // the original leaves a hole for the grass and clears to the grass color; drawing it is equivalent
    g.poly(flat(terrain.shore)).fill(colors.beach);
    g.poly(flat(terrain.grass)).fill(colors.grass);
    drawPatches(g, map, 0, mapRender);

    for (const river of terrain.rivers) {
        const bank = river.looped ? (colors.lakeRiverbank ?? colors.riverbank) : colors.riverbank;
        g.poly(flat(river.shorePoly)).fill(bank);
    }
    for (const river of terrain.rivers) {
        const water = river.looped ? (colors.lakeWater ?? colors.water) : colors.water;
        g.poly(flat(river.waterPoly)).fill(water);
    }

    // sea: the map rectangle minus the island; also hides river ends that run past the shore
    g.rect(0, 0, width, height).fill(colors.water);
    g.poly(flat(terrain.shore)).cut();

    if (opts.gridThickness > 0) {
        const step = GameConfig.map.gridSize;
        for (let x = 0; x <= width; x += step) g.moveTo(x, 0).lineTo(x, height);
        for (let y = 0; y <= height; y += step) g.moveTo(0, y).lineTo(width, y);
        g.stroke({ width: opts.gridThickness, color: 0x000000, alpha: GRID_ALPHA });
    }
    drawPatches(g, map, 1, mapRender);
}

/** Terrain graphics for the world root (pixel space, +y down). */
export function createTerrainGraphics(map: MapData, terrain: TerrainShape): Graphics {
    const g = new Graphics({ label: "terrain" });
    // grid lines are 2 px wide at zoom 1 (survev map.ts loadMap: 2 / ppu world units)
    drawTerrain(g, map, terrain, getMapDef(map.mapName).biome.colors, { gridThickness: 2 / PIXELS_PER_UNIT });
    g.scale.set(PIXELS_PER_UNIT, -PIXELS_PER_UNIT);
    return g;
}
