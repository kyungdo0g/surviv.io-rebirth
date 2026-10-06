// @rebirth/bots: bot AI (perception from snapshots, navigation, utility brain, human-like aim) and the two ways to run
// it: BotController drives a player of an in-process Game, NetworkBot plays over the network through HeadlessClient.

export { Bot, type BotOptions } from "./bot.ts";
export { AimController, gaussian } from "./brain/aim.ts";
export { Brain } from "./brain/brain.ts";
export {
    type BehaviourName,
    type BotOrder,
    type BrainCtx,
    BrainMemory,
    emptyIntent,
    type Intent,
    type IntentEmote,
    type ThrowPlan,
} from "./brain/context.ts";
export { EXTENSION_BEHAVIOURS, type ExtensionBehaviour } from "./brain/extensions.ts";
export {
    BRAIN_FEATURES,
    BRAIN_NAMES,
    BRAIN_PRESETS,
    type BrainFeature,
    type BrainFeatures,
    type BrainName,
    brainFeatures,
    brainLabel,
    DEFAULT_BRAIN,
    isBrainFeature,
    isBrainName,
    withFeatures,
} from "./brain/features.ts";
export { ThrowController, TriggerController, throwMouseLen } from "./brain/trigger.ts";
export { BotController, type SpawnBotOptions } from "./controller.ts";
export {
    DIFFICULTIES,
    DIFFICULTY_PRESETS,
    type Difficulty,
    type DifficultyName,
    type DifficultyParams,
    difficultyParams,
    isDifficulty,
    type MotorModel,
    type MotorParams,
} from "./difficulty.ts";
export { type HeldGun, heldGunsWithAmmo } from "./knowledge/arsenal.ts";
export { lootValue } from "./knowledge/loot.ts";
export { type GunInfo, gunInfo, suitability, type WeaponClass } from "./knowledge/weapons.ts";
export { BOT_NAMES_EN, BOT_NAMES_KO, pickBotName } from "./names.ts";
export { findPath, type PathResult, smoothPath } from "./nav/astar.ts";
export { PathFollower, type SteerResult } from "./nav/follower.ts";
export { NavGrid, NavTerrain } from "./nav/grid.ts";
export { NetworkBot, type NetworkBotOptions } from "./networkBot.ts";
export {
    type EnemyAction,
    type EnemyIntel,
    type EnemyIntelProvider,
    NO_INTEL,
    NullEnemyIntel,
} from "./perception/intel.ts";
export {
    type AirdropIntel,
    type DangerZone,
    NO_THREATS,
    NullThreatBoard,
    type ReportedThreat,
    type ThreatBoard,
    type ThreatKind,
    type UnseenShooter,
} from "./perception/threats.ts";
export { type Contact, type SeenLoot, type SelfState, WorldModel } from "./perception/world.ts";
export {
    type BotAssignment,
    type BotRecord,
    type MatchConfig,
    type MatchReport,
    runMatch,
    scaledGas,
} from "./runner.ts";
export { type Finish, finishOrder, MatchStats, type PlayerCombatStats, type StatsGame } from "./stats.ts";
export { TimingHistogram, type TimingHistogramJSON, type TimingSummary } from "./timing.ts";
