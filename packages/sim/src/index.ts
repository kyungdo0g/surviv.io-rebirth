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
export {
    type ArmorState,
    armorCovers,
    canHeadshot,
    computeDamage,
    type DamageParams,
    rollHeadshot,
} from "./combat/damage.ts";
export {
    type ExplosionHost,
    type ExplosionReport,
    type ExplosionSource,
    ExplosionSystem,
} from "./combat/explosions.ts";
export { HitLog } from "./combat/hitLog.ts";
export {
    type AddProjectileParams,
    type Projectile,
    type ProjectileHost,
    ProjectileSystem,
} from "./combat/projectiles.ts";
export { entityView, Game, VIEW_ASPECT, VIEW_MARGIN, viewBounds } from "./game.ts";
export { DEFAULT_MIN_PLAYERS, type GameInit } from "./gameInit.ts";
export * from "./input.ts";
export { BAG_ITEMS, gearLevel, gearQuality, Inventory, SCOPE_LEVELS, THROWABLE_LIST } from "./items/inventory.ts";
export { destroyTypeOf, dropGun, dropMelee, playerDropLoot, unknownLootTiers } from "./loot/drops.ts";
export { type AddLootOptions, Loot, LootSystem } from "./loot/loot.ts";
export { pickEntry, type RolledItem, rollLootList, rollTier } from "./loot/lootTable.ts";
export { closestLoot, freeGunSlot, type PickupResult, pickupLoot } from "./loot/pickup.ts";
export { getBoundingCollider } from "./mapgen/bounds.ts";
export { type GenerateMapResult, generateMap, type SpawnSource, type SpawnStat } from "./mapgen/generate.ts";
export type { GeneratedObject, LootSpawn } from "./mapgen/generator.ts";
export {
    generateShowcase,
    type ShowcaseEntry,
    type ShowcaseResult,
    showcaseEntries,
    showcaseMapOf,
    showcaseSpawnSpots,
} from "./mapgen/showcase.ts";
export { buildTerrain, createTerrain, type River, type Terrain, terrainToShape } from "./mapgen/terrain.ts";
export { isTerrainWater, type TerrainSurface, terrainSurfaceAt } from "./mapgen/terrainQuery.ts";
export {
    AIRSTRIKE_SPAWN_TIME,
    AirstrikeZones,
    bombPositions,
    pickAirstrikeVariant,
    type StrikeState,
} from "./match/airstrikes.ts";
export { DEATH_EMOTE_DELAY, EmoteSystem, updateEmoteThrottle } from "./match/emotes.ts";
export { damageSourceOf, EventLog } from "./match/events.ts";
export { FactionSystem, type FactionTeam, living } from "./match/faction.ts";
export { type CircleChoice, Gas, gasCircle, gasTimeLeft } from "./match/gas.ts";
export { type MapIndicator, MapIndicatorSystem, type TrackedIndicator } from "./match/indicators.ts";
export {
    CROSSHAIR_SIZE,
    CROSSHAIR_STROKE,
    type Crosshair,
    defaultLoadout,
    isLoadoutItem,
    type JoinLoadout,
    type Loadout,
    type LoadoutKind,
    loadoutChoices,
    validateLoadout,
} from "./match/loadout.ts";
export { KILL_LEADER_ROLE, Match, type MatchOptions, playerStats } from "./match/match.ts";
export type { CombatObserver } from "./match/observer.ts";
export { type FallingAirdrop, type PlaneState, PlaneSystem } from "./match/planes.ts";
export { canPlayerSpawn, randomSpawnPos, teammateSpawnPos } from "./match/spawn.ts";
export { type SpectateAction, SpectateSystem } from "./match/spectate.ts";
export { Group, killAllDowned, TEAMMATE_SPAWN_RADIUS, TeamSystem } from "./match/teams.ts";
export { UnlockSystem, type UnlockTiming, unlockTimings } from "./match/unlocks.ts";
export { mapBagSizes } from "./modes/bagSizes.ts";
export {
    type ClassSelectHost,
    onClassChosen,
    startsWithoutClass,
    TWINS_WAITING_ROOM,
    waitingRoom,
} from "./modes/classSelect.ts";
export { applyThrowableHit, frozenOri } from "./modes/frozen.ts";
export { defaultModeRules, type ModeRules, type ThrowableHitRule } from "./modes/modeRules.ts";
export { PERK_EFFECTS } from "./perks/coverage.ts";
export { onKillCredited, onPerkHolderDeath, playBugle, updatePerks, windwalkTrigger } from "./perks/effects.ts";
export { ALL_AMMO_BONUS_PERKS, AMMO_BONUS_PERKS, defaultPerkRules, type PerkRules } from "./perks/perkRules.ts";
export {
    type AddPerkOptions,
    addPerk,
    droppablePerk,
    giveHaste,
    type PerkSource,
    perkMinBoost,
    perkViews,
    recalcScale,
    removePerk,
} from "./perks/perks.ts";
export { ammoBonusCount, type ShotPerks, shotPerks } from "./perks/shotPerks.ts";
export {
    type ResolvedLoadout,
    ROLE_LOADOUTS,
    type RoleLoadout,
    resolveLoadout,
    resolveWeapon,
    roleLoadout,
} from "./roles/loadouts.ts";
export { defaultRoleRules, type RoleRules, type RoleSlot } from "./roles/roleRules.ts";
export { type RoleHost, RoleSystem } from "./roles/roleSystem.ts";
export { type PromoteOptions, promoteToRole, removeRole, setHelmet } from "./roles/roles.ts";
export { boostHealAmounts, defaultRules, type SimRules } from "./rules.ts";
export type * from "./view.ts";
export { fireGun } from "./weapons/gun.ts";
export { meleeCollider, meleeDamage } from "./weapons/melee.ts";
export { randomWeaponSwap } from "./weapons/potatoSwap.ts";
export { cookThrowable, throwableDef, throwThrowable, updateThrowable } from "./weapons/throwable.ts";
export { gunDef, TIME_EPS, WeaponManager, type WeaponSlotState } from "./weapons/weaponManager.ts";
export {
    breakWallAttachments,
    goreRegionKill,
    healRegionRate,
    onBuildingObstacleDestroyed,
    parentBuildingOf,
    removeAnchoredDecals,
} from "./world/buildings.ts";
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
export { BEHAVIOUR_FIELDS, type FieldStatus } from "./world/coverage.ts";
export { DeadBody, DeadBodySystem } from "./world/deadBodies.ts";
export { disguiseOf, setOutfit } from "./world/disguise.ts";
export {
    autoOpenDoors,
    checkDoorLayer,
    DOOR_USE_COOLDOWN,
    interactDoor,
    playerSide,
    scheduleDoor,
    setDoorOpen,
    toggleDoor,
    unlockDoor,
    updateDoorTimers,
} from "./world/doors.ts";
export {
    acceptsWhileDowned,
    bleedDamage,
    completeRevive,
    downPlayer,
    playerToRevive,
    startRevive,
    teammatesInRange,
    updateDowned,
} from "./world/downed.ts";
export { dropItem, dropRandomLoot, randomDropCandidates } from "./world/dropItem.ts";
export {
    Building,
    Decal,
    type DelayedDoorAction,
    type DoorState,
    type MapEntity,
    Obstacle,
    type PuzzleState,
    type Stair,
    Structure,
} from "./world/entities.ts";
export {
    interactableObstacles,
    interactObstacle,
    updateObstacleTimers,
    useButton,
    useObstacle,
} from "./world/interact.ts";
export { aimLayerOf, checkStairs, floorsVisible, type StairsResult } from "./world/layers.ts";
export { moveWithCollision, Player, type PlayerActionType } from "./world/player.ts";
export { PUZZLE_CODES, puzzleCode, puzzlePieceToggled, updatePuzzle } from "./world/puzzles.ts";
export { type Smoke, type SmokeHost, SmokeSystem, VISION_RECOVERY_TIME } from "./world/smoke.ts";
export { updateSurroundings } from "./world/surroundings.ts";
export { type Entity, sameLayer, World } from "./world/world.ts";
