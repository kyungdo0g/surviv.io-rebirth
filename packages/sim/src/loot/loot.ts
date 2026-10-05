// Loot items lying on the ground: spawning (with side ammo stacks for guns) and physics (push apart, drag,
// obstacle push-out, river drift). Behaviour follows survev server/src/game/objects/loot.ts.
import { type Bounds, collider, Grid, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDef, hasDef } from "@rebirth/defs";
import { pointInBounds } from "../geom/polygon.ts";
import { riverWaterAt } from "../mapgen/terrainQuery.ts";
import type { LootView } from "../view.ts";
import { type Entity, sameLayer, type World } from "../world/world.ts";

/** Side ammo stacks sit 0.75 left/right of a spawned gun (survev loot.ts AMMO_OFFSET_X/Y). */
const AMMO_OFFSET_X = 0.75;
const AMMO_OFFSET_Y = -0.075;
/** Default push speed of new loot (survev Loot constructor). */
const DEFAULT_PUSH_SPEED = 4.75;
/** Loot-to-loot collision uses a radius 1.25x the pickup radius (survev: matches recorded original packets). */
const LOOT_COLLISION_RAD_MULT = 1.25;
/** Push-apart force: max(pen / rad, 0.125) * 2.5 per second (survev LootBarn.update). */
const PUSH_FORCE = 2.5;
const PUSH_MIN = 0.125;
/** Velocity drag: vel *= 1 / (1 + dt * 2.5) (survev Loot.update). */
const DRAG = 2.5;
/** Loot "sleeps" when slower than this and not moved since the last physics step (survev Loot.update). */
const SLEEP_EPS = 0.01;
/** River current: the spline tangent times 0.5 per second (survev Loot.update). */
const RIVER_PUSH = 0.5;

export interface AddLootOptions {
    /** initial speed along `dir` (default 4.75) */
    pushSpeed?: number;
    /** push direction (default: random) */
    dir?: Vec2;
    /** guns: drop `count` rounds as the side stacks instead of the def's ammoSpawnCount (player drops) */
    useCountForAmmo?: boolean;
    /** guns: no side ammo stacks (items put back on the ground by a refused pickup) */
    noSideAmmo?: boolean;
    /** guns: carry ammoSpawnCount inside instead of side stacks (preload tables) */
    preloadGun?: boolean;
    source?: "player" | "obstacle" | "map";
}

export class Loot {
    readonly kind = "loot";
    readonly id: number;
    readonly type: string;
    readonly defType: string;
    count: number;
    pos: Vec2;
    vel: Vec2 = { x: 0, y: 0 };
    layer: number;
    /** pickup radius (GameConfig.lootRadius by item kind) */
    readonly rad: number;
    /** radius used to push loot apart */
    readonly lootRad: number;
    isPreloadedGun = false;
    destroyed = false;
    bounds: Bounds;
    /** physics is skipped while asleep (not moving); set when something around it changes */
    awake = true;
    /** pushed by an overlapping item this tick (keeps it awake until the pair separates) */
    pushed = false;
    /** position at the last physics step, for the sleep test */
    lastPos: Vec2;

    constructor(id: number, type: string, pos: Vec2, layer: number, count: number) {
        const def = getDef(type);
        this.id = id;
        this.type = type;
        this.defType = def.type;
        this.count = def.type === "gun" ? 1 : count;
        this.pos = v2.copy(pos);
        this.lastPos = v2.copy(pos);
        this.layer = layer;
        this.rad = GameConfig.lootRadius[def.type] ?? 1;
        this.lootRad = this.rad * LOOT_COLLISION_RAD_MULT;
        this.bounds = this.computeBounds();
    }

    computeBounds(): Bounds {
        const r = this.lootRad;
        return { min: { x: this.pos.x - r, y: this.pos.y - r }, max: { x: this.pos.x + r, y: this.pos.y + r } };
    }

    push(dir: Vec2, speed: number): void {
        this.vel = v2.add(this.vel, v2.mul(dir, speed));
        this.awake = true;
    }

    toView(): LootView {
        return {
            id: this.id,
            kind: "loot",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            count: this.count,
        };
    }
}

export function isLootType(type: string): boolean {
    if (!type || !hasDef(type)) return false;
    return "lootImg" in getDef(type);
}

export class LootSystem {
    private readonly world: World;
    /** loot random stream, read on use (the game may swap it) */
    private readonly rngOf: () => Rng;
    /** live loot by id (ids increase, so iteration is in creation order) */
    readonly items = new Map<number, Loot>();
    /** loot-only broadphase for the push-apart pass */
    private readonly grid: Grid<Loot>;
    private readonly scratch: Entity[] = [];
    private readonly lootScratch: Loot[] = [];

    constructor(world: World, rngOf: () => Rng) {
        this.world = world;
        this.rngOf = rngOf;
        this.grid = new Grid<Loot>(world.width, world.height, 16);
    }

    /**
     * Drops an item. Guns get their ammo as two side stacks (ceil(n/2) left, the rest right) unless preloaded or
     * `noSideAmmo`. Returns the item, or null for types that cannot be loot.
     */
    addLoot(type: string, pos: Vec2, layer: number, count: number, opts: AddLootOptions = {}): Loot | null {
        if (!isLootType(type)) return null;
        const def = getDef(type);
        const pushSpeed = opts.pushSpeed ?? DEFAULT_PUSH_SPEED;
        const dir = opts.dir ?? v2.randomUnit(this.rngOf());
        const loot = this.spawn(type, pos, layer, count, pushSpeed, dir);
        if (opts.noSideAmmo || def.type !== "gun") return loot;
        if (opts.preloadGun && !def.ammoInfinite && opts.source !== "player") {
            loot.isPreloadedGun = true;
            return loot;
        }
        if (!isLootType(def.ammo)) return loot;
        const ammoCount = opts.useCountForAmmo ? count : def.ammoSpawnCount;
        if (ammoCount <= 0) return loot;
        const half = Math.ceil(ammoCount / 2);
        this.spawn(def.ammo, v2.add(pos, { x: -AMMO_OFFSET_X, y: AMMO_OFFSET_Y }), layer, half, pushSpeed, dir);
        if (ammoCount - half >= 1) {
            this.spawn(
                def.ammo,
                v2.add(pos, { x: AMMO_OFFSET_X, y: AMMO_OFFSET_Y }),
                layer,
                ammoCount - half,
                pushSpeed,
                dir,
            );
        }
        return loot;
    }

    private spawn(type: string, pos: Vec2, layer: number, count: number, pushSpeed: number, dir: Vec2): Loot {
        const loot = new Loot(this.world.allocId(), type, this.world.clampToMap(pos, 0), layer, count);
        loot.push(dir, pushSpeed);
        this.items.set(loot.id, loot);
        this.grid.insert(loot, loot.bounds);
        this.world.add(loot);
        return loot;
    }

    /** Removes an item (picked up). */
    remove(loot: Loot): void {
        if (loot.destroyed) return;
        loot.destroyed = true;
        this.items.delete(loot.id);
        this.grid.remove(loot);
        this.world.remove(loot);
        this.wakeAround(loot.bounds, loot.layer);
    }

    /** Wakes loot touching `bounds` (an obstacle shrank or died, an item was removed). */
    wakeAround(bounds: Bounds, layer: number): void {
        for (const other of this.grid.query(bounds, this.lootScratch)) {
            if (sameLayer(other.layer, layer)) other.awake = true;
        }
    }

    update(dt: number): void {
        this.pushApart(dt);
        for (const loot of this.items.values()) {
            if (loot.awake) this.step(loot, dt);
        }
    }

    /** Overlapping items on the same layer push each other apart; only pairs with an awake item are checked. */
    private pushApart(dt: number): void {
        for (const a of this.items.values()) {
            if (!a.awake) continue;
            for (const b of this.grid.query(a.bounds, this.lootScratch)) {
                if (b === a || (b.awake && b.id < a.id) || !sameLayer(a.layer, b.layer)) continue;
                const res = collider.intersect(
                    { type: 0, pos: b.pos, rad: b.lootRad },
                    { type: 0, pos: a.pos, rad: a.lootRad },
                );
                if (!res) continue;
                // res.dir points from a towards b
                const forceA = Math.max(res.pen / a.lootRad, PUSH_MIN) * PUSH_FORCE;
                const forceB = Math.max(res.pen / b.lootRad, PUSH_MIN) * PUSH_FORCE;
                a.pos = v2.sub(a.pos, v2.mul(res.dir, forceA * dt));
                b.pos = v2.add(b.pos, v2.mul(res.dir, forceB * dt));
                a.pushed = true;
                b.pushed = true;
                b.awake = true;
                this.syncBounds(a);
                this.syncBounds(b);
            }
        }
    }

    private syncBounds(loot: Loot): void {
        loot.bounds = loot.computeBounds();
        this.grid.update(loot, loot.bounds);
        this.world.updateBounds(loot);
    }

    private step(loot: Loot, dt: number): void {
        const moving = !v2.eq(loot.vel, { x: 0, y: 0 }, SLEEP_EPS);
        if (!moving && !loot.pushed && v2.eq(loot.lastPos, loot.pos, SLEEP_EPS)) {
            loot.vel = { x: 0, y: 0 };
            loot.awake = false;
            return;
        }
        loot.pushed = false;
        loot.vel = v2.mul(loot.vel, 1 / (1 + dt * DRAG));
        loot.pos = v2.add(loot.pos, v2.mul(loot.vel, dt));

        let onFloor = false;
        for (const obj of this.world.query(loot.bounds, this.scratch)) {
            if (obj.kind === "obstacle") {
                if (!obj.blocking || !sameLayer(obj.layer, loot.layer)) continue;
                const res = collider.intersect({ type: 0, pos: loot.pos, rad: loot.rad }, obj.collider);
                if (res) loot.pos = v2.add(loot.pos, v2.mul(res.dir, res.pen + 0.001));
            } else if (obj.kind === "building" && obj.layer === loot.layer) {
                // floors (bridges, houses) shield loot from river currents
                if (obj.surfaces.some((s) => s.colliders.some((c) => collider.contains(c, loot.pos)))) onFloor = true;
            }
        }
        if (!onFloor && loot.layer === 0 && pointInBounds(loot.pos, this.world.terrain.shoreBounds)) {
            const river = riverWaterAt(this.world.terrain, loot.pos);
            if (river && !river.looped) {
                const tangent = river.spline.getTangent(river.spline.getClosestT(loot.pos));
                loot.vel = v2.add(loot.vel, v2.mul(tangent, RIVER_PUSH * dt));
            }
        }
        loot.pos = this.world.clampToMap(loot.pos, loot.rad);
        loot.lastPos = v2.copy(loot.pos);
        this.syncBounds(loot);
    }
}
