// Sprites that outlive their object to fade out (survev client/src/objects/decal.ts DecalRender: a decal with a
// def lifetime, e.g. an explosion scorch mark, fades at alpha lerp(dt * 3) towards 0 once its object is removed).
import type { Sprite } from "pixi.js";
import type { Renderer } from "../render/renderer.ts";

const FADE_RATE = 3;
const MIN_ALPHA = 0.01;

interface Fading {
    sprite: Sprite;
    layer: number;
    zOrd: number;
    zIdx: number;
    baseAlpha: number;
    fade: number;
}

export class FadingSprites {
    private readonly renderer: Renderer;
    private readonly items: Fading[] = [];

    constructor(renderer: Renderer) {
        this.renderer = renderer;
    }

    get count(): number {
        return this.items.length;
    }

    /** Takes over a pooled sprite and fades it out; it goes back to the pool afterwards. */
    add(sprite: Sprite, layer: number, zOrd: number, zIdx: number): void {
        this.items.push({ sprite, layer, zOrd, zIdx, baseAlpha: sprite.alpha, fade: 1 });
    }

    update(dt: number): void {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const f = this.items[i];
            f.fade += (0 - f.fade) * Math.min(1, dt * FADE_RATE);
            if (f.fade < MIN_ALPHA) {
                this.renderer.pool.release(f.sprite);
                this.items.splice(i, 1);
                continue;
            }
            f.sprite.alpha = f.baseAlpha * f.fade;
            this.renderer.add(f.sprite, f.layer, f.zOrd, f.zIdx);
        }
    }

    clear(): void {
        for (const f of this.items) this.renderer.pool.release(f.sprite);
        this.items.length = 0;
    }
}
