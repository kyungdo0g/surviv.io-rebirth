// The pictograms of the rebirth puzzle glyphs (glyphs.ts): symbols, compass needles, clock faces, international maritime
// signal flags A-E and military rank insignia, in the 100 x 100 design box (y down). Our own drawing.
import { circ, f, fnz, type GlyphDef, poly, s, starD } from "./glyphPath.ts";

function rays(cx: number, cy: number, r0: number, r1: number, n: number, phase = 0): string {
    let d = "";
    for (let i = 0; i < n; i++) {
        const a = phase + (i * 2 * Math.PI) / n;
        d += poly([
            [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0],
            [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1],
        ]);
    }
    return d;
}

function gear(): string {
    const pts: Array<[number, number]> = [];
    const teeth = 8;
    for (let i = 0; i < teeth * 4; i++) {
        const a = -Math.PI / 2 + ((i - 0.5) * Math.PI) / (teeth * 2);
        const r = i % 4 < 2 ? 44 : 32;
        pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
    return poly(pts, true) + circ(50, 50, 13);
}

/**
 * A compass needle pointing up, turned by the caller: a broad filled head, a short thin outlined tail and a pivot ring.
 * The head is the heavier, longer half so the direction still reads at 1 unit (an even needle read as a lozenge).
 */
const NEEDLE: GlyphDef = [
    f("M50 2L71 58L29 58Z"),
    s("M38 58L50 90L62 58", 0.5),
    f(`${circ(50, 58, 8)}${circ(50, 58, 3.5)}`),
];

function turned(def: GlyphDef, deg: number): GlyphDef {
    return def.map((p) => ({ ...p, turn: deg }));
}

function clock(hour: number): GlyphDef {
    const ticks = rays(50, 50, 36, 42, 12);
    const major = rays(50, 50, 31, 42, 4);
    const a = -Math.PI / 2 + ((hour % 12) * Math.PI) / 6;
    const hourHand = poly([
        [50, 50],
        [50 + Math.cos(a) * 22, 50 + Math.sin(a) * 22],
    ]);
    const parts: GlyphDef = [s(circ(50, 50, 45), 0.8), s(ticks, 0.5), s(major, 0.9), s(hourHand, 1.5)];
    // the minute hand stands at 12 (an o'clock); at 12 it lies along the hour hand, so draw it thin and long beside
    return [...parts, s("M50 50L50 14", 0.8), f(circ(50, 50, 5))];
}

/** A signal flag on a staff: the fly drawn by `field`, then the staff and the flag's outline. */
function flag(field: GlyphDef, swallowtail: boolean): GlyphDef {
    const outline = swallowtail ? "M20 22L92 22L74 50L92 78L20 78Z" : "M20 22L92 22L92 78L20 78Z";
    return [...field, s(outline, 0.45), s("M14 12L14 94", 0.8)];
}

const FLAG_WHITE = "#f2f0e8";
const FLAG_BLUE = "#1f4f9f";
const FLAG_RED = "#c8312e";
const FLAG_YELLOW = "#e2b425";

function stripes(colors: readonly string[], heights: readonly number[]): GlyphDef {
    let y = 22;
    return colors.map((c, i) => {
        const h = heights[i] as number;
        const d = `M20 ${y}L92 ${y}L92 ${y + h}L20 ${y + h}Z`;
        y += h;
        return f(d, c);
    });
}

function chevrons(n: number): GlyphDef {
    let d = "";
    const y0 = 50 - (n - 1) * 11;
    for (let i = 0; i < n; i++)
        d += poly([
            [14, y0 + 22 * i + 16],
            [50, y0 + 22 * i - 6],
            [86, y0 + 22 * i + 16],
        ]);
    return [s(d, 1.4)];
}

function bars(n: number): GlyphDef {
    let d = "";
    const w = 14;
    const gap = 12;
    const x0 = 50 - (n * w + (n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
        const x = x0 + i * (w + gap);
        d += `M${x} 12L${x + w} 12L${x + w} 88L${x} 88Z`;
    }
    return [f(d), s(d, 0.4)];
}

function stars(n: number): GlyphDef {
    const r = n === 1 ? 40 : n === 2 ? 22 : 16;
    const step = n === 1 ? 0 : n === 2 ? 46 : 32;
    let d = "";
    for (let i = 0; i < n; i++) d += starD(50 + (i - (n - 1) / 2) * step, 52, r, r * 0.42);
    return [fnz(d)];
}

export const PICTOS: Readonly<Record<string, GlyphDef>> = {
    sun: [f(circ(50, 50, 18)), s(rays(50, 50, 28, 44, 8), 0.9)],
    moon: [f("M62 12A40 40 0 1 0 62 88A50 50 0 0 1 62 12Z")],
    star: [fnz(starD(50, 53, 46, 19))],
    anchor: [
        s(`${circ(50, 15, 7)}M50 22L50 90M30 34L70 34M14 58C16 82 34 90 50 90C66 90 84 82 86 58`),
        f("M6 66L14 50L24 64ZM94 66L86 50L76 64Z"),
    ],
    fish: [f(`M10 50C28 22 62 22 76 50C62 78 28 78 10 50Z${circ(28, 46, 5)}M74 50L94 30L88 50L94 70Z`)],
    dove: [
        f(
            "M8 56C20 48 34 48 44 52L58 18C68 28 68 42 62 52C72 50 82 44 92 38C86 56 72 66 56 68L44 86L42 68C28 66 16 62 8 56Z",
        ),
        s("M44 52C38 44 30 40 22 40", 0.6),
    ],
    bell: [
        f("M50 14C30 14 26 32 26 50C26 66 18 72 12 78L88 78C82 72 74 66 74 50C74 32 70 14 50 14Z"),
        f(circ(50, 86, 7)),
        s("M44 14C44 4 56 4 56 14", 0.8),
    ],
    key: [s(`${circ(26, 50, 15)}M41 50L92 50M78 50L78 66M88 50L88 62`)],
    bolt: [
        f("M30 22L40 6L60 6L70 22L60 38L40 38ZM50 14L50 30"),
        s("M50 38L50 94M38 50L62 46M38 62L62 58M38 74L62 70M38 86L62 82", 0.8),
    ],
    cross: [f("M42 6L58 6L58 30L80 30L80 46L58 46L58 94L42 94L42 46L20 46L20 30L42 30Z")],
    flame: [
        f(
            "M50 94C26 94 16 76 20 58C24 44 38 38 36 14C50 24 56 38 54 50C60 44 62 34 60 24C76 40 84 58 80 72C76 86 66 94 50 94ZM50 88C40 88 36 80 38 72C40 64 48 62 48 54C56 62 62 70 60 78C58 84 54 88 50 88Z",
        ),
    ],
    wave: [
        s(
            [26, 50, 74]
                .map(
                    (y) =>
                        `M8 ${y}C18 ${y - 12} 30 ${y - 12} 40 ${y}C50 ${y + 12} 62 ${y + 12} 72 ${y}C80 ${y - 9} 86 ${y - 10} 92 ${y - 7}`,
                )
                .join(""),
        ),
    ],
    "arrow-n": NEEDLE,
    "arrow-e": turned(NEEDLE, 90),
    "arrow-s": turned(NEEDLE, 180),
    "arrow-w": turned(NEEDLE, 270),
    gear: [f(gear())],
    skull: [
        f(
            `M50 6C26 6 14 24 14 44C14 58 22 64 30 66L30 80L70 80L70 66C78 64 86 58 86 44C86 24 74 6 50 6Z${circ(35, 44, 10)}${circ(65, 44, 10)}M50 56L43 68L57 68Z`,
        ),
        f("M30 84L70 84L70 94L30 94Z"),
        s("M43 76L43 94M57 76L57 94", 0.5),
    ],
    eye: [s("M6 50C28 18 72 18 94 50C72 82 28 82 6 50Z", 0.9), f(`${circ(50, 50, 16)}${circ(50, 50, 6)}`)],
    crown: [
        f("M14 76L8 28L32 52L50 16L68 52L92 28L86 76ZM14 82L86 82L86 92L14 92Z"),
        f(`${circ(8, 24, 6)}${circ(50, 12, 6)}${circ(92, 24, 6)}`),
    ],
    book: [
        s("M50 24C38 15 22 13 6 18L6 82C22 78 38 80 50 88C62 80 78 78 94 82L94 18C78 13 62 15 50 24ZM50 24L50 88", 0.8),
        s("M16 34L40 34M16 48L40 48M16 62L40 62M60 34L84 34M60 48L84 48M60 62L84 62", 0.5),
    ],
    quill: [
        f("M92 4C58 10 32 36 24 74C48 64 74 40 92 4Z"),
        s("M30 68L10 96", 0.9),
        s("M50 50L68 48M44 58L58 60M60 36L78 30", 0.35),
    ],
    candle: [
        f("M36 42L64 42L64 94L36 94ZM50 6C58 16 61 24 57 31C55 35 45 35 43 31C39 24 42 16 50 6Z"),
        s("M50 34L50 42M64 50C68 54 68 60 66 66", 0.6),
    ],
    wheel: [s(`${circ(50, 50, 42)}${rays(50, 50, 12, 42, 8, Math.PI / 8)}`, 0.9), f(circ(50, 50, 11))],
    plane: [
        f(
            "M50 4C56 4 57 14 57 28L57 62L68 76L68 84L50 79L32 84L32 76L43 62L43 28C43 14 44 4 50 4ZM43 34L6 56L6 66L43 56ZM57 34L94 56L94 66L57 56Z",
        ),
    ],
    ship: [
        f(`M4 60L96 60L82 86L18 86Z${circ(32, 72, 4)}${circ(50, 72, 4)}${circ(68, 72, 4)}`),
        f("M28 42L68 42L68 60L28 60ZM52 20L64 20L64 42L52 42Z"),
        s("M34 18C38 10 46 8 50 10", 0.6),
    ],
    train: [
        f(
            `M24 10L76 10C82 10 86 14 86 22L86 78L14 78L14 22C14 14 18 10 24 10ZM24 22L76 22L76 46L24 46Z${circ(30, 62, 6)}${circ(70, 62, 6)}`,
        ),
        s("M30 80L16 96M70 80L84 96M22 90L78 90", 0.8),
    ],
    antenna: [
        s("M50 32L32 94M50 32L68 94M37 76L63 76M41 60L59 60M45 46L55 46", 0.8),
        f(circ(50, 25, 7)),
        s("M32 12A24 24 0 0 0 32 38M68 12A24 24 0 0 1 68 38M20 4A36 36 0 0 0 20 46M80 4A36 36 0 0 1 80 46", 0.6),
    ],
    lightning: [f("M60 4L18 54L46 54L34 96L82 40L54 40Z")],
    drop: [
        f(
            "M50 6C64 30 80 46 80 64C80 82 66 94 50 94C34 94 20 82 20 64C20 46 36 30 50 6ZM34 62C34 72 40 80 48 82L46 76C42 74 40 70 40 62Z",
        ),
    ],
    leaf: [s("M12 88C12 40 40 12 90 10C90 58 62 88 12 88ZM12 88L72 28M44 56L44 36M56 44L72 44M34 66L52 70", 0.8)],
    flower: [
        fnz(
            [0, 1, 2, 3, 4, 5]
                .map((i) => {
                    const a = -Math.PI / 2 + (i * Math.PI) / 3;
                    return circ(50 + Math.cos(a) * 21, 36 + Math.sin(a) * 21, 12);
                })
                .join(""),
        ),
        s("M50 60L50 96M50 82C42 72 32 70 24 72", 0.8),
    ],
    "clock-12": clock(12),
    "clock-3": clock(3),
    "clock-6": clock(6),
    "clock-9": clock(9),
    // international maritime signal flags A-E (alpha, bravo: swallowtails)
    "flag-alpha": flag(
        [f("M20 22L52 22L52 78L20 78Z", FLAG_WHITE), f("M52 22L92 22L74 50L92 78L52 78Z", FLAG_BLUE)],
        true,
    ),
    "flag-bravo": flag([f("M20 22L92 22L74 50L92 78L20 78Z", FLAG_RED)], true),
    "flag-charlie": flag(
        stripes([FLAG_BLUE, FLAG_WHITE, FLAG_RED, FLAG_WHITE, FLAG_BLUE], [11.2, 11.2, 11.2, 11.2, 11.2]),
        false,
    ),
    "flag-delta": flag(stripes([FLAG_YELLOW, FLAG_BLUE, FLAG_YELLOW], [14, 28, 14]), false),
    "flag-echo": flag(stripes([FLAG_BLUE, FLAG_RED], [28, 28]), false),
    // rank insignia: lieutenant / captain bars, private-to-sergeant chevrons, general stars
    "rank-bar-1": bars(1),
    "rank-bar-2": bars(2),
    "rank-chevron-1": chevrons(1),
    "rank-chevron-2": chevrons(2),
    "rank-chevron-3": chevrons(3),
    "rank-star-1": stars(1),
    "rank-star-2": stars(2),
    "rank-star-3": stars(3),
};
