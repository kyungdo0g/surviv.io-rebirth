// The owner's early-game items (bot round 6, user reports 38-41) on worker threads, apart from the faction A/B:
//   node packages/bots/scripts/earlyGame.ts [--seeds 1-6] [--bots 60] [--workers 3] [--only fistRush]
// Every seed plays twice (the four flags on the even, then the odd spawn indices; scripts/earlyGameLib.ts) on the main
// map with the server's skill tiers and personas. Prints per half the early-game melee-rush rate, the swap-to-melee
// rate at point blank, the share of first building visits in the top third by good-gun value, the crate-first rate,
// and kills per bot and wins. `--only <flag>` is an ablation: the flags half plays that one flag, the other half none.
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { EARLY_FLAGS, type EarlyTask, type GroupMetrics, type Rate, runEarlyMatch } from "./earlyGameLib.ts";

type Reply = { ok: true; result: Record<"on" | "off", GroupMetrics> } | { ok: false; error: string };

function parseSeeds(s: string): number[] {
    const out: number[] = [];
    for (const part of s.split(",")) {
        const [a, b] = part.split("-").map(Number);
        if (b === undefined) out.push(a);
        else for (let k = a; k <= b; k++) out.push(k);
    }
    return out;
}

const pct = (r: Rate) => (r.n ? `${((100 * r.yes) / r.n).toFixed(1)}% (${r.yes}/${r.n})` : "n/a");

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            seeds: { type: "string", default: "1-6" },
            bots: { type: "string", default: "60" },
            workers: { type: "string", default: "3" },
            only: { type: "string" },
        },
    });
    const only = EARLY_FLAGS.find((f) => f === values.only);
    if (values.only && !only) throw new Error(`--only takes one of ${EARLY_FLAGS.join(", ")}`);
    const tasks: EarlyTask[] = [];
    for (const seed of parseSeeds(values.seeds))
        for (const half of [0, 1] as const) tasks.push({ seed, bots: Number(values.bots), half, only });
    const sum: Record<"on" | "off", GroupMetrics> = {
        on: {
            rush: { n: 0, yes: 0 },
            swap: { n: 0, yes: 0 },
            firstLoot: { n: 0, yes: 0 },
            crate: { n: 0, yes: 0 },
            kills: 0,
            bots: 0,
            wins: 0,
        },
        off: {
            rush: { n: 0, yes: 0 },
            swap: { n: 0, yes: 0 },
            firstLoot: { n: 0, yes: 0 },
            crate: { n: 0, yes: 0 },
            kills: 0,
            bots: 0,
            wins: 0,
        },
    };
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
                        for (const k of ["on", "off"] as const) {
                            const a = sum[k];
                            const b = r.result[k];
                            for (const m of ["rush", "swap", "firstLoot", "crate"] as const) {
                                a[m].n += b[m].n;
                                a[m].yes += b[m].yes;
                            }
                            a.kills += b.kills;
                            a.bots += b.bots;
                            a.wins += b.wins;
                        }
                        console.log(`match done (${next}/${tasks.length})`);
                    } else console.log(r.error);
                    feed();
                });
                feed();
            });
        }),
    );
    for (const k of ["on", "off"] as const) {
        const g = sum[k];
        console.log(
            `${k === "on" ? "flags on " : "flags off"}: melee rush ${pct(g.rush)}, swap to melee ${pct(g.swap)}, ` +
                `first looting in top-third buildings ${pct(g.firstLoot)}, crate first ${pct(g.crate)}, ` +
                `kills/bot ${(g.kills / Math.max(1, g.bots)).toFixed(3)}, wins ${g.wins}`,
        );
    }
}

if (!isMainThread) {
    parentPort?.on("message", (task: EarlyTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runEarlyMatch(task) });
        } catch (err) {
            parentPort?.postMessage({
                ok: false,
                error: err instanceof Error ? (err.stack ?? err.message) : String(err),
            });
        }
    });
} else {
    await main();
}
