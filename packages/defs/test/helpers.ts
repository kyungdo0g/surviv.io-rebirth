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

/** Fork-only guns that must not appear anywhere in the ported data. */
export const FORK_ONLY_GUNS = ["barrett", "ash12", "sw500", "imbel"];

/** Ammo names of special guns that have no ammo def in the original client either. */
export const PSEUDO_AMMO = new Set(["9mm_cursed", "bugle_ammo"]);
