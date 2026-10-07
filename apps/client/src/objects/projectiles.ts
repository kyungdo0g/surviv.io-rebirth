// Flying projectiles: thrown grenades, potato gun shots and air strike bombs (survev client/src/objects/projectile.ts;
// docs/research/items/throwables.md). Each ProjectileView is its throwable's `worldImg`, scaled up with its height
// (posZ 0..maxHeight -> 1x..4.75x), spinning at `throwPhysics.spinVel` with `spinDrag` (3x in water, where it is
// drawn at 30 % alpha), with an optional speed trail, the pulsing strobe light of an IR strobe, and a bounce sound
// when it touches the ground (frag_grass / frag_sand / frag_water, hits channel). Positions are interpolated between
// snapshots like other objects. Air strike bombs are drawn above everything on the ground floor and are invisible
// when they fall onto a roof (the original hides them indoors).
// Rebirth addition: a soft ground shadow under every projectile that drifts away and fades as it rises, so the
// throw arc reads at a glance (the original conveys the height by the sprite scale alone).
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, isAirstrikeBomb, type ThrowableDef } from "@rebirth/defs";
import type { ProjectileView } from "@rebirth/sim";
import { Container, ImageSource, type Sprite, Texture } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import type { ParticleSystem } from "../fx/particles.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";

const MAX_HEIGHT = GameConfig.projectile.maxHeight;
/** survev projectile.ts: grounded projectiles at zOrd 14 (under players), airborne at 25 (over them) */
const GROUND_Z_ORD = 14;
const AIR_Z_ORD = 25;
const SHADOW_Z_ORD = 13.5;
const ONTOP_Z_ORD = 1000;
/** strobe light pulse: easeInExpo scale 0..12 at 1.25 cycles per second (survev strobe variables) */
const STROBE_SCALE_MAX = 12;
const STROBE_SPEED = 1.25;
/** shadow: size relative to the sprite on the ground and at the top of the arc, alpha, drift per unit of height */
const SHADOW_SIZE = [1.3, 0.95] as const;
const SHADOW_ALPHA = [0.5, 0.28] as const;
const SHADOW_DRIFT = 0.6;
const SHADOW_TEX_SIZE = 64;
/** logical size of most projectile images (sprite-sizes.json: 128 px; bombs and smoke 160) */
const DEFAULT_IMG_SIZE = 128;

const GROUND_SOUNDS: Readonly<Record<string, string>> = { grass: "frag_grass", sand: "frag_sand", water: "frag_water" };

function easeInExpo(t: number): number {
    return t <= 0 ? 0 : 2 ** (10 * (t - 1));
}

function remap(v: number, a: number, b: number, from: number, to: number): number {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return from + (to - from) * t;
}

let shadowTexture: Texture | null = null;

/** A soft round shadow drawn once into a canvas (radial gradient, black to transparent). */
function softShadow(): Texture {
    if (shadowTexture) return shadowTexture;
    const canvas = document.createElement("canvas");
    canvas.width = SHADOW_TEX_SIZE;
    canvas.height = SHADOW_TEX_SIZE;
    const ctx = canvas.getContext("2d")!;
    const r = SHADOW_TEX_SIZE / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.75)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SHADOW_TEX_SIZE, SHADOW_TEX_SIZE);
    shadowTexture = new Texture({ source: new ImageSource({ resource: canvas }) });
    shadowTexture.label = "projectile-shadow";
    return shadowTexture;
}

export interface ProjectileDeps {
    renderer: Renderer;
    textures: TextureStore;
    audio: AudioEngine;
    particles: ParticleSystem;
    /** ground surface at `pos` ("water", "sand", "grass", ...) */
    surfaceAt(pos: Vec2, layer: number): string;
    /** whether `pos` is under a building roof */
    insideCeiling(pos: Vec2): boolean;
    /** whether a circle touches a structure's stairs / stair mask */
    insideStairs(pos: Vec2, rad: number): boolean;
    insideStairMask(pos: Vec2, rad: number): boolean;
    rippleColor: number;
}

interface Proj {
    id: number;
    type: string;
    def: ThrowableDef;
    container: Container;
    sprite: Sprite;
    trail: Sprite | null;
    strobe: Sprite | null;
    shadow: Sprite;
    layer: number;
    /** interpolation: from `visualOld` to `pos` over the snapshot interval */
    pos: Vec2;
    visualOld: Vec2;
    interpTicker: number;
    vel: Vec2;
    posZ: number;
    velZ: number;
    dir: Vec2;
    rot: number;
    rotVel: number;
    rotDrag: number;
    grounded: boolean;
    inWater: boolean;
    playHitSfx: boolean;
    alwaysOnTop: boolean;
    hidden: boolean;
    strobeTicker: number;
    strobeDir: number;
    seen: boolean;
    isNew: boolean;
}

export class ProjectileSystem {
    private readonly deps: ProjectileDeps;
    private readonly projs = new Map<number, Proj>();
    private interval = 0.03;
    /** projectiles and shadows drawn last frame (tests) */
    visibleCount = 0;
    shadowCount = 0;
    /** largest posZ seen since boot, and the highest projectile now (tests) */
    maxPosZ = 0;
    topZ = 0;

    constructor(deps: ProjectileDeps) {
        this.deps = deps;
    }

    get count(): number {
        return this.projs.size;
    }

    /** Applies a snapshot's projectile list (complete for the view); `interval` is the snapshot spacing (s). */
    apply(list: readonly ProjectileView[], interval: number): void {
        this.interval = Math.max(0.005, interval);
        for (const p of this.projs.values()) p.seen = false;
        for (const data of list) {
            let p = this.projs.get(data.id);
            if (p && p.type !== data.type) {
                this.free(p);
                p = undefined;
            }
            if (!p) {
                const created = this.create(data);
                if (!created) continue;
                p = created;
                this.projs.set(data.id, p);
            } else {
                this.updateData(p, data);
            }
            p.seen = true;
        }
        for (const p of [...this.projs.values()]) if (!p.seen) this.free(p);
    }

    private create(data: ProjectileView): Proj | null {
        const def = GameObjectDefs[data.type] as ThrowableDef | undefined;
        if (def?.type !== "throwable") return null;
        const pool = this.deps.renderer.pool;
        const container = new Container({ label: "projectile" });
        const sprite = pool.acquire();
        this.deps.textures.apply(sprite, def.worldImg.sprite, def.worldImg.scale * 4.75);
        sprite.tint = def.worldImg.tint;
        let trail: Sprite | null = null;
        if (def.trail) {
            trail = pool.acquire();
            this.deps.textures.apply(trail, "player-bullet-trail-02.img", 1);
            trail.anchor.set(1, 0.5);
            trail.tint = def.trail.tint;
            container.addChild(trail);
        }
        container.addChild(sprite);
        let strobe: Sprite | null = null;
        if (data.type === "strobe") {
            strobe = pool.acquire();
            this.deps.textures.apply(strobe, "part-strobe-01.img", 2);
            strobe.scale.set(0);
            container.addChild(strobe);
        }
        const shadow = pool.acquire();
        shadow.texture = softShadow();
        const rotVel = def.throwPhysics.spinVel * (def.throwPhysics.randomizeSpinDir && Math.random() < 0.5 ? -1 : 1);
        // air strike bombs (iron and the rebirth heavy shell) draw over everything
        const alwaysOnTop = isAirstrikeBomb(data.type);
        const p: Proj = {
            id: data.id,
            type: data.type,
            def,
            container,
            sprite,
            trail,
            strobe,
            shadow,
            layer: data.layer,
            pos: { x: data.pos.x, y: data.pos.y },
            visualOld: { x: data.pos.x, y: data.pos.y },
            interpTicker: 0,
            vel: { x: 0, y: 0 },
            posZ: data.posZ,
            velZ: 0,
            dir: { x: data.dir.x, y: data.dir.y },
            rot: 0,
            rotVel,
            rotDrag: def.throwPhysics.spinDrag * (1 + Math.random()),
            grounded: false,
            inWater: false,
            playHitSfx: !def.explodeOnImpact,
            alwaysOnTop,
            // air strike bombs falling onto a roof are not drawn (survev "airstrike-projectile related hacks")
            hidden: alwaysOnTop && this.deps.insideCeiling(data.pos),
            strobeTicker: 0,
            strobeDir: 1,
            seen: true,
            isNew: true,
        };
        this.maxPosZ = Math.max(this.maxPosZ, data.posZ);
        return p;
    }

    private updateData(p: Proj, data: ProjectileView): void {
        const moved = data.pos.x !== p.pos.x || data.pos.y !== p.pos.y;
        if (moved) {
            p.visualOld = this.visualPos(p);
            p.interpTicker = 0;
            p.vel = { x: (data.pos.x - p.pos.x) / this.interval, y: (data.pos.y - p.pos.y) / this.interval };
        } else {
            p.vel = { x: 0, y: 0 };
        }
        p.pos = { x: data.pos.x, y: data.pos.y };
        p.dir = { x: data.dir.x, y: data.dir.y };
        p.layer = data.layer;
        const velZOld = p.velZ;
        p.velZ = (data.posZ - p.posZ) / this.interval;
        p.posZ = data.posZ;
        this.maxPosZ = Math.max(this.maxPosZ, data.posZ);
        const surface = this.deps.surfaceAt(p.pos, p.layer);
        if (p.posZ <= 0.01) {
            if (!p.inWater && surface === "water") {
                this.deps.particles.add(
                    "waterRipple",
                    p.layer,
                    p.pos,
                    { x: 0, y: 0 },
                    {
                        rot: 0,
                        color: this.deps.rippleColor,
                    },
                );
            }
            p.inWater = surface === "water";
        }
        // bounce: the height stopped falling (survev ProjectileBarn ground sound)
        if (!p.isNew && !p.grounded && p.velZ >= 0 && velZOld < 0) {
            p.grounded = true;
            const group = GROUND_SOUNDS[surface] ?? "frag_grass";
            if (p.playHitSfx) this.deps.audio.playGroup(group, { pos: p.pos, layer: p.layer, filter: "muffled" });
        }
        p.isNew = false;
    }

    private visualPos(p: Proj): Vec2 {
        const t = Math.min(1, p.interpTicker / this.interval);
        return { x: p.visualOld.x + (p.pos.x - p.visualOld.x) * t, y: p.visualOld.y + (p.pos.y - p.visualOld.y) * t };
    }

    update(dt: number, activeLayer: number): void {
        const renderer = this.deps.renderer;
        let visible = 0;
        let shadows = 0;
        let topZ = 0;
        for (const p of this.projs.values()) {
            topZ = Math.max(topZ, p.posZ);
            const def = p.def;
            p.rotVel *= 1 / (1 + dt * p.rotDrag * (p.inWater ? 3 : 1));
            p.rot += p.rotVel * dt;
            p.interpTicker += dt;
            const pos = this.visualPos(p);
            const scale = def.worldImg.scale * remap(p.posZ, 0, MAX_HEIGHT, 1, 4.75);

            if (p.strobe) {
                p.strobeTicker = Math.min(1, Math.max(0, p.strobeTicker + dt * p.strobeDir * STROBE_SPEED));
                const s = easeInExpo(p.strobeTicker) * STROBE_SCALE_MAX;
                p.strobe.scale.set(s);
                if (s >= STROBE_SCALE_MAX || p.strobeTicker <= 0) p.strobeDir *= -1;
            }
            p.sprite.rotation = p.rot;
            p.sprite.alpha = p.inWater ? 0.3 : 1;
            if (p.trail && def.trail) {
                const speed = Math.hypot(p.vel.x, p.vel.y);
                const t =
                    remap(speed, def.throwPhysics.speed * 0.25, def.throwPhysics.speed, 0, 1) *
                    remap(p.posZ, 0.1, MAX_HEIGHT * 0.5, 0, 1);
                p.trail.scale.set(def.trail.maxLength * t, def.trail.width);
                p.trail.rotation = -Math.atan2(p.dir.y, p.dir.x);
                p.trail.alpha = def.trail.alpha * t;
                p.trail.visible = t > 0;
            }

            let layer = p.layer;
            let zOrd = p.posZ < 0.25 ? GROUND_Z_ORD : AIR_Z_ORD;
            // airborne over stairs on the viewer's floor: above the stairs (survev ProjectileBarn.m_update)
            const stairRad = def.rad * 0.5 * 3;
            if (
                p.posZ >= 0.25 &&
                (p.layer & 1) === (activeLayer & 1) &&
                this.deps.insideStairs(pos, stairRad) &&
                (!(activeLayer & 2) || !this.deps.insideStairMask(pos, stairRad))
            ) {
                layer |= 2;
                zOrd += 100;
            }
            if (p.alwaysOnTop && activeLayer === 0) {
                zOrd = ONTOP_Z_ORD;
                layer |= 2;
            }
            const local = toLocal(pos);
            p.container.position.set(local.x, local.y);
            p.container.scale.set(scale);
            p.container.visible = !p.hidden;
            renderer.add(p.container, layer, zOrd, p.id);

            // shadow on the ground, offset down-right and faded with the height
            const h = Math.min(1, Math.max(0, p.posZ / MAX_HEIGHT));
            const drift = p.posZ * SHADOW_DRIFT;
            const shadowLocal = toLocal({ x: pos.x + drift, y: pos.y - drift });
            const imgPx = (p.sprite.texture.width > 1 ? p.sprite.texture.width : DEFAULT_IMG_SIZE) * def.worldImg.scale;
            const size = SHADOW_SIZE[0] + (SHADOW_SIZE[1] - SHADOW_SIZE[0]) * h;
            p.shadow.position.set(shadowLocal.x, shadowLocal.y);
            p.shadow.scale.set((imgPx * size) / SHADOW_TEX_SIZE);
            p.shadow.alpha = (SHADOW_ALPHA[0] + (SHADOW_ALPHA[1] - SHADOW_ALPHA[0]) * h) * (p.inWater ? 0.3 : 1);
            p.shadow.visible = !p.hidden && !p.alwaysOnTop;
            renderer.add(p.shadow, p.layer, SHADOW_Z_ORD, p.id);
            if (p.container.visible) visible++;
            if (p.shadow.visible) shadows++;
        }
        this.visibleCount = visible;
        this.shadowCount = shadows;
        this.topZ = topZ;
    }

    private free(p: Proj): void {
        const pool = this.deps.renderer.pool;
        pool.release(p.sprite);
        if (p.trail) pool.release(p.trail);
        if (p.strobe) pool.release(p.strobe);
        pool.release(p.shadow);
        p.container.destroy({ children: true });
        this.projs.delete(p.id);
    }

    clear(): void {
        for (const p of [...this.projs.values()]) this.free(p);
    }
}
