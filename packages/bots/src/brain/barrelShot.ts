// Shooting the barrel next to an enemy (BrainFeatures.barrelShot; owner, 2026-10-08): a real player habit. An
// intermediate or expert bot fighting a target that stands in the blast of an explosive obstacle (knowledge/
// explosives.ts: barrels, propane tanks, power boxes, ...) shoots the explosive instead of the target when:
// - the blast would hit the target hard (WORTH or more by the simulation's falloff, no wall between them);
// - the bot itself stands beyond the blast's reach, or behind a wall from it;
// - the explosive would break within a moment from the health it shows (ObstacleView.healthT: it shrinks and smokes as
//   it takes damage, docs/research/mechanics/explosions.md "Obstacles and explosions"), with the gun in hand and the
//   rounds in its magazine (containers.ts finishSeconds: bullet damage x obstacleDamage x pellets per cycle), a little
//   longer against a target standing still behind it;
// - its near side is in the bot's line of fire and on the screen, and the bot has reacted to the target.
// Beginners never do it (they shoot at the player). A blast is credited to whoever broke the explosive, and its
// teammates take no damage from it (explosions.md "Friendly fire and credit"), so teammates near it are no reason to
// hold off.
import { type Vec2, v2 } from "@rebirth/core";
import { colliderCenter } from "../geom.ts";
import { currentGun } from "../knowledge/arsenal.ts";
import { blastDamage, blastReach, explosiveOf } from "../knowledge/explosives.ts";
import { blastShielded } from "../perception/blasts.ts";
import type { SeenObstacle } from "../perception/world.ts";
import { noteBlast } from "./blast.ts";
import { reactedTo } from "./combat.ts";
import { closestPoint, finishSeconds } from "./containers.ts";
import type { BrainCtx, Intent } from "./context.ts";

/** Blast damage on the target that makes the shot worth taking (a frag-like hit: within ~8.7 u of a barrel). */
const WORTH = 45;
/** The explosive must break within this long (s): an expert commits to a slightly longer burst. */
const SOON: Readonly<Record<"intermediate" | "expert", number>> = { intermediate: 0.6, expert: 0.9 };
/**
 * ...and this much longer against a target that stands still (slower than STILL_SPEED u/s: camping behind the barrel,
 * it will still be there when it goes; an expert's rifle spray breaks a full barrel in about 1.2 s).
 */
const STILL_BONUS = 0.5;
const STILL_SPEED = 1;
/** The bot keeps this much beyond the blast's reach. */
const SAFE_MARGIN = 0.5;
/** The near side of the explosive is checked for a line of fire this far in front of its surface. */
const SURFACE_GAP = 0.1;

export interface BarrelShot {
    o: SeenObstacle;
    aim: Vec2;
    /** blast damage the target would take */
    dmg: number;
}

/** The explosive worth shooting at the fight's target now (see the header), or null. */
export function barrelShotFor(ctx: BrainCtx): BarrelShot | null {
    const { self, model } = ctx;
    const tier = ctx.skill.tier;
    if (tier === "beginner") return null;
    const t = ctx.target;
    if (!t?.visible || t.downed || t.faint || !reactedTo(ctx, t)) return null;
    const gun = currentGun(self, ctx.guns);
    if (!gun || gun.mag <= 0 || gun.info.cls === "launcher" || self.action.type !== "none") return null;
    const me = self.pos;
    const budget = SOON[tier] + (v2.length(t.vel) < STILL_SPEED ? STILL_BONUS : 0);
    let best: BarrelShot | null = null;
    for (const o of model.obstacles) {
        // (blocksBullets: alive, solid and on the bot's floor)
        if (!o.blocksBullets) continue;
        const e = explosiveOf(o.def);
        if (!e) continue;
        const c = colliderCenter(o.col);
        if (!model.onScreen(c)) continue;
        const dmg = blastDamage(e, v2.distance(t.pos, c));
        if (dmg < WORTH || (best && dmg <= best.dmg)) continue;
        const mine = v2.distance(me, c);
        if (mine > gun.info.range) continue;
        if (mine < blastReach(e) + SAFE_MARGIN && !blastShielded(model, o, c, me)) continue;
        if (blastShielded(model, o, c, t.pos)) continue;
        // breaks within a moment, with the rounds in the magazine
        const secs = finishSeconds(o, self, gun.info);
        if (secs > budget || secs / Math.max(gun.info.cycle, 1e-3) > gun.mag) continue;
        // its near side in the line of fire (the explosive itself is the only thing the bullets may meet)
        const near = closestPoint(o, me);
        const front = v2.add(near, v2.mul(v2.normalizeSafe(v2.sub(me, near)), SURFACE_GAP));
        if (!model.lineOfFire(me, front)) continue;
        best = { o, aim: c, dmg };
    }
    return best;
}

/** Turns a fight's intent into a shot at the explosive next to its target when one is worth it; true when it did. */
export function planBarrelShot(ctx: BrainCtx, intent: Intent): boolean {
    if (intent.behaviour !== "fight" || intent.throwPlan) return false;
    const shot = barrelShotFor(ctx);
    if (!shot) return false;
    const gun = currentGun(ctx.self, ctx.guns);
    if (!gun) return false;
    intent.aim = v2.copy(shot.aim);
    intent.lookAt = v2.copy(shot.aim);
    intent.targetId = 0;
    intent.fire = true;
    intent.slot = gun.slot;
    const f = ctx.mem.fight;
    if (ctx.target) f.fireTarget = ctx.target.id;
    f.fireAt = ctx.now;
    noteBlast(ctx, `shot ${shot.o.view.id} ${shot.dmg.toFixed(0)}`);
    return true;
}
