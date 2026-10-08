// M9 client hit effects: tracer rules (survev client/src/objects/bullet.ts), pan geometry (player.ts), flare growth
// (flare.ts) and melee render order, run on fake renderer / audio / scene objects.
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, type MeleeDef } from "@rebirth/defs";
import type { BulletEvent, ObstacleView, PlayerView } from "@rebirth/sim";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { AudioEngine } from "../src/audio/audio.ts";
import { hasActivePan, panHit, panSegmentOf, sameAudioLayer, tracerTint } from "../src/fx/bulletHits.ts";
import { type BulletScene, BulletSystem } from "../src/fx/bullets.ts";
import { playerRenderOrder } from "../src/fx/effects.ts";
import { FlareSystem } from "../src/fx/flare.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { SpritePool } from "../src/render/pool.ts";
import type { Renderer } from "../src/render/renderer.ts";

function player(id: number, pos: Vec2, extra: Partial<PlayerView> = {}): PlayerView {
    return {
        id,
        kind: "player",
        type: "player",
        pos,
        layer: 0,
        dir: { x: 1, y: 0 },
        dead: false,
        downed: false,
        activeWeapon: "ak47",
        outfit: "outfitBase",
        helmet: "",
        chest: "",
        backpack: "",
        scale: 1,
        ...extra,
    };
}

function bullet(id: number, shooterId: number, extra: Partial<BulletEvent> = {}): BulletEvent {
    return {
        id,
        shooterId,
        bulletType: "bullet_ak47",
        sourceType: "ak47",
        pos: { x: 100, y: 100 },
        dir: { x: 1, y: 0 },
        layer: 0,
        maxDist: 30,
        reflectCount: 0,
        hitPlayer: false,
        shotFx: false,
        offHand: false,
        ...extra,
    };
}

function fakeRenderer(): Renderer {
    return { pool: new SpritePool(), add: () => {}, overgroundLayer: () => 2 } as unknown as Renderer;
}

const fakeTextures = { apply: () => {} } as unknown as TextureStore;

function fakeAudio(log: string[]): AudioEngine {
    return {
        playGroup: (name: string) => {
            log.push(name);
            return null;
        },
        playSound: (name: string) => {
            log.push(name);
            return null;
        },
    } as unknown as AudioEngine;
}

function scene(players: PlayerView[], extra: Partial<BulletScene> = {}): BulletScene {
    const containers = new Map(players.map((p) => [p.id, new Container()]));
    return {
        localId: 999,
        cameraPos: { x: 0, y: 0 },
        activeAlive: true,
        activeLayer: 0,
        forEachObstacle: (_cb: (v: ObstacleView) => void) => {},
        forEachPlayer: (cb) => players.forEach(cb),
        playerById: (id) => players.find((p) => p.id === id),
        playerOld: () => undefined,
        playerContainer: (id) => containers.get(id) ?? null,
        segmentOnStairs: () => false,
        brightSurfaceAt: () => false,
        ...extra,
    };
}

const PARTICLES = new WeakMap<BulletSystem, ParticleSystem>();

function tracers(): { system: BulletSystem; particles: ParticleSystem; sounds: string[] } {
    const renderer = fakeRenderer();
    const particles = new ParticleSystem(renderer, fakeTextures);
    const sounds: string[] = [];
    const system = new BulletSystem(renderer, fakeTextures, fakeAudio(sounds), particles);
    PARTICLES.set(system, particles);
    return { system, particles, sounds };
}

function run(system: BulletSystem, s: BulletScene, seconds: number): void {
    for (let t = 0; t < seconds; t += 1 / 60) {
        system.update(1 / 60, s);
        PARTICLES.get(system)?.update(1 / 60);
    }
}

describe("tracer rules (survev bullet.ts)", () => {
    it("tints saturated bullets, then shooters on bright floors", () => {
        const colors = { regular: 1, saturated: 2, chambered: 3 };
        expect(tracerTint(colors, false, false)).toBe(1);
        expect(tracerTint(colors, false, true)).toBe(2);
        expect(tracerTint(colors, true, true)).toBe(3);
        expect(tracerTint({ regular: 1, saturated: 2 }, true, false)).toBe(2);
        // AP Rounds: the ammo's apSaturated colour first (survev bullet.ts:165-166), the usual rules without one
        const ap = { ...colors, apSaturated: 4 };
        expect(tracerTint(ap, true, true, true)).toBe(4);
        expect(tracerTint(ap, false, false, true)).toBe(4);
        expect(tracerTint(colors, false, true, true)).toBe(2);
    });

    it("whizzes on the listener's layer or when either is on stairs", () => {
        expect(sameAudioLayer(0, 0)).toBe(true);
        expect(sameAudioLayer(0, 1)).toBe(false);
        expect(sameAudioLayer(2, 1)).toBe(true);
        expect(sameAudioLayer(1, 3)).toBe(true);
    });

    it("draws blood on the hit player's view, with the hit sound", () => {
        const { system, particles, sounds } = tracers();
        const target = player(2, { x: 110, y: 100 });
        const s = scene([player(1, { x: 98, y: 100 }), target]);
        system.addEvents([bullet(1, 1)], s);
        run(system, s, 0.2);
        expect(system.hits.blood).toBe(1);
        expect(sounds).toContain("player_bullet_hit");
        const container = s.playerContainer(2)!;
        const [splat] = particles.spritesIn(container);
        // the impact offset in the player's local pixels: the left edge of the body (16 px per unit)
        expect(splat.position.x).toBeCloseTo(-GameConfig.player.radius * 16, 6);
        expect(splat.position.y).toBeCloseTo(0, 6);
        expect(splat.rotation).toBe(1);
    });

    it("shows neither blood nor the hit sound while the shooter is dead or downed", () => {
        for (const state of [{ dead: true }, { downed: true }]) {
            const { system, sounds } = tracers();
            const s = scene([player(1, { x: 98, y: 100 }, state), player(2, { x: 110, y: 100 })]);
            system.addEvents([bullet(1, 1)], s);
            run(system, s, 0.3);
            expect(system.hits.blood).toBe(0);
            expect(sounds).not.toContain("player_bullet_hit");
        }
    });

    it("skips the shooter unless the bullet is shrapnel or a ricochet", () => {
        const shooterOnPath = player(1, { x: 105, y: 100 });
        for (const [extra, blood] of [
            [{}, 0],
            [{ reflectCount: 1 }, 1],
            [{ bulletType: "shrapnel_frag", sourceType: "frag" }, 1],
        ] as const) {
            const { system } = tracers();
            const s = scene([shooterOnPath]);
            system.addEvents([bullet(1, 1, { ...extra, maxDist: 20 })], s);
            run(system, s, 0.5);
            expect(system.hits.blood).toBe(blood);
        }
    });

    it("stops at the first player: the pan in front takes the round with chips and the pan's bullet sound", () => {
        const { system, sounds } = tracers();
        const a = Math.PI + (15 * Math.PI) / 180;
        const panHolder = player(
            2,
            { x: 110, y: 100 },
            { activeWeapon: "pan", dir: { x: Math.cos(a), y: Math.sin(a) } },
        );
        const behind = player(3, { x: 120, y: 100 });
        const s = scene([player(1, { x: 98, y: 100 }), panHolder, behind]);
        system.addEvents([bullet(1, 1)], s);
        run(system, s, 0.5);
        expect(system.hits.pan).toBe(1);
        expect(system.hits.blood).toBe(0);
        expect(sounds).toContain((GameObjectDefs.pan as MeleeDef).sound.bullet);
    });

    it("passes a player's disguise, chipping it, but stops at the same obstacle undisguised (survev isSkin)", () => {
        const barrel = (skinPlayerId?: number): ObstacleView => ({
            id: 50,
            kind: "obstacle",
            type: "barrel_01",
            pos: { x: 108, y: 100 },
            layer: 0,
            ori: 0,
            scale: 1,
            healthT: 1,
            dead: false,
            ...(skinPlayerId === undefined ? {} : { skinPlayerId }),
        });
        for (const [skin, blood] of [
            [3, 1],
            [undefined, 0],
        ] as const) {
            const { system } = tracers();
            const behind = player(2, { x: 116, y: 100 });
            const obstacle = barrel(skin);
            const s = scene([player(1, { x: 98, y: 100 }), behind], {
                forEachObstacle: (cb: (v: ObstacleView) => void) => cb(obstacle),
            });
            const chips: string[] = [];
            const hitFx = (system as unknown as { hitFx: (p: string, ...rest: unknown[]) => void }).hitFx.bind(system);
            (system as unknown as { hitFx: (p: string, ...rest: unknown[]) => void }).hitFx = (p, ...rest) => {
                chips.push(p);
                hitFx(p, ...rest);
            };
            system.addEvents([bullet(1, 1)], s);
            run(system, s, 0.3);
            expect(chips, `skin ${skin}`).toEqual(["barrelChip"]);
            expect(system.hits.blood, `skin ${skin}`).toBe(blood);
        }
    });

    it("draws at def speed x speedMult", () => {
        const { system } = tracers();
        const s = scene([]);
        system.addEvents([bullet(1, 1, { maxDist: 200, speedMult: 1.25 })], s);
        system.addEvents([bullet(2, 1, { maxDist: 200, pos: { x: 100, y: 200 } })], s);
        system.update(0.1, s);
        const def = GameObjectDefs.bullet_ak47 as { speed: number };
        const internals = (system as unknown as { tracers: Array<{ id: number; pos: Vec2 }> }).tracers;
        const fast = internals.find((t) => t.id === 1)!;
        const normal = internals.find((t) => t.id === 2)!;
        expect(fast.pos.x - 100).toBeCloseTo(def.speed * 1.25 * 0.1, 6);
        expect(normal.pos.x - 100).toBeCloseTo(def.speed * 0.1, 6);
    });

    it("moves the tracer to the stairs layer for a shooter on stairs or a path over stairs", () => {
        const onStairs = tracers();
        const s1 = scene([player(1, { x: 98, y: 100 }, { layer: 2 })]);
        onStairs.system.addEvents([bullet(1, 1)], s1);
        const internals = (sys: BulletSystem) => (sys as unknown as { tracers: Array<{ layer: number }> }).tracers;
        expect(internals(onStairs.system)[0].layer).toBe(2);
        const crossing = tracers();
        const s2 = scene([], { segmentOnStairs: () => true });
        crossing.system.addEvents([bullet(1, 1)], s2);
        crossing.system.update(1 / 60, s2);
        expect(internals(crossing.system)[0].layer).toBe(2);
        expect(crossing.system.hits.stairs).toBe(1);
    });

    it("draws flare rounds as flares, not tracers", () => {
        const { system } = tracers();
        system.addEvents(
            [bullet(1, 1, { bulletType: "bullet_flare", sourceType: "flare_gun", maxDist: 16 })],
            scene([]),
        );
        expect(system.flares.count).toBe(1);
        expect(system.activeCount).toBe(0);
    });
});

describe("pans (survev player.ts m_getPanSegment, m_hasActivePan)", () => {
    const surface = (GameObjectDefs.pan as MeleeDef).reflectSurface!;

    it("uses the held surface, the worn one on the back, never mid-swing", () => {
        const held = player(1, { x: 0, y: 0 }, { activeWeapon: "pan" });
        expect(hasActivePan(held)).toBe(true);
        expect(hasActivePan({ ...held, anim: { type: "melee", seq: 1 } })).toBe(false);
        expect(hasActivePan(player(1, { x: 0, y: 0 }, { wearingPan: true }))).toBe(true);
        expect(panSegmentOf(held, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual(surface.equipped);
        const worn = player(1, { x: 0, y: 0 }, { wearingPan: true, scale: 2 });
        const seg = panSegmentOf(worn, { x: 0, y: 0 }, { x: 1, y: 0 })!;
        expect(seg.p0.x).toBeCloseTo(surface.unequipped.p0.x * 2, 9);
    });

    it("blocks a round crossing the pan before the body", () => {
        const a = Math.PI + (15 * Math.PI) / 180;
        const view = player(2, { x: 10, y: 0 }, { activeWeapon: "pan", dir: { x: Math.cos(a), y: Math.sin(a) } });
        const hit = panHit(view, { pos: view.pos, dir: view.dir }, { x: 0, y: 0 }, { x: 10, y: 0 });
        expect(hit).not.toBeNull();
        expect(hit!.point.x).toBeLessThan(10 - GameConfig.player.radius);
    });
});

describe("flares (survev flare.ts)", () => {
    it("grow by easeOutExpo to maxFlareScale, fly their range, then fade", () => {
        const flares = new FlareSystem(fakeRenderer(), fakeTextures);
        const def = GameObjectDefs.bullet_flare as { speed: number; distance: number; maxFlareScale: number };
        flares.add(
            bullet(1, 1, { bulletType: "bullet_flare", maxDist: def.distance }),
            GameObjectDefs.bullet_flare as never,
        );
        flares.update(1.25);
        expect(flares.newestScale).toBeCloseTo((1 - 2 ** -5) * def.maxFlareScale, 6);
        // at its range (4 s) the flare stops growing and drifts on while it fades (0.8 alpha at 1/s)
        for (let t = 1.25; t < def.distance / def.speed + 0.2; t += 0.05) flares.update(0.05);
        expect(flares.count).toBe(1);
        for (let t = 0; t < 1; t += 0.05) flares.update(0.05);
        expect(flares.count).toBe(0);
    });
});

describe("melee render order", () => {
    it("draws hits just above the hit player, over the stairs on the viewer's floor", () => {
        expect(playerRenderOrder(player(1, { x: 0, y: 0 }), 0)).toEqual({ layer: 0, zOrd: 18 });
        expect(playerRenderOrder(player(1, { x: 0, y: 0 }, { layer: 2 }), 0)).toEqual({ layer: 2, zOrd: 118 });
        expect(playerRenderOrder(player(1, { x: 0, y: 0 }, { layer: 3 }), 0)).toEqual({ layer: 3, zOrd: 18 });
    });
});
