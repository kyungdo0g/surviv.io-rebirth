// Weapon handling layered on every decision (Brain.think, after the behaviour planned its Intent): the slot to hold
// outside of what the behaviour asked for (shoot back while moving, carry the gun it wants most, put the throwable or an
// empty gun away) and reloads (the smart reload, or the baseline top-up while nobody is in sight). Split out of
// brain.ts in the bot overhaul's stage 0; LOOT owns it.
//
// Bot overhaul LOOT-11 (deadlocks, both brains): a bot never pulls the trigger on an empty magazine, so the sim's
// click-to-reload never ran: an empty gun with rounds in the bag is reloaded now, enemies in view or not; and the gun
// in the other slot is reloaded too once things are quiet (swapped in, reloaded, kept), since the old code only topped
// up the gun in hand and an emptied shotgun stayed empty for minutes while the bot fought with its pistol.
// LOOT-12 (BrainFeatures.holster, user report 17): travelling with nobody around, the bot holsters (fists or melee
// run faster: GameObjectDefs fists speed.equip +1) and draws its fight gun the moment a threat shows (fightSlot picks
// it, counting the draw delay).
import { Input, WeaponSlot } from "@rebirth/defs";
import { carrySlot, currentGun, type HeldGun } from "../knowledge/arsenal.ts";
import { gunDesire } from "../knowledge/desire.ts";
import { reloadSeconds } from "../knowledge/duel.ts";
import { addCombatLayer } from "./combat.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { tasteOf } from "./explore.ts";
import { manageReload, smartReloadOn } from "./reload.ts";

/** A reload swap keeps the other gun in hand this long (the carry slot does not switch back mid-reload). */
const SWAP_HOLD = 2.5;
/** An empty magazine is reloaded at most this often (the reload itself takes over once it started). */
const EMPTY_RELOAD_EVERY = 1;
/** Quiet this long (no threat) before the off-hand gun is reloaded or the bot holsters. */
const QUIET_RELOAD = 1.5;
/** Holster after this many quiet seconds for NEUTRAL (shorter for bold personas, longer for cautious ones). */
const QUIET_HOLSTER = 4;
/** Quiet, the carried gun goes back in hand when the bot wants it this much more (desire) than the one it holds. */
const CARRY_GAIN = 15;
/** Unseen gunfire this close counts as a threat (smart threat board). */
const HEARD = 45;
/** Behaviours that travel: holstered with nobody around. */
const TRAVEL = new Set<BehaviourName>(["explore", "zone", "loot", "sweep", "regroup", "airdrop"]);

/** Keeps LootMemory.lastThreat: a standing enemy in view, a bullet passing close, damage, gunfire heard nearby. */
function noteThreats(ctx: BrainCtx): void {
    const { model, now, self } = ctx;
    const lm = ctx.mem.loot2;
    let t = Math.max(model.lastHurt, model.underFire?.time ?? Number.NEGATIVE_INFINITY);
    if (ctx.visibleEnemies.some((e) => !e.downed)) t = now;
    if (ctx.features.threats) {
        for (const s of model.threats.unseenShooters()) {
            const dx = s.pos.x - self.pos.x;
            const dy = s.pos.y - self.pos.y;
            if (dx * dx + dy * dy < HEARD * HEARD) t = Math.max(t, s.lastShot);
        }
    }
    if (t > lm.lastThreat) lm.lastThreat = t;
}

/** The other gun when it needs a reload the bot can do now (rounds in the bag, the magazine under half). */
function offHandToReload(ctx: BrainCtx, cur: HeldGun | undefined): HeldGun | undefined {
    return ctx.guns.find(
        (g) => g !== cur && g.slot !== ctx.self.curWeapIdx && g.reserve > 0 && g.mag < g.info.def.maxClip * 0.5,
    );
}

/**
 * Whether the bot holsters for this intent (BrainFeatures.holster): a travelling behaviour, nobody around for a while,
 * nothing to reload. It starts only while walking; once holstered it stays so for a stop on the way (picking an item
 * up), instead of drawing and holstering at every item.
 */
function holsterNow(ctx: BrainCtx, intent: Intent, quietFor: number): boolean {
    const { self } = ctx;
    if (!ctx.features.holster || !ctx.armed || !TRAVEL.has(intent.behaviour)) return false;
    if (intent.fire || intent.aim !== null) return false;
    const moving = !intent.stop && (!!intent.goal || !!intent.moveDir);
    if (!moving && !(ctx.mem.loot2.holstered && self.curWeapIdx === WeaponSlot.Melee)) return false;
    // bold personas holster sooner (NEUTRAL: 4 s after the last threat)
    if (quietFor < QUIET_HOLSTER * (1.5 - ctx.persona.riskTolerance)) return false;
    if (self.action.type !== "none") return false;
    // a magazine to top up first (the reload needs the gun in hand)
    const gun = currentGun(self, ctx.guns);
    if (gun && gun.reserve > 0 && gun.mag < gun.info.def.maxClip * 0.7) return false;
    return true;
}

/** Slot to hold and reloads outside of what the behaviour asked for. */
export function manageWeapons(ctx: BrainCtx, intent: Intent): void {
    const { self, mem, now } = ctx;
    const lm = mem.loot2;
    noteThreats(ctx);
    const busy = self.action.type === "use" || self.action.type === "revive";
    if (busy) {
        // switching weapons cancels an item use or a revive
        intent.slot = null;
        intent.fire = false;
        return;
    }
    const quietFor = now - lm.lastThreat;
    const swapping =
        lm.reloadSlot >= 0 &&
        self.curWeapIdx === lm.reloadSlot &&
        (now < lm.reloadUntil || self.action.type === "reload");
    if (lm.reloadSlot >= 0 && !swapping && now >= lm.reloadUntil) lm.reloadSlot = -1;
    if (intent.slot === null) {
        if (ctx.target?.visible && ctx.armed && intent.behaviour !== "heal") addCombatLayer(ctx, intent);
        if (intent.slot === null) {
            const cur = currentGun(self, ctx.guns);
            const carry = carrySlot(self, ctx.guns, tasteOf(ctx));
            const holdingThrowable = self.curWeapIdx === WeaponSlot.Throwable;
            let holdingUseless = self.curWeapIdx !== carry && !cur?.mag;
            // smart reload: the gun swapped in for a top-up stays in hand while it reloads
            if (holdingUseless && smartReloadOn(ctx) && now - mem.smart.lastSwap < SWAP_HOLD) holdingUseless = false;
            // the off-hand gun swapped in to reload it stays in hand until it is done
            if (swapping) holdingUseless = false;
            const other =
                quietFor >= QUIET_RELOAD && intent.behaviour !== "heal" ? offHandToReload(ctx, cur) : undefined;
            if (holsterNow(ctx, intent, quietFor) && !swapping && !other) {
                lm.holstered = true;
                intent.slot = WeaponSlot.Melee;
            } else if (other && !swapping && self.action.type === "none") {
                // quiet: reload the other gun too (swapping to an empty gun schedules its reload; a partly empty one
                // is topped up below)
                lm.reloadSlot = other.slot;
                lm.reloadUntil =
                    now + other.info.def.switchDelay + reloadSeconds(other.info, other.info.def.maxClip) + 0.5;
                lm.holstered = false;
                intent.slot = other.slot;
            } else if (holdingThrowable || holdingUseless || self.curWeapIdx === WeaponSlot.Melee) {
                lm.holstered = false;
                intent.slot = carry;
            } else if (cur && !swapping && quietFor >= QUIET_RELOAD && self.action.type === "none") {
                // quiet again after a fight (or a reload swap): back to the gun it wants most, not the pistol the
                // fight ended with (pistol-keeping RC3: it went back only when the gun in hand was empty)
                const want = ctx.guns.find((g) => g.slot === carry);
                const taste = tasteOf(ctx);
                if (want && gunDesire(want.info.id, taste) >= gunDesire(cur.info.id, taste) + CARRY_GAIN)
                    intent.slot = carry;
            }
        }
    } else {
        lm.holstered = false;
    }
    if (smartReloadOn(ctx)) {
        // (its swap to the other loaded gun first: a reload pressed in the same think would only be cancelled)
        manageReload(ctx, intent);
        emptyReload(ctx, intent);
        return;
    }
    emptyReload(ctx, intent);
    // top up the magazine when nobody is in sight
    const gun = currentGun(self, ctx.guns);
    const quiet = !ctx.visibleEnemies.some((e) => !e.downed);
    if (
        gun &&
        quiet &&
        gun.reserve > 0 &&
        gun.mag < gun.info.def.maxClip * 0.7 &&
        self.action.type === "none" &&
        now - mem.lastReloadRequest > 1.5 &&
        intent.behaviour !== "heal" &&
        (intent.slot === null || intent.slot === self.curWeapIdx)
    ) {
        mem.lastReloadRequest = now;
        intent.actions.push(Input.Reload);
    }
}

/**
 * An empty magazine with rounds in the bag is reloaded whatever is in view (the bot never clicks on an empty gun, so
 * the auto-reload never ran: smart bots with an enemy within 12 units and baseline bots with anyone in sight stood
 * there with an empty gun). Not while it is about to switch away (a swap cancels the reload).
 */
function emptyReload(ctx: BrainCtx, intent: Intent): void {
    const { self, mem, now } = ctx;
    const gun = currentGun(self, ctx.guns);
    if (!gun || gun.mag > 0 || gun.reserve <= 0 || self.action.type !== "none" || intent.behaviour === "heal") return;
    if (intent.slot !== null && intent.slot !== self.curWeapIdx) return;
    if (now - mem.lastReloadRequest <= EMPTY_RELOAD_EVERY) return;
    mem.lastReloadRequest = now;
    intent.actions.push(Input.Reload);
}
