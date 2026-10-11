// The owner's wave 3 (PR #19, 2026-10-10) for the bots:
// - map knowledge: the gas pump is an explosive (never broken through, never cover), the brick shells break indoors
//   like the partitions, the explosion-gated doors never; a stair shut by a gate is no way down until a snapshot shows
//   the gate blown (nav/underground.ts);
// - a bot on the floor of a building it saw near collapse walks out of it (brain/collapse.ts);
// - in the dark subway a bot sees what the client's overlay shows: the glow round itself and muzzle flashes
//   (perception/darkness.ts);
// - an expert with an M202 blasts the blast bunker's door open; the door counts hits (the owner, 2026-10-11: M202 1,
//   NLAW 2, RPG-7 6), so a bot with RPG-7 rockets enough for the hits left spends those before the single-use M202, a
//   lone NLAW starts only on a door already half open, and too few rounds are never wasted on it (brain/gateBreach.ts).
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
import { gateLauncher, roundsToOpen } from "../src/brain/gateBreach.ts";
import { BotController } from "../src/controller.ts";
import { collapseSites, onCollapseFloor } from "../src/knowledge/collapse.ts";
import { explosiveOf } from "../src/knowledge/explosives.ts";
import { launcherSpec } from "../src/knowledge/launchers.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
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
    const gate = getMapObjectDefOfType("obstacle", BLAST_BUNKER_DOOR.type).explosionGate!;
    const held = (id: string, slot: number, mag: number, reserve = 0) => ({ slot, info: gunInfo(id)!, mag, reserve });
    const chosen = (guns: ReturnType<typeof held>[], healthT = 1) => gateLauncher(guns, gate, healthT)?.gun.info.id;

    it("counts the rounds left from the door's health (the shares left)", () => {
        const rpg = launcherSpec("rpg7")!;
        const nlaw = launcherSpec("nlaw")!;
        expect([1, 5 / 6, 4 / 6, 1 / 6].map((h) => roundsToOpen(rpg, gate, h))).toEqual([6, 5, 4, 1]);
        // the health travels quantized (8 bits): still whole shares
        expect(roundsToOpen(rpg, gate, Math.round((5 / 6) * 255) / 255)).toBe(5);
        expect([1, 0.5, 1 / 6].map((h) => roundsToOpen(nlaw, gate, h))).toEqual([2, 1, 1]);
        expect(roundsToOpen(launcherSpec("m202")!, gate, 1)).toBe(1);
    });

    it("spends the cheapest ammo that finishes the door: RPG-7 rockets, then NLAWs, the M202 last", () => {
        const m202 = held("m202", 1, 4);
        // six rockets (one loaded, five in the bag): the RPG-7, the M202 kept
        expect(chosen([held("rpg7", 0, 1, 5), m202])).toBe("rpg7");
        // reloading (none loaded, six in the bag) is no reason to switch to the M202
        expect(chosen([held("rpg7", 0, 0, 6), m202])).toBe("rpg7");
        // five rockets for a fresh door: the M202
        expect(chosen([held("rpg7", 0, 1, 4), m202])).toBe("m202");
        // 6 minus the hits already on it: two rockets finish a door with four RPG-7 hits
        expect(chosen([held("rpg7", 0, 1, 1), m202], 2 / 6)).toBe("rpg7");
        // one NLAW: no start on a fresh door (the M202 does it), the NLAW finishes a door already half open
        expect(chosen([held("nlaw", 0, 1), m202])).toBe("m202");
        expect(chosen([held("nlaw", 0, 1)])).toBeUndefined();
        expect(chosen([held("nlaw", 0, 1), m202], 0.5)).toBe("nlaw");
        // too few rockets and nothing else: nothing (no round wasted)
        expect(chosen([held("rpg7", 0, 1, 2)])).toBeUndefined();
        // nothing that opens it at all
        expect(chosen([held("panzerfaust", 0, 1), held("m79", 1, 1, 10)])).toBeUndefined();
    });

    function bunker(
        primary: string,
        opts: { reserve?: number; secondary?: string; rpgHits?: number; from?: number } = {},
    ): { game: Game; door: Obstacle; bot: BotController; mag: (slot?: number) => number } {
        const show = generateShowcase(BLAST_BUNKER, 1);
        const game = new Game(
            { mapName: show.mapName, seed: 1 },
            { generation: show.generation, spawnLoot: false, sandbox: true },
        );
        const doorPos = v2.add(show.object.pos, BLAST_BUNKER_DOOR.pos);
        const door = obstacles(game, BLAST_BUNKER_DOOR.type).find(
            (o) => v2.distance(o.pos, doorPos) < 0.01,
        ) as Obstacle;
        // (from 10 u the door is on screen; at the stand-off spot it lies just off the screen's short side)
        const p = placePlayer(game, "breacher", v2.add(doorPos, { x: 0, y: -(opts.from ?? 24) }));
        // a full magazine; rockets in the bag only when asked (the single-use launchers' rounds are no bag items)
        const arm = (gun: string, slot: number, reserve: number) => {
            const def = getDefOfType("gun", gun);
            p.weaponManager.setWeapon(slot, gun, def.maxClip);
            if (reserve > 0) {
                p.backpack = "backpack03";
                p.inv.set(def.ammo, reserve);
            }
        };
        if (opts.secondary) arm(opts.secondary, 1, 0);
        arm(primary, 0, opts.reserve ?? 0);
        p.weaponManager.setCurWeapIndex(0);
        // earlier RPG-7 hits on the door
        for (let i = 0; i < (opts.rpgHits ?? 0); i++) {
            game.damageObstacle(door, {
                amount: 135,
                damageType: DamageType.Player,
                isExplosion: true,
                explosionType: "explosion_rpg7",
            });
        }
        // others far away (a crowd: no endgame hold)
        for (let k = 0; k < 12; k++) placePlayer(game, `far${k}`, v2.add(doorPos, { x: 150 + k * 6, y: 200 }));
        const bot = new BotController(game, p.id, { seed: 1, skill: "expert", brain: "smart" });
        return { game, door, bot, mag: (slot = 0) => p.weaponManager.weapons[slot].ammo };
    }

    function run(game: Game, bot: BotController, door: Obstacle, ticks: number): number {
        for (let i = 0; i < ticks; i++) {
            bot.update();
            game.step();
            if (door.dead) return i / 100;
        }
        return -1;
    }

    it("an expert with an M202 blasts the blast bunker's door open", () => {
        const { game, door, bot } = bunker("m202");
        expect(run(game, bot, door, 1500)).toBeGreaterThan(0);
    });

    it("an expert with six RPG-7 rockets opens it with those and keeps its M202", () => {
        const { game, door, bot, mag } = bunker("rpg7", { reserve: 5, secondary: "m202" });
        expect(run(game, bot, door, 4000)).toBeGreaterThan(0);
        expect([door.gateHits, mag(1)]).toEqual([6, 4]);
    });

    it("with two rockets for a door already four RPG-7 hits in, it finishes it with the RPG-7", () => {
        // it walks up seeing the door's health (a third left), then backs off to the stand-off spot
        const { game, door, bot, mag } = bunker("rpg7", { reserve: 1, secondary: "m202", rpgHits: 4, from: 10 });
        expect(door.gateHits).toBe(4);
        expect(run(game, bot, door, 2500)).toBeGreaterThan(0);
        expect([door.gateHits, mag(1)]).toEqual([6, 4]);
    });

    it("with too few rockets it uses the M202", () => {
        const { game, door, bot, mag } = bunker("rpg7", { reserve: 1, secondary: "m202" });
        expect(run(game, bot, door, 1500)).toBeGreaterThan(0);
        expect([door.gateHits, mag(0)]).toEqual([1, 1]);
    });

    it("never wastes an RPG-7 round it cannot finish the door with", () => {
        const { game, door, bot, mag } = bunker("rpg7");
        const before = mag();
        expect(run(game, bot, door, 1000)).toBe(-1);
        expect([door.dead, door.health, mag()]).toEqual([false, door.maxHealth, before]);
    });
});
