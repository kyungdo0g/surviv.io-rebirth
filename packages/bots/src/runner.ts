// Headless in-process matches: a Game filled with bots, stepped at maximum speed until game over (or a tick budget),
// with a report of the outcome (winner, kills, causes of death, survival times, per-bot combat stats and finish order,
// idle episodes (idle.ts), bot exceptions, tick timings). Used by scripts/match.ts, scripts/tournament.ts and the match
// tests. Every bot can get its own difficulty (preset or custom parameters), skill, persona and brain (`assign`), for
// A/B runs; difficulty "population" draws the server's skill-tier mix (bot overhaul POPULATION-5) and
// `population.personas` the persona mix (off by default: runMatch and the tournament stay neutral). Read-only probes
// (`probes`) collect metrics per tick; `metrics` adds the bot overhaul's match metrics (metrics/collector.ts:
// fairness, looting, weapons, movement) as MatchReport.metrics. The wall clock is injected (scripts pass their timer) so this module stays free
// of non-deterministic calls.
import { createRng } from "@rebirth/core";
import { GameConfig, type GasStage, getMapDef } from "@rebirth/defs";
import { type CombatObserver, type DamageSource, damageSourceOf, Game } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeatures, type BrainName, DEFAULT_BRAIN } from "./brain/features.ts";
import { BotController } from "./controller.ts";
import { DIFFICULTIES, type Difficulty, type DifficultyParams, type SkillTierName } from "./difficulty.ts";
import { IdleDetector, type IdleEvent } from "./idle.ts";
import { MetricsCollector } from "./metrics/collector.ts";
import type { MatchMetrics } from "./metrics/types.ts";
import { pickBotName } from "./names.ts";
import { PERSONA_MIX, type PersonaName, type PersonaParams, shuffleBag } from "./persona.ts";
import { DEFAULT_SKILL_MIX } from "./skill.ts";
import { fanOut, finishOrder, MatchStats } from "./stats.ts";
import { TimingHistogram, type TimingHistogramJSON, type TimingSummary } from "./timing.ts";

/** The real gas stages with every stage after the first `div` times shorter (at least 1 s): quick test matches. */
export function scaledGas(div: number): GasStage[] {
    return GameConfig.gas.stages.map((st, i) => (i === 0 ? st : { ...st, duration: Math.max(1, st.duration / div) }));
}

/** The idle detector looks at the bots every this many ticks. */
const IDLE_SAMPLE_TICKS = 10;
/** Salt of the population draws (tiers and personas), apart from the bot names' stream. */
const POPULATION_SALT = 0x3c6ef372;

/** Per-bot overrides of a match (MatchConfig.assign). */
export interface BotAssignment {
    /** preset name or custom parameters (A/B runs of the motor model) */
    difficulty?: Difficulty | DifficultyParams;
    /** skill tier or exact skill s (BotOptions.skill), over `difficulty` */
    skill?: number | SkillTierName;
    /** persona (BotOptions.persona) */
    persona?: PersonaName | PersonaParams;
    brain?: BrainName;
}

/** Population draws of a match (MatchConfig.population). */
export interface PopulationConfig {
    /** tier weights of difficulty "population" (default DEFAULT_SKILL_MIX: 20 / 65 / 15) */
    skillMix?: Partial<Record<SkillTierName, number>>;
    /** personas: off (default: every bot NEUTRAL), true for PERSONA_MIX, or a custom mix */
    personas?: boolean | Partial<Record<PersonaName, number>>;
    /** the drawn personas' own gun taste (Bot taste: fire-rate lovers, class bias; default true) */
    tastes?: boolean;
}

/**
 * A read-only metrics collector (HARNESS): it may read the game and the bots (model, brain memory, intent, motor) but
 * must not change them nor draw from their random streams.
 */
export interface MatchProbe {
    /** key of its result in MatchReport.probes */
    name: string;
    /** once, after every bot spawned, before the first tick */
    start?(game: Game, bots: readonly BotController[]): void;
    /** after every tick */
    tick?(game: Game, bots: readonly BotController[]): void;
    /** at the end: a JSON-serialisable result, stored as MatchReport.probes[name] */
    finish?(game: Game, bots: readonly BotController[]): unknown;
    /** combat notifications (shots, hits, damage, kills), after the match statistics; read-only too */
    observer?: CombatObserver;
}

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
    /**
     * one preset (or custom parameters) for every bot, "mixed" (a third each of easy, normal and hard: the legacy mix)
     * or "population" (skill tiers drawn from `population.skillMix`, the server's BOT_DIFFICULTY=mixed)
     */
    difficulty?: Difficulty | DifficultyParams | "mixed" | "population";
    /** tier mix and personas of the population (personas stay neutral unless asked for) */
    population?: PopulationConfig;
    /** read-only metrics collectors (HARNESS) */
    probes?: readonly MatchProbe[];
    /** collect the bot overhaul's match metrics (metrics/collector.ts) into MatchReport.metrics (read-only) */
    metrics?: boolean;
    /** brain of every bot without an assigned one (default DEFAULT_BRAIN) */
    brain?: BrainName;
    /** feature set behind each brain name (default BRAIN_PRESETS; the tournament's ablation overrides "smart") */
    brainFeatures?: Partial<Record<BrainName, BrainFeatures>>;
    /** per-bot difficulty and brain by spawn index (0..bots-1), over `difficulty` and `brain` */
    assign?: (index: number) => BotAssignment;
    /** the host's own combat observer, notified after the match statistics */
    observer?: CombatObserver;
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
    /** preset name (custom parameters and skill tiers: the legacy family `name` they carry) */
    difficulty: Difficulty;
    /** skill tier label, mechanics skill s and game sense g (presets: PRESET_SKILL) */
    tier: SkillTierName;
    skill: number;
    sense: number;
    persona: PersonaName;
    brain: BrainName;
    teamId: number;
    kills: number;
    timeAlive: number;
    dead: boolean;
    cause: DamageSource | "alive";
    killerId: number;
    /** brain of the killer when it is a bot of this match, else null */
    killerBrain: BrainName | null;
    /** shots fired (trigger pulls), bullets spawned (pellets each), bullets that struck an enemy */
    shots: number;
    bullets: number;
    bulletHits: number;
    /** damage dealt to and taken from enemies; damage from everything else (gas, own grenades, barrels, bleeding) */
    damageDealt: number;
    damageTaken: number;
    envDamage: number;
    /** finish order (1 = last standing; the living share 1) of the player and of its team */
    placement: number;
    teamPlacement: number;
    /** path follower stuck events */
    stuckEvents: number;
    /** idle episodes (alive, not standing still on purpose, moved < 1 unit in 5 s: idle.ts) and seconds spent idle */
    idleEvents: number;
    idleSeconds: number;
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
    /** duration of one bot's update (perception, decision, input) per brain; empty without a clock */
    botTickMs: Partial<Record<BrainName, TimingSummary>>;
    /** the same as mergeable histograms (tournaments merge them across matches) */
    botTickHist: Partial<Record<BrainName, TimingHistogramJSON>>;
    stuckEvents: number;
    /** idle episodes of every bot (idle.ts), in the order they began */
    idle: IdleEvent[];
    throws: number;
    /** 50v50 (M7a): living players per faction at the end and team kills (must be 0) */
    teamAliveCounts?: number[];
    teamKills?: number;
    /** roles handed out (faction roles, Cobalt classes, The Hunted, Woods King; M7b: every map) */
    roles: Record<string, number>;
    /** results of MatchConfig.probes by name (absent without probes) */
    probes?: Record<string, unknown>;
    /** the match metrics (MatchConfig.metrics) */
    metrics?: MatchMetrics;
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
    const collector = cfg.metrics ? new MetricsCollector() : null;
    const probes: MatchProbe[] = [...(cfg.probes ?? []), ...(collector ? [collector] : [])];
    const stats = new MatchStats(game, fanOut([...probes.map((p) => p.observer), cfg.observer]));
    game.observer = stats;
    const rng = createRng(seed ^ 0x5bd1e995);
    const used = new Set<string>();
    const bots: BotController[] = [];
    const brains: BrainName[] = [];
    const difficulty = new Map<number, Difficulty>();
    const brainOf = new Map<number, BrainName>();
    // population draws: their own stream, drawn only when asked for (a legacy run draws nothing more)
    const popRng = createRng(seed ^ POPULATION_SALT);
    const tiers =
        cfg.difficulty === "population" ? shuffleBag(popRng, n, cfg.population?.skillMix ?? DEFAULT_SKILL_MIX) : null;
    const personaMix = cfg.population?.personas === true ? PERSONA_MIX : cfg.population?.personas || null;
    const personas = personaMix ? shuffleBag(popRng, n, personaMix) : null;
    for (let i = 0; i < n; i++) {
        const a = cfg.assign?.(i) ?? {};
        const legacy =
            cfg.difficulty === "mixed" || cfg.difficulty === undefined || cfg.difficulty === "population"
                ? DIFFICULTIES[i % 3]
                : cfg.difficulty;
        const d = a.difficulty ?? legacy;
        const skill = a.skill ?? (a.difficulty === undefined ? tiers?.[i] : undefined);
        const persona = a.persona ?? personas?.[i];
        const brain = a.brain ?? cfg.brain ?? DEFAULT_BRAIN;
        const features = cfg.brainFeatures?.[brain] ?? BRAIN_PRESETS[brain];
        const name = pickBotName(rng, used);
        const bot = BotController.spawn(game, {
            name,
            difficulty: d,
            brain: features,
            seed: seed * 1000 + i,
            ...(skill !== undefined ? { skill } : {}),
            ...(persona !== undefined ? { persona } : {}),
            ...(cfg.population?.tastes === false ? { taste: false } : {}),
        });
        difficulty.set(bot.playerId, bot.bot.params.name);
        brainOf.set(bot.playerId, brain);
        bots.push(bot);
        brains.push(brain);
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
    const botHist = new Map<BrainName, TimingHistogram>();
    const timed = cfg.clock !== undefined;
    const idle = new IdleDetector();
    const playerOf = (id: number) => game.getPlayer(id);
    for (const p of probes) p.start?.(game, bots);
    const t0 = clock();
    while (game.tick < maxTicks && !game.over) {
        const s = clock();
        for (let i = 0; i < bots.length; i++) {
            const b = bots[i];
            if (b.done) continue;
            const bs = timed ? clock() : 0;
            try {
                b.update();
            } catch (err) {
                exceptions++;
                if (errors.length < 10) errors.push(err instanceof Error ? (err.stack ?? err.message) : String(err));
            }
            if (timed) {
                let h = botHist.get(brains[i]);
                if (!h) botHist.set(brains[i], (h = new TimingHistogram()));
                h.add(clock() - bs);
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
        if (game.tick % IDLE_SAMPLE_TICKS === 0) idle.sample(game.time, bots, playerOf);
        for (const p of probes) p.tick?.(game, bots);
        cfg.onTick?.(game, bots);
    }
    const wallMs = clock() - t0;
    const probeResults: Record<string, unknown> = {};
    for (const p of probes) if (p.finish && p !== collector) probeResults[p.name] = p.finish(game, bots);
    const metrics = collector?.finish(game);
    const finish = finishOrder(
        bots.map((b) => {
            const p = game.getPlayer(b.playerId);
            const dead = p?.dead ?? true;
            const tick = stats.of(b.playerId).deathTick;
            return { id: b.playerId, teamId: p?.teamId ?? 0, deathTick: dead ? Math.max(0, tick) : -1 };
        }),
    );
    const players: BotRecord[] = bots.map((b) => {
        const p = game.getPlayer(b.playerId);
        const c = causes.get(b.playerId);
        const st = stats.of(b.playerId);
        const f = finish.get(b.playerId);
        const killerId = c?.killerId ?? 0;
        return {
            id: b.playerId,
            name: p?.name ?? "",
            difficulty: difficulty.get(b.playerId) ?? "normal",
            tier: b.bot.skill.tier,
            skill: b.bot.skill.s,
            sense: b.bot.skill.g,
            persona: b.bot.persona.name,
            brain: brainOf.get(b.playerId) ?? DEFAULT_BRAIN,
            teamId: p?.teamId ?? 0,
            kills: p?.kills ?? 0,
            timeAlive: p?.timeAlive ?? 0,
            dead: p?.dead ?? true,
            cause: c?.cause ?? "alive",
            killerId,
            killerBrain: killerId !== b.playerId ? (brainOf.get(killerId) ?? null) : null,
            shots: st.shots,
            bullets: st.bullets,
            bulletHits: st.bulletHits,
            damageDealt: st.damageDealt,
            damageTaken: st.damageTaken,
            envDamage: st.envDamage,
            placement: f?.placement ?? 0,
            teamPlacement: f?.teamPlacement ?? 0,
            stuckEvents: b.bot.follower.stuckEvents,
            idleEvents: idle.eventsOf(b.playerId).length,
            idleSeconds: idle.idleSecondsOf(b.playerId),
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
        botTickMs: Object.fromEntries([...botHist].map(([k, h]) => [k, h.summary()])),
        botTickHist: Object.fromEntries([...botHist].map(([k, h]) => [k, h.toJSON()])),
        stuckEvents: bots.reduce((a, b) => a + b.bot.follower.stuckEvents, 0),
        idle: idle.events,
        throws: bots.reduce((a, b) => a + b.bot.throws.throws, 0),
        roles,
        ...(cfg.probes?.length ? { probes: probeResults } : {}),
        ...(metrics ? { metrics } : {}),
        ...(game.faction ? { teamAliveCounts: game.faction.aliveCounts(), teamKills } : {}),
    };
}
