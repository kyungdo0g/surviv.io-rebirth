// Grenade craft by skill tier and persona (round 4, user report 30: "beginners forget grenades, waste them, throw
// late, short or into walls, misjudge when to fight or run; intermediates use them sometimes and plainly; experts
// throw purposefully (flush cover, deny a push or revive, cover an escape, finish downed players) with good timing
// and placement"). Nothing here branches on a tier: every rule reads the continuous DifficultyParams.frag fields that
// skill.ts composes from the bot's game sense g (recall, coverWait, craft, waste, pathCheck) and hand skill s
// (shortBias, rangeSd, lateralDeg, motionComp), and the persona's existing riskTolerance. Smart brain only
// (BrainFeatures.grenades: grenades.ts, escapeFrag.ts); every draw comes from ctx.rng on those paths, and a field at
// its "perfect" value (recall 1, pathCheck 0 or 1, waste 0, no hand error) draws nothing.
// - recall: one roll per engagement (a target, until it has been out of mind for ENGAGEMENT_GAP s): a bot that does
//   not think of its frags throws none at that target, whatever the opportunity;
// - the hand: a throw lands short by shortBias of its distance on average, rangeSd of it either way and lateralDeg
//   sideways, never inside the frag's own minimum distance (fragMath.ts fragMinDist);
// - the path: with chance pathCheck the bot looks at the throw's path; a frag that would bounce off a wall or a tree
//   (fragMath.ts arcBlocker) goes to a point beside it that still catches the target in the full-damage radius, or
//   not at all; unchecked, it goes into the wall;
// - waste: frag.waste frags per second at an enemy in the open or beyond the longest throw;
// - the persona: a cautious bot (riskTolerance low: rats, campers) covers its escapes and denies pushes more, a bold
//   one (rushers) flushes cover to push in; neutral (risk 0.5) is 1 everywhere.
import { type Vec2, v2 } from "@rebirth/core";
import { gaussian } from "../motor/noise.ts";
import type { SeenObstacle } from "../perception/world.ts";
import type { PersonaParams } from "../persona.ts";
import type { BrainCtx } from "./context.ts";
import { arcBlocker, fragBlast, fragMinDist, throwLine } from "./fragMath.ts";

/** A target out of the bot's mind this long (no frag decision about it) starts a new engagement: a new recall roll. */
const ENGAGEMENT_GAP = 8;
/** Points beside a blocked landing point that are tried (units across the throw line, nearest first). */
const SIDESTEPS = [2, -2, 3.5, -3.5, 5, -5];

/** Whether the bot thinks of its frags against `targetId` in this engagement (frag.recall, one roll each). */
export function recallsFrags(ctx: BrainCtx, targetId: number): boolean {
    const f = ctx.mem.fight;
    const p = ctx.params.frag.recall;
    if (p >= 1) return true;
    if (f.recallTarget !== targetId || ctx.now - f.recallSeen > ENGAGEMENT_GAP) {
        f.recallTarget = targetId;
        f.recalled = ctx.rng.bool(p);
        if (!f.recalled) f.trace.add(ctx.now, "frag", `forgot frags vs ${targetId}`);
    }
    f.recallSeen = ctx.now;
    return f.recalled;
}

/** A cautious persona's appetite for escape and push-denial frags: 1.5 - riskTolerance (neutral 1, rats 1.35). */
export function cautionTaste(p: Readonly<PersonaParams>): number {
    return 1.5 - p.riskTolerance;
}

/** A bold persona's appetite for frags that flush cover: 0.5 + riskTolerance (neutral 1, rushers 1.3). */
export function boldTaste(p: Readonly<PersonaParams>): number {
    return 0.5 + p.riskTolerance;
}

/** Whether the bot throws away a frag this think (frag.waste per second; beginners only). */
export function wastesFrag(ctx: BrainCtx, thinkDt: number): boolean {
    const w = ctx.params.frag.waste;
    return w > 0 && ctx.rng.bool(Math.min(1, w * thinkDt));
}

/**
 * The point the bot's hand actually sends a frag meant for `pos` to (frag.shortBias, rangeSd, lateralDeg around the
 * thrower), never closer than the frag's minimum distance (unless `pos` itself was).
 */
export function handError(ctx: BrainCtx, item: string, pos: Vec2): Vec2 {
    const f = ctx.params.frag;
    if (f.shortBias <= 0 && f.rangeSd <= 0 && f.lateralDeg <= 0) return v2.copy(pos);
    const me = ctx.self.pos;
    const rel = v2.sub(pos, me);
    const d = v2.length(rel);
    if (d < 1e-6) return v2.copy(pos);
    const k = Math.max(0.3, 1 - f.shortBias + gaussian(ctx.rng) * f.rangeSd);
    const turn = (gaussian(ctx.rng) * f.lateralDeg * Math.PI) / 180;
    const dist = Math.max(Math.min(d, fragMinDist(item)), d * k);
    return v2.add(me, v2.mul(v2.rotate(v2.div(rel, d), turn), dist));
}

/** Whether the bot looks at this throw's path (frag.pathCheck; one roll per throw, kept in ThrowPlan.check). */
export function checksPath(ctx: BrainCtx): boolean {
    const p = ctx.params.frag.pathCheck;
    return p >= 1 || (p > 0 && ctx.rng.bool(p));
}

/** What a frag thrown from `from` at `to` would bounce off first, along the line it really flies (throwLine). */
export function throwBlocker(
    item: string,
    from: Vec2,
    to: Vec2,
    obstacles: readonly SeenObstacle[],
    layer: number,
    mode: "land" | "air" = "land",
): SeenObstacle | null {
    const line = throwLine(from, to);
    return arcBlocker(item, line.from, line.to, obstacles, layer, mode);
}

/**
 * Where a frag meant to come to rest at `pos` against an enemy at `target` goes when the bot looks at its path
 * (`checked`, from checksPath): `pos` when nothing tall is in the way, else the nearest point beside it (SIDESTEPS)
 * with a clear path that still has `target` in the blast's full-damage radius, else null (no throw). Unchecked: `pos`.
 */
export function clearLanding(ctx: BrainCtx, item: string, pos: Vec2, target: Vec2, checked: boolean): Vec2 | null {
    if (!checked) return pos;
    const { model, self } = ctx;
    const me = self.pos;
    const blocker = throwBlocker(item, me, pos, model.obstacles, self.layer);
    if (!blocker) return pos;
    const dir = v2.normalizeSafe(v2.sub(pos, me));
    const across = { x: -dir.y, y: dir.x };
    const reach = fragBlast(item).min + 0.5;
    const min = fragMinDist(item);
    for (const off of SIDESTEPS) {
        const p = v2.add(pos, v2.mul(across, off));
        if (v2.distance(p, target) > reach || v2.distance(p, me) < min) continue;
        if (throwBlocker(item, me, p, model.obstacles, self.layer)) continue;
        ctx.mem.fight.trace.add(ctx.now, "frag", `sidestep ${off} past ${blocker.view.type}`);
        return p;
    }
    ctx.mem.fight.trace.add(ctx.now, "frag", `blocked by ${blocker.view.type}`);
    return null;
}

/** Whether an air burst at `target` would fly clear (when `checked`; unchecked: it goes). */
export function clearAirburst(ctx: BrainCtx, item: string, target: Vec2, checked: boolean): boolean {
    if (!checked) return true;
    const { model, self } = ctx;
    return !throwBlocker(item, self.pos, target, model.obstacles, self.layer, "air");
}
