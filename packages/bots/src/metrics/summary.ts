// Summaries of match metrics over many matches (scripts/population.ts, scripts/match.ts --metrics): a compact
// per-match sample (what a worker thread ships back), then per-group statistics (everyone, by skill tier, persona,
// difficulty and mode) and per-cell aggregates (containers, air drops, alive curve, idle, win share and hit rate by
// tier, 50v50 smoke numbers) that the acceptance thresholds (metrics/thresholds.ts) read.
import { SKILL_TIER_NAMES } from "../difficulty.ts";
import type { MatchReport } from "../runner.ts";
import { quantile } from "./episodes.ts";
import { type DeliberateStats, deliberateStats, type Round3Stats, round3Stats } from "./round3Summary.ts";
import { type BotMetrics, CHECKPOINTS, type MatchMetrics } from "./types.ts";

export type SuiteMode = "solo" | "duo" | "squad" | "faction";

/** One match as the suite keeps it. */
export interface MatchSample {
    /** cell: difficulty/brain (e.g. "population/smart") */
    cell: string;
    mode: SuiteMode;
    seed: number;
    gameSeconds: number;
    wallMs: number;
    over: boolean;
    exceptions: number;
    errors: string[];
    winningTeamId: number;
    winners: number[];
    teamKills?: number;
    roles: Record<string, number>;
    players: Array<{
        id: number;
        teamId: number;
        kills: number;
        dead: boolean;
        timeAlive: number;
        bullets: number;
        bulletHits: number;
    }>;
    idle: { episodes: number; seconds: number; over15: number; over15ByBehaviour: Record<string, number> };
    metrics: MatchMetrics;
}

/** The compact sample of a report made with `metrics: true`. */
export function sampleOf(report: MatchReport, cell: string, mode: SuiteMode, seed: number): MatchSample {
    if (!report.metrics) throw new Error("sampleOf: the match ran without metrics");
    const over15 = report.idle.filter((e) => e.duration >= 15);
    const byBehaviour: Record<string, number> = {};
    for (const e of over15) byBehaviour[e.behaviour] = (byBehaviour[e.behaviour] ?? 0) + 1;
    return {
        cell,
        mode,
        seed,
        gameSeconds: report.gameSeconds,
        wallMs: report.wallMs,
        over: report.over,
        exceptions: report.exceptions,
        errors: report.errors.slice(0, 3),
        winningTeamId: report.winningTeamId,
        winners: report.winners,
        ...(report.teamKills !== undefined ? { teamKills: report.teamKills } : {}),
        roles: report.roles,
        players: report.players.map((p) => ({
            id: p.id,
            teamId: p.teamId,
            kills: p.kills,
            dead: p.dead,
            timeAlive: p.timeAlive,
            bullets: p.bullets,
            bulletHits: p.bulletHits,
        })),
        idle: {
            episodes: report.idle.length,
            seconds: report.idle.reduce((a, e) => a + e.duration, 0),
            over15: over15.length,
            over15ByBehaviour: byBehaviour,
        },
        metrics: report.metrics,
    };
}

export interface Ratio {
    n: number;
    d: number;
    /** n / d, NaN without samples */
    r: number;
}

export function ratio(n: number, d: number): Ratio {
    return { n, d, r: d > 0 ? n / d : Number.NaN };
}

export interface LoadoutStats {
    alive: number;
    weakOnly: number;
    pistolOnly: number;
    unarmed: number;
    seesBetter: number;
    /** best-gun tier of the living */
    tiers: Record<string, number>;
    /** the dead by then, and how many of them were weak or unarmed when they died (survivorship) */
    dead: number;
    deadWeakOrUnarmed: number;
}

export interface GroupStats {
    bots: number;
    aliveMinutes: number;
    offScreenShots: Ratio;
    concealedShots: Ratio;
    concealedFirstShots: number;
    offScreenAimStarts: Ratio;
    hiddenAimStarts: Ratio;
    exposure: { n: number; p10: number; p50: number; p90: number; under150: Ratio };
    aimNoFire: Ratio;
    /** reasons of the aims without fire, range reasons per gun class */
    noFire: Record<string, number>;
    containersHit: number;
    containersBroken: number;
    containersAbandoned: number;
    platedHits: number;
    visits: number;
    pickupsPerVisit: number;
    emptyVisits: Ratio;
    pickups: number;
    tierDowngrades: number;
    sTier: Ratio;
    holsterTravel: Ratio;
    pistolInFight: Ratio;
    wrongSlotPistol: Ratio;
    rightGun: Ratio;
    switchesPerFightMinute: number;
    loadout: Record<string, LoadoutStats>;
    chases: number;
    chases30: number;
    chaseMax: number;
    /** p95 of (duration - patience) over chases of 5 s or more, and how many went over patience + 2 s */
    chaseExcessP95: number;
    chasesOverPatience: number;
    /** chases of 30 s or more of an unarmed target */
    chases30Unarmed: number;
    flees: number;
    flees30: number;
    flees60: number;
    fleeMax: number;
    oscSpots: number;
    oscCycles: number;
    oscMaxCycles: number;
    /** bots with a spot of 2 or more cycles (over the threshold) */
    oscOverLimit: number;
    /** behaviour flips back within 3 s per bot-minute alive */
    flipsPerMinute: number;
    revives: number;
    unsafeRevives: number;
    revivesHurt: number;
    revivesSurprised: number;
    kneelOtherSeconds: number;
    fragStartsNear: Ratio;
    fragReleasesNear: Ratio;
    smokeAtFeet: number;
    safeBoostUses: number;
    safeBoostMinutes: number;
    boostsPerSafeMinute: number;
    boostUses: number;
    healUses: number;
    kills: number;
    hitRate: Ratio;
    meanSurvival: number;
    /** wins credited (team modes: a share per member of the winning team) */
    wins: number;
    /** round 3 and 4 (user reports 19-30) */
    r3: Round3Stats;
}

type Row = { m: BotMetrics; s: MatchSample };

function sum(rows: readonly Row[], f: (m: BotMetrics) => number): number {
    let t = 0;
    for (const { m } of rows) t += f(m);
    return t;
}

function loadoutStats(rows: readonly Row[], t: number): LoadoutStats {
    const out: LoadoutStats = {
        alive: 0,
        weakOnly: 0,
        pistolOnly: 0,
        unarmed: 0,
        seesBetter: 0,
        tiers: {},
        dead: 0,
        deadWeakOrUnarmed: 0,
    };
    for (const { m } of rows) {
        const l = m.loadout.find((x) => x.t === t);
        if (!l) continue;
        if (!l.alive) {
            out.dead++;
            if (l.weakOnly || l.unarmed) out.deadWeakOrUnarmed++;
            continue;
        }
        out.alive++;
        if (l.weakOnly) out.weakOnly++;
        if (l.pistolOnly) out.pistolOnly++;
        if (l.unarmed) out.unarmed++;
        if (l.seesBetter) out.seesBetter++;
        out.tiers[l.best] = (out.tiers[l.best] ?? 0) + 1;
    }
    return out;
}

/** Wins credited to a bot of a decided match: 1 in solo, 1 / team size in team modes. */
function winsOf(m: BotMetrics, s: MatchSample): number {
    if (!s.over || s.winningTeamId <= 0) return s.over && s.winners.includes(m.id) ? 1 : 0;
    if (m.teamId !== s.winningTeamId) return 0;
    const size = s.players.filter((p) => p.teamId === s.winningTeamId).length;
    return size ? 1 / size : 0;
}

export function groupStats(rows: readonly Row[]): GroupStats {
    const lat = rows.flatMap(({ m }) => m.exposureLatency);
    const chases = rows.flatMap(({ m }) => m.chases);
    const flees = rows.flatMap(({ m }) => m.flees);
    const noFire: Record<string, number> = {};
    for (const { m } of rows) for (const [k, v] of Object.entries(m.noFire)) noFire[k] = (noFire[k] ?? 0) + v;
    const loadout: Record<string, LoadoutStats> = {};
    for (const t of CHECKPOINTS) loadout[t] = loadoutStats(rows, t);
    const visits = sum(rows, (m) => m.buildingVisits);
    const safeMinutes = sum(rows, (m) => m.safeBoostSeconds) / 60;
    const safeUses = sum(rows, (m) => m.safeBoostUses);
    const fightMinutes = sum(rows, (m) => m.fightSeconds) / 60;
    let kills = 0;
    let bullets = 0;
    let hits = 0;
    let survival = 0;
    let wins = 0;
    for (const { m, s } of rows) {
        const p = s.players.find((x) => x.id === m.id);
        if (p) {
            kills += p.kills;
            bullets += p.bullets;
            hits += p.bulletHits;
            survival += p.timeAlive;
        }
        wins += winsOf(m, s);
    }
    return {
        bots: rows.length,
        aliveMinutes: sum(rows, (m) => m.aliveSeconds) / 60,
        offScreenShots: ratio(
            sum(rows, (m) => m.offScreenShots),
            sum(rows, (m) => m.targetedShots),
        ),
        concealedShots: ratio(
            sum(rows, (m) => m.concealedShots),
            sum(rows, (m) => m.targetedShots),
        ),
        concealedFirstShots: sum(rows, (m) => m.concealedFirstShots),
        offScreenAimStarts: ratio(
            sum(rows, (m) => m.offScreenAimStarts),
            sum(rows, (m) => m.aimStarts),
        ),
        hiddenAimStarts: ratio(
            sum(rows, (m) => m.hiddenAimStarts),
            sum(rows, (m) => m.aimStarts),
        ),
        exposure: {
            n: lat.length,
            p10: quantile(lat, 0.1),
            p50: quantile(lat, 0.5),
            p90: quantile(lat, 0.9),
            under150: ratio(lat.filter((x) => x < 0.15).length, lat.length),
        },
        aimNoFire: ratio(
            sum(rows, (m) => m.aimNoFire),
            sum(rows, (m) => m.aimSamples),
        ),
        noFire,
        containersHit: sum(rows, (m) => m.containersHit),
        containersBroken: sum(rows, (m) => m.containersBroken),
        containersAbandoned: sum(rows, (m) => m.containersAbandoned),
        platedHits: sum(rows, (m) => m.platedHits),
        visits,
        pickupsPerVisit: visits ? sum(rows, (m) => m.visitPickups) / visits : Number.NaN,
        emptyVisits: ratio(
            sum(rows, (m) => m.emptyVisits),
            visits,
        ),
        pickups: sum(rows, (m) => m.pickups),
        tierDowngrades: sum(rows, (m) => m.tierDowngrades),
        sTier: ratio(
            sum(rows, (m) => m.sTierTaken),
            sum(rows, (m) => m.sTierSeen),
        ),
        holsterTravel: ratio(
            sum(rows, (m) => m.travelHolstered),
            sum(rows, (m) => m.travelSamples),
        ),
        pistolInFight: ratio(
            sum(rows, (m) => m.fightPistol),
            sum(rows, (m) => m.fightGunSamples),
        ),
        wrongSlotPistol: ratio(
            sum(rows, (m) => m.wrongSlotPistol),
            sum(rows, (m) => m.fightGunSamples),
        ),
        rightGun: ratio(
            sum(rows, (m) => m.rightGun),
            sum(rows, (m) => m.twoGunSamples),
        ),
        switchesPerFightMinute: fightMinutes > 0 ? sum(rows, (m) => m.fightSwitches) / fightMinutes : Number.NaN,
        loadout,
        chases: chases.length,
        chases30: chases.filter((c) => c.duration >= 30).length,
        chaseMax: chases.reduce((a, c) => Math.max(a, c.duration), 0),
        chaseExcessP95: quantile(
            chases.map((c) => c.duration - c.patience),
            0.95,
        ),
        chasesOverPatience: chases.filter((c) => c.duration > c.patience + 2).length,
        chases30Unarmed: chases.filter((c) => c.duration >= 30 && c.unarmedTarget).length,
        flees: flees.length,
        flees30: flees.filter((d) => d >= 30).length,
        flees60: flees.filter((d) => d >= 60).length,
        fleeMax: flees.reduce((a, d) => Math.max(a, d), 0),
        oscSpots: sum(rows, (m) => m.oscSpots),
        oscCycles: sum(rows, (m) => m.oscCycles),
        oscMaxCycles: rows.reduce((a, { m }) => Math.max(a, m.oscMaxCycles), 0),
        oscOverLimit: rows.filter(({ m }) => m.oscMaxCycles > 1).length,
        flipsPerMinute: (() => {
            const minutes = sum(rows, (m) => m.aliveSeconds) / 60;
            return minutes > 0 ? sum(rows, (m) => m.flips) / minutes : Number.NaN;
        })(),
        revives: sum(rows, (m) => m.revives),
        unsafeRevives: sum(rows, (m) => m.unsafeRevives),
        revivesHurt: sum(rows, (m) => m.revivesHurt ?? 0),
        revivesSurprised: sum(rows, (m) => m.revivesSurprised ?? 0),
        kneelOtherSeconds: sum(rows, (m) => m.kneelOtherSeconds ?? 0),
        fragStartsNear: ratio(
            sum(rows, (m) => m.fragStartsNear),
            sum(rows, (m) => m.fragStarts),
        ),
        fragReleasesNear: ratio(
            sum(rows, (m) => m.fragReleasesNear),
            sum(rows, (m) => m.fragReleases),
        ),
        smokeAtFeet: sum(rows, (m) => m.smokeAtFeet),
        safeBoostUses: safeUses,
        safeBoostMinutes: safeMinutes,
        boostsPerSafeMinute: safeMinutes > 0 ? safeUses / safeMinutes : Number.NaN,
        boostUses: sum(rows, (m) => m.boostUses),
        healUses: sum(rows, (m) => m.healUses),
        kills,
        hitRate: ratio(hits, bullets),
        meanSurvival: rows.length ? survival / rows.length : Number.NaN,
        wins,
        r3: round3Stats(rows.map((r) => r.m)),
    };
}

export interface CellSummary {
    cell: string;
    matches: number;
    /** matches with a winner */
    decided: number;
    modes: Record<string, number>;
    exceptions: number;
    errors: string[];
    gameSeconds: number;
    wallSeconds: number;
    overall: GroupStats;
    byTier: Record<string, GroupStats>;
    byPersona: Record<string, GroupStats>;
    byDifficulty: Record<string, GroupStats>;
    byMode: Record<string, GroupStats>;
    /** per match: chases of 30 s or more, containers abandoned, plated containers hit, idle episodes of 15 s or more */
    perMatch: { chases30: number; abandoned: number; plated: number; idle15: number };
    containers: { hit: number; broken: number; abandoned: number; plated: number };
    airdrops: { landed: number; opened: number; innerBroken: number; looted: number; openDelayP50: number };
    /** mean share of the starting bots alive at each sampled time (a match that ended counts its final living) */
    alive: Array<{ t: number; share: number }>;
    idle: { episodes: number; seconds: number; over15: number; over15ByBehaviour: Record<string, number> };
    /** win share by skill tier over decided matches (team modes: a share per member of the winning team) */
    winShare: Record<string, number>;
    hitRateByTier: Record<string, Ratio>;
    faction?: { matches: number; teamKills: number; roles: Record<string, number>; front: number; spread: number };
    /** deliberately started containers (round 3, user report 21) */
    deliberate: DeliberateStats;
}

function groupBy(rows: readonly Row[], key: (r: Row) => string): Record<string, GroupStats> {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
        const k = key(r);
        const list = map.get(k) ?? [];
        list.push(r);
        map.set(k, list);
    }
    const out: Record<string, GroupStats> = {};
    for (const [k, list] of [...map].sort((a, b) => a[0].localeCompare(b[0]))) out[k] = groupStats(list);
    return out;
}

export function summarizeCell(cell: string, samples: readonly MatchSample[]): CellSummary {
    const rows: Row[] = samples.flatMap((s) => s.metrics.bots.map((m) => ({ m, s })));
    const n = samples.length;
    const modes: Record<string, number> = {};
    for (const s of samples) modes[s.mode] = (modes[s.mode] ?? 0) + 1;
    const overall = groupStats(rows);
    const byTier = groupBy(rows, (r) => r.m.tier);
    const decided = samples.filter((s) => s.over).length;
    const winShare: Record<string, number> = {};
    const hitRateByTier: Record<string, Ratio> = {};
    for (const t of SKILL_TIER_NAMES) {
        if (!byTier[t]) continue;
        winShare[t] = decided ? byTier[t].wins / decided : Number.NaN;
        hitRateByTier[t] = byTier[t].hitRate;
    }
    const drops = samples.flatMap((s) => s.metrics.airdrops);
    const opened = drops.filter((d) => d.openedAt >= 0);
    const steps = [...new Set(samples.flatMap((s) => s.metrics.alive.map((a) => a.t)))].sort((a, b) => a - b);
    const alive = steps.map((t) => {
        let share = 0;
        for (const s of samples) {
            const at = s.metrics.alive.find((a) => a.t === t);
            const left = at ? at.alive : s.players.filter((p) => !p.dead).length;
            share += left / Math.max(1, s.players.length);
        }
        return { t, share: share / Math.max(1, n) };
    });
    const idleBy: Record<string, number> = {};
    for (const s of samples)
        for (const [k, v] of Object.entries(s.idle.over15ByBehaviour)) idleBy[k] = (idleBy[k] ?? 0) + v;
    const faction = samples.filter((s) => s.mode === "faction");
    const roles: Record<string, number> = {};
    for (const s of faction) for (const [k, v] of Object.entries(s.roles)) roles[k] = (roles[k] ?? 0) + v;
    const fronts = faction.flatMap((s) => s.metrics.faction ?? []);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
    return {
        cell,
        matches: n,
        decided,
        modes,
        exceptions: samples.reduce((a, s) => a + s.exceptions, 0),
        errors: samples.flatMap((s) => s.errors).slice(0, 5),
        gameSeconds: mean(samples.map((s) => s.gameSeconds)),
        wallSeconds: mean(samples.map((s) => s.wallMs / 1000)),
        overall,
        byTier,
        byPersona: groupBy(rows, (r) => r.m.persona),
        byDifficulty: groupBy(rows, (r) => r.m.difficulty),
        byMode: groupBy(rows, (r) => r.s.mode),
        perMatch: {
            chases30: n ? overall.chases30 / n : Number.NaN,
            abandoned: n ? samples.reduce((a, s) => a + s.metrics.containers.abandoned, 0) / n : Number.NaN,
            plated: n ? samples.reduce((a, s) => a + s.metrics.containers.plated, 0) / n : Number.NaN,
            idle15: n ? samples.reduce((a, s) => a + s.idle.over15, 0) / n : Number.NaN,
        },
        containers: {
            hit: samples.reduce((a, s) => a + s.metrics.containers.hit, 0),
            broken: samples.reduce((a, s) => a + s.metrics.containers.broken, 0),
            abandoned: samples.reduce((a, s) => a + s.metrics.containers.abandoned, 0),
            plated: samples.reduce((a, s) => a + s.metrics.containers.plated, 0),
        },
        airdrops: {
            landed: drops.length,
            opened: opened.length,
            innerBroken: drops.filter((d) => d.innerBrokenAt >= 0).length,
            looted: drops.filter((d) => d.lootedAt >= 0).length,
            openDelayP50: quantile(
                opened.map((d) => d.openedAt - d.landedAt),
                0.5,
            ),
        },
        alive,
        idle: {
            episodes: samples.reduce((a, s) => a + s.idle.episodes, 0),
            seconds: samples.reduce((a, s) => a + s.idle.seconds, 0),
            over15: samples.reduce((a, s) => a + s.idle.over15, 0),
            over15ByBehaviour: idleBy,
        },
        winShare,
        hitRateByTier,
        deliberate: deliberateStats(samples.map((s) => s.metrics.deliberate)),
        ...(faction.length
            ? {
                  faction: {
                      matches: faction.length,
                      teamKills: faction.reduce((a, s) => a + (s.teamKills ?? 0), 0),
                      roles,
                      front: mean(fronts.map((f) => f.front)),
                      spread: mean(fronts.map((f) => f.spread)),
                  },
              }
            : {}),
    };
}
