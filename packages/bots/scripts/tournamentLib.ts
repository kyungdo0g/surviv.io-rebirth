// The bot tournament (scripts/tournament.ts runs it on worker threads; test/tournament.test.ts in-process): matches of
// N bots of one difficulty where half the bots (half the groups in team modes) play the smart brain and half the
// baseline; each seed is played twice with the brains swapped (cancels spawn and loot luck). The aggregate compares
// the two brains (win share, placement, head-to-head kills, K/D, damage, survival, deaths by cause, stuck events, bot
// update time) and the gate decides whether the smart brain is good enough to become the default.
import type { DamageSource } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeature, type BrainName, withFeatures } from "../src/brain/features.ts";
import type { Difficulty, DifficultyParams } from "../src/difficulty.ts";
import { type BotRecord, runMatch, scaledGas } from "../src/runner.ts";
import { TimingHistogram, type TimingHistogramJSON } from "../src/timing.ts";
import { binomialUpper, mean, type PairedTest, pairedTTest, wilson } from "./statsMath.ts";

export type TournamentMode = "solo" | "duo" | "squad";

export const MODE_SIZE: Readonly<Record<TournamentMode, 1 | 2 | 4>> = { solo: 1, duo: 2, squad: 4 };

export interface TournamentOptions {
    /** bots per match (default 40) */
    bots: number;
    /** the same difficulty and motor for everyone */
    difficulty: Difficulty | DifficultyParams;
    mode: TournamentMode;
    /** smart = baseline + these features (ablation); null = the full smart preset */
    features: BrainFeature[] | null;
    /** gas stages after the first are this many times shorter (2.5: about 3 game minutes per match) */
    gasDiv: number;
    /** tick budget of a match */
    maxTicks: number;
    mapName: string;
}

export const DEFAULT_TOURNAMENT: TournamentOptions = {
    bots: 40,
    difficulty: "normal",
    mode: "solo",
    features: null,
    gasDiv: 2.5,
    maxTicks: 40000,
    mapName: "main",
};

export interface MatchTask {
    seed: number;
    /** brains swapped */
    mirrored: boolean;
}

/** `matches` (rounded up to even) as seed pairs, each played straight and mirrored. */
export function matchPlan(matches: number, baseSeed: number): MatchTask[] {
    const pairs = Math.max(1, Math.ceil(matches / 2));
    const out: MatchTask[] = [];
    for (let k = 0; k < pairs; k++) {
        out.push({ seed: baseSeed + k, mirrored: false }, { seed: baseSeed + k, mirrored: true });
    }
    return out;
}

/** Brain of the bot spawned `index`-th: alternate units (players, or auto-filled groups in team modes). */
export function brainFor(index: number, mode: TournamentMode, mirrored: boolean): BrainName {
    const unit = Math.floor(index / MODE_SIZE[mode]);
    return (unit % 2 === 0) !== mirrored ? "smart" : "baseline";
}

export interface MatchResult extends MatchTask {
    ticks: number;
    gameSeconds: number;
    over: boolean;
    /** brain of the winner (solo) or winning team, null without a winner */
    winnerBrain: BrainName | null;
    players: BotRecord[];
    exceptions: number;
    errors: string[];
    /** teams whose members got different brains (must be 0) */
    mixedTeams: number;
    botTickHist: Partial<Record<BrainName, TimingHistogramJSON>>;
    /** wall time of the match, ms */
    wallMs: number;
}

export function runTournamentMatch(opts: TournamentOptions, task: MatchTask, clock?: () => number): MatchResult {
    const smart = opts.features ? withFeatures(BRAIN_PRESETS.baseline, opts.features) : BRAIN_PRESETS.smart;
    const report = runMatch({
        mapName: opts.mapName,
        seed: task.seed,
        bots: opts.bots,
        teamMode: MODE_SIZE[opts.mode],
        difficulty: opts.difficulty,
        brainFeatures: { smart },
        assign: (i) => ({ brain: brainFor(i, opts.mode, task.mirrored) }),
        gasStages: scaledGas(opts.gasDiv),
        maxTicks: opts.maxTicks,
        clock,
    });
    const teamBrains = new Map<number, Set<BrainName>>();
    for (const p of report.players) {
        const s = teamBrains.get(p.teamId) ?? new Set<BrainName>();
        s.add(p.brain);
        teamBrains.set(p.teamId, s);
    }
    const winner = report.players.find((p) => report.winners.includes(p.id));
    return {
        ...task,
        ticks: report.ticks,
        gameSeconds: report.gameSeconds,
        over: report.over,
        winnerBrain: report.over && winner ? winner.brain : null,
        players: report.players,
        exceptions: report.exceptions,
        errors: report.errors,
        mixedTeams: [...teamBrains.values()].filter((s) => s.size > 1).length,
        botTickHist: report.botTickHist,
        wallMs: report.wallMs,
    };
}

export interface BrainSide {
    bots: number;
    wins: number;
    meanPlacement: number;
    kills: number;
    deaths: number;
    kd: number;
    damageDealt: number;
    damageTaken: number;
    survival: number;
    hitRate: number;
    causes: Partial<Record<DamageSource, number>>;
    stuck: number;
    /** idle episodes (idle.ts) and idle bot-seconds */
    idle: number;
    idleSeconds: number;
    tickP99: number;
    tickMean: number;
}

export interface TournamentReport {
    matches: number;
    pairs: number;
    decided: number;
    smart: BrainSide;
    baseline: BrainSide;
    win: { share: number; p: number };
    placement: PairedTest;
    h2h: { smartOnBaseline: number; baselineOnSmart: number; share: number; lo: number; hi: number };
    matchSeconds: { mean: number; min: number; max: number };
    undecided: number;
    exceptions: number;
    errors: string[];
    mixedTeams: number;
    wallMsPerMatch: number;
}

/** Mean placement of a brain's units in a match: players in solo, teams (once each) in team modes. */
function unitPlacement(r: MatchResult, brain: BrainName, solo: boolean): number {
    const ps = r.players.filter((p) => p.brain === brain);
    if (solo) return mean(ps.map((p) => p.placement));
    const byTeam = new Map<number, number>();
    for (const p of ps) byTeam.set(p.teamId, p.teamPlacement);
    return mean([...byTeam.values()]);
}

function side(results: readonly MatchResult[], brain: BrainName, solo: boolean): BrainSide {
    const ps = results.flatMap((r) => r.players.filter((p) => p.brain === brain));
    const hist = new TimingHistogram();
    for (const r of results) {
        const h = r.botTickHist[brain];
        if (h) hist.merge(h);
    }
    const causes: Partial<Record<DamageSource, number>> = {};
    for (const p of ps) if (p.dead && p.cause !== "alive") causes[p.cause] = (causes[p.cause] ?? 0) + 1;
    const kills = ps.reduce((a, p) => a + p.kills, 0);
    const deaths = ps.filter((p) => p.dead).length;
    const bullets = ps.reduce((a, p) => a + p.bullets, 0);
    return {
        bots: ps.length,
        wins: results.filter((r) => r.winnerBrain === brain).length,
        meanPlacement: mean(results.map((r) => unitPlacement(r, brain, solo))),
        kills,
        deaths,
        kd: kills / Math.max(1, deaths),
        damageDealt: mean(ps.map((p) => p.damageDealt)),
        damageTaken: mean(ps.map((p) => p.damageTaken)),
        survival: mean(ps.map((p) => p.timeAlive)),
        hitRate: ps.reduce((a, p) => a + p.bulletHits, 0) / Math.max(1, bullets),
        causes,
        stuck: ps.reduce((a, p) => a + p.stuckEvents, 0),
        idle: ps.reduce((a, p) => a + p.idleEvents, 0),
        idleSeconds: ps.reduce((a, p) => a + p.idleSeconds, 0),
        tickP99: hist.quantile(0.99),
        tickMean: hist.n ? hist.sum / hist.n : 0,
    };
}

export function aggregate(results: readonly MatchResult[], mode: TournamentMode): TournamentReport {
    const solo = mode === "solo";
    const smart = side(results, "smart", solo);
    const baseline = side(results, "baseline", solo);
    const decided = smart.wins + baseline.wins;
    // placement: per seed, (smart - baseline) mean placement over its straight and mirrored match (< 0: smart better)
    const bySeed = new Map<number, MatchResult[]>();
    for (const r of results) bySeed.set(r.seed, [...(bySeed.get(r.seed) ?? []), r]);
    const diffs: number[] = [];
    for (const pair of bySeed.values()) {
        if (pair.length !== 2) continue;
        const d = pair.map((r) => unitPlacement(r, "smart", solo) - unitPlacement(r, "baseline", solo));
        diffs.push(mean(d));
    }
    let sOnB = 0;
    let bOnS = 0;
    for (const r of results) {
        for (const p of r.players) {
            if (!p.dead || !p.killerBrain) continue;
            if (p.killerBrain === "smart" && p.brain === "baseline") sOnB++;
            if (p.killerBrain === "baseline" && p.brain === "smart") bOnS++;
        }
    }
    const h = wilson(sOnB, sOnB + bOnS);
    const secs = results.map((r) => r.gameSeconds);
    return {
        matches: results.length,
        pairs: diffs.length,
        decided,
        smart,
        baseline,
        win: { share: decided ? smart.wins / decided : Number.NaN, p: binomialUpper(smart.wins, decided) },
        placement: pairedTTest(diffs),
        h2h: { smartOnBaseline: sOnB, baselineOnSmart: bOnS, share: h.p, lo: h.lo, hi: h.hi },
        matchSeconds: { mean: mean(secs), min: Math.min(...secs), max: Math.max(...secs) },
        undecided: results.filter((r) => !r.winnerBrain).length,
        exceptions: results.reduce((a, r) => a + r.exceptions, 0),
        errors: results.flatMap((r) => r.errors).slice(0, 5),
        mixedTeams: results.reduce((a, r) => a + r.mixedTeams, 0),
        wallMsPerMatch: mean(results.map((r) => r.wallMs)),
    };
}

export interface GateCheck {
    name: string;
    pass: boolean;
    detail: string;
}

export interface GateResult {
    pass: boolean;
    checks: GateCheck[];
}

/** `smart` within `ratio` times `base`; small counts get `slack` (a couple of events either way are noise). */
function notWorse(smart: number, base: number, ratio: number, slack: number): boolean {
    return smart <= Math.max(base * ratio, base + slack);
}

const f3 = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : String(v));

export interface GateOptions {
    /**
     * The reference configuration (solo, normal bots): there the smart brain must also win significantly more often
     * (win share > 0.5 with p < 0.05); elsewhere a win share of at least 0.5 is enough.
     */
    strict: boolean;
}

/** Head-to-head kill share the smart brain needs, and the floor of its Wilson 95% interval. */
export const GATE_H2H = 0.52;
export const GATE_H2H_LO = 0.5;

/**
 * The smart brain becomes the default only when every check passes in every configuration (solo normal with
 * `strict`, squad normal, solo hard). The head-to-head share is 0.52 rather than 0.55: the smart brain deliberately
 * avoids fights it would lose, which caps its kill share against a brain that takes every fight.
 */
export function evaluate(r: TournamentReport, opts: GateOptions = { strict: true }): GateResult {
    const gas = (s: BrainSide) => s.causes.gas ?? 0;
    const checks: GateCheck[] = [
        {
            name: `h2h kill share >= ${GATE_H2H}, Wilson lower bound >= ${GATE_H2H_LO}`,
            pass: r.h2h.share >= GATE_H2H && r.h2h.lo >= GATE_H2H_LO,
            detail: `${f3(r.h2h.share)} [${f3(r.h2h.lo)}, ${f3(r.h2h.hi)}]`,
        },
        opts.strict
            ? {
                  name: "win share > 0.5 with p < 0.05",
                  pass: r.win.share > 0.5 && r.win.p < 0.05,
                  detail: `${f3(r.win.share)} (p ${f3(r.win.p)}, ${r.decided} decided)`,
              }
            : {
                  name: "win share >= 0.5",
                  pass: r.win.share >= 0.5,
                  detail: `${f3(r.win.share)} (p ${f3(r.win.p)}, ${r.decided} decided)`,
              },
        {
            name: "placement not worse (paired over mirrored seeds)",
            pass: r.placement.mean <= 0,
            detail: `diff ${f3(r.placement.mean)} (p ${f3(r.placement.pLess)}, ${r.placement.n} pairs)`,
        },
        { name: "zero exceptions", pass: r.exceptions === 0, detail: String(r.exceptions) },
        {
            name: "stuck events <= 1.2x baseline",
            pass: notWorse(r.smart.stuck, r.baseline.stuck, 1.2, 2),
            detail: `${r.smart.stuck} vs ${r.baseline.stuck}`,
        },
        {
            name: "bot tick p99 <= 1.3x baseline",
            pass: r.smart.tickP99 <= r.baseline.tickP99 * 1.3 + 1e-9,
            detail: `${f3(r.smart.tickP99)} ms vs ${f3(r.baseline.tickP99)} ms`,
        },
        {
            name: "gas deaths up at most 20%",
            pass: notWorse(gas(r.smart), gas(r.baseline), 1.2, 2),
            detail: `${gas(r.smart)} vs ${gas(r.baseline)}`,
        },
    ];
    return { pass: checks.every((c) => c.pass), checks };
}

/** Human-readable report. */
export function formatReport(r: TournamentReport, gate: GateResult, smartLabel: string): string {
    const pad = (s: string, n: number) => s.padEnd(n);
    const row = (name: string, a: string, b: string, note = "") => `${pad(name, 22)}${pad(a, 16)}${pad(b, 16)}${note}`;
    const r2 = (v: number) => (Number.isFinite(v) ? (Math.round(v * 100) / 100).toString() : "-");
    const causes = (s: BrainSide) =>
        Object.entries(s.causes)
            .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))
            .map(([c, n]) => `${c}:${n}`)
            .join(" ");
    const s = r.smart;
    const b = r.baseline;
    const lines = [
        `${r.matches} matches (${r.pairs} mirrored pairs), ${r.decided} decided, ${r.undecided} undecided; match ` +
            `${r2(r.matchSeconds.mean)} game s [${r2(r.matchSeconds.min)}, ${r2(r.matchSeconds.max)}]`,
        row("", smartLabel, "baseline"),
        row("bots", String(s.bots), String(b.bots)),
        row("wins", String(s.wins), String(b.wins), `share ${f3(r.win.share)}, p ${f3(r.win.p)} (one-sided)`),
        row(
            "mean placement",
            r2(s.meanPlacement),
            r2(b.meanPlacement),
            `paired diff ${f3(r.placement.mean)}, t ${f3(r.placement.t)}, p ${f3(r.placement.pLess)}`,
        ),
        row(
            "h2h kills",
            String(r.h2h.smartOnBaseline),
            String(r.h2h.baselineOnSmart),
            `share ${f3(r.h2h.share)} [${f3(r.h2h.lo)}, ${f3(r.h2h.hi)}]`,
        ),
        row("kills / deaths", `${s.kills}/${s.deaths}`, `${b.kills}/${b.deaths}`),
        row("K/D", r2(s.kd), r2(b.kd)),
        row("damage dealt / bot", r2(s.damageDealt), r2(b.damageDealt)),
        row("damage taken / bot", r2(s.damageTaken), r2(b.damageTaken)),
        row("survival s / bot", r2(s.survival), r2(b.survival)),
        row("bullet hit rate", f3(s.hitRate), f3(b.hitRate)),
        row("stuck events", String(s.stuck), String(b.stuck)),
        row(
            "idle episodes / s",
            `${s.idle} / ${Math.round(s.idleSeconds)}`,
            `${b.idle} / ${Math.round(b.idleSeconds)}`,
        ),
        row("bot tick ms p99", f3(s.tickP99), f3(b.tickP99), `mean ${f3(s.tickMean)} / ${f3(b.tickMean)}`),
        `deaths by cause: ${smartLabel}: ${causes(s)} | baseline: ${causes(b)}`,
        `exceptions: ${r.exceptions}${r.mixedTeams ? `, MIXED TEAMS: ${r.mixedTeams}` : ""}`,
        ...r.errors.map((e) => `  ${e.split("\n")[0]}`),
        `gate: ${gate.pass ? "PASS" : "FAIL"}`,
        ...gate.checks.map((c) => `  [${c.pass ? "pass" : "FAIL"}] ${c.name}: ${c.detail}`),
    ];
    return lines.join("\n");
}
