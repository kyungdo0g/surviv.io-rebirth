// Population metrics of the bot interactions (doors, puzzles, vaults, air drops) on worker threads, flags on vs off:
//   node packages/bots/scripts/interactions.ts [--seeds 1-4] [--bots 60] [--map main] [--gas quick|fast|normal]
//        [--workers 3] [--max-ticks 60000] [--json out.json]
// Every seed plays twice: every bot on the default brain with BrainFeatures.doors and .puzzles on, then both off
// (scripts/interactionsLib.ts), the server's skill-tier mix and personas. `--gas quick` divides the gas stages after
// the first by 4 (the tests' QUICK_GAS), `fast` by 8. Prints a table per match and the totals per flag setting:
// puzzle sites attempted / solved by skill tier, rooms behind them looted, hand doors opened and closed, closes behind,
// door alerts, air drops opened and their crates broken, stuck events per bot-minute, gas deaths, bot tick p99.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import {
    type FlagSetting,
    type InteractionResult,
    type InteractionTask,
    runInteractionMatch,
    TIERS,
    type TierCounts,
    tierCounts,
} from "./interactionsLib.ts";

type Reply = { ok: true; result: InteractionResult } | { ok: false; task: InteractionTask; error: string };

const GAS_DIV: Readonly<Record<string, number>> = { quick: 4, fast: 8, normal: 1 };

function parseSeeds(s: string): number[] {
    const out: number[] = [];
    for (const part of s.split(",")) {
        const [a, b] = part.split("-").map(Number);
        if (b === undefined) out.push(a);
        else for (let k = a; k <= b; k++) out.push(k);
    }
    return out;
}

const tierText = (c: TierCounts) => TIERS.map((t) => c[t]).join("/");
const sumTiers = (a: TierCounts, b: TierCounts) => {
    for (const t of TIERS) a[t] += b[t];
};

interface Totals {
    matches: number;
    over: number;
    exceptions: number;
    bots: TierCounts;
    attempted: TierCounts;
    solved: TierCounts;
    openedElse: number;
    roomsLooted: number;
    roomContainersBroken: number;
    doorsOpened: number;
    doorsClosed: number;
    closedBehind: number;
    doorAlerts: number;
    doorAlertsHeard: number;
    airdropsSeen: number;
    airdropsOpened: number;
    airdropCratesBroken: number;
    stuckEvents: number;
    aliveSeconds: number;
    deaths: number;
    gasDeaths: number;
    p99: number[];
    gameSeconds: number;
    sites: Record<string, { attempted: number; solved: number; opened: number; looted: number }>;
}

function totals(): Totals {
    return {
        matches: 0,
        over: 0,
        exceptions: 0,
        bots: tierCounts(),
        attempted: tierCounts(),
        solved: tierCounts(),
        openedElse: 0,
        roomsLooted: 0,
        roomContainersBroken: 0,
        doorsOpened: 0,
        doorsClosed: 0,
        closedBehind: 0,
        doorAlerts: 0,
        doorAlertsHeard: 0,
        airdropsSeen: 0,
        airdropsOpened: 0,
        airdropCratesBroken: 0,
        stuckEvents: 0,
        aliveSeconds: 0,
        deaths: 0,
        gasDeaths: 0,
        p99: [],
        gameSeconds: 0,
        sites: {},
    };
}

function add(t: Totals, r: InteractionResult): void {
    t.matches++;
    if (r.over) t.over++;
    t.exceptions += r.exceptions;
    sumTiers(t.bots, r.bots);
    sumTiers(t.attempted, r.attempted);
    sumTiers(t.solved, r.solved);
    for (const k of [
        "openedElse",
        "roomsLooted",
        "roomContainersBroken",
        "doorsOpened",
        "doorsClosed",
        "closedBehind",
        "doorAlerts",
        "doorAlertsHeard",
        "airdropsSeen",
        "airdropsOpened",
        "airdropCratesBroken",
        "stuckEvents",
        "aliveSeconds",
        "deaths",
        "gasDeaths",
        "gameSeconds",
    ] as const)
        t[k] += r[k];
    t.p99.push(r.botTickP99);
    for (const [name, c] of Object.entries(r.sites)) {
        const s = (t.sites[name] ??= { attempted: 0, solved: 0, opened: 0, looted: 0 });
        s.attempted += c.attempted;
        s.solved += c.solved;
        s.opened += c.opened;
        s.looted += c.looted;
    }
}

/** Stuck events per bot-minute alive. */
const stuckRate = (stuck: number, alive: number) => ((60 * stuck) / Math.max(1, alive)).toFixed(3);

const HEADER =
    "flags seed  game s  over | attempted b/i/e  solved b/i/e  else | rooms looted (boxes) | doors open/close  " +
    "closed behind  alerts (heard) | drops seen/opened/crates | stuck/bot-min  gas deaths/deaths | bot tick p99 ms";

function row(r: InteractionResult): string {
    return [
        `${r.task.flags.padEnd(5)} ${String(r.task.seed).padStart(4)} ${r.gameSeconds.toFixed(0).padStart(7)}  ${r.over ? "yes " : "NO  "}`,
        `${tierText(r.attempted).padStart(15)}  ${tierText(r.solved).padStart(12)}  ${String(r.openedElse).padStart(4)}`,
        `${String(r.roomsLooted).padStart(12)} (${r.roomContainersBroken})`.padEnd(20),
        `${`${r.doorsOpened}/${r.doorsClosed}`.padStart(16)}  ${String(r.closedBehind).padStart(13)}  ${`${r.doorAlerts} (${r.doorAlertsHeard})`.padStart(14)}`,
        `${`${r.airdropsSeen}/${r.airdropsOpened}/${r.airdropCratesBroken}`.padStart(24)}`,
        `${stuckRate(r.stuckEvents, r.aliveSeconds).padStart(13)}  ${`${r.gasDeaths}/${r.deaths}`.padStart(17)}`,
        `${r.botTickP99.toFixed(3).padStart(15)}`,
    ].join(" | ");
}

function summary(flags: FlagSetting, t: Totals): string[] {
    const m = Math.max(1, t.matches);
    const per = (x: number) => (x / m).toFixed(2);
    const p99 = [...t.p99].sort((a, b) => a - b);
    const lines = [
        `flags ${flags}: ${t.matches} matches (${t.over} decided), ${t.exceptions} bot exceptions, ` +
            `bots by tier b/i/e ${tierText(t.bots)}, mean game length ${(t.gameSeconds / m).toFixed(0)} s`,
        `  puzzle sites attempted per match b/i/e ${TIERS.map((k) => per(t.attempted[k])).join("/")} ` +
            `(total ${tierText(t.attempted)}), solved ${TIERS.map((k) => per(t.solved[k])).join("/")} ` +
            `(total ${tierText(t.solved)}); opened with nobody working them ${per(t.openedElse)}`,
        `  rooms and vaults looted per match ${per(t.roomsLooted)} (containers broken in them ${per(t.roomContainersBroken)})`,
        `  hand doors opened ${per(t.doorsOpened)}, closed ${per(t.doorsClosed)}, closed behind ${per(t.closedBehind)}, ` +
            `door alerts ${per(t.doorAlerts)} (heard ${per(t.doorAlertsHeard)}) per match`,
        `  air drops per match: seen ${per(t.airdropsSeen)}, opened ${per(t.airdropsOpened)}, ` +
            `inner crate broken ${per(t.airdropCratesBroken)}`,
        `  stuck ${stuckRate(t.stuckEvents, t.aliveSeconds)} per bot-minute (${per(t.stuckEvents)} per match), ` +
            `gas deaths ${per(t.gasDeaths)} of ${per(t.deaths)} deaths per match, ` +
            `bot tick p99 median ${(p99[Math.floor(p99.length / 2)] ?? 0).toFixed(3)} ms (max ${(p99[p99.length - 1] ?? 0).toFixed(3)})`,
    ];
    const sites = Object.entries(t.sites).filter(([, s]) => s.attempted + s.opened > 0);
    if (sites.length) {
        lines.push(
            `  by site (attempts / solved / opened / looted): ${sites
                .map(([name, s]) => `${name} ${s.attempted}/${s.solved}/${s.opened}/${s.looted}`)
                .join(", ")}`,
        );
    }
    return lines;
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            seeds: { type: "string", default: "1-4" },
            bots: { type: "string", default: "60" },
            map: { type: "string", default: "main" },
            gas: { type: "string", default: "quick" },
            workers: { type: "string", default: "3" },
            "max-ticks": { type: "string", default: "60000" },
            json: { type: "string" },
        },
    });
    const gasDiv = GAS_DIV[values.gas];
    if (!gasDiv) throw new Error(`--gas must be quick, fast or normal (got ${values.gas})`);
    const tasks: InteractionTask[] = [];
    for (const seed of parseSeeds(values.seeds))
        for (const flags of ["on", "off"] as const)
            tasks.push({
                seed,
                flags,
                bots: Number(values.bots),
                map: values.map,
                gasDiv,
                maxTicks: Number(values["max-ticks"]),
            });
    const results: InteractionResult[] = [];
    let failed = 0;
    let next = 0;
    const started = performance.now();
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
                        const s = ((performance.now() - started) / 1000).toFixed(0);
                        console.error(`match done: seed ${r.result.task.seed} flags ${r.result.task.flags} (${s} s)`);
                    } else {
                        failed++;
                        console.error(`seed ${r.task.seed} flags ${r.task.flags} failed: ${r.error}`);
                    }
                    feed();
                });
                feed();
            });
        }),
    );
    results.sort((a, b) => a.task.seed - b.task.seed || a.task.flags.localeCompare(b.task.flags));
    const wall = ((performance.now() - started) / 1000).toFixed(0);
    console.log(
        `bot interactions: ${values.map}, ${values.bots} bots, seeds ${values.seeds}, gas ${values.gas}, ` +
            `population skill mix and personas, ${results.length} matches in ${wall} s on ${n} workers`,
    );
    console.log(HEADER);
    for (const r of results) console.log(row(r));
    console.log("");
    for (const flags of ["on", "off"] as const) {
        const t = totals();
        for (const r of results) if (r.task.flags === flags) add(t, r);
        for (const line of summary(flags, t)) console.log(line);
    }
    for (const r of results)
        for (const e of r.errors.slice(0, 2)) console.log(`seed ${r.task.seed} ${r.task.flags}: ${e}`);
    if (values.json) writeFileSync(values.json, JSON.stringify(results, null, 1));
    if (failed > 0 || results.some((r) => r.exceptions > 0)) process.exitCode = 2;
}

if (!isMainThread) {
    parentPort?.on("message", (task: InteractionTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runInteractionMatch(task, () => performance.now()) });
        } catch (err) {
            const error = err instanceof Error ? (err.stack ?? err.message) : String(err);
            parentPort?.postMessage({ ok: false, task, error } satisfies Reply);
        }
    });
} else {
    await main();
}
