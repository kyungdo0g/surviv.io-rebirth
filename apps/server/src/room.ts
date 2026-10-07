// One running game: the simulation driven by a fixed-step accumulator at TICK_HZ (wall-clock driven, catching up
// at most `maxCatchUpTicks` per call), and a netsync every SNAPSHOT_EVERY_TICKS ticks that sends each member its
// frame, encoded through the game's shared ObjectCache: [AliveCounts when changed] Update [PlayerStats]
// [GameOver] Kill... RoleAnnouncement... The Kill and RoleAnnouncement messages carry every kill of the game since
// the member's previous frame (broadcast), PlayerStats / GameOver only the member's own result (per player), as in
// the original (netcode.md "Message framing"). The host closes the room `gameOverGraceMs` after the game ended.
// Team rooms (M6a) run a duo or squad game: a join may carry a party's group data, and members' emote requests go
// to the game. 50v50 rooms (M7a) run squads inside the factions, seat FACTION_MAX_PLAYERS and fill with
// FACTION_BOT_FILL bots; Cobalt class choices (PerkModeRoleSelect) go to the game. With BOT_FILL (M6b) a room fills its game with in-process bots while it is joinable (bots.ts); bots are
// players of the game, not members: they have no seat, so player counts, emptiness and room stats are about humans.
// M8: with the anti-cheat on, the room's MatchTelemetry observes the game's combat and its members' inputs (humans only;
// bots are never tracked), is scored once per simulated second and hands flags to `onFlag`; every human that joined is
// remembered (name, address) so reports can name players after they left.
import { randomUUID } from "node:crypto";
import { BitWriter } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { ClientEncoder, encodeMapMsg, MAX_OBJECT_ID, MsgType, ObjectCache, writeServerMsg } from "@rebirth/protocol";
import {
    type AddPlayerOptions,
    type EmoteRequest,
    Game,
    type PlayerInput,
    SNAPSHOT_EVERY_TICKS,
    type SpectateActionName,
    TICK_HZ,
} from "@rebirth/sim";
import { MatchTelemetry, type SuspectFlag } from "./anticheat/match.ts";
import { BotFill } from "./bots.ts";
import { isFactionMap, roomCapacity, type ServerConfig } from "./config.ts";
import type { MatchContext, PlayerRecord } from "./moderation/matches.ts";
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
    /** client address (M8: telemetry, reports) */
    readonly ip?: string;
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
    /** 1 solo, 2 duo, 4 squad */
    teamMode: number;
    players: number;
    /** living players in the game (disconnected ones and bots included) */
    alive: number;
    /** fill bots in the game (alive or dead), and the living ones; never counted in `players` */
    bots: number;
    botsAlive: number;
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
    /** 1 solo, 2 duo, 4 squad (M6a) */
    readonly teamMode: 1 | 2 | 4;
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
    /** bot fill (null when BOT_FILL is 0) */
    readonly bots: BotFill | null;
    /** players this room seats (MAX_PLAYERS, FACTION_MAX_PLAYERS for 50v50; M7a) */
    readonly capacity: number;
    /** anti-cheat telemetry (M8; null with ANTICHEAT=0) */
    readonly telemetry: MatchTelemetry | null;
    /** receives anti-cheat flags (the host forwards them to the server's suspect log) */
    onFlag: ((flag: SuspectFlag) => void) | null = null;
    /** every human that joined, by player id (kept after they leave, for reports) */
    private readonly humans = new Map<number, { name: string; ip: string }>();

    constructor(config: ServerConfig, mapName: string, seed: number, now: number, teamMode: 1 | 2 | 4 = 1) {
        this.config = config;
        this.mapName = mapName;
        this.teamMode = teamMode;
        this.game = new Game({ mapName, seed: seed >>> 0, teamMode }, { minPlayers: config.minPlayers });
        // rebirth 50v50 air strike variants (AIRSTRIKE_VARIANTS; the sim rolls them on faction maps only)
        this.game.rules.roles.factionAirstrikeVariants = { ...config.airstrikeVariants };
        this.cache = new ObjectCache({ width: this.game.mapData.width, height: this.game.mapData.height });
        this.mapMsg = encodeMapMsg(this.game.mapData);
        this.createdAt = now;
        this.emptySince = now;
        this.capacity = roomCapacity(config, mapName);
        const botTarget = isFactionMap(mapName) ? config.factionBotFill : config.botFill;
        this.bots =
            botTarget > 0
                ? new BotFill(this.game, {
                      target: botTarget,
                      difficulty: config.botDifficulty,
                      joinIntervalTicks: Math.round((config.botFillIntervalMs / 1000) * TICK_HZ),
                      seed: seed >>> 0,
                      onError: (err) => {
                          if (this.bots?.errors === 1) console.error(`game ${this.id}: a bot failed (dropped):`, err);
                      },
                  })
                : null;
        this.telemetry = config.antiCheat
            ? new MatchTelemetry(this.game, {
                  gameId: this.id,
                  mapName,
                  teamMode: this.game.options.teamMode ?? teamMode,
                  thresholds: config.antiCheat,
              })
            : null;
        this.game.observer = this.telemetry;
    }

    get playerCount(): number {
        return this.seats.size;
    }

    get isFull(): boolean {
        return this.seats.size >= this.capacity || !this.hasIdHeadroom();
    }

    /**
     * Whether find_game may route a new player here: seats left and the game's join window open. A game full of
     * players still takes a human when a fill bot can give up its seat.
     */
    canJoin(): boolean {
        if (this.isFull) return false;
        return this.game.canJoin() || (this.bots?.canMakeRoom() ?? false);
    }

    /** Whether object ids still fit the u16 wire id with room to spare (the simulation never reuses ids). */
    hasIdHeadroom(): boolean {
        let max = 0;
        for (const id of this.game.world.objects.keys()) if (id > max) max = id;
        return max < MAX_OBJECT_ID - ID_HEADROOM;
    }

    /**
     * Adds a player for `member` (in team modes into the group `opts` picks: party key, auto fill; M8: `isMobile` for
     * touch clients); returns its id and the first frame (Joined + Map).
     */
    join(member: RoomMember, name: string, opts?: AddPlayerOptions): { playerId: number; frame: Uint8Array } {
        // a human takes the seat of a fill bot when the game is at its target or full
        this.bots?.makeRoom();
        const playerId = this.game.addPlayer(name, opts);
        if (this.config.debugSpawnTogether) this.spawnNearFirstPlayer(playerId);
        const cache = this.sharedCache ? this.cache : new ObjectCache(this.cache.ctx);
        this.seats.set(playerId, { member, encoder: new ClientEncoder(cache), name });
        this.humans.set(playerId, { name, ip: member.ip ?? "" });
        this.telemetry?.track(playerId, name, member.ip ?? "", opts?.isMobile ?? false);
        this.emptySince = null;
        const w = new BitWriter(this.mapMsg.length + 64);
        writeServerMsg(w, {
            type: MsgType.Joined,
            teamMode: this.game.options.teamMode ?? 1,
            playerId,
            started: this.game.started,
            // the emote loadout (wheel, win and death slots); loadouts are not modelled: the original defaults
            emotes: [...GameConfig.defaultEmoteLoadout],
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
        if (this.telemetry) {
            this.telemetry.leave(playerId);
            this.emitFlags(this.telemetry.evaluate(playerId));
        }
    }

    setInput(playerId: number, input: PlayerInput): void {
        if (!this.seats.has(playerId)) return;
        this.game.setInput(playerId, input);
        this.telemetry?.onInput(playerId, input);
    }

    /** Scores every tracked player now and forwards new flags (the host calls it when the room closes). */
    evaluateTelemetry(): void {
        if (this.telemetry) this.emitFlags(this.telemetry.evaluate());
    }

    private emitFlags(flags: SuspectFlag[]): void {
        for (const f of flags) this.onFlag?.(f);
    }

    /** A player of this game as reports record it (humans that left included); null for an unknown id. */
    playerRecord(playerId: number): PlayerRecord | null {
        const human = this.humans.get(playerId);
        const player = this.game.getPlayer(playerId);
        if (!human && !player) return null;
        return {
            playerId,
            name: human?.name ?? player?.name ?? "",
            ip: human ? human.ip : null,
            // every player that never had a seat is a fill bot
            bot: !human,
            telemetry: this.telemetry?.snapshot(playerId) ?? null,
        };
    }

    /** Every human that joined and every player still in the game. */
    playerRecords(): PlayerRecord[] {
        const ids = new Set<number>(this.humans.keys());
        for (const p of this.game.players()) ids.add(p.id);
        return [...ids].flatMap((id) => this.playerRecord(id) ?? []);
    }

    /** This room as the match of a report. */
    matchContext(): MatchContext {
        return {
            gameId: this.id,
            mapName: this.mapName,
            teamMode: this.teamMode,
            player: (id) => this.playerRecord(id),
        };
    }

    /** Spectate request of a member (ignored while its player lives). */
    spectate(playerId: number, action: SpectateActionName): void {
        if (this.seats.has(playerId)) this.game.spectate(playerId, action);
    }

    /** Cobalt class choice of a member (the original PerkModeRoleSelect; the game validates it, M7a). */
    selectRole(playerId: number, role: string): void {
        if (this.seats.has(playerId)) this.game.selectRole(playerId, role);
    }

    /** Drop request of a member (the original DropItem; the game validates it, M7b). */
    dropItem(playerId: number, item: string, weapIdx: number): void {
        if (this.seats.has(playerId)) this.game.dropItem(playerId, item, weapIdx);
    }

    /** Emote or ping request of a member (the game validates and throttles it, M6a). */
    emote(playerId: number, request: EmoteRequest): void {
        if (this.seats.has(playerId)) this.game.emote(playerId, request);
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
        // bots read their snapshots and set their inputs before the step, like inputs arriving from sockets
        this.bots?.update();
        this.game.step();
        const t1 = performance.now();
        this.tickTimes.add(t1 - t0);
        if (this.game.tick % SNAPSHOT_EVERY_TICKS === 0) {
            this.netsync();
            this.netsyncTimes.add(performance.now() - t1);
        }
        // anti-cheat scores once per simulated second (M8)
        if (this.telemetry && this.game.tick % TICK_HZ === 0) this.emitFlags(this.telemetry.evaluate());
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
            teamMode: this.teamMode,
            players: this.seats.size,
            alive: this.game.aliveCount,
            bots: this.bots?.count ?? 0,
            botsAlive: this.bots?.aliveCount ?? 0,
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
