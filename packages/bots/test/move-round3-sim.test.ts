// Round 3 movement end to end in the simulation, default brain (smart, BrainFeatures.pursuit): fire from a shooter off
// the screen is answered by persona (cover, a zigzag run or a push; report 20), a target that ran off the screen is
// searched for where it went and found (report 25), a fight next to a stone is fought from its edge (report 19), and
// a bot inside an air strike zone gets out past the bombs' reach before they fall (report 27). Four idle players far
// away keep more than three alive. Owner: MOVE.
import { type Vec2, v2 } from "@rebirth/core";
import type { Game, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { blastRadius } from "../src/brain/strikes.ts";
import { BotController } from "../src/controller.ts";
import type { PersonaName } from "../src/persona.ts";
import { flatGame, giveGun, placePlayer } from "./helpers.ts";

function dummies(game: Game, at: Vec2): void {
    for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, v2.add(at, { x: k * 20, y: 0 }));
}

/** Holds a scripted player still, not shooting. */
function still(p: Player): void {
    p.input = { ...p.input, moveLeft: false, moveRight: false, moveUp: false, moveDown: false, shootStart: false };
    p.input.shootHold = false;
}

const SPOT = { x: 200, y: 420 };

describe("round 3 movement (simulation)", () => {
    it("answers fire from a shooter off the screen by persona: cover, a zigzag run or a push", () => {
        const styles: Record<string, number> = {};
        for (const persona of ["camper", "rusher"] as PersonaName[]) {
            for (const seed of [1, 2, 3, 4]) {
                const game = flatGame({ minPlayers: 99 }, 1, [
                    { type: "stone_01", pos: { x: SPOT.x - 6, y: SPOT.y + 2 } },
                ]);
                const p = placePlayer(game, "bot", SPOT);
                giveGun(p, "ak47", 90);
                p.helmet = "helmet03";
                p.chest = "chest03";
                // 45 units to the side: off the 16:9 screen (half width = the zoom, 28 with the 1x scope)
                const shooter = placePlayer(game, "shooter", { x: SPOT.x + 45, y: SPOT.y });
                giveGun(shooter, "ak47", 90);
                dummies(game, { x: 600, y: 120 });
                const bot = new BotController(game, p.id, { seed, persona });
                const start = v2.distance(p.pos, shooter.pos);
                let style = "";
                let evadeAt = -1;
                let hidden = false;
                let firstShot = -1;
                for (let i = 0; i < 500 && !p.dead; i++) {
                    bot.update();
                    still(shooter);
                    // a three-round burst every 1.2 s, aimed at the bot
                    const burst = i >= 20 && i % 120 < 30;
                    if (burst && firstShot < 0) firstShot = i / 100;
                    shooter.input = {
                        ...shooter.input,
                        toMouseDir: v2.normalizeSafe(v2.sub(p.pos, shooter.pos)),
                        shootStart: burst,
                        shootHold: burst,
                    };
                    game.step();
                    const ev = bot.bot.brain.mem.pursuit.evade;
                    if (ev && !style) style = ev.style;
                    if (bot.bot.intent.behaviour === "evade" && evadeAt < 0) evadeAt = i / 100;
                    if (style === "cover" && !bot.bot.model.lineOfFire(shooter.pos, p.pos)) hidden = true;
                }
                const label = `${persona} seed ${seed}`;
                expect(style, label).not.toBe("");
                expect(evadeAt, label).toBeGreaterThan(0);
                // reacts once the first bullets flew by (about 0.45 s from 45 units) plus a human reaction, not before
                expect(evadeAt - firstShot, label).toBeGreaterThan(0.5);
                expect(evadeAt - firstShot, label).toBeLessThan(1.5);
                styles[`${persona}:${style}`] = (styles[`${persona}:${style}`] ?? 0) + 1;
                const end = v2.distance(p.pos, shooter.pos);
                // cover with no obstacle in reach any more (it walked on before it noticed) falls back to the run
                if (style === "cover") expect(hidden || end - start > 8, label).toBe(true);
                if (style === "run") expect(end - start, label).toBeGreaterThan(8);
                if (style === "push") expect(start - end, label).toBeGreaterThan(8);
            }
        }
        // the camper never pushes
        expect(styles["camper:push"] ?? 0).toBe(0);
    }, 20_000);

    it("searches for a target that ran off the screen where it went, and finds it", () => {
        for (const seed of [1, 2]) {
            const game = flatGame({ minPlayers: 99 });
            const p = placePlayer(game, "bot", SPOT);
            giveGun(p, "ak47", 90);
            const target = placePlayer(game, "target", { x: SPOT.x + 16, y: SPOT.y });
            giveGun(target, "mp5", 90);
            for (const q of [p, target]) {
                q.helmet = "helmet02";
                q.chest = "chest02";
            }
            dummies(game, { x: 600, y: 120 });
            const bot = new BotController(game, p.id, { seed });
            let lostAt = -1;
            let searched = false;
            let foundAt = -1;
            for (let i = 0; i < 2000 && !target.dead && foundAt < 0; i++) {
                bot.update();
                still(target);
                // it runs +x off the screen at once and waits there, out of sight
                const t = i / 100;
                if (target.pos.x < SPOT.x + 70)
                    target.input = { ...target.input, moveRight: true, toMouseDir: { x: 1, y: 0 } };
                game.step();
                const seen = bot.bot.model.contacts.get(target.id)?.visible ?? false;
                if (!seen && lostAt < 0 && t > 0.5) lostAt = t;
                if (bot.bot.intent.behaviour === "search") searched = true;
                if (seen && lostAt >= 0 && searched) foundAt = t;
            }
            expect(lostAt, `seed ${seed}`).toBeGreaterThan(0);
            expect(searched, `seed ${seed}`).toBe(true);
            // back on its screen well within its patience (12 s)
            expect(foundAt, `seed ${seed}`).toBeGreaterThan(lostAt);
            expect(foundAt - lostAt, `seed ${seed}`).toBeLessThan(12);
        }
    });

    it("fights from next to the stone instead of strafing in the open", () => {
        /**
         * Share of the fight the bot spends within 6 units of the stone, with or without the flag. The post's edge sits
         * 3.4-5 units from the stone's centre (behind it by its radius 1.6 plus 1.5, then 1.5-3 sideways), and a bot hit
         * there strafes within its leash (tactics.ts HIT_STRAFE); the bot starts 7.3 units away, so standing where it
         * started does not count (the old 5 units against a 5.4 start measured tenths of a unit of nav snapping).
         */
        const nearShare = (seed: number, pursuit: boolean): number => {
            const stone = { x: SPOT.x + 2, y: SPOT.y + 7 };
            const game = flatGame({ minPlayers: 99 }, 1, [{ type: "stone_01", pos: stone }]);
            const p = placePlayer(game, "bot", SPOT);
            giveGun(p, "ak47", 90);
            const enemy = placePlayer(game, "enemy", { x: SPOT.x + 22, y: SPOT.y });
            giveGun(enemy, "ak47", 90);
            dummies(game, { x: 600, y: 120 });
            const bot = new BotController(game, p.id, { seed, brain: { ...BRAIN_PRESETS.smart, pursuit } });
            let near = 0;
            let fighting = 0;
            for (let i = 0; i < 400 && !enemy.dead && !p.dead; i++) {
                bot.update();
                still(enemy);
                // it trades with the bot: a short burst every second
                const burst = i > 50 && i % 100 < 15;
                enemy.input = {
                    ...enemy.input,
                    toMouseDir: v2.normalizeSafe(v2.sub(p.pos, enemy.pos)),
                    shootStart: burst,
                    shootHold: burst,
                };
                game.step();
                if (bot.bot.intent.behaviour !== "fight") continue;
                fighting++;
                if (v2.distance(p.pos, stone) < 6) near++;
            }
            expect(fighting, `seed ${seed}`).toBeGreaterThan(100);
            return near / fighting;
        };
        for (const seed of [1, 2, 3]) {
            expect(nearShare(seed, true), `seed ${seed}`).toBeGreaterThan(0.6);
            // the open-ground strafe drifts away from it
            expect(nearShare(seed, false), `seed ${seed}`).toBeLessThan(0.3);
        }
    });

    it("gets out of an air strike zone past the bombs' reach before they fall", () => {
        for (const seed of [1, 2]) {
            const game = flatGame({ minPlayers: 99 });
            const centre = { x: SPOT.x + 10, y: SPOT.y };
            const p = placePlayer(game, "bot", SPOT);
            giveGun(p, "ak47", 90);
            dummies(game, { x: 600, y: 120 });
            const bot = new BotController(game, p.id, { seed });
            game.step();
            // a 30-unit zone (planes after wait 1.5 + 2.5 s of flight), 3 planes a second apart
            game.planes.zones.addZone(centre, 30, 3, 1.5, 1);
            let outAt = -1;
            for (let i = 0; i < 1200 && !p.dead; i++) {
                bot.update();
                game.step();
                if (outAt < 0 && v2.distance(p.pos, centre) > 30 + blastRadius("bomb_iron")) outAt = i / 100;
            }
            expect(p.dead, `seed ${seed}`).toBe(false);
            expect(outAt, `seed ${seed}`).toBeGreaterThan(0);
            expect(outAt, `seed ${seed}`).toBeLessThan(4);
            expect(p.health, `seed ${seed}`).toBeGreaterThan(60);
        }
    });
});
