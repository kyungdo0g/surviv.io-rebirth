// A rocket stops being drawn where the simulation says it detonated (owner report 2026-10-10: the RPG-7 warhead flew
// on through the crate it had just blown up). The sim re-reports a launcher round's stop with its endDist (sim
// combat/bullets.ts); the tracer, the round's own sprite (fx/bullets.ts, rebirth/launcherRoundArt.ts) and the smoke
// trail (fx/newGunFx.ts) all end there, even when the obstacle it hit is already gone from the client's view.
import type { BulletEvent } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { AudioEngine } from "../src/audio/audio.ts";
import { type BulletScene, BulletSystem } from "../src/fx/bullets.ts";
import { LauncherFx } from "../src/fx/newGunFx.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { SpritePool } from "../src/render/pool.ts";
import type { Renderer } from "../src/render/renderer.ts";

const ROCKETS = ["bullet_rpg7", "bullet_panzerfaust", "bullet_m202"];

function rocket(id: number, bulletType: string, endDist?: number): BulletEvent {
    const e: BulletEvent = {
        id,
        shooterId: 1,
        bulletType,
        sourceType: bulletType.replace(/^bullet_/, ""),
        pos: { x: 100, y: 100 },
        dir: { x: 1, y: 0 },
        layer: 0,
        // the first indestructible obstacle on the path: a crate in between does not count
        maxDist: 60,
        reflectCount: 0,
        hitPlayer: false,
        shotFx: false,
        offHand: false,
    };
    if (endDist !== undefined) e.endDist = endDist;
    return e;
}

const scene: BulletScene = {
    localId: 999,
    activeLayer: 0,
    cameraPos: { x: 0, y: 0 },
    activeAlive: false,
    // the crate the rocket hit is already destroyed: nothing on the client stops the tracer by itself
    forEachObstacle: () => {},
    forEachPlayer: () => {},
    playerById: () => undefined,
    playerOld: () => undefined,
    playerContainer: () => null,
    segmentOnStairs: () => false,
    brightSurfaceAt: () => false,
};

function systems() {
    const textures = { apply: () => {} } as unknown as TextureStore;
    const renderer = { pool: new SpritePool(), add: () => {}, overgroundLayer: () => 0 } as unknown as Renderer;
    const audio = { playGroup: () => null, playSound: () => null } as unknown as AudioEngine;
    const particles = new ParticleSystem(renderer, textures);
    const puffs = { add: () => {} } as unknown as ParticleSystem;
    return { bullets: new BulletSystem(renderer, textures, audio, particles), trails: new LauncherFx(puffs) };
}

function step(s: ReturnType<typeof systems>, dt: number, times = 1): void {
    for (let i = 0; i < times; i++) {
        s.bullets.update(dt, scene);
        s.trails.update(dt);
    }
}

describe("a detonated rocket is no longer drawn", () => {
    it("the sim's stop report ends the sprite and the smoke trail at the blast, not at the next wall", () => {
        const stopped = systems();
        const flying = systems();
        const first = ROCKETS.map((type, i) => rocket(i + 1, type));
        for (const s of [stopped, flying]) {
            s.bullets.addEvents(first, scene);
            s.trails.addBullets(first);
            step(s, 0.1);
            expect(s.bullets.roundHeads).toHaveLength(3);
            expect(s.trails.activeRockets).toBe(3);
        }
        // the rockets burst on a crate 12 u out; the RPG-7 is already drawn past it (8.5 u, then 17)
        const stop = ROCKETS.map((type, i) => rocket(i + 1, type, 12));
        stopped.bullets.addEvents(stop, scene);
        stopped.trails.addBullets(stop);
        step(stopped, 0.1);
        expect(stopped.bullets.roundHeads.map((h) => h.bulletType)).toEqual(["bullet_m202"]);
        step(stopped, 0.1, 2);
        expect(stopped.bullets.roundHeads).toEqual([]);
        expect(stopped.trails.activeRockets).toBe(0);
        // without the report they would fly on towards the wall 60 u out
        step(flying, 0.1, 3);
        expect(flying.bullets.roundHeads).toHaveLength(3);
        expect(flying.trails.activeRockets).toBe(3);
    });

    it("a rocket first seen already stopped is drawn only up to its stop", () => {
        const s = systems();
        const events = ROCKETS.map((type, i) => rocket(i + 1, type, 6));
        s.bullets.addEvents(events, scene);
        s.trails.addBullets(events);
        step(s, 0.12);
        expect(s.bullets.roundHeads).toEqual([]);
        expect(s.trails.activeRockets).toBe(0);
    });
});
