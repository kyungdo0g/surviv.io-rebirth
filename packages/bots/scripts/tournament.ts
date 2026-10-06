// Smart brain vs baseline brain tournament on worker threads (the gate before the smart brain becomes the default).
//   node packages/bots/scripts/tournament.ts [--matches 120] [--quick] [--workers 4] [--bots 40]
//        [--difficulty normal] [--mode solo|duo|squad] [--features assess,cover] [--seed 1000] [--gas-div 2.5]
//        [--map main] [--json out.json]
// Every match: N bots of one difficulty on fast gas (about 3 game minutes), half of them (half the groups in team
// modes) on the smart brain, half on the baseline; every seed plays twice with the brains swapped. `--quick` plays 24
// matches; `--features a,b` makes "smart" the baseline plus only those features (ablation). Prints the comparison and
// the gate (scripts/tournamentLib.ts); exits 0 on PASS, 1 on FAIL, 2 on errors.
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { BRAIN_FEATURES, type BrainFeature, isBrainFeature } from "../src/brain/features.ts";
import { isDifficulty } from "../src/difficulty.ts";
import {
    aggregate,
    DEFAULT_TOURNAMENT,
    evaluate,
    formatReport,
    type MatchResult,
    type MatchTask,
    matchPlan,
    runTournamentMatch,
    type TournamentMode,
    type TournamentOptions,
} from "./tournamentLib.ts";

interface WorkerInit {
    opts: TournamentOptions;
}

if (!isMainThread) {
    // worker: play the matches the main thread hands out, one at a time
    const { opts } = workerData as WorkerInit;
    parentPort?.on("message", (task: MatchTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runTournamentMatch(opts, task, () => performance.now()) });
        } catch (err) {
            parentPort?.postMessage({
                ok: false,
                task,
                error: err instanceof Error ? (err.stack ?? err.message) : String(err),
            });
        }
    });
} else {
    await main();
}

type WorkerReply = { ok: true; result: MatchResult } | { ok: false; task: MatchTask; error: string };

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            matches: { type: "string", default: "120" },
            quick: { type: "boolean", default: false },
            workers: { type: "string", default: "4" },
            bots: { type: "string", default: String(DEFAULT_TOURNAMENT.bots) },
            difficulty: { type: "string", default: "normal" },
            mode: { type: "string", default: "solo" },
            features: { type: "string" },
            seed: { type: "string", default: "1000" },
            "gas-div": { type: "string", default: String(DEFAULT_TOURNAMENT.gasDiv) },
            "max-ticks": { type: "string", default: String(DEFAULT_TOURNAMENT.maxTicks) },
            map: { type: "string", default: DEFAULT_TOURNAMENT.mapName },
            json: { type: "string" },
        },
    });
    if (!isDifficulty(values.difficulty)) throw new Error(`unknown difficulty ${values.difficulty}`);
    const mode = values.mode as TournamentMode;
    if (!["solo", "duo", "squad"].includes(mode)) throw new Error(`--mode must be solo, duo or squad`);
    let features: BrainFeature[] | null = null;
    if (values.features) {
        const list = values.features.split(",").map((s) => s.trim());
        const bad = list.filter((f) => !isBrainFeature(f));
        if (bad.length) throw new Error(`unknown features ${bad.join(", ")} (known: ${BRAIN_FEATURES.join(", ")})`);
        features = list as BrainFeature[];
    }
    const opts: TournamentOptions = {
        ...DEFAULT_TOURNAMENT,
        bots: Number(values.bots),
        difficulty: values.difficulty,
        mode,
        features,
        gasDiv: Number(values["gas-div"]),
        maxTicks: Number(values["max-ticks"]),
        mapName: values.map,
    };
    const matches = values.quick ? 24 : Number(values.matches);
    const tasks = matchPlan(matches, Number(values.seed));
    const workers = Math.max(1, Math.min(Number(values.workers), tasks.length, availableParallelism()));
    const smartLabel = features ? `smart(${features.join(",")})` : "smart";
    console.log(
        `tournament: ${tasks.length} matches of ${opts.bots} bots, ${mode}, ${values.difficulty}, ${smartLabel} vs ` +
            `baseline, gas /${opts.gasDiv}, ${workers} workers`,
    );

    const t0 = performance.now();
    const results: MatchResult[] = [];
    const failures: string[] = [];
    await new Promise<void>((resolve) => {
        let next = 0;
        let running = 0;
        const start = (w: Worker) => {
            if (next >= tasks.length) {
                void w.terminate();
                if (--running === 0) resolve();
                return;
            }
            w.postMessage(tasks[next++]);
        };
        for (let i = 0; i < workers; i++) {
            const w = new Worker(new URL(import.meta.url), { workerData: { opts } satisfies WorkerInit });
            running++;
            w.on("message", (reply: WorkerReply) => {
                if (reply.ok) {
                    results.push(reply.result);
                    const r = reply.result;
                    const done = results.length + failures.length;
                    process.stdout.write(
                        `\r  ${done}/${tasks.length} (seed ${r.seed}${r.mirrored ? "m" : ""}: ` +
                            `${Math.round(r.gameSeconds)} game s, ${(r.wallMs / 1000).toFixed(1)} s wall, ` +
                            `winner ${r.winnerBrain ?? "none"})   `,
                    );
                } else {
                    failures.push(`seed ${reply.task.seed}${reply.task.mirrored ? "m" : ""}: ${reply.error}`);
                }
                start(w);
            });
            w.on("error", (err) => {
                failures.push(`worker: ${err.stack ?? err.message}`);
                if (--running === 0) resolve();
            });
            start(w);
        }
    });
    const wallMs = performance.now() - t0;
    process.stdout.write("\n");
    results.sort((a, b) => a.seed - b.seed || Number(a.mirrored) - Number(b.mirrored));
    const report = aggregate(results, mode);
    const gate = evaluate(report);
    console.log(formatReport(report, gate, smartLabel));
    console.log(
        `timing: ${(wallMs / 1000).toFixed(1)} s wall for ${results.length} matches on ${workers} workers = ` +
            `${(wallMs / 1000 / Math.max(1, results.length)).toFixed(2)} s per match throughput, ` +
            `${(report.wallMsPerMatch / 1000).toFixed(2)} s per match in a worker`,
    );
    for (const f of failures) console.log(`FAILED ${f}`);
    if (values.json) {
        const out = {
            options: { ...opts, matches: tasks.length, workers, seed: Number(values.seed) },
            wallMs,
            report,
            gate,
            failures,
            matches: results.map(({ players: _players, botTickHist: _hist, ...m }) => m),
        };
        writeFileSync(values.json, `${JSON.stringify(out, null, 2)}\n`);
        console.log(`wrote ${values.json}`);
    }
    process.exit(failures.length || report.exceptions ? 2 : gate.pass ? 0 : 1);
}
