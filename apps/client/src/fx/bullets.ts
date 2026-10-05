// Bullet tracers from the snapshot BulletEvents: a trail sprite whose head moves at the bullet speed from `pos`
// along `dir` and stops at `endDist` (it hit something) or `maxDist`. Bullets are checked against obstacles in view
// on the client too, for impact chips and sounds and to stop at destructible obstacles; player hits come from the
// simulation (`hitPlayer`). Drawing follows survev client/src/objects/bullet.ts (trail sprite
// player-bullet-trail-02, x-scale 0.8, y-scale tracerWidth, length min(tracerLength * 15, travelled / 2), container
// pivot 14.5 so the head sits on the bullet, ×6/s shrink after impact, reflected bullets at half alpha).
import { type Collider, collider, math, type Vec2 } from "@rebirth/core";
import {
    type BulletDef,
    GameConfig,
    GameObjectDefs,
    type GunDef,
    type MapDef,
    MapObjectDefs,
    type ObstacleDef,
} from "@rebirth/defs";
import type { BulletEvent, ObstacleView, PlayerView } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
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
/** blood splats draw over players (survev parents them to the hit player's container) */
const PLAYER_FX_Z_ORD = 19;

interface Tracer {
    id: number;
    container: Container;
    sprite: Sprite;
    shooterId: number;
    startPos: Vec2;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    speed: number;
    distance: number;
    tracerLength: number;
    hitPlayer: boolean;
    reflectCount: number;
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
    readonly localId: number;
    readonly cameraPos: Vec2;
    forEachObstacle(cb: (view: ObstacleView) => void): void;
    forEachPlayer(cb: (view: PlayerView) => void): void;
}

interface CachedCollider {
    scale: number;
    col: Collider;
    min: Vec2;
    max: Vec2;
}

function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

export class BulletSystem {
    private readonly renderer: Renderer;
    private readonly textures: TextureStore;
    private readonly audio: AudioEngine;
    private readonly particles: ParticleSystem;
    private readonly tracers: Tracer[] = [];
    private readonly free: Tracer[] = [];
    /** bullet id -> seconds since first seen, so a re-report updates instead of spawning a second tracer */
    private readonly seen = new Map<number, number>();
    private readonly colliders = new Map<number, CachedCollider>();
    private tracerColors: Record<string, Record<string, number>> = {};
    /** tracers drawn last frame (tests) */
    visibleCount = 0;
    /** tracers spawned since boot (tests) */
    spawned = 0;

    constructor(renderer: Renderer, textures: TextureStore, audio: AudioEngine, particles: ParticleSystem) {
        this.renderer = renderer;
        this.textures = textures;
        this.audio = audio;
        this.particles = particles;
    }

    /** Tracer colours for the map: GameConfig.tracerColors overridden by the biome's (survev onMapLoad). */
    setMap(mapDef: MapDef): void {
        const colors: Record<string, Record<string, number>> = {};
        for (const [key, value] of Object.entries(GameConfig.tracerColors)) colors[key] = { ...value };
        for (const [key, value] of Object.entries(mapDef.biome.tracerColors ?? {})) {
            colors[key] = { ...(colors[key] ?? {}), ...value };
        }
        this.tracerColors = colors;
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
            this.spawn(e);
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

    private spawn(e: BulletEvent): void {
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
        t.id = e.id;
        t.shooterId = e.shooterId;
        t.startPos = { x: e.pos.x, y: e.pos.y };
        t.pos = { x: e.pos.x, y: e.pos.y };
        t.dir = { x: e.dir.x, y: e.dir.y };
        t.layer = e.layer;
        t.speed = def.speed;
        t.distance = e.endDist ?? e.maxDist;
        t.tracerLength = def.tracerLength;
        t.hitPlayer = e.hitPlayer;
        t.reflectCount = e.reflectCount;
        t.alive = true;
        t.collided = false;
        t.scale = 1;
        t.alphaRate = colors.alphaRate ?? 1;
        t.alphaMin = colors.alphaMin ?? 0;
        t.suppressed = !!def.suppressed;
        t.whizHeard = false;
        t.chipped = new Set();
        t.playerFx = false;
        t.sprite.scale.set(0.8, def.tracerWidth);
        t.sprite.tint = colors.regular ?? 0xffffff;
        t.sprite.alpha = e.reflectCount > 0 ? 0.5 : 1;
        t.sprite.visible = true;
        t.container.rotation = -Math.atan2(e.dir.y, e.dir.x);
        t.container.visible = true;
        this.tracers.push(t);
        this.spawned++;
    }

    private obstacleCollider(view: ObstacleView, def: ObstacleDef): CachedCollider {
        let cached = this.colliders.get(view.id);
        if (!cached || cached.scale !== view.scale) {
            const col = collider.transform(def.collision, view.pos, math.oriToRad(view.ori), view.scale);
            const box = collider.toAabb(col);
            cached = { scale: view.scale, col, min: box.min, max: box.max };
            this.colliders.set(view.id, cached);
        }
        return cached;
    }

    /**
     * First thing hit on the segment a -> b (survev bullet.ts collision pass): obstacles get chips and impact
     * sounds and stop the bullet when collidable; a living player other than the shooter stops it with a blood
     * splat. Returns the stop point, or null when the bullet flies on.
     */
    private collide(t: Tracer, a: Vec2, b: Vec2, scene: BulletScene): Vec2 | null {
        const hits: Array<{
            dist: number;
            point: Vec2;
            normal: Vec2;
            obstacle?: ObstacleDef;
            player?: PlayerView;
            id: number;
            stop: boolean;
        }> = [];
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
            const stop = def.collidable && !(view.door?.open ?? false);
            hits.push({ dist: hit.dist, point: hit.point, normal: hit.normal, obstacle: def, id: view.id, stop });
        });
        scene.forEachPlayer((view) => {
            if (view.dead || (view.id === t.shooterId && t.reflectCount === 0)) return;
            if (!sameLayer(view.layer, t.layer) && !(view.layer & 2)) return;
            const rad = GameConfig.player.radius * (view.scale || 1);
            const hit = collider.intersectSegment({ type: 0, pos: view.pos, rad }, a, b);
            if (hit)
                hits.push({
                    dist: hit.dist,
                    point: hit.point,
                    normal: hit.normal,
                    player: view,
                    id: view.id,
                    stop: true,
                });
        });
        hits.sort((x, y) => x.dist - y.dist);
        for (const h of hits) {
            if (h.obstacle) {
                t.chipped.add(h.id);
                this.hitFx(h.obstacle.hitParticle, h.obstacle.sound.bullet, h.point, h.normal, t.layer);
            } else if (h.player) {
                this.playerHitFx(h.player, h.point);
                t.playerFx = true;
            }
            if (h.stop) return h.point;
        }
        return null;
    }

    /** One chip flying off the surface and the material's impact sound (survev bullet.ts playHitFx). */
    private hitFx(particle: string, sound: string, pos: Vec2, normal: Vec2, layer: number): void {
        const ang = (Math.random() - 0.5) * (Math.PI / 3);
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const vel = {
            x: (normal.x * cos - normal.y * sin) * HIT_PARTICLE_SPEED,
            y: (normal.x * sin + normal.y * cos) * HIT_PARTICLE_SPEED,
        };
        this.particles.add(particle, layer, pos, vel);
        this.audio.playGroup(sound, { pos, layer });
    }

    /** Blood splat at the impact point and the flesh-hit sound (survev bullet.ts player collision). */
    private playerHitFx(target: PlayerView, point: Vec2): void {
        this.particles.add("bloodSplat", target.layer, point, { x: 0, y: 0 }, { zOrd: PLAYER_FX_Z_ORD });
        this.audio.playGroup("player_bullet_hit", { pos: target.pos, layer: target.layer, fallOff: 1 });
    }

    /** The simulation says this bullet hit a player the client missed: splat on the nearest one. */
    private serverHitFx(t: Tracer, scene: BulletScene): void {
        let best: PlayerView | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        scene.forEachPlayer((p) => {
            const d = Math.hypot(p.pos.x - t.pos.x, p.pos.y - t.pos.y);
            if (!p.dead && d < bestDist) {
                bestDist = d;
                best = p;
            }
        });
        const target = best as PlayerView | null;
        if (target && bestDist < GameConfig.player.radius * (target.scale || 1) + 1.5) this.playerHitFx(target, t.pos);
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
        const stop = step > 0 ? this.collide(t, old, next, scene) : null;
        if (stop) next = stop;
        t.pos = next;
        if (t.suppressed && t.alphaRate < 1) t.sprite.alpha = Math.max(t.alphaMin, t.sprite.alpha * t.alphaRate);
        const cam = scene.cameraPos;
        if (!t.whizHeard && t.shooterId !== scene.localId && Math.hypot(cam.x - next.x, cam.y - next.y) < WHIZ_DIST) {
            t.whizHeard = true;
            this.audio.playGroup("bullet_whiz", { pos: next, fallOff: 4 });
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
    }
}
