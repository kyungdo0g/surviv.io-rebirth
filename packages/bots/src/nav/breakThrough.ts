// Breaking through what blocks the way (owner requests 2026-10-09/10: "inside a building, when a crate, furniture or a
// breakable wall blocks the route, break it and walk through instead of turning back or getting stuck"; and the house
// rule real players follow: everyone breaks the couch across the Crimson Ring club's passage, the mansion's interior
// panels in front of its rooms, the police station's red-blue-red rounded interior walls and the greenhouse glass;
// a share of players also punches or shoots straight through any glass wall instead of going round to a door).
// Map knowledge, as a player has it: the navigation grid marks the stamps of such obstacles with a break class
// (breakClassOf), and A* (astar.ts PathOptions.breakMask) crosses cells blocked only by obstacles of the classes the
// bot breaks at BREAK_STEP more per cell than open ground, so it breaks through where that is shorter than the way
// round. Outdoors crates, barrels and furniture are walked around as before. Acting stays fair: the follower reports
// an obstacle on the way only once the bot sees it in its snapshot (blockerAhead), and the brain breaks it
// (brain/breakThrough.ts). Explosive obstacles (barrels) are never punched through: the blast would hurt the bot.
import { type Vec2, v2 } from "@rebirth/core";
import type { ObstacleDef } from "@rebirth/defs";
import { distanceToCollider } from "../geom.ts";
import type { WorldModel } from "../perception/world.ts";
import type { CellGrid } from "./cellGrid.ts";

/** Break classes: 1 the house rule and anything breakable indoors, 2 glass walls elsewhere (BreakClass bits = 1 << (class - 1)). */
export const BreakClass = { None: 0, HouseRule: 1, Glass: 2 } as const;
export const BREAK_BITS = { HouseRule: 1, Glass: 2 } as const;
/** Extra cost of crossing one cell blocked by a breakable obstacle (about the time to break it, in units walked). */
export const BREAK_STEP = 5;
/** A* node budget for a goal behind breakable obstacles (another component of the grid). */
export const CROSS_EXPAND = 5000;
/** Obstacles with more health than this are not broken through (a 5000-HP glass wall, bollards, containers). */
const MAX_HEALTH = 300;
/** Obstacle types every player breaks through (the house rule), wherever they stand. */
const HOUSE_RULE = /^(couch_\d|police_wall_int_|mansion_wall_int_|club_wall_int_|glass_wall_10$)/;
/** Where the path follower asks for the bot's break classes and reports the obstacle on its way (brain/breakThrough.ts). */
export interface BlockerSink {
    breakMask(): number;
    /** reports the obstacle on the way; true while the bot breaks it (or is about to): no stuck check against it */
    blockerAhead(id: number, now: number): boolean;
}

/** An obstacle on the way this close ahead (along the path) is reported to the brain. */
const AHEAD = 4;

/**
 * The break class of an obstacle for routing: the house rule's types, and indoors (`indoor`: under a building's roof)
 * any destructible obstacle up to MAX_HEALTH; glass walls elsewhere; nothing for the rest, explosive ones included.
 * Doors are not here: usable ones open, the rest are sealed walls (cellGrid.ts). Nor obstacles only explosions damage
 * (`explosionGate`).
 */
export function breakClassOf(def: ObstacleDef, type: string, indoor: boolean): number {
    if (!def.destructible || def.explosion || def.health > MAX_HEALTH || def.door || def.armorPlated) return 0;
    // only explosions damage an obstacle with an explosion gate (the clone's next wave: blast doors, subway gates):
    // fists never break it (a launcher holder could; not yet). Read defensively: not in the defs types yet.
    if ((def as ObstacleDef & { explosionGate?: unknown }).explosionGate) return 0;
    if (HOUSE_RULE.test(type) || indoor) return BreakClass.HouseRule;
    return def.material === "glass" ? BreakClass.Glass : BreakClass.None;
}

/** Whether cell `i` is blocked only by breakable obstacles of the classes in `mask` (bits: BREAK_BITS). */
export function breakableCell(grid: CellGrid, i: number, mask: number): boolean {
    const b = grid.blocked[i];
    if (b === 0 || b >= 254) return false;
    const n = (mask & 1 ? grid.brk[0][i] : 0) + (mask & 2 ? grid.brk[1][i] : 0);
    return n >= b;
}

/**
 * The obstacle in the bot's way along the plan `points` from waypoint `idx`: the first cell within AHEAD of the bot
 * that is blocked only by breakable obstacles of `mask`, and the seen obstacle (in the snapshot, standing, breakable,
 * on the bot's floor) that blocks it. 0 when the way ahead is open or the obstacle is not in view yet.
 */
export function blockerAhead(
    model: WorldModel,
    grid: CellGrid,
    pos: Vec2,
    points: readonly Vec2[],
    idx: number,
    mask: number,
): number {
    if (!mask || model.self.layer !== 0) return 0;
    let from = pos;
    let left = AHEAD;
    for (let k = idx; k < points.length && left > 0; k++) {
        const to = points[k];
        const len = v2.distance(from, to);
        const steps = Math.max(1, Math.ceil(Math.min(len, left) / (grid.cellSize * 0.5)));
        for (let s = 1; s <= steps; s++) {
            const p = v2.lerp(Math.min(1, (s * grid.cellSize * 0.5) / Math.max(len, 1e-6)), from, to);
            if (!grid.covers(p)) return 0;
            const c = grid.cellOf(p);
            if (grid.blocked[c] === 0 || grid.tight[c] !== 0) continue;
            return breakableCell(grid, c, mask) ? seenBlocker(model, p) : 0;
        }
        left -= len;
        from = to;
    }
    return 0;
}

/** The seen standing destructible obstacle on the ground floor nearest `p` within the player's clearance, or 0. */
function seenBlocker(model: WorldModel, p: Vec2): number {
    let best = 0;
    let bestD = 1.6;
    for (const o of model.obstacles) {
        if (o.view.dead || !o.blocksMove || (o.view.layer & 1) !== 0 || !o.def.destructible || o.def.explosion)
            continue;
        const d = distanceToCollider(p, o.col);
        if (d < bestD) {
            bestD = d;
            best = o.view.id;
        }
    }
    return best;
}

/** Break-aware components are relabelled at most this often (game seconds), after the grid changed. */
const RELABEL_EVERY = 10;
/** Per grid: components with the house rule's breakable cells counted as walkable (4-connected), when labelled. */
const breakLabels = new WeakMap<CellGrid, { labels: Int32Array; version: number; at: number }>();

/**
 * Whether `b` can be reached from `a` breaking through the house rule's and indoor obstacles (BREAK_BITS.HouseRule):
 * the brain's reachability for goals behind them (brain/context.ts reachable). A hint like the grid's own components,
 * relabelled at most every RELABEL_EVERY seconds.
 */
export function reachableBreaking(grid: CellGrid, a: Vec2, b: Vec2, now: number, slack = 1.5): boolean {
    const ia = grid.nearestWalkable(a, 4);
    const ib = grid.nearestWalkable(b, slack);
    if (ia < 0 || ib < 0) return false;
    let e = breakLabels.get(grid);
    if (!e || (e.version !== grid.version && now - e.at >= RELABEL_EVERY) || now < e.at) {
        e = { labels: labelBreaking(grid), version: grid.version, at: now };
        breakLabels.set(grid, e);
    }
    return e.labels[ia] !== 0 && e.labels[ia] === e.labels[ib];
}

function labelBreaking(grid: CellGrid): Int32Array {
    const w = grid.w;
    const size = w * grid.h;
    const labels = new Int32Array(size);
    const open = (i: number) => grid.passable(i) || breakableCell(grid, i, BREAK_BITS.HouseRule);
    const stack: number[] = [];
    let next = 0;
    for (let s = 0; s < size; s++) {
        if (labels[s] !== 0 || !open(s)) continue;
        labels[s] = ++next;
        stack.push(s);
        while (stack.length) {
            const c = stack.pop() as number;
            const x = c % w;
            const n = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w];
            for (const j of n) {
                if (j < 0 || j >= size || labels[j] !== 0 || !open(j)) continue;
                labels[j] = next;
                stack.push(j);
            }
        }
    }
    return labels;
}
