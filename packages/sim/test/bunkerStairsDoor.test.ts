// Hydra/conch-style bunkers (bunker_structure_02/03/04) have a closed door (house_door_02, layer 3) at the foot of
// their stairs: walking down stops on the stairs until the door is opened with Interact, then the player reaches the
// underground floor. Bunkers without such a door (bunker_structure_08) go straight through.
import { Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyInput, Game, type PlayerInput } from "../src/index.ts";

function walkDown(type: string, interactAt: number | null): number[] {
    const game = new Game({ mapName: "main", seed: 1 }, { sandbox: true, spawnLoot: false });
    const id = game.addPlayer("p");
    const structure = [...game.world.objects.values()].find((o) => o.kind === "structure" && o.type === type);
    if (structure?.kind !== "structure") throw new Error(`no ${type} on main seed 1`);
    const stair = structure.stairs.find((s) => !s.lootOnly)!;
    const c = stair.collision;
    const center = { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
    const half = Math.max(c.max.x - c.min.x, c.max.y - c.min.y) / 2;
    game.teleportPlayer(
        id,
        { x: center.x - stair.downDir.x * (half + 2), y: center.y - stair.downDir.y * (half + 2) },
        0,
    );
    const base: PlayerInput = {
        ...emptyInput(0),
        moveRight: stair.downDir.x > 0.5,
        moveLeft: stair.downDir.x < -0.5,
        moveUp: stair.downDir.y > 0.5,
        moveDown: stair.downDir.y < -0.5,
    };
    const layers: number[] = [];
    for (let t = 0; t < 400; t++) {
        game.setInput(id, { ...base, seq: t, actions: t === interactAt ? [Input.Interact] : [] });
        game.step();
        const layer = game.getPlayer(id)!.layer;
        if (layers.at(-1) !== layer) layers.push(layer);
    }
    return layers;
}

describe("bunker stairs with a door at the bottom", () => {
    for (const type of ["bunker_structure_02", "bunker_structure_03", "bunker_structure_04"]) {
        it(`${type}: blocked on the stairs until the door is opened, then underground`, () => {
            expect(walkDown(type, null)).toEqual([0, 2, 3]);
            expect(walkDown(type, 150)).toEqual([0, 2, 3, 1]);
        });
    }

    it("bunker_structure_08 (no door) leads straight down", () => {
        expect(walkDown("bunker_structure_08", null)).toEqual([0, 2, 3, 1]);
    });
});
