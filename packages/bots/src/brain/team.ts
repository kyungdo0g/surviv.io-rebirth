// Team play (duo / squad): reviving downed teammates (Input.Revive within reach, then holding still for the 8 s
// revive) once no enemy covers them (reviveThreat; the smart brain smokes the threat line first), sticking with the
// group (followers stay near the lowest-id living teammate), and crawling to safety while downed. Teammate positions
// come from the team status rows of the bot's own snapshots.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, Input } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { distToSegment } from "../geom.ts";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import type { Contact } from "../perception/world.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

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

/** The nearest downed teammate. */
export function downedMate(ctx: BrainCtx): (TeamMemberView & { at: Vec2 }) | undefined {
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
    return null;
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

export function reviveScore(ctx: BrainCtx): number {
    if (!ctx.teamMode) return 0;
    const m = downedMate(ctx);
    if (ctx.self.action.type === "revive") {
        // kneeling already: finish it, unless the bot is being shot (then fight or run, and come back)
        return ctx.now - ctx.model.lastHurt < 0.5 ? 0.3 : 0.95;
    }
    if (!m) return 0;
    const d = v2.distance(m.at, ctx.self.pos);
    if (d > 60) return 0;
    // in an enemy's sights: smoke it first (guard), else deal with the enemy (fight, flee, cover) and come back
    const threat = reviveThreat(ctx, m.at);
    if (threat === "hurt") return 0.2;
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
