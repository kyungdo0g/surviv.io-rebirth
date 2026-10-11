// The stroke font of the rebirth puzzle glyphs (glyphs.ts): digits, roman numerals, Latin capitals, a few hanja and
// hangul syllables, drawn as single-line strokes in the 100 x 100 design box (y down). Our own drawing.
import { type GlyphDef, s } from "./glyphPath.ts";

const one = (d: string): GlyphDef => [s(d)];
/** The many-stroke hanja, drawn lighter so their strokes stay apart at one world unit. */
const dense = (d: string): GlyphDef => [s(d, 0.78)];

/** Digits 0-9; the zero carries a slash so it never reads as the letter O. */
export const DIGITS: Readonly<Record<string, GlyphDef>> = {
    "0": one("M50 10C76 10 79 30 79 50C79 70 76 90 50 90C24 90 21 70 21 50C21 30 24 10 50 10ZM64 28L36 72"),
    "1": one("M34 25L53 10L53 90M34 90L72 90"),
    "2": one("M24 28C24 4 77 4 77 30C77 52 40 62 23 90L79 90"),
    "3": one("M24 18C40 2 77 7 74 28C72 43 58 48 44 48C62 48 79 54 79 70C79 93 37 96 22 82"),
    "4": one("M63 90L63 10L19 66L81 66"),
    "5": one("M75 10L31 10L27 46C41 37 78 36 79 64C80 93 37 96 22 82"),
    "6": one("M71 14C50 3 22 18 22 56C22 80 34 90 50 90C67 90 79 80 79 64C79 48 67 40 51 40C36 40 25 48 22 58"),
    "7": one("M21 10L79 10L41 90"),
    "8": one(
        "M50 48C29 48 26 38 26 29C26 18 36 10 50 10C64 10 74 18 74 29C74 38 71 48 50 48C28 48 22 60 22 70C22 82 34 90 50 90C66 90 78 82 78 70C78 60 72 48 50 48Z",
    ),
    "9": one("M29 86C50 97 78 82 78 44C78 20 66 10 50 10C34 10 22 20 22 36C22 52 34 60 50 60C64 60 76 52 78 42"),
};

/**
 * Roman numerals I-X as `roman-1` .. `roman-10`, drawn between a top and a bottom rule (the monument style) so they
 * never read as the Latin letters I, V and X.
 */
function roman(n: number): GlyphDef {
    const spell = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] as string;
    const widths: Readonly<Record<string, number>> = { I: 10, V: 26, X: 26 };
    const gap = 7;
    const total = [...spell].reduce((sum, c) => sum + (widths[c] as number), 0) + gap * (spell.length - 1);
    const sx = Math.min(1, 76 / total); // squeeze the wide ones (VIII) into the box
    let x = 50 - (total * sx) / 2;
    const top = 22;
    const bot = 78;
    const parts: string[] = [];
    for (const c of spell) {
        const w = (widths[c] as number) * sx;
        if (c === "I") parts.push(`M${x + w / 2} ${top}L${x + w / 2} ${bot}`);
        if (c === "V") parts.push(`M${x} ${top}L${x + w / 2} ${bot}L${x + w} ${top}`);
        if (c === "X") parts.push(`M${x} ${top}L${x + w} ${bot}M${x + w} ${top}L${x} ${bot}`);
        x += w + gap * sx;
    }
    const half = (total * sx) / 2 + 6;
    const rules = `M${50 - half} 12L${50 + half} 12M${50 - half} 88L${50 + half} 88`;
    return [s(parts.join("")), s(rules, 0.8)];
}

export const ROMAN: Readonly<Record<string, GlyphDef>> = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`roman-${i + 1}`, roman(i + 1)]),
);

const O_RING = "M50 10C82 10 84 34 84 50C84 66 82 90 50 90C18 90 16 66 16 50C16 34 18 10 50 10Z";
const P_BOWL = "M26 90L26 10L54 10C82 10 82 52 54 52L26 52";

/** Latin capitals A-Z, a plain stroke font. */
export const LATIN: Readonly<Record<string, GlyphDef>> = {
    A: one("M18 90L50 10L82 90M30 62L70 62"),
    B: one("M26 90L26 10L54 10C79 10 79 48 54 48L26 48M54 48C84 48 84 90 54 90L26 90"),
    C: one("M78 24C66 6 36 6 26 24C16 42 16 60 26 76C36 94 66 94 78 76"),
    D: one("M26 10L26 90L46 90C86 90 86 10 46 10Z"),
    E: one("M76 10L26 10L26 90L76 90M26 50L64 50"),
    F: one("M76 10L26 10L26 90M26 50L64 50"),
    G: one("M78 24C66 6 36 6 26 24C16 42 16 60 26 76C36 94 70 94 78 76L78 54L54 54"),
    H: one("M24 10L24 90M76 10L76 90M24 50L76 50"),
    I: one("M50 10L50 90M34 10L66 10M34 90L66 90"),
    J: one("M70 10L70 66C70 96 30 96 26 72"),
    K: one("M26 10L26 90M76 10L26 58M42 43L78 90"),
    L: one("M26 10L26 90L76 90"),
    M: one("M18 90L18 10L50 62L82 10L82 90"),
    N: one("M24 90L24 10L76 90L76 10"),
    O: one(O_RING),
    P: one(P_BOWL),
    Q: one(`${O_RING}M56 66L84 94`),
    R: one(`${P_BOWL}M50 52L78 90`),
    S: one("M76 22C68 8 30 4 26 26C22 48 76 44 76 70C76 96 32 94 22 78"),
    T: one("M18 10L82 10M50 10L50 90"),
    U: one("M24 10L24 64C24 96 76 96 76 64L76 10"),
    V: one("M18 10L50 90L82 10"),
    W: one("M10 10L29 90L50 34L71 90L90 10"),
    X: one("M20 10L80 90M80 10L20 90"),
    Y: one("M18 10L50 50L82 10M50 50L50 90"),
    Z: one("M22 10L78 10L22 90L78 90"),
};

/** Hanja: numbers 1-5, the four directions, the four seasons, mountain, water, fire, moon, sun, star. */
export const HANJA: Readonly<Record<string, GlyphDef>> = {
    一: one("M10 52L90 50"),
    二: one("M24 30L76 30M12 74L88 74"),
    三: one("M22 20L78 20M28 50L72 50M12 82L88 82"),
    四: dense("M14 18L14 88M14 18L86 18L86 88M14 82L86 82M40 18C40 46 32 58 22 64M60 18L60 52C60 60 66 62 78 62"),
    五: one("M18 16L82 16M46 16L36 84M22 48L70 48L66 84M10 86L90 86"),
    東: dense("M12 20L88 20M50 6L50 92M26 34L26 64M26 34L74 34L74 64M26 49L74 49M26 64L74 64M46 66L14 90M54 66L86 90"),
    西: dense(
        "M10 14L90 14M16 32L16 90M16 32L84 32L84 90M16 84L84 84M40 14L40 46C40 56 32 62 24 66M60 14L60 54C60 62 66 64 76 64",
    ),
    南: dense(
        "M12 16L88 16M50 4L50 30M18 32L18 94M18 32L82 32L82 88C82 94 76 94 70 90M36 42L44 52M64 42L56 52M30 60L70 60M28 75L72 75M50 60L50 92",
    ),
    北: one("M38 10L38 90M14 34L38 34M10 76L38 60M62 10L62 82C62 90 68 90 88 88M62 46L86 32"),
    春: dense(
        "M18 14L82 14M22 28L78 28M10 42L90 42M50 4L50 42C44 58 30 70 10 78M50 42C58 58 72 70 90 78M32 62L32 94M32 62L68 62L68 94M32 78L68 78M32 94L68 94",
    ),
    夏: dense(
        "M10 8L90 8M30 18L30 50M30 18L70 18L70 50M30 29L70 29M30 40L70 40M30 50L70 50M42 56L30 68M38 62L72 62C62 78 42 88 16 94M40 70C52 82 70 90 88 94",
    ),
    秋: dense(
        "M40 8L12 16M8 32L44 32M27 12L27 94M27 34L8 68M29 42L42 56M56 30L62 46M88 28L80 44M71 10L71 48C67 68 59 82 50 92M71 48C77 68 85 82 92 90",
    ),
    冬: one("M44 6L16 38M36 18L74 18C62 40 40 54 14 62M42 28C56 44 72 54 90 60M44 68L58 74M38 82L60 92"),
    山: one("M50 8L50 86M18 32L18 86L82 86L82 32"),
    水: one("M50 8L50 86C50 92 44 92 38 88M14 36L38 36L14 72M84 26L58 46M56 44C66 62 76 74 90 84"),
    火: one("M24 32L32 52M78 28L68 50M50 8L50 48C46 68 32 82 12 92M50 48C58 68 72 82 90 92"),
    月: one("M28 10L28 64C28 80 22 88 12 94M28 10L74 10L74 86C74 92 68 94 58 90M28 36L74 36M28 60L74 60"),
    日: one("M24 10L24 90M24 10L76 10L76 90M24 50L76 50M24 90L76 90"),
    星: dense(
        "M26 6L26 40M26 6L74 6L74 40M26 23L74 23M26 40L74 40M34 48L22 66M30 60L80 60M50 48L50 92M24 76L76 76M12 92L88 92",
    ),
};

const A_VOWEL = "M70 8L70 92M70 48L90 48";

/** Hangul syllables 가 나 다 라 마, block letters (initial consonant left, the vowel ㅏ right). */
export const HANGUL: Readonly<Record<string, GlyphDef>> = {
    가: one(`M10 24L48 24C48 52 40 72 16 88${A_VOWEL}`),
    나: one(`M16 16L16 74L52 74${A_VOWEL}`),
    다: one(`M50 20L16 20L16 76L52 76${A_VOWEL}`),
    라: one(`M14 14L48 14L48 44L14 44L14 78L52 78${A_VOWEL}`),
    마: one(`M14 20L48 20L48 78L14 78Z${A_VOWEL}`),
};
