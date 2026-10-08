// Loudness levelling of the owner's gun clips at install time (newGunInstall.ts), so a new gun plays as loud as the
// original guns of its class (owner, 2026-10-08: "the volume is far too weak"). The owner's recordings were all cut to
// one target (assets-user/audio/guns/MANIFEST.md: fire -14.6 LUFS, reload / switch / cycle at the originals' overall
// medians), while the original guns grow louder with their class: snipers, LMGs and shotguns 2 LU above the owner's.
// Method (the MANIFEST's): ffmpeg ebur128 integrated loudness of the file with 0.4 s of silence before and after, as
// stereo when the file is stereo, plus the sound def's volume in dB (the gain the client applies on top). The targets
// below are the medians of the original and survev guns' own sounds measured that way on the installed files
// (`node tools/assets/loudness.ts --measure` prints them again): fire by gun class without the suppressed guns; reload
// and switch by class; cycle and pull overall (only snipers and pump shotguns have them). The launchers, a class the
// originals lack, take the shotgun median for their fire (the USAS-12's explosive rounds are a shotgun's) and the
// overall medians for the rest.
// A clip is levelled by a gain; a raised one then goes through a tanh soft clipper (the owner's clips arrive limited,
// so a plain gain would only raise their peaks: the MANIFEST's own cuts used a soft clipper for the same reason) and a
// look-ahead limiter at -2 dBFS (room for the mp3 encoder's overshoot; the client scales every sound by 0.25 or less
// before its master bus anyway), and the written file is measured again and corrected, three times at most. A reload clip
// longer than its gun's reload time, which the client cuts when the reload completes, is sped up by at most 25 % and
// then faded out at the reload time. Without ffmpeg the clips are copied as they are (the installer warns).
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type SoundRole = "fire" | "reload" | "switch" | "cycle" | "pull";

/** Integrated loudness targets in LUFS (file loudness + def volume), by role and gun class ("*": any other class). */
export const LOUDNESS_TARGETS: Readonly<Record<SoundRole, Readonly<Record<string, number>>>> = {
    fire: {
        assault: -15.4,
        dmr: -13.35,
        sniper: -11.95,
        pistol: -14.25,
        smg: -15.75,
        shotgun: -12.45,
        lmg: -12.75,
        launcher: -12.45,
        "*": -13.5,
    },
    reload: {
        assault: -19.45,
        dmr: -19.45,
        sniper: -18.72,
        pistol: -19.3,
        smg: -18.95,
        shotgun: -20.78,
        lmg: -16.88,
        "*": -19.4,
    },
    switch: {
        assault: -17.75,
        dmr: -16.18,
        sniper: -19.3,
        pistol: -18.7,
        smg: -15.7,
        shotgun: -16.8,
        lmg: -16.29,
        "*": -17.7,
    },
    cycle: { "*": -19.45 },
    pull: { "*": -19.4 },
};

/** A clip closer than this to its target is copied unchanged (the measurement's own spread). */
export const LEVEL_TOLERANCE = 0.5;
/** a levelled clip is measured again and corrected until it is this close (re-encoding and the limiter shift it) */
const PASS_TOLERANCE = 0.25;
/** the limiter's ceiling (-2 dBFS: room for the mp3 encoder's overshoot) */
const LIMIT = 0.794;
/** a raised clip gets at most this much gain */
const MAX_GAIN_DB = 12;
/** a long reload clip is sped up by at most this factor before it is faded out at the reload time */
export const MAX_TEMPO = 1.25;
const FADE_OUT = 0.15;

/** The target of a sound with `role` on a gun of class `gunClass`. */
export function loudnessTarget(role: SoundRole, gunClass: string | undefined): number {
    const row = LOUDNESS_TARGETS[role];
    return row[gunClass ?? "*"] ?? row["*"]!;
}

export function hasFfmpeg(): boolean {
    try {
        return (
            spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0 &&
            spawnSync("ffprobe", ["-version"], { stdio: "ignore" }).status === 0
        );
    } catch {
        return false;
    }
}

/** Integrated loudness (LUFS) of an audio file, padded with 0.4 s of silence each side; undefined if unreadable. */
export function measureLoudness(file: string): number | undefined {
    const res = spawnSync(
        "ffmpeg",
        ["-hide_banner", "-nostats", "-i", file, "-af", "adelay=400:all=1,apad=pad_dur=0.4,ebur128", "-f", "null", "-"],
        { encoding: "utf8" },
    );
    const m = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(res.stderr ?? "");
    return m ? Number(m[1]) : undefined;
}

/** Duration of an audio file in seconds (ffprobe), undefined if unreadable. */
export function audioDuration(file: string): number | undefined {
    const res = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
        encoding: "utf8",
    });
    const d = Number.parseFloat(res.stdout ?? "");
    return Number.isFinite(d) ? d : undefined;
}

export interface Processing {
    /** gain in dB before the limiter (0: none) */
    gainDb: number;
    /** playback speed factor (1: none) */
    tempo: number;
    /** fade out and end the clip here, in seconds of the output (undefined: keep its length) */
    endAt?: number;
}

/** The tempo and end of a reload clip of `duration` s for a reload of `reloadTime` s (see the header). */
export function fitReload(duration: number, reloadTime: number): Pick<Processing, "tempo" | "endAt"> {
    if (!(reloadTime > 0) || duration <= reloadTime + 0.1) return { tempo: 1 };
    const tempo = Math.min(MAX_TEMPO, duration / reloadTime);
    return duration / tempo > reloadTime + 0.05 ? { tempo, endAt: reloadTime } : { tempo };
}

/** Writes `src` processed by `p` to `dest` as a VBR mp3 (about 190 kb/s, 48 kHz, the source's channels). */
export function processClip(src: string, dest: string, p: Processing): void {
    const filters: string[] = [];
    if (p.gainDb !== 0) filters.push(`volume=${p.gainDb.toFixed(2)}dB`);
    if (p.gainDb > 0) filters.push("asoftclip=type=tanh");
    // always: a decoded mp3 can sit near full scale before the next encode
    filters.push(`alimiter=limit=${LIMIT}:attack=1:release=20:level=0:latency=1`);
    if (p.tempo !== 1) filters.push(`atempo=${p.tempo.toFixed(4)}`);
    if (p.endAt !== undefined) {
        const start = Math.max(0, p.endAt - FADE_OUT);
        filters.push(`afade=t=out:st=${start.toFixed(3)}:d=${FADE_OUT}`, `atrim=end=${p.endAt.toFixed(3)}`);
    }
    const args = ["-hide_banner", "-v", "error", "-y", "-i", src];
    if (filters.length) args.push("-af", filters.join(","));
    args.push("-ar", "48000", "-c:a", "libmp3lame", "-q:a", "2", "-map_metadata", "-1", dest);
    const res = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (res.status !== 0) throw new Error(`ffmpeg failed on ${src}: ${res.stderr}`);
}

export interface LevelResult {
    /** loudness of the source and of the written file (file loudness, without the def volume) */
    before: number;
    after: number;
    gainDb: number;
}

/**
 * Levels `src` into `dest` so its file loudness reaches `want` LUFS (keeping any tempo / end in `fit`); returns
 * undefined when the source cannot be measured. A clip already within LEVEL_TOLERANCE that needs no fitting is copied
 * as it is; any other is written, measured again and corrected three times at most, since re-encoding (the encoder's
 * low-pass takes some of the K-weighted top end) and the limiter on a raised clip shift its loudness.
 */
export function levelClip(
    src: string,
    dest: string,
    want: number,
    fit: Pick<Processing, "tempo" | "endAt"> = { tempo: 1 },
): LevelResult | undefined {
    const before = measureLoudness(src);
    if (before === undefined) return undefined;
    const clamp = (g: number) => Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, g));
    if (Math.abs(want - before) <= LEVEL_TOLERANCE && fit.tempo === 1 && fit.endAt === undefined) {
        copyFileSync(src, dest);
        return { before, after: before, gainDb: 0 };
    }
    let gainDb = clamp(want - before);
    processClip(src, dest, { ...fit, gainDb });
    let after = measureLoudness(dest) ?? before + gainDb;
    for (let pass = 0; pass < 3 && Math.abs(want - after) > PASS_TOLERANCE; pass++) {
        const next = clamp(gainDb + (want - after));
        if (next === gainDb) break;
        gainDb = next;
        processClip(src, dest, { ...fit, gainDb });
        after = measureLoudness(dest) ?? after;
    }
    return { before, after, gainDb: Number(gainDb.toFixed(2)) };
}

/** `node tools/assets/loudness.ts --measure`: the medians behind LOUDNESS_TARGETS, from the installed originals. */
async function printMeasuredTargets(): Promise<void> {
    const { GameObjectDefs, gunClass, NEW_GUN_IDS } = await import("../../packages/defs/src/index.ts");
    const lists = JSON.parse(readFileSync("apps/client/src/generated/sound-defs.json", "utf8")).lists as Record<
        string,
        Record<string, { path: string; volume?: number }>
    >;
    const fields: Record<string, SoundRole> = {
        shoot: "fire",
        reload: "reload",
        deploy: "switch",
        cycle: "cycle",
        pull: "pull",
    };
    const values: Record<string, Record<string, number[]>> = {};
    const seen = new Set<string>();
    for (const [id, def] of Object.entries(GameObjectDefs)) {
        if (def.type !== "gun" || NEW_GUN_IDS.includes(id)) continue;
        const cls = gunClass(id) ?? "*";
        const suppressed = (GameObjectDefs[def.bulletType] as { suppressed?: boolean } | undefined)?.suppressed;
        for (const [field, role] of Object.entries(fields)) {
            const name = (def.sound as Record<string, unknown>)[field];
            const sd = typeof name === "string" ? lists.players?.[name] : undefined;
            if (typeof name !== "string" || !sd || name === "gun_switch_01" || (role === "fire" && suppressed))
                continue;
            const key = `${cls}|${role}|${name}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const lufs = measureLoudness(`apps/client/public/assets/${sd.path}`);
            if (lufs === undefined) continue;
            const v = lufs + 20 * Math.log10(sd.volume ?? 1);
            for (const c of [cls, "*"]) ((values[role] ??= {})[c] ??= []).push(v);
        }
    }
    const median = (a: number[]) => {
        const s = [...a].sort((x, y) => x - y);
        const m = s.length >> 1;
        return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
    };
    for (const [role, byClass] of Object.entries(values)) {
        const row = Object.entries(byClass).map(([c, v]) => `${c} ${median(v).toFixed(2)} (n ${v.length})`);
        console.log(`${role}: ${row.join(", ")}`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--measure")) {
    await printMeasuredTargets();
}
