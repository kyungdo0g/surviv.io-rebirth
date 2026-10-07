// The population suite (scripts/population.ts runs it on worker threads; test/population.test.ts in-process): full
// matches of bots with the match metrics on (metrics/collector.ts), over seeds x modes (solo, duo, squad) x
// difficulties (the server's skill-tier mix "population", or a legacy preset) x brains, plus a 50v50 smoke run, then
// one summary per cell (difficulty/brain; the 50v50 runs their own cell) checked against the acceptance thresholds of
// the bot overhaul (metrics/thresholds.ts).
import { type BrainName, DEFAULT_BRAIN } from "../src/brain/features.ts";
import type { Difficulty, SkillTierName } from "../src/difficulty.ts";
import { type CellSummary, type MatchSample, type SuiteMode, sampleOf, summarizeCell } from "../src/metrics/summary.ts";
import { evaluateCell, type ThresholdResult } from "../src/metrics/thresholds.ts";
import { runMatch, scaledGas } from "../src/runner.ts";

export type SuiteDifficulty = Difficulty | "mixed" | "population";

export interface SuiteOptions {
    /** seeds per mode, from `seed` */
    seeds: number;
    seed: number;
    modes: Exclude<SuiteMode, "faction">[];
    difficulties: SuiteDifficulty[];
    brains: BrainName[];
    /** bots per match (50v50: 100) */
    bots: number;
    /** gas stages after the first this many times shorter (1: the real gas) */
    gasDiv: number;
    maxTicks: number;
    /** 50v50 smoke runs (per difficulty and brain) */
    faction: number;
    factionGasDiv: number;
    /** personas: "auto" = on for the population mix (the server's default), neutral for legacy presets */
    personas: "auto" | "on" | "off";
    skillMix?: Partial<Record<SkillTierName, number>>;
    /** map of the battle royale matches (default main; the 50v50 runs keep the faction map) */
    map?: string;
    /** seeds per mode overriding `seeds` (e.g. solo 40, duo 12, squad 12) */
    modeSeeds?: Partial<Record<Exclude<SuiteMode, "faction">, number>>;
}

export const DEFAULT_SUITE: SuiteOptions = {
    seeds: 10,
    seed: 1,
    modes: ["solo", "duo", "squad"],
    difficulties: ["population"],
    brains: [DEFAULT_BRAIN],
    bots: 80,
    gasDiv: 1,
    maxTicks: 60000,
    faction: 2,
    factionGasDiv: 4,
    personas: "auto",
};

/** `--quick`: two seeds of each mode and one 50v50 smoke run (about 5 minutes on 2 workers). */
export const QUICK_SUITE: Partial<SuiteOptions> = { seeds: 2, faction: 1 };

export interface SuiteTask {
    cell: string;
    mode: SuiteMode;
    difficulty: SuiteDifficulty;
    brain: BrainName;
    seed: number;
    map?: string;
}

const TEAM: Readonly<Record<Exclude<SuiteMode, "faction">, 1 | 2 | 4>> = { solo: 1, duo: 2, squad: 4 };

export function cellOf(difficulty: string, brain: string, mode: SuiteMode, map?: string): string {
    if (mode === "faction") return `faction/${difficulty}/${brain}`;
    return map && map !== "main" ? `${difficulty}/${brain}@${map}` : `${difficulty}/${brain}`;
}

export function suitePlan(opts: SuiteOptions): SuiteTask[] {
    const out: SuiteTask[] = [];
    for (const difficulty of opts.difficulties) {
        for (const brain of opts.brains) {
            for (const mode of opts.modes) {
                const seeds = opts.modeSeeds?.[mode] ?? opts.seeds;
                for (let k = 0; k < seeds; k++) {
                    out.push({
                        cell: cellOf(difficulty, brain, mode, opts.map),
                        mode,
                        difficulty,
                        brain,
                        seed: opts.seed + k,
                        ...(opts.map ? { map: opts.map } : {}),
                    });
                }
            }
            for (let k = 0; k < opts.faction; k++) {
                const mode = "faction";
                out.push({ cell: cellOf(difficulty, brain, mode), mode, difficulty, brain, seed: opts.seed + 100 + k });
            }
        }
    }
    return out;
}

export function runSuiteTask(opts: SuiteOptions, task: SuiteTask, clock?: () => number): MatchSample {
    const faction = task.mode === "faction";
    const personas = opts.personas === "auto" ? task.difficulty === "population" : opts.personas === "on";
    const gasDiv = faction ? opts.factionGasDiv : opts.gasDiv;
    const report = runMatch({
        seed: task.seed,
        faction,
        bots: faction ? 100 : opts.bots,
        teamMode: faction ? 4 : TEAM[task.mode as Exclude<SuiteMode, "faction">],
        difficulty: task.difficulty,
        population: { personas, ...(opts.skillMix ? { skillMix: opts.skillMix } : {}) },
        brain: task.brain,
        ...(!faction && task.map ? { mapName: task.map } : {}),
        ...(gasDiv > 1 ? { gasStages: scaledGas(gasDiv) } : {}),
        maxTicks: opts.maxTicks,
        metrics: true,
        clock,
    });
    return sampleOf(report, task.cell, task.mode, task.seed);
}

export interface CellResult {
    summary: CellSummary;
    results: ThresholdResult[];
}

/** One summary and threshold evaluation per cell, in plan order. */
export function summarizeSuite(samples: readonly MatchSample[]): CellResult[] {
    const cells = new Map<string, MatchSample[]>();
    for (const s of samples) {
        const list = cells.get(s.cell) ?? [];
        list.push(s);
        cells.set(s.cell, list);
    }
    return [...cells].map(([cell, list]) => {
        const summary = summarizeCell(cell, list);
        return { summary, results: evaluateCell(summary) };
    });
}
