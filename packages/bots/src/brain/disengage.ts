// Disengage (BrainFeatures.disengage): break off a fight the bot is losing instead of trading shots to the end. It
// starts when the assessment says the enemy has the edge (A < -0.3) in a fight that is on, or when the trade monitor
// sees the bot losing (over the last 3 s it took more than 1.5x the damage it dealt, and it is under 60 health). It
// retreats from cover to cover away from the threat (cover spots shielding from the threat's bearing, each farther from
// it than the bot), shooting back while exposed and throwing smoke when it has to cross open ground; it leans towards
// the safe zone. A 2 s hysteresis keeps it from flip-flopping, an episode lasts at most 10 s (then 6 s of fighting)
// so the bot never turns passive.
import { type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import { NO_INTEL } from "../perception/intel.ts";
import { ADVANTAGE_BAND, faces } from "./assess.ts";
import { addCombatLayer, findCoverFrom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";

const TRADE_WINDOW = 3;
const HYSTERESIS = 2;
const MAX_EPISODE = 10;
const COOLDOWN = 6;
/** How far a retreat hop may go. */
const HOP = 16;
/** Seconds an enemy out of sight still counts as the threat. */
const THREAT_MEMORY = 2.5;
/** Next circle radius under which there is no room left to disengage. */
const LAST_CIRCLES = 25;

/** Raw damage of a bullet type (0 when unknown). */
function bulletDamage(type: string): number {
    if (!hasDef(type)) return 0;
    return (GameObjectDefs[type] as { damage?: number }).damage ?? 0;
}

/**
 * Feeds the trade monitor (every think while the feature is on): health lost to enemies since the last think, and
 * damage dealt, from the bot's own bullets seen hitting players (scaled for the snapshots between thinks) or the
 * intel's health estimates of the enemies, whichever says more.
 */
export function updateTrade(ctx: BrainCtx): void {
    const { self, model, now } = ctx;
    const sm = ctx.mem.smart;
    let taken = 0;
    if (sm.tradeHealth >= 0 && self.health < sm.tradeHealth && !model.inGasNow() && !self.downed) {
        taken = sm.tradeHealth - self.health;
    }
    sm.tradeHealth = self.health;
    const snaps = sm.tradeSnapshots > 0 ? Math.max(1, model.snapshots - sm.tradeSnapshots) : 1;
    sm.tradeSnapshots = model.snapshots;
    // own hits: only while the bot has been firing (a bullet's hit is reported within its short flight)
    const mag = self.weapons[self.curWeapIdx]?.ammo ?? 0;
    if (mag !== sm.tradeMag || self.curWeapIdx !== sm.tradeSlot) sm.tradeFiredAt = now;
    sm.tradeMag = mag;
    sm.tradeSlot = self.curWeapIdx;
    let hits = 0;
    if (now - sm.tradeFiredAt < 1.5) {
        for (const b of model.bullets) if (b.shooterId === self.id && b.hitPlayer) hits += bulletDamage(b.bulletType);
    }
    let intelDealt = 0;
    // (the inert intel of a bot without it estimates nothing)
    const enemies = model.intel === NO_INTEL ? [] : ctx.enemies;
    for (const e of enemies) {
        const h = model.intel.of(e.id).estHealth;
        const prev = sm.estHealth.get(e.id);
        if (prev !== undefined && h < prev) intelDealt += prev - h;
        sm.estHealth.set(e.id, h);
    }
    if (sm.estHealth.size > 64) {
        for (const id of sm.estHealth.keys()) if (!model.contacts.has(id)) sm.estHealth.delete(id);
    }
    // armour takes about a fifth off on average
    const dealt = Math.max(hits * snaps * 0.8, intelDealt);
    sm.trade.push({ time: now, taken, dealt });
    while (sm.trade.length && sm.trade[0].time < now - TRADE_WINDOW) sm.trade.shift();
}

/** Damage taken and dealt over the trade window. */
export function tradeTotals(ctx: BrainCtx): { taken: number; dealt: number } {
    let taken = 0;
    let dealt = 0;
    for (const s of ctx.mem.smart.trade) {
        if (s.time < ctx.now - TRADE_WINDOW) continue;
        taken += s.taken;
        dealt += s.dealt;
    }
    return { taken, dealt };
}

/** The bot is losing the exchange: took > 1.5x what it dealt over 3 s, and is under 60 health. */
export function losingTrade(ctx: BrainCtx): boolean {
    const { taken, dealt } = tradeTotals(ctx);
    return ctx.self.health < 60 && taken >= 12 && taken > 1.5 * dealt;
}

/** Where the danger is: the target or the nearest standing enemy seen lately, else where the last close bullet came from. */
export function threatPos(ctx: BrainCtx): Vec2 | null {
    const { now, model } = ctx;
    const t = ctx.target;
    if (t && !t.downed && now - t.lastSeen < THREAT_MEMORY) return t.pos;
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const e of ctx.enemies) {
        if (e.downed || now - e.lastSeen > THREAT_MEMORY) continue;
        const d = v2.distance(e.pos, ctx.self.pos);
        if (d < bestD) {
            bestD = d;
            best = e.pos;
        }
    }
    if (best) return best;
    const uf = model.underFire;
    return uf && now - uf.time < 2 ? uf.from : null;
}

/** The fight is on: the target shoots at or faces the bot from close, or the bot was hurt lately. */
function engaged(ctx: BrainCtx): boolean {
    const t = ctx.target;
    const { now } = ctx;
    if (now - ctx.model.lastHurt < 3) return true;
    if (!t) return false;
    return (
        (now - t.lastShotAt < 2 && faces(t, ctx.self.pos, 20)) || (ctx.targetDist < 20 && faces(t, ctx.self.pos, 20))
    );
}

function endEpisode(ctx: BrainCtx): void {
    const sm = ctx.mem.smart;
    sm.disengageUntil = Number.NEGATIVE_INFINITY;
    sm.disengageSpot = null;
}

/** Utility of disengaging now (0..1); 0 keeps the behaviour out of the choice. */
export function disengageScore(ctx: BrainCtx): number {
    const { now } = ctx;
    const sm = ctx.mem.smart;
    // unarmed: running is the flee behaviour's job
    if (!ctx.armed || now < sm.disengageCooldown || ctx.model.inGasNow()) return 0;
    // the last circles leave nowhere to retreat to: fight it out
    const gas = ctx.model.gas;
    if (gas && gas.mode !== "inactive" && gas.radNew < LAST_CIRCLES) return 0;
    if (!threatPos(ctx)) {
        endEpisode(ctx);
        return 0;
    }
    const a = ctx.assessment;
    const outgunned = !!a && a.advantage < -ADVANTAGE_BAND && a.theirHealth > 25 && engaged(ctx);
    if (outgunned || losingTrade(ctx)) {
        if (now > sm.disengageUntil) sm.disengageStart = now;
        sm.disengageUntil = now + HYSTERESIS;
    }
    if (now >= sm.disengageUntil) return 0;
    if (now - sm.disengageStart > MAX_EPISODE) {
        // never turn passive: fight it out for a while
        sm.disengageCooldown = now + COOLDOWN;
        endEpisode(ctx);
        return 0;
    }
    return 0.86;
}

/** The next cover spot of the retreat: shields from `threat`, farther from it than the bot, along `away`. */
function retreatCover(ctx: BrainCtx, threat: Vec2, away: Vec2): Vec2 | null {
    const me = ctx.self.pos;
    const myDist = v2.distance(me, threat);
    return findCoverFrom(ctx.model, me, threat, HOP, (spot) => {
        if (v2.distance(spot, threat) < myDist + 2) return false;
        const dir = v2.normalizeSafe(v2.sub(spot, me));
        return v2.dot(dir, away) > -0.2 && reachable(ctx, spot, 1) && !nearFailedGoal(ctx, spot);
    });
}

export function planDisengage(ctx: BrainCtx): Intent {
    const intent = emptyIntent("disengage");
    const { self, model, mem, now } = ctx;
    const sm = mem.smart;
    const threat = threatPos(ctx);
    if (!threat) return intent;
    const me = self.pos;
    let away = v2.normalizeSafe(v2.sub(me, threat));
    // lean towards the safe zone rather than into the gas
    if (model.gas && model.gas.mode !== "inactive") {
        const toZone = v2.normalizeSafe(v2.sub(model.gas.posNew, me));
        away = v2.normalizeSafe(v2.add(away, v2.mul(toZone, model.insideSafeZone(me, 10) ? 0.3 : 1)));
    }
    let spot = sm.disengageSpot;
    const arrived = !!spot && v2.distance(me, spot) < 1.5;
    if (!spot || model.lineOfFire(threat, spot) || (arrived && v2.distance(me, threat) < 30)) {
        // a new hop: the spot became exposed, or the bot reached it and the threat is still close
        spot = retreatCover(ctx, threat, away);
        sm.disengageSpot = spot;
    }
    if (spot && v2.distance(me, spot) > 0.8) {
        intent.goal = v2.copy(spot);
        intent.arriveDist = 0.8;
    } else if (!spot) {
        const goal = v2.add(me, v2.mul(away, 20));
        const cell = model.nav.nearestWalkable(goal, 8, ctx.myComp);
        intent.goal = cell >= 0 ? model.nav.center(cell) : goal;
        intent.arriveDist = 3;
    } else {
        intent.stop = true;
    }
    // crossing open ground in sight of the threat: smoke between
    const exposed = model.lineOfFire(me, threat) && !!ctx.target?.visible;
    const longRun = !spot || v2.distance(me, spot) > 6;
    if (exposed && longRun && (self.inventory.smoke ?? 0) > 0 && now - mem.lastSmoke > 8) {
        mem.lastSmoke = now;
        const toThreat = v2.normalizeSafe(v2.sub(threat, me));
        intent.throwPlan = { item: "smoke", pos: v2.add(me, v2.mul(toThreat, 4)), cook: 0.15 };
        return intent;
    }
    // shoot back while exposed
    addCombatLayer(ctx, intent);
    if (!intent.aim) intent.lookAt = v2.copy(threat);
    return intent;
}
