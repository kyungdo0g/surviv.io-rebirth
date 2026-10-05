// Extracts the original English item names ("game-<id>") and short HUD names ("game-hud-<id>") of every item that
// can be looted or held from the original v0.8.82 client bundle into src/generated/l10n-en-items.json.
// Usage (repo root): node apps/client/scripts/l10n-items.ts [research-cache/live/app.<hash>.js]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIVE = "research-cache/live";
const OUT = "apps/client/src/generated/l10n-en-items.json";
const DEFS = "packages/defs/src/generated/gameObjects.json";
const ITEM_TYPES = new Set([
    "gun",
    "melee",
    "throwable",
    "ammo",
    "heal",
    "boost",
    "helmet",
    "chest",
    "backpack",
    "scope",
]);

const bundle = process.argv[2] ?? join(LIVE, readdirSync(LIVE).find((f) => /^app\..*\.js$/.test(f))!);
const src = readFileSync(bundle, "utf8");
const defs = JSON.parse(readFileSync(DEFS, "utf8")) as Record<string, { type: string }>;

/** `"game-<key>":"<value>"` pairs of the bundle's English string table (JS string escapes undone). */
const strings = new Map<string, string>();
for (const m of src.matchAll(/"(game-[A-Za-z0-9_-]+)":"((?:[^"\\]|\\.)*)"/g)) {
    if (!strings.has(m[1])) strings.set(m[1], m[2].replace(/\\(.)/g, "$1"));
}

const names: Record<string, string> = {};
const hud: Record<string, string> = {};
for (const [id, def] of Object.entries(defs)) {
    if (!ITEM_TYPES.has(def.type)) continue;
    const name = strings.get(`game-${id}`);
    if (name) names[id] = name;
    const short = strings.get(`game-hud-${id}`);
    if (short) hud[id] = short;
}
writeFileSync(OUT, `${JSON.stringify({ names, hud }, null, 1)}\n`);
console.log(`${Object.keys(names).length} item names, ${Object.keys(hud).length} HUD names -> ${OUT}`);
