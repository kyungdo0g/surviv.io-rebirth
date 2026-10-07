// Frags thrown back on the run (round 4, user report 29: "a bot carrying several grenades that runs from a chaser
// throws them fast and uncooked behind it, onto the chaser's path or just ahead of it, to cover the escape; more
// grenades -> freer use"). Smart brain (BrainFeatures.grenades), while the bot runs away (the "flee" behaviour) or
// breaks off a fight (the "disengage" behaviour) and is not holding a spot (nor shooting back with its last frag):
// - the chaser: a standing enemy on the screen coming at the bot (closing at max(0.5, 3.5 - frags) u/s or more), or
//   with two frags or more one shooting at it, from the frag's no-throw distance plus 1 (9 for the frag) out to
//   REACH_BASE + REACH_PER per frag carried (at most the longest throw); never with any standing enemy inside the
//   no-throw distance;
// - the point: where the chaser will be in about LEAD_TIME (its velocity, capped), a step in front of it on its way
//   to the bot, never closer to the bot than the frag's minimum distance; the path is checked like any other throw
//   (fragSkill.ts clearLanding) and the hand's error applies (grenades.ts fragPlan);
// - the throw: never cooked (cook 0: the pin is pulled and it goes; the simulation holds it for its 0.1 s minimum),
//   and the bot keeps running through it (ThrowPlan.run), allowing for its own motion as its hand skill lets it
//   (frag.motionComp: a beginner's frag lands short);
// - how readily: grenadeRate x ESCAPE_APPETITE x frag.craft x the persona's caution (fragSkill.ts cautionTaste) x a
//   factor of the frags carried (COUNT_FACTOR: one frag is mostly kept for later), and the gap between two such throws
//   shrinks with the frags carried (GAP_BASE - GAP_PER per frag, at least GAP_MIN); the engagement's recall roll holds.
import { type Vec2, v2 } from "@rebirth/core";
import type { Contact } from "../perception/world.ts";
import { engagingMe } from "./assess.ts";
import { FRAG_TYPES } from "./combat.ts";
import type { BrainCtx, Intent, ThrowPlan } from "./context.ts";
import { fragMaxDist, fragMinDist, fragNoThrowNear } from "./fragMath.ts";
import { cautionTaste, checksPath, clearLanding, recallsFrags } from "./fragSkill.ts";
import { enemyClose, fragPlan } from "./grenades.ts";
import { closingSpeed } from "./pursuit.ts";

/** Frags per second at a chaser for a bot with grenadeRate 1 and full craft (hard: 0.4 x 6 = 2.4/s with 3 frags). */
const ESCAPE_APPETITE = 6;
/** Appetite by the frags carried: 1, 2, 3, 4 or more. */
const COUNT_FACTOR = [0, 0.12, 0.6, 1, 1.4];
/** Reach of an escape throw: REACH_BASE + REACH_PER per frag carried, at most the longest throw. */
const REACH_BASE = 16;
const REACH_PER = 3;
/** Seconds between two escape throws: GAP_BASE - GAP_PER per frag carried, at least GAP_MIN; any frag 1.2 s. */
const GAP_BASE = 4.5;
const GAP_PER = 0.8;
const GAP_MIN = 1.2;
/** The landing point leads the chaser by its velocity over this long (at most LEAD_MAX, 0.6 of the gap)... */
const LEAD_TIME = 1;
const LEAD_MAX = 6;
/** ...plus this step towards the bot (just ahead of it on its way). */
const AHEAD = 1.5;
/** Behaviours that run from a chaser. */
const RUNNING = new Set(["flee", "disengage"]);

/** Frags (and MIRVs) in the bag. */
export function fragCount(ctx: BrainCtx): number {
    let n = 0;
    for (const it of FRAG_TYPES) n += ctx.self.inventory[it] ?? 0;
    return n;
}

/** The nearest standing enemy on the screen that chases the bot, within the reach `n` frags allow, or null. */
export function escapeChaser(ctx: BrainCtx, item: string, n: number): Contact | null {
    const near = fragNoThrowNear(item) + 1;
    const far = Math.min(fragMaxDist(item), REACH_BASE + REACH_PER * n);
    const minClose = Math.max(0.5, 3.5 - n);
    let best: Contact | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const e of ctx.visibleEnemies) {
        if (e.downed) continue;
        const d = v2.distance(e.pos, ctx.self.pos);
        if (d < near || d > far || d >= bestD) continue;
        if (closingSpeed(ctx, e) < minClose && !(n >= 2 && engagingMe(ctx, e))) continue;
        best = e;
        bestD = d;
    }
    return best;
}

/** Where a frag covering the escape from `e` lands: a step in front of where the chaser will be in a moment. */
export function escapePoint(ctx: BrainCtx, e: Contact, item: string): Vec2 | null {
    const me = ctx.self.pos;
    const d = v2.distance(me, e.pos);
    let lead = v2.mul(e.vel, LEAD_TIME);
    const cap = Math.min(LEAD_MAX, 0.6 * d);
    if (v2.length(lead) > cap) lead = v2.mul(v2.normalize(lead), cap);
    const toMe = v2.normalizeSafe(v2.sub(me, e.pos));
    let p = v2.add(v2.add(e.pos, lead), v2.mul(toMe, AHEAD));
    const rel = v2.sub(p, me);
    const min = fragMinDist(item);
    if (v2.length(rel) < min) p = v2.add(me, v2.mul(v2.normalizeSafe(rel, v2.mul(toMe, -1)), min));
    return v2.distance(p, me) <= fragMaxDist(item) ? p : null;
}

/** A frag thrown back at the chaser's path while running (see the header), or null. */
export function escapeFrag(ctx: BrainCtx, intent: Intent, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng } = ctx;
    if (!RUNNING.has(intent.behaviour) || intent.stop || self.action.type !== "none") return null;
    const item = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    if (!item) return null;
    const n = fragCount(ctx);
    // shooting back while it runs: only a bot with frags to spare breaks off to throw one
    if (intent.fire && n < 2) return null;
    const f = mem.fight;
    if (now - mem.lastThrow < GAP_MIN || now - f.escapeAt < Math.max(GAP_MIN, GAP_BASE - GAP_PER * n)) return null;
    if (enemyClose(ctx, item)) return null;
    const chaser = escapeChaser(ctx, item, n);
    if (!chaser || !recallsFrags(ctx, chaser.id)) return null;
    const count = COUNT_FACTOR[Math.min(n, COUNT_FACTOR.length - 1)];
    const rate = params.grenadeRate * ESCAPE_APPETITE * params.frag.craft * cautionTaste(ctx.persona) * count;
    if (!rng.bool(1 - Math.exp(-rate * thinkDt))) return null;
    const aim = escapePoint(ctx, chaser, item);
    const checked = checksPath(ctx);
    const pos = aim ? clearLanding(ctx, item, aim, aim, checked) : null;
    if (!pos) return null;
    const plan = fragPlan(ctx, item, pos, "escape", checked);
    plan.run = true;
    plan.comp = params.frag.motionComp;
    f.escapeAt = now;
    f.escapes++;
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(plan.pos);
    return plan;
}
