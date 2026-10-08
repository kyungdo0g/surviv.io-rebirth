// 50v50 squad cohesion (BrainFeatures.faction, bot round 6). A squad moves as a unit: the squad leader (the lowest-id
// standing member, team.ts leaderOf) takes the squad to its objective near the front (brain/factionFront.ts: the
// "advance" behaviour) and waits for followers that fall behind; followers keep a formation slot a few units behind
// and beside it, spaced so one grenade or bomb line does not catch two ("rally": the faction's tighter regroup, which it
// replaces). A bot whose squad is down to itself joins the nearest group of faction members instead of fighting
// alone. The no-solo-crossing rule (guardCrossing): nobody goes over the river or a bridge towards a known enemy
// cluster on the far bank without two squadmates beside it; the goal becomes a spot on its own bank by the crossing.
// Until its leader calls it to the front (kitted: factionCtx.ts; the call is the squad board's plan) the squad loots:
// the leader explores, followers loot within a leash a little shorter than the squad regroup's.
import { type Vec2, v2 } from "@rebirth/core";
import type { TeamMemberView } from "@rebirth/sim";
import { crossesRiver, nearestRiverPoint, riverSide } from "../perception/factionMap.ts";
import { addCombatLayer, findCoverFrom } from "./combat.ts";
import { type BehaviourName, type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { FACTION_TUNING, factionOf, kitted } from "./factionCtx.ts";
import { holdSpot, objective, outOfStrikes } from "./factionFront.ts";
import { inStrike } from "./strikes.ts";
import { zonePressure } from "./survival.ts";
import { leaderOf, mates } from "./team.ts";

/** Formation slots behind (along -forward) and beside (along the right) the leader, by follower rank. */
const SLOTS: readonly [back: number, side: number][] = [
    [4, 7],
    [4, -7],
    [9, 0],
    [12, 7],
];
/** Role shifts of a follower's slot along the forward axis: the Marksman behind, the Recon ahead. */
const ROLE_SHIFT: Readonly<Record<string, number>> = { marksman: -8, recon: 8 };
/**
 * A follower rallies when farther than this from its leader: in formation while the leader takes the squad to the
 * front (its call on the squad board is fresh), on a leash a little shorter than the squad regroup's 26 u otherwise...
 */
const RALLY_FAR = 18;
const RALLY_FAR_LOOT = 24;
/** ...until back within this; and hurries when farther than RALLY_URGENT. */
const RALLY_DONE = 9;
const RALLY_DONE_LOOT = 12;
/** The leader's call holds this long after its last advance decision. */
const PLAN_FRESH = 2;
const RALLY_URGENT = 45;
/** A follower holds behind cover within this distance of its slot (facing the front) when it sees some. */
const SLOT_COVER = 5;
/** The slot moves this far before its cover is looked for again. */
const SLOT_COVER_MOVE = 3;
/** In its slot within this distance; scores of walking to the slot and of holding it (above exploring's 0.12). */
const SLOT_TOLERANCE = 3;
const SLOT_SCORE = 0.17;
const HOLD_SCORE = 0.13;
/** The leader: holding the objective (above exploring, below sweeping and looting), and travelling to a far one. */
const ADVANCE_HOLD = 0.16;
const ADVANCE_FAR = 0.3;
const ADVANCE_FAR_DIST = 50;
/** The leader waits for a follower farther than this behind. */
const WAIT_FOR = 30;
/** A lone bot joins faction members within this distance (two or more standing within JOIN_GROUP of each other). */
const JOIN_RANGE = 150;
const JOIN_GROUP = 25;
/** Crossing rule: enemies seen this recently within this distance of the goal or the crossing count as a cluster... */
const CROSS_AGE = 10;
const CROSS_NEAR = 50;
const CROSS_CLUSTER = 2;
/** ...and a crossing needs this many squadmates within CROSS_SUPPORT_NEAR of the bot. */
const CROSS_SUPPORT = 2;
const CROSS_SUPPORT_NEAR = 15;
/** Held back, the bot waits this far from the water on its own bank. */
const CROSS_HOLD = 8;
/** Behaviours the crossing rule leaves alone (getting out of danger, healing, orders). */
const CROSS_FREE = new Set<BehaviourName>([
    "evacuate",
    "flee",
    "disengage",
    "evade",
    "downed",
    "heal",
    "order",
    "idle",
]);
/** The zone rotation crosses anyway when the gas presses this hard (or the bot is in it). */
const CROSS_ZONE_PRESSURE = 0.5;

type Mate = TeamMemberView & { at: Vec2 };

function standingMates(ctx: BrainCtx): Mate[] {
    return mates(ctx).filter((m) => !m.downed);
}

/** A faction member to join for a bot whose squad has nobody standing: the nearest one with company. */
function joinTarget(ctx: BrainCtx): Vec2 | null {
    const fi = factionOf(ctx);
    if (!fi) return null;
    const me = ctx.self.pos;
    let best: Vec2 | null = null;
    let bestD = JOIN_RANGE;
    for (const m of fi.allies()) {
        if (m.playerId === ctx.self.id) continue;
        const d = v2.distance(m.pos, me);
        if (d >= bestD || fi.alliesNear(m.pos, JOIN_GROUP) < 2) continue;
        bestD = d;
        best = m.pos;
    }
    return best;
}

/** followTarget and formation slots, once per decision (scores and plans ask again). */
const followCache = new WeakMap<BrainCtx, { lead: { id: number; at: Vec2 } | null; slot?: Vec2 }>();

/** Who the bot follows: its squad leader, or (squad down to itself) the nearest faction member with company. */
export function followTarget(ctx: BrainCtx): { id: number; at: Vec2 } | null {
    const hit = followCache.get(ctx);
    if (hit) return hit.lead;
    const lead = findFollowTarget(ctx);
    followCache.set(ctx, { lead });
    return lead;
}

function findFollowTarget(ctx: BrainCtx): { id: number; at: Vec2 } | null {
    const leader = leaderOf(ctx);
    if (leader) return { id: leader.playerId, at: leader.at };
    if (standingMates(ctx).length > 0) return null;
    const j = joinTarget(ctx);
    return j ? { id: -1, at: j } : null;
}

/** Unit forward (towards the enemy's side) at `p`: across the river, else towards the squad's objective front. */
function forwardAt(ctx: BrainCtx, p: Vec2): Vec2 {
    const fi = factionOf(ctx);
    const f = fi?.forward(p);
    if (f) return f;
    const front = ctx.mem.faction.front;
    return front ? v2.normalizeSafe(v2.sub(front, p), { x: 1, y: 0 }) : { x: 1, y: 0 };
}

/**
 * A follower's formation slot around its leader at `leaderAt`: its rank among the standing squad (by id, leader left
 * out) picks one of SLOTS, shifted by role; a Medic takes the slot beside the most hurt standing squadmate instead.
 */
export function formationSlot(ctx: BrainCtx, leaderId: number, leaderAt: Vec2): Vec2 {
    const hit = followCache.get(ctx);
    const lead = hit?.lead;
    if (hit?.slot && lead && lead.id === leaderId && lead.at === leaderAt) return hit.slot;
    const slot = computeSlot(ctx, leaderId, leaderAt);
    if (hit && lead && lead.id === leaderId && lead.at === leaderAt) hit.slot = slot;
    return slot;
}

function computeSlot(ctx: BrainCtx, leaderId: number, leaderAt: Vec2): Vec2 {
    const fi = factionOf(ctx);
    const standing = standingMates(ctx);
    const fwd = forwardAt(ctx, leaderAt);
    if (fi?.role === "medic") {
        let hurt: Mate | null = null;
        for (const m of standing) if (m.health < 70 && (!hurt || m.health < hurt.health)) hurt = m;
        if (hurt) return spotNear(ctx, v2.sub(hurt.at, v2.mul(fwd, 2.5)), hurt.at);
    }
    const ids = standing.map((m) => m.playerId);
    ids.push(ctx.self.id);
    const order = ids.filter((id) => id !== leaderId).sort((a, b) => a - b);
    const [back, side] = SLOTS[Math.max(0, order.indexOf(ctx.self.id)) % SLOTS.length];
    const right = { x: fwd.y, y: -fwd.x };
    const along = -back + (ROLE_SHIFT[fi?.role ?? ""] ?? 0);
    return spotNear(ctx, v2.add(leaderAt, v2.add(v2.mul(fwd, along), v2.mul(right, side))), leaderAt);
}

function spotNear(ctx: BrainCtx, p: Vec2, fallback: Vec2): Vec2 {
    const cell = ctx.model.nav.nearestWalkable(p, 4, ctx.myComp);
    return cell >= 0 ? ctx.model.nav.center(cell) : v2.copy(fallback);
}

/** Whether the squad leader `leaderId` calls the squad to the front now (a fresh plan on the squad board). */
export function onCall(ctx: BrainCtx, leaderId: number): boolean {
    const plan = factionOf(ctx)?.squadBoard?.plan;
    return !!plan && plan.leader === leaderId && ctx.now - plan.time < PLAN_FRESH && FACTION_TUNING.formation;
}

/** Utility of keeping formation with the leader (followers, and lone bots joining a group). */
export function rallyScore(ctx: BrainCtx): number {
    const fm = ctx.mem.faction;
    if (!factionOf(ctx)) return 0;
    const lead = followTarget(ctx);
    if (!lead) {
        fm.rallying = false;
        return 0;
    }
    // (an unarmed follower does not walk back into a place it was just chased out of: it arms first; nobody follows a
    // leader into an air strike: the leader is leaving it)
    if (ctx.features.pursuit && ((!ctx.armed && avoidPos(ctx, lead.at)) || inStrike(ctx, lead.at))) return 0;
    const dl = v2.distance(ctx.self.pos, lead.at);
    // in formation only while the leader takes the squad to the front (its call on the squad board)
    const loose = !onCall(ctx, lead.id);
    const far = loose ? RALLY_FAR_LOOT : RALLY_FAR;
    const done = loose ? RALLY_DONE_LOOT : RALLY_DONE;
    if (dl > RALLY_URGENT) {
        fm.rallying = true;
        return 0.62;
    }
    if (dl > far || (fm.rallying && dl > done)) {
        fm.rallying = true;
        return Math.min(0.6, 0.5 + (dl - done) / 150);
    }
    fm.rallying = false;
    // the squad loots: within the leash the follower loots, sweeps and explores like its leader
    if (loose) return 0;
    // a lone bot that reached a group stays with it like a follower; in its slot, holding beats wandering off (but
    // not looting what it sees or sweeping the house it is in: loot from 0.22, sweep 0.2)
    if (lead.id < 0) return HOLD_SCORE;
    const slot = formationSlot(ctx, lead.id, lead.at);
    return v2.distance(ctx.self.pos, slot) > SLOT_TOLERANCE ? SLOT_SCORE : HOLD_SCORE;
}

export function planRally(ctx: BrainCtx): Intent {
    const intent = emptyIntent("rally");
    const lead = followTarget(ctx);
    if (!lead) return intent;
    const front = ctx.mem.faction.front ?? factionOf(ctx)?.front(ctx.now) ?? null;
    const slot = slotCover(ctx, outOfStrikes(ctx, lead.id < 0 ? lead.at : formationSlot(ctx, lead.id, lead.at)), front);
    if (v2.distance(ctx.self.pos, slot) <= SLOT_TOLERANCE) {
        intent.stop = true;
        if (front) intent.lookAt = v2.copy(front);
    } else {
        intent.goal = slot;
        intent.arriveDist = lead.id < 0 ? 6 : 1.5;
    }
    addCombatLayer(ctx, intent);
    return intent;
}

/** The slot, or a cover spot next to it that hides the bot from the front (searched again when the slot moves). */
function slotCover(ctx: BrainCtx, slot: Vec2, front: Vec2 | null): Vec2 {
    if (!front) return slot;
    const fm = ctx.mem.faction;
    if (fm.slotCoverFor && v2.distance(fm.slotCoverFor, slot) < SLOT_COVER_MOVE) return fm.slotCover ?? slot;
    fm.slotCoverFor = v2.copy(slot);
    fm.slotCover = findCoverFrom(ctx.model, slot, front, SLOT_COVER) ?? slot;
    return fm.slotCover;
}

/** The farthest standing squadmate from the bot (the leader waits for it). */
function lag(ctx: BrainCtx): number {
    let far = 0;
    for (const m of standingMates(ctx)) far = Math.max(far, v2.distance(m.at, ctx.self.pos));
    return far;
}

/** Utility of the squad leader taking the squad to its objective near the front. */
export function advanceScore(ctx: BrainCtx): number {
    const fi = factionOf(ctx);
    if (!fi || !FACTION_TUNING.advance || !ctx.armed || leaderOf(ctx) || !kitted(ctx)) return 0;
    // squad down to the bot: it joins a group (rally) when there is one to join
    if (standingMates(ctx).length === 0 && followTarget(ctx)) return 0;
    const obj = objective(ctx, ctx.self.pos);
    if (!obj) return 0;
    if (obj.fallback) return 0.6;
    if (obj.push) return 0.52;
    // an enemy in view is the fight behaviours' business: no marching past it
    if (ctx.visibleEnemies.some((e) => !e.downed)) return ADVANCE_HOLD;
    return v2.distance(ctx.self.pos, obj.pos) > ADVANCE_FAR_DIST ? ADVANCE_FAR : ADVANCE_HOLD;
}

export function planAdvance(ctx: BrainCtx): Intent {
    const intent = emptyIntent("advance");
    const obj = objective(ctx, ctx.self.pos);
    if (!obj) return intent;
    // "on me": the squad's call to follow in formation (factionBoard.ts SquadPlan)
    const sb = factionOf(ctx)?.squadBoard;
    if (sb) sb.plan = { leader: ctx.self.id, objective: obj.pos, front: obj.front, time: ctx.now };
    const spot = holdSpot(ctx, obj);
    const behind = lag(ctx) > WAIT_FOR && !obj.fallback;
    if (behind || v2.distance(ctx.self.pos, spot) <= 1.2) {
        // wait for the squad (or hold the spot), facing the front
        intent.stop = true;
        intent.lookAt = v2.copy(obj.front);
    } else {
        intent.goal = spot;
        intent.arriveDist = 1;
        if (v2.distance(ctx.self.pos, spot) < 12) intent.lookAt = v2.copy(obj.front);
    }
    addCombatLayer(ctx, intent);
    return intent;
}

/** Standing enemies the bot or its squad saw lately on the far bank near `p` or near `q`. */
function farBankEnemies(ctx: BrainCtx, side: number, p: Vec2, q: Vec2): Vec2[] {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    if (!fi || !geo) return [];
    const out: Vec2[] = [];
    const seen = new Set<number>();
    const consider = (id: number, pos: Vec2, time: number, downed: boolean) => {
        if (seen.has(id) || downed || ctx.now - time > CROSS_AGE) return;
        seen.add(id);
        if (riverSide(geo, pos) * side > 0) return;
        if (v2.distance(pos, p) < CROSS_NEAR || v2.distance(pos, q) < CROSS_NEAR) out.push(pos);
    };
    for (const c of ctx.model.contacts.values())
        if (!c.teammate && !c.dead) consider(c.id, c.pos, c.lastSeen, c.downed);
    for (const s of fi.squadBoard?.sightings.values() ?? []) consider(s.id, s.pos, s.time, s.downed);
    return out;
}

/**
 * The no-solo-crossing rule: a goal over the river (or a bridge) towards two or more enemies known on the far bank is
 * replaced by a spot on the bot's own bank by the crossing, facing them, unless two squadmates are beside it (or the
 * gas presses, or the bot is getting out of danger).
 */
export function guardCrossing(ctx: BrainCtx, intent: Intent): void {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    const goal = intent.goal;
    if (!fi || !geo || !goal || !FACTION_TUNING.crossing || CROSS_FREE.has(intent.behaviour)) return;
    const model = ctx.model;
    // the gas comes first: a bot outside the next safe circle rotates in whatever waits over the river
    if (
        intent.behaviour === "zone" &&
        (!model.insideSafeZone(ctx.self.pos) || zonePressure(model) > CROSS_ZONE_PRESSURE)
    )
        return;
    if (model.inGasNow()) return;
    const me = ctx.self.pos;
    if (!crossesRiver(geo, me, goal)) return;
    const mySide = Math.sign(riverSide(geo, me)) || fi.side;
    const crossing = nearestRiverPoint(geo, v2.mul(v2.add(me, goal), 0.5)).point;
    const enemies = farBankEnemies(ctx, mySide, goal, crossing);
    if (enemies.length < CROSS_CLUSTER) return;
    let support = 0;
    for (const m of standingMates(ctx)) if (v2.distance(m.at, me) < CROSS_SUPPORT_NEAR) support++;
    if (support >= CROSS_SUPPORT) return;
    // hold on this bank by the crossing, facing the cluster
    const { point, dir } = nearestRiverPoint(geo, crossing);
    const left = { x: -dir.y, y: dir.x };
    const hold = v2.add(point, v2.mul(left, mySide * (geo.halfWidth + CROSS_HOLD)));
    const cell = model.nav.nearestWalkable(hold, 8, ctx.myComp);
    intent.goal = cell >= 0 ? model.nav.center(cell) : hold;
    intent.arriveDist = 2;
    let cx = 0;
    let cy = 0;
    for (const e of enemies) {
        cx += e.x;
        cy += e.y;
    }
    intent.lookAt = { x: cx / enemies.length, y: cy / enemies.length };
    ctx.mem.faction.crossingsHeld++;
}
