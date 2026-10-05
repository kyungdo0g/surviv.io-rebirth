// Looting and exploring: the most valuable remembered item weighed by distance (weapons first while unarmed), walking
// onto it and picking it up with Input.Loot (switching to the weaker gun first when both gun slots are full so the
// pickup replaces it), and otherwise walking from building to building inside the safe zone, where the loot is.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, getMapObjectDef, hasDef, hasMapObjectDef, Input } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";
import { colliderBounds, transformCollider } from "../geom.ts";
import { lootValue, slotToReplace } from "../knowledge/loot.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import type { SeenLoot } from "../perception/world.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, reachable } from "./context.ts";
import { onTheWay } from "./survival.ts";

const LOOT_RADIUS = GameConfig.lootRadius as Readonly<Record<string, number>>;
const MAX_LOOT_DIST = 70;

export interface LootChoice {
    loot: SeenLoot;
    value: number;
    dist: number;
}

function lootRad(type: string): number {
    if (!hasDef(type)) return 1;
    return LOOT_RADIUS[GameObjectDefs[type].type] ?? 1;
}

function nearFailedGoal(ctx: BrainCtx, p: Vec2): boolean {
    const f = ctx.mem.failedGoal;
    return !!f && ctx.now < ctx.mem.failedUntil && v2.distance(f, p) < 2;
}

/** The item most worth walking to, or null. */
export function bestLoot(ctx: BrainCtx): LootChoice | null {
    const { model, self, mem, now } = ctx;
    let best: LootChoice | null = null;
    let bestScore = 0;
    for (const l of model.loot.values()) {
        if ((l.layer & 1) !== 0) continue;
        const until = mem.lootBlacklist.get(l.id);
        if (until !== undefined) {
            if (until > now) continue;
            mem.lootBlacklist.delete(l.id);
        }
        const d = v2.distance(self.pos, l.pos);
        if (d > MAX_LOOT_DIST || !model.insideCurrentCircle(l.pos, 2) || nearFailedGoal(ctx, l.pos)) continue;
        if (!onTheWay(model, l.pos)) continue;
        const value = lootValue(self, l.type);
        if (value < 6) continue;
        if (!reachable(ctx, l.pos, 1.4)) {
            mem.lootBlacklist.set(l.id, now + 20);
            continue;
        }
        let s = value / (1 + d / 14);
        if (l.id === mem.lootTarget) s *= 1.3;
        if (s > bestScore) {
            bestScore = s;
            best = { loot: l, value, dist: d };
        }
    }
    return best;
}

export function lootScore(ctx: BrainCtx, choice: LootChoice | null): number {
    if (!choice) return 0;
    let s = 0.22 + 0.5 * (choice.value / 100) * (choice.dist < 20 ? 1 : 20 / choice.dist + 0.2);
    if (!ctx.armed && gunInfo(choice.loot.type)) s = Math.max(s, 0.7);
    if (ctx.visibleEnemies.some((e) => !e.downed) && ctx.armed) s *= 0.5;
    return Math.min(0.75, s);
}

export function planLoot(ctx: BrainCtx, choice: LootChoice): Intent {
    const intent = emptyIntent("loot");
    const { self, mem, now } = ctx;
    const l = choice.loot;
    mem.lootTarget = l.id;
    intent.goal = v2.copy(l.pos);
    intent.arriveDist = 0.6;
    const pickR = 1 + lootRad(l.type) - 0.3;
    if (choice.dist < pickR) {
        // in reach: Loot takes the closest item, no need to stand on it (items often rest against obstacles)
        intent.stop = true;
        const isGun = !!gunInfo(l.type);
        const replace = isGun ? slotToReplace(self) : null;
        const sameType = self.weapons.some((w) => w.type === l.type);
        if (replace !== null && !sameType && self.curWeapIdx !== replace) {
            intent.slot = replace;
        } else if (now - mem.lastLootRequest > 0.3) {
            mem.lastLootRequest = now;
            intent.actions.push(Input.Loot);
            if (mem.lootAttemptId !== l.id) {
                mem.lootAttemptId = l.id;
                mem.lootAttemptAt = now;
            } else if (now - mem.lootAttemptAt > 1.5) {
                // still there after several tries: refused (full bag, better gear) or out of reach
                mem.lootBlacklist.set(l.id, now + 30);
            }
        }
    }
    addCombatLayer(ctx, intent);
    return intent;
}

interface BuildingSpot {
    id: number;
    pos: Vec2;
}

const buildingCache = new WeakMap<MapData, BuildingSpot[]>();

/** Ground-floor buildings with an interior (a ceiling zoom region), at the centre of their interior. */
export function buildingSpots(map: MapData): BuildingSpot[] {
    let spots = buildingCache.get(map);
    if (spots) return spots;
    spots = [];
    for (const o of map.objects) {
        if (o.layer !== 0 || !hasMapObjectDef(o.type)) continue;
        const def = getMapObjectDef(o.type);
        if (def.type !== "building") continue;
        const zone = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn;
        if (!zone) continue;
        const b = colliderBounds(transformCollider(zone, o.pos, o.ori, o.scale));
        spots.push({ id: o.id, pos: { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 } });
    }
    buildingCache.set(map, spots);
    return spots;
}

function pickExploreGoal(ctx: BrainCtx): Vec2 {
    const { model, self, mem, rng } = ctx;
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const b of buildingSpots(model.map)) {
        if (mem.visited.has(b.id)) continue;
        const d = v2.distance(self.pos, b.pos);
        if (d < 6) {
            mem.visited.add(b.id);
            continue;
        }
        if (d > 240 || !model.insideSafeZone(b.pos, 5) || nearFailedGoal(ctx, b.pos)) continue;
        const cost = d + rng.range(0, 40);
        if (cost < bestCost) {
            bestCost = cost;
            best = b.pos;
        }
    }
    if (best) {
        const cell = model.nav.nearestWalkable(best, 6, ctx.myComp);
        if (cell >= 0) return model.nav.center(cell);
        mem.failedGoal = v2.copy(best);
        mem.failedUntil = ctx.now + 30;
    }
    // nothing left to search nearby: wander inside the safe zone
    for (let i = 0; i < 12; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const p = v2.add(self.pos, v2.mul({ x: Math.cos(angle), y: Math.sin(angle) }, rng.range(25, 70)));
        if (!model.insideSafeZone(p, 5)) continue;
        const cell = model.nav.nearestWalkable(p, 6, ctx.myComp);
        if (cell >= 0 && !model.nav.isWaterAt(p)) return model.nav.center(cell);
    }
    return model.gas && model.gas.mode !== "inactive" ? v2.copy(model.gas.posNew) : v2.copy(self.pos);
}

export function planExplore(ctx: BrainCtx): Intent {
    const intent = emptyIntent("explore");
    const { self, mem, now } = ctx;
    const g = mem.exploreGoal;
    const stale = !g || now > mem.exploreUntil || v2.distance(self.pos, g) < 4 || nearFailedGoal(ctx, g);
    if (stale || !g || !ctx.model.insideSafeZone(g, 3)) {
        mem.exploreGoal = pickExploreGoal(ctx);
        mem.exploreUntil = now + 30;
    }
    intent.goal = mem.exploreGoal;
    intent.arriveDist = 2;
    addCombatLayer(ctx, intent);
    return intent;
}
