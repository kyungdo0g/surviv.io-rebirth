// Team play (duo / squad): reviving downed teammates (Input.Revive within reach, then holding still for the 8 s
// revive) once no enemy covers them (reviveThreat; the smart brain smokes the threat line first), sticking with the
// group (followers stay near the lowest-id living teammate), and crawling to safety while downed. Teammate positions
// come from the team status rows of the bot's own snapshots.
//
// BrainFeatures.pursuit (bot overhaul MOVE-7): an enemy seen covering the downed teammate is remembered for 8 s after
// it left view (the contact itself is forgotten 2 s after: it has probably just stepped behind a wall or off the
// screen, and is still there), from where it was last seen, until smoke or an obstacle cuts that line; and while
// someone covers the teammate the bot waits in cover next to it instead of kneeling (the revive score of 0.2 still
// beat exploring, so bots knelt in front of the enemy whenever nothing else was going on: HARNESS BEFORE, 31 unsafe
// revives of 624). An unarmed follower does not regroup through a place it was just chased out of (brain/danger.ts).
// Round 3: nobody kneels in an air strike, and a downed bot crawls out of one first (brain/strikes.ts).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, Input } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { distToSegment } from "../geom.ts";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import type { Contact } from "../perception/world.ts";
import { findCoverFrom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { factionDowned, planSelfRevive } from "./factionRevive.ts";
import { inStrike, planEvacuate, strikeScore } from "./strikes.ts";

const REVIVE_RANGE = GameConfig.player.reviveRange;
/** Followers start regrouping farther than this from their leader, and stop once within REGROUP_DONE. */
const REGROUP_DIST = 26;
const REGROUP_DONE = 10;

/** Living teammates (not the bot itself), with the freshest position known. */
export function mates(ctx: BrainCtx): Array<TeamMemberView & { at: Vec2 }> {
    const out: Array<TeamMemberView & { at: Vec2 }> = [];
    for (const m of ctx.model.team) {
        if (m.playerId === ctx.self.id || m.dead || m.disconnected) continue;
        const c = ctx.model.contacts.get(m.playerId);
        out.push({ ...m, at: c?.visible ? v2.copy(c.pos) : v2.copy(m.pos) });
    }
    return out;
}

/** The nearest downed teammate (50v50: the downed faction member to revive, factionRevive.ts). */
export function downedMate(ctx: BrainCtx): (TeamMemberView & { at: Vec2 }) | undefined {
    if (ctx.features.faction) {
        const f = factionDowned(ctx);
        if (f !== null) return f;
    }
    let best: (TeamMemberView & { at: Vec2 }) | undefined;
    let bestD = Number.POSITIVE_INFINITY;
    for (const m of mates(ctx)) {
        if (!m.downed) continue;
        const d = v2.distance(m.at, ctx.self.pos);
        if (d < bestD) {
            bestD = d;
            best = m;
        }
    }
    return best;
}

/** An armed enemy seen this recently (visible or just out of sight) still covers the downed teammate. */
const THREAT_MEMORY = 2;
/** ...when it stood this close to the teammate with a line of fire on it. */
const THREAT_REACH = 45;
/** Hit this recently: whoever shoots the bot will shoot it kneeling over a teammate too. */
const HURT_RECENT = 1.5;
/** Smoke grenades are thrown this far at most (trigger.ts: about 22 units at full strength). */
const SMOKE_THROW = 20;
/** pursuit: an enemy that covered the downed teammate is remembered this long after it was last seen. */
const COVER_MEMORY = 8;
/** pursuit: waiting for a covered teammate, the bot takes cover this close to it. */
const WAIT_COVER = 8;

/** Whether a smoke cloud lies across the segment from `a` to `b` (it hides whoever kneels behind it). */
function smokeBetween(ctx: BrainCtx, a: Vec2, b: Vec2): boolean {
    for (const s of ctx.model.smokes) if (distToSegment(s.pos, a, b) < s.rad * 0.8) return true;
    return false;
}

/**
 * What makes reviving the teammate at `at` suicide now: "hurt" when the bot was just hit, else the armed enemy seen in
 * the last 2 s with a line of fire on the teammate (from where it was seen) within 45 units and no smoke between; null
 * when it is safe enough. A revive is 8 s of standing still over the teammate: in front of a shooter both die (a
 * spectator saw a bot running from a fight turn back to revive in the enemy's sights). The old rule only looked for
 * enemies within 18 units of the reviver.
 */
export function reviveThreat(ctx: BrainCtx, at: Vec2): Contact | "hurt" | null {
    const { model, now } = ctx;
    if (now - model.lastHurt < HURT_RECENT) return "hurt";
    for (const e of ctx.enemies) {
        if (e.downed || now - e.lastSeen > THREAT_MEMORY) continue;
        if (isMeleeWeapon(e.activeWeapon) && now - e.lastArmedAt > 15) continue;
        if (v2.distance(e.pos, at) > THREAT_REACH) continue;
        if (model.lineOfFire(e.pos, at) && !smokeBetween(ctx, e.pos, at)) return e;
    }
    // pursuit: an enemy that covered the teammate a few seconds ago, from where it was last seen
    if (!ctx.features.pursuit) return null;
    for (const c of ctx.mem.pursuit.coverers.values()) {
        if (now - c.seen > COVER_MEMORY || c.contact.dead || c.contact.downed) continue;
        if (v2.distance(c.pos, at) > THREAT_REACH) continue;
        if (model.lineOfFire(c.pos, at) && !smokeBetween(ctx, c.pos, at)) return c.contact;
    }
    return null;
}

/** pursuit: remembers the armed enemies in view that have a line of fire on the downed teammate at `at`. */
function noteCoverers(ctx: BrainCtx, at: Vec2): void {
    const { model, now } = ctx;
    const cov = ctx.mem.pursuit.coverers;
    for (const [id, c] of cov) if (now - c.seen > COVER_MEMORY || c.contact.dead) cov.delete(id);
    for (const e of ctx.visibleEnemies) {
        if (e.downed || (isMeleeWeapon(e.activeWeapon) && now - e.lastArmedAt > 15)) continue;
        if (v2.distance(e.pos, at) > THREAT_REACH || !model.lineOfFire(e.pos, at)) continue;
        cov.set(e.id, { contact: e, pos: v2.copy(e.pos), seen: now });
    }
}

/** Where a smoke grenade hides the teammate at `at` from `threat`: on the line between, 5 units off the teammate. */
function smokeSpot(at: Vec2, threat: Vec2): Vec2 {
    return v2.add(at, v2.mul(v2.normalizeSafe(v2.sub(threat, at)), 5));
}

/** guard: a smoke can be thrown now to hide the teammate from `threat` (in throwing range of its spot). */
function canSmoke(ctx: BrainCtx, at: Vec2, threat: Contact): boolean {
    if (!ctx.features.guard || (ctx.self.inventory.smoke ?? 0) <= 0 || ctx.now - ctx.mem.lastSmoke <= 10) return false;
    return v2.distance(ctx.self.pos, smokeSpot(at, threat.pos)) < SMOKE_THROW;
}

/** Kneeling: an armed enemy this close in view with a line of fire ends the revive (it walks into a kneeling target)... */
const KNEEL_CLOSE = 18;
/** ...and one within KNEEL_REACH that closes in faster than KNEEL_CLOSING (u/s) or fired within KNEEL_FIRED. */
const KNEEL_REACH = 35;
const KNEEL_CLOSING = 2;
const KNEEL_FIRED = 1;
/** A revive this close to done is finished unless the enemy is inside KNEEL_FINISH_NEAR or the bot is hit. */
const KNEEL_FINISH = 0.8;
const KNEEL_FINISH_NEAR = 12;

/**
 * Kneeling over a teammate (8 s of standing still): the armed enemy in view, noticed after a human reaction, that will
 * shoot the bot there, or null. The start of a revive is checked by reviveThreat; this is the enemy that shows up or
 * walks in during it (adversarial review: bots kept kneeling while an enemy walked from 22 to 10 u in plain view, and
 * reacted only once hit, 12.6 s and 64 HP later).
 */
export function kneelThreat(ctx: BrainCtx, at: Vec2): Contact | null {
    const { model, now, self } = ctx;
    const react = ctx.params.reactionTime[0];
    const left = self.action.duration - self.action.time;
    for (const e of ctx.visibleEnemies) {
        if (e.downed || now - e.firstSeen < react) continue;
        if (isMeleeWeapon(e.activeWeapon) && now - e.lastArmedAt > 15) continue;
        const d = v2.distance(e.pos, self.pos);
        if (d > KNEEL_REACH) continue;
        if (!model.bodyLineOfFire(e.pos, self.pos) && !model.lineOfFire(e.pos, at)) continue;
        if (smokeBetween(ctx, e.pos, self.pos)) continue;
        if (left < KNEEL_FINISH && d > KNEEL_FINISH_NEAR) continue;
        const toMe = v2.normalizeSafe(v2.sub(self.pos, e.pos));
        const closing = v2.dot(e.vel, toMe);
        if (d < KNEEL_CLOSE || closing > KNEEL_CLOSING || now - e.lastShotAt < KNEEL_FIRED) return e;
    }
    return null;
}

/** pursuit: the enemy that ended a revive keeps the bot off its knees while seen within this long, for KNEEL_ABORT_HOLD. */
const KNEEL_ABORT_SEEN = 2;
const KNEEL_ABORT_HOLD = 6;

function kneelAbortHolds(ctx: BrainCtx): boolean {
    const a = ctx.mem.pursuit.kneelAbort;
    if (!a || ctx.now - a.at > KNEEL_ABORT_HOLD) return false;
    const c = ctx.model.contacts.get(a.id);
    return !!c && !c.dead && !c.downed && ctx.now - c.lastSeen < KNEEL_ABORT_SEEN;
}

export function reviveScore(ctx: BrainCtx): number {
    if (!ctx.teamMode) return 0;
    const m = downedMate(ctx);
    // pursuit: never kneel in an air strike (the downed teammate crawls out of it: planDowned)
    const strike = ctx.features.pursuit && inStrike(ctx, ctx.self.pos);
    if (ctx.self.action.type === "revive") {
        // kneeling already: finish it, unless the bot is being shot (then fight or run, and come back)
        if (strike) return 0;
        // (pursuit: hit while kneeling, it gets up and answers: evade.ts takes over even from a kneel; the baseline
        // keeps 0.3, enough to stay down when nothing else scores)
        if (ctx.now - ctx.model.lastHurt < 0.5) return ctx.features.pursuit ? 0 : 0.3;
        // pursuit: an enemy walking in or opening fire in view ends it too (Brain cancels the revive action)
        const walkIn = ctx.features.pursuit ? kneelThreat(ctx, m?.at ?? ctx.self.pos) : null;
        if (walkIn) {
            ctx.mem.pursuit.kneelAbort = { id: walkIn.id, at: ctx.now };
            return 0;
        }
        return 0.95;
    }
    if (!m) return 0;
    const d = v2.distance(m.at, ctx.self.pos);
    if (d > 60 || (ctx.features.pursuit && inStrike(ctx, m.at))) return 0;
    if (ctx.features.pursuit) noteCoverers(ctx, m.at);
    // in an enemy's sights: smoke it first (guard), else deal with the enemy (fight, flee, cover) and come back
    const threat = reviveThreat(ctx, m.at);
    if (threat === "hurt") return 0.2;
    // pursuit: the enemy that just ended a revive is still around: no kneeling again in front of it
    if (ctx.features.pursuit && kneelAbortHolds(ctx)) return 0.2;
    if (threat) return canSmoke(ctx, m.at, threat) ? 0.6 : 0.2;
    const close = ctx.visibleEnemies.some((e) => !e.downed && v2.distance(e.pos, ctx.self.pos) < 18);
    return close ? 0.45 : 0.88;
}

export function planRevive(ctx: BrainCtx): Intent {
    const intent = emptyIntent("revive");
    const { self, mem, now } = ctx;
    const threat = ctx.visibleEnemies.find((e) => !e.downed);
    if (threat) intent.aim = v2.copy(threat.pos);
    if (self.action.type === "revive") {
        // holding still keeps the teammate in reach; shooting or switching would cancel the revive
        intent.stop = true;
        return intent;
    }
    const m = downedMate(ctx);
    if (!m) return intent;
    // guard: an enemy covers the teammate: blind its line with smoke from here first
    const covering = reviveThreat(ctx, m.at);
    if (covering && covering !== "hurt" && canSmoke(ctx, m.at, covering)) {
        mem.lastSmoke = now;
        intent.throwPlan = { item: "smoke", pos: smokeSpot(m.at, covering.pos), cook: 0.15 };
        intent.aim = v2.copy(covering.pos);
        return intent;
    }
    const d = v2.distance(m.at, self.pos);
    if (ctx.features.pursuit && covering) {
        // pursuit: someone covers the teammate: wait in cover next to it (facing the threat) instead of kneeling
        const threatPos = covering === "hurt" ? null : covering.pos;
        const cover = threatPos ? findCoverFrom(ctx.model, m.at, threatPos, WAIT_COVER) : null;
        if (threatPos) intent.aim = v2.copy(threatPos);
        if (cover && v2.distance(cover, self.pos) > 0.8) {
            intent.goal = cover;
            intent.arriveDist = 0.6;
        } else if (!cover && d > WAIT_COVER) {
            intent.goal = v2.copy(m.at);
            intent.arriveDist = WAIT_COVER;
        } else {
            intent.stop = true;
        }
        return intent;
    }
    if (d < REVIVE_RANGE - 1.6) {
        intent.stop = true;
        if (now - mem.lastReviveRequest > 0.6) {
            mem.lastReviveRequest = now;
            intent.actions.push(Input.Revive);
        }
        return intent;
    }
    intent.goal = v2.copy(m.at);
    intent.arriveDist = 1.5;
    return intent;
}

/** The group leader: the lowest-id standing member (the bot itself included). */
export function leaderOf(ctx: BrainCtx): (TeamMemberView & { at: Vec2 }) | undefined {
    let leader: (TeamMemberView & { at: Vec2 }) | undefined;
    for (const m of mates(ctx)) {
        if (m.downed) continue;
        if (!leader || m.playerId < leader.playerId) leader = m;
    }
    return leader && leader.playerId < ctx.self.id ? leader : undefined;
}

/** A follower's own errands (air drops, watching a fight, an endgame spot, a ping) stay this close to its leader. */
const LEASH = 30;

/**
 * Team modes (smart behaviours): whether a follower may go to `p` on its own errand: within LEASH of its leader, so the
 * team stays in mutual support distance (a teammate alone at an air drop or on its own endgame spot loses the 1 v 2).
 * Always true for the leader, in solo, and without a standing leader.
 */
export function onLeash(ctx: BrainCtx, p: Vec2): boolean {
    if (!ctx.teamMode) return true;
    const leader = leaderOf(ctx);
    return !leader || v2.distance(leader.at, p) <= LEASH;
}

export function regroupScore(ctx: BrainCtx): number {
    if (!ctx.teamMode) return 0;
    const leader = leaderOf(ctx);
    const mem = ctx.mem;
    if (!leader) {
        mem.regrouping = false;
        return 0;
    }
    const d = v2.distance(leader.at, ctx.self.pos);
    // pursuit: an unarmed follower does not walk back through the place it was just chased out of (it arms first)
    if (ctx.features.pursuit && !ctx.armed && avoidPos(ctx, leader.at)) return 0;
    // a band between starting and stopping keeps the follower from flip-flopping at one distance
    if (mem.regrouping ? d < REGROUP_DONE : d < REGROUP_DIST) {
        mem.regrouping = false;
        return 0;
    }
    mem.regrouping = true;
    return Math.min(0.7, 0.45 + Math.max(0, d - REGROUP_DIST) / 120);
}

export function planRegroup(ctx: BrainCtx): Intent {
    const intent = emptyIntent("regroup");
    const leader = leaderOf(ctx);
    if (!leader) return intent;
    intent.goal = v2.copy(leader.at);
    intent.arriveDist = REGROUP_DONE - 2;
    return intent;
}

/** Downed: crawl towards the nearest standing teammate, away from visible enemies when none is around. */
export function planDowned(ctx: BrainCtx): Intent {
    const intent = emptyIntent("downed");
    const { self } = ctx;
    // pursuit: out of an air strike first (a teammate will not kneel in one either: reviveScore)
    if (ctx.features.pursuit && strikeScore(ctx) > 0) {
        const out = planEvacuate(ctx);
        intent.goal = out.goal;
        intent.arriveDist = out.arriveDist;
        intent.moveDir = out.moveDir;
        return intent;
    }
    // 50v50: a Medic revives itself (Revivify) when nobody is in its face
    const selfRevive = ctx.features.faction ? planSelfRevive(ctx) : null;
    if (selfRevive) return selfRevive;
    if (self.action.type === "revive") {
        // being revived: crawling away would cancel it
        intent.stop = true;
        return intent;
    }
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const m of mates(ctx)) {
        if (m.downed) continue;
        const d = v2.distance(m.at, self.pos);
        if (d < bestD) {
            bestD = d;
            best = m.at;
        }
    }
    if (best) {
        intent.goal = best;
        intent.arriveDist = 2;
        return intent;
    }
    const threat = ctx.visibleEnemies.find((e) => !e.downed);
    if (threat) {
        const away = v2.normalizeSafe(v2.sub(self.pos, threat.pos));
        intent.goal = v2.add(self.pos, v2.mul(away, 10));
    }
    return intent;
}
