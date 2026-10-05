// Public API of the simulation. `Game` in game.ts implements `GameApi`.
import type { PlayerInput } from "./input.ts";
import type { MapData, Snapshot } from "./view.ts";

/** Fixed simulation rate. */
export const TICK_HZ = 100;
/** A snapshot is produced every N ticks (~33 Hz), matching the original update rate. */
export const SNAPSHOT_EVERY_TICKS = 3;

export interface GameOptions {
    /** MapDefs key */
    mapName: string;
    seed: number;
    /** 1 solo, 2 duo, 4 squad */
    teamMode?: 1 | 2 | 4;
}

export interface GameApi {
    readonly options: GameOptions;
    readonly mapData: MapData;
    /** current tick count */
    readonly tick: number;
    /** simulation time in seconds */
    readonly time: number;
    /** Spawns a player at a valid spawn point and returns its object id. */
    addPlayer(name: string): number;
    removePlayer(id: number): void;
    /** Latest input for a player; applied on the next step. */
    setInput(playerId: number, input: PlayerInput): void;
    /** Advances exactly one fixed tick (1 / TICK_HZ seconds). */
    step(): void;
    /** Snapshot of the world as `playerId` sees it. Tracks per-player state for deletedIds. */
    getSnapshot(playerId: number): Snapshot;
}
