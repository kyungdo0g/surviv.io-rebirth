// Server configuration from environment variables, validated with zod. Limits default to survev's production
// values (docs/research/engine/netcode.md "Limits and rate limits").
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    AIRSTRIKE_VARIANT_IDS,
    type AirstrikeVariant,
    DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS,
    getMapDef,
    isAirstrikeVariant,
    MapDefs,
} from "@rebirth/defs";
import { z } from "zod";
import { type AntiCheatThresholds, loadThresholds } from "./anticheat/thresholds.ts";
import type { BotDifficultySetting } from "./bots.ts";
import { DEFAULT_NAME_FILTER_FILE } from "./moderation/nameFilter.ts";
import { defaultModes, type ModeEntry, parseModes } from "./modes.ts";
import { parseRegionServers, REGION_ID } from "./regions.ts";

export interface ServerConfig {
    port: number;
    host: string;
    /** players per game (survev maxPlayers 80) */
    maxPlayers: number;
    /** players per 50v50 game (the faction map's maxPlayers, 100; M7a) */
    factionMaxPlayers: number;
    /**
     * Rebirth: roll weights of the 50v50 scheduled air strike variants (AIRSTRIKE_VARIANTS
     * "normal:60,heavy:25,carpet:15"; "normal" turns the variants off), copied into every game's
     * rules.roles.factionAirstrikeVariants
     */
    airstrikeVariants: Record<AirstrikeVariant, number>;
    /**
     * Rebirth: normal air drops are tier 1 or tier 2 drops (AIRDROP_TIERS "on", the default; "off" keeps v0.8.82's
     * crate weights and inner crate), copied into every game's rules.airdropTiers
     */
    airdropTiers: boolean;
    /**
     * Rebirth new-gun beta (GUN_BETA "on" / "1" / "true", any case; "off", the default): the new guns and the
     * survev-only guns are also common floor loot on every map (each at least twice), for trying them out; copied into
     * every game's rules.gunBeta at creation
     */
    gunBeta: boolean;
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
    /** bearer token of the /api/admin/* routes (M8); null disables them */
    adminToken: string | null;
    /** anti-cheat thresholds (M8, anticheat/thresholds.ts); null with ANTICHEAT=0 (no telemetry) */
    antiCheat: AntiCheatThresholds | null;
    /** JSONL file every anti-cheat flag is appended to (M8), or null for the in-memory list and log only */
    suspectsFile: string | null;
    /** JSONL file player reports are appended to (M8) */
    reportsFile: string;
    /** reports a player may file per match (M8) */
    reportMaxPerMatch: number;
    /** how long after its game closed a join token still authenticates reports (M8) */
    reportWindowMs: number;
    /** banned-words list of the name filter (M8), or null with NAME_FILTER=0 */
    nameFilterFile: string | null;
    /** IP / name bans (M8, moderation/bans.ts) */
    banFile: string;
    /** this server's region id, its /api/site_info `pops` key (M8, regions.ts) */
    region: string;
    /** other regions' servers: region id -> origin, listed by /api/site_info `regions` (M8) */
    regionServers: Record<string, string>;
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
    AIRSTRIKE_VARIANTS: z
        .string()
        .max(200)
        .transform((text, ctx) => {
            try {
                return parseAirstrikeVariants(text);
            } catch (err) {
                ctx.addIssue({ code: "custom", message: (err as Error).message });
                return z.NEVER;
            }
        })
        .optional(),
    AIRDROP_TIERS: z
        .enum(["on", "off"], { message: 'expected "on" or "off"' })
        .transform((v) => v === "on")
        .default(true),
    // any case ("ON", "True"); the message names every accepted value
    GUN_BETA: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(
            z.enum(["on", "off", "1", "0", "true", "false"], {
                message: 'expected "on", "off", "1", "0", "true" or "false" (any case)',
            }),
        )
        .transform((v) => v === "on" || v === "1" || v === "true")
        .default(false),
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
    ADMIN_TOKEN: z.string().min(16, { message: "at least 16 characters" }).optional(),
    ANTICHEAT: bool.default(true),
    ANTICHEAT_FLAG_SCORE: z.coerce.number().min(1).max(100).optional(),
    ANTICHEAT_CONFIG: z.string().min(1).optional(),
    SUSPECTS_FILE: z.string().min(1).optional(),
    REPORTS_FILE: z.string().min(1).default("data/reports.jsonl"),
    REPORT_MAX_PER_MATCH: z.coerce.number().int().min(1).max(100).default(3),
    REPORT_WINDOW_MS: z.coerce
        .number()
        .int()
        .min(0)
        .default(15 * 60 * 1000),
    NAME_FILTER: bool.default(true),
    NAME_FILTER_FILE: z.string().min(1).optional(),
    BAN_FILE: z.string().min(1).default("data/bans.json"),
    REGION: z.string().regex(REGION_ID, { message: "a-z, 0-9, - and _ (at most 32)" }).default("local"),
    REGION_SERVERS: z
        .string()
        .max(2000)
        .transform((text, ctx) => {
            try {
                return parseRegionServers(text);
            } catch (err) {
                ctx.addIssue({ code: "custom", message: (err as Error).message });
                return z.NEVER;
            }
        })
        .optional(),
});

/**
 * Validated configuration; throws an Error listing every invalid variable. Empty values count as unset (docker compose
 * passes `VAR: ""` for an unset `${VAR:-}`).
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
    const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
    const parsed = EnvSchema.safeParse(set);
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
        airstrikeVariants: e.AIRSTRIKE_VARIANTS ?? { ...DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS },
        airdropTiers: e.AIRDROP_TIERS,
        gunBeta: e.GUN_BETA,
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
        adminToken: e.ADMIN_TOKEN ?? null,
        antiCheat: e.ANTICHEAT ? loadThresholds(e.ANTICHEAT_CONFIG, e.ANTICHEAT_FLAG_SCORE) : null,
        suspectsFile: e.SUSPECTS_FILE ? resolve(e.SUSPECTS_FILE) : null,
        // relative paths are relative to the working directory
        reportsFile: resolve(e.REPORTS_FILE),
        reportMaxPerMatch: e.REPORT_MAX_PER_MATCH,
        reportWindowMs: e.REPORT_WINDOW_MS,
        nameFilterFile: e.NAME_FILTER ? resolve(e.NAME_FILTER_FILE ?? DEFAULT_NAME_FILTER_FILE) : null,
        banFile: resolve(e.BAN_FILE),
        region: e.REGION,
        regionServers: e.REGION_SERVERS ?? {},
    };
}

/** Largest AIRSTRIKE_VARIANTS weight: keeps the sum finite in rng.weighted (1e308 + 1e308 always picks the last). */
export const MAX_AIRSTRIKE_VARIANT_WEIGHT = 1_000_000;
/** A plain decimal weight ("25", "2.5"); hex, exponents, signs and "Infinity" are refused, not read by Number(). */
const DECIMAL_WEIGHT = /^\d+(\.\d+)?$/;

/**
 * Parses AIRSTRIKE_VARIANTS: comma-separated `variant[:weight]` (normal, heavy, carpet; weight a plain decimal from 0
 * to MAX_AIRSTRIKE_VARIANT_WEIGHT, 1 when left out), e.g. "normal:60,heavy:25,carpet:15", or "normal" to turn the
 * rebirth variants off. Variants not listed get 0; at least one weight must be positive. Throws on unknown or repeated
 * variants and bad weights.
 */
export function parseAirstrikeVariants(text: string): Record<AirstrikeVariant, number> {
    const out = Object.fromEntries(AIRSTRIKE_VARIANT_IDS.map((id) => [id, 0])) as Record<AirstrikeVariant, number>;
    const seen = new Set<string>();
    for (const part of text.split(",")) {
        const entry = part.trim();
        if (!entry) continue;
        const [name, weightText, ...rest] = entry.split(":").map((t) => t.trim());
        if (!isAirstrikeVariant(name)) {
            throw new Error(`unknown variant "${name}" (expected ${AIRSTRIKE_VARIANT_IDS.join(", ")})`);
        }
        if (seen.has(name)) throw new Error(`variant "${name}" listed twice`);
        seen.add(name);
        const weight = weightText === undefined ? 1 : Number(weightText);
        const plain = weightText === undefined || DECIMAL_WEIGHT.test(weightText);
        if (rest.length > 0 || !plain || !(weight <= MAX_AIRSTRIKE_VARIANT_WEIGHT)) {
            throw new Error(
                `bad weight in "${entry}" (expected variant:number, number 0-${MAX_AIRSTRIKE_VARIANT_WEIGHT})`,
            );
        }
        out[name] = weight;
    }
    if (!AIRSTRIKE_VARIANT_IDS.some((id) => out[id] > 0)) throw new Error("at least one variant needs a weight > 0");
    return out;
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
