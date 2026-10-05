// Smoke clouds (survev client/src/objects/smoke.ts SmokeBarn; docs/research/items/throwables.md "Smoke Grenade"):
// every SmokeView is one soft cloud sprite (part-smoke-02/03) whose diameter eases towards 2 x `rad` and whose
// position eases towards the cloud's (both at 3/s), slowly rotating, light grey at 90 % alpha. A cloud that leaves
// the snapshot fades out over 0.5-0.75 s. Clouds draw above players (zOrd 1000) or, when emitted inside a building,
// under its roof (zOrd 500), on the top render layer so stair masks do not cut them (except under a structure mask
// while the viewer stands on stairs).
import type { Vec2 } from "@rebirth/core";
import type { SmokeView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
import { hsv } from "./particleDefs.ts";

const IMAGES = ["part-smoke-02.img", "part-smoke-03.img"];
/** logical size of the smoke images (sprite-sizes.json: 256 x 256) */
const IMAGE_SIZE = 256;
const ALPHA = 0.9;
const LERP_RATE = 3;
const INTERIOR_Z_ORD = 500;
const Z_ORD = 1000;

interface Cloud {
    id: number;
    sprite: Sprite;
    pos: Vec2;
    posTarget: Vec2;
    rad: number;
    radTarget: number;
    rot: number;
    rotVel: number;
    fade: boolean;
    fadeTicker: number;
    fadeDuration: number;
    layer: number;
    interior: boolean;
    zIdx: number;
    seen: boolean;
}

export interface SmokeDeps {
    renderer: Renderer;
    textures: TextureStore;
    /** whether a circle at `pos` touches a structure's stair mask */
    insideStructureMask(pos: Vec2, rad: number): boolean;
}

function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

export class SmokeSystem {
    private readonly deps: SmokeDeps;
    /** live clouds by smoke id */
    private readonly clouds = new Map<number, Cloud>();
    /** clouds fading out after their smoke left the snapshot */
    private readonly fading: Cloud[] = [];
    /** newer clouds draw under older ones (survev SmokeBarn zIdx counts down) */
    private zIdx = 2 ** 31 - 1;
    /** clouds drawn last frame (tests) */
    visibleCount = 0;

    constructor(deps: SmokeDeps) {
        this.deps = deps;
    }

    get count(): number {
        return this.clouds.size;
    }

    /** Applies a snapshot's smoke list (complete for the view). */
    apply(list: readonly SmokeView[]): void {
        for (const c of this.clouds.values()) c.seen = false;
        for (const s of list) {
            let c = this.clouds.get(s.id);
            if (!c) {
                c = this.create(s);
                this.clouds.set(s.id, c);
            }
            c.seen = true;
            c.posTarget = { x: s.pos.x, y: s.pos.y };
            c.radTarget = s.rad;
            c.layer = s.layer;
            c.interior = s.interior;
        }
        for (const c of [...this.clouds.values()]) {
            if (c.seen) continue;
            this.clouds.delete(c.id);
            c.fade = true;
            this.fading.push(c);
        }
    }

    private create(s: SmokeView): Cloud {
        const sprite = this.deps.renderer.pool.acquire();
        this.deps.textures.apply(sprite, IMAGES[Math.floor(Math.random() * IMAGES.length)], 1);
        sprite.tint = hsv(0, 0, 0.9 + Math.random() * 0.05);
        return {
            id: s.id,
            sprite,
            pos: { x: s.pos.x, y: s.pos.y },
            posTarget: { x: s.pos.x, y: s.pos.y },
            rad: s.rad,
            radTarget: s.rad,
            rot: Math.random() * Math.PI * 2,
            rotVel: Math.PI * (0.25 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1),
            fade: false,
            fadeTicker: 0,
            fadeDuration: 0.5 + Math.random() * 0.25,
            layer: s.layer,
            interior: s.interior,
            zIdx: this.zIdx--,
            seen: true,
        };
    }

    update(dt: number, activeLayer: number): void {
        let visible = 0;
        for (const c of this.clouds.values()) if (this.step(c, dt, activeLayer)) visible++;
        for (let i = this.fading.length - 1; i >= 0; i--) {
            const c = this.fading[i];
            if (this.step(c, dt, activeLayer)) continue;
            this.deps.renderer.pool.release(c.sprite);
            this.fading.splice(i, 1);
        }
        this.visibleCount = visible;
    }

    /** Advances and places one cloud; false once it has faded out. */
    private step(c: Cloud, dt: number, activeLayer: number): boolean {
        const t = Math.min(1, dt * LERP_RATE);
        c.rad += (c.radTarget - c.rad) * t;
        c.pos.x += (c.posTarget.x - c.pos.x) * t;
        c.pos.y += (c.posTarget.y - c.pos.y) * t;
        c.rotVel *= 1 / (1 + dt * 0.1);
        c.rot += c.rotVel * dt;
        if (c.fade) c.fadeTicker += dt;
        if (c.fadeTicker >= c.fadeDuration) return false;
        let layer = c.layer;
        const onStairs = (activeLayer & 2) !== 0;
        if (
            (sameLayer(c.layer, activeLayer) || onStairs) &&
            (c.layer === 1 || !onStairs || !this.deps.insideStructureMask(c.pos, 1))
        ) {
            layer |= 2;
        }
        const s = c.sprite;
        const local = toLocal(c.pos);
        s.position.set(local.x, local.y);
        s.scale.set((c.rad * 2 * PIXELS_PER_UNIT) / IMAGE_SIZE);
        s.rotation = c.rot;
        s.alpha = Math.min(1, Math.max(0, 1 - c.fadeTicker / c.fadeDuration)) * ALPHA;
        s.visible = true;
        this.deps.renderer.add(s, layer, c.interior ? INTERIOR_Z_ORD : Z_ORD, c.zIdx);
        return true;
    }

    clear(): void {
        for (const c of this.clouds.values()) this.deps.renderer.pool.release(c.sprite);
        for (const c of this.fading) this.deps.renderer.pool.release(c.sprite);
        this.clouds.clear();
        this.fading.length = 0;
    }
}
