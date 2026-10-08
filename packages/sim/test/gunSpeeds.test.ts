// Move speed of the heavy guns the owner named (2026-10-08; defs rebirth/gunSpeeds.ts, newGuns.json, docs/research/
// rebirth-deviations.md): the Barrett M107 and the Hécate II slow their holder (equip -1); the PMG-134 slows its
// carrier while it sits in a gun slot (carry -2) and more when held (equip -1), like the DShK; the M79, GL-06 and
// Milkor MGL no longer slow their holder, while the RPG-7, Panzerfaust and M202 still do. Each is measured as the
// distance a player walks in one second, not only as computeSpeed.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Player } from "../src/index.ts";
import { DT, flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";

const MOVE = GameConfig.player.moveSpeed;
const FISTS = getDefOfType("melee", "fists").speed.equip;

/** A player at an open spot with `gun` held (primary), optionally `other` in the secondary slot. */
function holder(gun: string, other?: string) {
    const game = flatGame();
    const p = spawnAt(game, openSpot(game, 40));
    if (other) giveGun(p, other, { slot: WeaponSlot.Secondary });
    giveGun(p, gun);
    return { game, p };
}

/** Distance `p` walks to +x in one second (100 ticks) with whatever it holds. */
function walkOneSecond(game: ReturnType<typeof flatGame>, p: Player): number {
    const start: Vec2 = v2.copy(p.pos);
    send(game, p, { moveRight: true });
    steps(game, Math.round(1 / DT));
    send(game, p, {});
    expect(p.pos.y, "a straight line").toBeCloseTo(start.y, 9);
    return v2.distance(p.pos, start);
}

/** Speed `p` moves at this tick and the distance it walks in one second, which must agree. */
function measured(game: ReturnType<typeof flatGame>, p: Player): number {
    const speed = p.computeSpeed(game.world);
    expect(walkOneSecond(game, p)).toBeCloseTo(speed, 6);
    return speed;
}

describe("heavy snipers: the Barrett M107 and the Hécate II slow their holder", () => {
    it.each(["barrett", "hecate"])("%s: 11 u/s held against 12 with an AK-47, no slowdown carried", (gun) => {
        expect(getDefOfType("gun", gun).speed.equip).toBe(-1);
        const ak = holder("ak47");
        expect(measured(ak.game, ak.p)).toBe(MOVE);
        const held = holder(gun);
        expect(measured(held.game, held.p)).toBe(MOVE - 1);
        // in the other slot it weighs nothing (no carry): the held AK-47's full speed
        const carried = holder("ak47", gun);
        expect(carried.p.carrySpeed()).toBe(0);
        expect(measured(carried.game, carried.p)).toBe(MOVE);
    });
});

describe("PMG-134: slower carried, slower still held (the DShK's scheme)", () => {
    it("carry -2, equip -1 (survev -1.5), attack -6: 11 / 10 / 9 / 1.5 u/s", () => {
        expect(getDefOfType("gun", "potato_lmg").speed).toEqual({ carry: -2, equip: -1, attack: -6 });
        // held: 12 - 2 - 1
        const held = holder("potato_lmg", "ak47");
        expect(held.p.carrySpeed()).toBe(-2);
        expect(measured(held.game, held.p)).toBe(MOVE - 3);
        // carried while the AK-47 is out: 12 - 2
        const carried = holder("ak47", "potato_lmg");
        expect(carried.p.carrySpeed()).toBe(-2);
        expect(measured(carried.game, carried.p)).toBe(MOVE - 2);
        // carried with the fists out: 12 + 1 - 2
        carried.p.weaponManager.setCurWeapIndex(WeaponSlot.Melee, true);
        expect(measured(carried.game, carried.p)).toBe(MOVE + FISTS - 2);
        // firing: (12 - 2 - 1 - 6) x 0.5
        held.p.shotSlowdownTimer = 0.1;
        expect(held.p.computeSpeed(held.game.world)).toBe((MOVE - 2 - 1 - 6) * 0.5);
        // a second heavy gun adds its own carry: PMG-134 and DShK, -4 in all
        const both = holder("potato_lmg", "dshk");
        expect(both.p.carrySpeed()).toBe(-4);
        expect(measured(both.game, both.p)).toBe(MOVE - 4 - 1);
    });
});

describe("launchers: every one slows its holder but the M79, GL-06 and Milkor MGL", () => {
    it.each(["m79", "gl06", "mgl"])("%s held: full speed (12 u/s), as an AK-47", (gun) => {
        expect(getDefOfType("gun", gun).speed).toEqual({ equip: 0, attack: 0 });
        const { game, p } = holder(gun);
        expect(measured(game, p)).toBe(MOVE);
    });

    it.each([
        ["rpg7", -2],
        ["panzerfaust", -1.5],
        ["m202", -2.5],
    ] as const)("%s held: slower (equip %d)", (gun, equip) => {
        expect(getDefOfType("gun", gun).speed.equip).toBe(equip);
        const { game, p } = holder(gun);
        const speed = measured(game, p);
        expect(speed).toBe(MOVE + equip);
        expect(speed).toBeLessThan(MOVE);
    });

    it("the M79 walks a second as far as an AK-47 and 2 u further than the RPG-7", () => {
        const m79 = holder("m79");
        const rpg = holder("rpg7");
        const ak = holder("ak47");
        const d = [walkOneSecond(m79.game, m79.p), walkOneSecond(rpg.game, rpg.p), walkOneSecond(ak.game, ak.p)];
        expect(d[0]).toBeCloseTo(d[2], 6);
        expect(d[0] - d[1]).toBeCloseTo(2, 6);
    });
});
