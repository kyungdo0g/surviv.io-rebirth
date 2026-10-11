// The puzzle glyphs (glyphs.ts) are paths only (no <text>: fonts are not guaranteed where the SVGs are rasterised), each
// with drawable path data and finite coordinates, and the plates and clues built from them are well-formed.
import { describe, expect, it } from "vitest";
import { REBIRTH_ART_PX_PER_UNIT as PX } from "../../../packages/defs/src/rebirth/buildings.ts";
import { glyphSheet } from "./glyphPreview.ts";
import { cluePlaque, fallenSign, GLYPH_NAMES, GLYPHS, glyph, glyphPlate, phrase } from "./glyphs.ts";
import { boxFrame } from "./svg.ts";

const REQUIRED = [
    ..."0123456789",
    ...Array.from({ length: 10 }, (_, i) => `roman-${i + 1}`),
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ..."一二三四五東西南北春夏秋冬山水火月日星",
    ..."가나다라마",
    ..."sun moon star anchor fish dove bell key bolt cross flame wave gear skull eye crown book quill candle wheel plane ship train antenna lightning drop leaf flower".split(
        " ",
    ),
    "arrow-n",
    "arrow-e",
    "arrow-s",
    "arrow-w",
    "clock-12",
    "clock-3",
    "clock-6",
    "clock-9",
    "flag-alpha",
    "flag-bravo",
    "flag-charlie",
    "flag-delta",
    "flag-echo",
    "rank-bar-1",
    "rank-chevron-3",
    "rank-star-1",
];

describe("rebirth puzzle glyphs", () => {
    it("covers the requested sets", () => {
        for (const name of REQUIRED) expect(GLYPH_NAMES, name).toContain(name);
        expect(new Set(GLYPH_NAMES).size).toBe(GLYPH_NAMES.length);
    });

    it("every glyph is non-empty path data with only path elements and finite coordinates", () => {
        for (const name of GLYPH_NAMES) {
            for (const rot of [0, 37]) {
                const out = glyph(name, 40, 40, 40, { rot });
                const elements = [...out.matchAll(/<(\w+)\s/g)].map((m) => m[1]);
                expect(elements.length, name).toBeGreaterThan(0);
                expect(new Set(elements), name).toEqual(new Set(["path"]));
                expect(out.replace(/<path [^>]*\/>/g, ""), name).toBe("");
                for (const [, d] of out.matchAll(/ d="([^"]*)"/g)) {
                    expect(d, name).toMatch(/^M/);
                    expect(d, name).toMatch(/^[MLCQAZ0-9 .-]+$/);
                    const nums = (d as string).match(/-?\d*\.?\d+/g) ?? [];
                    expect(nums.length, name).toBeGreaterThan(1);
                    for (const n of nums) {
                        expect(Number.isFinite(Number(n)), `${name}: ${n}`).toBe(true);
                        // coordinates stay around the 40 px box at (40, 40); arc axis angles (below 360) are numbers too
                        expect(Math.abs(Number(n)), `${name}: ${n}`).toBeLessThan(360);
                    }
                }
                expect(out).not.toMatch(/NaN|Infinity|undefined/);
            }
        }
    });

    it("every glyph stays inside its 100 x 100 design box (no spill into the next slot of a row)", () => {
        const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7 };
        for (const name of GLYPH_NAMES) {
            for (const part of GLYPHS[name] ?? []) {
                const tokens = part.d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
                let cmd = "";
                for (let i = 0; i < tokens.length; ) {
                    const t = tokens[i] as string;
                    if (/[A-Za-z]/.test(t)) {
                        cmd = t;
                        i++;
                        continue;
                    }
                    const n = ARGS[cmd] as number;
                    const a = tokens.slice(i, i + n).map(Number);
                    i += n;
                    // an arc's radii, axis angle and flags are not coordinates
                    for (const v of cmd === "A" ? a.slice(5) : a) {
                        expect(v, `${name}: ${part.d}`).toBeGreaterThanOrEqual(0);
                        expect(v, `${name}: ${part.d}`).toBeLessThanOrEqual(100);
                    }
                    if (cmd === "M") cmd = "L";
                }
            }
        }
    });

    it("a fallen sign's crack runs between glyphs", () => {
        const fr = boxFrame(0, 0, 20, 20);
        const names = ["1", "9", "8", "7"];
        const art = fallenSign(fr, 0, 0, 5, 1.4, names, { rot: 0.0001 });
        const crack = art.match(/<path d="M([\d.]+) [\d.-]+L[^"]*" fill="none" stroke="#1b1d1f"/);
        expect(crack).not.toBeNull();
        const x = Number(crack?.[1]);
        // the crack's top sits on a slot boundary of the 4-glyph row centred on the sign
        const W = 5 * PX;
        const gs = Math.min(1.4 * PX * 0.64, (W * 0.88) / (4 * 1.15));
        const left = 10 * PX - 2 * gs * 1.15;
        const onBoundary = [1, 2, 3].some((k) => Math.abs(left + k * gs * 1.15 - x) < 0.02);
        expect(onBoundary, `crack at ${x}`).toBe(true);
    });

    it("plates, clues and the preview sheet draw without text in the art", () => {
        const fr = boxFrame(0, 0, 20, 20);
        const art = [
            glyphPlate(fr, 0, 0, "北", { material: "stone", worn: 3 }),
            cluePlaque(fr, 0, 2, 6, 1.6, phrase("SINCE 1987"), { style: "sign", scratches: 3, cover: 0.3, torn: true }),
            fallenSign(fr, 0, -3, 5, 1.4, ["sun", " ", "moon"]),
            ...(["plaque", "poster", "chalk", "scrawl", "page", "sign"] as const).map((style) =>
                cluePlaque(fr, 0, 4, 5, 1.5, ["1", "9", "8", "7"], { style }),
            ),
        ];
        for (const a of art) {
            expect(a).not.toContain("<text");
            expect(a).not.toMatch(/NaN|Infinity|undefined/);
        }
        expect(cluePlaque(fr, 0, 0, 4, 1, ["A"], { rot: 10 })).toMatch(/^<g transform="rotate\(10 /);
        expect(() => phrase("ä")).toThrow();
        expect(() => glyph("nope", 0, 0, 1)).toThrow();
        expect(glyphSheet()).toContain("<svg");
    });
});
