// Path following: plans with A* (or walks straight when the grid shows a clear line), advances along the smoothed
// waypoints with one point of lookahead, replans when the goal moves or the grid changes, detects being stuck (little
// progress while walking) and sidesteps out of it, and asks to open closed doors the path runs into.
import type { Rng, Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import type { WorldModel } from "../perception/world.ts";
import { colliderCenter, distanceToCollider, segmentHits } from "../geom.ts";
import { findPath } from "./astar.ts";

export interface SteerResult {
    /** unit direction to walk, null to stand */
    dir: Vec2 | null;
    /** obstacle id of a closed door to open now (send Input.Use), 0 for none */
    openDoor: number;
    arrived: boolean;
    /** the goal could not be reached (planning or walking failed repeatedly) */
    failed: boolean;
}

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

export class PathFollower {
    goal: Vec2 | null = null;
    /** waypoints of the current plan */
    points: Vec2[] = [];
    private idx = 0;
    private planTime = Number.NEGATIVE_INFINITY;
    private complete = false;
    private checkPos: Vec2 | null = null;
    private checkTime = 0;
    private lastSteer = Number.NEGATIVE_INFINITY;
    private unstickUntil = Number.NEGATIVE_INFINITY;
    private unstickDir: Vec2 = { x: 1, y: 0 };
    private stuckCount = 0;
    private failures = 0;
    private lastDoorUse = Number.NEGATIVE_INFINITY;
    private forceReplan = false;
    private readonly rng: Rng;
    /** total stuck events (diagnostics, tests) */
    stuckEvents = 0;

    constructor(rng: Rng) {
        this.rng = rng;
    }

    clear(): void {
        this.goal = null;
        this.points = [];
        this.idx = 0;
        this.failures = 0;
        this.stuckCount = 0;
    }

    private plan(model: WorldModel, pos: Vec2, goal: Vec2, now: number): void {
        const grid = model.nav;
        this.forceReplan = false;
        if (v2.distance(pos, goal) < DIRECT_DIST && grid.lineWalkable(pos, goal)) {
            this.planTime = now;
            this.idx = 0;
            this.points = [v2.copy(goal)];
            this.complete = true;
            return;
        }
        const budget = grid.planBudget(now);
        if (budget < MIN_PLAN_NODES) {
            // other bots used this tick's planning budget: keep going and plan on a later snapshot
            if (this.points.length === 0) {
                this.points = [v2.copy(goal)];
                this.idx = 0;
                this.complete = false;
            }
            this.forceReplan = true;
            return;
        }
        this.planTime = now;
        this.idx = 0;
        const res = findPath(grid, pos, goal, { maxExpand: Math.min(MAX_PLAN_NODES, budget) });
        grid.spendPlanBudget(res ? res.expanded : 50);
        if (!res || res.points.length === 0) {
            this.failures++;
            this.points = [v2.copy(goal)];
            this.complete = false;
            return;
        }
        this.points = res.points;
        this.complete = res.complete;
        if (!res.complete) this.failures++;
    }

    /**
     * A moving goal (a target walking, a flee point) usually needs no new search: walk straight when the line is clear,
     * or swap the plan's last point when the new goal is visible from the one before; a search runs at most every
     * 0.75 s otherwise. Returns false when a full replan is needed.
     */
    private retarget(model: WorldModel, pos: Vec2, goal: Vec2, now: number): boolean {
        const grid = model.nav;
        if (v2.distance(pos, goal) < DIRECT_DIST && grid.lineWalkable(pos, goal)) {
            this.points = [v2.copy(goal)];
            this.idx = 0;
            this.complete = true;
            return true;
        }
        const pts = this.points;
        if (pts.length > 0) {
            const prev = pts.length >= 2 ? pts[pts.length - 2] : pos;
            if (grid.lineWalkable(prev, goal)) {
                pts[pts.length - 1] = v2.copy(goal);
                return true;
            }
        }
        return now - this.planTime < 0.75;
    }

    steer(model: WorldModel, goal: Vec2, now: number, arriveDist = 1): SteerResult {
        const pos = model.self.pos;
        const dist = v2.distance(pos, goal);
        if (now - this.lastSteer > 0.5) this.checkPos = null;
        this.lastSteer = now;
        if (dist <= arriveDist) {
            this.checkPos = null;
            this.stuckCount = 0;
            return { dir: null, openDoor: 0, arrived: true, failed: false };
        }
        const moved = this.goal === null || v2.distance(goal, this.goal) > Math.max(1.5, 0.15 * dist);
        let replan = this.forceReplan || this.points.length === 0;
        if (moved) {
            if (this.goal === null || v2.distance(goal, this.goal) > 6) {
                this.failures = 0;
                this.stuckCount = 0;
            }
            this.goal = v2.copy(goal);
            replan = replan || !this.retarget(model, pos, goal, now);
        }
        // complete plans are refreshed now and then (doors, destroyed obstacles), partial ones sooner
        if (now - this.planTime > (this.complete ? 6 : 2)) replan = true;
        if (replan) this.plan(model, pos, goal, now);

        if (now < this.unstickUntil) return { dir: this.unstickDir, openDoor: 0, arrived: false, failed: false };

        const pts = this.points;
        while (this.idx < pts.length - 1 && v2.distance(pos, pts[this.idx]) < 0.9) this.idx++;
        if (this.idx < pts.length - 1 && model.nav.lineWalkable(pos, pts[this.idx + 1])) this.idx++;
        const wp = this.idx < pts.length ? pts[this.idx] : goal;
        const dir = v2.normalizeSafe(v2.sub(wp, pos), { x: 1, y: 0 });
        const openDoor = this.doorToOpen(model, pos, wp, now);
        this.checkStuck(pos, dir, now);
        return { dir, openDoor, arrived: false, failed: this.failures >= 3 || this.stuckCount >= 5 };
    }

    private checkStuck(pos: Vec2, dir: Vec2, now: number): void {
        if (this.checkPos === null) {
            this.checkPos = v2.copy(pos);
            this.checkTime = now;
            return;
        }
        if (now - this.checkTime < STUCK_WINDOW) return;
        const movedDist = v2.distance(pos, this.checkPos);
        this.checkPos = v2.copy(pos);
        this.checkTime = now;
        if (movedDist >= STUCK_MIN_MOVE) {
            this.stuckCount = Math.max(0, this.stuckCount - 1);
            return;
        }
        this.stuckCount++;
        this.stuckEvents++;
        // sidestep at a random angle away from the blocked direction, then plan again
        const side = this.rng.bool() ? 1 : -1;
        const angle = side * this.rng.range(Math.PI * 0.45, Math.PI * 0.8);
        this.unstickDir = v2.rotate(dir, angle);
        this.unstickUntil = now + this.rng.range(0.25, 0.55);
        this.forceReplan = true;
    }

    /** A closed, usable door in reach that lies ahead on the way to `wp` (and no open door in reach). */
    private doorToOpen(model: WorldModel, pos: Vec2, wp: Vec2, now: number): number {
        if (now - this.lastDoorUse < 0.7) return 0;
        let candidate = 0;
        for (const o of model.obstacles) {
            const door = o.view.door;
            const def = o.def.door;
            if (!door || !def || o.view.dead) continue;
            const reach = def.interactionRad + PLAYER_RAD - DOOR_REACH_SLACK;
            const d = distanceToCollider(pos, o.col);
            if (d >= reach) continue;
            // Interact toggles every door in reach: never close an open one by accident
            if (door.open) return 0;
            if (!door.canUse || door.locked || def.autoOpen) continue;
            const ahead = v2.dot(v2.sub(colliderCenter(o.col), pos), v2.sub(wp, pos)) > 0;
            const onWay = segmentHits(o.col, pos, v2.add(pos, v2.mul(v2.normalizeSafe(v2.sub(wp, pos)), 3)));
            if (ahead && (onWay || d < 0.4)) candidate = o.view.id;
        }
        if (candidate) this.lastDoorUse = now;
        return candidate;
    }
}
