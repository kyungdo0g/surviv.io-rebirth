// Keeping out of a building about to cave in (BrainFeatures.collapseAware; the owner's wave 3, 2026-10-10: the gas
// station's store and the church collapse once enough of their brick shell is broken, killing everyone inside; sim
// world/collapse.ts, knowledge/collapse.ts). Only what a player sees: the brick shell walls the bot has had on its
// screen broken (a wall shot to pieces leaves a gap) or badly damaged (it shrinks as it takes damage, ObstacleView
// healthT), counted against the def's wallCount, which the client ships. A building with at most NEAR_LEFT walls to go
// by that count is "near collapse":
// - goals on its floor are avoided (danger.ts avoidPos: loot, containers, explore and sweep goals there are left);
// - a bot standing on its floor walks out (leaveCollapse, after the decision): the nearest reachable spot outside,
//   keeping its aim and fire (it may be fighting on the way out);
// - nobody breaks another of its shell walls on the way (brain/breakThrough.ts).
// A collapsed building (its roof dead on the wire, BuildingView.ceilingDead) is rubble: no danger left.
import { type Vec2, v2 } from "@rebirth/core";
import { type CollapseSite, collapseSites, onCollapseFloor } from "../knowledge/collapse.ts";
import type { WorldModel } from "../perception/world.ts";
import { type BrainCtx, type Intent, reachable } from "./context.ts";

/** A building this many load-bearing walls (or fewer) from caving in, by what the bot saw, is near collapse. */
export const NEAR_LEFT = 2;
/** A shell wall shown below this much of its health counts as half broken (it shrinks and cracks as it is shot). */
const DAMAGED = 0.35;
/** Exit spots are looked for this far outside the floor, every EXIT_STEP along its edge. */
const EXIT_OUT = 3;
const EXIT_STEP = 2;
/** Feet on the floor's edge count as on it (a body in the doorway is buried too). */
const EDGE = 1;

interface Seen {
    /** wall id -> how broken the bot saw it (1 broken, 0.5 badly damaged) */
    walls: Map<number, number>;
    /** collapsed building ids (roof dead on the wire) */
    gone: Set<number>;
}

const memory = new WeakMap<WorldModel, Seen>();

function seenOf(model: WorldModel): Seen {
    let s = memory.get(model);
    if (!s) {
        s = { walls: new Map(), gone: new Set() };
        memory.set(model, s);
    }
    return s;
}

/** Notes the shell walls on the bot's screen and the collapsed roofs of its latest snapshot (once per think). */
export function noteCollapse(ctx: BrainCtx): void {
    const sites = collapseSites(ctx.model.map);
    if (!sites.length) return;
    const s = seenOf(ctx.model);
    for (const site of sites) {
        if (s.gone.has(site.id)) continue;
        for (const id of site.walls) {
            const o = ctx.model.obstacleById.get(id);
            if (!o || !ctx.model.onScreen(o.view.pos)) continue;
            const w = o.view.dead ? 1 : o.view.healthT < DAMAGED ? 0.5 : 0;
            if (w > (s.walls.get(id) ?? 0)) s.walls.set(id, w);
        }
    }
    for (const b of ctx.model.buildings) if (b.ceilingDead) s.gone.add(b.id);
}

/** Load-bearing walls left before `site` caves in, by what the bot saw (Infinity once it has collapsed). */
export function wallsLeft(model: WorldModel, site: CollapseSite): number {
    const s = seenOf(model);
    if (s.gone.has(site.id)) return Number.POSITIVE_INFINITY;
    let broken = 0;
    for (const id of site.walls) broken += s.walls.get(id) ?? 0;
    return site.wallCount - broken;
}

/** Whether `site` is near collapse by what the bot saw. */
export function nearCollapse(model: WorldModel, site: CollapseSite): boolean {
    return wallsLeft(model, site) <= NEAR_LEFT;
}

/** The near-collapse building whose floor holds `p` on `layer`, or null. */
export function collapseAt(ctx: BrainCtx, p: Vec2, layer = ctx.self.layer): CollapseSite | null {
    if (!ctx.features.collapseAware) return null;
    for (const site of collapseSites(ctx.model.map)) {
        if (onCollapseFloor(site, p, layer, EDGE) && nearCollapse(ctx.model, site)) return site;
    }
    return null;
}

/**
 * Whether breaking load-bearing wall `id` would bring its building near collapse (or down) by what the bot saw: the
 * bot goes round instead (brain/breakThrough.ts). False for every other obstacle.
 */
export function shellBreakRisky(ctx: BrainCtx, id: number): boolean {
    if (!ctx.features.collapseAware) return false;
    const site = collapseSites(ctx.model.map).find((s) => s.walls.includes(id));
    return !!site && wallsLeft(ctx.model, site) - 1 <= NEAR_LEFT;
}

/** The nearest reachable spot just outside the site's floor, or null. */
function exitSpot(ctx: BrainCtx, site: CollapseSite): Vec2 | null {
    const me = ctx.self.pos;
    const spots: Vec2[] = [];
    for (const b of site.floor) {
        const x0 = b.min.x - EXIT_OUT;
        const x1 = b.max.x + EXIT_OUT;
        const y0 = b.min.y - EXIT_OUT;
        const y1 = b.max.y + EXIT_OUT;
        for (let x = x0; x <= x1; x += EXIT_STEP) spots.push({ x, y: y0 }, { x, y: y1 });
        for (let y = y0; y <= y1; y += EXIT_STEP) spots.push({ x: x0, y }, { x: x1, y });
    }
    spots.sort((a, b) => v2.distance(a, me) - v2.distance(b, me));
    for (const p of spots) {
        if (onCollapseFloor(site, p, site.layer, EDGE)) continue;
        const cell = ctx.model.nav.nearestWalkable(p, 1);
        if (cell < 0) continue;
        const q = ctx.model.nav.center(cell);
        if (!onCollapseFloor(site, q, site.layer, EDGE) && reachable(ctx, q, 1)) return q;
    }
    return null;
}

/**
 * After the decision: a bot on the floor of a building near collapse walks out of it (the nearest reachable spot
 * outside), keeping its aim, fire and throws; a dodge in progress (urgent) is left alone. True when it took over.
 */
export function leaveCollapse(ctx: BrainCtx, intent: Intent): boolean {
    if (!ctx.features.collapseAware || intent.urgent) return false;
    const site = collapseAt(ctx, ctx.self.pos);
    if (!site) return false;
    if (intent.goal && !collapseAt(ctx, intent.goal) && !intent.moveDir && !intent.stop) return false;
    const out = exitSpot(ctx, site);
    if (!out) return false;
    intent.goal = out;
    intent.goalLayer = undefined;
    intent.arriveDist = 1;
    intent.moveDir = null;
    intent.stop = false;
    return true;
}
