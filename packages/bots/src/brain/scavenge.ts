// Breaking loot containers: most loot outside buildings sits in crates (and in furniture inside them) that must be
// destroyed first. The bot walks up to the nearest worthwhile container it can see and punches it (or shoots it when
// it carries plenty of ammo), then the loot behaviour picks up what drops. Explosive barrels are left alone.
import { type Vec2, v2 } from "@rebirth/core";
import { Input, WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius, distanceToCollider } from "../geom.ts";
import type { SeenObstacle } from "../perception/world.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable } from "./context.ts";
import { steadyGoal } from "./steady.ts";
import { onTheWay } from "./survival.ts";

/** Containers farther than this are not worth a detour. */
const MAX_DIST = 26;
/** Melee reach from the player centre to the obstacle surface (fists: offset 1.35 + radius 0.9, minus slack). */
const PUNCH_DIST = 2;
/** Closer than this, the bot walks straight at the container (the collision stops it within punching reach). */
const APPROACH_DIST = 4;
/** Give up on a container after this long. */
const BREAK_TIMEOUT = 8;

/** Rough worth of a container's loot table (0..100). */
function containerValue(o: SeenObstacle): number {
    // air drops hold the best loot of the match
    if (o.def.airdropCrate) return 80;
    const tiers = o.def.loot.map((l) => l.tier ?? l.type ?? "");
    if (tiers.some((t) => t === "tier_soviet" || t === "tier_chest" || t === "deagle" || t === "m870")) return 45;
    if (tiers.some((t) => t === "tier_world" || t === "tier_container" || t === "tier_toilet")) return 32;
    if (tiers.some((t) => t === "tier_throwables" || t.startsWith("tier_vending"))) return 18;
    if (tiers.some((t) => t.startsWith("tier_ammo"))) return 15;
    return 12;
}

function breakable(o: SeenObstacle): boolean {
    const d = o.def;
    return !o.view.dead && d.destructible && d.collidable && d.loot.length > 0 && !d.explosion && !d.door && !d.button;
}

/** A landed air drop crate that can still be opened (Interact / Use within its interaction radius). */
function openable(o: SeenObstacle): boolean {
    return !o.view.dead && !!o.def.airdropCrate && !!o.view.button?.canUse;
}

/** Whether a seen obstacle can still be broken open or opened (bestBreakable's filter). */
export function breakableNow(o: SeenObstacle): boolean {
    return (breakable(o) || openable(o)) && (o.view.layer & 1) === 0;
}

export interface BreakChoice {
    obstacle: SeenObstacle;
    value: number;
    dist: number;
}

export function bestBreakable(ctx: BrainCtx): BreakChoice | null {
    const { model, self, mem, now } = ctx;
    let best: BreakChoice | null = null;
    let bestScore = 0;
    for (const o of model.obstacles) {
        if (!(breakable(o) || openable(o)) || (o.view.layer & 1) !== 0) continue;
        const until = mem.lootBlacklist.get(o.view.id);
        if (until !== undefined && until > now) continue;
        const d = distanceToCollider(self.pos, o.col);
        if (d > MAX_DIST || !model.insideCurrentCircle(colliderCenter(o.col), 2)) continue;
        if (!onTheWay(model, colliderCenter(o.col))) continue;
        if (ctx.features.steady && !steadyGoal(ctx, colliderCenter(o.col))) continue;
        const value = containerValue(o);
        if (o.view.id !== mem.breakTarget && !reachable(ctx, colliderCenter(o.col), colliderRadius(o.col) + 1.8)) {
            mem.lootBlacklist.set(o.view.id, now + 30);
            continue;
        }
        let s = value / (1 + d / 10);
        if (o.view.id === mem.breakTarget) s *= 1.5;
        if (s > bestScore) {
            bestScore = s;
            best = { obstacle: o, value, dist: d };
        }
    }
    return best;
}

/**
 * How much the bot still needs loot (1 unarmed .. ~0.25 fully kitted): containers are worth less once it carries two
 * guns with ammo, armour and a backpack.
 */
export function lootNeed(ctx: BrainCtx): number {
    const { self, guns } = ctx;
    const loaded = guns.filter((g) => g.mag + g.reserve >= g.info.def.maxClip * 2).length;
    let need = 1;
    if (loaded >= 1) need -= 0.3;
    if (loaded >= 2) need -= 0.2;
    if (self.helmet && self.chest) need -= 0.15;
    if (self.backpack && self.backpack !== "backpack00") need -= 0.1;
    return Math.max(0.2, need);
}

export function breakScore(ctx: BrainCtx, choice: BreakChoice | null): number {
    if (!choice) return 0;
    const unarmed = !ctx.armed;
    const near = choice.dist < 6 ? 1 : 6 / choice.dist + 0.3;
    let s = (0.16 + (choice.value / 100) * (unarmed ? 0.55 : 0.3) * near) * lootNeed(ctx);
    if (ctx.visibleEnemies.some((e) => !e.downed)) s *= 0.4;
    // not worth a detour any more (well equipped): leave it to exploring
    return s < 0.14 ? 0 : Math.min(0.6, s);
}

/** Closest point of the container's collider to `p`. */
function closestPoint(o: SeenObstacle, p: Vec2): Vec2 {
    const col = o.col;
    if (col.type === 0) return v2.add(col.pos, v2.mul(v2.normalizeSafe(v2.sub(p, col.pos)), col.rad));
    return { x: Math.min(Math.max(p.x, col.min.x), col.max.x), y: Math.min(Math.max(p.y, col.min.y), col.max.y) };
}

/** A point just outside the container's surface towards `p`. */
function nearSurface(o: SeenObstacle, p: Vec2): Vec2 {
    const c = closestPoint(o, p);
    return v2.add(c, v2.mul(v2.normalizeSafe(v2.sub(p, c)), 0.3));
}

/** Distance from a container's centre to its surface along the unit direction `u` (box: its support function). */
function extentAlong(o: SeenObstacle, u: Vec2): number {
    const col = o.col;
    if (col.type === 0) return col.rad;
    return Math.abs(u.x) * (col.max.x - col.min.x) * 0.5 + Math.abs(u.y) * (col.max.y - col.min.y) * 0.5;
}

/**
 * The point to stand on to punch the container: of the eight spots 1.5 units off its surface around it, a walkable,
 * reachable one with nothing between it and the container (furniture and toilets stand in rooms: the spot outside the
 * room's wall is useless), the nearest to the bot (one it sees from where it stands first). Falls back to the surface
 * towards the bot, pushed out, when none qualifies.
 */
function standPoint(ctx: BrainCtx, o: SeenObstacle): Vec2 {
    const me = ctx.self.pos;
    const model = ctx.model;
    const c = colliderCenter(o.col);
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let k = 0; k < 8; k++) {
        const u = { x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) };
        const p = v2.add(c, v2.mul(u, extentAlong(o, u) + 1.5));
        if (!model.nav.walkableAt(p) || !reachable(ctx, p, 1)) continue;
        if (!model.lineOfFire(p, nearSurface(o, p))) continue;
        const cost = v2.distance(me, p) + (model.lineOfFire(me, p) ? 0 : 6);
        if (cost < bestCost) {
            bestCost = cost;
            best = p;
        }
    }
    if (best) return best;
    const out = v2.normalizeSafe(v2.sub(me, c));
    const col = o.col;
    let surface: Vec2;
    if (col.type === 0) surface = v2.add(col.pos, v2.mul(out, col.rad));
    else
        surface = {
            x: Math.min(Math.max(me.x, col.min.x), col.max.x),
            y: Math.min(Math.max(me.y, col.min.y), col.max.y),
        };
    const p = v2.add(surface, v2.mul(out, 1.3));
    const cell = model.nav.nearestWalkable(p, 3, ctx.myComp);
    return cell >= 0 ? model.nav.center(cell) : p;
}

export function planBreak(ctx: BrainCtx, choice: BreakChoice): Intent {
    const intent = emptyIntent("break");
    const { mem, now, self, guns } = ctx;
    const o = choice.obstacle;
    if (mem.breakTarget !== o.view.id) {
        mem.breakTarget = o.view.id;
        mem.breakStart = now;
    } else if (now - mem.breakStart > BREAK_TIMEOUT) {
        mem.lootBlacklist.set(o.view.id, now + 60);
    }
    const target = colliderCenter(o.col);
    intent.aim = target;
    if (openable(o)) {
        // air drop crates open with Use within their interaction radius
        const reach = (o.def.button?.interactionRad ?? 1) + 1 - 0.2;
        if (choice.dist < reach) {
            intent.stop = true;
            if (now - mem.lastUseObstacle > 0.5) {
                mem.lastUseObstacle = now;
                intent.actions.push(Input.Use);
            }
        } else {
            intent.goal = standPoint(ctx, o);
            intent.arriveDist = 0.4;
        }
        addCombatLayer(ctx, intent);
        return intent;
    }
    // shooting crates costs ammo: only with plenty to spare, otherwise punch
    const rich = guns.find((g) => g.mag > 0 && g.reserve >= g.info.def.maxClip * 2 && g.info.cls !== "sniper");
    const shootRange = rich ? 7 : PUNCH_DIST;
    intent.slot = rich ? rich.slot : WeaponSlot.Melee;
    // (a shot needs a clear line to the container: from behind a wall it only hits the wall)
    if (choice.dist <= shootRange && (!rich || ctx.model.lineOfFire(self.pos, nearSurface(o, self.pos)))) {
        intent.stop = true;
        intent.fire = self.curWeapIdx === intent.slot;
    } else if (choice.dist < APPROACH_DIST && ctx.model.lineOfFire(self.pos, nearSurface(o, self.pos))) {
        // (the line to the container's centre always crosses the container itself: check the way to its surface)
        intent.moveDir = v2.normalizeSafe(v2.sub(closestPoint(o, self.pos), self.pos));
    } else {
        intent.goal = standPoint(ctx, o);
        intent.arriveDist = 0.8;
    }
    addCombatLayer(ctx, intent);
    return intent;
}
