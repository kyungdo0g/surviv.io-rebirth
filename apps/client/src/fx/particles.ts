// Short-lived world particles (casings, hit chips, blood) with drag, spin, and scale/alpha ramps, drawn as pooled
// sprites in the render layers. Motion follows survev client/src/objects/particles.ts ParticleBarn.m_update.
import type { Vec2 } from "@rebirth/core";
import type { Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { adjustValue } from "../objects/types.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
import { PARTICLE_DEFS, type ParticleDef, pick } from "./particleDefs.ts";

/** default zOrd of particles (survev addParticle) */
const DEFAULT_Z_ORD = 20;
/** hard cap so a long firefight cannot grow the pool without bound */
const MAX_PARTICLES = 512;

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
    layer: number;
    zOrd: number;
    /** stable sort key within the zOrd (spawn order) */
    zIdx: number;
}

export interface ParticleOptions {
    /** scale multiplier (casings: GunDef.particle.shellScale) */
    scale?: number;
    /** initial rotation in screen radians; random by default */
    rot?: number;
    zOrd?: number;
    /** seconds before the particle appears */
    delay?: number;
}

/** remap t from [a, b] to [from, to], clamped */
function remap(t: number, a: number, b: number, from: number, to: number): number {
    const u = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : t >= b ? 1 : 0;
    return from + (to - from) * u;
}

export class ParticleSystem {
    private readonly renderer: Renderer;
    private readonly textures: TextureStore;
    private readonly particles: Particle[] = [];
    private spawned = 0;
    /** biome valueAdjust (Halloween darkens particles) */
    valueAdjust = 1;

    constructor(renderer: Renderer, textures: TextureStore) {
        this.renderer = renderer;
        this.textures = textures;
    }

    get count(): number {
        return this.particles.length;
    }

    /** Spawns one particle of `type` at world position `pos` moving at `vel` (world units/s). */
    add(type: string, layer: number, pos: Vec2, vel: Vec2, opts: ParticleOptions = {}): void {
        const def = PARTICLE_DEFS[type];
        if (!def) return;
        if (this.particles.length >= MAX_PARTICLES) this.free(0);
        const sprite = this.renderer.pool.acquire();
        const image = def.image[Math.floor(Math.random() * def.image.length)];
        this.textures.apply(sprite, image, 0.25);
        const color = typeof def.color === "function" ? def.color() : def.color;
        sprite.tint = adjustValue(color, this.valueAdjust);
        sprite.visible = false;
        const scale = opts.scale ?? 1;
        const drag = pick(def.drag);
        this.particles.push({
            sprite,
            def,
            pos: { x: pos.x, y: pos.y },
            vel: { x: vel.x, y: vel.y },
            rot: opts.rot ?? Math.random() * Math.PI * 2,
            rotVel: pick(def.rotVel) * (Math.random() < 0.5 ? -1 : 1),
            rotDrag: pick(def.drag) / 2,
            drag,
            life: pick(def.life),
            ticker: 0,
            delay: opts.delay ?? 0,
            scale: pick(def.scaleStart) * scale,
            scaleEnd: pick(def.scaleEnd) * scale,
            alpha: def.alphaStart ?? 1,
            layer,
            zOrd: opts.zOrd ?? def.zOrd ?? DEFAULT_Z_ORD,
            zIdx: this.spawned++ % 2 ** 31,
        });
    }

    private free(index: number): void {
        const p = this.particles[index];
        this.renderer.pool.release(p.sprite);
        this.particles.splice(index, 1);
    }

    update(dt: number): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.ticker += dt;
            if (p.ticker < p.delay) continue;
            const t = Math.min((p.ticker - p.delay) / p.life, 1);
            const drag = 1 / (1 + dt * p.drag);
            p.vel.x *= drag;
            p.vel.y *= drag;
            p.pos.x += p.vel.x * dt;
            p.pos.y += p.vel.y * dt;
            p.rotVel *= 1 / (1 + dt * p.rotDrag);
            p.rot += p.rotVel * dt;
            const local = toLocal(p.pos);
            const s = p.sprite;
            s.position.set(local.x, local.y);
            s.scale.set(remap(t, 0, 1, p.scale, p.scaleEnd));
            s.rotation = p.rot;
            s.alpha = remap(t, p.def.alphaLerp[0], p.def.alphaLerp[1], p.alpha, 0);
            s.visible = true;
            this.renderer.add(s, p.layer, p.zOrd, p.zIdx);
            if (t >= 1) this.free(i);
        }
    }

    clear(): void {
        for (let i = this.particles.length - 1; i >= 0; i--) this.free(i);
    }
}
