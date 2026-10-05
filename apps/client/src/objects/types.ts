// Shared shapes of the per-object views that turn snapshot ObjectViews into Pixi display objects.
import type { Vec2 } from "@rebirth/core";
import type { MapDef } from "@rebirth/defs";
import type { ObjectView } from "@rebirth/sim";
import type { TextureStore } from "../assets/textures.ts";
import type { ViewBounds } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";

/** Long-lived services every view needs. */
export interface ViewDeps {
    renderer: Renderer;
    textures: TextureStore;
    mapDef: MapDef;
}

/** Per-frame state handed to every view. */
export interface FrameContext {
    dt: number;
    /** interpolated local player position */
    localPos: Vec2;
    /** map layer of the local player */
    localLayer: number;
    localId: number;
}

export interface ObjectRender<V extends ObjectView = ObjectView> {
    readonly id: number;
    /** Applies the latest snapshot state. */
    setData(view: V, isNew: boolean): void;
    /** Positions and orders the display objects; `pos` is the interpolated position. */
    update(ctx: FrameContext, pos: Vec2): void;
    /** World-space box around everything the view draws, at `pos`. */
    bounds(pos: Vec2): ViewBounds;
    setVisible(visible: boolean): void;
    /** Releases pooled display objects. */
    destroy(): void;
}

/** Multiplies the HSV value of `tint` by `factor` (biome valueAdjust; survev util.adjustValue). */
export function adjustValue(tint: number, factor: number): number {
    if (factor >= 1) return tint;
    const r = ((tint >> 16) & 0xff) * factor;
    const g = ((tint >> 8) & 0xff) * factor;
    const b = (tint & 0xff) * factor;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function boxAround(pos: Vec2, rad: number): ViewBounds {
    return { min: { x: pos.x - rad, y: pos.y - rad }, max: { x: pos.x + rad, y: pos.y + rad } };
}
