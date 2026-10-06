// Explosions (M5): falloff from rad.min to rad.max, walls blocking the blast, Flak Jacket against the oracle's
// explosion rows, obstacle damage and plating, barrel chains with kill credit, shrapnel, loot pushes, USAS-12 frag
// rounds, Explosive Rounds, scorch decals and snapshot events.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Game, Player } from "../src/index.ts";
import { constantRng, giveGun, send, spawnAt, steps } from "./combatHelpers.ts";
import { clearSpot, fxGame, logExplosions } from "./fxHelpers.ts";
import { hasFixture, loadFixture, Mismatches } from "./oracleHelpers.ts";

const PLAYER_SRC = { damageType: DamageType.Player, sourceId: 0 };

function addTarget(game: Game, pos: Vec2): Player {
    const t = game.getPlayer(game.addPlayer("target"))!;
    game.teleportPlayer(t.id, pos);
    return t;
}

/**
 * Damage a player at distance `d` takes from one explosion of `type`. The target stands towards -x, on the first
 * ray (rays sweep from -PI and each object is damaged by the first ray that reaches it, explosions.md); shrapnel
 * flies towards +x.
 */
function damageAt(origin: Vec2, type: string, d: number, falloff: "step" | "smooth" = "step"): number {
    const { game, p } = fxGame(origin);
    game.fxRng = constantRng(0);
    game.rules.explosionFalloff = falloff;
    game.teleportPlayer(p.id, v2.add(origin, { x: 40, y: 0 }));
    const t = addTarget(game, v2.add(origin, { x: -d, y: 0 }));
    game.explosions.add(type, origin, 0, PLAYER_SRC);
    game.step();
    return 100 - t.health;
}

describe("explosion damage", () => {
    it("is full inside rad.min, then falls off to 0 at rad.max (conflicts.md explosion-falloff-curve)", () => {
        const origin = clearSpot();
        const { game } = fxGame(origin);
        const frag = getDefOfType("explosion", "explosion_frag");
        const far = { type: 0 as const, pos: { x: 100, y: 0 }, rad: 0.1 };
        const at = (d: number) => game.explosions.damageAt(frag, { x: 0, y: 0 }, far, d);
        expect([at(0), at(5), at(6), at(9), at(12), at(13)]).toEqual([125, 125, 62.5, 31.25, 0, 0]);
        // touching the rad.min circle counts as inside
        expect(game.explosions.damageAt(frag, { x: 0, y: 0 }, { type: 0, pos: { x: 5.5, y: 0 }, rad: 1 }, 9)).toBe(125);
        game.rules.explosionFalloff = "smooth";
        expect([at(5), at(8.5), at(12)]).toEqual([125, 62.5, 0]);

        // in the world the ray meets the body surface, 1 unit before its centre
        expect(damageAt(origin, "explosion_mirv_mini", 4)).toBeCloseTo(75, 9);
        expect(damageAt(origin, "explosion_mirv_mini", 6)).toBeCloseTo(75 * (1 - 5 / 8), 9);
        expect(damageAt(origin, "explosion_frag", 7)).toBeCloseTo(62.5, 9);
        expect(damageAt(origin, "explosion_frag", 10)).toBeCloseTo(31.25, 9);
        expect(damageAt(origin, "explosion_frag", 13.5)).toBe(0);
        expect(damageAt(origin, "explosion_frag", 9.5, "smooth")).toBeCloseTo(62.5, 9);
    });

    it("is blocked by walls: an explosion behind a wall does no damage", () => {
        const origin = clearSpot();
        const run = (wall: boolean) => {
            const { game, p } = fxGame(
                origin,
                wall ? [{ type: "warehouse_wall_side", pos: { x: 3, y: 0 }, ori: 1 }] : [],
            );
            game.fxRng = constantRng(0); // shrapnel towards +x, into the wall
            game.teleportPlayer(p.id, v2.add(origin, { x: 0, y: -40 }));
            const t = addTarget(game, v2.add(origin, { x: 6, y: 0 }));
            game.explosions.add("explosion_frag", origin, 0, PLAYER_SRC);
            steps(game, 100);
            return 100 - t.health;
        };
        expect(run(false)).toBeGreaterThan(60);
        expect(run(true)).toBe(0);
    });

    it.skipIf(!hasFixture("damage"))("goes through Flak Jacket and armour like damage.json's explosion rows", () => {
        const rows = (loadFixture("damage").rows as Array<[number, string, number, number, string, number]>).filter(
            (r) => r[0] === 125 && r[1] === "explosion" && r[5] < 100,
        );
        const helmets = ["", "helmet01", "helmet02", "helmet03"];
        const chests = ["", "chest01", "chest02", "chest03"];
        const origin = clearSpot();
        const m = new Mismatches();
        for (const [, , helmet, chest, perk, want] of rows) {
            if (helmet > 3 || chest > 3) continue;
            const { game, p } = fxGame(origin);
            game.teleportPlayer(p.id, v2.add(origin, { x: -40, y: 0 }));
            const t = addTarget(game, v2.add(origin, { x: 0.5, y: 0 }));
            t.helmet = helmets[helmet];
            t.chest = chests[chest];
            if (perk !== "none") t.perks.push(perk);
            game.rules.steelskinReduction = 0.45; // survev's value, as recorded by the oracle
            game.explosions.add("explosion_frag", origin, 0, PLAYER_SRC);
            game.step();
            m.near(`helmet ${helmet} chest ${chest} ${perk}`, 100 - t.health, want, 1e-6);
        }
        expect(m.checked).toBeGreaterThan(20);
        expect(m.list).toEqual([]);
        // fandom's stacked 91 % behind a knob (conflicts.md flak-explosion-reduction)
        const { game } = fxGame(origin);
        const t = addTarget(game, v2.add(origin, { x: 0.5, y: 0 }));
        t.perks.push("flak_jacket");
        game.rules.flakJacketStacksOnExplosions = true;
        game.explosions.add("explosion_frag", origin, 0, PLAYER_SRC);
        game.step();
        expect(100 - t.health).toBeCloseTo(125 * 0.1 * 0.9, 9);
    });

    it("damages obstacles x obstacleDamage; plated obstacles resist grenades but not air strike bombs", () => {
        const origin = clearSpot();
        const { game } = fxGame(origin, [
            { type: "crate_01", pos: { x: 4, y: 0 } },
            { type: "stone_04", pos: { x: 0, y: 5 } },
        ]);
        const crate = [...game.world.objects.values()].find((o) => o.type === "crate_01")!;
        const stone = [...game.world.objects.values()].find((o) => o.type === "stone_04")!;
        if (crate.kind !== "obstacle" || stone.kind !== "obstacle") throw new Error("obstacles expected");
        game.explosions.add("explosion_frag", origin, 0, { damageType: DamageType.Player, gameSourceType: "frag" });
        game.step();
        expect(crate.dead).toBe(true);
        expect(stone.health).toBe(stone.maxHealth);
        game.explosions.add("explosion_bomb_iron", origin, 0, { damageType: DamageType.Airstrike });
        game.step();
        expect(stone.health).toBeLessThan(stone.maxHealth);
    });

    it("chains through barrels in one tick and credits whoever destroyed the first", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin, [
            { type: "barrel_01", pos: { x: 6, y: 0 } },
            { type: "propane_01", pos: { x: 0, y: 0 } },
        ]);
        game.fxRng = constantRng(0);
        const barrel = [...game.world.objects.values()].find((o) => o.type === "barrel_01")!;
        if (barrel.kind !== "obstacle") throw new Error("barrel expected");
        game.teleportPlayer(p.id, v2.add(origin, { x: 40, y: 0 }));
        // out of the barrel's reach, 8 units from the propane tank on its first ray
        const victim = addTarget(game, v2.add(origin, { x: -8, y: 0 }));
        const log = logExplosions(game);
        game.damageObstacle(barrel, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "mp5",
            sourceId: p.id,
        });
        game.step();
        expect(log.map((e) => [e.type, e.mapSourceType, e.sourceId])).toEqual([
            ["explosion_barrel", "barrel_01", p.id],
            ["explosion_barrel", "propane_01", p.id],
        ]);
        expect(game.explosions.count).toBe(2);
        // 8 units from the propane tank: 125 x (1 - 7 / 12)
        expect(victim.health).toBeCloseTo(100 - 125 * (1 - 7 / 12), 9);
        victim.health = 10;
        game.explosions.add("explosion_barrel", victim.pos, 0, {
            damageType: DamageType.Player,
            mapSourceType: "barrel_01",
            sourceId: p.id,
        });
        game.step();
        const kill = game.match.kills.since(0).at(-1)!;
        expect(kill).toMatchObject({
            targetId: victim.id,
            killerId: p.id,
            mapSourceType: "barrel_01",
            source: "explosion",
        });
        expect(p.kills).toBe(1);
    });

    it("fires shrapnelCount shrapnel bullets, pushes loot away and leaves a scorch decal", () => {
        const origin = clearSpot();
        const { game } = fxGame(origin);
        const loot = game.loot.addLoot("bandage", v2.add(origin, { x: 3, y: 0 }), 0, 1, { pushSpeed: 0 })!;
        const before = game.bullets.reports.length;
        game.explosions.add("explosion_frag", origin, 0, {
            damageType: DamageType.Player,
            gameSourceType: "frag",
            sourceId: 7,
        });
        game.step();
        const shrapnel = game.bullets.reports.slice(before).map((r) => r.bullet);
        expect(shrapnel).toHaveLength(12);
        expect(
            shrapnel.every((b) => b.bulletType === "shrapnel_frag" && b.shooterId === 7 && b.sourceType === "frag"),
        ).toBe(true);
        expect(loot.vel.x).toBeGreaterThan(0);
        const decals = [...game.world.objects.values()].filter((o) => o.type === "decal_frag_explosion");
        expect(decals).toHaveLength(1);
        // explosion_rounds scorches fade after 2-2.5 s
        game.explosions.add("explosion_rounds", origin, 0, PLAYER_SRC);
        game.step();
        expect([...game.world.objects.values()].some((o) => o.type === "decal_rounds_explosion")).toBe(true);
        steps(game, 260);
        expect([...game.world.objects.values()].some((o) => o.type === "decal_rounds_explosion")).toBe(false);
    });

    it("are reported once to viewers that see them", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        game.getSnapshot(p.id);
        game.explosions.add("explosion_frag", v2.add(origin, { x: 10, y: 0 }), 0, PLAYER_SRC);
        game.explosions.add("explosion_frag", v2.add(origin, { x: 300, y: 0 }), 0, PLAYER_SRC);
        game.step();
        const snap = game.getSnapshot(p.id);
        expect(snap.explosions).toEqual([{ type: "explosion_frag", pos: v2.add(origin, { x: 10, y: 0 }), layer: 0 }]);
        game.step();
        expect(game.getSnapshot(p.id).explosions).toEqual([]);
    });
});

describe("explosive bullets", () => {
    function shooter(origin: Vec2, gun: string): { game: Game; p: Player; target: Player } {
        const { game, p } = fxGame(origin);
        giveGun(p, gun, { reserve: 100 });
        const target = addTarget(game, v2.add(origin, { x: 8, y: 0 }));
        return { game, p, target };
    }

    it("USAS-12 frag rounds explode where they stop, even at max range", () => {
        const origin = clearSpot();
        const { game, p, target } = shooter(origin, "usas");
        const log = logExplosions(game);
        // toMouseHit: the cursor beyond the target and the def range (M9)
        send(game, p, { shootStart: true, shootHold: true, toMouseLen: 64 });
        game.step();
        send(game, p, {});
        steps(game, 50);
        const usas = log.filter((e) => e.type === "explosion_usas");
        expect(usas.length).toBeGreaterThanOrEqual(1);
        expect(usas[0]).toMatchObject({ sourceId: p.id, gameSourceType: "usas" });
        // the round's own damage plus the 42-damage explosion on the target's body
        const bullet = getDefOfType("bullet", "bullet_frag");
        expect(100 - target.health).toBeGreaterThan(42 + bullet.damage * 0.5);
        // a round fired into the open explodes at its range
        target.health = 100;
        game.teleportPlayer(target.id, v2.add(origin, { x: 0, y: 60 }));
        steps(game, 200);
        const before = log.length;
        p.weaponManager.weapons[WeaponSlot.Primary].cooldown = 0;
        send(game, p, { shootStart: true, shootHold: true, toMouseLen: 64 });
        game.step();
        send(game, p, {});
        steps(game, 60);
        const fresh = log.slice(before).filter((e) => e.type === "explosion_usas");
        expect(fresh.length).toBe(1);
        expect(v2.distance(fresh[0].pos, p.pos)).toBeGreaterThan(20);
    });

    it("Explosive Rounds explode on hits only, shotgun pellets with the quieter explosion_rounds_sg", () => {
        const origin = clearSpot();
        const hit = shooter(origin, "ak47");
        hit.p.perks.push("explosive");
        const log = logExplosions(hit.game);
        send(hit.game, hit.p, { shootHold: true });
        hit.game.step();
        send(hit.game, hit.p, {});
        steps(hit.game, 30);
        expect(log.map((e) => e.type)).toEqual(["explosion_rounds"]);
        // a miss peters out at max range
        const miss = shooter(origin, "ak47");
        miss.p.perks.push("explosive");
        miss.game.teleportPlayer(miss.target.id, v2.add(origin, { x: 0, y: 60 }));
        const missLog = logExplosions(miss.game);
        send(miss.game, miss.p, { shootHold: true });
        miss.game.step();
        send(miss.game, miss.p, {});
        steps(miss.game, 200);
        expect(missLog).toEqual([]);
        const sg = shooter(origin, "m870");
        sg.p.perks.push("explosive");
        const sgLog = logExplosions(sg.game);
        send(sg.game, sg.p, { shootStart: true, shootHold: true });
        sg.game.step();
        send(sg.game, sg.p, {});
        steps(sg.game, 30);
        expect(sgLog.length).toBeGreaterThan(1);
        expect(sgLog.every((e) => e.type === "explosion_rounds_sg")).toBe(true);
    });
});

describe("Martyrdom", () => {
    it("releases 12 martyr grenades on death", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const victim = spawnAt(game, v2.add(origin, { x: 30, y: 0 }));
        victim.perks.push("martyrdom");
        game.damagePlayer(victim, { amount: 200, damageType: DamageType.Player, sourceId: p.id });
        const nades = game.projectiles.projectiles.filter((pr) => pr.type === "martyr_nade");
        expect(nades).toHaveLength(12);
        expect(nades.every((n) => n.ownerId === victim.id)).toBe(true);
        const log = logExplosions(game);
        steps(game, 400);
        expect(log.filter((e) => e.type === "explosion_martyr_nade")).toHaveLength(12);
    });
});
