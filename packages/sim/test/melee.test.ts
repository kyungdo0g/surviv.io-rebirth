import { v2 } from "@rebirth/core";
import type { MeleeDef } from "@rebirth/defs";
import { getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Obstacle, Player } from "../src/index.ts";
import {
    constantRng,
    DT,
    flatGame,
    giveGun,
    type ObstacleSpec,
    openSpot,
    send,
    spawnAt,
    steps,
} from "./combatHelpers.ts";

const CLICK = { shootHold: true, shootStart: true };

function arena(melee: string, obstacles: Array<Omit<ObstacleSpec, "pos"> & { at: { x: number; y: number } }> = []) {
    const probe = flatGame();
    const origin = openSpot(probe, 20);
    const game = flatGame(obstacles.map(({ at, ...o }) => ({ ...o, pos: v2.add(origin, at) })));
    game.combatRng = constantRng();
    const p = spawnAt(game, origin);
    p.weaponManager.setWeapon(WeaponSlot.Melee, melee, 0);
    p.weaponManager.weapons[WeaponSlot.Melee].cooldown = 0;
    const def = getDefOfType("melee", melee);
    return { game, p, def };
}

/** A target standing `dx, dy` from the attacker. */
function target(game: ReturnType<typeof flatGame>, p: Player, dx: number, dy = 0): Player {
    return spawnAt(game, v2.add(p.pos, { x: dx, y: dy }), { x: -1, y: 0 });
}

/** Ticks (after the input) at which `t` took damage while `input` is sent for `ticks` ticks. */
function hitTicks(game: ReturnType<typeof flatGame>, p: Player, t: Player, ticks: number, input = CLICK): number[] {
    const out: number[] = [];
    const start = game.tick;
    for (let i = 0; i < ticks; i++) {
        const hp = t.health;
        send(game, p, input);
        game.step();
        if (t.health !== hp) out.push(game.tick - start);
    }
    send(game, p, {});
    return out;
}

describe("melee", () => {
    it("hits a target in front at the damage time with the weapon's damage", () => {
        const { game, p, def } = arena("fists");
        const t = target(game, p, def.attack.offset.x + 0.5);
        const hits = hitTicks(game, p, t, 1);
        expect(hits).toEqual([]);
        steps(game, 30);
        expect(100 - t.health).toBe(def.damage);
    });

    it("lands the hit exactly damageTimes after the swing starts and swings every cooldownTime", () => {
        const { game, p, def } = arena("fists");
        const t = target(game, p, def.attack.offset.x + 0.5);
        t.helmet = "helmet03";
        t.chest = "chest03";
        const hits = hitTicks(game, p, t, 200);
        // swing starts on the first tick, the hit lands damageTimes later
        expect(hits[0] * DT).toBeCloseTo(DT + def.attack.damageTimes[0], 9);
        for (let i = 1; i < hits.length; i++)
            expect((hits[i] - hits[i - 1]) * DT).toBeCloseTo(def.attack.cooldownTime, 9);
        expect(hits.length).toBe(Math.floor((200 * DT - DT - def.attack.damageTimes[0]) / def.attack.cooldownTime) + 1);
    });

    it("misses targets outside the attack circle and behind the attacker", () => {
        const { game, p, def } = arena("fists");
        const far = target(game, p, def.attack.offset.x + def.attack.rad + 1 + 0.05);
        const behind = target(game, p, -2);
        const side = target(game, p, 0, 3);
        hitTicks(game, p, far, 40);
        expect(far.health).toBe(100);
        expect(behind.health).toBe(100);
        expect(side.health).toBe(100);
        // facing it hits
        p.dir = { x: 0, y: 1 };
        hitTicks(game, p, side, 40);
        expect(side.health).toBe(100 - def.damage);
    });

    it("hits only the deepest target unless the weapon cleaves", () => {
        for (const [weapon, expected] of [
            ["fists", 1],
            ["katana", 2],
        ] as const) {
            const { game, p, def } = arena(weapon);
            const a = target(game, p, def.attack.offset.x, 0.6);
            const b = target(game, p, def.attack.offset.x + 0.3, -0.7);
            hitTicks(game, p, a, 60);
            const hurt = [a, b].filter((t) => t.health < 100).length;
            expect(hurt).toBe(expected);
        }
    });

    it("does not hit a player behind a wall", () => {
        const { game, p, def } = arena("katana", [{ type: "brick_wall_ext_10", at: { x: 1.4, y: 0 } }]);
        const t = target(game, p, def.attack.offset.x + 1.2);
        hitTicks(game, p, t, 60);
        expect(t.health).toBe(100);
    });

    it("damages obstacles by damage x obstacleDamage; stone needs a stone-piercing weapon", () => {
        const crate = arena("fists", [{ type: "crate_01", at: { x: 3.4, y: 0 } }]);
        const box = [...crate.game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        hitTicks(crate.game, crate.p, crate.p, 20);
        expect(box.maxHealth - box.health).toBeCloseTo(crate.def.damage * crate.def.obstacleDamage, 9);
        const stone = arena("fists", [{ type: "stone_04", at: { x: 3, y: 0 } }]);
        const rock = [...stone.game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        hitTicks(stone.game, stone.p, stone.p, 60);
        expect(rock.health).toBe(rock.maxHealth);
        const hammer = arena("stonehammer", [{ type: "stone_04", at: { x: 3, y: 0 } }]);
        const rock2 = [...hammer.game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        hitTicks(hammer.game, hammer.p, hammer.p, 60);
        expect(rock2.health).toBeLessThan(rock2.maxHealth);
    });

    it("repeats swings while held only for autoAttack weapons", () => {
        for (const weapon of ["fists", "hook"]) {
            const { game, p, def } = arena(weapon);
            const t = target(game, p, def.attack.offset.x + 0.5);
            t.helmet = "helmet03";
            t.chest = "chest03";
            const hold = { shootHold: true, shootStart: false };
            send(game, p, CLICK);
            game.step();
            const hits = hitTicks(game, p, t, 150, hold);
            const expectedHits = (def as MeleeDef).autoAttack ? 3 : 1;
            expect(hits.length >= expectedHits).toBe(true);
            if (!def.autoAttack) expect(hits.length).toBe(1);
        }
    });

    it("waits max(melee cooldown, switchDelay) after switching to melee", () => {
        const { game, p, def } = arena("fists");
        giveGun(p, "ak47", { reserve: 0 });
        steps(game, 200);
        const t = target(game, p, def.attack.offset.x + 0.5);
        send(game, p, { ...CLICK, actions: [Input.EquipMelee] });
        const start = game.tick;
        game.step();
        while (p.animType !== "melee" && game.tick - start < 100) {
            send(game, p, CLICK);
            game.step();
        }
        expect((game.tick - start) * DT).toBeCloseTo(def.switchDelay, 9);
        steps(game, 20);
        expect(t.health).toBeLessThan(100);
    });

    it("drops the equip speed bonus while a hit is pending", () => {
        const { game, p, def } = arena("fists");
        send(game, p, { ...CLICK, moveRight: true });
        game.step();
        send(game, p, { moveRight: true });
        game.step();
        expect(p.speed).toBe(12);
        steps(game, Math.round(def.attack.damageTimes[0] / DT) + 1);
        expect(p.speed).toBe(13);
    });
});
