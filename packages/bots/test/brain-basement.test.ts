// Basements and bunkers (BrainFeatures.basements, the "basement" behaviour; owner 2026-10-08: "why don't the bots go
// underground? The military base's basement shows no sign of being looted"), on the main map, seed 12345 (no loot
// spawned: the containers are the loot; alone, the gas waits): what bots know of the map's basements, who goes for
// them, a looter walking down into the Hydra bunker, breaking its lockers and crates and coming back up, the military
// base's basement with its vault door opened, a bot that does not go for basements staying up, a looter walking out of
// a basement the next circle leaves outside before the gas comes, and what an underground bot sees of a basement lying
// under a ground building's roof.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getMapObjectDef } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BASEMENT_SALT, basementChance, floorPoints } from "../src/brain/basement.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { puzzleSites } from "../src/brain/puzzleSites.ts";
import { BotController } from "../src/controller.ts";
import { colliderBounds, pointInBounds, transformCollider } from "../src/geom.ts";
import { basementSites } from "../src/knowledge/basements.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { UndergroundNav } from "../src/nav/underground.ts";
import { installPerception } from "../src/perception/install.ts";
import { PERSONA_MIX, PERSONAS, type PersonaName } from "../src/persona.ts";
import { DEFAULT_SKILL_MIX, type SkillProfile } from "../src/skill.ts";
import { cachedMap, giveGun, mainGame, placePlayer } from "./helpers.ts";
import { newModel, ORIGIN, snap } from "./perceptionSnap.ts";

const SECOND = 100;
type Tier = SkillProfile["tier"];
const gen = cachedMap("main", 12345);
const ground = NavGrid.forMap(gen.mapData);
const ug = UndergroundNav.forMap(gen.mapData, ground);
const sites = basementSites(gen.mapData, ug);

function site(type: string) {
    const s = sites.find((x) => x.type === type);
    if (!s) throw new Error(`no ${type}`);
    return s;
}

function profile(tier: Tier): SkillProfile {
    return { tier, s: 0.5, g: 0.5 };
}

/** The first bot seed from `from` whose basement draw says `goes` for this persona and tier. */
function seedFor(persona: PersonaName, tier: Tier, goes: boolean, from = 1): number {
    const chance = basementChance(PERSONAS[persona], profile(tier));
    let seed = from;
    while (createRng((seed ^ BASEMENT_SALT) >>> 0).next() < chance !== goes) seed++;
    return seed;
}

/** A bot with an MP5 on the ground `off` units out from the top of the structure's first stairs. */
function botNear(game: Game, type: string, persona: PersonaName, tier: Tier, goes: boolean, off: Vec2) {
    const portal = site(type).region.portals[0];
    const top = portal.top as Vec2;
    const pos = ground.center(ground.nearestWalkable(v2.add(top, off), 10));
    const p = placePlayer(game, `${persona}-${tier}`, pos);
    giveGun(p, "mp5", 90);
    const seed = seedFor(persona, tier, goes);
    return { p, bot: new BotController(game, p.id, { seed, skill: tier, brain: "smart", persona }) };
}

/**
 * Stages the library's hidden room as already looted: since the rebirth buildings' rework (2026-10-10) its one-switch
 * room lies 88 units from the Hydra's stairs on main 12345 and draws the looter there first, then on to the chrys bunker.
 */
function libraryDone(game: Game, bot: BotController): void {
    for (const s of puzzleSites(game.mapData)) {
        if (s.entry.building === "library_01") bot.bot.brain.mem.puzzle.finished.add(s.index);
    }
}

/**
 * Stages the military base's PR #18 hidden rooms (the armory's gun cage, the HQ's archive, the infirmary's narcotics
 * store) as already looted: a looter who knows them works all three on the way (they sit round the basement's stairs)
 * and starts down only some 120 s in, too late for the vault and ten containers inside the 150 s. PR #19's wave-3
 * rooms too: the apartments' storeroom drew it off first, then the radio station's vault, and it was not down by 150 s.
 */
function militaryRoomsDone(game: Game, bot: BotController): void {
    const rooms = [
        "military_armory_01",
        "military_hq_01",
        "military_infirmary_01",
        "gas_station_store_01",
        "church_01",
        "mall_01",
        "capitol_01",
        "apartment_01",
        "port_checkpoint_01",
        "cargo_ship_01",
    ];
    for (const s of puzzleSites(game.mapData)) {
        if (rooms.includes(s.entry.building)) bot.bot.brain.mem.puzzle.finished.add(s.index);
    }
}

/** Containers (destructible obstacles with loot) on the floor of the structure's underground grid. */
function floorContainers(game: Game, type: string): number[] {
    const region = site(type).region;
    const out: number[] = [];
    for (const o of game.world.objects.values()) {
        if (o.kind !== "obstacle" || (o.layer & 1) !== 1 || o.dead || !o.destructible || !o.def.loot?.length) continue;
        if (region.onFloor(o.pos, 1)) out.push(o.id);
    }
    return out;
}

function broken(game: Game, ids: readonly number[]): number {
    let n = 0;
    for (const id of ids) {
        const o = game.world.get(id);
        if (!o || (o.kind === "obstacle" && o.dead)) n++;
    }
    return n;
}

describe("basement knowledge", () => {
    it("knows every basement of the map, what it is worth and where its rooms are", () => {
        expect(sites.map((s) => s.type).sort()).toEqual(ug.regions.map((r) => r.type).sort());
        const value = (t: string) => site(t).value;
        // the military base's big basement is the richest, then the Hydra bunker and the club's bathhouse; the barn's
        // little cellar the poorest (knowledge/buildingValue.ts)
        expect(Math.max(...sites.map((s) => s.value))).toBe(value("military_base_01"));
        expect(value("bunker_structure_02")).toBeGreaterThan(value("mansion_structure_01"));
        expect(value("club_structure_01")).toBeGreaterThan(value("bunker_structure_03"));
        expect(Math.min(...sites.map((s) => s.value))).toBe(value("barn_basement_structure_01"));
        // waypoints over the floor, walkable and reachable from the stairs, the military vault's among them (its door
        // opens by hand: the path follower uses it and waits for it)
        const mil = site("military_base_01").region;
        const points = floorPoints(mil);
        expect(points.length).toBeGreaterThan(10);
        for (const p of points) {
            expect(mil.walkableAt(p)).toBe(true);
            expect(ug.canPathTo(ground, mil.portals[0].top as Vec2, 0, p, 1)).toBe(true);
        }
        const vault = gen.objects.find((o) => o.type === "military_bunker_vault_01");
        if (!vault) throw new Error("no military vault");
        const def = getMapObjectDef("military_bunker_vault_01");
        if (def.type !== "building") throw new Error("the vault is no building");
        const zone = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn;
        if (!zone) throw new Error("the vault has no interior");
        const inside = colliderBounds(transformCollider(zone, vault.pos, vault.ori, 1));
        expect(points.some((p) => pointInBounds(p, inside))).toBe(true);
    });

    it("sends a share of the bots: thorough looters and map-wise players most", () => {
        expect(basementChance(PERSONAS.looter, profile("expert"))).toBeGreaterThan(0.75);
        expect(basementChance(PERSONAS.rusher, profile("beginner"))).toBeLessThan(0.12);
        expect(basementChance(PERSONAS.looter, profile("intermediate"))).toBeGreaterThan(
            basementChance(PERSONAS.rifleman, profile("intermediate")),
        );
        // the server's population: about a third of the bots (personas x skill tiers)
        let share = 0;
        let total = 0;
        for (const [persona, pw] of Object.entries(PERSONA_MIX) as Array<[PersonaName, number]>) {
            for (const [tier, tw] of Object.entries(DEFAULT_SKILL_MIX) as Array<[Tier, number]>) {
                share += pw * tw * basementChance(PERSONAS[persona], profile(tier));
                total += pw * tw;
            }
        }
        expect(share / total).toBeGreaterThan(0.25);
        expect(share / total).toBeLessThan(0.45);
    });
});

describe("basements in a game", () => {
    it("a looter walks down into the Hydra bunker, breaks its lockers and crates, and comes back up", () => {
        const game = mainGame();
        const hydra = "bunker_structure_02";
        const { p, bot } = botNear(game, hydra, "looter", "expert", true, { x: 0, y: 0 });
        libraryDone(game, bot);
        const containers = floorContainers(game, hydra);
        expect(containers.length).toBeGreaterThan(10);
        const region = site(hydra).region;
        let downAt = -1;
        let upAt = -1;
        for (let t = 0; t < 200 * SECOND && upAt < 0; t++) {
            bot.update();
            game.step();
            if (downAt < 0 && (p.layer & 1) === 1 && region.onFloor(p.pos, 1)) downAt = t;
            if (downAt >= 0 && p.layer === 0 && bot.bot.brain.mem.loot2.basementsDone.has(region.id)) upAt = t;
        }
        // down within half a minute, most of its containers broken, then back on the ground floor with the trip done
        expect(downAt).toBeGreaterThan(0);
        expect(downAt).toBeLessThan(30 * SECOND);
        expect(broken(game, containers)).toBeGreaterThanOrEqual(8);
        expect(upAt).toBeGreaterThan(downAt);
    }, 120_000);

    it("a looter loots the military base's basement and opens its vault door", () => {
        const game = mainGame();
        const mil = "military_base_01";
        const { bot } = botNear(game, mil, "looter", "expert", true, { x: 0, y: 60 });
        militaryRoomsDone(game, bot);
        const containers = floorContainers(game, mil);
        const door = [...game.world.objects.values()].find(
            (o) => o.kind === "obstacle" && o.type === "vault_door_main" && site(mil).region.onFloor(o.pos, 2),
        );
        expect(door).toBeDefined();
        const vaultOpen = () => door?.kind === "obstacle" && !!door.door?.open;
        let t = 0;
        for (; t < 150 * SECOND && !(vaultOpen() && broken(game, containers) >= 10); t++) {
            bot.update();
            game.step();
        }
        expect(vaultOpen()).toBe(true);
        expect(broken(game, containers)).toBeGreaterThanOrEqual(10);
    }, 120_000);

    it("a bot that does not go for basements stays on the ground floor", () => {
        const game = mainGame();
        const { p, bot } = botNear(game, "bunker_structure_02", "rusher", "beginner", false, { x: 0, y: 0 });
        for (let t = 0; t < 40 * SECOND; t++) {
            bot.update();
            game.step();
            expect(p.layer & 1).toBe(0);
        }
        expect(bot.bot.brain.mem.loot2.basementGoer).toBe(false);
        expect(bot.bot.brain.mem.loot2.basementSite).toBe(-1);
    }, 60_000);

    it("a looter down in the Hydra bunker leaves it before the gas comes when the next circle leaves it outside", () => {
        // (review: no bot may be caught underground by the gas; the real stage times, the first circle announced while the
        // bot loots, smaller (0.2 of the map instead of 0.45) so its centre, kept well on the map, can leave the whole
        // floor and its stairs outside it)
        const stages = GameConfig.gas.stages.map((st, i) => (i === 1 || i === 2 ? { ...st, rad: 0.2 } : st));
        const game = mainGame({ gasStages: stages });
        const hydra = "bunker_structure_02";
        const { p, bot } = botNear(game, hydra, "looter", "expert", true, { x: 0, y: 0 });
        libraryDone(game, bot);
        const s = site(hydra);
        const b = s.region.bounds;
        const halfDiag = Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y) / 2;
        const mapMiddle = { x: game.gas.width / 2, y: game.gas.height / 2 };
        const toMiddle = v2.normalizeSafe(v2.sub(mapMiddle, s.center), { x: 1, y: 0 });
        const rad = game.gas.stages[1].rad * game.gas.mapSize;
        game.gas.chooseCenter = () => v2.add(s.center, v2.mul(toMiddle, rad + halfDiag + 20));
        let announced = -1;
        let upAt = -1;
        let gasBelow = 0;
        for (let t = 0; t < 180 * SECOND && !p.dead; t++) {
            bot.update();
            game.step();
            const below = (p.layer & 1) === 1 && s.region.onFloor(p.pos, 1);
            if (announced < 0 && below && bot.bot.brain.mem.loot2.basementBelowAt >= 0) {
                // looting down there for a while, then the circle is announced
                if (game.time - bot.bot.brain.mem.loot2.basementBelowAt > 20) {
                    game.gas.start();
                    announced = t;
                    expect(v2.distance(s.center, game.gas.posNew)).toBeGreaterThan(game.gas.radNew + halfDiag);
                }
            }
            if (announced >= 0 && upAt < 0 && p.layer === 0) upAt = t;
            if (p.layer !== 0 && game.gas.isInGas(p.pos)) gasBelow++;
            // until the circle has closed in (the waiting and moving stages of the first circle)
            if (announced >= 0 && game.gas.stage >= 3) break;
        }
        expect(announced).toBeGreaterThan(0);
        // the trip is dropped, the bot walks back up and never stands underground in the gas
        expect(bot.bot.brain.mem.loot2.basementsDone.has(s.region.id)).toBe(true);
        expect(upAt).toBeGreaterThan(announced);
        expect(gasBelow).toBe(0);
        expect(p.dead).toBe(false);
        expect(game.gas.stage).toBeGreaterThanOrEqual(3);
    }, 180_000);
});

describe("underground perception", () => {
    it("sees the loot of a basement lying under a ground building's roof only from underground", () => {
        const def = getMapObjectDef("house_red_01") as {
            ceiling: { zoomRegions: Array<{ zoomIn?: { min: Vec2; max: Vec2 } }> };
        };
        const z = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn as { min: Vec2; max: Vec2 };
        const housePos = v2.add(ORIGIN, { x: 20, y: 0 });
        const below = v2.add(housePos, { x: (z.min.x + z.max.x) / 2, y: (z.min.y + z.max.y) / 2 });
        const house = {
            id: 950,
            kind: "building" as const,
            type: "house_red_01",
            pos: housePos,
            layer: 0,
            ori: 0,
            occupied: false,
            ceilingDead: false,
            ceilingDamaged: false,
        };
        const loot = { id: 31, kind: "loot" as const, type: "mp5", pos: below, layer: 1, count: 1 };
        // underground (basements): no ceiling hides anything, the client covers the ground floor with its fill
        const under = newModel();
        installPerception(under, BRAIN_PRESETS.smart);
        under.observe(snap(1, { objects: [house, loot], self: { layer: 1 } }));
        expect(under.loot.has(31)).toBe(true);
        // a bot without underground navigation keeps the old reading (the baseline brain replays as before)
        const base = newModel();
        installPerception(base, BRAIN_PRESETS.baseline);
        base.observe(snap(1, { objects: [house, loot], self: { layer: 1 } }));
        expect(base.loot.has(31)).toBe(false);
    });
});
