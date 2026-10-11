// Stroke lettering for the rebirth floor art (the mall's "SINCE 1987" sign and its keypad digits, 2026-10-11): block
// capitals and digits drawn as round-capped polylines on a 4 x 6 grid, so the text needs no font (the SVGs are shown
// as images, where a <text> element would fall back to whatever font the viewer's browser has).
import { f2 } from "./svg.ts";

/** Polylines of each glyph on a 4 wide, 6 tall grid, y down. */
const GLYPHS: Readonly<Record<string, ReadonlyArray<ReadonlyArray<readonly [number, number]>>>> = {
    S: [
        [
            [4, 0.6],
            [3.4, 0],
            [0.6, 0],
            [0, 0.6],
            [0, 2.4],
            [0.6, 3],
            [3.4, 3],
            [4, 3.6],
            [4, 5.4],
            [3.4, 6],
            [0.6, 6],
            [0, 5.4],
        ],
    ],
    I: [
        [
            [2, 0],
            [2, 6],
        ],
        [
            [0.8, 0],
            [3.2, 0],
        ],
        [
            [0.8, 6],
            [3.2, 6],
        ],
    ],
    N: [
        [
            [0, 6],
            [0, 0],
            [4, 6],
            [4, 0],
        ],
    ],
    C: [
        [
            [4, 0.6],
            [3.4, 0],
            [0.6, 0],
            [0, 0.6],
            [0, 5.4],
            [0.6, 6],
            [3.4, 6],
            [4, 5.4],
        ],
    ],
    E: [
        [
            [4, 0],
            [0, 0],
            [0, 6],
            [4, 6],
        ],
        [
            [0, 3],
            [3, 3],
        ],
    ],
    "1": [
        [
            [0.8, 1.2],
            [2.2, 0],
            [2.2, 6],
        ],
        [
            [0.8, 6],
            [3.6, 6],
        ],
    ],
    "2": [
        [
            [0, 0.8],
            [0.7, 0],
            [3.3, 0],
            [4, 0.7],
            [4, 2.3],
            [0, 6],
            [4, 6],
        ],
    ],
    "3": [
        [
            [0, 0],
            [4, 0],
            [1.8, 2.6],
            [3.3, 2.6],
            [4, 3.3],
            [4, 5.3],
            [3.3, 6],
            [0.7, 6],
            [0, 5.3],
        ],
    ],
    "7": [
        [
            [0, 0],
            [4, 0],
            [1.4, 6],
        ],
    ],
    "8": [
        [
            [0.6, 0],
            [3.4, 0],
            [4, 0.6],
            [4, 2.4],
            [3.4, 3],
            [0.6, 3],
            [0, 2.4],
            [0, 0.6],
            [0.6, 0],
        ],
        [
            [0.6, 3],
            [3.4, 3],
            [4, 3.6],
            [4, 5.4],
            [3.4, 6],
            [0.6, 6],
            [0, 5.4],
            [0, 3.6],
            [0.6, 3],
        ],
    ],
    "9": [
        [
            [4, 3],
            [0.6, 3],
            [0, 2.4],
            [0, 0.6],
            [0.6, 0],
            [3.4, 0],
            [4, 0.6],
            [4, 5.4],
            [3.4, 6],
            [0.6, 6],
            [0, 5.4],
        ],
    ],
};

/** Whether every character of `text` has a glyph (spaces always do). */
export function canLetter(text: string): boolean {
    return [...text].every((ch) => ch === " " || Object.hasOwn(GLYPHS, ch));
}

/**
 * `text` in strokes, centred on the image point (cx, cy) in pixels, `h` pixels tall (a glyph is 2/3 as wide, with a
 * third of its width between glyphs), drawn with `attrs` (a stroke colour and width).
 */
export function lettering(text: string, cx: number, cy: number, h: number, attrs: string): string {
    if (!canLetter(text)) throw new Error(`lettering: no glyph in "${text}"`);
    const u = h / 6;
    const advance = 4 * u + (4 * u) / 3;
    const width = text.length * advance - (4 * u) / 3;
    const x0 = cx - width / 2;
    const y0 = cy - h / 2;
    const paths: string[] = [];
    [...text].forEach((ch, i) => {
        const gx = x0 + i * advance;
        for (const line of GLYPHS[ch] ?? []) {
            paths.push(line.map(([x, y], j) => `${j ? "L" : "M"}${f2(gx + x * u)} ${f2(y0 + y * u)}`).join(""));
        }
    });
    return `<path d="${paths.join("")}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
}
