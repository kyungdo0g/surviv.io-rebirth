// A contact sheet of the rebirth puzzle glyphs (glyphs.ts) at the buildings' scale, for eyeballing legibility:
// `node tools/assets/rebirthArt/glyphPreview.ts [out.svg]` (default: glyphs.svg in the OS temp directory). Every glyph at
// 1 and 1.5 world units on a floor tone, then the glyph plates and every clue style with its damage variants. The labels
// use <text> because this sheet is only looked at in a browser; the glyphs themselves are paths.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import { type ClueOptions, cluePlaque, fallenSign, GLYPH_NAMES, glyph, glyphPlate, phrase } from "./glyphs.ts";
import type { Frame } from "./svg.ts";

export function glyphSheet(): string {
    const cols = 12;
    const cell = 2.4 * PX;
    const rows = Math.ceil(GLYPH_NAMES.length / cols);
    const gridH = rows * cell;
    const extraH = 15 * PX;
    const W = cols * cell;
    const H = gridH + extraH;
    const out: string[] = [`<rect width="${W}" height="${H}" fill="#6d6a62"/>`];
    GLYPH_NAMES.forEach((name, i) => {
        const x = (i % cols) * cell;
        const y = Math.floor(i / cols) * cell;
        out.push(`<rect x="${x + 2}" y="${y + 2}" width="${cell - 4}" height="${cell - 4}" fill="#c9c3b5" rx="3"/>`);
        out.push(glyph(name, x + cell * 0.36, y + cell * 0.42, 1.5 * PX));
        out.push(glyph(name, x + cell * 0.8, y + cell * 0.36, 1 * PX));
        out.push(
            `<text x="${x + 5}" y="${y + cell - 6}" font-family="sans-serif" font-size="10" fill="#333">${name}</text>`,
        );
    });
    // the examples: a frame whose world origin is the sheet's top left, 1 unit = PX pixels, below the grid
    const fr: Frame = { ox: 0, oy: 0, w: W, h: H };
    const wy = (row: number) => -gridH / PX - row;
    const plates: Array<[string, "metal" | "stone" | "brass"]> = [
        ["7", "metal"],
        ["北", "stone"],
        ["anchor", "brass"],
        ["roman-4", "metal"],
        ["flag-charlie", "metal"],
        ["clock-3", "brass"],
        ["가", "stone"],
        ["rank-chevron-3", "metal"],
    ];
    plates.forEach(([g, m], i) => {
        out.push(glyphPlate(fr, 1.5 + i * 2.2, wy(1.5), g, { material: m, worn: i === 3 ? 4 : undefined }));
    });
    const clues: Array<[number, number, number, number, string[], ClueOptions]> = [
        [3.5, 4.2, 6, 1.6, phrase("SINCE 1987"), { style: "plaque" }],
        [10.5, 4.2, 6, 1.6, phrase("SINCE 1987"), { style: "sign", fallen: true, scratches: 3 }],
        [17, 4.2, 5, 1.6, ["1", "arrow-e", "9", "arrow-e", "8", "arrow-e", "7"], { style: "poster", torn: true }],
        [23.2, 4.2, 5, 1.6, ["東", "西", "南", "北"], { style: "chalk" }],
        [3.5, 7.4, 5, 1.8, ["sun", "moon", "star"], { style: "page", rot: -6 }],
        [10, 7.4, 5, 1.6, ["roman-3", "roman-1", "roman-4"], { style: "plaque", material: "metal", cover: 0.35 }],
        [16.5, 7.4, 6, 1.6, ["flag-alpha", "flag-delta", "flag-echo"], { style: "poster" }],
        [23, 7.4, 5, 1.6, ["가", "나", "다", "라"], { style: "scrawl" }],
        [4, 10.8, 6, 1.6, phrase("CODE 4"), { style: "sign", scratches: 5, cover: 0.3, torn: true }],
        [11, 10.8, 5, 1.6, ["clock-12", "clock-3", "clock-6", "clock-9"], { style: "plaque", material: "stone" }],
        [17.5, 10.8, 5, 1.6, ["rank-star-1", "rank-bar-2", "rank-chevron-2"], { style: "plaque", material: "metal" }],
    ];
    for (const [x, y, w, h, names, o] of clues) out.push(cluePlaque(fr, x, wy(y), w, h, names, o));
    out.push(fallenSign(fr, 23.5, wy(10.8), 4.5, 1.4, ["一", "二", "三"], { style: "plaque", rot: -18, scratches: 2 }));
    out.push(cluePlaque(fr, 14, wy(13.5), 7, 1.4, phrase("ABC XYZ"), { style: "page" }));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${out.join("")}</svg>\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const file = process.argv[2] ?? join(tmpdir(), "glyphs.svg");
    writeFileSync(file, glyphSheet());
    console.log(file);
}
