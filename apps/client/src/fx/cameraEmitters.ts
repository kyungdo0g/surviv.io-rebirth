// The map's camera particles (MapDef biome.particles.camera: falling leaves, blossoms, potatoes, snow): one emitter
// that follows the camera and spawns its particles anywhere within a radius of it, drifting down-right over everything
// (map layer 99999 with zOrd 999 lands on the top render layer). As in survev client/src/map.ts (onMapLoad / m_update,
// the same in the 0.8.82 client): the radius is the active player's zoom x 2.5 capped at 120 units, the spawn rate
// scales with the covered area so the density stays the same at every scope, and the particles fade out (rate 6/s)
// while the player is not on the ground layer.
import type { Vec2 } from "@rebirth/core";
import type { Emitter, ParticleSystem } from "./particles.ts";

const MAX_RADIUS = 120;
/** survev map.ts: the emitter is on layer 99999 (stairs bit set, so zOrd >= 100 draws on the top layer) */
const CAMERA_LAYER = 99999;
const ALPHA_RATE = 6;
const DIR = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };

export class CameraEmitters {
    private readonly particles: ParticleSystem;
    readonly type: string;
    private emitter: Emitter | null = null;
    private alpha = 1;

    constructor(particles: ParticleSystem, type: string) {
        this.particles = particles;
        this.type = type;
    }

    /** whether this map has camera particles (tests) */
    get running(): boolean {
        return !!this.emitter?.active;
    }

    /** `zoom` is the active player's view radius (scope zoom); `layer` its map layer. */
    update(dt: number, cameraPos: Vec2, zoom: number, layer: number): void {
        if (!this.type) return;
        // a sandbox respawn clears every emitter: start again
        if (!this.emitter?.active) {
            this.emitter = this.particles.addEmitter(this.type, { pos: cameraPos, dir: DIR, layer: CAMERA_LAYER });
        }
        const e = this.emitter;
        e.pos = { x: cameraPos.x, y: cameraPos.y };
        e.enabled = true;
        e.radius = Math.min(zoom * 2.5, MAX_RADIUS);
        const ratio = (e.radius * e.radius) / (MAX_RADIUS * MAX_RADIUS);
        e.rateMult = ratio > 0 ? 1 / ratio : 1;
        this.alpha += ((layer === 0 ? 1 : 0) - this.alpha) * Math.min(1, dt * ALPHA_RATE);
        e.alpha = this.alpha;
    }

    stop(): void {
        this.emitter?.stop();
        this.emitter = null;
    }
}
