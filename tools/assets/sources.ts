// Where each sprite of the client comes from: the original v0.8.82 atlas frames (cut by atlas.ts), survev's SVGs, or
// fandom PNG gap fills, and the size the client scales each one by. Shared by import.ts (the manifest) and
// atlasInventory.ts (the comparison report). Pure functions apart from the file readers at the top.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path, { basename, extname, join } from "node:path";
import { pngSize } from "./png.ts";

export const SURVEV_PUBLIC = ".survev/client/public";
export const ASSET_DEST = "apps/client/public/assets";
/** where import.ts puts the original atlas frames, under the asset root */
export const ORIGINAL_DIR = "img/original";
const ASSET_ROOTS = [ASSET_DEST, SURVEV_PUBLIC];

// survev's own branding, promos and social icons are not original game art
const EXCLUDE =
    /^img\/(survev[-_].*|discord-promo\..*|icon_(kofi|discord|discord_sm|facebook|facebook_reverse|google|instagram|reddit|twitch|twitter|youtube|wiki|app|apple)\..*|template_.*|hof_splash\.png|stats_title\.png|surviv_shirts_.*|yt_icon_rgb\.png)$/;

/** survev's atlas builder: the scale it draws some SVGs at (`scaledSprites`, large ceilings at 0.75 or 0.5) */
const SURVEV_ATLAS_DEFS = ".survev/client/atlas-builder/atlasDefs.ts";

/** "original-0.8.82": a frame of the original client's atlases; "none": the original client names it but ships no image */
export type SpriteSource = "original-0.8.82" | "survev" | "fandom" | "none";
export type Size = [number, number];

export interface ManifestEntry {
    source: SpriteSource;
    /** file under the asset root (absent for "none") */
    path?: string;
    /** the size the definitions' sprite scales are relative to (absent for "none") */
    size?: Size;
    /** survev's vector file of the same sprite, for DOM images: the original HUD loaded img/loot/*.svg, not atlas frames */
    svg?: string;
}

/** The original atlas frame of a sprite (atlas.ts sprites/index.json). */
export interface OriginalFrame {
    file: string;
    /** size at scale 1 (sourceSize / atlas scale) */
    logicalSize: Size;
}

/** Per-sprite decisions over the default (the original frame wherever there is one), from tools/assets/*.json. */
export interface SourceRules {
    /** drawn from survev's file although the original atlases hold a frame (keep-survev.json `sprites`) */
    keepSurvev: ReadonlySet<string>;
    /**
     * kept sprites whose original frame is another canvas than the one the definitions place (cut short or cropped):
     * survev's file is drawn at its own logical size, not scaled to the frame's (keep-survev.json `ownCanvas`)
     */
    ownCanvas: ReadonlySet<string>;
    /** original frames whose survev SVG is different art: the DOM gets no `svg` alternative (survev-redrawn.json) */
    redrawn: ReadonlySet<string>;
}

/** survev directories of sprites only ever drawn in the world, never as DOM images (no `svg` alternative needed) */
const WORLD_ONLY = /^img\/(map|particles|proj|guns)\//;

/** proportions within 3% count as the same picture stored at another size */
export const ASPECT_TOLERANCE = 0.03;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

/**
 * `file` relative to `dir` with "/" separators on every OS: the manifest, the URLs and every pattern here use "/",
 * while path.relative answers "img\\map\\..." on Windows (`impl` is node:path; tests pass path.win32).
 */
export function posixRelative(dir: string, file: string, impl: path.PlatformPath = path): string {
    return impl.relative(dir, file).split(impl.sep).join("/");
}

/** survev's art and audio files (paths relative to its public directory), without its own branding. */
export function survevFiles(): string[] {
    return [...walk(join(SURVEV_PUBLIC, "img")), ...walk(join(SURVEV_PUBLIC, "audio"))]
        .map((p) => posixRelative(SURVEV_PUBLIC, p))
        .filter((p) => !EXCLUDE.test(p));
}

/** Sprite id ("<basename>.img") -> survev image file; an SVG wins a name clash with a PNG. */
export function survevSprites(files: readonly string[]): { sprites: Map<string, string>; clashes: string[] } {
    const sprites = new Map<string, string>();
    const clashes: string[] = [];
    for (const f of files.filter((p) => p.startsWith("img/") && /\.(svg|png)$/.test(p)).sort()) {
        const id = `${basename(f, extname(f))}.img`;
        const prev = sprites.get(id);
        if (prev?.endsWith(".svg")) {
            clashes.push(`${id}: ${prev} / ${f}`);
            continue;
        }
        sprites.set(id, f);
    }
    return { sprites, clashes };
}

export function collectSpriteRefs(value: unknown, out: Set<string>): void {
    if (typeof value === "string") {
        if (value.endsWith(".img")) out.add(value);
    } else if (Array.isArray(value)) {
        for (const v of value) collectSpriteRefs(v, out);
    } else if (value && typeof value === "object") {
        for (const v of Object.values(value)) collectSpriteRefs(v, out);
    }
}

/** Number from an SVG length ("144", "144px", "38.1pt"); undefined for relative units. */
function svgLength(v: string | undefined): number | undefined {
    const m = v && /^\s*([\d.]+)\s*(px|pt)?\s*$/.exec(v);
    if (!m) return undefined;
    return Number(m[1]) * (m[2] === "pt" ? 4 / 3 : 1);
}

/** Nominal size of an image file under the asset roots: the root <svg> width/height (else its viewBox), or the PNG size. */
export function nominalSize(file: string): Size | undefined {
    const path = ASSET_ROOTS.map((r) => join(r, file)).find((p) => existsSync(p));
    if (!path) return undefined;
    const buf = readFileSync(path);
    if (file.endsWith(".png")) {
        const { width, height } = pngSize(buf);
        return [width, height];
    }
    const tag = /<svg\b[^>]*>/.exec(buf.toString("utf8"))?.[0];
    if (!tag) return undefined;
    const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`).exec(tag)?.[1];
    const view = attr("viewBox")
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
    const w = svgLength(attr("width")) ?? view?.[2];
    const h = svgLength(attr("height")) ?? view?.[3];
    return w !== undefined && h !== undefined ? [Math.round(w * 100) / 100, Math.round(h * 100) / 100] : undefined;
}

/**
 * survev's atlas scale per file (paths relative to its public directory): survev's atlas builder draws the files of
 * `scaledSprites` at that scale and its frames keep the scaled size, so survev's logical size of such a sprite is its
 * file's size x the scale (1 for every other file). Empty when the survev clone lacks the file.
 */
export function survevAtlasScales(): Map<string, number> {
    const out = new Map<string, number>();
    if (!existsSync(SURVEV_ATLAS_DEFS)) return out;
    const text = readFileSync(SURVEV_ATLAS_DEFS, "utf8");
    const start = text.indexOf("scaledSprites");
    if (start < 0) return out;
    const block = text.slice(start, text.indexOf("};", start));
    for (const m of block.matchAll(/["']([^"']+\.(?:svg|png))["']\s*:\s*([\d.]+)/g))
        out.set(`img/${m[1]}`, Number(m[2]));
    return out;
}

/**
 * The size the definitions' sprite scales are relative to. The original client sizes a texture by its atlas frame
 * (sourceSize / atlas scale: the "-50" pages are just half resolution of the same logical size), and it stored some
 * images shrunk (large ceilings at 0.75 or 0.5), so the original frame's logical size is the reference whenever we
 * have one. A vector of ours keeps its own size when its proportions differ from the original frame (different art,
 * e.g. a re-cropped canvas); a raster gap fill always takes the original size.
 */
export function scaleSize(own: Size, original: Size | undefined, isVector: boolean): Size {
    if (!original) return [Math.round(own[0]), Math.round(own[1])];
    if (!isVector) return [original[0], original[1]];
    const fx = original[0] / own[0];
    const fy = original[1] / own[1];
    return Math.abs(fx - fy) <= ASPECT_TOLERANCE * Math.max(fx, fy)
        ? [original[0], original[1]]
        : [Math.round(own[0]), Math.round(own[1])];
}

/** Manifest path of an original frame: atlas.ts names it "<id stem>[@<scale>x].png". */
export function originalPath(frame: OriginalFrame): string {
    return `${ORIGINAL_DIR}/${frame.file}`;
}

/**
 * Picks every sprite's source: the original atlas frame unless `rules.keepSurvev` names the id (relaunch atlas defects,
 * misplaced crops; tools/assets/keep-survev.json), else survev's file. `survev` maps ids to their file and logical size
 * (survevAtlasScales applied). An original frame gets survev's SVG as its DOM image unless `rules.redrawn` names it.
 */
export function chooseSprites(
    survev: ReadonlyMap<string, { file: string; size: Size | undefined }>,
    originals: Readonly<Record<string, OriginalFrame>>,
    rules: SourceRules,
): Record<string, ManifestEntry> {
    const out: Record<string, ManifestEntry> = {};
    for (const id of new Set([...survev.keys(), ...Object.keys(originals)])) {
        const ours = survev.get(id);
        const frame = originals[id];
        if (frame && !(ours && rules.keepSurvev.has(id))) {
            const domSvg =
                ours?.file.endsWith(".svg") && !WORLD_ONLY.test(ours.file) && !rules.redrawn.has(id)
                    ? ours.file
                    : undefined;
            out[id] = {
                source: "original-0.8.82",
                path: originalPath(frame),
                size: [frame.logicalSize[0], frame.logicalSize[1]],
                ...(domSvg ? { svg: domSvg } : {}),
            };
        } else if (ours) {
            const isVector = ours.file.endsWith(".svg");
            const size = ours.size ?? frame?.logicalSize;
            // a frame on another canvas is no reference for the size: ours is drawn at its own
            const reference = rules.ownCanvas.has(id) ? undefined : frame?.logicalSize;
            out[id] = {
                source: "survev",
                path: ours.file,
                ...(size ? { size: scaleSize(size, reference, isVector) } : {}),
            };
        }
    }
    return out;
}

/** The manifest as JSON with one sprite per line, sorted by id. */
export function formatManifest(entries: Readonly<Record<string, ManifestEntry>>): string {
    const ids = Object.keys(entries).sort();
    const lines = ids.map((id) => {
        const e = entries[id]!;
        const ordered = { path: e.path, source: e.source, size: e.size, svg: e.svg };
        return ` ${JSON.stringify(id)}: ${JSON.stringify(ordered)}`;
    });
    return `{\n${lines.join(",\n")}\n}\n`;
}
