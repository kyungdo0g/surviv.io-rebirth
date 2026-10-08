// Readable tables of the match metrics: the acceptance thresholds of a cell (PASS / FAIL / N/A, with the user reports
// each answers), a breakdown of the key numbers by skill tier, persona, difficulty and mode, and the tier of the best
// gun carried at the checkpoints (living, and the dead when they died).
import type { CellSummary, GroupStats } from "./summary.ts";
import type { ThresholdResult } from "./thresholds.ts";
import { CHECKPOINTS } from "./types.ts";

const pct = (r: number, d = 1) => (Number.isFinite(r) ? `${(r * 100).toFixed(d)}%` : "-");
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "-");

function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
    const line = (r: readonly string[]) =>
        r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
    return [line(header), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)];
}

export function formatThresholds(results: readonly ThresholdResult[]): string[] {
    return results.map((r) => `  ${r.verdict.padEnd(4)}  ${r.label} [${r.target}] (#${r.reports}): ${r.value}`);
}

const COLUMNS = [
    "group",
    "bots",
    "kills",
    "hit",
    "surv s",
    "offscr",
    "exp p10",
    "noFire",
    "ch30",
    "fl60",
    "brk/hit",
    "aband",
    "holst",
    "boost/m",
    "weak120",
    "wrongPis",
    "unsafeRv",
    "fragNear",
] as const;

function row(name: string, g: GroupStats): string[] {
    const l = g.loadout[120];
    return [
        name,
        String(g.bots),
        num(g.bots ? g.kills / g.bots : Number.NaN),
        pct(g.hitRate.r),
        num(g.meanSurvival, 0),
        pct(g.offScreenShots.r),
        num(g.exposure.p10, 3),
        pct(g.aimNoFire.r, 0),
        String(g.chases30),
        String(g.flees60),
        `${g.containersBroken}/${g.containersHit}`,
        String(g.containersAbandoned),
        pct(g.holsterTravel.r, 0),
        num(g.boostsPerSafeMinute),
        l?.alive ? `${l.weakOnly}/${l.alive}` : "-",
        pct(g.wrongSlotPistol.r),
        `${g.unsafeRevives}/${g.revives}`,
        `${g.fragReleasesNear.n}/${g.fragReleasesNear.d}`,
    ];
}

/** Key numbers of everyone, then by tier, persona, difficulty and mode (one row per group). */
export function formatBreakdown(c: CellSummary): string[] {
    const rows: string[][] = [row("all", c.overall)];
    const add = (prefix: string, groups: Record<string, GroupStats>) => {
        if (Object.keys(groups).length < 2 && prefix !== "tier") return;
        for (const [k, g] of Object.entries(groups)) rows.push(row(`${prefix} ${k}`, g));
    };
    add("tier", c.byTier);
    add("persona", c.byPersona);
    add("diff", c.byDifficulty);
    add("mode", c.byMode);
    return table(COLUMNS, rows);
}

/** Tier of the best gun carried at each checkpoint (the living), and the dead that were weak or unarmed. */
export function formatGuns(c: CellSummary): string[] {
    const tiers = ["S", "S-aim", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "none"];
    const rows = CHECKPOINTS.map((t) => {
        const l = c.overall.loadout[t];
        if (!l) return [`${t}s`, ...tiers.map(() => "-"), "-", "-"];
        return [
            `${t}s`,
            ...tiers.map((k) => (l.alive ? pct((l.tiers[k] ?? 0) / l.alive, 0) : "-")),
            String(l.alive),
            l.dead ? `${pct(l.deadWeakOrUnarmed / l.dead, 0)} of ${l.dead}` : "-",
        ];
    });
    return table(["t", ...tiers, "alive", "dead weak/unarmed"], rows);
}

const R3_COLUMNS = [
    "group",
    "frags",
    "f/chMin",
    "fHit",
    "onTgt",
    "cooked",
    "restAim",
    "esc unc",
    "forgot",
    "unseen",
    "reacted",
    "safe",
    "lost arm",
    "searched",
    "found",
    "coverNr",
    "hidden",
    "outfits",
] as const;

function r3Row(name: string, g: GroupStats): string[] {
    const r = g.r3;
    const f = r.frags;
    return [
        name,
        String(f.throws),
        num(f.perChanceMinute),
        pct(f.hit.r, 0),
        pct(f.onTarget.r, 0),
        String(f.cooked),
        num(f.restOnAim.p50),
        `${f.escapeUncooked}/${f.escape}`,
        String(f.forgot),
        String(r.unseen.episodes),
        pct(r.unseen.reacted.r, 0),
        pct(r.unseen.safe.r, 0),
        String(r.lost.armed),
        String(r.lost.searched),
        String(r.lost.found),
        pct(r.cover.near.r, 0),
        pct(r.cover.hidden.r, 0),
        `${r.outfits.swaps}/${r.outfits.unsafe}`,
    ];
}

/** Round 3 and 4 numbers by tier and persona (frags, unseen fire, lost targets, cover, outfits). */
export function formatRound3(c: CellSummary): string[] {
    const rows: string[][] = [r3Row("all", c.overall)];
    for (const [k, g] of Object.entries(c.byTier)) rows.push(r3Row(`tier ${k}`, g));
    if (Object.keys(c.byPersona).length > 1)
        for (const [k, g] of Object.entries(c.byPersona)) rows.push(r3Row(`persona ${k}`, g));
    return table(R3_COLUMNS, rows);
}

/** The whole readable report of a cell. */
export function formatCell(c: CellSummary, results: readonly ThresholdResult[]): string {
    const modes = Object.entries(c.modes)
        .map(([m, n]) => `${m} ${n}`)
        .join(", ");
    const head =
        `== ${c.cell}: ${c.matches} matches (${modes}), ${c.decided} decided, mean ${num(c.gameSeconds, 0)} game s, ` +
        `${num(c.wallSeconds, 1)} s wall, exceptions ${c.exceptions}`;
    return [
        head,
        ...formatThresholds(results),
        "",
        ...formatBreakdown(c).map((l) => `  ${l}`),
        "",
        "  best gun carried (share of the living by tier):",
        ...formatGuns(c).map((l) => `  ${l}`),
        "",
        "  round 3 and 4 (outfits: swaps/unsafe):",
        ...formatRound3(c).map((l) => `  ${l}`),
        ...(c.errors.length ? ["", "  errors:", ...c.errors.map((e) => `  ${e.split("\n")[0]}`)] : []),
    ].join("\n");
}
