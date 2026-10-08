// Knowing that barrels explode (BrainFeatures.blastAware; owner, 2026-10-08). Every player knows a red barrel, a
// propane tank or a power box blows up when it is shot to pieces (knowledge/explosives.ts lists them from the defs).
// The cover searches already price that in (brain/combat.ts findCoverFrom with perception/blasts.ts coverCost); this
// file holds the parts that need the brain:
// - blastHot: a spot in the blast of an explosive that is being shot or badly damaged; stillHit.ts burned() counts it,
//   so every behaviour that holds a cover spot (cover.ts, disengage.ts, evade.ts, position.ts) gives it up then;
// - stepOutOfBlast: standing deep enough in the blast of an explosive that is being shot (its health falling on the
//   screen) to take STEP_HP, the bot steps straight away from it until the blast cannot reach it or a wall stands
//   between, after the dodge reaction a grenade gets (DifficultyParams.dodgeReaction, its middle: no draw); the fight
//   goes on from the move;
// - holdBlastFire: no fire that would soon break an explosive whose blast reaches the bot (a 50 HP propane tank breaks
//   to three rifle rounds, faster than anyone steps away: in the A/B probe a FAMAS bot blew one up between itself and
//   its target); the explosive shot on purpose stands beyond its blast (barrelShot.ts), so it never meets this.
import { type Vec2, v2 } from "@rebirth/core";
import { currentGun } from "../knowledge/arsenal.ts";
import { blastWatchOf } from "../perception/blasts.ts";
import { freeDir } from "./combat.ts";
import { finishSeconds } from "./containers.ts";
import type { BrainCtx, Intent } from "./context.ts";

/** Whether a body at `p` would take a real blast (HOT_HP) from an explosive being shot or badly damaged. */
export function blastHot(ctx: BrainCtx, p: Vec2): boolean {
    const watch = blastWatchOf(ctx.model);
    return !!watch && watch.exposure(ctx.model, p).hot;
}

/** A blast this strong at a spot makes it "behind or next to an explosive" (a barrel's within about 7.7 u). */
const EXPOSED_HP = 50;

/** Whether a body at `p` stands deep in an explosive's blast (a cover spot behind or next to one). */
export function blastExposed(ctx: BrainCtx, p: Vec2): boolean {
    const watch = blastWatchOf(ctx.model);
    return !!watch && watch.exposure(ctx.model, p).worst >= EXPOSED_HP;
}

/** The hand's wobble on top of a gun's spread (degrees) when judging what a shot may strike. */
const WOBBLE_DEG = 3;
/** The bot holds fire when its shots would break an explosive next to it within this long (s). */
const HOLD_BREAK = 2;

/** A blast decision repeated on the same explosive within this long of its last entry adds none to the trace. */
const TRACE_GAP = 1;

/**
 * Notes a blast decision ("out", "hold", "shot" and the explosive's id first) in the fight trace at most once a second
 * per decision and explosive: the trace keeps the last 32 decisions, and a step out noted every think would push the
 * others out.
 */
export function noteBlast(ctx: BrainCtx, detail: string): void {
    const trace = ctx.mem.fight.trace;
    const last = trace.last("blast");
    const key = (d: string) => d.split(" ", 2).join(" ");
    if (last && key(last.detail) === key(detail) && ctx.now - last.t < TRACE_GAP) return;
    trace.add(ctx.now, "blast", detail);
}

/**
 * A bot starts walking out of the blast of an explosive being shot where it would take this much (a barrel's within
 * about 10.6 u; at the rim of a blast a fight is worth more than the few HP), then walks clear of it.
 */
const STEP_HP = 25;
/** The explosive each bot (by its model's blast watch) is walking away from, 0 for none. */
const stepping = new WeakMap<object, number>();

/** Seconds from the first hit on an explosive the bot sees until it reacts (its grenade dodge reaction's middle). */
function reaction(ctx: BrainCtx): number {
    const [lo, hi] = ctx.params.dodgeReaction;
    return (lo + hi) / 2;
}

/**
 * The bot stands deep in the blast of an explosive that is being shot (STEP_HP), or is walking out of one: walk
 * straight away from it until clear (the intent's aim and trigger stay; called by Brain.think before the grenade
 * dodge, which comes first when both apply).
 */
export function stepOutOfBlast(ctx: BrainCtx, intent: Intent): void {
    const { self, model } = ctx;
    if (self.downed || intent.behaviour === "revive") return;
    const watch = blastWatchOf(model);
    if (!watch) return;
    const hit = watch.danger(model, self.pos, reaction(ctx), STEP_HP, stepping.get(watch) ?? 0);
    stepping.set(watch, hit ? hit.x.o.view.id : 0);
    if (!hit) return;
    const away = v2.normalizeSafe(v2.sub(self.pos, hit.x.c), v2.normalizeSafe(v2.neg(self.dir)));
    const dir = freeDir(model, self.pos, away);
    if (!dir) return;
    intent.moveDir = dir;
    intent.goal = null;
    intent.stop = false;
    intent.urgent = true;
    noteBlast(ctx, `out ${hit.x.o.view.id} ${hit.dmg.toFixed(0)}`);
}

/**
 * The trigger stays released while its shots would soon break an explosive whose blast reaches the bot (called by
 * Brain.think after every layer that may fire). The shots fan out by the gun's spread (sim weapons/gun.ts:
 * +-(shotSpread + moveSpread) / 2 degrees) and the hand's wobble, along the aim or along where the gun points now (the
 * hand may still be on its way); the share of them that strikes an explosive is the overlap of its angular width with
 * that fan, and the bot holds when that share would break it within HOLD_BREAK (containers.ts finishSeconds over the
 * share: a barrel at the edge of a spray takes a long while, a propane tank on the line goes in a few rounds). The
 * movement goes on, so the next angle may clear it.
 */
export function holdBlastFire(ctx: BrainCtx, intent: Intent): void {
    if (!intent.fire || !intent.aim || intent.throwPlan) return;
    const gun = currentGun(ctx.self, ctx.guns);
    const watch = gun ? blastWatchOf(ctx.model) : null;
    if (!gun || !watch) return;
    const me = ctx.self.pos;
    const def = gun.info.def;
    const fan = (((def.shotSpread + def.moveSpread) / 2 + WOBBLE_DEG) * Math.PI) / 180;
    const dirs = [v2.normalizeSafe(v2.sub(intent.aim, me), ctx.self.dir), v2.normalizeSafe(ctx.self.dir)];
    for (const { x, off, half } of watch.inShot(ctx.model, me, dirs, fan)) {
        const share = (Math.min(fan, off + half) - Math.max(-fan, off - half)) / (2 * fan);
        if (share <= 0 || finishSeconds(x.o, ctx.self, gun.info) / share > HOLD_BREAK) continue;
        intent.fire = false;
        noteBlast(ctx, `hold ${x.o.view.id}`);
        return;
    }
}
