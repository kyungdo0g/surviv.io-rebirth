// Contract types of the battle-royale loop (M4: gas, planes, air drops, map indicators, kills, roles, results) and of
// M7a (perks, haste, faction minimap rows). They are re-exported from view.ts, whose header documents how they are
// used; consumers import them from "@rebirth/sim" like every other view type.
import type { Vec2 } from "@rebirth/core";

/** One perk a player holds (the original Player record's perk entry) (M7a). */
export interface PerkView {
    /** GameObjectDefs perk id */
    type: string;
    /** a loot perk the player can drop (role, helmet and trick-or-treat perks cannot) */
    droppable: boolean;
}

/** Speed bursts (the original HasteType: Windwalk 1, Takedown 2, Inspire 3) (M7a). */
export type HasteName = "none" | "windwalk" | "takedown" | "inspire";

/** A member of the viewer's faction on the 50v50 minimap (the original faction PlayerStatus record) (M7a). */
export interface FactionMemberView {
    playerId: number;
    /** position at the last faction status refresh */
    pos: Vec2;
    dead: boolean;
    downed: boolean;
    /** role id, "" for none */
    role: string;
}

export type GasModeName = "inactive" | "waiting" | "moving";

/**
 * Red zone state (the original gas section plus its progress `gasT`). Before the match starts the gas is
 * "inactive" (the client shows "Waiting for players"). Each circle has a "waiting" stage (the next safe circle
 * `posNew`/`radNew` is shown, the zone does not move) and a "moving" stage (the zone closes linearly from
 * `posOld`/`radOld` to `posNew`/`radNew` over `duration`). The current circle is `gasCircle(gas)`.
 */
export interface GasView {
    mode: GasModeName;
    /** index into GameConfig.gas.stages; stages.length once the last stage has ended (the zone stays closed) */
    stage: number;
    /** -1 before the first circle; incremented when each waiting stage starts */
    circleIdx: number;
    /** duration of the current stage in seconds */
    duration: number;
    /** progress through the current stage, 0..1 (time left = duration * (1 - gasT)) */
    gasT: number;
    posOld: Vec2;
    posNew: Vec2;
    radOld: number;
    radNew: number;
    /** damage dealt every GameConfig.gas.damageTickRate seconds to players outside the circle (ignores armor) */
    damage: number;
}

export type PlaneType = "airdrop" | "airstrike";

export interface PlaneView {
    /** plane id (1..255, not an object id) */
    id: number;
    pos: Vec2;
    /** unit flight direction */
    dir: Vec2;
    planeType: PlaneType;
    /** the plane released its crate (air drop) or bombs (air strike) */
    actionComplete: boolean;
}

/** A falling air drop crate (the original Airdrop object). When it lands, the crate obstacle appears. */
export interface AirdropView {
    /** object id (unique among objects) */
    id: number;
    pos: Vec2;
    /** fall progress 0..1 over GameConfig.airdrop.fallTime */
    fallT: number;
    landed: boolean;
}

export interface MapIndicatorView {
    /** indicator id 0..15 (reused after the indicator died) */
    id: number;
    /** GameObjectDefs id, e.g. "ping_airdrop" (drawn with its `mapTexture`) */
    type: string;
    pos: Vec2;
    /** the indicator was removed: the client drops it */
    dead: boolean;
    equipped: boolean;
}

/** How a player died, derived from the damage type and the source defs (kill feed wording). */
export type DamageSource =
    | "gun"
    | "melee"
    | "explosion"
    | "gas"
    | "bleed"
    | "airdrop"
    | "airstrike"
    | "collapse"
    | "other";

/** One kill (the original Kill message). */
export interface KillEvent {
    /** the player who died (or was downed, M6) */
    targetId: number;
    /** player whose hit caused it; 0 for the environment (gas, air drop) and for bleeding */
    killerId: number;
    /** player credited with the kill (0 for none; the victim itself for a suicide) */
    killCreditId: number;
    /** kill count of the credited player after this kill */
    killerKills: number;
    /** defs DamageType (Player 0, Bleeding 1, Gas 2, Airdrop 3, Airstrike 4, rebirth Collapse 5) */
    damageType: number;
    source: DamageSource;
    /** GameObjectDefs id of the weapon, "" for none */
    itemSourceType: string;
    /** MapObjectDefs id of the obstacle that dealt it (exploding barrel), "" for none */
    mapSourceType: string;
    /** knocked down, not killed (team modes, M6a) */
    downed: boolean;
    killed: boolean;
}

/**
 * A role event (the original RoleAnnouncement message): "promoted to Kill Leader!" / "killed Kill Leader!"; since M7a
 * every role (faction roles, Lone Survivr, The Hunted, Cobalt classes) is announced the same way.
 */
export interface RoleAnnouncementEvent {
    playerId: number;
    /** who killed the role holder (0 when not killed) */
    killerId: number;
    /** GameObjectDefs role id, e.g. "kill_leader", "leader", "last_man" */
    role: string;
    assigned: boolean;
    killed: boolean;
}

export interface KillLeaderView {
    /** 0 for none */
    id: number;
    kills: number;
}

/** End-of-life stats of one player (the original PlayerStats record; integers). */
export interface PlayerStatsView {
    playerId: number;
    /** whole seconds alive */
    timeAlive: number;
    kills: number;
    dead: boolean;
    damageDealt: number;
    damageTaken: number;
}

/** The viewer's match result (the original GameOver message). */
export interface GameOverEvent {
    /** the viewer's team (solo: a per-player id) */
    teamId: number;
    /** final rank of the viewer's team: 1 for the winner, else living teams + 1 when it was eliminated */
    teamRank: number;
    /** the match is over (a winner exists) */
    gameOver: boolean;
    /** team id of the winner, 0 while the match goes on */
    winningTeamId: number;
    /** stats of the viewer's team members (solo: the viewer) */
    playerStats: PlayerStatsView[];
}
