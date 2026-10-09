// Public API of the simulation. `Game` in game.ts implements `GameApi`.
import type { PlayerInput } from "./input.ts";
import type { AddPlayerOptions, EmoteRequest, MapData, Snapshot } from "./view.ts";

/** Fixed simulation rate. */
export const TICK_HZ = 100;
/** A snapshot is produced every N ticks (~33 Hz), matching the original update rate. */
export const SNAPSHOT_EVERY_TICKS = 3;

export interface GameOptions {
    /** MapDefs key */
    mapName: string;
    seed: number;
    /** 1 solo (default), 2 duo, 4 squad (M6a: groups, knocks and revives) */
    teamMode?: 1 | 2 | 4;
    /**
     * The game's player cap (the server's MAX_PLAYERS / FACTION_MAX_PLAYERS). Above the map's design count the map is
     * larger (defs mapDefForPlayers), its gas and schedules slower (match/gasScale.ts) and that many may play; absent:
     * the map's own size and maxPlayers.
     */
    maxPlayers?: number;
}

/** Spectate requests of a dead player (the original Spectate message: Begin, Next, Prev). */
export type SpectateActionName = "begin" | "next" | "prev";

export interface GameApi {
    readonly options: GameOptions;
    readonly mapData: MapData;
    /** current tick count */
    readonly tick: number;
    /** simulation time in seconds */
    readonly time: number;
    /**
     * Spawns a player at a valid spawn point and returns its object id. Team modes: `opts` picks the group (party key,
     * auto fill) and teammates spawn next to each other (M6a).
     */
    addPlayer(name: string, opts?: AddPlayerOptions): number;
    removePlayer(id: number): void;
    /** Latest input for a player; applied on the next step. */
    setInput(playerId: number, input: PlayerInput): void;
    /** Advances exactly one fixed tick (1 / TICK_HZ seconds). */
    step(): void;
    /** Snapshot of the world as `playerId` sees it. Tracks per-player state for deletedIds. */
    getSnapshot(playerId: number): Snapshot;
    /** Whether a new player may join this game now (join window, player limit, game over) (M4). */
    canJoin(): boolean;
    /** Spectate request of a dead player; ignored for living players (M4). */
    spectate(playerId: number, action: SpectateActionName): void;
    /** Emote or ping request (the original Emote message); throttled, invalid requests are ignored (M6a). */
    emote(playerId: number, request: EmoteRequest): void;
}
