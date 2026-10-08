// Flat vector loot icons in the original loot icons' style (survev img/loot/loot-weapon-*.svg: white fill, #323232
// outline about 3 px wide, dark detail shapes, the gun drawn diagonally with its muzzle up-right), for the rebirth's own
// art of guns that have no other icon (rebirthArt/lootIcons.ts). An icon is a list of shapes drawn back to front in a
// local frame (muzzle towards +x, y down, any unit); `placeIcon` turns and fits it into the 128 x 128 loot frame, and
// the placed shapes are written as an SVG (committed, served to the client) and rasterized to RGBA pixels (png.ts) by
// the asset installer, so both come from the same geometry and no image library or SVG renderer is needed.
import { createImage, type RgbaImage } from "./png.ts";

export type Point = readonly [number, number];

/** A filled polygon (closed path), with an optional outline centred on its edge (SVG stroke). */
export interface PolyShape {
    kind: "poly";
    points: readonly Point[];
    fill: string;
    stroke?: string;
    width?: number;
}

/** A filled circle, with an optional outline. */
export interface CircleShape {
    kind: "circle";
    center: Point;
    r: number;
    fill: string;
    stroke?: string;
    width?: number;
}

export type Shape = PolyShape | CircleShape;

/** The original icons' colours: white body, dark grey outline and details, mid grey shading. */
export const ICON_WHITE = "#ffffff";
export const ICON_INK = "#323232";
export const ICON_GREY = "#7e7e7e";
/** outline width in icon pixels (survev's loot icons: 3 to 3.2) */
export const ICON_STROKE = 3.2;
export const ICON_SIZE = 128;

/** A white part with the dark outline. */
export function part(points: readonly Point[], fill = ICON_WHITE): PolyShape {
    return { kind: "poly", points, fill, stroke: ICON_INK, width: ICON_STROKE };
}

/** A dark detail (no outline). */
export function detail(points: readonly Point[], fill = ICON_INK): PolyShape {
    return { kind: "poly", points, fill };
}

/** The corners of the box (x0, y0)-(x1, y1). */
export function box(x0: number, y0: number, x1: number, y1: number): Point[] {
    return [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
    ];
}

/** A white disc with the dark outline. */
export function disc(cx: number, cy: number, r: number, fill = ICON_WHITE): CircleShape {
    return { kind: "circle", center: [cx, cy], r, fill, stroke: ICON_INK, width: ICON_STROKE };
}

export interface PlaceOptions {
    /** degrees the muzzle points above the horizontal (the original icons: 45) */
    angle?: number;
    /** the turned drawing's larger side, in pixels */
    fit?: number;
    size?: number;
}

/** Turns the local-frame shapes by `angle` (muzzle up-right) and fits their bounds, centred, into the icon frame. */
export function placeIcon(shapes: readonly Shape[], options: PlaceOptions = {}): Shape[] {
    const { angle = 45, fit = 116, size = ICON_SIZE } = options;
    const a = (-angle * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const turn = ([x, y]: Point): Point => [x * c - y * s, x * s + y * c];
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    const grow = (p: Point, r = 0) => {
        x0 = Math.min(x0, p[0] - r);
        y0 = Math.min(y0, p[1] - r);
        x1 = Math.max(x1, p[0] + r);
        y1 = Math.max(y1, p[1] + r);
    };
    for (const sh of shapes) {
        if (sh.kind === "poly") for (const p of sh.points) grow(turn(p));
        else grow(turn(sh.center), sh.r);
    }
    const k = fit / Math.max(x1 - x0, y1 - y0);
    const ox = size / 2 - ((x0 + x1) / 2) * k;
    const oy = size / 2 - ((y0 + y1) / 2) * k;
    const place = (p: Point): Point => {
        const [tx, ty] = turn(p);
        return [tx * k + ox, ty * k + oy];
    };
    return shapes.map((sh) =>
        sh.kind === "poly" ? { ...sh, points: sh.points.map(place) } : { ...sh, center: place(sh.center), r: sh.r * k },
    );
}

const n2 = (v: number) => Number(v.toFixed(2));

function strokeAttrs(sh: Shape): string {
    return sh.stroke ? ` stroke="${sh.stroke}" stroke-width="${n2(sh.width ?? 1)}" stroke-linejoin="round"` : "";
}

/** The placed shapes as an SVG document (`comment` goes in an XML comment after the root tag). */
export function iconSvg(shapes: readonly Shape[], comment: string, size = ICON_SIZE): string {
    const body = shapes.map((sh) => {
        if (sh.kind === "circle") {
            return `  <circle cx="${n2(sh.center[0])}" cy="${n2(sh.center[1])}" r="${n2(sh.r)}" fill="${sh.fill}"${strokeAttrs(sh)}/>`;
        }
        const d = sh.points.map(([x, y], i) => `${i ? "L" : "M"}${n2(x)} ${n2(y)}`).join("");
        return `  <path d="${d}Z" fill="${sh.fill}"${strokeAttrs(sh)}/>`;
    });
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
        `  <!-- ${comment} -->`,
        ...body,
        "</svg>",
        "",
    ].join("\n");
}

function parseColor(hex: string): [number, number, number] {
    const v = Number.parseInt(hex.replace("#", ""), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Distance from (px, py) to the segment a-b. */
function segmentDistance(px: number, py: number, a: Point, b: Point): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2)) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** Signed distance to a shape's edge: negative inside (non-zero winding for polygons). */
function signedDistance(sh: Shape, px: number, py: number): number {
    if (sh.kind === "circle") return Math.hypot(px - sh.center[0], py - sh.center[1]) - sh.r;
    let dist = Number.POSITIVE_INFINITY;
    let winding = 0;
    const pts = sh.points;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        dist = Math.min(dist, segmentDistance(px, py, a, b));
        if (a[1] <= py) {
            if (b[1] > py && (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]) > 0) winding++;
        } else if (b[1] <= py && (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]) < 0) {
            winding--;
        }
    }
    return winding !== 0 ? -dist : dist;
}

/** Bounds of a shape grown by half its outline. */
function shapeBounds(sh: Shape): [number, number, number, number] {
    const half = sh.stroke ? (sh.width ?? 1) / 2 : 0;
    if (sh.kind === "circle") {
        const r = sh.r + half;
        return [sh.center[0] - r, sh.center[1] - r, sh.center[0] + r, sh.center[1] + r];
    }
    const xs = sh.points.map((p) => p[0]);
    const ys = sh.points.map((p) => p[1]);
    return [Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) + half, Math.max(...ys) + half];
}

/**
 * The placed shapes drawn into `size` x `size` straight-alpha RGBA, back to front, with `samples` x `samples`
 * sub-samples per pixel: each sub-sample takes the colour of the topmost shape covering it (its outline within half
 * the outline width of its edge, else its fill inside), as an SVG renderer paints opaque shapes.
 */
export function rasterizeIcon(shapes: readonly Shape[], size = ICON_SIZE, samples = 4): RgbaImage {
    const img = createImage(size, size);
    const prepared = shapes.map((sh) => ({
        sh,
        bounds: shapeBounds(sh),
        fill: parseColor(sh.fill),
        stroke: sh.stroke ? parseColor(sh.stroke) : null,
        half: sh.stroke ? (sh.width ?? 1) / 2 : 0,
    }));
    const n = samples * samples;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            let covered = 0;
            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const px = x + (sx + 0.5) / samples;
                    const py = y + (sy + 0.5) / samples;
                    let color: [number, number, number] | null = null;
                    for (const p of prepared) {
                        const [bx0, by0, bx1, by1] = p.bounds;
                        if (px < bx0 || px > bx1 || py < by0 || py > by1) continue;
                        const d = signedDistance(p.sh, px, py);
                        if (p.stroke && Math.abs(d) <= p.half) color = p.stroke;
                        else if (d < 0) color = p.fill;
                    }
                    if (!color) continue;
                    covered++;
                    r += color[0];
                    g += color[1];
                    b += color[2];
                }
            }
            if (!covered) continue;
            const i = (y * size + x) * 4;
            img.data[i] = Math.round(r / covered);
            img.data[i + 1] = Math.round(g / covered);
            img.data[i + 2] = Math.round(b / covered);
            img.data[i + 3] = Math.round((covered / n) * 255);
        }
    }
    return img;
}
