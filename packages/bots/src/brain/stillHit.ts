// Shot while standing still (BrainFeatures.pursuit; adversarial review of the overhaul): several behaviours park the
// bot on a spot (a cover spot, a fighting post, a disengage hop, a long shot, a hold) and keep it there for as long as
// their own geometry says the spot is safe. When it is not (the shooter is not where the bot thinks, a second one, the
// spot shields only part of the body), the bot stood there and soaked the fire: 8-14 episodes per match of 3 s or more
// without moving while being hit, one bot losing 62 HP holding a disengage spot without firing back. A human hit on a
// spot gets off it. This layer watches every think:
// - a spot where the bot stood for STILL_MIN and lost BURN_HP or more to fire without shooting back is "burned" for
//   BURN_TIME (trading shots from a spot is the fight's business: it strafes when hit, tactics.ts): the cover
//   searches skip spots near it (burned(), read by evade.ts, disengage.ts, cover.ts and position.ts);
// - while burned, an intent that would leave the bot standing gets a short sideways juke instead (0.45-0.8 s legs,
//   across the line to the shooter as it seems to be), so the next think finds a better spot or fights from the move.
// Kneeling over a teammate and being downed are left to their own rules (team.ts).
import { type Vec2, v2 } from "@rebirth/core";
import { freeDir } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";

/** The bot counts as standing still while it stays within STILL_RAD of where it stopped... */
const STILL_RAD = 1;
/** ...and is "parked" after STILL_MIN there. */
const STILL_MIN = 0.6;
/** Health lost to fire on one parked spot that burns it (hit this recently: HURT_FRESH). */
const BURN_HP = 10;
const HURT_FRESH = 0.4;
/** The bot decided to fire this recently (s): it is trading from the spot, not hiding on it. */
const TRADING = 0.8;
/** A burned spot is avoided this long, within BURN_RAD. */
const BURN_TIME = 6;
const BURN_RAD = 2.5;
/** Juke legs (s). */
const JUKE_MIN = 0.45;
const JUKE_MAX = 0.8;

/** Watches the bot's own position and health (every think while the flag is on); burns a spot it is shot on. */
export function noteStillHit(ctx: BrainCtx): void {
    const pm = ctx.mem.pursuit;
    const { self, now, model } = ctx;
    const still = pm.still;
    if (!still || v2.distance(still.pos, self.pos) > STILL_RAD || self.downed) {
        pm.still = { pos: v2.copy(self.pos), since: now, health: self.health };
        return;
    }
    // healing on the spot raises the health: count the loss from the highest point since
    if (self.health > still.health) still.health = self.health;
    const parked = now - still.since >= STILL_MIN;
    if (!parked || now - model.lastHurt > HURT_FRESH || still.health - self.health < BURN_HP) return;
    // trading shots from the spot (an edge it peeks from, a long shot) is a fight, not a hiding place that failed: the
    // fight strafes when hit (tactics.ts HIT_STRAFE)
    if (self.action.type === "revive" || now - ctx.mem.fight.fireAt < TRADING) return;
    pm.burned = { pos: v2.copy(still.pos), until: now + BURN_TIME };
    // start over from here: the next burn needs fresh damage
    still.health = self.health;
    if (now >= pm.jukeUntil) {
        pm.jukeUntil = now + ctx.rng.range(JUKE_MIN, JUKE_MAX);
        pm.jukeSign = ctx.rng.bool() ? 1 : -1;
    }
}

/** Whether `p` lies on a spot the bot was just shot on (see the header). */
export function burned(ctx: BrainCtx, p: Vec2): boolean {
    const b = ctx.mem.pursuit.burned;
    return !!b && ctx.now < b.until && v2.distance(b.pos, p) < BURN_RAD;
}

/** Where the fire seems to come from: the last close bullet, else the target, else the nearest visible enemy. */
function shooterPos(ctx: BrainCtx): Vec2 | null {
    const uf = ctx.model.underFire;
    if (uf && ctx.now - uf.time < 1) return uf.from;
    if (ctx.target?.visible) return ctx.target.pos;
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const e of ctx.visibleEnemies) {
        const d = v2.distance(e.pos, ctx.self.pos);
        if (!e.downed && d < bestD) {
            bestD = d;
            best = e.pos;
        }
    }
    return best;
}

/** Whether the intent leaves the bot standing where it is. */
function standing(ctx: BrainCtx, intent: Intent): boolean {
    if (intent.moveDir) return false;
    if (intent.stop || !intent.goal) return true;
    return v2.distance(intent.goal, ctx.self.pos) <= intent.arriveDist + 0.3;
}

/** The juke (see the header): a standing intent steps sideways across the line of fire while the juke lasts. */
export function unpinUnderFire(ctx: BrainCtx, intent: Intent): void {
    const pm = ctx.mem.pursuit;
    const { now, self } = ctx;
    if (now >= pm.jukeUntil || self.downed || self.action.type === "revive" || !standing(ctx, intent)) return;
    const from = shooterPos(ctx);
    const toShooter = from ? v2.normalizeSafe(v2.sub(from, self.pos)) : v2.normalizeSafe(self.dir);
    const side = v2.mul(v2.perp(toShooter), pm.jukeSign);
    const dir = freeDir(ctx.model, self.pos, side) ?? freeDir(ctx.model, self.pos, v2.neg(side));
    if (!dir) return;
    intent.stop = false;
    intent.goal = null;
    intent.moveDir = dir;
}
