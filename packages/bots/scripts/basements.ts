// Basement looting in population matches (owner, 2026-10-08): per structure with an underground floor, how many bots
// walk down, when and why, how many containers are opened and items picked up there, next to the surface buildings.
//   node packages/bots/scripts/basements.ts [--seeds 3] [--seed 1] [--bots 80] [--mode solo] [--workers 2]
//        [--max-ticks 60000] [--json out.json]
// Population matches like scripts/population.ts: difficulty "population" with personas, the real gas, the main map.
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { runMatch } from "../src/runner.ts";
import {
    BasementProbe,
    type BasementReport,
    formatRows,
    type PlaceRecord,
    placeRows,
    totalRow,
    UNDERGROUND_NAMES,
} from "./basementsLib.ts";

interface Task {
    seed: number;
    bots: number;
    teamMode: 1 | 2 | 4;
    maxTicks: number;
}

type Reply = { ok: true; report: BasementReport; wallMs: number } | { ok: false; seed: number; error: string };

function runTask(t: Task): BasementReport {
    const probe = new BasementProbe();
    const report = runMatch({
        seed: t.seed,
        bots: t.bots,
        teamMode: t.teamMode,
        difficulty: "population",
        population: { personas: true },
        maxTicks: t.maxTicks,
        probes: [probe],
    });
    const out = report.probes?.basements as BasementReport;
    out.seed = t.seed;
    return out;
}

if (!isMainThread) {
    parentPort?.on("message", (t: Task) => {
        const t0 = performance.now();
        try {
            const report = runTask(t);
            parentPort?.postMessage({ ok: true, report, wallMs: performance.now() - t0 } satisfies Reply);
        } catch (err) {
            const error = err instanceof Error ? (err.stack ?? err.message) : String(err);
            parentPort?.postMessage({ ok: false, seed: t.seed, error } satisfies Reply);
        }
    });
    void workerData;
} else {
    await main();
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            seeds: { type: "string", default: "3" },
            seed: { type: "string", default: "1" },
            bots: { type: "string", default: "80" },
            mode: { type: "string", default: "solo" },
            workers: { type: "string", default: "2" },
            "max-ticks": { type: "string", default: "60000" },
            json: { type: "string" },
        },
    });
    const teamMode = ({ solo: 1, duo: 2, squad: 4 } as const)[values.mode as "solo" | "duo" | "squad"];
    if (!teamMode) throw new Error("--mode takes solo, duo or squad");
    const tasks: Task[] = [];
    for (let k = 0; k < Number(values.seeds); k++) {
        tasks.push({
            seed: Number(values.seed) + k,
            bots: Number(values.bots),
            teamMode,
            maxTicks: Number(values["max-ticks"]),
        });
    }
    const workers = Math.max(1, Math.min(Number(values.workers), tasks.length, availableParallelism()));
    console.log(`basements: ${tasks.length} ${values.mode} matches, ${values.bots} bots, ${workers} workers`);
    const reports: BasementReport[] = [];
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
            const w = new Worker(new URL(import.meta.url));
            running++;
            w.on("message", (r: Reply) => {
                if (r.ok) {
                    reports.push(r.report);
                    console.log(
                        `  seed ${r.report.seed}: ${Math.round(r.report.gameSeconds)} game s, ${(r.wallMs / 1000).toFixed(0)} s wall`,
                    );
                } else failures.push(`seed ${r.seed}: ${r.error}`);
                start(w);
            });
            w.on("error", (err) => {
                failures.push(`worker: ${err.stack ?? err.message}`);
                if (--running === 0) resolve();
            });
            start(w);
        }
    });
    reports.sort((a, b) => a.seed - b.seed);
    const under: PlaceRecord[] = reports.flatMap((r) => r.underground);
    const surface: PlaceRecord[] = reports.flatMap((r) => r.surface);
    const uRows = placeRows(under, UNDERGROUND_NAMES).sort((a, b) => a.name.localeCompare(b.name));
    console.log(`\nunderground (${reports.length} matches)`);
    console.log(formatRows([...uRows, totalRow(uRows, "all underground floors")], true));
    const sRows = placeRows(surface).sort((a, b) => b.pickups - a.pickups);
    console.log(`\nsurface buildings (${reports.length} matches; the 15 with the most pickups)`);
    console.log(formatRows([...sRows.slice(0, 15), totalRow(sRows, "all surface buildings")], false));
    const open = reports.reduce((a, r) => a + r.openPickups, 0);
    console.log(`\npickups outside every building: ${open}`);
    const deaths = reports.flatMap((r) => r.deathTimes);
    const by = (t: number) => deaths.filter((d) => d <= t).length;
    console.log(
        `deaths (all matches): by 60 s ${by(60)}, by 120 s ${by(120)}, by 180 s ${by(180)}, by 240 s ${by(240)}, ` +
            `of ${reports.reduce((a, r) => a + r.bots, 0)} bots`,
    );
    for (const f of failures) console.log(`FAILED ${f}`);
    if (values.json) {
        writeFileSync(values.json, `${JSON.stringify({ reports, underground: uRows, surface: sRows }, null, 1)}\n`);
        console.log(`wrote ${values.json}`);
    }
    process.exit(failures.length ? 2 : 0);
}
