// Fight assessment (BrainFeatures.assess): who wins the trade with the target if both start shooting now. The
// advantage A = ln(TTK_them / TTK_me) compares the time the enemies need to kill the bot with the time the bot needs
// to kill its target: TTK = effective health / (gun damage per second x hit chance at that distance). The bot's
// effective health counts armour, boost and the heals in its bag (usable from cover); the target's comes from the
// intel estimate and the armour it is seen wearing. Other armed enemies within 25 units add to the incoming damage,
// a short magazine adds a reload (or a weapon swap), cover within 5 units dampens what the bot takes, teammates next to
// the target speed up the kill. Both sides are assumed to aim like the bot (its difficulty): what differs is health,
// armour, weapons, numbers and position. A > 0.3: push; in between: fight at the range where its guns do better
// (rangePreference); A < -0.3: disengage, or peek from cover; A < -1: do not open fire on a target that is not shooting
// at the bot (holdFire). Tournament diagnostics (hard bots) found the assessment predictive: when the smart bot hit
// first it won 27% of the exchanges at A < -1, 56% at -1..-0.3, 73% around 0 and 84-91% above 0.3.
import { type Vec2, v2 } from "@rebirth/core";
import { fightSlot, hasAmmo } from "../knowledge/arsenal.ts";
import {
    armourFactor,
    firedMoving,
    fistClosing,
    fistDps,
    hitChance,
    rawDps,
    reloadSeconds,
} from "../knowledge/duel.ts";
import { type GunInfo, gunInfo } from "../knowledge/weapons.ts";
import type { Contact } from "../perception/world.ts";
import { findCover } from "./combat.ts";
import type { BrainCtx } from "./context.ts";
import type { BrainFeatures } from "./features.ts";

/** A above this: the bot wins the trade clearly (push); below its negative: it loses (disengage). */
export const ADVANTAGE_BAND = 0.3;
/** Other enemies closer than this join the trade. */
const CROWD_RANGE = 25;
/** Cover this close lets the bot break line of sight to reload and heal. */
const COVER_RANGE = 5;
/** Gun assumed for an enemy seen armed lately that holds something else now. */
const FALLBACK_GUN = "mp5";
/** Typical strafing speed of a fighter (u/s), for the tracking part of the aim error. */
const STRAFE_SPEED = 7;
const MAX_A = 3;
/** Range control looks this many units closer and farther, and moves for at least this gain in ln(dps ratio). */
const RANGE_STEP = 5;
const RANGE_GAIN = 0.12;
/** Cover next to the bot lets it duck out of part of the incoming fire. */
const COVER_DAMPING = 0.8;

export interface Assessment {
    targetId: number;
    /** ln(ttkThem / ttkMe), clamped to [-3, 3]; > 0 the bot wins the trade (from where it is, cover included) */
    advantage: number;
    /** the same without the cover next to the bot: the trade if it pushes out into the open */
    openAdvantage: number;
    /** seconds the bot needs to kill the target */
    ttkMe: number;
    /** seconds the enemies around need to kill the bot */
    ttkThem: number;
    /** shots the bot needs (with its fight gun) and rounds in that gun's magazine */
    shotsNeeded: number;
    magShots: number;
    /** armed enemies counted in the incoming damage (the target included) */
    threats: number;
    /** cover within 5 units of the bot against the target */
    coverNear: boolean;
    /** estimated health of the target */
    theirHealth: number;
}

/** ln(ttkThem / ttkMe) clamped to [-3, 3] (infinite times at the ends). */
function advantageFrom(ttkMe: number, ttkThem: number): number {
    if (!Number.isFinite(ttkMe)) return -MAX_A;
    if (!Number.isFinite(ttkThem)) return MAX_A;
    return Math.max(-MAX_A, Math.min(MAX_A, Math.log(ttkThem / Math.max(ttkMe, 1e-3))));
}

/** Whether any enabled feature reads the assessment (it is computed only then). */
export function wantsAssessment(f: Readonly<BrainFeatures>): boolean {
    return f.assess || f.disengage || f.cover || f.thirdparty || f.airdrop;
}

/** Aim error the assessment assumes for both sides (degrees): the bot's own, against a strafing target. */
function aimSigma(ctx: BrainCtx): number {
    const p = ctx.params;
    return Math.hypot(p.aimErrorDeg, p.aimErrorPerSpeed * STRAFE_SPEED);
}

function reactionMid(ctx: BrainCtx): number {
    const [lo, hi] = ctx.params.reactionTime;
    return (lo + hi) / 2;
}

/** Gun an enemy fights with: the one in its hands, or a typical SMG when it was seen armed lately; null unarmed. */
export function enemyGun(ctx: BrainCtx, e: Contact): GunInfo | null {
    const g = gunInfo(e.activeWeapon);
    if (g && g.score > 0) return g;
    if (ctx.now - e.lastArmedAt < 15) return gunInfo(FALLBACK_GUN) ?? null;
    return null;
}

/** Whether `e` faces `p` within `deg` degrees. */
export function faces(e: Contact, p: { x: number; y: number }, deg: number): boolean {
    const to = v2.normalizeSafe(v2.sub(p, e.pos));
    return v2.dot(e.dir, to) > Math.cos((deg * Math.PI) / 180);
}

/** Expected damage per second `e` deals to the bot, after the bot's armour. */
function incomingDps(ctx: BrainCtx, e: Contact, sigma: number): number {
    const self = ctx.self;
    const d = v2.distance(e.pos, self.pos);
    const g = enemyGun(ctx, e);
    if (!g) return fistDps(d) * armourFactor(self.helmet, self.chest, 1);
    // part of a fight goes to reloads (its magazine is unknown)
    return rawDps(g, d, sigma, firedMoving(g, d)) * armourFactor(self.helmet, self.chest, g.headshotMult) * 0.92;
}

/** Seconds the bot needs to kill `t` with its fight gun at distance `d` (Infinity when it cannot). */
function timeToKill(ctx: BrainCtx, t: Contact, d: number, health: number, sigma: number) {
    const self = ctx.self;
    const slot = fightSlot(self, ctx.guns, d);
    const gun = ctx.guns.find((g) => g.slot === slot && hasAmmo(g));
    if (!gun) {
        // fists: walk up to it first
        const dps = fistDps(0) * armourFactor(t.helmet, t.chest, 1);
        return { ttk: fistClosing(d) + health / dps, shots: 0, mag: 0 };
    }
    const info = gun.info;
    const perShot =
        info.damage *
        info.def.bulletCount *
        hitChance(info, d, sigma, firedMoving(info, d)) *
        armourFactor(t.helmet, t.chest, info.headshotMult);
    if (perShot <= 1e-6) return { ttk: Number.POSITIVE_INFINITY, shots: 0, mag: gun.mag };
    const shots = Math.ceil(health / perShot);
    let ttk = reactionMid(ctx) + (shots - 1) * info.cycle;
    if (gun.mag < shots) {
        // the magazine runs dry first: swap to the other loaded gun, else reload
        const other = ctx.guns.find((g) => g !== gun && g.mag > 0);
        ttk += other ? other.info.def.switchDelay + 0.1 : reloadSeconds(info, shots - gun.mag);
    }
    if (self.action.type === "reload") ttk += info.def.reloadTime * 0.5;
    return { ttk, shots, mag: gun.mag };
}

const coverCache = new WeakMap<object, { time: number; id: number; me: Vec2; them: Vec2; near: boolean }>();

/** Cover within 5 units against `t` (the search is reused for 0.6 s while neither side moved much). */
function coverNearCached(ctx: BrainCtx, t: Contact): boolean {
    const me = ctx.self.pos;
    const c = coverCache.get(ctx.model);
    if (c && c.id === t.id && ctx.now - c.time < 0.6 && ctx.now >= c.time) {
        if (v2.distance(c.me, me) < 2.5 && v2.distance(c.them, t.pos) < 4) return c.near;
    }
    const near = findCover(ctx.model, t.pos, COVER_RANGE) !== null;
    coverCache.set(ctx.model, { time: ctx.now, id: t.id, me: v2.copy(me), them: v2.copy(t.pos), near });
    return near;
}

/** The bot's health plus what boost and its heals add over a fight (more with cover to heal behind). */
function myEffectiveHealth(ctx: BrainCtx, coverNear: boolean): number {
    const { self } = ctx;
    const inv = self.inventory;
    const heals = (inv.bandage ?? 0) * 15 + (inv.healthkit ?? 0) * 100;
    const missing = Math.max(0, 100 - self.health);
    return self.health + self.boost * 0.1 + Math.min(missing, heals) * (coverNear ? 0.35 : 0.15);
}

interface AssessCache {
    time: number;
    id: number;
    me: Vec2;
    them: Vec2;
    health: number;
    theirHealth: number;
    mag: number;
    enemies: number;
    // what the target wears and does, whether it noticed the bot, what the bot wears and does
    helmet: string;
    chest: string;
    action: string | null;
    noticed: boolean;
    myHelmet: string;
    myChest: string;
    myAction: string;
    a: Assessment;
}

const assessCache = new WeakMap<object, AssessCache>();
/** An assessment is reused this long while nothing that moves it changed much. */
const REUSE = 0.2;

/** The assessment against `t`, reused for a moment while positions, health and magazine stay about the same. */
export function assessCached(ctx: BrainCtx, t: Contact): Assessment {
    const { self, model, now } = ctx;
    const c = assessCache.get(model);
    const mag = self.weapons[self.curWeapIdx]?.ammo ?? 0;
    const enemies = ctx.visibleEnemies.length;
    const intel = model.intel.of(t.id);
    const noticed = now - t.lastShotAt < 3 || faces(t, self.pos, 25);
    const theirHealth = intel.estHealth;
    if (
        c &&
        c.id === t.id &&
        now >= c.time &&
        now - c.time < REUSE &&
        c.health === self.health &&
        c.theirHealth === theirHealth &&
        c.mag === mag &&
        c.enemies === enemies &&
        c.noticed === noticed &&
        c.action === intel.action &&
        c.helmet === t.helmet &&
        c.chest === t.chest &&
        c.myHelmet === self.helmet &&
        c.myChest === self.chest &&
        c.myAction === self.action.type &&
        v2.distance(c.me, self.pos) < 1.5 &&
        v2.distance(c.them, t.pos) < 1.5
    ) {
        return c.a;
    }
    const a = assess(ctx, t);
    assessCache.set(model, {
        time: now,
        id: t.id,
        me: v2.copy(self.pos),
        them: v2.copy(t.pos),
        health: self.health,
        theirHealth,
        mag,
        enemies,
        helmet: t.helmet,
        chest: t.chest,
        action: intel.action,
        noticed,
        myHelmet: self.helmet,
        myChest: self.chest,
        myAction: self.action.type,
        a,
    });
    return a;
}

export function assess(ctx: BrainCtx, t: Contact): Assessment {
    const { self, model, now } = ctx;
    const me = self.pos;
    const d = v2.distance(me, t.pos);
    const sigma = aimSigma(ctx);
    const intel = model.intel.of(t.id);
    const theirHealth = Math.max(1, intel.estHealth);
    const mine = timeToKill(ctx, t, d, theirHealth, sigma);
    let ttkMe = mine.ttk;
    // teammates next to the target shoot it too
    let mates = 0;
    for (const c of model.contacts.values()) {
        if (c.teammate && c.visible && !c.downed && v2.distance(c.pos, t.pos) < 30) mates++;
    }
    ttkMe /= 1 + 0.6 * mates;

    let incoming = 0;
    let threats = 0;
    for (const e of ctx.enemies) {
        if (e.downed) continue;
        const isTarget = e.id === t.id;
        if (!isTarget && !e.visible && now - e.lastSeen > 1.5) continue;
        if (!isTarget && v2.distance(e.pos, me) > CROWD_RANGE) continue;
        let w = 1;
        if (!isTarget) w = faces(e, me, 30) || now - e.lastShotAt < 2 ? 1 : 0.5;
        const busy = model.intel.of(e.id).action;
        if (busy === "use" || busy === "revive") w *= 0.5;
        const dps = incomingDps(ctx, e, sigma) * w;
        if (dps > 0) threats++;
        incoming += dps;
    }
    const coverNear = coverNearCached(ctx, t);
    // an enemy that has not noticed the bot yet reacts late; one busy reloading cannot shoot back for a moment
    const noticed = now - t.lastShotAt < 3 || faces(t, me, 25);
    const delay = reactionMid(ctx) + (noticed ? 0 : 0.5) + (intel.action === "reload" ? 1 : 0);
    const theirTtk = (cover: boolean) => {
        const dps = incoming * (cover ? COVER_DAMPING : 1);
        return dps > 1e-6 ? myEffectiveHealth(ctx, cover) / dps + delay : Number.POSITIVE_INFINITY;
    };
    const ttkThem = theirTtk(coverNear);
    const advantage = advantageFrom(ttkMe, ttkThem);
    return {
        targetId: t.id,
        advantage,
        openAdvantage: coverNear ? advantageFrom(ttkMe, theirTtk(false)) : advantage,
        ttkMe,
        ttkThem,
        shotsNeeded: mine.shots,
        magShots: mine.mag,
        threats,
        coverNear,
        theirHealth,
    };
}

/** Below this advantage a trade is clearly lost: the smart brain does not open it (holdFire). */
export const LOST_BAND = 1;

/** Whether `t` is shooting at the bot: its bullets passed close lately, or it fires while facing the bot. */
export function engagingMe(ctx: BrainCtx, t: Contact): boolean {
    const uf = ctx.model.underFire;
    if (uf && uf.shooterId === t.id && ctx.now - uf.time < 2) return true;
    return ctx.now - t.lastShotAt < 2 && faces(t, ctx.self.pos, 20);
}

/**
 * assess: hold fire on a target the bot clearly loses to (A < -1) while that target is not shooting at it, beyond
 * brawl range: opening fire only starts the lost trade. Tournament diagnostics (hard bots, 48 matches): the smart bot
 * opened 44 exchanges at A < -1 and won 9 of the 33 that ended in a kill; at -1..-0.3 it still won 56%.
 */
export function holdFire(ctx: BrainCtx, t: Contact, d: number): boolean {
    if (!ctx.features.assess || t.downed || d < 12) return false;
    const a = ctx.assessment;
    if (!a || a.targetId !== t.id || a.advantage > -LOST_BAND) return false;
    return !engagingMe(ctx, t);
}

/** The advantage against ctx.target (0 when nothing is assessed). */
export function advantageOf(ctx: BrainCtx): number {
    return ctx.assessment?.advantage ?? 0;
}

/** The advantage of pushing out into the open against ctx.target (0 when nothing is assessed). */
export function pushAdvantageOf(ctx: BrainCtx): number {
    return ctx.assessment?.openAdvantage ?? 0;
}

/** The bot's best damage per second against `t` at `dist` (its guns with ammo, after the target's armour). */
function myDpsAt(ctx: BrainCtx, t: Contact, dist: number, sigma: number): number {
    let best = 0;
    for (const g of ctx.guns) {
        if (!hasAmmo(g)) continue;
        const dps =
            rawDps(g.info, dist, sigma, firedMoving(g.info, dist)) *
            armourFactor(t.helmet, t.chest, g.info.headshotMult);
        if (dps > best) best = dps;
    }
    return best;
}

/**
 * Range control: whether the duel with `t` goes better a few units closer (+1) or farther (-1) than now (0: no clear
 * difference), from the two guns' damage at those distances (a rifle keeps a shotgun at bay, a shotgun closes in).
 */
export function rangePreference(ctx: BrainCtx, t: Contact): number {
    const g = enemyGun(ctx, t);
    if (!g) return 0;
    const self = ctx.self;
    const sigma = aimSigma(ctx);
    const d = v2.distance(self.pos, t.pos);
    const ratio = (x: number) => {
        const mine = myDpsAt(ctx, t, x, sigma);
        const theirs = rawDps(g, x, sigma, firedMoving(g, x)) * armourFactor(self.helmet, self.chest, g.headshotMult);
        return Math.log((mine + 1e-3) / (theirs + 1e-3));
    };
    const here = ratio(d);
    const closer = d > RANGE_STEP + 2 ? ratio(d - RANGE_STEP) - here : Number.NEGATIVE_INFINITY;
    const farther = ratio(d + RANGE_STEP) - here;
    if (closer > RANGE_GAIN && closer >= farther) return 1;
    if (farther > RANGE_GAIN) return -1;
    return 0;
}
