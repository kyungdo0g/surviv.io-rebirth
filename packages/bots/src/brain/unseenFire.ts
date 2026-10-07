// Fire from a shooter off the bot's screen (round 3, user report 20, the combat side; BrainFeatures.threats). What the
// bot knows is what a human knows: bullets that crossed its screen and where their shooter seems to be, the fuzzy origin
// its tracer and shot sound give (perception/bulletSight.ts: up to 15 degrees off as the bot sees it, -40%..+50% in
// distance; each return-fire burst sprays around it by skill, SCATTER_LO..SCATTER_HI), never the
// shooter itself. Once per episode (one shooter, until it has been quiet for EPISODE_END) the bot picks how its weapon
// answers, by persona and situation:
// - "return": short bursts at the estimated origin while the shooter keeps firing (at most RETURN_CAP seconds of
//   trigger time per episode), only with a loaded gun that reaches that far and nothing blocking the first few units;
// - "hold": the crosshair holds the origin's angle without firing (so a shooter stepping into view meets a pre-aimed
//   crosshair: brain/combat.ts PRE_AIM), from cover a few steps away when the bot was busy in the open;
// - "evade": the crosshair only glances at it and MOVE's evasive reactions (brain/evade.ts: run, cover, push) decide.
// `unseenReaction` exposes the episode's choice (MOVE reads it to match its movement to it); `applyUnseenReaction` puts
// the weapon side on top of the chosen intent (brain/alert.ts reactToThreats). Persona draws come from the persona rng;
// a neutral bot decides from the situation alone (no draw). Every decision goes to the combat trace.
import { type Vec2, v2 } from "@rebirth/core";
import { currentGun, type HeldGun } from "../knowledge/arsenal.ts";
import { gaussian } from "../motor/noise.ts";
import { isNeutral, type PersonaName } from "../persona.ts";
import { findCover } from "./combat.ts";
import type { UnseenChoice, UnseenReaction } from "./combatMemory.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";

/** An unseen shooter's bullet this fresh starts or feeds an episode; an episode ends after EPISODE_END of quiet. */
const FIRE_FRESH = 1;
const EPISODE_END = 3;
/** The threat board's unseen shooters count this long after their last bullet, out to MAX_DIST. */
const SHOOTER_MEMORY = 1.5;
const MAX_DIST = 80;
/** Return fire: at most this much trigger time per episode, and only while the shooter fired within RETURN_QUIET. */
const RETURN_CAP = 2.5;
const RETURN_QUIET = 1.2;
const BURST: [number, number] = [0.3, 0.55];
const PAUSE: [number, number] = [0.35, 0.7];
/**
 * Each return-fire burst is off the origin estimate by a normal angle about the bot, this sd (radians) at skill 0 and
 * 1 (on top of the estimate's own bearing error): an unseen shooter is suppressed, not picked off (adversarial review:
 * an expert hit an off-screen Mosin shooter 8 times at 36 u).
 */
const SCATTER_LO = (9 * Math.PI) / 180;
const SCATTER_HI = (4 * Math.PI) / 180;
/** The first units towards the origin must be clear (no shooting the wall next to the bot). */
const NEAR_CLEAR = 6;
/** Hold: from cover this close, for at most HOLD_CAP after the episode began. */
const HOLD_COVER = 6;
const HOLD_CAP = 5;
/** Under this health the bot leans to evading. */
const HURT = 40;
/** Behaviours that leave the bot in the open doing something else: holding the angle moves it to cover. */
const BUSY_IN_OPEN: ReadonlySet<BehaviourName> = new Set<BehaviourName>([
    "loot",
    "break",
    "explore",
    "heal",
    "hold",
    "sweep",
]);

/** Persona weights of [return, hold, evade] (design choices: rushers shoot back, rats and campers do not). */
const WEIGHTS: Readonly<Record<Exclude<PersonaName, "neutral">, readonly [number, number, number]>> = {
    rusher: [0.6, 0.1, 0.3],
    rifleman: [0.45, 0.35, 0.2],
    marksman: [0.3, 0.5, 0.2],
    camper: [0.2, 0.6, 0.2],
    looter: [0.3, 0.3, 0.4],
    rat: [0.1, 0.3, 0.6],
};

/** The freshest fire from a shooter the bot does not see: its fuzzy origin, the shooter and its last bullet. */
export interface UnseenFire {
    origin: Vec2;
    shooterId: number;
    lastShot: number;
}

/** The freshest fire from a shooter the bot does not see (a near miss first, else the threat board), or null. */
export function freshUnseen(ctx: BrainCtx): UnseenFire | null {
    const { model, now } = ctx;
    const uf = model.underFire;
    if (uf && now - uf.time < FIRE_FRESH && !model.contacts.get(uf.shooterId)?.visible)
        return { origin: uf.from, shooterId: uf.shooterId, lastShot: uf.time };
    let best: UnseenFire | null = null;
    for (const s of model.threats.unseenShooters()) {
        if (now - s.lastShot > SHOOTER_MEMORY || v2.distance(s.pos, ctx.self.pos) > MAX_DIST) continue;
        if (model.contacts.get(s.id)?.visible) continue;
        if (!best || s.lastShot > best.lastShot) best = { origin: s.pos, shooterId: s.id, lastShot: s.lastShot };
    }
    return best;
}

/** The loaded gun the bot would answer with: the one in hand, else the first loaded one; null when none. */
function answeringGun(ctx: BrainCtx): HeldGun | null {
    const cur = currentGun(ctx.self, ctx.guns);
    if (cur && cur.mag > 0) return cur;
    return ctx.guns.find((g) => g.mag > 0) ?? null;
}

/**
 * The current unseen-fire episode and its choice (decided once, when its first bullet is noticed), or null when no
 * unseen shooter fired lately. Idempotent within a think; MOVE may call it as well.
 */
export function unseenReaction(ctx: BrainCtx): Readonly<UnseenReaction> | null {
    const f = ctx.mem.fight;
    const now = ctx.now;
    const fire = freshUnseen(ctx);
    const cur = f.unseen;
    if (cur && now - cur.lastShot > EPISODE_END) f.unseen = null;
    if (!fire) return f.unseen;
    if (f.unseen && f.unseen.shooterId === fire.shooterId) {
        f.unseen.origin = v2.copy(fire.origin);
        f.unseen.lastShot = Math.max(f.unseen.lastShot, fire.lastShot);
        return f.unseen;
    }
    const dist = v2.distance(ctx.self.pos, fire.origin);
    const [choice, why] = decide(ctx, fire.origin, dist);
    f.unseen = {
        choice,
        shooterId: fire.shooterId,
        origin: v2.copy(fire.origin),
        since: now,
        lastShot: fire.lastShot,
        dist,
        why,
    };
    f.unseenFired = 0;
    f.unseenBurstUntil = Number.NEGATIVE_INFINITY;
    f.unseenPauseUntil = Number.NEGATIVE_INFINITY;
    f.trace.add(now, "unseen", `${choice} ${why} shooter ${fire.shooterId} d ${dist.toFixed(0)}`);
    return f.unseen;
}

/** The episode's choice: persona weights masked by the situation, or the neutral rule. */
function decide(ctx: BrainCtx, origin: Vec2, dist: number): [UnseenChoice, string] {
    const gun = answeringGun(ctx);
    const canReturn = !!gun && gun.info.range >= dist * 0.9;
    const hurt = ctx.self.health < HURT;
    const cover = findCover(ctx.model, origin, HOLD_COVER) !== null;
    if (isNeutral(ctx.persona)) {
        if (canReturn && !hurt) return ["return", "situation"];
        return cover ? ["hold", "situation"] : ["evade", "situation"];
    }
    const base = WEIGHTS[ctx.persona.name as Exclude<PersonaName, "neutral">] ?? WEIGHTS.rifleman;
    let [ret, hold, evade] = base;
    if (!canReturn) ret = 0;
    if (hurt) {
        ret *= 0.5;
        evade *= 2;
    }
    if (!cover) hold *= 0.5;
    const total = ret + hold + evade;
    const r = ctx.personaRng.next() * total;
    if (r < ret) return ["return", "persona"];
    return r < ret + hold ? ["hold", "persona"] : ["evade", "persona"];
}

/**
 * The weapon side of the episode on top of the chosen intent (brain/alert.ts): return fire in bursts at the origin, or
 * hold its angle (moving to cover first when the bot was busy in the open). Leaves an intent that already shoots or
 * aims at a visible target alone. Returns whether it changed the intent.
 */
export function applyUnseenReaction(ctx: BrainCtx, intent: Intent): boolean {
    const r = unseenReaction(ctx);
    // busy with a visible target, or already shooting at something that matters more than a crate
    if (!r || (intent.targetId && (intent.fire || intent.aim))) return false;
    if (intent.fire && !BUSY_IN_OPEN.has(intent.behaviour)) return false;
    const { now, self, model } = ctx;
    const f = ctx.mem.fight;
    const dt = Math.min(0.2, Math.max(0, now - f.unseenLastThink));
    f.unseenLastThink = now;
    if (r.choice === "return") {
        const gun = answeringGun(ctx);
        const d = v2.distance(self.pos, r.origin);
        intent.aim = v2.copy(r.origin);
        intent.targetId = 0;
        if (!gun || d > gun.info.range) return true;
        intent.slot = gun.slot;
        // each burst sprays around the estimate (a guess, not a target: suppression, not marksmanship)
        intent.aim = v2.add(self.pos, v2.rotate(v2.sub(r.origin, self.pos), f.unseenScatter));
        const dir = v2.normalizeSafe(v2.sub(r.origin, self.pos));
        const clear = model.lineOfFire(self.pos, v2.add(self.pos, v2.mul(dir, Math.min(NEAR_CLEAR, d))));
        const live = now - r.lastShot < RETURN_QUIET && f.unseenFired < RETURN_CAP;
        if (!clear || !live || self.action.type === "use" || self.action.type === "revive") return true;
        if (now >= f.unseenPauseUntil) {
            f.unseenBurstUntil = now + ctx.rng.range(BURST[0], BURST[1]);
            f.unseenPauseUntil = f.unseenBurstUntil + ctx.rng.range(PAUSE[0], PAUSE[1]);
            const sd = SCATTER_LO + (SCATTER_HI - SCATTER_LO) * ctx.skill.s;
            f.unseenScatter = gaussian(ctx.rng) * sd;
            intent.aim = v2.add(self.pos, v2.rotate(v2.sub(r.origin, self.pos), f.unseenScatter));
        }
        intent.fire = now < f.unseenBurstUntil && gun.slot === self.curWeapIdx;
        if (intent.fire) f.unseenFired += dt;
        return true;
    }
    if (r.choice === "hold" && now - r.since < HOLD_CAP) {
        intent.aim = v2.copy(r.origin);
        intent.targetId = 0;
        const using = self.action.type === "use" || self.action.type === "revive";
        if (BUSY_IN_OPEN.has(intent.behaviour) && !using) {
            const cover = findCover(model, r.origin, HOLD_COVER);
            if (cover) {
                intent.goal = cover;
                intent.arriveDist = 0.6;
                intent.moveDir = null;
                intent.stop = v2.distance(cover, self.pos) < 0.6;
            }
        }
        return true;
    }
    return false;
}
