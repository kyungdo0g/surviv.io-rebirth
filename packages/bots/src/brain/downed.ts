// Crawling while knocked (owner report 2026-10-10: "downed bots don't move at all; they should crawl toward teammates
// and cover, away from enemies"). A knocked player crawls at downedMoveSpeed (sim world/player.ts) and bleeds out; a
// teammate revives it, an enemy finishes it. planDowned (team.ts) crawled only towards the nearest standing squadmate,
// else straight away from the first enemy in view, and stood still otherwise (in 50v50 with the squad gone, or with the
// enemy out of sight a moment). Now:
// - friends: the nearest standing squadmate, any standing teammate in view, and in 50v50 any standing faction member on
//   the minimap within FRIEND_RANGE;
// - threats: standing enemies seen within THREAT_MEMORY and THREAT_RANGE;
// - with a threat close (THREAT_CLOSE): the cover nearest the bot that hides it from the nearest threat within
//   COVER_RANGE (a crawl is slow), else away from the threats, bent towards the friend;
// - with a threat farther: towards the friend, bent away from the threats (the friend comes to revive it);
// - no threat: towards the friend; with no friend either, behind the nearest cover from where enemies were last seen,
//   else it waits where it is (nobody to crawl to).
import { type Vec2, v2 } from "@rebirth/core";
import { findCoverFrom, freeDir } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { factionOf } from "./factionCtx.ts";
import { mates } from "./team.ts";

const FRIEND_RANGE = 120;
const THREAT_MEMORY = 4;
const THREAT_RANGE = 45;
const THREAT_CLOSE = 25;
/** Cover within this distance is crawled to. */
const COVER_RANGE = 9;
/** A crawl step away from the threats is planned this far ahead. */
const STEP = 8;
/** Next to the friend: close enough to be revived (revive reach 2.5 plus a little). */
const FRIEND_NEAR = 2;

/** The nearest standing friend (squadmate, teammate in view, 50v50 faction member) within FRIEND_RANGE, or null. */
export function nearestFriend(ctx: BrainCtx): Vec2 | null {
    const me = ctx.self.pos;
    let best: Vec2 | null = null;
    let bestD = FRIEND_RANGE;
    const consider = (p: Vec2) => {
        const d = v2.distance(p, me);
        if (d < bestD) {
            bestD = d;
            best = v2.copy(p);
        }
    };
    for (const m of mates(ctx)) if (!m.downed) consider(m.at);
    for (const c of ctx.model.contacts.values())
        if (c.teammate && c.visible && !c.downed && !c.dead && c.id !== ctx.self.id) consider(c.pos);
    const board = factionOf(ctx)?.factionBoard;
    if (board)
        for (const m of board.members.values()) if (!m.dead && !m.downed && m.playerId !== ctx.self.id) consider(m.pos);
    return best;
}

/** Fills the downed intent's crawl (see the header); leaves it standing when there is nowhere to crawl to. */
export function planCrawl(ctx: BrainCtx, intent: Intent): void {
    const me = ctx.self.pos;
    const friend = nearestFriend(ctx);
    const threats = ctx.enemies.filter(
        (e) => !e.downed && !e.dead && ctx.now - e.lastSeen < THREAT_MEMORY && v2.distance(e.pos, me) < THREAT_RANGE,
    );
    if (threats.length === 0) {
        if (friend) {
            intent.goal = friend;
            intent.arriveDist = FRIEND_NEAR;
            return;
        }
        const last = ctx.enemies.find((e) => !e.downed && !e.dead && v2.distance(e.pos, me) < THREAT_RANGE * 2);
        const cover = last ? findCoverFrom(ctx.model, me, last.pos, COVER_RANGE) : null;
        if (cover && v2.distance(cover, me) > 0.8) {
            intent.goal = cover;
            intent.arriveDist = 0.5;
        }
        return;
    }
    let nearest = threats[0];
    for (const e of threats) if (v2.distance(e.pos, me) < v2.distance(nearest.pos, me)) nearest = e;
    const close = v2.distance(nearest.pos, me) < THREAT_CLOSE;
    if (close) {
        const cover = findCoverFrom(ctx.model, me, nearest.pos, COVER_RANGE);
        if (cover && v2.distance(cover, me) > 0.8) {
            intent.goal = cover;
            intent.arriveDist = 0.5;
            return;
        }
    }
    let away = { x: 0, y: 0 };
    for (const e of threats) {
        const d = Math.max(1, v2.distance(e.pos, me));
        away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, e.pos)), 1 / d));
    }
    away = v2.normalizeSafe(away, { x: 1, y: 0 });
    if (friend && !close && v2.distance(friend, me) > FRIEND_NEAR) {
        // the friend comes first while the enemy is not on top of the bot (unless the way leads into it)
        const to = v2.normalizeSafe(v2.sub(friend, me));
        if (v2.dot(to, away) > -0.5) {
            intent.goal = friend;
            intent.arriveDist = FRIEND_NEAR;
            return;
        }
    }
    const want = friend ? v2.normalizeSafe(v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(friend, me)), 0.6))) : away;
    const dir = freeDir(ctx.model, me, want);
    if (dir) intent.goal = v2.add(me, v2.mul(dir, STEP));
}
