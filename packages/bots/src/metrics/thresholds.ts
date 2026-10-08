// Acceptance thresholds of the bot overhaul (scratchpad triage section 5.3, with the critique's corrections), evaluated
// on a cell summary (metrics/summary.ts): each yields PASS, FAIL or N/A (too few samples to judge, or not applicable to
// the cell: win share needs the population mix, revives need team modes). A 50v50 cell is a smoke run: only its
// exceptions and team kills gate, the rest is shown for information. Monitors (alive curve and diagnostics) never gate.
import { SKILL_TIER_NAMES } from "../difficulty.ts";
import { round3Lines } from "./round3Summary.ts";
import type { CellSummary, Ratio } from "./summary.ts";

export type Verdict = "PASS" | "FAIL" | "N/A" | "INFO";

export interface ThresholdResult {
    id: string;
    /** what is measured */
    label: string;
    /** the acceptance rule */
    target: string;
    /** the measured value, readable */
    value: string;
    verdict: Verdict;
    /** user reports (numbers of the 18) it answers */
    reports: string;
}

interface Threshold {
    id: string;
    label: string;
    target: string;
    reports: string;
    /** gates a 50v50 smoke cell too */
    faction?: boolean;
    check(c: CellSummary): { value: string; verdict: Verdict };
}

const pct = (r: number) => (Number.isFinite(r) ? `${(r * 100).toFixed(1)}%` : "n/a");
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const frac = (q: Ratio) => `${pct(q.r)} (${q.n}/${q.d})`;
const verdict = (ok: boolean): Verdict => (ok ? "PASS" : "FAIL");

/** Minimum samples before a rate is judged. */
const MIN = { shots: 50, latencies: 20, opened: 3, alive120: 20, fightSamples: 100, sTier: 5, travel: 100 } as const;

/** Win-share bands by tier (triage 5.3; with the 35/45/20 server mix) and the matches needed to judge them. */
export const WIN_SHARE: Readonly<Record<string, readonly [number, number]>> = {
    beginner: [0.1, 0.2],
    intermediate: [0.4, 0.5],
    expert: [0.35, 0.45],
};
const MIN_DECIDED = 30;
/** Alive-curve design target (monitor): share of the bots alive at 60 s and at 120 s. */
export const ALIVE_TARGET: Readonly<Record<number, number>> = { 60: 0.45, 120: 0.25 };

export const THRESHOLDS: readonly Threshold[] = [
    {
        id: "exceptions",
        label: "bot exceptions",
        target: "0",
        reports: "-",
        faction: true,
        check: (c) => ({ value: String(c.exceptions), verdict: verdict(c.exceptions === 0) }),
    },
    {
        id: "offscreen-shots",
        label: "shots at targets off the 16:9 screen (1 u slack)",
        target: "<= 1%",
        reports: "3",
        check: ({ overall: o }) => ({
            value: frac(o.offScreenShots),
            verdict: o.offScreenShots.d < MIN.shots ? "N/A" : verdict(o.offScreenShots.r <= 0.01),
        }),
    },
    {
        id: "concealed-first-shots",
        label: "first shots at concealed targets not revealed",
        target: "0",
        reports: "3",
        check: ({ overall: o }) => ({
            value: `${o.concealedFirstShots} (first shots of an engagement, target in a bush or canopy and not revealed)`,
            verdict: verdict(o.concealedFirstShots === 0),
        }),
    },
    {
        id: "exposure-p10",
        label: "exposure-to-first-shot p10",
        target: ">= 0.15 s",
        reports: "3, 5",
        check: ({ overall: o }) => ({
            value: `${num(o.exposure.p10, 3)} s (p50 ${num(o.exposure.p50, 3)}, n ${o.exposure.n}, <0.15 s ${pct(o.exposure.under150.r)})`,
            verdict: o.exposure.n < MIN.latencies ? "N/A" : verdict(o.exposure.p10 >= 0.15),
        }),
    },
    {
        id: "chases-30",
        label: "chases over 30 s per match",
        target: "<= 1",
        reports: "11",
        check: (c) => ({
            value: `${num(c.perMatch.chases30)} (${c.overall.chases30} in ${c.matches}; longest ${num(c.overall.chaseMax, 1)} s)`,
            verdict: verdict(c.perMatch.chases30 <= 1),
        }),
    },
    {
        id: "chase-p95",
        label: "chase duration minus persona patience, p95",
        target: "<= 2 s",
        reports: "11",
        check: ({ overall: o }) => ({
            value: o.chases
                ? `${num(o.chaseExcessP95, 1)} s (${o.chasesOverPatience} of ${o.chases} over patience + 2 s)`
                : "no chases",
            verdict: o.chases ? verdict(o.chaseExcessP95 <= 2) : "PASS",
        }),
    },
    {
        id: "flees-60",
        label: "flee episodes over 60 s",
        target: "0",
        reports: "11",
        check: ({ overall: o }) => ({
            value: `${o.flees60} (longest ${num(o.fleeMax, 1)} s; over 30 s: ${o.flees30})`,
            verdict: verdict(o.flees60 === 0),
        }),
    },
    {
        id: "oscillation",
        label: "flee-and-return cycles at one contested spot (max)",
        target: "<= 1",
        reports: "14",
        check: ({ overall: o }) => ({
            value: `${o.oscMaxCycles} (${o.oscOverLimit} bots over; ${o.oscCycles} cycles at ${o.oscSpots} spots)`,
            verdict: verdict(o.oscMaxCycles <= 1),
        }),
    },
    {
        id: "abandoned",
        label: "containers abandoned after a break attempt per match",
        target: "<= 3",
        reports: "6, 7",
        check: (c) => ({
            value: `${num(c.perMatch.abandoned)} (${c.containers.abandoned} of ${c.containers.hit} hit; broken ${c.containers.broken})`,
            verdict: verdict(c.perMatch.abandoned <= 3),
        }),
    },
    {
        id: "plated",
        label: "plated containers hit while looting (no piercing melee)",
        target: "0",
        reports: "7",
        check: (c) => ({ value: String(c.containers.plated), verdict: verdict(c.containers.plated === 0) }),
    },
    {
        id: "airdrop-inner",
        label: "air drops: inner crate broken of opened",
        target: ">= 60%",
        reports: "2",
        check: ({ airdrops: a }) => ({
            value: `${pct(a.opened ? a.innerBroken / a.opened : Number.NaN)} (landed ${a.landed}, opened ${a.opened}, inner ${a.innerBroken}, looted ${a.looted})`,
            verdict: a.opened < MIN.opened ? "N/A" : verdict(a.innerBroken / a.opened >= 0.6),
        }),
    },
    {
        id: "frags-near",
        label: "frags released with a standing enemy under 6 u",
        target: "0",
        reports: "15",
        check: ({ overall: o }) => ({
            value: `${o.fragReleasesNear.n} of ${o.fragReleasesNear.d} (started near: ${o.fragStartsNear.n})`,
            verdict: verdict(o.fragReleasesNear.n === 0),
        }),
    },
    {
        id: "weak-only-120",
        label: "pistol-only (best gun C+ or lower) of the living at 120 s",
        target: "<= 3%",
        reports: "8",
        check: ({ overall: o }) => {
            const l = o.loadout[120];
            const r = l?.alive ? l.weakOnly / l.alive : Number.NaN;
            return {
                value: l
                    ? `${pct(r)} (${l.weakOnly}/${l.alive}; class pistol-only ${l.pistolOnly}, unarmed ${l.unarmed}, seeing a better gun ${l.seesBetter})`
                    : "n/a",
                verdict: !l || l.alive < MIN.alive120 ? "N/A" : verdict(r <= 0.03),
            };
        },
    },
    {
        id: "wrong-slot",
        label: "fight samples with a pistol while the other gun suits the range better",
        target: "<= 1%",
        reports: "8, 18",
        check: ({ overall: o }) => ({
            value: `${frac(o.wrongSlotPistol)}; pistol in hand ${pct(o.pistolInFight.r)}`,
            verdict: o.wrongSlotPistol.d < MIN.fightSamples ? "N/A" : verdict(o.wrongSlotPistol.r <= 0.01),
        }),
    },
    {
        id: "s-tier",
        label: "S-tier gun seen within 20 u outside a fight, held within 15 s",
        target: ">= 90%",
        reports: "12",
        check: ({ overall: o }) => ({
            value: frac(o.sTier),
            verdict: o.sTier.d < MIN.sTier ? "N/A" : verdict(o.sTier.r >= 0.9),
        }),
    },
    {
        id: "holster",
        label: "holstered share of armed, safe travel",
        target: ">= 60%",
        reports: "17",
        check: ({ overall: o }) => ({
            value: frac(o.holsterTravel),
            verdict: o.holsterTravel.d < MIN.travel ? "N/A" : verdict(o.holsterTravel.r >= 0.6),
        }),
    },
    {
        id: "boosts",
        label: "boosts per bot-minute of safe time with a boost in the bag (boost < 50)",
        target: ">= 1",
        reports: "16",
        check: ({ overall: o }) => ({
            value: `${num(o.boostsPerSafeMinute)} (${o.safeBoostUses} in ${num(o.safeBoostMinutes, 1)} min; boosts ${o.boostUses}, heals ${o.healUses})`,
            verdict: o.safeBoostMinutes < 2 ? "N/A" : verdict(o.boostsPerSafeMinute >= 1),
        }),
    },
    {
        id: "idle-15",
        label: "idle episodes of 15 s or more",
        target: "0",
        reports: "1",
        check: (c) => ({
            value: `${c.idle.over15} (${[
                ...Object.entries(c.idle.over15ByBehaviour).map(([k, v]) => `${k} ${v}`),
                `all episodes ${c.idle.episodes}, ${num(c.idle.seconds, 0)} bot-s`,
            ].join(", ")})`,
            verdict: verdict(c.idle.over15 === 0),
        }),
    },
    {
        id: "unsafe-revives",
        label: "revives started while reviveThreat saw a threat (one first sighted in that moment counted apart)",
        target: "0",
        reports: "13",
        check: (c) => {
            const team = Object.keys(c.modes).some((m) => m !== "solo");
            return {
                value: `${c.overall.unsafeRevives} of ${c.overall.revives} (threat sighted as it began ${c.overall.revivesSurprised}; hit for 10+ HP while kneeling ${c.overall.revivesHurt}; kneeling under another behaviour ${num(c.overall.kneelOtherSeconds, 1)} s)`,
                verdict: team ? verdict(c.overall.unsafeRevives === 0) : "N/A",
            };
        },
    },
    {
        id: "hit-rate-tier",
        label: "real-match hit rate by tier",
        target: "strictly increasing",
        reports: "9",
        check: (c) => {
            const rs = SKILL_TIER_NAMES.map((t) => c.hitRateByTier[t]);
            const value = SKILL_TIER_NAMES.map((t, i) => `${t} ${pct(rs[i]?.r ?? Number.NaN)}`).join(" < ");
            if (rs.some((r) => !r || r.d < 200)) return { value, verdict: "N/A" };
            return { value, verdict: verdict(rs[0].r < rs[1].r && rs[1].r < rs[2].r) };
        },
    },
    {
        id: "win-share",
        label: "win share by tier (35/45/20 mix)",
        target: "beg 10-20%, int 40-50%, exp 35-45%",
        reports: "9",
        check: (c) => {
            const value = `${SKILL_TIER_NAMES.map((t) => `${t.slice(0, 3)} ${pct(c.winShare[t] ?? Number.NaN)}`).join(", ")} (${c.decided} decided)`;
            const all = SKILL_TIER_NAMES.every((t) => c.byTier[t]);
            if (!all || !c.cell.startsWith("population") || c.decided < MIN_DECIDED) return { value, verdict: "N/A" };
            const ok = SKILL_TIER_NAMES.every((t) => {
                const [lo, hi] = WIN_SHARE[t];
                const s = c.winShare[t] ?? Number.NaN;
                return s >= lo && s <= hi;
            });
            return { value, verdict: verdict(ok) };
        },
    },
    {
        id: "team-kills",
        label: "50v50 team kills",
        target: "0",
        reports: "50v50",
        faction: true,
        check: (c) => ({
            value: c.faction ? String(c.faction.teamKills) : "n/a",
            verdict: c.faction ? verdict(c.faction.teamKills === 0) : "N/A",
        }),
    },
];

/** Diagnostics shown with the thresholds (never gate). */
function monitors(c: CellSummary): ThresholdResult[] {
    const o = c.overall;
    const curve = c.alive
        .filter((a) => a.t <= 240)
        .map((a) => `${a.t}s ${pct(a.share)}`)
        .join(", ");
    const below = Object.entries(ALIVE_TARGET).filter(([t, share]) => {
        const at = c.alive.find((a) => a.t === Number(t));
        return at && at.share < share;
    });
    const noFire: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.noFire)) {
        const key = k.startsWith("range:") ? "range" : k.startsWith("beh:") ? "behaviour" : k;
        noFire[key] = (noFire[key] ?? 0) + v;
    }
    const top = Object.entries(noFire)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${pct(v / Math.max(1, o.aimNoFire.n))}`)
        .join(", ");
    const info = (id: string, label: string, value: string, reports: string): ThresholdResult => ({
        id,
        label,
        target: "monitor",
        value,
        verdict: "INFO",
        reports,
    });
    return [
        info(
            "alive-curve",
            "alive share (design: >= 45% at 60 s, >= 25% at 120 s)",
            `${curve}${below.length ? ` (below target at ${below.map(([t]) => `${t}s`).join(", ")})` : ""}`,
            "-",
        ),
        info("aim-no-fire", "aiming at a visible enemy without firing", `${frac(o.aimNoFire)}: ${top}`, "4, 5"),
        info(
            "aim-starts",
            "aim acquisitions at off-screen / hidden players",
            `${frac(o.offScreenAimStarts)} / ${frac(o.hiddenAimStarts)}`,
            "3",
        ),
        info(
            "containers",
            "distinct containers broken of those bots hit while breaking",
            `${pct(c.containers.hit ? c.containers.broken / c.containers.hit : Number.NaN)} (${c.containers.broken}/${c.containers.hit})`,
            "6, 7",
        ),
        info(
            "visits",
            "building visits, pickups per visit, empty visits",
            `${o.visits}, ${num(o.pickupsPerVisit)}, ${pct(o.emptyVisits.r)}`,
            "6",
        ),
        info("downgrades", "usable guns dropped for a lower tier", String(o.tierDowngrades), "12"),
        info(
            "flips",
            "behaviour flips back within 3 s (zone <-> loot, explore <-> flee) per bot-minute",
            num(o.flipsPerMinute),
            "1, 14",
        ),
        info(
            "right-gun",
            "two-gun fight samples holding the gun that suits the range; slot switches per fight-minute",
            `${frac(o.rightGun)}; ${num(o.switchesPerFightMinute)}`,
            "18",
        ),
        info("smoke-feet", "smoke grenades aimed at the bot's own feet", String(o.smokeAtFeet), "15"),
    ];
}

/** Every threshold of a cell, then the monitors. */
export function evaluateCell(c: CellSummary): ThresholdResult[] {
    const smoke = !!c.faction;
    const out = THRESHOLDS.map((t) => {
        const r = t.check(c);
        const v: Verdict = smoke && !t.faction && r.verdict !== "N/A" ? "INFO" : r.verdict;
        return { id: t.id, label: t.label, target: t.target, value: r.value, verdict: v, reports: t.reports };
    });
    // round 3 and 4 (user reports 19-30): a 50v50 smoke cell shows them for information only
    const r3 = round3Lines(c.overall.r3, c.byTier, c.deliberate).map((l) =>
        smoke && l.verdict !== "N/A" ? { ...l, verdict: "INFO" as Verdict } : l,
    );
    return [...out, ...r3, ...monitors(c)];
}

/** Whether every gating threshold passed (N/A and INFO do not fail). */
export function passed(results: readonly ThresholdResult[]): boolean {
    return results.every((r) => r.verdict !== "FAIL");
}
