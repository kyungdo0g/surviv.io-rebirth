// Doors (M5b): Interact opens a hinged door away from the opener and closes it again, the open panel still blocks
// where it now stands, sliding doors move along their axis, automatic doors open for players nearby and close after
// their delay (postponed while someone stands in the doorway), one-way and open-once doors, open delays, locked doors
// waiting for an unlock, punching doors, destroying them, doors next to stairs.
import { math, type Vec2, v2 } from "@rebirth/core";
import { DamageType, Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    DOOR_USE_COOLDOWN,
    emptyInput,
    type Game,
    type Obstacle,
    type Player,
    toggleDoor,
    unlockDoor,
} from "../src/index.ts";
import {
    childObstacles,
    findBuilding,
    findStructure,
    interact,
    mapGame,
    placePlayer,
    stairCenter,
    walk,
} from "./buildingHelpers.ts";
import { flatGame, openSpot, steps } from "./combatHelpers.ts";

/** A flat game with one door at `pos` (hinge) and its spot. */
function doorGame(type: string, ori = 0): { game: Game; door: Obstacle; hinge: Vec2 } {
    const probe = flatGame();
    const hinge = v2.add(openSpot(probe, 30), { x: 10, y: 0 });
    const game = flatGame([{ type, pos: hinge, ori }]);
    return { game, door: game.world.get(1) as Obstacle, hinge };
}

function boxCenter(o: Obstacle): Vec2 {
    const c = o.collider;
    if (c.type === 0) return v2.copy(c.pos);
    return { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
}

describe("hinged doors", () => {
    it("open away from the player on Interact and close back to their closed orientation", () => {
        // ori 0: the panel runs from the hinge 4 units along +y; its +x side is the "player side -1" side
        for (const side of [1, -1]) {
            const { game, door, hinge } = doorGame("house_door_01");
            // within reach of the closed panel and of the open one (rad 1 + interactionRad 0.75)
            const p = placePlayer(game, v2.add(hinge, { x: 1.4 * side, y: 0.9 }));
            interact(game, p);
            expect(door.door?.open).toBe(true);
            expect(door.door?.seq).toBe(1);
            // the panel swung to the side opposite the player and the hinge stayed put
            expect(Math.sign(boxCenter(door).x - hinge.x)).toBe(-side);
            expect(door.pos).toEqual(hinge);
            expect(door.ori).toBe(side > 0 ? 1 : 3);
            expect(door.toView()).toMatchObject({ ori: door.ori, door: { open: true, seq: 1 } });
            // Interact again (after the 0.1 s cooldown) closes it
            steps(game, Math.ceil(DOOR_USE_COOLDOWN * 100));
            interact(game, p);
            expect(door.door?.open).toBe(false);
            expect(door.ori).toBe(0);
        }
    });

    it("refuse a second use within the 0.1 s cooldown", () => {
        const { game, door, hinge } = doorGame("house_door_01");
        const p = placePlayer(game, v2.add(hinge, { x: 1.6, y: 2 }));
        game.setInput(p.id, { ...emptyInput(), actions: [Input.Interact, Input.Interact] });
        game.step();
        expect(door.door?.open).toBe(true);
        expect(door.door?.seq).toBe(1);
    });

    it("block movement while closed, let the player through the doorway once open, block where the panel swung", () => {
        const { game, door, hinge } = doorGame("house_door_01");
        const p = placePlayer(game, v2.add(hinge, { x: 3, y: 2 }));
        walk(game, p, { x: -1, y: 0 }, 100);
        // stopped by the closed panel (x in hinge +-0.3) at the player's radius
        expect(p.pos.x).toBeCloseTo(hinge.x + 0.3 + p.rad, 2);
        interact(game, p);
        expect(door.door?.open).toBe(true);
        walk(game, p, { x: -1, y: 0 }, 100);
        expect(p.pos.x).toBeLessThan(hinge.x - 3);
        // the open panel lies along y = hinge.y, from hinge.x - 4 to hinge.x: walking down into it is blocked
        game.teleportPlayer(p.id, v2.add(hinge, { x: -2, y: 2 }));
        walk(game, p, { x: 0, y: -1 }, 100);
        expect(p.pos.y).toBeCloseTo(hinge.y + 0.3 + p.rad, 2);
        expect(door.blocking).toBe(true);
    });

    it("are opened by punching them (changelog 0.2.6)", () => {
        const { game, door, hinge } = doorGame("house_door_01");
        const p = placePlayer(game, v2.add(hinge, { x: 1.4, y: 2 }), 0, { x: -1, y: 0 });
        game.setInput(p.id, { ...emptyInput(), toMouseDir: { x: -1, y: 0 }, shootStart: true, shootHold: true });
        steps(game, 40);
        expect(door.door?.open).toBe(true);
        expect(door.health).toBeLessThan(door.maxHealth);
    });

    it("destructible doors break and stop blocking; metal doors do not", () => {
        const wood = doorGame("house_door_01");
        wood.game.damageObstacle(wood.door, { amount: 1000, damageType: DamageType.Player });
        expect(wood.door.dead).toBe(true);
        expect(wood.door.blocking).toBe(false);
        expect(wood.door.interactable).toBe(false);
        const metal = doorGame("house_door_02");
        metal.game.damageObstacle(metal.door, { amount: 1000, damageType: DamageType.Player });
        expect(metal.door.dead).toBe(false);
    });

    it("vault doors open once, after their 4.1 s delay, always to the same side", () => {
        const { game, door, hinge } = doorGame("vault_door_main");
        const p = placePlayer(game, v2.add(hinge, { x: -2.2, y: 3.5 }));
        interact(game, p);
        expect(door.door).toMatchObject({ open: false, canUse: false, seq: 1 });
        steps(game, 405);
        expect(door.door?.open).toBe(false);
        steps(game, 10);
        expect(door.door?.open).toBe(true);
        // openOneWay -1: ori - (-1), whatever side the player stood on
        expect(door.ori).toBe(1);
        steps(game, 20);
        interact(game, p);
        steps(game, 500);
        expect(door.door?.open).toBe(true);
    });

    it("doors only buttons or puzzles move ignore Interact", () => {
        const { game, door, hinge } = doorGame("cell_door_01");
        const p = placePlayer(game, v2.add(hinge, { x: 1.6, y: 2 }));
        interact(game, p);
        expect(door.door?.open).toBe(false);
        toggleDoor(game, door, null);
        // no player: side -1 (survev toggleDoor)
        expect(door.door?.open).toBe(true);
        expect(door.ori).toBe(1);
    });
});

describe("sliding doors", () => {
    it("move by slideOffset along their local y axis and back", () => {
        const { game, door, hinge } = doorGame("teahouse_door_01", 1);
        const p = placePlayer(game, v2.add(hinge, { x: -2, y: 2.5 }));
        interact(game, p);
        expect(door.door?.open).toBe(true);
        // ori 1 turns local (0, -3.75) into (3.75, 0)
        expect(door.pos.x).toBeCloseTo(hinge.x + 3.75, 9);
        expect(door.pos.y).toBeCloseTo(hinge.y, 9);
        expect(door.ori).toBe(1);
        steps(game, 20);
        interact(game, p);
        expect(door.door?.open).toBe(false);
        expect(door.pos).toEqual(hinge);
    });
});

describe("automatic doors", () => {
    function approach(game: Game, door: Obstacle, from: number): Player {
        return placePlayer(game, v2.add(door.pos, { x: 2.8 * from, y: 2 }));
    }

    it("open for a nearby player and close 1 s after the doorway is clear", () => {
        const { game, door } = doorGame("lab_door_01");
        const p = approach(game, door, 1);
        game.step();
        expect(door.door?.open).toBe(true);
        // standing in the doorway keeps it open past the 1 s delay
        steps(game, 250);
        expect(door.door?.open).toBe(true);
        // once clear, it closes at the next check (at most autoCloseDelay later)
        game.teleportPlayer(p.id, v2.add(door.door!.closedPos, { x: 12, y: 0 }));
        steps(game, 101);
        expect(door.door?.open).toBe(false);
        expect(door.pos).toEqual(door.door?.closedPos);
        // a player passing by: open now, closed exactly autoCloseDelay (1 s) later
        game.teleportPlayer(p.id, v2.add(door.door!.closedPos, { x: 2.8, y: 2 }));
        game.step();
        expect(door.door?.open).toBe(true);
        game.teleportPlayer(p.id, v2.add(door.door!.closedPos, { x: 12, y: 0 }));
        steps(game, 98);
        expect(door.door?.open).toBe(true);
        steps(game, 2);
        expect(door.door?.open).toBe(false);
    });

    it("one-way doors only open from their side", () => {
        const { game, door } = doorGame("lab_door_02");
        // openOneWay 1: the player must be on the side where playerSide() is 1 (the door's -x side at ori 0)
        const wrong = approach(game, door, 1);
        steps(game, 5);
        expect(door.door?.open).toBe(false);
        game.removePlayer(wrong.id);
        approach(game, door, -1);
        steps(game, 1);
        expect(door.door?.open).toBe(true);
    });

    it("locked doors stay shut until unlocked, then open for good with a map ping", () => {
        const { game, door } = doorGame("lab_door_locked_01");
        const p = approach(game, door, 1);
        steps(game, 50);
        interact(game, p);
        expect(door.door).toMatchObject({ open: false, locked: true });
        unlockDoor(game, door);
        expect(door.door).toMatchObject({ open: true, locked: false, canUse: false });
        game.teleportPlayer(p.id, v2.add(door.pos, { x: 30, y: 0 }));
        steps(game, 500);
        expect(door.door?.open).toBe(true);
        const snap = game.getSnapshot(p.id);
        expect(snap.mapIndicators?.map((m) => m.type)).toEqual(["ping_unlock"]);
    });
});

describe("the mansion's secret room", () => {
    it("hides behind the bookshelf door (house_door_03), opened like any wooden door or broken", () => {
        const game = mapGame("main", 4242);
        const mansion = findBuilding(game, "mansion_01");
        const [shelf] = childObstacles(game, mansion, "house_door_03");
        expect(shelf.def.img.sprite).toBe("map-door-03.img");
        expect(shelf.layer).toBe(0);
        // stand beside the panel (it runs along the door's local +y axis from the hinge), on its local +x side
        const local = v2.rotate({ x: 1.6, y: 1 }, math.oriToRad(shelf.ori));
        const p = placePlayer(game, v2.add(shelf.pos, local));
        interact(game, p);
        expect(shelf.door?.open).toBe(true);
        game.damageObstacle(shelf, { amount: 1000, damageType: DamageType.Player });
        expect(shelf.dead).toBe(true);
    });
});

describe("doors next to stairs", () => {
    it("take a stairs layer so both floors collide with them, and open on the way down", () => {
        const game = mapGame();
        const storm = findStructure(game, "bunker_structure_03");
        const sublevel = game.world.get(storm.layerObjIds[1]);
        if (sublevel?.kind !== "building") throw new Error("expected the sublevel building");
        const [door] = childObstacles(game, sublevel, "house_door_02");
        expect(door.originalLayer).toBe(1);
        expect(door.layer).toBe(3);
        const stair = storm.stairs[0];
        const p = placePlayer(game, v2.sub(stairCenter(storm), v2.mul(stair.downDir, 6)));
        walk(game, p, stair.downDir, 300, 50);
        expect(door.door?.open).toBe(true);
        expect(p.layer).toBe(1);
    });
});
