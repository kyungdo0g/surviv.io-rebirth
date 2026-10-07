// TexturePacker spritesheets of the original client: parsing them out of the bundle and cutting frames.
// The v0.8.82 bundle inlines one JSON-hash sheet per atlas page ({"meta":{"image":"shared-0-100-<hash>.png",...},
// "frames":{...}}); each atlas family ("shared", "main", "desert", ...) exists as a full-resolution "-100" page set
// and a half-resolution "-50" set. Which families a map loads is `assets.atlases` in its map def.
import { createImage, type RgbaImage } from "./png.ts";

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface SheetFrame {
    /** rectangle in the atlas page, in the sprite's own (unrotated) orientation */
    frame: Rect;
    /** stored rotated 90 degrees clockwise: the page region is frame.h wide and frame.w tall */
    rotated: boolean;
    trimmed: boolean;
    /** where the stored (trimmed) pixels sit inside the untrimmed sprite */
    spriteSourceSize: Rect;
    sourceSize: { w: number; h: number };
}

export interface Sheet {
    meta: { image: string; size: { w: number; h: number }; scale: number | string };
    frames: Record<string, SheetFrame>;
}

/** "shared-0-100-829fee3a.png" -> family "shared", page 0, percent 100, hash "829fee3a" */
export interface PageName {
    family: string;
    page: number;
    percent: number;
    hash: string;
}

export function parsePageName(image: string): PageName | undefined {
    const m = /^([a-z]+)-(\d+)-(\d+)-([0-9a-f]+)\.png$/.exec(image);
    return m ? { family: m[1]!, page: Number(m[2]), percent: Number(m[3]), hash: m[4]! } : undefined;
}

export function sheetScale(sheet: Sheet): number {
    return Number(sheet.meta.scale) || 1;
}

/** End index (inclusive) of the balanced JSON object starting at `start`, or -1. */
function matchBrace(src: string, start: number): number {
    let depth = 0;
    let inString = false;
    for (let j = start; j < src.length; j++) {
        const c = src[j];
        if (inString) {
            if (c === "\\") j++;
            else if (c === '"') inString = false;
        } else if (c === '"') inString = true;
        else if (c === "{") depth++;
        else if (c === "}" && --depth === 0) return j;
    }
    return -1;
}

/**
 * Every spritesheet object literal in the bundle. Finds each `"meta":{"image"` key, walks back to the `{` that opens
 * the enclosing object (meta may come before or after frames) and JSON-parses the balanced object.
 */
export function findSheets(src: string): Sheet[] {
    const sheets: Sheet[] = [];
    const seen = new Set<number>();
    for (let i = src.indexOf('"meta":{"image"'); i >= 0; i = src.indexOf('"meta":{"image"', i + 1)) {
        // the enclosing object starts at the nearest unmatched "{" before the key
        let depth = 0;
        let open = -1;
        for (let j = i - 1; j >= 0 && open < 0; j--) {
            const c = src[j];
            if (c === "}") depth++;
            else if (c === "{" && depth-- === 0) open = j;
        }
        if (open < 0 || seen.has(open)) continue;
        const close = matchBrace(src, open);
        if (close < 0) continue;
        let sheet: Sheet;
        try {
            sheet = JSON.parse(src.slice(open, close + 1)) as Sheet;
        } catch {
            continue;
        }
        if (!sheet.frames || typeof sheet.meta?.image !== "string") continue;
        seen.add(open);
        sheets.push(sheet);
    }
    return sheets;
}

/**
 * The pages to use: per family the full-resolution set when the bundle has one, else the largest scale it has
 * (shared-3 only exists at -50).
 */
export function choosePages(sheets: readonly Sheet[]): Sheet[] {
    const best = new Map<string, number>();
    for (const s of sheets) {
        const name = parsePageName(s.meta.image);
        const key = name ? `${name.family}-${name.page}` : s.meta.image;
        best.set(key, Math.max(best.get(key) ?? 0, sheetScale(s)));
    }
    return sheets.filter((s) => {
        const name = parsePageName(s.meta.image);
        return sheetScale(s) === best.get(name ? `${name.family}-${name.page}` : s.meta.image);
    });
}

/** Order in which duplicate frames resolve: the always-loaded families first, then main, then the mode atlases. */
const FAMILY_PRIORITY = ["gradient", "loadout", "shared", "main"];

export function familyRank(image: string): number {
    const family = parsePageName(image)?.family ?? image;
    const i = FAMILY_PRIORITY.indexOf(family);
    return i >= 0 ? i : FAMILY_PRIORITY.length;
}

/**
 * The frame as its own untrimmed image of `sourceSize`: the stored pixels are placed at `spriteSourceSize` and
 * rotated frames are turned back (TexturePacker stores them 90 degrees clockwise).
 */
export function cutFrame(page: RgbaImage, f: SheetFrame): RgbaImage {
    const out = createImage(f.sourceSize.w, f.sourceSize.h);
    const { w, h } = f.frame;
    const ox = f.spriteSourceSize.x;
    const oy = f.spriteSourceSize.y;
    for (let v = 0; v < h; v++) {
        const ty = oy + v;
        if (ty < 0 || ty >= out.height) continue;
        for (let u = 0; u < w; u++) {
            const tx = ox + u;
            if (tx < 0 || tx >= out.width) continue;
            // clockwise storage: sprite (u, v) sits at page (x + h - 1 - v, y + u)
            const px = f.rotated ? f.frame.x + h - 1 - v : f.frame.x + u;
            const py = f.rotated ? f.frame.y + u : f.frame.y + v;
            if (px < 0 || py < 0 || px >= page.width || py >= page.height) continue;
            const s = (py * page.width + px) * 4;
            const d = (ty * out.width + tx) * 4;
            out.data[d] = page.data[s]!;
            out.data[d + 1] = page.data[s + 1]!;
            out.data[d + 2] = page.data[s + 2]!;
            out.data[d + 3] = page.data[s + 3]!;
        }
    }
    return out;
}

const DIFF_BLOCK = 4;

/** Premultiplied RGBA averaged over DIFF_BLOCK x DIFF_BLOCK blocks. */
function blockMeans(img: RgbaImage): Float64Array {
    const bw = Math.ceil(img.width / DIFF_BLOCK);
    const out = new Float64Array(bw * Math.ceil(img.height / DIFF_BLOCK) * 4);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            const o = (Math.floor(y / DIFF_BLOCK) * bw + Math.floor(x / DIFF_BLOCK)) * 4;
            const alpha = img.data[i + 3]! / 255;
            out[o]! += img.data[i]! * alpha;
            out[o + 1]! += img.data[i + 1]! * alpha;
            out[o + 2]! += img.data[i + 2]! * alpha;
            out[o + 3]! += img.data[i + 3]!;
        }
    }
    return out.map((v) => v / (DIFF_BLOCK * DIFF_BLOCK));
}

/**
 * How different two same-sized pictures are, robust to palette dithering: the atlas pages are palette-quantized with
 * dithering per page, so one piece of art cut from two pages differs pixel by pixel but not in 4x4 block averages.
 * Returns the mean and maximum per-block channel difference (0-255). Copies of the same art measure up to about
 * mean 6 / max 45; distinct sprites mostly well above (but near-identical art can be lower).
 */
export function imageDiff(a: RgbaImage, b: RgbaImage): { mean: number; max: number } {
    if (a.width !== b.width || a.height !== b.height) return { mean: 255, max: 255 };
    const pa = blockMeans(a);
    const pb = blockMeans(b);
    let sum = 0;
    let max = 0;
    for (let i = 0; i < pa.length; i += 4) {
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(pa[i + c]! - pb[i + c]!));
        sum += d;
        max = Math.max(max, d);
    }
    const round = (v: number) => Math.round(v * 100) / 100;
    return { mean: round(sum / (pa.length / 4)), max: round(max) };
}

/** Thresholds above which a copy of a frame on another page counts as different art (see imageDiff). */
export const VARIANT_DIFF = { mean: 8, max: 64 } as const;
