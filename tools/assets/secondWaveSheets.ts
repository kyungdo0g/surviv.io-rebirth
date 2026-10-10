// The owner's second-wave sheets of 2026-10-10 (gitignored, assets-user/source/2026-10-10-sheets/; docs/deploy.md):
// - second-wave-icons.webp: line-art loot icons in the first sheets' style (black outline, white fill) but on a
//   transparent background and without a grid, four per row, the KPV reaching into the next column; cut by finding the
//   separate drawings in reading order (gunIcons.ts looseDrawings) rather than by grid cells;
// - second-wave-decals.png: the throwables' and launchers' decals (read by their own installer, not here).
// The eleven gun drawings become the guns' loot icons (newGunInstall.ts); the Molotov and the flashbang drawings are
// for the throwables, whose installer takes them through secondWaveDrawings.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cutGunIcon, type LooseDrawing, looseDrawings } from "./gunIcons.ts";
import type { RgbaImage } from "./png.ts";

export const SECOND_WAVE_SHEET_DIR = "assets-user/source/2026-10-10-sheets";

export interface LooseSheetLayout {
    file: string;
    /** the name of each drawing in reading order: rows top to bottom, left to right */
    drawings: readonly string[];
}

/**
 * The owner's second-wave icon sheet: row 1 NLAW, PAW20, Pvg m/42, RPD; row 2 Bren, MG3, Maadi GMR-30A1, Negev;
 * row 3 Bazooka, KPV, Jackhammer, Molotov; row 4 the flashbang. Gun ids as in rebirth/newGuns.ts.
 */
export const SECOND_WAVE_ICON_SHEET: LooseSheetLayout = {
    file: "second-wave-icons.webp",
    drawings: [
        "nlaw",
        "paw20",
        "pvg42",
        "rpd",
        "bren",
        "mg3",
        "maadi",
        "negev",
        "bazooka",
        "kpv",
        "jackhammer",
        "molotov",
        "flashbang",
    ],
};

/** The drawings of the icon sheet that are not guns: the throwables installer's, not newGunInstall's. */
export const SECOND_WAVE_THROWABLE_DRAWINGS: readonly string[] = ["molotov", "flashbang"];

/**
 * The drawings of a loose sheet by name; empty, with a warning, when the sheet does not hold exactly the layout's
 * number of drawings (a changed sheet must not put one gun's picture on another).
 */
export function namedDrawings(
    sheet: RgbaImage,
    layout: LooseSheetLayout,
    warnings: string[],
): Map<string, LooseDrawing> {
    const found = looseDrawings(sheet);
    const out = new Map<string, LooseDrawing>();
    if (found.length !== layout.drawings.length) {
        warnings.push(
            `${layout.file}: ${found.length} drawings found, the layout names ${layout.drawings.length} ` +
                "(tools/assets/secondWaveSheets.ts); none cut, stand-ins used",
        );
        return out;
    }
    layout.drawings.forEach((name, i) => {
        out.set(name, found[i]!);
    });
    return out;
}

/**
 * The drawings of the owner's icon sheet in `dir` by name (each cropped to itself, transparent around it); empty when
 * the sheet or ffmpeg is missing, the reason in `warnings`. `readImage` reads the WebP (newGunInstall.ts, ffmpeg).
 */
export function secondWaveDrawings(
    dir: string,
    readImage: (path: string) => RgbaImage,
    warnings: string[],
    ffmpeg: boolean,
): Map<string, LooseDrawing> {
    const path = join(dir, SECOND_WAVE_ICON_SHEET.file);
    if (!existsSync(path)) {
        warnings.push(
            `${path} missing: the second-wave guns' loot icons are not installed, they show stand-ins ` +
                "(the launchers a first-wave launcher's drawing, the others an original gun's)",
        );
        return new Map();
    }
    if (!ffmpeg) {
        warnings.push(`${path}: ffmpeg / ffprobe are needed to read it (e.g. winget install ffmpeg), stand-ins used`);
        return new Map();
    }
    return namedDrawings(readImage(path), SECOND_WAVE_ICON_SHEET, warnings);
}

/** The second-wave guns' loot icons (128 x 128, gunIcons.ts cutGunIcon) by gun id; the throwables left out. */
export function cutSecondWaveIcons(
    dir: string,
    readImage: (path: string) => RgbaImage,
    warnings: string[],
    ffmpeg: boolean,
): Map<string, RgbaImage> {
    const icons = new Map<string, RgbaImage>();
    for (const [name, drawing] of secondWaveDrawings(dir, readImage, warnings, ffmpeg)) {
        if (!SECOND_WAVE_THROWABLE_DRAWINGS.includes(name)) icons.set(name, cutGunIcon(drawing.image).icon);
    }
    return icons;
}
