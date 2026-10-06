// Ports the game definitions into packages/defs/src/generated/: original client defs (research-cache/live/defs.json)
// for everything the client has, survev (.survev @ c6185e31) for the server-only data. See README.md for the policy.
// Usage: node --experimental-transform-types tools/port-survev/port.ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyBalanceRevert, type RevertLog } from "./lib/balance.ts";
import { applyEventMapFixes } from "./lib/eventMaps.ts";
import { loadInputs } from "./lib/inputs.ts";
import {
    cleanLootTables,
    cleanRoleOverrides,
    mapRoleProblems,
    portMaps,
    renameTiers,
    revertForkReskins,
} from "./lib/maps.ts";
import { objectPaths, portGameConfig, portGameObjects, portMapObjects } from "./lib/objects.ts";
import { stableJson } from "./lib/util.ts";
import { validate } from "./lib/validate.ts";

// survev uses TypeScript enums, which plain type stripping cannot run: re-exec with the flag (e.g. via `pnpm port`)
if (!process.execArgv.includes("--experimental-transform-types")) {
    const args = ["--experimental-transform-types", ...process.execArgv, fileURLToPath(import.meta.url)];
    process.exit(spawnSync(process.execPath, [...args, ...process.argv.slice(2)], { stdio: "inherit" }).status ?? 1);
}

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = join(ROOT, "packages/defs/src/generated");
const BALANCE_REVERT_REL = "docs/research/provenance/balance-revert.json";
const BALANCE_REVERT = join(ROOT, BALANCE_REVERT_REL);

const warnings: string[] = [];
const inputs = await loadInputs(ROOT);
const { live, survev } = inputs;

// 1. game objects: the original client, nothing else
const gameObjects = portGameObjects(live.gameObjects, survev.gameObjects);

// 2. map defs: survev, client-visible parts from the original client
const maps = portMaps(survev.mapDefs, live.maps, warnings);

// 3. balance reverts on server-only data (before cleanup so reverted spawns/loot are cleaned and closed over)
let balanceRevert: RevertLog[] = [];
let balanceRevertNote = "";
if (existsSync(BALANCE_REVERT)) {
    const entries = JSON.parse(readFileSync(BALANCE_REVERT, "utf8"));
    const survevOnlyMapObjects = Object.fromEntries(
        Object.entries(survev.mapObjects).filter(([id]) => !(id in live.mapObjects)),
    );
    balanceRevert = applyBalanceRevert(entries, {
        maps: maps.maps,
        gameConfig: survev.gameConfig,
        originalGameConfigPaths: objectPaths(live.gameConfig),
        gameObjects: gameObjects.defs,
        mapObjects: { ...live.mapObjects, ...survevOnlyMapObjects },
        mapObjectStatus: Object.fromEntries(Object.keys(survevOnlyMapObjects).map((id) => [id, "survev-only"])),
        knownMapObjects: new Set([...Object.keys(live.mapObjects), ...Object.keys(survev.mapObjects)]),
    });
} else {
    balanceRevertNote = `${BALANCE_REVERT_REL} not found: balance reverts skipped (re-run the port once it exists)`;
    console.warn(`warning: ${balanceRevertNote}`);
}

// 3b. fork reskins (woods/faction/cobalt caches, desert crimson airdrop) back to the original objects
const reskinReverts = revertForkReskins(maps.maps, live.mapObjects);

// 3c. event maps whose revert baseline was not the original (Savannah, Turkey, seasonal variants) + loot bans
const eventMapFixes = applyEventMapFixes(maps.maps);

// 4. loot tables: original tier names, only items that exist, no xp drops
const tierRenames = renameTiers(maps.maps);
const lootRemovals = cleanLootTables(maps.maps, gameObjects.defs);
const roleOverrideRemovals = cleanRoleOverrides(maps.maps, gameObjects.defs);

// 5. map objects: original + survev-only ones the maps need
const mapObjects = portMapObjects(live.mapObjects, survev.mapObjects, maps.maps, gameObjects.defs);

// 6. GameConfig: original client wins, survev supplies server constants
const gameConfig = portGameConfig(live.gameConfig, survev.gameConfig, gameObjects.defs);

const validation = validate(gameObjects.defs, mapObjects.defs, maps.maps);
const problems = [
    ...validation.problems,
    ...mapRoleProblems(maps.maps, gameObjects.defs),
    ...mapObjects.missing.map((id) => `map object ${id} referenced but defined in neither source`),
];

const provenance = {
    generatedFrom: {
        survevCommit: survev.commit,
        liveBundle: live.bundle,
        balanceRevert: existsSync(BALANCE_REVERT) ? BALANCE_REVERT_REL : null,
    },
    gameObjects: Object.fromEntries(Object.keys(gameObjects.defs).map((id) => [id, "original"])),
    mapObjects: mapObjects.status,
    maps: maps.provenance,
    balanceRevert,
    reskinReverts,
    eventMapFixes,
    lootRemovals: [...lootRemovals, ...mapObjects.lootRemovals, ...roleOverrideRemovals],
    gameConfigDiffs: [...gameConfig.diffs, ...gameConfig.prunes.map((p) => ({ ...p, kind: "pruned" }))],
    fixups: [...gameObjects.fixups, ...mapObjects.fixups, ...tierRenames],
    excluded: { gameObjects: gameObjects.excluded, mapObjects: mapObjects.excluded },
    conversionNotes: inputs.conversionNotes.filter((n) => n.startsWith("survev.maps")),
    problems,
    deadRefs: validation.deadRefs,
    warnings: balanceRevertNote ? [...warnings, balanceRevertNote] : warnings,
};

mkdirSync(OUT, { recursive: true });
const files: Record<string, unknown> = {
    "gameObjects.json": gameObjects.defs,
    "mapObjects.json": mapObjects.defs,
    "maps.json": maps.maps,
    "gameConfig.json": gameConfig.config,
    "provenance.json": provenance,
};
for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT, name), stableJson(data));

// ---- summary ----
const countBy = <T>(xs: T[], key: (x: T) => string) => {
    const out: Record<string, number> = {};
    for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
    return out;
};
const fmt = (o: Record<string, number>) =>
    Object.entries(o)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
const lines: string[] = [];
lines.push(`survev ${survev.commit.slice(0, 8)}, original client bundle ${live.bundle}`);
lines.push(
    `game objects: ${Object.keys(gameObjects.defs).length} (${fmt(countBy(Object.values(gameObjects.defs), (d: any) => d.type))})`,
);
lines.push(`  excluded survev-only: ${gameObjects.excluded.length}; fixups: ${gameObjects.fixups.length}`);
const moStatus = countBy(Object.values(mapObjects.status), (s) => s);
lines.push(`map objects: ${Object.keys(mapObjects.defs).length} (${fmt(moStatus)})`);
lines.push(`  by type: ${fmt(countBy(Object.values(mapObjects.defs), (d: any) => d.type))}`);
lines.push(`  excluded survev-only: ${mapObjects.excluded.length}; fixups: ${mapObjects.fixups.length}`);
lines.push(`maps: ${Object.keys(maps.maps).length}`);
for (const [name, p] of Object.entries(maps.provenance)) {
    const extra = p.inOriginalClient
        ? ` original client (${p.clientFieldsOverridden?.length ?? 0} client fields replaced)`
        : "";
    lines.push(`  ${name}: mapId ${p.mapId}${extra}`);
}
if (balanceRevertNote) lines.push(`balance revert: SKIPPED (${balanceRevertNote})`);
else lines.push(`balance revert: ${fmt(countBy(balanceRevert, (r) => r.status)) || "0 entries"}`);
lines.push(`loot removals: ${provenance.lootRemovals.length}`);
const byItem = countBy(provenance.lootRemovals, (r) => r.item || "(emptied table)");
lines.push(`  by item (count of map tables): ${fmt(byItem)}`);
lines.push(
    `gameConfig diffs: ${provenance.gameConfigDiffs.length} (${fmt(countBy(provenance.gameConfigDiffs, (d) => d.kind))})`,
);
if (provenance.conversionNotes.length) lines.push(`map def conversion notes: ${provenance.conversionNotes.length}`);
for (const w of provenance.warnings) lines.push(`warning: ${w}`);
lines.push(`dead refs (defs no map spawns): ${validation.deadRefs.length}`);
for (const d of validation.deadRefs) lines.push(`  ${d}`);
lines.push(`problems: ${problems.length}`);
for (const p of problems) lines.push(`  ${p}`);
lines.push(`wrote ${Object.keys(files).join(", ")} to packages/defs/src/generated`);
console.log(lines.join("\n"));
