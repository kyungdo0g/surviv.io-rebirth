// The room a puzzle, panel or vault door opened (BrainFeatures.puzzles, the "puzzle" behaviour's last stage): walk in
// and break the containers inside, the best first (the ring case, the chrys case, the vault's deposit boxes, gun mounts,
// then crates); the loot behaviour picks up what drops. Furniture blocking a door (the bookshelf in front of the club's
// secret door) goes first. The bot punches, on either floor, from a spot off the container towards the room's middle
// on that floor's grid: no shooting in a closed vault (rounds glance off its walls back at the shooter, and a hit ends
// the attempt: brain/puzzle.ts calm). A container that loses no health for a while is left, and so is one the bot stands
// at without getting any closer or a punch in (a planter in a corner it cannot reach: it pushed against it for 12 s);
// the stage ends when nothing worth breaking is left or after ROOM_TIME. Containers are known from the defs (a player
// knows a vault holds deposit boxes); whether one is still there comes from the snapshot only while the client draws
// it (perception/drawn.ts: the vault's ceiling hides its boxes from a bot still outside the room).
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { colliderCenter, distanceToCollider, pointInBounds } from "../geom.ts";
import { drawnObstacle } from "../perception/drawn.ts";
import type { SeenObstacle } from "../perception/world.ts";
import { closestPoint, containerValue, meleeBreaks, meleeReach, nearSurface, swingLands } from "./containers.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { floorGrid, type PuzzleSite, type SiteRoom } from "./puzzleSites.ts";

/** Seconds in the room stage at most. */
const ROOM_TIME = 50;
/** A container punched for this long without losing health is left ... */
const NO_PROGRESS = 5;
/** ... and one walked to for this long without a punch landing on it ... */
const WALK_LIMIT = 12;
/**
 * ... and one the bot stands at (within SPOT_NEAR of its stand spot, or stepping straight in) for this long without
 * getting NEAR_GAIN closer or landing a punch, or while the path follower reports STUCK_SKIP stuck events walking to it.
 */
const NEAR_LIMIT = 2;
const NEAR_GAIN = 0.1;
const STUCK_SKIP = 2;
/** At the stand spot within this distance: the last steps go straight in. */
const SPOT_NEAR = 0.8;
/** Closer than this, the bot walks straight at the container it punches. */
const APPROACH = 4;
/** Stand this far off a container's surface to punch it. */
const STAND_OFF = 1.4;
/** A blocker missing from the snapshot with the bot this close is gone (broken). */
const BLOCKER_SEEN = 12;
/** What the rooms' special containers hold (loot tiers): worth breaking first. */
const PRIZE_TIERS = ["tier_ring_case", "tier_chrys_case", "tier_club_vault", "tier_eye_block", "tier_guns"];

function insideRoom(ctx: BrainCtx, room: SiteRoom): boolean {
    return (ctx.self.layer & 1) === (room.layer & 1) && pointInBounds(ctx.self.pos, room.bounds);
}

/** Worth of a container in a puzzle room (the prizes first, then containers.ts values). */
function roomValue(o: SeenObstacle): number {
    if (o.def.loot.some((l) => PRIZE_TIERS.includes(l.tier ?? ""))) return 80;
    return containerValue(o);
}

/** A container of the room as the bot sees it now: in the snapshot and drawn on its screen, else undefined. */
function seenContainer(ctx: BrainCtx, id: number): SeenObstacle | undefined {
    const o = ctx.model.obstacleById.get(id);
    return o && drawnObstacle(ctx.model, o) ? o : undefined;
}

/** A container of the room the bot could still break: alive as last seen, breakable by it, not given up. */
function open(ctx: BrainCtx, room: SiteRoom, id: number): boolean {
    // (not the loot blacklist: the scavenge behaviour passes a vault's deposit boxes over while it sees no stand spot
    // for them; the room keeps its own give-ups, trackProgress)
    if (ctx.mem.puzzle.roomSkip.has(id)) return false;
    const o = seenContainer(ctx, id);
    // not drawn (out of the snapshot, under the room's ceiling seen from outside): still there unless the bot stands in
    // the room (everything inside is in view there)
    if (!o) return !insideRoom(ctx, room);
    return !o.view.dead && meleeBreaks(ctx.self, o);
}

/**
 * The first room not looked into yet (loot lies on its floor: the club vault's machete) or with something left to
 * break, or null. A room the path follower just failed to reach from outside it, while the bot's grids show no way to
 * it, is given up with everything in it: the greenhouse bunker's compartment 3 lies behind a glass wall (only breaking
 * it lets a player in), and its case and crates, taken as still standing while the bot is not in the room, kept the bot
 * walking at it for the rest of the stage (move-slide: 30 s along the glass).
 */
function currentRoom(ctx: BrainCtx, site: PuzzleSite): SiteRoom | null {
    const pm = ctx.mem.puzzle;
    const failed = ctx.mem.failedGoal;
    site.rooms.forEach((r, i) => {
        const gaveUp = !!failed && ctx.now < ctx.mem.failedUntil && pointInBounds(failed, grow(r.bounds, 2));
        const inside = insideRoom(ctx, r);
        if (inside || gaveUp) pm.visited.add(i);
        if (failed && gaveUp && !inside && cutOff(ctx, failed, r.layer))
            for (const id of r.containers) pm.roomSkip.add(id);
    });
    for (let i = 0; i < site.rooms.length; i++) {
        const r = site.rooms[i];
        if (!pm.visited.has(i) || r.containers.some((id) => open(ctx, r, id))) return r;
    }
    return null;
}

/**
 * Whether the bot's grids show no way to `p` on the floor `layer` now. Another failure keeps the room (move-slide
 * review): a goal that failed while the doors were shut (forgetVerdicts clears only those within 12 of a room's middle,
 * and the bathhouse vault reaches 15 out), one on the floor above an underground room (room bounds are flat), a bot held
 * up once on the way in. With a stale failure in its far corner, the bathhouse vault and the greenhouse bunker's sublevel
 * were given up untouched (0 of 9 and 0 of 5 containers broken, against 7 and 4 without the give-up).
 */
function cutOff(ctx: BrainCtx, p: Vec2, layer: number): boolean {
    const ug = ctx.model.underground;
    if (ug) return !ug.canPathTo(ctx.model.nav, ctx.self.pos, ctx.self.layer, p, layer);
    // (no underground navigation: no underground site either, puzzle.ts)
    return !ctx.model.nav.reachable(ctx.self.pos, p);
}

function grow(b: SiteRoom["bounds"], m: number): SiteRoom["bounds"] {
    return { min: { x: b.min.x - m, y: b.min.y - m }, max: { x: b.max.x + m, y: b.max.y + m } };
}

/** Whether the room stage is over: nothing left to break, or it took too long. */
export function roomDone(ctx: BrainCtx, site: PuzzleSite): boolean {
    const pm = ctx.mem.puzzle;
    return ctx.now - pm.since > ROOM_TIME || currentRoom(ctx, site) === null;
}

/** The container to break next: the best in view, discounted by distance. */
function pickContainer(ctx: BrainCtx, room: SiteRoom): SeenObstacle | null {
    let best: SeenObstacle | null = null;
    let bestScore = 0;
    for (const id of room.containers) {
        const o = seenContainer(ctx, id);
        if (!o || !open(ctx, room, id)) continue;
        const d = distanceToCollider(ctx.self.pos, o.col);
        const s = (roomValue(o) / (1 + d / 10)) * (id === ctx.mem.puzzle.roomTarget ? 1.5 : 1);
        if (s > bestScore) {
            bestScore = s;
            best = o;
        }
    }
    return best;
}

/** How the punch went: swinging at it, at its stand spot (or stepping straight in), or walking there. */
type PunchState = "swing" | "near" | "walk";

/**
 * Gives up on a container that loses no health while the bot punches it (the clock runs only while it does), that it
 * stands at without getting closer or a punch in (NEAR_LIMIT), or that the follower gets stuck walking to.
 */
function trackProgress(ctx: BrainCtx, o: SeenObstacle, state: PunchState): boolean {
    const pm = ctx.mem.puzzle;
    const id = o.view.id;
    const dt = Math.min(0.5, Math.max(0, ctx.now - pm.roomAt));
    pm.roomAt = ctx.now;
    if (pm.roomTarget !== id || o.view.healthT < pm.roomHealth - 1e-6) {
        pm.roomTarget = id;
        pm.roomHealth = o.view.healthT;
        pm.roomSince = 0;
        pm.roomWalk = ctx.now;
        pm.roomBest = Number.POSITIVE_INFINITY;
        pm.roomNear = 0;
        pm.roomStuck = pm.followerStuck;
        return false;
    }
    if (state === "swing") {
        pm.roomSince += dt;
        pm.roomWalk = ctx.now;
        pm.roomNear = 0;
    } else if (state === "near") {
        // at the spot: closer by NEAR_GAIN is progress, else the clock runs (walking back to the spot pauses it)
        const d = distanceToCollider(ctx.self.pos, o.col);
        if (d < pm.roomBest - NEAR_GAIN) {
            pm.roomBest = d;
            pm.roomNear = 0;
        } else pm.roomNear += dt;
    }
    // punched without a dent, walked to without ever getting a punch in, standing at it without getting closer, or the
    // way to it gets the follower stuck: something is in the way
    const stuck = pm.followerStuck - pm.roomStuck >= STUCK_SKIP;
    if (pm.roomSince > NO_PROGRESS || ctx.now - pm.roomWalk > WALK_LIMIT || pm.roomNear > NEAR_LIMIT || stuck) {
        pm.roomSkip.add(id);
        pm.roomTarget = 0;
        return true;
    }
    return false;
}

/** Punches a container: a spot off its surface towards `side` (the room's middle) on its floor's grid, then in. */
function punch(ctx: BrainCtx, layer: number, side: Vec2, o: SeenObstacle, intent: Intent): PunchState {
    const me = ctx.self.pos;
    const d = distanceToCollider(me, o.col);
    const floor = (ctx.self.layer & 1) === (layer & 1);
    const clear = floor && ctx.model.lineOfFire(me, nearSurface(o, me));
    const aim = closestPoint(o, me);
    intent.slot = WeaponSlot.Melee;
    // (the sim's swing hits whatever its circle overlaps most: from a doorway the wall takes the blow)
    if (d <= meleeReach(ctx.self) && clear && swingLands(ctx, o, me)) {
        intent.stop = true;
        intent.aim = aim;
        intent.fire = ctx.self.curWeapIdx === WeaponSlot.Melee;
        return "swing";
    }
    const c = colliderCenter(o.col);
    const out = v2.normalizeSafe(v2.sub(side, c), { x: 0, y: 1 });
    const want = v2.add(closestPoint(o, v2.add(c, v2.mul(out, 50))), v2.mul(out, STAND_OFF));
    const spot = floorSpot(ctx, want, layer);
    if (spot && v2.distance(me, spot) > SPOT_NEAR) {
        walkOnFloor(ctx, spot, layer, intent, 0.4);
        return "walk";
    }
    if (d < APPROACH && clear) {
        // at the spot: the last steps straight in
        intent.moveDir = v2.normalizeSafe(v2.sub(aim, me));
        intent.aim = aim;
    } else walkOnFloor(ctx, want, layer, intent, 0.4);
    return spot ? "near" : "walk";
}

/** The walkable cell nearest `p` on its floor's grid, or null. */
function floorSpot(ctx: BrainCtx, p: Vec2, layer: number): Vec2 | null {
    const grid = floorGrid(ctx.model, layer, p);
    const cell = grid ? grid.nearestWalkable(p, 3) : -1;
    return grid && cell >= 0 ? grid.center(cell) : null;
}

/** Walks to the walkable cell nearest `p` on its floor's grid. */
function walkOnFloor(ctx: BrainCtx, p: Vec2, layer: number, intent: Intent, arrive: number): void {
    const grid = floorGrid(ctx.model, layer, p);
    const cell = grid ? grid.nearestWalkable(p, 4) : -1;
    intent.goal = grid && cell >= 0 ? grid.center(cell) : v2.copy(p);
    intent.goalLayer = layer & 1;
    intent.arriveDist = arrive;
}

/**
 * A breakable obstacle still standing in front of the doors (the club's bookshelf), or null. One seen broken (or gone
 * from the snapshot with the bot close by) has the floor's grid relabelled once: the room behind joins the map.
 */
function standingBlocker(ctx: BrainCtx, site: PuzzleSite): SeenObstacle | null {
    const pm = ctx.mem.puzzle;
    for (const b of site.blockers) {
        if (pm.roomSkip.has(b.id) || pm.cleared.has(b.id)) continue;
        const o = ctx.model.obstacleById.get(b.id);
        // (one not drawn on the screen is taken as standing until the bot sees it: a player expects the bookshelf)
        if (o && (!o.view.dead || !drawnObstacle(ctx.model, o))) {
            if (meleeBreaks(ctx.self, o)) return o;
            continue;
        }
        if (o?.view.dead || v2.distance(ctx.self.pos, b.pos) < BLOCKER_SEEN) {
            pm.cleared.add(b.id);
            floorGrid(ctx.model, b.layer, b.pos)?.relabelSoon();
        }
    }
    return null;
}

/** Breaks `o` on its floor by punching it from the `side` it is approached from. */
function breakOne(ctx: BrainCtx, layer: number, side: Vec2, o: SeenObstacle, intent: Intent): void {
    const state = punch(ctx, layer, side, o, intent);
    if (trackProgress(ctx, o, state)) {
        intent.stop = true;
        intent.fire = false;
    }
}

/** The room stage's step: the blockers in front of the doors, into the room, then the containers one by one. */
export function planRoom(ctx: BrainCtx, site: PuzzleSite, intent: Intent): void {
    const blocker = standingBlocker(ctx, site);
    if (blocker) {
        breakOne(ctx, blocker.view.layer, ctx.self.pos, blocker, intent);
        return;
    }
    const room = currentRoom(ctx, site);
    if (!room) return;
    const o = insideRoom(ctx, room) || ctx.self.layer === room.layer ? pickContainer(ctx, room) : null;
    if (!o) {
        walkOnFloor(ctx, room.center, room.layer, intent, 2);
        return;
    }
    breakOne(ctx, room.layer, room.center, o, intent);
}
