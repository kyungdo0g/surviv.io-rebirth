// Aim bench: one bot against a scripted target on a duel range (scripts/aimbenchLib.ts), per difficulty, gun (ak47,
// m9, mosin, m870), distance (10, 20, 35), scope (1x, 4x) and target pattern (stationary, ADAD strafe, crossing).
//   node packages/bots/scripts/aimbench.ts [--trials 16] [--seed 1] [--workers 4] [--difficulty all|none|easy,...]
//        [--motor legacy|human] [--record] [--baseline packages/bots/test/fixtures/aim-baseline.json] [--json out.json]
//        [--skill tiers|0.15,0.5,...] [--guns stock|tiers|ot38,m9,...] [--patterns stationary,strafe,cross]
//        [--scope both|auto] [--view snapshot|screen] [--record-tiers]
// Prints, per difficulty, time to first shot and first hit after the target becomes visible, the bullet hit rate and the
// time to kill, then compares with the recorded baseline (the legacy aim): the human motor model must stay within
// +-20% of its first-shot time and +-15% of its hit rate. Without --motor the presets' model runs. `--record` rewrites
// the baseline fixture with the legacy motor (unless --motor says otherwise). Cells whose distance lies outside the
// scope's view (35 units with 1x) never see the target and are reported as such.
//
// Skill tiers (bot overhaul POPULATION-6): `--skill tiers` adds each tier's representative skill level (skill.ts
// SKILL_TIERS benchS; `--skill 0.1,0.4` any levels) as shooters and switches to the calibration grid
// (scripts/aimbenchTiers.ts: TIER_GUNS, 4x at 35 u, standing and strafing targets inside the human 16:9 screen, timed
// from on-screen exposure), prints the tier table and checks the tier bands and monotonicity; `--difficulty all` puts
// the presets in the same table. `--record-tiers` writes test/fixtures/aim-tiers.json.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { DIFFICULTIES, DIFFICULTY_PRESETS, type Difficulty, isDifficulty, type MotorModel } from "../src/difficulty.ts";
import { SKILL_TIERS } from "../src/skill.ts";
import {
    type AimBaseline,
    allCells,
    BENCH_GUNS,
    BENCH_PATTERNS,
    type BenchCell,
    type BenchPattern,
    type BenchView,
    type CellGrid,
    cellKey,
    cellVisible,
    gridCells,
    runTrial,
    shooterLabel,
    summarize,
    summarizeDifficulty,
    TIER_GUNS,
    TRIAL_SECONDS,
    type TrialResult,
    trialSeed,
} from "./aimbenchLib.ts";
import { type AimTiers, printTiers, summarizeTiers, tierGateFailures } from "./aimbenchTiers.ts";

interface Job {
    index: number;
    cell: BenchCell;
    seed: number;
}

interface WorkerInit {
    motor: MotorModel | undefined;
}

const FIXTURE = fileURLToPath(new URL("../test/fixtures/aim-baseline.json", import.meta.url));
const TIERS_FIXTURE = fileURLToPath(new URL("../test/fixtures/aim-tiers.json", import.meta.url));
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
            skill: { type: "string" },
            guns: { type: "string" },
            patterns: { type: "string" },
            scope: { type: "string" },
            view: { type: "string" },
            "record-tiers": { type: "boolean", default: false },
        },
    });
    const difficulties: Difficulty[] =
        values.difficulty === "all"
            ? [...DIFFICULTIES]
            : values.difficulty === "none"
              ? []
              : values.difficulty.split(",").map((d) => {
                    if (!isDifficulty(d)) throw new Error(`unknown difficulty ${d}`);
                    return d;
                });
    const skills =
        values.skill === undefined
            ? []
            : values.skill === "tiers"
              ? Object.values(SKILL_TIERS).map((t) => t.benchS)
              : values.skill.split(",").map(Number);
    if (skills.some((k) => !(k >= 0 && k <= 1))) throw new Error("--skill takes levels in 0..1 or 'tiers'");
    // the baseline fixture is the legacy aim: --record defaults to it
    const motor = (values.motor ?? (values.record ? "legacy" : undefined)) as MotorModel | undefined;
    if (motor && motor !== "legacy" && motor !== "human") throw new Error("--motor must be legacy or human");
    const presetModel = DIFFICULTY_PRESETS.normal.motor.model;
    const trialsPerCell = Number(values.trials);
    const seed = Number(values.seed);
    const tierRun = skills.length > 0 || values["record-tiers"];
    const stock =
        !tierRun && !values.guns && !values.patterns && !values.scope && (values.view ?? "snapshot") === "snapshot";
    const grid: CellGrid = {
        shooters: [
            ...difficulties.map((difficulty) => ({ difficulty })),
            ...skills.map((skill) => ({ difficulty: "normal" as const, skill })),
        ],
        guns:
            values.guns === undefined
                ? tierRun
                    ? TIER_GUNS
                    : BENCH_GUNS
                : values.guns === "tiers"
                  ? TIER_GUNS
                  : values.guns === "stock"
                    ? BENCH_GUNS
                    : values.guns.split(","),
        patterns: (values.patterns?.split(",") ??
            (tierRun ? ["stationary", "strafe"] : [...BENCH_PATTERNS])) as BenchPattern[],
        scopes: (values.scope ?? (tierRun ? "auto" : "both")) as CellGrid["scopes"],
        view: (values.view ?? (tierRun ? "screen" : "snapshot")) as BenchView,
    };
    const cells = stock ? allCells(difficulties) : gridCells(grid);
    const jobs: Job[] = [];
    for (const cell of cells) {
        if (!cellVisible(cell.distance, cell.scope, cell.view)) continue;
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

    if (tierRun) {
        reportTiers(
            jobs.map((j) => j.cell),
            results,
            seed,
            trialsPerCell,
            values["record-tiers"],
        );
        console.log(`wall ${(wallMs / 1000).toFixed(1)} s for ${jobs.length} trials on ${workers} workers`);
        if (values.json) writeJson(values.json, { cells: jobs.map((j) => cellKey(j.cell)), results });
        return;
    }
    const byCell = new Map<string, TrialResult[]>();
    const byDifficulty = new Map<string, TrialResult[]>();
    jobs.forEach((job, i) => {
        const key = cellKey(job.cell);
        const label = shooterLabel(job.cell);
        byCell.set(key, [...(byCell.get(key) ?? []), results[i]]);
        byDifficulty.set(label, [...(byDifficulty.get(label) ?? []), results[i]]);
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
    for (const d of byDifficulty.keys()) out.summary[d] = summarizeDifficulty(byDifficulty.get(d) ?? []);
    for (const cell of cells) {
        const key = cellKey(cell);
        out.cells[key] = summarize(byCell.get(key) ?? []);
    }
    printTable(out, cells);
    console.log(`wall ${(wallMs / 1000).toFixed(1)} s for ${jobs.length} trials on ${workers} workers`);

    if (stock && !values.record && existsSync(values.baseline))
        compare(out, JSON.parse(readFileSync(values.baseline, "utf8")));
    if (values.record) {
        if (!stock) throw new Error("--record writes the stock grid only");
        writeJson(FIXTURE, out);
    }
    if (values.json) writeJson(values.json, out);
}

/** Tier table, gates and (with --record-tiers) the fixture. */
function reportTiers(
    cells: readonly BenchCell[],
    results: readonly TrialResult[],
    seed: number,
    trialsPerCell: number,
    record: boolean,
): void {
    const summaries = summarizeTiers(cells, results);
    printTiers(summaries);
    const fails = tierGateFailures(summaries);
    console.log(`\ntier gate: ${fails.length ? "FAIL" : "PASS"}`);
    for (const f of fails) console.log(`  ${f}`);
    if (record) {
        const out: AimTiers = {
            version: 1,
            command: `node packages/bots/scripts/aimbench.ts --skill tiers --difficulty all --record-tiers --trials ${trialsPerCell} --seed ${seed}`,
            seed,
            trialsPerCell,
            summaries,
        };
        writeJson(TIERS_FIXTURE, out);
    }
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
