// Explosions: queued by projectiles, bullets with an `onHit` explosion, destroyed obstacles and air strike bombs, and
// resolved once per tick after the projectiles (explosions queued while resolving, e.g. barrel chains, resolve in the
// same tick). Each explosion leaves its scorch decal, then casts rays from its centre: every player, obstacle and
// loot item is hit once, by the first ray reaching it, and a ray stops at the first collidable obstacle taller than
// 0.5 (walls block explosions). Damage is full inside rad.min and falls off to 0 at rad.max; obstacles take
// x obstacleDamage, loot is pushed away; shrapnel bullets fly in random directions. explosion_smoke spawns a smoke
// emitter instead of dealing damage.
// Behaviour follows docs/research/mechanics/explosions.md "Damage model" (survev objects/explosion.ts).
import { type Bounds, type Collider, collider, math, type Vec2, v2 } from "@rebirth/core";
import { type ExplosionDef, getDefOfType, getMapObjectDef, hasDef, hasMapObjectDef } from "@rebirth/defs";
import type { Loot } from "../loot/loot.ts";
import { applyThrowableHit } from "../modes/frozen.ts";
import { windwalkTrigger } from "../perks/effects.ts";
import { incrementFat } from "../perks/perks.ts";
import type { ExplosionEvent } from "../view.ts";
import type { SimContext } from "../world/context.ts";
import { createMapEntity, type Decal, type Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { sameLayer } from "../world/world.ts";

/** Seconds a coconut heal shows the heal effect (survev explosion.ts healEffectTicker). */
const HEAL_EFFECT_TIME = 0.5;
/** Largest angular step between two rays (survev: min(acos(1 - (0.75 / rad)^2 / 2), 0.3)). */
const MAX_RAY_STEP = 0.3;
/** Rays are at most this far apart at the rim. */
const RAY_GAP = 0.75;
/** A collidable obstacle taller than this stops a ray (walls, trees, doors; crates at 0.5 do not). */
const BLOCK_HEIGHT = 0.5;
/** The centre counts as inside an object when a circle this big around it overlaps the object. */
const CENTER_RAD = 0.01;
/** Loot is pushed with damage x random(0.15, 0.4) (survev explosion.ts damageObject). */
const LOOT_PUSH_MIN = 0.15;
const LOOT_PUSH_MAX = 0.4;
/** Queue guard: an explosion chain stops after this many explosions in one tick. */
const MAX_PER_TICK = 4096;

/** Who and what caused an explosion (damage attribution and plating rules). */
export interface ExplosionSource {
    /** weapon or projectile that caused it ("frag", "usas", "bomb_iron"); "" for exploding obstacles */
    gameSourceType?: string;
    /** the weapon it started from (survev weaponSourceType: the thrown item, the gun that shot the barrel) */
    weaponSourceType?: string;
    /** map object that exploded (barrels); "" otherwise */
    mapSourceType?: string;
    /** defs DamageType: Player, or Airstrike for air strike bombs */
    damageType: number;
    /** player credited with the damage (0 / undefined for the environment) */
    sourceId?: number;
}

interface Explosion {
    type: string;
    def: ExplosionDef;
    pos: Vec2;
    layer: number;
    source: ExplosionSource;
}

/** An explosion as reported to snapshots. */
export interface ExplosionReport {
    tick: number;
    type: string;
    pos: Vec2;
    layer: number;
    /** rad.max, for view culling */
    rad: number;
}

type Target = Player | Obstacle | Loot;

/** The whole context: snowball / potato hits make players drop items (M7b, modes/frozen.ts). */
export type ExplosionHost = SimContext;

function colliderOf(obj: Target): Collider {
    if (obj.kind === "obstacle") return obj.collider;
    return collider.createCircle(obj.pos, obj.rad);
}

function circleTouchesBox(pos: Vec2, rad: number, b: Bounds): boolean {
    const dx = pos.x - math.clamp(pos.x, b.min.x, b.max.x);
    const dy = pos.y - math.clamp(pos.y, b.min.y, b.max.y);
    return dx * dx + dy * dy <= rad * rad;
}

export class ExplosionSystem {
    private readonly host: ExplosionHost;
    private queue: Explosion[] = [];
    /** explosions reported to snapshots, oldest first (pruned by the game) */
    readonly reports: ExplosionReport[] = [];
    /** scorch decals that fade after their def lifetime */
    private readonly decals: Array<{ decal: Decal; life: number }> = [];
    /** current tick, for reports */
    tick = 0;
    /** explosions resolved so far (tests, stats) */
    count = 0;

    constructor(host: ExplosionHost) {
        this.host = host;
    }

    /** Queues an explosion; it is resolved in the next `update` (survev ExplosionBarn.addExplosion). */
    add(type: string, pos: Vec2, layer: number, source: ExplosionSource): void {
        if (!hasDef(type)) return;
        const def = getDefOfType("explosion", type);
        const p = this.host.world.clampToMap(pos, 0);
        this.queue.push({ type, def, pos: p, layer, source: { ...source } });
    }

    /** Resolves every queued explosion (and those they cause) and ages the scorch decals. */
    update(dt: number): void {
        for (let i = 0; i < this.decals.length; i++) {
            const d = this.decals[i];
            d.life -= dt;
            if (d.life > 1e-9) continue;
            this.host.world.remove(d.decal);
            this.decals.splice(i--, 1);
        }
        let resolved = 0;
        while (this.queue.length > 0 && resolved < MAX_PER_TICK) {
            const batch = this.queue;
            this.queue = [];
            for (const e of batch) {
                this.explode(e);
                resolved++;
            }
        }
        this.queue.length = 0;
    }

    private addDecal(type: string, pos: Vec2, layer: number): void {
        if (!type || !hasMapObjectDef(type)) return;
        const def = getMapObjectDef(type);
        if (def.type !== "decal") return;
        const world = this.host.world;
        const decal = createMapEntity({
            id: world.allocId(),
            kind: "decal",
            type,
            pos: v2.copy(pos),
            ori: 0,
            scale: 1,
            layer,
            parentId: 0,
        }) as Decal;
        world.add(decal);
        // some decals fade (rounds after 2-2.5 s, 60 % of bomb scorches after 6-10 s) (survev decal.ts)
        if (def.lifetime !== undefined && this.host.fxRng.next() < (def.fadeChance ?? 1)) {
            const life =
                typeof def.lifetime === "number"
                    ? def.lifetime
                    : this.host.fxRng.range(def.lifetime.min, def.lifetime.max);
            this.decals.push({ decal, life });
        }
    }

    private explode(e: Explosion): void {
        const { def, pos, layer } = e;
        this.count++;
        this.reports.push({ tick: this.tick, type: e.type, pos: v2.copy(pos), layer, rad: def.rad.max });
        this.addDecal(def.decalType, pos, layer);
        if (e.type === "explosion_smoke") {
            this.host.smokes.addEmitter(pos, layer);
            return;
        }
        const rad = def.rad.max;
        const world = this.host.world;
        const box = { min: { x: pos.x - rad, y: pos.y - rad }, max: { x: pos.x + rad, y: pos.y + rad } };
        const targets: Array<{ obj: Target; col: Collider }> = [];
        for (const obj of world.query(box)) {
            if (obj.kind !== "player" && obj.kind !== "obstacle" && obj.kind !== "loot") continue;
            if (!sameLayer(obj.layer, layer)) continue;
            if (obj.kind !== "loot" && obj.dead) continue;
            targets.push({ obj, col: colliderOf(obj) });
        }
        // Windwalk holders near an enemy explosion get their burst (conflicts.md perk-windwalk-explosions)
        if (this.host.rules.perks.windwalkOnExplosions) {
            const sourceTeam = e.source.sourceId ? (this.host.getPlayer(e.source.sourceId)?.teamId ?? 0) : 0;
            for (const { obj } of targets) {
                if (
                    obj.kind !== "player" ||
                    v2.distance(obj.pos, pos) > this.host.rules.perks.windwalkTriggerDistance
                ) {
                    continue;
                }
                windwalkTrigger(this.host.rules.perks, obj, sourceTeam);
            }
        }
        const center = collider.createCircle(pos, CENTER_RAD);
        const damaged = new Set<number>();
        const step = Math.min(Math.acos(1 - (RAY_GAP / rad) ** 2 / 2), MAX_RAY_STEP);
        const hits: Array<{ obj: Target; dist: number }> = [];
        for (let angle = -Math.PI; angle < Math.PI; angle += step) {
            hits.length = 0;
            const end = v2.add(pos, v2.rotate({ x: rad, y: 0 }, angle));
            for (const { obj, col } of targets) {
                // an object containing the centre takes the full hit
                if (collider.intersect(col, center)) {
                    hits.push({ obj, dist: 0 });
                    continue;
                }
                const res = collider.intersectSegment(col, pos, end);
                if (res) hits.push({ obj, dist: res.dist });
            }
            // nearest first, so nothing is damaged through a wall
            hits.sort((a, b) => a.dist - b.dist);
            for (const { obj, dist } of hits) {
                if (!damaged.has(obj.id)) {
                    damaged.add(obj.id);
                    this.damageObject(e, obj, dist);
                }
                if (obj.kind === "obstacle" && obj.collidable && obj.height > BLOCK_HEIGHT) break;
            }
        }
        this.fireShrapnel(e);
    }

    /** Explosion damage at `dist` from the centre for an object with collider `col` (explosions.md falloff). */
    damageAt(def: ExplosionDef, pos: Vec2, col: Collider, dist: number): number {
        if (dist <= def.rad.min || collider.intersect(collider.createCircle(pos, def.rad.min), col)) {
            return def.damage;
        }
        if (this.host.rules.explosionFalloff === "smooth") {
            return math.remap(dist, def.rad.min, def.rad.max, def.damage, 0);
        }
        return math.remap(dist, 0, def.rad.max, def.damage, 0);
    }

    private damageObject(e: Explosion, obj: Target, dist: number): void {
        const damage = this.damageAt(e.def, e.pos, colliderOf(obj), dist);
        const dir = v2.normalizeSafe(v2.sub(obj.pos, e.pos), { x: 1, y: 0 });
        if (obj.kind === "loot") {
            obj.push(dir, damage * this.host.fxRng.range(LOOT_PUSH_MIN, LOOT_PUSH_MAX));
            return;
        }
        // teammates of the source take no damage: the player damage pipeline drops teammate hits (potato explosions'
        // teamDamage false is informational, explosions.md "Friendly fire and credit")
        // snowball / potato hits slow enemies and make them drop an item before the damage (M7b, modes/frozen.ts)
        if (obj.kind === "player") {
            const source = e.source.sourceId ? this.host.getPlayer(e.source.sourceId) : undefined;
            const teammate = !!source && source.teamId === obj.teamId;
            // Spud Gun shots enlarge enemies only (survev explosion.ts:209-238, fork 0.2.31; throwables.md)
            if (e.type === "explosion_potato_smgshot" && !teammate) incrementFat(obj);
            // coconuts heal the thrower's side instead of hurting it (survev explosion.ts:214-220, healAmount 7)
            if (e.def.healTeam && teammate) {
                if (!obj.dead) obj.health = Math.min(obj.health + (e.def.healAmount ?? 5), 100);
                obj.healEffectTicker = HEAL_EFFECT_TIME;
                return;
            }
            applyThrowableHit(this.host, obj, e.type, dir, source);
        }
        const params = {
            amount: obj.kind === "obstacle" ? damage * e.def.obstacleDamage : damage,
            damageType: e.source.damageType,
            gameSourceType: e.source.gameSourceType ?? "",
            weaponSourceType: e.source.weaponSourceType ?? "",
            mapSourceType: e.source.mapSourceType ?? "",
            sourceId: e.source.sourceId ?? 0,
            isExplosion: true,
            dir,
        };
        if (obj.kind === "obstacle") this.host.damageObstacle(obj, params);
        else this.host.damagePlayer(obj, params);
    }

    /** shrapnelCount shrapnel bullets in uniformly random directions with a random variance (survev explode). */
    private fireShrapnel(e: Explosion): void {
        const { def } = e;
        if (!def.shrapnelCount || !def.shrapnelType || !hasDef(def.shrapnelType)) return;
        const rng = this.host.fxRng;
        // Hyperfragmentation: the source's shrapnel x2 count (rounded up), x1.5 damage, x1.4 speed, darker tracer
        // (survev explosion.ts:146-178)
        const source = e.source.sourceId ? this.host.getPlayer(e.source.sourceId) : undefined;
        const amped = source?.hasPerk("amped_explosives") ? this.host.rules.perks.ampedExplosives : undefined;
        const count = Math.ceil(def.shrapnelCount * (amped?.shrapnelCountMult ?? 1));
        for (let i = 0; i < count; i++) {
            const varianceT = rng.next();
            this.host.bullets.fire({
                shooterId: e.source.sourceId ?? 0,
                bulletType: def.shrapnelType,
                sourceType: e.source.gameSourceType ?? "",
                mapSourceType: e.source.mapSourceType ?? "",
                damageType: e.source.damageType,
                pos: e.pos,
                dir: v2.randomUnit(rng),
                layer: e.layer,
                varianceT,
                shotFx: false,
                damageMult: amped?.shrapnelDamageMult ?? 1,
                speedMult: amped?.shrapnelSpeedMult ?? 1,
                saturated: !!amped,
            });
        }
    }

    /** Explosions reported after `sinceTick` whose radius touches `view`, in order. */
    events(sinceTick: number, view: Bounds, max = 255): ExplosionEvent[] {
        const out: ExplosionEvent[] = [];
        for (const r of this.reports) {
            if (r.tick <= sinceTick || !circleTouchesBox(r.pos, r.rad, view)) continue;
            out.push({ type: r.type, pos: v2.copy(r.pos), layer: r.layer });
            if (out.length >= max) break;
        }
        return out;
    }

    /** Drops reports older than `minTick`. */
    pruneReports(minTick: number): void {
        let n = 0;
        while (n < this.reports.length && this.reports[n].tick < minTick) n++;
        if (n > 0) this.reports.splice(0, n);
    }
}
