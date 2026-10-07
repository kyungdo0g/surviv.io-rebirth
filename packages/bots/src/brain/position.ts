// Fighting positions (BrainFeatures.pursuit, bot overhaul round 3, user report 19: "bots must use trees / stones /
// walls / crates as cover in fights"). planFight strafes in the open wherever the fight finds it; the smart brain's
// cover peeking (brain/cover.ts) starts in a trade it loses, to reload or heal, or (COMBAT round 3) in an even trade with
// cover a few steps away. Here, in an even fight in reach (not a brawl, not a won trade it presses, not against an
// enemy rushing in), the bot first takes a post: the edge of an obstacle between it and the target, a step sideways
// from the spot the obstacle hides, with a line of fire from the edge. It picks the post within a few units (5 once
// shots are flying, 9 before), inside its gun's reach, on the side of the range it wants (assess.ts rangePreference:
// a rifle backs off a shotgun, a shotgun closes in) and never by walking into the target. At the post it fights with
// the usual strafe within LEASH of the edge (a static bot at an edge is the easiest target there is: against a scripted
// shooter with perfect aim it lost twice the health) and walks back once it strayed farther; it steps behind the
// obstacle while reloading (ducking after every hit only wasted the shooting window between the enemy's bursts: the
// hide and peek timing is brain/cover.ts). The post is dropped when the obstacle no longer hides the spot from the
// target, when the target moved far, or after POST_KEEP. Bold personas (the rusher) keep strafing in the open unless
// hurt. Hooked into planFight through one seam (tactics.ts) before the open-ground strafe.
import { type Vec2, v2 } from "@rebirth/core";
import type { HeldGun } from "../knowledge/arsenal.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { ADVANTAGE_BAND, engagingMe, pushAdvantageOf, rangePreference } from "./assess.ts";
import { findCoverFrom } from "./combat.ts";
import { type BrainCtx, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { isBusy } from "./opportunity.ts";
import { closingSpeed } from "./pursuit.ts";
import type { FightPost } from "./pursuitMemory.ts";
import { burned } from "./stillHit.ts";

/** Closer than this the fight is a brawl: no post (brain/cover.ts BRAWL_DIST). */
const BRAWL = 7;
/** An enemy coming in faster than this (u/s) is shot, not waited for behind cover (cover.ts RUSH_SPEED). */
const RUSH = 4;
/** Post search radius once the shooting started, and before. */
const ENGAGED_HOP = 5;
const CALM_HOP = 9;
/** A post is kept this long at most, and dropped once the target moved this far from where it was chosen. */
const POST_KEEP = 8;
const TARGET_MOVED = 8;
/** No new look for a post this long after none was found. */
const RETRY = 1.5;
/** Edge offsets tried sideways from the hidden spot (units). */
const EDGE_STEPS = [1.5, 2, 2.5, 3];
/** Persona boldness from which the bot fights in the open unless its health is below BOLD_HEALTH. */
const BOLD = 0.1;
const BOLD_HEALTH = 60;
/** At the post the fight strafes as usual within this of the edge; farther out it walks back to it. */
const LEASH = 3;

/** A spot 1.5-3 units sideways from `hide` with a line of fire on `target`, on the side nearer `from`. */
export function edgeSpot(model: WorldModel, hide: Vec2, target: Vec2, from: Vec2): Vec2 | null {
    const side = v2.perp(v2.normalizeSafe(v2.sub(target, hide)));
    const first = v2.dot(side, v2.sub(from, hide)) >= 0 ? 1 : -1;
    for (const s of [first, -first]) {
        for (const off of EDGE_STEPS) {
            const raw = v2.add(hide, v2.mul(side, s * off));
            if (!model.nav.walkableAt(raw) || model.nav.isWaterAt(raw)) continue;
            const p = model.nav.center(model.nav.nearestWalkable(raw, 1));
            if (model.lineOfFire(p, target) && model.nav.lineWalkable(hide, p)) return p;
        }
    }
    return null;
}

/** A post against `t` (see the header), or null. */
function findPost(ctx: BrainCtx, t: Contact, gun: HeldGun, d: number): FightPost | null {
    const { model, now, self } = ctx;
    const me = self.pos;
    const info = gun.info;
    const reach = Math.max(info.maxEngage * ctx.params.rangeMult, 10);
    const lo = Math.max(BRAWL, Math.min(info.idealMin, d));
    const pref = ctx.features.assess ? rangePreference(ctx, t) : 0;
    const engaged = now - model.lastHurt < 2 || engagingMe(ctx, t);
    const hop = engaged ? ENGAGED_HOP : CALM_HOP;
    const hide = findCoverFrom(model, me, t.pos, hop + 4, (spot) => {
        if (v2.distance(spot, me) > hop) return false;
        const dt = v2.distance(spot, t.pos);
        if (dt < lo || dt > reach) return false;
        if (pref < 0 ? dt < d - 1 : pref > 0 ? dt > d + 1 : dt < d - 3) return false;
        return reachable(ctx, spot, 1) && !nearFailedGoal(ctx, spot) && !avoidPos(ctx, spot) && !burned(ctx, spot);
    });
    if (!hide) return null;
    const edge = edgeSpot(model, hide, t.pos, me);
    if (!edge) return null;
    return { target: t.id, hide, edge, ref: v2.copy(t.pos), until: now + POST_KEEP };
}

/**
 * Called by planFight (tactics.ts) with a visible target in reach before it strafes in the open: takes or keeps a post
 * next to cover (see the header) and plans the move there; false leaves the fight to the open-ground strafe.
 */
export function planFightPosition(ctx: BrainCtx, intent: Intent, gun: HeldGun, d: number): boolean {
    if (!ctx.features.pursuit) return false;
    const pm = ctx.mem.pursuit;
    const t = ctx.target;
    const { model, now, self } = ctx;
    const reach = Math.max(gun.info.maxEngage * ctx.params.rangeMult, 10);
    const pressing = pushAdvantageOf(ctx) > ADVANTAGE_BAND || (ctx.features.opportunism && !!t && isBusy(ctx, t));
    const bold = ctx.persona.aggressionBias >= BOLD && self.health > BOLD_HEALTH;
    if (!t?.visible || t.downed || d < BRAWL || d > reach || pressing || bold || closingSpeed(ctx, t) > RUSH) {
        pm.post = null;
        return false;
    }
    let post = pm.post;
    if (
        post &&
        (post.target !== t.id ||
            now > post.until ||
            v2.distance(t.pos, post.ref) > TARGET_MOVED ||
            model.bodyLineOfFire(t.pos, post.hide) ||
            burned(ctx, post.hide))
    )
        post = pm.post = null;
    if (post && !model.lineOfFire(post.edge, t.pos)) {
        // it moved along: another edge of the same obstacle
        const edge = edgeSpot(model, post.hide, t.pos, self.pos);
        if (edge) post.edge = edge;
        else post = pm.post = null;
    }
    if (!post) {
        if (now < pm.postRetryAt) return false;
        post = findPost(ctx, t, gun, d);
        if (!post) {
            pm.postRetryAt = now + RETRY;
            return false;
        }
        pm.post = post;
    }
    const reloading = self.action.type === "reload" || gun.mag <= 0;
    let spot: Vec2;
    if (reloading) spot = post.hide;
    else if (v2.distance(self.pos, post.edge) > LEASH) spot = post.edge;
    else return false; // at the edge: the fight's own strafe (its legs keep the bot moving; the leash brings it back)
    if (v2.distance(self.pos, spot) > 0.4) {
        intent.goal = v2.copy(spot);
        intent.arriveDist = 0.3;
    } else {
        intent.stop = true;
    }
    return true;
}
