// Installs the owner's "second-wave decals" sheet of 2026-10-10 (assets-user/source/2026-10-10-sheets/
// second-wave-decals.png, gitignored, never committed) into the client's asset folder, the way the first owner sheets
// are cut (gunIcons.ts): a 3 x 3 grid of coloured drawings with dark outlines on white,
//   row 1: the Molotov, the flashbang, the NLAW missile;
//   row 2: the Pvg m/42's HEAT round, the Bazooka rocket, the NLAW launcher;
//   row 3: the Pvg m/42 tube, the M202 FLASH box, the Bazooka.
// Each cell's drawing is separated from the white (isolateGun, its colours kept), the launchers turned upright (long
// axis vertical: their muzzles, drawn up-right, point up like the held sprites; the throwables and the rounds are drawn
// standing, noses up) and fitted, centred,
// into its sprite's logical frame at 2x (4x for the small rounds): img/rebirth/<sprite>.png, the files the client's
// sprite manifest names (apps/client/src/assets/decalThrowableSprites.ts). Without the sheet nothing is written and
// the client draws each sprite's fallback (the committed throwable drawings, the closest committed round, the gun's
// held sprite). Run by import.ts after the new guns' art.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
    DISCARD_DECALS,
    newGunIconPath,
    OWNER_ROUND_ART,
    REBIRTH_THROWABLE_SPRITE_SIZE,
    REBIRTH_THROWABLE_SPRITES,
} from "../../packages/defs/src/rebirth/index.ts";
import { axisAngle, drawScaled, gridCell, isolateGun, opaqueBox, rotate } from "./gunIcons.ts";
import { createImage, decodePng, encodePng, type RgbaImage } from "./png.ts";

export const DECAL_SHEET = "assets-user/source/2026-10-10-sheets/second-wave-decals.png";

export interface SheetCell {
    /** sprite id the cell installs */
    sprite: string;
    /** logical size of the sprite */
    size: readonly [number, number];
    /** pixels per logical pixel of the written PNG */
    resolution: number;
    /** share of the frame's height (and width) the drawing may fill */
    fill: number;
    /** drawn standing already (the throwables and rounds): not turned */
    upright: boolean;
}

const throwable = (id: keyof typeof REBIRTH_THROWABLE_SPRITES): SheetCell => ({
    sprite: REBIRTH_THROWABLE_SPRITES[id],
    size: REBIRTH_THROWABLE_SPRITE_SIZE,
    resolution: 2,
    fill: 0.8,
    upright: true,
});
const round = (sprite: keyof typeof OWNER_ROUND_ART): SheetCell => ({
    sprite,
    size: OWNER_ROUND_ART[sprite].size,
    resolution: 4,
    fill: 0.98,
    upright: true,
});
const body = (gun: string): SheetCell => ({
    sprite: DISCARD_DECALS[gun].sprite,
    size: DISCARD_DECALS[gun].size,
    resolution: 2,
    fill: 0.98,
    upright: false,
});

/** The sheet's cells, row by row. */
export const DECAL_SHEET_CELLS: readonly SheetCell[] = [
    throwable("molotov"),
    throwable("flashbang"),
    round("proj-nlaw-01.img"),
    round("proj-pvg42-01.img"),
    round("proj-bazooka-01.img"),
    body("nlaw"),
    body("pvg42"),
    body("m202"),
    body("bazooka"),
];

/** Degrees to turn a drawing counter-clockwise so its long axis stands vertical (at most a quarter turn). */
export function uprightTurn(drawing: RgbaImage): number {
    let turn = 90 - axisAngle(drawing);
    if (turn > 90) turn -= 180;
    if (turn <= -90) turn += 180;
    return turn;
}

/**
 * The drawing turned upright (unless `standing` already) and fitted, centred, into a `w` x `h` frame filling at most
 * `fill` of it.
 */
export function fitUpright(drawing: RgbaImage, w: number, h: number, fill: number, standing = false): RgbaImage {
    const turned = standing ? drawing : rotate(drawing, uprightTurn(drawing));
    const out = createImage(w, h);
    const box = opaqueBox(turned, 8);
    if (!box) return out;
    const bw = box.x1 - box.x0 + 1;
    const bh = box.y1 - box.y0 + 1;
    const k = Math.min((w * fill) / bw, (h * fill) / bh);
    const dw = Math.max(1, Math.round(bw * k));
    const dh = Math.max(1, Math.round(bh * k));
    drawScaled(
        out,
        turned,
        { x: box.x0, y: box.y0, w: bw, h: bh },
        { x: Math.round((w - dw) / 2), y: Math.round((h - dh) / 2), w: dw, h: dh },
    );
    return out;
}

/** Every cell of the sheet cut into its sprite image, by sprite id. */
export function cutDecalSheet(sheet: RgbaImage): Map<string, RgbaImage> {
    const out = new Map<string, RgbaImage>();
    DECAL_SHEET_CELLS.forEach((cell, i) => {
        const img = gridCell(sheet, 3, 3, i % 3, Math.floor(i / 3));
        // coloured art: keep its colours (ink 0) and every part (no label to drop)
        const drawing = isolateGun(img, { ink: 0, labelTop: 2, bgThreshold: 235 }).image;
        const [w, h] = cell.size;
        out.set(cell.sprite, fitUpright(drawing, w * cell.resolution, h * cell.resolution, cell.fill, cell.upright));
    });
    return out;
}

/** Every file installDecalSheet writes under the asset folder (when the sheet is there). */
export function decalSheetPlan(): string[] {
    return DECAL_SHEET_CELLS.map((c) => newGunIconPath(c.sprite));
}

export interface DecalSheetReport {
    /** sprite id -> installed file (under the asset folder) */
    installed: Record<string, string>;
    warnings: string[];
}

/** Installs the sheet's sprites into `dest` (the client's asset folder); see the header. */
export function installDecalSheet(dest: string, sheetPath = DECAL_SHEET): DecalSheetReport {
    const report: DecalSheetReport = { installed: {}, warnings: [] };
    if (!existsSync(sheetPath)) {
        report.warnings.push(
            `${sheetPath} missing: the Molotov, flashbang, second-wave rounds and discarded launchers show their ` +
                "stand-ins (our own drawings, the closest round, the held sprite)",
        );
        return report;
    }
    for (const [sprite, img] of cutDecalSheet(decodePng(readFileSync(sheetPath)))) {
        const file = newGunIconPath(sprite);
        mkdirSync(dirname(join(dest, file)), { recursive: true });
        writeFileSync(join(dest, file), encodePng(img));
        report.installed[sprite] = file;
    }
    return report;
}

/** One line for the import log, then the warnings. */
export function summarizeDecalSheet(report: DecalSheetReport): string[] {
    const n = Object.keys(report.installed).length;
    return [
        `owner decal sheet: ${n} of ${DECAL_SHEET_CELLS.length} sprites installed`,
        ...report.warnings.map((w) => `WARNING: ${w}`),
    ];
}
