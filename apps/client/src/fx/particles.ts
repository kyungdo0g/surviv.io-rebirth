// Short-lived world particles (casings, hit chips, blood, explosion bursts, smoke puffs, heal/boost effects) with
// drag, spin, and scale/alpha ramps, drawn as pooled sprites in the render layers, plus emitters that spawn them
// continuously (chimney smoke, heal effects). Motion follows survev client/src/objects/particles.ts
// ParticleBarn.m_update: scale lerps over `scaleLerp` of the life (or grows by `scaleExp` per second), alpha lerps
// from alphaStart to alphaEnd over `alphaLerp` (or changes by `alphaExp` per second), with an optional fade-in
// (`alphaIn`); particles of an emitter are multiplied by its alpha.
import type { Vec2 } from "@rebirth/core";
import type { Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { adjustValue } from "../objects/types.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
import { PARTICLE_DEFS, type ParticleDef, pick, type Range } from "./particleDefs.ts";
import { EMITTER_DEFS, type EmitterDef, PARTICLE_DEFS_M5 } from "./particleDefsM5.ts";

/** default zOrd of particles (survev addParticle) */
const DEFAULT_Z_ORD = 20;
/** hard cap so a long firefight cannot grow the pool without bound */
const MAX_PARTICLES = 768;

const DEFS: Readonly<Record<string, ParticleDef>> = { ...PARTICLE_DEFS, ...PARTICLE_DEFS_M5 };

interface Particle {
    sprite: Sprite;
    def: ParticleDef;
    pos: Vec2;
    vel: Vec2;
    rot: number;
    rotVel: number;
    rotDrag: number;
    drag: number;
    life: number;
    ticker: number;
    delay: number;
    scale: number;
    scaleEnd: number;
    alpha: number;
    alphaEnd: number;
    alphaInStart: number;
    alphaInEnd: number;
    layer: number;
    zOrd: number;
    /** stable sort key within the zOrd (spawn order) */
    zIdx: number;
    emitter: Emitter | null;
}

export interface ParticleOptions {
    /** scale multiplier (casings: GunDef.particle.shellScale) */
    scale?: number;
    /** initial rotation in screen radians; random by default */
    rot?: number;
    zOrd?: number;
    /** seconds before the particle appears */
    delay?: number;
    /** overrides the def's drag */
    drag?: number;
    /** overrides the def's colour */
    color?: number;
}

export interface EmitterOptions {
    pos: Vec2;
    /** unit spawn direction; default +y (up) */
    dir?: Vec2;
    scale?: number;
    layer?: number;
    zOrd?: number;
    /** seconds the emitter runs; forever by default */
    duration?: number;
    radius?: number;
    rateMult?: number;
    /** multiplies the particle speed (unit conversion of emitters measured in sprite pixels) */
    speedMult?: number;
    /** overrides the particle def's colour (revive particles are purple, M6) */
    color?: () => number;
}

/** A continuous particle source; move it by setting `pos`, stop it with `stop()`. */
export class Emitter {
    readonly type: string;
    readonly def: EmitterDef;
    pos: Vec2;
    dir: Vec2;
    scale: number;
    layer: number;
    zOrd: number;
    radius: number;
    rateMult: number;
    speedMult: number;
    duration: number;
    color: (() => number) | undefined;
    /** spawning is paused while disabled (the emitter keeps its place) */
    enabled = true;
    /** multiplies the alpha of its particles (ceiling fade of chimney smoke) */
    alpha = 1;
    ticker = 0;
    nextSpawn = 0;
    spawnCount = 0;
    active = true;

    constructor(type: string, def: EmitterDef, opts: EmitterOptions, particleZOrd: number) {
        this.type = type;
        this.def = def;
        this.pos = { x: opts.pos.x, y: opts.pos.y };
        this.dir = opts.dir ? { x: opts.dir.x, y: opts.dir.y } : { x: 0, y: 1 };
        this.scale = opts.scale ?? 1;
        this.layer = opts.layer ?? 0;
        this.zOrd = opts.zOrd ?? def.zOrd ?? particleZOrd;
        this.radius = opts.radius ?? def.radius;
        this.rateMult = opts.rateMult ?? 1;
        this.speedMult = opts.speedMult ?? 1;
        this.duration = opts.duration ?? Number.POSITIVE_INFINITY;
        this.color = opts.color;
    }

    stop(): void {
        this.duration = this.ticker;
    }
}

/** remap t from [a, b] to [from, to], clamped */
function remap(t: number, a: number, b: number, from: number, to: number): number {
    const u = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : t >= b ? 1 : 0;
    return from + (to - from) * u;
}

function randomInCircle(rad: number): Vec2 {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * rad;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export class ParticleSystem {
    private readonly renderer: Renderer;
    private readonly textures: TextureStore;
    private readonly particles: Particle[] = [];
    private readonly emitters: Emitter[] = [];
    private spawned = 0;
    /** biome valueAdjust (Halloween darkens particles) */
    valueAdjust = 1;
    /** particles spawned per type since boot (tests) */
    readonly spawnedByType = new Map<string, number>();

    constructor(renderer: Renderer, textures: TextureStore) {
        this.renderer = renderer;
        this.textures = textures;
    }

    get count(): number {
        return this.particles.length;
    }

    get emitterCount(): number {
        return this.emitters.length;
    }

    /** Spawns one particle of `type` at world position `pos` moving at `vel` (world units/s). */
    add(type: string, layer: number, pos: Vec2, vel: Vec2, opts: ParticleOptions = {}, emitter?: Emitter): void {
        const def = DEFS[type];
        if (!def) return;
        if (this.particles.length >= MAX_PARTICLES) this.free(0);
        const sprite = this.renderer.pool.acquire();
        const image = def.image[Math.floor(Math.random() * def.image.length)];
        const scale = opts.scale ?? 1;
        const life = pick(def.life);
        const start = pick(def.scaleStart) * scale;
        const end = def.scaleExp !== undefined ? start : pick(def.scaleEnd) * scale;
        // rasterize for the largest size the particle reaches (growing ripples: at the end of their life)
        const grown = def.scaleExp !== undefined ? start + Math.max(0, def.scaleExp) * life : end;
        this.textures.apply(sprite, image, Math.max(start, grown, 0.25));
        const color = opts.color ?? (typeof def.color === "function" ? def.color() : def.color);
        sprite.tint = def.ignoreValueAdjust ? color : adjustValue(color, this.valueAdjust);
        sprite.visible = false;
        const alphaIn = def.alphaIn;
        this.particles.push({
            sprite,
            def,
            pos: { x: pos.x, y: pos.y },
            vel: { x: vel.x, y: vel.y },
            rot: opts.rot ?? Math.random() * Math.PI * 2,
            rotVel: pick(def.rotVel) * (Math.random() < 0.5 ? -1 : 1),
            rotDrag: pick(def.drag) / 2,
            drag: opts.drag ?? pick(def.drag),
            life,
            ticker: 0,
            delay: opts.delay ?? 0,
            scale: start,
            scaleEnd: end,
            alpha: def.alphaStart ?? 1,
            alphaEnd: def.alphaEnd ?? 0,
            alphaInStart: alphaIn ? alphaIn.start : 0,
            alphaInEnd: alphaIn ? alphaIn.end : 0,
            layer,
            zOrd: opts.zOrd ?? def.zOrd ?? DEFAULT_Z_ORD,
            zIdx: this.spawned++ % 2 ** 31,
            emitter: emitter ?? null,
        });
        this.spawnedByType.set(type, (this.spawnedByType.get(type) ?? 0) + 1);
    }

    /** Starts an emitter of `type` (EMITTER_DEFS). */
    addEmitter(type: string, opts: EmitterOptions): Emitter {
        const def = EMITTER_DEFS[type] ?? EMITTER_DEFS.heal_basic;
        const emitter = new Emitter(type, def, opts, DEFS[def.particle]?.zOrd ?? DEFAULT_Z_ORD);
        if (!EMITTER_DEFS[type]) emitter.stop();
        this.emitters.push(emitter);
        return emitter;
    }

    private free(index: number): void {
        const p = this.particles[index];
        this.renderer.pool.release(p.sprite);
        this.particles.splice(index, 1);
    }

    private updateEmitters(dt: number): void {
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            const e = this.emitters[i];
            if (!e.enabled) {
                if (e.ticker >= e.duration) {
                    e.active = false;
                    this.emitters.splice(i, 1);
                }
                continue;
            }
            e.ticker += dt;
            e.nextSpawn -= dt;
            const def = e.def;
            const max = def.maxCount ?? Number.POSITIVE_INFINITY;
            while (e.nextSpawn <= 0 && e.spawnCount < max) {
                const off = randomInCircle(e.scale * e.radius);
                const spread = (Math.random() - 0.5) * def.angle;
                const c = Math.cos(spread);
                const s = Math.sin(spread);
                const speed = pick(def.speed) * e.speedMult;
                const vel = { x: (e.dir.x * c - e.dir.y * s) * speed, y: (e.dir.x * s + e.dir.y * c) * speed };
                const rot = def.rot === undefined ? undefined : pick(def.rot as Range);
                this.add(
                    def.particle,
                    e.layer,
                    { x: e.pos.x + off.x, y: e.pos.y + off.y },
                    vel,
                    { scale: e.scale, rot, zOrd: e.zOrd, color: e.color?.() },
                    e,
                );
                e.nextSpawn += pick(def.rate) * e.rateMult;
                e.spawnCount++;
            }
            if (e.ticker >= e.duration) {
                e.active = false;
                this.emitters.splice(i, 1);
            }
        }
    }

    update(dt: number): void {
        this.updateEmitters(dt);
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.ticker += dt;
            if (p.ticker < p.delay) continue;
            const def = p.def;
            const t = Math.min((p.ticker - p.delay) / p.life, 1);
            const drag = 1 / (1 + dt * p.drag);
            p.vel.x *= drag;
            p.vel.y *= drag;
            p.pos.x += p.vel.x * dt;
            p.pos.y += p.vel.y * dt;
            p.rotVel *= 1 / (1 + dt * p.rotDrag);
            p.rot += p.rotVel * dt;
            let scale: number;
            if (def.scaleExp !== undefined) {
                p.scale += dt * def.scaleExp;
                scale = p.scale;
            } else {
                const lerp = def.scaleLerp ?? [0, 1];
                scale = remap(t, lerp[0], lerp[1], p.scale, p.scaleEnd);
            }
            let alpha: number;
            if (def.alphaExp !== undefined) {
                p.alpha = Math.max(p.alpha + dt * def.alphaExp, 0);
                alpha = p.alpha;
            } else {
                alpha = remap(t, def.alphaLerp[0], def.alphaLerp[1], p.alpha, p.alphaEnd);
            }
            if (def.alphaIn && t < def.alphaIn.lerp[1]) {
                alpha = remap(t, def.alphaIn.lerp[0], def.alphaIn.lerp[1], p.alphaInStart, p.alphaInEnd);
            }
            if (p.emitter) alpha *= p.emitter.alpha;
            const local = toLocal(p.pos);
            const s = p.sprite;
            s.position.set(local.x, local.y);
            s.scale.set(scale);
            s.rotation = p.rot;
            s.alpha = alpha;
            s.visible = true;
            this.renderer.add(s, p.layer, p.zOrd, p.zIdx);
            if (t >= 1) this.free(i);
        }
    }

    clear(): void {
        for (let i = this.particles.length - 1; i >= 0; i--) this.free(i);
        for (const e of this.emitters) e.active = false;
        this.emitters.length = 0;
    }
}
