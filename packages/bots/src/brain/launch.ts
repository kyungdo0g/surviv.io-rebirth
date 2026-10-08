// When a launcher comes out (bot round 6, item 5): the beta launchers' slow, few, explosive rounds (knowledge/
// launchers.ts) are worth a shot at a group (another enemy inside the round's blast around the target), at an enemy
// behind cover (the round bursts on the cover next to it), and at a target of opportunity (standing still, or busy
// healing, reloading or reviving); a lone enemy running in the open gets the other gun. Never at point blank: the
// target must be beyond the launcher's minimum distance (its blast's reach to the bot's body plus slack, and its
// arming distance) with a margin for an enemy closing in, and no other standing enemy may be that close to the bot.
import { v2 } from "@rebirth/core";
import type { HeldGun } from "../knowledge/arsenal.ts";
import { type LauncherSpec, launcherSpec } from "../knowledge/launchers.ts";
import type { Contact } from "../perception/world.ts";
import { bodyShot } from "./combat.ts";
import type { BrainCtx } from "./context.ts";
import { isBusy } from "./opportunity.ts";

/** A target closing in at speed v is kept this many seconds of closing beyond the minimum distance. */
const CLOSING_MARGIN = 0.6;
/** "Standing still": slower than this (u/s). */
const STILL = 2;
/** A group member counts when seen this recently. */
const GROUP_AGE = 1;

/** The bot's launcher with a round in it (and its spec), or null. */
export function loadedLauncher(ctx: BrainCtx): { gun: HeldGun; spec: LauncherSpec } | null {
    for (const g of ctx.guns) {
        if (g.mag <= 0) continue;
        const spec = launcherSpec(g.info.id);
        if (spec) return { gun: g, spec };
    }
    return null;
}

/** Whether a launcher round may go at `t` at `dist` without hurting the bot (minimum distance, closing margin). */
export function launcherSafe(ctx: BrainCtx, spec: LauncherSpec, t: Contact, dist: number): boolean {
    const toMe = v2.normalizeSafe(v2.sub(ctx.self.pos, t.pos));
    const closing = Math.max(0, v2.dot(t.vel, toMe));
    if (dist < spec.minDist + closing * CLOSING_MARGIN || dist > spec.range * 0.9) return false;
    for (const e of ctx.visibleEnemies) {
        if (e !== t && !e.downed && v2.distance(e.pos, ctx.self.pos) < spec.minDist) return false;
    }
    return true;
}

/** Why a launcher fits against `t`: a group around it, cover in front of it, or a still or busy target; else null. */
export function launcherReason(ctx: BrainCtx, spec: LauncherSpec, t: Contact): "group" | "cover" | "still" | null {
    if (!t.visible || t.downed) return null;
    for (const e of ctx.enemies) {
        if (e === t || e.downed || ctx.now - e.lastSeen > GROUP_AGE) continue;
        if (v2.distance(e.pos, t.pos) < spec.blastMax) return "group";
    }
    if (bodyShot(ctx, t) === null) return "cover";
    if (v2.length(t.vel) < STILL || isBusy(ctx, t)) return "still";
    return null;
}

/** The launcher slot to fight `t` at `dist` with, or -1 when another gun (or nothing) should. */
export function launcherSlot(ctx: BrainCtx, t: Contact, dist: number): number {
    const l = loadedLauncher(ctx);
    if (!l || !launcherSafe(ctx, l.spec, t, dist)) return -1;
    return launcherReason(ctx, l.spec, t) ? l.gun.slot : -1;
}

/** Whether the gun in hand is a launcher too close to fire at `dist` (point blank: the shot check holds fire). */
export function launcherTooClose(gun: HeldGun | undefined, dist: number): boolean {
    const spec = gun ? launcherSpec(gun.info.id) : undefined;
    return !!spec && dist < spec.minDist;
}
