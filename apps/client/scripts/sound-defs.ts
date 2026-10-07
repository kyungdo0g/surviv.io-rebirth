// Extracts the original v0.8.82 sound definitions (sound lists with per-sound volumes, channels and random groups)
// from the original client bundle into src/generated/sound-defs.json. Sounds whose mp3 is not in the imported
// assets are dropped, so the client never requests a missing file. M9: keeps `canCoalesce` (impact sounds that merge).
// Sounds the game objects name (gun, melee and throwable `sound` fields) that the original lists lack, i.e. those of
// the survev-only items the port takes (tools/port-survev/policy.json), come from survev's own list
// (.survev/client/src/soundDefs.ts) with `source: "survev"`; so do the sounds survev's map objects name (buildings,
// music, sound emitters) and survev-only sound groups (egg hits), plus the client effect sounds no def names
// (EFFECT_SOUNDS).
// Usage (repo root): node apps/client/scripts/sound-defs.ts [research-cache/live/app.<hash>.js]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const LIVE = "research-cache/live";
const OUT = "apps/client/src/generated/sound-defs.json";
const DEFS = "packages/defs/src/generated/gameObjects.json";
const MAP_OBJECTS = "packages/defs/src/generated/mapObjects.json";
const SURVEV_SOUNDS = ".survev/client/src/soundDefs.ts";
/**
 * Sounds the client's own effects play that no game or map object def names: survev's coconut and tomato explosion
 * effects (survev client/src/objects/explosion.ts:672-715; apps/client/src/fx/explosions.ts).
 */
const EFFECT_SOUNDS = ["coconut_01", "tomato_01"];
/** where the audio files live: the imported client assets, else the survev clone they are copied from */
const AUDIO_ROOTS = ["apps/client/public/assets", ".survev/client/public"];

interface SoundDef {
    path: string;
    volume: number;
    maxInstances?: number;
    /** plays of this sound ending within 30 ms of a playing one merge into it (survev createJS canCoalesce) */
    canCoalesce?: boolean;
    /** "survev": not in the original lists, taken from survev's for a survev-only item */
    source?: "survev";
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
// sounds the game objects name that no original list has: survev's definition (survev-only items)
const named = new Set<string>(EFFECT_SOUNDS);
for (const def of Object.values(JSON.parse(readFileSync(DEFS, "utf8")) as Record<string, { sound?: object }>)) {
    for (const v of Object.values(def.sound ?? {})) if (typeof v === "string" && v) named.add(v);
}
// and the sounds the map objects name (survev buildings: obstacle hit / break sounds, doors, buttons, puzzles,
// interior music, sound emitters), every string under a key containing "sound" but the labels beside them
const LABEL_KEYS = new Set(["filter", "puzzle", "channel"]);
const collect = (v: unknown, inSound: boolean): void => {
    if (typeof v === "string") {
        if (inSound && v && v !== "none") named.add(v);
    } else if (Array.isArray(v)) {
        for (const x of v) collect(x, inSound);
    } else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
            if (!LABEL_KEYS.has(k)) collect(x, inSound || k.toLowerCase().includes("sound"));
        }
    }
};
collect(JSON.parse(readFileSync(MAP_OBJECTS, "utf8")), false);
const inOriginal = (name: string) => Object.values(mod.Sounds).some((list) => Object.hasOwn(list, name));
const survev = existsSync(SURVEV_SOUNDS)
    ? ((await import(pathToFileURL(resolve(SURVEV_SOUNDS)).href)).default as Pick<SoundModule, "Sounds" | "Groups">)
    : undefined;
// a named group (hit sounds) only survev has: its sounds come along
const groups: SoundModule["Groups"] = { ...mod.Groups };
for (const name of [...named].sort()) {
    if (Object.hasOwn(groups, name) || !survev?.Groups?.[name]) continue;
    groups[name] = survev.Groups[name];
    for (const s of survev.Groups[name].sounds) named.add(s);
}
const fromSurvev: string[] = [];
for (const name of [...named].sort()) {
    if (inOriginal(name) || !survev || Object.hasOwn(groups, name)) continue;
    const list = Object.keys(survev.Sounds).find((l) => Object.hasOwn(survev.Sounds[l], name));
    if (!list) continue;
    const def = survev.Sounds[list][name];
    if (audioRoot && !existsSync(join(audioRoot, def.path))) {
        missing.push(def.path);
        continue;
    }
    const out: SoundDef = { path: def.path, volume: def.volume, source: "survev" };
    if (def.maxInstances !== undefined) out.maxInstances = def.maxInstances;
    if (def.canCoalesce) out.canCoalesce = true;
    lists[list] ??= {};
    lists[list][name] = out;
    fromSurvev.push(name);
}
const result = { channels: mod.Channels, lists, groups };
writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`);
const count = Object.values(lists).reduce((n, l) => n + Object.keys(l).length, 0);
console.log(`${count} sounds, ${Object.keys(groups).length} groups, ${Object.keys(mod.Channels).length} channels`);
console.log(audioRoot ? `checked against ${audioRoot}` : "audio files not found: existence not checked");
console.log(`${fromSurvev.length} from survev's list: ${fromSurvev.join(", ")}`);
if (missing.length) console.log(`dropped ${missing.length} without a file: ${missing.join(", ")}`);
