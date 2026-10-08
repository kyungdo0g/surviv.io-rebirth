// @rebirth/bots: bot AI (perception from snapshots, navigation, utility brain, human-like aim) and the two ways to run
// it: BotController drives a player of an in-process Game, NetworkBot plays over the network through HeadlessClient.

export { Bot, type BotOptions } from "./bot.ts";
export { Brain, type BrainProfile } from "./brain/brain.ts";
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
    type DifficultySetting,
    difficultyParams,
    isDifficulty,
    isDifficultySetting,
    isSkillTier,
    LEGACY_TIER,
    type MotorModel,
    type MotorParams,
    SKILL_TIER_NAMES,
    type SkillTierName,
    TIER_FAMILY,
} from "./difficulty.ts";
export { type HeldGun, heldGunsWithAmmo } from "./knowledge/arsenal.ts";
export {
    bodyHitsToKill,
    type GunTier,
    type GunTierInfo,
    gunClassOf,
    gunRank,
    gunTier,
    isWeakGun,
    perfectTtk,
    S_RULE_GUNS,
    skillFit,
    TIER_BASE,
    TIER_ORDER,
    tierAtLeast,
    tieredGuns,
    tierRank,
} from "./knowledge/gunTiers.ts";
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
export { AirdropMemory, type KnownAirdrop } from "./perception/airdrops.ts";
export { EnemyIntelTracker } from "./perception/enemyIntel.ts";
export { installPerception } from "./perception/install.ts";
export {
    type EnemyAction,
    type EnemyIntel,
    type EnemyIntelProvider,
    NO_INTEL,
    NullEnemyIntel,
} from "./perception/intel.ts";
export { concealed, humanScreen, onHumanScreen } from "./perception/sight.ts";
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
    baseDesire,
    isNeutral,
    isPersonaName,
    mayCamp,
    NEUTRAL,
    PERSONA_MIX,
    PERSONA_NAMES,
    PERSONA_SALT,
    PERSONAS,
    type PersonaName,
    type PersonaParams,
    personaBag,
    personaParams,
    pickPersona,
    ROLE_PERSONA,
    shuffleBag,
    withPersona,
} from "./persona.ts";
export {
    type BotAssignment,
    type BotRecord,
    type MatchConfig,
    type MatchProbe,
    type MatchReport,
    type PopulationConfig,
    runMatch,
    scaledGas,
} from "./runner.ts";
export {
    DEFAULT_SKILL_MIX,
    drawSkill,
    PRESET_SKILL,
    parseSkillMix,
    REACTION_FLOOR,
    SKILL_SIGMA,
    SKILL_TIERS,
    type SkillProfile,
    type SkillTierDef,
    skillOf,
    skillParams,
    skillSigma,
    tierOfSkill,
    tierParams,
} from "./skill.ts";
export { type Finish, finishOrder, MatchStats, type PlayerCombatStats, type StatsGame } from "./stats.ts";
export { TimingHistogram, type TimingHistogramJSON, type TimingSummary } from "./timing.ts";
