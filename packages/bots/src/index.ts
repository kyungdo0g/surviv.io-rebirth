// @rebirth/bots: bot AI (perception from snapshots, navigation, utility brain, human-like aim) and the two ways to run
// it: BotController drives a player of an in-process Game, NetworkBot plays over the network through HeadlessClient.
export { AimController, gaussian } from "./brain/aim.ts";
export { Brain } from "./brain/brain.ts";
export {
    type BehaviourName,
    type BotOrder,
    type BrainCtx,
    BrainMemory,
    emptyIntent,
    type Intent,
    type ThrowPlan,
} from "./brain/context.ts";
export { ThrowController, throwMouseLen, TriggerController } from "./brain/trigger.ts";
export { Bot, type BotOptions } from "./bot.ts";
export { BotController, type SpawnBotOptions } from "./controller.ts";
export {
    DIFFICULTIES,
    DIFFICULTY_PRESETS,
    type Difficulty,
    type DifficultyParams,
    difficultyParams,
    isDifficulty,
} from "./difficulty.ts";
export { type HeldGun, heldGunsWithAmmo } from "./knowledge/arsenal.ts";
export { lootValue } from "./knowledge/loot.ts";
export { type GunInfo, gunInfo, suitability, type WeaponClass } from "./knowledge/weapons.ts";
export { BOT_NAMES_EN, BOT_NAMES_KO, pickBotName } from "./names.ts";
export { findPath, type PathResult, smoothPath } from "./nav/astar.ts";
export { NavGrid, NavTerrain } from "./nav/grid.ts";
export { PathFollower, type SteerResult } from "./nav/follower.ts";
export { NetworkBot, type NetworkBotOptions } from "./networkBot.ts";
export { type Contact, type SelfState, type SeenLoot, WorldModel } from "./perception/world.ts";
export { type BotRecord, type MatchConfig, type MatchReport, runMatch } from "./runner.ts";
