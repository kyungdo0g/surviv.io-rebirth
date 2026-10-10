// 50v50 river and rally numbers (owner 2026-10-08) on worker threads: the share of bot-seconds in water by match phase
// and behaviour, and the share of faction members near their Commander (scripts/factionRallyLib.ts).
//   node packages/bots/scripts/factionRally.ts [--seeds 1-4] [--workers 2] [--gas normal|quick] [--max-ticks 60000]
//        [--difficulty population|mixed] [--personas 0|1] [--out results.jsonl]
//   node packages/bots/scripts/factionRally.ts --report results.jsonl [more.jsonl ...]
import { appendFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { formatRally, type RallyMatch, type RallyTask, runRallyMatch } from "./factionRallyLib.ts";

type Reply = { ok: true; result: RallyMatch } | { ok: false; task: RallyTask; error: string };

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
            seeds: { type: "string", default: "1-4" },
            workers: { type: "string", default: "2" },
            gas: { type: "string", default: "normal" },
            "max-ticks": { type: "string", default: "60000" },
            difficulty: { type: "string", default: "population" },
            personas: { type: "string", default: "1" },
            out: { type: "string" },
        },
    });
    const tasks: RallyTask[] = parseSeeds(values.seeds).map((seed) => ({
        seed,
        gas: values.gas === "quick" ? "quick" : "normal",
        maxTicks: Number(values["max-ticks"]),
        difficulty: values.difficulty === "mixed" ? "mixed" : "population",
        personas: values.personas !== "0",
    }));
    const results: RallyMatch[] = [];
    const errors: string[] = [];
    let next = 0;
    const n = Math.max(1, Math.min(Number(values.workers), tasks.length));
    await Promise.all(
        Array.from({ length: n }, () => {
            const w = new Worker(new URL(import.meta.url));
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
                        console.log(formatRally([r.result]).split("\n")[0]);
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
    console.log(formatRally(results.sort((a, b) => a.task.seed - b.task.seed)));
    if (errors.length) console.log(`errors:\n${errors.join("\n")}`);
    process.exit(errors.length ? 2 : 0);
}

if (!isMainThread) {
    parentPort?.on("message", (task: RallyTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runRallyMatch(task, () => performance.now()) });
        } catch (err) {
            parentPort?.postMessage({
                ok: false,
                task,
                error: err instanceof Error ? (err.stack ?? err.message) : String(err),
            });
        }
    });
} else if (process.argv.includes("--report")) {
    const files = process.argv.slice(process.argv.indexOf("--report") + 1).filter((a) => !a.startsWith("--"));
    const rows = files.flatMap((f) =>
        readFileSync(f, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((l) => JSON.parse(l) as RallyMatch),
    );
    console.log(formatRally(rows));
} else {
    await main();
}
