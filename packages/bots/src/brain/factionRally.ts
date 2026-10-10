// 50v50: the faction rallies to its Commander (owner ruling 2026-10-08, rebirth-deviations.md "Bots at the river and
// around the Commander"). Once the faction has a Commander (the 50 s promotion: sim roles/roleRules.ts; the faction
// minimap rows carry every member's role), most of its bots go to it and form a loose group around it: rings of
// slots 7-22 u out, spaced 5-7 u apart (not a clump: one grenade or bomb line catches one or two), each slot behind
// cover from the front when there is some next to it, out of the river on the faction's own bank (factionRiver.ts;
// over the river only with a Commander that attacks there). They follow it when it moves (the slots move with it; the
// Commander waits for its group before it takes it to the front), close in around it when it is knocked
// (factionRevive.ts sends the two nearest to revive it), and once its flare's air drop is known near it (the automatic
// flare: sim roles/roleSystem.ts) the group forms around the drop with it. A minority keeps to itself: a draw per bot
// by persona (most rats, many campers and looters, a few of the others; about a quarter of the server's mix and of
// neutral bots) and every Recon (it scouts) go on looting, scouting and holding the front on their own. Medics and
// Buglers always rally (their perks need allies around them). The squads stay what they were before the Commander and
// are again once it is gone.
import { type Vec2, v2 } from "@rebirth/core";
import { riverSide, waterHalfAt } from "../perception/factionMap.ts";
import type { BrainCtx } from "./context.ts";
import { FACTION_TUNING, factionOf } from "./factionCtx.ts";
import { inZone } from "./factionFront.ts";
import { dryOn, drySpot, inWater } from "./factionRiver.ts";

/** The Commander's role id (survev role "leader"). */
const COMMANDER = "leader";
/** Chance of keeping to itself, by persona (the server's mix gives about 26 %, neutral bots 25 %). */
const INDEPENDENT: Readonly<Record<string, number>> = {
    rat: 0.8,
    camper: 0.6,
    looter: 0.4,
    marksman: 0.15,
    rifleman: 0.1,
    rusher: 0.08,
    neutral: 0.25,
};
/** Roles that always keep to themselves (scouting) and that always rally (their perks work on allies around them). */
const SCOUT_ROLES = new Set(["recon"]);
const SUPPORT_ROLES = new Set(["medic", "bugler"]);
/** Slot rings around the Commander: radius (u) and slot count; 56 slots for the 49 other members of a faction. */
const RINGS: readonly [radius: number, count: number][] = [
    [7, 8],
    [12, 12],
    [17, 16],
    [22, 20],
];
/** The Marksman's slot lies this much farther out (a long angle from the edge of the group). */
const MARKSMAN_OUT = 6;
/** Around a knocked Commander the rings close in to this share of their radius, at least GUARD_MIN out. */
const GUARD_SHRINK = 0.45;
const GUARD_MIN = 5;
/** An air drop known this close to the Commander (its flare's), not opened yet and this fresh, is the rally point. */
const DROP_NEAR = 50;
const DROP_FRESH = 120;
/** The Commander's call holds this long after its last advance decision (factionSquad.ts PLAN_FRESH). */
const CALL_FRESH = 2;
/** Slots keep this far inside the next safe circle (while the rally point is inside it). */
const SLOT_ZONE_MARGIN = 4;
/**
 * The Commander goes to the front once this share of the faction's standing members (GATHER_MAX at most) stands within
 * GATHER_NEAR of it, and waits again when fewer than half that keep up; it waits GATHER_PATIENCE at most, then goes on
 * for GATHER_GO whatever the group does. (With the 5 allies it waited for before, it left most of its group behind:
 * seed 11 had 6-21 of 40 rallying bots within 40 u of a Commander walking to the river at 6 u/s, 60-100 s in.)
 */
const GATHER_SHARE = 0.3;
const GATHER_MAX = 12;
const GATHER_NEAR = 35;
const GATHER_PATIENCE = 25;
const GATHER_GO = 15;

export interface Commander {
    id: number;
    /** freshest position: in view, else the faction minimap's */
    at: Vec2;
    downed: boolean;
}

/** Whether the bot is its faction's Commander. */
export function isCommander(ctx: BrainCtx): boolean {
    return factionOf(ctx)?.role === COMMANDER;
}

/** The faction's living Commander other than the bot (standing or knocked), from the faction minimap rows. */
export function commanderOf(ctx: BrainCtx): Commander | null {
    const hit = cmdCache.get(ctx);
    if (hit !== undefined) return hit;
    const cmd = findCommander(ctx);
    cmdCache.set(ctx, cmd);
    return cmd;
}

/** commanderOf once per decision (scores, plans and the revive pick ask again). */
const cmdCache = new WeakMap<BrainCtx, Commander | null>();

function findCommander(ctx: BrainCtx): Commander | null {
    const fi = factionOf(ctx);
    const fb = fi?.factionBoard;
    if (!fi || !fb || !FACTION_TUNING.rally || fi.role === COMMANDER) return null;
    for (const m of fb.members.values()) {
        if (m.role !== COMMANDER || m.dead || m.playerId === ctx.self.id) continue;
        const c = ctx.model.contacts.get(m.playerId);
        const at = c?.visible && !c.dead ? c.pos : m.pos;
        return { id: m.playerId, at: v2.copy(at), downed: c?.visible ? c.downed : m.downed };
    }
    return null;
}

/** A unit number from the bot's id (deterministic, no rng stream touched). */
function unitOf(id: number): number {
    let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** Whether the bot keeps to itself instead of rallying (the persona's draw, scouts always, support roles never). */
export function independent(ctx: BrainCtx): boolean {
    return keepsToItself(ctx.self.id, ctx.persona.name, factionOf(ctx)?.role ?? "");
}

/** independent() from the bot's id, persona name and role (also read by scripts/factionRallyLib.ts). */
export function keepsToItself(id: number, persona: string, role: string): boolean {
    if (SCOUT_ROLES.has(role)) return true;
    if (SUPPORT_ROLES.has(role)) return false;
    return unitOf(id) < (INDEPENDENT[persona] ?? INDEPENDENT.neutral);
}

/** The Commander the bot rallies to, or null (no Commander, the bot is it, or the bot keeps to itself). */
export function rallyCommander(ctx: BrainCtx): Commander | null {
    const cmd = commanderOf(ctx);
    return cmd && !independent(ctx) ? cmd : null;
}

/**
 * A bot of the minority once the faction has a Commander: it keeps to itself, with the squadmates that keep to
 * themselves too (each tells its squad whether it rallies: SquadBoard.rallies). Files its own answer.
 */
export function onItsOwn(ctx: BrainCtx): boolean {
    const own = commanderOf(ctx) !== null && independent(ctx);
    factionOf(ctx)?.squadBoard?.rallies.set(ctx.self.id, !own);
    return own;
}

/** The squad leader of a bot on its own: the lowest-id standing squadmate that keeps to itself too, below the bot. */
export function ownLeader(ctx: BrainCtx): { id: number; at: Vec2 } | null {
    const sb = factionOf(ctx)?.squadBoard;
    if (!sb) return null;
    let best: { id: number; at: Vec2 } | null = null;
    for (const m of ctx.model.team) {
        if (m.playerId >= ctx.self.id || m.dead || m.downed || m.disconnected || sb.rallies.get(m.playerId) !== false)
            continue;
        if (best && m.playerId > best.id) continue;
        const c = ctx.model.contacts.get(m.playerId);
        best = { id: m.playerId, at: v2.copy(c?.visible ? c.pos : m.pos) };
    }
    return best;
}

/** Where the group forms: the Commander, or its flare's air drop near it until the drop is opened. */
export function rallyPoint(ctx: BrainCtx, cmd: Commander): Vec2 {
    if (cmd.downed) return cmd.at;
    for (const d of ctx.model.airdrops.open()) {
        if (d.stage === "opened" || ctx.now - d.since > DROP_FRESH) continue;
        if (v2.distance(d.pos, cmd.at) < DROP_NEAR) return v2.copy(d.pos);
    }
    return cmd.at;
}

/**
 * Whether the Commander waits for its group before (or while) it takes it to the front: see GATHER_SHARE. Never in the
 * water (a Commander caught mid-crossing goes on and waits on the bank).
 */
export function commanderWaits(ctx: BrainCtx): boolean {
    const fi = factionOf(ctx);
    if (!fi || !FACTION_TUNING.rally || fi.role !== COMMANDER) return false;
    const fm = ctx.mem.faction;
    if (ctx.now < fm.cmdGoUntil || inWater(ctx)) return false;
    const want = Math.min(GATHER_MAX, Math.floor(fi.allies().length * GATHER_SHARE));
    if (fi.alliesNear(ctx.self.pos, GATHER_NEAR) >= (fm.cmdMoving ? Math.ceil(want / 2) : want)) {
        fm.cmdMoving = true;
        fm.cmdWaitFrom = Number.NaN;
        return false;
    }
    fm.cmdMoving = false;
    if (Number.isNaN(fm.cmdWaitFrom)) fm.cmdWaitFrom = ctx.now;
    if (ctx.now - fm.cmdWaitFrom < GATHER_PATIENCE) return true;
    // (waited long enough: allies cut off or busy elsewhere do not hold it forever)
    fm.cmdGoUntil = ctx.now + GATHER_GO;
    fm.cmdWaitFrom = Number.NaN;
    fm.cmdMoving = true;
    return false;
}

/** The bot's rank among its faction's members (ids, dead ones included, the Commander left out), kept per Commander. */
function rankOf(ctx: BrainCtx, cmdId: number): number {
    const fm = ctx.mem.faction;
    if (fm.rallyRankFor === cmdId && fm.rallyRank >= 0) return fm.rallyRank;
    let rank = 0;
    for (const id of factionOf(ctx)?.factionBoard?.members.keys() ?? [])
        if (id !== cmdId && id !== ctx.self.id && id < ctx.self.id) rank++;
    fm.rallyRank = rank;
    fm.rallyRankFor = cmdId;
    return rank;
}

/**
 * The bot's slot around the rally point `at`: its rank picks a ring and a place on it, turned with the front (the
 * first place of each ring faces it), the rings closed in around a knocked Commander; kept on the group's bank
 * (bankOf) and on a dry cell.
 */
export function rallySlot(ctx: BrainCtx, cmd: Commander, at: Vec2): Vec2 {
    const fi = factionOf(ctx);
    let rank = rankOf(ctx, cmd.id);
    let ring = 0;
    while (ring < RINGS.length - 1 && rank >= RINGS[ring][1]) rank -= RINGS[ring++][1];
    const [radius0, count] = RINGS[ring];
    let radius = radius0 + (fi?.role === "marksman" ? MARKSMAN_OUT : 0);
    if (cmd.downed) radius = Math.max(GUARD_MIN, radius * GUARD_SHRINK);
    const front = ctx.mem.faction.front;
    const fwd = fi?.forward(at) ?? (front ? v2.normalizeSafe(v2.sub(front, at), { x: 1, y: 0 }) : { x: 1, y: 0 });
    const angle = Math.atan2(fwd.y, fwd.x) + ((rank % count) + (ring % 2) * 0.5) * ((2 * Math.PI) / count);
    // inside the next safe circle while the rally point is: the outer slots of a group at the circle's edge. A rally
    // point outside it keeps its rings (pulled to the edge they all landed on one short arc of it, up to 90 u from a
    // Commander still on its way in: seed 11), and the zone behaviour takes each bot in as the gas presses
    const off = v2.add(at, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    const raw = ctx.model.insideSafeZone(at) ? inZone(ctx, off, SLOT_ZONE_MARGIN) : off;
    // on the group's bank: a slot over the water or across it moves onto that bank
    const geo = fi?.geo;
    if (!geo) return drySpot(ctx, raw, 6);
    const side = bankOf(ctx, at);
    const kept = riverSide(geo, raw) * side > waterHalfAt(geo, raw) ? raw : dryOn(ctx, raw, side);
    return drySpot(ctx, kept, 6);
}

/**
 * The bank (riverSide sign) the group forms on: the faction's own (owner 2026-10-08: hold the own bank, cross when
 * attacking). A rally point over the river (a Commander there on an errand, a drop that fell there) gets its group
 * across from it on the own bank; the group crosses with its Commander when the Commander's call is a push (an attack
 * over the river), or when the own bank across from it lies outside the next safe circle.
 */
function bankOf(ctx: BrainCtx, at: Vec2): number {
    const fi = factionOf(ctx);
    const geo = fi?.geo;
    if (!fi || !geo) return 0;
    const s = riverSide(geo, at);
    const there = Math.abs(s) > waterHalfAt(geo, at) ? Math.sign(s) : 0;
    const own = fi.side || there || Math.sign(s) || 1;
    if (!there || there === own) return own;
    const call = fi.factionBoard?.commanderPlan;
    if (call?.push && ctx.now - call.time < CALL_FRESH) return there;
    return ctx.model.insideSafeZone(dryOn(ctx, at, own)) ? own : there;
}
