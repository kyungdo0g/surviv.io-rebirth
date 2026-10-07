// Sliding door panels on the client follow the simulation: the drawn panel slides from the closed spot to the open one
// at the def's openSpeed and stops exactly there, and the closed position the slot casing is drawn from is the
// simulation's, whether the door was seen closing/opening or first seen already open (survev client obstacle.ts
// door.closedPos / interpPos; server obstacle.ts toggleDoor).
import { v2 } from "@rebirth/core";
import { MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import { Game, generateMap, type Obstacle, toggleDoor } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { DoorAnim } from "../src/objects/door.ts";

const TYPES = ["lab_door_01", "lab_door_02", "teahouse_door_01"];

/** A game whose map holds only sliding doors, every type at every orientation, far apart. */
function doorGame(): { game: Game; doors: Obstacle[] } {
    const gen = generateMap("main", 12345, 1);
    const objects = TYPES.flatMap((type, t) =>
        [0, 1, 2, 3].map((ori) => ({
            id: t * 4 + ori + 1,
            kind: "obstacle" as const,
            type,
            pos: { x: 100 + ori * 20, y: 100 + t * 20 },
            ori,
            scale: 1,
            layer: 0,
            parentId: 0,
        })),
    );
    const generation = { ...gen, objects, lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    const game = new Game({ mapName: "main", seed: 1 }, { generation, spawnLoot: false });
    const doors = objects.map((o) => game.world.get(o.id) as Obstacle);
    return { game, doors };
}

function doorDef(type: string): NonNullable<ObstacleDef["door"]> {
    return (MapObjectDefs[type] as ObstacleDef).door!;
}

describe("sliding door panel animation", () => {
    const { game, doors } = doorGame();

    it.each(doors.map((d) => [`${d.type} ori ${d.ori}`, d] as const))("%s", (_name, door) => {
        const def = doorDef(door.type);
        const anim = new DoorAnim(def, door.toView());
        expect(anim.closedPos).toEqual(door.door!.closedPos);

        toggleDoor(game, door, null);
        expect(door.door!.open).toBe(true);
        anim.setData(door.toView(), undefined, false);
        // the casing stays over the closed spot while the panel slides away
        expect(v2.distance(anim.closedPos, door.door!.closedPos)).toBeLessThan(1e-9);
        const dt = 1 / 60;
        let t = 0;
        let last = v2.distance(anim.pos, door.pos);
        while (anim.moving && t < 5) {
            anim.update(dt);
            t += dt;
            const d = v2.distance(anim.pos, door.pos);
            expect(d).toBeLessThanOrEqual(last + 1e-9);
            last = d;
        }
        expect(v2.distance(anim.pos, door.pos)).toBeLessThan(1e-6);
        expect(t).toBeCloseTo(Math.abs(def.slideOffset) / def.openSpeed, 1);

        // a door first seen open still knows where its slot is
        const seenOpen = new DoorAnim(def, door.toView());
        expect(v2.distance(seenOpen.closedPos, door.door!.closedPos)).toBeLessThan(1e-9);
        expect(seenOpen.pos).toEqual(door.pos);

        toggleDoor(game, door, null);
        anim.setData(door.toView(), undefined, false);
        for (let i = 0; i < 120 && anim.moving; i++) anim.update(dt);
        expect(v2.distance(anim.pos, door.door!.closedPos)).toBeLessThan(1e-6);
    });
});
