// The second wave of rebirth buildings (the owner, 2026-10-08: "more buildings, the maps get bigger"; packages/defs
// rebirth/buildings/): the fire station's hose tower gives the 4x view and nothing around it does, the radio station's
// panel seals the transmitter hall's sliding doors for 10 s, the arsenal's magazine opens 90 s into the first circle
// with pings, the 50v50 buildings stand on the front line (the arsenal beside the river, each blockhouse on its own
// side near it), the blockhouse's loopholes stop players but not bullets, the library's stacks leave no straight lane,
// and every sliding door has a wall to slide into.
import { type Collider, collider, type Vec2, v2 } from "@rebirth/core";
import {
    ARSENAL_UNLOCK,
    BLOCKHOUSE_FACTIONS,
    FIRESTATION_TOWER,
    GameConfig,
    getMapObjectDef,
    getMapObjectDefOfType,
    LIBRARY_LAYOUT,
    LIBRARY_SHELVES,
    LOOKOUT_ZOOM,
    REBIRTH_BUILDING_UNLOCKS,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri, transformOri } from "../src/geom/transform.ts";
import { Game, interactObstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds, walk } from "./buildingHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** A building-local point in world space. */
const at = (b: { pos: Vec2; ori: number }, x: number, y: number) => v2.add(b.pos, rotateOri({ x, y }, b.ori));

describe("sliding doors", () => {
    it("slide into a wall of their building (lab doors: 3.75 along their local -y, 0.25 left in the doorway)", () => {
        for (const type of ["radio_station_01", "arsenal_01"]) {
            const def = getMapObjectDefOfType("building", type);
            const walls: Collider[] = [];
            const doors: Array<{ col: Collider; type: string }> = [];
            for (const c of def.mapObjects) {
                if (typeof c.type !== "string") continue;
                const d = getMapObjectDef(c.type);
                if (d.type !== "obstacle") continue;
                if (/_wall_ext_/.test(c.type)) walls.push(transformOri(d.collision, c.pos, c.ori, 1));
                if (d.door?.slideToOpen) {
                    const slid = { ...c.pos, ...v2.add(c.pos, rotateOri({ x: 0, y: -d.door.slideOffset }, c.ori)) };
                    doors.push({ col: transformOri(d.collision, slid, c.ori, 1), type: c.type });
                }
            }
            expect(doors.length, type).toBe(2);
            for (const door of doors) {
                // survev's panels keep 0.25 in the doorway when open
                const box = collider.toAabb(door.col);
                const tol = 0.3;
                const covered = walls.some((w) => {
                    const wb = collider.toAabb(w);
                    return (
                        box.min.x >= wb.min.x - tol &&
                        box.max.x <= wb.max.x + tol &&
                        box.min.y >= wb.min.y - tol &&
                        box.max.y <= wb.max.y + tol
                    );
                });
                expect([type, door.type, covered]).toEqual([type, door.type, true]);
            }
        }
    });
});

describe("the fire station", () => {
    it("gives the 4x view in the hose tower only", () => {
        const game = mapGame("main", 12345);
        const station = findBuilding(game, "firestation_01");
        const tower = FIRESTATION_TOWER;
        const p = placePlayer(game, at(station, (tower.min.x + tower.max.x) / 2, (tower.min.y + tower.max.y) / 2));
        stepSeconds(game, 0.2);
        expect(p.zoom).toBe(LOOKOUT_ZOOM);
        // the crew room against the tower's walls and the apparatus bay keep the indoor view
        for (const [x, y] of [
            [16.5, 5],
            [12, 9.5],
            [-8, 0],
        ]) {
            game.teleportPlayer(p.id, at(station, x, y), 0);
            stepSeconds(game, 0.2);
            expect([x, y, p.zoom < LOOKOUT_ZOOM]).toEqual([x, y, true]);
        }
    });
});

describe("the radio station", () => {
    it("its panel closes and locks the transmitter hall's two sliding doors for 10 s, then restores them", () => {
        const game = mapGame("main", 12345);
        const station = findBuilding(game, "radio_station_01");
        const [panel] = childObstacles(game, station, "control_panel_07sv");
        const doors = childObstacles(game, station, "lab_door_01");
        expect(doors.length).toBe(2);
        // a player at the lobby door opens it (automatic)
        const p = placePlayer(game, at(station, 0, -5));
        stepSeconds(game, 1);
        expect(doors.some((d) => d.door?.open)).toBe(true);
        game.teleportPlayer(p.id, at(station, 0.5, 6.4), 0);
        interactObstacle(game, panel, p);
        stepSeconds(game, 1);
        for (const d of doors) expect(d.door).toMatchObject({ open: false, locked: true });
        stepSeconds(game, 10);
        for (const d of doors) expect(d.door?.locked).toBe(false);
    });
});

describe("the arsenal", () => {
    it("spawns once per 50v50 map and opens its magazine 90 s into the first circle, one door a second, with pings", () => {
        expect(REBIRTH_BUILDING_UNLOCKS).toEqual({ faction: [ARSENAL_UNLOCK] });
        expect(ARSENAL_UNLOCK).toEqual({ type: "arsenal_01", stagger: 1, circleIdx: 0, wait: 90 });
        const game = new Game(
            { mapName: "faction", seed: 7, teamMode: 4 },
            { generation: cachedMap("faction", 7, 4), spawnLoot: false, minPlayers: 1 },
        );
        const arsenal = findBuilding(game, "arsenal_01");
        const doors = childObstacles(game, arsenal, "lab_door_locked_01");
        expect(doors.length).toBe(2);
        for (const d of doors) expect(d.door).toMatchObject({ locked: true, open: false });
        const id = game.addPlayer("watcher");
        game.rules.minActiveTime = 0;
        let circle0Tick = -1;
        const openedAt: number[] = [];
        for (let i = 0; i < 130 * 100 && openedAt.length < doors.length; i++) {
            game.step();
            if (circle0Tick < 0 && game.gas.circleIdx === 0) circle0Tick = game.tick;
            const open = doors.filter((d) => d.door?.open).length;
            while (openedAt.length < open) openedAt.push(game.tick);
        }
        expect(openedAt).toHaveLength(2);
        // 90 s, then one door per stagger (1 s)
        const secs = openedAt.map((t) => (t - circle0Tick) / 100);
        expect(secs[0]).toBeGreaterThan(90);
        expect(secs[0]).toBeLessThan(92.5);
        expect(secs[1] - secs[0]).toBeCloseTo(1, 1);
        for (const d of doors) expect(d.door).toMatchObject({ locked: false, open: true });
        const pings = (game.getSnapshot(id).mapIndicators ?? []).filter((m) => m.type === "ping_unlock");
        expect(pings.length).toBe(2);
    }, 60_000);
});

describe("the 50v50 front line", () => {
    it("puts the arsenal beside the river and each blockhouse on its own side near it", () => {
        for (const seed of [1, 7, 12345]) {
            const generation = cachedMap("faction", seed, 4);
            const game = new Game({ mapName: "faction", seed, teamMode: 4 }, { generation, spawnLoot: false });
            const faction = game.faction!;
            const w = game.mapData.width;
            const centre = { x: w / 2, y: game.mapData.height / 2 };
            const redBand = faction.spawnBand(1);
            const redCentre = v2.mul(v2.add(redBand.min, redBand.max), 0.5);
            // the axis across the river, and Red's side on it
            const axis = Math.abs(redCentre.x - centre.x) > Math.abs(redCentre.y - centre.y) ? "x" : "y";
            const redSign = Math.sign(redCentre[axis] - centre[axis]);
            const offset = (pos: Vec2) => (pos[axis] - centre[axis]) / w;
            const top = generation.objects.filter((o) => o.parentId === 0);
            const arsenal = top.filter((o) => o.type === "arsenal_01");
            expect(arsenal, `seed ${seed}`).toHaveLength(1);
            // a tenth beside the split line: within 0.1 of the map's width
            expect(Math.abs(offset(arsenal[0].pos)), `seed ${seed}`).toBeLessThan(0.1);
            for (const f of BLOCKHOUSE_FACTIONS) {
                const houses = top.filter((o) => o.type === f.id);
                expect(houses, `${f.id} seed ${seed}`).toHaveLength(2);
                const sign = f.teamId === 1 ? redSign : -redSign;
                for (const h of houses) {
                    const d = offset(h.pos) * sign;
                    // its own side, within two tenths of the line (the spawn bands are the outer tenths)
                    expect([f.id, seed, d > 0, d < 0.2]).toEqual([f.id, seed, true, true]);
                }
            }
        }
    });
});

describe("the blockhouse", () => {
    it("has loopholes bullets fly through and players cannot cross, and the 4x view inside", () => {
        const slit = getMapObjectDef("brick_wall_ext_3_0_low");
        if (slit.type !== "obstacle") throw new Error("brick_wall_ext_3_0_low");
        expect(slit.collidable).toBe(true);
        expect(slit.height).toBeLessThan(GameConfig.bullet.height);
        const game = mapGame("faction", 7, 1);
        const house = game.world.buildings.find((b) => b.type === "blockhouse_01r")!;
        // walk at the west loophole (local -10.5, 5.5) from inside: stopped by it
        const p = placePlayer(game, at(house, -8.5, 5.5));
        stepSeconds(game, 0.1);
        expect(p.zoom).toBe(LOOKOUT_ZOOM);
        const west = rotateOri({ x: -1, y: 0 }, house.ori);
        walk(game, p, west, 150);
        const local = rotateOri(v2.sub(p.pos, house.pos), (4 - house.ori) & 3);
        expect(local.x).toBeGreaterThan(-10.5);
    });
});

describe("the library", () => {
    it("its stacks leave no straight east-west lane and 3-unit aisles between the shelves", () => {
        const shelf = getMapObjectDef("bookshelf_01");
        const column = getMapObjectDef("house_column_1");
        if (shelf.type !== "obstacle" || column.type !== "obstacle") throw new Error("obstacles");
        const blocks = [
            ...LIBRARY_SHELVES.map(([x, y]) => collider.toAabb(transformOri(shelf.collision, { x, y }, 1, 1))),
            ...[
                [-3, 7],
                [7, 7],
                [-8, 4],
                [2, 4],
            ].map(([x, y]) => collider.toAabb(transformOri(column.collision, { x, y }, 0, 1))),
        ];
        const hall = LIBRARY_LAYOUT.rooms.find((r) => r.floor === "stacks")!;
        for (let y = hall.min.y + 0.6; y < hall.max.y - 0.6; y += 0.25) {
            const crossing = blocks.some((b) => y >= b.min.y && y <= b.max.y);
            expect([y, crossing]).toEqual([y, true]);
        }
        const xs = LIBRARY_SHELVES.map(([x]) => x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] - 2).toBeGreaterThanOrEqual(3);
    });
});
