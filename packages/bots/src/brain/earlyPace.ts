// Early-game pacing (BrainFeatures.earlyPace; the owner's report of 2026-10-08: bots die en masse from the very start,
// with 200 players it was soon down to 40). Measured with scripts/earlyDeaths.ts (main map, the server's skill tiers
// and personas, normal gas, seeds 1-3): with 80 players 30% were alive when the first gas moved (90 s) and 7% when the
// second circle closed (210 s); every match was over by 230-390 s. Nine deaths in ten were gun kills, not fists;
// turning off the round-6 early items (fist rush, melee answer, crate first), third-partying or loot routing changed
// nothing measurable (28-32% alive at 90 s). No source gives the original's alive curve (docs/research has none), so
// the owner-level expectation stands in: early fist fights happen, but most players are still alive when the first gas
// moves and about half remain at the end of the second gas stage.
// What drives it (probes on the same matches): armed bots open a fight with every enemy they see that is worth one
// (fightScore 0.74 against 0.20 for the best loot, 190 such starts per match in the first 2 minutes), and shoot on the
// move while looting. Two armed bots meeting within 15 u ended in a death two times in three.
// People loot up first: in the first minutes most players with a gun who see another one, not shooting at them, let
// him be and loot elsewhere (a better gun, armour, heals); a few hunt from the start. Shot at, hit, rushed with fists
// or met at arm's reach, everyone fights. So, while the loot phase lasts (paceStrength: full through the first gas
// move, then fading out by the end of the third gas stage; the gas timer is on every player's screen):
// - an armed bot hunts (starts fights as before) only if its own roll, drawn once for the match, is under its hunt odds
//   (huntOdds: persona and loadout), which grow to 1 as the phase fades. A first version rolled once per enemy (odds
//   0.02-0.33): a bot sees many enemies before the first gas, so nearly every bot took one on and 47% were alive at
//   90 s, 10% at 210 s; a roll per bot does not grow with the number of enemies in view, so it holds at 200 players;
// - a bot that does not hunt neither starts a fight (the fight score drops under exploring) nor shoots at an enemy on
//   the move (assess.ts holdFire) nor throws at it (brain.ts), and the loot and goals within KEEP_AWAY of an armed enemy
//   it saw lately are looked for elsewhere (danger.ts avoidPos), so it does not walk up to it and meet it at arm's
//   reach;
// - a threat ends the restraint at once and for PROVOKED_HOLD seconds after its last sign: shot at or hit by the
//   enemy, a fist rush coming in, arm's reach facing the bot (CLOSE). Proximity alone is no threat: with 8 u for a hit
//   from anyone and for a bare-handed walker, and 3 u for anyone, half the lobby had died by the first gas move.
// Result (scripts/earlyDeaths.ts, seeds 1-3, normal gas: the first gas moves at 80 s, the second wait starts at 110 s,
// the second circle closes at 200 s), alive before -> after, with the losing fist fighter's break-off (fists.ts):
// 80 players 41% -> 58% at 80 s, 26% -> 44% at 110 s, 7% -> 15% at 200 s; 200 players 32% -> 58%, 18% -> 43%,
// 5% -> 17%; fist and melee deaths in the first 2 minutes 20 -> 6 (80) and 141 -> 98 (200).
import { type Vec2, v2 } from "@rebirth/core";
import type { Contact } from "../perception/world.ts";
import { enemyGun, engagingMe, faces } from "./assess.ts";
import type { BehaviourName, BrainCtx } from "./context.ts";
import { closingSpeed } from "./pursuit.ts";

/** The loot phase holds through gas stage FADE_FROM (0: the first wait) and fades out evenly over FADE_STAGES stages. */
const FADE_FROM = 2;
const FADE_STAGES = 4;
/** An enemy this close that faces the bot within CLOSE_DEG is at arm's reach: no one lets it be. */
const CLOSE = 3;
const CLOSE_DEG = 90;
/**
 * A bare-handed enemy coming at the bot (closing faster than CLOSING within RUSH_ALERT, facing it within RUSH_DEG) is a
 * fist rush on its last straight leg (early.ts: straight in from 4.5 u), met with the melee answer or the gun
 * (early.ts ANSWER_DIST 4). Not an armed one walking its way: bots (and people) look where they walk, so every enemy
 * heading for loot near the bot looked like one; from 8 u or 6 u it still made a fight of most unarmed bots walking
 * to loot past an armed one (a match probe: about half the loot-phase gunfights of bots that did not hunt were on an
 * unarmed bot that then fled).
 */
const RUSH_ALERT = 4;
const RUSH_DEG = 25;
const CLOSING = 4;
/** Hurt by the target's bullets this lately: a fight on, not one to start. */
const HURT_RECENT = 6;
/**
 * Hurt within HURT_BLOW seconds while the target is this close and no other shooter's bullets explain it: its blow.
 * (8 u and 6 s made a fight with whoever stood near of every stray hit and barrel blast.)
 */
const HURT_NEAR = 4;
const HURT_BLOW = 2;
/**
 * A provocation holds this long after its last sign. Not "the bot fired at it lately": that held every fight the bot
 * had begun for any reason for as long as it kept shooting, a fleeing enemy included.
 */
const PROVOKED_HOLD = 6;
/**
 * A spot this close to an armed enemy is not walked to by a bot that does not hunt (faded with the phase), the enemy
 * as last seen up to KEEP_MEMORY seconds ago (one seen walking into a house is still in it).
 */
const KEEP_AWAY = 14;
const KEEP_MEMORY = 8;
/** Fight score of an enemy left be: under exploring's 0.12, so the bot goes about its business. */
const LEAVE_SCORE = 0.02;
/** Extension behaviours that start or chase a fight on the bot's own initiative (pacedExtension). */
const PACED: ReadonlySet<BehaviourName> = new Set<BehaviourName>(["thirdparty", "search"]);
/** huntOdds: base and bounds. */
const HUNT_BASE = 0.08;
const HUNT_MIN = 0.02;
const HUNT_MAX = 0.6;

/**
 * How strongly the loot phase holds now: 1 through the first wait and move, then down to 0 evenly over the next
 * FADE_STAGES stages (by stage progress, as the gas timer shows it); 0 on faction maps and with the gas inactive (no
 * match clock: the pre-game lobby, a sandbox, where the old fight rules hold: test/combat-fire.test.ts), 1 with no gas
 * seen yet.
 */
export function paceStrength(ctx: BrainCtx): number {
    if (ctx.model.faction?.active) return 0;
    const gas = ctx.model.gas;
    if (!gas) return 1;
    if (gas.mode === "inactive") return 0;
    if (gas.circleIdx < 0) return 1;
    const stage = gas.circleIdx * 2 + (gas.mode === "moving" ? 1 : 0);
    return Math.min(1, Math.max(0, 1 - (stage - FADE_FROM + gas.gasT) / FADE_STAGES));
}

/**
 * The chance an armed bot hunts in the full loot phase: a bold persona or a risk taker more, a cautious one less, a
 * strong loadout (`confidence`, fightScore.ts: 0.55 for a D-tier gun .. 1.1 for A and up) more. With the server's
 * persona mix about one bot in nine: rushers 0.3, riflemen 0.05-0.13, the cautious ones 0.02-0.07.
 */
export function huntOdds(ctx: BrainCtx, confidence: number): number {
    const p = ctx.persona;
    const odds = HUNT_BASE + 0.6 * p.aggressionBias + 0.3 * (p.riskTolerance - 0.5) + 0.15 * (confidence - 0.75);
    return Math.min(HUNT_MAX, Math.max(HUNT_MIN, odds));
}

/**
 * Whether an armed bot hunts now (BrainFeatures.earlyPace): its roll, drawn on its first armed think, under its hunt
 * odds as the phase fades. Noted on every think of an armed bot (fightScore), read by leftBe and nearLeftBe.
 */
export function noteHunt(ctx: BrainCtx, confidence: number): boolean {
    const em = ctx.mem.early;
    if (em.hunting) return true;
    const k = paceStrength(ctx);
    if (k <= 0) em.hunting = true;
    else {
        if (Number.isNaN(em.huntRoll)) em.huntRoll = ctx.rng.next();
        em.hunting = em.huntRoll < 1 - k * (1 - huntOdds(ctx, confidence));
    }
    return em.hunting;
}

/** Whether `t` at `d` provokes the bot now: shooting at it or engaged with it, its blow, arm's reach, a fist rush. */
function provokes(ctx: BrainCtx, t: Contact, d: number): boolean {
    const { now, model } = ctx;
    if (engagingMe(ctx, t) || model.intel.of(t.id).engagedWith === ctx.self.id) return true;
    // hurt lately by this one (its bullets, or a blow from close by); a stray hit from someone else's fight is no
    // reason to start one with every enemy in view (a match probe: the largest share of loot-phase fight starts)
    const uf = model.underFire;
    if (now - model.lastHurt < HURT_RECENT && uf?.shooterId === t.id && now - uf.time < HURT_RECENT) return true;
    const shotByOther = !!uf && uf.shooterId !== t.id && now - uf.time < HURT_BLOW;
    if (now - model.lastHurt < HURT_BLOW && d < HURT_NEAR && !shotByOther) return true;
    if (d < CLOSE && faces(t, ctx.self.pos, CLOSE_DEG)) return true;
    // a fist rush coming in: a threat, not a choice
    return (
        !enemyGun(ctx, t) &&
        d < RUSH_ALERT &&
        t.visible &&
        closingSpeed(ctx, t) > CLOSING &&
        faces(t, ctx.self.pos, RUSH_DEG)
    );
}

/**
 * Whether a fight with `t` at `d` is one the bot would start now: `t` has not provoked it within PROVOKED_HOLD. A
 * target out of sight counts too: chasing a remembered enemy it left be is starting that fight (match probe: many
 * fight starts beyond 12 u went after an enemy that had just stepped out of sight).
 */
function unprovoked(ctx: BrainCtx, t: Contact, d: number): boolean {
    if (t.downed) return false;
    const seen = ctx.mem.early.provoked;
    if (provokes(ctx, t, d)) seen.set(t.id, ctx.now);
    const at = seen.get(t.id);
    if (at === undefined) return true;
    if (ctx.now - at < PROVOKED_HOLD) return false;
    seen.delete(t.id);
    return true;
}

/** The fight score `s` of an armed bot with the loot phase applied: LEAVE_SCORE for an unprovoked fight unless it hunts. */
export function pacedFightScore(ctx: BrainCtx, s: number, confidence: number): number {
    if (!ctx.armed) return s;
    const hunting = noteHunt(ctx, confidence);
    const t = ctx.target;
    if (hunting || s <= LEAVE_SCORE || !t || !unprovoked(ctx, t, ctx.targetDist)) return s;
    return LEAVE_SCORE;
}

/**
 * The score `s` of the extension behaviour `name` with the loot phase applied: a bot that does not hunt neither joins
 * others' fights (thirdparty) nor hunts down an enemy that slipped out of sight (search).
 */
export function pacedExtension(ctx: BrainCtx, name: BehaviourName, s: number): number {
    if (s <= 0 || !PACED.has(name) || !ctx.armed || ctx.mem.early.hunting || paceStrength(ctx) <= 0) return s;
    return 0;
}

/** Whether the bot leaves `t` at `d` be (it does not hunt, `t` has not provoked it): no shot or throw at it. */
export function leftBe(ctx: BrainCtx, t: Contact, d: number): boolean {
    return ctx.armed && !ctx.mem.early.hunting && paceStrength(ctx) > 0 && unprovoked(ctx, t, d);
}

/**
 * Whether `p` (an item, a container, an explore goal) lies within KEEP_AWAY of an armed enemy seen lately while the bot
 * does not hunt: it looks for its loot elsewhere (danger.ts avoidPos) instead of walking up to the enemy, where an
 * arm's-reach meeting starts the fight anyway (a match probe: with no fight chosen beyond arm's reach, half the lobby
 * still died by the first gas, the first hit at a median 3-5 u).
 */
export function nearLeftBe(ctx: BrainCtx, p: Vec2): boolean {
    if (!ctx.armed || ctx.mem.early.hunting) return false;
    const reach = KEEP_AWAY * paceStrength(ctx);
    if (reach <= 0) return false;
    for (const e of ctx.enemies) {
        if (e.downed || ctx.now - e.lastSeen > KEEP_MEMORY || !enemyGun(ctx, e)) continue;
        if (v2.distance(e.pos, p) < reach) return true;
    }
    return false;
}
