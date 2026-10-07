// The survev-only guns in the simulation (tools/port-survev/policy.json; their stats are pinned to survev.wiki.gg in
// packages/defs/test/survevGuns.test.ts): each fires at its fire delay and hits an unarmoured body for the wiki's
// damage (with the bullet falloff over the distance travelled), the PMG-134's potato shots slow the target and shrink
// its view like survev's (server explosion.ts:222-242, player.ts:4592-4597), and seeded loot rolls give them at the
// weights survev's tables hold.
import { createRng, v2 } from "@rebirth/core";
import { GameConfig, getDefOfType, getMapDef, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rollTier } from "../src/loot/lootTable.ts";
import {
    constantRng,
    DT,
    fireOnce,
    flatGame,
    giveGun,
    intervals,
    openSpot,
    recordShots,
    send,
    spawnAt,
    steps,
} from "./combatHelpers.ts";
import { clearSpot, fxGame, logExplosions } from "./fxHelpers.ts";

/** survev.wiki.gg body damage per bullet (pellet) of the hitscan survev-only guns */
const WIKI_DAMAGE: Readonly<Record<string, number>> = { barrett: 99, ash12: 31, sw500: 64, imbel: 12, spas16: 8.75 };

/** Shooter facing +x at an open spot, a gun with a full clip, constant rng (no spread, no headshot). */
function range(gun: string) {
    const game = flatGame();
    game.combatRng = constantRng();
    const p = spawnAt(game, openSpot(game, 70));
    const def = giveGun(p, gun, { reserve: 200 });
    return { game, p, def };
}

describe("survev-only guns fire like their wiki pages", () => {
    it.each(Object.keys(WIKI_DAMAGE))("%s hits an unarmoured body for the wiki damage x falloff", (gun) => {
        for (const dist of [6, 12]) {
            const { game, p, def } = range(gun);
            const target = spawnAt(game, v2.add(p.pos, { x: dist, y: 0 }), { x: -1, y: 0 });
            fireOnce(game, p);
            steps(game, 100);
            const bullet = getDefOfType("bullet", def.bulletType);
            expect(bullet.damage).toBe(WIKI_DAMAGE[gun]);
            // falloff over the distance travelled at the end of the tick of the hit (bullets.test.ts falloff test)
            const stepLen = bullet.speed * DT;
            const travelled = Math.ceil((dist - 1 - def.barrelLength) / stepLen - 1e-9) * stepLen;
            const perHit = bullet.damage * (1 + (bullet.falloff - 1) * (travelled / bullet.distance));
            // every SPAS-16 pellet hits a body this close with no spread
            expect(100 - target.health, `${gun} at ${dist}`).toBeCloseTo(perHit * def.bulletCount, 9);
        }
    });

    it.each(["ash12", "imbel", "spas16"])("auto %s fires every fireDelay", (gun) => {
        const { game, p, def } = range(gun);
        p.weaponManager.weapons[WeaponSlot.Primary].ammo = 255;
        const gaps = intervals(recordShots(game, p, 600, () => ({ shootHold: true })));
        expect(gaps.length).toBeGreaterThan(10);
        for (const g of gaps) expect(Math.abs(g - def.fireDelay)).toBeLessThanOrEqual(DT + 1e-9);
    });

    it.each(["barrett", "sw500"])("single %s fires once per click, at most every fireDelay", (gun) => {
        const { game, p, def } = range(gun);
        const gaps = intervals(recordShots(game, p, 400, () => ({ shootHold: true, shootStart: true })));
        expect(gaps.length).toBeGreaterThan(2);
        for (const g of gaps.slice(1)) expect(Math.abs(g - def.fireDelay)).toBeLessThanOrEqual(DT + 1e-9);
    });

    it("the Barrett slows its holder by 1 and by 4 more right after a shot (wiki Player / Recoil speed)", () => {
        const { game, p } = range("barrett");
        const held = p.computeSpeed(game.world);
        expect(held).toBeCloseTo(GameConfig.player.moveSpeed - 1, 9);
        fireOnce(game, p);
        // and, as after every shot, at half speed while the shot slowdown runs (survev BUSY speed x0.5)
        expect(p.computeSpeed(game.world)).toBeCloseTo((GameConfig.player.moveSpeed - 1 - 4) * 0.5, 9);
    });
});

describe("PMG-134", () => {
    it("fires two potato shots per shot with infinite ammo; a hit slows 0.25 s and shrinks the view", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const target = spawnAt(game, { x: origin.x + 8, y: origin.y }, { x: -1, y: 0 });
        const zoom = target.zoom;
        giveGun(p, "potato_lmg");
        const log = logExplosions(game);
        fireOnce(game, p);
        expect(game.projectiles.projectiles.map((pr) => pr.type)).toEqual(["potato_lmgshot", "potato_lmgshot"]);
        for (let i = 0; i < 60 && log.length < 2; i++) game.step();
        expect(log.map((e) => e.type)).toEqual(["explosion_potato_lmgshot", "explosion_potato_lmgshot"]);
        // 2 x 8.5 (wikigg PMG-134 Explosion damage) on an unarmoured body inside rad.min
        expect(100 - target.health).toBeCloseTo(17, 6);
        expect(target.frozen.ticker).toBeGreaterThan(0);
        expect(target.frozen.ticker).toBeLessThanOrEqual(0.25);
        expect(target.viewShrink.amount).toBe(3);
        // never below the 1x zoom: shrinking a 1x view changes nothing visible
        expect(target.zoom).toBe(Math.max(GameConfig.scopeZoomRadius.desktop["1xscope"], zoom - 3));
        // infinite ammo: the clip still counts down, the bag holds none
        expect(p.weaponManager.weapons[WeaponSlot.Primary].ammo).toBe(149);
        expect(p.inv.get("potato_ammo")).toBe(0);
        // the view comes back 2.5 s after the last hit
        steps(game, 260);
        expect(target.viewShrink).toEqual({ amount: 0, ticker: 0 });
        expect(target.frozen.ticker).toBe(0);
    });

    it("the view shrink adds 1.5 a hit up to 32 and takes the zoom down from a scope, never below 1x", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const target = spawnAt(game, { x: origin.x + 8, y: origin.y }, { x: -1, y: 0 });
        target.scope = "8xscope";
        giveGun(p, "potato_lmg");
        /** steps `n` ticks keeping the target alive (8.5 a hit kills it in 12) */
        const run = (n: number) => {
            for (let i = 0; i < n; i++) {
                target.health = 100;
                game.step();
            }
        };
        send(game, p, { shootHold: true });
        run(10);
        send(game, p, {});
        run(30);
        const desktop = GameConfig.scopeZoomRadius.desktop;
        expect(target.viewShrink.amount).toBeGreaterThan(0);
        expect(target.zoom).toBeCloseTo(Math.max(desktop["1xscope"], desktop["8xscope"] - target.viewShrink.amount), 9);
        send(game, p, { shootHold: true });
        run(400);
        expect(target.dead).toBe(false);
        expect(target.viewShrink.amount).toBe(32);
        expect(target.zoom).toBe(Math.max(desktop["1xscope"], desktop["8xscope"] - 32));
        // a 2x scope's view goes all the way down to the 1x one
        target.scope = "2xscope";
        run(1);
        expect(target.zoom).toBe(desktop["1xscope"]);
    });

    it("never slows or blinds the shooter's teammates or the shooter", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        giveGun(p, "potato_lmg");
        fireOnce(game, p);
        steps(game, 60);
        expect(p.viewShrink.amount).toBe(0);
        expect(p.frozen.ticker).toBe(0);
    });
});

/** Pearson chi-square of `counts` against `weights` over `n` rolls. */
function chiSquare(counts: ReadonlyMap<string, number>, weights: ReadonlyMap<string, number>, n: number): number {
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    let chi = 0;
    for (const [name, w] of weights) {
        const expected = (n * w) / total;
        chi += ((counts.get(name) ?? 0) - expected) ** 2 / expected;
    }
    return chi;
}

describe("seeded loot rolls", () => {
    // chi-square critical values at p = 0.001 for the tables' degrees of freedom (the gold tables grew with survev's
    // 50v50 table and the rebirth's new guns, rebirth/newGunLoot.ts)
    // biome-ignore format: one row
    const CRITICAL: Readonly<Record<number, number>> = {
        6: 22.46, 7: 24.32, 8: 26.12, 9: 27.88, 10: 29.59, 11: 31.26, 12: 32.91, 13: 34.53, 14: 36.12, 15: 37.7,
        16: 39.25, 17: 40.79, 18: 42.31, 19: 43.82, 20: 45.31, 21: 46.8, 22: 48.27, 23: 49.73, 24: 51.18, 25: 52.62,
    };

    it.each([
        ["woods", "tier_guns", "imbel", 2.75],
        ["main", "tier_airdrop_rare", "barrett", 1],
        ["snow", "tier_airdrop_rare", "barrett", 1],
        ["savannah", "tier_airdrop_rare", "sw500", 2],
        ["faction", "tier_airdrop_rare", "spas16", 2],
    ] as const)("%s %s gives %s at its weight (chi-square sanity)", (map, tier, gun, weight) => {
        const table = getMapDef(map).lootTable[tier];
        expect(table.find((e) => e.name === gun)?.weight).toBe(weight);
        const weights = new Map<string, number>();
        for (const e of table) weights.set(e.name, (weights.get(e.name) ?? 0) + e.weight);
        const rng = createRng(20261007);
        const n = 20_000;
        const counts = new Map<string, number>();
        for (let i = 0; i < n; i++) {
            const name = rollTier({ [tier]: table }, tier, rng)?.name ?? "";
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const dof = weights.size - 1;
        expect(CRITICAL[dof], `no critical value for ${dof} degrees of freedom`).toBeDefined();
        expect(chiSquare(counts, weights, n)).toBeLessThan(CRITICAL[dof]);
        const total = [...weights.values()].reduce((a, b) => a + b, 0);
        expect(counts.get(gun)! / n).toBeCloseTo(weight / total, 1);
    });
});
