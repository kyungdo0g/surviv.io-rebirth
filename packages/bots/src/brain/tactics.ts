// The engagement against ctx.target (planFight: slot by distance, the weapon's preferred range, strafing, cover while
// reloading, standing still for long shots, going around cover or keeping a grenade distance). How much fighting
// matters (fightScore) lives in brain/fightScore.ts. The smart brain adds, each behind its flag: the fight assessment
// (push a won trade, otherwise take the range where its guns beat the enemy's, back off in a lost one, and hold fire on
// a clearly lost one that is not shooting at the bot), opportunism (press a busy or weakened enemy), cover (peek from
// cover in a lost trade, hold a building, hold a lost target's angle, flank around the obstacle between:
// brain/cover.ts, brain/building.ts) and reloading in cover (smartReload). A target out of reach goes through the
// pursuit seam first (brain/pursuit.ts planChase).
// Fire and attention (bot overhaul COMBAT-7/8/11/12, both brains): the crosshair tracks a target only while a shot is
// on or about to be (reaction, exposure, reload); out of reach it glances (Intent.lookAt) while the bot closes in,
// behind cover it holds the cover's edge, and on a trade the bot holds fire on it does not track at all. A shot from
// beyond the gun's comfort range is answered (combat.ts engageLimit); outranged and under fire the bot zig-zags in or
// takes the cover next to it instead of walking straight at the shooter. A whole body behind cover is brain/standoff.ts
// (frag at once or move, reposition), melee brain/melee.ts. Round 3 (smart, BrainFeatures.cover): a target out of sight
// is held at the spot it vanished at, prefired there right after it ran into a bush or through a door
// (brain/lostTarget.ts, item 25), and one that walked into smoke gets sprayed, fragged or its exit held
// (brain/smokeFight.ts, item 23); a faint body under a canopy is shot in short bursts (brain/faint.ts, item 26).
import { type Vec2, v2 } from "@rebirth/core";
import type { GunInfo } from "../knowledge/weapons.ts";
import type { Contact } from "../perception/world.ts";
import { ADVANTAGE_BAND, holdFire, pushAdvantageOf, rangePreference } from "./assess.ts";
import { planBuildingHold } from "./building.ts";
import {
    findCover,
    freeDir,
    leadPoint,
    reactedTo,
    returningFire,
    type ShotCheck,
    shotAim,
    shotCheck,
    slotAgainst,
} from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { holdLostAngle, planCoverPeek } from "./cover.ts";
import { faintDropped } from "./faint.ts";
import { lostAim, prefireCorner } from "./lostTarget.ts";
import { heldMelee, perceivedOffset, standOff, swingBand } from "./melee.ts";
import { isBusy } from "./opportunity.ts";
import { planFightPosition } from "./position.ts";
import { planChase } from "./pursuit.ts";
import { smartReloadOn } from "./reload.ts";
import { planSmoke } from "./smokeFight.ts";
import { coverAim, planBlocked } from "./standoff.ts";

/** Cover this close is worth walking to for a reload (smartReload). */
const RELOAD_COVER = 4;
/** Out of reach by less than this, about half a second of closing in: the crosshair stays on (the shot is near). */
const RANGE_SOON = 6;
/** Outranged and shot at: cover this close is taken (else the bot zig-zags in). */
const OUTRANGED_COVER = 6;
/** pursuit: hit this recently, the bot strafes instead of standing still (s). */
const HIT_STRAFE = 1.5;
/** pursuit (round 5): a strafe leg lasts this long (s), and the side flips at its end with this chance. */
const STRAFE_LEG: readonly [number, number] = [0.9, 2.4];
const STRAFE_FLIP = 0.4;

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

/**
 * Where the crosshair goes for the shot check's outcome (COMBAT-7): on the target (its exposed edge) while a shot is on
 * or about to be, on the cover's edge while it hides, only a glance while it is out of reach or the bot holds fire.
 */
function attend(ctx: BrainCtx, intent: Intent, t: Contact, check: ShotCheck, hold: boolean, d: number): void {
    if (hold) {
        intent.lookAt = v2.copy(t.pos);
        return;
    }
    switch (check.why) {
        case null:
        case "reaction":
        case "exposure":
        case "empty":
            intent.aim = shotAim(ctx, t, check);
            return;
        case "faint":
            // between bursts on a faint body: near the guess; given up on: a glance
            if (faintDropped(ctx, t)) intent.lookAt = v2.copy(t.pos);
            else intent.aim = shotAim(ctx, t, check);
            return;
        case "blocked":
            intent.aim = coverAim(ctx, t);
            return;
        case "range":
            if (d <= check.limit + RANGE_SOON) intent.aim = shotAim(ctx, t, check);
            else intent.lookAt = v2.copy(t.pos);
            return;
        default:
            intent.aim = leadPoint(ctx, t);
    }
}

/**
 * Fists or a melee weapon: close in to a human stand-off on where the target seemed to be a moment ago, swing once
 * reacted when that perceived gap is inside the weapon's reach (melee.ts).
 */
function planMelee(ctx: BrainCtx, intent: Intent, t: Contact): Intent {
    const def = heldMelee(ctx.self);
    // the shot check draws the reaction time of a new target
    shotCheck(ctx, t, ctx.targetDist);
    const rel = perceivedOffset(ctx, t);
    const seen: Vec2 = v2.add(ctx.self.pos, rel);
    intent.goal = seen;
    intent.arriveDist = standOff(def);
    intent.aim = seen;
    intent.fire = t.visible && reactedTo(ctx, t) && v2.length(rel) <= swingBand(def);
    return intent;
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
    const slot = slotAgainst(ctx, t, d);
    intent.slot = slot;
    const gun = ctx.guns.find((g) => g.slot === slot);
    const toT = v2.normalizeSafe(v2.sub(t.pos, me));

    if (!gun) return planMelee(ctx, intent, t);
    if (!t.visible) {
        // the last-seen spot: hold its angle from cover, or approach carefully, crosshair on it (smart: on the spot it
        // vanished at, a smoke stand-off when it walked into smoke, a prefire burst at a bush or door)
        intent.aim = features.cover ? lostAim(ctx, t) : leadPoint(ctx, t);
        if (features.cover && planSmoke(ctx, intent, t, gun)) return intent;
        if (features.cover && holdLostAngle(ctx, intent, t)) {
            prefireCorner(ctx, intent, t.id);
            return intent;
        }
        intent.goal = v2.copy(t.pos);
        intent.arriveDist = 4;
        if (features.cover) prefireCorner(ctx, intent, t.id);
        return intent;
    }
    // tactics for this engagement (re-rolled for every new target and every few seconds)
    if (mem.engagedTarget !== t.id || now > mem.tacticsUntil) {
        mem.tacticsUntil = now + rng.range(4, 8);
        mem.strafing = rng.bool(params.strafeChance);
        mem.useCover = rng.bool(params.coverChance);
        mem.standStill = rng.bool(params.standStillChance);
    }
    const check = shotCheck(ctx, t, d);
    // assess: no shot that only opens a clearly lost trade
    const hold = check.ok && holdFire(ctx, t, d);
    intent.fire = check.ok && !hold;
    if (intent.fire) {
        mem.fight.fireTarget = t.id;
        mem.fight.fireAt = now;
    }
    attend(ctx, intent, t, check, hold, d);
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
    if (!empty && !reloading && check.why === "blocked") {
        // the whole body behind cover: frag at once or move (standoff.ts), never stand waiting
        planBlocked(ctx, intent, info, d);
        return intent;
    }
    // position seam (MOVE, round 3): fight from the edge of cover instead of strafing in the open (brain/position.ts)
    if (planFightPosition(ctx, intent, gun, d)) return intent;
    if (now >= mem.strafeUntil) {
        if (features.pursuit) {
            // round 5 (report 36): human strafe legs (the owner's videos: 7 reversals a minute in a typical 10 s
            // stretch, 21 at the 90th percentile; the old 0.35-1.2 s legs with a fresh side each made 60+)
            if (rng.next() < STRAFE_FLIP) mem.strafeSign = -mem.strafeSign;
            mem.strafeUntil = now + rng.range(STRAFE_LEG[0], STRAFE_LEG[1]);
        } else {
            mem.strafeSign = rng.bool() ? 1 : -1;
            mem.strafeUntil = now + rng.range(0.35, 1.2);
        }
    }
    const perp = v2.mul(v2.perp(toT), mem.strafeSign);
    let radial = 0;
    if (d > info.idealMax) radial = 1;
    else if (d < info.idealMin) radial = -1;
    if (features.assess && ctx.assessment) radial = assessedRadial(ctx, d, info, radial);
    else if (features.opportunism && isBusy(ctx, t)) radial = pressRadial(d, info);
    const longShot = d > 20 && info.def.moveSpread >= 2 && info.cls !== "shotgun";
    // pursuit: being hit, nobody stands still for a steadier shot (a second shooter, or losing the trade standing:
    // adversarial review, an expert stood still 82% of a 20 u fight and soaked a flanker's fire): it strafes
    const shotAt = features.pursuit && now - model.lastHurt < HIT_STRAFE;
    const standStill = mem.standStill && !shotAt;
    const strafing = mem.strafing || shotAt;
    if (longShot && standStill && intent.fire && !empty) {
        intent.stop = true;
        return intent;
    }
    if (radial > 0 && d > info.maxEngage * params.rangeMult) {
        // pursuit seam (MOVE): give up, holster-sprint or otherwise plan the chase; the stub never does
        if (planChase(ctx, intent, gun)) return intent;
        // outranged and shot at: the cover next to it, or zig-zag in, not a straight walk into the bullets
        if (!intent.fire && returningFire(ctx, t)) {
            const cover = now - model.lastHurt < 2 ? findCover(model, t.pos, OUTRANGED_COVER) : null;
            if (cover && v2.distance(cover, me) > 0.8) {
                intent.goal = cover;
                intent.arriveDist = 0.6;
                return intent;
            }
            const zig = freeDir(model, me, v2.normalize(v2.add(v2.mul(toT, 0.7), v2.mul(perp, 0.7))));
            if (zig) {
                intent.moveDir = zig;
                return intent;
            }
        }
        // out of reach: close in along the path
        intent.goal = v2.copy(t.pos);
        intent.arriveDist = info.idealMax * 0.8;
        return intent;
    }
    let move = v2.mul(toT, radial);
    if (strafing) move = v2.add(move, v2.mul(perp, radial === 0 ? 1 : 0.7));
    if (v2.lengthSqr(move) < 1e-6) {
        intent.stop = standStill;
        return intent;
    }
    const dir = freeDir(model, me, v2.normalize(move));
    if (dir) intent.moveDir = dir;
    else mem.strafeSign = -mem.strafeSign;
    return intent;
}
