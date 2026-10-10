// The gas station (the owner's wave 3, 2026-10-10; packages/defs rebirth/buildings/gasStation.ts), alone on its showcase
// map: the store caves in once 40 % of its brick pieces are broken, killing everyone inside and burying its furniture
// and loot while the forecourt, the drums and the players outside stay; one shot drum sets off its whole stack (the
// tanks between the drums carry the chain); the switch behind the counter opens the back office.
import { type Vec2, v2 } from "@rebirth/core";
import {
    DamageType,
    GAS_STATION,
    GAS_STATION_BRITTLE_WALLS,
    GAS_STATION_COLLAPSE_WALLS,
    GAS_STATION_OFFICE_DOOR,
    GAS_STATION_STORE,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Building, Game, interactObstacle, type Obstacle, type Player } from "../src/index.ts";
import { generateShowcase } from "../src/mapgen/showcase.ts";
import { childObstacles, findBuilding, placePlayer, stepSeconds } from "./buildingHelpers.ts";

function stationGame(spawnLoot = false): { game: Game; site: Building; store: Building } {
    const show = generateShowcase(GAS_STATION, 1);
    const game = new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot, sandbox: true },
    );
    const site = findBuilding(game, GAS_STATION);
    // the showcase stands it at ori 0, so site-frame offsets add to its position
    expect(site.ori).toBe(0);
    return { game, site, store: findBuilding(game, GAS_STATION_STORE) };
}

const at = (b: Building, x: number, y: number): Vec2 => v2.add(b.pos, { x, y });

function lootIn(game: Game, min: Vec2, max: Vec2): string[] {
    const out: string[] = [];
    for (const o of game.world.objects.values()) {
        if (o.kind === "loot" && o.pos.x > min.x && o.pos.x < max.x && o.pos.y > min.y && o.pos.y < max.y)
            out.push(o.type);
    }
    return out;
}

function breakWall(game: Game, wall: Obstacle, by: Player): void {
    game.damageObstacle(wall, { amount: 1000, damageType: DamageType.Player, gameSourceType: "ak47", sourceId: by.id });
}

describe("the gas station", () => {
    it("its store caves in at 40 % of its brick walls: the shopper dies buried, the store's loot goes, the forecourt stays", () => {
        const { game, site, store } = stationGame(true);
        expect(GAS_STATION_COLLAPSE_WALLS).toBe(Math.round(GAS_STATION_BRITTLE_WALLS * 0.4));
        const shopper = placePlayer(game, at(site, -14, 11));
        const clerk = placePlayer(game, at(site, -7.5, 6));
        const driver = placePlayer(game, at(site, 0, -12.5));
        const shooter = placePlayer(game, at(site, -2, -4.5));
        const storeMin = at(site, -21, 0);
        const storeMax = at(site, 11, 17);
        expect(lootIn(game, storeMin, storeMax).length).toBeGreaterThanOrEqual(5);
        const forecourtLoot = lootIn(game, at(site, -16, -19), at(site, 16, -5));
        expect(forecourtLoot.length).toBeGreaterThan(0);
        const storeObstacles = store.childIds.filter((id) => game.world.get(id));
        const drums = childObstacles(game, site).filter((o) => o.type === "barrel_01" || o.type === "propane_01");
        expect(drums.length).toBeGreaterThanOrEqual(30);

        const shell = childObstacles(game, store).filter((o) => o.type.startsWith("rebirth_wall_brk_"));
        expect(shell).toHaveLength(GAS_STATION_BRITTLE_WALLS);
        for (const w of shell.slice(0, GAS_STATION_COLLAPSE_WALLS - 1)) breakWall(game, w, shooter);
        // one wall short: the store stands
        expect([store.ceilingDead, shopper.dead, clerk.dead]).toEqual([false, false, false]);

        breakWall(game, shell[GAS_STATION_COLLAPSE_WALLS - 1], shooter);
        expect(store.ceilingDead).toBe(true);
        expect([shopper.dead, clerk.dead, driver.dead, shooter.dead]).toEqual([true, true, false, false]);
        expect(shopper.killedBy).toBe(shooter.id);
        // the store's walls, doors, shelves, safe and chest are buried, and its loot with them
        expect(storeObstacles.filter((id) => game.world.get(id))).toEqual([]);
        expect(lootIn(game, storeMin, storeMax)).toEqual([]);
        stepSeconds(game, 1);
        expect(lootIn(game, storeMin, storeMax)).toEqual([]);
        // the site, its drums and the forecourt's loot stand
        expect(drums.every((d) => !d.dead && game.world.get(d.id))).toBe(true);
        expect(lootIn(game, at(site, -16, -19), at(site, 16, -5))).toEqual(forecourtLoot);
        expect(site.ceilingDead).toBe(false);
    });

    it("one shot drum sets off its whole stack: the tanks between the drums carry the chain", () => {
        const { game, site } = stationGame();
        // the east stack: drums on x 19.75, tanks on x 22.76, four rows down from y -0.2
        const inStack = (o: Obstacle) => {
            const d = v2.sub(o.pos, site.pos);
            return d.x > 17.5 && d.x < 24.5 && d.y < 0 && d.y > -15;
        };
        const stack = childObstacles(game, site).filter((o) => o.def.explosion && inStack(o));
        expect(stack.map((o) => o.type).sort()).toEqual([
            ...Array(4).fill("barrel_01"),
            ...Array(4).fill("propane_01"),
        ]);
        const top = stack.find((o) => o.type === "barrel_01" && o.pos.y - site.pos.y > -3)!;
        game.damageObstacle(top, { amount: 1000, damageType: DamageType.Player, gameSourceType: "ak47" });
        stepSeconds(game, 2);
        expect(stack.filter((o) => !o.dead).map((o) => o.type)).toEqual([]);
    });

    it("the switch behind the counter opens the back office", () => {
        const { game, store } = stationGame();
        const [door] = childObstacles(game, store, GAS_STATION_OFFICE_DOOR.type);
        const [sw] = childObstacles(game, store, "switch_03");
        const p = placePlayer(game, v2.add(sw.pos, { x: -1.5, y: 0 }));
        interactObstacle(game, door, p);
        stepSeconds(game, 0.5);
        expect(door.door!.open).toBe(false);
        interactObstacle(game, sw, p);
        stepSeconds(game, 2.5);
        expect(door.door!.open).toBe(true);
    });
});
