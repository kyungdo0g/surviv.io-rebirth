// Path-drawn glyphs for the rebirth buildings' puzzles: digits, roman numerals, Latin capitals, hanja, hangul,
// pictograms, signal flags and rank insignia (glyphFont.ts, glyphPictos.ts), plus the floor plates that carry one under a
// switch and the in-world clues (plaques, posters, chalk, torn pages, fallen signs) that show a code in plain sight.
// SVG paths only, never <text>: the building SVGs are rasterised by the browser and fonts are not guaranteed.
import { REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import { DIGITS, HANGUL, HANJA, LATIN, ROMAN } from "./glyphFont.ts";
import { type GlyphDef, placePath, seeded } from "./glyphPath.ts";
import { PICTOS } from "./glyphPictos.ts";
import { type Frame, f2, px, py } from "./svg.ts";

export const GLYPHS: Readonly<Record<string, GlyphDef>> = {
    ...DIGITS,
    ...ROMAN,
    ...LATIN,
    ...HANJA,
    ...HANGUL,
    ...PICTOS,
};

/** Every glyph name: "0".."9", "roman-1".."roman-10", "A".."Z", the hanja and hangul themselves, pictogram names. */
export const GLYPH_NAMES: readonly string[] = Object.keys(GLYPHS);

/** A blank slot in a glyph row (half a glyph wide). */
export const GLYPH_GAP = " ";

export interface GlyphStyle {
    /** stroke and fill colour (signal flags keep their own field colours) */
    ink?: string;
    /** stroke weight multiplier */
    weight?: number;
    opacity?: number;
    /** degrees clockwise */
    rot?: number;
}

/** The base stroke width as a fraction of the glyph size. */
const STROKE = 0.095;

/** A glyph centred on image pixel (x, y), `size` pixels wide: `<path>` elements only. */
export function glyph(name: string, x: number, y: number, size: number, style: GlyphStyle = {}): string {
    const def = GLYPHS[name];
    if (!def) throw new Error(`unknown glyph ${JSON.stringify(name)}`);
    const ink = style.ink ?? "#23272a";
    const op = style.opacity !== undefined && style.opacity < 1 ? ` opacity="${f2(style.opacity)}"` : "";
    return def
        .map((part) => {
            const d = placePath(part.d, { x, y, size, rot: (style.rot ?? 0) + (part.turn ?? 0) });
            const color = part.color ?? ink;
            if (part.fill) {
                const rule = part.nonzero ? "" : ` fill-rule="evenodd"`;
                return `<path d="${d}" fill="${color}"${rule}${op}/>`;
            }
            const w = f2(size * STROKE * (part.width ?? 1) * (style.weight ?? 1));
            return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op}/>`;
        })
        .join("");
}

/** A glyph centred on world point (x, y), `size` world units wide. */
export function glyphAt(fr: Frame, name: string, x: number, y: number, size: number, style: GlyphStyle = {}): string {
    return glyph(name, px(fr, x), py(fr, y), size * PX, style);
}

/** The glyph names spelling `text` (letters, digits, spaces; anything else must be a glyph name character). */
export function phrase(text: string): string[] {
    return [...text.toUpperCase()].map((c) => {
        if (c === GLYPH_GAP) return GLYPH_GAP;
        if (!GLYPHS[c]) throw new Error(`no glyph for ${JSON.stringify(c)}`);
        return c;
    });
}

/** A row of glyphs centred on image pixel (x, y); a GLYPH_GAP takes half a slot. Returns the paths. */
function row(
    names: readonly string[],
    x: number,
    y: number,
    size: number,
    pitch: number,
    style: (i: number) => GlyphStyle,
) {
    const slots = names.reduce((n, g) => n + (g === GLYPH_GAP ? 0.5 : 1), 0);
    let at = x - (slots * pitch) / 2;
    return names
        .map((g, i) => {
            if (g === GLYPH_GAP) {
                at += pitch / 2;
                return "";
            }
            const out = glyph(g, at + pitch / 2, y, size, style(i));
            at += pitch;
            return out;
        })
        .join("");
}

export const PLATE_MATERIALS = {
    metal: { base: "#8b9297", light: "#b9c0c4", ink: "#262b2f", rim: "#1f2326" },
    stone: { base: "#a29b8e", light: "#c4beb2", ink: "#3a352e", rim: "#3a352e" },
    brass: { base: "#b48e3c", light: "#e1c374", ink: "#47320f", rim: "#2e2210" },
} as const;

export type PlateMaterial = keyof typeof PLATE_MATERIALS;

export interface GlyphPlateOptions {
    material?: PlateMaterial;
    /** plate side in world units (1.6, the colour plates' size) */
    size?: number;
    /** glyph size in world units */
    glyphSize?: number;
    /** degrees clockwise of the glyph on the plate */
    rot?: number;
    /** scuffs over the plate (a seed) */
    worn?: number;
}

/**
 * A neutral floor plate under a code switch at world (x, y), engraved with a glyph: a bevelled square (rivets on metal
 * and brass), the glyph cut in with a light lower edge. Takes the colour plates' place (svg.ts switchPlate).
 */
export function glyphPlate(fr: Frame, x: number, y: number, glyphName: string, opts: GlyphPlateOptions = {}): string {
    const m = PLATE_MATERIALS[opts.material ?? "metal"];
    const side = (opts.size ?? 1.6) * PX;
    const cx = px(fr, x);
    const cy = py(fr, y);
    const h = side / 2;
    const out = [
        `<rect x="${f2(cx - h)}" y="${f2(cy - h)}" width="${f2(side)}" height="${f2(side)}" fill="${m.base}" stroke="${m.rim}" stroke-width="3"/>`,
        `<rect x="${f2(cx - h + 4)}" y="${f2(cy - h + 4)}" width="${f2(side - 8)}" height="${f2(side - 8)}" fill="none" stroke="${m.light}" stroke-width="1.5" opacity="0.8"/>`,
    ];
    if (opts.material !== "stone") {
        for (const [dx, dy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ] as const) {
            out.push(
                `<circle cx="${f2(cx + dx * (h - 6))}" cy="${f2(cy + dy * (h - 6))}" r="2.2" fill="${m.light}" stroke="${m.rim}" stroke-width="1"/>`,
            );
        }
    }
    const gs = (opts.glyphSize ?? 1.1) * PX;
    const rot = opts.rot ?? 0;
    out.push(glyph(glyphName, cx + 1.2, cy + 1.2, gs, { ink: m.light, rot }));
    out.push(glyph(glyphName, cx, cy, gs, { ink: m.ink, rot }));
    if (opts.worn !== undefined) out.push(scratches(seeded(opts.worn), cx, cy, side * 0.8, side * 0.8, 4, m.light));
    return out.join("");
}

export type ClueStyle = "plaque" | "poster" | "chalk" | "scrawl" | "page" | "sign";

export interface ClueOptions {
    style?: ClueStyle;
    /** plaque material */
    material?: PlateMaterial;
    /** glyph size in world units (fits the box by default) */
    glyphSize?: number;
    /** overrides the style's ink */
    ink?: string;
    /** degrees clockwise */
    rot?: number;
    /** a fallen sign: tilted (14 degrees unless `rot`), a drop shadow, a crack across */
    fallen?: boolean;
    /** scratch marks over it */
    scratches?: number;
    /** the fraction of its width, from the right, buried under rubble */
    cover?: number;
    /** a torn corner off a poster or sign (pages are always torn) */
    torn?: boolean;
    /** the seed of the scratches, rubble and torn edges */
    seed?: number;
}

const CLUE_STYLES: Readonly<
    Record<ClueStyle, { fill?: string; edge?: string; edgeW?: number; ink: string; opacity?: number }>
> = {
    plaque: { ink: "" },
    poster: { fill: "#e9e0c8", edge: "#6b5a40", edgeW: 2, ink: "#2b2420" },
    chalk: { fill: "#2e3d34", edge: "#6b4a2a", edgeW: 6, ink: "#e8eee6", opacity: 0.9 },
    scrawl: { ink: "#e6e2d6", opacity: 0.82 },
    page: { fill: "#efe8d6", edge: "#8f8470", edgeW: 1.5, ink: "#45464e" },
    sign: { fill: "#34495e", edge: "#1f2326", edgeW: 3, ink: "#ece6d0" },
};

function scratches(rng: () => number, cx: number, cy: number, w: number, h: number, n: number, color: string): string {
    let d = "";
    for (let i = 0; i < n; i++) {
        const x0 = cx + (rng() - 0.5) * w;
        const y0 = cy + (rng() - 0.5) * h;
        const a = (rng() - 0.5) * 1.2;
        const len = (0.25 + rng() * 0.45) * w;
        // the far end stays on the surface
        const x1 = Math.min(cx + w / 2 - 2, Math.max(cx - w / 2 + 2, x0 + Math.cos(a) * len));
        const y1 = Math.min(cy + h / 2 - 2, Math.max(cy - h / 2 + 2, y0 + Math.sin(a) * len));
        d += `M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y1)}`;
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>`;
}

/** The outline of a torn sheet: straight left and top, ragged right and bottom. */
function tornSheet(rng: () => number, x0: number, y0: number, w: number, h: number): string {
    const pts: Array<[number, number]> = [
        [x0, y0],
        [x0 + w, y0],
    ];
    const steps = Math.max(4, Math.round(h / 7));
    for (let i = 1; i <= steps; i++) pts.push([x0 + w - rng() * 6, y0 + (h * i) / steps]);
    const steps2 = Math.max(4, Math.round(w / 7));
    for (let i = steps2 - 1; i >= 0; i--) pts.push([x0 + (w * i) / steps2, y0 + h - rng() * 6]);
    return `M${pts.map(([a, b]) => `${f2(a)} ${f2(b)}`).join("L")}Z`;
}

/** Rubble over the right `amount` of a w x h box at (x0, y0): a heap of grey stones. */
function rubble(rng: () => number, x0: number, y0: number, w: number, h: number, amount: number): string {
    const left = x0 + w * (1 - amount);
    const out: string[] = [];
    const tones = ["#5d574e", "#6f685d", "#837b6e", "#4c4740"];
    const n = Math.max(6, Math.round((amount * w * h) / 90));
    for (let i = 0; i < n; i++) {
        const r = 4 + rng() * 7;
        const x = left + rng() * (x0 + w - left) + (i % 3 === 0 ? -r * 0.6 : 0);
        const y = y0 - 4 + rng() * (h + 8);
        out.push(
            `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${tones[i % tones.length]}" stroke="#2c2924" stroke-width="1"/>`,
        );
    }
    out.push(
        `<path d="M${f2(left)} ${f2(y0 - 2)}L${f2(x0 + w + 4)} ${f2(y0 - 2)}L${f2(x0 + w + 4)} ${f2(y0 + h + 2)}L${f2(left + 4)} ${f2(y0 + h + 2)}Z" fill="#6f685d" opacity="0.55"/>`,
    );
    return out.join("");
}

/**
 * A clue at world (x, y), `w` x `h` units, showing a row of glyphs (GLYPH_GAP for a space; phrase() spells words):
 * a screwed plaque, a pinned poster, a chalkboard, a bare chalk scrawl, a torn notebook page or a painted sign; tilted,
 * fallen, scratched, torn or half buried so that a code can lie in plain sight.
 */
export function cluePlaque(
    fr: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
    glyphNames: readonly string[],
    opts: ClueOptions = {},
): string {
    const style = opts.style ?? "plaque";
    const look = CLUE_STYLES[style];
    const metal = PLATE_MATERIALS[opts.material ?? "brass"];
    const rng = seeded(opts.seed ?? 1987);
    const cx = px(fr, x);
    const cy = py(fr, y);
    const W = w * PX;
    const H = h * PX;
    const x0 = cx - W / 2;
    const y0 = cy - H / 2;
    const rot = opts.rot ?? (opts.fallen ? 14 : 0);
    const out: string[] = [];
    const box = (dx: number, dy: number, attrs: string) =>
        `<rect x="${f2(x0 + dx)}" y="${f2(y0 + dy)}" width="${f2(W)}" height="${f2(H)}" ${attrs}/>`;
    const cut = opts.torn && style !== "page" ? Math.min(W, H) * 0.45 : 0;
    const shape = (dx: number, dy: number, attrs: string) => {
        if (style === "page")
            return `<path d="${tornSheet(seeded(opts.seed ?? 1987), x0 + dx, y0 + dy, W, H)}" ${attrs}/>`;
        if (cut === 0) return box(dx, dy, attrs);
        // the bottom right corner torn away
        const p = [
            [x0, y0],
            [x0 + W, y0],
            [x0 + W, y0 + H - cut],
            [x0 + W - cut * 0.55, y0 + H - cut * 0.45],
            [x0 + W - cut, y0 + H],
            [x0, y0 + H],
        ];
        return `<path d="M${p.map(([a, b]) => `${f2((a as number) + dx)} ${f2((b as number) + dy)}`).join("L")}Z" ${attrs}/>`;
    };
    if (opts.fallen && style !== "scrawl") out.push(shape(5, 6, `fill="#000" opacity="0.28"`));
    let ink = look.ink;
    if (style === "plaque") {
        out.push(shape(0, 0, `fill="${metal.base}" stroke="${metal.rim}" stroke-width="3"`));
        out.push(
            `<rect x="${f2(x0 + 4)}" y="${f2(y0 + 4)}" width="${f2(W - 8)}" height="${f2(H - 8)}" fill="none" stroke="${metal.light}" stroke-width="1.5" opacity="0.8"/>`,
        );
        for (const [sx, sy] of [
            [x0 + 7, y0 + 7],
            [x0 + W - 7, y0 + 7],
            [x0 + 7, y0 + H - 7],
            [x0 + W - 7, y0 + H - 7],
        ]) {
            out.push(
                `<circle cx="${f2(sx as number)}" cy="${f2(sy as number)}" r="2.4" fill="${metal.light}" stroke="${metal.rim}" stroke-width="1"/>`,
            );
        }
        ink = metal.ink;
    } else if (look.fill) {
        out.push(shape(0, 0, `fill="${look.fill}" stroke="${look.edge}" stroke-width="${look.edgeW}"`));
        if (style === "page") {
            let d = "";
            for (let ly = y0 + 9; ly < y0 + H - 4; ly += 9) d += `M${f2(x0 + 3)} ${f2(ly)}L${f2(x0 + W - 8)} ${f2(ly)}`;
            out.push(
                `<path d="${d}M${f2(x0 + 10)} ${f2(y0)}L${f2(x0 + 10)} ${f2(y0 + H - 6)}" stroke="#9fb4cc" stroke-width="0.8" opacity="0.7"/>`,
            );
        }
        if (style === "poster") {
            for (const sx of [x0 + 6, x0 + W - 6])
                out.push(
                    `<circle cx="${f2(sx)}" cy="${f2(y0 + 6)}" r="2.6" fill="#b3302b" stroke="#3a1210" stroke-width="1"/>`,
                );
        }
        if (style === "sign") {
            for (const sx of [x0 + W * 0.2, x0 + W * 0.8])
                out.push(`<circle cx="${f2(sx)}" cy="${f2(y0 + 5)}" r="2.2" fill="#1f2326"/>`);
        }
    }
    ink = opts.ink ?? ink;
    const slots = glyphNames.reduce((n, g) => n + (g === GLYPH_GAP ? 0.5 : 1), 0);
    const gs = opts.glyphSize !== undefined ? opts.glyphSize * PX : Math.min(H * 0.64, (W * 0.88) / (slots * 1.15));
    const jitter = style === "scrawl" || style === "chalk";
    const glyphRng = seeded((opts.seed ?? 1987) + 7);
    out.push(
        row(glyphNames, cx, cy, gs, gs * 1.15, () => ({
            ink,
            opacity: look.opacity,
            rot: jitter ? (glyphRng() - 0.5) * 14 : 0,
            weight: style === "page" ? 0.8 : 1,
        })),
    );
    if (opts.fallen && style !== "scrawl") {
        // the crack runs down a gap between two glyphs: through one it could turn an 8 into a 3
        const pick = 0.3 + rng() * 0.4;
        const pitch = gs * 1.15;
        let at = cx - (slots * pitch) / 2;
        const bounds: number[] = [];
        glyphNames.forEach((g, i) => {
            at += g === GLYPH_GAP ? pitch / 2 : pitch;
            if (i < glyphNames.length - 1) bounds.push(at);
        });
        const want = x0 + W * pick;
        const kx = bounds.length
            ? bounds.reduce((b, v) => (Math.abs(v - want) < Math.abs(b - want) ? v : b))
            : x0 + W * (pick < 0.5 ? 0.12 : 0.88);
        out.push(
            `<path d="M${f2(kx)} ${f2(y0)}L${f2(kx + 4)} ${f2(y0 + H * 0.4)}L${f2(kx - 3)} ${f2(y0 + H * 0.65)}L${f2(kx + 2)} ${f2(y0 + H)}" fill="none" stroke="#1b1d1f" stroke-width="1.6" opacity="0.8"/>`,
        );
    }
    if (opts.scratches) {
        const scratchInk = style === "sign" || style === "chalk" ? "#9aa3a8" : "#f4efe2";
        out.push(scratches(rng, cx, cy, W, H, opts.scratches, scratchInk));
    }
    if (opts.cover) out.push(rubble(rng, x0, y0, W, H, Math.min(1, opts.cover)));
    const body = out.join("");
    return rot === 0 ? body : `<g transform="rotate(${f2(rot)} ${f2(cx)} ${f2(cy)})">${body}</g>`;
}

/** A sign fallen to the floor (a painted board unless `style`), its glyphs still readable: the mall's "SINCE 1987". */
export function fallenSign(
    fr: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
    glyphNames: readonly string[],
    opts: ClueOptions = {},
): string {
    return cluePlaque(fr, x, y, w, h, glyphNames, { style: "sign", ...opts, fallen: true });
}
