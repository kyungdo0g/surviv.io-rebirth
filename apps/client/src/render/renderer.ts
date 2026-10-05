// Layered world scene, ordered like the original client (survev client/src/renderer.ts):
//   terrain -> layer 0 (ground) -> underground fill -> layer 1 (underground) -> layer 2/3 (stairs, tall objects)
// then the screen-space red zone (`gas`, above every world layer like survev game.ts) and the UI overlay.
// Each layer is sorted by (zOrd, zIdx); views register their display objects every frame with `add()`.
// World children live in "pixel space": 16 px per world unit at zoom 1 with +y down, i.e. (x, y) -> (16x, -16y).
// The world root alone carries the camera transform, so moving the camera never touches individual sprites.

import type { Vec2 } from "@rebirth/core";
import { type Application, Container, Graphics, Sprite } from "pixi.js";
import type { Camera, ViewBounds } from "./camera.ts";
import { PIXELS_PER_UNIT } from "./camera.ts";
import { SpritePool } from "./pool.ts";

const LAYER_COUNT = 4;
/** zOrd and zIdx are folded into one Pixi zIndex: zOrd * 2^32 + zIdx (zIdx stays below 2^32) */
const Z_ORD_STRIDE = 2 ** 32;
/** alpha fade rate of the underground layer and fill (survev renderer.ts) */
const LAYER_FADE_RATE = 12;

/** world position -> pixel-space position inside the world root */
export function toLocal(p: Vec2): { x: number; y: number } {
    return { x: p.x * PIXELS_PER_UNIT, y: -p.y * PIXELS_PER_UNIT };
}

function stepTowards(cur: number, target: number, rate: number): number {
    const delta = target - cur;
    const step = delta * Math.min(1, rate);
    return Math.abs(step) < 0.01 ? target : cur + step;
}

function countSprites(node: Container): number {
    if (!node.visible || node.alpha <= 0) return 0;
    let n = node instanceof Sprite && node.texture.width > 1 ? 1 : 0;
    for (const child of node.children) n += countSprites(child);
    return n;
}

export class Renderer {
    readonly app: Application;
    readonly camera: Camera;
    readonly pool = new SpritePool();
    /** camera-transformed root of everything in the world */
    readonly world = new Container({ label: "world" });
    /** map ground: background, beach, grass, rivers, grid */
    readonly terrain = new Container({ label: "terrain" });
    readonly layers: Container[] = [];
    /** underground fill drawn between layer 0 and layer 1 */
    readonly undergroundFill = new Graphics();
    /** screen-space red zone between the world and the UI (survev game.ts scene order: layers, then gas) */
    readonly gas = new Container({ label: "gas" });
    /** screen-space UI on top of the world (minimap, HUD) */
    readonly overlay = new Container({ label: "overlay" });
    /** hides the stairs layer inside structure masks while viewing the ground (survev renderer.ts layerMask) */
    readonly layerMask = new Graphics({ label: "layer-mask" });

    /** layer the local player is on (0 ground, 1 underground, 2/3 stairs) */
    activeLayer = 0;
    private layerAlpha = 0;
    private groundAlpha = 0;
    private zIdxCounter = 0;
    private stairMasks: ViewBounds[] = [];
    private stairMasksDirty = false;

    constructor(app: Application, camera: Camera) {
        this.app = app;
        this.camera = camera;
        this.world.addChild(this.terrain);
        for (let i = 0; i < LAYER_COUNT; i++) {
            const layer = new Container({ label: `layer_${i}`, sortableChildren: true });
            this.layers.push(layer);
            this.world.addChild(layer);
            if (i === 0) this.world.addChild(this.undergroundFill);
        }
        this.undergroundFill.alpha = 0;
        this.undergroundFill.visible = false;
        this.world.interactiveChildren = false;
        this.overlay.interactiveChildren = false;
        this.gas.interactiveChildren = false;
        app.stage.addChild(this.world, this.gas, this.overlay);
    }

    /** Removes the scene from the stage and frees it (the client is torn down for a new game). */
    destroy(): void {
        this.pool.clear();
        for (const root of [this.world, this.gas, this.overlay]) {
            root.removeFromParent();
            root.destroy({ children: true });
        }
    }

    /** Sets the underground fill color and the area it covers (the map plus its ocean border). */
    setUnderground(color: number, width: number, height: number): void {
        const pad = 200 * PIXELS_PER_UNIT;
        this.undergroundFill
            .clear()
            .rect(
                -pad,
                -height * PIXELS_PER_UNIT - pad,
                width * PIXELS_PER_UNIT + 2 * pad,
                height * PIXELS_PER_UNIT + 2 * pad,
            )
            .fill(color);
    }

    /** World-space boxes of the structures in view that hide the stairs layer from the ground. */
    setStairMasks(masks: ViewBounds[]): void {
        this.stairMasks = masks;
        this.stairMasksDirty = true;
    }

    private updateLayerMask(): void {
        const mask = this.layerMask;
        if (this.stairMasksDirty) {
            this.stairMasksDirty = false;
            mask.clear();
            if (this.stairMasks.length) {
                const pad = 1e5;
                mask.rect(-pad, -pad, pad * 2, pad * 2).fill(0xffffff);
                for (const m of this.stairMasks) {
                    const x = m.min.x * PIXELS_PER_UNIT;
                    const y = -m.max.y * PIXELS_PER_UNIT;
                    mask.rect(x, y, (m.max.x - m.min.x) * PIXELS_PER_UNIT, (m.max.y - m.min.y) * PIXELS_PER_UNIT).cut();
                }
            }
        }
        const stairs = this.layers[2];
        const active = this.activeLayer === 0 && this.stairMasks.length > 0;
        if (active && stairs.mask !== mask) {
            this.world.addChild(mask);
            stairs.mask = mask;
        } else if (!active && stairs.mask === mask) {
            stairs.mask = null;
            mask.removeFromParent();
        }
    }

    /**
     * Places `obj` in the render layer for an object on map layer `layer`, sorted by (zOrd, zIdx).
     * Objects on stairs (layer bit 2) go to layer 2, or layer 3 when zOrd >= 100 so tall objects (trees) are not
     * covered by the stairs (survev renderer.ts addPIXIObj).
     */
    add(obj: Container, layer: number, zOrd: number, zIdx?: number): void {
        let layerIdx = layer & 1;
        if (layer & 2) layerIdx = zOrd >= 100 ? 3 : 2;
        const target = this.layers[layerIdx];
        const z = zOrd * Z_ORD_STRIDE + (zIdx ?? this.zIdxCounter++ % Z_ORD_STRIDE);
        if (obj.parent !== target) target.addChild(obj);
        if (obj.zIndex !== z) obj.zIndex = z;
    }

    /** Applies the camera to the world root and fades the underground layer for the active layer. */
    update(dt: number): void {
        const cam = this.camera;
        const z = cam.z();
        this.world.scale.set(cam.zoom, cam.zoom);
        this.world.position.set(cam.screenWidth * 0.5 - cam.pos.x * z, cam.screenHeight * 0.5 + cam.pos.y * z);

        this.layerAlpha = stepTowards(this.layerAlpha, this.activeLayer > 0 ? 1 : 0, dt * LAYER_FADE_RATE);
        this.groundAlpha = stepTowards(this.groundAlpha, this.activeLayer === 1 ? 1 : 0, dt * LAYER_FADE_RATE);
        this.layers[1].alpha = this.layerAlpha;
        this.layers[1].visible = this.layerAlpha > 0;
        this.layers[0].visible = this.groundAlpha < 1;
        this.terrain.visible = this.groundAlpha < 1;
        this.undergroundFill.alpha = this.groundAlpha;
        this.undergroundFill.visible = this.groundAlpha > 0;
        this.updateLayerMask();
    }

    /** number of visible, textured sprites in the world (for tests and the debug HUD) */
    spriteCount(): number {
        return countSprites(this.world);
    }

    fps(): number {
        return this.app.ticker.FPS;
    }
}
