// MOVE (bot overhaul) end to end in the simulation, default brain (smart, BrainFeatures.pursuit): an armed bot gives
// up a melee runner it cannot catch (user report 11), a fist chase ends (report 10), an unarmed bot chased out of a house by an armed player goes
// elsewhere and does not walk back in (report 14), a fleeing bot hides behind cover (MOVE-3). Four idle players far
// away keep more than three alive (a fight with three left is fought to the end). Owner: MOVE.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef } from "@rebirth/defs";
import type { Game, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { flatGame, giveGun, mainGame, placePlayer } from "./helpers.ts";

function dummies(game: Game, at: Vec2): void {
    for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, v2.add(at, { x: k * 20, y: 0 }));
}

/** Holds a scripted player still (its inputs from the last step are cleared). */
function still(p: Player): void {
    p.input = { ...p.input, moveLeft: false, moveRight: false, moveUp: false, moveDown: false };
}

describe("MOVE scenarios", () => {
    it("an armed bot stops chasing a melee runner it cannot catch within its patience", () => {
        // a dry corridor on the flat terrain: y = 420, x 50..470 (horizontal: the runner stays on the screen)
        for (const seed of [1, 2]) {
            const game = flatGame({ minPlayers: 99 });
            const p = placePlayer(game, "bot", { x: 70, y: 420 });
            giveGun(p, "m870", 30);
            const runner = placePlayer(game, "runner", { x: 86, y: 420 });
            dummies(game, { x: 600, y: 120 });
            const bot = new BotController(game, p.id, { seed });
            let firstEnd = -1;
            let fighting = false;
            let resumed = -1;
            for (let i = 0; i < 3000; i++) {
                bot.update();
                const d = v2.distance(p.pos, runner.pos);
                still(runner);
                // it runs whenever the bot comes within 40 units (fists: 13 u/s against a gun holder's 12)
                if (d < 40 && runner.pos.x < 465) runner.input = { ...runner.input, moveRight: true };
                game.step();
                const it = bot.bot.intent;
                const now = it.behaviour === "fight" && it.targetId === runner.id;
                if (fighting && !now && firstEnd < 0) firstEnd = i / 100;
                if (!fighting && now && firstEnd >= 0 && resumed < 0) resumed = i / 100;
                fighting = now;
            }
            // patience against an unarmed target: 6 s (the baseline brain chased it for 15-27 s of these 30)
            expect(firstEnd, `seed ${seed}`).toBeGreaterThan(0);
            expect(firstEnd, `seed ${seed}`).toBeLessThan(12);
            // ...and leaves it alone for its ignore window (15 s) while it keeps away
            if (resumed >= 0) expect(resumed - firstEnd, `seed ${seed}`).toBeGreaterThan(10);
        }
    }, 20_000);

    it("an unarmed bot gives up a fist chase after a punchless 3 s", () => {
        for (const seed of [1, 2]) {
            const game = flatGame({ minPlayers: 99 });
            const p = placePlayer(game, "bot", { x: 70, y: 420 });
            const runner = placePlayer(game, "runner", { x: 73, y: 420 });
            dummies(game, { x: 600, y: 120 });
            const bot = new BotController(game, p.id, { seed });
            let fight = 0;
            for (let i = 0; i < 1500; i++) {
                bot.update();
                runner.input = { ...runner.input, moveRight: runner.pos.x < 465 };
                game.step();
                const it = bot.bot.intent;
                if (it.behaviour === "fight" && it.targetId === runner.id) fight += 0.01;
            }
            // the baseline brain follows it 3 units behind for ever (meleeAggression beats exploring)
            expect(fight, `seed ${seed}`).toBeLessThan(4.5);
        }
    });

    it("an unarmed bot chased out of a house by an armed player goes elsewhere and does not come back", () => {
        const houses = mainGame().world.buildings.filter((b) => b.type === "house_red_01" || b.type === "house_red_02");
        for (const s of [3, 4, 5]) {
            const game = mainGame({ minPlayers: 99 });
            const hb = houses[s % houses.length];
            const def = getMapObjectDef(hb.type);
            if (def.type !== "building") throw new Error(hb.type);
            const zone = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn;
            if (zone?.type !== 1) throw new Error("no zoomIn box");
            let c = { x: (zone.min.x + zone.max.x) / 2, y: (zone.min.y + zone.max.y) / 2 };
            for (let k = 0; k < (hb.ori ?? 0); k++) c = { x: -c.y, y: c.x };
            const centre = v2.add(hb.pos, c);
            // an armed player standing in the house next to a gun on the floor, never shooting (the triage probe)
            const human = placePlayer(game, "human", v2.add(centre, { x: 1.5, y: 0 }));
            giveGun(human, "ak47", 90, 0);
            game.loot.addLoot("mp5", v2.add(centre, { x: -1.5, y: 0 }), 0, 1);
            dummies(game, { x: 40, y: 40 });
            const p = placePlayer(game, "bot", v2.add(centre, { x: 22, y: 4 }));
            const bot = new BotController(game, p.id, { seed: 11 + s });
            let firstFlee = -1;
            let flights = 0;
            let last = "";
            let returned = -1;
            let farthest = 0;
            for (let i = 0; i < 5000 && !p.dead; i++) {
                bot.update();
                still(human);
                game.step();
                const t = i / 100;
                const b = bot.bot.intent.behaviour;
                if (b === "flee" && last !== "flee") {
                    flights++;
                    if (firstFlee < 0) firstFlee = t;
                }
                last = b;
                const armed = p.weaponManager.weapons.slice(0, 2).some((w) => !!w.type);
                const d = v2.distance(p.pos, human.pos);
                if (firstFlee >= 0 && !armed) {
                    farthest = Math.max(farthest, d);
                    if (t > firstFlee + 4 && d < 10 && returned < 0) returned = t;
                }
            }
            // the triage probe on HEAD: 1-14 flights in a row (seed 3: 11, seed 4: 14), walking back in up to 8 times
            expect(firstFlee, `house ${s}`).toBeGreaterThanOrEqual(0);
            expect(flights, `house ${s}`).toBeLessThanOrEqual(2);
            expect(returned, `house ${s}: came back while unarmed`).toBe(-1);
            expect(farthest, `house ${s}`).toBeGreaterThan(25);
        }
    }, 20_000);

    it("a fleeing unarmed bot hides behind cover from an armed player", () => {
        for (const seed of [1, 2, 3]) {
            const spot = { x: 200, y: 420 };
            const game = flatGame({ minPlayers: 99 }, 1, [{ type: "stone_01", pos: { x: spot.x - 6, y: spot.y } }]);
            const p = placePlayer(game, "bot", spot);
            const enemy = placePlayer(game, "enemy", { x: spot.x + 24, y: spot.y });
            giveGun(enemy, "ak47", 90);
            dummies(game, { x: 600, y: 120 });
            const bot = new BotController(game, p.id, { seed });
            let hidden = -1;
            for (let i = 0; i < 300; i++) {
                bot.update();
                // it keeps the bot in its sights (never shoots)
                enemy.input = { ...enemy.input, toMouseDir: v2.normalizeSafe(v2.sub(p.pos, enemy.pos)) };
                game.step();
                if (hidden < 0 && !bot.bot.model.lineOfFire(enemy.pos, p.pos)) hidden = i / 100;
            }
            // the old flight ran straight into the open (hidden 1 time in 3)
            expect(hidden, `seed ${seed}`).toBeGreaterThan(0);
            expect(hidden, `seed ${seed}`).toBeLessThan(2);
        }
    });
});
