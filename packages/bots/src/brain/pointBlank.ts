// Point blank (owner report 2026-10-10, a screenshot: two players pressed body to body on stairs, both shooting guns
// whose muzzle sits past the other's body, so every bullet spawns beyond the target and misses; neither swaps to fists
// or melee). The sim is right: survev spawns a bullet barrelLength ahead of the player's centre (sim weapons/gun.ts),
// and a body whose far side is nearer than that is not hit (measured on the flat map: the AK-47, barrel 3.15, hits a
// player 2.5 u away and misses at 2; the MP5, 2.625, hits at 2 and misses at 1.6). So, with a gun in hand and the
// target at point blank (its far side inside the muzzle: muzzleReach), the bot does not fire (combat.ts shotCheck) and
// either backs off to where the gun hits or swaps to melee and fights, a choice held per enemy like the melee answer
// to a fist rush (early.ts answerSlot): bold, risk-taking personas swing more, skilled bots back off to use the gun
// more (pointBlankOdds); a bot with nowhere to back off to swings, and so does one that backs off for BACK_LIMIT
// without getting out of point blank (players walk through each other: a hugger that follows at the same speed stays
// on top of it). Bots that mean to melee (a fist rush, a melee fight) are not affected: they hold melee already.
import { v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, WeaponSlot } from "@rebirth/defs";
import type { Contact } from "../perception/world.ts";
import { freeDir } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";

const PLAYER_RAD = GameConfig.player.radius;
/** A target this much beyond the point-blank distance still counts (it steps in and out between thinks). */
const MARGIN = 0.3;
/** Backing off goes on until the target is this far past the point-blank distance. */
const BACK_TO = 1.5;
/** The choice holds this long per enemy. */
const HOLD = 10;
/** Backing off this long while still at point blank: the bot swings instead. */
const BACK_LIMIT = 1.2;
/** Odds of swinging rather than backing off: base and bounds. */
const MELEE_BASE = 0.35;
const MELEE_MIN = 0.08;
const MELEE_MAX = 0.85;

/** The point-blank distance of a gun: a target whose centre is nearer has its far side inside the muzzle. */
export function muzzleReach(gunId: string): number {
    const def = hasDef(gunId) ? (GameObjectDefs[gunId] as { type: string; barrelLength?: number }) : undefined;
    if (def?.type !== "gun" || !def.barrelLength) return 0;
    return def.barrelLength - PLAYER_RAD + MARGIN;
}

/** Whether a target `dist` away is at point blank for the gun `gunId` (its bullets would spawn past it). */
export function muzzlePast(gunId: string, dist: number): boolean {
    return dist < muzzleReach(gunId);
}

/** The chance the bot swings at a point-blank enemy instead of backing off (persona; skill backs off more). */
export function pointBlankOdds(ctx: BrainCtx): number {
    const p = ctx.persona;
    const odds = MELEE_BASE + 0.8 * p.aggressionBias + 0.4 * (p.riskTolerance - 0.5) - 0.4 * (ctx.skill.s - 0.5);
    return Math.min(MELEE_MAX, Math.max(MELEE_MIN, odds));
}

/**
 * A unit number for the choice about enemy `id`, from the bot's seed (the Brain's profile seed, kept by the puzzle
 * memory) and the enemy's id: no draw from the brain's rng, so the rest of its decisions do not shift.
 */
function drawFor(ctx: BrainCtx, id: number): number {
    let h = Math.imul((ctx.mem.puzzle.seed ^ Math.imul(id, 0x9e3779b1) ^ 0x51ed) >>> 0, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** The held choice about `t` at point blank: true to swing, false to back off; null while it is not point blank. */
function choice(ctx: BrainCtx, t: Contact, gunId: string, dist: number): boolean | null {
    const choices = ctx.mem.fight.pointBlank;
    for (const [id, c] of choices) if (ctx.now >= c.until) choices.delete(id);
    let c = choices.get(t.id);
    const reach = muzzleReach(gunId);
    if (!c) {
        if (dist >= reach) return null;
        c = { yes: drawFor(ctx, t.id) < pointBlankOdds(ctx), until: ctx.now + HOLD, since: ctx.now };
        choices.set(t.id, c);
    }
    // still at point blank after backing off a while: it follows step for step, so the bot swings
    if (!c.yes && dist < reach && ctx.now - c.since > BACK_LIMIT) c.yes = true;
    if (dist >= reach) c.since = ctx.now;
    // backing off goes on to BACK_TO past the point-blank distance; a swing holds while it stays close
    return dist < reach + (c.yes ? MARGIN : BACK_TO) ? c.yes : null;
}

/** The fight slot against `t` at `dist`: melee when the bot chose to swing at it at point blank, else `want`. */
export function pointBlankSlot(ctx: BrainCtx, t: Contact, dist: number, want: number): number {
    if (want !== WeaponSlot.Primary && want !== WeaponSlot.Secondary) return want;
    if (!t.visible || t.downed) return want;
    const gun = ctx.self.weapons[want]?.type ?? "";
    return choice(ctx, t, gun, dist) === true ? WeaponSlot.Melee : want;
}

/**
 * After the decision: a bot fighting `ctx.target` with a gun at point blank that chose to back off steps away from it
 * (a free direction, aim kept on it) until its gun hits again; with nowhere to go it swings instead.
 */
export function keepGunRange(ctx: BrainCtx, intent: Intent): void {
    const t = ctx.target;
    if (!t?.visible || t.downed || intent.targetId !== t.id) return;
    const slot = intent.slot ?? ctx.self.curWeapIdx;
    if (slot !== WeaponSlot.Primary && slot !== WeaponSlot.Secondary) return;
    const gun = ctx.self.weapons[slot]?.type ?? "";
    const d = ctx.targetDist;
    if (choice(ctx, t, gun, d) !== false) return;
    const me = ctx.self.pos;
    const away = freeDir(ctx.model, me, v2.normalizeSafe(v2.sub(me, t.pos), { x: 1, y: 0 }));
    if (!away) {
        // cornered (a stairwell, a doorway): swing at it rather than shoot past it
        const c = ctx.mem.fight.pointBlank.get(t.id);
        if (c) c.yes = true;
        intent.slot = WeaponSlot.Melee;
        intent.fire = false;
        return;
    }
    intent.moveDir = away;
    intent.goal = null;
    intent.stop = false;
    intent.urgent = true;
    intent.fire = false;
    intent.aim = v2.copy(t.pos);
}
