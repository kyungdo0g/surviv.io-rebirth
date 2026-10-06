// Dead bodies: every player that dies leaves one where it died (the client draws a skull and the player's name). A body
// starts sliding along the killing hit's direction at 10 u/s, slows with drag 4, follows stairs and is never removed;
// explosions do not push it. Behaviour follows survev server/src/game/objects/deadBody.ts (DeadBodyBarn, DeadBody) and
// player.ts kill (addDeadBody(pos, id, layer, params.dir)).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import type { DeadBodyView } from "../view.ts";
import { checkStairs } from "./layers.ts";
import type { Entity, World } from "./world.ts";

/** Initial speed along the killing hit's direction (survev DeadBody: vel = dir * 10). */
const START_SPEED = 10;
/** Velocity drag: vel *= 1 / (1 + dt * 4) (survev DeadBody.update). */
const DRAG = 4;
/** The body moves while a velocity component exceeds this (survev DeadBody.update). */
const MOVE_EPS = 0.001;
/** Broadphase half extent (survev: bounds = createAabbExtents(0, (2, 2))) and stairs radius (checkStairs(objs, 2)). */
const EXTENT = 2;

export class DeadBody {
    readonly kind = "deadBody";
    readonly id: number;
    readonly type = "deadBody";
    /** the player who died here */
    readonly playerId: number;
    pos: Vec2;
    layer: number;
    vel: Vec2;
    oldPos: Vec2;
    bounds: Bounds;

    constructor(id: number, playerId: number, pos: Vec2, layer: number, dir: Vec2) {
        this.id = id;
        this.playerId = playerId;
        this.pos = v2.copy(pos);
        this.layer = layer;
        this.vel = v2.mul(dir, START_SPEED);
        this.oldPos = v2.copy(pos);
        this.bounds = this.computeBounds();
    }

    computeBounds(): Bounds {
        const p = this.pos;
        return { min: { x: p.x - EXTENT, y: p.y - EXTENT }, max: { x: p.x + EXTENT, y: p.y + EXTENT } };
    }

    toView(): DeadBodyView {
        return {
            id: this.id,
            kind: "deadBody",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            playerId: this.playerId,
        };
    }
}

export class DeadBodySystem {
    private readonly world: World;
    /** every body of the game, in creation order */
    readonly bodies: DeadBody[] = [];
    private readonly scratch: Entity[] = [];

    constructor(world: World) {
        this.world = world;
    }

    /** A player died at `pos` on `layer`; `dir` is the killing hit's direction (zero for none). */
    add(pos: Vec2, playerId: number, layer: number, dir: Vec2 | undefined): DeadBody {
        const body = new DeadBody(this.world.allocId(), playerId, pos, layer, dir ?? { x: 0, y: 0 });
        this.bodies.push(body);
        this.world.add(body);
        return body;
    }

    update(dt: number): void {
        for (const body of this.bodies) this.step(body, dt);
    }

    private step(body: DeadBody, dt: number): void {
        const moving =
            Math.abs(body.vel.x) > MOVE_EPS || Math.abs(body.vel.y) > MOVE_EPS || !v2.eq(body.oldPos, body.pos);
        if (!moving) return;
        body.oldPos = v2.copy(body.pos);
        body.vel = v2.mul(body.vel, 1 / (1 + dt * DRAG));
        body.pos = this.world.clampToMap(v2.add(body.pos, v2.mul(body.vel, dt)), 0);
        // survev queries the grid cells of the body's previous bounds (intersectGameObject before updateObject)
        const objs = this.world.query(body.bounds, this.scratch);
        body.layer = checkStairs(body.pos, EXTENT, body.layer, objs).layer;
        if (!v2.eq(body.oldPos, body.pos)) {
            body.bounds = body.computeBounds();
            this.world.updateBounds(body);
        }
    }
}
