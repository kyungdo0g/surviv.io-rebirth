// Path following: plans with A* (or walks straight when the grid shows a clear line), advances along the smoothed
// waypoints with one point of lookahead, replans when the goal moves or the grid changes, detects being stuck (little
// progress while walking towards the same destination) and sidesteps out of it, and asks to open closed doors the
// path runs into (waiting for slow doors such as vault doors instead of pushing against them).
// With underground navigation installed (WorldModel.underground, BrainFeatures.basements) `steer` also takes the goal's
// layer and plans across floors (nav/layered.ts): each leg runs on one grid through `steerOn`.
//
// Stuck fixes (stuck-event investigation, wave 2): no progress while the destination keeps changing (a brain switching
// between goals) counts as a dither event, not a stuck event; a goal drifting by less than the replan threshold moves
// the plan's last point with it (the bot used to dance around a stale last waypoint); a plan whose end had to snap
// away from the goal (the goal cell is blocked) ends with a short straight approach and then reports failure instead
// of replanning the same path forever; a bot in a blocked cell (pressed against an open door) plans from a free cell it
// can walk to in a straight line; slow doors are waited for. Grid side: tight cells, unusable doors as walls, one-way
// doors (nav/cellGrid.ts).
import type { Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { colliderCenter, distanceToCollider, segmentHits } from "../geom.ts";
import type { WorldModel } from "../perception/world.ts";
import { findPath } from "./astar.ts";
import { type CellGrid, sameLayer } from "./cellGrid.ts";
import { LayeredRoute } from "./layered.ts";

export interface SteerResult {
    /** unit direction to walk, null to stand */
    dir: Vec2 | null;
    /** obstacle id of a closed door to open now (send Input.Use), 0 for none */
    openDoor: number;
    arrived: boolean;
    /** the goal could not be reached (planning or walking failed repeatedly) */
    failed: boolean;
}

/** A grid the follower can plan on: the ground NavGrid or an underground grid, each with its per-tick plan budget. */
export type PlanGrid = CellGrid & { planBudget(now: number): number; spendPlanBudget(nodes: number): void };

/** Distance from the player centre within which Interact reaches a door (interactionRad + player radius, minus slack). */
const DOOR_REACH_SLACK = 0.15;
const PLAYER_RAD = 1;
/** A straight line is tried before A* for goals this close. */
const DIRECT_DIST = 60;
const STUCK_WINDOW = 0.9;
/** Node budget of one plan, and the least worth starting a plan with. */
const MAX_PLAN_NODES = 12000;
const MIN_PLAN_NODES = 1500;
const STUCK_MIN_MOVE = 0.8;
/** A goal moving farther than this is a new destination: the progress window starts over. */
const NEW_DESTINATION = 6;
/**
 * The end of a snapped plan (goal cell blocked) is followed by a straight approach of at most this long when the goal
 * is at most APPROACH_DIST away (loot by a wall, a crate's side); farther, the goal is behind something: failure.
 */
const APPROACH_TIME = 1.5;
const APPROACH_DIST = 3;
/** A bot in a blocked cell starts its plan from a free cell this close that it can walk to in a straight line. */
const START_SEARCH = 4;
/** A goal this close that a full search cannot reach is not searched for again for UNREACHABLE_MEMORY seconds. */
const DETOUR_DIST = 30;
const UNREACHABLE_MEMORY = 10;

export class PathFollower {
    goal: Vec2 | null = null;
    /** waypoints of the current plan */
    points: Vec2[] = [];
    /** grid of the current plan (the ground grid, or an underground grid), null before the first plan */
    grid: CellGrid | null = null;
    private idx = 0;
    private planTime = Number.NEGATIVE_INFINITY;
    /** grid version the plan was checked against */
    private planVersion = -1;
    /** a close goal a full search could not reach, and until when steering to it fails at once */
    private unreachable: Vec2 | null = null;
    private unreachableUntil = Number.NEGATIVE_INFINITY;
    private complete = false;
    /** the plan ends short of the goal (findPath snapped the goal to the nearest reachable cell) */
    private snapped = false;
    /** straight approach to the goal after a snapped plan ended, until this time */
    private approachUntil = Number.NEGATIVE_INFINITY;
    private checkPos: Vec2 | null = null;
    private checkTime = 0;
    private lastSteer = Number.NEGATIVE_INFINITY;
    private unstickUntil = Number.NEGATIVE_INFINITY;
    private unstickDir: Vec2 = { x: 1, y: 0 };
    private stuckCount = 0;
    private failures = 0;
    private lastDoorUse = Number.NEGATIVE_INFINITY;
    /** a door with an opening delay was used: wait for it until this time */
    private doorWaitUntil = Number.NEGATIVE_INFINITY;
    private doorWaitId = 0;
    private forceReplan = false;
    /** plan again at this time (a deferred replan) */
    private replanAt = Number.POSITIVE_INFINITY;
    private readonly rng: Rng;
    private readonly route = new LayeredRoute();
    /** the destination changed during the current progress window */
    private destChanged = false;
    /** total stuck events: no progress towards one destination (diagnostics, tests, tournaments) */
    stuckEvents = 0;
    /**
     * Total dither events: no progress while the destination kept changing (the brain switching back and forth between
     * goals). The follower reacts as to being stuck (a sidestep, a new plan, failure after five), but counts it apart.
     */
    ditherEvents = 0;

    constructor(rng: Rng) {
        this.rng = rng;
    }

    clear(): void {
        this.goal = null;
        this.replanAt = Number.POSITIVE_INFINITY;
        this.points = [];
        this.idx = 0;
        this.failures = 0;
        this.stuckCount = 0;
        this.snapped = false;
        this.approachUntil = Number.NEGATIVE_INFINITY;
        this.route.clear();
    }

    /**
     * Whether `pos` on `layer` (0 ground, 1 underground) can probably be walked to from where the bot stands: grid
     * components, plus stair portals when underground navigation is installed (no search).
     */
    canPathTo(model: WorldModel, pos: Vec2, layer = 0): boolean {
        const self = model.self;
        const ug = model.underground;
        if (ug) return ug.canPathTo(model.nav, self.pos, self.layer, pos, layer);
        return self.layer === 0 && (layer & 1) === 0 && model.nav.reachable(self.pos, pos);
    }

    /**
     * One step towards `goal`. `goalLayer` (0 ground, 1 underground) only matters with underground navigation
     * installed: then a layer-1 goal is reached through the nearest usable stairs, and a bot underground (or on stairs)
     * walks back up to reach a ground goal. Without it, or for ground goals on the ground, this is plain path following.
     */
    steer(model: WorldModel, goal: Vec2, now: number, arriveDist = 1, goalLayer?: number): SteerResult {
        const ug = model.underground;
        if (ug && (model.self.layer !== 0 || ((goalLayer ?? 0) & 1) === 1)) {
            const r = this.route.steer(this, model, ug, goal, goalLayer ?? 0, now, arriveDist);
            if (r) return r;
        }
        return this.steerOn(model, model.nav, goal, now, arriveDist);
    }

    /** Forget the plan when the next leg runs on another grid. */
    private useGrid(grid: CellGrid): void {
        this.grid = grid;
        this.goal = null;
        this.points = [];
        this.idx = 0;
        this.planTime = Number.NEGATIVE_INFINITY;
        this.complete = false;
        this.snapped = false;
        this.approachUntil = Number.NEGATIVE_INFINITY;
        this.replanAt = Number.POSITIVE_INFINITY;
        this.forceReplan = false;
        this.failures = 0;
    }

    /** The next few waypoints of the plan and the legs between them are still passable. */
    private legsOpen(grid: CellGrid): boolean {
        const pts = this.points;
        const end = Math.min(pts.length, this.idx + 3);
        for (let i = this.idx; i < end; i++) {
            if (!grid.covers(pts[i]) || !grid.passable(grid.cellOf(pts[i]))) return false;
            if (i > this.idx && !grid.linePassable(pts[i - 1], pts[i])) return false;
        }
        return true;
    }

    private plan(model: WorldModel, grid: PlanGrid, pos: Vec2, goal: Vec2, now: number): void {
        this.planVersion = grid.version;
        this.forceReplan = false;
        this.replanAt = Number.POSITIVE_INFINITY;
        this.approachUntil = Number.NEGATIVE_INFINITY;
        if (v2.distance(pos, goal) < DIRECT_DIST && grid.lineWalkable(pos, goal)) {
            this.planTime = now;
            this.idx = 0;
            this.points = [v2.copy(goal)];
            this.complete = true;
            this.snapped = false;
            return;
        }
        const budget = grid.planBudget(now);
        if (budget < MIN_PLAN_NODES) {
            // other bots used this tick's planning budget: keep going and plan on a later snapshot
            if (this.points.length === 0) {
                this.points = [v2.copy(goal)];
                this.idx = 0;
                this.complete = false;
                this.snapped = false;
            }
            this.forceReplan = true;
            return;
        }
        this.planTime = now;
        this.idx = 0;
        const maxExpand = Math.min(MAX_PLAN_NODES, budget);
        const res = findPath(grid, pos, goal, { maxExpand, startCell: this.startCell(model, grid, pos) });
        grid.spendPlanBudget(res ? res.expanded : 50);
        if (res && !res.complete && maxExpand === MAX_PLAN_NODES && v2.distance(pos, goal) < DETOUR_DIST) {
            // a full search found no way to a goal this close: behind a wall, or only by a long detour (a tight gap on
            // the far side of a building); give up on it for a while instead of searching again and again
            this.unreachable = v2.copy(goal);
            this.unreachableUntil = now + UNREACHABLE_MEMORY;
            this.failures = Math.max(this.failures, 3);
        }
        if (!res || res.points.length === 0) {
            this.failures++;
            this.points = [v2.copy(goal)];
            this.complete = false;
            this.snapped = false;
            return;
        }
        this.points = res.points;
        this.complete = res.complete;
        const end = res.points[res.points.length - 1];
        this.snapped = res.complete && v2.distance(end, goal) > 1.5;
        if (!res.complete) this.failures++;
    }

    /**
     * A moving goal (a target walking, a flee point) usually needs no new search: walk straight when the line is clear,
     * or swap the plan's last point when the new goal is visible from the one before; a search runs at most every
     * 0.75 s otherwise. Returns false when a full replan is needed.
     */
    private retarget(grid: CellGrid, pos: Vec2, goal: Vec2, now: number): boolean {
        if (v2.distance(pos, goal) < DIRECT_DIST && grid.lineWalkable(pos, goal)) {
            this.points = [v2.copy(goal)];
            this.idx = 0;
            this.complete = true;
            this.snapped = false;
            return true;
        }
        const pts = this.points;
        if (pts.length > 0 && !this.snapped) {
            const prev = pts.length >= 2 ? pts[pts.length - 2] : pos;
            if (grid.lineWalkable(prev, goal)) {
                pts[pts.length - 1] = v2.copy(goal);
                return true;
            }
        }
        if (now - this.planTime >= 0.75) return false;
        // searched very recently: keep the current plan a little longer, then plan again
        this.replanAt = Math.min(this.replanAt, this.planTime + 0.75);
        return true;
    }

    /** Path following on one grid (the layered route runs each leg through it). */
    steerOn(model: WorldModel, grid: PlanGrid, goal: Vec2, now: number, arriveDist = 1): SteerResult {
        if (grid !== this.grid) this.useGrid(grid);
        const pos = model.self.pos;
        const dist = v2.distance(pos, goal);
        if (now - this.lastSteer > 0.5) this.checkPos = null;
        this.lastSteer = now;
        if (dist <= arriveDist) {
            this.checkPos = null;
            this.stuckCount = 0;
            return { dir: null, openDoor: 0, arrived: true, failed: false };
        }
        if (this.unreachable && now < this.unreachableUntil && v2.distance(goal, this.unreachable) < 2) {
            return { dir: null, openDoor: 0, arrived: false, failed: true };
        }
        const shift = this.goal === null ? Number.POSITIVE_INFINITY : v2.distance(goal, this.goal);
        let replan = this.forceReplan || this.points.length === 0 || now >= this.replanAt;
        if (shift > Math.max(1.5, 0.15 * dist)) {
            if (shift > NEW_DESTINATION) {
                this.failures = 0;
                this.stuckCount = 0;
                // no progress while the destination keeps changing is the brain dithering, not the bot stuck
                if (this.goal !== null) this.destChanged = true;
            }
            this.goal = v2.copy(goal);
            // a new destination (behaviour switch) plans at once; a goal drifting along adapts the current plan
            replan = replan || shift > 0.35 * dist || !this.retarget(grid, pos, goal, now);
        } else if (shift > 0.05 && this.goal !== null && !replan && !this.snapped && this.points.length > 0) {
            // a small drift: carry the plan's last point along when the last leg stays walkable (otherwise the drift
            // adds up until it triggers a retarget)
            const pts = this.points;
            const prev = pts.length >= 2 ? pts[pts.length - 2] : pos;
            if (grid.lineWalkable(prev, goal)) {
                pts[pts.length - 1] = v2.copy(goal);
                this.goal = v2.copy(goal);
            }
        }
        // complete plans are refreshed now and then (doors, destroyed obstacles), partial ones sooner
        if (now - this.planTime > (this.complete ? 6 : 2)) replan = true;
        // the grid changed (a door opened across the way): replan when the next legs are no longer open
        if (!replan && grid.version !== this.planVersion) {
            this.planVersion = grid.version;
            if (this.complete && !this.legsOpen(grid)) replan = true;
        }
        // walked the whole plan without reaching the goal (an old or partial plan; a snapped one ends in an approach)
        const last = this.points[this.points.length - 1];
        const atEnd = !!last && v2.distance(pos, last) < 0.9 && v2.distance(last, goal) > 1.5;
        if (atEnd && this.snapped) {
            // the goal cell is blocked: close enough to try the last bit straight, else it cannot be reached from here
            if (v2.distance(last, goal) > APPROACH_DIST) this.failures = Math.max(this.failures, 3);
            else if (this.approachUntil === Number.NEGATIVE_INFINITY) this.approachUntil = now + APPROACH_TIME;
        } else if (atEnd) replan = true;
        if (replan) this.plan(model, grid, pos, goal, now);

        if (now < this.unstickUntil) return { dir: this.unstickDir, openDoor: 0, arrived: false, failed: false };
        if (this.waitingForDoor(model, now)) {
            this.checkPos = null;
            return { dir: null, openDoor: 0, arrived: false, failed: false };
        }

        if (this.snapped && this.approachUntil !== Number.NEGATIVE_INFINITY) {
            // the snapped plan's end: straight at the goal for a moment, then give up
            if (now > this.approachUntil) this.failures = Math.max(this.failures, 3);
            const dir = v2.normalizeSafe(v2.sub(goal, pos), { x: 1, y: 0 });
            const openDoor = this.doorToOpen(model, pos, goal, now);
            this.checkStuck(pos, dir, now);
            const failed = this.failures >= 3 || this.stuckCount >= 2;
            return { dir: failed ? null : dir, openDoor, arrived: false, failed };
        }
        const pts = this.points;
        while (this.idx < pts.length - 1 && v2.distance(pos, pts[this.idx]) < 0.9) this.idx++;
        if (this.idx < pts.length - 1 && grid.lineWalkable(pos, pts[this.idx + 1])) this.idx++;
        const wp = this.idx < pts.length ? pts[this.idx] : goal;
        const dir = v2.normalizeSafe(v2.sub(wp, pos), { x: 1, y: 0 });
        const openDoor = this.doorToOpen(model, pos, wp, now);
        this.checkStuck(pos, dir, now);
        const failed = this.failures >= 3 || this.stuckCount >= 5;
        // a failed goal: stand (the brain picks another) rather than jitter at the plan's end
        return { dir: failed && this.snapped ? null : dir, openDoor, arrived: false, failed };
    }

    /**
     * Where a plan starts when the bot stands in a blocked cell (pressed against an open door's panel, wedged between
     * crates): the nearest walkable cell it can walk to in a straight line without crossing an obstacle of its floor
     * (the plain nearest walkable cell may lie behind the panel it touches). Undefined: findPath's default.
     */
    private startCell(model: WorldModel, grid: CellGrid, pos: Vec2): number | undefined {
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

    /** Walks `dir` directly (along stairs), with stuck detection and doors; `wp` is the point it heads for. */
    steerDirect(model: WorldModel, dir: Vec2, wp: Vec2, now: number): SteerResult {
        const pos = model.self.pos;
        if (now - this.lastSteer > 0.5) this.checkPos = null;
        this.lastSteer = now;
        if (now < this.unstickUntil) return { dir: this.unstickDir, openDoor: 0, arrived: false, failed: false };
        const openDoor = this.doorToOpen(model, pos, wp, now);
        this.checkStuck(pos, dir, now);
        return { dir, openDoor, arrived: false, failed: this.stuckCount >= 5 };
    }

    /** Restarts the progress window (a new leg of a layered route). */
    resetProgress(): void {
        this.checkPos = null;
        this.stuckCount = 0;
    }

    /**
     * The keys were lifted on purpose (round 5, motor/rhythm.ts: a walking pause, a stop to shoot): the progress window
     * starts again, so a pause is not taken for being stuck (a sidestep and a new plan, the goal failed after five);
     * stuck counts already made stay.
     */
    pauseProgress(): void {
        this.checkPos = null;
    }

    private checkStuck(pos: Vec2, dir: Vec2, now: number): void {
        if (this.checkPos === null) {
            this.checkPos = v2.copy(pos);
            this.checkTime = now;
            this.destChanged = false;
            return;
        }
        if (now - this.checkTime < STUCK_WINDOW) return;
        const movedDist = v2.distance(pos, this.checkPos);
        const dithering = this.destChanged;
        this.checkPos = v2.copy(pos);
        this.checkTime = now;
        this.destChanged = false;
        if (movedDist >= STUCK_MIN_MOVE) {
            this.stuckCount = Math.max(0, this.stuckCount - 1);
            return;
        }
        this.stuckCount++;
        if (dithering) this.ditherEvents++;
        else this.stuckEvents++;
        // sidestep at a random angle away from the blocked direction, then plan again
        const side = this.rng.bool() ? 1 : -1;
        const angle = side * this.rng.range(Math.PI * 0.45, Math.PI * 0.8);
        this.unstickDir = v2.rotate(dir, angle);
        this.unstickUntil = now + this.rng.range(0.15, 0.35);
        this.forceReplan = true;
    }

    /** A door with an opening delay (vault doors) was just used and is still closed: stand and wait for it. */
    private waitingForDoor(model: WorldModel, now: number): boolean {
        if (now >= this.doorWaitUntil) return false;
        const o = model.obstacleById.get(this.doorWaitId);
        if (!o?.view.door || o.view.door.open || o.view.dead) {
            this.doorWaitUntil = Number.NEGATIVE_INFINITY;
            return false;
        }
        return true;
    }

    /** A closed, usable door in reach that lies ahead on the way to `wp` (and no open door in reach). */
    private doorToOpen(model: WorldModel, pos: Vec2, wp: Vec2, now: number): number {
        if (now - this.lastDoorUse < 0.7) return 0;
        let candidate = 0;
        let delay = 0;
        const layer = model.self.layer;
        for (const o of model.obstacles) {
            const door = o.view.door;
            const def = o.def.door;
            // doors of the other floor (a bunker's under a house's porch) are out of reach
            if (!door || !def || o.view.dead || !sameLayer(layer, o.view.layer)) continue;
            const reach = def.interactionRad + PLAYER_RAD - DOOR_REACH_SLACK;
            const d = distanceToCollider(pos, o.col);
            if (d >= reach) continue;
            // Interact toggles every door in reach: never close an open one by accident
            if (door.open) return 0;
            if (!door.canUse || door.locked || def.autoOpen) continue;
            const ahead = v2.dot(v2.sub(colliderCenter(o.col), pos), v2.sub(wp, pos)) > 0;
            const onWay = segmentHits(o.col, pos, v2.add(pos, v2.mul(v2.normalizeSafe(v2.sub(wp, pos)), 3)));
            if (ahead && (onWay || d < 0.4)) {
                candidate = o.view.id;
                delay = def.openDelay ?? 0;
            }
        }
        if (candidate) {
            this.lastDoorUse = now;
            if (delay > 0) {
                this.doorWaitId = candidate;
                this.doorWaitUntil = now + delay + 0.5;
            }
        }
        return candidate;
    }
}
