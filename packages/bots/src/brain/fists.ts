// Bare hands against bare hands (BrainFeatures.pursuit, round 5, user report 35: "everyone bare-handed: bots that see
// me all run away; they go into a house, run out, go in ... for ever"). Early in a match nobody has a gun. A person
// with fists who meets another one either fights (punches, chases a little) or goes on looting and arming up; nobody
// runs from a player they can match. Before: an unarmed enemy within 6 units counted as a threat to looting
// (lootRisk.ts), so items and crates dropped to 0.4 of their worth and the house sweep stopped, while a fist fight
// started only inside 4 units at meleeAggression 0.1-0.3: the bot neither looted nor fought and walked off exploring
// ("they all run away"); in a house the roof hid the enemy again the moment the bot stepped out, the sweep resumed and
// walked it back in. Match probe (scripts/r5probe.ts, seed 1, an unarmed bot within 8 units of an unarmed enemy and no
// gun in view): exploring 30% of the time, fighting 18%.
// Now an unarmed enemy never damps looting (lootRisk.ts), and an unarmed bot that sees one within DECIDE_RANGE decides
// once what to do about it, a decision held for DECISION_HOLD seconds (re-taken when the enemy picks up a gun):
// - fight: the fist fight scores DUEL_SCORE while the enemy stays within CHASE_RANGE (above ordinary loot, below a gun
//   lying close: arming up comes first); the pursuit clock's 3 s fist patience still ends a chase that goes nowhere;
// - leave it be: the bot goes on looting; it punches back when hit (fightScore's 0.7) or when the enemy steps into
//   reach facing it (IN_REACH_SCORE: about to swing); one standing right next to it gets the old meleeAggression.
// The odds of fighting: FIGHT_BASE, more for a bold persona (aggressionBias) or a risk taker, for game sense, for its
// own health against the enemy's estimate, for the better melee weapon (damage per second from the defs), and for an
// enemy standing still with its back turned.
import { v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef, type MeleeDef, WeaponSlot } from "@rebirth/defs";
import type { Contact } from "../perception/world.ts";
import { enemyGun, faces } from "./assess.ts";
import type { BrainCtx } from "./context.ts";

/** An unarmed enemy this close gets a decision. */
export const DECIDE_RANGE = 9;
/** A fist fight the bot chose is pressed while the enemy stays this close. */
const CHASE_RANGE = 12;
/** The decision about one enemy holds this long (no flip-flop as it steps in and out of view). */
const DECISION_HOLD = 20;
/** Score of the chosen fist fight, and of punching an enemy in reach that faces the bot. */
export const DUEL_SCORE = 0.62;
const IN_REACH_SCORE = 0.66;
/** Reach of a swing coming the bot's way (fists 3.25 plus a step), and the facing cone that means "about to swing". */
const IN_REACH = 3.8;
const FACING_DEG = 40;
/** Odds of choosing to fight. */
const FIGHT_BASE = 0.45;
/** An enemy standing still that does not face the bot (within this angle) adds this much: a free first punch. */
const UNAWARE_DEG = 90;
const UNAWARE_BONUS = 0.25;
const FIGHT_MIN = 0.12;
const FIGHT_MAX = 0.92;

/** Damage per second of a melee weapon (fists for an unknown id). */
export function meleeDps(id: string): number {
    const def = (
        hasDef(id) && GameObjectDefs[id].type === "melee" ? GameObjectDefs[id] : GameObjectDefs.fists
    ) as MeleeDef;
    return def.damage / Math.max(0.1, def.attack.cooldownTime);
}

/** The enemy holds no gun as far as the bot knows (fists or a melee weapon, no gun seen in its hands lately). */
export function bareHanded(ctx: BrainCtx, e: Contact): boolean {
    return enemyGun(ctx, e) === null && !throwing(e.activeWeapon);
}

function throwing(id: string): boolean {
    return hasDef(id) && GameObjectDefs[id].type === "throwable";
}

/** The chance the bot takes a fist fight with `t` (see the header). */
export function fightOdds(ctx: BrainCtx, t: Contact): number {
    const p = ctx.persona;
    const mine = meleeDps(ctx.self.weapons[WeaponSlot.Melee]?.type || "fists");
    const theirs = meleeDps(t.activeWeapon || "fists");
    const edge = Math.max(-0.3, Math.min(0.3, (mine - theirs) / Math.max(mine, theirs)));
    const health = (ctx.self.health - ctx.model.intel.of(t.id).estHealth) / 100;
    // standing still with its back to the bot (looting, away from the keyboard): a free first punch
    const unaware = !faces(t, ctx.self.pos, UNAWARE_DEG) && v2.length(t.vel) < 1 ? UNAWARE_BONUS : 0;
    const odds =
        FIGHT_BASE +
        0.9 * p.aggressionBias +
        0.3 * (p.riskTolerance - 0.5) +
        0.2 * (ctx.skill.g - 0.5) +
        0.4 * health +
        0.5 * edge +
        unaware;
    return Math.min(FIGHT_MAX, Math.max(FIGHT_MIN, odds));
}

/**
 * The fist-fight score of an unarmed bot against the unarmed ctx.target, or null when the rule does not apply (the
 * bot or the target holds a gun, the target is out of sight or beyond DECIDE_RANGE without a decision).
 */
export function fistDuelScore(ctx: BrainCtx): number | null {
    const t = ctx.target;
    if (!ctx.features.pursuit || ctx.armed || !t || !t.visible || t.downed || !bareHanded(ctx, t)) return null;
    const d = ctx.targetDist;
    const fists = ctx.mem.pursuit.fists;
    const { now } = ctx;
    for (const [id, f] of fists) if (now >= f.until) fists.delete(id);
    let f = fists.get(t.id);
    if (!f) {
        if (d > DECIDE_RANGE) return null;
        f = { fight: ctx.rng.next() < fightOdds(ctx, t), until: now + DECISION_HOLD };
        fists.set(t.id, f);
    }
    if (f.fight && d <= CHASE_RANGE) return DUEL_SCORE;
    if (d < IN_REACH && faces(t, ctx.self.pos, FACING_DEG)) return IN_REACH_SCORE;
    // left be: the old rule (fightScore: meleeAggression within 4 units) still decides about one standing right there
    return null;
}
