// How much fighting ctx.target matters now (the "fight" behaviour's utility): the baseline score (punch back unarmed,
// chase a remembered target for a while, a threatening enemy 0.78, an unprovoked fight DifficultyParams.aggression),
// adjusted by the smart brain's fight assessment (assess: push a won trade, never start a lost one) and opportunism
// (press a busy or weakened enemy). The engagement itself is brain/tactics.ts (planFight).
//
// BrainFeatures.pursuit (bot overhaul MOVE-1/2/4) adds patience (brain/pursuit.ts: a futile engagement is given up and
// ignored for a while) and replaces what kept bots on targets they could not get at:
// - "threatened" means shot at by this target (its bullets passing close, or firing while facing the bot), not "fired
//   at anything" (Contact.lastShotAt counts shots at crates and at other players);
// - a target beyond the bot's reach (its shoot range x persona engageScale x 1.4) that does not threaten it is not
//   worth starting a fight for (0.1); a chase already on keeps 0.3 until its clock runs out (the old 0.35 held every
//   chase for minutes);
// - unprovoked fights scale with loadout confidence: clamp(aggression + persona aggressionBias) x 0.55 with a D-tier
//   best gun, 0.75 with C/C+, 1 with B, 1.1 with A and better (design section 3, critique C3: "weak" by tier, not by
//   class; rushers keep at least 0.8), so a pistol-only bot loots instead of starting fights (F5);
// - no smart push against a target out of reach that runs away or is unarmed (assess gives +3 against fists); a trade
//   the target has not started is left (0.1: the bot goes about its business instead of aiming without shooting) only
//   when it is clearly lost (A < -1, assess.ts LOST_BAND: the smart bot won 27% of those exchanges), and fought like
//   any other between -1 and -0.3 (it still won 56% there; the old 0.25 cap held those as stand-offs with the
//   crosshair on the target and no shot, user reports 4 and 5; the assessment also reads symmetric trades as lost,
//   A -0.15 bare and -0.66 in level 3 armour, because it times the bot's kill with whole hits and reloads and the
//   enemy's with a smooth rate); a bot almost out of ammo restocks before it fights an enemy that leaves it alone;
// - a fist chase ends after 3 s without a hit or closing in (the 0.7 retaliation stays);
// - (round 5, report 35) bare hands against bare hands: a fist fight chosen once per enemy, or none (brain/fists.ts).
import { hasAmmo } from "../knowledge/arsenal.ts";
import { gunRank } from "../knowledge/gunTiers.ts";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import { ADVANTAGE_BAND, enemyGun, engagingMe, LOST_BAND } from "./assess.ts";
import { type BrainCtx, nearFailedGoal } from "./context.ts";
import { fistDuelScore } from "./fists.ts";
import { isBusy, isWeakened } from "./opportunity.ts";
import { closingSpeed, givenUp, notePursuit, shootRange } from "./pursuit.ts";
import { zonePressure } from "./survival.ts";

/** Zone pressure (survival.ts) under which an unprovoked won fight is still worth taking. */
const ZONE_CALM = 0.35;
/** pursuit: a target this far beyond the bot's reach (x its shoot range) is not worth starting a fight for. */
const START_SLACK = 1.4;
/** pursuit: scores of a target out of reach (a chase already on / not started), a lost trade, an ammo-starved bot. */
const CHASE_SCORE = 0.3;
const FAR_SCORE = 0.1;
const LOST_SCORE = 0.1;
const STARVED_SCORE = 0.3;

/** Utility of fighting the selected target (0..1). */
export function fightScore(ctx: BrainCtx): number {
    const pursuit = ctx.features.pursuit;
    if (pursuit) notePursuit(ctx);
    const base = pursuit ? patientFightScore(ctx) : baseFightScore(ctx);
    if (!ctx.features.assess && !ctx.features.opportunism) return base;
    const s = smartFightScore(ctx, base);
    return pursuit ? pursuitCaps(ctx, base, s) : s;
}

export function baseFightScore(ctx: BrainCtx): number {
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

/** Whether the target shot at the bot (pursuit: at the bot itself) or hurt it lately, or stands too close to ignore. */
export function threatened(ctx: BrainCtx): boolean {
    const t = ctx.target;
    if (!t) return false;
    const shot = ctx.features.pursuit ? engagingMe(ctx, t) : ctx.now - t.lastShotAt < 2;
    return shot || ctx.now - ctx.model.lastHurt < 3 || ctx.targetDist < 12;
}

/**
 * Loadout confidence (pursuit, MOVE-2): how readily the bot starts a fight with the best gun it has ammo for (design
 * section 3 with critique C3): D 0.55, C/C+ 0.75, B-/B/B+ 1, A- and better 1.1; a gun outside the tier table 1;
 * a bold persona (aggressionBias > 0, the rusher) at least 0.8.
 */
export function confidence(ctx: BrainCtx): number {
    let best = -1;
    for (const g of ctx.guns) if (hasAmmo(g)) best = Math.max(best, gunRank(g.info.id));
    let c = 1;
    if (best === 0) c = 0.55;
    else if (best > 0 && best <= 2) c = 0.75;
    else if (best >= 6) c = 1.1;
    return ctx.persona.aggressionBias > 0 ? Math.max(c, 0.8) : c;
}

/** The baseline score with patience and loadout confidence (BrainFeatures.pursuit). */
export function patientFightScore(ctx: BrainCtx): number {
    const t = ctx.target;
    if (!t || givenUp(ctx, t)) return 0;
    const { now, model, params } = ctx;
    const d = ctx.targetDist;
    if (!ctx.armed) {
        // unarmed: punch back when attacked (the 0.7 retaliation); against an unarmed one, the fist fight it chose or
        // the punch of one about to swing (brain/fists.ts; its clock ends a chase that goes nowhere: notePursuit)
        if (!t.visible) return 0;
        if (d <= 6 && now - model.lastHurt < 2) return 0.7;
        const duel = fistDuelScore(ctx);
        if (duel !== null) return duel;
        if (d > 6) return 0;
        return isMeleeWeapon(t.activeWeapon) && d < 4 ? params.meleeAggression : 0;
    }
    if (!t.visible) return 0.5 * Math.max(0, 1 - (now - t.lastSeen) / (params.memory + 0.01));
    const threat = threatened(ctx);
    if (!threat && d > shootRange(ctx) * ctx.persona.engageScale * START_SLACK) {
        const chasing = ctx.mem.current === "fight" && ctx.mem.targetId === t.id;
        return chasing ? CHASE_SCORE : FAR_SCORE;
    }
    if (t.downed && ctx.visibleEnemies.some((e) => !e.downed && e !== t)) return 0.5;
    if (nearFailedGoal(ctx, t.pos) && now - model.lastHurt > 3 && !model.lineOfFire(ctx.self.pos, t.pos)) return 0.1;
    if (threat) return 0.78;
    const aggression = Math.min(0.85, Math.max(0.05, params.aggression + ctx.persona.aggressionBias));
    return aggression * confidence(ctx);
}

/** The best gun with ammo holds less than one magazine in all (mag + bag): an ammo-starved chaser. */
function starved(ctx: BrainCtx): boolean {
    let most = -1;
    let clip = 0;
    for (const g of ctx.guns) {
        if (!hasAmmo(g)) continue;
        const rounds = g.mag + g.reserve;
        if (rounds > most) {
            most = rounds;
            clip = g.info.def.maxClip;
        }
    }
    return most >= 0 && most < clip;
}

/** Caps on the smart score against targets the bot cannot get at or should not start on (pursuit). */
function pursuitCaps(ctx: BrainCtx, base: number, s: number): number {
    const t = ctx.target;
    if (!t || !ctx.armed || s <= 0 || t.downed || threatened(ctx)) return s;
    let out = s;
    // no push against a target out of reach that runs away, or an unarmed one out of reach (assess: +3 against fists)
    if (t.visible && ctx.targetDist > shootRange(ctx) && (closingSpeed(ctx, t) < -1 || !enemyGun(ctx, t)))
        out = Math.min(out, base);
    // a lost trade the target has not started: leave it instead of standing in its sights aiming without shooting
    const a = ctx.features.assess ? ctx.assessment : null;
    if (a && t.visible && a.advantage < -LOST_BAND) out = Math.min(out, LOST_SCORE);
    if (starved(ctx)) out = Math.min(out, STARVED_SCORE);
    return out;
}

/** The fight score adjusted by the assessment (assess) and the target's state (opportunism). */
export function smartFightScore(ctx: BrainCtx, base: number): number {
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
            } else if (adv < -ADVANTAGE_BAND && !threat && !ctx.features.pursuit) {
                // a trade it loses: do not start it (pursuit: pursuitCaps leaves only a clearly lost one)
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
