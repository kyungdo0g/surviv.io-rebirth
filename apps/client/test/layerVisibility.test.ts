// What a viewer on each layer sees of things drawn over the floor (render/layerRules.ts, render/renderer.ts
// addOverground; survev smoke.ts:145-159, airdrop.ts:108-115, plane.ts:268-276, flare.ts:158-168, emote.ts:1088-1092):
// a surface air drop, its plane and landing smoke, smoke clouds and flares are lifted over everything only when the
// viewer's floor sees the ground; underground they stay on the hidden ground layer, under a stair mask too when the
// viewer stands on the stairs, and a bunker smoke stays on the faded underground layer for a viewer on the surface.
import { GameObjectDefs, MapDefs } from "@rebirth/defs";
import type { AirdropView, BulletEvent, PlaneView } from "@rebirth/sim";
import { type Application, Container, Sprite } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { AudioEngine, PlayOptions } from "../src/audio/audio.ts";
import { EmoteFx } from "../src/fx/emotes.ts";
import { FlareSystem } from "../src/fx/flare.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { SmokeSystem } from "../src/fx/smoke.ts";
import { AirSystem } from "../src/objects/planes.ts";
import { Camera } from "../src/render/camera.ts";
import { layerVisibility, overgroundLayer, sameLayer } from "../src/render/layerRules.ts";
import { Renderer } from "../src/render/renderer.ts";

const NEVER = (): boolean => {
    throw new Error("the stair mask is only asked for a viewer on stairs");
};

describe("overgroundLayer (survev smoke.ts / airdrop.ts / plane.ts / flare.ts)", () => {
    it("lifts a ground object over everything for a viewer on the ground, never for one underground", () => {
        expect(overgroundLayer(0, 0, NEVER)).toBe(2);
        expect(overgroundLayer(0, 1, NEVER)).toBe(0);
    });

    it("lifts a bunker object for a viewer underground, never for one on the ground", () => {
        expect(overgroundLayer(1, 1, NEVER)).toBe(3);
        expect(overgroundLayer(1, 0, NEVER)).toBe(1);
    });

    it("on the stairs both floors show, except a ground object under a stair mask", () => {
        for (const viewer of [2, 3]) {
            expect(
                overgroundLayer(0, viewer, () => false),
                `viewer ${viewer}`,
            ).toBe(2);
            expect(
                overgroundLayer(0, viewer, () => true),
                `viewer ${viewer}`,
            ).toBe(0);
            expect(
                overgroundLayer(1, viewer, () => true),
                `viewer ${viewer}`,
            ).toBe(3);
            expect(
                overgroundLayer(1, viewer, () => false),
                `viewer ${viewer}`,
            ).toBe(3);
        }
    });

    it("sameLayer: a floor sees itself and its stair half, both stair halves see each other", () => {
        expect([sameLayer(0, 0), sameLayer(0, 2), sameLayer(1, 3), sameLayer(2, 3)]).toEqual([true, true, true, true]);
        expect([sameLayer(0, 1), sameLayer(0, 3), sameLayer(1, 2)]).toEqual([false, false, false]);
    });
});

describe("layerVisibility (emotes over players, survev emote.ts)", () => {
    it("shows the viewer's floor and the stairs fully and another floor as far as it is faded in", () => {
        const underground = { layer: 1, ground: 1 };
        expect(layerVisibility(0, 1, underground)).toBe(0);
        expect(layerVisibility(1, 1, underground)).toBe(1);
        expect(layerVisibility(2, 1, underground)).toBe(1);
        const surface = { layer: 0, ground: 0 };
        expect(layerVisibility(1, 0, surface)).toBe(0);
        expect(layerVisibility(0, 0, surface)).toBe(1);
        expect(layerVisibility(3, 0, surface)).toBe(1);
        // halfway down the fade
        expect(layerVisibility(0, 1, { layer: 0.5, ground: 0.25 })).toBe(0.75);
        expect(layerVisibility(1, 0, { layer: 0.5, ground: 0 })).toBe(0.5);
    });
});

function renderer(): Renderer {
    const app = { stage: new Container(), ticker: { FPS: 60 } } as unknown as Application;
    return new Renderer(app, new Camera());
}

/** Sets the viewer's layer and runs the renderer's layer fade to its end. */
function view(r: Renderer, layer: number, underground = layer === 1): void {
    r.activeLayer = layer;
    r.underground = underground;
    for (let i = 0; i < 20; i++) r.update(0.1);
}

const POS = { x: 100, y: 100 };
const MASK = { min: { x: 95, y: 95 }, max: { x: 105, y: 105 } };

describe("Renderer.addOverground", () => {
    it("hides a surface object in a bunker and shows it again on the surface", () => {
        const r = renderer();
        const s = new Sprite();
        view(r, 1);
        expect(r.layerFade).toEqual({ layer: 1, ground: 1 });
        expect(r.addOverground(s, 0, 1500, 1, POS)).toBe(0);
        expect(s.parent).toBe(r.layers[0]);
        expect(r.drawn(s)).toBe(false);
        view(r, 0);
        expect(r.addOverground(s, 0, 1500, 1, POS)).toBe(2);
        expect(s.parent).toBe(r.layers[3]);
        expect(r.drawn(s)).toBe(true);
    });

    it("keeps a bunker smoke on the faded underground layer for a viewer on the surface", () => {
        const r = renderer();
        const s = new Sprite();
        view(r, 0);
        r.addOverground(s, 1, 1000, 1, POS);
        expect(s.parent).toBe(r.layers[1]);
        expect(r.drawn(s)).toBe(false);
        view(r, 1);
        r.addOverground(s, 1, 1000, 1, POS);
        expect(s.parent).toBe(r.layers[3]);
        expect(r.drawn(s)).toBe(true);
    });

    it("on the stairs: over everything outside the stair mask, on the ground layer under it", () => {
        const r = renderer();
        const s = new Sprite();
        r.setStairMasks([MASK]);
        view(r, 3);
        r.addOverground(s, 0, 1500, 1, POS);
        expect(s.parent).toBe(r.layers[0]);
        expect(r.drawn(s)).toBe(true);
        r.addOverground(s, 0, 1500, 1, { x: 120, y: 100 });
        expect(s.parent).toBe(r.layers[3]);
        expect(r.insideStairMask({ x: 105.5, y: 100 }, 1)).toBe(true);
        expect(r.insideStairMask({ x: 106.5, y: 100 }, 1)).toBe(false);
    });

    it("a layer 1 structure above ground (underground: false) keeps the ground drawn under it", () => {
        const r = renderer();
        const s = new Sprite();
        view(r, 1, false);
        expect(r.addOverground(s, 0, 1500, 1, POS)).toBe(0);
        expect(r.drawn(s)).toBe(true);
    });
});

interface Played {
    name: string;
    layer: number | undefined;
}

function fakeAudio(played: Played[]): AudioEngine {
    return {
        preload: () => {},
        playSound: (name: string, opts: PlayOptions) => {
            played.push({ name, layer: opts.layer });
            return null;
        },
        updateSound: () => {},
        stop: () => {},
    } as unknown as AudioEngine;
}

const fakeTextures = { apply: () => {} } as unknown as TextureStore;

describe("air drops seen from a bunker (survev airdrop.ts:108-115, plane.ts:268-276)", () => {
    it("the plane, the falling crate and its landing smoke stay hidden underground; their sounds come from above", () => {
        const r = renderer();
        const particles = new ParticleSystem(r, fakeTextures);
        const played: Played[] = [];
        const air = new AirSystem({
            renderer: r,
            textures: fakeTextures,
            audio: fakeAudio(played),
            particles,
            mapDef: MapDefs.main,
            isWater: () => false,
        });
        const frame = (layer: number) => ({ dt: 0.1, viewerPos: POS, viewerLayer: layer, viewerIndoors: false });
        const plane: PlaneView = { id: 1, pos: POS, dir: { x: 1, y: 0 }, planeType: "airdrop", actionComplete: true };
        const drop: AirdropView = { id: 7, pos: POS, fallT: 0.05, landed: false };
        view(r, 1);
        air.apply([plane], [drop]);
        air.update(frame(1));
        const { planes, airdrops } = air.sprites;
        expect(planes[0].parent).toBe(r.layers[0]);
        expect(airdrops[0].parent).toBe(r.layers[0]);
        expect([r.drawn(planes[0]), r.drawn(airdrops[0])]).toEqual([false, false]);
        // the chute and fall sounds play from the ground layer: halved and muffled underground
        expect(played.filter((p) => p.name.startsWith("airdrop_")).map((p) => p.layer)).toEqual([0, 0]);

        // back on the surface the falling crate is drawn over everything
        view(r, 0);
        air.update(frame(0));
        expect(airdrops[0].parent).toBe(r.layers[3]);
        expect(r.drawn(airdrops[0])).toBe(true);

        // it lands while the viewer is on the surface: the smoke shows, then hides once the viewer is underground
        air.apply([], [{ ...drop, landed: true }]);
        air.update(frame(0));
        particles.update(0.01);
        const smoke = particles.spritesOf("airdropSmoke");
        expect(smoke.length).toBe(10);
        expect(smoke.every((s) => s.parent === r.layers[3] && r.drawn(s))).toBe(true);
        view(r, 1);
        particles.update(0.01);
        expect(smoke.every((s) => s.parent === r.layers[0] && !r.drawn(s))).toBe(true);
    });
});

describe("smoke clouds and flares seen from the other floor (survev smoke.ts:145-159, flare.ts:158-168)", () => {
    it("a surface smoke and a flare are hidden in a bunker, a bunker smoke on the surface", () => {
        const r = renderer();
        const smokes = new SmokeSystem({ renderer: r, textures: fakeTextures });
        smokes.apply([
            { id: 1, pos: POS, rad: 3, layer: 0, interior: false },
            { id: 2, pos: { x: 120, y: 100 }, rad: 3, layer: 1, interior: false },
        ]);
        const [surface, bunker] = smokes.sprites;
        const flares = new FlareSystem(r, fakeTextures);
        const flare: BulletEvent = {
            id: 1,
            shooterId: 1,
            bulletType: "bullet_flare",
            sourceType: "flare_gun",
            pos: POS,
            dir: { x: 1, y: 0 },
            layer: 0,
            maxDist: 40,
            reflectCount: 0,
            hitPlayer: false,
            shotFx: false,
            offHand: false,
        };
        flares.add(flare, GameObjectDefs.bullet_flare as never);
        const step = () => {
            smokes.update(0.1);
            flares.update(0.1);
        };

        view(r, 1);
        step();
        expect([surface.parent, r.drawn(surface)]).toEqual([r.layers[0], false]);
        expect([bunker.parent, r.drawn(bunker)]).toEqual([r.layers[3], true]);
        expect(flares.containers.map((c) => [c.parent, r.drawn(c)])).toEqual([
            [r.layers[0], false],
            [r.layers[0], false],
        ]);

        view(r, 0);
        step();
        expect([surface.parent, r.drawn(surface)]).toEqual([r.layers[3], true]);
        expect([bunker.parent, r.drawn(bunker)]).toEqual([r.layers[1], false]);
        expect(flares.containers.map((c) => [c.parent, r.drawn(c)])).toEqual([
            [r.layers[3], true],
            [r.layers[3], true],
        ]);
    });
});

describe("emotes of players on another floor (survev emote.ts:1088-1092)", () => {
    it("an emote over a surface player is hidden in a bunker and shown on the surface", () => {
        const r = renderer();
        const camera = new Camera();
        camera.resize(1280, 720);
        const emotes = new EmoteFx(fakeTextures, fakeAudio([]));
        emotes.addEmote({ playerId: 5, type: "emote_thumbsup", itemType: "", isPing: false });
        const frame = (dt: number) => ({
            dt,
            camera,
            player: (id: number) => (id === 5 ? { pos: { x: 0, y: 0 }, layer: 0 } : null),
            visibility: (layer: number) => r.visibility(layer),
        });
        view(r, 1);
        emotes.update(frame(0.1));
        expect(emotes.bubbleContainers.length).toBe(1);
        expect(emotes.bubbleCount).toBe(0);
        view(r, 0);
        emotes.update(frame(0.1));
        expect(emotes.bubbleCount).toBe(1);
        // a teammate on the stairs shows from both floors
        view(r, 1);
        const onStairs = { ...frame(0.1), player: () => ({ pos: { x: 0, y: 0 }, layer: 2 }) };
        emotes.update(onStairs);
        expect(emotes.bubbleCount).toBe(1);
    });
});
