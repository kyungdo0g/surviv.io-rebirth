// Terrain polygons for a map: `buildTerrain` from @rebirth/sim (shared with the server), or the temporary
// rectangle fallback while the simulation package does not export it yet.

import type { MapData, TerrainShape } from "@rebirth/sim";
import * as sim from "@rebirth/sim";
import { fallbackTerrain } from "../map/terrain.ts";

export function buildTerrainShape(map: MapData): { shape: TerrainShape; source: "sim" | "fallback" } {
    const build = (sim as unknown as { buildTerrain?: (map: MapData) => TerrainShape }).buildTerrain;
    if (typeof build === "function") return { shape: build(map), source: "sim" };
    return { shape: fallbackTerrain(map), source: "fallback" };
}
