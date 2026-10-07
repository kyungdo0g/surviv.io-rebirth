// Throwables (M5): cooking, the 4 s frag fuse and the in-hand cook-off, throw speed from the mouse distance, 2.5D
// flight with bounces, dropping at the feet, inventory and slot cycling, smoke, MIRV splits, strobe air strikes,
// snowball impacts and the potato guns' projectiles.
import { createRng, v2 } from "@rebirth/core";
import { DamageType, GameConfig, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyInput, Game } from "../src/index.ts";
import { giveGun, send, steps } from "./combatHelpers.ts";
import { clearSpot, cookAndThrow, fxGame, holdThrowable, logExplosions, untilExplosions } from "./fxHelpers.ts";

const HAND = { x: 0.5, y: -1 };

describe("frag grenades", () => {
    it("explode exactly 4 s after the pin is pulled, thrown or held (conflicts.md frag-fuse-time)", () => {
        const origin = clearSpot();
        for (const cookTicks of [10, 100, 250]) {
            const { game, p } = fxGame(origin);
            holdThrowable(p, "frag", 2);
            const start = cookAndThrow(game, p, cookTicks);
            expect(game.projectiles.projectiles).toHaveLength(1);
            expect(p.inv.get("frag")).toBe(1);
            expect(untilExplosions(game)! - start).toBe(400);
            // thrown far enough: the thrower is unhurt
            expect(p.health).toBe(100);
        }
    });

    it("explode in the hand when cooked past the fuse, killing an unarmoured thrower", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        holdThrowable(p, "frag", 3);
        const log = logExplosions(game);
        const start = game.tick;
        send(game, p, { shootStart: true, shootHold: true, toMouseLen: 18 });
        game.step();
        send(game, p, { shootHold: true, toMouseLen: 18 });
        expect(p.animType).toBe("cook");
        const tick = untilExplosions(game);
        expect(tick! - start).toBe(400);
        expect(log).toHaveLength(1);
        expect(v2.distance(log[0].pos, p.pos)).toBeLessThan(2);
        expect(p.dead).toBe(true);
        const kill = game.match.kills.since(0).at(-1)!;
        expect(kill).toMatchObject({ targetId: p.id, killCreditId: p.id, source: "explosion", itemSourceType: "frag" });
    });

    it("throw speed scales with the mouse distance up to throwableMaxMouseDist", () => {
        const origin = clearSpot();
        const dist = (item: string, mouseLen: number) => {
            const { game, p } = fxGame(origin);
            holdThrowable(p, item, 1);
            const log = logExplosions(game);
            cookAndThrow(game, p, 10, mouseLen);
            untilExplosions(game, 1, 1200);
            return log[0].pos.x - (origin.x + HAND.x);
        };
        const max = GameConfig.player.throwableMaxMouseDist;
        const d = [max / 4, max / 2, max, max * 2].map((m) => dist("frag", m));
        expect(d[0]).toBeGreaterThan(1);
        expect(d[1] / d[0]).toBeCloseTo(2, 6);
        expect(d[2] / d[0]).toBeCloseTo(4, 6);
        expect(d[3]).toBeCloseTo(d[2], 9);
        // snowballs always fly at full speed (forceMaxThrowDistance)
        expect(dist("snowball", 2)).toBeCloseTo(dist("snowball", max), 9);
    });

    it("bounce off a wall", () => {
        const origin = clearSpot();
        // a 50 u long wall standing 8 u ahead, across the throw
        const { game, p } = fxGame(origin, [{ type: "warehouse_wall_side", pos: { x: 8.6, y: 0 }, ori: 1 }]);
        const wallX = origin.x + 8;
        holdThrowable(p, "frag", 1);
        cookAndThrow(game, p, 10);
        const proj = game.projectiles.projectiles[0];
        let bounced = false;
        let maxX = -Infinity;
        for (let i = 0; i < 380 && !proj.dead; i++) {
            game.step();
            maxX = Math.max(maxX, proj.pos.x);
            if (proj.vel.x < 0) bounced = true;
        }
        expect(bounced).toBe(true);
        expect(maxX).toBeLessThan(wallX);
        expect(proj.pos.x).toBeLessThan(wallX);
    });

    it("switching away while cooking drops the grenade at the feet; its fuse keeps running", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        holdThrowable(p, "frag", 2);
        const start = game.tick;
        send(game, p, { shootStart: true, shootHold: true, toMouseLen: 18 });
        steps(game, 50);
        send(game, p, { shootHold: true, toMouseLen: 18, actions: [Input.EquipMelee] });
        game.step();
        expect(p.curWeapIdx).toBe(WeaponSlot.Melee);
        const proj = game.projectiles.projectiles[0];
        expect(v2.length(proj.vel)).toBe(0);
        expect(v2.distance(proj.pos, v2.add(origin, HAND))).toBeLessThan(1e-9);
        expect(untilExplosions(game)! - start).toBe(400);
    });

    it("use up the inventory and cycle the slot to the next type, then back to the last weapon", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        giveGun(p, "mp5");
        holdThrowable(p, "frag", 2);
        p.inv.set("smoke", 1);
        const wm = p.weaponManager;
        const throwOne = () => {
            cookAndThrow(game, p, 10);
            steps(game, 40);
        };
        throwOne();
        expect([p.inv.get("frag"), wm.weapons[WeaponSlot.Throwable].type]).toEqual([1, "frag"]);
        throwOne();
        expect([p.inv.get("frag"), wm.weapons[WeaponSlot.Throwable].type, p.curWeapIdx]).toEqual([
            0,
            "smoke",
            WeaponSlot.Throwable,
        ]);
        throwOne();
        expect(wm.weapons[WeaponSlot.Throwable].type).toBe("");
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        expect(game.projectiles.projectiles.length + game.explosions.count).toBe(3);
        // Equip Frag / Smoke select a type
        p.inv.set("frag", 1);
        p.inv.set("smoke", 1);
        send(game, p, { actions: [Input.EquipSmokeGrenade] });
        game.step();
        expect([p.curWeapIdx, p.activeWeapon]).toEqual([WeaponSlot.Throwable, "smoke"]);
        send(game, p, { actions: [Input.EquipFragGrenade] });
        game.step();
        expect(p.activeWeapon).toBe("frag");
    });

    it("cooking cancels a heal and heals are refused while cooking", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        holdThrowable(p, "frag", 1);
        p.health = 50;
        p.inv.set("bandage", 2);
        send(game, p, { useItem: "bandage" });
        game.step();
        expect(p.action.type).toBe("use");
        send(game, p, { shootStart: true, shootHold: true });
        game.step();
        expect([p.action.type, p.animType]).toEqual(["none", "cook"]);
        send(game, p, { shootHold: true, useItem: "bandage" });
        game.step();
        expect(p.action.type).toBe("none");
    });
});

describe("other throwables", () => {
    it("smoke grenades are not cookable: held for 5 s nothing happens, the smoke starts 2.5 s after the throw", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        holdThrowable(p, "smoke", 1);
        const log = logExplosions(game);
        cookAndThrow(game, p, 500);
        expect(log).toHaveLength(0);
        // the fuse starts in the tick of the throw
        const beforeThrow = game.tick - 1;
        expect(untilExplosions(game)! - beforeThrow).toBe(250);
        expect(log[0].type).toBe("explosion_smoke");
        // 3 clouds at once plus the emitter's first regular cloud, then one every 1.75 s up to 8
        expect(game.smokes.smokes.length).toBe(4);
        steps(game, 175);
        expect(game.smokes.smokes.length).toBe(5);
        steps(game, 175 * 8);
        expect(game.smokes.smokes.length).toBe(11);
    });

    it("a MIRV splits into 6 mini grenades that explode 1.8-2.1 s later", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        game.fxRng = createRng(7);
        holdThrowable(p, "mirv", 1);
        const log = logExplosions(game);
        const start = cookAndThrow(game, p, 10);
        untilExplosions(game);
        expect(log.map((e) => e.type)).toEqual(["explosion_mirv"]);
        expect(game.tick - start).toBe(400);
        const minis = game.projectiles.projectiles.filter((pr) => pr.type === "mirv_mini");
        expect(minis).toHaveLength(6);
        expect(minis.every((m) => m.fuse >= 1.8 - 1e-9 && m.fuse <= 2.1 + 1e-9)).toBe(true);
        steps(game, 220);
        expect(log.filter((e) => e.type === "explosion_mirv_mini")).toHaveLength(6);
        expect(log.every((e) => e.sourceId === p.id)).toBe(true);
    });

    it("a strobe calls an air strike: ping 3 s after the throw, then 3 planes (5 with Broken Arrow) beside its line", () => {
        const origin = clearSpot(200);
        for (const brokenArrow of [false, true]) {
            const { game, p } = fxGame(origin);
            if (brokenArrow) p.perks.push("broken_arrow");
            holdThrowable(p, "strobe", 1);
            const log = logExplosions(game);
            cookAndThrow(game, p, 10, 4);
            const thrown = game.tick - 1;
            const strobe = game.projectiles.projectiles[0];
            let pingTick = 0;
            const planeTicks: number[] = [];
            const targets: { x: number; y: number }[] = [];
            const seenPlanes = new Set<number>();
            for (let i = 0; i < 1200; i++) {
                game.step();
                if (!pingTick && game.planes.indicators.some((m) => m.type === "ping_airstrike")) pingTick = game.tick;
                for (const plane of game.planes.planes) {
                    if (!seenPlanes.has(plane.id)) {
                        seenPlanes.add(plane.id);
                        planeTicks.push(game.tick);
                        targets.push(v2.sub(plane.target, strobe.pos));
                    }
                }
            }
            // strikeDelay 3 s (survev, the baseline; conflicts.md strobe-strike-delay), first plane 1 s later, all
            // within 3 s
            expect((pingTick - thrown) * 0.01).toBeCloseTo(3, 6);
            const n = brokenArrow ? 5 : 3;
            expect(planeTicks).toHaveLength(n);
            expect((planeTicks[0] - pingTick) * 0.01).toBeCloseTo(1, 6);
            expect(((planeTicks[1] - planeTicks[0]) * 0.01) / (3 / n)).toBeCloseTo(1, 1);
            // survev's pattern (conflicts.md strobe-airstrike-offset): the first line starts at the strobe, the next
            // ones 5 and 10 u beside it on alternating sides, all along the throw direction (+x)
            // (relative to where the strobe lies a tick later: it still creeps forward a little)
            const expected = [0, -5, 5, -10, 10].slice(0, n);
            expect(targets.map((t) => Math.round(t.y * 1e3) / 1e3 + 0)).toEqual(expected);
            for (const t of targets) expect(Math.abs(t.x)).toBeLessThan(1e-3);
            const bombs = log.filter((e) => e.type === "explosion_bomb_iron");
            expect(bombs.length).toBe(n * GameConfig.airstrike.bombCount);
            for (const b of bombs) {
                expect(Math.abs(b.pos.y - strobe.pos.y)).toBeLessThan(
                    (n === 5 ? 10 : 5) + GameConfig.airstrike.bombJitter + 1,
                );
            }
            expect(bombs.every((b) => b.damageType === DamageType.Airstrike && b.sourceId === p.id)).toBe(true);
            // the original strobe's bombs are credited as bomb_iron, as in v0.8.82
            expect(bombs.every((b) => b.gameSourceType === "bomb_iron")).toBe(true);
        }
    });

    it("snowballs hit players on impact", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const target = game.getPlayer(game.addPlayer("t"))!;
        game.teleportPlayer(target.id, { x: origin.x + 10, y: origin.y });
        holdThrowable(p, "snowball", 1);
        const log = logExplosions(game);
        cookAndThrow(game, p, 10);
        untilExplosions(game, 1, 200);
        expect(log[0].type).toBe("explosion_snowball");
        expect(100 - target.health).toBeCloseTo(2, 9);
    });
});

describe("projectile guns", () => {
    it("the potato cannon fires a cannonball that explodes on the first player it touches", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const target = game.getPlayer(game.addPlayer("t"))!;
        game.teleportPlayer(target.id, { x: origin.x + 15, y: origin.y });
        giveGun(p, "potato_cannon");
        const log = logExplosions(game);
        send(game, p, { shootStart: true, shootHold: true });
        game.step();
        send(game, p, {});
        expect(p.shotSeq).toBe(1);
        expect(game.projectiles.projectiles.map((pr) => pr.type)).toEqual(["potato_cannonball"]);
        untilExplosions(game, 1, 200);
        expect(log[0]).toMatchObject({ type: "explosion_potato_cannonball", sourceId: p.id });
        expect(100 - target.health).toBeCloseTo(95, 6);
        expect(target.lastHit?.gameSourceType).toBe("potato_cannonball");
    });

    it("the spud gun fires wedges at its full rate", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        giveGun(p, "potato_smg");
        const log = logExplosions(game);
        send(game, p, { shootHold: true });
        steps(game, 100);
        send(game, p, {});
        steps(game, 100);
        expect(p.shotSeq).toBeGreaterThanOrEqual(10);
        expect(log.filter((e) => e.type === "explosion_potato_smgshot").length).toBe(p.shotSeq);
    });
});

describe("determinism", () => {
    it("produces identical snapshots for identical inputs (grenades, MIRVs, smoke, strobes, heals)", () => {
        const run = () => {
            const game = new Game({ mapName: "main", seed: 31 });
            const a = game.getPlayer(game.addPlayer("a"))!;
            const b = game.getPlayer(game.addPlayer("b"))!;
            game.teleportPlayer(b.id, v2.add(a.pos, { x: 14, y: 2 }));
            a.backpack = "backpack03";
            for (const [item, n] of [
                ["frag", 3],
                ["mirv", 1],
                ["smoke", 1],
                ["strobe", 1],
            ] as const)
                a.inv.set(item, n);
            a.weaponManager.setCurWeapIndex(WeaponSlot.Throwable);
            b.inv.set("soda", 2);
            b.health = 50;
            const snaps = [];
            for (let i = 0; i < 1500; i++) {
                const toB = v2.normalize(v2.sub(b.pos, a.pos));
                game.setInput(a.id, {
                    ...emptyInput(i),
                    toMouseDir: toB,
                    toMouseLen: 6 + (i % 13),
                    shootStart: i % 90 === 0,
                    shootHold: i % 90 < 30,
                    moveUp: i % 200 < 50,
                    actions: i % 300 === 150 ? [Input.EquipThrowable] : [],
                });
                game.setInput(b.id, {
                    ...emptyInput(i),
                    toMouseDir: v2.neg(toB),
                    useItem: i % 400 === 10 ? "soda" : "",
                });
                game.step();
                if (i % 3 === 0) snaps.push(game.getSnapshot(a.id), game.getSnapshot(b.id));
            }
            return snaps;
        };
        const first = run();
        expect(first.some((s) => (s.explosions?.length ?? 0) > 0)).toBe(true);
        expect(first.some((s) => (s.projectiles?.length ?? 0) > 0)).toBe(true);
        expect(first.some((s) => (s.smokes?.length ?? 0) > 0)).toBe(true);
        expect(run()).toEqual(first);
    }, 30_000);
});
