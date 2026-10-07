// @rebirth/bots: bot AI (perception from snapshots, navigation, utility brain, human-like aim) and the two ways to run
// it: BotController drives a player of an in-process Game, NetworkBot plays over the network through HeadlessClient.

export { Bot, type BotOptions } from "./bot.ts";
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
    SMART_EXCLUDED,
    withFeatures,
} from "./brain/features.ts";
export { type AimSense, ThrowController, TriggerController, throwMouseLen } from "./brain/trigger.ts";
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
export { type Flick, planFlick } from "./motor/flick.ts";
export { HumanMotor, type MotorGoal, type MotorInput } from "./motor/human.ts";
export { AimController } from "./motor/legacy.ts";
export { gaussian } from "./motor/noise.ts";
export { BOT_NAMES_EN, BOT_NAMES_KO, pickBotName } from "./names.ts";
export { findPath, type PathResult, smoothPath } from "./nav/astar.ts";
export { CellGrid } from "./nav/cellGrid.ts";
export { PathFollower, type PlanGrid, type SteerResult } from "./nav/follower.ts";
export { NavGrid, NavTerrain } from "./nav/grid.ts";
export { type StairPortal, UndergroundGrid, UndergroundNav } from "./nav/underground.ts";
export { NetworkBot, type NetworkBotOptions } from "./networkBot.ts";
export { EnemyIntelTracker } from "./perception/enemyIntel.ts";
export { installPerception } from "./perception/install.ts";
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
    type KillLeaderIntel,
    NO_THREATS,
    NullThreatBoard,
    type ReportedThreat,
    type ThreatBoard,
    type ThreatEvent,
    type ThreatKind,
    type UnseenShooter,
} from "./perception/threats.ts";
export { ThreatTracker } from "./perception/threatTracker.ts";
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
