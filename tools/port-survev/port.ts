// Ports the game definitions into packages/defs/src/generated/: original client defs (research-cache/live/defs.json)
// for everything the client has, survev (.survev @ c6185e31) for the server-only data and for the survev-only content
// policy.json lists (docs/adr/0003-survev-baseline.md). See README.md for the policy.
// Usage: node --experimental-transform-types tools/port-survev/port.ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOOT_BANS } from "../../packages/defs/src/gunClasses.ts";
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
import {
    applySurvevGameplay,
    applySurvevMapGenFields,
    objectPaths,
    portGameConfig,
    portGameObjects,
    portMapObjects,
    SURVEV_MAP_GAMEPLAY_FIELDS,
} from "./lib/objects.ts";
import { loadPolicy, portedSurvevIds } from "./lib/policy.ts";
import { keepSurvevPlacements, restoreSurvevPlacements, splitMapGenEntries } from "./lib/survevLoot.ts";
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
const POLICY_REL = "tools/port-survev/policy.json";

const warnings: string[] = [];
const inputs = await loadInputs(ROOT);
const { live, survev } = inputs;
const policy = loadPolicy(join(ROOT, POLICY_REL));
const ported = portedSurvevIds(policy);

// 1. game objects: the original client, then the survev-only ids policy.json ports
const gameObjects = portGameObjects(live.gameObjects, survev.gameObjects, policy);
// 1b. survev balance (option B): original ids take survev's gameplay fields
const survevValues = policy.survevBalance
    ? applySurvevGameplay(gameObjects.defs, gameObjects.status, survev.gameObjects, policy.survevSkins)
    : [];

// 2. map defs: survev, client-visible parts from the original client
const maps = portMaps(survev.mapDefs, live.maps, warnings);

// 3. balance reverts on server-only data (before cleanup so reverted spawns/loot are cleaned and closed over)
let balanceRevert: RevertLog[] = [];
let balanceRevertNote = "";
if (existsSync(BALANCE_REVERT) && policy.survevBalance) {
    // survev balance (option B): balance-revert.json stays the record of the original values, nothing is applied
    balanceRevert = (JSON.parse(readFileSync(BALANCE_REVERT, "utf8")) as RevertLog["entry"][]).map((entry) => ({
        status: "skipped",
        entry,
        reason: "survev balance (tools/port-survev/policy.json survevBalance)",
    }));
} else if (existsSync(BALANCE_REVERT)) {
    // the ported survev-only items keep survev's placements: their revert entries are skipped (logged as such)
    const kept = keepSurvevPlacements(
        JSON.parse(readFileSync(BALANCE_REVERT, "utf8")),
        ported,
        policy.survevSkins,
        Object.keys(maps.maps),
    );
    // survev map generation (policy survevMapGen): map-spawn entries and map-level game config entries stay unapplied
    const mapGen = policy.survevMapGen ? splitMapGenEntries(kept.apply) : { apply: kept.apply, skipped: [] };
    const entries = mapGen.apply;
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
    balanceRevert.push(...kept.skipped, ...mapGen.skipped);
} else {
    balanceRevertNote = `${BALANCE_REVERT_REL} not found: balance reverts skipped (re-run the port once it exists)`;
    console.warn(`warning: ${balanceRevertNote}`);
}

// 3b. fork reskins (woods/faction/cobalt caches, desert crimson airdrop) back to the original objects
const reskinReverts = policy.survevMapGen ? [] : revertForkReskins(maps.maps, live.mapObjects);

// 3c. event maps whose revert baseline was not the original (Savannah, Turkey, seasonal variants) + loot bans
const eventMapFixes = applyEventMapFixes(maps.maps, { lootOnly: policy.survevMapGen, noFixes: policy.survevBalance });
// 3d. survev's placements of the ported survev-only items in tables a fix rebuilt (Savannah), bans permitting
const survevPlacements = restoreSurvevPlacements(maps.maps, survev.mapDefs, ported, LOOT_BANS);

// 4. loot tables: original tier names, only items that exist, no xp drops
const tierRenames = renameTiers(maps.maps);
const lootRemovals = cleanLootTables(maps.maps, gameObjects.defs);
const roleOverrideRemovals = cleanRoleOverrides(maps.maps, gameObjects.defs);

// 5. map objects: original + survev-only ones the maps need
const mapObjects = portMapObjects(
    live.mapObjects,
    survev.mapObjects,
    maps.maps,
    gameObjects.defs,
    policy.survevMapObjects,
);
// survev balance (option B): original map objects take survev's loot, explosions and health (loot of items the port
// does not take is dropped, as for survev-only map objects)
const survevMapValues: ReturnType<typeof applySurvevGameplay> = [];
if (policy.survevBalance) {
    const changes = applySurvevGameplay(
        mapObjects.defs,
        mapObjects.status,
        survev.mapObjects,
        {},
        SURVEV_MAP_GAMEPLAY_FIELDS,
    );
    for (const c of changes) {
        const def = mapObjects.defs[c.id];
        if (c.field !== "loot" || !Array.isArray(def.loot)) continue;
        def.loot = def.loot.filter((l: any) => {
            const bad = typeof l?.type === "string" && l.type !== "" && !(l.type in gameObjects.defs);
            if (bad)
                mapObjects.lootRemovals.push({
                    mapObject: c.id,
                    item: l.type,
                    reason: "item not in the ported game objects",
                });
            return !bad;
        });
    }
    survevMapValues.push(...changes);
}
// survev map generation: the original map objects take survev's faction sides and placement rules
const mapGenFields = policy.survevMapGen
    ? applySurvevMapGenFields(mapObjects.defs, mapObjects.status, survev.mapObjects)
    : [];

// 6. GameConfig: original client wins, survev supplies server constants
const gameConfig = portGameConfig(live.gameConfig, survev.gameConfig, gameObjects.defs, policy.survevGameConfig);

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
        policy: POLICY_REL,
    },
    policy,
    gameObjects: gameObjects.status,
    mapObjects: mapObjects.status,
    maps: maps.provenance,
    balanceRevert,
    reskinReverts,
    eventMapFixes,
    survevPlacements,
    survevMapGenFields: mapGenFields,
    survevValues,
    survevMapValues,
    lootRemovals: [...lootRemovals, ...mapObjects.lootRemovals, ...roleOverrideRemovals],
    gameConfigDiffs: [
        ...gameConfig.diffs,
        ...gameConfig.prunes.map((p) => ({ ...p, kind: "pruned" })),
        ...gameConfig.survev.map((d) => ({ ...d, kind: "survev (policy.json)" })),
    ],
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
lines.push(
    `  survev-only ported (policy.json): ${ported.size}; excluded survev-only: ${gameObjects.excluded.length}; ` +
        `fixups: ${gameObjects.fixups.length}`,
);
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
lines.push(`survev placements restored: ${survevPlacements.length}`);
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
