// Projectiles: thrown grenades, potato gun shots and air strike bombs. 2.5D flight: the projectile slides on the
// ground plane with drag while it lies on the ground (or on a low obstacle), flies over obstacles lower than its
// height and bounces off taller ones (each touched obstacle takes 1 damage), explodes when its fuse runs out, on
// impact (`explodeOnImpact`) or when it touches another player (`playerCollision`). MIRVs split into `numSplit`
// sub-grenades, a thrown strobe calls in air strikes `strikeDelay` seconds after the throw (survev's pattern: the first
// line in front of the strobe, the next ones beside it on alternating sides; the rebirth variant strobes call heavy
// shell and carpet strikes, defs STROBE_STRIKES).
// Behaviour follows survev server/src/game/objects/projectile.ts and docs/research/items/throwables.md
// "Throwing, cooking and flight rules" (gravity and drag are survev reconstructions from recorded packets).
import { type Bounds, collider, math, type Vec2, v2 } from "@rebirth/core";
import {
    DamageType,
    GameConfig,
    getDefOfType,
    isAirstrikeBomb,
    STROBE_STRIKES,
    type StrobeStrikeDef,
    strobeStrikeOf,
    type ThrowableDef,
} from "@rebirth/defs";
import { randomPointInCircle } from "../mapgen/random.ts";
import type { ProjectileView } from "../view.ts";
import type { SimContext } from "../world/context.ts";
import { checkStairs } from "../world/layers.ts";
import { type Entity, sameLayer } from "../world/world.ts";

/** Gravity in units/s^2 (survev: derived from recorded original potato cannon packets). */
const GRAVITY = 10.5;
/** Ground drag per second, 5 on water (survev: "based on plotted data from surviv"). */
const GROUND_DRAG = 2.3;
const WATER_DRAG = 5;
/** A bounce keeps max(1 + dot(dir, normal), 0.15) of the speed. */
const MIN_BOUNCE_SCALE = 0.15;
/** Pushed this far beyond the contact so the next tick starts clear. */
const PUSH_EPS = 0.1;
/** Obstacle damage of a touch; potato gun shots destroy non-collidable obstacles (bushes) with 999. */
const TOUCH_DAMAGE = 1;
const DESTROY_NON_COLLIDABLE_DAMAGE = 999;
/** MIRV sub-grenades: 0.6 x the parent velocity plus a random vector up to 4 u/s, starting at height 1. */
const SPLIT_VEL_MULT = 0.6;
const SPLIT_MAX_VEL = 4;
const SPLIT_HEIGHT = 1;
/**
 * Strobe: first strike 1 s after the ping, all strikes within 3 s (survev weaponManager.ts:1337-1362 duration 3,
 * projectile.ts:173-211); the strike count is the strobe's (defs STROBE_STRIKES: 3, +2 with Broken Arrow).
 */
const STROBE_FIRST_STRIKE = 1;
const STROBE_STRIKE_WINDOW = 3;
const TIME_EPS = 1e-9;
const MAX_ID = 0xffff;
/** Projectiles test stairs with a tiny circle at their centre (survev projectile.ts checkStairs(objs, 0.01)). */
const STAIRS_PROBE_RAD = 0.01;

interface StrobeState {
    /** the strobe's strike: variant, line count, spacing and ping */
    strike: StrobeStrikeDef;
    timeToPing: number;
    pinged: boolean;
    total: number;
    left: number;
    ticker: number;
    delay: number;
    rotAngle: number;
}

export interface Projectile {
    readonly id: number;
    readonly type: string;
    readonly def: ThrowableDef;
    /** player who threw or fired it (0 for the game: scheduled air strikes) */
    readonly ownerId: number;
    pos: Vec2;
    posZ: number;
    vel: Vec2;
    velZ: number;
    dir: Vec2;
    readonly throwDir: Vec2;
    /** changes on stairs like a player's (M5b) */
    layer: number;
    /** def.rad x 0.5; collisions use half of it */
    readonly rad: number;
    fuse: number;
    readonly damageType: number;
    /** weapon that launched it (kill attribution of potato gun shots and strobe bombs) */
    readonly sourceType: string;
    /** height of the collidable obstacle it rests on (0 on the ground) */
    obstacleBelowHeight: number;
    dead: boolean;
    strobe?: StrobeState;
}

export interface AddProjectileParams {
    ownerId: number;
    type: string;
    pos: Vec2;
    posZ: number;
    layer: number;
    vel: Vec2;
    fuse: number;
    damageType?: number;
    throwDir?: Vec2;
    sourceType?: string;
}

/** What projectiles need from the game; random streams and rules are read on use. */
export type ProjectileHost = Pick<
    SimContext,
    "world" | "rules" | "fxRng" | "explosions" | "planes" | "getPlayer" | "damageObstacle"
>;

export class ProjectileSystem {
    private readonly host: ProjectileHost;
    readonly projectiles: Projectile[] = [];
    private nextId = 1;
    private readonly scratch: Entity[] = [];

    constructor(host: ProjectileHost) {
        this.host = host;
    }

    private allocId(): number {
        const id = this.nextId;
        this.nextId = this.nextId >= MAX_ID ? 1 : this.nextId + 1;
        return id;
    }

    /** Launches a projectile; `fuseVariance` adds random(0, variance) to its fuse (survev Projectile). */
    add(p: AddProjectileParams): Projectile {
        const def = getDefOfType("throwable", p.type);
        let fuse = p.fuse;
        if (def.fuseVariance) fuse += this.host.fxRng.range(0, def.fuseVariance);
        const dir = v2.normalizeSafe(p.vel, { x: 1, y: 0 });
        const proj: Projectile = {
            id: this.allocId(),
            type: p.type,
            def,
            ownerId: p.ownerId,
            pos: this.host.world.clampToMap(p.pos, 0),
            posZ: p.posZ,
            vel: v2.copy(p.vel),
            velZ: def.throwPhysics.velZ,
            dir,
            throwDir: v2.copy(p.throwDir ?? dir),
            layer: p.layer,
            rad: def.rad * 0.5,
            fuse,
            damageType: p.damageType ?? DamageType.Player,
            sourceType: p.sourceType || p.type,
            obstacleBelowHeight: 0,
            dead: false,
        };
        this.projectiles.push(proj);
        return proj;
    }

    /** `count` projectiles of `type` scattered from `pos` (MIRV split, Martyrdom) (survev addSplitProjectiles). */
    addSplit(
        ownerId: number,
        type: string,
        pos: Vec2,
        layer: number,
        initialVel: Vec2,
        count: number,
        maxVel: number,
        sourceType = "",
    ): void {
        const def = getDefOfType("throwable", type);
        for (let i = 0; i < count; i++) {
            const vel = v2.add(v2.mul(initialVel, SPLIT_VEL_MULT), randomPointInCircle(this.host.fxRng, maxVel));
            this.add({ ownerId, type, pos, posZ: SPLIT_HEIGHT, layer, vel, fuse: def.fuseTime, sourceType });
        }
    }

    /**
     * Arms a thrown strobe: `strikeDelay` s later its air strike ping appears at the strobe, then its strikes (3, 5
     * with Broken Arrow; the carpet strobe 6 / 8) fly along the throw direction within 3 s (survev weaponManager.ts
     * throwThrowable). Broken Arrow is counted now unless rules.brokenArrowAtPing.
     */
    armStrobe(proj: Projectile, strikeDelay: number): void {
        const rules = this.host.rules;
        let rotAngle = -Math.PI / 2;
        if (rules.strobeRandomSide && this.host.fxRng.next() < 0.5) rotAngle = -rotAngle;
        proj.strobe = {
            strike: strobeStrikeOf(proj.type) ?? STROBE_STRIKES.strobe,
            timeToPing: strikeDelay,
            pinged: false,
            total: 0,
            left: 0,
            ticker: 0,
            delay: 0,
            rotAngle,
        };
        if (!rules.brokenArrowAtPing) this.countStrikes(proj);
    }

    private countStrikes(proj: Projectile): void {
        const s = proj.strobe;
        if (!s) return;
        const owner = this.host.getPlayer(proj.ownerId);
        s.total = s.strike.strikes + (owner?.hasPerk("broken_arrow") ? s.strike.brokenArrowBonus : 0);
        s.left = s.total;
        s.delay = STROBE_STRIKE_WINDOW / s.total;
    }

    update(dt: number): void {
        const list = this.projectiles;
        for (let i = 0; i < list.length; i++) {
            if (!list[i].dead) this.step(list[i], dt);
        }
        for (let i = 0; i < list.length; i++) if (list[i].dead) list.splice(i--, 1);
    }

    private updateStrobe(p: Projectile, s: StrobeState, dt: number): void {
        if (!s.pinged) {
            s.timeToPing -= dt;
            if (s.timeToPing > TIME_EPS) return;
            s.pinged = true;
            if (this.host.rules.brokenArrowAtPing) this.countStrikes(p);
            this.host.planes.addPing(s.strike.ping, p.pos);
            s.ticker = STROBE_FIRST_STRIKE;
            return;
        }
        if (s.left <= 0) return;
        s.ticker -= dt;
        if (s.ticker > TIME_EPS) return;
        // strike k flies ceil(k / 2) x offset beside the strobe on alternating sides: 0 / 5 / 5 / 10 / 10 (survev
        // projectile.ts:194-206), the carpet strobe's lines 1.4x as far apart
        const rot = s.left % 2 ? -s.rotAngle : s.rotAngle;
        const step = this.host.rules.strobeAirstrikeOffset * s.strike.offsetMult;
        const offset = Math.ceil((s.total - s.left) / 2) * step;
        const pos = v2.add(p.pos, v2.mul(v2.rotate(p.throwDir, rot), offset));
        // the bombs remember the strobe that called them (kill feed of the variant strobes, explode below)
        this.host.planes.addAirstrike(pos, p.throwDir, p.ownerId, s.strike.variant, p.type);
        s.left--;
        s.ticker = s.delay;
    }

    private step(p: Projectile, dt: number): void {
        if (p.strobe) this.updateStrobe(p, p.strobe, dt);
        const { world } = this.host;
        const def = p.def;
        if (p.posZ <= p.obstacleBelowHeight) {
            const drag = world.isOnWater(p.pos, p.layer) ? WATER_DRAG : GROUND_DRAG;
            p.vel = v2.mul(p.vel, 1 / (1 + dt * drag));
        }
        const posOld = v2.copy(p.pos);
        p.pos = v2.add(p.pos, v2.mul(p.vel, dt));
        p.velZ -= GRAVITY * dt;
        p.posZ = math.clamp(p.posZ + p.velZ * dt, p.obstacleBelowHeight, GameConfig.projectile.maxHeight);
        const height = def.throwPhysics.fixedCollisionHeight || p.posZ;
        const rad = p.rad / 2;
        const velLength = Math.max(v2.length(p.vel), 0.000001);
        // fast projectiles also test the segment they travelled this tick
        const lineCheck = velLength * dt > p.rad;
        const box = {
            min: { x: Math.min(posOld.x, p.pos.x) - p.rad, y: Math.min(posOld.y, p.pos.y) - p.rad },
            max: { x: Math.max(posOld.x, p.pos.x) + p.rad, y: Math.max(posOld.y, p.pos.y) + p.rad },
        };
        let insideObstacle = false;
        const objs = world.query(box, this.scratch);
        for (const obj of objs) {
            if (obj.kind === "obstacle") {
                if (obj.dead || !sameLayer(p.layer, obj.layer)) continue;
                const hit = collider.intersect(collider.createCircle(p.pos, rad), obj.collider);
                const line = lineCheck ? collider.intersectSegment(obj.collider, posOld, p.pos) : null;
                if (!hit && !line) continue;
                if (obj.height > height) {
                    const amount =
                        def.destroyNonCollidables && !obj.collidable ? DESTROY_NON_COLLIDABLE_DAMAGE : TOUCH_DAMAGE;
                    this.host.damageObstacle(obj, {
                        amount,
                        damageType: p.damageType,
                        gameSourceType: p.type,
                        weaponSourceType: p.sourceType,
                        sourceId: p.ownerId,
                        dir: v2.copy(p.dir),
                    });
                    if (obj.dead || !obj.collidable) continue;
                    if (line) p.pos = v2.add(line.point, v2.mul(line.normal, rad + PUSH_EPS));
                    else if (hit) p.pos = v2.add(p.pos, v2.mul(hit.dir, hit.pen + PUSH_EPS));
                    if (def.explodeOnImpact) {
                        this.explode(p);
                    } else {
                        const dir = v2.div(p.vel, velLength);
                        const normal = hit ? hit.dir : (line as { normal: Vec2 }).normal;
                        const dot = v2.dot(dir, normal);
                        const newDir = v2.add(v2.mul(normal, dot * -2), dir);
                        p.vel = v2.mul(newDir, velLength * Math.max(1 + dot, MIN_BOUNCE_SCALE));
                        p.dir = v2.normalizeSafe(p.vel, p.dir);
                    }
                } else if (obj.collidable) {
                    // rides on top of low collidable obstacles (crates, tables)
                    p.obstacleBelowHeight = Math.max(p.obstacleBelowHeight, obj.height);
                    insideObstacle = true;
                }
            } else if (obj.kind === "player") {
                if (!def.playerCollision || obj.dead || obj.id === p.ownerId || !sameLayer(p.layer, obj.layer))
                    continue;
                const r = rad + obj.rad;
                if (v2.distanceSqr(p.pos, obj.pos) < r * r) this.explode(p);
            }
        }
        if (!insideObstacle) p.obstacleBelowHeight = 0;
        p.pos = world.clampToMap(p.pos, p.rad);
        if (p.dead) return;
        // thrown projectiles go down (and up) stairs like players (survev projectile.ts checkStairs, radius 0.01)
        p.layer = checkStairs(p.pos, STAIRS_PROBE_RAD, p.layer, objs).layer;
        if (p.posZ === p.obstacleBelowHeight && def.explodeOnImpact) {
            this.explode(p);
            return;
        }
        p.fuse -= dt;
        if (p.fuse <= TIME_EPS) this.explode(p);
    }

    /**
     * Air strike bombs (bomb_iron, the rebirth heavy shell) never explode inside a building with an indestructible roof
     * (survev canBombIronExplode).
     */
    private canBombExplode(p: Projectile): boolean {
        const box = { min: v2.sub(p.pos, { x: p.rad, y: p.rad }), max: v2.add(p.pos, { x: p.rad, y: p.rad }) };
        for (const obj of this.host.world.query(box)) {
            if (obj.kind !== "building" || !sameLayer(obj.layer, p.layer) || obj.def.ceiling.destroy) continue;
            for (const r of obj.zoomRegions) {
                if (!r.zoomIn) continue;
                if (collider.intersect(collider.createCircle(p.pos, p.rad), { type: 1, ...r.zoomIn })) return false;
            }
        }
        return true;
    }

    /** Explodes a projectile now (fuse, impact, in-hand cook-off): split, then its explosion (survev explode). */
    explode(p: Projectile): void {
        if (p.dead) return;
        p.dead = true;
        const def = p.def;
        if (def.splitType && def.numSplit) {
            this.addSplit(p.ownerId, def.splitType, p.pos, p.layer, p.vel, def.numSplit, SPLIT_MAX_VEL, p.sourceType);
        }
        if (isAirstrikeBomb(p.type) && !this.canBombExplode(p)) return;
        if (!def.explosionType) return;
        this.host.explosions.add(def.explosionType, p.pos, p.layer, {
            gameSourceType: killSourceOf(p),
            weaponSourceType: p.sourceType,
            damageType: p.damageType,
            sourceId: p.ownerId,
        });
    }

    /** Projectiles inside `view`, by id (at most `max`). */
    views(view: Bounds, max = 255): ProjectileView[] {
        const out: ProjectileView[] = [];
        for (const p of this.projectiles) {
            if (p.dead) continue;
            if (p.pos.x < view.min.x - p.rad || p.pos.x > view.max.x + p.rad) continue;
            if (p.pos.y < view.min.y - p.rad || p.pos.y > view.max.y + p.rad) continue;
            out.push({
                id: p.id,
                type: p.type,
                pos: v2.copy(p.pos),
                posZ: p.posZ,
                dir: v2.copy(p.dir),
                layer: p.layer,
            });
        }
        out.sort((a, b) => a.id - b.id);
        return out.length > max ? out.slice(0, max) : out;
    }
}

/**
 * Item a projectile's explosion is credited with (the kill feed's itemSourceType): its own type, except the bombs of
 * a rebirth variant strobe, credited to that strobe so the kill feed can name its strike ("with a heavy shell
 * strike"); the bombs of the original strobe and of the 50v50 zones stay bomb_iron as in v0.8.82.
 */
function killSourceOf(p: Projectile): string {
    const strike = isAirstrikeBomb(p.type) ? strobeStrikeOf(p.sourceType) : undefined;
    return strike && strike.variant !== "normal" ? p.sourceType : p.type;
}
