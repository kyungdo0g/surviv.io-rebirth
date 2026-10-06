// Server configuration from environment variables, validated with zod. Limits default to survev's production
// values (docs/research/engine/netcode.md "Limits and rate limits").
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getMapDef, MapDefs } from "@rebirth/defs";
import { z } from "zod";
import type { BotDifficultySetting } from "./bots.ts";
import { defaultModes, type ModeEntry, parseModes } from "./modes.ts";

export interface ServerConfig {
    port: number;
    host: string;
    /** players per game (survev maxPlayers 80) */
    maxPlayers: number;
    /** players per 50v50 game (the faction map's maxPlayers, 100; M7a) */
    factionMaxPlayers: number;
    /** games this server runs at most */
    maxGames: number;
    /** map of games created when find_game names none */
    defaultMap: string;
    /**
     * The three play buttons (mode index 0-2) listed by /api/site_info: MODES ("map:teamMode,..."), default Solo, Duo
     * and Squad of MAP_NAME (M7b, modes.ts)
     */
    modes: ModeEntry[];
    /** simultaneous game sockets per IP (survev: 5) */
    maxConnectionsPerIp: number;
    /** messages per second per socket before it is closed with rate_limited (survev: 500) */
    maxMsgsPerSecond: number;
    /** join token lifetime (survev: 10 s) */
    joinTokenTtlMs: number;
    /** time a socket may take to send Join after connecting */
    joinTimeoutMs: number;
    /** an empty game is removed after this long */
    emptyGameGraceMs: number;
    /** ticks a game may run in one timer callback to catch up after a stall */
    maxCatchUpTicks: number;
    /** an update is skipped for a socket whose send buffer exceeds this many bytes (congested client) */
    maxBufferedBytes: number;
    /** directory of a built client served at /, or null */
    clientDist: string | null;
    /** public http(s) origin used to build the /play URL; null: derived from the request's Host header */
    publicUrl: string | null;
    /** take the client IP from X-Forwarded-For (behind a reverse proxy) */
    trustProxy: boolean;
    /** log joins, leaves and game lifecycle */
    log: boolean;
    /** testing aid: players joining a game with others spawn next to its first player */
    debugSpawnTogether: boolean;
    /** living players (alive for 10 s; team modes: groups with such a player) a game needs to start (original: 2) */
    minPlayers: number;
    /** a game is closed (its clients disconnected) this long after a winner was decided (survev: 1.8 s) */
    gameOverGraceMs: number;
    /** party lobby sockets per IP (survev teamMenu: 5) */
    partyMaxConnectionsPerIp: number;
    /** party lobby messages per second per socket (survev: 50) */
    partyMaxMsgsPerSecond: number;
    /** time a party socket may take to create or join a room (survev: 5 s) */
    partyJoinTimeoutMs: number;
    /** party members silent for this long are dropped (survev: 8 minutes; clients keepAlive every 45 s) */
    partyIdleMs: number;
    /**
     * Bot fill (rebirth): players per game that in-process bots fill up to while the game is joinable; 0 turns bots
     * off. Humans joining a full game take the seat of a bot that has not fought yet (bots.ts).
     */
    botFill: number;
    /**
     * Bot fill target of 50v50 games (M7a); defaults to BOT_FILL scaled from MAX_PLAYERS to FACTION_MAX_PLAYERS
     * (BOT_FILL 80 of 80 fills a faction game to 100), 0 when BOT_FILL is 0.
     */
    factionBotFill: number;
    /** difficulty of fill bots: easy, normal, hard or mixed (a third each) */
    botDifficulty: BotDifficultySetting;
    /** milliseconds between two bot joins (bots trickle in like players; 0: all at once) */
    botFillIntervalMs: number;
}

const DEFAULT_CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const bool = z.enum(["0", "1", "true", "false"]).transform((v) => v === "1" || v === "true");

const EnvSchema = z.object({
    PORT: z.coerce.number().int().min(0).max(65535).default(8001),
    HOST: z.string().min(1).default("127.0.0.1"),
    MAX_PLAYERS: z.coerce.number().int().min(1).max(255).default(80),
    FACTION_MAX_PLAYERS: z.coerce.number().int().min(2).max(255).default(100),
    FACTION_BOT_FILL: z.coerce.number().int().min(0).max(255).optional(),
    MAX_GAMES: z.coerce.number().int().min(1).max(256).default(16),
    MAP_NAME: z
        .string()
        .refine((m) => Object.hasOwn(MapDefs, m), { message: "unknown map" })
        .default("main"),
    MODES: z.string().max(200).optional(),
    MAX_CONNECTIONS_PER_IP: z.coerce.number().int().min(1).default(5),
    MAX_MSGS_PER_SECOND: z.coerce.number().int().min(1).default(500),
    JOIN_TOKEN_TTL_MS: z.coerce.number().int().min(1).default(10_000),
    JOIN_TIMEOUT_MS: z.coerce.number().int().min(1).default(10_000),
    EMPTY_GAME_GRACE_MS: z.coerce.number().int().min(0).default(30_000),
    MAX_CATCH_UP_TICKS: z.coerce.number().int().min(1).max(100).default(5),
    MAX_BUFFERED_BYTES: z.coerce
        .number()
        .int()
        .min(1024)
        .default(1 << 20),
    CLIENT_DIST: z.string().optional(),
    PUBLIC_URL: z.url().optional(),
    TRUST_PROXY: bool.default(false),
    LOG: bool.default(true),
    DEBUG_SPAWN_TOGETHER: bool.default(false),
    MIN_PLAYERS: z.coerce.number().int().min(1).max(255).default(2),
    GAME_OVER_GRACE_MS: z.coerce.number().int().min(0).default(1800),
    PARTY_MAX_CONNECTIONS_PER_IP: z.coerce.number().int().min(1).default(5),
    PARTY_MAX_MSGS_PER_SECOND: z.coerce.number().int().min(1).default(50),
    PARTY_JOIN_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
    PARTY_IDLE_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .default(8 * 60 * 1000),
    BOT_FILL: z.coerce.number().int().min(0).max(255).default(0),
    BOT_DIFFICULTY: z.enum(["easy", "normal", "hard", "mixed"]).default("normal"),
    BOT_FILL_INTERVAL_MS: z.coerce.number().int().min(0).default(250),
});

/** Validated configuration; throws an Error listing every invalid variable. */
export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
    const parsed = EnvSchema.safeParse(env);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new Error(`invalid server configuration: ${issues}`);
    }
    const e = parsed.data;
    const clientDist = e.CLIENT_DIST ?? DEFAULT_CLIENT_DIST;
    return {
        port: e.PORT,
        host: e.HOST,
        maxPlayers: e.MAX_PLAYERS,
        factionMaxPlayers: e.FACTION_MAX_PLAYERS,
        maxGames: e.MAX_GAMES,
        defaultMap: e.MAP_NAME,
        modes: e.MODES ? parseModes(e.MODES) : defaultModes(e.MAP_NAME),
        maxConnectionsPerIp: e.MAX_CONNECTIONS_PER_IP,
        maxMsgsPerSecond: e.MAX_MSGS_PER_SECOND,
        joinTokenTtlMs: e.JOIN_TOKEN_TTL_MS,
        joinTimeoutMs: e.JOIN_TIMEOUT_MS,
        emptyGameGraceMs: e.EMPTY_GAME_GRACE_MS,
        maxCatchUpTicks: e.MAX_CATCH_UP_TICKS,
        maxBufferedBytes: e.MAX_BUFFERED_BYTES,
        clientDist: existsSync(clientDist) ? clientDist : null,
        publicUrl: e.PUBLIC_URL ?? null,
        trustProxy: e.TRUST_PROXY,
        log: e.LOG,
        debugSpawnTogether: e.DEBUG_SPAWN_TOGETHER,
        minPlayers: e.MIN_PLAYERS,
        gameOverGraceMs: e.GAME_OVER_GRACE_MS,
        partyMaxConnectionsPerIp: e.PARTY_MAX_CONNECTIONS_PER_IP,
        partyMaxMsgsPerSecond: e.PARTY_MAX_MSGS_PER_SECOND,
        partyJoinTimeoutMs: e.PARTY_JOIN_TIMEOUT_MS,
        partyIdleMs: e.PARTY_IDLE_MS,
        botFill: e.BOT_FILL,
        factionBotFill:
            e.FACTION_BOT_FILL ??
            Math.min(e.FACTION_MAX_PLAYERS, Math.round((e.BOT_FILL * e.FACTION_MAX_PLAYERS) / e.MAX_PLAYERS)),
        botDifficulty: e.BOT_DIFFICULTY,
        botFillIntervalMs: e.BOT_FILL_INTERVAL_MS,
    };
}

/** Defaults (no environment) with overrides, for tests and scripts (the buttons follow an overridden defaultMap). */
export function makeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
    const base = loadConfig({});
    const modes = overrides.modes ?? (overrides.defaultMap ? defaultModes(overrides.defaultMap) : base.modes);
    return { ...base, ...overrides, modes };
}

/** Whether `mapName` is a 50v50 Faction map (M7a). */
export function isFactionMap(mapName: string): boolean {
    return Object.hasOwn(MapDefs, mapName) && !!getMapDef(mapName).gameMode.factionMode;
}

/**
 * Team mode a game of `mapName` runs: 50v50 always plays in squads inside the factions (the original 50v50 squad queue;
 * survev's config runs faction with TeamMode.Squad), any requested mode joins it (M7a).
 */
export function effectiveTeamMode(mapName: string, teamMode: 1 | 2 | 4): 1 | 2 | 4 {
    return isFactionMap(mapName) ? 4 : teamMode;
}

/** Player capacity of a game of `mapName` (M7a: FACTION_MAX_PLAYERS for 50v50). */
export function roomCapacity(config: ServerConfig, mapName: string): number {
    return isFactionMap(mapName) ? config.factionMaxPlayers : config.maxPlayers;
}
