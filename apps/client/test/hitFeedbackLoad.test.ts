// Load limits of the rebirth Enhanced hit effects (fx/hitFeedback.ts, fx/hitFeedbackMath.ts; user/2026-10-07-hit-feedback):
// players hit beyond the frame's 32 slots are dropped (never merged into another player's slot), at most 8 body flashes
// run with the viewer's own hits first, other players' extra blood shares a small budget and skips bodies too small on
// screen, and the confirm sounds never coalesce with (or take the instances of) the original impact sounds.
import type { LocalPlayerState, PlayerView, Snapshot } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { AudioEngine } from "../src/audio/audio.ts";
import { soundDef } from "../src/audio/soundDefs.ts";
import { HitFeedback, type HitFeedbackFrame, type HitWorld } from "../src/fx/hitFeedback.ts";
import {
    CONFIRM_SOUNDS,
    confirmSound,
    extraBloodCount,
    flashParams,
    hitIntensity,
    MAX_FLASHES,
    MarkerVariant,
    MIN_BLOOD_RADIUS_PX,
    OTHER_BLOOD_BURST,
    OTHER_BLOOD_RATE,
    sharedBloodCount,
} from "../src/fx/hitFeedbackMath.ts";
import type { ParticleSystem } from "../src/fx/particles.ts";
import type { Camera } from "../src/render/camera.ts";
import { SpritePool } from "../src/render/pool.ts";

const ACTIVE = 1;
const STRANGER = 999;

interface Rig {
    fx: HitFeedback;
    players: Map<number, PlayerView>;
    containers: Map<number, Container>;
    /** extra blood splats started, by the player they started on */
    blood: Map<number, number>;
    camera: { z: number };
    frame(dt?: number): void;
    hit(targetId: number, nominal: number, shooterId?: number): void;
}

function rig(count: number): Rig {
    const players = new Map<number, PlayerView>();
    const containers = new Map<number, Container>();
    for (let id = 1; id <= count; id++) {
        // 10 units apart on a line, so a splat's start tells which body it bled from
        players.set(id, {
            kind: "player",
            id,
            pos: { x: id * 10, y: 0 },
            layer: 0,
            dead: false,
            scale: 1,
        } as unknown as PlayerView);
        containers.set(id, new Container());
    }
    const blood = new Map<number, number>();
    const camera = { z: 20 };
    const world: HitWorld = {
        get: (id) => players.get(id),
        playerContainer: (id) => containers.get(id) ?? null,
        visualPos: (id) => players.get(id)?.pos,
        teamOf: () => 0,
    };
    const fx = new HitFeedback({
        renderer: { pool: new SpritePool(), screen: new Container() },
        textures: { apply: () => {} } as unknown as TextureStore,
        audio: { preload: () => {}, playSound: () => null } as unknown as AudioEngine,
        particles: {
            add: (_type: string, _layer: number, pos: { x: number }) => {
                const id = Math.round(pos.x / 10);
                blood.set(id, (blood.get(id) ?? 0) + 1);
            },
        } as unknown as ParticleSystem,
        camera: {
            shakeEnabled: true,
            screenWidth: 1280,
            screenHeight: 720,
            z: () => camera.z,
            viewBounds: () => ({ min: { x: -1e6, y: -1e6 }, max: { x: 1e6, y: 1e6 } }),
            worldToScreen: (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
            addOffset: () => {},
        } as unknown as Camera,
        hudRoot: null,
    });
    fx.setWorld(world, ACTIVE);
    const local = { layer: 0, dead: false, health: 100 } as LocalPlayerState;
    const frame = (dt = 1 / 60): void => {
        const f: HitFeedbackFrame = {
            dt,
            now: 0,
            activePos: { x: 10, y: 0 },
            local,
            downed: false,
            cursor: null,
            aimDir: { x: 1, y: 0 },
            hudHidden: false,
            hudScale: 1,
        };
        fx.update(f);
    };
    const hit = (targetId: number, nominal: number, shooterId = STRANGER): void => {
        const target = players.get(targetId);
        if (!target) throw new Error(`no player ${targetId}`);
        fx.onPlayerHit(target, target.pos, { x: 1, y: 0 }, nominal, shooterId);
    };
    return { fx, players, containers, blood, camera, frame, hit };
}

/** Alpha of the flash sprite on `id`'s body (0 when it does not flash). */
function flashAlphaOf(r: Rig, id: number): number {
    const sprite = r.containers.get(id)?.children[0] as Sprite | undefined;
    return sprite?.visible ? sprite.alpha : 0;
}

describe("Enhanced hit effects under load", () => {
    it("drops the players hit beyond the frame's 32 slots instead of merging them into another player", () => {
        const r = rig(42);
        // players 2-32 hit by a stranger (light), 33 by the active player (light, so its flash is certain), 34-41 by
        // a stranger and 42 by the active player (Barrett-heavy): the old code piled 34-42 onto the 32nd slot (33)
        for (let id = 2; id <= 32; id++) r.hit(id, 9);
        r.hit(33, 9, ACTIVE);
        for (let id = 34; id <= 41; id++) r.hit(id, 99);
        r.hit(42, 99, ACTIVE);
        expect(r.fx.stats.dropped).toBe(9);
        // the server confirms the active player's dropped hit on 42 as a headshot
        r.fx.applySnapshot({
            localPlayerId: ACTIVE,
            hits: [{ targetId: 42, sourceId: ACTIVE, amount: 99, damageType: 0, headshot: true, armored: false }],
            kills: [],
        } as unknown as Snapshot);
        r.frame(0);
        // player 33 shows exactly its own 9-damage hit: the light flash and two splats
        expect(flashAlphaOf(r, 33)).toBeCloseTo(flashParams(hitIntensity(9)).alpha, 5);
        expect(r.blood.get(33)).toBe(extraBloodCount(hitIntensity(9)));
        // and the dropped players show nothing extra, but for the two splats of the confirmed headshot on 42 (its own)
        for (let id = 34; id <= 42; id++) {
            expect(flashAlphaOf(r, id)).toBe(0);
            expect(r.blood.get(id) ?? 0).toBe(id === 42 ? 2 : 0);
        }
        // the dropped hit was seen, so its server confirmation does not bring it back as a server-only hit later
        for (let i = 0; i < 20; i++) r.frame(1 / 60);
        expect(r.fx.stats.serverOnly).toBe(0);
        expect(flashAlphaOf(r, 42)).toBe(0);
    });

    it("runs at most 8 body flashes; the active player's hits take the place of other players' flashes", () => {
        const r = rig(30);
        for (let id = 2; id <= 25; id++) r.hit(id, 13.5);
        r.frame();
        expect(r.fx.flashes.count).toBe(MAX_FLASHES);
        expect(r.fx.flashes.skipped).toBe(24 - MAX_FLASHES);
        // the active player's hits still flash, replacing other flashes, while strangers' hits wait
        r.hit(28, 13.5, ACTIVE);
        r.hit(ACTIVE, 13.5, 29);
        r.hit(26, 13.5);
        r.frame();
        expect(r.fx.flashes.count).toBe(MAX_FLASHES);
        expect(flashAlphaOf(r, 28)).toBeGreaterThan(0);
        expect(flashAlphaOf(r, ACTIVE)).toBeGreaterThan(0);
        expect(flashAlphaOf(r, 26)).toBe(0);
    });

    it("keeps an 80-player fight's extra sprites bounded, with the active player's own hits served in full", () => {
        const r = rig(90);
        r.frame();
        const start = r.fx.stats.extraBlood;
        let maxFlashes = 0;
        let ownMissing = 0;
        // 10 s at 3 fps: 24 of 78 strangers hit per frame, and the active player lands one AK-47 bullet every frame on
        // one of 10 others
        const frames = 30;
        for (let i = 0; i < frames; i++) {
            for (let k = 0; k < 24; k++) r.hit(2 + ((i * 7 + k * 3) % 78), 13.5 * 3);
            const mine = 80 + (i % 10);
            const before = r.blood.get(mine) ?? 0;
            r.hit(mine, 13.5, ACTIVE);
            r.frame(1 / 3);
            maxFlashes = Math.max(maxFlashes, r.fx.flashes.count);
            if (flashAlphaOf(r, mine) === 0) ownMissing++;
            // the own hit's two splats
            if ((r.blood.get(mine) ?? 0) - before !== extraBloodCount(hitIntensity(13.5))) ownMissing++;
        }
        expect(maxFlashes).toBeLessThanOrEqual(MAX_FLASHES);
        expect(ownMissing).toBe(0);
        const others = r.fx.stats.extraBlood - start - frames * extraBloodCount(hitIntensity(13.5));
        // strangers' blood stays within its budget: 32 per second plus the first burst
        expect(others).toBeLessThanOrEqual(OTHER_BLOOD_RATE * frames * (1 / 3) + OTHER_BLOOD_BURST);
        expect(others).toBeGreaterThan(0);
    });

    it("gives other players' hits no extra blood on bodies too small on screen; own hits still bleed", () => {
        const r = rig(4);
        r.camera.z = MIN_BLOOD_RADIUS_PX - 1;
        r.hit(2, 50);
        r.hit(3, 50, ACTIVE);
        r.frame();
        expect(r.blood.get(2) ?? 0).toBe(0);
        expect(r.blood.get(3)).toBe(extraBloodCount(hitIntensity(50)));
        // the flash still shows on both
        expect(flashAlphaOf(r, 2)).toBeGreaterThan(0);
        r.camera.z = MIN_BLOOD_RADIUS_PX;
        r.hit(4, 50);
        r.frame();
        expect(r.blood.get(4)).toBe(extraBloodCount(hitIntensity(50)));
    });

    it("shares other players' extra blood when more than 4 are hit in a frame", () => {
        const k = hitIntensity(99);
        expect(sharedBloodCount(k, 1)).toBe(extraBloodCount(k));
        expect(sharedBloodCount(k, 4)).toBe(extraBloodCount(k));
        expect(sharedBloodCount(k, 8)).toBe(Math.round(extraBloodCount(k) / 2));
        expect(sharedBloodCount(hitIntensity(9), 24)).toBe(1);
    });
});

describe("confirm sounds", () => {
    it("never coalesce with, or take the instances of, the original impact sounds", () => {
        const variants = Object.values(MarkerVariant);
        const names = new Set(variants.map((v) => confirmSound(v, 0.5).name));
        expect([...names].sort()).toEqual([...CONFIRM_SOUNDS].sort());
        for (const name of names) {
            const def = soundDef(name, "hits");
            expect(def, name).toBeDefined();
            expect(def?.canCoalesce ?? false, name).toBe(false);
            expect(def?.maxInstances, name).toBeUndefined();
        }
    });
});
