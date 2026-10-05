// @rebirth/sim: deterministic game simulation. The contract (api, input, view) is what consumers depend on.
export * from "./api.ts";
export { entityView, Game, VIEW_ASPECT, VIEW_MARGIN, viewBounds } from "./game.ts";
export * from "./input.ts";
export { getBoundingCollider } from "./mapgen/bounds.ts";
export { type GenerateMapResult, generateMap, type SpawnSource, type SpawnStat } from "./mapgen/generate.ts";
export type { GeneratedObject, LootSpawn } from "./mapgen/generator.ts";
export { buildTerrain, createTerrain, type River, type Terrain, terrainToShape } from "./mapgen/terrain.ts";
export { isTerrainWater, type TerrainSurface, terrainSurfaceAt } from "./mapgen/terrainQuery.ts";
export type * from "./view.ts";
export { Building, Decal, type MapEntity, Obstacle, Structure } from "./world/entities.ts";
export { moveWithCollision, Player } from "./world/player.ts";
export { type Entity, sameLayer, World } from "./world/world.ts";
