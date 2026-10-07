// Summaries and thresholds of the round 3 and 4 metrics (user reports 19-30, stage EVALUATE): per-group statistics of
// the per-bot round 3 counters (metrics/round3Types.ts), the deliberately started containers of a cell, the acceptance
// lines that gate (containers ~100%, no frag held past its fuse, no cook without a reason, escape frags uncooked,
// bushes hide, canopies only partly, unseen fire answered, safe outfit swaps, frag craft rising with skill) and the
// monitors that only inform (smoke, search, cover, outfit habits, reactions by persona).
import { SKILL_TIER_NAMES } from "../difficulty.ts";
import { quantile } from "./episodes.ts";
import {
    type ConcealSamples,
    type DeliberateContainers,
    emptyRound3,
    type FragRecord,
    INTERRUPTIONS,
    type Round3Bot,
    UNREACHABLE,
} from "./round3Types.ts";
import type { BotMetrics } from "./types.ts";

/** A frag thrown from the minimum cook (the simulation holds a pulled pin 0.1 s) counts as uncooked. */
export const UNCOOKED = 0.15;

export interface Ratio3 {
    n: number;
    d: number;
    r: number;
}

const ratio = (n: number, d: number): Ratio3 => ({ n, d, r: d > 0 ? n / d : Number.NaN });

export interface FragStats {
    throws: number;
    /** throws per minute with a frag in the bag and an enemy on the screen */
    perChanceMinute: number;
    chanceMinutes: number;
    /** throws whose blast hurt an enemy; enemies within the blast at the burst */
    hit: Ratio3;
    onTarget: Ratio3;
    enemyDmgPerThrow: number;
    ownDmgPerThrow: number;
    /** throws the bot planned to cook (ThrowPlan.cook over the minimum) and those it held over the minimum */
    plannedCooked: number;
    cooked: number;
    /** planned cooks without a reason (none, waste, escape, unknown): the decision of report 24 */
    cookedNoReason: number;
    reasons: Record<string, number>;
    /** cooked frags that came to rest within 3 u of the point aimed at: seconds they lay before the burst */
    restOnAim: { n: number; p10: number; p50: number; p90: number };
    /** every cooked frag that came to rest (bounces and short throws included), and the uncooked ones */
    restCooked: { n: number; p50: number };
    restUncooked: { n: number; p50: number };
    /** held past the fuse (burst in the hand) */
    cookedOff: number;
    /** held 0.5 s or more past the planned cook and burst before arriving, over 3 u from the aim: held too long */
    heldTooLong: number;
    /** released 0.3 s or more past the planned cook / before it (an abort, a blocked path) */
    heldLonger: number;
    releasedEarly: number;
    /** frags thrown back on the run (reason escape) and those released at the minimum cook */
    escape: number;
    escapeUncooked: number;
    escapeHit: Ratio3;
    /** frags let go while the bot ran (flee, disengage), any reason */
    fleeing: number;
    /** the decision trace: frags forgotten in an engagement, throws called off or moved for a blocked path */
    forgot: number;
    blocked: number;
    sidestep: number;
}

export interface Round3Stats {
    unseen: {
        episodes: number;
        reactions: Record<string, number>;
        move: Record<string, number>;
        weapon: Record<string, number>;
        /** episodes with any reaction (not none+none, spotted counts as a reaction to a seen shooter) */
        reacted: Ratio3;
        latencyP50: number;
        latencyP90: number;
        safe: Ratio3;
        damagePerEpisode: number;
        deaths: number;
    };
    smoke: { episodes: number; reactions: Record<string, number>; shots: number; hits: number };
    lost: {
        episodes: number;
        armed: number;
        searched: number;
        found: number;
        foundBySearch: number;
        gaveUp: number;
        giveUpP50: number;
        giveUpP90: number;
        findP50: number;
    };
    conceal: { open: Ratio3; canopy: Ratio3; bush: Ratio3; canopyShots: number; canopyFirstShots: number };
    cover: { samples: number; near: Ratio3; hidden: Ratio3 };
    outfits: { swaps: number; unsafe: number };
    frags: FragStats;
}

function merge(into: Record<string, number>, from: Record<string, number>): void {
    for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

function cs(list: readonly ConcealSamples[]): Ratio3 {
    return ratio(
        list.reduce((a, c) => a + c.fire, 0),
        list.reduce((a, c) => a + c.samples, 0),
    );
}

export function fragStats(
    frags: readonly FragRecord[],
    chanceSeconds: number,
    trace: Record<string, number>,
): FragStats {
    const cooked = frags.filter((f) => f.cook > UNCOOKED && !f.cookedOff);
    const planned = frags.filter((f) => f.planned > UNCOOKED);
    const uncooked = frags.filter((f) => f.cook <= UNCOOKED);
    const restOnAim = cooked.filter((f) => f.rest >= 0 && f.burstOff >= 0 && f.burstOff <= 3).map((f) => f.rest);
    const restC = cooked.filter((f) => f.rest >= 0).map((f) => f.rest);
    const restU = uncooked.filter((f) => f.rest >= 0).map((f) => f.rest);
    const reasons: Record<string, number> = {};
    for (const f of planned) reasons[f.reason || "?"] = (reasons[f.reason || "?"] ?? 0) + 1;
    const known = frags.filter((f) => f.planned >= 0);
    const escapes = frags.filter((f) => f.reason === "escape");
    const withDist = frags.filter((f) => f.enemyDist >= 0);
    const n = frags.length;
    const traceOf = (prefix: string) =>
        Object.entries(trace)
            .filter(([k]) => k.startsWith(prefix))
            .reduce((a, [, v]) => a + v, 0);
    return {
        throws: n,
        perChanceMinute: chanceSeconds > 0 ? n / (chanceSeconds / 60) : Number.NaN,
        chanceMinutes: chanceSeconds / 60,
        hit: ratio(frags.filter((f) => f.enemyDmg > 0).length, n),
        onTarget: ratio(withDist.filter((f) => f.enemyDist <= f.blast).length, withDist.length),
        enemyDmgPerThrow: n ? frags.reduce((a, f) => a + f.enemyDmg, 0) / n : Number.NaN,
        ownDmgPerThrow: n ? frags.reduce((a, f) => a + f.teamDmg + f.selfDmg, 0) / n : Number.NaN,
        plannedCooked: planned.length,
        cooked: cooked.length,
        cookedNoReason: planned.filter((f) => !f.reason || ["none", "waste", "escape"].includes(f.reason)).length,
        reasons,
        restOnAim: {
            n: restOnAim.length,
            p10: quantile(restOnAim, 0.1),
            p50: quantile(restOnAim, 0.5),
            p90: quantile(restOnAim, 0.9),
        },
        restCooked: { n: restC.length, p50: quantile(restC, 0.5) },
        restUncooked: { n: restU.length, p50: quantile(restU, 0.5) },
        cookedOff: frags.filter((f) => f.cookedOff).length,
        heldTooLong: known.filter(
            (f) => f.reason !== "airburst" && f.cook - f.planned >= 0.5 && f.rest < 0 && f.burstOff > 3,
        ).length,
        heldLonger: known.filter((f) => f.cook - Math.max(f.planned, 0.1) >= 0.3).length,
        releasedEarly: known.filter((f) => f.planned - f.cook >= 0.3).length,
        escape: escapes.length,
        escapeUncooked: escapes.filter((f) => f.cook <= UNCOOKED).length,
        escapeHit: ratio(escapes.filter((f) => f.enemyDmg > 0).length, escapes.length),
        fleeing: frags.filter((f) => f.fleeing).length,
        forgot: traceOf("frag:forgot"),
        blocked: traceOf("frag:blocked"),
        sidestep: traceOf("frag:sidestep"),
    };
}

export function round3Stats(bots: readonly BotMetrics[]): Round3Stats {
    const rs: Round3Bot[] = bots.map((m) => m.r3 ?? emptyRound3());
    const sum = (f: (r: Round3Bot) => number) => rs.reduce((a, r) => a + f(r), 0);
    const reactions: Record<string, number> = {};
    const smokeReactions: Record<string, number> = {};
    const trace: Record<string, number> = {};
    for (const r of rs) {
        merge(reactions, r.unseenReactions);
        merge(smokeReactions, r.smokeReactions);
        merge(trace, r.fragTrace);
    }
    const move: Record<string, number> = {};
    const weapon: Record<string, number> = {};
    for (const [k, v] of Object.entries(reactions)) {
        const [mv, wp] = k === "spotted" ? ["spotted", "spotted"] : k.split("+");
        move[mv] = (move[mv] ?? 0) + v;
        weapon[wp] = (weapon[wp] ?? 0) + v;
    }
    const episodes = sum((r) => r.unseenEpisodes);
    const lat = rs.flatMap((r) => r.unseenLatency);
    const giveUp = rs.flatMap((r) => r.giveUpTimes);
    const find = rs.flatMap((r) => r.findTimes);
    return {
        unseen: {
            episodes,
            reactions,
            move,
            weapon,
            reacted: ratio(episodes - (reactions["none+none"] ?? 0), episodes),
            latencyP50: quantile(lat, 0.5),
            latencyP90: quantile(lat, 0.9),
            safe: ratio(
                sum((r) => r.unseenSafeSamples),
                sum((r) => r.unseenSamples),
            ),
            damagePerEpisode: episodes ? sum((r) => r.unseenDamage) / episodes : Number.NaN,
            deaths: sum((r) => r.unseenDeaths),
        },
        smoke: {
            episodes: sum((r) => r.smokeEpisodes),
            reactions: smokeReactions,
            shots: sum((r) => r.smokeShots),
            hits: sum((r) => r.smokeHits),
        },
        lost: {
            episodes: sum((r) => r.lostEpisodes),
            armed: sum((r) => r.lostArmed),
            searched: sum((r) => r.lostSearched),
            found: sum((r) => r.lostFound),
            foundBySearch: sum((r) => r.lostFoundBySearch),
            gaveUp: sum((r) => r.lostGaveUp),
            giveUpP50: quantile(giveUp, 0.5),
            giveUpP90: quantile(giveUp, 0.9),
            findP50: quantile(find, 0.5),
        },
        conceal: {
            open: cs(rs.map((r) => r.conceal.open)),
            canopy: cs(rs.map((r) => r.conceal.canopy)),
            bush: cs(rs.map((r) => r.conceal.bush)),
            canopyShots: sum((r) => r.canopyShots),
            canopyFirstShots: sum((r) => r.canopyFirstShots),
        },
        cover: {
            samples: sum((r) => r.coverSamples),
            near: ratio(
                sum((r) => r.coverNear),
                sum((r) => r.coverSamples),
            ),
            hidden: ratio(
                sum((r) => r.coverHidden),
                sum((r) => r.coverSamples),
            ),
        },
        outfits: { swaps: sum((r) => r.outfitSwaps), unsafe: sum((r) => r.outfitUnsafe) },
        frags: fragStats(
            rs.flatMap((r) => r.frags),
            sum((r) => r.fragChanceSeconds),
            trace,
        ),
    };
}

/** Deliberately started containers over a cell's matches, and the completion rate without real interruptions. */
export interface DeliberateStats extends DeliberateContainers {
    interrupted: number;
    unreachable: number;
    /** broken of started, and broken of started less ongoing, interrupted, unreachable and plated */
    raw: Ratio3;
    completion: Ratio3;
}

export function deliberateStats(list: readonly (DeliberateContainers | undefined)[]): DeliberateStats {
    const out: DeliberateContainers = { started: 0, broken: 0, abandoned: 0, reasons: {}, ongoing: 0, plated: 0 };
    for (const d of list) {
        if (!d) continue;
        out.started += d.started;
        out.broken += d.broken;
        out.abandoned += d.abandoned;
        out.ongoing += d.ongoing;
        out.plated += d.plated;
        merge(out.reasons, d.reasons);
    }
    let interrupted = 0;
    let unreachable = 0;
    for (const [k, v] of Object.entries(out.reasons)) {
        if (INTERRUPTIONS.has(k)) interrupted += v;
        else if (UNREACHABLE.has(k) || k === "plated") unreachable += v;
    }
    const base = out.started - out.ongoing - interrupted - unreachable;
    return {
        ...out,
        interrupted,
        unreachable,
        raw: ratio(out.broken, out.started - out.ongoing),
        completion: ratio(out.broken, base),
    };
}

export type R3Verdict = "PASS" | "FAIL" | "N/A" | "INFO";

export interface R3Line {
    id: string;
    label: string;
    target: string;
    value: string;
    verdict: R3Verdict;
    reports: string;
}

const pct = (r: number) => (Number.isFinite(r) ? `${(r * 100).toFixed(1)}%` : "n/a");
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const fr = (q: Ratio3) => `${pct(q.r)} (${q.n}/${q.d})`;
const v = (ok: boolean): R3Verdict => (ok ? "PASS" : "FAIL");
const kv = (o: Record<string, number>) =>
    Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(", ") || "none";

/** The round 3 and 4 lines of a cell: overall stats, frag stats by tier, the cell's deliberate containers. */
export function round3Lines(
    o: Round3Stats,
    byTier: Readonly<Record<string, { r3: Round3Stats }>>,
    d: DeliberateStats,
): R3Line[] {
    const f = o.frags;
    const line = (
        id: string,
        label: string,
        target: string,
        reports: string,
        value: string,
        verdict: R3Verdict,
    ): R3Line => ({ id, label, target, value, verdict, reports });
    const tiers = SKILL_TIER_NAMES.filter((t) => byTier[t]);
    const tierHit = tiers.map((t) => byTier[t].r3.frags.hit);
    const hitRising =
        tierHit.length === 3 && tierHit.every((h) => h.d >= 20)
            ? v(tierHit[0].r < tierHit[1].r && tierHit[1].r < tierHit[2].r)
            : "N/A";
    const kinds = ["run", "cover", "push"].filter((k) => (o.unseen.move[k] ?? 0) > 0).length;
    const returned = (o.unseen.weapon.return ?? 0) > 0;
    return [
        line(
            "r3-containers",
            "deliberately started containers broken (real interruptions, unreachable, plated left out)",
            ">= 98%",
            "21",
            `${fr(d.completion)}; raw ${fr(d.raw)}; abandoned ${d.abandoned}: ${kv(d.reasons)}; ongoing ${d.ongoing}`,
            d.completion.d < 50 ? "N/A" : v(d.completion.r >= 0.98),
        ),
        line("r3-plated", "plated containers deliberately started", "0", "21", String(d.plated), v(d.plated === 0)),
        line(
            "r3-unseen",
            "unseen-fire episodes answered (run/cover/push/flee, return/hold, or spotting the shooter)",
            ">= 80%, run/cover/push and return all seen",
            "20",
            `${fr(o.unseen.reacted)}; ${kv(o.unseen.reactions)}`,
            o.unseen.episodes < 30 ? "N/A" : v(o.unseen.reacted.r >= 0.8 && kinds === 3 && returned),
        ),
        line(
            "r3-cookoff",
            "frags held too long: burst in the hand, or held 0.5 s past the plan and burst short of the aim",
            "0",
            "24",
            `${f.cookedOff + f.heldTooLong} of ${f.throws} (in the hand ${f.cookedOff}; held ${f.heldLonger} >= 0.3 s past the plan, released ${f.releasedEarly} >= 0.3 s early)`,
            v(f.cookedOff + f.heldTooLong === 0),
        ),
        line(
            "r3-cook-reason",
            "planned cooks without a reason (none, waste, escape, unknown)",
            "0",
            "24",
            `${f.cookedNoReason} of ${f.plannedCooked} planned cooks (${kv(f.reasons)}); ${f.throws - f.plannedCooked} thrown at once`,
            f.plannedCooked < 10 ? "N/A" : v(f.cookedNoReason === 0),
        ),
        line(
            "r3-cook-rest",
            "cooked frags that came to rest on the aim (3 u): seconds before the burst (fuse - flight - margin), p50",
            "<= 1.0 s",
            "24",
            `p50 ${num(f.restOnAim.p50)} s (p10 ${num(f.restOnAim.p10)}, p90 ${num(f.restOnAim.p90)}, n ${f.restOnAim.n}); every cooked frag at rest p50 ${num(f.restCooked.p50)} s (n ${f.restCooked.n}); uncooked p50 ${num(f.restUncooked.p50)} s`,
            f.restOnAim.n < 10 ? "N/A" : v(f.restOnAim.p50 <= 1),
        ),
        line(
            "r3-flee-frags",
            "frags thrown back on the run (escape) released uncooked (minimum 0.1 s hold)",
            ">= 90%",
            "29",
            `${fr(ratio(f.escapeUncooked, f.escape))}; hit ${fr(f.escapeHit)}; any frag let go while running ${f.fleeing}`,
            f.escape < 10 ? "N/A" : v(f.escapeUncooked / f.escape >= 0.9),
        ),
        line(
            "r3-frag-tier",
            "frag hit share by tier (blast hurt an enemy)",
            "strictly increasing",
            "30",
            tiers.map((t, i) => `${t} ${fr(tierHit[i])}`).join(" < "),
            hitRising,
        ),
        line(
            "r3-bush",
            "fire at unrevealed enemies inside a bush (in reach, clear line), share of samples",
            "<= 1%",
            "26",
            fr(o.conceal.bush),
            o.conceal.bush.d < 50 ? "N/A" : v(o.conceal.bush.r <= 0.01),
        ),
        line(
            "r3-canopy",
            "fire at enemies under a canopy: above zero, below the open-ground share",
            "0 < canopy < open",
            "26",
            `canopy ${fr(o.conceal.canopy)} vs open ${fr(o.conceal.open)}; canopy shots ${o.conceal.canopyShots} (first ${o.conceal.canopyFirstShots})`,
            o.conceal.canopy.d < 50 ? "N/A" : v(o.conceal.canopy.r > 0 && o.conceal.canopy.r < o.conceal.open.r),
        ),
        line(
            "r3-outfit-safe",
            "outfit swaps with an enemy in view, hurt or under threat",
            "0",
            "22",
            `${o.outfits.unsafe} of ${o.outfits.swaps}`,
            v(o.outfits.unsafe === 0),
        ),
        line(
            "r3-unseen-detail",
            "unseen fire: reaction latency p50/p90, out of the shooter's line, damage per episode, deaths",
            "monitor",
            "20",
            `${num(o.unseen.latencyP50)} / ${num(o.unseen.latencyP90)} s; safe ${fr(o.unseen.safe)}; ${num(o.unseen.damagePerEpisode, 1)} HP; ${o.unseen.deaths} deaths of ${o.unseen.episodes}; move ${kv(o.unseen.move)}; weapon ${kv(o.unseen.weapon)}`,
            "INFO",
        ),
        line(
            "r3-smoke",
            "fight target in smoke: reactions (spray, frag, hold; shot, none), shots and hits into the smoke",
            "monitor",
            "23",
            `${o.smoke.episodes} episodes: ${kv(o.smoke.reactions)}; shots ${o.smoke.shots}, hits ${o.smoke.hits}`,
            "INFO",
        ),
        line(
            "r3-search",
            "fight target lost from sight: searched, found, given up (s from the loss)",
            "monitor",
            "25",
            `${o.lost.episodes} losses (${o.lost.armed} armed in reach): searched ${o.lost.searched}, found ${o.lost.found} (by a search ${o.lost.foundBySearch}, p50 ${num(o.lost.findP50, 1)} s), search given up ${o.lost.gaveUp} (p50 ${num(o.lost.giveUpP50, 1)} s, p90 ${num(o.lost.giveUpP90, 1)} s)`,
            "INFO",
        ),
        line(
            "r3-cover",
            "fight samples next to cover on the target's line (5 u) / fully out of its line of fire",
            "monitor",
            "19",
            `${fr(o.cover.near)} / ${fr(o.cover.hidden)}`,
            "INFO",
        ),
        line(
            "r3-frags",
            "frags: throws per chance-minute, hit, on target, enemy / own damage per throw, forgot, blocked",
            "monitor",
            "24, 30",
            `${f.throws} (${num(f.perChanceMinute)}/min of ${num(f.chanceMinutes, 0)}); hit ${fr(f.hit)}; on target ${fr(f.onTarget)}; ${num(f.enemyDmgPerThrow, 1)} / ${num(f.ownDmgPerThrow, 1)} HP; forgot ${f.forgot}, blocked ${f.blocked}, sidestep ${f.sidestep}`,
            "INFO",
        ),
    ];
}
