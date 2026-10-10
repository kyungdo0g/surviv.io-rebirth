// Early deaths in population matches (owner, 2026-10-08: "they die en masse from the very start"), on worker threads:
//   node packages/bots/scripts/earlyDeaths.ts [--bots 80,200] [--seeds 1-3] [--workers 2] [--seconds 900]
//        [--off fistRush,crateFirst] [--out table.md] [--json raw.json] [--from raw.json (re-render only)]
// Every (bots, seed) pair plays one classic solo match on the main map with the server's skill tiers and personas and
// the normal gas (scripts/earlyDeathsLib.ts). Prints, per player count: the alive curve (every 15 s for 6 minutes, then
// at every gas stage), deaths by cause and time window, who killed whom with fists or melee (armed or not), gun kills
// of unarmed players (rushing or not), fist rush and fist duel episodes and how they ended, the spawn density, the
// unarmed bots' behaviours in the first 2 minutes, and the clustered deaths (scripts/earlyDeathsBursts.ts). `--off`
// turns smart features off for every bot (ablations).
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { isBrainFeature } from "../src/brain/features.ts";
import { burstReport } from "./earlyDeathsBursts.ts";
import type { DeathRow, EarlyDeathTask, Episode, MatchResult } from "./earlyDeathsLib.ts";

type Reply = { ok: true; result: MatchResult } | { ok: false; error: string };

function parseList(s: string): number[] {
    const out: number[] = [];
    for (const part of s.split(",")) {
        const [a, b] = part.split("-").map(Number);
        if (b === undefined) out.push(a);
        else for (let k = a; k <= b; k++) out.push(k);
    }
    return out;
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : "-");
const mean = (a: readonly number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a: readonly number[]) => {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
};

const WINDOWS: Array<[number, number, string]> = [
    [0, 60, "0-60 s"],
    [60, 120, "60-120 s"],
    [120, 200, "120-200 s"],
    [200, 360, "200-360 s"],
    [360, 1e9, "360 s+"],
];
const CAUSES = [
    "fists",
    "melee",
    "gun:pistol",
    "gun:smg",
    "gun:shotgun",
    "gun:assault",
    "gun:dmr",
    "gun:sniper",
    "gun:lmg",
    "gun:launcher",
    "gun:special",
    "explosion",
    "gas",
    "bleed",
    "airdrop",
    "airstrike",
    "other",
];
/** The gas stage starts of the normal gas (GameConfig.gas.stages: 80 s wait, 30 s move, 65 / 25, 50 / 20, ...). */
const STAGE_NAME = (stage: number) => (stage % 2 === 1 ? `gas ${(stage + 1) / 2} waits` : `gas ${stage / 2} moves`);

function aliveAt(r: MatchResult, t: number): number {
    let last = r.bots;
    for (const [s, n] of r.alive) {
        if (s > t) break;
        last = n;
    }
    // a match over before t: the winner alone (NaN: the run stopped before t)
    if (r.gameSeconds < t) return r.over ? 1 : Number.NaN;
    return last;
}

function meleeKind(d: DeathRow): string {
    if (d.killerArmed === null) return "self/env";
    if (!d.killerArmed && !d.victimArmed) return "unarmed kills unarmed";
    if (!d.killerArmed && d.victimArmed) return d.killerRushing ? "fist rusher kills armed" : "unarmed kills armed";
    if (d.killerArmed && !d.victimArmed) return "armed (melee) kills unarmed";
    return "armed (melee) kills armed";
}

function episodeTable(eps: readonly Episode[], label: string): string[] {
    const out: string[] = [];
    const n = eps.length;
    const by = (o: string) => eps.filter((e) => e.outcome === o).length;
    const reached = eps.filter((e) => e.reached).length;
    const dur = mean(eps.map((e) => e.end - e.start));
    out.push(
        `| ${label} | ${n} | ${pct(reached, n)} | ${pct(by("targetDied"), n)} | ${pct(by("rusherDied"), n)} | ${pct(by("otherDied"), n)} | ${pct(by("armed"), n)} | ${pct(by("brokeOff") + by("open"), n)} | ${dur.toFixed(1)} |`,
    );
    return out;
}

export function report(results: readonly MatchResult[], title: string): string {
    const lines: string[] = [`# ${title}`, ""];
    const counts = [...new Set(results.map((r) => r.bots))].sort((a, b) => a - b);
    for (const n of counts) {
        const rs = results.filter((r) => r.bots === n);
        lines.push(`## ${n} players (${rs.length} seeds: ${rs.map((r) => r.seed).join(", ")})`, "");
        // alive curve
        lines.push("### Alive over time", "", "| t (s) | mean | min | max | mean % |", "|---|---|---|---|---|");
        for (let t = 0; t <= 360; t += 15) {
            const a = rs.map((r) => aliveAt(r, t)).filter((x) => !Number.isNaN(x));
            if (!a.length) break;
            lines.push(`| ${t} | ${mean(a).toFixed(1)} | ${Math.min(...a)} | ${Math.max(...a)} | ${pct(mean(a), n)} |`);
        }
        lines.push("", "| gas stage | starts at (s) | mean alive | % |", "|---|---|---|---|");
        const stages = new Map<number, { t: number[]; a: number[] }>();
        for (const r of rs)
            for (const [t, st, a] of r.stages) {
                if (st < 1) continue;
                const e = stages.get(st) ?? { t: [], a: [] };
                e.t.push(t);
                e.a.push(a);
                stages.set(st, e);
            }
        for (const [st, e] of [...stages].sort((x, y) => x[0] - y[0])) {
            if (st > 12) break;
            lines.push(
                `| ${STAGE_NAME(st)} | ${mean(e.t).toFixed(0)} | ${mean(e.a).toFixed(1)} | ${pct(mean(e.a), n)} |`,
            );
        }
        lines.push(
            "",
            `Match length ${rs.map((r) => r.gameSeconds.toFixed(0)).join(" / ")} s; alive at 80 s (first gas moves) ${pct(mean(rs.map((r) => aliveAt(r, 80))), n)}, at 200 s (second gas closed) ${pct(mean(rs.map((r) => aliveAt(r, 200))), n)}.`,
            "",
        );
        lines.push(...burstReport(rs));
        // causes by window
        const deaths = rs.flatMap((r) => r.deaths);
        const used = CAUSES.filter((c) => deaths.some((d) => d.cause === c));
        lines.push("### Deaths by cause and time (all seeds)", "");
        lines.push(`| window | all | ${used.join(" | ")} |`, `|---|---|${used.map(() => "---|").join("")}`);
        for (const [a, b, label] of WINDOWS) {
            const w = deaths.filter((d) => d.t >= a && d.t < b);
            lines.push(
                `| ${label} | ${w.length} | ${used.map((c) => w.filter((d) => d.cause === c).length).join(" | ")} |`,
            );
        }
        lines.push(
            `| total | ${deaths.length} | ${used.map((c) => deaths.filter((d) => d.cause === c).length).join(" | ")} |`,
            "",
        );
        // melee deaths by armed state
        const melee = deaths.filter((d) => d.cause === "fists" || d.cause === "melee");
        const kinds = [
            "unarmed kills unarmed",
            "fist rusher kills armed",
            "unarmed kills armed",
            "armed (melee) kills unarmed",
            "armed (melee) kills armed",
        ];
        lines.push("### Fist and melee deaths by armed state (killer / victim)", "");
        lines.push(`| window | melee deaths | ${kinds.join(" | ")} |`, `|---|---|${kinds.map(() => "---|").join("")}`);
        for (const [a, b, label] of [...WINDOWS, [0, 1e9, "total"] as [number, number, string]]) {
            const w = melee.filter((d) => d.t >= a && d.t < b);
            lines.push(
                `| ${label} | ${w.length} | ${kinds.map((k) => w.filter((d) => meleeKind(d) === k).length).join(" | ")} |`,
            );
        }
        // gun kills of unarmed victims
        const gunUnarmed = deaths.filter((d) => d.cause.startsWith("gun:") && !d.victimArmed);
        const gunArmed = deaths.filter((d) => d.cause.startsWith("gun:") && d.victimArmed);
        const rushingVictims = gunUnarmed.filter((d) => d.victimRushing).length;
        lines.push(
            "",
            `Gun deaths: ${gunArmed.length} armed victims (gun out ${pct(gunArmed.filter((d) => d.victimGunOut).length, gunArmed.length)}), ${gunUnarmed.length} unarmed victims, of which ${rushingVictims} were fist-rushing the last 3 s (an armed player killing a rusher).`,
            "",
        );
        const early = deaths.filter((d) => d.t < 120);
        const known = early.filter((d) => d.killerStarted !== null);
        lines.push(
            `First 120 s, deaths to a player: the killer hit first ${pct(known.filter((d) => d.killerStarted).length, known.length)}; exchange length median ${median(known.map((d) => d.engageSecs)).toFixed(1)} s; distance at the first hit median ${median(known.map((d) => d.startDist)).toFixed(1)} u; victim behaviour at the killer's first hit ${top(
                known.map((d) => d.victimBehAtStart),
                6,
            )}.`,
            "",
        );
        const ex = rs.flatMap((r) => r.exchanges).filter((e) => e.start < 120);
        const exKinds: Array<[string, (e: (typeof ex)[number]) => boolean]> = [
            ["all", () => true],
            ["armed hits unarmed", (e) => e.byArmed && !e.targetArmed],
            ["armed hits armed", (e) => e.byArmed && e.targetArmed],
            ["unarmed hits armed", (e) => !e.byArmed && e.targetArmed],
            ["unarmed hits unarmed", (e) => !e.byArmed && !e.targetArmed],
        ];
        lines.push(
            "Exchanges of hits started in the first 120 s (per match):",
            "",
            "| exchange | per match | first hitter killed the other | first hitter died | nobody died |",
            "|---|---|---|---|---|",
        );
        for (const [label, f] of exKinds) {
            const e = ex.filter(f);
            const k = (o: string) => pct(e.filter((x) => x.outcome === o).length, e.length);
            lines.push(
                `| ${label} | ${(e.length / rs.length).toFixed(1)} | ${k("starterKilled")} | ${k("starterDied")} | ${k("none")} |`,
            );
        }
        lines.push(
            "",
            `Target behaviour at the first hit: ${top(
                ex.map((e) => e.targetBeh),
                7,
            )}.`,
            "",
        );
        const enc = rs.flatMap((r) => r.encounters ?? []).filter((e) => e.t < 120);
        if (enc.length) {
            lines.push(
                "Encounters in the first 120 s (two standing players first within 15 u; a hit or a kill between them within 10 s), per match:",
                "",
                "| armed of the two | encounters | led to a hit | led to a kill |",
                "|---|---|---|---|",
            );
            for (const k of [0, 1, 2]) {
                const e = enc.filter((x) => x.armed === k);
                lines.push(
                    `| ${k} | ${(e.length / rs.length).toFixed(1)} | ${pct(e.filter((x) => x.hit).length, e.length)} | ${pct(e.filter((x) => x.kill).length, e.length)} |`,
                );
            }
            const sh = rs.reduce((a, r) => ({ b: a.b + (r.shots?.bullets ?? 0), h: a.h + (r.shots?.hits ?? 0) }), {
                b: 0,
                h: 0,
            });
            lines.push("", `Bullets that hit a player in the first 120 s: ${pct(sh.h, sh.b)} of ${sh.b}.`, "");
        }
        const fs = rs.flatMap((r) => r.fightStarts ?? []).filter((f) => f.t < 120);
        if (fs.length) {
            const cls = (f: (typeof fs)[number]) =>
                f.mutual
                    ? "mutual (target already on it)"
                    : f.hurt
                      ? "hit or shot at"
                      : f.dist < 12
                        ? `unprovoked, close (< 12 u), target ${f.targetArmed ? "armed" : "unarmed"}`
                        : `unprovoked, >= 12 u, target ${f.targetArmed ? "armed" : "unarmed"}`;
            lines.push(
                "Fight starts of armed bots in the first 120 s (a new target in the fight behaviour, per match):",
                "",
                "| why | per match | median dist | median fight score | median best loot score |",
                "|---|---|---|---|---|",
            );
            const classes = [...new Set(fs.map(cls))].sort();
            for (const c of classes) {
                const g = fs.filter((f) => cls(f) === c);
                lines.push(
                    `| ${c} | ${(g.length / rs.length).toFixed(1)} | ${median(g.map((f) => f.dist)).toFixed(1)} | ${median(g.map((f) => f.fight)).toFixed(2)} | ${median(g.map((f) => f.loot)).toFixed(2)} |`,
                );
            }
            lines.push(
                "",
                `Fight starts by persona: ${top(
                    fs.map((f) => f.persona),
                    7,
                )}; left behaviour: ${top(
                    fs.map((f) => f.from),
                    6,
                )}.`,
                "",
            );
        }
        lines.push(
            `First 120 s: ${early.length} deaths; victims unarmed ${pct(early.filter((d) => !d.victimArmed).length, early.length)}; victim behaviour ${top(early.map((d) => d.victimBeh))}; killer behaviour ${top(early.map((d) => d.killerBeh))}; victim persona ${top(early.map((d) => d.victimPersona))}; killer persona ${top(early.map((d) => d.killerPersona))}.`,
            "",
        );
        // episodes
        lines.push("### Fist rushes and fist duels", "");
        lines.push(
            "| episodes | n | reached 3 u | target killed by it | it killed by target | someone else died/killed | armed up | broke off | mean s |",
            "|---|---|---|---|---|---|---|---|---|",
        );
        const rushes = rs.flatMap((r) => r.rushes);
        const duels = rs.flatMap((r) => r.duels);
        lines.push(...episodeTable(rushes, "fist rush"));
        for (const g of ["pistol", "smg", "shotgun", "assault", "dmr", "sniper", "lmg"]) {
            const e = rushes.filter((x) => x.gun === g);
            if (e.length >= 5) lines.push(...episodeTable(e, `rush vs ${g}`));
        }
        lines.push(...episodeTable(duels, "fist duel"));
        lines.push(
            "",
            `Rushes per persona: ${top(
                rushes.map((e) => e.persona),
                7,
            )}.`,
            "",
        );
        // density
        const near = (k: string) => rs.flatMap((r) => r.near[k] ?? []);
        lines.push(
            "### Density",
            "",
            `Nearest other player at spawn: median ${median(rs.flatMap((r) => r.spawnNearest)).toFixed(1)} u, mean ${mean(rs.flatMap((r) => r.spawnNearest)).toFixed(1)} u; players within 20 u at 10 s ${mean(near("20@10")).toFixed(2)}, within 40 u ${mean(near("40@10")).toFixed(2)}; at 30 s ${mean(near("20@30")).toFixed(2)} / ${mean(near("40@30")).toFixed(2)}.`,
            "",
        );
        const armedAt = rs.flatMap((r) => r.armedAt ?? []);
        const armedBy = (t: number) => armedAt.filter((a) => a >= 0 && a <= t).length;
        lines.push(
            `Bots that had held a gun by 15 s ${pct(armedBy(15), armedAt.length)}, by 30 s ${pct(armedBy(30), armedAt.length)}, by 60 s ${pct(armedBy(60), armedAt.length)}; median first gun ${median(armedAt.filter((a) => a >= 0)).toFixed(1)} s.`,
            "",
        );
        const beh: Record<string, number> = {};
        for (const r of rs) for (const [k, v] of Object.entries(r.unarmedBeh)) beh[k] = (beh[k] ?? 0) + v;
        const total = Object.values(beh).reduce((a, b) => a + b, 0);
        lines.push(
            `Unarmed bots' time by behaviour, first 120 s: ${Object.entries(beh)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 9)
                .map(([k, v]) => `${k} ${pct(v, total)}`)
                .join(", ")} (${(total / rs.length).toFixed(0)} bot-seconds per match).`,
            "",
        );
    }
    return lines.join("\n");
}

function top(xs: readonly string[], k = 4): string {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x || "-", (m.get(x || "-") ?? 0) + 1);
    return [...m]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([x, c]) => `${x} ${pct(c, xs.length)}`)
        .join(", ");
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            bots: { type: "string", default: "80,200" },
            seeds: { type: "string", default: "1-3" },
            workers: { type: "string", default: "2" },
            seconds: { type: "string", default: "900" },
            off: { type: "string", default: "" },
            out: { type: "string" },
            json: { type: "string" },
            title: { type: "string", default: "Early deaths" },
            from: { type: "string" },
        },
    });
    if (values.from) {
        const md = report(JSON.parse(readFileSync(values.from, "utf8")) as MatchResult[], values.title);
        if (values.out) writeFileSync(values.out, `${md}\n`);
        console.log(md);
        return;
    }
    const off = values.off ? values.off.split(",").map((s) => s.trim()) : [];
    for (const f of off) if (!isBrainFeature(f)) throw new Error(`unknown feature ${f}`);
    const tasks: EarlyDeathTask[] = [];
    for (const bots of parseList(values.bots))
        for (const seed of parseList(values.seeds))
            tasks.push({ seed, bots, seconds: Number(values.seconds), off: off as EarlyDeathTask["off"] });
    // the big matches first: the pool finishes together
    tasks.sort((a, b) => b.bots - a.bots);
    const results: MatchResult[] = [];
    let next = 0;
    const n = Math.max(1, Math.min(Number(values.workers), tasks.length));
    await Promise.all(
        Array.from({ length: n }, () => {
            const w = new Worker(new URL(import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 3072 } });
            return new Promise<void>((resolve, reject) => {
                const feed = () => {
                    if (next >= tasks.length) {
                        void w.terminate();
                        resolve();
                        return;
                    }
                    w.postMessage(tasks[next++]);
                };
                w.on("message", (r: Reply) => {
                    if (!r.ok) {
                        reject(new Error(r.error));
                        return;
                    }
                    results.push(r.result);
                    // partial results as they come (a long run can be looked at before it ends)
                    if (values.json) writeFileSync(values.json, JSON.stringify(results));
                    console.error(
                        `done: ${r.result.bots} bots seed ${r.result.seed} (${r.result.gameSeconds.toFixed(0)} s)`,
                    );
                    feed();
                });
                w.on("error", reject);
                feed();
            });
        }),
    );
    results.sort((a, b) => a.bots - b.bots || a.seed - b.seed);
    const md = report(results, `${values.title}${off.length ? ` (off: ${off.join(", ")})` : ""}`);
    if (values.out) writeFileSync(values.out, `${md}\n`);
    if (values.json) writeFileSync(values.json, JSON.stringify(results));
    console.log(md);
}

if (isMainThread) {
    void main();
} else {
    const { runEarlyDeathMatch } = await import("./earlyDeathsLib.ts");
    parentPort?.on("message", (task: EarlyDeathTask) => {
        try {
            parentPort?.postMessage({ ok: true, result: runEarlyDeathMatch(task) } satisfies Reply);
        } catch (err) {
            parentPort?.postMessage({
                ok: false,
                error: err instanceof Error ? (err.stack ?? err.message) : String(err),
            });
        }
    });
}
