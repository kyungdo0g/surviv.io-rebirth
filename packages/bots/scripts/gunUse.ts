// The owner's gun-use items (bot round 6, user reports 42-44) on worker threads, apart from the faction A/B:
//   node packages/bots/scripts/gunUse.ts [--seeds 1-4] [--bots 60] [--map main] [--workers 3]
// Every seed plays twice (the three flags on the even, then the odd spawn indices; scripts/gunUseLib.ts) with the
// server's skill tiers and personas. Prints per half and skill tier the loadout shares (DMR, close gun + DMR, bolt
// sniper, potato gun), the mean follow-up time after a slow gun's shot, quick switches per bot, kills per bot, DMRs
// picked up of those seen close by, and the potato-gun kills (use --map potato for report 42).
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { emptyHalf, type GunTask, type HalfMetrics, runGunMatch, TIERS } from "./gunUseLib.ts";

type Reply = { ok: true; result: Record<"on" | "off", HalfMetrics> } | { ok: false; error: string };

function parseSeeds(s: string): number[] {
    const out: number[] = [];
    for (const part of s.split(",")) {
        const [a, b] = part.split("-").map(Number);
        if (b === undefined) out.push(a);
        else for (let k = a; k <= b; k++) out.push(k);
    }
    return out;
}

const pct = (yes: number, n: number) => (n ? `${((100 * yes) / n).toFixed(1)}%` : "n/a");

function add(a: HalfMetrics, b: HalfMetrics): void {
    for (const t of TIERS) {
        const x = a[t];
        const y = b[t];
        for (const k of Object.keys(x) as Array<keyof typeof x>) x[k] += y[k];
    }
    a.potatoKills += b.potatoKills;
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            seeds: { type: "string", default: "1-4" },
            bots: { type: "string", default: "60" },
            map: { type: "string", default: "main" },
            workers: { type: "string", default: "3" },
        },
    });
    const tasks: GunTask[] = [];
    for (const seed of parseSeeds(values.seeds))
        for (const half of [0, 1] as const) tasks.push({ seed, bots: Number(values.bots), map: values.map, half });
    const sum: Record<"on" | "off", HalfMetrics> = { on: emptyHalf(), off: emptyHalf() };
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
                        add(sum.on, r.result.on);
                        add(sum.off, r.result.off);
                        console.log(`match done (${next}/${tasks.length})`);
                    } else console.log(r.error);
                    feed();
                });
                feed();
            });
        }),
    );
    console.log(`map ${values.map}, seeds ${values.seeds}, ${values.bots} bots`);
    console.log(
        "half tier          bots samples   DMR  close+DMR sniper potato follow-up(s, n)  quick/bot kills/bot  DMR taken/seen",
    );
    for (const k of ["on", "off"] as const) {
        for (const t of TIERS) {
            const m = sum[k][t];
            const follow = m.follow ? (m.followSum / m.follow).toFixed(2) : "n/a";
            console.log(
                `${k.padEnd(4)} ${t.padEnd(13)} ${String(m.bots).padStart(5)} ${String(m.samples).padStart(7)} ` +
                    `${pct(m.dmr, m.samples).padStart(6)} ${pct(m.closeDmr, m.samples).padStart(9)} ` +
                    `${pct(m.sniper, m.samples).padStart(6)} ${pct(m.potato, m.samples).padStart(6)} ` +
                    `${`${follow} (${m.follow})`.padStart(15)} ${(m.quick / Math.max(1, m.bots)).toFixed(2).padStart(10)} ` +
                    `${(m.kills / Math.max(1, m.bots)).toFixed(3).padStart(9)} ` +
                    `${`${m.dmrTaken}/${m.dmrSeen} ${pct(m.dmrTaken, m.dmrSeen)}`.padStart(15)}`,
            );
        }
        console.log(`${k} potato-gun kills ${sum[k].potatoKills}`);
    }
}

if (!isMainThread) {
    parentPort?.on("message", (task: GunTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runGunMatch(task) });
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
