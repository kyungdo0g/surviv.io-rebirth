// Breaking loot containers: most loot outside buildings sits in crates (and in furniture inside them) that must be
// destroyed first. The bot walks up to the nearest worthwhile container it can see and punches it (or shoots it when
// it carries plenty of ammo), then the loot behaviour picks up what drops. Explosive barrels are left alone.
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { colliderCenter, colliderRadius, distanceToCollider } from "../geom.ts";
import type { SeenObstacle } from "../perception/world.ts";
import { addCombatLayer } from "./combat.ts";
import { onTheWay } from "./survival.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable } from "./context.ts";

/** Containers farther than this are not worth a detour. */
const MAX_DIST = 26;
/** Melee reach from the player centre to the obstacle surface (fists: offset 1.35 + radius 0.9, minus slack). */
const PUNCH_DIST = 1.8;
/** Give up on a container after this long. */
const BREAK_TIMEOUT = 8;

/** Rough worth of a container's loot table (0..100). */
function containerValue(o: SeenObstacle): number {
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
        if (!breakable(o) || (o.view.layer & 1) !== 0) continue;
        const until = mem.lootBlacklist.get(o.view.id);
        if (until !== undefined && until > now) continue;
        const d = distanceToCollider(self.pos, o.col);
        if (d > MAX_DIST || !model.insideCurrentCircle(colliderCenter(o.col), 2)) continue;
        if (!onTheWay(model, colliderCenter(o.col))) continue;
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

export function breakScore(ctx: BrainCtx, choice: BreakChoice | null): number {
    if (!choice) return 0;
    const unarmed = !ctx.armed;
    let s = 0.16 + (choice.value / 100) * (unarmed ? 0.55 : 0.3) * (choice.dist < 6 ? 1 : 6 / choice.dist + 0.3);
    if (ctx.visibleEnemies.some((e) => !e.downed)) s *= 0.4;
    return Math.min(0.6, s);
}

/** The point next to the container to stand on: its surface towards the bot, pushed out by the punch distance. */
function standPoint(ctx: BrainCtx, o: SeenObstacle): Vec2 {
    const me = ctx.self.pos;
    const c = colliderCenter(o.col);
    const out = v2.normalizeSafe(v2.sub(me, c));
    const col = o.col;
    let surface: Vec2;
    if (col.type === 0) surface = v2.add(col.pos, v2.mul(out, col.rad));
    else surface = { x: Math.min(Math.max(me.x, col.min.x), col.max.x), y: Math.min(Math.max(me.y, col.min.y), col.max.y) };
    const p = v2.add(surface, v2.mul(out, 1.3));
    const cell = ctx.model.nav.nearestWalkable(p, 3, ctx.myComp);
    return cell >= 0 ? ctx.model.nav.center(cell) : p;
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
    // shooting crates costs ammo: only with plenty to spare, otherwise punch
    const rich = guns.find((g) => g.mag > 0 && g.reserve >= g.info.def.maxClip * 2 && g.info.cls !== "sniper");
    const shootRange = rich ? 7 : PUNCH_DIST;
    const target = colliderCenter(o.col);
    intent.aim = target;
    if (choice.dist <= shootRange) {
        intent.slot = rich ? rich.slot : WeaponSlot.Melee;
        intent.stop = true;
        intent.fire = self.curWeapIdx === intent.slot;
    } else {
        intent.goal = standPoint(ctx, o);
        intent.arriveDist = 0.4;
        intent.slot = rich ? rich.slot : WeaponSlot.Melee;
    }
    addCombatLayer(ctx, intent);
    return intent;
}
