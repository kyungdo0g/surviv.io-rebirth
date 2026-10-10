// The owner's 2026-10-10 throwables and ground decals (rebirth/throwables.ts, rebirth/discardDecals.ts): built from the
// frag, rarer than frags on every floor throwable table, and decals that exist for every launcher thrown away.
import { describe, expect, it } from "vitest";
import {
    DISCARD_DECALS,
    FIRE_DECAL_TYPE,
    GameConfig,
    getDefOfType,
    getMapObjectDefOfType,
    LAUNCHER_ROUNDS,
    MapDefs,
    MOLOTOV_FIRE,
    OWNER_ROUND_ART,
    REBIRTH_THROWABLE_SPRITES,
} from "../src/index.ts";

describe("Molotov and flashbang defs", () => {
    it("the Molotov bursts on contact into a fire; the flashbang cooks like a frag and flashes", () => {
        const frag = getDefOfType("throwable", "frag");
        const molotov = getDefOfType("throwable", "molotov");
        expect(molotov).toMatchObject({ cookable: false, explodeOnImpact: true, playerCollision: true });
        expect(getDefOfType("explosion", molotov.explosionType).fire).toEqual(MOLOTOV_FIRE);
        expect(getDefOfType("explosion", molotov.explosionType).damage).toBe(0);
        const flash = getDefOfType("throwable", "flashbang");
        expect(flash.cookable).toBe(true);
        expect(flash.throwPhysics).toEqual(frag.throwPhysics);
        expect(getDefOfType("explosion", flash.explosionType).flash?.rad).toBe(20);
        for (const id of ["molotov", "flashbang"] as const) {
            const def = getDefOfType("throwable", id);
            expect(def.worldImg.sprite).toBe(REBIRTH_THROWABLE_SPRITES[id]);
            expect(def.lootImg.sprite).toBe(REBIRTH_THROWABLE_SPRITES[id]);
            expect(def.handImg?.equip?.right.sprite).toBe(REBIRTH_THROWABLE_SPRITES[id]);
            expect(def.noPotatoSwap).toBe(true);
        }
        expect(GameConfig.bagSizes.molotov).toEqual(GameConfig.bagSizes.mirv);
        expect(GameConfig.bagSizes.flashbang).toEqual(GameConfig.bagSizes.smoke);
    });

    it("are rarer than frags on every floor throwable table", () => {
        let maps = 0;
        for (const [name, def] of Object.entries(MapDefs)) {
            const table = def.lootTable.tier_throwables;
            if (!table) continue;
            maps++;
            const frag = table.find((e) => e.name === "frag")!;
            for (const id of ["molotov", "flashbang"]) {
                const row = table.find((e) => e.name === id)!;
                expect(row, `${name} ${id}`).toBeDefined();
                // fewer rolls than the frags, and at most half as many grenades
                expect(row.weight, `${name} ${id}`).toBeLessThan(frag.weight);
                expect(row.weight * row.count, `${name} ${id}`).toBeLessThanOrEqual((frag.weight * frag.count) / 2);
            }
            // the air drops keep their own throwables
            const air = def.lootTable.tier_airdrop_throwables ?? [];
            expect(
                air.some((e) => e.name === "molotov" || e.name === "flashbang"),
                name,
            ).toBe(false);
        }
        expect(maps).toBeGreaterThan(10);
    });
});

describe("ground decals", () => {
    it("every thrown-away launcher has a timed decal; the fire's lasts as long as the fire", () => {
        for (const [gun, art] of Object.entries(DISCARD_DECALS)) {
            expect(getDefOfType("gun", gun).discardWhenEmpty, gun).toBe(true);
            const decal = getMapObjectDefOfType("decal", art.decal);
            expect(decal.img.sprite).toBe(art.sprite);
            expect(decal.lifetime).toBeGreaterThan(10);
            // the body is `length` world units long (16 px per unit)
            expect((decal.img.scale * art.size[1]) / 16).toBeCloseTo(art.length, 2);
        }
        expect(getMapObjectDefOfType("decal", FIRE_DECAL_TYPE).lifetime).toBe(MOLOTOV_FIRE.duration);
    });

    it("the second-wave rounds draw their own sprites in flight", () => {
        expect(LAUNCHER_ROUNDS.bullet_nlaw.sprite).toBe("proj-nlaw-01.img");
        expect(LAUNCHER_ROUNDS.bullet_bazooka.sprite).toBe("proj-bazooka-01.img");
        expect(LAUNCHER_ROUNDS.bullet_pvg42.sprite).toBe("proj-pvg42-01.img");
        for (const art of Object.values(OWNER_ROUND_ART)) expect(art.fallback).toMatch(/^proj-.*\.img$/);
    });
});
