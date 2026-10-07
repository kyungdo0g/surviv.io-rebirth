// Skill-tier calibration of the aim bench (scripts/aimbench.ts --skill; bot overhaul POPULATION-6): the tier grid
// (TIER_GUNS x 10/20/35 u, 4x scope at 35 u, standing and ADAD-strafing targets, inside the human 16:9 screen), the
// per-shooter summary (pooled hit rate, time to the first shot from on-screen exposure, kill within the 8 s trial),
// the target bands every tier must land in, and the monotonicity checks between tiers. The recorded result is
// test/fixtures/aim-tiers.json, which test/aimbench.test.ts checks against the same bands.
import type { Difficulty } from "../src/difficulty.ts";
import { SKILL_TIERS } from "../src/skill.ts";
import { type BenchCell, type CellGrid, shooterLabel, TIER_GUNS, type TrialResult } from "./aimbenchLib.ts";

/** The calibration grid for some shooters. */
export function tierGrid(shooters: CellGrid["shooters"], guns: readonly string[] = TIER_GUNS): CellGrid {
    return { shooters, guns, patterns: ["stationary", "strafe"], scopes: "auto", view: "screen" };
}

/** Shooters of a calibration run: each tier's representative skill (its benchS) and, optionally, the presets. */
export function tierShooters(presets: readonly Difficulty[] = []): CellGrid["shooters"] {
    return [
        ...presets.map((difficulty) => ({ difficulty })),
        { difficulty: "easy" as const, skill: SKILL_TIERS.beginner.benchS },
        { difficulty: "normal" as const, skill: SKILL_TIERS.intermediate.benchS },
        { difficulty: "hard" as const, skill: SKILL_TIERS.expert.benchS },
    ];
}

export interface Band {
    hit: readonly [number, number];
    firstShot: readonly [number, number];
    kill: readonly [number, number];
}

/**
 * Target bands of each tier's representative bot on the calibration grid (pooled over the grid). The user lost to an
 * OT-38 bot (report 9) and wants real misses at beginner and intermediate: a beginner lands clearly below today's easy
 * preset (on this grid easy hits 0.328 and kills 0.64 of its targets), an intermediate a little above easy and well below
 * normal (0.447 / 0.875), an expert near normal and hard (0.447 / 0.881) with slower reactions than hard. Recalibrate in wave 2 once COMBAT-1/3/4
 * remove the off-screen head start and add the exposure reaction.
 */
export const TIER_BANDS: Readonly<Record<"beginner" | "intermediate" | "expert", Band>> = {
    beginner: { hit: [0.22, 0.28], firstShot: [1.05, 1.45], kill: [0.38, 0.52] },
    intermediate: { hit: [0.31, 0.36], firstShot: [0.66, 0.86], kill: [0.65, 0.77] },
    expert: { hit: [0.39, 0.45], firstShot: [0.42, 0.62], kill: [0.82, 0.92] },
};

/** Monotonicity tolerances: per (pattern, distance) group hit rate, and per gun kill rate (design 4.3). */
export const MONO_HIT_TOL = 0.02;
/** strafe at 35 u: bullet flight is longer than an ADAD reversal, every tier sits near the floor */
export const MONO_HIT_TOL_FAR_STRAFE = 0.04;
export const MONO_KILL_TOL = 0.05;

export interface ShooterSummary {
    label: string;
    /** pooled bullet hit rate, mean and median seconds to the first shot, kill-within-trial rate */
    hit: number;
    firstShot: number;
    firstShotMedian: number;
    kill: number;
    trials: number;
    /** "pattern/distance" -> mean hit rate over the guns (equal weight) */
    groups: Record<string, number>;
    /** gun -> kill rate and hit rate over its cells */
    guns: Record<string, { kill: number; hit: number }>;
    /** OT-38 cells (the user's case): "pattern/distance" -> hit rate and kill rate */
    ot38: Record<string, { hit: number; kill: number }>;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function median(xs: readonly number[]): number {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Summaries per shooter label of a finished run (cells[i] produced results[i]). */
export function summarizeTiers(cells: readonly BenchCell[], results: readonly TrialResult[]): ShooterSummary[] {
    const byLabel = new Map<string, Array<{ cell: BenchCell; r: TrialResult }>>();
    cells.forEach((cell, i) => {
        const label = shooterLabel(cell);
        let list = byLabel.get(label);
        if (!list) byLabel.set(label, (list = []));
        list.push({ cell, r: results[i] });
    });
    const out: ShooterSummary[] = [];
    for (const [label, list] of byLabel) {
        const seen = list.filter((x) => x.r.seen);
        const bullets = seen.reduce((a, x) => a + x.r.bullets, 0);
        const hits = seen.reduce((a, x) => a + x.r.hits, 0);
        const shots = seen.flatMap((x) => (x.r.firstShot === null ? [] : [x.r.firstShot]));
        const kills = seen.filter((x) => x.r.ttk !== null).length;
        const cellHit = new Map<string, { b: number; h: number; k: number; n: number; gun: string; group: string }>();
        for (const x of seen) {
            const key = `${x.cell.gun}/${x.cell.pattern}/${x.cell.distance}`;
            const c = cellHit.get(key) ?? {
                b: 0,
                h: 0,
                k: 0,
                n: 0,
                gun: x.cell.gun,
                group: `${x.cell.pattern}/${x.cell.distance}`,
            };
            c.b += x.r.bullets;
            c.h += x.r.hits;
            c.k += x.r.ttk !== null ? 1 : 0;
            c.n++;
            cellHit.set(key, c);
        }
        const groups: Record<string, number> = {};
        const gunAcc = new Map<string, { kill: number[]; hit: number[] }>();
        const groupAcc = new Map<string, number[]>();
        const ot38: Record<string, { hit: number; kill: number }> = {};
        for (const c of cellHit.values()) {
            const hit = c.b ? c.h / c.b : 0;
            const kill = c.n ? c.k / c.n : 0;
            const g = groupAcc.get(c.group) ?? [];
            g.push(hit);
            groupAcc.set(c.group, g);
            const a = gunAcc.get(c.gun) ?? { kill: [], hit: [] };
            a.kill.push(kill);
            a.hit.push(hit);
            gunAcc.set(c.gun, a);
            if (c.gun === "ot38") ot38[c.group] = { hit: r3(hit), kill: r3(kill) };
        }
        for (const [k, v] of groupAcc) groups[k] = r3(mean(v));
        const guns: Record<string, { kill: number; hit: number }> = {};
        for (const [k, v] of gunAcc) guns[k] = { kill: r3(mean(v.kill)), hit: r3(mean(v.hit)) };
        out.push({
            label,
            hit: r3(bullets ? hits / bullets : 0),
            firstShot: r3(mean(shots)),
            firstShotMedian: r3(median(shots)),
            kill: r3(seen.length ? kills / seen.length : 0),
            trials: seen.length,
            groups,
            guns,
            ot38,
        });
    }
    return out;
}

/** Tier of a summary label ("s0.15" -> the tier whose benchS it is), undefined for presets. */
export function tierOfLabel(label: string): keyof typeof TIER_BANDS | undefined {
    for (const [tier, def] of Object.entries(SKILL_TIERS))
        if (label === `s${def.benchS}`) return tier as keyof typeof TIER_BANDS;
    return undefined;
}

/** Every failed gate (bands and monotonicity) of the tier summaries; empty when the calibration holds. */
export function tierGateFailures(summaries: readonly ShooterSummary[]): string[] {
    const fails: string[] = [];
    const ordered: ShooterSummary[] = [];
    for (const tier of ["beginner", "intermediate", "expert"] as const) {
        const s = summaries.find((x) => tierOfLabel(x.label) === tier);
        if (!s) continue;
        ordered.push(s);
        const band = TIER_BANDS[tier];
        const check = (name: string, v: number, [lo, hi]: readonly [number, number]) => {
            if (v < lo || v > hi) fails.push(`${tier} ${name} ${v} outside [${lo}, ${hi}]`);
        };
        check("hit", s.hit, band.hit);
        check("firstShot", s.firstShot, band.firstShot);
        check("kill", s.kill, band.kill);
    }
    for (let i = 1; i < ordered.length; i++) {
        const lo = ordered[i - 1];
        const hi = ordered[i];
        for (const [group, v] of Object.entries(lo.groups)) {
            const tol = group === "strafe/35" ? MONO_HIT_TOL_FAR_STRAFE : MONO_HIT_TOL;
            if ((hi.groups[group] ?? 0) < v - tol)
                fails.push(`hit ${group}: ${hi.label} ${hi.groups[group]} < ${lo.label} ${v}`);
        }
        for (const [gun, v] of Object.entries(lo.guns))
            if ((hi.guns[gun]?.kill ?? 0) < v.kill - MONO_KILL_TOL)
                fails.push(`kill ${gun}: ${hi.label} ${hi.guns[gun]?.kill} < ${lo.label} ${v.kill}`);
    }
    return fails;
}

/** Console table of the summaries. */
export function printTiers(summaries: readonly ShooterSummary[]): void {
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log(
        `\n${pad("shooter", 9)}${pad("hit", 8)}${pad("1st shot", 10)}${pad("median", 9)}${pad("kill<=8s", 10)}trials`,
    );
    for (const s of summaries)
        console.log(
            `${pad(s.label, 9)}${pad(s.hit.toFixed(3), 8)}${pad(s.firstShot.toFixed(3), 10)}` +
                `${pad(s.firstShotMedian.toFixed(3), 9)}${pad(s.kill.toFixed(3), 10)}${s.trials}`,
        );
    const groups = Object.keys(summaries[0]?.groups ?? {}).sort();
    console.log(
        `\nmean hit by pattern/distance (equal gun weight)\n${pad("", 16)}${summaries.map((s) => pad(s.label, 9)).join("")}`,
    );
    for (const g of groups)
        console.log(`${pad(g, 16)}${summaries.map((s) => pad((s.groups[g] ?? 0).toFixed(3), 9)).join("")}`);
    const guns = Object.keys(summaries[0]?.guns ?? {});
    console.log(`\nkill / hit by gun\n${pad("", 8)}${summaries.map((s) => pad(s.label, 13)).join("")}`);
    for (const g of guns)
        console.log(
            `${pad(g, 8)}${summaries.map((s) => pad(`${s.guns[g]?.kill.toFixed(2)}/${s.guns[g]?.hit.toFixed(2)}`, 13)).join("")}`,
        );
    const ot = Object.keys(summaries[0]?.ot38 ?? {}).sort();
    if (ot.length) {
        console.log(`\nOT-38 (hit | kill)\n${pad("", 16)}${summaries.map((s) => pad(s.label, 13)).join("")}`);
        for (const g of ot)
            console.log(
                `${pad(g, 16)}${summaries.map((s) => pad(`${s.ot38[g]?.hit.toFixed(2)} | ${s.ot38[g]?.kill.toFixed(2)}`, 13)).join("")}`,
            );
    }
}

/** The recorded calibration (test/fixtures/aim-tiers.json). */
export interface AimTiers {
    version: 1;
    command: string;
    seed: number;
    trialsPerCell: number;
    summaries: ShooterSummary[];
}
