// GameHost: runs the games of this server on one wall-clock timer, hands out join tokens, creates a game when none
// can take the joining players (full at maxPlayers, counting seats reserved by unexpired tokens, or past its join
// window: survev game.ts canJoin), closes games `gameOverGraceMs` after they ended and removes games that stayed
// empty for the grace period. Games are per map and team mode (M6a: duo and squad games).
import { randomInt } from "node:crypto";
import { MapDefs } from "@rebirth/defs";
import type { ServerConfig } from "./config.ts";
import { GameRoom, type RoomStats } from "./room.ts";
import { JoinTokens } from "./tokens.ts";

/** Timer period of the game loop; each room's accumulator decides how many ticks are due. */
const LOOP_INTERVAL_MS = 4;
/** Housekeeping (expired tokens, empty games) period. */
const SWEEP_INTERVAL_MS = 1000;

export interface HostStats {
    games: RoomStats[];
    players: number;
    pendingTokens: number;
    heapUsedMb: number;
    rssMb: number;
    uptimeS: number;
}

export class GameHost {
    readonly config: ServerConfig;
    readonly tokens: JoinTokens;
    readonly rooms = new Map<string, GameRoom>();
    private loopTimer: ReturnType<typeof setInterval> | null = null;
    private lastSweep = 0;
    private readonly startedAt = Date.now();
    /** called when a room is removed (sessions of that room are closed by the server) */
    onRoomClosed: ((room: GameRoom) => void) | null = null;

    constructor(config: ServerConfig) {
        this.config = config;
        this.tokens = new JoinTokens(config.joinTokenTtlMs);
    }

    start(): void {
        if (this.loopTimer) return;
        this.loopTimer = setInterval(() => this.loop(), LOOP_INTERVAL_MS);
    }

    stop(): void {
        if (this.loopTimer) clearInterval(this.loopTimer);
        this.loopTimer = null;
        for (const room of [...this.rooms.values()]) this.closeRoom(room);
    }

    get playerCount(): number {
        let n = 0;
        for (const room of this.rooms.values()) n += room.playerCount;
        return n;
    }

    getRoom(id: string): GameRoom | undefined {
        return this.rooms.get(id);
    }

    /**
     * A game of `mapName` and `teamMode` that can take `seats` more players (a party), created if needed; null when
     * the server is full.
     */
    findRoom(mapName: string, teamMode: 1 | 2 | 4 = 1, seats = 1): GameRoom | null {
        let best: GameRoom | null = null;
        for (const room of this.rooms.values()) {
            if (room.mapName !== mapName || room.teamMode !== teamMode || !room.canJoin()) continue;
            if (room.playerCount + this.tokens.pendingFor(room.id) + seats > this.config.maxPlayers) continue;
            // the oldest joinable game fills first (survev gameProcessManager)
            if (!best || room.createdAt < best.createdAt) best = room;
        }
        if (best) return best;
        if (this.rooms.size >= this.config.maxGames || seats > this.config.maxPlayers) return null;
        return this.createRoom(mapName, teamMode);
    }

    createRoom(mapName: string, teamMode: 1 | 2 | 4 = 1): GameRoom {
        if (!Object.hasOwn(MapDefs, mapName)) throw new Error(`unknown map "${mapName}"`);
        const room = new GameRoom(this.config, mapName, randomInt(0, 2 ** 32 - 1), Date.now(), teamMode);
        this.rooms.set(room.id, room);
        if (this.config.log) {
            console.log(`game ${room.id} created (${mapName}, team mode ${teamMode}, seed ${room.game.options.seed})`);
        }
        return room;
    }

    closeRoom(room: GameRoom): void {
        if (!this.rooms.delete(room.id)) return;
        this.onRoomClosed?.(room);
        if (this.config.log) console.log(`game ${room.id} removed after ${room.game.tick} ticks`);
    }

    /** One loop iteration: advance every game, then housekeeping. Public for tests. */
    loop(now = performance.now()): void {
        for (const room of [...this.rooms.values()]) {
            try {
                room.advance(now);
            } catch (err) {
                // one broken game must not take the others down: drop it and disconnect its players
                console.error(`game ${room.id} crashed:`, err);
                this.closeRoom(room);
                continue;
            }
            // the game ended: its clients got GameOver, the room closes after the grace period (survev stopTicker)
            if (room.overSince !== null && now - room.overSince >= this.config.gameOverGraceMs) this.closeRoom(room);
        }
        const wall = Date.now();
        if (wall - this.lastSweep >= SWEEP_INTERVAL_MS) {
            this.lastSweep = wall;
            this.sweep(wall);
        }
    }

    /** Expires tokens and removes games empty for longer than the grace period. */
    sweep(wall = Date.now()): void {
        this.tokens.sweep();
        for (const room of [...this.rooms.values()]) {
            if (room.emptySince === null || this.tokens.pendingFor(room.id) > 0) continue;
            if (wall - room.emptySince >= this.config.emptyGameGraceMs) this.closeRoom(room);
        }
    }

    stats(): HostStats {
        const mem = process.memoryUsage();
        return {
            games: [...this.rooms.values()].map((r) => r.stats()),
            players: this.playerCount,
            pendingTokens: this.tokens.size,
            heapUsedMb: Math.round((mem.heapUsed / 1048576) * 10) / 10,
            rssMb: Math.round((mem.rss / 1048576) * 10) / 10,
            uptimeS: Math.round((Date.now() - this.startedAt) / 1000),
        };
    }
}
