// Rebirth rainy matches (user/2026-10-08-rain; docs/research/rebirth-deviations.md "Rainy matches"): on a match that
// rains (isRainyMatch in @rebirth/defs: 30 % of the classic and 50v50 seeds) the world is a little darker and cooler
// and rain falls from start to finish. Effects only, in surviv's flat style, light enough to keep players and loot as
// readable as on a clear day:
// - a screen-space multiply tint over the world (Renderer.weather: under the red zone and the UI, so the HUD and the
//   minimap keep their colours), about a fifth darker with a grey-blue cast, much lighter than the Halloween night
//   (whose valueAdjust 0.3 is baked into each sprite's tint at creation and cannot fade or follow a setting); faded out
//   underground (bunkers, basements);
// - streaks around the camera (fx/cameraEmitters.ts with the `falling_rain` def of particleDefsAmbient.ts), spawned
//   in the screen grown by their fall, so the density per world area is the same at every scope up to the emitter's 240
//   live particles; none over the roof the player stands under (its interior is drawn see-through then): a streak whose
//   fall would cross it is not spawned and the ones over it are removed as the player walks in, while the rain keeps
//   falling on the open ground around the house; faded out off the ground layer, like the snow;
// - small rings where drops land in the open, a few dozen a second in view, never under a roof and held back when the
//   particle system is busy with combat effects: on water (rivers, lakes, the sea and water decals, but not the bridge
//   decks and docks over them) a spreading ripple in that water's ripple colour.
// No sound: the original has no rain recording (its ambience is wind, waves, a river stream, steam and a lab hum).
// The "Weather effects" setting (config weatherFx, on by default) turns all of it off.
import type { Vec2 } from "@rebirth/core";
import { isRainyMatch } from "@rebirth/defs";
import { Sprite, Texture } from "pixi.js";
import { config } from "../config.ts";
import type { ViewBounds } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";
import { CameraEmitters } from "./cameraEmitters.ts";
import { RAIN_DIR, RAIN_LIFE, RAIN_SPEED, RAIN_STREAK } from "./particleDefsAmbient.ts";
import type { ParticleSystem } from "./particles.ts";

/** multiply colour over the world: takes about 20 % off red, 16 % off green and 10 % off blue */
export const RAIN_TINT = 0xccd6e6;
/** fade rate (1/s) of the tint when the player goes underground or the setting changes (the camera particles' rate) */
const TINT_RATE = 6;
/** world units a streak falls in its life (speed 30-36 x life 0.38-0.46 s: 11.4-16.6), for the spawn box */
const RAIN_FALL = 14;
/** the farthest a streak's sprite reaches from its spawn point along the fall: its longest fall and half its length */
const RAIN_REACH = RAIN_SPEED[1] * RAIN_LIFE[1] + RAIN_STREAK / 2;
/** rings a second per 1000 square units in view (about 50 a second on a 16:9 screen at the 1x scope) */
const SPLASH_RATE = 28;
/** at most this many rings a second, whatever the scope */
const MAX_SPLASH_RATE = 80;
/** no rings while the particle system has less room than this before it starts dropping combat effects */
const SPLASH_ROOM = 96;
const ZERO: Vec2 = { x: 0, y: 0 };

/** Whether the match rains: the sandbox's ?rain= override when set, else the map seed's roll (isRainyMatch). */
export function rainyMatch(map: { mapName: string; seed: number }, force?: boolean): boolean {
    return force ?? isRainyMatch(map.mapName, map.seed);
}

export interface RainDeps {
    renderer: Renderer;
    particles: ParticleSystem;
    /** whether `pos` is under the roof of a building on the ground floor */
    insideCeiling: (pos: Vec2) => boolean;
    /** the ripple colour of the water at `pos`, or null when `pos` is not water (a floor over it is not) */
    waterAt: (pos: Vec2) => number | null;
}

/** A roof the player stands under (objects/building.ts BuildingRender). */
export interface RainRoof {
    /** whether the segment `a`-`b` crosses the roof's zoom regions */
    ceilingOnSegment(a: Vec2, b: Vec2): boolean;
}

export interface RainFrame {
    dt: number;
    cameraPos: Vec2;
    /** the active player's map layer */
    layer: number;
    /** the roofs the active player stands under (ObjectWorld.localRoofs): no streaks over them */
    roofs: readonly RainRoof[];
    /** the world rectangle on screen */
    view: ViewBounds;
}

export interface RainState {
    /** the Weather effects setting */
    enabled: boolean;
    /** the streak emitter runs */
    running: boolean;
    /** alpha the streaks are drawn with (0 underground or off) */
    rainAlpha: number;
    /** alpha of the world tint (0 hidden) */
    tint: number;
    /** streaks alive */
    drops: number;
    splashes: number;
    ripples: number;
    /** roofs the player stands under (no streaks over them) */
    roofs: number;
}

export class RainFx {
    private readonly deps: RainDeps;
    private readonly drops: CameraEmitters;
    /** the world tint (a white quad multiplied over the world) */
    readonly tint = new Sprite({ texture: Texture.WHITE, label: "rain-tint" });
    private enabled: boolean;
    private readonly unsubscribe: () => void;
    private tintAlpha = 1;
    private splashDebt = 0;
    private roofs: readonly RainRoof[] = [];
    /** rings spawned on the ground / on water (tests) */
    splashes = 0;
    ripples = 0;

    constructor(deps: RainDeps) {
        this.deps = deps;
        this.drops = new CameraEmitters(deps.particles, "falling_rain", {
            dir: RAIN_DIR,
            fall: RAIN_FALL,
            skip: (pos) => this.overRoof(this.roofs, pos, RAIN_REACH),
            pauseHidden: true,
        });
        this.tint.tint = RAIN_TINT;
        this.tint.blendMode = "multiply";
        deps.renderer.weather.addChild(this.tint);
        const cfg = config();
        this.enabled = cfg.get("weatherFx");
        this.tintAlpha = this.enabled ? 1 : 0;
        this.layoutTint();
        this.unsubscribe = cfg.onChange((key) => {
            if (key === "weatherFx") this.setEnabled(cfg.get("weatherFx"));
        });
    }

    get state(): RainState {
        return {
            enabled: this.enabled,
            running: this.drops.running,
            rainAlpha: this.drops.visibility,
            tint: this.tint.visible ? this.tint.alpha : 0,
            drops: this.deps.particles.spritesOf("rain").length,
            splashes: this.splashes,
            ripples: this.ripples,
            roofs: this.roofs.length,
        };
    }

    /**
     * Whether a streak at `pos` crosses one of `roofs` within `reach` units of its fall (from half a streak behind it,
     * so no part of its sprite is drawn over the roof).
     */
    private overRoof(roofs: readonly RainRoof[], pos: Vec2, reach: number): boolean {
        if (!roofs.length) return false;
        const back = RAIN_STREAK / 2;
        const a = { x: pos.x - RAIN_DIR.x * back, y: pos.y - RAIN_DIR.y * back };
        const b = { x: pos.x + RAIN_DIR.x * reach, y: pos.y + RAIN_DIR.y * reach };
        return roofs.some((r) => r.ceilingOnSegment(a, b));
    }

    /** Takes the roofs the player stands under; the streaks already falling over a roof just walked under go. */
    private setRoofs(roofs: readonly RainRoof[]): void {
        const entered = roofs.filter((r) => !this.roofs.includes(r));
        this.roofs = roofs;
        if (!entered.length) return;
        const half = RAIN_STREAK / 2;
        this.deps.particles.cull("rain", (pos, end) => {
            const reach = Math.hypot(end.x - pos.x, end.y - pos.y) + half;
            return this.overRoof(entered, pos, reach);
        });
    }

    private setEnabled(on: boolean): void {
        this.enabled = on;
        if (!on) this.drops.stop();
    }

    /** The tint covers the screen at its alpha. */
    private layoutTint(): void {
        const camera = this.deps.renderer.camera;
        this.tint.alpha = this.tintAlpha;
        this.tint.visible = this.tintAlpha > 0;
        this.tint.width = camera.screenWidth;
        this.tint.height = camera.screenHeight;
    }

    update(f: RainFrame): void {
        // no weather underground (layer 1, and the stairs down to it)
        const target = this.enabled && !(f.layer & 1) ? 1 : 0;
        this.tintAlpha += (target - this.tintAlpha) * Math.min(1, f.dt * TINT_RATE);
        if (Math.abs(target - this.tintAlpha) < 0.005) this.tintAlpha = target;
        this.layoutTint();
        this.setRoofs(f.roofs);
        if (!this.enabled) return;
        const half = { x: (f.view.max.x - f.view.min.x) / 2, y: (f.view.max.y - f.view.min.y) / 2 };
        this.drops.update(f.dt, f.cameraPos, Math.max(half.x, half.y), f.layer, half);
        if (f.layer === 0) this.splash(f.dt, f.view);
    }

    /** Rings where drops land on the open ground in view, ripples on water. */
    private splash(dt: number, view: ViewBounds): void {
        const { particles, insideCeiling, waterAt } = this.deps;
        const w = view.max.x - view.min.x;
        const h = view.max.y - view.min.y;
        this.splashDebt += Math.min((SPLASH_RATE * w * h) / 1000, MAX_SPLASH_RATE) * dt;
        for (; this.splashDebt >= 1; this.splashDebt--) {
            if (particles.room < SPLASH_ROOM) continue;
            const pos = { x: view.min.x + Math.random() * w, y: view.min.y + Math.random() * h };
            if (insideCeiling(pos)) continue;
            const ripple = waterAt(pos);
            if (ripple !== null) {
                particles.add("rainRipple", 0, pos, ZERO, { color: ripple, rot: 0 });
                this.ripples++;
            } else {
                particles.add("rainSplash", 0, pos, ZERO, { rot: 0 });
                this.splashes++;
            }
        }
    }

    destroy(): void {
        this.unsubscribe();
        this.drops.stop();
        this.tint.destroy();
    }
}
