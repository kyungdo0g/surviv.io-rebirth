// Extracts the original v0.8.82 sound definitions (sound lists with per-sound volumes, channels and random groups)
// from the original client bundle into src/generated/sound-defs.json. Sounds whose mp3 is not in the imported
// assets are dropped, so the client never requests a missing file. M9: keeps `canCoalesce` (impact sounds that merge).
// Usage (repo root): node apps/client/scripts/sound-defs.ts [research-cache/live/app.<hash>.js]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const LIVE = "research-cache/live";
const OUT = "apps/client/src/generated/sound-defs.json";
/** where the audio files live: the imported client assets, else the survev clone they are copied from */
const AUDIO_ROOTS = ["apps/client/public/assets", ".survev/client/public"];

interface SoundDef {
    path: string;
    volume: number;
    maxInstances?: number;
    /** plays of this sound ending within 30 ms of a playing one merge into it (survev createJS canCoalesce) */
    canCoalesce?: boolean;
}

interface SoundModule {
    Sounds: Record<string, Record<string, SoundDef & Record<string, unknown>>>;
    Groups: Record<string, { channel: string; sounds: string[] }>;
    Channels: Record<string, { volume: number; maxRange: number; list: string; type: string }>;
}

/** The object literal starting at `start` (a `{`), found by bracket matching outside strings. */
function objectLiteralAt(src: string, start: number): string {
    let depth = 0;
    let quote = "";
    for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === "\\") i++;
            else if (c === quote) quote = "";
        } else if (c === '"' || c === "'") {
            quote = c;
        } else if (c === "{") {
            depth++;
        } else if (c === "}" && --depth === 0) {
            return src.slice(start, i + 1);
        }
    }
    throw new Error("unterminated object literal");
}

const bundle = process.argv[2] ?? join(LIVE, readdirSync(LIVE).find((f) => /^app\..*\.js$/.test(f))!);
const src = readFileSync(bundle, "utf8");
const marker = src.indexOf("{Sounds:{players:");
if (marker < 0) throw new Error(`no sound module in ${bundle}`);
const mod = runInNewContext(`(${objectLiteralAt(src, marker)})`) as SoundModule;

const audioRoot = AUDIO_ROOTS.find((r) => existsSync(join(r, "audio")));
const missing: string[] = [];
const lists: Record<string, Record<string, SoundDef>> = {};
for (const [list, sounds] of Object.entries(mod.Sounds)) {
    lists[list] = {};
    for (const [name, def] of Object.entries(sounds)) {
        if (audioRoot && !existsSync(join(audioRoot, def.path))) {
            missing.push(def.path);
            continue;
        }
        const out: SoundDef = { path: def.path, volume: def.volume };
        if (def.maxInstances !== undefined) out.maxInstances = def.maxInstances;
        if (def.canCoalesce) out.canCoalesce = true;
        lists[list][name] = out;
    }
}
const result = { channels: mod.Channels, lists, groups: mod.Groups };
writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`);
const count = Object.values(lists).reduce((n, l) => n + Object.keys(l).length, 0);
console.log(`${count} sounds, ${Object.keys(mod.Groups).length} groups, ${Object.keys(mod.Channels).length} channels`);
console.log(audioRoot ? `checked against ${audioRoot}` : "audio files not found: existence not checked");
if (missing.length) console.log(`dropped ${missing.length} without a file: ${missing.join(", ")}`);
