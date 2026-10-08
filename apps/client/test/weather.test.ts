// Rebirth rainy matches on the client (fx/weather.ts, fx/cameraEmitters.ts, particleDefsAmbient.ts falling_rain;
// user/2026-10-08-rain): the rain runs only on a rainy match, the streaks fade and stop spawning underground, none fall
// over the roof the player stands under while they keep falling around it, the tint stays indoors but leaves
// underground, the rings land only in the open (ripples on water), the Weather effects setting turns it all off, and
// the rain keeps its own particle budget.
import { collider, type Vec2 } from "@rebirth/core";
import { isRainyMatch, MapDefs, RAINY_MAPS } from "@rebirth/defs";
import { Container } from "pixi.js";
import { afterEach, describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import { config } from "../src/config.ts";
import { CameraEmitters } from "../src/fx/cameraEmitters.ts";
import { ALL_EMITTER_DEFS, ALL_PARTICLE_DEFS } from "../src/fx/particleDefsAll.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { RAIN_TINT, type RainFrame, RainFx, type RainRoof, rainyMatch } from "../src/fx/weather.ts";
import { PIXELS_PER_UNIT } from "../src/render/camera.ts";
import { SpritePool } from "../src/render/pool.ts";
import type { Renderer } from "../src/render/renderer.ts";

const DT = 1 / 60;
/** a 16:9 screen at the 1x scope (zoom radius 28): 56 x 31.5 units */
const VIEW = { min: { x: -28, y: -15.75 }, max: { x: 28, y: 15.75 } };

function setup(opts: { insideCeiling?: (p: Vec2) => boolean; waterAt?: (p: Vec2) => number | null } = {}) {
    const weather = new Container();
    const renderer = {
        pool: new SpritePool(),
        add: () => {},
        addOverground: () => 0,
        camera: { screenWidth: 1280, screenHeight: 720 },
        weather,
    } as unknown as Renderer;
    const particles = new ParticleSystem(renderer, { apply: () => {} } as unknown as TextureStore);
    const rain = new RainFx({
        renderer,
        particles,
        insideCeiling: opts.insideCeiling ?? (() => false),
        waterAt: opts.waterAt ?? (() => null),
    });
    /** runs `seconds` of frames (the rain, then the particles) */
    const run = (seconds: number, frame: Partial<RainFrame> = {}) => {
        for (let t = 0; t < seconds; t += DT) {
            rain.update({
                dt: DT,
                cameraPos: { x: 0, y: 0 },
                layer: 0,
                roofs: [],
                view: VIEW,
                ...frame,
            });
            particles.update(DT);
        }
    };
    const spawned = (type: string) => particles.spawnedByType.get(type) ?? 0;
    /** world positions of the live streaks */
    const streaks = () =>
        particles
            .spritesOf("rain")
            .map((sp) => ({ x: sp.position.x / PIXELS_PER_UNIT, y: -sp.position.y / PIXELS_PER_UNIT }));
    return { rain, particles, weather, run, spawned, streaks };
}

afterEach(() => {
    config().set("weatherFx", true);
});

describe("rainy match decision on the client", () => {
    it("rains only where the map seed rolls rain, unless the sandbox forces it", () => {
        const wet = Array.from({ length: 50 }, (_, seed) => seed).filter((s) => isRainyMatch("main", s));
        const dry = Array.from({ length: 50 }, (_, seed) => seed).filter((s) => !isRainyMatch("main", s));
        expect(wet.length).toBeGreaterThan(5);
        for (const seed of wet) expect(rainyMatch({ mapName: "main", seed })).toBe(true);
        for (const seed of dry) expect(rainyMatch({ mapName: "main", seed })).toBe(false);
        // the event maps never rain on their own; ?rain=1 / ?rain=0 override any map
        for (const mapName of Object.keys(MapDefs).filter((m) => !RAINY_MAPS.includes(m))) {
            expect(rainyMatch({ mapName, seed: wet[0] }), mapName).toBe(false);
        }
        expect(rainyMatch({ mapName: "halloween", seed: dry[0] }, true)).toBe(true);
        expect(rainyMatch({ mapName: "main", seed: wet[0] }, false)).toBe(false);
    });

    it("defines the rain particles with existing original sprites and a capped camera emitter", () => {
        const emitter = ALL_EMITTER_DEFS.falling_rain;
        expect(emitter.particle).toBe("rain");
        expect(emitter.maxLive).toBe(240);
        expect(ALL_PARTICLE_DEFS.rain.image).toEqual(["player-bullet-trail-02.img"]);
        expect(ALL_PARTICLE_DEFS.rainSplash.image).toEqual(["player-ripple-01.img"]);
        expect(ALL_PARTICLE_DEFS.rainRipple.image).toEqual(["player-ripple-01.img"]);
    });
});

describe("rain effects", () => {
    it("falls on the ground in the open: streaks around the camera, under their cap, and the world tint", () => {
        const { rain, particles, weather, run } = setup();
        expect(weather.children).toContain(rain.tint);
        expect(rain.tint.blendMode).toBe("multiply");
        expect(rain.tint.tint).toBe(RAIN_TINT);
        run(1.5);
        const s = rain.state;
        expect(s.running).toBe(true);
        expect(s.rainAlpha).toBeCloseTo(1, 2);
        expect(s.tint).toBe(1);
        expect(s.drops).toBeGreaterThan(120);
        expect(s.drops).toBeLessThanOrEqual(240);
        // spawned in the screen grown by the fall: most of them are on screen (about 100)
        const local = particles.spritesOf("rain").map((sp) => ({
            x: sp.position.x / PIXELS_PER_UNIT,
            y: -sp.position.y / PIXELS_PER_UNIT,
        }));
        const onScreen = local.filter(
            (p) => p.x >= VIEW.min.x && p.x <= VIEW.max.x && p.y >= VIEW.min.y && p.y <= VIEW.max.y,
        );
        expect(onScreen.length).toBeGreaterThan(70);
        expect(onScreen.length / local.length).toBeGreaterThan(0.5);
        for (const p of local) {
            expect(Math.abs(p.x)).toBeLessThan(28 + 15);
            expect(Math.abs(p.y)).toBeLessThan(15.75 + 15);
        }
        // the tint covers the screen
        expect(rain.tint.width).toBe(1280);
        expect(rain.tint.height).toBe(720);
        // streaks stretched along the fall, drawn faint
        const streak = particles.spritesOf("rain")[0];
        expect(streak.scale.x / streak.scale.y).toBeCloseTo(26, 5);
        expect(streak.alpha).toBeLessThanOrEqual(0.5);
    });

    it("thins out at the far scopes instead of passing its 240 live streaks", () => {
        const { rain, run } = setup();
        // the 15x scope's view on a 16:9 screen
        run(1.5, { view: { min: { x: -104, y: -58.5 }, max: { x: 104, y: 58.5 } } });
        expect(rain.state.drops).toBeGreaterThan(200);
        expect(rain.state.drops).toBeLessThanOrEqual(240);
    });

    it("stops underground: the streaks fade and stop spawning, and the tint leaves", () => {
        const { rain, run, spawned } = setup();
        run(1);
        run(1, { layer: 1 });
        expect(rain.state.rainAlpha).toBeLessThan(0.01);
        expect(rain.state.tint).toBe(0);
        const before = spawned("rain");
        const rings = rain.splashes + rain.ripples;
        run(1, { layer: 1 });
        expect(spawned("rain")).toBe(before);
        expect(rain.splashes + rain.ripples).toBe(rings);
        expect(rain.state.drops).toBe(0);
        // back on the surface it rains again
        run(1);
        expect(rain.state.rainAlpha).toBeCloseTo(1, 2);
        expect(rain.state.tint).toBe(1);
        expect(spawned("rain")).toBeGreaterThan(before);
    });

    it("draws no streaks over the roof the player stands under, but keeps them, the tint and the rings around it", () => {
        // a house left of the player (its zoom region), the player standing under its roof
        const house = collider.createAabb({ x: -22, y: -10 }, { x: -2, y: 10 });
        const roof: RainRoof = { ceilingOnSegment: (a, b) => collider.intersectSegment(house, a, b) !== null };
        const inHouse = (p: Vec2) => collider.contains(house, p);
        const { rain, particles, run, streaks } = setup({ insideCeiling: inHouse });
        run(1);
        // outside, the rain falls over the roof too
        expect(streaks().filter(inHouse).length).toBeGreaterThan(5);
        // walking in removes the streaks over the roof at once and spawns none there
        run(DT, { roofs: [roof] });
        expect(rain.state.roofs).toBe(1);
        expect(streaks().filter(inHouse)).toEqual([]);
        const splashes = rain.splashes;
        for (let i = 0; i < 60; i++) {
            run(DT, { roofs: [roof] });
            expect(streaks().filter(inHouse)).toEqual([]);
        }
        // around the house it keeps raining at full strength, under the same tint, with rings in the open only
        expect(rain.state.rainAlpha).toBeCloseTo(1, 2);
        expect(rain.state.tint).toBe(1);
        expect(rain.state.drops).toBeGreaterThan(100);
        expect(streaks().filter((p) => p.x > 0).length).toBeGreaterThan(50);
        expect(rain.splashes).toBeGreaterThan(splashes);
        for (const s of particles.spritesOf("rainSplash")) {
            expect(inHouse({ x: s.position.x / PIXELS_PER_UNIT, y: -s.position.y / PIXELS_PER_UNIT })).toBe(false);
        }
        // walking out: it rains over the roof again
        run(1);
        expect(rain.state.roofs).toBe(0);
        expect(streaks().filter(inHouse).length).toBeGreaterThan(5);
    });

    it("leaves rings on the ground and ripples on water, a few dozen a second", () => {
        // water below y = 0, in the biome's ripple colour
        const { rain, particles, run } = setup({ waterAt: (p) => (p.y < 0 ? 0xb3f0ff : null) });
        run(2);
        expect(rain.splashes).toBeGreaterThan(40);
        expect(rain.ripples).toBeGreaterThan(40);
        expect(rain.splashes + rain.ripples).toBeLessThan(2 * 80);
        // pixel space is +y down: water (world y < 0) is pixel y > 0
        for (const s of particles.spritesOf("rainRipple")) {
            expect(s.position.y).toBeGreaterThan(0);
            expect(s.tint).toBe(0xb3f0ff);
        }
        for (const s of particles.spritesOf("rainSplash")) expect(s.position.y).toBeLessThanOrEqual(0);
    });

    it("follows the Weather effects setting: off stops the rain and the tint, on brings them back", () => {
        const { rain, run, spawned } = setup();
        run(1);
        config().set("weatherFx", false);
        run(1.5);
        const before = spawned("rain");
        const rings = rain.splashes + rain.ripples;
        run(1);
        expect(rain.state.enabled).toBe(false);
        expect(rain.state.running).toBe(false);
        expect(rain.state.tint).toBe(0);
        expect(rain.state.drops).toBe(0);
        expect(spawned("rain")).toBe(before);
        expect(rain.splashes + rain.ripples).toBe(rings);
        config().set("weatherFx", true);
        run(1.5);
        expect(rain.state.running).toBe(true);
        expect(rain.state.tint).toBe(1);
        expect(rain.state.drops).toBeGreaterThan(0);
    });

    it("starts dry with the setting off", () => {
        config().set("weatherFx", false);
        const { rain, run, spawned } = setup();
        expect(rain.tint.visible).toBe(false);
        run(1);
        expect(spawned("rain")).toBe(0);
        expect(rain.state.tint).toBe(0);
    });

    it("keeps its own budget: a full particle system keeps its combat particles and holds the rings back", () => {
        const { rain, particles, run } = setup();
        for (let i = 0; i < 760; i++) particles.add("9mm", 0, { x: 0, y: 0 }, { x: 0, y: 0 }, { delay: 30 });
        run(1);
        expect(particles.spritesOf("9mm").length).toBe(760);
        expect(rain.state.drops).toBeGreaterThan(100);
        expect(rain.splashes + rain.ripples).toBe(0);
        expect(particles.room).toBe(768 - 760);
    });

    it("is removed with the match", () => {
        const { rain, weather, run } = setup();
        run(0.5);
        rain.destroy();
        expect(weather.children).not.toContain(rain.tint);
        expect(rain.state.running).toBe(false);
        config().set("weatherFx", false);
        config().set("weatherFx", true);
        expect(rain.state.running).toBe(false);
    });
});

describe("camera emitters with the rain options", () => {
    it("leave the map particles as survev runs them: snow keeps spawning (faded) underground", () => {
        const { particles } = setup();
        const snow = new CameraEmitters(particles, "falling_snow_slow");
        for (let t = 0; t < 2; t += DT) {
            snow.update(DT, { x: 0, y: 0 }, 28, 1);
            particles.update(DT);
        }
        expect(snow.visibility).toBeLessThan(0.01);
        expect(particles.spawnedByType.get("snow") ?? 0).toBeGreaterThan(5);
    });
});
