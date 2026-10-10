// Installs the owner's art and sound for the beta new guns into the client's asset folder (gitignored), every file the
// client names for them (packages/defs/src/rebirth/newGunAssets.ts; installPlan lists them), so it never requests a
// missing one, with or without the owner's gitignored assets-user/ folder:
// - loot icons, img/rebirth/loot-weapon-<id>.png: cut from the owner's line-art sheets (assets-user/source/
//   2026-10-07-sheets/; gunIcons.ts), the second wave's from the owner's loose sheet of 2026-10-10
//   (secondWaveSheets.ts), the two dual pistols composed from their single; anything without a drawing (the M79; every
//   gun when the sheets or ffmpeg are missing) gets its fallback icon: the launchers our own drawn icon
//   (rebirthLootIcons.ts, rasterized here), the others a copy of an original gun's of the same class;
// - sounds, audio/rebirth/guns/<name>.mp3: the owner's clip (assets-user/audio/guns/, MANIFEST.md) levelled to the
//   original guns of its class (loudness.ts), else a copy of the donor's original file; the original sounds the owner
//   replaced (the AK-47 reload) likewise; a reload clip longer than its reload is fitted to it (loudness.ts fitReload);
// - the new ammo's ping emotes, img/rebirth/ammo-<id>.png: drawn like the original ammo emotes (ammoEmotes.ts);
// - the owner's held sprites, img/rebirth/gun-<id>-owner-01.png, from the top-down sheets of 2026-10-10 where they are
//   there (ownerHeldArt.ts); nothing otherwise, the client then keeps the bar.
// Levelling, fitting and the WebP sheets need ffmpeg / ffprobe on the PATH; without them the clips are copied as they
// are and the installer says so. A report of what came from where goes to <dest>/rebirth-new-guns.json. Run by
// import.ts after the original assets are in place, or alone: node tools/assets/newGuns.ts.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type AmmoDef, GameObjectDefs, type GunDef, gunClass } from "../../packages/defs/src/index.ts";
import {
    DRAWN_LOOT_ICONS,
    drawnLootIconSprite,
    NEW_AMMO_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    NEW_GUN_LOOT_ICONS,
    NEW_GUN_SOUND_DONORS,
    newAmmoEmoteTexture,
    newGunDefs,
    newGunIconPath,
    newGunSoundPath,
    OWNER_HELD_GUN_ART,
    ownerHeldGunArtPath,
    REPLACED_ORIGINAL_SOUNDS,
} from "../../packages/defs/src/rebirth/index.ts";
import { ammoEmoteIcon } from "./ammoEmotes.ts";
import { cutGunIcon, dualIcon, gridCell } from "./gunIcons.ts";
import {
    audioDuration,
    fitReload,
    hasFfmpeg,
    levelClip,
    loudnessTarget,
    type Processing,
    processClip,
    type SoundRole,
} from "./loudness.ts";
import { installOwnerHeldArt, type OwnerHeldRow } from "./ownerHeldArt.ts";
import { decodePng, encodePng, type RgbaImage } from "./png.ts";
import { drawnLootIconImage } from "./rebirthLootIcons.ts";
import { cutSecondWaveIcons, SECOND_WAVE_SHEET_DIR } from "./secondWaveSheets.ts";

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

export interface InstalledAsset {
    file: string;
    origin: AssetOrigin;
    from: string;
}

export interface InstalledSound extends InstalledAsset {
    /** loudness of the source and of the installed file in LUFS (file loudness; the def volume is added on top) */
    lufs?: [number, number];
    /** the file loudness it was levelled to (the class target less the def volume) and the gain applied */
    target?: number;
    gainDb?: number;
    /** a reload clip fitted to its reload: speed factor and end time */
    tempo?: number;
    endAt?: number;
}

export interface InstallReport {
    icons: Record<string, InstalledAsset>;
    sounds: Record<string, InstalledSound>;
    /** the new ammo's ping emote icons, by ammo id */
    emotes: Record<string, InstalledAsset>;
    /** the owner's held sprites installed from the top-down sheets, by gun id (ownerHeldArt.ts) */
    held: Record<string, OwnerHeldRow>;
    /** whether ffmpeg / ffprobe were found (levelling, reload fitting, WebP sheets) */
    ffmpeg: boolean;
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

/** Every loot icon cut from the sheets, by gun id (duals composed); `warnings` collects what could not be read. */
export function cutSheetIcons(sheetDir: string, warnings: string[], ffmpeg = hasFfmpeg()): Map<string, RgbaImage> {
    const icons = new Map<string, RgbaImage>();
    if (!existsSync(sheetDir)) {
        warnings.push(
            `${sheetDir} missing: the owner's loot icons are not installed, every new gun shows a stand-in icon ` +
                "(the launchers our own drawing, the others an original gun's)",
        );
        return icons;
    }
    for (const sheet of SHEETS) {
        const path = join(sheetDir, sheet.file);
        if (!existsSync(path)) {
            warnings.push(`${path} missing`);
            continue;
        }
        if (!path.endsWith(".png") && !ffmpeg) {
            warnings.push(
                `${path}: ffmpeg / ffprobe are needed to read it (e.g. winget install ffmpeg), stand-ins used`,
            );
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

type SoundLists = Record<string, Record<string, { path: string; volume?: number }>>;

/** The original def (any list of the client's sound defs) of a sound name, or undefined. */
function originalSound(name: string, lists: SoundLists): { path: string; volume?: number } | undefined {
    for (const list of Object.values(lists)) if (Object.hasOwn(list, name)) return list[name];
    return undefined;
}

/** What a sound is to the guns that name it: its role, the first gun's class, and the shortest reload it plays for. */
export interface SoundUse {
    role: SoundRole | "discard";
    gunClass: string | undefined;
    reloadTime?: number;
}

const SOUND_FIELDS: Readonly<Record<string, SoundRole | "discard">> = {
    shoot: "fire",
    reload: "reload",
    reloadAlt: "reload",
    deploy: "switch",
    cycle: "cycle",
    pull: "pull",
    discard: "discard",
};

/** The use of every gun sound name, from every gun def (the new guns first, then the originals). */
export function soundUses(): Map<string, SoundUse> {
    const uses = new Map<string, SoundUse>();
    const guns = Object.entries(GameObjectDefs).filter((e): e is [string, GunDef] => e[1].type === "gun");
    guns.sort(([a], [b]) => Number(!NEW_GUN_LOOT_ICONS[a]) - Number(!NEW_GUN_LOOT_ICONS[b]));
    for (const [id, def] of guns) {
        for (const [field, role] of Object.entries(SOUND_FIELDS)) {
            const name = (def.sound as Record<string, unknown>)[field];
            if (typeof name !== "string" || !name) continue;
            const reloadTime =
                role !== "reload"
                    ? undefined
                    : field === "reloadAlt"
                      ? (def.reloadTimeAlt ?? def.reloadTime)
                      : def.reloadTime;
            const use = uses.get(name);
            if (!use) uses.set(name, { role, gunClass: gunClass(id), reloadTime });
            else if (reloadTime !== undefined && reloadTime > 0) {
                use.reloadTime = Math.min(use.reloadTime ?? Number.POSITIVE_INFINITY, reloadTime);
            }
        }
    }
    return uses;
}

/** Every file installNewGunAssets writes under the asset folder: icons, emotes, held sprites (img/rebirth/), sounds. */
export function installPlan(): { icons: string[]; sounds: string[]; emotes: string[]; held: string[] } {
    return {
        // written only where the owner's top-down sheets are (the client checks which are installed)
        held: Object.keys(OWNER_HELD_GUN_ART).map(ownerHeldGunArtPath),
        icons: Object.values(NEW_GUN_LOOT_ICONS).map(newGunIconPath),
        sounds: [...Object.keys(NEW_GUN_SOUND_DONORS), ...REPLACED_ORIGINAL_SOUNDS].map(newGunSoundPath),
        emotes: NEW_AMMO_IDS.map((ammo) => newGunIconPath(newAmmoEmoteTexture(ammo))),
    };
}

export interface InstallOptions {
    /** the client's asset folder (apps/client/public/assets) */
    dest: string;
    sheetDir?: string;
    /** the owner's second-wave sheets (secondWaveSheets.ts) */
    secondWaveSheetDir?: string;
    userAudio?: string;
    /** force (true) or forbid (false) the ffmpeg steps; default: whether ffmpeg and ffprobe are on the PATH */
    ffmpeg?: boolean;
}

/** Installs one new-gun sound into `dest`: the owner's clip levelled and fitted, else the donor's file. */
function installSound(
    name: string,
    donor: string,
    ctx: { dest: string; userAudio: string; ffmpeg: boolean; lists: SoundLists; uses: Map<string, SoundUse> },
    report: InstallReport,
): void {
    const file = newGunSoundPath(name);
    const out = join(ctx.dest, file);
    const use = ctx.uses.get(name);
    const donorDef = originalSound(donor, ctx.lists);
    const fitFor = (src: string): Pick<Processing, "tempo" | "endAt"> => {
        if (!ctx.ffmpeg || use?.role !== "reload" || use.reloadTime === undefined) return { tempo: 1 };
        const duration = audioDuration(src);
        return duration === undefined ? { tempo: 1 } : fitReload(duration, use.reloadTime);
    };
    const own = join(ctx.userAudio, `${name}.mp3`);
    if (existsSync(own)) {
        mkdirSync(dirname(out), { recursive: true });
        const row: InstalledSound = { file, origin: "owner", from: own };
        const fit = fitFor(own);
        if (ctx.ffmpeg && use && use.role !== "discard") {
            // the client plays it at the donor's def volume (audio/rebirthSounds.ts), on top of the file's loudness
            const volumeDb = 20 * Math.log10(donorDef?.volume ?? 1);
            const target = Number((loudnessTarget(use.role, use.gunClass) - volumeDb).toFixed(2));
            const levelled = levelClip(own, out, target, fit);
            if (levelled) {
                Object.assign(row, { lufs: [levelled.before, levelled.after], target, gainDb: levelled.gainDb });
            } else {
                copyFileSync(own, out);
                report.warnings.push(`${own}: cannot measure its loudness, copied as it is`);
            }
        } else {
            copyFileSync(own, out);
        }
        if (fit.tempo !== 1 && row.lufs) row.tempo = Number(fit.tempo.toFixed(3));
        if (fit.endAt !== undefined && row.lufs) row.endAt = fit.endAt;
        report.sounds[name] = row;
        return;
    }
    const src = donorDef ? join(ctx.dest, donorDef.path) : undefined;
    if (!src || !existsSync(src)) {
        report.sounds[name] = { file, origin: "missing", from: donor };
        report.warnings.push(`no sound for ${name}: its donor ${donor} has no file in ${ctx.dest} (run pnpm assets)`);
        return;
    }
    // an original sound the owner replaced stays the original file when the owner's is missing
    const fit = name === donor ? { tempo: 1 } : fitFor(src);
    mkdirSync(dirname(out), { recursive: true });
    const row: InstalledSound = { file, origin: "fallback", from: donor };
    if (fit.tempo !== 1 || fit.endAt !== undefined) {
        processClip(src, out, { gainDb: 0, ...fit });
        row.tempo = Number(fit.tempo.toFixed(3));
        if (fit.endAt !== undefined) row.endAt = fit.endAt;
    } else {
        copyFileSync(src, out);
    }
    report.sounds[name] = row;
}

/** Installs every new-gun loot icon and sound into `dest`; see the header. */
export function installNewGunAssets(options: InstallOptions): InstallReport {
    const { dest, sheetDir = SHEET_DIR, secondWaveSheetDir = SECOND_WAVE_SHEET_DIR, userAudio = USER_AUDIO } = options;
    const ffmpeg = options.ffmpeg ?? hasFfmpeg();
    const report: InstallReport = { icons: {}, sounds: {}, emotes: {}, held: {}, ffmpeg, warnings: [] };
    if (!ffmpeg) {
        report.warnings.push(
            "ffmpeg / ffprobe not found on the PATH: the owner's WebP sheets cannot be cut, and the owner's clips are " +
                "copied without levelling them to the original guns' loudness (install ffmpeg, e.g. " +
                "`winget install ffmpeg` on Windows, then run pnpm assets again)",
        );
    }
    if (!existsSync(userAudio)) {
        report.warnings.push(
            `${userAudio} missing: the owner's gun sounds are not installed, every new gun plays a stand-in ` +
                "(an original gun's sound of the same kind)",
        );
    }
    const sprites = readJson<Record<string, { path?: string }>>(SPRITE_MANIFEST);
    const cut = cutSheetIcons(sheetDir, report.warnings, ffmpeg);
    const secondWave = cutSecondWaveIcons(secondWaveSheetDir, readImage, report.warnings, ffmpeg);
    for (const [id, icon] of secondWave) cut.set(id, icon);
    for (const [id, sprite] of Object.entries(NEW_GUN_LOOT_ICONS)) {
        const file = newGunIconPath(sprite);
        const icon = cut.get(id);
        const fallback = NEW_GUN_LOOT_FALLBACKS[id]!;
        // a second-wave launcher without the owner's sheet borrows a first-wave launcher's drawn icon
        const drawnDonor = DRAWN_LOOT_ICONS.find((name) => drawnLootIconSprite(name) === fallback);
        if (icon || drawnDonor) {
            mkdirSync(dirname(join(dest, file)), { recursive: true });
            writeFileSync(join(dest, file), encodePng(icon ?? drawnLootIconImage(drawnDonor!)));
            const origin: AssetOrigin = !icon
                ? DRAWN_LOOT_ICONS.includes(id)
                    ? "drawn"
                    : "fallback"
                : DUAL_ICONS[id]
                  ? "composed"
                  : "owner";
            report.icons[id] = {
                file,
                origin,
                from: icon ? (secondWave.has(id) ? secondWaveSheetDir : sheetDir) : fallback,
            };
            continue;
        }
        const src = sprites[fallback]?.path;
        if (src?.endsWith(".png") && existsSync(join(dest, src))) {
            copyInto(dest, file, join(dest, src));
            report.icons[id] = { file, origin: "fallback", from: fallback };
        } else {
            report.icons[id] = { file, origin: "missing", from: fallback };
            report.warnings.push(`no loot icon for ${id}: ${fallback} has no PNG in ${dest} (run pnpm assets)`);
        }
    }
    report.held = installOwnerHeldArt(dest, secondWaveSheetDir, readImage, report.warnings, ffmpeg);
    const lists = readJson<{ lists: SoundLists }>(SOUND_DEFS).lists;
    const ctx = { dest, userAudio, ffmpeg, lists, uses: soundUses() };
    const names: Array<[string, string]> = [
        ...Object.entries(NEW_GUN_SOUND_DONORS),
        ...REPLACED_ORIGINAL_SOUNDS.map((n): [string, string] => [n, n]),
    ];
    for (const [name, donor] of names) installSound(name, donor, ctx, report);
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

/** One line per origin ("icons: 29 owner, 2 composed, 1 drawn"), what stands in for the owner's files, warnings. */
export function summarize(report: InstallReport): string[] {
    const count = (rows: Record<string, { origin: AssetOrigin }>) => {
        const by: Record<string, number> = {};
        for (const r of Object.values(rows)) by[r.origin] = (by[r.origin] ?? 0) + 1;
        return Object.entries(by)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");
    };
    const standIns = Object.entries(report.icons)
        .filter(([, r]) => r.origin !== "owner" && r.origin !== "composed")
        .map(([id, r]) => `${id} (${r.origin === "drawn" ? "drawn" : r.from})`);
    const sounds = Object.values(report.sounds);
    const owned = sounds.filter((r) => r.origin === "owner");
    const levelled = owned.filter((r) => (r.gainDb ?? 0) !== 0).length;
    const fitted = sounds.filter((r) => r.tempo !== undefined || r.endAt !== undefined).length;
    const lines = [
        `new-gun loot icons: ${count(report.icons)}${standIns.length ? `; stand-ins: ${standIns.join(", ")}` : ""}`,
        `new-gun sounds: ${count(report.sounds)}` +
            (owned.length && report.ffmpeg
                ? `; ${levelled} of the owner's ${owned.length} clips levelled to the original guns of their class`
                : "") +
            (fitted ? `; ${fitted} reload clips fitted to their reload time` : ""),
        `new ammo ping emotes: ${count(report.emotes)}`,
        `owner held sprites: ${Object.keys(report.held).join(", ") || "none (bars)"}`,
    ];
    if (!owned.length || standIns.length === Object.keys(report.icons).length) {
        lines.push(
            "NOTE: the owner's art and sound live only in the gitignored assets-user/ folder; without it the new guns " +
                "show stand-in icons and play original guns' sounds (docs/deploy.md).",
        );
    }
    return [...lines, ...report.warnings.map((w) => `WARNING: ${w}`)];
}
