// The population suite of the bot overhaul on worker threads: full matches with the match metrics on, then the
// acceptance thresholds per cell (difficulty/brain) as PASS / FAIL / N/A lines, a breakdown by skill tier, persona,
// difficulty and mode, and the tier of the guns bots carry over time.
//   node packages/bots/scripts/population.ts [--quick] [--seeds 10] [--seed 1] [--modes solo,duo,squad]
//        [--difficulty population[,normal,...]] [--brains smart[,baseline]] [--bots 80] [--gas-div 1]
//        [--faction 2] [--personas auto|on|off] [--skill-mix 35,45,20] [--max-ticks 60000] [--workers 2]
//        [--json out.json] [--samples] [--map main] [--mode-seeds solo=40,duo=12,squad=12]
// The default plays 10 seeds of each mode (30 decided matches: enough to judge the win share by tier) plus two 50v50
// smoke runs, about 15 minutes on 2 workers; `--quick` plays 2 seeds of each mode plus one 50v50 smoke run. `--difficulty population` is the server's default
// population (BOT_DIFFICULTY=mixed: 35/45/20 beginner/intermediate/expert, personas on); legacy presets run neutral.
// `--samples` also writes every match's per-bot metrics to the JSON. Exits 0 when every threshold passes (N/A does
// not fail), 1 when one fails, 2 on errors or bot exceptions.
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { BRAIN_PRESETS, type BrainName } from "../src/brain/features.ts";
import { isDifficulty } from "../src/difficulty.ts";
import { formatCell } from "../src/metrics/format.ts";
import type { MatchSample, SuiteMode } from "../src/metrics/summary.ts";
import { passed } from "../src/metrics/thresholds.ts";
import { parseSkillMix } from "../src/skill.ts";
import {
    DEFAULT_SUITE,
    QUICK_SUITE,
    runSuiteTask,
    type SuiteDifficulty,
    type SuiteOptions,
    type SuiteTask,
    suitePlan,
    summarizeSuite,
} from "./populationLib.ts";

interface WorkerInit {
    opts: SuiteOptions;
}

type WorkerReply = { ok: true; sample: MatchSample } | { ok: false; task: SuiteTask; error: string };

if (!isMainThread) {
    const { opts } = workerData as WorkerInit;
    parentPort?.on("message", (task: SuiteTask) => {
        try {
            const sample = runSuiteTask(opts, task, () => performance.now());
            parentPort?.postMessage({ ok: true, sample } satisfies WorkerReply);
        } catch (err) {
            const error = err instanceof Error ? (err.stack ?? err.message) : String(err);
            parentPort?.postMessage({ ok: false, task, error } satisfies WorkerReply);
        }
    });
} else {
    await main();
}

/** `solo=40,duo=12,squad=12`: seeds per mode. */
function modeSeeds(v: string): SuiteOptions["modeSeeds"] {
    const out: NonNullable<SuiteOptions["modeSeeds"]> = {};
    for (const part of list(v)) {
        const [mode, n] = part.split("=");
        if (mode !== "solo" && mode !== "duo" && mode !== "squad")
            throw new Error(`--mode-seeds: unknown mode ${mode}`);
        out[mode] = Number(n);
    }
    return out;
}

function list(v: string): string[] {
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            quick: { type: "boolean", default: false },
            seeds: { type: "string" },
            seed: { type: "string" },
            modes: { type: "string" },
            difficulty: { type: "string" },
            brains: { type: "string" },
            bots: { type: "string" },
            "gas-div": { type: "string" },
            faction: { type: "string" },
            personas: { type: "string" },
            "skill-mix": { type: "string" },
            "max-ticks": { type: "string" },
            workers: { type: "string", default: "2" },
            json: { type: "string" },
            samples: { type: "boolean", default: false },
            map: { type: "string" },
            "mode-seeds": { type: "string" },
        },
    });
    const base: SuiteOptions = { ...DEFAULT_SUITE, ...(values.quick ? QUICK_SUITE : {}) };
    const modes = values.modes ? list(values.modes) : base.modes;
    const bad = modes.filter((m) => !["solo", "duo", "squad"].includes(m));
    if (bad.length) throw new Error(`--modes takes solo, duo, squad (got ${bad.join(", ")})`);
    const difficulties = values.difficulty ? list(values.difficulty) : base.difficulties;
    for (const d of difficulties) {
        if (d !== "population" && d !== "mixed" && !isDifficulty(d)) throw new Error(`unknown difficulty ${d}`);
    }
    const brains = values.brains ? list(values.brains) : base.brains;
    for (const b of brains) if (!Object.hasOwn(BRAIN_PRESETS, b)) throw new Error(`unknown brain ${b}`);
    const personas = (values.personas ?? base.personas) as SuiteOptions["personas"];
    if (!["auto", "on", "off"].includes(personas)) throw new Error("--personas takes auto, on or off");
    const opts: SuiteOptions = {
        ...base,
        seeds: Number(values.seeds ?? base.seeds),
        seed: Number(values.seed ?? base.seed),
        modes: modes as Exclude<SuiteMode, "faction">[],
        difficulties: difficulties as SuiteDifficulty[],
        brains: brains as BrainName[],
        bots: Number(values.bots ?? base.bots),
        gasDiv: Number(values["gas-div"] ?? base.gasDiv),
        faction: Number(values.faction ?? base.faction),
        maxTicks: Number(values["max-ticks"] ?? base.maxTicks),
        personas,
        ...(values["skill-mix"] ? { skillMix: parseSkillMix(values["skill-mix"]) } : {}),
        ...(values.map ? { map: values.map } : {}),
        ...(values["mode-seeds"] ? { modeSeeds: modeSeeds(values["mode-seeds"]) } : {}),
    };
    const tasks = suitePlan(opts);
    // the biggest matches first: the 50v50 runs would otherwise finish last on one worker
    tasks.sort((a, b) => Number(b.mode === "faction") - Number(a.mode === "faction"));
    const workers = Math.max(1, Math.min(Number(values.workers), tasks.length, availableParallelism()));
    console.log(
        `population suite: ${tasks.length} matches (${opts.seeds} seeds x ${opts.modes.join("/")} x ` +
            `${opts.difficulties.join("/")} x ${opts.brains.join("/")}, ${opts.bots} bots, gas /${opts.gasDiv}` +
            `${opts.faction ? `, ${opts.faction} 50v50 smoke` : ""}${opts.map ? `, map ${opts.map}` : ""}), ${workers} workers`,
    );
    const t0 = performance.now();
    const samples: MatchSample[] = [];
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
                    const s = reply.sample;
                    samples.push(s);
                    process.stdout.write(
                        `\r  ${samples.length + failures.length}/${tasks.length} (${s.cell} ${s.mode} seed ${s.seed}: ` +
                            `${Math.round(s.gameSeconds)} game s, ${(s.wallMs / 1000).toFixed(1)} s wall)      `,
                    );
                } else {
                    failures.push(`${reply.task.cell} ${reply.task.mode} seed ${reply.task.seed}: ${reply.error}`);
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
    samples.sort((a, b) => a.cell.localeCompare(b.cell) || a.mode.localeCompare(b.mode) || a.seed - b.seed);
    const cells = summarizeSuite(samples);
    for (const c of cells) console.log(`\n${formatCell(c.summary, c.results)}`);
    const pass = cells.every((c) => passed(c.results));
    const exceptions = cells.reduce((a, c) => a + c.summary.exceptions, 0);
    const counts = { PASS: 0, FAIL: 0, "N/A": 0 } as Record<string, number>;
    for (const c of cells) for (const r of c.results) if (r.verdict in counts) counts[r.verdict]++;
    console.log(
        `\nsuite: ${pass ? "PASS" : "FAIL"} (${counts.PASS} pass, ${counts.FAIL} fail, ${counts["N/A"]} n/a), ` +
            `${(wallMs / 1000).toFixed(0)} s wall for ${samples.length} matches`,
    );
    for (const f of failures) console.log(`FAILED ${f}`);
    if (values.json) {
        const out = {
            options: opts,
            wallMs,
            pass,
            cells,
            failures,
            matches: samples.map(({ metrics: _m, players: _p, ...s }) => s),
            ...(values.samples ? { samples } : {}),
        };
        writeFileSync(values.json, `${JSON.stringify(out, null, 1)}\n`);
        console.log(`wrote ${values.json}`);
    }
    process.exit(failures.length || exceptions ? 2 : pass ? 0 : 1);
}
