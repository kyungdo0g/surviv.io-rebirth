// Rebirth Enhanced hit effects (user/2026-10-07-hit-feedback; fx/hitFeedback.ts): the damage -> intensity curves and
// the numbers derived from it, arc angles, marker priority, confirm sounds and their rate limit, the flash pool, the
// camera kick and the Screen shake setting, the off switch (identical original effects, nothing extra drawn) and an
// 80-player stress run, on fake renderer / audio / world objects like hits.test.ts.
import type { Vec2 } from "@rebirth/core";
import type { BulletEvent, HitEvent, KillEvent, LocalPlayerState, PlayerView, Snapshot } from "@rebirth/sim";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { AudioEngine } from "../src/audio/audio.ts";
import { type BulletScene, BulletSystem } from "../src/fx/bullets.ts";
import { HitFeedback, type HitFeedbackFrame, type HitWorld } from "../src/fx/hitFeedback.ts";
import {
    arcAngle,
    arcRadius,
    CONFIRM_INTERVAL,
    confirmSound,
    extraBloodCount,
    flashFrame,
    flashParams,
    hitIntensity,
    hitVariant,
    kickAmount,
    lowHealthFloor,
    MarkerVariant,
    markerFrame,
    nominalBulletDamage,
    stackVignette,
    strongerVariant,
    TokenBucket,
    vignettePeak,
} from "../src/fx/hitFeedbackMath.ts";
import { HitFlashes } from "../src/fx/hitFlash.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { Camera } from "../src/render/camera.ts";
import { SpritePool } from "../src/render/pool.ts";
import type { Renderer } from "../src/render/renderer.ts";

const fakeTextures = { apply: () => {} } as unknown as TextureStore;

interface Played {
    name: string;
    detune?: number;
    volumeScale?: number;
    pos?: Vec2;
}

function fakeAudio(log: Played[]): AudioEngine {
    const play = (name: string, opts: Omit<Played, "name"> = {}) => {
        log.push({ name, detune: opts.detune, volumeScale: opts.volumeScale, pos: opts.pos });
        return null;
    };
    return { playGroup: play, playSound: play } as unknown as AudioEngine;
}

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

function fakeWorld(
    players: PlayerView[],
    teams: Record<number, number> = {},
): HitWorld & { containers: Map<number, Container> } {
    const containers = new Map(players.map((p) => [p.id, new Container()]));
    // keyed like ObjectWorld's entries
    const byId = new Map(players.map((p) => [p.id, p]));
    return {
        containers,
        get: (id) => byId.get(id),
        playerContainer: (id) => containers.get(id) ?? null,
        visualPos: (id) => byId.get(id)?.pos,
        teamOf: (id) => teams[id] ?? 0,
    };
}

const LOCAL: LocalPlayerState = { health: 100, dead: false, layer: 0 } as unknown as LocalPlayerState;

interface Rig {
    fx: HitFeedback;
    camera: Camera;
    pool: SpritePool;
    screen: Container;
    particles: ParticleSystem;
    sounds: Played[];
    world: ReturnType<typeof fakeWorld>;
    frame(dt?: number, local?: LocalPlayerState): void;
}

function rig(
    players: PlayerView[],
    activeId = 1,
    enabled = true,
    shrouded?: (pos: Vec2, layer: number) => boolean,
): Rig {
    const pool = new SpritePool();
    const screen = new Container();
    const renderer = { pool, screen, add: () => {} } as unknown as Renderer;
    const particles = new ParticleSystem(renderer, fakeTextures);
    const sounds: Played[] = [];
    const camera = new Camera();
    camera.resize(1280, 720);
    camera.zoom = 1.43;
    const me = players.find((p) => p.id === activeId);
    camera.pos = me ? { ...me.pos } : { x: 100, y: 100 };
    const fx = new HitFeedback({
        renderer,
        textures: fakeTextures,
        audio: fakeAudio(sounds),
        particles,
        camera,
        hudRoot: null,
        enabled,
        shrouded,
    });
    const world = fakeWorld(players);
    fx.setWorld(world, activeId);
    const frame = (dt = 1 / 60, local = LOCAL) => {
        const f: HitFeedbackFrame = {
            dt,
            now: 0,
            activePos: me?.pos ?? camera.pos,
            local,
            downed: false,
            cursor: { x: 700, y: 300 },
            aimDir: { x: 1, y: 0 },
            hudHidden: false,
            hudScale: 1,
        };
        fx.update(f);
        particles.update(dt);
        camera.applyShake();
    };
    return { fx, camera, pool, screen, particles, sounds, world, frame };
}

function snap(activeId: number, hits: HitEvent[] = [], kills: KillEvent[] = []): Snapshot {
    return { tick: 1, time: 0, localPlayerId: activeId, local: LOCAL, objects: [], deletedIds: [], hits, kills };
}

const dealt = (target: number, amount: number, extra: Partial<HitEvent> = {}): HitEvent => ({
    targetId: target,
    sourceId: 1,
    amount,
    damageType: 0,
    headshot: false,
    armored: false,
    ...extra,
});

const taken = (source: number, amount: number, dir: Vec2 | undefined, extra: Partial<HitEvent> = {}): HitEvent => ({
    targetId: 1,
    sourceId: source,
    amount,
    damageType: 0,
    headshot: false,
    armored: false,
    dir,
    ...extra,
});

function kill(target: number, killer: number, downed = false): KillEvent {
    return {
        targetId: target,
        killerId: killer,
        killCreditId: killer,
        killerKills: 1,
        damageType: 0,
        source: {} as KillEvent["source"],
        itemSourceType: "ak47",
        mapSourceType: "",
        downed,
        killed: !downed,
    };
}

const blood = (r: Rig) => r.particles.spawnedByType.get("bloodSplat") ?? 0;

describe("intensity and the numbers built on it", () => {
    it("k = sqrt(d / 100), clamped", () => {
        const table: Array<[number, number]> = [
            [9, 0.3],
            [13.5, 0.367],
            [35, 0.592],
            [72, 0.849],
            [99, 0.995],
            [112, 1],
        ];
        for (const [d, k] of table) expect(hitIntensity(d)).toBeCloseTo(k, 2);
        expect(hitIntensity(0)).toBe(0);
        expect(hitIntensity(-5)).toBe(0);
    });

    it("vignette peaks, stacking and the low-health floor", () => {
        expect(vignettePeak(hitIntensity(9))).toBeCloseTo(0.394, 2);
        expect(vignettePeak(hitIntensity(99))).toBeCloseTo(0.797, 2);
        expect(stackVignette(0.5, 0.4)).toBeCloseTo(0.532, 3);
        expect(stackVignette(0.8, 0.8)).toBe(0.85);
        expect(lowHealthFloor(30, 0)).toBe(0);
        expect(lowHealthFloor(0, 0)).toBe(0);
        // 10 HP: 0.30 x 0.6 x the 0.85-1 pulse
        expect(lowHealthFloor(10, 0)).toBeCloseTo(0.18 * 0.85, 3);
        expect(lowHealthFloor(10, 1 / 4.8)).toBeCloseTo(0.18, 3);
    });

    it("extra blood, kick and flash scale with the damage", () => {
        expect([9, 13.5, 35, 72, 99, 112].map((d) => extraBloodCount(hitIntensity(d)))).toEqual([2, 2, 3, 4, 5, 5]);
        // 0.125 u = 2.9 px and 0.299 u = 6.8 px at the 1x zoom of 1.43 (16 px per unit)
        expect(kickAmount(hitIntensity(9)) * 16 * 1.43).toBeCloseTo(2.86, 1);
        expect(kickAmount(hitIntensity(99)) * 16 * 1.43).toBeCloseTo(6.83, 1);
        const light = flashParams(hitIntensity(9));
        const heavy = flashParams(hitIntensity(99));
        expect(light.alpha).toBeCloseTo(0.455, 3);
        expect(heavy.alpha).toBeCloseTo(0.698, 3);
        expect(heavy.duration).toBeGreaterThan(light.duration);
        expect(flashParams(0.3, true).alpha).toBeCloseTo(light.alpha + 0.15, 3);
        expect(flashParams(0.3, false, true).alpha).toBe(0.85);
        expect(flashFrame(light, 0.01).tint).toBe(0xffffff);
        expect(flashFrame(light, 0.05).tint).toBe(0xff3030);
        expect(flashFrame(light, light.duration).alpha).toBe(0);
    });

    it("nominal bullet damage splits ricochets and falls off with range", () => {
        const def = { damage: 20, falloff: 0.5, distance: 100 };
        expect(nominalBulletDamage(def, 0, 0)).toBe(20);
        expect(nominalBulletDamage(def, 0, 100)).toBe(10);
        expect(nominalBulletDamage(def, 1, 0)).toBe(10);
        expect(nominalBulletDamage(def, 0, 300)).toBe(10);
    });

    it("the blood bucket refills at its rate up to its burst", () => {
        const b = new TokenBucket(160, 48);
        expect(b.take(100)).toBe(48);
        expect(b.take(1)).toBe(0);
        b.refill(0.1);
        expect(b.take(100)).toBe(16);
        b.refill(10);
        expect(b.available).toBe(48);
    });
});

describe("arcs and markers", () => {
    it("aims an arc at the attacker, else back along the hit, else nowhere", () => {
        const c = { x: 640, y: 360 };
        expect(arcAngle(c, { x: 800, y: 360 }, null)).toBeCloseTo(0, 6);
        expect(arcAngle(c, { x: 640, y: 500 }, null)).toBeCloseTo(Math.PI / 2, 6);
        // a hit travelling +x (world) came from -x: the arc points left
        expect(Math.abs(arcAngle(c, null, { x: 1, y: 0 })!)).toBeCloseTo(Math.PI, 6);
        // travelling down the world (-y) came from above: the arc points up the screen (-y)
        expect(arcAngle(c, null, { x: 0, y: -1 })).toBeCloseTo(-Math.PI / 2, 6);
        // the attacker on top of the player falls back to the direction
        expect(Math.abs(arcAngle(c, c, { x: 1, y: 0 })!)).toBeCloseTo(Math.PI, 6);
        expect(arcAngle(c, null, null)).toBeNull();
        expect(arcRadius(1280, 720)).toBeCloseTo(100.8, 3);
        expect(arcRadius(400, 300)).toBe(80);
        expect(arcRadius(3840, 2160)).toBe(140);
    });

    it("kill > knock > headshot > armour > body", () => {
        expect(hitVariant(true, true)).toBe(MarkerVariant.Headshot);
        expect(hitVariant(false, true)).toBe(MarkerVariant.Armor);
        expect(hitVariant(false, false)).toBe(MarkerVariant.Body);
        expect(strongerVariant(MarkerVariant.Kill, MarkerVariant.Headshot)).toBe(MarkerVariant.Kill);
        expect(strongerVariant(MarkerVariant.Armor, MarkerVariant.Knock)).toBe(MarkerVariant.Knock);
        const pop = markerFrame(MarkerVariant.Body, 0, 0);
        expect(pop.scale).toBeCloseTo(1.3, 6);
        expect(markerFrame(MarkerVariant.Body, 0, 0.06).scale).toBeCloseTo(1, 6);
        expect(markerFrame(MarkerVariant.Body, 0, 0.2).alpha).toBe(0);
        expect(markerFrame(MarkerVariant.Kill, 0, 0.1).scale).toBeCloseTo(1.6, 6);
    });

    it("merges one snapshot's hits into one marker of the strongest variant", () => {
        const r = rig([player(1, { x: 100, y: 100 }), player(2, { x: 110, y: 100 })]);
        r.fx.applySnapshot(snap(1, [dealt(2, 10), dealt(2, 12, { armored: true }), dealt(2, 30, { headshot: true })]));
        expect(r.fx.markers.shown).toEqual([0, 0, 1, 0, 0]);
        r.fx.applySnapshot(snap(1, [dealt(2, 10)], [kill(2, 1)]));
        expect(r.fx.markers.shown[MarkerVariant.Kill]).toBe(1);
        r.frame();
        expect(r.fx.markers.markerVisible).toBe(true);
    });
});

describe("confirm sounds", () => {
    it("plays the variant's sound pitched and quiet, one per 70 ms except kills and knocks", () => {
        expect(confirmSound(MarkerVariant.Body, 0.3)).toEqual({
            name: "punch_hit_01",
            detune: 600,
            volumeScale: 0.295,
        });
        expect(confirmSound(MarkerVariant.Kill, 1).name).toBe("metal_punch_hit_02");
        const r = rig([player(1, { x: 100, y: 100 }), player(2, { x: 110, y: 100 })]);
        r.fx.applySnapshot(snap(1, [dealt(2, 10)]));
        r.frame(CONFIRM_INTERVAL / 2);
        r.fx.applySnapshot(snap(1, [dealt(2, 10)]));
        expect(r.sounds.map((s) => s.name)).toEqual(["punch_hit_01"]);
        r.fx.applySnapshot(snap(1, [], [kill(2, 1, true)]));
        expect(r.sounds.map((s) => s.name)).toEqual(["punch_hit_01", "punch_hit_01"]);
        expect(r.sounds[1].detune).toBe(-200);
        r.frame(CONFIRM_INTERVAL);
        r.fx.applySnapshot(snap(1, [dealt(2, 10, { headshot: true })]));
        expect(r.sounds.at(-1)).toMatchObject({ name: "pan_hit_01", detune: 500 });
        // centred: never positional
        expect(r.sounds.every((s) => s.pos === undefined)).toBe(true);
    });
});

describe("hits taken", () => {
    it("pulses the vignette, points an arc at the attacker and kicks the camera along the hit", () => {
        const r = rig([player(1, { x: 100, y: 100 }), player(2, { x: 90, y: 100 })]);
        r.fx.applySnapshot(snap(1, [taken(2, 35, { x: 1, y: 0 })]));
        r.frame();
        expect(r.fx.vignette.shown).toBeGreaterThan(0.5);
        expect(r.fx.markers.activeArcs).toBe(1);
        // the camera moved against the hit's travel: the scene jolts along it
        expect(r.camera.lastShake).toBeGreaterThan(0.1);
        expect(r.fx.kickOffset.x).toBeLessThan(0);
        for (let i = 0; i < 90; i++) r.frame();
        expect(r.fx.vignette.shown).toBe(0);
        expect(r.fx.markers.activeArcs).toBe(0);
        expect(r.fx.kickOffset).toEqual({ x: 0, y: 0 });
    });

    it("keeps the kick off with Screen shake off", () => {
        const r = rig([player(1, { x: 100, y: 100 }), player(2, { x: 90, y: 100 })]);
        r.camera.shakeEnabled = false;
        r.fx.applySnapshot(snap(1, [taken(2, 99, { x: 1, y: 0 })]));
        r.frame();
        expect(r.camera.lastShake).toBe(0);
        expect(r.fx.kickOffset).toEqual({ x: 0, y: 0 });
        expect(r.fx.vignette.shown).toBeGreaterThan(0.7);
    });

    it("falls back to the hit's direction for an attacker out of view (source 0)", () => {
        const r = rig([player(1, { x: 100, y: 100 })]);
        r.fx.applySnapshot(snap(1, [taken(0, 20, { x: 0, y: 1 })]));
        r.frame();
        expect(r.fx.markers.activeArcs).toBe(1);
        // no direction and no attacker: no arc, still the vignette
        r.fx.applySnapshot(snap(1, [taken(0, 20, undefined, { damageType: 3 })]));
        r.frame();
        expect(r.fx.markers.arcsStarted).toBe(1);
    });

    it("keeps the hit's direction for an attacker standing in the dark out of every light (fx/darkness.ts)", () => {
        // the attacker 20 u north of the player (up the screen); the hit travelled +x (from the west)
        const arcAngleNow = (shrouded: boolean) => {
            const r = rig([player(1, { x: 100, y: 100 }), player(2, { x: 100, y: 120 })], 1, true, () => shrouded);
            r.fx.applySnapshot(snap(1, [taken(2, 20, { x: 1, y: 0 })]));
            r.frame();
            const arcs = (r.fx.markers as unknown as { arcs: Array<{ active: boolean; g: Container }> }).arcs;
            return arcs.filter((a) => a.active).map((a) => a.g.rotation);
        };
        const [lit] = arcAngleNow(false);
        expect(lit).toBeCloseTo(-Math.PI / 2, 3);
        const [dark] = arcAngleNow(true);
        expect(Math.abs(dark)).toBeCloseTo(Math.PI, 3);
    });

    it("adds nothing for bleeding and gas, and at most four arcs", () => {
        const r = rig([player(1, { x: 100, y: 100 })]);
        r.fx.applySnapshot(
            snap(1, [taken(0, 5, { x: 1, y: 0 }, { damageType: 1 }), taken(0, 5, undefined, { damageType: 2 })]),
        );
        r.frame();
        expect(r.fx.vignette.shown).toBe(0);
        expect(r.fx.markers.activeArcs).toBe(0);
        const dirs = [0, 1, 2, 3, 4, 5].map((i) => ({ x: Math.cos(i), y: Math.sin(i) }));
        r.fx.applySnapshot(
            snap(
                1,
                dirs.map((d, i) => taken(10 + i, 10, d)),
            ),
        );
        r.frame();
        expect(r.fx.markers.activeArcs).toBe(4);
    });
});

describe("hits seen on any player", () => {
    it("flashes the body and sprays blood scaled by the damage; teammates get nothing", () => {
        const target = player(2, { x: 105, y: 100 });
        const mate = player(3, { x: 95, y: 100 });
        const r = rig([player(1, { x: 100, y: 100 }), target, mate]);
        r.world.teamOf = (id) => (id === 1 || id === 3 ? 7 : 8);
        r.fx.onPlayerHit(target, target.pos, { x: 1, y: 0 }, 9, 1);
        r.frame();
        expect(r.fx.flashes.count).toBe(1);
        const light = blood(r);
        expect(light).toBe(2);
        r.fx.onPlayerHit(target, target.pos, { x: 1, y: 0 }, 99, 1);
        r.frame();
        expect(blood(r) - light).toBe(5);
        r.fx.onPlayerHit(mate, mate.pos, { x: 1, y: 0 }, 50, 1);
        r.frame();
        expect(blood(r) - light).toBe(5);
        expect(r.fx.flashes.started).toBe(1);
    });

    it("bursts on kills and knocks, and flashes a server-only hit from its exact amount", () => {
        const target = player(2, { x: 105, y: 100 });
        const r = rig([player(1, { x: 100, y: 100 }), target]);
        r.fx.applySnapshot(snap(1, [], [kill(2, 9, true)]));
        expect(blood(r)).toBe(6);
        expect(r.fx.flashes.count).toBe(1);
        // a dealt hit nothing on screen showed (an explosion): after 0.15 s, flash and blood for 64 damage
        // the knock flash started between frames shows once (a long frame never hides a flash), then ends
        r.frame(0.5);
        r.frame(0.5);
        expect(r.fx.flashes.count).toBe(0);
        r.fx.applySnapshot(snap(1, [dealt(2, 64)]));
        r.frame(0.1);
        expect(r.fx.stats.serverOnly).toBe(0);
        r.frame(0.1);
        expect(r.fx.stats.serverOnly).toBe(1);
        expect(blood(r)).toBe(6 + extraBloodCount(hitIntensity(64)));
        // a client hit right before the server's: matched, the headshot adds its two splats
        r.frame(1);
        const before = blood(r);
        r.fx.onPlayerHit(target, target.pos, { x: 1, y: 0 }, 13.5, 1);
        r.fx.applySnapshot(snap(1, [dealt(2, 20, { headshot: true })]));
        r.frame(0.3);
        expect(r.fx.stats.serverOnly).toBe(1);
        expect(blood(r) - before).toBe(2 + extraBloodCount(hitIntensity(13.5)));
    });
});

describe("the flash pool", () => {
    it("reuses sprites, restarts a running flash and drops sprites destroyed with their player", () => {
        const pool = new SpritePool();
        const flashes = new HitFlashes(pool, fakeTextures);
        const a = new Container();
        flashes.flash(1, a, 1, flashParams(0.3));
        flashes.flash(1, a, 1, flashParams(0.9));
        expect(flashes.count).toBe(1);
        expect(a.children).toHaveLength(1);
        for (let i = 0; i < 30; i++) flashes.update(1 / 60);
        expect(flashes.count).toBe(0);
        expect(a.children).toHaveLength(0);
        flashes.flash(2, a, 1, flashParams(0.3));
        expect(pool.created).toBe(1);
        // the player view goes away with the flash sprite inside it
        a.destroy({ children: true });
        flashes.update(1 / 60);
        expect(flashes.count).toBe(0);
    });
});

describe("the setting", () => {
    function bulletRun(listener: HitFeedback | null) {
        const renderer = { pool: new SpritePool(), add: () => {} } as unknown as Renderer;
        const particles = new ParticleSystem(renderer, fakeTextures);
        const sounds: Played[] = [];
        const bullets = new BulletSystem(renderer, fakeTextures, fakeAudio(sounds), particles);
        bullets.hitListener = listener;
        const target = player(2, { x: 110, y: 100 });
        const containers = new Map([[2, new Container()]]);
        const scene: BulletScene = {
            localId: 999,
            cameraPos: { x: 0, y: 0 },
            activeAlive: true,
            activeLayer: 0,
            forEachObstacle: () => {},
            forEachPlayer: (cb) => cb(target),
            playerById: (id) => (id === 2 ? target : undefined),
            playerOld: () => undefined,
            playerContainer: (id) => containers.get(id) ?? null,
            segmentOnStairs: () => false,
            brightSurfaceAt: () => false,
        };
        const e: BulletEvent = {
            id: 1,
            shooterId: 1,
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
        };
        bullets.addEvents([e], scene);
        for (let i = 0; i < 60; i++) {
            bullets.update(1 / 60, scene);
            listener?.update({
                dt: 1 / 60,
                now: 0,
                activePos: { x: 100, y: 100 },
                local: LOCAL,
                downed: false,
                cursor: null,
                aimDir: { x: 1, y: 0 },
                hudHidden: false,
                hudScale: 1,
            });
            particles.update(1 / 60);
        }
        return { types: [...particles.spawnedByType], sounds: sounds.map((s) => s.name), hits: { ...bullets.hits } };
    }

    it("off: the original effects are identical and nothing extra is drawn", () => {
        const original = bulletRun(null);
        expect(original.hits.blood).toBe(1);
        const r = rig([player(1, { x: 100, y: 100 }), player(2, { x: 110, y: 100 })], 1, false);
        const off = bulletRun(r.fx);
        expect(off).toEqual(original);
        r.fx.applySnapshot(snap(1, [dealt(2, 50), taken(2, 50, { x: 1, y: 0 })], [kill(2, 1)]));
        r.frame();
        expect(r.screen.children.filter((c) => c.visible)).toEqual([]);
        expect(r.fx.vignette.shown).toBe(0);
        expect(r.camera.lastShake).toBe(0);
        expect(r.sounds).toEqual([]);
        expect(blood(r)).toBe(0);
        // on: the same bullet adds the flash and the extra blood on top (in the feedback's own particle system here)
        const onRig = rig([player(1, { x: 100, y: 100 }), player(2, { x: 110, y: 100 })]);
        const on = bulletRun(onRig.fx);
        expect(on).toEqual(original);
        expect(onRig.fx.flashes.started).toBe(1);
        expect(blood(onRig)).toBe(extraBloodCount(hitIntensity(13.5)));
    });

    it("switching off mid-effect releases the flash sprites and hides the HUD effects", () => {
        const target = player(2, { x: 105, y: 100 });
        const r = rig([player(1, { x: 100, y: 100 }), target]);
        r.fx.onPlayerHit(target, target.pos, { x: 1, y: 0 }, 50, 1);
        r.fx.applySnapshot(snap(1, [dealt(2, 50), taken(2, 50, { x: 1, y: 0 })]));
        r.frame();
        expect(r.fx.flashes.count).toBe(1);
        expect(r.world.containers.get(2)!.children.length).toBeGreaterThan(0);
        r.fx.setEnabled(false);
        expect(r.fx.flashes.count).toBe(0);
        expect(r.fx.markers.markerVisible).toBe(false);
        expect(r.fx.markers.activeArcs).toBe(0);
        r.frame();
        expect(r.fx.vignette.shown).toBe(0);
        expect(r.camera.lastShake).toBe(0);
        expect(r.screen.children.filter((c) => c.visible)).toEqual([]);
    });
});

describe("an 80-player fight", () => {
    it("allocates no new sprites after warm-up and stays cheap", () => {
        const players = Array.from({ length: 81 }, (_, i) =>
            player(i + 1, { x: 100 + (i % 9) * 3, y: 100 + Math.floor(i / 9) * 3 }),
        );
        const r = rig(players);
        let createdAfterWarmup = -1;
        let maxFlashes = 0;
        const frames = 600;
        const warmup = 60;
        const times = new Float64Array(frames);
        for (let f = 0; f < frames; f++) {
            const t0 = performance.now();
            // every other player is hit 10 times a second, the active player 5 times
            for (let i = 1; i < players.length; i++) {
                if ((f + i) % 6 === 0)
                    r.fx.onPlayerHit(players[i], players[i].pos, { x: 1, y: 0 }, 13.5, 1 + ((i + 1) % 80));
            }
            if (f % 12 === 0) {
                r.fx.applySnapshot(snap(1, [taken(2, 13.5, { x: 1, y: 0 }), dealt(3 + (f % 70), 20)]));
            }
            r.fx.update({
                dt: 1 / 60,
                now: 0,
                activePos: players[0].pos,
                local: LOCAL,
                downed: false,
                cursor: { x: 700, y: 300 },
                aimDir: { x: 1, y: 0 },
                hudHidden: false,
                hudScale: 1,
            });
            times[f] = performance.now() - t0;
            r.particles.update(1 / 60);
            r.camera.applyShake();
            maxFlashes = Math.max(maxFlashes, r.fx.flashes.count);
            if (f === warmup) createdAfterWarmup = r.pool.created;
        }
        expect(r.pool.created).toBeLessThanOrEqual(createdAfterWarmup + 8);
        // at most one flash per player in view
        expect(maxFlashes).toBeLessThanOrEqual(players.length);
        expect(r.fx.markers.activeArcs).toBeLessThanOrEqual(4);
        // extra blood is held to the bucket: 48 + 160 / s over 10 s
        expect(r.fx.stats.extraBlood).toBeLessThanOrEqual(48 + 160 * (frames / 60) + 1);
        // the median frame after the JIT warm-up: a busy test machine (other workers, GC) only moves the tail
        const steady = Array.from(times.subarray(warmup)).sort((a, b) => a - b);
        const median = steady[Math.floor(steady.length / 2)];
        const mean = steady.reduce((a, b) => a + b, 0) / steady.length;
        console.log(
            `hit feedback, 80 players: median ${median.toFixed(3)} ms, mean ${mean.toFixed(3)} ms per frame, ${r.pool.created} sprites`,
        );
        expect(median).toBeLessThan(0.5);
    });
});
