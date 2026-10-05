// Headless match runner: a full Game with N in-process bots stepped at maximum speed until game over.
//   node packages/bots/scripts/match.ts [--bots 80] [--mode solo|duo|squad] [--map main] [--seed 1]
//        [--difficulty mixed|easy|normal|hard] [--gas normal|fast] [--max-ticks 60000] [--json]
// Prints the match duration (game seconds and wall time), the winner, the kills distribution, causes of death,
// average survival time, bot exceptions (must be 0) and tick time percentiles (bots + simulation).
import { parseArgs } from "node:util";
import { GameConfig, MapDefs } from "@rebirth/defs";
import { type Difficulty, isDifficulty } from "../src/difficulty.ts";
import { runMatch } from "../src/runner.ts";

const { values } = parseArgs({
    options: {
        bots: { type: "string", default: "80" },
        mode: { type: "string", default: "solo" },
        map: { type: "string", default: "main" },
        seed: { type: "string", default: "1" },
        difficulty: { type: "string", default: "mixed" },
        gas: { type: "string", default: "normal" },
        "max-ticks": { type: "string", default: "60000" },
        json: { type: "boolean", default: false },
    },
});

const MODES: Readonly<Record<string, 1 | 2 | 4>> = { solo: 1, duo: 2, squad: 4 };
const teamMode = MODES[values.mode];
if (!teamMode) throw new Error(`--mode must be solo, duo or squad (got ${values.mode})`);
if (!Object.hasOwn(MapDefs, values.map)) throw new Error(`unknown map ${values.map}`);
const difficulty = values.difficulty === "mixed" ? "mixed" : values.difficulty;
if (difficulty !== "mixed" && !isDifficulty(difficulty)) throw new Error(`unknown difficulty ${difficulty}`);
const gasStages =
    values.gas === "fast"
        ? GameConfig.gas.stages.map((st, i) => (i === 0 ? st : { ...st, duration: Math.max(1, st.duration / 8) }))
        : undefined;

const report = runMatch({
    bots: Number(values.bots),
    mapName: values.map,
    seed: Number(values.seed),
    teamMode,
    difficulty: difficulty as Difficulty | "mixed",
    gasStages,
    maxTicks: Number(values["max-ticks"]),
    clock: () => performance.now(),
});

if (values.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.exceptions === 0 ? 0 : 1);
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const winners = report.players.filter((p) => report.winners.includes(p.id));
const byDifficulty = new Map<string, { n: number; kills: number; alive: number }>();
for (const p of report.players) {
    const e = byDifficulty.get(p.difficulty) ?? { n: 0, kills: 0, alive: 0 };
    e.n++;
    e.kills += p.kills;
    e.alive += p.timeAlive;
    byDifficulty.set(p.difficulty, e);
}
const dead = report.players.filter((p) => p.dead).length;
console.log(`match: ${report.players.length} bots, ${values.mode}, map ${values.map}, seed ${values.seed}, gas ${values.gas}`);
console.log(`duration: ${r2(report.gameSeconds)} game s (${report.ticks} ticks), wall ${r2(report.wallMs / 1000)} s`);
console.log(
    `result: ${report.over ? "game over" : "NOT OVER (tick budget)"}, winner${winners.length === 1 ? "" : "s"}: ${
        winners.map((w) => `${w.name} (${w.difficulty}, ${w.kills} kills)`).join(", ") || "none"
    }`,
);
const dist = Object.entries(report.killsDistribution)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, n]) => `${k}:${n}`)
    .join(" ");
console.log(`kills distribution (kills:bots): ${dist}`);
const causes = Object.entries(report.causes)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([c, n]) => `${c} ${n} (${Math.round(((n ?? 0) / Math.max(1, dead)) * 100)}%)`)
    .join(", ");
console.log(`causes of death: ${causes}`);
console.log(`average survival: ${r2(report.avgSurvival)} s`);
for (const [d, e] of [...byDifficulty.entries()].sort()) {
    console.log(`  ${d.padEnd(6)} ${e.n} bots, avg kills ${r2(e.kills / e.n)}, avg survival ${r2(e.alive / e.n)} s`);
}
console.log(`exceptions: ${report.exceptions}`);
for (const e of report.errors) console.log(e);
console.log(
    `tick ms (bots + sim): p50 ${r2(report.tickMs.p50)}, p99 ${r2(report.tickMs.p99)}, max ${r2(report.tickMs.max)}, mean ${r2(report.tickMs.mean)}`,
);
console.log(`stuck events: ${report.stuckEvents}, grenades thrown: ${report.throws}`);
process.exit(report.exceptions === 0 ? 0 : 1);
