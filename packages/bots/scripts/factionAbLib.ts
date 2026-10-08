// 50v50 A/B harness (bot round 6): one 100-bot faction match on the faction map where one faction plays the faction
// brain (the smart preset with BrainFeatures.faction) and the other the current behaviour (the smart preset without
// it), with the same difficulty mix ("mixed": a third each of easy, normal, hard, by spawn index). Joiners alternate
// between the factions (sim match/faction.ts smallestTeam: Red on a tie), so even spawn indices play Red (1) and odd
// ones Blue (2); `newSide` says which faction gets the new brain, and the harness checks the factions afterwards.
// The control side runs under the brain name "baseline" with its features overridden (MatchConfig.brainFeatures), so
// the runner's per-brain timings split the two sides. A read-only probe samples squad cohesion: every second, the
// distance from each standing player to its nearest standing squadmate (same group).
import { GameConfig, type GasStage } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { FACTION_TUNING } from "../src/brain/factionCtx.ts";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import { type MatchProbe, type MatchReport, runMatch } from "../src/runner.ts";
import type { TimingSummary } from "../src/timing.ts";

/** Quarter-speed gas after the first circle (as test/helpers.ts QUICK_GAS and the faction test). */
export const QUICK_GAS: GasStage[] = GameConfig.gas.stages.map((st, i) =>
    i === 0 ? st : { ...st, duration: Math.max(1, st.duration / 4) },
);

/**
 * Ablations: FACTION_TUNING overrides as "part=0,part=1" (the env var FACTION_TUNING of scripts/factionAb.ts), applied
 * to this thread's bots; unknown parts throw.
 */
export function applyTuning(spec: string | undefined): void {
    for (const kv of (spec ?? "").split(",").filter(Boolean)) {
        const [k, v] = kv.split("=");
        if (!Object.hasOwn(FACTION_TUNING, k)) throw new Error(`unknown faction part ${k}`);
        (FACTION_TUNING as Record<string, boolean>)[k] = v !== "0" && v !== "false";
    }
}

/** The smart preset without the faction brain: the behaviour before bot round 6. */
export function controlFeatures(): Readonly<BrainFeatures> {
    const f = { ...BRAIN_PRESETS.smart } as BrainFeatures & { faction?: boolean };
    if ("faction" in f) f.faction = false;
    return Object.freeze(f);
}

export interface FactionTask {
    seed: number;
    /** faction (1 Red, 2 Blue) that plays the new brain; 0: every bot plays `allBrain` (perf runs) */
    newSide: 0 | 1 | 2;
    /** perf runs (newSide 0): "new" = smart preset, "control" = smart without the faction brain */
    allBrain?: "new" | "control";
    maxTicks?: number;
    gas?: "quick" | "normal";
}

export interface SideStats {
    team: number;
    brain: "new" | "control";
    kills: number;
    deaths: number;
    alive: number;
    strikeDeaths: number;
    gasDeaths: number;
    stuckEvents: number;
    /** bot-seconds alive (stuck rate = stuckEvents per bot-minute) */
    aliveSeconds: number;
    /** squad cohesion samples: median and mean distance to the nearest standing squadmate */
    cohesionMedian: number;
    cohesionMean: number;
    cohesionSamples: number;
    bugleUses: number;
    revives: number;
}

export interface FactionResult {
    task: FactionTask;
    over: boolean;
    winningTeam: number;
    ticks: number;
    gameSeconds: number;
    wallMs: number;
    exceptions: number;
    errors: string[];
    teamKills: number;
    roles: Record<string, number>;
    sides: SideStats[];
    botTickMs: Partial<Record<string, TimingSummary>>;
    tickMs: MatchReport["tickMs"];
}

/** Cohesion and revive counters (read-only: the game state only). */
class CohesionProbe implements MatchProbe {
    readonly name = "cohesion";
    readonly samples = new Map<number, number[]>();
    /** players of each faction stood up again from a knock (revived, by anyone or by themselves) */
    readonly revives = new Map<number, number>();
    private readonly wasDowned = new Set<number>();

    tick(game: Game): void {
        if (game.tick % 100 === 0) this.sample(game);
        for (const p of game.players()) {
            if (p.dead) {
                this.wasDowned.delete(p.id);
                continue;
            }
            if (p.downed) this.wasDowned.add(p.id);
            else if (this.wasDowned.delete(p.id)) this.revives.set(p.teamId, (this.revives.get(p.teamId) ?? 0) + 1);
        }
    }

    private sample(game: Game): void {
        const standing = [...game.players()].filter((p) => !p.dead && !p.downed);
        for (const p of standing) {
            let best = Number.POSITIVE_INFINITY;
            for (const q of standing) {
                if (q === p || q.groupId !== p.groupId) continue;
                const d = Math.hypot(q.pos.x - p.pos.x, q.pos.y - p.pos.y);
                if (d < best) best = d;
            }
            if (!Number.isFinite(best)) continue;
            let list = this.samples.get(p.teamId);
            if (!list) this.samples.set(p.teamId, (list = []));
            list.push(best);
        }
    }
}

function median(xs: readonly number[]): number {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

/** One match of the A/B (or a perf run with every bot on one brain). */
export function runFactionMatch(task: FactionTask, clock: () => number): FactionResult {
    const probe = new CohesionProbe();
    const control = controlFeatures();
    const brainOfIndex = (i: number): "new" | "control" => {
        if (task.newSide === 0) return task.allBrain ?? "new";
        const team = i % 2 === 0 ? 1 : 2;
        return team === task.newSide ? "new" : "control";
    };
    const bugleBy = new Map<number, number>();
    const report = runMatch({
        faction: true,
        seed: task.seed,
        gasStages: task.gas === "normal" ? undefined : QUICK_GAS,
        maxTicks: task.maxTicks ?? 30000,
        difficulty: "mixed",
        clock,
        brainFeatures: { baseline: control },
        assign: (i) => ({ brain: brainOfIndex(i) === "new" ? "smart" : "baseline" }),
        probes: [probe],
        observer: {
            onShotFired: (shooter, weapon) => {
                if (weapon === "bugle") bugleBy.set(shooter.teamId, (bugleBy.get(shooter.teamId) ?? 0) + 1);
            },
        },
    });
    const sides: SideStats[] = [];
    for (const team of [1, 2]) {
        const ps = report.players.filter((p) => p.teamId === team);
        const brain = ps[0]?.brain === "baseline" ? "control" : "new";
        const coh = probe.samples.get(team) ?? [];
        sides.push({
            team,
            brain,
            kills: ps.reduce((a, p) => a + p.kills, 0),
            deaths: ps.filter((p) => p.dead).length,
            alive: ps.filter((p) => !p.dead).length,
            strikeDeaths: ps.filter((p) => p.dead && p.cause === "airstrike").length,
            gasDeaths: ps.filter((p) => p.dead && p.cause === "gas").length,
            stuckEvents: ps.reduce((a, p) => a + p.stuckEvents, 0),
            aliveSeconds: ps.reduce((a, p) => a + p.timeAlive, 0),
            cohesionMedian: median(coh),
            cohesionMean: coh.length ? coh.reduce((a, b) => a + b, 0) / coh.length : 0,
            cohesionSamples: coh.length,
            bugleUses: bugleBy.get(team) ?? 0,
            revives: probe.revives.get(team) ?? 0,
        });
        // every bot of a side must play the side's brain (the join order put even indices on Red)
        if (task.newSide !== 0 && ps.some((p) => (p.brain === "baseline" ? "control" : "new") !== brain))
            throw new Error(`seed ${task.seed}: faction ${team} mixes brains (join order changed?)`);
    }
    return {
        task,
        over: report.over,
        winningTeam: report.winningTeamId,
        ticks: report.ticks,
        gameSeconds: report.gameSeconds,
        wallMs: report.wallMs,
        exceptions: report.exceptions,
        errors: report.errors,
        teamKills: report.teamKills ?? 0,
        roles: report.roles,
        sides,
        botTickMs: report.botTickMs,
        tickMs: report.tickMs,
    };
}
