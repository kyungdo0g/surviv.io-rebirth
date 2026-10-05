// One running game: the simulation driven by a fixed-step accumulator at TICK_HZ (wall-clock driven, catching up
// at most `maxCatchUpTicks` per call), and a netsync every SNAPSHOT_EVERY_TICKS ticks that sends each member its
// frame, encoded through the game's shared ObjectCache: [AliveCounts when changed] Update [PlayerStats]
// [GameOver] Kill... RoleAnnouncement... The Kill and RoleAnnouncement messages carry every kill of the game since
// the member's previous frame (broadcast), PlayerStats / GameOver only the member's own result (per player), as in
// the original (netcode.md "Message framing"). The host closes the room `gameOverGraceMs` after the game ended.
import { randomUUID } from "node:crypto";
import { BitWriter } from "@rebirth/core";
import { ClientEncoder, encodeMapMsg, MAX_OBJECT_ID, MsgType, ObjectCache, writeServerMsg } from "@rebirth/protocol";
import { Game, type PlayerInput, SNAPSHOT_EVERY_TICKS, type SpectateActionName, TICK_HZ } from "@rebirth/sim";
import type { ServerConfig } from "./config.ts";
import { type Percentiles, roundSummary, SampleWindow } from "./stats.ts";

const TICK_MS = 1000 / TICK_HZ;
/** ids kept free for the loot, players and other objects a running game still creates */
const ID_HEADROOM = 8192;
const MIN_NETSYNC_BYTES = 4096;

/** What a room needs from a connection. */
export interface RoomMember {
    /** last input seq received, echoed as the Update ack */
    readonly ack: number;
    /** bytes queued on the socket (congested sockets skip updates) */
    readonly bufferedAmount: number;
    sendFrame(bytes: Uint8Array): void;
}

interface Seat {
    member: RoomMember;
    encoder: ClientEncoder;
    name: string;
}

export interface RoomStats {
    id: string;
    mapName: string;
    players: number;
    /** living players in the game (disconnected ones included) */
    alive: number;
    started: boolean;
    over: boolean;
    tick: number;
    tickMs: Percentiles;
    netsyncMs: Percentiles;
    /** ticks dropped because the loop fell too far behind */
    droppedTicks: number;
    /** updates skipped for congested sockets */
    skippedUpdates: number;
    bytesSent: number;
    cache: { entries: number; quantized: number; hits: number; fullBuilt: number; partBuilt: number };
}

export class GameRoom {
    readonly id: string = randomUUID();
    readonly mapName: string;
    readonly game: Game;
    readonly cache: ObjectCache;
    /** the Map message, encoded once and copied into every join frame */
    readonly mapMsg: Uint8Array;
    readonly createdAt: number;
    /** wall-clock ms when the room became empty, null while it has players */
    emptySince: number | null;
    /** loop clock (ms) of the first advance that saw the game over, null before */
    overSince: number | null = null;
    private readonly config: ServerConfig;
    private readonly seats = new Map<number, Seat>();
    private readonly tickTimes = new SampleWindow();
    private readonly netsyncTimes = new SampleWindow(2000);
    private accumulator = 0;
    private lastAdvance = -1;
    private droppedTicks = 0;
    private skippedUpdates = 0;
    private bytesSent = 0;
    /** initial capacity of the next netsync's writer */
    private netsyncBytes = MIN_NETSYNC_BYTES;
    /** set to false to give every member a private cache (benchmarks) */
    sharedCache = true;

    constructor(config: ServerConfig, mapName: string, seed: number, now: number) {
        this.config = config;
        this.mapName = mapName;
        this.game = new Game({ mapName, seed: seed >>> 0 }, { minPlayers: config.minPlayers });
        this.cache = new ObjectCache({ width: this.game.mapData.width, height: this.game.mapData.height });
        this.mapMsg = encodeMapMsg(this.game.mapData);
        this.createdAt = now;
        this.emptySince = now;
    }

    get playerCount(): number {
        return this.seats.size;
    }

    get isFull(): boolean {
        return this.seats.size >= this.config.maxPlayers || !this.hasIdHeadroom();
    }

    /** Whether find_game may route a new player here: seats left and the game's join window open. */
    canJoin(): boolean {
        return !this.isFull && this.game.canJoin();
    }

    /** Whether object ids still fit the u16 wire id with room to spare (the simulation never reuses ids). */
    hasIdHeadroom(): boolean {
        let max = 0;
        for (const id of this.game.world.objects.keys()) if (id > max) max = id;
        return max < MAX_OBJECT_ID - ID_HEADROOM;
    }

    /** Adds a player for `member`; returns its id and the first frame (Joined + Map). */
    join(member: RoomMember, name: string): { playerId: number; frame: Uint8Array } {
        const playerId = this.game.addPlayer(name);
        if (this.config.debugSpawnTogether) this.spawnNearFirstPlayer(playerId);
        const cache = this.sharedCache ? this.cache : new ObjectCache(this.cache.ctx);
        this.seats.set(playerId, { member, encoder: new ClientEncoder(cache), name });
        this.emptySince = null;
        const w = new BitWriter(this.mapMsg.length + 64);
        writeServerMsg(w, {
            type: MsgType.Joined,
            teamMode: this.game.options.teamMode ?? 1,
            playerId,
            started: this.game.started,
            emotes: [],
        });
        w.writeBytes(this.mapMsg);
        return { playerId, frame: w.getBuffer() };
    }

    /** DEBUG_SPAWN_TOGETHER: moves a new player to a free spot a few units from the room's first player. */
    private spawnNearFirstPlayer(playerId: number): void {
        const first = [...this.seats.keys()][0];
        const anchor = first === undefined ? undefined : this.game.getPlayer(first)?.pos;
        if (!anchor) return;
        for (let ring = 1; ring <= 6; ring++) {
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                const pos = { x: anchor.x + Math.cos(a) * ring * 3, y: anchor.y + Math.sin(a) * ring * 3 };
                if (this.game.canPlayerSpawn(pos)) {
                    this.game.teleportPlayer(playerId, pos);
                    return;
                }
            }
        }
    }

    /** The member's socket closed: a young player despawns, any other stays in the game idle (survev). */
    leave(playerId: number, now: number): void {
        if (!this.seats.delete(playerId)) return;
        this.game.disconnectPlayer(playerId);
        if (this.seats.size === 0) this.emptySince = now;
    }

    setInput(playerId: number, input: PlayerInput): void {
        if (this.seats.has(playerId)) this.game.setInput(playerId, input);
    }

    /** Spectate request of a member (ignored while its player lives). */
    spectate(playerId: number, action: SpectateActionName): void {
        if (this.seats.has(playerId)) this.game.spectate(playerId, action);
    }

    /** Runs the ticks due at wall-clock time `now` (ms). */
    advance(now: number): void {
        if (this.lastAdvance < 0) this.lastAdvance = now;
        this.accumulator += now - this.lastAdvance;
        this.lastAdvance = now;
        let ticks = 0;
        while (this.accumulator >= TICK_MS && ticks < this.config.maxCatchUpTicks) {
            this.tick();
            this.accumulator -= TICK_MS;
            ticks++;
        }
        if (this.accumulator >= TICK_MS) {
            // too far behind: drop the backlog instead of fast-forwarding the game
            this.droppedTicks += Math.floor(this.accumulator / TICK_MS);
            this.accumulator %= TICK_MS;
        }
        if (this.game.over && this.overSince === null) this.overSince = now;
    }

    /** One simulation tick, plus the netsync when a snapshot is due. */
    tick(): void {
        const t0 = performance.now();
        this.game.step();
        const t1 = performance.now();
        this.tickTimes.add(t1 - t0);
        if (this.game.tick % SNAPSHOT_EVERY_TICKS === 0) {
            this.netsync();
            this.netsyncTimes.add(performance.now() - t1);
        }
    }

    private netsync(): void {
        // one writer for every member's update (sized from the previous netsync): a fresh typed array per client
        // costs more than the encoding itself; each update is copied out into a small pooled Buffer at once
        const w = new BitWriter(this.netsyncBytes);
        for (const [playerId, seat] of this.seats) {
            // a congested socket skips this update; its encoder sends full records for what it missed
            if (seat.member.bufferedAmount > this.config.maxBufferedBytes) {
                this.skippedUpdates++;
                continue;
            }
            const snap = this.game.getSnapshot(playerId);
            const start = w.byteLength;
            seat.encoder.writeFrame(w, snap, seat.member.ack);
            const bytes = Buffer.from(w.getBuffer().subarray(start));
            this.bytesSent += bytes.length;
            seat.member.sendFrame(bytes);
        }
        this.netsyncBytes = Math.max(MIN_NETSYNC_BYTES, Math.ceil(w.byteLength * 1.25));
        this.cache.maybeSweep(this.game.tick);
    }

    /** Sends the same frame to every member (later broadcast messages: Kill, RoleAnnouncement...). */
    broadcast(bytes: Uint8Array): void {
        for (const seat of this.seats.values()) seat.member.sendFrame(bytes);
    }

    members(): RoomMember[] {
        return [...this.seats.values()].map((s) => s.member);
    }

    stats(): RoomStats {
        const c = this.cache.stats;
        return {
            id: this.id,
            mapName: this.mapName,
            players: this.seats.size,
            alive: this.game.aliveCount,
            started: this.game.started,
            over: this.game.over,
            tick: this.game.tick,
            tickMs: roundSummary(this.tickTimes.summary(), 4),
            netsyncMs: roundSummary(this.netsyncTimes.summary(), 4),
            droppedTicks: this.droppedTicks,
            skippedUpdates: this.skippedUpdates,
            bytesSent: this.bytesSent,
            cache: { entries: this.cache.size, ...c },
        };
    }

    /** Clears the timing windows (soak runs measure after a warm-up). */
    resetTimings(): void {
        this.tickTimes.reset();
        this.netsyncTimes.reset();
    }
}
