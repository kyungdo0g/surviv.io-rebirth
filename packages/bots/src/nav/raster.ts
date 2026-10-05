// Scanline rasterization of polygons and boxes onto a grid of square cells: `fn` is called for every cell whose centre
// lies inside the shape (even-odd rule, like the simulation's pointInPolygon).
import type { Bounds, Vec2 } from "@rebirth/core";

export interface RasterGrid {
    readonly w: number;
    readonly h: number;
    readonly cellSize: number;
}

/** Calls `fn(index)` for each cell whose centre is inside `poly`. */
export function rasterPolygon(grid: RasterGrid, poly: readonly Vec2[], fn: (idx: number) => void): void {
    const n = poly.length;
    if (n < 3) return;
    const cs = grid.cellSize;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of poly) {
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    const row0 = Math.max(0, Math.floor(minY / cs));
    const row1 = Math.min(grid.h - 1, Math.ceil(maxY / cs));
    const xs: number[] = [];
    for (let row = row0; row <= row1; row++) {
        const y = (row + 0.5) * cs;
        xs.length = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const a = poly[i];
            const b = poly[j];
            if (a.y > y !== b.y > y) xs.push(((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            // cells whose centre x lies in [xs[k], xs[k + 1])
            const c0 = Math.max(0, Math.ceil(xs[k] / cs - 0.5));
            const c1 = Math.min(grid.w - 1, Math.ceil(xs[k + 1] / cs - 0.5) - 1);
            for (let col = c0; col <= c1; col++) fn(row * grid.w + col);
        }
    }
}

/** Calls `fn(index)` for each cell whose centre is inside the box. */
export function rasterBounds(grid: RasterGrid, b: Bounds, fn: (idx: number) => void): void {
    const cs = grid.cellSize;
    const c0 = Math.max(0, Math.ceil(b.min.x / cs - 0.5));
    const c1 = Math.min(grid.w - 1, Math.floor(b.max.x / cs - 0.5));
    const r0 = Math.max(0, Math.ceil(b.min.y / cs - 0.5));
    const r1 = Math.min(grid.h - 1, Math.floor(b.max.y / cs - 0.5));
    for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) fn(row * grid.w + col);
    }
}
