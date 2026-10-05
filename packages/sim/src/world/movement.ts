// Player movement helpers: collision sub-steps against blocking obstacles and the circle-vs-box test of zoom regions.
// Behaviour follows survev server/src/game/objects/player.ts (update: "Calculate new speed, position and check for
// collision with obstacles").
import { type Bounds, collider, math, type Vec2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import type { Player } from "./player.ts";
import { type Entity, sameLayer, type World } from "./world.ts";

const PLAYER = GameConfig.player;
/** Extra distance pushed out of an obstacle so the next sub-step starts clear (survev player.ts). */
const PUSH_EPS = 0.001;

/** Number of collision sub-steps for one tick of movement (survev player.ts). */
export function movementSteps(speed: number, dt: number): number {
    return Math.round(Math.max(speed * dt + 5, 5));
}

/** Circle vs box overlap, inclusive of the centre lying inside (survev coldet.testCircleAabb). */
export function circleTouchesBounds(pos: Vec2, rad: number, b: Bounds): boolean {
    const cx = math.clamp(pos.x, b.min.x, b.max.x);
    const cy = math.clamp(pos.y, b.min.y, b.max.y);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    return dx * dx + dy * dy < rad * rad || (dx === 0 && dy === 0);
}

/**
 * Moves the player along `movement` (unit or zero vector) at `speed` for `dt` seconds in sub-steps, pushing
 * it out of blocking obstacles on its layer after each sub-step so it can never tunnel through them.
 * Returns the broadphase result (also used for zoom regions).
 */
export function moveWithCollision(
    world: World,
    player: Player,
    movement: Vec2,
    speed: number,
    dt: number,
    out: Entity[] = [],
): Entity[] {
    const moving = movement.x !== 0 || movement.y !== 0;
    const steps = moving ? movementSteps(speed, dt) : 1;
    const reach = PLAYER.maxVisualRadius * player.scale + speed * dt;
    const query = {
        min: { x: player.pos.x - reach, y: player.pos.y - reach },
        max: { x: player.pos.x + reach, y: player.pos.y + reach },
    };
    const objs = world.query(query, out);
    const stepLen = moving ? (speed / steps) * dt : 0;
    const rad = player.rad;
    // One With Nature walks through trees (survev player.ts update: obj.isTree && hasTreeClimbing)
    const throughTrees = player.hasPerk("tree_climbing");
    let x = player.pos.x;
    let y = player.pos.y;
    for (let i = 0; i < steps; i++) {
        x += movement.x * stepLen;
        y += movement.y * stepLen;
        for (const obj of objs) {
            if (obj.kind !== "obstacle" || !obj.blocking || !sameLayer(obj.layer, player.layer)) continue;
            if (throughTrees && obj.isTree) continue;
            const res = collider.intersect({ type: 0, pos: { x, y }, rad }, obj.collider);
            if (res) {
                x += res.dir.x * (res.pen + PUSH_EPS);
                y += res.dir.y * (res.pen + PUSH_EPS);
            }
        }
    }
    player.pos = { x, y };
    return objs;
}
