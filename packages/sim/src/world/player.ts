// Player state, movement with sub-stepped collision, and zoom regions.
// Behaviour follows survev server/src/game/objects/player.ts (update movement block, recalculateSpeed, zoom).
import { type Bounds, collider, math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDef, WeaponSlot } from "@rebirth/defs";
import { emptyInput, type PlayerInput } from "../input.ts";
import type { LocalPlayerState, PlayerView } from "../view.ts";
import type { Building } from "./entities.ts";
import { type Entity, sameLayer, type World } from "./world.ts";

const PLAYER = GameConfig.player;
const ZOOM_RADIUS = GameConfig.scopeZoomRadius.desktop;
/** Extra distance pushed out of an obstacle so the next sub-step starts clear (survev player.ts). */
const PUSH_EPS = 0.001;

/** Number of collision sub-steps for one tick of movement (survev player.ts). */
export function movementSteps(speed: number, dt: number): number {
    return Math.round(Math.max(speed * dt + 5, 5));
}

export class Player {
    readonly kind = "player";
    readonly type = "player";
    readonly id: number;
    readonly name: string;
    pos: Vec2;
    dir: Vec2 = { x: 1, y: 0 };
    layer = 0;
    scale = 1;
    health: number = PLAYER.health;
    boost = 0;
    dead = false;
    downed = false;
    weapons: Array<{ type: string; ammo: number }>;
    curWeapIdx: number = WeaponSlot.Melee;
    outfit: string = PLAYER.defaultItems.outfit;
    backpack: string = PLAYER.defaultItems.backpack;
    helmet: string = PLAYER.defaultItems.helmet;
    chest: string = PLAYER.defaultItems.chest;
    scope: string = PLAYER.defaultItems.scope;
    inventory: Record<string, number> = { ...PLAYER.defaultItems.inventory };
    /** camera zoom radius in world units */
    zoom: number;
    indoors = false;
    insideZoomRegion = false;
    /** speed of the last tick in units per second (0 when standing still) */
    speed = 0;
    input: PlayerInput = emptyInput();
    /** buildings whose ceiling zoom region the player is inside (updated every tick) */
    readonly occupiedBuildings: Building[] = [];
    bounds: Bounds;
    private readonly scratch: Entity[] = [];

    constructor(id: number, name: string, pos: Vec2) {
        this.id = id;
        this.name = name;
        this.pos = v2.copy(pos);
        this.weapons = PLAYER.defaultItems.weapons.map((w) => ({ type: w.type, ammo: w.ammo }));
        this.zoom = ZOOM_RADIUS[this.scope] ?? ZOOM_RADIUS["1xscope"];
        this.bounds = this.computeBounds();
    }

    get rad(): number {
        return PLAYER.radius * this.scale;
    }

    get activeWeapon(): string {
        return this.weapons[this.curWeapIdx]?.type ?? "";
    }

    computeBounds(): Bounds {
        // the broadphase uses the visual radius so partly visible players are still sent
        const r = PLAYER.maxVisualRadius * this.scale;
        return { min: { x: this.pos.x - r, y: this.pos.y - r }, max: { x: this.pos.x + r, y: this.pos.y + r } };
    }

    /** Move speed for this tick (survev player.ts recalculateSpeed, M1 subset: equip speed, water, boost). */
    computeSpeed(world: World): number {
        let speed = this.downed ? PLAYER.downedMoveSpeed : PLAYER.moveSpeed;
        const weapon = this.activeWeapon;
        if (weapon) {
            const def = getDef(weapon) as { speed?: { equip?: number } };
            speed += def.speed?.equip ?? 0;
        }
        if (world.isOnWater(this.pos, this.layer)) speed -= PLAYER.waterSpeedPenalty;
        if (this.boost >= 50) speed += PLAYER.boostMoveSpeed;
        return math.clamp(speed, 1, 10000);
    }

    /** Unit movement vector from the held keys; +y is up, diagonals are normalized. */
    static movementFromInput(input: PlayerInput): Vec2 {
        const m = { x: 0, y: 0 };
        if (input.moveUp) m.y += 1;
        if (input.moveDown) m.y -= 1;
        if (input.moveLeft) m.x -= 1;
        if (input.moveRight) m.x += 1;
        if (m.x !== 0 && m.y !== 0) {
            m.x *= Math.SQRT1_2;
            m.y *= Math.SQRT1_2;
        }
        return m;
    }

    update(world: World, dt: number): void {
        if (this.dead) return;
        const input = this.input;
        if (v2.lengthSqr(input.toMouseDir) > 1e-12) this.dir = v2.normalize(input.toMouseDir);

        const movement = Player.movementFromInput(input);
        const moving = movement.x !== 0 || movement.y !== 0;
        this.speed = moving ? this.computeSpeed(world) : 0;
        const objs = moveWithCollision(world, this, movement, this.speed, dt, this.scratch);

        this.updateZoom(objs);
        this.pos = world.clampToMap(this.pos, this.rad);
        this.bounds = this.computeBounds();
        world.updateBounds(this);
    }

    /** Scope zoom, overridden by building zoom regions while indoors (survev player.ts). */
    private updateZoom(objs: readonly Entity[]): void {
        const lowestZoom = ZOOM_RADIUS["1xscope"];
        let finalZoom = Math.max(lowestZoom, ZOOM_RADIUS[this.scope] ?? lowestZoom);
        let regionZoom = lowestZoom;
        let outsideAllRegions = true;
        this.indoors = false;
        this.occupiedBuildings.length = 0;
        const pos = this.pos;
        const rad = this.rad;
        for (const obj of objs) {
            if (obj.kind !== "building" || obj.ceilingDead) continue;
            // only check the layer when not on stairs
            if (this.layer < 2 && this.layer !== obj.layer) continue;
            for (const region of obj.zoomRegions) {
                if (region.zoomIn && circleTouchesBounds(pos, rad, region.zoomIn)) {
                    this.indoors = true;
                    this.insideZoomRegion = !region.noZoom;
                    outsideAllRegions = false;
                    if (region.zoom) regionZoom = region.zoom;
                    if (!this.occupiedBuildings.includes(obj)) this.occupiedBuildings.push(obj);
                }
                if (region.zoomOut && circleTouchesBounds(pos, rad, region.zoomOut)) {
                    outsideAllRegions = false;
                    if (this.insideZoomRegion && region.zoom) regionZoom = region.zoom;
                }
            }
        }
        if (this.insideZoomRegion) finalZoom = regionZoom;
        if (this.downed) finalZoom = lowestZoom;
        this.zoom = finalZoom;
        if (outsideAllRegions) this.insideZoomRegion = false;
    }

    toView(): PlayerView {
        return {
            id: this.id,
            kind: "player",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            dir: v2.copy(this.dir),
            dead: this.dead,
            downed: this.downed,
            activeWeapon: this.activeWeapon,
            outfit: this.outfit,
            helmet: this.helmet,
            chest: this.chest,
            backpack: this.backpack,
            scale: this.scale,
        };
    }

    localState(): LocalPlayerState {
        return {
            health: this.health,
            boost: this.boost,
            zoom: this.zoom,
            layer: this.layer,
            weapons: this.weapons.map((w) => ({ ...w })),
            curWeapIdx: this.curWeapIdx,
            inventory: { ...this.inventory },
        };
    }
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
    let x = player.pos.x;
    let y = player.pos.y;
    for (let i = 0; i < steps; i++) {
        x += movement.x * stepLen;
        y += movement.y * stepLen;
        for (const obj of objs) {
            if (obj.kind !== "obstacle" || !obj.blocking || !sameLayer(obj.layer, player.layer)) continue;
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
