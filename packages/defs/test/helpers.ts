// Shared test fixtures: the generated JSON as plain untyped data, and the optional research inputs.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const GENERATED = new URL("../src/generated/", import.meta.url);

export type Defs = Record<string, any>;

export const readGenerated = (name: string): any => JSON.parse(readFileSync(new URL(name, GENERATED), "utf8"));
export const readGeneratedText = (name: string): string => readFileSync(new URL(name, GENERATED), "utf8");

export const gameObjects: Defs = readGenerated("gameObjects.json");
export const mapObjects: Defs = readGenerated("mapObjects.json");
export const maps: Defs = readGenerated("maps.json");
export const gameConfig: Defs = readGenerated("gameConfig.json");
export const provenance: Defs = readGenerated("provenance.json");

/** Reads a repo file that may be absent (research-cache is gitignored; docs/research may still be in progress). */
export function readOptionalJson(rel: string): any | undefined {
    const file = `${REPO_ROOT}${rel}`;
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

/** The port policy (tools/port-survev/policy.json): the survev-only content taken as survev has it. */
export const portPolicy: {
    survevOnlyGameObjects: string[];
    survevSkins: Record<string, string>;
    survevGameConfig: string[];
} = JSON.parse(readFileSync(`${REPO_ROOT}tools/port-survev/policy.json`, "utf8"));

/** Every survev-only game object id the port takes (listed ids and skins). */
export const PORTED_SURVEV_IDS: readonly string[] = [
    ...portPolicy.survevOnlyGameObjects,
    ...Object.keys(portPolicy.survevSkins),
];

/**
 * survev-only items the policy does not take yet (later waves: melee, throwables, packs, perks) and post-0.8.82
 * original guns neither survev nor the owner adds: none may appear anywhere in the ported data.
 */
export const NOT_PORTED_IDS = [
    "iceaxe",
    "cutlass",
    "cutlass_gold",
    "coconut",
    "tomato",
    "backpack04_cloud",
    "pkm",
    "m134",
];

/** Ammo names of special guns that have no ammo def in the original client either. */
export const PSEUDO_AMMO = new Set(["9mm_cursed", "bugle_ammo"]);
