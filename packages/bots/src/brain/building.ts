// Holding a building (BrainFeatures.cover): in an even trade with an enemy at range and a building's interior within
// reach, the bot goes inside. Under the roof it is hidden from outside, like the original client draws the ceiling
// over the players inside (perception/roofs.ts), and the enemy has to come through a doorway to fight it. Inside it
// holds still facing the threat and closes an open door next to it on the threat's side (Input.Use toggles the doors
// in reach; the door state comes from the snapshot's ObstacleView). Capped at 10 s, then 20 s without.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { colliderCenter } from "../geom.ts";
import type { HeldGun } from "../knowledge/arsenal.ts";
import { ADVANTAGE_BAND, pushAdvantageOf } from "./assess.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { buildingSpots } from "./explore.ts";
import { underRoof } from "./grenades.ts";

/** A building interior centre this close is worth going into. */
const REACH = 14;
/** Closer enemies are fought where they stand. */
const MIN_ENEMY_DIST = 15;
const HOLD_CAP = 10;
const COOLDOWN = 20;
const DOOR_REACH = 3;
/** Buildings nearby are looked for at most this often. */
const SCAN_EVERY = 1;

/**
 * Takes the fight into a nearby building when the trade is even and the enemy still far (called by planFight while
 * the feature is on); false leaves the fight to the other tactics.
 */
export function planBuildingHold(ctx: BrainCtx, intent: Intent, _gun: HeldGun): boolean {
    const { model, self, now, mem } = ctx;
    const sm = mem.smart;
    const t = ctx.target;
    if (!t || t.downed || now < sm.buildingCooldown) return false;
    const me = self.pos;
    const adv = pushAdvantageOf(ctx);
    const inside = underRoof(model, me);
    if (!sm.buildingSpot) {
        if (adv > ADVANTAGE_BAND || ctx.targetDist < MIN_ENEMY_DIST || now - sm.buildingScanAt < SCAN_EVERY)
            return false;
        sm.buildingScanAt = now;
        if (inside || underRoof(model, t.pos)) return false;
        let best: Vec2 | null = null;
        let bestD = REACH;
        for (const b of buildingSpots(model.map)) {
            const d = v2.distance(b.pos, me);
            // the building must not lie towards the enemy
            if (d < bestD && v2.distance(b.pos, t.pos) > ctx.targetDist) {
                bestD = d;
                best = b.pos;
            }
        }
        if (!best) return false;
        const cell = model.nav.nearestWalkable(best, 4, ctx.myComp);
        if (cell < 0) return false;
        sm.buildingSpot = model.nav.center(cell);
        sm.buildingHoldUntil = now + HOLD_CAP;
    }
    if (now > sm.buildingHoldUntil || adv > ADVANTAGE_BAND) {
        sm.buildingSpot = null;
        sm.buildingCooldown = now + COOLDOWN;
        return false;
    }
    intent.lookAt = v2.copy(t.pos);
    if (!inside || v2.distance(me, sm.buildingSpot) > 3) {
        intent.goal = v2.copy(sm.buildingSpot);
        intent.arriveDist = 1.5;
        // shoot on the way when the shot is there (intent.fire from planFight)
        return true;
    }
    // inside: hold, crosshair on the threat, and shut the door on its side
    intent.stop = true;
    if (now - sm.lastDoorClose > 1.5) {
        for (const o of model.obstacles) {
            const door = o.view.door;
            if (!o.def.door || !door?.open || !door.canUse || door.locked) continue;
            const c = colliderCenter(o.col);
            if (v2.distance(c, me) > DOOR_REACH) continue;
            if (v2.dot(v2.sub(c, me), v2.sub(t.pos, me)) <= 0) continue;
            sm.lastDoorClose = now;
            intent.actions.push(Input.Use);
            break;
        }
    }
    return true;
}
