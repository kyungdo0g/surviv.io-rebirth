// Headless match runner: a full Game with N in-process bots stepped at maximum speed until game over.
//   node packages/bots/scripts/match.ts [--bots 80] [--mode solo|duo|squad|faction] [--map main] [--seed 1]
//        [--difficulty mixed|population|easy|normal|hard] [--personas] [--gas normal|fast] [--max-ticks 60000] [--json]
//        [--metrics]
// Prints the match duration (game seconds and wall time), the winner, the kills distribution, causes of death,
// average survival time, bot exceptions (must be 0), tick time percentiles (bots + simulation), idle episodes (idle.ts)
// and the roles handed out (Cobalt classes, The Hunted, Woods King, faction roles). `--mode faction` (M7a) runs 50v50
// on the faction map (100 bots unless --bots is given) and also prints the factions' living counts and team kills
// (must be 0); a faction map (`--map faction_potato`, M7b) always plays 50v50. `--difficulty population` draws the
// server's skill-tier mix (35/45/20 beginner/intermediate/expert) and `--personas` the persona mix; the report then
// also groups bots by tier and persona. `--metrics` collects the bot overhaul's match metrics (metrics/collector.ts)
// and prints the acceptance thresholds and their breakdown for this one match (scripts/population.ts runs many).
import { parseArgs } from "node:util";
import { GameConfig, MapDefs } from "@rebirth/defs";
import { type Difficulty, isDifficulty } from "../src/difficulty.ts";
import { formatCell } from "../src/metrics/format.ts";
import { sampleOf, summarizeCell } from "../src/metrics/summary.ts";
import { evaluateCell } from "../src/metrics/thresholds.ts";
import { runMatch } from "../src/runner.ts";

const { values } = parseArgs({
    options: {
        bots: { type: "string" },
        mode: { type: "string", default: "solo" },
        map: { type: "string", default: "main" },
        seed: { type: "string", default: "1" },
        difficulty: { type: "string", default: "mixed" },
        personas: { type: "boolean", default: false },
        gas: { type: "string", default: "normal" },
        "max-ticks": { type: "string", default: "60000" },
        json: { type: "boolean", default: false },
        metrics: { type: "boolean", default: false },
    },
});

const MODES: Readonly<Record<string, 1 | 2 | 4>> = { solo: 1, duo: 2, squad: 4, faction: 4 };
if (!Object.hasOwn(MapDefs, values.map)) throw new Error(`unknown map ${values.map}`);
// a faction map (faction, faction_potato) always plays 50v50 (M7b)
const faction = values.mode === "faction" || !!MapDefs[values.map].gameMode.factionMode;
const teamMode = faction ? 4 : MODES[values.mode];
if (!teamMode) throw new Error(`--mode must be solo, duo, squad or faction (got ${values.mode})`);
const mapName = faction && !MapDefs[values.map].gameMode.factionMode ? "faction" : values.map;
const difficulty = values.difficulty;
if (difficulty !== "mixed" && difficulty !== "population" && !isDifficulty(difficulty))
    throw new Error(`unknown difficulty ${difficulty}`);
const gasStages =
    values.gas === "fast"
        ? GameConfig.gas.stages.map((st, i) => (i === 0 ? st : { ...st, duration: Math.max(1, st.duration / 8) }))
        : undefined;

const report = runMatch({
    bots: Number(values.bots ?? (faction ? 100 : 80)),
    faction,
    mapName,
    seed: Number(values.seed),
    teamMode,
    difficulty: difficulty as Difficulty | "mixed" | "population",
    population: { personas: values.personas },
    gasStages,
    maxTicks: Number(values["max-ticks"]),
    metrics: values.metrics,
    clock: () => performance.now(),
});

if (values.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.exceptions === 0 ? 0 : 1);
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const winners = report.players.filter((p) => report.winners.includes(p.id));
const byDifficulty = new Map<string, { n: number; kills: number; alive: number }>();
const groupOf = (p: (typeof report.players)[number]) =>
    difficulty === "population" ? p.tier : values.personas ? `${p.difficulty}/${p.persona}` : p.difficulty;
for (const p of report.players) {
    for (const key of values.personas && difficulty === "population" ? [p.tier, p.persona] : [groupOf(p)]) {
        const e = byDifficulty.get(key) ?? { n: 0, kills: 0, alive: 0 };
        e.n++;
        e.kills += p.kills;
        e.alive += p.timeAlive;
        byDifficulty.set(key, e);
    }
}
const dead = report.players.filter((p) => p.dead).length;
console.log(
    `match: ${report.players.length} bots, ${faction ? "faction" : values.mode}, map ${mapName}, seed ${values.seed}, gas ${values.gas}`,
);
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
    console.log(`  ${d.padEnd(12)} ${e.n} bots, avg kills ${r2(e.kills / e.n)}, avg survival ${r2(e.alive / e.n)} s`);
}
console.log(`exceptions: ${report.exceptions}`);
for (const e of report.errors) console.log(e);
console.log(
    `tick ms (bots + sim): p50 ${r2(report.tickMs.p50)}, p99 ${r2(report.tickMs.p99)}, max ${r2(report.tickMs.max)}, mean ${r2(report.tickMs.mean)}`,
);
console.log(`stuck events: ${report.stuckEvents}, grenades thrown: ${report.throws}`);
const idleSeconds = report.idle.reduce((a, e) => a + e.duration, 0);
const idleBy = new Map<string, number>();
for (const e of report.idle) idleBy.set(e.behaviour, (idleBy.get(e.behaviour) ?? 0) + 1);
console.log(
    `idle episodes (moved < 1 unit in 5 s, not on purpose): ${report.idle.length}, ${r2(idleSeconds)} bot-s, ` +
        `${report.idle.filter((e) => e.duration >= 15).length} of 15 s or more; by behaviour: ${
            [...idleBy.entries()].map(([b, n]) => `${b} ${n}`).join(", ") || "none"
        }`,
);
const roles = Object.entries(report.roles)
    .map(([r, n]) => `${r} ${n}`)
    .join(", ");
console.log(`roles assigned: ${roles || "none"}`);
if (report.metrics) {
    const mode = faction ? "faction" : (values.mode as "solo" | "duo" | "squad");
    const summary = summarizeCell(`${difficulty}/match`, [
        sampleOf(report, `${difficulty}/match`, mode, Number(values.seed)),
    ]);
    console.log(`\n${formatCell(summary, evaluateCell(summary))}`);
}
if (report.teamAliveCounts) {
    console.log(
        `factions alive (red, blue): ${report.teamAliveCounts.join(", ")}; winning team ${report.winningTeamId}; ` +
            `team kills: ${report.teamKills ?? 0}`,
    );
}
process.exit(report.exceptions === 0 ? 0 : 1);
