// The blast bunker (bunker_blast_01, packages/defs rebirth/buildings/blastBunker.ts; the owner's wave 3, 2026-10-10:
// "an underground bunker only strong firepower like the M202 can open"): the entrance's blast door keeps everyone out
// of the stairs, and so out of the basement, until an M202 rocket goes off at it; then the stairs lead down to the vault
// complex. The explosion gate itself is tested in explosionGate.test.ts.
import { type Vec2, v2 } from "@rebirth/core";
import { BLAST_BUNKER, BLAST_BUNKER_DOOR, DamageType, Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyInput, Game, type Obstacle } from "../src/index.ts";
import { generateShowcase } from "../src/mapgen/showcase.ts";

function bunkerGame(): { game: Game; door: Obstacle; origin: Vec2 } {
    const show = generateShowcase(BLAST_BUNKER);
    const game = new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot: false, sandbox: true },
    );
    // the showcase stands the structure at ori 0: its frame is the world's, moved to its position
    expect(show.object.ori).toBe(0);
    const origin = show.object.pos;
    const doorPos = v2.add(origin, BLAST_BUNKER_DOOR.pos);
    const door = [...game.world.objects.values()].find(
        (o): o is Obstacle =>
            o.kind === "obstacle" && o.type === BLAST_BUNKER_DOOR.type && v2.distance(o.pos, doorPos) < 0.01,
    );
    if (!door) throw new Error("no blast door");
    return { game, door, origin };
}

/**
 * Walks player `id` north from 6 units south of the blast door for `ticks` ticks (Interact every 25 ticks: the steel
 * door at the stairs' foot); the floors it went through and where it ended (structure frame).
 */
function walkIn(game: Game, id: number, origin: Vec2, ticks: number): { layers: number[]; y: number } {
    game.teleportPlayer(id, v2.add(origin, { x: 0, y: BLAST_BUNKER_DOOR.pos.y - 6 }), 0);
    const layers: number[] = [];
    for (let t = 0; t < ticks; t++) {
        const actions = t % 25 === 24 ? [Input.Interact] : [];
        game.setInput(id, { ...emptyInput(0), moveUp: true, seq: game.tick + 1, actions });
        game.step();
        const layer = game.getPlayer(id)!.layer;
        if (layers.at(-1) !== layer) layers.push(layer);
    }
    return { layers, y: game.getPlayer(id)!.pos.y - origin.y };
}

describe("the blast bunker", () => {
    it("keeps everyone out until an M202 rocket blows its door, then the stairs lead down to the vault", () => {
        const { game, door, origin } = bunkerGame();
        const id = game.addPlayer("walker");
        const shut = walkIn(game, id, origin, 300);
        expect(shut.layers).toEqual([0]);
        expect(shut.y).toBeLessThan(BLAST_BUNKER_DOOR.pos.y - 0.75);

        // well out of the blasts' reach (explosion_m202 rad.max 16)
        game.teleportPlayer(id, v2.add(origin, { x: 0, y: -40 }), 0);
        const at = v2.add(door.pos, { x: 0, y: -3 });
        // a frag does nothing (explosionGate hitsToOpen: explosionGate.test.ts tries the rest); one M202 rocket 3 u out
        // opens it
        game.explosions.add("explosion_frag", at, 0, { damageType: DamageType.Player, sourceId: 0 });
        game.step();
        expect(door.dead).toBe(false);
        game.explosions.add("explosion_m202", at, 0, {
            damageType: DamageType.Player,
            sourceId: 0,
            gameSourceType: "m202",
        });
        game.step();
        expect(door.dead).toBe(true);

        const open = walkIn(game, id, origin, 600);
        expect(open.layers).toEqual([0, 2, 3, 1]);
        // past the stairs' foot, inside the vault complex (y 3..31)
        expect(open.y).toBeGreaterThan(3);
    });
});
