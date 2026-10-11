// The rebirth's Molotov and flashbang for bots (BrainFeatures.rebirthThrows; owner 2026-10-10, defs rebirth/throwables.ts).
// - Molotov: not cookable, bursts on contact into MOLOTOV_FIRE (radius 5, 7 s): the frag's cook maths does not apply. A bot
//   throws it to flush a camper (a target that keeps still behind cover or out of sight) or to deny the doorway it
//   holds, from MOLOTOV_MIN to MOLOTOV_MAX away, never with a teammate near the landing spot.
// - Flashbang: a 2.5 s fuse, cooked like a frag (fragPlan): thrown before pushing a room, at a target behind cover or
//   inside a building from FLASH_MIN to FLASH_MAX, when the bot is armed and means to close in.
// - Being flashed: only the bot's own state (Snapshot.flash, kept by the threat tracker as blindUntil): a blinded bot
//   stops aiming and firing and backs off from where it last saw enemies (keepClear).
// - Fire: the burning ground shows as a decal (FIRE_DECAL_TYPE): the threat tracker turns the ones in view into danger
//   zones (kind "fire"); goals inside them are avoided (danger.ts avoidPos) and a bot standing in one steps out (dodge.ts).
// - An incoming Molotov bursts where it lands: dodge.ts steps off its flight line; an incoming flashbang is not lethal
//   (it is not in dodge.ts's DANGEROUS list).
import { v2 } from "@rebirth/core";
import { MOLOTOV_FIRE } from "@rebirth/defs";
import { currentGun } from "../knowledge/arsenal.ts";
import type { Contact } from "../perception/world.ts";
import { bodyShot, freeDir } from "./combat.ts";
import type { BrainCtx, Intent, ThrowPlan } from "./context.ts";
import { leftBe } from "./earlyPace.ts";
import { fragPlan } from "./grenades.ts";

const MOLOTOV = "molotov";
const FLASHBANG = "flashbang";
/** Never closer than the fire's edge plus 4.5 u (9 u with the 4.5 u fire it was tuned on): a short throw burns the bot. */
const MOLOTOV_MIN = MOLOTOV_FIRE.rad + 4.5;
const MOLOTOV_MAX = 24;
const FLASH_MIN = 8;
const FLASH_MAX = 20;
/** A camper: moving slower than this, and out of a clear shot (or out of sight) for CAMP_TIME. */
const CAMP_SPEED = 1.5;
const CAMP_TIME = 1.5;
/** Seconds between two rebirth throws of one bot. */
const COOLDOWN = 7;
/** No teammate this close to the landing spot. */
const ALLY_CLEAR = MOLOTOV_FIRE.rad + 2;

function has(ctx: BrainCtx, item: string): boolean {
    return (ctx.self.inventory[item] ?? 0) > 0;
}

function allyNear(ctx: BrainCtx, p: { x: number; y: number }): boolean {
    for (const c of ctx.model.contacts.values())
        if (c.teammate && !c.dead && v2.distance(c.pos, p) < ALLY_CLEAR) return true;
    return false;
}

/** The target out of a clear shot for CAMP_TIME and keeping still (or out of sight): a camper to flush or flash. */
function camping(ctx: BrainCtx, t: Contact): boolean {
    if (v2.length(t.vel) > CAMP_SPEED) return false;
    const f = ctx.mem.fight;
    const coveredFor = f.lastClearAt > 0 ? ctx.now - f.lastClearAt : Number.POSITIVE_INFINITY;
    const clear = t.visible && currentGun(ctx.self, ctx.guns) !== undefined && bodyShot(ctx, t) !== null;
    return !clear && coveredFor >= CAMP_TIME;
}

/** A Molotov or flashbang plan for the fight with ctx.target, or null (see the header). */
export function rebirthThrow(ctx: BrainCtx): ThrowPlan | null {
    const t = ctx.target;
    if (!t || t.downed || ctx.now - ctx.mem.lastThrow < COOLDOWN || ctx.now - t.lastSeen > 2) return null;
    if (ctx.self.action.type !== "none") return null;
    if (ctx.features.earlyPace && leftBe(ctx, t, ctx.targetDist)) return null;
    const d = ctx.targetDist;
    if (has(ctx, MOLOTOV) && d >= MOLOTOV_MIN && d <= MOLOTOV_MAX && camping(ctx, t) && !allyNear(ctx, t.pos)) {
        ctx.mem.fight.trace.add(ctx.now, "frag", `molotov at camper ${t.id} d ${d.toFixed(1)}`);
        return { item: MOLOTOV, pos: v2.copy(t.pos), cook: 0 };
    }
    if (has(ctx, FLASHBANG) && ctx.armed && d >= FLASH_MIN && d <= FLASH_MAX && camping(ctx, t)) {
        return fragPlan(ctx, FLASHBANG, t.pos, "cover");
    }
    return null;
}

/** Whether the bot is blinded by a flashbang now (its own state only: the threat tracker's Snapshot.flash). */
export function blinded(ctx: BrainCtx): boolean {
    const until = ctx.model.threats.blindUntil?.() ?? Number.NEGATIVE_INFINITY;
    return ctx.now < until;
}

/** After the decision: blinded, no aim, no shot, no throw; it backs off from where it last saw enemies. */
export function keepClear(ctx: BrainCtx, intent: Intent): void {
    if (!blinded(ctx) || ctx.self.downed) return;
    intent.fire = false;
    intent.aim = null;
    intent.targetId = 0;
    intent.throwPlan = null;
    const me = ctx.self.pos;
    let away = { x: 0, y: 0 };
    for (const e of ctx.enemies) {
        if (e.downed || e.dead || ctx.now - e.lastSeen > 6) continue;
        const dist = Math.max(1, v2.distance(e.pos, me));
        away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(me, e.pos)), 1 / dist));
    }
    if (v2.lengthSqr(away) < 1e-9) return;
    const dir = freeDir(ctx.model, me, v2.normalize(away));
    if (!dir) return;
    intent.moveDir = dir;
    intent.goal = null;
    intent.stop = false;
    intent.urgent = true;
}
