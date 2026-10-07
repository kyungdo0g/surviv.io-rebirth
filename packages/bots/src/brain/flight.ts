// Running away (BrainFeatures.pursuit, bot overhaul MOVE-3; user report 11 "they flee across the map for two
// minutes"). The baseline flight counts every standing enemy seen within 35 units, armed or busy elsewhere, and runs
// straight to a point 25 units on, for ever: it never breaks the line of sight, never picks up a gun on the way, never
// turns to fight. Here:
// - a threat counts only while it chases the bot: it shoots at it, faces it within its gun's reach, closes in on it,
//   or stands within 15 units; an enemy fighting someone else does not;
// - the flight radius comes from the threat's gun (its maxEngage + 8, 16..40 units: about what a screen shows, a gun
//   holder cannot aim at a bot it does not see) and is 6 units larger while the bot is already running (hysteresis,
//   no flee <-> explore flicker at one distance);
// - an unarmed bot runs to a gun lying within 40 units that is not towards the threat and picks it up on the run
//   (explore.ts planLoot), and punches back a chaser that holds melee within 4 units;
// - it runs to cover that breaks the line of sight (an obstacle within 20 units, farther from the threat, not back
//   towards it) and holds there; once the threat has been out of sight for 2.5 s the flight is over (and the place is
//   remembered: brain/danger.ts); without cover it runs on, away from the threats and the map border, towards the
//   safe zone;
// - armed and running for its health or from three enemies, it turns and fights when that costs less: an armed threat
//   within 10 units with a line of fire (a brawl: running only gives free shots, disengage.ts BRAWL), or nowhere to
//   run;
// - smoke goes between the bot and a threat that has a line on it (not at its own feet).
import { type Vec2, v2 } from "@rebirth/core";
import { gunInfo, isMeleeWeapon } from "../knowledge/weapons.ts";
import type { Contact, SeenLoot } from "../perception/world.ts";
import { fleeHealth } from "../persona.ts";
import { enemyGun, engagingMe, faces } from "./assess.ts";
import { addCombatLayer, findCoverFrom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { dangerToLeave, inDangerBuilding, noteDanger } from "./danger.ts";
import { planLoot } from "./explore.ts";
import { closingSpeed } from "./pursuit.ts";
import { strikeBlocks } from "./strikes.ts";
import { zonePressure } from "./survival.ts";
import { underFireNow, zigzagTo } from "./zigzag.ts";

/** An enemy out of sight this long no longer counts (it is probably still there for that long). */
const THREAT_MEMORY = 2.5;
/** Closer than this an enemy is a threat whatever it does. */
const NEAR = 15;
/** Facing the bot within this angle (inside its gun's reach + RADIUS_PAD): a threat. */
const FACING_DEG = 35;
/** Coming towards the bot this fast (u/s): a threat. */
const CLOSING = 2.5;
/**
 * Facing alone stops counting once the bot has been running this long without being shot at or hit (an armed player
 * that only looks at the bot: the flight ends and the danger memory keeps the bot away from its place).
 */
const FACING_GRACE = 5;
/** ...and does not start a new flight for this long unless someone shoots, closes in or comes near. */
const CALM_HOLD = 15;
/** Flight radius: the threat's maxEngage + RADIUS_PAD, within RADIUS_MIN..RADIUS_MAX; STOP_PAD more while running. */
const RADIUS_PAD = 8;
const RADIUS_MIN = 16;
const RADIUS_MAX = 40;
const STOP_PAD = 6;
/** Melee reach assumed for an unarmed threat (fists 2.25 + a step). */
const FIST_REACH = 6;
/** An unarmed bot runs to a gun this close that is not towards the threat, and picks it up from GUN_GRAB. */
const GUN_SEARCH = 40;
const GUN_GRAB = 1.6;
/** ...at least this far from every armed threat (steady.ts keeps loot that close to a fled enemy out of reach). */
const GUN_CLEAR = 16;
/** Punch back a chaser holding melee this close. */
const PUNCH_BACK = 4;
/** Cover hop of a flight, and how long a chosen cover spot is kept. */
const COVER_HOP = 20;
const SPOT_KEEP = 4;
/**
 * A threat coming at the bot faster than this is a hunter: the bot does not stop behind cover (it gets flanked: match
 * probe, an unarmed bot held cover after cover for 43 s while a G18C bot walked round each one and shot it), it runs,
 * passing behind cover only on its way (a spot within this cosine of the run direction).
 */
const HUNTING = 1.5;
const ON_THE_WAY = 0.6;
/** Cover closer than this to the threat is no use (it still counts as close: NEAR); nor is holding there. */
const COVER_CLEAR = NEAR + 3;
/** Straight run: this far, rotated away from the map border by up to 90 degrees. */
const RUN = 25;
const BORDER = 14;
/** An armed threat this close with a line of fire: running only gives it free shots (disengage.ts BRAWL). */
const BRAWL = 10;
const SMOKE_EVERY = 12;
const SMOKE_RANGE = 30;
/** Score of walking on out of the way of a building the bot was chased out of (below a gun to grab, 0.7). */
const LEAVE_SCORE = 0.66;

/** Whether `e` seen with a gun is armed (it keeps the gun when it switches to its fists for a while). */
function armed(ctx: BrainCtx, e: Contact): boolean {
    return !isMeleeWeapon(e.activeWeapon) || ctx.now - e.lastArmedAt < 15;
}

/** How far a threat reaches the bot: its gun's maxEngage, or a punch. */
function reachOf(ctx: BrainCtx, e: Contact): number {
    const g = enemyGun(ctx, e);
    return g ? Math.min(g.maxEngage, g.range) : FIST_REACH;
}

/** Whether `e` chases the bot: shoots at it, faces it within its reach, closes in, or stands too close to ignore. */
export function chasesMe(ctx: BrainCtx, e: Contact): boolean {
    const d = v2.distance(e.pos, ctx.self.pos);
    if (d < NEAR || engagingMe(ctx, e)) return true;
    // just out of sight (off the screen, under a roof again) while the bot runs: still there for a moment
    if (!e.visible) return ctx.mem.current === "flee";
    if (closingSpeed(ctx, e) > CLOSING) return true;
    // kneeling over a teammate it cannot shoot: looking the bot's way is no chase
    if (e.reviving) return false;
    const { now, model, mem } = ctx;
    const shotAt = Math.max(model.lastHurt, model.underFire?.time ?? Number.NEGATIVE_INFINITY);
    if (now - shotAt > FACING_GRACE) {
        if (mem.current === "flee" && now - mem.currentSince > FACING_GRACE) mem.pursuit.calmUntil = now + CALM_HOLD;
        if (now < mem.pursuit.calmUntil) return false;
    }
    const pad = RADIUS_PAD + (mem.current === "flee" ? STOP_PAD : 0);
    return d < reachOf(ctx, e) + pad && faces(e, ctx.self.pos, FACING_DEG);
}

/** Standing enemies seen lately that chase the bot, within their flight radius (the larger one while running). */
export function flightThreats(ctx: BrainCtx): Contact[] {
    const pad = ctx.mem.current === "flee" ? STOP_PAD : 0;
    const me = ctx.self.pos;
    return ctx.enemies.filter((e) => {
        if (e.downed || ctx.now - e.lastSeen > THREAT_MEMORY) return false;
        const r = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, reachOf(ctx, e) + RADIUS_PAD)) + pad;
        return v2.distance(e.pos, me) < r && chasesMe(ctx, e);
    });
}

function nearest(ctx: BrainCtx, list: readonly Contact[]): Contact | null {
    let best: Contact | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const e of list) {
        const d = v2.distance(e.pos, ctx.self.pos);
        if (d < bestD) {
            bestD = d;
            best = e;
        }
    }
    return best;
}

/** A gun on the ground within GUN_SEARCH that is not towards any armed threat (nearest first), or null. */
export function safeGun(ctx: BrainCtx, threats: readonly Contact[]): SeenLoot | null {
    const me = ctx.self.pos;
    let best: SeenLoot | null = null;
    let bestD = GUN_SEARCH;
    for (const l of ctx.model.loot.values()) {
        if ((l.layer & 1) !== 0) continue;
        const until = ctx.mem.lootBlacklist.get(l.id);
        if (until !== undefined && until > ctx.now) continue;
        const info = gunInfo(l.type);
        if (!info || info.score <= 0) continue;
        const d = v2.distance(me, l.pos);
        if (d >= bestD) continue;
        const towards = threats.some((e) => {
            const fromThreat = v2.distance(e.pos, l.pos);
            const mine = v2.distance(e.pos, me);
            return fromThreat < Math.min(GUN_CLEAR, mine + 2) || fromThreat < mine - 2;
        });
        if (towards || inDangerBuilding(ctx, l.pos) || nearFailedGoal(ctx, l.pos) || !reachable(ctx, l.pos, 1.4))
            continue;
        best = l;
        bestD = d;
    }
    return best;
}

/** Direction away from the threats (closer ones weigh more), leaning towards the safe zone. */
function awayDir(ctx: BrainCtx, threats: readonly Contact[]): Vec2 {
    const { self, model } = ctx;
    let away = { x: 0, y: 0 };
    for (const e of threats) {
        const d = Math.max(1, v2.distance(e.pos, self.pos));
        away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(self.pos, e.pos)), 1 / d));
    }
    away = v2.normalizeSafe(away);
    const gas = model.gas;
    if (gas && gas.mode !== "inactive") {
        const toZone = v2.normalizeSafe(v2.sub(gas.posNew, self.pos));
        let w = model.insideSafeZone(self.pos, 10) ? 0.2 : 0.8;
        if (zonePressure(model) > 0.3 || !model.insideSafeZone(self.pos, 3)) w = 1.6;
        away = v2.normalizeSafe(v2.add(away, v2.mul(toZone, w)));
    }
    return away;
}

/** A point RUN units away along `dir` or up to 90 degrees off it, clear of the map border, or null (cornered). */
function runGoal(ctx: BrainCtx, dir: Vec2, threat: Contact | null): Vec2 | null {
    const { model, self } = ctx;
    const w = model.map.width;
    const h = model.map.height;
    for (const a of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
        const d = a === 0 ? dir : v2.rotate(dir, a);
        const p = v2.add(self.pos, v2.mul(d, RUN));
        if (p.x < BORDER || p.y < BORDER || p.x > w - BORDER || p.y > h - BORDER) continue;
        const cell = model.nav.nearestWalkable(p, 10, ctx.myComp);
        if (cell < 0) continue;
        const goal = model.nav.center(cell);
        if (v2.distance(goal, self.pos) < RUN * 0.4) continue;
        if (threat && v2.distance(goal, threat.pos) < v2.distance(self.pos, threat.pos) + 4) continue;
        if (strikeBlocks(ctx, goal)) continue;
        return goal;
    }
    return null;
}

/** A cover spot within COVER_HOP that hides the bot from `threat`, farther from it and not back towards it. */
function flightCover(ctx: BrainCtx, threat: Contact, away: Vec2): Vec2 | null {
    const me = ctx.self.pos;
    const myDist = v2.distance(me, threat.pos);
    return findCoverFrom(ctx.model, me, threat.pos, COVER_HOP + 4, (spot) => {
        const fromThreat = v2.distance(spot, threat.pos);
        if (v2.distance(spot, me) > COVER_HOP || fromThreat < myDist + 2 || fromThreat < COVER_CLEAR) return false;
        const dir = v2.normalizeSafe(v2.sub(spot, me));
        return v2.dot(dir, away) > -0.2 && reachable(ctx, spot, 1) && !nearFailedGoal(ctx, spot);
    });
}

/** Utility of running away (BrainFeatures.pursuit): see the header. */
export function flightScore(ctx: BrainCtx): number {
    const threats = flightThreats(ctx);
    // out of sight again, but still next to the building it was chased out of: keep going (unarmed)
    if (!threats.length) return dangerToLeave(ctx) ? LEAVE_SCORE : 0;
    const { self, model } = ctx;
    const armedThreats = threats.filter((e) => armed(ctx, e));
    const close = nearest(ctx, threats);
    if (!ctx.armed && armedThreats.length) {
        // the armed chaser holds melee right now (holstered, out of ammo) within a punch or two: punch back (the fight
        // scores 0.7 when hit)
        const chaser = nearest(ctx, armedThreats);
        if (chaser && isMeleeWeapon(chaser.activeWeapon) && v2.distance(chaser.pos, self.pos) < PUNCH_BACK) return 0.3;
        return 0.8;
    }
    const hasHeals = (self.inventory.healthkit ?? 0) + (self.inventory.bandage ?? 0) > 0;
    const low = self.health < fleeHealth(ctx.persona) && hasHeals;
    if (!low && armedThreats.length < 3) return 0;
    // running costs more than fighting: a brawl with a line of fire, or nowhere to run
    const brawl =
        ctx.armed &&
        armedThreats.some((e) => v2.distance(e.pos, self.pos) < BRAWL && model.lineOfFire(self.pos, e.pos));
    if (brawl || !runGoal(ctx, awayDir(ctx, threats), close)) return 0;
    return low ? 0.72 : 0.62;
}

/** The flight (BrainFeatures.pursuit): a gun on the way, cover that breaks the line of sight, or a straight run. */
export function planFlight(ctx: BrainCtx): Intent {
    const intent = emptyIntent("flee");
    const { self, model, now, mem } = ctx;
    const pm = mem.pursuit;
    const threats = flightThreats(ctx);
    const armedThreats = threats.filter((e) => armed(ctx, e));
    for (const e of armedThreats) noteDanger(ctx, e);
    const primary = nearest(ctx, armedThreats.length ? armedThreats : threats);
    const me = self.pos;
    const leave = threats.length ? null : dangerToLeave(ctx);
    const away = leave ? v2.normalizeSafe(v2.sub(me, leave.pos)) : awayDir(ctx, threats);
    const gun = !ctx.armed && (armedThreats.length || leave) ? safeGun(ctx, armedThreats) : null;
    const gunDist = gun ? v2.distance(gun.pos, me) : Number.POSITIVE_INFINITY;
    if (gun && gunDist < GUN_GRAB) {
        // on it: pick it up on the run (the loot behaviour's pickup: the closest item, slot to replace, retries)
        const pick = planLoot(ctx, { loot: gun, value: 100, dist: gunDist });
        pick.behaviour = "flee";
        if (primary && !pick.aim) pick.lookAt = v2.copy(primary.pos);
        return pick;
    }
    if (gun) {
        intent.goal = v2.copy(gun.pos);
        intent.arriveDist = 0.5;
    } else if (primary) {
        // hunted (it comes at the bot): run, through cover on the way at most; else cover to hide behind and hold
        const hunted = primary.visible && closingSpeed(ctx, primary) > HUNTING;
        let spot = pm.fleeSpot;
        const stale = !spot || now > pm.fleeSpotUntil || nearFailedGoal(ctx, spot);
        if (stale || (spot && model.lineOfFire(primary.pos, spot))) {
            spot = flightCover(ctx, primary, away);
            pm.fleeSpot = spot;
            pm.fleeSpotUntil = now + SPOT_KEEP;
        }
        if (spot && hunted && v2.dot(v2.normalizeSafe(v2.sub(spot, me)), away) < ON_THE_WAY) spot = null;
        const pd = v2.distance(primary.pos, me);
        if (spot && !hunted && v2.distance(spot, me) < 1 && pd > NEAR && !model.lineOfFire(primary.pos, me)) {
            // behind cover, out of its line of fire: hold (the flight ends once it stops chasing or leaves the screen)
            intent.stop = true;
            pm.fleeSpotUntil = now + SPOT_KEEP;
        } else if (spot && pd > NEAR && v2.distance(spot, me) >= 1) {
            intent.goal = v2.copy(spot);
            intent.arriveDist = 0.6;
        } else {
            pm.fleeSpot = null;
            const goal = runGoal(ctx, away, primary) ?? v2.add(me, v2.mul(away, RUN));
            intent.goal = goal;
            intent.arriveDist = 3;
        }
        // shot at in its line of fire on the way: irregular legs, not a straight line (zigzag.ts)
        if (intent.goal && underFireNow(ctx) && (!primary.visible || model.lineOfFire(primary.pos, me)))
            zigzagTo(ctx, intent, intent.goal);
    } else {
        intent.goal = runGoal(ctx, away, null) ?? v2.add(me, v2.mul(away, RUN));
        intent.arriveDist = 3;
    }
    // to a gun on the run under fire as well (the cover and straight-run legs are handled above)
    if (gun && intent.goal && underFireNow(ctx)) zigzagTo(ctx, intent, intent.goal);
    // smoke between the bot and a threat that has a line on it (the old flight smoked its own feet)
    if (primary?.visible && (self.inventory.smoke ?? 0) > 0 && now - mem.lastSmoke > SMOKE_EVERY) {
        const pd = v2.distance(primary.pos, me);
        if (pd > BRAWL && pd < SMOKE_RANGE && model.lineOfFire(primary.pos, me)) {
            mem.lastSmoke = now;
            const toThreat = v2.normalizeSafe(v2.sub(primary.pos, me));
            intent.throwPlan = { item: "smoke", pos: v2.add(me, v2.mul(toThreat, 4)), cook: 0.15 };
        }
    }
    addCombatLayer(ctx, intent);
    if (!intent.aim && primary) intent.lookAt = v2.copy(primary.pos);
    return intent;
}
