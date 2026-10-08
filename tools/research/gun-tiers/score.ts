// Gun tier rebuild, step 2 (docs/design/gun-tiers.md 2.6): composite score, tier cuts, S-aim, owner rulings, behaviour
// pins and consistency from compute.ts's metrics.json. Fast: rerun after changing weights.
// usage (repo root): node tools/research/gun-tiers/score.ts [metrics.json] [tiers.json]  (default research-cache/gun-tiers)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve("research-cache/gun-tiers");
const IN = resolve(process.argv[2] ?? `${DIR}/metrics.json`);
const OUTF = resolve(process.argv[3] ?? `${DIR}/tiers.json`);
const J: any = JSON.parse(readFileSync(IN, "utf8"), (_, v) => (v === "Infinity" ? Number.POSITIVE_INFINITY : v));

type Skill = "expert" | "average" | "beginner";
/**
 * Composite weights. Every component is a log2 ratio against the median tiered gun, so the composite is the log2 of
 * a weighted geometric mean of "how many times better than the median gun" (exponents sum to 1).
 */
export const W = { role: 0.32, range: 0.14, alpha: 0.08, sustain: 0.18, handling: 0.18, ammo: 0.1 };
if (process.env.W_JSON) Object.assign(W, JSON.parse(process.env.W_JSON));
/** wanting a gun follows what a decent player gets from it: expert and average aim, half each */
const BLEND: Record<Skill, number> = { expert: 0.5, average: 0.5, beginner: 0 };
/** an aim gun for S-aim: forgiveness at most this (skillDemand >= 0.8) */
const F_AIM = 0.35;

export type Tier = "S" | "S-aim" | "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D";
const ORDER: Tier[] = ["S", "S-aim", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const RANK = (t: Tier) => 10 - ORDER.indexOf(t); // S 10 .. D 0 (S-aim 9)

const rows: any[] = J.rows;
const comp = J.components;
const current = J.current;

function compositeOf(id: string, blend: Record<Skill, number>) {
    const c = comp[id];
    const b = (k: "role" | "range" | "alpha") =>
        (Object.keys(blend) as Skill[]).reduce((a, s) => a + blend[s] * c[k][s], 0);
    const parts = {
        role: b("role"),
        range: b("range"),
        alpha: b("alpha"),
        sustain: c.sustain,
        handling: c.handling,
        ammo: c.ammo,
    };
    const total = (Object.keys(W) as Array<keyof typeof W>).reduce((a, k) => a + W[k] * parts[k], 0);
    return { parts, total };
}

const score = new Map<string, { C: number; CE: number; parts: ReturnType<typeof compositeOf>["parts"] }>();
for (const r of rows) {
    const b = compositeOf(r.id, BLEND);
    const e = compositeOf(r.id, { expert: 1, average: 0, beginner: 0 });
    score.set(r.id, { C: b.total, CE: e.total, parts: b.parts });
}

// thresholds: the current list's tier shape. Sorting the tiered guns by composite, the k-th cut sits where the
// current list has as many guns at or above that tier (S and S-aim count together as the top band).
const ref = rows.filter((r) => current[r.id]);
const counts = new Map<string, number>();
for (const r of ref) {
    const t = current[r.id].tier === "S-aim" ? "S" : current[r.id].tier;
    counts.set(t, (counts.get(t) ?? 0) + 1);
}
const sorted = ref.map((r) => (score.get(r.id) as { C: number }).C).sort((a, b) => b - a);
const bands: Tier[] = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const TH = new Map<Tier, number>();
let cum = 0;
for (const t of bands.slice(0, -1)) {
    cum += counts.get(t) ?? 0;
    // midpoint between the last gun inside and the first outside
    TH.set(t, (sorted[cum - 1] + sorted[cum]) / 2);
}
function tierOf(c: number): Tier {
    for (const t of bands.slice(0, -1)) if (c >= (TH.get(t) as number)) return t;
    return "D";
}

// rulings (gunTiers.ts header and the task): kept even where the stats disagree, and flagged
const RULING: Record<string, { tier: Tier; why: string }> = {
    m249: { tier: "S", why: "owner: the M249 and the PKP are the top guns (S-rule)" },
    pkp: { tier: "S", why: "owner: the M249 and the PKP are the top guns (S-rule)" },
    mosin: { tier: "A", why: 'owner (report 33): the Mosin is "strong but needs aim": A' },
    mk12: { tier: "B+", why: "owner (report 33): the MK12 and the M39 are low-tier DMRs: B+" },
    m39: { tier: "B+", why: "owner (report 33): the MK12 and the M39 are low-tier DMRs: B+" },
};
/** "pistols are low" (report 12): a cap per pistol kind */
const PISTOL_CAP: { single: Tier; dual: Tier } = { single: "B", dual: "A-" };
/**
 * Behaviour pins (coordinator, 2026-10-08): tiers kept against the stats so two bot behaviours hold; unlike a ruling
 * they set no scale for their class. The AK-47 at B keeps owner item 43 (an average bot with an SMG and an AK takes
 * an MK12 for the AK: the gain must clear the upgrade threshold); the M9 at D keeps a bot with an M9 and an MP5
 * swapping the M9 for an AK lying without ammo.
 */
const PIN: Record<string, { tier: Tier; why: string }> = {
    ak47: { tier: "B", why: "pinned for owner item 43 (an average bot takes an MK12 for its AK)" },
    m9: { tier: "D", why: "pinned so a bot with an M9 and an MP5 takes an AK for the M9" },
};

/**
 * Owner rulings of 2026-10-08, given after the owner reviewed the rebuilt list; applied last, so they override the
 * earlier ones (the MK12 / M39 B+ and the Mosin A of report 33 become A- and A+):
 * - "every DMR and every sniper moves up one tier": the bots' classes dmr and sniper (winter skins included); S-aim has
 *   no higher aim tier and stays, an S gun stays;
 * - the RPG-7 (A-) and the Panzerfaust (B+): "far too low";
 * - the M202 FLASH (A+): "overpowered, a near-certain kill, the endgame comeback gun"; the Panzerfaust is its downgrade.
 */
const OWNER_BUMP_CLASSES: ReadonlySet<string> = new Set(["dmr", "sniper"]);
/**
 * The list the owner reviewed (gunTiers.ts at d96246a): the one-tier bump counts from it, so a later stat shift (the
 * M202's revert moved the B cut past the Model 94) cannot make it two steps.
 */
const REVIEWED: Record<string, Tier> = JSON.parse(
    readFileSync(new URL("reviewed-d96246a.json", import.meta.url), "utf8"),
).tiers;
const OWNER_1008: Record<string, { tier: Tier; why: string }> = {
    rpg7: { tier: "A-", why: "the RPG-7 and the Panzerfaust are far too low" },
    panzerfaust: { tier: "B+", why: "the RPG-7 and the Panzerfaust are far too low" },
    m202: {
        tier: "A+",
        why: "overpowered, a near-certain kill, the endgame comeback gun (the Panzerfaust is its downgrade)",
    },
};

export interface TierRow {
    id: string;
    cls: string;
    C: number;
    CE: number;
    F: number;
    stat: Tier;
    /** the tier in the list the owner reviewed on 2026-10-08 (d96246a), before the rulings of that day */
    before1008?: Tier;
    tier: Tier;
    current?: Tier;
    currentF?: number;
    mainMap?: boolean;
    flags: string[];
    inRows: boolean;
}

const out: TierRow[] = [];
for (const r of rows) {
    const s = score.get(r.id) as { C: number; CE: number };
    let stat = tierOf(s.C);
    // S-aim: an aim gun (forgiveness <= F_AIM) whose blended or expert-only composite reaches the top band; S is
    // kept for top guns that do not need aim
    if (r.F <= F_AIM && Math.max(s.C, s.CE) >= (TH.get("S") as number)) stat = "S-aim";
    let tier = stat;
    const flags: string[] = [];
    const rule = RULING[r.id];
    if (rule && rule.tier !== stat) {
        flags.push(`ruling: stats say ${stat} (composite ${s.C.toFixed(2)}), kept ${rule.tier}: ${rule.why}`);
        tier = rule.tier;
    } else if (rule) flags.push(`ruling agrees: ${rule.tier}`);
    const pin = PIN[r.id];
    if (pin && pin.tier !== tier) {
        flags.push(`pin: stats say ${tier} (composite ${s.C.toFixed(2)}), kept ${pin.tier}: ${pin.why}`);
        tier = pin.tier;
    }
    if (r.cls === "pistol") {
        const cap = r.dualOf ? PISTOL_CAP.dual : PISTOL_CAP.single;
        if (RANK(tier) > RANK(cap)) {
            flags.push(`ruling "pistols are low": stats say ${tier} (composite ${s.C.toFixed(2)}), capped at ${cap}`);
            tier = cap;
        }
    }
    const cur = current[r.id];
    out.push({
        id: r.id,
        cls: r.cls,
        C: s.C,
        CE: s.CE,
        F: r.F,
        stat,
        tier,
        current: cur?.tier,
        currentF: cur?.F,
        mainMap: cur?.mainMap,
        flags,
        inRows: !!cur,
    });
}

// consistency with the rulings: a gun that stat-dominates a ruled gun of its class is never tiered below it (the
// SV-98 beats the Mosin on every stat), and one the ruled gun dominates never above it
{
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const t of out) {
        const rule = RULING[t.id];
        if (!rule) continue;
        for (const u of out) {
            const x = byId.get(u.id);
            const y = byId.get(t.id);
            if (dominates(x, y) && RANK(u.tier) < RANK(t.tier)) {
                u.flags.push(
                    `consistency: stat-dominates ${t.id} (ruled ${t.tier}); stats say ${u.tier}, lifted to ${t.tier}`,
                );
                u.tier = t.tier;
            }
            if (dominates(y, x) && RANK(u.tier) > RANK(t.tier)) {
                u.flags.push(
                    `consistency: stat-dominated by ${t.id} (ruled ${t.tier}); stats say ${u.tier}, capped at ${t.tier}`,
                );
                u.tier = t.tier;
            }
            // a demoting ruling sets the owner's scale for its class: guns of the class that score no better than the
            // ruled gun are not tiered above it (a promoting ruling, the Mosin, speaks for that gun only)
            if (
                RANK(t.tier) < RANK(t.stat) &&
                !RULING[u.id] &&
                u.cls === t.cls &&
                u.C <= t.C &&
                RANK(u.tier) > RANK(t.tier)
            ) {
                u.flags.push(
                    `consistency: scores ${u.C.toFixed(2)}, no better than ${t.id} (${t.C.toFixed(2)}, ruled ${t.tier}); stats say ${u.tier}, capped at ${t.tier}`,
                );
                u.tier = t.tier;
            }
        }
    }
}

// the owner rulings of 2026-10-08 come last
for (const t of out) {
    t.before1008 = REVIEWED[t.id] ?? t.tier;
    if (OWNER_BUMP_CLASSES.has(t.cls)) {
        // exactly one tier over the reviewed list; S-aim and S stay
        const from = t.before1008;
        const up = from === "S" || from === "S-aim" ? from : ORDER[ORDER.indexOf(from) - 1];
        if (up !== t.tier) t.flags.push(`owner 2026-10-08: every DMR and sniper moves up one tier: ${from} -> ${up}`);
        t.tier = up;
    }
    const r = OWNER_1008[t.id];
    if (r && r.tier !== t.tier) {
        t.flags.push(`owner 2026-10-08: ${t.tier} -> ${r.tier}: ${r.why}`);
        t.tier = r.tier;
    }
}

writeFileSync(
    OUTF,
    JSON.stringify(
        {
            W,
            BLEND,
            F_AIM,
            thresholds: Object.fromEntries(TH),
            counts: Object.fromEntries(counts),
            rows: out,
            score: Object.fromEntries(score),
        },
        null,
        1,
    ),
);

if (!process.env.QUIET) {
    console.log("thresholds", [...TH].map(([t, v]) => `${t} ${v.toFixed(3)}`).join(", "));
    const byTier = new Map<Tier, string[]>();
    for (const t of out.filter((x) => x.inRows).sort((a, b) => b.C - a.C)) {
        const list = byTier.get(t.tier) ?? [];
        list.push(t.current && t.current !== t.tier ? `${t.id}(${t.current})` : t.id);
        byTier.set(t.tier, list);
    }
    for (const t of ORDER) console.log(t.padEnd(6), (byTier.get(t) ?? []).join(" "));
    console.log(
        "-- not in ROWS (reference):",
        out
            .filter((x) => !x.inRows)
            .map((x) => `${x.id} ${x.stat} ${x.C.toFixed(2)}`)
            .join(", "),
    );
    for (const t of out) for (const f of t.flags) if (!f.startsWith("ruling agrees")) console.log("FLAG", t.id, f);
}

// ---------------------------------------------------------------------------------------------------------------
// Stat dominance inside a class: X dominates Y when X is at least as good on every listed stat and better on one.
export function dominates(x: any, y: any): boolean {
    if (x.cls !== y.cls || x.id === y.id) return false;
    const shot = (r: any) => r.pellets * (r.damage + r.explosion);
    const reloadPerRound = (r: any) => (Number.isFinite(r.fullReload) ? r.fullReload / r.mag : 0);
    // [value of x, value of y, higher is better]
    const pairs: Array<[number, number, boolean]> = [
        [shot(x), shot(y), true],
        [x.damage, y.damage, true],
        [60 / x.rpm, 60 / y.rpm, false],
        [x.mag, y.mag, true],
        [reloadPerRound(x), reloadPerRound(y), false],
        [x.shotSpread, y.shotSpread, false],
        [x.moveSpread, y.moveSpread, false],
        [x.bulletSpeed, y.bulletSpeed, true],
        [x.range, y.range, true],
        [x.falloff, y.falloff, true],
        [x.headshotMult, y.headshotMult, true],
        [x.heldSpeed, y.heldSpeed, true],
        [x.firingSpeed, y.firingSpeed, true],
        [x.switchDelay, y.switchDelay, false],
        [x.ammoFactor, y.ammoFactor, true],
    ];
    let better = false;
    for (const [a, b, hi] of pairs) {
        if (hi ? a < b - 1e-9 : a > b + 1e-9) return false;
        if (hi ? a > b + 1e-9 : a < b - 1e-9) better = true;
    }
    return better;
}

if (!process.env.QUIET) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const tierById = new Map(out.map((t) => [t.id, t]));
    for (const x of rows)
        for (const y of rows) {
            if (!dominates(x, y)) continue;
            const tx = tierById.get(x.id) as TierRow;
            const ty = tierById.get(y.id) as TierRow;
            const bad = RANK(tx.tier) < RANK(ty.tier);
            console.log(
                `${bad ? "VIOLATION" : "dom"} ${x.id} (${tx.tier}, ${tx.C.toFixed(2)}) >= ${y.id} (${ty.tier}, ${ty.C.toFixed(2)})`,
            );
        }
    void byId;
}
