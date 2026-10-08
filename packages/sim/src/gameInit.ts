// Construction options of a Game (tests, tools, the client's loopback and the server's rooms) and the default start
// condition, kept apart from game.ts so the simulation class stays readable; index.ts exports both.
import type { GasStage } from "@rebirth/defs";
import type { GenerateMapResult } from "./mapgen/generate.ts";

/** Optional construction parameters for tests, tools and the client's loopback. */
export interface GameInit {
    /** use this generated map instead of generating one from the options */
    generation?: GenerateMapResult;
    /** roll the map's loot spawners at creation (default true) */
    spawnLoot?: boolean;
    /**
     * Sandbox / loopback (M4): the match starts on the first step even with a single player, never ends (no game
     * over, no winner) and always accepts joins. The gas, planes and kill feed run as usual.
     */
    sandbox?: boolean;
    /**
     * Living players needed to start the match, each alive for `rules.minActiveTime` (10 s); default 2 like the
     * original (M4); team modes count groups with such a player (M6a). Until then the gas stays "inactive" (the client
     * shows "Waiting for players").
     */
    minPlayers?: number;
    /** raises the map mode's player cap (never lowers it); the server passes its MAX_PLAYERS */
    maxPlayers?: number;
    /** gas stage table (default GameConfig.gas.stages; tools and tests use shorter ones) */
    gasStages?: readonly GasStage[];
    /** rebirth new-gun beta (rules.gunBeta, server GUN_BETA): set before the map loot spawns (default false) */
    gunBeta?: boolean;
}

/** Default start condition: two players (survev gameModeManager isGameStarted: cantDespawnAliveCount > 1). */
export const DEFAULT_MIN_PLAYERS = 2;
