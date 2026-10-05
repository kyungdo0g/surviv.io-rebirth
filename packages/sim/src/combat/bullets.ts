// Bullets: swept per-tick flight, obstacle/player/pan collisions, ricochets, falloff; damage is queued and applied
// after every bullet moved. Behaviour follows survev server/src/game/objects/bullet.ts and
// docs/research/items/bullets.md "Server simulation".
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { type BulletDef, DamageType, GameConfig, getDefOfType } from "@rebirth/defs";
import { intersectSegmentSegment } from "../geom/polygon.ts";
import type { BulletEvent } from "../view.ts";
import type { SimContext } from "../world/context.ts";
import type { Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { type Entity, sameLayer, type World } from "../world/world.ts";
import type { DamageParams } from "./damage.ts";

/** Upper bound of a bullet range (survev net.ts Constants.MaxPosition). */
const MAX_DISTANCE = 1024;
/** Range jitter index range: distAdj = remap(randomInt(0, 16), 0..16 -> -1..1) (survev bullet.ts). */
const DIST_ADJ_STEPS = 16;
/** A pan hit point is moved 0.2 back along the bullet so the ricochet starts outside the pan (survev). */
const PAN_HIT_BACKOFF = 0.2;

export interface FireBulletParams {
    shooterId: number;
    bulletType: string;
    /** weapon id (damage attribution, headshotMult) */
    sourceType: string;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    damageMult?: number;
    reflectCount?: number;
    /** object the bullet ricocheted off; it cannot hit it again */
    reflectObjId?: number;
    /** variance factor input in 0..1 (guns fire with 1; every gun bullet has variance 0) */
    varianceT?: number;
    shotFx?: boolean;
    offHand?: boolean;
}

export interface Bullet {
    readonly id: number;
    readonly shooterId: number;
    readonly bulletType: string;
    readonly def: BulletDef;
    readonly sourceType: string;
    readonly startPos: Vec2;
    pos: Vec2;
    readonly dir: Vec2;
    readonly layer: number;
    readonly speed: number;
    /** maximum travel distance of this bullet (after range jitter) */
    readonly distance: number;
    /** travel distance until the first indestructible obstacle on the path (what clients draw) */
    readonly clientDistance: number;
    distanceTraveled: number;
    readonly damage: number;
    readonly damageMult: number;
    readonly reflectCount: number;
    readonly reflectObjId: number;
    readonly varianceT: number;
    /** ricochets and shrapnel may hit their own shooter */
    readonly damageSelf: boolean;
    readonly shotFx: boolean;
    readonly offHand: boolean;
    alive: boolean;
    /** this bullet already spawned its ricochet (one per bullet per update) */
    reflected: boolean;
    hitPlayer: boolean;
    readonly damagedIds: Set<number>;
    /** tick of the snapshot-visible report: creation, then again when it hits a player */
    reportTicks: number[];
}

interface Collision {
    type: "obstacle" | "player" | "pan";
    obj?: Obstacle | Player;
    collidable: boolean;
    point: Vec2;
    normal: Vec2;
    /** squared distance from the bullet start */
    dist: number;
}

export interface QueuedDamage {
    target: Obstacle | Player;
    params: DamageParams;
}

/** Segment of an active pan in world space at a player transform (survev player.ts getPanSegment). */
export function panSegment(player: Player, pos: Vec2, dir: Vec2): { p0: Vec2; p1: Vec2 } {
    const surface = getDefOfType("melee", "pan").reflectSurface;
    if (!surface) throw new Error("pan has no reflect surface");
    let { p0, p1 } = player.wearingPan ? surface.unequipped : surface.equipped;
    if (player.scale !== 1) {
        if (player.wearingPan) {
            p0 = v2.mul(p0, player.scale);
            p1 = v2.mul(p1, player.scale);
        } else {
            const s = (player.scale - 1) * 0.75;
            p0 = v2.add(p0, { x: s, y: -s });
            p1 = v2.add(p1, { x: s, y: -s });
        }
    }
    const ang = Math.atan2(dir.y, dir.x);
    return { p0: v2.add(pos, v2.rotate(p0, ang)), p1: v2.add(pos, v2.rotate(p1, ang)) };
}

/** What the bullet system reads from the game; random streams and rules are read on use, so they can be swapped. */
export type BulletContext = Pick<SimContext, "world" | "rules" | "combatRng" | "getPlayer">;

export class BulletSystem {
    private readonly ctx: BulletContext;
    private readonly world: World;
    private nextId = 1;
    /** bullets still flying */
    active: Bullet[] = [];
    /** damage of the current update, applied by the game after all bullets moved */
    readonly damages: QueuedDamage[] = [];
    /** bullets reported to snapshots, oldest first (pruned by the game) */
    readonly reports: Array<{ tick: number; bullet: Bullet }> = [];
    private readonly scratch: Entity[] = [];
    /** current tick, for reports */
    tick = 0;

    constructor(ctx: BulletContext) {
        this.ctx = ctx;
        this.world = ctx.world;
    }

    fire(p: FireBulletParams): Bullet {
        const def = getDefOfType("bullet", p.bulletType);
        const pos = this.world.clampToMap(p.pos, 0);
        const dir = v2.normalize(p.dir);
        const reflectCount = p.reflectCount ?? 0;
        const varianceT = p.varianceT ?? 1;
        const variance = 1 + varianceT * def.variance;
        const noDistAdj = this.ctx.rules.noDistAdjBullets.includes(p.bulletType);
        const distAdjIdx = noDistAdj ? DIST_ADJ_STEPS / 2 : this.ctx.combatRng.int(0, DIST_ADJ_STEPS);
        const distAdj = math.remap(distAdjIdx, 0, DIST_ADJ_STEPS, -1, 1);
        // each ricochet divides the range by reflectDistDecay (1.5)
        const baseDistance = def.distance / GameConfig.bullet.reflectDistDecay ** reflectCount;
        const distance = math.clamp(baseDistance * variance + distAdj, 0, MAX_DISTANCE);
        const reflectObjId = p.reflectObjId ?? 0;
        const bullet: Bullet = {
            id: this.nextId++,
            shooterId: p.shooterId,
            bulletType: p.bulletType,
            def,
            sourceType: p.sourceType,
            startPos: v2.copy(pos),
            pos: v2.copy(pos),
            dir,
            layer: p.layer,
            speed: def.speed * variance,
            distance,
            clientDistance: this.clientDistance(pos, dir, distance, p.layer, reflectObjId),
            distanceTraveled: 0,
            damage: def.damage * (p.damageMult ?? 1),
            damageMult: p.damageMult ?? 1,
            reflectCount,
            reflectObjId,
            varianceT,
            damageSelf: reflectCount > 0 || def.shrapnel,
            shotFx: p.shotFx ?? false,
            offHand: p.offHand ?? false,
            alive: true,
            reflected: false,
            hitPlayer: false,
            damagedIds: new Set(),
            reportTicks: [this.tick],
        };
        this.active.push(bullet);
        this.reports.push({ tick: this.tick, bullet });
        return bullet;
    }

    /** Distance to the first indestructible obstacle on the path, capped at the range (survev clientEndPos). */
    private clientDistance(pos: Vec2, dir: Vec2, distance: number, layer: number, reflectObjId: number): number {
        const end = v2.add(pos, v2.mul(dir, distance));
        let best = distance;
        for (const obj of this.world.querySegment(pos, end, this.scratch)) {
            if (obj.kind !== "obstacle" || obj.destructible || obj.dead || obj.id === reflectObjId) continue;
            if (obj.height < GameConfig.bullet.height || !sameLayer(obj.layer, layer)) continue;
            const res = collider.intersectSegment(obj.collider, pos, end);
            if (res && res.dist < best) best = res.dist;
        }
        return best;
    }

    /** Moves every bullet one tick (ricochets spawned this tick move in the same tick, as in survev). */
    update(dt: number): void {
        const list = this.active;
        for (let i = 0; i < list.length; i++) {
            if (list[i].alive) this.step(list[i], dt);
        }
        this.active = list.filter((b) => b.alive);
    }

    private step(b: Bullet, dt: number): void {
        const posOld = v2.copy(b.pos);
        const distLeft = b.distance - v2.distance(b.startPos, b.pos);
        const moveDist = Math.min(distLeft, dt * b.speed);
        b.distanceTraveled += moveDist;
        b.pos = v2.add(b.pos, v2.mul(b.dir, moveDist));
        const w = this.world;
        if (b.pos.x < 0 || b.pos.y < 0 || b.pos.x > w.width || b.pos.y > w.height) {
            b.alive = false;
            b.pos = w.clampToMap(b.pos, 0);
        }
        if (!b.def.skipCollision) this.collide(b, posOld);
        if (math.eqAbs(b.distanceTraveled, b.distance, 0.001)) b.alive = false;
        // TODO(M5): bullets with an onHit explosion (bullet_frag) explode where they die
        if (!b.alive && b.hitPlayer && b.reportTicks[b.reportTicks.length - 1] !== this.tick) {
            b.reportTicks.push(this.tick);
            this.reports.push({ tick: this.tick, bullet: b });
        }
    }

    private collide(b: Bullet, posOld: Vec2): void {
        const collisions: Collision[] = [];
        for (const obj of this.world.querySegment(posOld, b.pos, this.scratch)) {
            if (obj.kind === "obstacle") {
                if (obj.dead || !sameLayer(obj.layer, b.layer) || obj.height < GameConfig.bullet.height) continue;
                if (obj.id === b.reflectObjId) continue;
                const res = collider.intersectSegment(obj.collider, posOld, b.pos);
                if (res) {
                    const dist = v2.distanceSqr(res.point, b.startPos);
                    collisions.push({
                        type: "obstacle",
                        obj,
                        collidable: obj.collidable,
                        point: res.point,
                        normal: res.normal,
                        dist,
                    });
                }
            } else if (obj.kind === "player") {
                this.collidePlayer(b, posOld, obj, collisions);
            }
        }
        if (collisions.length === 0) return;
        collisions.sort((x, y) => x.dist - y.dist);

        const shooter = this.ctx.getPlayer(b.shooterId);
        const shooterDead = !!shooter && (shooter.dead || shooter.downed);
        let damage = b.damage / (b.reflectCount + 1);
        if (GameConfig.bullet.falloff) {
            // linear from full damage at the muzzle to `falloff` at this bullet's maximum range
            const t = math.clamp(b.distanceTraveled / b.distance, 0, 1);
            damage *= math.lerp(t, 1, b.def.falloff);
        }
        for (const col of collisions) {
            // each obstacle takes at most one hit per bullet (players stop the bullet anyway)
            if (col.type === "obstacle" && col.obj) {
                if (b.damagedIds.has(col.obj.id)) continue;
                b.damagedIds.add(col.obj.id);
            }
            let hit = false;
            if (col.type === "obstacle") {
                const obstacle = col.obj as Obstacle;
                this.damages.push({ target: obstacle, params: this.params(b, damage * b.def.obstacleDamage) });
                if (obstacle.def.reflectBullets) this.reflect(b, col.point, col.normal, obstacle.id);
                // non-collidable obstacles take the hit but let the bullet pass
                hit = col.collidable;
            } else if (col.type === "player") {
                if (!shooterDead) {
                    const params = this.params(b, damage);
                    params.isExplosion = b.def.shrapnel;
                    this.damages.push({ target: col.obj as Player, params });
                }
                b.hitPlayer = true;
                hit = col.collidable;
            } else {
                hit = col.collidable;
                this.reflect(b, col.point, col.normal, col.obj?.id ?? 0);
            }
            if (hit) {
                b.pos = col.point;
                b.distanceTraveled = v2.distance(b.startPos, b.pos);
                b.alive = false;
                break;
            }
        }
    }

    private params(b: Bullet, amount: number): DamageParams {
        return {
            amount,
            damageType: DamageType.Player,
            gameSourceType: b.sourceType,
            sourceId: b.shooterId,
            dir: v2.copy(b.dir),
        };
    }

    private collidePlayer(b: Bullet, posOld: Vec2, p: Player, out: Collision[]): void {
        if (p.dead || !(sameLayer(p.layer, b.layer) || (p.layer & 2) !== 0)) return;
        if ((p.id === b.shooterId && !b.damageSelf) || p.id === b.reflectObjId) return;
        let pan: { point: Vec2; normal: Vec2 } | null = null;
        if (p.hasActivePan()) {
            const oldSeg = panSegment(p, p.posOld, p.dirOld);
            const newSeg = panSegment(p, p.pos, p.dir);
            const hitOld = intersectSegmentSegment(posOld, b.pos, oldSeg.p0, oldSeg.p1);
            const hitNew = intersectSegmentSegment(posOld, b.pos, newSeg.p0, newSeg.p1);
            const point = hitNew ?? hitOld;
            if (point) {
                const seg = hitNew ? newSeg : oldSeg;
                pan = {
                    point: v2.add(point, v2.mul(v2.neg(b.dir), PAN_HIT_BACKOFF)),
                    normal: v2.normalize(v2.perp(v2.sub(seg.p1, seg.p0))),
                };
            }
        }
        const body = collider.intersectSegment(collider.createCircle(p.pos, p.rad), posOld, b.pos);
        const bodyNormal = body && v2.normalizeSafe(v2.sub(body.point, p.pos), v2.neg(b.dir));
        if (
            body &&
            bodyNormal &&
            (!pan || v2.distanceSqr(body.point, b.startPos) < v2.distanceSqr(pan.point, b.startPos))
        ) {
            const dist = v2.distanceSqr(body.point, b.startPos);
            out.push({ type: "player", obj: p, collidable: true, point: body.point, normal: bodyNormal, dist });
            // Cast Ironskin: the hit also ricochets off the body
            if (p.hasPerk("steelskin")) {
                const point = v2.add(body.point, v2.mul(bodyNormal, 0.1));
                out.push({
                    type: "pan",
                    obj: p,
                    collidable: false,
                    point,
                    normal: bodyNormal,
                    dist: v2.distanceSqr(point, b.startPos),
                });
            }
        } else if (pan) {
            const dist = v2.distanceSqr(pan.point, b.startPos);
            out.push({ type: "pan", collidable: true, point: pan.point, normal: pan.normal, dist });
        }
    }

    /** Spawns the ricochet: mirrored direction, reflectCount + 1, range / 1.5^n, damage / (n + 1) (survev). */
    private reflect(b: Bullet, pos: Vec2, normal: Vec2, objId: number): void {
        if (b.reflectCount >= GameConfig.bullet.maxReflect || b.reflected) return;
        b.reflected = true;
        const dot = v2.dot(b.dir, normal);
        this.fire({
            shooterId: b.shooterId,
            bulletType: b.bulletType,
            sourceType: b.sourceType,
            pos,
            dir: v2.add(v2.mul(normal, dot * -2), b.dir),
            layer: b.layer,
            damageMult: b.damageMult,
            reflectCount: b.reflectCount + 1,
            reflectObjId: objId,
            varianceT: b.varianceT,
            shotFx: false,
        });
    }

    /** Report of a bullet for a snapshot (its state at the time the snapshot is built). */
    static toEvent(b: Bullet): BulletEvent {
        const event: BulletEvent = {
            id: b.id,
            shooterId: b.shooterId,
            bulletType: b.bulletType,
            sourceType: b.sourceType,
            pos: v2.copy(b.startPos),
            dir: v2.copy(b.dir),
            layer: b.layer,
            maxDist: b.clientDistance,
            reflectCount: b.reflectCount,
            hitPlayer: b.hitPlayer,
            shotFx: b.shotFx,
            offHand: b.offHand,
        };
        if (!b.alive) event.endDist = b.distanceTraveled;
        return event;
    }

    /** Drops reports older than `minTick`. */
    pruneReports(minTick: number): void {
        let n = 0;
        while (n < this.reports.length && this.reports[n].tick < minTick) n++;
        if (n > 0) this.reports.splice(0, n);
    }
}
