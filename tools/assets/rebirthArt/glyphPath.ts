// The path toolkit of the rebirth puzzle glyphs (glyphs.ts): a glyph is drawn in a 100 x 100 design box (y down) as a few
// stroked and filled SVG paths in absolute commands (M L H V C Q A Z), then placed by an affine map (scale, rotation,
// translation). Paths only, never <text>: the building SVGs are rasterised by the browser and fonts are not guaranteed.

/** One path of a glyph: stroked (round caps and joins) unless `fill`; `color` overrides the ink (signal flags). */
export interface GlyphPart {
    readonly d: string;
    readonly fill?: boolean;
    readonly color?: string;
    /** stroke width as a multiple of the glyph's base stroke */
    readonly width?: number;
    /** fills use the even-odd rule (holes) unless this is set */
    readonly nonzero?: boolean;
    /** turns this part by degrees clockwise about the box centre (compass needles) */
    readonly turn?: number;
}

export type GlyphDef = readonly GlyphPart[];

/** A stroked part. */
export const s = (d: string, width?: number): GlyphPart => (width === undefined ? { d } : { d, width });
/** A filled part (even-odd: inner rings cut holes). */
export const f = (d: string, color?: string): GlyphPart =>
    color === undefined ? { d, fill: true } : { d, fill: true, color };
/** A filled part with the nonzero rule (overlapping petals stay filled). */
export const fnz = (d: string): GlyphPart => ({ d, fill: true, nonzero: true });

const r2 = (v: number) => {
    const n = Number(v.toFixed(2));
    return Object.is(n, -0) ? 0 : n;
};

/** A full circle as two arcs. */
export function circ(cx: number, cy: number, r: number): string {
    return `M${r2(cx - r)} ${r2(cy)}A${r2(r)} ${r2(r)} 0 1 0 ${r2(cx + r)} ${r2(cy)}A${r2(r)} ${r2(r)} 0 1 0 ${r2(cx - r)} ${r2(cy)}Z`;
}

/** A polyline (closed with `close`). */
export function poly(pts: ReadonlyArray<readonly [number, number]>, close = false): string {
    return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${r2(x)} ${r2(y)}`).join("") + (close ? "Z" : "");
}

/** A regular star of `n` points centred on (cx, cy): outer radius `r`, inner `ri`, first point straight up. */
export function starD(cx: number, cy: number, r: number, ri: number, n = 5): string {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 2 * n; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        const rr = i % 2 === 0 ? r : ri;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return poly(pts, true);
}

/** The placement of a glyph: its design box centred on (x, y), `size` pixels wide, turned `rot` degrees clockwise. */
export interface Placement {
    x: number;
    y: number;
    size: number;
    rot?: number;
}

const ARGS: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 };

/** Maps a design-box path (absolute commands only) to image pixels; H and V become L (a turn breaks them). */
export function placePath(d: string, at: Placement): string {
    const k = at.size / 100;
    const th = ((at.rot ?? 0) * Math.PI) / 180;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const map = (x: number, y: number) => {
        const dx = (x - 50) * k;
        const dy = (y - 50) * k;
        return `${r2(at.x + dx * cos - dy * sin)} ${r2(at.y + dx * sin + dy * cos)}`;
    };
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
    const out: string[] = [];
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    let i = 0;
    let cmd = "";
    while (i < tokens.length) {
        const t = tokens[i] as string;
        if (/[A-Za-z]/.test(t)) {
            if (!(t in ARGS)) throw new Error(`glyph path: unsupported command ${t} (absolute M L H V C Q A Z only)`);
            cmd = t;
            i++;
            if (cmd === "Z") {
                out.push("Z");
                cx = sx;
                cy = sy;
                continue;
            }
        } else if (cmd === "" || cmd === "Z") {
            throw new Error(`glyph path: number without a command in "${d}"`);
        }
        const n = ARGS[cmd] as number;
        const a = tokens.slice(i, i + n).map(Number);
        if (a.length < n || a.some((v) => !Number.isFinite(v))) throw new Error(`glyph path: bad arguments in "${d}"`);
        i += n;
        switch (cmd) {
            case "M":
            case "L":
                out.push(`${cmd}${map(a[0] as number, a[1] as number)}`);
                [cx, cy] = [a[0] as number, a[1] as number];
                if (cmd === "M") {
                    [sx, sy] = [cx, cy];
                    cmd = "L"; // implicit lineto after a moveto's first pair
                }
                break;
            case "H":
                cx = a[0] as number;
                out.push(`L${map(cx, cy)}`);
                break;
            case "V":
                cy = a[0] as number;
                out.push(`L${map(cx, cy)}`);
                break;
            case "C":
                out.push(
                    `C${map(a[0] as number, a[1] as number)} ${map(a[2] as number, a[3] as number)} ${map(a[4] as number, a[5] as number)}`,
                );
                [cx, cy] = [a[4] as number, a[5] as number];
                break;
            case "Q":
                out.push(`Q${map(a[0] as number, a[1] as number)} ${map(a[2] as number, a[3] as number)}`);
                [cx, cy] = [a[2] as number, a[3] as number];
                break;
            case "A": {
                // uniform scale and a rotation keep an arc's flags; its axis turns with the glyph
                const rot = r2((a[2] as number) + (at.rot ?? 0));
                out.push(
                    `A${r2((a[0] as number) * k)} ${r2((a[1] as number) * k)} ${rot} ${a[3]} ${a[4]} ${map(a[5] as number, a[6] as number)}`,
                );
                [cx, cy] = [a[5] as number, a[6] as number];
                break;
            }
        }
    }
    return out.join("");
}

/** A small deterministic generator (mulberry32) for the clue art's scratches and torn edges. */
export function seeded(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
