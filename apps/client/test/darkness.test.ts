// Rebirth pitch-dark interiors (fx/darkness.ts, owner wave 3 2026-10-10): the overlay fades in only while the viewer
// is in an unlit place, gun shots and fiery explosions in the dark add lights that expire after their life, and a
// shot or explosion in a lit place adds none.
import type { Vec2 } from "@rebirth/core";
import { type ExplosionDef, GameObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    DARK_ALPHA,
    DARK_FADE_TIME,
    DarknessFx,
    DarknessState,
    EXPLOSION_LIGHT,
    explosionLightRadius,
    lightIntensity,
    MAX_LIGHTS,
    SHOT_LIGHT,
} from "../src/fx/darkness.ts";
import type { Renderer } from "../src/render/renderer.ts";

const DT = 1 / 60;
/** an unlit room: x, y in [0, 10] on layer 1 */
const inRoom = (p: Vec2, layer: number) => layer === 1 && p.x >= 0 && p.x <= 10 && p.y >= 0 && p.y <= 10;
const IN = { x: 5, y: 5 };
const OUT = { x: 50, y: 50 };

function run(state: DarknessState, seconds: number, pos: Vec2, layer: number): void {
    for (let t = 0; t < seconds - 1e-9; t += DT) state.update(DT, pos, layer);
}

describe("darkness overlay", () => {
    it("is active only while the viewer is in the dark, fading over 0.3 s", () => {
        const d = new DarknessState(inRoom);
        run(d, 1, OUT, 1);
        expect(d.active).toBe(false);
        expect(d.alpha).toBe(0);
        // the same spot on the ground floor is lit
        run(d, 1, IN, 0);
        expect(d.active).toBe(false);
        expect(d.fade).toBe(0);
        d.update(DT, IN, 1);
        expect(d.active).toBe(true);
        expect(d.fade).toBeCloseTo(DT / DARK_FADE_TIME, 5);
        run(d, DARK_FADE_TIME, IN, 1);
        expect(d.fade).toBe(1);
        expect(d.alpha).toBeCloseTo(DARK_ALPHA, 5);
        run(d, DARK_FADE_TIME / 2, OUT, 1);
        expect(d.active).toBe(false);
        expect(d.fade).toBeGreaterThan(0.3);
        expect(d.fade).toBeLessThan(0.7);
        run(d, DARK_FADE_TIME, OUT, 1);
        expect(d.fade).toBe(0);
    });

    it("adds a short muzzle flash for a shot in the dark and none in a lit place", () => {
        const d = new DarknessState(inRoom);
        expect(d.addShot(OUT, 1)).toBe(false);
        expect(d.addShot(IN, 0)).toBe(false);
        expect(d.addShot(IN, 1)).toBe(true);
        expect(d.lights).toHaveLength(1);
        const flash = d.lights[0];
        expect(flash).toMatchObject({ kind: "shot", radius: SHOT_LIGHT.radius, duration: SHOT_LIGHT.duration });
        expect(lightIntensity(flash)).toBe(1);
        d.update(SHOT_LIGHT.duration / 2, IN, 1);
        // quick falloff: a quarter left half way through
        expect(lightIntensity(flash)).toBeCloseTo(0.25, 5);
        d.update(SHOT_LIGHT.duration / 2 + 1e-6, IN, 1);
        expect(d.lights).toHaveLength(0);
    });

    it("lights an explosion in the dark by 1.5 x its blast radius for 0.5 s", () => {
        const d = new DarknessState(inRoom);
        const frag = GameObjectDefs.explosion_frag as ExplosionDef;
        expect(explosionLightRadius("explosion_frag")).toBeCloseTo(frag.rad.max * 1.5, 5);
        expect(d.addExplosion("explosion_frag", OUT, 1)).toBe(false);
        expect(d.addExplosion("explosion_frag", IN, 1)).toBe(true);
        expect(d.lights[0]).toMatchObject({ kind: "explosion", duration: EXPLOSION_LIGHT.duration });
        run(d, 0.25, IN, 1);
        expect(d.lights).toHaveLength(1);
        expect(lightIntensity(d.lights[0])).toBeCloseTo(0.5, 1);
        run(d, 0.3, IN, 1);
        expect(d.lights).toHaveLength(0);
    });

    it("gives no light for smoke grenades, fruit splats or unknown types", () => {
        expect(explosionLightRadius("explosion_smoke")).toBe(0);
        expect(explosionLightRadius("explosion_snowball")).toBe(0);
        expect(explosionLightRadius("no_such_explosion")).toBe(0);
        const d = new DarknessState(inRoom);
        expect(d.addExplosion("explosion_smoke", IN, 1)).toBe(false);
        expect(d.lights).toHaveLength(0);
    });

    it("keeps at most MAX_LIGHTS, dropping the oldest, and clears", () => {
        const d = new DarknessState(inRoom);
        for (let i = 0; i < MAX_LIGHTS + 5; i++) d.addShot({ x: i % 10, y: 1 }, 1);
        expect(d.lights).toHaveLength(MAX_LIGHTS);
        expect(d.added).toBe(MAX_LIGHTS + 5);
        expect(d.lights[0].pos.x).toBe(5 % 10);
        d.clear();
        expect(d.lights).toHaveLength(0);
    });

    it("forced darkness (dev ?dark=1) makes every place dark", () => {
        const d = new DarknessState(() => false, true);
        d.update(DT, OUT, 0);
        expect(d.active).toBe(true);
        expect(d.addShot(OUT, 0)).toBe(true);
    });

    it("DarknessFx feeds its state and skips drawing without a Pixi renderer", () => {
        const renderer = { camera: { screenWidth: 1280, screenHeight: 720, z: () => 16 } } as unknown as Renderer;
        const fx = new DarknessFx({ renderer, isDark: inRoom });
        fx.addShot(IN, 1);
        fx.addExplosion("explosion_frag", IN, 1);
        fx.addShot(OUT, 1);
        fx.update({ dt: DT, viewerPos: IN, viewerLayer: 1 });
        expect(fx.state.active).toBe(true);
        expect(fx.state.lights.map((l) => l.kind)).toEqual(["shot", "explosion"]);
        fx.clear();
        expect(fx.state.lights).toHaveLength(0);
        fx.destroy();
    });
});
