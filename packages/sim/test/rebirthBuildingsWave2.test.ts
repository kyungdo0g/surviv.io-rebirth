// The second wave of rebirth buildings (the owner, 2026-10-08: "more buildings, the maps get bigger"; reworked
// 2026-10-10; packages/defs rebirth/buildings/): the fire station's hose tower gives the 4x view and nothing around it
// does, every hidden room opens on its puzzle (the radio station's frequency code, the one-switch rooms of the clinic,
// library, fire station and command posts), the arsenal's magazine opens 90 s into the first circle with pings, the
// 50v50 buildings stand on the front line (the arsenal beside the river, each blockhouse on its own side near it), the
// blockhouse's loopholes stop players but not bullets, the library's stacks leave no straight lane, and every sliding
// door has a wall to slide into.
import { type Collider, collider, type Vec2, v2 } from "@rebirth/core";
import {
    APARTMENT_STORE_DOOR,
    ARSENAL_UNLOCK,
    BLOCKHOUSE_CODE,
    BLOCKHOUSE_FACTIONS,
    BLOCKHOUSE_MAGAZINE_DOOR,
    CAPITOL_CODE,
    CAPITOL_VAULT_DOOR,
    CLINIC_SAFE_DOOR,
    FIRESTATION_CAGE_DOOR,
    FIRESTATION_TOWER,
    GameConfig,
    getMapObjectDef,
    getMapObjectDefOfType,
    LIBRARY_CODE,
    LIBRARY_LAYOUT,
    LIBRARY_SECRET_DOOR,
    LIBRARY_SHELVES,
    LOOKOUT_ZOOM,
    MILITARY_HQ_ARCHIVE_DOOR,
    MILITARY_HQ_CODE,
    OUTPOST_ARMORY_DOOR,
    PLANT_CODE,
    PLANT_STRONGROOM_DOOR,
    RADIO_CODE,
    RADIO_VAULT_DOOR,
    REBIRTH_BUILDING_UNLOCKS,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri, transformOri } from "../src/geom/transform.ts";
import { Game, interactObstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds, walk } from "./buildingHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** A building-local point in world space. */
const at = (b: { pos: Vec2; ori: number }, x: number, y: number) => v2.add(b.pos, rotateOri({ x, y }, b.ori));

/** The share of `box` inside the union of the wall boxes (sampled every 0.05 unit). */
function shareInWalls(box: { min: Vec2; max: Vec2 }, walls: ReadonlyArray<{ min: Vec2; max: Vec2 }>): number {
    let n = 0;
    let inside = 0;
    for (let x = box.min.x + 0.025; x < box.max.x; x += 0.05) {
        for (let y = box.min.y + 0.025; y < box.max.y; y += 0.05) {
            n++;
            if (walls.some((w) => x >= w.min.x && x <= w.max.x && y >= w.min.y && y <= w.max.y)) inside++;
        }
    }
    return inside / n;
}

describe("sliding doors", () => {
    it("slide into a wall of their building (open, 0.25 or less left in the doorway)", () => {
        const expected: Readonly<Record<string, number>> = {
            clinic_01: 1,
            radio_station_01: 1,
            library_01: 1,
            arsenal_01: 2,
            blockhouse_01r: 1,
            blockhouse_01b: 1,
            military_hq_01: 1,
            military_hq_01r: 1,
            military_hq_01b: 1,
            military_infirmary_01: 1,
            // the war chest's door (Command's lab doors slide into the basement's walls: militaryBase.test.ts)
            military_bunker_command_01: 1,
            // the mall's four automatic doors and its vault door (wave 3)
            mall_01: 5,
            // the power plant's strongroom (wave 3)
            power_plant_control_01: 1,
            // the governor's vault (wave 3)
            capitol_01: 1,
            // wave 3 (2026-10-10): the apartment's storeroom
            apartment_01: 1,
            // the container port's evidence vault and captain's cabin (wave 3)
            port_checkpoint_01: 1,
            cargo_ship_01: 1,
            // the subway station master's safe (wave 3)
            subway_platform_01: 1,
        };
        const own = (type: string, door: string) => type !== "military_bunker_command_01" || door !== "lab_door_01";
        for (const [type, count] of Object.entries(expected)) {
            const def = getMapObjectDefOfType("building", type);
            const walls: Array<{ min: Vec2; max: Vec2 }> = [];
            const doors: Array<{ col: Collider; type: string }> = [];
            for (const c of def.mapObjects) {
                if (typeof c.type !== "string") continue;
                const d = getMapObjectDef(c.type);
                if (d.type !== "obstacle") continue;
                if (/_wall_ext_|^rebirth_wall_int_/.test(c.type))
                    walls.push(collider.toAabb(transformOri(d.collision, c.pos, c.ori, 1)));
                if (d.door?.slideToOpen && own(type, c.type)) {
                    const slid = v2.add(c.pos, rotateOri({ x: 0, y: -d.door.slideOffset }, c.ori));
                    doors.push({ col: transformOri(d.collision, slid, c.ori, 1), type: c.type });
                }
            }
            expect([type, doors.length]).toEqual([type, count]);
            for (const door of doors) {
                // survev's panels keep 0.25 of 4 in the doorway when open
                const share = shareInWalls(collider.toAabb(door.col), walls);
                expect([type, door.type, share >= 0.93]).toEqual([type, door.type, true]);
            }
        }
    });
});

describe("the hidden rooms", () => {
    /** The building's switches (puzzle pieces) and its hidden room's doors. */
    const parts = (game: Game, type: string, door: string) => {
        const b = findBuilding(game, type);
        const switches = childObstacles(game, b, "switch_03").filter((o) => o.puzzlePiece);
        return { b, switches, doors: childObstacles(game, b, door) };
    };

    // [map, seed, building, its hidden room's door type, the code]
    const CODES = [
        ["main", 12345, "radio_station_01", RADIO_VAULT_DOOR.type, RADIO_CODE],
        ["main", 12345, "library_01", LIBRARY_SECRET_DOOR.type, LIBRARY_CODE],
        ["main", 12345, "military_hq_01", MILITARY_HQ_ARCHIVE_DOOR.type, MILITARY_HQ_CODE],
        // (the mall's keypad, with its decoy button, has its own file: mallKeypad.test.ts)
        ["faction", 7, "blockhouse_01r", BLOCKHOUSE_MAGAZINE_DOOR.type, BLOCKHOUSE_CODE],
        ["faction", 7, "blockhouse_01b", BLOCKHOUSE_MAGAZINE_DOOR.type, BLOCKHOUSE_CODE],
        ["faction", 7, "power_plant_control_01", PLANT_STRONGROOM_DOOR.type, PLANT_CODE],
        ["main", 12345, "capitol_01", CAPITOL_VAULT_DOOR.type, CAPITOL_CODE],
    ] as const;
    for (const [map, seed, type, door, code] of CODES) {
        it(`${type}'s hidden room opens on its code only (${code.join(", ")})`, () => {
            const game = mapGame(map, seed);
            const { switches, doors } = parts(game, type, door);
            expect([switches.length, doors.length]).toEqual([code.length, 1]);
            const piece = (label: string) => switches.find((o) => o.puzzlePiece === label)!;
            const p = placePlayer(game, piece(code[0]).pos);
            // a wrong order (the code backwards): an error, the switches reset, the room stays shut
            for (const label of [...code].reverse()) interactObstacle(game, piece(label), p);
            stepSeconds(game, 3);
            expect(doors[0].door!.open).toBe(false);
            expect(switches.every((o) => o.button!.canUse && !o.button!.onOff)).toBe(true);
            for (const label of code) interactObstacle(game, piece(label), p);
            stepSeconds(game, 1.5);
            expect(doors[0].door!.open).toBe(false);
            stepSeconds(game, 1);
            expect(doors[0].door!.open).toBe(true);
        });
    }

    it("the clinic's safe, the fire station's cage, each command post's armory and the military armory's cage and infirmary store open on their switch", () => {
        const cases = [
            ["main", 12345, "clinic_01", CLINIC_SAFE_DOOR.type],
            ["main", 12345, "military_armory_01", "cell_door_01"],
            ["main", 12345, "military_infirmary_01", "vault_door_bathhouse"],
            ["main", 12345, "firestation_01", FIRESTATION_CAGE_DOOR.type],
            ["faction", 7, "outpost_01r", OUTPOST_ARMORY_DOOR.type],
            ["faction", 7, "outpost_01b", OUTPOST_ARMORY_DOOR.type],
            // wave 3 (2026-10-10): the apartment's storeroom
            ["main", 12345, "apartment_01", APARTMENT_STORE_DOOR.type],
        ] as const;
        for (const [map, seed, type, door] of cases) {
            const game = mapGame(map, seed);
            const { switches, doors } = parts(game, type, door);
            expect([type, switches.length, doors.length]).toEqual([type, 1, 1]);
            // the door ignores Interact: only the switch opens it
            const p = placePlayer(game, switches[0].pos);
            interactObstacle(game, doors[0], p);
            stepSeconds(game, 0.5);
            expect([type, doors[0].door!.open]).toEqual([type, false]);
            interactObstacle(game, switches[0], p);
            stepSeconds(game, 2.5);
            expect([type, doors[0].door!.open]).toEqual([type, true]);
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
    it("its stacks leave no straight east-west lane and 4-unit aisles between the shelves", () => {
        const shelf = getMapObjectDef("bookshelf_01");
        if (shelf.type !== "obstacle") throw new Error("obstacles");
        const blocks = LIBRARY_SHELVES.map(([x, y]) => collider.toAabb(transformOri(shelf.collision, { x, y }, 1, 1)));
        const hall = LIBRARY_LAYOUT.rooms.find((r) => r.floor === "stacks")!;
        for (let y = hall.min.y + 0.6; y < hall.max.y - 0.6; y += 0.25) {
            const crossing = blocks.some((b) => y >= b.min.y && y <= b.max.y);
            expect([y, crossing]).toEqual([y, true]);
        }
        const xs = LIBRARY_SHELVES.map(([x]) => x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] - 2).toBeGreaterThanOrEqual(4);
    });
});
