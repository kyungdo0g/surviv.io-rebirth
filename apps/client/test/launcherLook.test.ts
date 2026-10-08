// The launchers' look beyond the held sprite (owner, 2026-10-08): the RPG-7 is drawn without its warhead while its
// round is fired and not yet reloaded (objects/gunLoad.ts: the followed player's loaded rounds, else the shots and
// reloads seen in the snapshots), and the launcher rounds fly with their own sprite (defs rebirth/launcherRoundArt.ts;
// fx/bullets.ts over the rockets' and the GL-06's tracers), turned along the flight.
import { GameObjectDefs, type GunDef } from "@rebirth/defs";
import type { BulletEvent, PlayerAction } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { AudioEngine } from "../src/audio/audio.ts";
import { type BulletScene, BulletSystem } from "../src/fx/bullets.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { GunLoad, RELOAD_END_SLACK } from "../src/objects/gunLoad.ts";
import { SpritePool } from "../src/render/pool.ts";
import type { Renderer } from "../src/render/renderer.ts";

const reload = (item: string, seq: number): PlayerAction => ({
    type: "reload",
    seq,
    item,
    duration: (GameObjectDefs[item] as GunDef).reloadTime,
});
const none = (seq: number): PlayerAction => ({ type: "none", seq, item: "", duration: 0 });

describe("the RPG-7's empty look (objects/gunLoad.ts)", () => {
    it("another player's RPG-7: empty from its shot until a reload runs its full time", () => {
        const load = new GunLoad();
        const time = (GameObjectDefs.rpg7 as GunDef).reloadTime;
        expect(load.empty("rpg7")).toBe(false);
        load.shots("rpg7", 1);
        expect(load.empty("rpg7")).toBe(true);
        // a reload cut short (a switch) leaves it empty
        load.action(reload("rpg7", 1));
        load.tick(time * 0.5);
        load.action(none(2));
        expect(load.empty("rpg7")).toBe(true);
        // seen ending a snapshot early still counts as finished
        load.action(reload("rpg7", 3));
        expect(load.empty("rpg7")).toBe(true);
        load.tick(time - RELOAD_END_SLACK * 0.5);
        load.action(none(4));
        expect(load.empty("rpg7")).toBe(false);
        load.shots("rpg7", 1);
        expect(load.empty("rpg7")).toBe(true);
    });

    it("the followed player's loaded rounds decide when known; guns without an empty look never are", () => {
        const load = new GunLoad();
        expect(load.empty("rpg7", 0)).toBe(true);
        expect(load.empty("rpg7", 1)).toBe(false);
        load.shots("rpg7", 1);
        expect(load.empty("rpg7", 1)).toBe(false);
        for (const gun of ["m79", "panzerfaust", "m202", "ak47", ""]) {
            load.shots(gun, 5);
            expect(load.empty(gun), gun).toBe(false);
            expect(load.empty(gun, 0), gun).toBe(false);
        }
    });

    it("a player coming into view mid-reload is empty until that reload ends", () => {
        const load = new GunLoad();
        load.action(reload("rpg7", 7), true);
        expect(load.empty("rpg7")).toBe(true);
        load.tick(0.2);
        load.action(none(8));
        expect(load.empty("rpg7")).toBe(false);
    });
});

function bullet(id: number, bulletType: string, dir: { x: number; y: number }): BulletEvent {
    return {
        id,
        shooterId: 1,
        bulletType,
        sourceType: bulletType.replace(/^bullet_/, ""),
        pos: { x: 100, y: 100 },
        dir,
        layer: 0,
        maxDist: 40,
        reflectCount: 0,
        hitPlayer: false,
        shotFx: false,
        offHand: false,
    };
}

const emptyScene: BulletScene = {
    localId: 999,
    activeLayer: 0,
    cameraPos: { x: 0, y: 0 },
    activeAlive: false,
    forEachObstacle: () => {},
    forEachPlayer: () => {},
    playerById: () => undefined,
    playerOld: () => undefined,
    playerContainer: () => null,
    segmentOnStairs: () => false,
    brightSurfaceAt: () => false,
};

describe("launcher rounds in flight (fx/bullets.ts)", () => {
    it("each rocket and the GL-06's grenade fly with their own sprite, nose along the flight, gone when they stop", () => {
        const applied: string[] = [];
        const textures = { apply: (_s: unknown, id: string) => applied.push(id) } as unknown as TextureStore;
        const renderer = { pool: new SpritePool(), add: () => {}, overgroundLayer: () => 0 } as unknown as Renderer;
        const audio = { playGroup: () => null, playSound: () => null } as unknown as AudioEngine;
        const bullets = new BulletSystem(renderer, textures, audio, new ParticleSystem(renderer, textures));
        const up = { x: 0, y: 1 };
        const right = { x: 1, y: 0 };
        bullets.addEvents(
            [
                bullet(1, "bullet_rpg7", right),
                bullet(2, "bullet_panzerfaust", up),
                bullet(3, "bullet_m202", right),
                bullet(4, "bullet_gl06", right),
                bullet(5, "bullet_ak47", right),
            ],
            emptyScene,
        );
        expect(applied.filter((id) => id.startsWith("proj-"))).toEqual([
            "proj-rpg7-01.img",
            "proj-panzerfaust-01.img",
            "proj-m202-01.img",
            "proj-40mm-01.img",
        ]);
        const heads = bullets.roundHeads;
        expect(heads.map((h) => h.bulletType)).toEqual([
            "bullet_rpg7",
            "bullet_panzerfaust",
            "bullet_m202",
            "bullet_gl06",
        ]);
        // the sprites point up: flying +x is a quarter turn clockwise, flying +y (up the screen) none
        expect(heads[0]!.rotation).toBeCloseTo(Math.PI / 2, 6);
        expect(heads[1]!.rotation).toBeCloseTo(0, 6);
        expect(heads.map((h) => h.scale)).toEqual([0.6, 0.6, 0.5, 0.45]);
        // they fly until their end (the shortest, the GL-06's 45 u/s grenade, needs under 1 s for 40 u), then go
        bullets.update(0.2, emptyScene);
        expect(bullets.roundHeads).toHaveLength(4);
        for (let i = 0; i < 20; i++) bullets.update(0.1, emptyScene);
        expect(bullets.roundHeads).toEqual([]);
    });
});
