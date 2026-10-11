// The owner's wave-3 puzzles (PR #19, 2026-10-10) in a real game, by real Use presses: an expert who knows the
// solutions walks from six units out of the first piece's front to every piece in order and presses it, inside each
// piece's 10 s window, and the hidden room opens. The gas station, church, mall, capitol, apartments, port checkpoint,
// cargo ship and subway station on the main map (12345; the subway's shutter blown first: only launcher rounds open
// it), the power plant and radar base on the 50v50 map. Before the review fixes the church's pews (punched through
// on the way between switches, brain/breakThrough.ts hurry) and the radar's ops-room door (opened across the straight
// last steps to its red switch, brain/puzzle.ts panelBetween) ran the window out. The mall's keypad (2026-10-11, 1 9 8
// 7 off the "SINCE 1987" sign) is walked to from the north concourse through the security office's door (six units
// out of its first button lie in the shut vault); seeds 1-12 solve it in 2.4-2.7 s (beginners, slips included,
// 2.7-5.8 s), where the four shop switches it replaced took about 19 s with legs up to 79 u.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { Game } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { floorGrid, pieceFront, puzzleSites } from "../src/brain/puzzleSites.ts";
import { BotController } from "../src/controller.ts";
import { rotateOri } from "../src/geom.ts";
import { PUZZLES } from "../src/knowledge/puzzles.ts";
import { installPerception } from "../src/perception/install.ts";
import { WorldModel } from "../src/perception/world.ts";
import { cachedMap, giveGun, placePlayer } from "./helpers.ts";

/** Where a site's walk starts instead (the puzzle building's own frame): the mall's north concourse by the office door. */
const STARTS: Readonly<Record<string, Vec2>> = { mall_01: { x: 2, y: 14 } };

const SITES: ReadonlyArray<readonly [string, string, number]> = [
    // map, puzzle building, most seconds an expert took over seeds 1-4 (plus slack)
    ["main", "gas_station_store_01", 3],
    ["main", "church_01", 15],
    ["main", "mall_01", 6],
    ["main", "capitol_01", 12],
    ["main", "apartment_01", 4],
    ["main", "port_checkpoint_01", 5],
    ["main", "cargo_ship_01", 6],
    ["main", "subway_platform_01", 16],
    ["faction", "power_plant_control_01", 8],
    ["faction", "radar_ops_01", 9],
];

function solve(map: string, building: string, seed: number): number {
    const game = new Game({ mapName: map, seed: 12345 }, { generation: cachedMap(map, 12345), spawnLoot: false });
    const s = puzzleSites(game.mapData).find((x) => x.entry.building === building);
    if (!s) throw new Error(`no ${building} site on ${map}`);
    for (const o of game.world.objects.values()) {
        if (o.kind === "obstacle" && o.type === "subway_gate_01")
            game.damageObstacle(o, { amount: 1e6, damageType: DamageType.Airdrop });
    }
    const first = s.pieces.find((p) => p.label === s.code[0]) ?? s.pieces[0];
    const model = new WorldModel(game.mapData);
    installPerception(model, BRAIN_PRESETS.smart);
    const grid = floorGrid(model, first.layer, first.pos);
    const front = grid ? pieceFront(s, first, grid) : null;
    if (!grid || !front) throw new Error(`no front for ${building}`);
    const start = STARTS[building];
    const b = game.world.buildings.find((x) => x.id === s.buildingId);
    const cell = grid.nearestWalkable(v2.add(front.spot, v2.mul(front.face, 6)), 4);
    const pos: Vec2 = start && b ? v2.add(b.pos, rotateOri(start, b.ori)) : cell >= 0 ? grid.center(cell) : front.spot;
    const p = placePlayer(game, `expert-${seed}`, pos);
    game.teleportPlayer(p.id, pos, first.layer);
    giveGun(p, "mp5", 90);
    // others far away: the match does not end, and nobody walks in
    for (let k = 0; k < 4; k++) placePlayer(game, `d${k}`, v2.add(pos, { x: 150 + k * 20, y: 150 }));
    const bot = new BotController(game, p.id, { seed, skill: "expert", brain: "smart" });
    bot.bot.brain.mem.puzzle.known = new Set([...PUZZLES.values()].map((e) => e.name));
    for (let t = 0; t < 4000; t++) {
        bot.update();
        game.step();
        if (b?.puzzle?.solved) return t / 100;
    }
    return -1;
}

describe("wave-3 puzzles in a game", () => {
    it.each(SITES)(
        "%s: an expert solves %s with real presses",
        (map, building, most) => {
            const t = solve(map, building, 1);
            expect(t, building).toBeGreaterThan(0);
            expect(t, building).toBeLessThan(most);
        },
        120_000,
    );
});
