// Loads the two inputs of the port: the original client defs (research-cache/live/defs.json) and the survev
// reference TypeScript sources (.survev/shared), converting the latter to plain JSON.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isPlainObject } from "./util.ts";

export const SURVEV_COMMIT = "c6185e31fe25a4a07def77a2bb25b1710bda90ac";

export interface LiveDefs {
    gameObjects: Record<string, any>;
    mapObjects: Record<string, any>;
    /** client-side map defs indexed by mapId */
    maps: Map<number, any>;
    gameConfig: Record<string, any>;
    bundle: string;
}

export interface SurvevDefs {
    gameObjects: Record<string, any>;
    mapObjects: Record<string, any>;
    mapDefs: Record<string, any>;
    gameConfig: Record<string, any>;
    commit: string;
}

export interface Inputs {
    live: LiveDefs;
    survev: SurvevDefs;
    /** values that could not be represented as plain JSON (functions, non-finite numbers) */
    conversionNotes: string[];
}

export function loadLive(root: string): LiveDefs {
    const file = join(root, "research-cache/live/defs.json");
    if (!existsSync(file)) throw new Error(`${file} missing: run pnpm survev:fetch`);
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const maps = new Map<number, any>();
    for (const def of Object.values<any>(raw.mapDefCandidates ?? {})) {
        if (isPlainObject(def) && typeof def.mapId === "number") maps.set(def.mapId, def);
    }
    const gameConfig = Object.values<any>(raw.gameConfig ?? {}).find((c) => isPlainObject(c) && "protocolVersion" in c);
    if (!gameConfig) throw new Error("no GameConfig module found in live defs");
    const htmlFile = join(root, "research-cache/live/index.html");
    const html = existsSync(htmlFile) ? readFileSync(htmlFile, "utf8") : "";
    const bundle = html.match(/src="js\/(app\.[^"]+\.js)"/)?.[1] ?? `module ${raw.meta?.gameObjectModule ?? "?"}`;
    return { gameObjects: raw.gameObjects, mapObjects: raw.mapObjects, maps, gameConfig, bundle };
}

const FACTION_TEAMS = { red: 1, blue: 2 } as const;

/**
 * Converts survev runtime values to JSON. Team-dependent closures `(teamcolor) => x` become
 * `{ "$byTeam": { red, blue } }`; `util.weightedRandom([...])` calls (patched before import) become
 * `{ "$weighted": [...] }`; other functions become `{ "$fn": source }` and are reported.
 */
export function toJson(v: unknown, path: string, notes: string[]): any {
    if (typeof v === "function") {
        if (v.length === 1) {
            const out: Record<string, any> = {};
            for (const [name, team] of Object.entries(FACTION_TEAMS))
                out[name] = toJson(v(team), `${path}.${name}`, notes);
            notes.push(`${path}: team-dependent function converted to $byTeam`);
            return { $byTeam: out };
        }
        notes.push(`${path}: function kept as $fn source`);
        return { $fn: v.toString().replace(/\s+/g, " ") };
    }
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`${path}: non-finite number ${v}`);
    if (Array.isArray(v)) {
        return v.map((x, i) => {
            if (x === undefined) notes.push(`${path}.${i}: undefined array element converted to null`);
            return x === undefined ? null : toJson(x, `${path}.${i}`, notes);
        });
    }
    if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        const out: Record<string, any> = {};
        for (const k of Object.keys(obj)) {
            const x = obj[k];
            // TypeScript enums carry reverse mappings ({ 0: "MoveLeft", MoveLeft: 0 }): keep only name -> value
            const reverse = /^\d+$/.test(k) && typeof x === "string" && obj[x] === Number(k);
            if (x !== undefined && !reverse) out[k] = toJson(x, `${path}.${k}`, notes);
        }
        return out;
    }
    return v;
}

/**
 * survev keeps the gas stage table as a private const of server/src/game/objects/gas.ts; evaluate that array
 * literal (only `GasMode` in scope) so it can live in GameConfig.gas.stages.
 */
function loadGasStages(root: string, gasMode: Record<string, number>): unknown[] {
    const src = readFileSync(join(root, ".survev/server/src/game/objects/gas.ts"), "utf8");
    const literal = src.match(/const GasStages: StageData\[\] = (\[[\s\S]*?\n\]);/)?.[1];
    if (!literal) throw new Error("GasStages table not found in survev gas.ts");
    return new Function("GasMode", `"use strict"; return ${literal};`)(gasMode);
}

export async function loadSurvev(root: string, notes: string[]): Promise<SurvevDefs> {
    const shared = join(root, ".survev/shared");
    if (!existsSync(shared)) throw new Error(".survev missing: run pnpm survev:fetch");
    const commit = execFileSync("git", ["-C", join(root, ".survev"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (commit !== SURVEV_COMMIT) console.warn(`warning: .survev is at ${commit}, expected ${SURVEV_COMMIT}`);
    const load = (rel: string) => import(pathToFileURL(join(shared, rel)).href);

    // Some survev map defs call util.weightedRandom at import time; record the choices instead of rolling dice
    // so the output is deterministic and keeps the full distribution.
    const { util } = await load("utils/util.ts");
    util.weightedRandom = (items: unknown[]) => ({ $weighted: structuredClone(items) });

    const gameObjects = (await load("defs/gameObjectDefs.ts")).RawGameObjectDefs;
    const mapObjects = (await load("defs/mapObjectDefs.ts")).RawMapObjectDefs;
    const mapDefs = (await load("defs/mapDefs.ts")).MapDefs;
    const gameConfig = (await load("gameConfig.ts")).GameConfig;
    gameConfig.gas = { ...gameConfig.gas, stages: loadGasStages(root, gameConfig.GasMode) };
    return {
        // survev-only role closures are never ported (game objects come from the original client): no notes
        gameObjects: toJson(gameObjects, "survev.gameObjects", []),
        mapObjects: toJson(mapObjects, "survev.mapObjects", notes),
        mapDefs: toJson(mapDefs, "survev.maps", notes),
        gameConfig: toJson(gameConfig, "survev.gameConfig", notes),
        commit,
    };
}

export async function loadInputs(root: string): Promise<Inputs> {
    const conversionNotes: string[] = [];
    const live = loadLive(root);
    const survev = await loadSurvev(root, conversionNotes);
    return { live, survev, conversionNotes };
}
