// Loot icons cut from the owner's line-art sheets (gunIcons.ts, newGunInstall.ts): the white background becomes
// transparent while the white fill inside the outline stays, the bottom-right label and specks go, the drawing is
// turned to the original icons' 45 degrees and fitted into 128 x 128; the sheet layout names every new gun once.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEW_GUN_IDS } from "../../packages/defs/src/index.ts";
import { axisAngle, cutGunIcon, dualIcon, fitIcon, gridCell, isolateGun, opaqueBox, rotate } from "./gunIcons.ts";
import { DUAL_ICONS, SHEETS } from "./newGunInstall.ts";
import { createImage, type RgbaImage } from "./png.ts";

/** Guns whose drawings have not arrived yet (the sheet's assets.artPending: the second wave, 2026-10-10). */
const SHEET = JSON.parse(readFileSync(new URL("../../docs/design/new-gun-stats.json", import.meta.url), "utf8"));
const ART_PENDING = new Set(Object.keys(SHEET.guns).filter((id) => SHEET.guns[id].assets?.artPending));

const W = 300;
const H = 270;

function fill(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, v: number): void {
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * img.width + x) * 4;
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
    }
}

/** A sheet cell: white, a black-outlined white "gun" (a bar, 30 degrees up-right), a 3-letter label, a speck. */
function cell(): RgbaImage {
    const img = createImage(W, H);
    fill(img, 0, 0, W, H, 255);
    const bar = createImage(220, 36);
    fill(bar, 0, 0, 220, 36, 0);
    fill(bar, 5, 5, 215, 31, 255);
    const turned = rotate(bar, 30);
    for (let y = 0; y < turned.height; y++) {
        for (let x = 0; x < turned.width; x++) {
            const s = (y * turned.width + x) * 4;
            const a = turned.data[s + 3]! / 255;
            if (a < 0.5) continue;
            const d = ((y + 20) * W + x + 20) * 4;
            for (let c = 0; c < 3; c++) img.data[d + c] = turned.data[s + c]!;
        }
    }
    for (const x of [200, 225, 250]) fill(img, x, 225, x + 18, 255, 0);
    fill(img, 285, 100, 287, 102, 0);
    return img;
}

const alphaAt = (img: RgbaImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3]!;

describe("loot icons from the sheets", () => {
    it("keeps the drawing with its white fill, drops the background, the label and specks", () => {
        const src = cell();
        const { image, label, specks } = isolateGun(src);
        expect(label).toBe(3);
        expect(specks).toBe(1);
        expect(alphaAt(image, 2, 2)).toBe(0);
        for (const x of [205, 230, 255]) expect(alphaAt(image, x, 240)).toBe(0);
        expect(alphaAt(image, 286, 101)).toBe(0);
        // the bar's centre is white fill, enclosed by its outline: kept opaque, the ink lifted to the original grey
        const box = opaqueBox(image)!;
        const cx = Math.round((box.x0 + box.x1) / 2);
        const cy = Math.round((box.y0 + box.y1) / 2);
        expect(alphaAt(image, cx, cy)).toBe(255);
        expect(image.data[(cy * W + cx) * 4]).toBe(255);
        const inks = new Set<number>();
        for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3]) inks.add(image.data[i]!);
        expect(Math.min(...inks)).toBe(0x2b);
        expect(axisAngle(image)).toBeGreaterThan(25);
        expect(axisAngle(image)).toBeLessThan(35);
    });

    it("fits the drawing into 128 x 128 like the original icons: turned to 45 degrees, long side 120, centred", () => {
        const { icon } = cutGunIcon(cell());
        expect([icon.width, icon.height]).toEqual([128, 128]);
        const box = opaqueBox(icon, 8)!;
        expect(Math.max(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1)).toBeGreaterThanOrEqual(118);
        expect(Math.max(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1)).toBeLessThanOrEqual(121);
        expect(Math.abs(box.x0 - (127 - box.x1))).toBeLessThanOrEqual(2);
        expect(Math.abs(box.y0 - (127 - box.y1))).toBeLessThanOrEqual(2);
        expect(axisAngle(icon)).toBeGreaterThan(40);
        expect(axisAngle(icon)).toBeLessThan(50);
        // a turn never goes past maxTurn
        expect(axisAngle(fitIcon(isolateGun(cell()).image, { angle: 89, maxTurn: 5 }))).toBeLessThan(40);
    });

    it("composes a dual icon of two crossed copies inside the canvas", () => {
        const { icon } = cutGunIcon(cell());
        const dual = dualIcon(icon);
        const box = opaqueBox(dual, 8)!;
        expect(box.x0).toBeGreaterThanOrEqual(0);
        expect(box.x1).toBeLessThanOrEqual(127);
        // mirrored on the left: opaque near both top corners
        expect(box.x1 - box.x0).toBeGreaterThan(110);
    });

    it("cuts grid cells over the whole sheet", () => {
        const sheet = createImage(10, 9);
        sheet.data[(8 * 10 + 9) * 4 + 3] = 77;
        const c = gridCell(sheet, 2, 3, 1, 2);
        expect([c.width, c.height]).toEqual([5, 3]);
        expect(c.data[(2 * 5 + 4) * 4 + 3]).toBe(77);
    });

    it("the sheet layout names every new gun once but the M79 (no drawing), the duals (composed) and art pending", () => {
        const cut = SHEETS.flatMap((s) => s.cells.filter((c): c is string => !!c));
        expect(new Set(cut).size).toBe(cut.length);
        expect(ART_PENDING.size).toBe(11);
        const expected = NEW_GUN_IDS.filter((id) => id !== "m79" && !DUAL_ICONS[id] && !ART_PENDING.has(id));
        expect([...cut].sort()).toEqual([...expected].sort());
        for (const s of SHEETS) expect(s.cells).toHaveLength(s.cols * s.rows);
        // the FN FAL comes from the redrawn sheet; sheet 17's cell (the SPAS-15 picture) and the SPAS-15 are not cut
        expect(SHEETS.find((s) => s.cells.includes("fal"))?.file).toBe("21-fal-fixed.png");
        expect(cut).not.toContain("spas15");
    });
});
