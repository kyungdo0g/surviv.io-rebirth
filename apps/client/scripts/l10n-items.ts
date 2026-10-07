// Extracts the original English item names ("game-<id>") and short HUD names ("game-hud-<id>") of every item that
// can be looted or held from the original v0.8.82 client bundle into src/generated/l10n-en-items.json. M7: perk and
// role names ("game-<id>") join the names, and perk descriptions ("game-<id>-desc", "</br>" line breaks) go to `desc`.
// Names the original lacks (the survev-only items the port takes, tools/port-survev/policy.json) come from survev's
// English table (.survev/client/src/en.json), and so do the SURVEV_NAMES survev renamed for them.
// Usage (repo root): node apps/client/scripts/l10n-items.ts [research-cache/live/app.<hash>.js]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIVE = "research-cache/live";
const OUT = "apps/client/src/generated/l10n-en-items.json";
const DEFS = "packages/defs/src/generated/gameObjects.json";
const PROVENANCE = "packages/defs/src/generated/provenance.json";
const SURVEV_EN = ".survev/client/src/en.json";
/**
 * Original items whose survev name wins: survev renamed ".50 AE" to ".50 Caliber" when it made it the ammo of the
 * Barrett, ASh-12 and S&W 500 (wikigg .50 Caliber; docs/design/survev-content-and-new-guns.md section 1.3).
 */
const SURVEV_NAMES = ["50AE"];
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
    "perk",
    "role",
]);

const bundle = process.argv[2] ?? join(LIVE, readdirSync(LIVE).find((f) => /^app\..*\.js$/.test(f))!);
const src = readFileSync(bundle, "utf8");
const defs = JSON.parse(readFileSync(DEFS, "utf8")) as Record<string, { type: string }>;

/** `"game-<key>":"<value>"` pairs of the bundle's English string table (JS string escapes undone). */
const strings = new Map<string, string>();
for (const m of src.matchAll(/"(game-[A-Za-z0-9_-]+)":"((?:[^"\\]|\\.)*)"/g)) {
    if (!strings.has(m[1])) strings.set(m[1], m[2].replace(/\\(.)/g, "$1"));
}

const survevEn: Record<string, string> = existsSync(SURVEV_EN) ? JSON.parse(readFileSync(SURVEV_EN, "utf8")) : {};
const status = (JSON.parse(readFileSync(PROVENANCE, "utf8")) as { gameObjects: Record<string, string> }).gameObjects;
for (const id of SURVEV_NAMES) {
    const name = survevEn[`game-${id}`];
    if (name) strings.set(`game-${id}`, name);
}

const names: Record<string, string> = {};
const hud: Record<string, string> = {};
const desc: Record<string, string> = {};
const fromSurvev: string[] = [];
for (const [id, def] of Object.entries(defs)) {
    if (!ITEM_TYPES.has(def.type)) continue;
    for (const key of [`game-${id}`, `game-hud-${id}`]) {
        if (status[id] === "survev-only" && !strings.has(key) && survevEn[key]) {
            strings.set(key, survevEn[key]);
            fromSurvev.push(key);
        }
    }
    const name = strings.get(`game-${id}`);
    if (name) names[id] = name;
    const short = strings.get(`game-hud-${id}`);
    if (short) hud[id] = short;
    const text = def.type === "perk" ? strings.get(`game-${id}-desc`) : undefined;
    if (text) desc[id] = text;
}
writeFileSync(OUT, `${JSON.stringify({ names, hud, desc }, null, 1)}\n`);
console.log(
    `${Object.keys(names).length} names, ${Object.keys(hud).length} HUD names, ${Object.keys(desc).length} perk ` +
        `descriptions -> ${OUT}`,
);
console.log(`from survev's en.json: ${[...SURVEV_NAMES.map((id) => `game-${id}`), ...fromSurvev].join(", ")}`);
