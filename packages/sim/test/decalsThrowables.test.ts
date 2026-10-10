// The owner's 2026-10-10 additions (defs rebirth/throwables.ts, rebirth/discardDecals.ts): a single-use launcher fired
// empty leaves its body on the ground as a timed decal turned to the shooter's facing; the Molotov bursts on contact
// into a fire that burns whoever stands in it (through armour, not through walls); the flashbang blinds and deafens by
// distance and line of sight.
import { type Vec2, v2 } from "@rebirth/core";
import {
    DamageType,
    DISCARD_DECAL_LIFETIME,
    FIRE_DECAL_TYPE,
    FLASHBANG_FLASH,
    getDefOfType,
    MOLOTOV_FIRE,
    WeaponSlot,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { flashStrength } from "../src/combat/flash.ts";
import type { DecalView, Game, Player } from "../src/index.ts";
import { constantRng, DT, flatGame, giveGun, send, spawnAt, steps } from "./combatHelpers.ts";
import { clearSpot, cookAndThrow, fxGame, holdThrowable, untilExplosions } from "./fxHelpers.ts";

const SRC = (sourceId: number, gameSourceType = "") => ({ damageType: DamageType.Player, sourceId, gameSourceType });
const WALL = "warehouse_wall_side";

function addPlayer(game: Game, pos: Vec2): Player {
    const t = game.getPlayer(game.addPlayer("target"))!;
    game.teleportPlayer(t.id, pos);
    return t;
}

function decalsOf(game: Game, type: string) {
    return [...game.world.objects.values()].filter((o) => o.kind === "decal" && o.type === type);
}

describe("discarded launchers", () => {
    it.each(["nlaw", "bazooka", "pvg42", "m202", "panzerfaust"])(
        "%s fired empty drops its body at the feet, turned to the facing, for its lifetime",
        (gun) => {
            const game = flatGame();
            game.combatRng = constantRng();
            const origin = clearSpot(80);
            const dir = v2.normalize({ x: 1, y: 1 });
            const p = spawnAt(game, origin, dir);
            const def = giveGun(p, gun);
            const decal = `decal_${gun}_discard`;
            for (let i = 0; i < Math.ceil((def.maxClip * def.fireDelay + 1) / DT) + 40; i++) {
                send(game, p, { shootStart: true, shootHold: true, toMouseLen: 70, toMouseDir: dir });
                game.step();
            }
            expect(p.weaponManager.weapons[WeaponSlot.Primary].type).toBe("");
            const dropped = decalsOf(game, decal);
            expect(dropped).toHaveLength(1);
            const d = dropped[0] as unknown as { pos: Vec2; rot: number; layer: number };
            // where the shooter stood when it ran dry (the M202's recoil slides him back a little after that)
            expect(v2.distance(d.pos, p.pos)).toBeLessThan(0.5);
            // the sprite's up axis (its muzzle) points where the player looked: rot + 90 degrees is the facing angle
            expect(d.rot + Math.PI / 2).toBeCloseTo(Math.atan2(dir.y, dir.x), 6);
            // every player in view is sent it, rotation included
            const view = game.getSnapshot(p.id).objects.find((o) => o.type === decal) as DecalView;
            expect(view.kind).toBe("decal");
            expect(view.rot).toBeCloseTo(d.rot, 9);
            // nothing collides with it: a second player walks over it
            steps(game, Math.round(DISCARD_DECAL_LIFETIME / DT) + 2);
            expect(decalsOf(game, decal)).toHaveLength(0);
        },
    );

    it("rifles that run dry (Boys, Maadi) and reloadable launchers leave nothing", () => {
        for (const gun of ["boys", "maadi"]) {
            const game = flatGame();
            game.combatRng = constantRng();
            const p = spawnAt(game, clearSpot(80));
            const def = giveGun(p, gun);
            for (let i = 0; i < Math.ceil((def.maxClip * def.fireDelay + 2) / DT); i++) {
                send(game, p, { shootStart: true, shootHold: true, toMouseLen: 70 });
                game.step();
            }
            expect(p.weaponManager.weapons[WeaponSlot.Primary].type, gun).toBe("");
            expect(game.decals.count, gun).toBe(0);
        }
    });
});

describe("Molotov", () => {
    it("has no fuse: thrown, it bursts where it lands and lights a fire there", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        holdThrowable(p, "molotov", 1);
        cookAndThrow(game, p, 2, 6);
        const tick = untilExplosions(game, 1, 300);
        expect(tick).not.toBeNull();
        // it falls in about a second, far before its 5 s safety fuse
        expect(tick! * DT).toBeLessThan(1.5);
        expect(game.fires.fires).toHaveLength(1);
        const fire = game.fires.fires[0];
        expect(fire.pos.x).toBeGreaterThan(origin.x + 2);
        expect(decalsOf(game, FIRE_DECAL_TYPE)).toHaveLength(1);
        expect(game.explosions.reports.at(-1)?.type).toBe("explosion_molotov");
    });

    it("bursts on the first player it touches", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const t = addPlayer(game, v2.add(origin, { x: 3, y: 0 }));
        holdThrowable(p, "molotov", 1);
        cookAndThrow(game, p, 2, 18);
        untilExplosions(game, 1, 300);
        expect(game.fires.fires).toHaveLength(1);
        expect(v2.distance(game.fires.fires[0].pos, t.pos)).toBeLessThan(2);
    });

    it("burns players in it through their armour, credited to the thrower, then goes out", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        game.teleportPlayer(p.id, v2.add(origin, { x: -30, y: 0 }));
        const t = addPlayer(game, v2.add(origin, { x: 1, y: 0 }));
        t.helmet = "helmet03";
        t.chest = "chest03";
        game.explosions.add("explosion_molotov", origin, 0, SRC(p.id, "molotov"));
        game.step();
        // the first tick bites at once, at full damage
        expect(100 - t.health).toBeCloseTo(MOLOTOV_FIRE.damage, 9);
        expect(t.lastHit?.gameSourceType).toBe("molotov");
        expect(t.lastDamagedBy).toBe(p.id);
        steps(game, Math.round(1 / DT));
        // 8 HP a second
        const perSecond = MOLOTOV_FIRE.damage / MOLOTOV_FIRE.tickInterval;
        expect(100 - t.health).toBeCloseTo(MOLOTOV_FIRE.damage + perSecond, 6);
        // walking out, it keeps burning for afterburn seconds, then stops
        game.teleportPlayer(t.id, v2.add(origin, { x: 0, y: 20 }));
        const left = t.health;
        steps(game, Math.round((MOLOTOV_FIRE.afterburn + 0.5) / DT));
        const after = left - t.health;
        expect(after).toBeGreaterThan(perSecond * MOLOTOV_FIRE.afterburn - MOLOTOV_FIRE.damage - 1e-6);
        expect(after).toBeLessThanOrEqual(perSecond * MOLOTOV_FIRE.afterburn + MOLOTOV_FIRE.damage + 1e-6);
        expect(game.fires.burning(t.id)).toBe(0);
        const settled = t.health;
        steps(game, 50);
        expect(t.health).toBe(settled);
        // the ground stops burning after `duration` and its decal goes
        steps(game, Math.round(MOLOTOV_FIRE.duration / DT));
        expect(game.fires.fires).toHaveLength(0);
        expect(decalsOf(game, FIRE_DECAL_TYPE)).toHaveLength(0);
    });

    it("does not burn through a wall, nor anyone outside its radius", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin, [{ type: WALL, pos: { x: 2.5, y: 0 }, ori: 1 }]);
        game.teleportPlayer(p.id, v2.add(origin, { x: -30, y: 0 }));
        const behind = addPlayer(game, v2.add(origin, { x: 4, y: 0 }));
        const outside = addPlayer(game, v2.add(origin, { x: 0, y: MOLOTOV_FIRE.rad + 1.5 }));
        const inside = addPlayer(game, v2.add(origin, { x: -2, y: 0 }));
        game.explosions.add("explosion_molotov", origin, 0, SRC(p.id, "molotov"));
        steps(game, 200);
        expect(behind.health).toBe(100);
        expect(outside.health).toBe(100);
        expect(inside.health).toBeLessThan(100);
    });

    it("only splashes over water", () => {
        const game = flatGame();
        // the sea along the map's edge
        const water = { x: 2, y: game.mapData.height / 2 };
        expect(game.world.isOnWater(water, 0)).toBe(true);
        game.explosions.add("explosion_molotov", water, 0, SRC(0, "molotov"));
        game.step();
        expect(game.fires.fires).toHaveLength(0);
    });
});

describe("flashbang", () => {
    it("is cooked and thrown like a frag, with its own fuse", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        holdThrowable(p, "flashbang", 1);
        const start = cookAndThrow(game, p, 10, 10);
        const tick = untilExplosions(game, 1, 400);
        expect(Math.abs((tick! - start - 1) * DT - getDefOfType("throwable", "flashbang").fuseTime)).toBeLessThan(
            DT + 1e-9,
        );
        expect(game.explosions.reports.at(-1)?.type).toBe("explosion_flashbang");
    });

    it("falls off with distance: full within fullRad, nothing past rad", () => {
        const at = (d: number, sight = true) => flashStrength(FLASHBANG_FLASH, { x: 0, y: 0 }, { x: d, y: 0 }, sight);
        expect(at(3)).toEqual({ blind: 1, deaf: 1 });
        expect(at(FLASHBANG_FLASH.fullRad)).toEqual({ blind: 1, deaf: 1 });
        const mid = (FLASHBANG_FLASH.fullRad + FLASHBANG_FLASH.rad) / 2;
        expect(at(mid).blind).toBeCloseTo(0.5, 9);
        expect(at(FLASHBANG_FLASH.rad + 0.1)).toEqual({ blind: 0, deaf: 0 });
        expect(at(3, false)).toEqual({ blind: 0, deaf: FLASHBANG_FLASH.deafThroughWalls });
    });

    it("blinds the players who see it and only deafens those behind a wall; no damage", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin, [{ type: WALL, pos: { x: 3, y: 0 }, ori: 1 }]);
        game.teleportPlayer(p.id, v2.add(origin, { x: -4, y: 0 }));
        const behind = addPlayer(game, v2.add(origin, { x: 5, y: 0 }));
        const far = addPlayer(game, v2.add(origin, { x: 0, y: 14 }));
        const away = addPlayer(game, v2.add(origin, { x: 0, y: -30 }));
        game.explosions.add("explosion_flashbang", origin, 0, SRC(p.id, "flashbang"));
        game.step();
        const snap = (pl: Player) => game.getSnapshot(pl.id).flash;
        // the thrower, close and in sight: a full flash
        expect(snap(p)).toEqual({ blind: 1, deaf: 1 });
        // seconds left, one tick already worn off
        expect(game.flashes.state(p.id).blind).toBeCloseTo(FLASHBANG_FLASH.blindTime - DT, 9);
        expect(game.flashes.state(p.id).deaf).toBeCloseTo(FLASHBANG_FLASH.deafTime - DT, 9);
        // behind the wall: heard, not seen
        expect(snap(behind)).toEqual({ blind: 0, deaf: FLASHBANG_FLASH.deafThroughWalls });
        // 14 u away in the open: partly
        const f = snap(far)!;
        expect(f.blind).toBeGreaterThan(0.2);
        expect(f.blind).toBeLessThan(0.6);
        expect(snap(away)).toBeUndefined();
        for (const pl of [p, behind, far]) expect(pl.health).toBe(100);
        // reported once; the effect wears off over its seconds
        game.step();
        expect(game.getSnapshot(p.id).flash).toBeUndefined();
        steps(game, Math.round(FLASHBANG_FLASH.deafTime / DT));
        expect(game.flashes.state(p.id)).toEqual({ blind: 0, deaf: 0 });
    });
});
