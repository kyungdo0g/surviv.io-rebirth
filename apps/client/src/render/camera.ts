// World (+y up, world units) <-> screen (+y down, CSS pixels) transforms.
// Same model as the original client (survev client/src/camera.ts): 16 pixels per world unit at zoom 1, and the
// zoom is chosen so that the scope's zoom radius (LocalPlayerState.zoom) spans half of the larger screen
// dimension, normalized to at least 16:9 (survev client/src/game.ts update()).
import type { Vec2 } from "@rebirth/core";

export const PIXELS_PER_UNIT = 16;
/** zoom lerp rates (1/s) when zooming in / out (survev game.ts) */
const ZOOM_RATE_IN = 2;
const ZOOM_RATE_OUT = 1.4;

export interface ViewBounds {
    min: Vec2;
    max: Vec2;
}

/** Camera zoom that shows `radius` world units from the screen center to the edge of the larger dimension. */
export function zoomForRadius(radius: number, screenWidth: number, screenHeight: number): number {
    const minDim = Math.min(screenWidth, screenHeight);
    const maxDim = Math.max(screenWidth, screenHeight);
    const maxScreenDim = Math.max(minDim * (16 / 9), maxDim);
    return (maxScreenDim * 0.5) / (Math.max(radius, 1) * PIXELS_PER_UNIT);
}

export class Camera {
    /** world position at the screen center */
    pos: Vec2 = { x: 0, y: 0 };
    readonly ppu = PIXELS_PER_UNIT;
    zoom = 1.5;
    targetZoom = 1.5;
    screenWidth = 1;
    screenHeight = 1;

    resize(width: number, height: number): void {
        this.screenWidth = Math.max(1, width);
        this.screenHeight = Math.max(1, height);
    }

    /** screen pixels per world unit */
    z(): number {
        return this.ppu * this.zoom;
    }

    worldToScreen(p: Vec2): Vec2 {
        const z = this.z();
        return {
            x: this.screenWidth * 0.5 + (p.x - this.pos.x) * z,
            y: this.screenHeight * 0.5 - (p.y - this.pos.y) * z,
        };
    }

    screenToWorld(s: Vec2): Vec2 {
        const z = this.z();
        return {
            x: this.pos.x + (s.x - this.screenWidth * 0.5) / z,
            y: this.pos.y + (this.screenHeight * 0.5 - s.y) / z,
        };
    }

    /** world-space rectangle currently on screen, grown by `margin` world units */
    viewBounds(margin = 0): ViewBounds {
        const ext = {
            x: (this.screenWidth * 0.5) / this.z() + margin,
            y: (this.screenHeight * 0.5) / this.z() + margin,
        };
        return {
            min: { x: this.pos.x - ext.x, y: this.pos.y - ext.y },
            max: { x: this.pos.x + ext.x, y: this.pos.y + ext.y },
        };
    }

    /**
     * Follows `target` (the interpolated local player position, so the camera is as smooth as the player) and
     * eases the zoom towards the one for `zoomRadius`. `snap` jumps straight to the target zoom.
     */
    follow(dt: number, target: Vec2, zoomRadius: number, snap = false): void {
        this.pos = { x: target.x, y: target.y };
        this.targetZoom = zoomForRadius(zoomRadius, this.screenWidth, this.screenHeight);
        if (snap) {
            this.zoom = this.targetZoom;
            return;
        }
        const rate = this.targetZoom > this.zoom ? ZOOM_RATE_IN : ZOOM_RATE_OUT;
        const t = Math.min(1, dt * rate);
        this.zoom += (this.targetZoom - this.zoom) * t;
    }
}
