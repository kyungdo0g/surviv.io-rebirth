// The owner's 2026-10-10 decal sheet install (decalSheet.ts), on a synthetic sheet (the real one is gitignored): every
// cell becomes its sprite at its logical size x resolution, transparent around the drawing, the launchers turned
// upright; without the sheet nothing is written and the summary says the stand-ins show.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
    cutDecalSheet,
    DECAL_SHEET_CELLS,
    fitUpright,
    installDecalSheet,
    summarizeDecalSheet,
    uprightTurn,
} from "./decalSheet.ts";
import { opaqueBox } from "./gunIcons.ts";
import { createImage, encodePng, type RgbaImage } from "./png.ts";

const dirs: string[] = [];
afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A dark-outlined olive bar from (x0, y0) to (x1, y1), `w` px thick, drawn into `img`. */
function bar(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, w: number): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const t = Math.max(0, Math.min(1, ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / (len * len)));
            const d = Math.hypot(x - (x0 + t * (x1 - x0)), y - (y0 + t * (y1 - y0)));
            if (d > w) continue;
            const i = (y * img.width + x) * 4;
            const ink = d > w - 3;
            img.data.set(ink ? [20, 20, 20, 255] : [110, 120, 60, 255], i);
        }
    }
}

/** A 3 x 3 sheet on white: upright bars in rows 1-2 (throwables, rounds), launchers drawn up-right after. */
function sheet(): RgbaImage {
    const cw = 120;
    const ch = 100;
    const img = createImage(cw * 3, ch * 3);
    img.data.fill(255);
    DECAL_SHEET_CELLS.forEach((cell, i) => {
        const ox = (i % 3) * cw;
        const oy = Math.floor(i / 3) * ch;
        if (cell.upright) bar(img, ox + 60, oy + 15, ox + 60, oy + 85, 9);
        else bar(img, ox + 15, oy + 85, ox + 105, oy + 20, 7);
    });
    return img;
}

describe("owner decal sheet", () => {
    it("cuts every cell into its sprite, transparent around it, launchers turned upright", () => {
        const cut = cutDecalSheet(sheet());
        expect([...cut.keys()]).toEqual(DECAL_SHEET_CELLS.map((c) => c.sprite));
        for (const cell of DECAL_SHEET_CELLS) {
            const img = cut.get(cell.sprite)!;
            expect([img.width, img.height], cell.sprite).toEqual([
                cell.size[0] * cell.resolution,
                cell.size[1] * cell.resolution,
            ]);
            expect(img.data[3], cell.sprite).toBe(0);
            const box = opaqueBox(img, 8)!;
            // standing tall: the long axis is vertical, filling the frame's height
            expect(box.y1 - box.y0, cell.sprite).toBeGreaterThan((box.x1 - box.x0) * 1.5);
            expect(box.y1 - box.y0 + 1, cell.sprite).toBeGreaterThanOrEqual(Math.floor(img.height * cell.fill * 0.6));
        }
    });

    it("turns a drawing at most a quarter turn to stand it up", () => {
        const img = createImage(100, 100);
        bar(img, 10, 90, 90, 10, 6);
        expect(uprightTurn(img)).toBeCloseTo(45, 0);
        const standing = fitUpright(img, 40, 120, 1);
        const box = opaqueBox(standing, 8)!;
        expect(box.y1 - box.y0).toBeGreaterThan((box.x1 - box.x0) * 2);
    });

    it("installs the files the client names, and without the sheet writes nothing", () => {
        const dir = mkdtempSync(join(tmpdir(), "decal-sheet-"));
        dirs.push(dir);
        const src = join(dir, "sheet.png");
        writeFileSync(src, encodePng(sheet()));
        const report = installDecalSheet(join(dir, "assets"), src);
        expect(Object.keys(report.installed)).toHaveLength(DECAL_SHEET_CELLS.length);
        for (const file of Object.values(report.installed)) expect(existsSync(join(dir, "assets", file))).toBe(true);
        expect(report.installed["decal-m202-01.img"]).toBe("img/rebirth/decal-m202-01.png");
        const none = installDecalSheet(join(dir, "empty"), join(dir, "missing.png"));
        expect(none.installed).toEqual({});
        expect(existsSync(join(dir, "empty"))).toBe(false);
        expect(summarizeDecalSheet(none).join("\n")).toMatch(/stand-ins/);
    });
});
