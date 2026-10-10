// The new guns' asset install (newGunInstall.ts) on a machine without the owner's gitignored assets-user/ folder (the
// owner's own case, 2026-10-08): every icon and sound the client names is written, the launchers get our own drawn
// icons (all six different), the rest an original gun's icon and sound; the committed drawn SVGs are current; and the
// loudness helpers (loudness.ts) level a clip to its target and fit a long reload clip to its reload time.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
    DRAWN_LOOT_ICONS,
    drawnLootIconSprite,
    NEW_AMMO_IDS,
    NEW_GUN_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    NEW_GUN_SOUND_DONORS,
    REPLACED_ORIGINAL_SOUNDS,
} from "../../packages/defs/src/rebirth/index.ts";
import {
    audioDuration,
    fitReload,
    hasFfmpeg,
    LOUDNESS_TARGETS,
    levelClip,
    loudnessTarget,
    MAX_TEMPO,
    measureLoudness,
} from "./loudness.ts";
import { installNewGunAssets, installPlan, soundUses, summarize } from "./newGunInstall.ts";
import { decodePng } from "./png.ts";
import { drawnLootIconSvgs } from "./rebirthLootIcons.ts";

const SPRITES = JSON.parse(readFileSync("apps/client/src/generated/sprite-manifest.json", "utf8")) as Record<
    string,
    { path?: string }
>;
const LISTS = JSON.parse(readFileSync("apps/client/src/generated/sound-defs.json", "utf8")).lists as Record<
    string,
    Record<string, { path: string }>
>;
const tmp = mkdtempSync(join(tmpdir(), "rebirth-newguns-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Writes `bytes` at `rel` under `root`. */
function put(root: string, rel: string, bytes: string | Uint8Array): void {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), bytes);
}

describe("new-gun asset install without assets-user", () => {
    // an asset folder holding only the original files the stand-ins are copied from
    const dest = join(tmp, "assets");
    for (const icon of Object.values(NEW_GUN_LOOT_FALLBACKS)) {
        const path = SPRITES[icon]?.path;
        if (path) put(dest, path, `png ${icon}`);
    }
    for (const donor of new Set([...Object.values(NEW_GUN_SOUND_DONORS), ...REPLACED_ORIGINAL_SOUNDS])) {
        const def = Object.values(LISTS).find((l) => Object.hasOwn(l, donor))?.[donor];
        if (def) put(dest, def.path, `mp3 ${donor}`);
    }
    const report = installNewGunAssets({
        dest,
        sheetDir: join(tmp, "no-sheets"),
        secondWaveSheetDir: join(tmp, "no-second-wave"),
        userAudio: join(tmp, "no-audio"),
        ffmpeg: false,
    });

    it("writes every file of the plan, nothing missing", () => {
        const plan = installPlan();
        expect(plan.icons).toHaveLength(NEW_GUN_IDS.length);
        expect(plan.emotes).toHaveLength(NEW_AMMO_IDS.length);
        for (const file of [...plan.icons, ...plan.sounds, ...plan.emotes]) {
            expect(existsSync(join(dest, file)), file).toBe(true);
        }
        const rows = [...Object.values(report.icons), ...Object.values(report.sounds), ...Object.values(report.emotes)];
        expect(rows.filter((r) => r.origin === "missing")).toEqual([]);
        expect(rows.map((r) => r.file).sort()).toEqual([...plan.icons, ...plan.sounds, ...plan.emotes].sort());
        expect(existsSync(join(dest, "rebirth-new-guns.json"))).toBe(true);
    });

    it("stand-ins: the launchers' drawn icons (six different), the others an original's; donor sounds", () => {
        const drawn = new Set<string>();
        for (const id of NEW_GUN_IDS) {
            const row = report.icons[id]!;
            const bytes = readFileSync(join(dest, row.file));
            if (DRAWN_LOOT_ICONS.map(drawnLootIconSprite).includes(NEW_GUN_LOOT_FALLBACKS[id]!)) {
                expect(row.origin, id).toBe(DRAWN_LOOT_ICONS.includes(id) ? "drawn" : "fallback");
                const img = decodePng(bytes);
                expect([img.width, img.height], id).toEqual([128, 128]);
                let opaque = 0;
                for (let i = 3; i < img.data.length; i += 4) if (img.data[i]! > 128) opaque++;
                expect(opaque, id).toBeGreaterThan(1500);
                if (DRAWN_LOOT_ICONS.includes(id)) drawn.add(Buffer.from(bytes).toString("base64"));
            } else {
                expect(row, id).toMatchObject({ origin: "fallback", from: NEW_GUN_LOOT_FALLBACKS[id] });
                expect(bytes.toString(), id).toBe(`png ${NEW_GUN_LOOT_FALLBACKS[id]}`);
            }
        }
        expect(drawn.size).toBe(DRAWN_LOOT_ICONS.length);
        for (const [name, donor] of Object.entries(NEW_GUN_SOUND_DONORS)) {
            expect(report.sounds[name], name).toMatchObject({ origin: "fallback", from: donor });
            expect(readFileSync(join(dest, report.sounds[name]!.file)).toString(), name).toBe(`mp3 ${donor}`);
        }
    });

    it("says plainly that the owner's files and ffmpeg are missing", () => {
        const text = summarize(report).join("\n");
        expect(text).toContain("no-audio missing: the owner's gun sounds are not installed");
        expect(text).toContain("no-sheets missing: the owner's loot icons are not installed");
        expect(text).toContain("second-wave-icons.webp missing: the second-wave guns' loot icons are not installed");
        expect(text).toContain("ffmpeg / ffprobe not found");
        expect(text).toContain("assets-user/");
    });
});

describe("drawn launcher loot icons", () => {
    it("the committed SVGs under apps/client/public/rebirth/loot/ are current", () => {
        const svgs = drawnLootIconSvgs();
        expect(svgs.size).toBe(DRAWN_LOOT_ICONS.length);
        for (const [file, text] of svgs) {
            expect(existsSync(file), file).toBe(true);
            expect(readFileSync(file, "utf8"), `${file} is stale: rerun tools/assets/rebirthLootIcons.ts`).toBe(text);
            expect(text).toContain('width="128" height="128"');
        }
    });
});

describe("sound roles and loudness targets", () => {
    it("every new-gun sound has a role and a class; a reload knows its reload time", () => {
        const uses = soundUses();
        for (const name of Object.keys(NEW_GUN_SOUND_DONORS)) {
            const use = uses.get(name);
            expect(use, name).toBeDefined();
            if (use!.role === "reload") expect(use!.reloadTime, name).toBeGreaterThan(0);
        }
        expect(uses.get("rpg7_01")).toMatchObject({ role: "fire", gunClass: "launcher" });
        expect(uses.get("mg42_reload_01")).toMatchObject({ role: "reload", gunClass: "lmg", reloadTime: 4 });
        // the AK-47's reload: an original sound the owner replaced, with the AK-47's own reload time
        expect(uses.get("ak47_reload_01")).toMatchObject({ role: "reload", gunClass: "assault", reloadTime: 2.5 });
        expect(uses.get("panzerfaust_discard_01")?.role).toBe("discard");
    });

    it("targets: the louder classes louder, a class without its own row takes the overall median", () => {
        expect(loudnessTarget("fire", "sniper")).toBeGreaterThan(loudnessTarget("fire", "assault"));
        expect(loudnessTarget("fire", "lmg")).toBeGreaterThan(loudnessTarget("fire", "smg"));
        expect(loudnessTarget("reload", "launcher")).toBe(LOUDNESS_TARGETS.reload["*"]);
        expect(loudnessTarget("cycle", "sniper")).toBe(LOUDNESS_TARGETS.cycle["*"]);
    });

    it("a long reload clip is sped up by at most 25 %, then faded out at the reload time", () => {
        expect(fitReload(2.4, 2.5)).toEqual({ tempo: 1 });
        expect(fitReload(5.12, 4.5)).toEqual({ tempo: 5.12 / 4.5 });
        expect(fitReload(7.01, 4)).toEqual({ tempo: MAX_TEMPO, endAt: 4 });
        expect(fitReload(2, 0)).toEqual({ tempo: 1 });
    });

    it("the levelling passes need not converge: the closest one is written, not the last", () => {
        // the Mk 14 switch clip's curve (review, 2026-10-08): -14.3 LUFS, no soft clip up to 0 dB of gain (the limiter
        // alone takes 2.8 LU off), the soft clipper's jump above it; target -16.18
        const curve = (g: number) => (g > 0 ? -15.9 + 0.6 * g : -17.1 + 0.53 * g);
        const written: number[] = [];
        let last = 0;
        const tools = {
            process: (_src: string, _dest: string, p: { gainDb: number }) => {
                written.push(p.gainDb);
                last = p.gainDb;
            },
            measure: (file: string) => (file === "src.mp3" ? -14.3 : Number(curve(last).toFixed(2))),
        };
        const res = levelClip("src.mp3", "dest.mp3", -16.18, { tempo: 1 }, tools)!;
        // passes: -1.88 -> -18.1, 0.04 -> -15.88, -0.26 -> -17.24, 0.8 -> -15.42; the second is the closest
        expect(written).toHaveLength(5);
        expect(written.at(-1)).toBeCloseTo(0.04, 6);
        expect(res.gainDb).toBe(0.04);
        expect(res.after).toBeCloseTo(-15.88, 2);
    });
});

describe.runIf(hasFfmpeg())("levelling a clip (ffmpeg)", () => {
    const src = join(tmp, "burst.mp3");
    // a 0.5 s noise burst with a decay, like a shot
    spawnSync("ffmpeg", [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anoisesrc=d=0.5:c=pink:a=0.3,afade=t=out:st=0.05:d=0.45",
        "-ar",
        "48000",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        src,
    ]);

    // up to a dozen ffmpeg runs: the default 5 s timed out once with the other test files running in parallel
    it("lowers and raises a clip to its target within 0.6 LU, and fits its length", { timeout: 60_000 }, () => {
        const before = measureLoudness(src)!;
        expect(before).toBeLessThan(-5);
        for (const want of [before - 4, before + 4]) {
            const out = join(tmp, `level-${want.toFixed(1)}.mp3`);
            const res = levelClip(src, out, want)!;
            expect(Math.abs(res.after - want), `${want}`).toBeLessThan(0.6);
            expect(Math.abs(measureLoudness(out)! - want)).toBeLessThan(0.6);
        }
        const fitted = join(tmp, "fitted.mp3");
        levelClip(src, fitted, before, { tempo: 1.25, endAt: 0.3 });
        expect(audioDuration(fitted)!).toBeLessThan(0.4);
    });
});
