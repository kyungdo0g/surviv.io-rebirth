// Fighting: target selection, the engagement (slot choice by distance, keeping the weapon's preferred range,
// strafing, cover while reloading, standing still for long shots), the "combat layer" that lets other behaviours shoot
// back while moving, grenade opportunities and target leading. The bot only uses contacts from its own snapshots.
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius } from "../geom.ts";
import { currentGun, fightSlot, hasAmmo } from "../knowledge/arsenal.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { type BrainCtx, emptyIntent, type Intent, type ThrowPlan } from "./context.ts";

const MELEE_REACH = 2.4;
const FRAG_TYPES = ["frag", "mirv"];

/** Picks the enemy to fight: visible ones first, the closest and the ones shooting at the bot weigh most. */
export function selectTarget(ctx: BrainCtx): Contact | null {
    const { model, now, mem } = ctx;
    const me = ctx.self.pos;
    let best: Contact | null = null;
    let bestScore = 0;
    for (const c of ctx.enemies) {
        const age = now - c.lastSeen;
        if (age > ctx.params.memory) continue;
        const d = v2.distance(me, c.pos);
        let s = 40 / (d + 5);
        if (!c.visible) s *= 0.45 * (1 - age / (ctx.params.memory + 0.01));
        if (now - c.lastShotAt < 2) s *= 1.4;
        if (model.underFire && model.underFire.shooterId === c.id && now - model.underFire.time < 2) s *= 1.5;
        // a downed enemy is no threat while others stand; finish it when nothing else is around
        if (c.downed) s *= 0.35;
        if (c.id === mem.targetId) s *= 1.3;
        if (s > bestScore) {
            bestScore = s;
            best = c;
        }
    }
    return best;
}

/** Where the bot should aim to hit `c`: its position plus lead along its velocity for the bullet flight time. */
export function leadPoint(ctx: BrainCtx, c: Contact): Vec2 {
    const gun = currentGun(ctx.self, ctx.guns);
    const speed = gun?.info.bulletSpeed ?? 100;
    const d = v2.distance(ctx.self.pos, c.pos);
    const t = d / speed + 0.03;
    const lead = ctx.params.leadFactor;
    // remembered contacts drift along their last velocity for a short while
    const extra = c.visible ? 0 : Math.min(0.5, ctx.now - c.lastSeen);
    return v2.add(c.pos, v2.mul(c.vel, t * lead + extra * 0.5));
}

/** Whether the bot may shoot at `c` now: visible, reacted, in range and in line of fire. */
export function canShoot(ctx: BrainCtx, c: Contact, dist: number): boolean {
    if (!c.visible) return false;
    const mem = ctx.mem;
    if (mem.engagedTarget !== c.id) {
        mem.engagedTarget = c.id;
        mem.engageStart = c.firstSeen;
        const [lo, hi] = ctx.params.reactionTime;
        mem.reaction = ctx.rng.range(lo, hi);
    }
    if (ctx.now - Math.max(c.firstSeen, mem.engageStart) < mem.reaction) return false;
    const gun = currentGun(ctx.self, ctx.guns);
    if (gun) {
        if (gun.mag <= 0) return false;
        if (dist > Math.max(gun.info.maxEngage * ctx.params.rangeMult, 10) || dist > gun.info.range) return false;
    } else if (dist > MELEE_REACH + 0.5) {
        return false;
    }
    return ctx.model.lineOfFire(ctx.self.pos, c.pos);
}

/** A direction near `dir` that does not walk into a wall within 2.5 units (tries mirrored and rotated variants). */
export function freeDir(model: WorldModel, pos: Vec2, dir: Vec2): Vec2 | null {
    const tries = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
    for (const a of tries) {
        const d = a === 0 ? dir : v2.rotate(dir, a);
        const probe = v2.add(pos, v2.mul(d, 2.5));
        if (model.nav.walkableAt(probe) && !model.nav.isWaterAt(probe)) return d;
    }
    return null;
}

/** A spot behind an obstacle that shields the bot from `threat`, within `maxDist`, or null. */
export function findCover(model: WorldModel, threat: Vec2, maxDist = 12): Vec2 | null {
    const me = model.self.pos;
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const o of model.obstacles) {
        if (!o.blocksBullets || o.def.door) continue;
        const r = colliderRadius(o.col);
        if (r < 0.9 || r > 7) continue;
        const c = colliderCenter(o.col);
        const d = v2.distance(me, c);
        if (d > maxDist) continue;
        const away = v2.normalizeSafe(v2.sub(c, threat));
        const spot = v2.add(c, v2.mul(away, r * (o.col.type === 1 ? 0.75 : 1) + 1.5));
        if (!model.nav.walkableAt(spot)) continue;
        if (model.lineOfFire(threat, spot)) continue;
        // prefer close spots that do not make the bot walk towards the threat
        const towards = Math.max(0, v2.distance(threat, me) - v2.distance(threat, spot));
        const cost = v2.distance(me, spot) + towards * 1.5;
        if (cost < bestCost) {
            bestCost = cost;
            best = spot;
        }
    }
    return best;
}

/** The engagement against ctx.target. */
export function planFight(ctx: BrainCtx): Intent {
    const intent = emptyIntent("fight");
    const t = ctx.target;
    if (!t) return intent;
    const { self, model, mem, rng, now, params } = ctx;
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
    const info = gun.info;
    const reloading = self.action.type === "reload";
    const empty = gun.mag <= 0;
    if ((empty || reloading) && mem.useCover) {
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
            intent.goal = v2.copy(t.pos);
            intent.arriveDist = Math.max(6, info.idealMin);
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

/**
 * Lets a non-fight behaviour shoot back at the target while it moves (looting, rotating, regrouping): adds aim and
 * fire, and the slot to hold, when the target is visible and in reach.
 */
export function addCombatLayer(ctx: BrainCtx, intent: Intent): void {
    const t = ctx.target;
    if (!t?.visible || !ctx.armed) return;
    const d = ctx.targetDist;
    const slot = fightSlot(ctx.self, ctx.guns, d);
    if (slot === WeaponSlot.Melee) return;
    intent.slot = slot;
    intent.targetId = t.id;
    intent.aim = leadPoint(ctx, t);
    intent.fire = canShoot(ctx, t, d);
}

/** A grenade worth throwing now: at an enemy hiding behind cover or a group of enemies, within throwing range. */
export function grenadeOpportunity(ctx: BrainCtx, thinkDt: number): ThrowPlan | null {
    const { self, now, mem, params, rng } = ctx;
    if (now - mem.lastThrow < 6 || self.action.type !== "none") return null;
    const item = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    if (!item) return null;
    const t = ctx.target;
    if (!t) return null;
    const d = ctx.targetDist;
    // the frag's blast reaches 12 units (explosion_frag rad.max): never closer than 10
    if (d < 10 || d > 27) return null;
    const hiding = !t.visible && now - t.lastSeen < 2.5;
    const behindCover = t.visible && !ctx.model.lineOfFire(self.pos, t.pos);
    let cluster = 0;
    for (const e of ctx.enemies) if (e !== t && e.visible && v2.distance(e.pos, t.pos) < 6) cluster++;
    if (!hiding && !behindCover && cluster === 0 && !t.downed) return null;
    // a group, or an enemy camping behind its cover, is the best moment for a grenade
    const camping = v2.length(t.vel) < 2 && (hiding || behindCover);
    const boost = (cluster > 0 ? 2 : 1) * (camping ? 2 : 1);
    if (!rng.bool(Math.min(1, params.grenadeRate * thinkDt * boost))) return null;
    mem.lastThrow = now;
    mem.lastThrowPos = v2.copy(t.pos);
    // lead a moving target a little (at most 3 units: velocity estimates are noisy)
    let lead = v2.mul(t.vel, 0.6);
    if (v2.length(lead) > 3) lead = v2.mul(v2.normalize(lead), 3);
    return { item, pos: v2.add(t.pos, lead), cook: rng.range(1.2, 2.2) };
}

/** Whether the bot holds a usable gun in its hands (loaded or with reserve). */
export function holdsUsableGun(ctx: BrainCtx): boolean {
    const g = currentGun(ctx.self, ctx.guns);
    return !!g && hasAmmo(g) && !!gunInfo(g.info.id);
}
