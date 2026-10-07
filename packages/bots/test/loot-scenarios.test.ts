// LOOT (bot overhaul) end to end in the simulation: containers broken fully (armed bots too, after an interruption, a
// plated crate only with a piercing melee), an air drop opened and its inner crate broken, a house cleared room by
// room, boosts used when safe, holstering while travelling. Default brain (smart) unless noted. Owner: LOOT.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef } from "@rebirth/defs";
import type { Game, Obstacle, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { flatGame, giveGun, mainGame, openSpot, placePlayer, runUntil } from "./helpers.ts";

const SPOT = openSpot(flatGame(), 60);

function obstacleOf(game: Game, type: string): Obstacle {
    for (const o of game.world.objects.values()) if (o.kind === "obstacle" && o.type === type) return o as Obstacle;
    throw new Error(`no ${type}`);
}

/** A flat game with `type` at the open spot and a bot 8-10 units off it (a far dummy keeps the match running). */
function crateGame(type: string, angle = 0, dist = 9) {
    const game = flatGame({ sandbox: true }, 1, [{ type, pos: SPOT }]);
    const p = placePlayer(game, "bot", v2.add(SPOT, { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }));
    placePlayer(game, "dummy", v2.add(SPOT, { x: 250, y: 250 }));
    return { game, p, crate: obstacleOf(game, type) };
}

describe("containers", () => {
    it("breaks a crate fully from every side, unarmed and with two loaded guns", () => {
        for (const armed of [false, true]) {
            for (const type of ["crate_01", "crate_02", "toilet_01"]) {
                for (let k = 0; k < 3; k++) {
                    const { game, p, crate } = crateGame(type, (k * 2 * Math.PI) / 3);
                    if (armed) {
                        // two loaded guns and no armour: 0/30 on HEAD (lootNeed and explore's hysteresis)
                        giveGun(p, "mp5", 90, 0);
                        giveGun(p, "m870", 30, 1);
                    }
                    const bot = new BotController(game, p.id, { seed: 7 + k });
                    const ticks = runUntil(game, [bot], () => crate.dead, 600);
                    expect(ticks, `${type} armed=${armed} side ${k}`).toBeGreaterThan(0);
                }
            }
        }
    });

    it("comes back to a crate it was pulled away from and finishes it (no blacklist on return)", () => {
        for (const away of [3, 12]) {
            const { game, p, crate } = crateGame("crate_02");
            const bot = new BotController(game, p.id, { seed: 3 });
            expect(runUntil(game, [bot], () => crate.health < crate.maxHealth, 600)).toBeGreaterThan(0);
            expect(crate.dead).toBe(false);
            // an order takes it away for a while (a fight, a flight, a heal)
            bot.bot.brain.mem.order = { type: "goto", pos: v2.add(SPOT, { x: 35, y: 0 }), arriveDist: 1 };
            runUntil(game, [bot], () => false, away * 100);
            bot.bot.brain.mem.order = null;
            expect(
                runUntil(game, [bot], () => crate.dead, 1200),
                `away ${away} s`,
            ).toBeGreaterThan(0);
        }
    });

    it("leaves a plated crate to a piercing melee", () => {
        const fists = crateGame("crate_04");
        const a = new BotController(fists.game, fists.p.id, { seed: 3 });
        runUntil(fists.game, [a], () => false, 600);
        expect(fists.crate.health).toBe(fists.crate.maxHealth);
        expect(a.bot.brain.mem.breakTarget).toBe(0);
        const axe = crateGame("crate_04");
        axe.p.weaponManager.setWeapon(2, "woodaxe", 0);
        const b = new BotController(axe.game, axe.p.id, { seed: 3 });
        expect(runUntil(axe.game, [b], () => axe.crate.dead, 900)).toBeGreaterThan(0);
    });
});

describe("air drops", () => {
    it("goes for a drop, opens it, waits it out and breaks the inner crate (then takes the loot)", () => {
        const game = flatGame({ sandbox: true });
        const p = placePlayer(game, "bot", SPOT);
        giveGun(p, "mp5", 90, 0);
        placePlayer(game, "dummy", v2.add(SPOT, { x: 250, y: 250 }));
        const bot = new BotController(game, p.id, { seed: 5 });
        game.planes.addAirdrop(v2.add(SPOT, { x: 60, y: 0 }));
        let inner: Obstacle | undefined;
        const broke = runUntil(
            game,
            [bot],
            () => {
                inner ??= [...game.world.objects.values()].find(
                    (o) => o.kind === "obstacle" && /^crate_1[0-3]$/.test(o.type) && !o.dead,
                ) as Obstacle | undefined;
                return !!inner?.dead;
            },
            6000,
        );
        expect(broke).toBeGreaterThan(0);
        // the bot walks over its loot afterwards (a better gun than the mp5, a throwable, armour...)
        const before = JSON.stringify([p.weaponManager.weapons.map((w) => w.type), p.helmet, p.chest]);
        runUntil(game, [bot], () => false, 800);
        expect(JSON.stringify([p.weaponManager.weapons.map((w) => w.type), p.helmet, p.chest])).not.toBe(before);
    });
});

/** The centre of a building's first ceiling zoomIn region. */
function interior(b: { type: string; pos: Vec2; ori: number }): Vec2 {
    const def = getMapObjectDef(b.type) as { ceiling: { zoomRegions: Array<{ zoomIn?: { min: Vec2; max: Vec2 } }> } };
    const z = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn as { min: Vec2; max: Vec2 };
    let c = { x: (z.min.x + z.max.x) / 2, y: (z.min.y + z.max.y) / 2 };
    for (let i = 0; i < (b.ori ?? 0); i++) c = { x: -c.y, y: c.x };
    return v2.add(b.pos, c);
}

describe("house clearing (sweep)", () => {
    it("clears a house room by room with a full loadout: every piece of furniture, every waypoint", () => {
        const game = mainGame({ sandbox: true });
        const house = game.world.buildings.find((b) => b.type === "house_red_01");
        expect(house).toBeDefined();
        const centre = interior(house as { type: string; pos: Vec2; ori: number });
        const p = placePlayer(game, "bot", centre);
        giveGun(p, "mp5", 90, 0);
        giveGun(p, "m870", 30, 1);
        p.helmet = "helmet01";
        p.chest = "chest01";
        placePlayer(game, "dummy", v2.add(centre, { x: 250, y: 250 }));
        const furniture = [...game.world.objects.values()].filter(
            (o) =>
                o.kind === "obstacle" &&
                o.layer === 0 &&
                (o as Obstacle).def.loot.length > 0 &&
                (o as Obstacle).def.destructible &&
                !(o as Obstacle).def.explosion &&
                v2.distance(o.pos, centre) < 16,
        ) as Obstacle[];
        expect(furniture.length).toBeGreaterThan(1);
        const bot = new BotController(game, p.id, { seed: 2 });
        const lm = bot.bot.brain.mem.loot2;
        let points: Vec2[] = [];
        const reached = new Set<number>();
        const done = runUntil(
            game,
            [bot],
            () => {
                if (!points.length && lm.sweepPoints.length) points = lm.sweepPoints.map((q) => v2.copy(q));
                points.forEach((q, k) => {
                    if (v2.distance(q, p.pos) < 2.6) reached.add(k);
                });
                return lm.swept.has(house!.id);
            },
            4000,
        );
        expect(done).toBeGreaterThan(0);
        expect(points.length).toBeGreaterThanOrEqual(3);
        expect(reached.size).toBe(points.length);
        expect(furniture.every((o) => o.dead)).toBe(true);
        // the baseline brain (no sweep) with the same loadout walks through and leaves the furniture
        const g2 = mainGame({ sandbox: true });
        const p2 = placePlayer(g2, "bot", centre);
        giveGun(p2, "mp5", 90, 0);
        giveGun(p2, "m870", 30, 1);
        p2.helmet = "helmet01";
        p2.chest = "chest01";
        placePlayer(g2, "dummy", v2.add(centre, { x: 250, y: 250 }));
        const base = new BotController(g2, p2.id, { seed: 2, brain: "baseline" });
        runUntil(g2, [base], () => false, 1500);
        expect(base.bot.brain.mem.loot2.swept.size).toBe(0);
    });
});

describe("boosts and holstering", () => {
    it("drinks soda and takes pills when safe", () => {
        const game = flatGame({ sandbox: true });
        const p: Player = placePlayer(game, "bot", SPOT);
        giveGun(p, "mp5", 90, 0);
        p.inv.set("soda", 2);
        p.inv.set("painkiller", 1);
        placePlayer(game, "dummy", v2.add(SPOT, { x: 250, y: 250 }));
        const bot = new BotController(game, p.id, { seed: 4 });
        expect(runUntil(game, [bot], () => p.boost > 0, 1200)).toBeGreaterThan(0);
        expect((p.inv.get("soda") ?? 0) + (p.inv.get("painkiller") ?? 0)).toBeLessThan(3);
    });

    it("holsters while travelling with nobody around and draws when an enemy shows (smart only)", () => {
        const game = flatGame({ sandbox: true });
        const p = placePlayer(game, "bot", SPOT);
        giveGun(p, "mp5", 90, 0);
        const dummy = placePlayer(game, "dummy", v2.add(SPOT, { x: 250, y: 250 }));
        const bot = new BotController(game, p.id, { seed: 6 });
        expect(runUntil(game, [bot], () => p.weaponManager.curWeapIdx === 2, 800)).toBeGreaterThan(0);
        // an armed enemy walks into view: the gun comes out
        giveGun(dummy, "ak47", 90, 0);
        game.teleportPlayer(dummy.id, v2.add(p.pos, { x: 14, y: 0 }));
        expect(runUntil(game, [bot], () => p.weaponManager.curWeapIdx === 0, 150)).toBeGreaterThan(0);
        // the baseline brain never holsters
        const g2 = flatGame({ sandbox: true });
        const p2 = placePlayer(g2, "bot", SPOT);
        giveGun(p2, "mp5", 90, 0);
        placePlayer(g2, "dummy", v2.add(SPOT, { x: 250, y: 250 }));
        const base = new BotController(g2, p2.id, { seed: 6, brain: "baseline" });
        expect(runUntil(g2, [base], () => p2.weaponManager.curWeapIdx === 2, 800)).toBe(-1);
    });
});
