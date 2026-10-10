// Shared helpers of the 50v50 faction brain (BrainFeatures.faction, bot round 6): whether it runs (the flag on, on a
// faction map, the faction known), the bot's local numbers (standing allies against the enemies it and its squad saw
// lately: the push / fall back test), whether it is kitted for the front, and its memory between decisions.
import type { Vec2 } from "@rebirth/core";
import { hasAmmo } from "../knowledge/arsenal.ts";
import { gunRank, tierRank } from "../knowledge/gunTiers.ts";
import type { FactionIntel } from "../perception/factionIntel.ts";
import type { BrainCtx } from "./context.ts";

/** Local numbers count standing allies and enemies within this radius... */
export const ODDS_RANGE = 35;
/** ...enemies seen (by the bot or its squad) this recently. */
export const ODDS_AGE = 6;
/** Kitted: a gun of this tier or better with KIT_MAGS magazines' worth in all, some armour and a heal or two. */
const KIT_TIER = tierRank("B-");
const KIT_MAGS = 2;
const KIT_BANDAGES = 2;
/** From this gas circle on everybody goes to the front, kitted or not. */
const KIT_CIRCLE = 3;

/**
 * The faction brain's parts, each on by default (scripts/factionAb.ts turns single parts off for ablations; bots never
 * change them): the objective's push and fall back, the follower formation, the leader's advance to the front, the
 * no-solo-crossing rule, the local-numbers fight adjustment, reviving faction members outside the squad, the role
 * actions, the rally to the Commander and the river discipline.
 */
export const FACTION_TUNING = {
    push: true,
    fallback: true,
    formation: true,
    advance: true,
    crossing: true,
    fightOdds: true,
    /** outnumbered, an unprovoked fight is capped (off: it held fire in front of enemies in big battles) */
    outnumberedCap: false,
    factionRevive: true,
    roles: true,
    /** owner 2026-10-08: most of the faction rallies to its Commander (factionRally.ts) */
    rally: true,
    /** owner 2026-10-08: bank spots out of the water, no idling in it (factionRiver.ts) */
    dry: true,
};

/** The faction knowledge when the faction brain runs for this bot: flag on, faction map, faction known. */
export function factionOf(ctx: BrainCtx): FactionIntel | null {
    if (!ctx.features.faction) return null;
    const f = ctx.model.faction;
    return f?.active && f.team ? f : null;
}

export interface Odds {
    /** standing faction members within ODDS_RANGE, the bot included */
    allies: number;
    /** standing enemies seen within ODDS_RANGE in the last ODDS_AGE seconds */
    enemies: number;
}

const oddsCache = new WeakMap<BrainCtx, Odds>();

/** Local numbers around the bot (or around `at`), cached per decision for the bot's own position. */
export function localOdds(ctx: BrainCtx, at?: Vec2): Odds {
    const fi = factionOf(ctx);
    if (!fi) return { allies: 1, enemies: 0 };
    if (!at) {
        const hit = oddsCache.get(ctx);
        if (hit) return hit;
    }
    const p = at ?? ctx.self.pos;
    const odds = {
        allies: 1 + fi.alliesNear(p, ODDS_RANGE),
        enemies: fi.enemiesNear(ctx.model, p, ODDS_RANGE, ODDS_AGE),
    };
    if (!at) oddsCache.set(ctx, odds);
    return odds;
}

/** Local numbers favour a push: at least 1.5 allies per enemy, three standing at least, someone to push at. */
export function favourable(o: Odds): boolean {
    return o.enemies > 0 && o.allies >= 3 && o.allies >= 1.5 * o.enemies;
}

/** Clearly outnumbered: two enemies or more, at least 1.4 per standing ally. */
export function outnumbered(o: Odds): boolean {
    return o.enemies >= 2 && o.enemies >= 1.4 * o.allies;
}

/**
 * Ready for the front: a decent gun with two magazines' worth of rounds, a helmet or a vest, and a heal (a med kit or
 * a couple of bandages); or the zone has moved on. Until then the squad loots its side (factionSquad.ts).
 */
export function kitted(ctx: BrainCtx): boolean {
    if ((ctx.model.gas?.circleIdx ?? 0) >= KIT_CIRCLE) return true;
    const self = ctx.self;
    if (!self.helmet && !self.chest) return false;
    const inv = self.inventory;
    if ((inv.healthkit ?? 0) < 1 && (inv.bandage ?? 0) < KIT_BANDAGES) return false;
    for (const g of ctx.guns) {
        if (!hasAmmo(g) || gunRank(g.info.id) < KIT_TIER) continue;
        if (g.mag + g.reserve >= g.info.def.maxClip * KIT_MAGS) return true;
    }
    return false;
}

/** A role the bot holds ("" for none). */
export function roleOf(ctx: BrainCtx): string {
    return factionOf(ctx)?.role ?? "";
}
