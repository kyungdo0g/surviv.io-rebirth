// Staying alive: healing and boosting when hurt and safe (smoke first when an enemy is close, namu.md /팁), rotating
// into the next safe zone ahead of the red zone (follow the line to the safe zone; run when inside the gas), and
// fleeing a fight the bot cannot win.
//
// BrainFeatures.pursuit (bot overhaul MOVE-3 and MOVE-6) replaces the flight (brain/flight.ts) and adds, for items:
// - an item use under fire is broken off (Input.Cancel: the sim keeps it running otherwise, and the bot can neither
//   shoot nor switch while it lasts) when the bot is hit or an armed enemy in view has a line on it, faces it and has
//   it in reach, unless the use is about to finish; no new heal for 2.5 s after that while the danger lasts;
// - soda and pills never with a standing enemy in view; when safe (nobody in view, not hit or shot at for 3 s, out of
//   the gas) the boost bar is kept at 50 or more for every difficulty (user report 16: "use soda / pills when safe";
//   the easy preset never boosted, boostAbove 0), and a boost then scores 0.28 (above exploring and low-value loot);
// - the persona's healBias moves the heal threshold (healBelow);
// - smoke at its own feet before healing only when it cannot fight back (unarmed, or the threat beyond its reach);
// - the zone score does not jump at the next circle's edge: in no hurry (pressure < 0.3) it ramps up over 25 units
//   outside the margin (an item a few steps out of the circle no longer flips the bot between the zone and the item
//   every second: triage house.ts seed 0, zone <-> loot every ~1.5 s for 40 s), and an unarmed bot in the first two
//   circles arms first (x0.6); the rotation goes round an air strike (brain/strikes.ts) instead of through it, and
//   round a place the bot was chased out of (brain/danger.ts) while the zone does not press.
//
// BrainFeatures.endgame, once the zone has closed to nothing (the 50v50 endgame stall, bots faction.test.ts seed 11):
// the gas is everywhere and hurts the same everywhere, so the zone behaviour has nothing left to offer (held at 0.97
// plus its hysteresis it used to pin the last players to the centre, never healing and never going for an enemy);
// it drops to ZONE_CLOSED, and the heals that outlast the others give way to a fight with a standing enemy close by or
// with an enemy kneeling in a revive (a self reviving Medic stands up again: finishing it ends the match).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, Input } from "@rebirth/defs";
import { type GasView, gasCircle, gasTimeLeft } from "@rebirth/sim";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { engagingMe, faces } from "./assess.ts";
import { addCombatLayer, findCover, freeDir } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";
import { dangerAcross } from "./danger.ts";
import { flightScore, planFlight } from "./flight.ts";
import { shootRange } from "./pursuit.ts";
import { inStrike, strikeBlocks } from "./strikes.ts";

/** The last circles close to (nearly) nothing (GameConfig gas stages: radius 0.0225 of the map, then 0). */
const FINAL_RAD = 3;
/** endgame: the current circle under this radius is gone (no safe spot left); the zone score then (below a fight). */
const CLOSED_RAD = 1;
const ZONE_CLOSED = 0.5;
/** Effective rotation speed through terrain and obstacles (u/s; the player runs at 12). */
const TRAVEL_SPEED = 8.5;
/** pursuit: the boost bar kept when safe, the score of such a boost, and how long "safe" needs nothing to happen. */
const SAFE_BOOST = 50;
const SAFE_BOOST_SCORE = 0.28;
const SAFE_QUIET = 3;
/** pursuit: an item use this close to its end is finished even under fire; no new heal this long after a cancel. */
const USE_FINISH = 0.6;
const HEAL_HOLD = 2.5;
/** pursuit: zone score ramp outside the next circle's margin, while the zone does not press. */
const ZONE_RAMP = 25;
const ZONE_RAMP_MIN = 0.3;
const ZONE_NO_HURRY = 0.3;
const ZONE_UNARMED = 0.6;
/** pursuit: zone pressure under which the rotation goes round a place the bot was chased out of, this far past it. */
const ZONE_DETOUR = 0.5;
const DETOUR_PAD = 5;

/** pursuit: nobody in view, not hit or shot at lately, out of the gas (boosting is free then). */
function safeNow(ctx: BrainCtx): boolean {
    const { model, now } = ctx;
    if (now - model.lastHurt < SAFE_QUIET || model.inGasNow()) return false;
    if (model.underFire && now - model.underFire.time < SAFE_QUIET) return false;
    return !ctx.visibleEnemies.some((e) => !e.downed);
}

/** Heal or boost item to use now, or "" (healthkit when badly hurt, bandages otherwise, boosts when healthy). */
export function healItem(ctx: BrainCtx): string {
    const { self, params } = ctx;
    const inv = self.inventory;
    const h = self.health;
    const healBelow = params.healBelow + (ctx.features.pursuit ? ctx.persona.healBias : 0);
    if (h < 100 - 1e-6) {
        if (h < 45 && inv.healthkit > 0) return "healthkit";
        if (h < healBelow + 15 && inv.bandage > 0 && h < 92) return "bandage";
        if (h < healBelow && inv.healthkit > 0) return "healthkit";
    }
    const boostTo = ctx.features.pursuit && safeNow(ctx) ? Math.max(params.boostAbove, SAFE_BOOST) : params.boostAbove;
    if (self.boost < boostTo) {
        if (inv.painkiller > 0 && self.boost < 50) return "painkiller";
        if (inv.soda > 0) return "soda";
    }
    return "";
}

/** pursuit: an armed enemy in view that has the bot in its sights: a line on it, facing it, within its reach. */
function inSights(ctx: BrainCtx, e: Contact): boolean {
    if (e.downed || !e.visible) return false;
    if (isMeleeWeapon(e.activeWeapon) && ctx.now - e.lastArmedAt > 15) return false;
    if (v2.distance(e.pos, ctx.self.pos) > Math.max(shootRange(ctx), 30)) return false;
    if (!ctx.model.lineOfFire(e.pos, ctx.self.pos)) return false;
    return engagingMe(ctx, e) || faces(e, ctx.self.pos, 30);
}

/** pursuit: the item use under way should be broken off (hit, or in an armed enemy's sights; not about to finish). */
function useInterrupted(ctx: BrainCtx): boolean {
    const a = ctx.self.action;
    if (a.type !== "use" || a.duration - a.time < USE_FINISH) return false;
    if (ctx.now - ctx.model.lastHurt < 0.5) return true;
    return ctx.visibleEnemies.some((e) => inSights(ctx, e));
}

/** pursuit: whether the bot can answer `threat` with its guns from here (else smoke and heal). */
function canFightBack(ctx: BrainCtx, threat: Contact): boolean {
    return ctx.armed && v2.distance(threat.pos, ctx.self.pos) <= shootRange(ctx);
}

/** Utility of healing now (0..1). */
export function healScore(ctx: BrainCtx): number {
    const { self, params, now, model } = ctx;
    // (pursuit: an interrupted use still wins this think, so planHeal can cancel it)
    if (self.action.type === "use") return ctx.features.pursuit && useInterrupted(ctx) ? 0.95 : 0.9;
    const item = healItem(ctx);
    if (!item) return 0;
    // endgame (smart brain): once the zone is gone (the last circle closes to nothing) whoever lasts longer in the gas
    // wins: every heal and boost buys time, so use them on the way to the centre instead of only walking
    const gasNow = model.gas;
    if (ctx.features.endgame && gasNow && gasNow.radNew < FINAL_RAD && model.inGasNow()) {
        // ...but not with the last enemy shooting it from close by, nor with one kneeling in a revive within reach (a
        // heal keeps the gun down for seconds): that fight decides the match
        const fightOn = ctx.visibleEnemies.some((e) => {
            const d = v2.distance(e.pos, self.pos);
            return e.downed ? e.reviving && ctx.armed && d <= shootRange(ctx) : d < 40;
        });
        if (!fightOn) return 0.98;
    }
    const isHeal = item === "healthkit" || item === "bandage";
    const pursuit = ctx.features.pursuit;
    if (pursuit) {
        const standing = ctx.visibleEnemies.some((e) => !e.downed);
        // never a soda or pills with an enemy in view; no new heal right after one was broken off under fire
        if (!isHeal && standing) return 0;
        if (now < ctx.mem.pursuit.healHoldUntil && (standing || now - model.lastHurt < SAFE_QUIET)) return 0;
    }
    const healBelow = params.healBelow + (pursuit ? ctx.persona.healBias : 0);
    let s = isHeal ? 0.35 + 0.6 * Math.max(0, (healBelow + 10 - self.health) / 100) : 0.2;
    if (isHeal && self.health < healBelow) s = Math.max(s, 0.55);
    if (pursuit && !isHeal && safeNow(ctx)) s = SAFE_BOOST_SCORE;
    const close = ctx.visibleEnemies.some((e) => v2.distance(e.pos, self.pos) < 30 && !e.downed);
    if (close) s *= self.health < 35 ? 0.6 : 0.25;
    if (now - model.lastHurt < 1.5) s *= 0.6;
    const gas = model.gas;
    if (model.inGasNow() && gas && gas.damage >= 3) s *= 0.3;
    // disengage (smart brain): right after a fight, patch up before looting the spoils (third parties are coming)
    const sinceHurt = now - model.lastHurt;
    if (ctx.features.disengage && isHeal && self.health < 70 && sinceHurt >= 1.5 && sinceHurt < 20) {
        if (!ctx.visibleEnemies.some((e) => !e.downed) && !model.inGasNow()) s = Math.max(s, 0.78);
    }
    return Math.min(0.92, s);
}

export function planHeal(ctx: BrainCtx): Intent {
    const intent = emptyIntent("heal");
    const { self, model, mem, now, rng } = ctx;
    const using = self.action.type === "use";
    const threat = ctx.visibleEnemies.find((e) => !e.downed) ?? ctx.target;
    if (using && ctx.features.pursuit && useInterrupted(ctx)) {
        // hit, or in an armed enemy's sights: break the use off and answer (the sim never ends it on its own)
        intent.actions.push(Input.Cancel);
        mem.pursuit.healHoldUntil = now + HEAL_HOLD;
        if (threat) intent.aim = v2.copy(threat.pos);
        return intent;
    }
    if (!using) {
        // an enemy close by: blind it with smoke first, then heal inside (pursuit: only when it cannot fight back)
        const smokeIt = !ctx.features.pursuit || (!!threat && !canFightBack(ctx, threat));
        if (threat && smokeIt && self.inventory.smoke > 0 && now - mem.lastSmoke > 10 && self.health < 50) {
            mem.lastSmoke = now;
            intent.throwPlan = { item: "smoke", pos: v2.add(self.pos, v2.mul(self.dir, 1.5)), cook: 0.15 };
            return intent;
        }
        const item = healItem(ctx);
        if (item && now - mem.lastUseRequest > 0.6) {
            mem.lastUseRequest = now;
            intent.useItem = item;
        }
    }
    if (threat) {
        const cover = findCover(model, threat.pos, 10);
        if (cover) {
            intent.goal = cover;
            intent.arriveDist = 0.6;
        } else {
            const away = v2.normalizeSafe(v2.sub(self.pos, threat.pos));
            intent.moveDir = freeDir(model, self.pos, away);
        }
        intent.aim = v2.copy(threat.pos);
    } else if (!model.insideSafeZone(self.pos, 4)) {
        intent.goal = zoneTarget(model, rng.next());
        intent.arriveDist = 3;
    } else {
        intent.stop = true;
    }
    return intent;
}

/** Duration of the moving stage that follows a waiting stage (GameConfig stage table; 0 when unknown). */
/**
 * Expected duration of the moving stage that follows a waiting stage: the GameConfig stage table, scaled by how the
 * waiting stage the bot sees compares with the table (servers and tests may run shorter stage tables).
 */
function nextMoveDuration(gas: GasView): number {
    if (gas.mode !== "waiting") return 0;
    const table = GameConfig.gas.stages;
    const waiting = table[gas.stage]?.duration ?? 0;
    const moving = table[gas.stage + 1]?.duration ?? 0;
    const scale = waiting > 0 ? Math.min(1.5, gas.duration / waiting) : 1;
    return moving * scale;
}

/** How hard the zone presses the bot to leave (0 inside the safe zone .. >1 late). */
export function zonePressure(model: WorldModel): number {
    return zonePressureAt(model, model.self.pos);
}

/** zonePressure of a bot standing at `p`. */
export function zonePressureAt(model: WorldModel, p: Vec2): number {
    const gas = model.gas;
    if (!gas || gas.mode === "inactive") return 0;
    const dist = v2.distance(p, gas.posNew);
    if (dist < gas.radNew) return 0;
    const need = (dist - gas.radNew * 0.6) / TRAVEL_SPEED;
    return need / Math.max(gasTimeLeft(gas) + nextMoveDuration(gas), 1);
}

/**
 * Whether going to `p` keeps the bot on its way to the safe zone: never out of the next circle while the zone closes
 * in, and only towards the circle once the zone presses.
 */
export function onTheWay(model: WorldModel, p: Vec2): boolean {
    const gas = model.gas;
    if (!gas || gas.mode === "inactive") return true;
    const selfDist = v2.distance(model.self.pos, gas.posNew);
    const targetDist = v2.distance(p, gas.posNew);
    if (gas.mode === "moving" && selfDist < gas.radNew && targetDist > gas.radNew - 2) return false;
    if (zonePressure(model) < 0.3) return true;
    return targetDist < selfDist + 3;
}

/** A point well inside the next safe circle, along the line from the bot to the circle centre. */
export function zoneTarget(model: WorldModel, jitter: number): Vec2 {
    const gas = model.gas;
    const me = model.self.pos;
    if (!gas) return v2.copy(me);
    const center = gas.posNew;
    const rad = gas.radNew;
    const dist = v2.distance(me, center);
    // deep enough that arriving near it (arriveDist 3) puts the bot inside the margin zoneScore lets go at: in small
    // circles a deeper target left bots standing on it with the zone score still up
    const depth = Math.max(0, Math.min(rad * (0.45 + 0.2 * jitter), rad - Math.min(14, rad * 0.4) - 4));
    if (dist <= depth || rad < 1) return v2.copy(center);
    const p = v2.add(center, v2.mul(v2.normalizeSafe(v2.sub(me, center)), depth));
    const cell = model.nav.nearestWalkable(p, 10, model.nav.component(model.nav.nearestWalkable(me, 3)));
    return cell >= 0 ? model.nav.center(cell) : p;
}

/**
 * threats (smart brain): the zone target with the least threat heat among the straight one and two approaches 45
 * degrees to either side (around the circle centre), so the rotation avoids a fight the bot heard on its way.
 */
export function coolZoneTarget(model: WorldModel, jitter: number): Vec2 {
    const straight = zoneTarget(model, jitter);
    const gas = model.gas;
    if (!gas || model.threats.heat(straight, 20) <= 0) return straight;
    let best = straight;
    let bestHeat = model.threats.heat(straight, 20);
    // only spots the bot can walk to (its own navigation component)
    const comp = model.nav.component(model.nav.nearestWalkable(model.self.pos, 3));
    for (const a of [0.8, -0.8]) {
        const p = v2.add(gas.posNew, v2.rotate(v2.sub(straight, gas.posNew), a));
        const cell = model.nav.nearestWalkable(p, 8, comp);
        if (cell < 0) continue;
        const c = model.nav.center(cell);
        const h = model.threats.heat(c, 20);
        if (h < bestHeat - 0.5) {
            bestHeat = h;
            best = c;
        }
    }
    return best;
}

/** Utility of moving into the safe zone now (0..1). */
export function zoneScore(ctx: BrainCtx): number {
    const { model, self } = ctx;
    const gas = model.gas;
    if (!gas || gas.mode === "inactive") return 0;
    // endgame: the zone is gone, there is no safe spot to run to (heal or fight instead; see the header)
    if (ctx.features.endgame && gas.radNew < FINAL_RAD && gasCircle(gas).rad < CLOSED_RAD) return ZONE_CLOSED;
    if (model.inGasNow()) return gas.damage >= 5 ? 0.97 : 0.93;
    const dist = v2.distance(self.pos, gas.posNew);
    // once rotating, keep going until comfortably inside (no flip-flop on the boundary)
    const margin = Math.min(
        ctx.mem.current === "zone" ? 14 : 6,
        gas.radNew * (ctx.mem.current === "zone" ? 0.4 : 0.25),
    );
    if (dist < gas.radNew - margin) {
        // inside the next circle; late circles keep the bot away from the edge of the current one
        const c = gasCircle(gas);
        return v2.distance(self.pos, c.pos) > c.rad - 4 ? 0.6 : 0;
    }
    const pressure = zonePressure(model);
    if (gas.mode === "moving") return Math.min(0.9, 0.55 + pressure);
    // early circles are weak: finish looting nearby first, but leave with time to spare
    let s = Math.min(0.9, 0.2 + 0.8 * pressure + (gas.circleIdx >= 2 ? 0.15 : 0));
    if (ctx.features.pursuit && pressure < ZONE_NO_HURRY) {
        // no jump at the circle's edge (the item a few steps out flipped the bot between the two every second)
        s *= Math.min(1, Math.max(ZONE_RAMP_MIN, (dist - (gas.radNew - margin)) / ZONE_RAMP));
        // unarmed in the first circles: a gun first
        if (!ctx.armed && gas.circleIdx <= 1) s *= ZONE_UNARMED;
    }
    return s;
}

/**
 * pursuit: a zone goal clear of air strikes (`goal` turned around the next circle's centre when one covers it or the
 * way there), and, out of the gas while the zone does not press, a way round a place the bot was chased out of
 * (brain/danger.ts): a waypoint beside it first (an unarmed bot rotating past the gunman it had just run from fled,
 * rotated back and fled again, up to five times in a match probe).
 */
function clearZoneGoal(ctx: BrainCtx, goal: Vec2): Vec2 {
    const gas = ctx.model.gas;
    if (!gas) return goal;
    if (!ctx.model.inGasNow() && zonePressure(ctx.model) < ZONE_DETOUR) {
        const a = dangerAcross(ctx, goal);
        const wp = a ? sideStep(ctx, goal, a) : null;
        if (wp) return wp;
    }
    if (!strikeBlocks(ctx, goal)) return goal;
    for (const a of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
        const cell = ctx.model.nav.nearestWalkable(
            v2.add(gas.posNew, v2.rotate(v2.sub(goal, gas.posNew), a)),
            8,
            ctx.myComp,
        );
        if (cell < 0) continue;
        const p = ctx.model.nav.center(cell);
        if (!strikeBlocks(ctx, p)) return p;
    }
    return goal;
}

/** A walkable point beside the danger `a` (DETOUR_PAD past its radius, on the side the way to `goal` leans to). */
function sideStep(ctx: BrainCtx, goal: Vec2, a: { pos: Vec2; rad: number }): Vec2 | null {
    const me = ctx.self.pos;
    const dir = v2.normalizeSafe(v2.sub(goal, me));
    const left = { x: -dir.y, y: dir.x };
    // the danger to the left of the way: pass it on the right, and the other way round
    const first = v2.dot(v2.sub(a.pos, me), left) > 0 ? -1 : 1;
    for (const side of [first, -first]) {
        const raw = v2.add(a.pos, v2.mul(left, side * (a.rad + DETOUR_PAD)));
        const cell = ctx.model.nav.nearestWalkable(raw, 6, ctx.myComp);
        if (cell < 0) continue;
        const p = ctx.model.nav.center(cell);
        if (v2.distance(p, a.pos) < a.rad || inStrike(ctx, p) || ctx.model.nav.isWaterAt(p)) continue;
        return p;
    }
    return null;
}

export function planZone(ctx: BrainCtx): Intent {
    const intent = emptyIntent("zone");
    const jitter = (ctx.self.id % 7) / 7;
    intent.goal = ctx.features.threats ? coolZoneTarget(ctx.model, jitter) : zoneTarget(ctx.model, jitter);
    if (ctx.features.pursuit) intent.goal = clearZoneGoal(ctx, intent.goal);
    intent.arriveDist = 3;
    addCombatLayer(ctx, intent);
    return intent;
}

/** Utility of running away (0..1): unarmed against an armed enemy, badly hurt, or outnumbered. */
/** Seconds an enemy that left view still counts as a threat to run from (it is probably still there). */
const THREAT_MEMORY = 2.5;

/** Standing enemies seen recently within `range`. */
function threatsOf(ctx: BrainCtx, range: number): BrainCtx["enemies"] {
    const { self, now } = ctx;
    return ctx.enemies.filter(
        (e) => !e.downed && now - e.lastSeen < THREAT_MEMORY && v2.distance(e.pos, self.pos) < range,
    );
}

export function fleeScore(ctx: BrainCtx): number {
    // pursuit: the reworked flight (brain/flight.ts)
    const s = ctx.features.pursuit ? flightScore(ctx) : baseFleeScore(ctx);
    // disengage (smart brain): running never beats getting out of the gas (the zone scores 0.93+ there)
    if (ctx.features.disengage && s > 0.6 && ctx.model.inGasNow()) return 0.6;
    return s;
}

function baseFleeScore(ctx: BrainCtx): number {
    const { self } = ctx;
    const threats = threatsOf(ctx, 35);
    if (threats.length === 0) return 0;
    // a player seen with a gun a moment ago still has it, even while it punches a crate
    const armedThreat = threats.some((e) => !isMeleeWeapon(e.activeWeapon) || ctx.now - e.lastArmedAt < 15);
    if (!ctx.armed && armedThreat) return threats.some((e) => v2.distance(e.pos, self.pos) < 4) ? 0.5 : 0.8;
    const hasHeals = (self.inventory.healthkit ?? 0) + (self.inventory.bandage ?? 0) > 0;
    if (self.health < 25 && hasHeals) return 0.72;
    if (threats.length >= 3) return 0.62;
    return 0;
}

export function planFlee(ctx: BrainCtx): Intent {
    if (ctx.features.pursuit) return planFlight(ctx);
    const intent = emptyIntent("flee");
    const { self, model, now, mem } = ctx;
    const threats = threatsOf(ctx, 60);
    let away = { x: 0, y: 0 };
    for (const e of threats) {
        const d = Math.max(1, v2.distance(e.pos, self.pos));
        away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(self.pos, e.pos)), 1 / d));
    }
    // run towards the safe zone rather than into the gas
    if (model.gas && model.gas.mode !== "inactive") {
        const toZone = v2.normalizeSafe(v2.sub(model.gas.posNew, self.pos));
        let w = model.insideSafeZone(self.pos, 10) ? 0.2 : 0.8;
        // disengage (smart brain): once the zone presses, the safe zone comes first
        if (ctx.features.disengage && (zonePressure(model) > 0.3 || !model.insideSafeZone(self.pos, 3))) w = 1.6;
        away = v2.add(v2.normalizeSafe(away), v2.mul(toZone, w));
    }
    const dir = v2.normalizeSafe(away);
    const goal = v2.add(self.pos, v2.mul(dir, 25));
    const cell = model.nav.nearestWalkable(goal, 10, ctx.myComp);
    intent.goal = cell >= 0 ? model.nav.center(cell) : goal;
    intent.arriveDist = 3;
    if (threats.length && self.inventory.smoke > 0 && now - mem.lastSmoke > 12) {
        mem.lastSmoke = now;
        intent.throwPlan = { item: "smoke", pos: v2.add(self.pos, v2.mul(dir, -3)), cook: 0.15 };
    }
    addCombatLayer(ctx, intent);
    return intent;
}
