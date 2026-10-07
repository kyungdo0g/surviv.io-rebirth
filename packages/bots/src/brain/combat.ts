// Fighting basics: target selection, target leading, the shooting check (reaction, range, line of fire), free
// directions and cover spots, and the "combat layer" that lets other behaviours shoot back while moving. The
// engagement itself is brain/tactics.ts, grenades brain/grenades.ts. The bot only uses contacts from its own
// snapshots.
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius } from "../geom.ts";
import { currentGun, fightSlot, hasAmmo } from "../knowledge/arsenal.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import type { Contact, SeenObstacle, WorldModel } from "../perception/world.ts";
import { holdFire } from "./assess.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { opportunityMult } from "./opportunity.ts";
import { focusMult } from "./teamplay.ts";

export const MELEE_REACH = 2.4;
export const FRAG_TYPES = ["frag", "mirv"];

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
        // smart brain: punish busy or weakened enemies, shoot the one the team is shooting
        if (ctx.features.opportunism) s *= opportunityMult(ctx, c);
        if (ctx.features.teamplay) s *= focusMult(ctx, c);
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
    return findCoverFrom(model, model.self.pos, threat, maxDist);
}

/** Centre and rough radius of an obstacle's collider (cached per seen obstacle: the model reuses unchanged ones). */
export interface ObstacleGeom {
    c: Vec2;
    r: number;
}

const geomCache = new WeakMap<SeenObstacle, ObstacleGeom>();

export function obstacleGeom(o: SeenObstacle): ObstacleGeom {
    let g = geomCache.get(o);
    if (!g) {
        g = { c: colliderCenter(o.col), r: colliderRadius(o.col) };
        geomCache.set(o, g);
    }
    return g;
}

interface CoverCandidate {
    c: Vec2;
    r: number;
    box: boolean;
}

const coverLists = new WeakMap<WorldModel, { src: SeenObstacle[]; len: number; cands: CoverCandidate[] }>();

/**
 * Obstacles in view that can serve as cover (bullet-stopping, no doors, radius 0.9..7), in the model's order, with
 * their centre and radius: built once per snapshot (the model replaces its obstacle list with every snapshot).
 */
function coverCandidates(model: WorldModel): CoverCandidate[] {
    const e = coverLists.get(model);
    if (e && e.src === model.obstacles && e.len === model.obstacles.length) return e.cands;
    const cands: CoverCandidate[] = [];
    for (const o of model.obstacles) {
        if (!o.blocksBullets || o.def.door) continue;
        const { c, r } = obstacleGeom(o);
        if (r < 0.9 || r > 7) continue;
        cands.push({ c, r, box: o.col.type === 1 });
    }
    coverLists.set(model, { src: model.obstacles, len: model.obstacles.length, cands });
    return cands;
}

/**
 * A spot behind an obstacle that shields from `threat`, within `maxDist` of `from`, or null. `accept` filters the
 * candidate spots (default: all).
 */
export function findCoverFrom(
    model: WorldModel,
    from: Vec2,
    threat: Vec2,
    maxDist: number,
    accept?: (spot: Vec2) => boolean,
): Vec2 | null {
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const { c, r, box } of coverCandidates(model)) {
        if (v2.distance(from, c) > maxDist) continue;
        const away = v2.normalizeSafe(v2.sub(c, threat));
        const raw = v2.add(c, v2.mul(away, r * (box ? 0.75 : 1) + 1.5));
        if (!model.nav.walkableAt(raw)) continue;
        // the centre of its navigation cell: a player can stand there (the raw spot can sit closer to the obstacle
        // than the player's radius, and a goal no one can reach only piles up path follower stuck events)
        const spot = model.nav.center(model.nav.nearestWalkable(raw, 1));
        if (model.lineOfFire(threat, spot)) continue;
        if (accept && !accept(spot)) continue;
        // prefer close spots that do not make the bot walk towards the threat
        const towards = Math.max(0, v2.distance(threat, from) - v2.distance(threat, spot));
        const cost = v2.distance(from, spot) + towards * 1.5;
        if (cost < bestCost) {
            bestCost = cost;
            best = spot;
        }
    }
    return best;
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
    // (canShoot first: it draws the reaction time of a new target)
    intent.fire = canShoot(ctx, t, d) && !holdFire(ctx, t, d);
}

/** Whether the bot holds a usable gun in its hands (loaded or with reserve). */
export function holdsUsableGun(ctx: BrainCtx): boolean {
    const g = currentGun(ctx.self, ctx.guns);
    return !!g && hasAmmo(g) && !!gunInfo(g.info.id);
}
