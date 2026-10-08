// Closing the door behind (BrainFeatures.doors): a player who goes into a building to loot, heal or hold often shuts
// the door it came in by, so nobody walks in unheard and the open door does not give it away from outside. Whether a
// bot does is drawn once per entry and purpose from its skill and persona (closeChance: experts and cautious personas
// more often). It turns back after a human moment, steps to a spot inside from which Use reaches the panel, never in
// the doorway the panel closes into nor against the open leaf, and out of the leaf's swing back where the room allows
// (beside a sliding door's slot, behind or past a hinged door's open leaf; the simulation moves a door's collider at
// once, sim world/doors.ts toggleDoor, so only the doorway itself would shove the bot), and presses Use once (Use
// toggles every door and button in reach, so the spot must reach no other). It never shuts the door on a teammate in
// the doorway or following within FOLLOW_RADIUS outside, nor on anyone standing in the panel's way, gives up after
// PLAN_TIMEOUT, and closes it again (up to maxCloses) when someone opens it while the bot stays inside. Leaving, the
// path follower opens it like any closed door on the way; so a bot whose way to its next goal leads out by that door
// (loot in the bank's other wing, reached round the outside) leaves it open: it shut doors only to open them again
// 0.3-0.7 s later, about one close in ten (review of the interactions).
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { colliderBounds, distanceToCollider, segmentHits } from "../geom.ts";
import { findPath } from "../nav/astar.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import {
    alongOf,
    clearOfSweep,
    type DoorShape,
    doorMiddle,
    inDoorway,
    PLAYER_RAD,
    reaches,
    sideOf,
    sweepLines,
    useReach,
} from "../nav/doorGeom.ts";
import { USE_SAFETY } from "../nav/follower.ts";
import type { DoorWatch } from "../perception/doorWatch.ts";
import type { SeenObstacle } from "../perception/world.ts";
import type { PersonaParams } from "../persona.ts";
import type { SkillProfile } from "../skill.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";
import { underRoof } from "./grenades.ts";

export type ClosePurpose = "loot" | "heal" | "hold";

/** Behaviours that keep the bot in the building it came into, and why it would close the door behind it. */
export const STAY_PURPOSE: ReadonlyMap<BehaviourName, ClosePurpose> = new Map<BehaviourName, ClosePurpose>([
    ["loot", "loot"],
    ["break", "loot"],
    ["sweep", "loot"],
    ["heal", "heal"],
    ["hold", "hold"],
]);

/** A teammate outside the door within this distance is following: the door stays open. */
export const FOLLOW_RADIUS = 16;
/** Anyone this close to the door's middle is in the doorway's way. */
const DOORWAY_NEAR = 3.5;
/**
 * The bot starts to close a door only within this distance of it (farther in, it does not walk back), and keeps at it
 * within CLOSE_KEEP (turning back on the keys takes a moment, motor/keys.ts); a door it already shut once and heard
 * opened again it goes back to from CLOSE_KEEP too.
 */
const CLOSE_RANGE = 9;
const CLOSE_KEEP = 13;
/** A close that has not happened after this long is given up for BLOCKED_FOR seconds. */
const PLAN_TIMEOUT = 5;
const BLOCKED_FOR = 8;
/** Use is pressed at most this often. */
const PRESS_EVERY = 0.8;
/**
 * Reach margin of a chosen stand spot (the bot stops up to its arrival distance short of it) and of the press itself;
 * margin of the bot's body from the leaf's swing.
 */
const SPOT_SLACK = 0.45;
const PRESS_SLACK = 0.05;
const SWEEP_CLEAR = PLAYER_RAD + 0.2;
/** A stand spot's body keeps this far from every obstacle (the open leaf included). */
const BODY_CLEAR = PLAYER_RAD + 0.05;
/** Stand spots are searched on this grid step. */
const SPOT_STEP = 0.25;
/** A stand spot in the leaf's swing costs this much more (units of walking) than one clear of it. */
const SWING_COST = 4;
/** ...and one whose grid cell is blocked (next to the leaf: the follower walks the last bit straight) this much. */
const OFF_GRID_COST = 1.5;
/** Arriving this close to the chosen spot counts as standing on it. */
const ON_SPOT = 0.45;

/** The exterior door the bot came in by, while it stays under that roof. */
export interface DoorEntry {
    id: number;
    /** the inner side of the door (sign of doorGeom sideOf) */
    side: number;
    at: number;
    /** since when the bot has been out from under the roof (Infinity while inside) */
    outsideSince: number;
    /** purposes the close decision was drawn for, and whether it wants the door shut */
    drawn: Set<ClosePurpose>;
    wants: boolean;
    /** earliest time to act on it (a human's moment before turning back to the door) */
    reactAt: number;
    /** times the bot shut it this entry, and its last press */
    closes: number;
    pressedAt: number;
    /** the running close: since when, the stand spot and whether it is out of the leaf's swing */
    since: number;
    spot: Vec2 | null;
    spotClear: boolean;
    blockedUntil: number;
    /** the last goal whose route was checked, and whether that route leaves by this door (routeLeaves) */
    route: { goal: Vec2; out: boolean } | null;
}

export function newEntry(id: number, side: number, now: number): DoorEntry {
    return {
        id,
        side,
        at: now,
        outsideSince: Number.POSITIVE_INFINITY,
        drawn: new Set(),
        wants: false,
        reactAt: now,
        closes: 0,
        pressedAt: Number.NEGATIVE_INFINITY,
        since: Number.NEGATIVE_INFINITY,
        spot: null,
        spotClear: false,
        blockedUntil: Number.NEGATIVE_INFINITY,
        route: null,
    };
}

/** Whether the leg `a` -> `b` passes through the doorway: across the panel's line within the doorway's span. */
export function crossesDoorway(shape: DoorShape, a: Vec2, b: Vec2): boolean {
    const s0 = sideOf(shape, a);
    const s1 = sideOf(shape, b);
    if (s0 * s1 > 0 || s0 === s1) return false;
    const t = alongOf(shape, v2.lerp(s0 / (s0 - s1), a, b));
    return t >= shape.t0 - PLAYER_RAD * 0.5 && t <= shape.t1 + PLAYER_RAD * 0.5;
}

/** A* nodes the route check may expand (inside one building). */
const ROUTE_NODES = 4000;
/** A goal within this of the last one checked keeps its verdict. */
const ROUTE_SAME = 1.5;

/**
 * Whether the way to `goal` leads out by the entry door: a leg of the grid route (the path follower plans the same
 * way) crosses its doorway. Checked once per goal (DoorEntry.route); no route: no.
 */
function routeLeaves(ctx: BrainCtx, entry: DoorEntry, shape: DoorShape, goal: Vec2): boolean {
    const known = entry.route;
    if (known && v2.distance(known.goal, goal) < ROUTE_SAME) return known.out;
    const grid = ctx.model.nav;
    const res = findPath(grid, ctx.self.pos, goal, { maxExpand: ROUTE_NODES });
    grid.spendPlanBudget(res ? res.expanded : 50);
    let out = false;
    if (res) {
        let a = ctx.self.pos;
        for (const p of [...res.points, goal]) {
            if (crossesDoorway(shape, a, p)) {
                out = true;
                break;
            }
            a = p;
        }
    }
    entry.route = { goal: v2.copy(goal), out };
    return out;
}

/**
 * Chance that a bot closes the door behind it (design values): game sense from about 0.2 (beginner) to 0.6 (expert),
 * caution (low risk tolerance, campiness) up to about +0.4 (camper, rat), a rusher about -0.2; more when it came in
 * to heal or to hold than to loot. NEUTRAL with an intermediate g = 0.5: 0.43.
 */
export function closeChance(
    skill: Readonly<SkillProfile>,
    persona: Readonly<PersonaParams>,
    why: ClosePurpose,
): number {
    const sense = 0.15 + 0.55 * skill.g;
    const caution = 0.6 * (0.5 - persona.riskTolerance) + 0.3 * persona.campiness;
    const reason = why === "heal" ? 0.15 : why === "hold" ? 0.2 : 0;
    return Math.min(0.95, Math.max(0.03, sense + caution + reason));
}

/** How many times one entry's door is shut: re-closing after someone opens it is for players with some game sense. */
export function maxCloses(skill: Readonly<SkillProfile>): number {
    return skill.g >= 0.6 ? 3 : skill.g >= 0.3 ? 2 : 1;
}

/** Positions of the friends the bot knows of (teammates on the screen, else the team UI's positions). */
function friendPositions(ctx: BrainCtx): Vec2[] {
    const out: Vec2[] = [];
    const seen = new Set<number>();
    for (const c of ctx.model.contacts.values()) {
        if (!c.teammate || c.dead || !c.visible) continue;
        out.push(c.pos);
        seen.add(c.id);
    }
    for (const m of ctx.model.team) {
        if (m.playerId === ctx.self.id || m.dead || seen.has(m.playerId)) continue;
        out.push(m.pos);
    }
    return out;
}

/**
 * Whether the door must stay open for someone: a friend in the doorway, in the panel's way or following outside
 * within FOLLOW_RADIUS, or anyone on the screen in the panel's way.
 */
export function doorBusy(ctx: BrainCtx, shape: DoorShape, side: number, lines: ReturnType<typeof sweepLines>): boolean {
    const mid = doorMiddle(shape);
    for (const p of friendPositions(ctx)) {
        const d = v2.distance(p, mid);
        if (d < DOORWAY_NEAR || !clearOfSweep(shape, lines, p, SWEEP_CLEAR)) return true;
        if (sideOf(shape, p) * side < 0 && d < FOLLOW_RADIUS) return true;
    }
    for (const c of ctx.model.contacts.values()) {
        if (c.visible && !c.dead && !clearOfSweep(shape, lines, c.pos, SWEEP_CLEAR)) return true;
    }
    return false;
}

/** Interactables near `target` that Use would toggle too (a door that opens or closes, a button), on the bot's floor. */
function othersNear(ctx: BrainCtx, target: SeenObstacle): SeenObstacle[] {
    const out: SeenObstacle[] = [];
    const layer = ctx.self.layer;
    const box = colliderBounds(target.col);
    for (const o of ctx.model.obstacles) {
        if (o === target || o.view.dead || !sameLayer(layer, o.view.layer)) continue;
        const door = o.view.door;
        const usable =
            (!!door && !!o.def.door && door.canUse && !door.locked && !o.def.door.autoOpen) ||
            (!!o.view.button && o.view.button.canUse);
        if (!usable) continue;
        const b = colliderBounds(o.col);
        const gap = Math.max(box.min.x - b.max.x, b.min.x - box.max.x, box.min.y - b.max.y, b.min.y - box.max.y);
        if (gap < 2 * useReach(o.def) + 1) out.push(o);
    }
    return out;
}

/** Whether Use from `p` would toggle one of `others` too (with the follower's safety margin past the reach). */
function touchesOther(others: readonly SeenObstacle[], p: Vec2): boolean {
    for (const o of others) if (distanceToCollider(p, o.col) < useReach(o.def) + USE_SAFETY) return true;
    return false;
}

type Lines = ReturnType<typeof sweepLines>;

/** The door being closed: its obstacle, closed shape, inner side, sweep, and the interactables next to it. */
interface Door {
    o: SeenObstacle;
    shape: DoorShape;
    side: number;
    lines: Lines;
    others: SeenObstacle[];
}

/**
 * A spot to close the door from: inside, Use reaching it with `slack` to spare, out of the doorway (where the leaf
 * closes to), nothing else in reach; `strict`: clear of the leaf's whole swing too.
 */
function goodSpot(door: Door, p: Vec2, slack: number, strict: boolean): boolean {
    const { o, shape, side, lines } = door;
    if (sideOf(shape, p) * side <= 0 || inDoorway(shape, p, 0.2)) return false;
    if (!reaches(o.def, o.col, p, slack)) return false;
    if (strict && !clearOfSweep(shape, lines, p, SWEEP_CLEAR)) return false;
    return !touchesOther(door.others, p);
}

/**
 * The nearest good spot the bot can stand on (its body clear of obstacles, a walkable cell close by), straight lines,
 * spots out of the leaf's swing and on walkable cells first; `clear`: out of the swing.
 */
function findSpot(ctx: BrainCtx, door: Door): { pos: Vec2; clear: boolean } | null {
    const { model, self } = ctx;
    const { o, shape, lines } = door;
    const reach = useReach(o.def);
    const box = colliderBounds(o.col);
    const near = model.obstacles.filter(
        (x) => x.blocksMove && sameLayer(self.layer, x.view.layer) && distanceToCollider(self.pos, x.col) < 14,
    );
    let best: { pos: Vec2; clear: boolean } | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let x = box.min.x - reach; x <= box.max.x + reach; x += SPOT_STEP) {
        for (let y = box.min.y - reach; y <= box.max.y + reach; y += SPOT_STEP) {
            const p = { x, y };
            if (!goodSpot(door, p, SPOT_SLACK, false)) continue;
            // the body fits there (next to the open leaf the grid's cells are blocked by its clearance: a walkable
            // cell close by is enough, the follower walks the last bit straight)
            if (near.some((n) => distanceToCollider(p, n.col) < BODY_CLEAR)) continue;
            if (model.nav.nearestWalkable(p, 1.5) < 0) continue;
            const straight = !near.some((n) => n !== o && segmentHits(n.col, self.pos, p));
            const clear = clearOfSweep(shape, lines, p, SWEEP_CLEAR);
            const grid = model.nav.walkableAt(p) ? 0 : OFF_GRID_COST;
            const cost = v2.distance(self.pos, p) + (straight ? 0 : 6) + (clear ? 0 : SWING_COST) + grid;
            if (cost < bestCost) {
                bestCost = cost;
                best = { pos: p, clear };
            }
        }
    }
    return best;
}

/**
 * The close behind, layered on the intent the behaviour planned: true when it took the intent over this decision
 * (walking to the stand spot or pressing Use). `paused`: a door alert's moment of looking is still running.
 */
export function planClose(
    ctx: BrainCtx,
    entry: DoorEntry,
    watch: DoorWatch,
    rng: Rng,
    intent: Intent,
    paused: boolean,
): boolean {
    const { model, self, now } = ctx;
    const why = STAY_PURPOSE.get(intent.behaviour);
    const o = model.obstacleById.get(entry.id);
    const door = o?.view.door;
    if (!why || !o || !door?.open || !door.canUse || door.locked || self.layer !== 0) {
        entry.since = Number.NEGATIVE_INFINITY;
        return false;
    }
    if (ctx.visibleEnemies.some((e) => !e.downed)) return false;
    if (!entry.drawn.has(why)) {
        entry.drawn.add(why);
        if (!entry.wants) entry.wants = rng.next() < closeChance(ctx.skill, ctx.persona, why);
    }
    if (!entry.wants || paused || now < entry.reactAt || now < entry.blockedUntil) return false;
    if (entry.closes >= maxCloses(ctx.skill)) return false;
    // an item in reach is picked up first, and the goal after it decides: closing during the room's last pickup shut
    // the door 0.1-0.2 s before the follower opened it again on the way to loot seen in the other wing (the bank)
    if (intent.behaviour === "loot" && intent.stop) return false;
    const shape = watch.shape(model, o);
    const range = entry.since === Number.NEGATIVE_INFINITY && entry.closes === 0 ? CLOSE_RANGE : CLOSE_KEEP;
    if (!shape || distanceToCollider(self.pos, shape.closedCol) > range) return false;
    // heading out (the goal is not under the roof): the door is the way out
    if (intent.goal && !underRoof(model, intent.goal)) return false;
    // ... or the way to it, under the roof, leads out by this door (another wing), or what it breaks or picks up in
    // place lies on the outer side: the follower would open it again at once
    const outer = !intent.goal && !!intent.aim && (intent.behaviour === "break" || intent.behaviour === "loot");
    if (
        (intent.goal && routeLeaves(ctx, entry, shape, intent.goal)) ||
        (outer && intent.aim && sideOf(shape, intent.aim) * entry.side <= 0)
    ) {
        entry.since = Number.NEGATIVE_INFINITY;
        entry.blockedUntil = now + BLOCKED_FOR;
        entry.spot = null;
        return false;
    }
    const lines = sweepLines(shape, o.view.pos, o.view.ori);
    if (doorBusy(ctx, shape, entry.side, lines)) return false;
    const target: Door = { o, shape, side: entry.side, lines, others: othersNear(ctx, o) };
    if (entry.since === Number.NEGATIVE_INFINITY) entry.since = now;
    if (now - entry.since > PLAN_TIMEOUT) {
        entry.since = Number.NEGATIVE_INFINITY;
        entry.blockedUntil = now + BLOCKED_FOR;
        entry.spot = null;
        return false;
    }
    intent.lookAt = doorMiddle(shape);
    intent.moveDir = null;
    // pressed from where it stands once Use reaches from there: out of the swing while a spot out of it is known (or
    // none was looked for yet), anywhere out of the doorway when the room leaves none (or on the chosen spot)
    const onSpot = !!entry.spot && v2.distance(self.pos, entry.spot) < ON_SPOT;
    const strict = entry.spot ? entry.spotClear && !onSpot : true;
    if (goodSpot(target, self.pos, PRESS_SLACK, strict)) {
        intent.goal = null;
        intent.stop = true;
        if (now - entry.pressedAt >= PRESS_EVERY) {
            entry.pressedAt = now;
            intent.actions.push(Input.Use);
        }
        return true;
    }
    if (!entry.spot || !goodSpot(target, entry.spot, SPOT_SLACK, false)) {
        const found = findSpot(ctx, target);
        entry.spot = found?.pos ?? null;
        entry.spotClear = found?.clear ?? false;
        if (!entry.spot) {
            entry.since = Number.NEGATIVE_INFINITY;
            entry.blockedUntil = now + BLOCKED_FOR;
            return false;
        }
    }
    intent.goal = v2.copy(entry.spot);
    intent.arriveDist = 0.3;
    intent.stop = false;
    return true;
}

/** Behaviours whose standing still may be moved out of a doorway (a spot the brain chose on purpose is left alone). */
const STAND_FREE = new Set<BehaviourName>(["heal", "idle", "explore", "sweep", "regroup"]);

/**
 * Don't stand in a doorway: a bot about to stand still in an open door's doorway (where the panel closes, the way in
 * for anyone) steps out of it, under the roof when one side is inside.
 */
export function leaveDoorway(ctx: BrainCtx, watch: DoorWatch, intent: Intent): void {
    const { model, self } = ctx;
    if (!STAND_FREE.has(intent.behaviour) || self.layer !== 0 || intent.moveDir) return;
    if (!intent.stop && intent.goal && v2.distance(intent.goal, self.pos) > 1) return;
    for (const o of model.obstacles) {
        if (!o.view.door?.open || o.view.dead || !o.def.door || distanceToCollider(self.pos, o.col) > 5) continue;
        const shape = watch.shape(model, o);
        if (!shape || !inDoorway(shape, self.pos, 0.1)) continue;
        const out = PLAYER_RAD + shape.half + 1.2;
        const t = Math.min(shape.t1 - 1, Math.max(shape.t0 + 1, alongOf(shape, self.pos)));
        const base = v2.add(shape.pos, v2.mul(shape.along, t));
        const plus = v2.add(base, v2.mul(shape.normal, out));
        const minus = v2.sub(base, v2.mul(shape.normal, out));
        const inPlus = underRoof(model, plus);
        const first =
            inPlus !== underRoof(model, minus) ? (inPlus ? plus : minus) : sideOf(shape, self.pos) >= 0 ? plus : minus;
        const second = first === plus ? minus : plus;
        const exit = model.nav.walkableAt(first) ? first : model.nav.walkableAt(second) ? second : null;
        if (!exit) return;
        intent.goal = exit;
        intent.arriveDist = 0.4;
        intent.stop = false;
        return;
    }
}
