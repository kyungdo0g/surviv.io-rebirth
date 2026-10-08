// 50v50 A/B of the faction brain (bot round 6) on worker threads.
//   node packages/bots/scripts/factionAb.ts [--seeds 1-8] [--workers 3] [--gas quick|normal] [--max-ticks 30000]
//        [--perf new|control] [--out results.jsonl]
//   node packages/bots/scripts/factionAb.ts --report results.jsonl [more.jsonl ...] [--perf]
// FACTION_TUNING="push=0,formation=0" (env) turns parts of the faction brain off for an ablation (factionCtx.ts).
// Every seed plays twice, the faction brain on Red, then on Blue (scripts/factionAbLib.ts); the report gives the new
// faction's win rate with an exact two-sided binomial p-value, kills per side, squad cohesion (median distance to the
// nearest standing squadmate), air strike and gas deaths, stuck events per bot-minute alive, bugle uses, revives and
// the per-bot update time (p50 / p99 / mean) of each side. `--perf new|control` instead plays every bot on one brain,
// once per seed (the before / after cost of a whole faction match). Results stream to `--out` as JSON lines.
import { appendFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { applyTuning, type FactionResult, type FactionTask, runFactionMatch } from "./factionAbLib.ts";
import { binomialUpper, wilson } from "./statsMath.ts";

type Reply = { ok: true; result: FactionResult } | { ok: false; task: FactionTask; error: string };

function parseSeeds(s: string): number[] {
    const out: number[] = [];
    for (const part of s.split(",")) {
        const [a, b] = part.split("-").map(Number);
        if (b === undefined) out.push(a);
        else for (let k = a; k <= b; k++) out.push(k);
    }
    return out;
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            seeds: { type: "string", default: "1-8" },
            workers: { type: "string", default: "3" },
            gas: { type: "string", default: "quick" },
            "max-ticks": { type: "string", default: "30000" },
            perf: { type: "string" },
            out: { type: "string" },
        },
    });
    const seeds = parseSeeds(values.seeds);
    const gas = values.gas === "normal" ? "normal" : "quick";
    const maxTicks = Number(values["max-ticks"]);
    const perf = values.perf === "new" || values.perf === "control" ? values.perf : null;
    const tasks: FactionTask[] = [];
    for (const seed of seeds) {
        if (perf) tasks.push({ seed, newSide: 0, allBrain: perf, gas, maxTicks });
        else for (const side of [1, 2] as const) tasks.push({ seed, newSide: side, gas, maxTicks });
    }
    const results: FactionResult[] = [];
    const errors: string[] = [];
    const n = Math.max(1, Math.min(Number(values.workers), tasks.length));
    let next = 0;
    await Promise.all(
        Array.from({ length: n }, () => {
            const w = new Worker(new URL(import.meta.url), { workerData: {} });
            return new Promise<void>((resolve) => {
                const feed = () => {
                    if (next >= tasks.length) {
                        void w.terminate();
                        resolve();
                        return;
                    }
                    w.postMessage(tasks[next++]);
                };
                w.on("message", (r: Reply) => {
                    if (r.ok) {
                        results.push(r.result);
                        if (values.out) appendFileSync(values.out, `${JSON.stringify(r.result)}\n`);
                        const s = r.result.sides.map((x) => `${x.brain}@${x.team} k${x.kills} a${x.alive}`).join(" ");
                        console.log(
                            `seed ${r.result.task.seed} new@${r.result.task.newSide}: winner ${r.result.winningTeam} ` +
                                `(${r.result.over ? "over" : "NOT OVER"}) ${s} ${(r.result.wallMs / 1000).toFixed(0)} s`,
                        );
                    } else {
                        errors.push(`seed ${r.task.seed}: ${r.error}`);
                        console.log(errors[errors.length - 1]);
                    }
                    feed();
                });
                w.on("error", (e) => {
                    errors.push(String(e));
                    resolve();
                });
                feed();
            });
        }),
    );
    console.log(formatReport(results, perf));
    if (errors.length) console.log(`errors:\n${errors.join("\n")}`);
    process.exit(errors.length ? 2 : 0);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Two-sided exact binomial p-value of `k` wins in `n` games against p = 0.5. */
export function binomialTwoSided(k: number, n: number): number {
    if (n === 0) return 1;
    const hi = binomialUpper(Math.max(k, n - k), n);
    return Math.min(1, 2 * hi);
}

export function formatReport(results: readonly FactionResult[], perf: string | null): string {
    const lines: string[] = [];
    const agg = (brain: "new" | "control") => {
        const sides = results.flatMap((r) => r.sides.filter((s) => s.brain === brain));
        const sum = (f: (s: (typeof sides)[number]) => number) => sides.reduce((a, s) => a + f(s), 0);
        const alive = sum((s) => s.aliveSeconds);
        const cohW = sum((s) => s.cohesionSamples);
        return {
            matches: sides.length,
            kills: sum((s) => s.kills),
            deaths: sum((s) => s.deaths),
            strike: sum((s) => s.strikeDeaths),
            gas: sum((s) => s.gasDeaths),
            stuck: sum((s) => s.stuckEvents),
            stuckPerMin: alive > 0 ? sum((s) => s.stuckEvents) / (alive / 60) : 0,
            cohesionMedian: sides.length
                ? sides.map((s) => s.cohesionMedian).sort((a, b) => a - b)[Math.floor(sides.length / 2)]
                : 0,
            cohesionMean: cohW ? sum((s) => s.cohesionMean * s.cohesionSamples) / cohW : 0,
            bugles: sum((s) => s.bugleUses),
            revives: sum((s) => s.revives),
        };
    };
    const timing = (key: string) => {
        const ts = results.map((r) => r.botTickMs[key]).filter((t) => t !== undefined);
        if (!ts.length) return null;
        const n = ts.reduce((a, t) => a + t.n, 0);
        return {
            p50: ts.reduce((a, t) => a + t.p50 * t.n, 0) / n,
            p99: ts.reduce((a, t) => a + t.p99 * t.n, 0) / n,
            mean: ts.reduce((a, t) => a + t.mean * t.n, 0) / n,
        };
    };
    if (!perf) {
        const decided = results.filter((r) => r.over && r.winningTeam > 0);
        const wins = decided.filter((r) => r.winningTeam === r.task.newSide).length;
        const w = wilson(wins, decided.length);
        lines.push(
            `faction brain wins ${wins}/${decided.length} (${r2(w.p)}, 95% CI ${r2(w.lo)}-${r2(w.hi)}), ` +
                `two-sided binomial p = ${binomialTwoSided(wins, decided.length).toPrecision(3)}, one-sided p = ${binomialUpper(wins, decided.length).toPrecision(3)}`,
        );
        const redWins = decided.filter((r) => r.winningTeam === 1).length;
        lines.push(`red wins ${redWins}/${decided.length}; undecided ${results.length - decided.length}`);
        // finer than wins (the map side decides many matches): the kill margin of every match, and per seed and map side
        // the survivors the new brain kept against those the current one kept on that same side
        const margin = results.map((r) => {
            const n = r.sides.find((s) => s.brain === "new");
            const c = r.sides.find((s) => s.brain === "control");
            return (n?.kills ?? 0) - (c?.kills ?? 0);
        });
        const ahead = margin.filter((m) => m > 0).length;
        const ties = margin.filter((m) => m === 0).length;
        const mean = margin.reduce((a, b) => a + b, 0) / Math.max(1, margin.length);
        lines.push(
            `kill margin new - control per match: mean ${r2(mean)}, new ahead in ${ahead}/${margin.length - ties} ` +
                `(sign test two-sided p = ${binomialTwoSided(ahead, margin.length - ties).toPrecision(3)})`,
        );
        let better = 0;
        let pairs = 0;
        for (const seed of new Set(results.map((r) => r.task.seed))) {
            const runs = results.filter((r) => r.task.seed === seed);
            for (const side of [1, 2]) {
                const asNew = runs.find((r) => r.task.newSide === side);
                const asCtl = runs.find((r) => r.task.newSide === 3 - side);
                if (!asNew || !asCtl) continue;
                const keep = (r: FactionResult) =>
                    (r.sides.find((s) => s.team === side)?.alive ?? 0) -
                    (r.sides.find((s) => s.team !== side)?.alive ?? 0);
                const d = keep(asNew) - keep(asCtl);
                if (d === 0) continue;
                pairs++;
                if (d > 0) better++;
            }
        }
        if (pairs)
            lines.push(
                `same seed and side, survivor margin of the new brain above the current one's: ${better}/${pairs} ` +
                    `(sign test two-sided p = ${binomialTwoSided(better, pairs).toPrecision(3)})`,
            );
    }
    lines.push(
        "side      matches kills deaths strike gas  stuck stuck/min cohesion(med/mean) bugles revives  bot ms p50/p99/mean",
    );
    for (const brain of ["new", "control"] as const) {
        const a = agg(brain);
        if (!a.matches) continue;
        const t = timing(brain === "new" ? "smart" : "baseline");
        lines.push(
            `${brain.padEnd(9)} ${String(a.matches).padStart(7)} ${String(a.kills).padStart(5)} ${String(a.deaths).padStart(6)} ` +
                `${String(a.strike).padStart(6)} ${String(a.gas).padStart(4)} ${String(a.stuck).padStart(6)} ${r2(a.stuckPerMin).toFixed(3).padStart(9)} ` +
                `${r2(a.cohesionMedian).toFixed(1).padStart(8)}/${r2(a.cohesionMean).toFixed(1).padEnd(9)} ${String(a.bugles).padStart(6)} ${String(a.revives).padStart(7)}  ` +
                (t ? `${t.p50.toFixed(3)}/${t.p99.toFixed(3)}/${t.mean.toFixed(3)}` : "-"),
        );
    }
    const tick = results.map((r) => r.tickMs.p99);
    if (tick.length)
        lines.push(`tick ms p99 (bots + sim), mean over matches: ${r2(tick.reduce((a, b) => a + b, 0) / tick.length)}`);
    const exc = results.reduce((a, r) => a + r.exceptions, 0);
    const tk = results.reduce((a, r) => a + r.teamKills, 0);
    lines.push(`exceptions ${exc}, team kills ${tk}, matches ${results.length}`);
    return lines.join("\n");
}

if (!isMainThread) {
    // ablations: FACTION_TUNING="push=0,formation=0" turns parts of the faction brain off (factionCtx.ts)
    applyTuning(process.env.FACTION_TUNING);
    parentPort?.on("message", (task: FactionTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runFactionMatch(task, () => performance.now()) });
        } catch (err) {
            parentPort?.postMessage({
                ok: false,
                task,
                error: err instanceof Error ? (err.stack ?? err.message) : String(err),
            });
        }
    });
    void workerData;
} else if (process.argv.includes("--report")) {
    // re-print the report of saved results: --report results.jsonl [more.jsonl ...] [--perf]
    const files = process.argv.slice(process.argv.indexOf("--report") + 1).filter((a) => !a.startsWith("--"));
    const rows = files.flatMap((f) =>
        readFileSync(f, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((l) => JSON.parse(l) as FactionResult),
    );
    console.log(formatReport(rows, process.argv.includes("--perf") ? "perf" : null));
} else {
    await main();
}
