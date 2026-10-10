// Bullets: swept per-tick flight, obstacle/player/pan collisions, ricochets, falloff; damage is queued and applied
// after every bullet moved. Bullets with an on-hit explosion (USAS-12 frag rounds, Explosive Rounds) explode where
// they stop. M7a: perk speed / range multipliers and tracer flags, Windwalk (an enemy bullet passing within 5 u of a
// holder), High-Value Targets (x1.25 against players holding a perk). M9: clipped ranges (USAS-12 `toMouseHit` rounds
// stop at the cursor), the tracer speed factor in reports, full-range reports of `skipCollision` bullets (flares).
// Rebirth new guns (docs/design/new-gun-stats.md 4.4): `noReflect`, `armDistance` and `noDistAdj` bullet fields.
// Behaviour follows survev server/src/game/objects/bullet.ts and docs/research/items/bullets.md "Server simulation".
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { type BulletDef, DamageType, GameConfig, getDefOfType } from "@rebirth/defs";
import { intersectSegmentSegment } from "../geom/polygon.ts";
import { windwalkTrigger } from "../perks/effects.ts";
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
    /** defs DamageType (default Player; shrapnel of air strike bombs: Airstrike) */
    damageType?: number;
    /** map object behind the hit (shrapnel of an exploding barrel) */
    mapSourceType?: string;
    /** explosion where the bullet stops, when its def has no `onHit` (Explosive Rounds: "explosion_rounds") */
    onHitFx?: string;
    /** perk multipliers of speed and range (9mm Overpressure) (M7a) */
    speedMult?: number;
    distanceMult?: number;
    /** tracer flags (M7a): darker, thick, Splinter side bullet */
    saturated?: boolean;
    thick?: boolean;
    splinter?: boolean;
    /** AP Rounds (survev-only perk): armour reductions x armorPenetration, obstacle damage x obstacleMult */
    apRounds?: boolean;
    /** the range is min(def.distance x distanceMult, `distance`) (USAS-12 toMouseHit, M9; survev clipDistance) */
    clipDistance?: boolean;
    distance?: number;
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
    readonly damageType: number;
    readonly mapSourceType: string;
    /** explosion spawned where the bullet stops ("" for none; Explosive Rounds peter out at max range) */
    onHitFx: string;
    /** Explosive Rounds bullets never ricochet (survev canReflect) */
    readonly canReflect: boolean;
    alive: boolean;
    /** this bullet already spawned its ricochet (one per bullet per update) */
    reflected: boolean;
    hitPlayer: boolean;
    readonly damagedIds: Set<number>;
    /** tick of the snapshot-visible report: creation, then again when it hits a player */
    reportTicks: number[];
    readonly speedMult: number;
    readonly distanceMult: number;
    readonly saturated: boolean;
    readonly thick: boolean;
    readonly splinter: boolean;
    readonly apRounds: boolean;
    /** the range was clipped (USAS-12 toMouseHit); ricochets keep a clipped range (M9) */
    readonly clipDistance: boolean;
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
export type BulletContext = Pick<SimContext, "world" | "rules" | "combatRng" | "getPlayer" | "observer"> & {
    /** queues an on-hit explosion (optional for bare bullet tests) */
    readonly explosions?: Pick<SimContext["explosions"], "add">;
};

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
        // rebirth new guns: the exploding rounds carry their own noDistAdj (new-gun-stats.md 4.4)
        const noDistAdj = !!def.noDistAdj || this.ctx.rules.noDistAdjBullets.includes(p.bulletType);
        const distAdjIdx = noDistAdj ? DIST_ADJ_STEPS / 2 : this.ctx.combatRng.int(0, DIST_ADJ_STEPS);
        const distAdj = math.remap(distAdjIdx, 0, DIST_ADJ_STEPS, -1, 1);
        // each ricochet divides the range by reflectDistDecay (1.5)
        let baseDistance = def.distance / GameConfig.bullet.reflectDistDecay ** reflectCount;
        const speedMult = p.speedMult ?? 1;
        let distanceMult = p.distanceMult ?? 1;
        const clipDistance = !!p.clipDistance;
        if (clipDistance) {
            // the multiplier is applied here only, not twice (survev bullet.ts init clipDistance)
            baseDistance = Math.min(def.distance * distanceMult, p.distance ?? MAX_DISTANCE);
            distanceMult = 1;
        }
        const distance = math.clamp(baseDistance * distanceMult * variance + distAdj, 0, MAX_DISTANCE);
        const reflectObjId = p.reflectObjId ?? 0;
        const onHitFx = def.onHit ?? p.onHitFx ?? "";
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
            speed: def.speed * speedMult * variance,
            distance,
            // flares fly through everything (skipCollision): clients draw their whole range (M9)
            clientDistance: def.skipCollision
                ? distance
                : this.clientDistance(pos, dir, distance, p.layer, reflectObjId),
            distanceTraveled: 0,
            damage: def.damage * (p.damageMult ?? 1),
            damageMult: p.damageMult ?? 1,
            reflectCount,
            reflectObjId,
            varianceT,
            damageSelf: reflectCount > 0 || def.shrapnel,
            shotFx: p.shotFx ?? false,
            offHand: p.offHand ?? false,
            damageType: p.damageType ?? DamageType.Player,
            mapSourceType: p.mapSourceType ?? "",
            onHitFx,
            // rebirth new guns: rockets and the GL-06 round never ricochet, they explode on metal (`noReflect`)
            canReflect: !def.noReflect && onHitFx !== "explosion_rounds",
            alive: true,
            reflected: false,
            hitPlayer: false,
            damagedIds: new Set(),
            reportTicks: [this.tick],
            speedMult,
            distanceMult,
            saturated: p.saturated ?? false,
            apRounds: p.apRounds ?? false,
            thick: p.thick ?? false,
            splinter: p.splinter ?? false,
            clipDistance,
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
        if (math.eqAbs(b.distanceTraveled, b.distance, 0.001)) {
            b.alive = false;
            // Explosive Rounds peter out at max range; USAS-12 frag rounds still explode
            if (b.onHitFx === "explosion_rounds") b.onHitFx = "";
        }
        if (!b.alive && !b.reflected && b.onHitFx) {
            // rebirth new guns: a round stopped before its arming distance is a dud (no point-blank rocket suicide)
            if (b.def.armDistance && b.distanceTraveled < b.def.armDistance) b.onHitFx = "";
            else this.explodeOnHit(b);
        }
        // a stop is re-reported (with its endDist) after a player hit, and for every round with its own on-hit
        // explosion (rockets, the GL-06 and USAS-12 rounds): clients stop its tracer, sprite and smoke trail there even
        // when the obstacle it hit is destroyed before their tracer reaches it (owner report 2026-10-10: the RPG-7
        // warhead flew on through the crate it had just blown up)
        const reportStop = b.hitPlayer || !!b.def.onHit;
        if (!b.alive && reportStop && b.reportTicks[b.reportTicks.length - 1] !== this.tick) {
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
                // AP Rounds: obstacle damage x1.5 (survev bullet.ts:593-597)
                const ap = b.apRounds ? this.ctx.rules.perks.apRounds.obstacleMult : 1;
                this.damages.push({ target: obstacle, params: this.params(b, damage * b.def.obstacleDamage * ap) });
                if (obstacle.def.reflectBullets) this.reflect(b, col.point, col.normal, obstacle.id);
                // non-collidable obstacles take the hit but let the bullet pass
                hit = col.collidable;
            } else if (col.type === "player") {
                if (!shooterDead) {
                    const target = col.obj as Player;
                    // High-Value Targets: x1.25 against a player holding any perk (perks.md targeting)
                    const hvt = !!shooter?.hasPerk("targeting") && target.perks.length > 0;
                    const params = this.params(b, hvt ? damage * this.ctx.rules.perks.targetingDamageMult : damage);
                    params.isExplosion = b.def.shrapnel;
                    // AP Rounds: armour and damage-reduction perks work at x0.8 (survev bullet.ts:635-637)
                    if (b.apRounds) params.armorPenetration = this.ctx.rules.perks.apRounds.armorPenetration;
                    this.damages.push({ target: col.obj as Player, params });
                    this.ctx.observer?.onBulletHitPlayer?.(b, target);
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

    /** The bullet's on-hit explosion, 0.1 behind where it stopped so it is not inside an obstacle (survev). */
    private explodeOnHit(b: Bullet): void {
        let type = b.onHitFx;
        // shotguns use the quieter explosion_rounds_sg (survev useExplosiveRoundsAlt)
        if (type === "explosion_rounds" && this.ctx.rules.explosiveRoundsAltBullets.includes(b.bulletType)) {
            type = "explosion_rounds_sg";
        }
        b.onHitFx = "";
        this.ctx.explosions?.add(type, v2.sub(b.pos, v2.mul(b.dir, 0.1)), b.layer, {
            gameSourceType: b.sourceType,
            mapSourceType: b.mapSourceType,
            damageType: b.damageType,
            sourceId: b.shooterId,
        });
    }

    private params(b: Bullet, amount: number): DamageParams {
        const params: DamageParams = {
            amount,
            damageType: b.damageType,
            gameSourceType: b.sourceType,
            sourceId: b.shooterId,
            dir: v2.copy(b.dir),
        };
        if (b.mapSourceType) params.mapSourceType = b.mapSourceType;
        return params;
    }

    private collidePlayer(b: Bullet, posOld: Vec2, p: Player, out: Collision[]): void {
        if (p.dead || !(sameLayer(p.layer, b.layer) || (p.layer & 2) !== 0)) return;
        if ((p.id === b.shooterId && !b.damageSelf) || p.id === b.reflectObjId) return;
        // Windwalk: enemy fire passing within the trigger distance of the holder (survev bullet.ts)
        if (v2.distance(b.pos, p.pos) <= this.ctx.rules.perks.windwalkTriggerDistance) {
            windwalkTrigger(this.ctx.rules.perks, p, this.ctx.getPlayer(b.shooterId)?.teamId ?? 0);
        }
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
        if (!b.canReflect || b.reflectCount >= GameConfig.bullet.maxReflect || b.reflected) return;
        b.reflected = true;
        const dot = v2.dot(b.dir, normal);
        // a clipped range carries over: what is left of it, divided by 1.5^n of this bullet (survev reflect)
        const distance = b.clipDistance
            ? Math.max(1, b.distance - b.distanceTraveled) / GameConfig.bullet.reflectDistDecay ** b.reflectCount
            : undefined;
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
            damageType: b.damageType,
            mapSourceType: b.mapSourceType,
            onHitFx: b.onHitFx,
            speedMult: b.speedMult,
            distanceMult: b.distanceMult,
            saturated: b.saturated,
            thick: b.thick,
            splinter: b.splinter,
            apRounds: b.apRounds,
            clipDistance: b.clipDistance,
            distance,
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
            saturated: b.saturated,
            thick: b.thick,
            splinter: b.splinter,
            apRounds: b.apRounds,
            speedMult: b.def.speed > 0 ? b.speed / b.def.speed : 1,
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
