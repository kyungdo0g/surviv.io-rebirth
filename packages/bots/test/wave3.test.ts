// The owner's wave 3 (PR #19, 2026-10-10) for the bots:
// - map knowledge: the gas pump is an explosive (never broken through, never cover), the brick shells break indoors
//   like the partitions, the explosion-gated doors never; a stair shut by a gate is no way down until a snapshot shows
//   the gate blown (nav/underground.ts);
// - a bot on the floor of a building it saw near collapse walks out of it (brain/collapse.ts);
// - in the dark subway a bot sees what the client's overlay shows: the glow round itself and muzzle flashes
//   (perception/darkness.ts);
// - an expert with an M202 blasts the blast bunker's door open; an RPG-7 cannot open it and never wastes a round on it
//   (brain/gateBreach.ts).
import { type Vec2, v2 } from "@rebirth/core";
import {
    BLAST_BUNKER,
    BLAST_BUNKER_DOOR,
    DamageType,
    GAS_STATION,
    GAS_STATION_COLLAPSE_WALLS,
    getDefOfType,
    getMapObjectDefOfType,
    SUBWAY_STRUCTURE,
} from "@rebirth/defs";
import { type Building, Game, generateShowcase, type Obstacle } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { NEAR_LEFT } from "../src/brain/collapse.ts";
import { BotController } from "../src/controller.ts";
import { collapseSites, onCollapseFloor } from "../src/knowledge/collapse.ts";
import { explosiveOf } from "../src/knowledge/explosives.ts";
import { BreakClass, breakClassOf } from "../src/nav/breakThrough.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { UndergroundNav } from "../src/nav/underground.ts";
import { cachedMap, giveGun, placePlayer } from "./helpers.ts";

function showcaseGame(type: string): Game {
    const show = generateShowcase(type, 1);
    return new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot: false, sandbox: true },
    );
}

function obstacles(game: Game, type: string): Obstacle[] {
    return [...game.world.objects.values()].filter((o): o is Obstacle => o.kind === "obstacle" && o.type === type);
}

describe("wave-3 map knowledge", () => {
    it("knows the gas pump explodes, breaks brick shells indoors, never an explosion-gated door", () => {
        const def = (type: string) => getMapObjectDefOfType("obstacle", type);
        expect(explosiveOf(def("gas_pump_01"))).not.toBeNull();
        expect(breakClassOf(def("gas_pump_01"), "gas_pump_01", true)).toBe(BreakClass.None);
        expect(breakClassOf(def("rebirth_wall_brk_4"), "rebirth_wall_brk_4", true)).toBe(BreakClass.HouseRule);
        expect(breakClassOf(def("rebirth_wall_brk_4"), "rebirth_wall_brk_4", false)).toBe(BreakClass.None);
        for (const gate of ["blast_door_01", "subway_gate_01"]) expect(breakClassOf(def(gate), gate, true)).toBe(0);
    });

    it("plans no way down a stair shut by a gate until it sees the gate blown", () => {
        const gen = cachedMap("main", 12345);
        const ground = new NavGrid(gen.mapData);
        const ug = new UndergroundNav(gen.mapData, ground);
        for (const type of [BLAST_BUNKER, SUBWAY_STRUCTURE]) {
            const p = ug.portals.find((x) => x.region.type === type);
            if (!p?.topPoint || !p.bottom) throw new Error(`no ${type} stair`);
            expect([type, p.gates.size, p.top]).toEqual([type, 1, null]);
            expect(ug.canPathTo(ground, p.topPoint, 0, p.bottom, 1)).toBe(false);
            // the gate seen destroyed (an M202 for the bunker's, any launcher round for the subway's)
            const [id] = [...p.gates];
            const g = gen.mapData.objects.find((o) => o.id === id);
            if (!g) throw new Error("no gate");
            ug.observeObstacle({ ...g, kind: "obstacle", healthT: 0, dead: true });
            expect(p.top).toEqual(p.topPoint);
            expect(ug.canPathTo(ground, p.topPoint, 0, p.bottom, 1)).toBe(true);
        }
    });
});

describe("collapsing buildings", () => {
    it("walks out of the gas station's store once it saw it near collapse", () => {
        const game = showcaseGame(GAS_STATION);
        const store = game.world.buildings.find((b) => b.type === "gas_station_store_01") as Building;
        const site = collapseSites(game.mapData).find((s) => s.id === store.id);
        if (!site) throw new Error("no collapse site");
        expect(site.wallCount).toBe(GAS_STATION_COLLAPSE_WALLS);
        // inside the shop floor (store frame: x -5..11, y 0..8 is the shop)
        const inside = v2.add(store.pos, { x: 3, y: 4 });
        const p = placePlayer(game, "shopper", inside);
        giveGun(p, "mp5", 90);
        placePlayer(game, "far", v2.add(store.pos, { x: 150, y: 150 }));
        const bot = new BotController(game, p.id, { seed: 2, skill: "expert", brain: "smart" });
        const shell = obstacles(game, "rebirth_wall_brk_4")
            .concat(obstacles(game, "rebirth_wall_brk_3"), obstacles(game, "rebirth_wall_brk_2"))
            .filter((o) => site.walls.includes(o.id));
        // broken down to NEAR_LEFT walls short of the collapse, in the bot's view
        for (const w of shell.slice(0, site.wallCount - NEAR_LEFT))
            game.damageObstacle(w, { amount: 1000, damageType: DamageType.Player });
        expect(store.ceilingDead).toBe(false);
        let out = -1;
        for (let i = 0; i < 800 && out < 0; i++) {
            bot.update();
            game.step();
            if (!onCollapseFloor(site, p.pos, p.layer, 1)) out = i / 100;
        }
        expect(out).toBeGreaterThan(0);
        expect(out).toBeLessThan(6);
    });
});

describe("the dark subway", () => {
    function subway(): { game: Game; platform: Vec2 } {
        const game = showcaseGame(SUBWAY_STRUCTURE);
        for (const g of obstacles(game, "subway_gate_01"))
            game.damageObstacle(g, { amount: 1e6, damageType: DamageType.Airdrop });
        const platform = game.world.buildings.find((b) => b.type === "subway_platform_01") as Building;
        return { game, platform: platform.pos };
    }

    it("sees an enemy in the dark only in its own glow or by a muzzle flash", () => {
        const { game, platform } = subway();
        const me = placePlayer(game, "bot", v2.add(platform, { x: -10, y: 0 }));
        game.teleportPlayer(me.id, me.pos, 1);
        const enemy = placePlayer(game, "enemy", v2.add(platform, { x: -2, y: 0 }));
        game.teleportPlayer(enemy.id, enemy.pos, 1);
        placePlayer(game, "far", v2.add(platform, { x: 200, y: 200 }));
        const bot = new BotController(game, me.id, { seed: 1, skill: "expert", brain: "smart" });
        const seen = () => !!bot.bot.model.contacts.get(enemy.id)?.visible;
        const run = (ticks: number) => {
            let any = false;
            for (let i = 0; i < ticks; i++) {
                bot.update();
                game.step();
                any ||= seen();
            }
            return any;
        };
        expect(bot.bot.model.darkness).not.toBeNull();
        // 8 units off in the dark: not seen (in a lit room it would be)
        expect(run(30)).toBe(false);
        // it fires: the flash shows it
        giveGun(enemy, "m9", 30);
        enemy.input = { ...enemy.input, shootStart: true, shootHold: true, toMouseDir: { x: 0, y: 1 } };
        expect(run(10)).toBe(true);
        enemy.input = { ...enemy.input, shootStart: false, shootHold: false };
        // right next to the bot, in its glow: seen
        game.teleportPlayer(enemy.id, v2.add(me.pos, { x: 2.5, y: 0 }), 1);
        expect(run(10)).toBe(true);
    });
});

describe("explosion-gated doors", () => {
    function bunker(gun: string): { game: Game; door: Obstacle; bot: BotController; mag: () => number } {
        const show = generateShowcase(BLAST_BUNKER, 1);
        const game = new Game(
            { mapName: show.mapName, seed: 1 },
            { generation: show.generation, spawnLoot: false, sandbox: true },
        );
        const doorPos = v2.add(show.object.pos, BLAST_BUNKER_DOOR.pos);
        const door = obstacles(game, BLAST_BUNKER_DOOR.type).find(
            (o) => v2.distance(o.pos, doorPos) < 0.01,
        ) as Obstacle;
        const p = placePlayer(game, "breacher", v2.add(doorPos, { x: 0, y: -24 }));
        // a full magazine, no reserve (the launchers' own rounds are no bag items)
        p.weaponManager.setWeapon(0, gun, getDefOfType("gun", gun).maxClip);
        p.weaponManager.setCurWeapIndex(0);
        // others far away (a crowd: no endgame hold)
        for (let k = 0; k < 12; k++) placePlayer(game, `far${k}`, v2.add(doorPos, { x: 150 + k * 6, y: 200 }));
        const bot = new BotController(game, p.id, { seed: 1, skill: "expert", brain: "smart" });
        return { game, door, bot, mag: () => p.weaponManager.weapons[0].ammo };
    }

    it("an expert with an M202 blasts the blast bunker's door open", () => {
        const { game, door, bot } = bunker("m202");
        let t = -1;
        for (let i = 0; i < 1500 && t < 0; i++) {
            bot.update();
            game.step();
            if (door.dead) t = i / 100;
        }
        expect(t).toBeGreaterThan(0);
    });

    it("never wastes an RPG-7 round on the door it cannot open", () => {
        const { game, door, bot, mag } = bunker("rpg7");
        const before = mag();
        for (let i = 0; i < 1000; i++) {
            bot.update();
            game.step();
        }
        expect([door.dead, door.health, mag()]).toEqual([false, door.maxHealth, before]);
    });
});
