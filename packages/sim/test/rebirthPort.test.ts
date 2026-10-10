// The container port's rebirth additions (the owner's wave 3, 2026-10-10; packages/defs rebirth/buildings/port.ts,
// portCheckpoint.ts, cargoShip.ts) on real generated maps: warehouse_complex_01 brings its checkpoint and its cargo
// ship, the ship lies on the sea beside the quay and its deck is not water, the gangway carries a player from the quay
// onto the deck, and each hidden room opens on its puzzle only (the booth's switch; red then green on the ship).
import { type Vec2, v2 } from "@rebirth/core";
import {
    CARGO_SHIP_BOW_TIP,
    CARGO_SHIP_CABIN_DOOR,
    CARGO_SHIP_CODE,
    CARGO_SHIP_GANGWAY,
    CARGO_SHIP_HULL,
    PORT_VAULT_DOOR,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri } from "../src/geom/transform.ts";
import { type Game, interactObstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds, walk } from "./buildingHelpers.ts";

/** A building-local point in world space. */
const at = (b: { pos: Vec2; ori: number }, x: number, y: number) => v2.add(b.pos, rotateOri({ x, y }, b.ori));

const MAPS = [
    ["main", 12345],
    ["main", 7],
    ["faction", 7],
] as const;

function parts(game: Game, type: string, door: string) {
    const b = findBuilding(game, type);
    const switches = childObstacles(game, b, "switch_03").filter((o) => o.puzzlePiece);
    return { b, switches, doors: childObstacles(game, b, door) };
}

describe("the container port", () => {
    for (const [map, seed] of MAPS) {
        it(`${map} ${seed}: the complex brings its checkpoint and its ship, moored on the sea`, () => {
            const game = mapGame(map, seed);
            const complexes = game.world.buildings.filter((b) => b.type === "warehouse_complex_01");
            expect(complexes.length).toBeGreaterThan(0);
            const ships = game.world.buildings.filter((b) => b.type === "cargo_ship_01");
            const posts = game.world.buildings.filter((b) => b.type === "port_checkpoint_01");
            expect([ships.length, posts.length]).toEqual([complexes.length, complexes.length]);
            const ship = ships[0];
            const H = CARGO_SHIP_HULL;
            // the bare sea around the hull, the bow and the gangway's middle (the terrain, not the deck)
            const sea = [
                [H.min.x - 0.5, H.min.y - 0.5],
                [H.max.x + 0.5, H.min.y - 0.5],
                [H.min.x - 0.5, H.max.y],
                [H.max.x + 0.5, H.max.y],
                [0, CARGO_SHIP_BOW_TIP + 0.5],
                [(CARGO_SHIP_GANGWAY.min.x + CARGO_SHIP_GANGWAY.max.x) / 2 + 0.5, CARGO_SHIP_GANGWAY.max.y + 1],
            ];
            for (const [x, y] of sea) expect([x, y, game.world.isOnWater(at(ship, x, y), 0)]).toEqual([x, y, true]);
            // the deck, the bridge house and the gangway are dry
            for (const [x, y] of [
                [0, 0],
                [-8.75, 20],
                [0, -38],
                [13, 3],
            ]) {
                expect([x, y, game.world.isOnWater(at(ship, x, y), 0)]).toEqual([x, y, false]);
            }
        });
    }

    it("the gangway carries a player from the quay onto the deck", () => {
        const game = mapGame("main", 12345);
        const ship = findBuilding(game, "cargo_ship_01");
        // on the quay, 2 units past the gangway's end, walking towards the ship (-x in its frame)
        const p = placePlayer(game, at(ship, CARGO_SHIP_GANGWAY.max.x + 2, 3));
        const inward = v2.normalize(v2.sub(at(ship, 0, 3), at(ship, 10, 3)));
        expect(game.world.isOnWater(p.pos, 0)).toBe(false);
        walk(game, p, inward, 150);
        const local = rotateOri(v2.sub(p.pos, ship.pos), (4 - ship.ori) % 4);
        expect(local.x).toBeLessThan(9);
        expect(game.world.isOnWater(p.pos, 0)).toBe(false);
    });

    it("the evidence vault opens on the booth's switch only", () => {
        const game = mapGame("main", 12345);
        const { switches, doors } = parts(game, "port_checkpoint_01", PORT_VAULT_DOOR.type);
        expect([switches.length, doors.length]).toEqual([1, 1]);
        const p = placePlayer(game, switches[0].pos);
        interactObstacle(game, doors[0], p);
        stepSeconds(game, 0.5);
        expect(doors[0].door!.open).toBe(false);
        interactObstacle(game, switches[0], p);
        stepSeconds(game, 2.5);
        expect(doors[0].door!.open).toBe(true);
    });

    it(`the captain's cabin opens on its code only (${CARGO_SHIP_CODE.join(", ")})`, () => {
        const game = mapGame("main", 12345);
        const { switches, doors } = parts(game, "cargo_ship_01", CARGO_SHIP_CABIN_DOOR.type);
        expect([switches.length, doors.length]).toEqual([CARGO_SHIP_CODE.length, 1]);
        const piece = (label: string) => switches.find((o) => o.puzzlePiece === label)!;
        const p = placePlayer(game, piece(CARGO_SHIP_CODE[0]).pos);
        interactObstacle(game, doors[0], p);
        for (const label of [...CARGO_SHIP_CODE].reverse()) interactObstacle(game, piece(label), p);
        stepSeconds(game, 3);
        expect(doors[0].door!.open).toBe(false);
        expect(switches.every((o) => o.button!.canUse && !o.button!.onOff)).toBe(true);
        for (const label of CARGO_SHIP_CODE) interactObstacle(game, piece(label), p);
        stepSeconds(game, 2.5);
        expect(doors[0].door!.open).toBe(true);
    });
});
