// @rebirth/sim: deterministic game simulation. The contract (api, input, view) is what consumers depend on.
export * from "./api.ts";
export { type Bullet, BulletSystem, type FireBulletParams, panSegment } from "./combat/bullets.ts";
export {
    applyObstacleDamage,
    applyPlayerDamage,
    canDamageObstacle,
    type HitRecord,
    killPlayer,
} from "./combat/combat.ts";
export { type ArmorState, canHeadshot, computeDamage, type DamageParams, rollHeadshot } from "./combat/damage.ts";
export { entityView, Game, type GameInit, VIEW_ASPECT, VIEW_MARGIN, viewBounds } from "./game.ts";
export * from "./input.ts";
export { BAG_ITEMS, gearLevel, gearQuality, Inventory, SCOPE_LEVELS, THROWABLE_LIST } from "./items/inventory.ts";
export { dropGun, dropMelee, playerDropLoot, unknownLootTiers } from "./loot/drops.ts";
export { type AddLootOptions, Loot, LootSystem } from "./loot/loot.ts";
export { pickEntry, type RolledItem, rollLootList, rollTier } from "./loot/lootTable.ts";
export { closestLoot, freeGunSlot, type PickupResult, pickupLoot } from "./loot/pickup.ts";
export { getBoundingCollider } from "./mapgen/bounds.ts";
export { type GenerateMapResult, generateMap, type SpawnSource, type SpawnStat } from "./mapgen/generate.ts";
export type { GeneratedObject, LootSpawn } from "./mapgen/generator.ts";
export { buildTerrain, createTerrain, type River, type Terrain, terrainToShape } from "./mapgen/terrain.ts";
export { isTerrainWater, type TerrainSurface, terrainSurfaceAt } from "./mapgen/terrainQuery.ts";
export { defaultRules, type SimRules } from "./rules.ts";
export type * from "./view.ts";
export { fireGun, gunFireGate } from "./weapons/gun.ts";
export { meleeCollider, meleeDamage } from "./weapons/melee.ts";
export { gunDef, TIME_EPS, WeaponManager, type WeaponSlotState } from "./weapons/weaponManager.ts";
export type { SimContext } from "./world/context.ts";
export { Building, Decal, type MapEntity, Obstacle, Structure } from "./world/entities.ts";
export { moveWithCollision, Player, type PlayerActionType } from "./world/player.ts";
export { type Entity, sameLayer, World } from "./world/world.ts";
