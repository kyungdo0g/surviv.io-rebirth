// Melee like a human (bot overhaul COMBAT-12; user report 10 "a chasing bot beats the fleeing user when it looks out
// of reach"). The sim matches the original (diagnosis round 2 issue 2 RC0/RC1): the bot-side causes were a chase and
// swing that reacted to the target's current position with no delay, a fists-only reach for every weapon and a body
// overlap (arriveDist 1.2) that started every flight deep inside reach. Now:
// - the chase and the swing judge the gap the screen showed `meleeLag` ago, both positions lagged together
//   (perception/trails.ts; fix concern 1: a delayed target against the true own position under-reports the gap);
// - reach per weapon from its def: the swing circle's offset plus its radius plus the target's body (fists
//   1.35 + 0.9 + 1 = 3.25, sim weapons/melee.ts), swung only inside it less a human's judgement slack;
// - a stand-off of about 2.2 (fists) instead of overlapping bodies, so a target that runs from it gets out of reach
//   while the bot is still reacting (fix concern 5: still close enough to land the swing);
// - the swing waits for the reaction to the target (combat.ts shotCheck), and the trigger clicks at the weapon's
//   cooldown plus a human click gap (brain/trigger.ts).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, type MeleeDef, WeaponSlot } from "@rebirth/defs";
import type { Contact, SelfState } from "../perception/world.ts";
import type { BrainCtx } from "./context.ts";

const PLAYER_RAD = GameConfig.player.radius;
/** A human swings this much inside the true reach (it judges the gap from a delayed screen). */
export const SWING_SLACK = 0.45;
/** Stand-off: the reach less this, within [STAND_MIN, STAND_MAX] (fists: 3.25 - 1.05 = 2.2). */
const STAND_INSIDE = 1.05;
const STAND_MIN = 1.6;
const STAND_MAX = 4;

/** The bot's melee weapon (its melee slot; fists when empty or unknown). */
export function heldMelee(self: SelfState): MeleeDef {
    const id = self.weapons[WeaponSlot.Melee]?.type || "fists";
    const def = hasDef(id) ? GameObjectDefs[id] : undefined;
    return (def?.type === "melee" ? def : GameObjectDefs.fists) as MeleeDef;
}

/** Centre-to-centre distance a swing straight ahead reaches a player at: offset + swing radius + body radius. */
export function meleeReach(def: MeleeDef): number {
    return def.attack.offset.x + def.attack.rad + PLAYER_RAD;
}

/** The gap the bot swings at: the reach less the judgement slack (fists 2.8). */
export function swingBand(def: MeleeDef): number {
    return meleeReach(def) - SWING_SLACK;
}

/** How close a human holds while fighting with `def` (fists 2.2). */
export function standOff(def: MeleeDef): number {
    return Math.min(STAND_MAX, Math.max(STAND_MIN, meleeReach(def) - STAND_INSIDE));
}

/**
 * Where `t` is relative to the bot as the screen showed it params.meleeLag ago (both positions from that moment), or
 * its current offset when there is no older sample (a fresh sighting, a hand-built model).
 */
export function perceivedOffset(ctx: BrainCtx, t: Contact): Vec2 {
    const lagged = ctx.model.trails.laggedOffset(t.id, ctx.now, ctx.params.meleeLag);
    return lagged ?? v2.sub(t.pos, ctx.self.pos);
}
