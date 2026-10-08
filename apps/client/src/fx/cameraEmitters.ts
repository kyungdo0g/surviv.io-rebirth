// The map's camera particles (MapDef biome.particles.camera: falling leaves, blossoms, potatoes, snow): one emitter
// that follows the camera and spawns its particles anywhere within a radius of it, drifting down-right over everything
// (map layer 99999 with zOrd 999 lands on the top render layer). As in survev client/src/map.ts (onMapLoad / m_update,
// the same in the 0.8.82 client): the radius is the active player's zoom x 2.5 capped at 120 units, the spawn rate
// scales with the covered area so the density stays the same at every scope, and the particles fade out (rate 6/s)
// while the player is not on the ground layer.
// Rebirth rain (user/2026-10-08-rain; fx/weather.ts) runs through the same emitter with options: its own direction, a
// spawn box instead of the circle (the screen, grown and offset upwind by the fall so every streak can cross it; the
// rate still scales with the area), a spawn filter (no streak over the roof the player is under) and no spawning while
// faded out (its streaks live half a second).
import type { Vec2 } from "@rebirth/core";
import type { Emitter, ParticleSystem } from "./particles.ts";

const MAX_RADIUS = 120;
/** the area the emitter defs' spawn delays are for: survev's largest camera circle */
const DEF_AREA = Math.PI * MAX_RADIUS * MAX_RADIUS;
/** survev map.ts: the emitter is on layer 99999 (stairs bit set, so zOrd >= 100 draws on the top layer) */
const CAMERA_LAYER = 99999;
const ALPHA_RATE = 6;
const DIR = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };

export interface CameraEmitterOptions {
    /** unit direction the particles travel (default down-right) */
    dir?: Vec2;
    /**
     * spawn in the view (the `view` half extents of `update`) instead of the circle: the box grows by this distance
     * the particles travel, along `dir`, and sits half of it upwind (world units)
     */
    fall?: number;
    /** rejects spawn points (the emitter's `skip`) */
    skip?: (pos: Vec2) => boolean;
    /** stop spawning while faded out (short-lived particles) */
    pauseHidden?: boolean;
}

export class CameraEmitters {
    private readonly particles: ParticleSystem;
    readonly type: string;
    private readonly opts: CameraEmitterOptions;
    private emitter: Emitter | null = null;
    private alpha = 1;

    constructor(particles: ParticleSystem, type: string, opts: CameraEmitterOptions = {}) {
        this.particles = particles;
        this.type = type;
        this.opts = opts;
    }

    /** whether this map has camera particles (tests) */
    get running(): boolean {
        return !!this.emitter?.active;
    }

    /** alpha the particles are drawn with (1 on the ground floor, 0 faded out) */
    get visibility(): number {
        return this.running ? this.alpha : 0;
    }

    /**
     * `zoom` is the active player's view radius (scope zoom); `layer` its map layer; `view` the half extents of the
     * world on screen (only with `fall`).
     */
    update(dt: number, cameraPos: Vec2, zoom: number, layer: number, view?: Vec2): void {
        if (!this.type) return;
        const dir = this.opts.dir ?? DIR;
        // a sandbox respawn clears every emitter: start again
        if (!this.emitter?.active) {
            this.emitter = this.particles.addEmitter(this.type, { pos: cameraPos, dir, layer: CAMERA_LAYER });
            this.emitter.skip = this.opts.skip ?? null;
        }
        const e = this.emitter;
        const fall = this.opts.fall;
        let area: number;
        if (fall !== undefined && view) {
            e.pos = { x: cameraPos.x - (dir.x * fall) / 2, y: cameraPos.y - (dir.y * fall) / 2 };
            e.box = { x: view.x + (Math.abs(dir.x) * fall) / 2, y: view.y + (Math.abs(dir.y) * fall) / 2 };
            area = 4 * e.box.x * e.box.y;
        } else {
            e.pos = { x: cameraPos.x, y: cameraPos.y };
            e.box = null;
            e.radius = Math.min(zoom * 2.5, MAX_RADIUS);
            area = Math.PI * e.radius * e.radius;
        }
        e.rateMult = area > 0 ? DEF_AREA / area : 1;
        const shown = layer === 0;
        this.alpha += ((shown ? 1 : 0) - this.alpha) * Math.min(1, dt * ALPHA_RATE);
        e.alpha = this.alpha;
        e.enabled = shown || !this.opts.pauseHidden || this.alpha > 0.01;
    }

    stop(): void {
        this.emitter?.stop();
        this.emitter = null;
    }
}
