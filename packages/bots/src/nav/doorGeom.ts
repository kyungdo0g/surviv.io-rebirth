// Door geometry for the bots (BrainFeatures.doors): where a door's panel stands closed and as the snapshot shows it now,
// which side of the doorway a point is on, whether a body stands in the doorway, the path the panel sweeps on its way
// back to closed (a hinged door turns a quarter around its hinge, a sliding door slides along its own length), and
// whether Use from a spot reaches it. Pure functions over the defs, the door's closed spawn (MapData) and its
// ObstacleView, mirroring the simulation: packages/sim/src/world/doors.ts (toggleDoor: a hinged door keeps its position
// and turns by one quarter, a sliding door moves `slideOffset` along its local -y) and interact.ts (Use reaches what a
// circle of interactionRad + the player's radius around the player touches).
import { type Collider, type Vec2, v2 } from "@rebirth/core";
import type { ObstacleDef } from "@rebirth/defs";
import { distanceToCollider, distToSegment, obstacleCollider, rotateOri } from "../geom.ts";
import type { SeenObstacle } from "../perception/world.ts";

/** Player radius (GameConfig.player.radius). */
export const PLAYER_RAD = 1;
/** Orientations sampled along a hinged door's quarter turn. */
const SWING_STEPS = 8;

/** A door as it stands closed. */
export interface DoorShape {
    id: number;
    def: ObstacleDef;
    /** closed position (a hinged door turns around it), quarter turns and scale */
    pos: Vec2;
    ori: number;
    scale: number;
    closedCol: Collider;
    /** unit vectors along the closed panel (its local +y) and across it (local +x) */
    along: Vec2;
    normal: Vec2;
    /** the closed panel's middle line (local y from min to max) and its half thickness */
    a: Vec2;
    b: Vec2;
    half: number;
    /** span of the doorway along `along`, measured from `pos` */
    t0: number;
    t1: number;
    sliding: boolean;
}

/** The panel's middle line at a position and orientation (local y from collision min to max). */
function panelLine(def: ObstacleDef, pos: Vec2, ori: number, scale: number): { a: Vec2; b: Vec2 } | null {
    const c = def.collision;
    if (c.type !== 1) return null;
    const cx = ((c.min.x + c.max.x) / 2) * scale;
    const a = rotateOri({ x: cx, y: c.min.y * scale }, ori);
    const b = rotateOri({ x: cx, y: c.max.y * scale }, ori);
    return { a: v2.add(pos, a), b: v2.add(pos, b) };
}

/** The shape of a door closed at `pos` / `ori` (null for doors without a box collider). */
export function doorShape(id: number, def: ObstacleDef, pos: Vec2, ori: number, scale: number): DoorShape | null {
    const line = panelLine(def, pos, ori, scale);
    const c = def.collision;
    if (!line || c.type !== 1 || !def.door) return null;
    const along = rotateOri({ x: 0, y: 1 }, ori);
    return {
        id,
        def,
        pos: v2.copy(pos),
        ori,
        scale,
        closedCol: obstacleCollider(def, pos, ori, scale),
        along,
        normal: rotateOri({ x: 1, y: 0 }, ori),
        a: line.a,
        b: line.b,
        half: ((c.max.x - c.min.x) / 2) * scale,
        t0: c.min.y * scale,
        t1: c.max.y * scale,
        sliding: def.door.slideToOpen,
    };
}

/** Use reaches the door from this far from its collider (interactionRad + the player's radius; sim interact.ts). */
export function useReach(def: ObstacleDef): number {
    return (def.button?.interactionRad ?? def.door?.interactionRad ?? 0) + PLAYER_RAD;
}

/** Signed distance of `p` from the closed panel's middle line, positive on the door's local +x side. */
export function sideOf(shape: DoorShape, p: Vec2): number {
    return v2.dot(v2.sub(p, shape.a), shape.normal);
}

/** Position of `p` along the doorway, measured from the door's position. */
export function alongOf(shape: DoorShape, p: Vec2): number {
    return v2.dot(v2.sub(p, shape.pos), shape.along);
}

/** The middle of the closed panel. */
export function doorMiddle(shape: DoorShape): Vec2 {
    return v2.lerp(0.5, shape.a, shape.b);
}

/** Whether a body at `p` overlaps the doorway (where the closed panel stands), grown by `margin`. */
export function inDoorway(shape: DoorShape, p: Vec2, margin = 0): boolean {
    const s = Math.abs(sideOf(shape, p));
    const t = alongOf(shape, p);
    return s < PLAYER_RAD + shape.half + margin && t > shape.t0 - margin && t < shape.t1 + margin;
}

/**
 * The lines the panel passes over from where it stands (`pos` / `ori` of its view) back to closed: the turning panel
 * at SWING_STEPS orientations of its quarter turn, or for a sliding door the span from its open to its closed place.
 */
export function sweepLines(shape: DoorShape, pos: Vec2, ori: number): Array<{ a: Vec2; b: Vec2 }> {
    const now = panelLine(shape.def, pos, ori, shape.scale);
    if (!now) return [];
    const closed = { a: shape.a, b: shape.b };
    if (shape.sliding) {
        // collinear: one line from the farthest ends
        const ends = [now.a, now.b, closed.a, closed.b];
        let lo = ends[0];
        let hi = ends[0];
        for (const e of ends) {
            if (alongOf(shape, e) < alongOf(shape, lo)) lo = e;
            if (alongOf(shape, e) > alongOf(shape, hi)) hi = e;
        }
        return [{ a: lo, b: hi }];
    }
    const turn = (((shape.ori - ori) % 4) + 4) % 4;
    if (turn === 0) return [closed];
    // closing turns the panel a quarter counter-clockwise (+1) or clockwise (3) around its position
    const sign = turn === 1 ? 1 : -1;
    const ea = v2.sub(now.a, pos);
    const eb = v2.sub(now.b, pos);
    const out: Array<{ a: Vec2; b: Vec2 }> = [];
    for (let k = 0; k <= SWING_STEPS; k++) {
        const th = (sign * (Math.PI / 2) * k) / SWING_STEPS;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const rot = (e: Vec2) => ({ x: pos.x + e.x * c - e.y * s, y: pos.y + e.x * s + e.y * c });
        out.push({ a: rot(ea), b: rot(eb) });
    }
    return out;
}

/** Whether a body at `p` stays `clearance` away from every line the panel sweeps on its way to closed. */
export function clearOfSweep(shape: DoorShape, lines: ReadonlyArray<{ a: Vec2; b: Vec2 }>, p: Vec2, clearance: number) {
    for (const l of lines) if (distToSegment(p, l.a, l.b) - shape.half < clearance) return false;
    return true;
}

/** Whether Use from `p` reaches the door's collider `col`, with `slack` to spare. */
export function reaches(def: ObstacleDef, col: Collider, p: Vec2, slack: number): boolean {
    return distanceToCollider(p, col) < useReach(def) - slack;
}

/** A door the bots may close by hand: usable, not locked, not automatic, not a one-time door. */
export function closable(def: ObstacleDef): boolean {
    const d = def.door;
    return !!d && d.canUse && !d.locked && !d.autoOpen && !d.openOnce && d.openDelay <= 0;
}
/**
 * A closed door that opens for a bot walking up to it (usable and unlocked: by Use from the follower, or by itself):
 * with BrainFeatures.doors the human keys (bot.ts) do not treat it as a wall to slide along, so the bot walks up to it
 * and opens it instead of veering off along the wall before it opens.
 */
export function opensOnTheWay(o: SeenObstacle): boolean {
    const door = o.view.door;
    return !!door && !!o.def.door && !door.open && door.canUse && !door.locked && !o.view.dead;
}

/** Told about every door the follower uses (BrainFeatures.doors: brain/doors.ts DoorBrain). */
export interface DoorUseSink {
    noteUse(now: number): void;
}
