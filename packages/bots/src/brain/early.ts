// The owner's early-game items (bot round 6, user reports 38, 39, 41; every mode, each behind its own BrainFeatures
// flag), from his own play:
// - 38 fistRush: early in a match (the bot's first EARLY_ALIVE seconds alive, few guns around) real players rush an
//   armed enemy with their fists, even one holding a rifle or a shotgun: they juke all the way in (legs of 0.25-0.7 s,
//   30-65 degrees off the way in, mostly flipping sides: no straight line to lead), then punch at point blank. Each
//   enemy gets one decision, held RUSH_HOLD seconds, at odds set by the persona (aggressive often, cautious rarely)
//   and a little by game sense; a pistol is rushed more readily than a long gun. A gun lying within reach comes first.
// - 39 meleeAnswer: an armed bot whose bare-handed rusher gets within ANSWER_DIST either swaps to melee and fights it
//   out or keeps the gun out to the end (the owner's own way): one decision per rusher, by persona.
// - 41 crateFirst: unarmed with an enemy near but not yet in melee range, the bot first breaks a cheap crate within a
//   couple of seconds' walk (one that holds guns, its fists break it in CRATE_BREAK seconds, not past the enemy), takes
//   the gun and re-engages armed (the break behaviour scores CRATE_SCORE: above the fist fight and the flight).
// Round 5 still holds: bare hands against bare hands is brain/fists.ts's fight-or-leave decision, and every decision
// here is held per enemy, so no flee / come back loop starts.
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius, distanceToCollider } from "../geom.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import type { Contact, SeenObstacle } from "../perception/world.ts";
import { enemyGun } from "./assess.ts";
import { freeDir, reactedTo, shotCheck } from "./combat.ts";
import { containerValue, finishSeconds, meleeBreaks } from "./containers.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable } from "./context.ts";
import { bareHanded } from "./fists.ts";
import { heldMelee, perceivedOffset, standOff, swingBand } from "./melee.ts";
import { type BreakChoice, breakableNow } from "./scavenge.ts";

/** The early game: the bot's first this many seconds alive. */
export const EARLY_ALIVE = 60;
/** A rush is decided for an armed enemy this close, and pressed while it stays this close. */
const RUSH_DECIDE = 16;
const RUSH_CHASE = 24;
/** One decision per enemy holds this long. */
const HOLD = 20;
/** Score of a rush (above the unarmed flight's 0.8). */
export const RUSH_SCORE = 0.85;
/** Odds of rushing: base, persona weights, a long gun's factor, and the bounds. */
const RUSH_BASE = 0.3;
const LONG_GUN = 0.7;
const RUSH_MIN = 0.03;
const RUSH_MAX = 0.85;
/** A gun lying this close is picked up instead. */
const GUN_NEAR = 5;
/** Juke legs: duration and angle off the way in; the side flips this often; straight in from JUKE_END. */
const JUKE_MIN = 0.25;
const JUKE_MAX = 0.7;
const JUKE_DEG_MIN = 30;
const JUKE_DEG_MAX = 65;
const JUKE_FLIP = 0.8;
const JUKE_END = 4.5;
/** A bare-handed rusher this close gets the answer (39). */
export const ANSWER_DIST = 4;
/** Odds of swapping to melee: base and bounds. */
const SWAP_BASE = 0.5;
const SWAP_MIN = 0.05;
const SWAP_MAX = 0.95;
/** Crate first (41): an enemy within CRATE_ENEMY but beyond CRATE_MELEE, a crate within CRATE_REACH... */
const CRATE_ENEMY = 28;
const CRATE_MELEE = 5;
const CRATE_REACH = 12;
/** ...that the bot's melee breaks within CRATE_BREAK seconds and that holds guns (containers.ts value). */
const CRATE_BREAK = 2.5;
const CRATE_VALUE = 30;
export const CRATE_SCORE = 0.83;

/** Whether the bot is in its early game (its alive time counts from its first decision with an early flag on). */
export function earlyGame(ctx: BrainCtx): boolean {
    const em = ctx.mem.early;
    if (!Number.isFinite(em.bornAt)) em.bornAt = ctx.now;
    return ctx.now - em.bornAt < EARLY_ALIVE;
}

function held(map: Map<number, { yes: boolean; until: number }>, now: number, id: number) {
    for (const [k, c] of map) if (now >= c.until) map.delete(k);
    return map.get(id);
}

/** The chance the bot rushes the armed `e` with its fists (persona, game sense, the gun it faces). */
export function rushOdds(ctx: BrainCtx, e: Contact): number {
    const p = ctx.persona;
    const gun = enemyGun(ctx, e);
    const odds =
        (RUSH_BASE + 1.2 * p.aggressionBias + 0.5 * (p.riskTolerance - 0.5) + 0.2 * (ctx.skill.g - 0.5)) *
        (gun && gun.cls !== "pistol" ? LONG_GUN : 1);
    return Math.min(RUSH_MAX, Math.max(RUSH_MIN, odds));
}

/** The armed enemy the bot rushes now, or null. */
export function rushTarget(ctx: BrainCtx): Contact | null {
    if (ctx.armed || ctx.self.downed) return null;
    let best: Contact | null = null;
    let bestD = RUSH_CHASE;
    for (const e of ctx.visibleEnemies) {
        if (e.downed || !enemyGun(ctx, e)) continue;
        const d = v2.distance(e.pos, ctx.self.pos);
        if (d < bestD) {
            bestD = d;
            best = e;
        }
    }
    if (!best) return null;
    const em = ctx.mem.early;
    let c = held(em.rush, ctx.now, best.id);
    if (!c) {
        if (bestD > RUSH_DECIDE) return null;
        c = { yes: ctx.rng.next() < rushOdds(ctx, best), until: ctx.now + HOLD };
        em.rush.set(best.id, c);
    }
    return c.yes ? best : null;
}

function gunNear(ctx: BrainCtx): boolean {
    for (const l of ctx.model.loot.values()) {
        if (v2.distance(l.pos, ctx.self.pos) < GUN_NEAR && (gunInfo(l.type)?.score ?? 0) > 0) return true;
    }
    return false;
}

/** Utility of a fist rush (BrainFeatures.fistRush; the "rush" behaviour). */
export function rushScore(ctx: BrainCtx): number {
    if (!earlyGame(ctx) || ctx.armed || ctx.self.downed || gunNear(ctx)) return 0;
    return rushTarget(ctx) ? RUSH_SCORE : 0;
}

/** The rush: juke in on where the enemy seemed to be, punch once in reach. */
export function planRush(ctx: BrainCtx): Intent {
    const intent = emptyIntent("rush");
    const t = rushTarget(ctx);
    if (!t) return intent;
    const def = heldMelee(ctx.self);
    intent.slot = WeaponSlot.Melee;
    intent.targetId = t.id;
    shotCheck(ctx, t, v2.distance(t.pos, ctx.self.pos));
    const rel = perceivedOffset(ctx, t);
    const d = v2.length(rel);
    const seen = v2.add(ctx.self.pos, rel);
    intent.aim = seen;
    intent.fire = reactedTo(ctx, t) && d <= swingBand(def);
    if (d > JUKE_END) {
        const dir = juke(ctx, v2.normalizeSafe(rel));
        if (dir) intent.moveDir = dir;
        else {
            intent.goal = seen;
            intent.arriveDist = standOff(def);
        }
    } else {
        intent.goal = seen;
        intent.arriveDist = standOff(def);
    }
    intent.urgent = true;
    return intent;
}

/** One juke leg along `base` (see the header), or null when the leg is walled. */
function juke(ctx: BrainCtx, base: Vec2): Vec2 | null {
    const em = ctx.mem.early;
    const { now, rng } = ctx;
    if (now >= em.jukeUntil) {
        em.jukeSign = rng.next() < JUKE_FLIP ? -em.jukeSign : em.jukeSign;
        em.jukeAngle = (rng.range(JUKE_DEG_MIN, JUKE_DEG_MAX) * Math.PI) / 180;
        em.jukeUntil = now + rng.range(JUKE_MIN, JUKE_MAX);
    }
    const free = freeDir(ctx.model, ctx.self.pos, v2.rotate(base, em.jukeSign * em.jukeAngle));
    return free && v2.dot(free, base) > 0.15 ? free : null;
}

/** The chance the bot swaps to melee against a bare-handed rusher at point blank (persona; skill keeps the gun). */
export function swapOdds(ctx: BrainCtx): number {
    const p = ctx.persona;
    const odds = SWAP_BASE + 0.8 * p.aggressionBias + 0.4 * (p.riskTolerance - 0.5) - 0.3 * (ctx.skill.s - 0.5);
    return Math.min(SWAP_MAX, Math.max(SWAP_MIN, odds));
}

/**
 * The slot against a bare-handed `t` at `dist` (BrainFeatures.meleeAnswer): melee when the bot decided to fight it out
 * once the rusher came within ANSWER_DIST, else `want` (the gun).
 */
export function answerSlot(ctx: BrainCtx, t: Contact, dist: number, want: number): number {
    if (!ctx.armed || !t.visible || t.downed || !bareHanded(ctx, t)) return want;
    const em = ctx.mem.early;
    let c = held(em.answer, ctx.now, t.id);
    if (!c) {
        if (dist > ANSWER_DIST) return want;
        c = { yes: ctx.rng.next() < swapOdds(ctx), until: ctx.now + HOLD };
        em.answer.set(t.id, c);
    }
    return c.yes && dist <= ANSWER_DIST * 1.5 ? WeaponSlot.Melee : want;
}

/** The standing enemy nearest the bot in view, with its distance. */
function nearestEnemy(ctx: BrainCtx): { e: Contact; d: number } | null {
    let best: { e: Contact; d: number } | null = null;
    for (const e of ctx.visibleEnemies) {
        if (e.downed) continue;
        const d = v2.distance(e.pos, ctx.self.pos);
        if (!best || d < best.d) best = { e, d };
    }
    return best;
}

/**
 * Crate first (BrainFeatures.crateFirst): the break score of `crate` for an unarmed bot with an enemy near but not
 * yet in melee range, when the crate is close, cheap to break, holds guns and is not past the enemy; else 0.
 */
export function crateFirstScore(ctx: BrainCtx, crate: BreakChoice | null): number {
    if (!crate || ctx.armed || ctx.self.downed) return 0;
    const near = nearestEnemy(ctx);
    if (!near || near.d > CRATE_ENEMY || near.d < CRATE_MELEE) return 0;
    return cheapCrate(ctx, crate.obstacle, crate.dist, near.e) ? CRATE_SCORE : 0;
}

function cheapCrate(ctx: BrainCtx, o: SeenObstacle, dist: number, enemy: Contact): boolean {
    if (dist > CRATE_REACH || !meleeBreaks(ctx.self, o) || o.def.airdropCrate) return false;
    if (containerValue(o) < CRATE_VALUE || finishSeconds(o, ctx.self) > CRATE_BREAK) return false;
    // not past the enemy: the crate is nearer the bot than the enemy is
    return v2.distance(o.view.pos, enemy.pos) >= dist;
}

/**
 * The crate an unarmed bot with an enemy near breaks first (BrainFeatures.crateFirst): the nearest cheap one of those
 * crateFirstScore accepts that it can reach, or null (the regular container choice may prefer a richer one farther).
 */
export function crateFirstChoice(ctx: BrainCtx): BreakChoice | null {
    if (ctx.armed || ctx.self.downed) return null;
    const near = nearestEnemy(ctx);
    if (!near || near.d > CRATE_ENEMY || near.d < CRATE_MELEE) return null;
    let best: BreakChoice | null = null;
    for (const o of ctx.model.obstacles) {
        if (!breakableNow(o) || o.def.airdropCrate || o.view.layer !== ctx.self.layer) continue;
        const d = distanceToCollider(ctx.self.pos, o.col);
        if (best && d >= best.dist) continue;
        if (!cheapCrate(ctx, o, d, near.e)) continue;
        if (!reachable(ctx, colliderCenter(o.col), colliderRadius(o.col) + 1.8)) continue;
        best = { obstacle: o, value: containerValue(o), dist: d };
    }
    return best;
}
