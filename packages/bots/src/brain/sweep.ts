// House clearing (BrainFeatures.sweep, bot overhaul LOOT-6, user report 6 "they don't clear houses: grab one item and
// leave"): once inside a building (one of its ceiling zoomIn regions, the roof lifted), the bot walks it room by room
// (waypoints spread over every zoomIn region, at most 8, nearest first) while the loot and break behaviours take what
// it finds; furniture in the building it sweeps is worth breaking even with a full loadout (from a thoroughness of 0.5:
// rushers skip it). The building counts as visited (explore moves on) only when the sweep is done. Exploring weighs
// buildings by their loot potential (containers and loot spawns in their def) so houses, barns and warehouses come
// before shipping containers and outhouses (pistol-keeping RC7: 44 of 101 explore spots on seed 1 were containers).
// Everything here is what a player sees once inside (the roof lifts over the whole building: perception/roofs.ts).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import { obstacleDef, pointInBounds } from "../geom.ts";
import { roofRegions } from "../perception/roofs.ts";
import type { WorldModel } from "../perception/world.ts";
import { byThoroughness } from "../persona.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { avoidPos } from "./danger.ts";
import { underThreat } from "./lootRisk.ts";

/** Utility of sweeping (NEUTRAL; persona-scaled): above exploring, below looting an item. */
const SWEEP_SCORE = 0.2;
/** Furniture in the building being swept scores at least this (above SWEEP_SCORE), from a thoroughness of 0.5. */
export const SWEEP_FURNITURE = 0.21;
/** Waypoints per building at most, their spacing at least, and their inset from the region's walls. */
const MAX_POINTS = 8;
const MIN_SPACING = 7;
const INSET = 2;
/** A waypoint counts as visited this close; one not reached within NOT_REACHED seconds of sweeping is dropped. */
const VISITED = 2.5;
const NOT_REACHED = 8;
/** The sweep is left once the bot is this far from the building (fled, chased off, called away). */
const LEAVE = 30;

const regionCache = new WeakMap<WorldModel, Map<number, Bounds[]>>();

function regionsOf(model: WorldModel): Array<{ id: number; regions: Bounds[] }> {
    let cache = regionCache.get(model);
    if (!cache) {
        cache = new Map();
        regionCache.set(model, cache);
    }
    return roofRegions(model.buildings, cache);
}

/** The building (with a standing roof) whose zoomIn region the bot stands in, or null. */
function buildingAt(model: WorldModel, p: Vec2): { id: number; regions: Bounds[] } | null {
    for (const r of regionsOf(model)) if (r.regions.some((b) => pointInBounds(p, b))) return r;
    return null;
}

/** Waypoints over the building's zoomIn regions: a grid of at most MAX_POINTS, walkable and reachable. */
function waypoints(ctx: BrainCtx, regions: readonly Bounds[]): Vec2[] {
    const area = regions.reduce((a, b) => a + (b.max.x - b.min.x) * (b.max.y - b.min.y), 0);
    const spacing = Math.max(MIN_SPACING, Math.sqrt(area / MAX_POINTS));
    const out: Vec2[] = [];
    for (const b of regions) {
        const w = b.max.x - b.min.x - 2 * INSET;
        const h = b.max.y - b.min.y - 2 * INSET;
        const nx = Math.max(1, Math.round(w / spacing));
        const ny = Math.max(1, Math.round(h / spacing));
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                const p = { x: b.min.x + INSET + ((i + 0.5) * w) / nx, y: b.min.y + INSET + ((j + 0.5) * h) / ny };
                const cell = ctx.model.nav.nearestWalkable(p, 2, ctx.myComp);
                if (cell < 0) continue;
                const spot = ctx.model.nav.center(cell);
                if (!pointInBounds(spot, b) || !reachable(ctx, spot, 1)) continue;
                if (out.some((q) => v2.distance(q, spot) < MIN_SPACING * 0.6)) continue;
                out.push(spot);
            }
        }
    }
    return out.slice(0, MAX_POINTS);
}

/** Whether `p` lies in the building the bot is sweeping (its furniture is worth breaking: scavenge.ts). */
export function inSweptBuilding(ctx: BrainCtx, p: Vec2): boolean {
    const lm = ctx.mem.loot2;
    if (!ctx.features.sweep || lm.sweepId === 0) return false;
    const r = regionsOf(ctx.model).find((x) => x.id === lm.sweepId);
    return !!r && r.regions.some((b) => pointInBounds(p, b));
}

/** Whether building `id` is being swept with waypoints left (explore does not mark it visited yet). */
export function sweepPending(ctx: BrainCtx, id: number): boolean {
    const lm = ctx.mem.loot2;
    return ctx.features.sweep && lm.sweepId === id && lm.sweepPoints.length > 0;
}

function finish(ctx: BrainCtx, id: number): void {
    const lm = ctx.mem.loot2;
    lm.swept.add(id);
    ctx.mem.visited.add(id);
    lm.sweepId = 0;
    lm.sweepPoints = [];
}

/** Utility of sweeping the building the bot is in (0 when there is none, it is done, or an enemy threatens). */
export function sweepScore(ctx: BrainCtx): number {
    const { model, self, now } = ctx;
    const lm = ctx.mem.loot2;
    const here = buildingAt(model, self.pos);
    if (here && here.id !== lm.sweepId && !lm.swept.has(here.id)) {
        lm.sweepId = here.id;
        lm.sweepPoints = waypoints(ctx, here.regions);
        lm.sweepPointSince = now;
        lm.sweepWalked = 0;
    }
    if (lm.sweepId === 0) return 0;
    const sweeping = regionsOf(model).find((r) => r.id === lm.sweepId);
    if (!sweeping || sweeping.regions.every((b) => distToBounds(self.pos, b) > LEAVE)) {
        // gone (its roof broke) or the bot was taken away: let it go unfinished (explore may bring it back)
        lm.sweepId = 0;
        lm.sweepPoints = [];
        return 0;
    }
    // visited, failed or not reached in time: off the list (the time counts only while the bot sweeps: furniture and
    // loot on the way used to time the next waypoint out, so a room was skipped, LOOT2)
    const dt = Math.min(0.5, Math.max(0, now - lm.sweepPointSince));
    lm.sweepPointSince = now;
    if (ctx.mem.current === "sweep") lm.sweepWalked += dt;
    const first = lm.sweepPoints[0];
    lm.sweepPoints = lm.sweepPoints.filter((p) => v2.distance(p, self.pos) > VISITED && !nearFailedGoal(ctx, p));
    if (first && lm.sweepPoints[0] === first && lm.sweepWalked > NOT_REACHED) lm.sweepPoints.shift();
    if (lm.sweepPoints[0] !== first) lm.sweepWalked = 0;
    if (lm.sweepPoints.length === 0) {
        finish(ctx, lm.sweepId);
        return 0;
    }
    if (underThreat(ctx)) return 0;
    // danger memory: the house it was just chased out of waits (evaluation F7: sweeping walked bots straight back)
    if (avoidPos(ctx, lm.sweepPoints[0])) return 0;
    return byThoroughness(ctx.persona, SWEEP_SCORE, 0.8);
}

function distToBounds(p: Vec2, b: Bounds): number {
    const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
    const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
    return Math.hypot(dx, dy);
}

/** Walks to the nearest waypoint left (the list is kept nearest first). */
export function planSweep(ctx: BrainCtx): Intent {
    const intent = emptyIntent("sweep");
    const lm = ctx.mem.loot2;
    const me = ctx.self.pos;
    lm.sweepPoints.sort((a, b) => v2.distance(a, me) - v2.distance(b, me));
    const next = lm.sweepPoints[0];
    if (next) {
        intent.goal = v2.copy(next);
        intent.arriveDist = 1.5;
    }
    addCombatLayer(ctx, intent);
    return intent;
}

const potentialCache = new Map<string, number>();

/**
 * Loot potential of a building type (0..10): its loot containers plus 1.5 per loot spawn among its def's map objects
 * (a random choice counts by its first option). A red house holds ~4-5 pieces of furniture, a warehouse ~10 crates, a
 * shipping container 2 loot spawns, an outhouse 1 toilet.
 */
export function buildingPotential(type: string): number {
    let p = potentialCache.get(type);
    if (p !== undefined) return p;
    p = 0;
    if (hasMapObjectDef(type)) {
        const def = getMapObjectDef(type);
        if (def.type === "building") {
            for (const child of (def as { mapObjects?: Array<{ type: string | Record<string, number> }> }).mapObjects ??
                []) {
                const t = typeof child.type === "string" ? child.type : (Object.keys(child.type)[0] ?? "");
                if (t.startsWith("loot_tier")) {
                    p += 1.5;
                    continue;
                }
                const o = obstacleDef(t);
                if (o?.destructible && o.loot.length > 0 && !o.explosion && !o.armorPlated) p += 1;
            }
        }
    }
    p = Math.min(10, p);
    potentialCache.set(type, p);
    return p;
}
