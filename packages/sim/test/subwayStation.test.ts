// The abandoned subway station (the owner's wave 3, 2026-10-10; packages/defs rebirth/buildings/subway.ts): the street
// kiosk's shutter keeps everyone off the stairs until launcher rounds blow it open (bullets and grenades do nothing),
// then the stairs lead down into the dark station; the station master's safe opens on the line code only; the station
// spawns once on the normal map.
import { type Vec2, v2 } from "@rebirth/core";
import {
    DamageType,
    getMapObjectDefOfType,
    SUBWAY_CODE,
    SUBWAY_GATE,
    SUBWAY_PLATFORM,
    SUBWAY_SAFE_DOOR,
    SUBWAY_STRUCTURE,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri } from "../src/geom/transform.ts";
import { Game, interactObstacle, type Obstacle, type Structure } from "../src/index.ts";
import { generateShowcase } from "../src/mapgen/showcase.ts";
import { childObstacles, findBuilding, findStructure, placePlayer, stepSeconds, walk } from "./buildingHelpers.ts";
import { cachedMap } from "./helpers.ts";

const PLAYER_SRC = { damageType: DamageType.Player, sourceId: 0 };

function showcaseGame(): { game: Game; s: Structure } {
    const show = generateShowcase(SUBWAY_STRUCTURE);
    const game = new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot: false, sandbox: true },
    );
    return { game, s: findStructure(game, SUBWAY_STRUCTURE) };
}

const worldOf = (s: Structure, x: number, y: number): Vec2 => v2.add(s.pos, rotateOri({ x, y }, s.ori));
const localOf = (s: Structure, p: Vec2): Vec2 => rotateOri(v2.sub(p, s.pos), (4 - s.ori) % 4);

function gateOf(game: Game): Obstacle {
    const gates = [...game.world.objects.values()].filter(
        (o): o is Obstacle => o.kind === "obstacle" && o.type === SUBWAY_GATE,
    );
    expect(gates).toHaveLength(1);
    return gates[0];
}

describe("the abandoned subway station", () => {
    it("is a two-floor structure with one stair; the floor below is dark", () => {
        const def = getMapObjectDefOfType("structure", SUBWAY_STRUCTURE);
        expect(def.layers.map((l) => [l.type, l.dark ?? false])).toEqual([
            ["subway_entrance_01", false],
            [SUBWAY_PLATFORM, true],
        ]);
        expect(def.stairs).toHaveLength(1);
    });

    it("its shutter blocks the stairs until launcher rounds blow it open, then the stairs lead down", () => {
        const { game, s } = showcaseGame();
        const south = rotateOri({ x: 0, y: -1 }, s.ori);
        const gate = gateOf(game);
        // walking from the doorway onto the stairs: the shutter (y 23..24) stops the player on the street floor
        const a = placePlayer(game, worldOf(s, 0, 27));
        walk(game, a, south, 300);
        expect([a.layer, Math.abs(localOf(s, a.pos).y - 25) < 0.2]).toEqual([0, true]);
        game.teleportPlayer(a.id, worldOf(s, 0, 60), 0);
        // bullets' worth of damage, grenades and a barrel's blast: nothing
        for (const type of ["explosion_frag", "explosion_barrel"]) {
            for (let i = 0; i < 4; i++) {
                game.explosions.add(type, worldOf(s, 0, 25.5), 0, { ...PLAYER_SRC });
                game.step();
            }
        }
        game.damageObstacle(gate, { amount: 10_000, damageType: DamageType.Player, gameSourceType: "ak47" });
        expect([gate.dead, gate.health]).toEqual([false, gate.maxHealth]);
        // three RPG-7 rockets from the street side
        for (let i = 0; i < 3; i++) {
            game.explosions.add("explosion_rpg7", worldOf(s, 0, 25.5), 0, { ...PLAYER_SRC, gameSourceType: "rpg7" });
            game.step();
        }
        expect(gate.dead).toBe(true);
        // (the blasts' shrapnel settles)
        stepSeconds(game, 2);
        // now the same walk ends on the floor below, in the ticket hall
        const b = placePlayer(game, worldOf(s, 0, 27));
        walk(game, b, south, 300);
        expect([b.layer, localOf(s, b.pos).y < 16]).toEqual([1, true]);
    });

    it("the station master's safe opens on the line code only", () => {
        const { game } = showcaseGame();
        const b = findBuilding(game, SUBWAY_PLATFORM);
        const switches = childObstacles(game, b, "switch_03").filter((o) => o.puzzlePiece);
        const doors = childObstacles(game, b, SUBWAY_SAFE_DOOR.type);
        expect([switches.length, doors.length]).toEqual([SUBWAY_CODE.length, 1]);
        const piece = (label: string) => switches.find((o) => o.puzzlePiece === label)!;
        const p = placePlayer(game, piece(SUBWAY_CODE[0]).pos, 1);
        for (const label of [...SUBWAY_CODE].reverse()) interactObstacle(game, piece(label), p);
        stepSeconds(game, 3);
        expect(doors[0].door!.open).toBe(false);
        for (const label of SUBWAY_CODE) interactObstacle(game, piece(label), p);
        stepSeconds(game, 2.5);
        expect(doors[0].door!.open).toBe(true);
    });

    it("spawns once on the normal map", () => {
        for (const seed of [1, 7]) {
            const gen = cachedMap("main", seed);
            expect(gen.objects.filter((o) => o.type === SUBWAY_STRUCTURE && o.parentId === 0)).toHaveLength(1);
        }
    });
});
