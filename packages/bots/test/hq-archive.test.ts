// The HQ archive (military_hq_01, code blue, red, green; coordinator report 2026-10-10): the office door swings onto a
// table on the way from the red switch to the green one, and the bot punched the table for about 3 s while the piece
// window ran. Between a puzzle's pieces a loaded gun now shoots such an obstacle down (brain/breakThrough.ts), and an
// expert solves the archive well inside the window.
import { type Vec2, v2 } from "@rebirth/core";
import type { Game } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { floorGrid, type PuzzleSite, pieceFront, puzzleSites } from "../src/brain/puzzleSites.ts";
import { BotController } from "../src/controller.ts";
import { installPerception } from "../src/perception/install.ts";
import { WorldModel } from "../src/perception/world.ts";
import { giveGun, mainGame, placePlayer } from "./helpers.ts";

function site(game: Game): PuzzleSite {
    const s = puzzleSites(game.mapData).find((x) => x.entry.building === "military_hq_01");
    if (!s) throw new Error("no HQ site");
    return s;
}

/** An expert with an MP5 six units out from the first piece's front. */
function expertAt(game: Game, s: PuzzleSite, seed: number): BotController {
    const first = s.pieces.find((p) => p.label === s.code[0]) ?? s.pieces[0];
    const model = new WorldModel(game.mapData);
    installPerception(model, BRAIN_PRESETS.smart);
    const grid = floorGrid(model, first.layer, first.pos);
    const front = grid ? pieceFront(s, first, grid) : null;
    if (!grid || !front) throw new Error("no front");
    const cell = grid.nearestWalkable(v2.add(front.spot, v2.mul(front.face, 6)), 4);
    const pos: Vec2 = cell >= 0 ? grid.center(cell) : front.spot;
    const p = placePlayer(game, `expert-${seed}`, pos);
    game.teleportPlayer(p.id, pos, first.layer);
    giveGun(p, "mp5", 90);
    for (let k = 0; k < 4; k++) placePlayer(game, `d${k}`, v2.add(pos, { x: 150 + k * 20, y: 150 }));
    return new BotController(game, p.id, { seed, skill: "expert", brain: "smart" });
}

describe("the HQ archive", () => {
    it("an expert enters the staff code inside the piece window", () => {
        for (const seed of [1, 2, 3]) {
            const game = mainGame();
            const s = site(game);
            const bot = expertAt(game, s, seed);
            const hq = [...game.world.buildings].find((b) => b.type === "military_hq_01");
            let solvedAt = -1;
            for (let t = 0; t < 1500 && solvedAt < 0; t++) {
                bot.update();
                game.step();
                if (hq?.puzzle?.solved) solvedAt = t / 100;
            }
            expect(solvedAt, `seed ${seed}`).toBeGreaterThan(0);
            expect(solvedAt, `seed ${seed}`).toBeLessThan(9);
        }
    }, 60_000);
});
