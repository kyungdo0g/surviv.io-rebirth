// The engagement against ctx.target: how much fighting matters now (fightScore) and how to fight (planFight: slot by
// distance, the weapon's preferred range, strafing, cover while reloading, standing still for long shots, going around
// cover or keeping a grenade distance). The smart brain adds, each behind its flag: the fight assessment (push a won
// trade, otherwise take the range where its guns beat the enemy's, back off in a lost one, never start a lost one and
// hold fire on a clearly lost one that is not shooting at the bot),
// opportunism (press a busy or weakened enemy), cover (peek from cover in a lost trade, hold a building, hold a lost
// target's angle, flank around the obstacle between: brain/cover.ts, brain/building.ts) and reloading in cover
// (smartReload).
import { v2 } from "@rebirth/core";
import { fightSlot, hasAmmo } from "../knowledge/arsenal.ts";
import type { GunInfo } from "../knowledge/weapons.ts";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import { ADVANTAGE_BAND, holdFire, pushAdvantageOf, rangePreference } from "./assess.ts";
import { planBuildingHold } from "./building.ts";
import { canShoot, FRAG_TYPES, findCover, freeDir, leadPoint, MELEE_REACH } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal } from "./context.ts";
import { flankSpot, holdLostAngle, planCoverPeek } from "./cover.ts";
import { isBusy, isWeakened } from "./opportunity.ts";
import { smartReloadOn } from "./reload.ts";
import { zonePressure } from "./survival.ts";

/** Cover this close is worth walking to for a reload (smartReload). */
const RELOAD_COVER = 4;
/** Zone pressure (survival.ts) under which an unprovoked won fight is still worth taking. */
const ZONE_CALM = 0.35;

/** Utility of fighting the selected target (0..1). */
export function fightScore(ctx: BrainCtx): number {
    const base = baseFightScore(ctx);
    if (!ctx.features.assess && !ctx.features.opportunism) return base;
    return smartFightScore(ctx, base);
}

function baseFightScore(ctx: BrainCtx): number {
    const t = ctx.target;
    if (!t) return 0;
    const d = ctx.targetDist;
    if (!ctx.armed) {
        // unarmed: punch back when attacked or when the other one is unarmed too and close; else loot or run
        if (!t.visible || d > 6) return 0;
        const attacked = ctx.now - ctx.model.lastHurt < 2;
        if (attacked) return 0.7;
        return isMeleeWeapon(t.activeWeapon) && d < 4 ? ctx.params.meleeAggression : 0;
    }
    if (!t.visible) return 0.5 * Math.max(0, 1 - (ctx.now - t.lastSeen) / (ctx.params.memory + 0.01));
    const shootingAtMe = ctx.now - t.lastShotAt < 2;
    const reach = Math.max(...ctx.guns.filter(hasAmmo).map((g) => g.info.maxEngage), 10);
    if (d > reach * 1.4 && !shootingAtMe) return 0.35;
    if (t.downed && ctx.visibleEnemies.some((e) => !e.downed && e !== t)) return 0.5;
    // in sight behind an obstacle, and the way round it just failed (a wall between, no path): nothing to fight
    // here; another behaviour moves on (the bot comes back as soon as the target shoots or a shot opens)
    if (nearFailedGoal(ctx, t.pos) && ctx.now - ctx.model.lastHurt > 3 && !ctx.model.lineOfFire(ctx.self.pos, t.pos))
        return 0.1;
    // shot at, or too close to ignore: fight; an enemy that has not noticed the bot is a choice (looting may win)
    const threatened = shootingAtMe || ctx.now - ctx.model.lastHurt < 3 || d < 12;
    return threatened ? 0.78 : ctx.params.aggression;
}

/** Whether the target shot at the bot or hurt it lately, or stands too close to ignore. */
export function threatened(ctx: BrainCtx): boolean {
    const t = ctx.target;
    if (!t) return false;
    return ctx.now - t.lastShotAt < 2 || ctx.now - ctx.model.lastHurt < 3 || ctx.targetDist < 12;
}

/** The fight score adjusted by the assessment (assess) and the target's state (opportunism). */
function smartFightScore(ctx: BrainCtx, base: number): number {
    const t = ctx.target;
    if (!t || !ctx.armed || base <= 0) return base;
    let s = base;
    const a = ctx.features.assess ? ctx.assessment : null;
    if (a && !t.downed) {
        const adv = a.advantage;
        const push = a.openAdvantage;
        if (t.visible) {
            const threat = threatened(ctx);
            if (push > ADVANTAGE_BAND && (threat || zonePressure(ctx.model) < ZONE_CALM)) {
                // a trade the bot wins: take it, even against an enemy that has not noticed it (unless the zone presses)
                s = Math.max(s, threat ? 0.84 : Math.min(0.8, ctx.params.aggression + 0.12 + 0.08 * Math.min(push, 2)));
            } else if (adv < -ADVANTAGE_BAND && !threat) {
                // a trade it loses: do not start it
                s = Math.min(s, 0.25);
            }
        } else if (adv < -ADVANTAGE_BAND) {
            s *= 0.5;
        } else if (push > ADVANTAGE_BAND) {
            s = Math.min(0.7, s * 1.25);
        }
    }
    if (ctx.features.opportunism && t.visible && !t.downed && ctx.targetDist < 60) {
        if (isBusy(ctx, t)) s = Math.max(s, 0.8);
        else if (isWeakened(ctx, t)) s = Math.max(s, 0.74);
    }
    return s;
}

/** Pressing a target: into the near half of the gun's preferred band. */
function pressRadial(d: number, info: GunInfo): number {
    const mid = (info.idealMin + info.idealMax) / 2;
    if (d > mid) return 1;
    return d < info.idealMin ? -1 : 0;
}

/**
 * Radial move (+1 closer, -1 away, 0 hold) by the assessment: push a won trade; otherwise towards the range where the
 * bot's guns beat the enemy's, and keep the range in a lost one.
 */
function assessedRadial(ctx: BrainCtx, d: number, info: GunInfo, radial: number): number {
    const adv = ctx.assessment?.advantage ?? 0;
    const t = ctx.target;
    const pressing = pushAdvantageOf(ctx) > ADVANTAGE_BAND || (ctx.features.opportunism && !!t && isBusy(ctx, t));
    if (pressing) return pressRadial(d, info);
    // range control: towards the distance where its guns beat the enemy's (a rifle keeps a shotgun at bay)
    const pref = t ? rangePreference(ctx, t) : 0;
    if (pref !== 0) return pref;
    if (adv < -ADVANTAGE_BAND) return d < info.idealMax ? -1 : 0;
    return radial;
}

/** The engagement against ctx.target. */
export function planFight(ctx: BrainCtx): Intent {
    const intent = emptyIntent("fight");
    const t = ctx.target;
    if (!t) return intent;
    const { self, model, mem, rng, now, params, features } = ctx;
    const me = self.pos;
    const d = ctx.targetDist;
    intent.targetId = t.id;
    mem.targetId = t.id;
    const slot = fightSlot(self, ctx.guns, d);
    intent.slot = slot;
    const gun = ctx.guns.find((g) => g.slot === slot);
    const aimPoint = leadPoint(ctx, t);
    intent.aim = aimPoint;
    const toT = v2.normalizeSafe(v2.sub(t.pos, me));

    if (!gun) {
        // fists or melee: charge, swing in reach
        intent.goal = v2.copy(t.pos);
        intent.arriveDist = 1.2;
        intent.fire = d < MELEE_REACH + 0.3 && t.visible;
        return intent;
    }
    if (!t.visible) {
        // cover: hold the last-seen angle instead of walking into it
        if (features.cover && holdLostAngle(ctx, intent, t)) return intent;
        // last seen spot: approach carefully, ready to shoot
        intent.goal = v2.copy(t.pos);
        intent.arriveDist = 4;
        return intent;
    }
    // tactics for this engagement (re-rolled for every new target and every few seconds)
    if (mem.engagedTarget !== t.id || now > mem.tacticsUntil) {
        mem.tacticsUntil = now + rng.range(4, 8);
        mem.strafing = rng.bool(params.strafeChance);
        mem.useCover = rng.bool(params.coverChance);
        mem.standStill = rng.bool(params.standStillChance);
    }
    intent.fire = canShoot(ctx, t, d);
    // assess: no shot that only opens a clearly lost trade
    if (intent.fire && holdFire(ctx, t, d)) intent.fire = false;
    // cover: take an even fight at range into a building, else peek from cover (reload and heal behind it)
    if (features.cover && (planBuildingHold(ctx, intent, gun) || planCoverPeek(ctx, intent, gun))) return intent;
    const info = gun.info;
    const reloading = self.action.type === "reload";
    const empty = gun.mag <= 0;
    if (smartReloadOn(ctx) && (empty || reloading)) {
        // reload behind cover when it is close (the other gun is swapped in by brain/reload.ts when it suits)
        const cover = findCover(model, t.pos, RELOAD_COVER) ?? (mem.useCover ? findCover(model, t.pos) : null);
        if (cover) {
            intent.goal = cover;
            intent.arriveDist = 0.6;
            return intent;
        }
    } else if ((empty || reloading) && mem.useCover) {
        const cover = findCover(model, t.pos);
        if (cover) {
            intent.goal = cover;
            intent.arriveDist = 0.6;
            return intent;
        }
    }
    if (!empty && !reloading && !model.lineOfFire(me, t.pos)) {
        // something stands between: with a grenade, keep a safe throwing distance and let it decide (the explosion
        // reaches 12 units); without, go around the cover (the path leads past it) until the shot is clear
        const frags = FRAG_TYPES.some((it) => (self.inventory[it] ?? 0) > 0);
        if (frags && d < 11) {
            intent.moveDir = freeDir(model, me, v2.neg(toT));
            return intent;
        }
        if (!frags || d > 26) {
            // cover: around the obstacle to a spot with a shot (walking straight at the target can stall against it)
            const flank = features.cover ? flankSpot(ctx, t) : null;
            intent.goal = flank ?? v2.copy(t.pos);
            // within the usual stopping distance already (two bots on either side of a tree, a crate or a wall): keep
            // walking round the obstacle, or both stand facing each other without a shot until the zone comes
            intent.arriveDist = flank ? 1 : Math.min(Math.max(6, info.idealMin), Math.max(0.5, d - 3));
            return intent;
        }
    }
    if (now >= mem.strafeUntil) {
        mem.strafeSign = rng.bool() ? 1 : -1;
        mem.strafeUntil = now + rng.range(0.35, 1.2);
    }
    const perp = v2.mul(v2.perp(toT), mem.strafeSign);
    let radial = 0;
    if (d > info.idealMax) radial = 1;
    else if (d < info.idealMin) radial = -1;
    if (features.assess && ctx.assessment) radial = assessedRadial(ctx, d, info, radial);
    else if (features.opportunism && isBusy(ctx, t)) radial = pressRadial(d, info);
    const longShot = d > 20 && info.def.moveSpread >= 2 && info.cls !== "shotgun";
    if (longShot && mem.standStill && intent.fire && !empty) {
        intent.stop = true;
        return intent;
    }
    if (radial > 0 && d > info.maxEngage * params.rangeMult) {
        // out of reach: close in along the path
        intent.goal = v2.copy(t.pos);
        intent.arriveDist = info.idealMax * 0.8;
        return intent;
    }
    let move = v2.mul(toT, radial);
    if (mem.strafing) move = v2.add(move, v2.mul(perp, radial === 0 ? 1 : 0.7));
    if (v2.lengthSqr(move) < 1e-6) {
        intent.stop = mem.standStill;
        return intent;
    }
    const dir = freeDir(model, me, v2.normalize(move));
    if (dir) intent.moveDir = dir;
    else mem.strafeSign = -mem.strafeSign;
    return intent;
}
