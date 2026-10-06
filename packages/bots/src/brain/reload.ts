// Smart reloading (BrainFeatures.smartReload, and only for difficulties with DifficultyParams.smartReload): replaces
// the baseline "top up when nobody is in sight". Never reload while a visible enemy has a line of fire on the bot and
// the magazine still has rounds; an empty magazine under fire, or an enemy peeking mid-reload, swaps to the other
// loaded gun when it suits the range (brain/tactics.ts walks to cover within 4 units for the reload itself); with
// nobody in sight right after a kill the magazine is topped up fully before looting; an enemy that broke line of sight
// beyond 25 units, or one busy reloading or healing, is the moment to reload.
import { v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { currentGun, type HeldGun } from "../knowledge/arsenal.ts";
import { suitability } from "../knowledge/weapons.ts";
import type { Contact } from "../perception/world.ts";
import { enemyGun } from "./assess.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { isBusy } from "./opportunity.ts";

/** Enemies farther than this that broke line of sight leave time for a reload. */
const SAFE_DIST = 25;
/** Seconds without a standing enemy in sight before a full top-up after a kill. */
const QUIET_TIME = 0.8;
/** A kill this recent allows a full top-up (before looting the body). */
const KILL_TOP_UP = 8;
/** ...unless the magazine is nearly full anyway (a reload is seconds without a shot ready for the next one). */
const KILL_TOP_FILL = 0.85;

export function smartReloadOn(ctx: BrainCtx): boolean {
    return ctx.features.smartReload && ctx.params.smartReload;
}

/** Whether `e` can shoot the bot right now: in line of fire and within the reach of its gun. */
function canHit(ctx: BrainCtx, e: Contact): boolean {
    const me = ctx.self.pos;
    const d = v2.distance(e.pos, me);
    const g = enemyGun(ctx, e);
    const reach = g ? Math.min(g.range, g.maxEngage * 1.6) : 4;
    return d <= reach && ctx.model.lineOfFire(me, e.pos);
}

/** The other gun, loaded and fit for a fight at `dist` (a shotgun is no answer at 30 units). */
function otherLoaded(ctx: BrainCtx, gun: HeldGun, dist: number): HeldGun | undefined {
    return ctx.guns.find((g) => g.slot !== gun.slot && g.mag > 0 && suitability(g.info, dist) >= 0.5);
}

/** Reloads and reload swaps for this think (called by Brain.manageWeapons instead of the baseline top-up). */
export function manageReload(ctx: BrainCtx, intent: Intent): void {
    const { self, mem, now } = ctx;
    const sm = mem.smart;
    const standing = ctx.visibleEnemies.filter((e) => !e.downed);
    if (standing.length) sm.lastEnemySeen = now;
    if (self.kills > sm.kills) {
        sm.kills = self.kills;
        sm.lastKill = now;
    }
    const gun = currentGun(self, ctx.guns);
    if (!gun || intent.behaviour === "heal") return;
    const reloading = self.action.type === "reload";
    const exposedTo = standing.filter((e) => canHit(ctx, e));
    // empty, or caught mid-reload, with an enemy on the bot: a loaded gun that suits the range is faster than the reload
    if ((reloading || gun.mag <= 0) && exposedTo.length && now - sm.lastSwap > 0.8) {
        const d = Math.min(...exposedTo.map((e) => v2.distance(e.pos, self.pos)));
        const other = otherLoaded(ctx, gun, d);
        if (other) {
            sm.lastSwap = now;
            intent.slot = other.slot;
            return;
        }
    }
    const maxClip = gun.info.def.maxClip;
    if (reloading || self.action.type !== "none" || now - mem.lastReloadRequest <= 1) return;
    if (gun.reserve <= 0 || gun.mag >= maxClip) return;
    // never with an enemy in line of fire while rounds remain
    if (exposedTo.length && gun.mag > 0) return;
    let want: boolean;
    if (standing.length === 0) {
        // nobody in sight: the usual top-up, and a full one right after a kill once things calmed down
        const quiet = now - sm.lastEnemySeen > QUIET_TIME;
        want =
            gun.mag < maxClip * 0.7 || (quiet && now - sm.lastKill < KILL_TOP_UP && gun.mag < maxClip * KILL_TOP_FILL);
    } else {
        // enemies in sight, none able to shoot the bot now: far away, busy, or the magazine nearly dry
        const nearest = Math.min(...standing.map((e) => v2.distance(e.pos, self.pos)));
        const allBusy = standing.every((e) => isBusy(ctx, e));
        want =
            (nearest > SAFE_DIST && gun.mag < maxClip * 0.5) ||
            (allBusy && gun.mag < maxClip * 0.6) ||
            (nearest > 12 && gun.mag <= maxClip * 0.25);
    }
    if (want) {
        mem.lastReloadRequest = now;
        intent.actions.push(Input.Reload);
    }
}
