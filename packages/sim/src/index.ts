// @rebirth/sim: deterministic game simulation. The contract (api, input, view) is what consumers depend on.
export * from "./api.ts";
export { type Bullet, BulletSystem, type FireBulletParams, panSegment } from "./combat/bullets.ts";
export {
    applyObstacleDamage,
    applyPlayerDamage,
    canDamageObstacle,
    destroyObstacle,
    type HitRecord,
    killPlayer,
} from "./combat/combat.ts";
export { type ArmorState, canHeadshot, computeDamage, type DamageParams, rollHeadshot } from "./combat/damage.ts";
export {
    type ExplosionHost,
    type ExplosionReport,
    type ExplosionSource,
    ExplosionSystem,
} from "./combat/explosions.ts";
export {
    type AddProjectileParams,
    type Projectile,
    type ProjectileHost,
    ProjectileSystem,
} from "./combat/projectiles.ts";
export { DEFAULT_MIN_PLAYERS, entityView, Game, type GameInit, VIEW_ASPECT, VIEW_MARGIN, viewBounds } from "./game.ts";
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
export { AIRSTRIKE_SPAWN_TIME, AirstrikeZones, bombPositions, type StrikeState } from "./match/airstrikes.ts";
export { damageSourceOf, EventLog } from "./match/events.ts";
export { type CircleChoice, Gas, gasCircle, gasTimeLeft } from "./match/gas.ts";
export { KILL_LEADER_ROLE, Match, type MatchOptions, playerStats } from "./match/match.ts";
export { type FallingAirdrop, type MapIndicator, type PlaneState, PlaneSystem } from "./match/planes.ts";
export { type SpectateAction, SpectateSystem } from "./match/spectate.ts";
export { boostHealAmounts, defaultRules, type SimRules } from "./rules.ts";
export type * from "./view.ts";
export { fireGun } from "./weapons/gun.ts";
export { meleeCollider, meleeDamage } from "./weapons/melee.ts";
export { cookThrowable, throwableDef, throwThrowable, updateThrowable } from "./weapons/throwable.ts";
export { gunDef, TIME_EPS, WeaponManager, type WeaponSlotState } from "./weapons/weaponManager.ts";
export {
    BOOST_TIER_EDGES,
    boostHealRate,
    completeUse,
    minBoost,
    selectThrowable,
    updateBoost,
    useItem,
} from "./world/consumables.ts";
export type { SimContext } from "./world/context.ts";
export { Building, Decal, type MapEntity, Obstacle, Structure } from "./world/entities.ts";
export { interactableObstacles, updateObstacleTimers, useObstacle } from "./world/interact.ts";
export { moveWithCollision, Player, type PlayerActionType } from "./world/player.ts";
export { type Smoke, type SmokeHost, SmokeSystem, VISION_RECOVERY_TIME } from "./world/smoke.ts";
export { type Entity, sameLayer, World } from "./world/world.ts";
