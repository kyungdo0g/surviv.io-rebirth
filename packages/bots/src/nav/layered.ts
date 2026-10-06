// Hierarchical routes across floors (BrainFeatures.basements): the path follower's legs between the ground and the
// underground grids of nav/underground.ts. Down: ground A* to a stair portal's top point, walk down along the stair axis
// (the simulation switches the player 0 -> 2 -> 3 -> 1 on the way), then local A* on the underground grid. Up: local A*
// to the portal's bottom point, along the stair axis back up, then ground A*. The portal is chosen once per destination
// (cheapest ground distance plus underground distance field) and kept while the bot follows it.
import { type Vec2, v2 } from "@rebirth/core";
import type { WorldModel } from "../perception/world.ts";
import type { PathFollower, SteerResult } from "./follower.ts";
import type { StairPortal, UndergroundGrid, UndergroundNav } from "./underground.ts";

/** Within this distance of a portal point the bot starts walking the stairs. */
const PORTAL_REACH = 1.2;
/** A goal moving farther than this picks its portal again. */
const REPICK_SHIFT = 4;
/** Ground distances are weighted a little above straight-line distance (paths bend). */
const GROUND_DETOUR = 1.25;

const FAILED: SteerResult = Object.freeze({ dir: null, openDoor: 0, arrived: false, failed: true }) as SteerResult;

/** Whether a position lies within the stair box (grown by `slack`). */
function onStair(p: StairPortal, pos: Vec2, slack: number): boolean {
    const b = p.box;
    return pos.x >= b.min.x - slack && pos.x <= b.max.x + slack && pos.y >= b.min.y - slack && pos.y <= b.max.y + slack;
}

export class LayeredRoute {
    private portal: StairPortal | null = null;
    private goal: Vec2 | null = null;
    private goalLayer = 0;

    clear(): void {
        this.portal = null;
        this.goal = null;
    }

    /**
     * The step of a route to `goal` on `goalLayer`, or null when the ground follower should handle it (both ends on the
     * ground, or the bot is somewhere underground navigation does not know).
     */
    steer(
        f: PathFollower,
        model: WorldModel,
        ug: UndergroundNav,
        goal: Vec2,
        goalLayer: number,
        now: number,
        arriveDist: number,
    ): SteerResult | null {
        const self = model.self;
        const pos = self.pos;
        const layer = self.layer;
        const wantUnder = (goalLayer & 1) === 1;
        if (layer === 0 && !wantUnder) {
            this.clear();
            return null;
        }
        if (!this.goal || v2.distance(goal, this.goal) > REPICK_SHIFT || goalLayer !== this.goalLayer) {
            this.goal = v2.copy(goal);
            this.goalLayer = goalLayer;
            this.portal = null;
        }
        const goalRegion = wantUnder ? ug.regionAt(goal, 1.5) : null;
        if (wantUnder && !goalRegion) return FAILED;

        if (layer === 2 || layer === 3) {
            // on the stairs: on down or back up, whichever floor the route needs next
            const p = ug.portalAt(pos, 1.5) ?? this.portal;
            if (!p) return null;
            return this.walkStairs(f, model, p, wantUnder && goalRegion === p.region ? 1 : -1, now);
        }

        if (layer === 0) {
            // ground -> underground
            const region = goalRegion as UndergroundGrid;
            const p = this.portal?.region === region ? this.portal : this.pickEntry(model, region, goal);
            if (!p?.top) return FAILED;
            this.portal = p;
            if (v2.distance(pos, p.top) < PORTAL_REACH || onStair(p, pos, 0.3))
                return this.walkStairs(f, model, p, 1, now);
            const r = f.steerOn(model, model.nav, p.top, now, PORTAL_REACH * 0.7);
            return r.arrived ? this.walkStairs(f, model, p, 1, now) : r;
        }

        // underground (layer 1)
        const here = ug.regionAt(pos, 2);
        if (!here) return null;
        if (wantUnder && goalRegion === here) {
            this.portal = null;
            return f.steerOn(model, here, goal, now, arriveDist);
        }
        const p =
            this.portal && this.portal.region === here ? this.portal : this.pickExit(model, ug, here, goal, wantUnder);
        if (!p?.bottom) return FAILED;
        this.portal = p;
        if (v2.distance(pos, p.bottom) < PORTAL_REACH || onStair(p, pos, 0.3)) {
            return this.walkStairs(f, model, p, -1, now);
        }
        const r = f.steerOn(model, here, p.bottom, now, PORTAL_REACH * 0.7);
        return r.arrived ? this.walkStairs(f, model, p, -1, now) : r;
    }

    /** Along the stair axis, down (sign 1) or up (sign -1), steering back onto the centre line. */
    private walkStairs(f: PathFollower, model: WorldModel, p: StairPortal, sign: 1 | -1, now: number): SteerResult {
        const pos = model.self.pos;
        const along = sign > 0 ? p.down : v2.neg(p.down);
        const side = { x: -p.down.y, y: p.down.x };
        const lateral = v2.dot(v2.sub(pos, p.center), side);
        const correction = Math.max(-0.8, Math.min(0.8, -lateral * 0.9));
        const dir = v2.normalizeSafe(v2.add(along, v2.mul(side, correction)), along);
        const end = sign > 0 ? p.bottom : p.top;
        const wp = end ?? v2.add(p.center, v2.mul(along, p.halfLen + 1.5));
        return f.steerDirect(model, dir, wp, now);
    }

    /** The stairs into `region` that make the shortest walk from the bot to `goal`. */
    private pickEntry(model: WorldModel, region: UndergroundGrid, goal: Vec2): StairPortal | null {
        const pos = model.self.pos;
        let best: StairPortal | null = null;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const p of region.portals) {
            if (!p.top || !p.bottom || !model.nav.reachable(pos, p.top)) continue;
            const under = region.costToPortal(p, goal);
            if (!Number.isFinite(under)) continue;
            const cost = v2.distance(pos, p.top) * GROUND_DETOUR + under;
            if (cost < bestCost) {
                bestCost = cost;
                best = p;
            }
        }
        return best;
    }

    /** The stairs out of `here` towards `goal` (on the ground, or in another underground region). */
    private pickExit(
        model: WorldModel,
        ug: UndergroundNav,
        here: UndergroundGrid,
        goal: Vec2,
        goalUnder: boolean,
    ): StairPortal | null {
        const pos = model.self.pos;
        const target = goalUnder ? ug.regionAt(goal, 1.5) : null;
        let best: StairPortal | null = null;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const p of here.portals) {
            if (!p.top || !p.bottom) continue;
            const under = here.costToPortal(p, pos, true);
            if (!Number.isFinite(under)) continue;
            let rest: number;
            if (target) {
                rest = Number.POSITIVE_INFINITY;
                for (const q of target.portals) {
                    if (!q.top || !model.nav.reachable(p.top, q.top)) continue;
                    rest = Math.min(rest, v2.distance(p.top, q.top) * GROUND_DETOUR + target.costToPortal(q, goal));
                }
            } else {
                rest = model.nav.reachable(p.top, goal, 3) ? v2.distance(p.top, goal) * GROUND_DETOUR : 1e6;
            }
            const cost = under + rest;
            if (cost < bestCost) {
                bestCost = cost;
                best = p;
            }
        }
        return best;
    }
}
