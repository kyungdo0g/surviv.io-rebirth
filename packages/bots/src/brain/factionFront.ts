// The 50v50 front (BrainFeatures.faction, bot round 6): where a squad goes when nothing more urgent calls. The front is
// where the bot's squad saw its enemies lately, else where its faction has been fighting (knocks, deaths and kills on
// the faction minimap, Commander pings: perception/factionBoard.ts), else the river bank on the faction's side (the
// map splits Red and Blue along the main river and most fights happen at it and its bridges: docs/research/modes/
// faction.md "Map"). The squad holds a spot on its side of that front, set back by role: the Commander stays a little
// behind (items/roles.md "leader"), a Marksman farther back on a long angle, a Recon up front. Local numbers move the
// spot: with 1.5 allies per enemy around the squad pushes onto the enemy, clearly outnumbered it falls back. One squad
// in four flanks: its spot slides along the river towards the bridge beside the main fight. The spot is kept inside
// the next safe circle and moved behind cover from the front once the bot can see some near it.
// Owner report 2026-10-08 (the faction's bots stood in the river): the spot never lies in the river. The bank spot is
// measured from the riverbank's true edge (perception/factionMap.ts), and a spot the setback puts in the water or on
// its open riverbank (a front across the river, a push onto enemies over it) moves back onto the squad's bank, past
// the riverbank, on a dry cell (factionRiver.ts); a push onto the far bank itself still crosses.
import { type Vec2, v2 } from "@rebirth/core";
import { nearestBridge, nearestRiverPoint, riverSide, waterHalfAt } from "../perception/factionMap.ts";
import { findCoverFrom } from "./combat.ts";
import type { BrainCtx } from "./context.ts";
import { FACTION_TUNING, factionOf, favourable, localOdds, type Odds, outnumbered } from "./factionCtx.ts";
import { BANK_CLEAR, dryCover, dryOn, drySpot } from "./factionRiver.ts";
import { inStrike, strikeDangers } from "./strikes.ts";

/**
 * Facing known enemies the squad holds this far from them: rifle range, where the fight behaviours take over from
 * cover (walking up to within a few units of them in the open lost the fights: A/B round 6); a push closes to
 * PUSH_SETBACK, a fall back opens to FALLBACK_SETBACK.
 */
const CONTACT_SETBACK = 24;
const PUSH_SETBACK = 12;
const FALLBACK_SETBACK = 48;
/** Holding at the bank with no enemy known: this far back from the riverbank's outer edge (the water and its sand). */
const BANK_SETBACK = 6;
/** Each role's extra setback (u): the Commander a little behind, the Marksman on a long angle, the Recon ahead. */
const ROLE_SETBACK: Readonly<Record<string, number>> = {
    leader: 6,
    captain: 6,
    marksman: 16,
    medic: 6,
    recon: -8,
    bugler: 2,
};
/** A bridge this close to the bank point is the place to hold (a choke point); farther, the squad's own bank spot. */
const BRIDGE_PULL = 40;
/** An objective in an air strike moves this far past the strike's edge. */
const STRIKE_CLEAR = 4;
/** Flanking squads hold this far along the river from the main front. */
const FLANK_OFFSET = 55;
/** One squad in FLANK_EVERY flanks. */
const FLANK_EVERY = 4;
/** The objective is chosen again at most this often (s). */
const OBJECTIVE_EVERY = 2.5;
/** Enemies around the front count within this radius, seen this recently. */
const FRONT_RANGE = 40;
const FRONT_AGE = 8;
/** The objective keeps this far inside the next safe circle. */
const ZONE_MARGIN = 12;
/** Cover is looked for within this distance of the objective once the bot is this close to it. */
const COVER_RANGE = 12;
const COVER_NEAR = 30;

export interface Objective {
    pos: Vec2;
    /** where the enemy is (or the river, without one): the bot faces it while it holds */
    front: Vec2;
    push: boolean;
    fallback: boolean;
}

/** Whether the bot's squad is one of the flanking ones (one in FLANK_EVERY, by squad id). */
export function flankSquad(group: number): boolean {
    return group > 0 && group % FLANK_EVERY === 1;
}

/** The front with no enemy known: the bank of the main river (a bridge near it) on the faction's side, near `p`. */
export function defaultFront(ctx: BrainCtx, p: Vec2): Vec2 {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    if (!geo) return v2.copy(ctx.model.gas?.posNew ?? p);
    const bank = nearestRiverPoint(geo, p).point;
    const bridge = nearestBridge(geo, bank);
    return bridge && v2.distance(bridge, bank) < BRIDGE_PULL ? v2.copy(bridge) : bank;
}

/** `p` pulled inside the next safe circle (`margin` inside its edge). */
export function inZone(ctx: BrainCtx, p: Vec2, margin = ZONE_MARGIN): Vec2 {
    const gas = ctx.model.gas;
    if (!gas || gas.mode === "inactive") return p;
    const off = v2.sub(p, gas.posNew);
    const d = v2.length(off);
    const max = Math.max(0, gas.radNew - margin);
    return d <= max ? p : v2.add(gas.posNew, v2.mul(off, max / Math.max(d, 1e-6)));
}

/**
 * The squad's objective now: the hold spot on the faction's side of the front for the bot's role, pushed onto the
 * enemy or pulled back by the local numbers around `anchor` (the squad leader). Recomputed every OBJECTIVE_EVERY.
 */
export function objective(ctx: BrainCtx, anchor: Vec2): Objective | null {
    const fi = factionOf(ctx);
    if (!fi) return null;
    const fm = ctx.mem.faction;
    // (a strike announced over the kept objective sends the squad elsewhere at once)
    if (fm.objective && fm.front && ctx.now - fm.objectiveAt < OBJECTIVE_EVERY && !inStrike(ctx, fm.objective))
        return { pos: fm.objective, front: fm.front, push: fm.push, fallback: fm.fallback };
    const known = fi.front(ctx.now, undefined, anchor);
    const front = known ?? defaultFront(ctx, anchor);
    const fwd = fi.forward(front) ?? v2.normalizeSafe(v2.sub(front, anchor), { x: 1, y: 0 });
    // local numbers: the allies around the squad against the enemies around the front
    const odds: Odds = known
        ? { allies: localOdds(ctx, anchor).allies, enemies: fi.enemiesNear(ctx.model, front, FRONT_RANGE, FRONT_AGE) }
        : { allies: 1, enemies: 0 };
    const role = fi.role;
    const push = FACTION_TUNING.push && known !== null && favourable(odds) && role !== "marksman" && role !== "medic";
    const fallback = FACTION_TUNING.fallback && known !== null && outnumbered(odds) && role !== "last_man";
    const extra = ROLE_SETBACK[role] ?? 0;
    let setback = push ? PUSH_SETBACK : fallback ? FALLBACK_SETBACK : CONTACT_SETBACK + extra;
    if (!known) {
        const bank = fi.geo ? nearestRiverPoint(fi.geo, front).bank : CONTACT_SETBACK - BANK_SETBACK;
        setback = bank + BANK_SETBACK + Math.max(BANK_CLEAR - BANK_SETBACK, extra);
    }
    let pos = v2.sub(front, v2.mul(fwd, setback));
    if (!push && !fallback && flankSquad(fi.group)) {
        const lateral = { x: -fwd.y, y: fwd.x };
        const sign = fi.group % 2 === 0 ? 1 : -1;
        pos = v2.add(pos, v2.mul(lateral, sign * FLANK_OFFSET));
    }
    pos = offRiver(ctx, outOfStrikes(ctx, inZone(ctx, clampToMap(ctx, pos))), anchor, push);
    pos = drySpot(ctx, pos, 10);
    fm.objective = pos;
    fm.objectiveAt = ctx.now;
    fm.front = front;
    fm.push = push;
    fm.fallback = fallback;
    return { pos, front, push, fallback };
}

/**
 * `p` out of the main river: a spot in its water or on its riverbank, or a hold over on the other bank, moves past the
 * riverbank onto the bank `anchor` stands on (the faction's own while the anchor is in the water; always the own one
 * for the Commander), or onto the other bank when only that one is inside the next safe circle; a spot neither bank
 * keeps in the circle stays where the zone put it. A push onto the other bank itself crosses (quickly, attacking: the
 * crossing rule still wants company).
 */
function offRiver(ctx: BrainCtx, p: Vec2, anchor: Vec2, push: boolean): Vec2 {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    if (!fi || !geo || !FACTION_TUNING.dry) return p;
    const sa = riverSide(geo, anchor);
    let side = Math.abs(sa) > waterHalfAt(geo, anchor) ? Math.sign(sa) : fi.side || Math.sign(sa) || 1;
    // the Commander holds its own bank, where its group forms (factionRally.ts bankOf), unless it attacks over there
    if (!push && fi.side && fi.role === "leader" && FACTION_TUNING.rally) side = fi.side;
    if (push && riverSide(geo, p) * side < -(nearestRiverPoint(geo, p).bank + BANK_CLEAR)) return p;
    const out = dryOn(ctx, p, side);
    if (out === p || ctx.model.insideSafeZone(out)) return out;
    const other = dryOn(ctx, p, -side);
    return ctx.model.insideSafeZone(other) ? other : p;
}

/** `p` moved out of the air strikes the bot knows of (past each one's edge, away from its centre). */
export function outOfStrikes(ctx: BrainCtx, p: Vec2): Vec2 {
    let out = p;
    for (const d of strikeDangers(ctx)) {
        if (v2.distance(out, d.pos) >= d.rad) continue;
        const away = v2.normalizeSafe(
            v2.sub(out, d.pos),
            v2.normalizeSafe(v2.sub(ctx.self.pos, d.pos), { x: 1, y: 0 }),
        );
        out = v2.add(d.pos, v2.mul(away, d.rad + STRIKE_CLEAR));
    }
    return out;
}

function clampToMap(ctx: BrainCtx, p: Vec2): Vec2 {
    const m = ctx.model.map;
    const inset = m.shoreInset + 6;
    return {
        x: Math.min(m.width - inset, Math.max(inset, p.x)),
        y: Math.min(m.height - inset, Math.max(inset, p.y)),
    };
}

/**
 * The spot to hold at the objective: behind cover from the front when the bot sees some within COVER_RANGE of it (the
 * search runs once the bot is within COVER_NEAR, and once per objective), else the objective itself.
 */
export function holdSpot(ctx: BrainCtx, obj: Objective): Vec2 {
    const fm = ctx.mem.faction;
    if (fm.cover && fm.coverFor && v2.distance(fm.coverFor, obj.pos) < 1) return fm.cover;
    if (v2.distance(ctx.self.pos, obj.pos) > COVER_NEAR) return obj.pos;
    // (never behind a river stone in the water: factionRiver.ts dryCover)
    const cover = obj.push ? null : findCoverFrom(ctx.model, obj.pos, obj.front, COVER_RANGE, dryCover(ctx));
    fm.cover = cover ?? obj.pos;
    fm.coverFor = v2.copy(obj.pos);
    return fm.cover;
}
