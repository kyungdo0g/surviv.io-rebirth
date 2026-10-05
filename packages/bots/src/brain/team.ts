// Team play (duo / squad): reviving downed teammates (Input.Revive within reach, then holding still for the 8 s
// revive), sticking with the group (followers stay near the lowest-id living teammate), and crawling to safety while
// downed. Teammate positions come from the team status rows of the bot's own snapshots.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, Input } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

const REVIVE_RANGE = GameConfig.player.reviveRange;
/** Followers start regrouping farther than this from their leader, and stop once within REGROUP_DONE. */
const REGROUP_DIST = 26;
const REGROUP_DONE = 10;

/** Living teammates (not the bot itself), with the freshest position known. */
function mates(ctx: BrainCtx): Array<TeamMemberView & { at: Vec2 }> {
    const out: Array<TeamMemberView & { at: Vec2 }> = [];
    for (const m of ctx.model.team) {
        if (m.playerId === ctx.self.id || m.dead || m.disconnected) continue;
        const c = ctx.model.contacts.get(m.playerId);
        out.push({ ...m, at: c?.visible ? v2.copy(c.pos) : v2.copy(m.pos) });
    }
    return out;
}

/** The nearest downed teammate. */
function downedMate(ctx: BrainCtx): (TeamMemberView & { at: Vec2 }) | undefined {
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

export function reviveScore(ctx: BrainCtx): number {
    if (!ctx.teamMode) return 0;
    if (ctx.self.action.type === "revive") return 0.95;
    const m = downedMate(ctx);
    if (!m) return 0;
    const d = v2.distance(m.at, ctx.self.pos);
    if (d > 60) return 0;
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
function leaderOf(ctx: BrainCtx): (TeamMemberView & { at: Vec2 }) | undefined {
    let leader: (TeamMemberView & { at: Vec2 }) | undefined;
    for (const m of mates(ctx)) {
        if (m.downed) continue;
        if (!leader || m.playerId < leader.playerId) leader = m;
    }
    return leader && leader.playerId < ctx.self.id ? leader : undefined;
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
