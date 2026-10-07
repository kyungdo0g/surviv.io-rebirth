// Flare rounds (M9): bullets whose def has `addFlare` (the flare gun's bullet_flare) draw as a flare instead of a
// tracer. survev client/src/objects/flare.ts (FlareBarn): a part-flare-01 sprite tinted `flareColor` at alpha 0.8 that
// grows by easeOutExpo(timeAlive / 2.5) up to `maxFlareScale`, behind it the bullet trail (player-bullet-trail-02, the
// def's tracer colour and width, the trail fading by the colour's alphaRate x 0.9 every frame down to alphaMin); both
// at zOrd 1000 over the ground (renderer.addOverground: over everything unless the viewer is underground, where they
// stay hidden on the ground layer, or on stairs under a stair mask; survev flare.ts:158-168). The original stops
// placing a flare once it reached its range, so a viewer who goes underground during its fade still saw it; here the
// fading flare follows the viewer's floor too. Flares fly through everything (skipCollision) to their range at the def
// speed; there the flare keeps drifting while it shrinks by 0.5/s and fades by 1/s, the trail shrinking by 6/s. The
// original computes a smoke throttle but never spawns smoke, so neither does this.
import type { Vec2 } from "@rebirth/core";
import { type BulletDef, GameConfig, GameObjectDefs, type TracerColor } from "@rebirth/defs";
import type { BulletEvent } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";

const FLARE_SPRITE = "part-flare-01.img";
const TRAIL_SPRITE = "player-bullet-trail-02.img";
const TRAIL_PIVOT = 14.5;
const Z_ORD = 1000;
/** seconds to grow to full size (survev maxTimeAlive) */
const GROW_TIME = 2.5;
const FLARE_ALPHA = 0.8;
/** flare sprites are rasterized for their largest size */
const MAX_RASTER_SCALE = 2;

/** survev math.easeOutExpo */
function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

interface Flare {
    flareContainer: Container;
    flare: Sprite;
    trailContainer: Container;
    trail: Sprite;
    alive: boolean;
    collided: boolean;
    flareScale: number;
    maxFlareScale: number;
    trailScale: number;
    timeAlive: number;
    startPos: Vec2;
    pos: Vec2;
    dir: Vec2;
    speed: number;
    distance: number;
    tracerLength: number;
    alphaRate: number;
    alphaMin: number;
}

export class FlareSystem {
    private readonly renderer: Renderer;
    private readonly textures: TextureStore;
    private readonly flares: Flare[] = [];
    private readonly free: Flare[] = [];
    /** flares spawned since boot (tests) */
    spawned = 0;

    constructor(renderer: Renderer, textures: TextureStore) {
        this.renderer = renderer;
        this.textures = textures;
    }

    /** flares drawn now (tests) */
    get count(): number {
        return this.flares.length;
    }

    /** the flare and trail containers of the live flares (tests) */
    get containers(): Container[] {
        return this.flares.flatMap((f) => [f.flareContainer, f.trailContainer]);
    }

    /** current flare scale of the newest flare (tests), 0 when none */
    get newestScale(): number {
        return this.flares.length ? this.flares[this.flares.length - 1].flareScale : 0;
    }

    /** Starts a flare for a fired `addFlare` bullet (survev FlareBarn.addFlare). */
    add(e: BulletEvent, def: BulletDef): void {
        let f = this.free.pop();
        if (!f) {
            const flareContainer = new Container({ label: "flare" });
            const flare = this.renderer.pool.acquire();
            this.textures.apply(flare, FLARE_SPRITE, MAX_RASTER_SCALE);
            flareContainer.addChild(flare);
            const trailContainer = new Container({ label: "flare-trail" });
            trailContainer.pivot.set(TRAIL_PIVOT, 0);
            const trail = this.renderer.pool.acquire();
            this.textures.apply(trail, TRAIL_SPRITE, 1);
            trailContainer.addChild(trail);
            f = { flareContainer, flare, trailContainer, trail } as Flare;
        }
        // the original's flare colours come from GameConfig only (not the biome's)
        const colors: Partial<TracerColor> = GameConfig.tracerColors[def.tracerColor] ?? {};
        const variance = 1 + def.variance;
        f.alive = true;
        f.collided = false;
        f.flareScale = 0.01;
        f.maxFlareScale = def.maxFlareScale ?? 1;
        f.trailScale = 1;
        f.timeAlive = 0;
        f.startPos = { x: e.pos.x, y: e.pos.y };
        f.pos = { x: e.pos.x, y: e.pos.y };
        f.dir = { x: e.dir.x, y: e.dir.y };
        f.speed = def.speed * variance;
        // the simulation's range (the original redraws its own jitter, within 1 unit of it)
        f.distance = e.maxDist;
        f.tracerLength = def.tracerLength;
        f.alphaRate = colors.alphaRate ?? 0;
        f.alphaMin = colors.alphaMin ?? 0;
        const rot = -Math.atan2(e.dir.y, e.dir.x);
        f.flareContainer.rotation = rot;
        f.trailContainer.rotation = rot;
        f.trail.scale.set(0.8, def.tracerWidth);
        f.trail.tint = colors.regular ?? 0xffffff;
        f.trail.alpha = 1;
        f.flare.scale.set(1);
        f.flare.tint = def.flareColor ?? 0xffffff;
        f.flare.alpha = FLARE_ALPHA;
        f.flareContainer.visible = true;
        f.trailContainer.visible = true;
        this.flares.push(f);
        this.spawned++;
    }

    update(dt: number): void {
        for (let i = this.flares.length - 1; i >= 0; i--) {
            const f = this.flares[i];
            if (f.collided) {
                f.flareScale = Math.max(f.flareScale - dt * 0.5, 0);
                f.flare.alpha = Math.max(f.flare.alpha - dt, 0);
                f.trailScale = Math.max(f.trailScale - dt * 6, 0);
                f.trail.alpha = Math.max(f.trail.alpha - dt, 0);
                f.pos = { x: f.pos.x + f.dir.x * dt * f.speed, y: f.pos.y + f.dir.y * dt * f.speed };
                if (f.flare.alpha <= 0) {
                    this.release(i);
                    continue;
                }
            }
            if (f.alive) this.advance(f, dt);
            this.draw(f);
        }
    }

    private advance(f: Flare, dt: number): void {
        // the original compares the active player with a playerId it never sets: always the 0.9 rate
        if (f.alphaRate) f.trail.alpha = Math.max(f.alphaMin, f.trail.alpha * f.alphaRate * 0.9);
        f.timeAlive += dt;
        f.flareScale = easeOutExpo(f.timeAlive / GROW_TIME) * f.maxFlareScale;
        const travelled = Math.hypot(f.pos.x - f.startPos.x, f.pos.y - f.startPos.y);
        const left = f.distance - travelled;
        const step = Math.min(left, dt * f.speed);
        f.pos = { x: f.pos.x + f.dir.x * step, y: f.pos.y + f.dir.y * step };
        if (Math.abs(left - step) < 1e-4) {
            f.collided = true;
            f.alive = false;
        }
    }

    private draw(f: Flare): void {
        // a ground-layer object over the floor (survev flare.ts: layer 0, | 2 when the viewer sees the ground there)
        const layer = this.renderer.overgroundLayer(0, f.pos);
        this.renderer.add(f.trailContainer, layer, Z_ORD, 0);
        this.renderer.add(f.flareContainer, layer, Z_ORD, 1);
        const local = toLocal(f.pos);
        f.flareContainer.position.set(local.x, local.y);
        f.flareContainer.scale.set(f.flareScale);
        const dist = Math.hypot(f.pos.x - f.startPos.x, f.pos.y - f.startPos.y);
        f.trailContainer.position.set(local.x, local.y);
        f.trailContainer.scale.set(Math.min(f.tracerLength * 15, dist / 2) * f.trailScale, 1);
    }

    private release(index: number): void {
        const f = this.flares[index];
        this.flares.splice(index, 1);
        f.flareContainer.removeFromParent();
        f.trailContainer.removeFromParent();
        f.flareContainer.visible = false;
        f.trailContainer.visible = false;
        this.free.push(f);
    }

    clear(): void {
        for (let i = this.flares.length - 1; i >= 0; i--) this.release(i);
    }
}

/** Whether a bullet type draws as a flare (survev bullet.ts createBullet). */
export function isFlareBullet(bulletType: string): boolean {
    const def = GameObjectDefs[bulletType] as BulletDef | undefined;
    return def?.type === "bullet" && !!def.addFlare;
}
