// Aim bench: one bot against a scripted target on a duel range (scripts/aimbenchLib.ts), per difficulty, gun (ak47,
// m9, mosin, m870), distance (10, 20, 35), scope (1x, 4x) and target pattern (stationary, ADAD strafe, crossing).
//   node packages/bots/scripts/aimbench.ts [--trials 16] [--seed 1] [--workers 4] [--difficulty all|easy|normal|hard]
//        [--motor legacy|human] [--record] [--baseline packages/bots/test/fixtures/aim-baseline.json] [--json out.json]
// Prints, per difficulty, time to first shot and first hit after the target becomes visible, the bullet hit rate and the
// time to kill, then compares with the recorded baseline (the legacy aim): the human motor model must stay within
// +-20% of its first-shot time and +-15% of its hit rate. Without --motor the presets' model runs. `--record` rewrites
// the baseline fixture with the legacy motor (unless --motor says otherwise). Cells whose distance lies outside the
// scope's view (35 units with 1x) never see the target and are reported as such.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { DIFFICULTIES, DIFFICULTY_PRESETS, type Difficulty, isDifficulty, type MotorModel } from "../src/difficulty.ts";
import {
    type AimBaseline,
    allCells,
    type BenchCell,
    cellKey,
    cellVisible,
    runTrial,
    summarize,
    summarizeDifficulty,
    TRIAL_SECONDS,
    type TrialResult,
    trialSeed,
} from "./aimbenchLib.ts";

interface Job {
    index: number;
    cell: BenchCell;
    seed: number;
}

interface WorkerInit {
    motor: MotorModel | undefined;
}

const FIXTURE = fileURLToPath(new URL("../test/fixtures/aim-baseline.json", import.meta.url));
const r4 = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            trials: { type: "string", default: "16" },
            seed: { type: "string", default: "1" },
            workers: { type: "string", default: "4" },
            difficulty: { type: "string", default: "all" },
            motor: { type: "string" },
            record: { type: "boolean", default: false },
            baseline: { type: "string", default: FIXTURE },
            json: { type: "string" },
        },
    });
    const difficulties: Difficulty[] =
        values.difficulty === "all"
            ? [...DIFFICULTIES]
            : values.difficulty.split(",").map((d) => {
                  if (!isDifficulty(d)) throw new Error(`unknown difficulty ${d}`);
                  return d;
              });
    // the baseline fixture is the legacy aim: --record defaults to it
    const motor = (values.motor ?? (values.record ? "legacy" : undefined)) as MotorModel | undefined;
    if (motor && motor !== "legacy" && motor !== "human") throw new Error("--motor must be legacy or human");
    const presetModel = DIFFICULTY_PRESETS[difficulties[0]].motor.model;
    const trialsPerCell = Number(values.trials);
    const seed = Number(values.seed);
    const cells = allCells(difficulties);
    const jobs: Job[] = [];
    for (const cell of cells) {
        if (!cellVisible(cell.distance, cell.scope)) continue;
        for (let k = 0; k < trialsPerCell; k++) jobs.push({ index: jobs.length, cell, seed: trialSeed(seed, cell, k) });
    }
    const workers = Math.max(1, Math.min(Number(values.workers), availableParallelism(), jobs.length));
    console.log(
        `aim bench: ${cells.length} cells x ${trialsPerCell} trials (${jobs.length} trials in view), ` +
            `motor ${motor ?? `${presetModel} (preset)`}, ${workers} workers`,
    );
    const t0 = performance.now();
    const results: TrialResult[] = new Array(jobs.length);
    await new Promise<void>((resolve, reject) => {
        let next = 0;
        let done = 0;
        for (let i = 0; i < workers; i++) {
            const w = new Worker(new URL(import.meta.url), { workerData: { motor } satisfies WorkerInit });
            const feed = () => {
                if (next < jobs.length) w.postMessage(jobs[next++]);
                else void w.terminate();
            };
            w.on("message", (m: { index: number; result: TrialResult }) => {
                results[m.index] = m.result;
                if (++done === jobs.length) resolve();
                if (done % 50 === 0) process.stdout.write(`\r  ${done}/${jobs.length}`);
                feed();
            });
            w.on("error", reject);
            feed();
        }
    });
    process.stdout.write("\n");
    const wallMs = performance.now() - t0;

    const byCell = new Map<string, TrialResult[]>();
    const byDifficulty = new Map<Difficulty, TrialResult[]>();
    jobs.forEach((job, i) => {
        const key = cellKey(job.cell);
        byCell.set(key, [...(byCell.get(key) ?? []), results[i]]);
        byDifficulty.set(job.cell.difficulty, [...(byDifficulty.get(job.cell.difficulty) ?? []), results[i]]);
    });
    const out: AimBaseline = {
        version: 1,
        command: `node packages/bots/scripts/aimbench.ts --record --trials ${trialsPerCell} --seed ${seed}`,
        motor: motor ?? presetModel,
        seed,
        trialsPerCell,
        trialSeconds: TRIAL_SECONDS,
        summary: {},
        cells: {},
    };
    for (const d of difficulties) out.summary[d] = summarizeDifficulty(byDifficulty.get(d) ?? []);
    for (const cell of cells) {
        const key = cellKey(cell);
        out.cells[key] = summarize(byCell.get(key) ?? []);
    }
    printTable(out, cells);
    console.log(`wall ${(wallMs / 1000).toFixed(1)} s for ${jobs.length} trials on ${workers} workers`);

    if (!values.record && existsSync(values.baseline)) compare(out, JSON.parse(readFileSync(values.baseline, "utf8")));
    if (values.record) writeJson(FIXTURE, out);
    if (values.json) writeJson(values.json, out);
}

function writeJson(path: string, data: unknown): void {
    writeFileSync(path, `${JSON.stringify(data, null, 4)}\n`);
    try {
        // keep the committed fixture in the repository's Biome format
        execFileSync("npx", ["biome", "format", "--write", path], { stdio: "ignore" });
    } catch {
        // formatting is cosmetic
    }
    console.log(`wrote ${path}`);
}

const fmt = (v: number | null, digits = 3) => (v === null ? "-" : v.toFixed(digits));

function printTable(b: AimBaseline, cells: readonly BenchCell[]): void {
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log(
        `${pad("difficulty", 11)}${pad("first shot s", 14)}${pad("first hit s", 13)}${pad("hit rate", 10)}` +
            `${pad("ttk s", 9)}${pad("kills", 8)}trials`,
    );
    for (const [d, s] of Object.entries(b.summary)) {
        if (!s) continue;
        console.log(
            `${pad(d, 11)}${pad(fmt(s.firstShot), 14)}${pad(fmt(s.firstHit), 13)}${pad(fmt(s.hitRate), 10)}` +
                `${pad(fmt(s.ttk), 9)}${pad(fmt(s.killRate, 2), 8)}${s.trials}`,
        );
    }
    console.log("\nper cell (difficulty/gun/distance/scope/pattern): first shot, first hit, hit rate, ttk, kill rate");
    for (const cell of cells) {
        const key = cellKey(cell);
        const c = b.cells[key];
        const line = c.seen
            ? `${fmt(c.firstShot)}  ${fmt(c.firstHit)}  ${fmt(c.hitRate)}  ${fmt(c.ttk)}  ${fmt(c.killRate, 2)}`
            : "target out of view";
        console.log(`  ${pad(key, 34)}${line}`);
    }
}

/** Wave 2 tolerance: first-shot time within +-20%, hit rate within +-15% of the baseline, per difficulty. */
function compare(now: AimBaseline, base: AimBaseline): void {
    const rel = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b - 1);
    console.log(`\nagainst the baseline (${base.motor} motor, ${base.trialsPerCell} trials per cell):`);
    let pass = true;
    for (const [d, s] of Object.entries(now.summary)) {
        const ref = base.summary[d as Difficulty];
        if (!s || !ref) continue;
        const shot = rel(s.firstShot, ref.firstShot);
        const hit = rel(s.hitRate, ref.hitRate);
        const ok = shot !== null && hit !== null && Math.abs(shot) <= 0.2 && Math.abs(hit) <= 0.15;
        pass &&= ok;
        console.log(
            `  ${d.padEnd(7)} first shot ${fmt(s.firstShot)} vs ${fmt(ref.firstShot)} (${fmt(r4(shot), 3)}), ` +
                `hit rate ${fmt(s.hitRate)} vs ${fmt(ref.hitRate)} (${fmt(r4(hit), 3)}), ttk ${fmt(s.ttk)} vs ` +
                `${fmt(ref.ttk)}: ${ok ? "within tolerance" : "OUT OF TOLERANCE"}`,
        );
    }
    console.log(`motor check: ${pass ? "PASS" : "FAIL"} (first shot +-20%, hit rate +-15%)`);
}

// dispatch last: main() reads the module constants above
if (!isMainThread) {
    const { motor } = workerData as WorkerInit;
    parentPort?.on("message", (job: Job) => {
        parentPort?.postMessage({ index: job.index, result: runTrial(job.cell, job.seed, motor) });
    });
} else {
    await main();
}
