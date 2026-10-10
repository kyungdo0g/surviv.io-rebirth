// Clustered deaths for scripts/earlyDeaths.ts (owner, 2026-10-08: "many die at once"): a burst is a group of 3 or more
// deaths linked by pairs within BURST_SECONDS and BURST_DIST of each other (single linkage). Each burst gets a kind
// from its causes: an explosion (a barrel or propane chain, a grenade), the gas, an air drop, a fist brawl, one shooter
// killing several, or a gunfight of several shooters. Prints how many deaths fall in bursts against singly, the kinds,
// and the bursts of the first two minutes one by one.
import type { DeathRow, MatchResult } from "./earlyDeathsLib.ts";

export const BURST_SECONDS = 5;
export const BURST_DIST = 40;
const BURST_MIN = 3;
const EARLY = 120;

export interface Burst {
    seed: number;
    deaths: DeathRow[];
    kind: string;
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : "-");

/** The bursts of one match. */
export function burstsOf(r: MatchResult): Burst[] {
    const ds = [...r.deaths].sort((a, b) => a.t - b.t);
    const parent = ds.map((_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    for (let i = 0; i < ds.length; i++) {
        for (let j = i + 1; j < ds.length && ds[j].t - ds[i].t <= BURST_SECONDS; j++) {
            if (Math.hypot(ds[i].x - ds[j].x, ds[i].y - ds[j].y) <= BURST_DIST) parent[find(j)] = find(i);
        }
    }
    const groups = new Map<number, DeathRow[]>();
    ds.forEach((d, i) => {
        const g = groups.get(find(i)) ?? [];
        g.push(d);
        groups.set(find(i), g);
    });
    return [...groups.values()]
        .filter((g) => g.length >= BURST_MIN)
        .map((g) => ({ seed: r.seed, deaths: g, kind: kindOf(g) }));
}

const EXPLOSIVE_OBJECT = /barrel|propane|tank|power|bomb|potato|vat|silo/;

function kindOf(g: readonly DeathRow[]): string {
    const ex = g.filter((d) => d.cause === "explosion");
    if (ex.length) return ex.some((d) => EXPLOSIVE_OBJECT.test(d.src)) ? "explosion: map object" : "explosion: grenade";
    if (g.some((d) => d.cause === "gas")) return "gas";
    if (g.some((d) => d.cause === "airdrop")) return "airdrop crush";
    if (g.some((d) => d.cause === "airstrike")) return "airstrike";
    if (g.every((d) => d.cause === "fists" || d.cause === "melee")) return "fist brawl";
    const killers = new Set(g.filter((d) => d.killerId).map((d) => d.killerId));
    // a killer that died in the same burst passed its kills on to the next shooter: a gunfight, not a spree
    if (killers.size <= 1) return "gun: one shooter kills several";
    return g.some((d) => d.cause === "fists" || d.cause === "melee")
        ? "gunfight with fists"
        : "gunfight: several shooters";
}

function causes(g: readonly DeathRow[]): string {
    const m = new Map<string, number>();
    for (const d of g) {
        const k = d.cause === "explosion" ? `explosion(${d.src || "?"})` : d.cause;
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].map(([k, n]) => (n > 1 ? `${k} x${n}` : k)).join(", ");
}

/** The burst section of the report for the matches `rs` (one player count). */
export function burstReport(rs: readonly MatchResult[]): string[] {
    const out: string[] = [];
    if (!rs.every((r) => r.deaths.every((d) => Number.isFinite(d.x)))) return out;
    const bursts = rs.flatMap(burstsOf);
    const all = rs.flatMap((r) => r.deaths);
    const inBurst = (early: boolean) =>
        bursts.reduce((a, b) => a + b.deaths.filter((d) => !early || d.t < EARLY).length, 0);
    const early = all.filter((d) => d.t < EARLY).length;
    out.push(
        `### Clustered deaths (${BURST_MIN}+ deaths linked within ${BURST_SECONDS} s and ${BURST_DIST} u)`,
        "",
        `First ${EARLY} s: ${inBurst(true)} of ${early} deaths in bursts (${pct(inBurst(true), early)}), ${early - inBurst(true)} singly; whole match: ${inBurst(false)} of ${all.length} (${pct(inBurst(false), all.length)}). Bursts per match ${(bursts.length / rs.length).toFixed(1)}, largest ${Math.max(0, ...bursts.map((b) => b.deaths.length))} deaths.`,
        "",
        "| burst kind | bursts | deaths | of them in the first 120 s | mean size | mean span (s) |",
        "|---|---|---|---|---|---|",
    );
    const kinds = [...new Set(bursts.map((b) => b.kind))].sort();
    for (const k of kinds) {
        const bs = bursts.filter((b) => b.kind === k);
        const n = bs.reduce((a, b) => a + b.deaths.length, 0);
        const e = bs.reduce((a, b) => a + b.deaths.filter((d) => d.t < EARLY).length, 0);
        const span = bs.reduce((a, b) => a + (b.deaths[b.deaths.length - 1].t - b.deaths[0].t), 0) / bs.length;
        out.push(`| ${k} | ${bs.length} | ${n} | ${e} | ${(n / bs.length).toFixed(1)} | ${span.toFixed(1)} |`);
    }
    // the kill feed's view: deaths anywhere on the map close in time (what "many die at once" looks like on screen)
    const feed = rs.map((r) => {
        const ts = r.deaths
            .filter((d) => d.t < EARLY)
            .map((d) => d.t)
            .sort((a, b) => a - b);
        let peak = 0;
        let crowded = 0;
        for (let i = 0, j = 0; i < ts.length; i++) {
            while (ts[i] - ts[j] > BURST_SECONDS) j++;
            peak = Math.max(peak, i - j + 1);
        }
        for (let i = 0; i < ts.length; i++) {
            const near = ts.filter((t) => Math.abs(t - ts[i]) <= BURST_SECONDS / 2).length;
            if (near >= BURST_MIN) crowded++;
        }
        return { peak, crowded, n: ts.length };
    });
    const fn = feed.reduce((a, f) => a + f.n, 0);
    out.push(
        "",
        `Kill feed (map-wide, first ${EARLY} s): most deaths in any ${BURST_SECONDS} s window ${feed.map((f) => f.peak).join(" / ")} per match; ${pct(
            feed.reduce((a, f) => a + f.crowded, 0),
            fn,
        )} of the deaths came with ${BURST_MIN - 1}+ others within ${BURST_SECONDS} s anywhere on the map; mean rate ${(fn / rs.length / (EARLY / 60)).toFixed(1)} deaths per minute.`,
    );
    const ex = all.filter((d) => d.cause === "explosion");
    const exIn = bursts.reduce((a, b) => a + b.deaths.filter((d) => d.cause === "explosion").length, 0);
    const bySrc = new Map<string, number>();
    for (const d of ex) bySrc.set(d.src || "?", (bySrc.get(d.src || "?") ?? 0) + 1);
    out.push(
        "",
        `Explosion deaths: ${ex.length} (${[...bySrc].map(([k, n]) => `${k} ${n}`).join(", ") || "none"}), ${exIn} of them in bursts. Gas deaths ${all.filter((d) => d.cause === "gas").length}, air drop ${all.filter((d) => d.cause === "airdrop").length}.`,
        "",
    );
    const firsts = bursts
        .filter((b) => b.deaths[0].t < EARLY)
        .sort((a, b) => a.seed - b.seed || a.deaths[0].t - b.deaths[0].t);
    if (firsts.length) {
        out.push(
            `Bursts starting in the first ${EARLY} s:`,
            "",
            "| seed | t (s) | deaths | span (s) | kind | causes | killers | victims armed | victim behaviour |",
            "|---|---|---|---|---|---|---|---|---|",
        );
        for (const b of firsts.slice(0, 40)) {
            const g = b.deaths;
            const killers = new Set(g.filter((d) => d.killerId).map((d) => d.killerId)).size;
            const beh = [...new Set(g.map((d) => d.victimBeh || "-"))].join(", ");
            out.push(
                `| ${b.seed} | ${g[0].t.toFixed(0)} | ${g.length} | ${(g[g.length - 1].t - g[0].t).toFixed(1)} | ${b.kind} | ${causes(g)} | ${killers} | ${g.filter((d) => d.victimArmed).length}/${g.length} | ${beh} |`,
            );
        }
        if (firsts.length > 40) out.push(`| ... | ${firsts.length - 40} more | | | | | | | |`);
        out.push("");
    }
    return out;
}
