// Bullet tracers from the snapshot BulletEvents: a trail sprite whose head moves at the bullet speed from `pos`
// along `dir` and stops at `endDist` (it hit something) or `maxDist`. Bullets are checked against obstacles and players
// in view on the client too, for impact chips, blood and sounds and to stop at destructible obstacles; the simulation
// reports player hits too (`hitPlayer`). Drawing follows survev client/src/objects/bullet.ts (trail sprite
// player-bullet-trail-02, x-scale 0.8, y-scale tracerWidth, length min(tracerLength * 15, travelled / 2), container
// pivot 14.5 so the head sits on the bullet, ×6/s shrink after impact, reflected bullets at half alpha).
// M7 (survev bullet.ts addBullet): Splinter Rounds side bullets (`splinter`, the original trailSmall) draw at half the
// tracer width, One in the Chamber shots (`thick`) at twice the width, and saturated bullets (ammo perks, Hollow-points,
// OKAMI Bar, Last Breath, One in the Chamber) in the tracer colour's `chambered` tint, else its `saturated` one.
// M9 (survev bullet.ts:92-506): the tracer speed is def.speed × `speedMult` (perks, shrapnel variance); a shooter on
// stairs or a bullet crossing stairs moves the tracer to the stairs layer; a shooter on a bright floor gets the
// saturated tint; the whiz needs a living active player on the same audio layer. Player hits: the shooter is skipped
// unless the bullet is shrapnel or a ricochet, a held or worn pan is tested before the body (chips + the pan's bullet
// sound, Cast Ironskin bodies chip too), the first player hit ends the player pass; blood is parented to the hit
// player at the impact offset (rotation 1 rad) and neither blood nor the hit sound play while the shooter is dead or
// downed. Flare rounds (`addFlare`) are drawn by fx/flare.ts.
// Rebirth (user/2026-10-07-hit-feedback): after the original effects of a player hit, `hitListener` (fx/hitFeedback.ts)
// hears of it with the bullet's nominal damage, for the Enhanced hit effects.
import { type Collider, collider, math, type Vec2 } from "@rebirth/core";
import {
    type BulletDef,
    GameConfig,
    GameObjectDefs,
    type GunDef,
    type MapDef,
    MapObjectDefs,
    type MeleeDef,
    type ObstacleDef,
} from "@rebirth/defs";
import type { BulletEvent, ObstacleView, PlayerView } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
import { hasActivePan, panHit, sameAudioLayer, sameLayer, tracerTint, tracerWidth } from "./bulletHits.ts";
import { FlareSystem } from "./flare.ts";
import type { PlayerHitListener } from "./hitFeedback.ts";
import { nominalBulletDamage } from "./hitFeedbackMath.ts";
import type { ParticleSystem } from "./particles.ts";

const TRAIL_SPRITE = "player-bullet-trail-02.img";
const TRAIL_PIVOT = 14.5;
const TRAIL_Z_ORD = 20;
/** shrink rate of a stopped tracer (1/s) */
const COLLIDED_SHRINK = 6;
/** bullets passing closer than this to the camera whiz (survev bullet.ts) */
const WHIZ_DIST = 7.5;
/** reports older than this are ignored when a bullet id comes back (seconds) */
const ID_MEMORY = 4;
const HIT_PARTICLE_SPEED = 9.5;
/** survev bullet.ts: blood splats on the hit player use rotation 1 rad and scale 1 */
const BLOOD_ROT = 1;

interface Tracer {
    id: number;
    container: Container;
    sprite: Sprite;
    shooterId: number;
    bulletType: string;
    startPos: Vec2;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    speed: number;
    distance: number;
    tracerLength: number;
    hitPlayer: boolean;
    reflectCount: number;
    /** shrapnel and ricochets may hit their shooter (survev damageSelf) */
    damageSelf: boolean;
    alive: boolean;
    collided: boolean;
    scale: number;
    alphaRate: number;
    alphaMin: number;
    suppressed: boolean;
    whizHeard: boolean;
    /** obstacles this bullet already chipped (non-collidable ones are passed through) */
    chipped: Set<number>;
    /** the client already showed this bullet's player hit */
    playerFx: boolean;
}

/** What the tracer system needs from the object world. */
export interface BulletScene {
    /** the followed (active) player */
    readonly localId: number;
    /** layer of the followed player */
    readonly activeLayer: number;
    readonly cameraPos: Vec2;
    /** the active player is alive (bullets whiz past living players only) */
    readonly activeAlive: boolean;
    forEachObstacle(cb: (view: ObstacleView) => void): void;
    forEachPlayer(cb: (view: PlayerView) => void): void;
    playerById(id: number): PlayerView | undefined;
    /** position and facing of a player in the previous snapshot (the pan sweep), when known */
    playerOld(id: number): { pos: Vec2; dir: Vec2 } | undefined;
    /** the root container of a player's view (blood splats follow it) */
    playerContainer(id: number): Container | null;
    /** whether a -> b crosses the stairs of a structure outside its stair masks */
    segmentOnStairs(a: Vec2, b: Vec2): boolean;
    /** whether the floor at `pos` is bright (saturated tracers) */
    brightSurfaceAt(pos: Vec2, layer: number): boolean;
}

interface CachedCollider {
    /** the transform it was built for (doors move and turn without changing scale) */
    scale: number;
    ori: number;
    x: number;
    y: number;
    col: Collider;
    min: Vec2;
    max: Vec2;
}

interface Hit {
    type: "obstacle" | "player" | "pan";
    dist: number;
    point: Vec2;
    normal: Vec2;
    collidable: boolean;
    layer: number;
    obstacle?: ObstacleDef;
    player?: PlayerView;
    id: number;
}

export class BulletSystem {
    private readonly renderer: Renderer;
    private readonly textures: TextureStore;
    private readonly audio: AudioEngine;
    private readonly particles: ParticleSystem;
    readonly flares: FlareSystem;
    private readonly tracers: Tracer[] = [];
    private readonly free: Tracer[] = [];
    /** bullet id -> seconds since first seen, so a re-report updates instead of spawning a second tracer */
    private readonly seen = new Map<number, number>();
    private readonly colliders = new Map<number, CachedCollider>();
    private tracerColors: Record<string, Record<string, number>> = {};
    private turkeyMode = false;
    /** tracers drawn last frame (tests) */
    visibleCount = 0;
    /** tracers spawned since boot (tests) */
    spawned = 0;
    /** saturated / thick / splinter tracers spawned since boot (tests, M7) */
    readonly variants = { saturated: 0, thick: 0, splinter: 0 };
    /** hit effects shown since boot (tests, M9): blood on players, pan chips, player hit sounds */
    readonly hits = { blood: 0, pan: 0, sounds: 0, stairs: 0 };
    /** rebirth Enhanced hit effects: told about every player hit after its original effects */
    hitListener: PlayerHitListener | null = null;

    constructor(renderer: Renderer, textures: TextureStore, audio: AudioEngine, particles: ParticleSystem) {
        this.renderer = renderer;
        this.textures = textures;
        this.audio = audio;
        this.particles = particles;
        this.flares = new FlareSystem(renderer, textures);
    }

    /** Tracer colours for the map: GameConfig.tracerColors overridden by the biome's (survev onMapLoad). */
    setMap(mapDef: MapDef): void {
        const colors: Record<string, Record<string, number>> = {};
        for (const [key, value] of Object.entries(GameConfig.tracerColors)) colors[key] = { ...value };
        for (const [key, value] of Object.entries(mapDef.biome.tracerColors ?? {})) {
            colors[key] = { ...(colors[key] ?? {}), ...value };
        }
        this.tracerColors = colors;
        this.turkeyMode = !!mapDef.gameMode.turkeyMode;
    }

    get activeCount(): number {
        return this.tracers.length;
    }

    /** Applies one snapshot's bullet events; shots from the shooter's first bullet play the gun sound. */
    addEvents(events: readonly BulletEvent[], scene: BulletScene): void {
        for (const e of events) {
            if (this.seen.has(e.id)) {
                const t = this.tracers.find((tr) => tr.id === e.id);
                if (t && e.endDist !== undefined) {
                    t.distance = Math.min(t.distance, e.endDist);
                    t.hitPlayer = t.hitPlayer || e.hitPlayer;
                }
                continue;
            }
            this.seen.set(e.id, 0);
            const def = GameObjectDefs[e.bulletType] as BulletDef | undefined;
            if (def?.type === "bullet" && def.addFlare) this.flares.add(e, def);
            else this.spawn(e, scene);
            if (e.shotFx) this.playShot(e, scene);
        }
    }

    private playShot(e: BulletEvent, scene: BulletScene): void {
        const gun = GameObjectDefs[e.sourceType] as GunDef | undefined;
        if (gun?.type !== "gun") return;
        this.audio.playSound(gun.sound.shoot, {
            channel: e.shooterId === scene.localId ? "activePlayer" : "otherPlayers",
            pos: e.pos,
            layer: e.layer,
            fallOff: gun.sound.fallOff ?? 0,
        });
    }

    private spawn(e: BulletEvent, scene: BulletScene): void {
        const def = GameObjectDefs[e.bulletType] as BulletDef | undefined;
        if (def?.type !== "bullet") return;
        let t = this.free.pop();
        if (!t) {
            const container = new Container({ label: "tracer" });
            container.pivot.set(TRAIL_PIVOT, 0);
            const sprite = this.renderer.pool.acquire();
            this.textures.apply(sprite, TRAIL_SPRITE, 1);
            container.addChild(sprite);
            t = { container, sprite } as Tracer;
        }
        const colors = this.tracerColors[def.tracerColor] ?? { regular: 0xffffff };
        const shooter = scene.playerById(e.shooterId);
        t.id = e.id;
        t.shooterId = e.shooterId;
        t.bulletType = e.bulletType;
        t.startPos = { x: e.pos.x, y: e.pos.y };
        t.pos = { x: e.pos.x, y: e.pos.y };
        t.dir = { x: e.dir.x, y: e.dir.y };
        // a shooter on stairs draws its bullets on the stairs layer (survev addBullet)
        t.layer = shooter && shooter.layer & 2 ? e.layer | 2 : e.layer;
        t.speed = def.speed * (e.speedMult ?? 1);
        t.distance = e.endDist ?? e.maxDist;
        t.tracerLength = def.tracerLength;
        t.hitPlayer = e.hitPlayer;
        t.reflectCount = e.reflectCount;
        t.damageSelf = def.shrapnel || e.reflectCount > 0;
        t.alive = true;
        t.collided = false;
        t.scale = 1;
        t.alphaRate = colors.alphaRate ?? 1;
        t.alphaMin = colors.alphaMin ?? 0;
        t.suppressed = !!def.suppressed;
        t.whizHeard = false;
        t.chipped = new Set();
        t.playerFx = false;
        t.sprite.scale.set(0.8, tracerWidth(def.tracerWidth, e));
        const bright = !!shooter && scene.brightSurfaceAt(shooter.pos, shooter.layer);
        t.sprite.tint = tracerTint(colors, !!e.saturated, bright, !!e.apRounds);
        t.sprite.alpha = e.reflectCount > 0 ? 0.5 : 1;
        t.sprite.visible = true;
        t.container.rotation = -Math.atan2(e.dir.y, e.dir.x);
        t.container.visible = true;
        this.tracers.push(t);
        this.spawned++;
        if (e.saturated) this.variants.saturated++;
        if (e.thick) this.variants.thick++;
        if (e.splinter) this.variants.splinter++;
    }

    private obstacleCollider(view: ObstacleView, def: ObstacleDef): CachedCollider {
        let cached = this.colliders.get(view.id);
        if (
            !cached ||
            cached.scale !== view.scale ||
            cached.ori !== view.ori ||
            cached.x !== view.pos.x ||
            cached.y !== view.pos.y
        ) {
            const col = collider.transform(def.collision, view.pos, math.oriToRad(view.ori), view.scale);
            const box = collider.toAabb(col);
            cached = {
                scale: view.scale,
                ori: view.ori,
                x: view.pos.x,
                y: view.pos.y,
                col,
                min: box.min,
                max: box.max,
            };
            this.colliders.set(view.id, cached);
        }
        return cached;
    }

    /** Obstacles the segment a -> b touches (survev bullet.ts m_update obstacle pass). */
    private obstacleHits(t: Tracer, a: Vec2, b: Vec2, scene: BulletScene, out: Hit[]): void {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        scene.forEachObstacle((view) => {
            if (view.dead || t.chipped.has(view.id) || !sameLayer(view.layer, t.layer)) return;
            const def = MapObjectDefs[view.type] as ObstacleDef | undefined;
            if (!def || def.height < GameConfig.bullet.height) return;
            const c = this.obstacleCollider(view, def);
            if (c.max.x < minX || c.min.x > maxX || c.max.y < minY || c.min.y > maxY) return;
            const hit = collider.intersectSegment(c.col, a, b);
            if (!hit) return;
            // a ricochet starts on the surface it bounced off, which it ignores (survev reflectObjId)
            if (t.reflectCount > 0 && Math.hypot(hit.point.x - t.startPos.x, hit.point.y - t.startPos.y) < 1e-3) {
                t.chipped.add(view.id);
                return;
            }
            // a player's disguise never stops a bullet, which still chips it on the way (survev client obstacle.ts
            // `collidable = def.collidable && !isSkin`, bullet.ts:274-276 and 394-407)
            const collidable = def.collidable && !(view.door?.open ?? false) && view.skinPlayerId === undefined;
            out.push({
                type: "obstacle",
                dist: hit.dist,
                point: hit.point,
                normal: hit.normal,
                collidable,
                layer: t.layer,
                obstacle: def,
                id: view.id,
            });
        });
    }

    /**
     * The first player the segment a -> b touches, pan first (survev bullet.ts:283-375): the shooter only for shrapnel
     * and ricochets; a pan closer than the body takes the hit; Cast Ironskin bodies also chip like a pan.
     */
    private playerHits(t: Tracer, a: Vec2, b: Vec2, scene: BulletScene, out: Hit[]): void {
        let done = false;
        scene.forEachPlayer((p) => {
            if (done || p.dead) return;
            if (!sameLayer(p.layer, t.layer) && !(p.layer & 2)) return;
            if (p.id === t.shooterId && !t.damageSelf) return;
            const old = scene.playerOld(p.id) ?? { pos: p.pos, dir: p.dir };
            const pan = hasActivePan(p) ? panHit(p, old, a, b) : null;
            const rad = GameConfig.player.radius * (p.scale || 1);
            const body = collider.intersectSegment({ type: 0, pos: p.pos, rad }, a, b);
            const fromStart = (q: Vec2) => Math.hypot(q.x - t.startPos.x, q.y - t.startPos.y);
            const distOf = (q: Vec2) => Math.hypot(q.x - a.x, q.y - a.y);
            if (body && (!pan || fromStart(body.point) < fromStart(pan.point))) {
                out.push({
                    type: "player",
                    dist: distOf(body.point),
                    point: body.point,
                    normal: body.normal,
                    collidable: true,
                    layer: p.layer,
                    player: p,
                    id: p.id,
                });
                if (p.perks?.some((perk) => perk.type === "steelskin")) {
                    const point = { x: body.point.x + body.normal.x * 0.1, y: body.point.y + body.normal.y * 0.1 };
                    out.push({
                        type: "pan",
                        dist: distOf(point),
                        point,
                        normal: body.normal,
                        collidable: false,
                        layer: p.layer,
                        id: p.id,
                    });
                }
            } else if (pan) {
                out.push({
                    type: "pan",
                    dist: distOf(pan.point),
                    point: pan.point,
                    normal: pan.normal,
                    collidable: true,
                    layer: p.layer,
                    id: p.id,
                });
            }
            if (body || pan) done = true;
        });
    }

    /** First thing that stops the bullet on a -> b, with its effects on the way (survev bullet.ts:377-458). */
    private collide(t: Tracer, a: Vec2, b: Vec2, scene: BulletScene): Vec2 | null {
        const hits: Hit[] = [];
        this.obstacleHits(t, a, b, scene, hits);
        this.playerHits(t, a, b, scene, hits);
        if (!hits.length) return null;
        hits.sort((x, y) => x.dist - y.dist);
        const shooterDown = this.shooterDown(t, scene);
        for (const h of hits) {
            if (h.type === "obstacle" && h.obstacle) {
                t.chipped.add(h.id);
                this.hitFx(h.obstacle.hitParticle, h.obstacle.sound.bullet, h.point, h.normal, h.layer);
            } else if (h.type === "player" && h.player) {
                // no blood nor sound while the shooter is dead or downed (survev: avoids confusion with bullets
                // the server inactivated when their shooter died)
                if (!shooterDown) this.playerHitFx(h.player, h.point, t, scene);
                t.playerFx = true;
            } else if (h.type === "pan") {
                const pan = GameObjectDefs.pan as MeleeDef | undefined;
                this.hitFx("barrelChip", pan?.sound.bullet, h.point, h.normal, h.layer);
                this.hits.pan++;
            }
            if (h.collidable) return h.point;
        }
        return null;
    }

    private shooterDown(t: Tracer, scene: BulletScene): boolean {
        const shooter = scene.playerById(t.shooterId);
        return !!shooter && (shooter.dead || shooter.downed);
    }

    /** One chip flying off the surface and the material's impact sound (survev bullet.ts playHitFx). */
    private hitFx(particle: string, sound: string | undefined, pos: Vec2, normal: Vec2, layer: number): void {
        const ang = (Math.random() - 0.5) * (Math.PI / 3);
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const vel = {
            x: (normal.x * cos - normal.y * sin) * HIT_PARTICLE_SPEED,
            y: (normal.x * sin + normal.y * cos) * HIT_PARTICLE_SPEED,
        };
        this.particles.add(particle, layer, pos, vel);
        if (sound) this.audio.playGroup(sound, { pos, layer, filter: "muffled" });
    }

    /**
     * Blood splat inside the hit player's view at the impact offset, so it moves with the player, and the flesh-hit
     * sound (survev bullet.ts:409-440); Perky Shoot shooters on turkey maps add feathers.
     */
    private playerHitFx(target: PlayerView, point: Vec2, t: Tracer, scene: BulletScene): void {
        if (this.turkeyMode && scene.playerById(t.shooterId)?.perks?.some((p) => p.type === "turkey_shoot")) {
            const a = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 3;
            this.particles.add("turkeyFeathersHit", target.layer, target.pos, {
                x: Math.cos(a) * speed,
                y: Math.sin(a) * speed,
            });
        }
        const parent = scene.playerContainer(target.id);
        if (parent) {
            const offset = {
                x: (point.x - target.pos.x) * PIXELS_PER_UNIT,
                y: -(point.y - target.pos.y) * PIXELS_PER_UNIT,
            };
            this.particles.add("bloodSplat", target.layer, offset, { x: 0, y: 0 }, { rot: BLOOD_ROT, parent });
            this.hits.blood++;
        }
        this.playerHitSound(target);
        const def = GameObjectDefs[t.bulletType] as BulletDef | undefined;
        if (this.hitListener && def?.type === "bullet") {
            const travelled = Math.hypot(point.x - t.startPos.x, point.y - t.startPos.y);
            const nominal = nominalBulletDamage(def, t.reflectCount, travelled);
            this.hitListener.onPlayerHit(target, point, t.dir, nominal, t.shooterId);
        }
    }

    /** survev bullet.ts createBulletHit: the muffled flesh hit at the player (also played by the kill frame). */
    playerHitSound(target: Pick<PlayerView, "pos" | "layer">): void {
        this.audio.playGroup("player_bullet_hit", {
            pos: target.pos,
            layer: target.layer,
            fallOff: 1,
            filter: "muffled",
        });
        this.hits.sounds++;
    }

    /**
     * The simulation says this bullet hit a player the client missed (positions differ slightly): the same effects on
     * the nearest player. Nothing when that player is dead (the Kill message plays the hit sound) or the shooter is
     * down.
     */
    private serverHitFx(t: Tracer, scene: BulletScene): void {
        let best: PlayerView | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        scene.forEachPlayer((p) => {
            if (p.id === t.shooterId && !t.damageSelf) return;
            const d = Math.hypot(p.pos.x - t.pos.x, p.pos.y - t.pos.y);
            if (d < bestDist) {
                bestDist = d;
                best = p;
            }
        });
        const target = best as PlayerView | null;
        if (!target || target.dead || this.shooterDown(t, scene)) return;
        if (bestDist < GameConfig.player.radius * (target.scale || 1) + 1.5) this.playerHitFx(target, t.pos, t, scene);
    }

    update(dt: number, scene: BulletScene): void {
        for (const [id, age] of this.seen) {
            if (age + dt > ID_MEMORY) this.seen.delete(id);
            else this.seen.set(id, age + dt);
        }
        let visible = 0;
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const t = this.tracers[i];
            if (t.collided) {
                t.scale = Math.max(t.scale - dt * COLLIDED_SHRINK, 0);
                if (t.scale <= 0) {
                    this.release(i);
                    continue;
                }
            }
            if (t.alive) this.advance(t, dt, scene);
            const dist = Math.hypot(t.pos.x - t.startPos.x, t.pos.y - t.startPos.y);
            const local = toLocal(t.pos);
            t.container.position.set(local.x, local.y);
            t.container.scale.set(Math.min(t.tracerLength * 15, dist / 2) * t.scale, 1);
            this.renderer.add(t.container, t.layer, TRAIL_Z_ORD, t.id % 2 ** 31);
            visible++;
        }
        this.visibleCount = visible;
        if (this.colliders.size > 2048) this.colliders.clear();
        this.flares.update(dt);
    }

    private advance(t: Tracer, dt: number, scene: BulletScene): void {
        let travelled = Math.hypot(t.pos.x - t.startPos.x, t.pos.y - t.startPos.y);
        if (travelled > t.distance) {
            // a late report cut the bullet short: pull the head back to where it stopped
            t.pos = { x: t.startPos.x + t.dir.x * t.distance, y: t.startPos.y + t.dir.y * t.distance };
            travelled = t.distance;
        }
        const left = t.distance - travelled;
        const step = Math.min(left, dt * t.speed);
        const old = t.pos;
        let next = { x: old.x + t.dir.x * step, y: old.y + t.dir.y * step };
        const cam = scene.cameraPos;
        if (
            !t.whizHeard &&
            scene.activeAlive &&
            sameAudioLayer(scene.activeLayer, t.layer) &&
            t.shooterId !== scene.localId &&
            Math.hypot(cam.x - next.x, cam.y - next.y) < WHIZ_DIST
        ) {
            t.whizHeard = true;
            this.audio.playGroup("bullet_whiz", { pos: next, fallOff: 4 });
        }
        if (t.suppressed && t.alphaRate < 1) t.sprite.alpha = Math.max(t.alphaMin, t.sprite.alpha * t.alphaRate);
        const stop = step > 0 ? this.collide(t, old, next, scene) : null;
        if (stop) next = stop;
        t.pos = next;
        // crossing stairs moves the tracer to the stairs layer for good (survev bullet.ts:459-498)
        if (!(t.layer & 2) && step > 0 && scene.segmentOnStairs(old, next)) {
            t.layer |= 2;
            this.hits.stairs++;
        }
        if (stop || step >= left - 1e-6) {
            if (t.hitPlayer && !t.playerFx) this.serverHitFx(t, scene);
            t.alive = false;
            t.collided = true;
        }
    }

    private release(index: number): void {
        const t = this.tracers[index];
        this.tracers.splice(index, 1);
        t.container.removeFromParent();
        t.container.visible = false;
        this.free.push(t);
    }

    clear(): void {
        for (let i = this.tracers.length - 1; i >= 0; i--) this.release(i);
        this.seen.clear();
        this.colliders.clear();
        this.flares.clear();
    }
}
