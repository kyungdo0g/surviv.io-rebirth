// Running under fire in irregular legs (BrainFeatures.pursuit; user report 20 "flee opposite with direction changes",
// adversarial review: flee and disengage ran dead-straight to one far goal, 29-90 straight 2 s windows per match while
// being shot at, free kills for a sniper). The legs are evade.ts's: 0.3-0.9 s each, 20-55 degrees off the way out, the
// side usually but not always flipping, so there is no sine wave a shooter can lead. Only on open ground: a leg whose
// first units are walled falls back to the path (the caller's goal).
import { type Vec2, v2 } from "@rebirth/core";
import { freeDir } from "./combat.ts";
import type { BrainCtx, Intent } from "./context.ts";

const LEG_MIN = 0.3;
const LEG_MAX = 0.9;
const LEG_DEG_MIN = 20;
const LEG_DEG_MAX = 55;
const LEG_FLIP = 0.75;
/** Under fire, goals closer than this are walked to straight (a zigzag would overshoot a cover spot). */
const ZIG_NEAR = 6;
/** Under fire: hit this recently, or a bullet passed close this recently (s). */
const HIT_RECENT = 1.5;
const FIRE_RECENT = 1;

/** The legs' state (kept by the caller's memory). */
export interface ZigzagState {
    legSign: number;
    legAngle: number;
    legUntil: number;
}

export function newZigzag(): ZigzagState {
    return { legSign: 1, legAngle: 0, legUntil: Number.NEGATIVE_INFINITY };
}

/** Whether the bot is being shot at now (hit, or a bullet passing close). */
export function underFireNow(ctx: BrainCtx): boolean {
    const { model, now } = ctx;
    if (now - model.lastHurt < HIT_RECENT) return true;
    return !!model.underFire && now - model.underFire.time < FIRE_RECENT;
}

/**
 * One step along `base` in irregular legs (see the header): the direction to walk, or null when the leg is walled
 * (the caller keeps its path goal). Draws from the brain's rng only when a leg ends.
 */
export function zigzagStep(ctx: BrainCtx, z: ZigzagState, base: Vec2): Vec2 | null {
    const { now, rng } = ctx;
    if (now >= z.legUntil) {
        z.legSign = rng.next() < LEG_FLIP ? -z.legSign : z.legSign;
        z.legAngle = (rng.range(LEG_DEG_MIN, LEG_DEG_MAX) * Math.PI) / 180;
        z.legUntil = now + rng.range(LEG_MIN, LEG_MAX);
    }
    const dir = v2.rotate(base, z.legSign * z.legAngle);
    const free = freeDir(ctx.model, ctx.self.pos, dir);
    // a leg turned far off (freeDir's rotated variants) is no way out: keep to the path then
    if (!free || v2.dot(free, base) < 0.2) {
        z.legSign = -z.legSign;
        z.legUntil = now + LEG_MIN;
        return null;
    }
    return free;
}

/** Running to `goal` under fire: a zigzag leg towards it while it is farther than ZIG_NEAR (else the path). */
export function zigzagTo(ctx: BrainCtx, intent: Intent, goal: Vec2): void {
    const me = ctx.self.pos;
    if (v2.distance(goal, me) < ZIG_NEAR) return;
    const dir = zigzagStep(ctx, ctx.mem.pursuit.runZig, v2.normalizeSafe(v2.sub(goal, me)));
    if (dir) intent.moveDir = dir;
}
