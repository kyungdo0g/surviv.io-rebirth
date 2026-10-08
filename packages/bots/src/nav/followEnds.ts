// Where the path follower's plans start and end (nav/follower.ts): the free cell a bot standing in a blocked cell
// starts from, and, for a goal with no route at all (it lies in another connected component of the grid: a room behind
// a glass wall, the far side of a perimeter wall with no gate on the grid), the reachable cell nearest the goal, which
// the follower walks to before it reports the failure instead of walking straight at the goal and sliding along the
// wall in between (move-slide: a bot in the greenhouse bunker slid along compartment 2's glass wall for 30 s towards
// compartment 3, which only a broken glass wall opens).
import type { Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { distanceToCollider, segmentHits } from "../geom.ts";
import type { WorldModel } from "../perception/world.ts";
import { type CellGrid, sameLayer } from "./cellGrid.ts";

/** A bot in a blocked cell starts its plan from a free cell this close that it can walk to in a straight line. */
const START_SEARCH = 4;
/**
 * A goal with no route is walked towards up to the reachable cell nearest it within this distance of it (the greenhouse
 * bunker's compartment 3 middle lies 25 units past the glass wall); a goal with no reachable cell this close fails at
 * once.
 */
export const NO_ROUTE_REACH = 30;

/**
 * Where a plan starts when the bot stands in a blocked cell (pressed against an open door's panel, wedged between
 * crates): the nearest walkable cell it can walk to in a straight line without crossing an obstacle of its floor
 * (the plain nearest walkable cell may lie behind the panel it touches). Undefined: findPath's default.
 */
export function blockedStart(model: WorldModel, grid: CellGrid, pos: Vec2): number | undefined {
    const own = grid.cellOf(pos);
    if (!grid.covers(pos) || grid.blocked[own] === 0 || grid.tight[own] !== 0) return undefined;
    const layer = model.self.layer;
    const near = model.obstacles.filter(
        (o) => o.blocksMove && sameLayer(layer, o.view.layer) && distanceToCollider(pos, o.col) < START_SEARCH + 1,
    );
    const r = Math.ceil(START_SEARCH / grid.cellSize);
    const cx = own % grid.w;
    const cy = Math.floor(own / grid.w);
    let best = -1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx;
            const y = cy + dy;
            if (!grid.inside(x, y)) continue;
            const i = y * grid.w + x;
            if (grid.blocked[i] !== 0) continue;
            const c = grid.center(i);
            const d = v2.distanceSqr(c, pos);
            if (d >= bestD || d > START_SEARCH * START_SEARCH) continue;
            if (near.some((o) => segmentHits(o.col, pos, c))) continue;
            bestD = d;
            best = i;
        }
    }
    return best >= 0 ? best : undefined;
}

/** The cell findPath starts a plan from (`startCell`, else the bot's own tight cell, else the nearest free one), or -1. */
export function planStartCell(grid: CellGrid, pos: Vec2, startCell: number | undefined): number {
    if (startCell !== undefined) return startCell;
    const own = grid.cellOf(pos);
    return grid.covers(pos) && grid.tight[own] !== 0 ? own : grid.nearestWalkable(pos, 4);
}

/** Each unit of walk from the bot to the cell weighs this much against a unit closer to the goal (towardUnreachable). */
const TOWARD_WALK = 0.5;

/**
 * For a goal findPath found no route to although the plan has a start cell: the centre of the start's component cell
 * within NO_ROUTE_REACH of the goal that best trades nearness to the goal against the walk from `from` (the side of a
 * walled-in room facing the bot, not the far side that is as close to the goal), or null (nothing reachable near it:
 * fail at once).
 */
export function towardUnreachable(grid: CellGrid, start: number, from: Vec2, goal: Vec2): Vec2 | null {
    if (grid.component(start) === 0) return null;
    const r = Math.ceil(NO_ROUTE_REACH / grid.cellSize);
    const g = grid.cellOf(goal);
    const gx = g % grid.w;
    const gy = Math.floor(g / grid.w);
    let best = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let y = Math.max(0, gy - r); y <= Math.min(grid.h - 1, gy + r); y++) {
        for (let x = Math.max(0, gx - r); x <= Math.min(grid.w - 1, gx + r); x++) {
            const i = y * grid.w + x;
            if (!grid.walkable(i)) continue;
            const c = grid.center(i);
            const d = v2.distance(c, goal);
            if (d > NO_ROUTE_REACH) continue;
            const cost = d + TOWARD_WALK * v2.distance(c, from);
            // (the start's label asked again: a query may relabel the grid, which renames the components)
            if (cost >= bestCost || grid.component(i) !== grid.component(start)) continue;
            bestCost = cost;
            best = i;
        }
    }
    return best >= 0 ? grid.center(best) : null;
}
