// Under fire from a shooter the bot cannot see (BrainFeatures.pursuit, bot overhaul round 3, user report 20: "a
// persona-based reaction set: flee opposite with direction changes (zigzag), take cover, push toward the source moving
// cover to cover"). What the bot knows is what a human knows: bullets that passed close (WorldModel.underFire) and where
// their shooter seems to be, the fuzzy origin its tracer and shot sound give (perception/bulletSight.ts: up to 15
// degrees off and -40%..+50% in distance for an off-screen shooter), never the shooter itself. One episode starts with
// the first such bullet, is acted on once that bullet has flown by plus a human reaction (DifficultyParams.dodgeReaction;
// the snapshot reports a bullet's whole path when it is fired), and ends once it has been quiet for a while (2.5-4 s by
// style), the shooter shows up on the screen (the fight takes over), or after EPISODE_CAP; its style is picked once,
// by persona:
// - "run": away from the origin, towards the safe zone and off the map border, in irregular legs (0.3-0.9 s each,
//   20-55 degrees off the way out, the side usually but not always flipping: no sine wave a player can lead);
// - "cover": to the nearest obstacle that breaks the estimated line of fire (not towards the origin), then holds there
//   looking out at it;
// - "push": towards the origin, hop by hop from one cover to the next a few units closer (a pause behind each), or
//   zigzagging in when there is none, until close to where the shots came from (the fight takes over when it shows).
// Aggressive personas push more (aggressionBias, riskTolerance), cautious ones take cover or run (healBias, low risk
// tolerance); an unarmed or badly hurt bot never pushes. The style follows COMBAT's weapon answer for the episode
// (brain/unseenFire.ts): "hold" (the crosshair on the origin's angle) is done from cover, "return" (bursts at the
// origin) goes with cover or a push, never running away, "evade" leaves all three to the persona. The crosshair only
// glances at the origin here (Intent.lookAt): COMBAT's layer puts aim and fire on top (brain/alert.ts), and a visible
// target in reach is still shot at on the way (addCombatLayer). A visible enemy fighting the bot outranks all of this
// (score capped below the fight's).
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import { isNeutral } from "../persona.ts";
import { engagingMe } from "./assess.ts";
import { addCombatLayer, findCoverFrom, freeDir } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { shootRange } from "./pursuit.ts";
import type { EvadeState, EvadeStyle } from "./pursuitMemory.ts";
import { burned } from "./stillHit.ts";
import { inStrike } from "./strikes.ts";
import { zonePressure } from "./survival.ts";
import { unseenReaction } from "./unseenFire.ts";
import { underFireNow, zigzagTo } from "./zigzag.ts";

/** A bullet this fresh (s) starts or feeds an episode. */
const FIRE_FRESH = 1;
/** A hit within this long of a close bullet counts as a hit by that shooter. */
const HIT_LINK = 0.4;
/** Hit this recently: the higher score. */
const HIT_RECENT = 1.5;
/** An episode ends after this long without a close bullet, by style; and lasts at most EPISODE_CAP. */
const QUIET: Readonly<Record<EvadeStyle, number>> = { run: 2.5, cover: 3, push: 4 };
const EPISODE_CAP = 15;
/** A new bullet this long after the last one starts a new episode (a new style roll). */
const NEW_EPISODE = 6;
/** Scores: hit lately, bullets passing, the tail of an episode; capped while a visible enemy fights the bot. */
const HIT_SCORE = 0.82;
const FIRE_SCORE = 0.64;
const TAIL_SCORE = 0.56;
const ENGAGED_CAP = 0.5;
/** Style weights (neutral: run 0.35, cover 0.45, push 0.2). */
const RUN_BASE = 0.35;
const COVER_BASE = 0.45;
const PUSH_BASE = 0.2;
/** No push below this health. */
const PUSH_HEALTH = 50;
/** Cover: spots this close; push: hops this long that end this much closer to the origin. */
const COVER_REACH = 12;
const HOP = 14;
const HOP_GAIN = 3;
/** A push stops this close to the estimated origin (it is a guess: the bot looks around there). */
const PUSH_DONE = 8;
const PAUSE_MIN = 0.5;
const PAUSE_MAX = 1.2;
/** Zigzag legs: duration (s), angle off the base direction (degrees), the chance the side flips. */
const LEG_MIN = 0.3;
const LEG_MAX = 0.9;
const LEG_DEG_MIN = 20;
const LEG_DEG_MAX = 55;
const LEG_FLIP = 0.75;
/** Running: points this far ahead stay this far from the map border. */
const RUN_LOOK = 10;
const BORDER = 14;

/** Median bullet speed of the guns in the defs (u/s): the flight time of a bullet whose own def is not at hand. */
const MEDIAN_BULLET_SPEED = (() => {
    const speeds: number[] = [];
    for (const d of Object.values(GameObjectDefs) as Array<{ type?: string; bulletType?: string }>) {
        if (d.type !== "gun" || !d.bulletType || !hasDef(d.bulletType)) continue;
        const b = GameObjectDefs[d.bulletType] as { speed?: number };
        if (b.speed && b.speed > 0) speeds.push(b.speed);
    }
    speeds.sort((a, b) => a - b);
    return speeds.length ? speeds[Math.floor(speeds.length / 2)] : 100;
})();

/**
 * Seconds until the shooter's bullet reaches the bot: the snapshot reports a bullet with its whole path when it is
 * fired, so "passed close" is known before it flies by; a human notices the tracer as it comes (its def's speed over the
 * way left along its line, else the median speed over the distance to the origin estimate).
 */
function flightTime(ctx: BrainCtx, shooterId: number, origin: Vec2): number {
    const me = ctx.self.pos;
    for (const b of ctx.model.bullets) {
        if (b.shooterId !== shooterId || !hasDef(b.bulletType)) continue;
        const speed = (GameObjectDefs[b.bulletType] as { speed?: number }).speed ?? 0;
        if (speed > 0) return Math.max(0, v2.dot(v2.sub(me, b.pos), b.dir)) / speed;
    }
    return v2.distance(me, origin) / MEDIAN_BULLET_SPEED;
}

/** The bullet that passed close lately from a shooter not on the screen: its origin estimate, or null. */
function unseenBullet(ctx: BrainCtx): { origin: Vec2; shooterId: number; time: number } | null {
    const uf = ctx.model.underFire;
    if (!uf || ctx.now - uf.time > FIRE_FRESH) return null;
    if (ctx.model.contacts.get(uf.shooterId)?.visible) return null;
    return { origin: uf.from, shooterId: uf.shooterId, time: uf.time };
}

/** The episode's rng: the persona stream for a persona (its draws must not shift the brain's), else the brain's. */
function styleRng(ctx: BrainCtx): Rng {
    return isNeutral(ctx.persona) ? ctx.rng : ctx.personaRng;
}

/** Style weights of this bot now (see the header). */
export function styleWeights(ctx: BrainCtx): Record<EvadeStyle, number> {
    const p = ctx.persona;
    const caution = 0.5 - p.riskTolerance;
    let push = PUSH_BASE + 0.8 * p.aggressionBias - 0.6 * caution;
    if (!ctx.armed || ctx.self.health < PUSH_HEALTH) push = 0;
    const cover = COVER_BASE + 0.6 * caution + Math.max(0, p.healBias) / 50;
    const run = RUN_BASE + 0.3 * caution + (ctx.armed ? 0 : 0.3);
    return { run: Math.max(0.05, run), cover: Math.max(0.05, cover), push: Math.max(0, push) };
}

/**
 * The episode's style, matched to COMBAT's weapon answer (brain/unseenFire.ts unseenReaction, decided once for the same
 * episode): holding the origin's angle is done from cover; returning fire goes with cover or a push, never with
 * running away; only when COMBAT leaves it to the movement ("evade", or no answer) do all three styles compete.
 */
function pickStyle(ctx: BrainCtx): EvadeStyle {
    const answer = unseenReaction(ctx)?.choice;
    if (answer === "hold") return "cover";
    const w = styleWeights(ctx);
    if (answer === "return") w.run = 0;
    let r = styleRng(ctx).next() * (w.run + w.cover + w.push);
    for (const s of ["cover", "run", "push"] as const) {
        r -= w[s];
        if (r < 0) return s;
    }
    return "cover";
}

/** Starts, feeds or ends the episode (every think while the flag is on); the episode, or null. */
function updateEpisode(ctx: BrainCtx): EvadeState | null {
    const pm = ctx.mem.pursuit;
    const { now, model } = ctx;
    const b = unseenBullet(ctx);
    let ev = pm.evade;
    if (b) {
        if (!ev || now - ev.lastFire > NEW_EPISODE) {
            ev = {
                style: pickStyle(ctx),
                origin: v2.copy(b.origin),
                shooterId: b.shooterId,
                since: now,
                lastFire: b.time,
                lastHit: Number.NEGATIVE_INFINITY,
                noticeAt: b.time + flightTime(ctx, b.shooterId, b.origin) + ctx.rng.range(...ctx.params.dodgeReaction),
                legSign: 1,
                legAngle: 0,
                legUntil: Number.NEGATIVE_INFINITY,
                spot: null,
                pauseUntil: Number.NEGATIVE_INFINITY,
            };
            pm.evade = ev;
        } else if (b.time > ev.lastFire) {
            ev.lastFire = b.time;
            ev.shooterId = b.shooterId;
            // a new estimate: the cover spot may face the wrong way now (checked in the plan)
            ev.origin = v2.copy(b.origin);
        }
        if (Math.abs(model.lastHurt - b.time) < HIT_LINK || model.lastHurt > b.time) ev.lastHit = model.lastHurt;
    }
    if (!ev) return null;
    const over = now - ev.lastFire > QUIET[ev.style] || now - ev.since > EPISODE_CAP;
    // the shooter on the screen now: it is a fight (or a flight) like any other
    if (over || model.contacts.get(ev.shooterId)?.visible) {
        pm.evade = null;
        return null;
    }
    return ev;
}

/** The style of the episode under way (COMBAT may read it: a pushing bot returns fire at the estimate), or null. */
export function evadeStyle(ctx: BrainCtx): EvadeStyle | null {
    return ctx.features.pursuit ? (ctx.mem.pursuit.evade?.style ?? null) : null;
}

/** Utility of answering unseen fire (BrainFeatures.pursuit): see the header. */
export function evadeScore(ctx: BrainCtx): number {
    if (!ctx.features.pursuit) return 0;
    const ev = updateEpisode(ctx);
    // (kneeling over a teammate: only once hit; the kneel is then cancelled, brain.ts leaveRevive)
    const kneeling = ctx.self.action.type === "revive" && ctx.now - ctx.model.lastHurt > HIT_RECENT;
    if (!ev || ctx.now < ev.noticeAt || ctx.model.inGasNow() || kneeling) return 0;
    const { now } = ctx;
    let s = now - ev.lastHit < HIT_RECENT ? HIT_SCORE : now - ev.lastFire < FIRE_FRESH ? FIRE_SCORE : TAIL_SCORE;
    const t = ctx.target;
    if (t?.visible && !t.downed && ctx.targetDist <= shootRange(ctx) && engagingMe(ctx, t))
        s = Math.min(s, ENGAGED_CAP);
    return s;
}

/** The way out from `origin`: away from it, leaning towards the safe zone, turned off the map border. */
function runBase(ctx: BrainCtx, origin: Vec2): Vec2 {
    const { model, self } = ctx;
    let dir = v2.normalizeSafe(v2.sub(self.pos, origin));
    const gas = model.gas;
    if (gas && gas.mode !== "inactive") {
        const w = model.insideSafeZone(self.pos, 10) ? 0.2 : zonePressure(model) > 0.3 ? 1.6 : 0.8;
        dir = v2.normalizeSafe(v2.add(dir, v2.mul(v2.normalizeSafe(v2.sub(gas.posNew, self.pos)), w)));
    }
    const w = model.map.width;
    const h = model.map.height;
    for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.6, -1.6]) {
        const d = a === 0 ? dir : v2.rotate(dir, a);
        const p = v2.add(self.pos, v2.mul(d, RUN_LOOK));
        if (p.x > BORDER && p.y > BORDER && p.x < w - BORDER && p.y < h - BORDER && !inStrike(ctx, p)) return d;
    }
    return dir;
}

/** One zigzag step along `base`: irregular legs (see the header); null when every way is walled. */
function zigzag(ctx: BrainCtx, ev: EvadeState, base: Vec2): Vec2 | null {
    const { now, rng } = ctx;
    if (now >= ev.legUntil) {
        ev.legSign = rng.next() < LEG_FLIP ? -ev.legSign : ev.legSign;
        ev.legAngle = (rng.range(LEG_DEG_MIN, LEG_DEG_MAX) * Math.PI) / 180;
        ev.legUntil = now + rng.range(LEG_MIN, LEG_MAX);
    }
    const dir = v2.rotate(base, ev.legSign * ev.legAngle);
    const free = freeDir(ctx.model, ctx.self.pos, dir);
    if (!free) {
        ev.legSign = -ev.legSign;
        ev.legUntil = now + LEG_MIN;
    }
    return free;
}

/** A spot within COVER_REACH hidden from `origin`, not towards it. */
function coverSpot(ctx: BrainCtx, origin: Vec2): Vec2 | null {
    const me = ctx.self.pos;
    const mine = v2.distance(me, origin);
    return findCoverFrom(ctx.model, me, origin, COVER_REACH + 4, (spot) => {
        if (v2.distance(spot, me) > COVER_REACH || v2.distance(spot, origin) < mine - 2) return false;
        return reachable(ctx, spot, 1) && !nearFailedGoal(ctx, spot) && !inStrike(ctx, spot) && !burned(ctx, spot);
    });
}

/** The next push hop: cover within HOP, at least HOP_GAIN closer to `origin` (not closer than PUSH_DONE - 2). */
function hopSpot(ctx: BrainCtx, origin: Vec2): Vec2 | null {
    const me = ctx.self.pos;
    const mine = v2.distance(me, origin);
    return findCoverFrom(ctx.model, me, origin, HOP + 4, (spot) => {
        const left = v2.distance(spot, origin);
        if (v2.distance(spot, me) > HOP || left > mine - HOP_GAIN || left < PUSH_DONE - 2) return false;
        return reachable(ctx, spot, 1) && !nearFailedGoal(ctx, spot) && !inStrike(ctx, spot) && !burned(ctx, spot);
    });
}

function goTo(intent: Intent, p: Vec2, arrive = 0.6): void {
    intent.goal = v2.copy(p);
    intent.arriveDist = arrive;
}

/** Cover: the spot (found again when the estimate moved and exposed it), else run. */
function planCover(ctx: BrainCtx, intent: Intent, ev: EvadeState): boolean {
    const model = ctx.model;
    // (a spot the bot was shot on does not shield, whatever the estimate says: stillHit.ts)
    if (!ev.spot || model.bodyLineOfFire(ev.origin, ev.spot) || nearFailedGoal(ctx, ev.spot) || burned(ctx, ev.spot))
        ev.spot = coverSpot(ctx, ev.origin);
    if (!ev.spot) return false;
    if (v2.distance(ctx.self.pos, ev.spot) > 0.8) {
        goTo(intent, ev.spot);
        // still being shot at on the way: irregular legs, not a straight line into the spot (zigzag.ts)
        if (underFireNow(ctx)) zigzagTo(ctx, intent, ev.spot);
    } else intent.stop = true;
    return true;
}

/** Push: hop to the next cover closer to the origin, pause behind it, zigzag in without cover. */
function planPush(ctx: BrainCtx, intent: Intent, ev: EvadeState): void {
    const { now, rng, self } = ctx;
    const me = self.pos;
    if (v2.distance(me, ev.origin) < PUSH_DONE) {
        // where the shots came from: hold the last cover (or stand) and look around
        if (ev.spot && v2.distance(me, ev.spot) > 0.8) goTo(intent, ev.spot);
        else intent.stop = true;
        return;
    }
    if (ev.spot && v2.distance(me, ev.spot) <= 0.8) {
        if (ev.pauseUntil === Number.NEGATIVE_INFINITY) ev.pauseUntil = now + rng.range(PAUSE_MIN, PAUSE_MAX);
        if (now < ev.pauseUntil) {
            intent.stop = true;
            return;
        }
        ev.spot = null;
    }
    if (!ev.spot || nearFailedGoal(ctx, ev.spot)) {
        ev.spot = hopSpot(ctx, ev.origin);
        ev.pauseUntil = Number.NEGATIVE_INFINITY;
    }
    if (ev.spot) {
        goTo(intent, ev.spot);
        if (underFireNow(ctx)) zigzagTo(ctx, intent, ev.spot);
        return;
    }
    const dir = zigzag(ctx, ev, v2.normalizeSafe(v2.sub(ev.origin, me)));
    if (dir) intent.moveDir = dir;
    else intent.stop = true;
}

/** The answer to unseen fire (BrainFeatures.pursuit): run, cover or push by the episode's style. */
export function planEvade(ctx: BrainCtx): Intent {
    const intent = emptyIntent("evade");
    const ev = ctx.mem.pursuit.evade;
    if (!ev) {
        intent.stop = true;
        return intent;
    }
    if (ev.style === "push") planPush(ctx, intent, ev);
    else if (ev.style !== "cover" || !planCover(ctx, intent, ev)) {
        const dir = zigzag(ctx, ev, runBase(ctx, ev.origin));
        if (dir) intent.moveDir = dir;
        else intent.stop = true;
    }
    addCombatLayer(ctx, intent);
    if (!intent.aim) intent.lookAt = v2.copy(ev.origin);
    return intent;
}
