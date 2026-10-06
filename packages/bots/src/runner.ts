// Headless in-process matches: a Game filled with bots, stepped at maximum speed until game over (or a tick budget),
// with a report of the outcome (winner, kills, causes of death, survival times, bot exceptions, tick timings). Used by
// scripts/match.ts and the match tests. The wall clock is injected (scripts pass their timer) so this module stays
// free of non-deterministic calls.
import { createRng } from "@rebirth/core";
import { type GasStage, getMapDef } from "@rebirth/defs";
import { type DamageSource, damageSourceOf, Game } from "@rebirth/sim";
import { BotController } from "./controller.ts";
import { DIFFICULTIES, type Difficulty } from "./difficulty.ts";
import { pickBotName } from "./names.ts";

export interface MatchConfig {
    mapName?: string;
    /**
     * 50v50 (M7a): squads inside the Red / Blue factions, on `mapName` when it is a faction map (faction_potato, M7b),
     * else on "faction"
     */
    faction?: boolean;
    seed?: number;
    /** number of bots (default 80) */
    bots?: number;
    teamMode?: 1 | 2 | 4;
    /** one preset for every bot, or "mixed" (a third each) */
    difficulty?: Difficulty | "mixed";
    gasStages?: readonly GasStage[];
    /** stop after this many ticks even without a winner (default 60000 = 10 game minutes) */
    maxTicks?: number;
    /** wall clock in milliseconds, for timings only (default: none, timings are 0) */
    clock?: () => number;
    /** called after every tick */
    onTick?: (game: Game, bots: readonly BotController[]) => void;
}

export interface BotRecord {
    id: number;
    name: string;
    difficulty: Difficulty;
    teamId: number;
    kills: number;
    timeAlive: number;
    dead: boolean;
    cause: DamageSource | "alive";
    killerId: number;
}

export interface MatchReport {
    ticks: number;
    gameSeconds: number;
    wallMs: number;
    /** a winner was decided */
    over: boolean;
    winners: number[];
    winningTeamId: number;
    players: BotRecord[];
    /** kill count -> number of bots with that many kills */
    killsDistribution: Record<number, number>;
    causes: Partial<Record<DamageSource, number>>;
    avgSurvival: number;
    exceptions: number;
    errors: string[];
    tickMs: { p50: number; p99: number; max: number; mean: number };
    stuckEvents: number;
    throws: number;
    /** 50v50 (M7a): living players per faction at the end and team kills (must be 0) */
    teamAliveCounts?: number[];
    teamKills?: number;
    /** roles handed out (faction roles, Cobalt classes, The Hunted, Woods King; M7b: every map) */
    roles: Record<string, number>;
}

export function runMatch(cfg: MatchConfig = {}): MatchReport {
    const clock = cfg.clock ?? (() => 0);
    const seed = cfg.seed ?? 1;
    const n = cfg.bots ?? (cfg.faction ? 100 : 80);
    const requested = cfg.mapName ?? (cfg.faction ? "faction" : "main");
    const mapName = cfg.faction && !getMapDef(requested).gameMode.factionMode ? "faction" : requested;
    const game = new Game(
        { mapName, seed, teamMode: cfg.faction ? 4 : (cfg.teamMode ?? 1) },
        cfg.gasStages ? { gasStages: cfg.gasStages } : {},
    );
    const rng = createRng(seed ^ 0x5bd1e995);
    const used = new Set<string>();
    const bots: BotController[] = [];
    const difficulty = new Map<number, Difficulty>();
    for (let i = 0; i < n; i++) {
        const d = cfg.difficulty === "mixed" || cfg.difficulty === undefined ? DIFFICULTIES[i % 3] : cfg.difficulty;
        const bot = BotController.spawn(game, { name: pickBotName(rng, used), difficulty: d, seed: seed * 1000 + i });
        difficulty.set(bot.playerId, d);
        bots.push(bot);
    }
    const causes = new Map<number, { cause: DamageSource; killerId: number }>();
    const roles: Record<string, number> = {};
    let teamKills = 0;
    const announce = game.announceRole.bind(game);
    game.announceRole = (e) => {
        if (e.assigned) roles[e.role] = (roles[e.role] ?? 0) + 1;
        announce(e);
    };
    const onKilled = game.onPlayerKilled.bind(game);
    game.onPlayerKilled = (victim, params, credit) => {
        const source = params.sourceId ? game.getPlayer(params.sourceId) : undefined;
        if (source && source !== victim && source.teamId === victim.teamId && !victim.disconnected) teamKills++;
        causes.set(victim.id, {
            cause: damageSourceOf(params.damageType, params.gameSourceType ?? "", params.mapSourceType ?? ""),
            killerId: credit?.id ?? 0,
        });
        onKilled(victim, params, credit);
    };
    const errors: string[] = [];
    let exceptions = 0;
    const tickTimes: number[] = [];
    const maxTicks = cfg.maxTicks ?? 60000;
    const t0 = clock();
    while (game.tick < maxTicks && !game.over) {
        const s = clock();
        for (const b of bots) {
            try {
                b.update();
            } catch (err) {
                exceptions++;
                if (errors.length < 10) errors.push(err instanceof Error ? (err.stack ?? err.message) : String(err));
            }
        }
        try {
            game.step();
        } catch (err) {
            exceptions++;
            errors.push(`sim: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
            break;
        }
        tickTimes.push(clock() - s);
        cfg.onTick?.(game, bots);
    }
    const wallMs = clock() - t0;
    const players: BotRecord[] = bots.map((b) => {
        const p = game.getPlayer(b.playerId);
        const c = causes.get(b.playerId);
        return {
            id: b.playerId,
            name: p?.name ?? "",
            difficulty: difficulty.get(b.playerId) ?? "normal",
            teamId: p?.teamId ?? 0,
            kills: p?.kills ?? 0,
            timeAlive: p?.timeAlive ?? 0,
            dead: p?.dead ?? true,
            cause: c?.cause ?? "alive",
            killerId: c?.killerId ?? 0,
        };
    });
    const killsDistribution: Record<number, number> = {};
    const causeCount: Partial<Record<DamageSource, number>> = {};
    for (const p of players) {
        killsDistribution[p.kills] = (killsDistribution[p.kills] ?? 0) + 1;
        if (p.dead && p.cause !== "alive") causeCount[p.cause] = (causeCount[p.cause] ?? 0) + 1;
    }
    const sorted = [...tickTimes].sort((a, b) => a - b);
    const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
    return {
        ticks: game.tick,
        gameSeconds: game.time,
        wallMs,
        over: game.over,
        winners: [...game.match.winnerIds],
        winningTeamId: game.match.winningTeamId,
        players,
        killsDistribution,
        causes: causeCount,
        avgSurvival: players.reduce((a, p) => a + p.timeAlive, 0) / Math.max(1, players.length),
        exceptions,
        errors,
        tickMs: {
            p50: at(0.5),
            p99: at(0.99),
            max: sorted[sorted.length - 1] ?? 0,
            mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length),
        },
        stuckEvents: bots.reduce((a, b) => a + b.bot.follower.stuckEvents, 0),
        throws: bots.reduce((a, b) => a + b.bot.throws.throws, 0),
        roles,
        ...(game.faction ? { teamAliveCounts: game.faction.aliveCounts(), teamKills } : {}),
    };
}
