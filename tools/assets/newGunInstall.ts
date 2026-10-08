// Installs the owner's art and sound for the beta new guns into the client's asset folder (gitignored), every file the
// client names for them (packages/defs/src/rebirth/newGunAssets.ts), so it never requests a missing one:
// - loot icons, img/rebirth/loot-weapon-<id>.png: cut from the owner's line-art sheets (assets-user/source/
//   2026-10-07-sheets/; gunIcons.ts), the two dual pistols composed from their single, anything without a drawing (the
//   M79; every gun when the sheets or ffmpeg are missing) a copy of the sheet's fallback icon (an original gun's);
// - sounds, audio/rebirth/guns/<name>.mp3: the owner's clip (assets-user/audio/guns/, MANIFEST.md), else a copy of the
//   donor's original file; the original sounds the owner replaced (the AK-47 reload) likewise;
// - the new ammo's ping emotes, img/rebirth/ammo-<id>.png: drawn like the original ammo emotes (ammoEmotes.ts).
// A report of what came from where goes to <dest>/rebirth-new-guns.json. Run by import.ts after the original assets
// are in place, or alone: node tools/assets/newGuns.ts.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AmmoDef } from "../../packages/defs/src/index.ts";
import {
    NEW_AMMO_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    NEW_GUN_LOOT_ICONS,
    NEW_GUN_SOUND_DONORS,
    newAmmoEmoteTexture,
    newGunDefs,
    newGunIconPath,
    newGunSoundPath,
    REPLACED_ORIGINAL_SOUNDS,
} from "../../packages/defs/src/rebirth/index.ts";
import { ammoEmoteIcon } from "./ammoEmotes.ts";
import { cutGunIcon, dualIcon, gridCell } from "./gunIcons.ts";
import { decodePng, encodePng, type RgbaImage } from "./png.ts";

export const SHEET_DIR = "assets-user/source/2026-10-07-sheets";
export const USER_AUDIO = "assets-user/audio/guns";
const SPRITE_MANIFEST = "apps/client/src/generated/sprite-manifest.json";
const SOUND_DEFS = "apps/client/src/generated/sound-defs.json";

export interface SheetLayout {
    file: string;
    cols: number;
    rows: number;
    /** gun id of each cell, row by row; null for a cell that is not cut */
    cells: ReadonlyArray<string | null>;
}

/**
 * The owner's five sheets of 2026-10-07 (two columns, three rows each) and the redrawn sheet 17: its FN FAL cell
 * replaces sheet 17's, which drew the SPAS-15's picture (survev-content-and-new-guns.md section 8). The SPAS-15 of
 * sheet 18 is dropped (survev's SPAS-16 covers it); the M79 has no drawing.
 */
export const SHEETS: readonly SheetLayout[] = [
    { file: "15.webp", cols: 2, rows: 3, cells: ["dp12", "m202", "mg42", "m1928", "panzerfaust", "m200"] },
    { file: "16.webp", cols: 2, rows: 3, cells: ["g3", "sig550", "p90", "mgl", "gl06", "honeybadger"] },
    { file: "17.webp", cols: 2, rows: 3, cells: ["m60", "mk14", "dshk", "rpg7", "bizon", null] },
    { file: "21-fal-fixed.png", cols: 2, rows: 3, cells: [null, null, null, null, null, "fal"] },
    { file: "18.webp", cols: 2, rows: 3, cells: ["boys", "ak74", "m16a4", "g36c", "vz61", null] },
    { file: "19.webp", cols: 2, rows: 3, cells: ["aa12", "wa2000", "hecate", "lynx", "asval", "tec9"] },
];

/** Dual pistols whose icon is composed from the single's. */
export const DUAL_ICONS: Readonly<Record<string, string>> = { tec9_dual: "tec9", vz61_dual: "vz61" };

export type AssetOrigin = "owner" | "composed" | "drawn" | "fallback" | "missing";

export interface InstallReport {
    icons: Record<string, { file: string; origin: AssetOrigin; from: string }>;
    sounds: Record<string, { file: string; origin: AssetOrigin; from: string }>;
    /** the new ammo's ping emote icons, by ammo id */
    emotes: Record<string, { file: string; origin: AssetOrigin; from: string }>;
    warnings: string[];
}

/** RGBA pixels of a PNG (png.ts) or, through ffmpeg, of any other image (the sheets are WebP). */
export function readImage(path: string): RgbaImage {
    if (path.toLowerCase().endsWith(".png")) return decodePng(readFileSync(path));
    const size = execFileSync(
        "ffprobe",
        ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
        { encoding: "utf8" },
    ).trim();
    const [width, height] = size.split(",").map(Number) as [number, number];
    if (!(width > 0 && height > 0)) throw new Error(`${path}: cannot read its size (${size})`);
    const raw = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
        maxBuffer: width * height * 4 + (1 << 20),
    });
    if (raw.length !== width * height * 4) throw new Error(`${path}: ffmpeg gave ${raw.length} bytes`);
    return { width, height, data: new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength) };
}

function hasFfmpeg(): boolean {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
        execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/** Every loot icon cut from the sheets, by gun id (duals composed); `warnings` collects what could not be read. */
export function cutSheetIcons(sheetDir: string, warnings: string[]): Map<string, RgbaImage> {
    const icons = new Map<string, RgbaImage>();
    if (!existsSync(sheetDir)) {
        warnings.push(`${sheetDir} missing: the fallback loot icons are used`);
        return icons;
    }
    const ffmpeg = hasFfmpeg();
    for (const sheet of SHEETS) {
        const path = join(sheetDir, sheet.file);
        if (!existsSync(path)) {
            warnings.push(`${path} missing`);
            continue;
        }
        if (!path.endsWith(".png") && !ffmpeg) {
            warnings.push(`${path}: ffmpeg / ffprobe are needed to read it`);
            continue;
        }
        const img = readImage(path);
        sheet.cells.forEach((id, i) => {
            if (!id) return;
            const cell = gridCell(img, sheet.cols, sheet.rows, i % sheet.cols, Math.floor(i / sheet.cols));
            icons.set(id, cutGunIcon(cell).icon);
        });
    }
    for (const [dual, single] of Object.entries(DUAL_ICONS)) {
        const icon = icons.get(single);
        if (icon) icons.set(dual, dualIcon(icon));
    }
    return icons;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function copyInto(dest: string, rel: string, from: string): void {
    mkdirSync(dirname(join(dest, rel)), { recursive: true });
    copyFileSync(from, join(dest, rel));
}

/** The original file of a sound name (any list of the client's sound defs), or undefined. */
function originalSoundPath(name: string, lists: Record<string, Record<string, { path: string }>>): string | undefined {
    for (const list of Object.values(lists)) if (Object.hasOwn(list, name)) return list[name]!.path;
    return undefined;
}

export interface InstallOptions {
    /** the client's asset folder (apps/client/public/assets) */
    dest: string;
    sheetDir?: string;
    userAudio?: string;
}

/** Installs every new-gun loot icon and sound into `dest`; see the header. */
export function installNewGunAssets(options: InstallOptions): InstallReport {
    const { dest, sheetDir = SHEET_DIR, userAudio = USER_AUDIO } = options;
    const report: InstallReport = { icons: {}, sounds: {}, emotes: {}, warnings: [] };
    const sprites = readJson<Record<string, { path?: string }>>(SPRITE_MANIFEST);
    const cut = cutSheetIcons(sheetDir, report.warnings);
    for (const [id, sprite] of Object.entries(NEW_GUN_LOOT_ICONS)) {
        const file = newGunIconPath(sprite);
        const icon = cut.get(id);
        if (icon) {
            mkdirSync(dirname(join(dest, file)), { recursive: true });
            writeFileSync(join(dest, file), encodePng(icon));
            report.icons[id] = { file, origin: DUAL_ICONS[id] ? "composed" : "owner", from: sheetDir };
            continue;
        }
        const fallback = NEW_GUN_LOOT_FALLBACKS[id]!;
        const src = sprites[fallback]?.path;
        if (src?.endsWith(".png") && existsSync(join(dest, src))) {
            copyInto(dest, file, join(dest, src));
            report.icons[id] = { file, origin: "fallback", from: fallback };
        } else {
            report.icons[id] = { file, origin: "missing", from: fallback };
            report.warnings.push(`no loot icon for ${id}: ${fallback} has no PNG in ${dest} (run pnpm assets)`);
        }
    }
    const lists = readJson<{ lists: Record<string, Record<string, { path: string }>> }>(SOUND_DEFS).lists;
    const names: Array<[string, string]> = [
        ...Object.entries(NEW_GUN_SOUND_DONORS),
        ...REPLACED_ORIGINAL_SOUNDS.map((n): [string, string] => [n, n]),
    ];
    for (const [name, donor] of names) {
        const file = newGunSoundPath(name);
        const own = join(userAudio, `${name}.mp3`);
        if (existsSync(own)) {
            copyInto(dest, file, own);
            report.sounds[name] = { file, origin: "owner", from: own };
            continue;
        }
        const src = originalSoundPath(donor, lists);
        if (src && existsSync(join(dest, src))) {
            copyInto(dest, file, join(dest, src));
            report.sounds[name] = { file, origin: "fallback", from: donor };
        } else {
            report.sounds[name] = { file, origin: "missing", from: donor };
            report.warnings.push(`no sound for ${name}: its donor ${donor} has no file in ${dest} (run pnpm assets)`);
        }
    }
    const defs = newGunDefs();
    for (const ammo of NEW_AMMO_IDS) {
        const file = newGunIconPath(newAmmoEmoteTexture(ammo));
        const tint = (defs[ammo] as AmmoDef).lootImg.tint;
        mkdirSync(dirname(join(dest, file)), { recursive: true });
        writeFileSync(join(dest, file), encodePng(ammoEmoteIcon(tint)));
        report.emotes[ammo] = { file, origin: "drawn", from: `loot tint 0x${tint.toString(16).padStart(6, "0")}` };
    }
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "rebirth-new-guns.json"), `${JSON.stringify(report, null, 1)}\n`);
    return report;
}

/** One line per origin: "icons: 29 owner, 2 composed, 1 fallback". */
export function summarize(report: InstallReport): string[] {
    const count = (rows: Record<string, { origin: AssetOrigin }>) => {
        const by: Record<string, number> = {};
        for (const r of Object.values(rows)) by[r.origin] = (by[r.origin] ?? 0) + 1;
        return Object.entries(by)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");
    };
    const fallbackIcons = Object.entries(report.icons)
        .filter(([, r]) => r.origin !== "owner" && r.origin !== "composed")
        .map(([id, r]) => `${id} (${r.from})`);
    return [
        `new-gun loot icons: ${count(report.icons)}${fallbackIcons.length ? `; fallback: ${fallbackIcons.join(", ")}` : ""}`,
        `new-gun sounds: ${count(report.sounds)}`,
        `new ammo ping emotes: ${count(report.emotes)}`,
        ...report.warnings.map((w) => `WARNING: ${w}`),
    ];
}
