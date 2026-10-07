// The fire decision (bot overhaul COMBAT-3/7/8/9/10/11/12): exposure reactions, attention without the aim lock, return
// fire beyond the comfort range, shots through windows and at a half-covered body, the cover stand-off (frag at once
// or move, one reposition), grenade gates and aborted throws, melee timing and reach. Synthetic worlds for the
// decisions, the simulation for the scenarios. Owner: COMBAT.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { Game, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { addCombatLayer, engageLimit, shotCheck } from "../src/brain/combat.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { dodge } from "../src/brain/dodge.ts";
import { grenadeOpportunity } from "../src/brain/grenades.ts";
import { heldMelee, meleeReach, standOff, swingBand } from "../src/brain/melee.ts";
import { repositionSpot } from "../src/brain/standoff.ts";
import { planFight } from "../src/brain/tactics.ts";
import { ThrowController, TriggerController } from "../src/brain/trigger.ts";
import { BotController } from "../src/controller.ts";
import { DIFFICULTY_PRESETS } from "../src/difficulty.ts";
import { addEnemy, addObstacle, brainOf, faceTo, giveGun as giveWorldGun, NOW, testWorld } from "./brain-world.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";

describe("exposure and attention", () => {
    it("a target stepping out of cover gets a fresh, short reaction before the first shot", () => {
        const w = testWorld();
        addObstacle(w, { x: 9, y: 0 });
        const e = addEnemy(w, 2, { x: 14, y: 0 });
        const brain = brainOf(w, []);
        let ctx = brain.context(NOW);
        expect(shotCheck(ctx, e, 14).why).toBe("blocked");
        // it steps out sideways: no shot on the think it shows
        e.pos = v2.add(w.spot, { x: 14, y: 4 });
        ctx = brain.context(NOW + 1);
        const first = shotCheck(ctx, e, ctx.targetDist);
        expect(first.why).toBe("exposure");
        const [lo, hi] = DIFFICULTY_PRESETS.normal.exposureReaction;
        expect(shotCheck(brain.context(NOW + 1 + lo * 0.6), e, ctx.targetDist).ok).toBe(false);
        expect(shotCheck(brain.context(NOW + 1 + hi + 0.01), e, ctx.targetDist).ok).toBe(true);
    });

    it("shoots the exposed edge of a half-covered body", () => {
        const w = testWorld();
        // a crate (4.5 units square) covering the target's centre but not its upper edge
        addObstacle(w, { x: 7, y: -2.25 });
        const e = addEnemy(w, 2, { x: 14, y: -0.4 });
        const ctx = brainOf(w, []).context(NOW);
        expect(w.model.lineOfFire(w.spot, e.pos)).toBe(false);
        const check = shotCheck(ctx, e, ctx.targetDist);
        expect(check.ok).toBe(true);
        expect(check.aim).not.toEqual(e.pos);
        expect(w.model.lineOfFire(w.spot, check.aim as Vec2)).toBe(true);
    });

    it("glances at a target out of reach and holds the cover's edge on one behind cover (no aim lock)", () => {
        const w = testWorld();
        giveWorldGun(w, 0, "m870", 5, 20);
        w.model.self.inventory["12gauge"] = 20;
        const e = addEnemy(w, 2, { x: 24, y: 0 });
        const far = planFight(brainOf(w, []).context(NOW));
        expect(far.fire).toBe(false);
        expect(far.aim).toBeNull();
        expect(far.lookAt).toEqual(e.pos);
        // behind cover in reach: the crosshair rests on the cover's edge, not on the hidden body
        const w2 = testWorld();
        addObstacle(w2, { x: 9, y: 0 });
        const e2 = addEnemy(w2, 2, { x: 12, y: 0.2 });
        const blocked = planFight(brainOf(w2, []).context(NOW));
        expect(blocked.fire).toBe(false);
        expect(blocked.aim).not.toBeNull();
        expect(v2.distance(blocked.aim as Vec2, e2.pos)).toBeGreaterThan(1);
        expect(blocked.goal ?? blocked.moveDir).not.toBeNull();
    });

    it("answers fire beyond the comfort range; does not open fire there", () => {
        const w = testWorld();
        giveWorldGun(w, 0, "m870", 5, 20);
        const e = addEnemy(w, 2, { x: 18, y: 0 });
        faceTo(e, w.spot);
        const brain = brainOf(w, []);
        const quiet = brain.context(NOW);
        expect(shotCheck(quiet, e, 18).why).toBe("range");
        // it opens fire on the bot: the shotgun answers out to 0.75 of its pellets' reach
        e.lastShotAt = NOW - 0.2;
        const shot = brain.context(NOW);
        const gun = shot.guns[0];
        expect(engageLimit(shot, e, gun)).toBeGreaterThan(18);
        expect(shotCheck(shot, e, 18).ok).toBe(true);
        const layer = emptyIntent("loot");
        addCombatLayer(brain.context(NOW), layer);
        expect(layer.fire).toBe(true);
    });
});

describe("cover stand-off", () => {
    it("never stands still behind cover: frag once the gates hold, else round it", () => {
        const w = testWorld();
        w.model.self.inventory.frag = 2;
        addObstacle(w, { x: 12, y: 0 });
        const e = addEnemy(w, 2, { x: 15, y: 0 });
        const brain = brainOf(w, [], "hard");
        // covered just now: no frag yet (a second of cover first), but moving
        const a = planFight(brain.context(NOW));
        expect(a.goal ?? a.moveDir).not.toBeNull();
        expect(a.stop).toBe(false);
        expect(brain.mem.fight.throwNow).not.toBe(NOW);
        // covered for over a second and reacted: this think throws (no roll)
        const later = NOW + 1.2;
        const b = planFight(brain.context(later));
        expect(b.goal ?? b.moveDir).not.toBeNull();
        expect(brain.mem.fight.throwNow).toBe(later);
        const plan = grenadeOpportunity(brain.context(later), 0.03);
        expect(plan?.item).toBe("frag");
        // over the low crate: an air burst (round 3), thrown along the line to the target and past it
        const along = v2.normalize(v2.sub(plan?.pos as Vec2, w.spot));
        const toE = v2.sub(e.pos, w.spot);
        expect(Math.abs(v2.det(along, toE))).toBeLessThan(0.5);
        expect(v2.distance(plan?.pos as Vec2, w.spot)).toBeGreaterThan(v2.length(toE));
        expect(brain.mem.fight.trace.last("cook")?.detail).toMatch(/^airburst/);
    });

    it("too close to throw: backs off at most 1.5 s, then goes round", () => {
        const w = testWorld();
        w.model.self.inventory.frag = 2;
        addObstacle(w, { x: 4.5, y: 0 });
        addEnemy(w, 2, { x: 7, y: 0 });
        const brain = brainOf(w, [], "hard");
        const a = planFight(brain.context(NOW));
        expect(a.moveDir?.x ?? 0).toBeLessThan(0);
        const b = planFight(brain.context(NOW + 2));
        expect(b.goal).not.toBeNull();
    });

    it("a futile or stalled stand-off steps sideways, both bots the same world way", () => {
        const w = testWorld();
        addObstacle(w, { x: 6, y: 0 }, "tree_01");
        const e = addEnemy(w, 9, { x: 12, y: 0 });
        const ctx = brainOf(w, []).context(NOW);
        const spot = repositionSpot(ctx, e);
        expect(spot).not.toBeNull();
        expect(w.model.lineOfFire(spot as Vec2, e.pos)).toBe(true);
        // the other bot (higher id) sees the mirror image and steps to the same world side: the line between them
        // shifts off the tree instead of pivoting about it
        const w2 = testWorld();
        w2.model.self.id = 20;
        w2.model.selfId = 20;
        addObstacle(w2, { x: -6, y: 0 }, "tree_01");
        const e2 = addEnemy(w2, 9, { x: -12, y: 0 });
        const spot2 = repositionSpot(brainOf(w2, []).context(NOW), e2) as Vec2;
        expect(Math.sign((spot as Vec2).y - w.spot.y)).toBe(Math.sign(spot2.y - w2.spot.y));
    });

    it("the futile flag from MOVE's clock gets its one reposition", () => {
        const w = testWorld();
        addObstacle(w, { x: 6, y: 0 }, "tree_01");
        addEnemy(w, 9, { x: 12, y: 0 });
        const brain = brainOf(w, []);
        brain.mem.pursuit.futileTarget = 9;
        brain.mem.pursuit.futileSince = NOW;
        const plan = planFight(brain.context(NOW));
        expect(brain.mem.fight.futileDone).toBe(9);
        expect(plan.goal).toEqual(brain.mem.fight.repoSpot);
    });
});

describe("grenades", () => {
    it("are not thrown before the bot reacted, nor at a group in the open with a clear loaded shot", () => {
        const w = testWorld();
        w.model.self.inventory.frag = 2;
        const t = addEnemy(w, 2, { x: 15, y: 0 }, { firstSeen: NOW - 0.05 });
        addEnemy(w, 3, { x: 16, y: 2 });
        const brain = brainOf(w, [], "hard");
        expect(grenadeOpportunity(brain.context(NOW), 100)).toBeNull();
        t.firstSeen = NOW - 5;
        planFight(brain.context(NOW));
        expect(grenadeOpportunity(brain.context(NOW), 100)).toBeNull();
    });

    it("a throw being readied is broken off: cancelled before the cook, released at its point during it", () => {
        const tc = new ThrowController();
        tc.start({ item: "frag", pos: { x: 20, y: 0 }, cook: 1.5 }, 0);
        tc.abort(0.1);
        expect(tc.active).toBe(false);
        tc.start({ item: "frag", pos: { x: 20, y: 0 }, cook: 1.5 }, 0);
        const self = {
            pos: { x: 0, y: 0 },
            curWeapIdx: WeaponSlot.Throwable,
            weapons: [{ type: "" }, { type: "" }, { type: "fists" }, { type: "frag" }],
            inventory: { frag: 1 },
        } as unknown as Parameters<ThrowController["update"]>[1];
        tc.update(0.05, self);
        expect(tc.cooking).toBe(true);
        tc.abort(0.3);
        const out = tc.update(0.31, self);
        expect(out.shootHold).toBe(false);
        expect(out.aim).toEqual({ x: 20, y: 0 });
    });

    it("a bot readying a frag drops it when an enemy rushes within 8 units (simulation)", () => {
        const spot = openSpot(flatGame(), 30);
        const game = flatGame({ sandbox: true });
        const me = placePlayer(game, "bot", spot);
        giveGun(me, "mp5", 90);
        me.inv.set("frag", 2);
        const bot = new BotController(game, me.id, { seed: 3, difficulty: "normal" });
        bot.update();
        game.step();
        bot.bot.throws.start({ item: "frag", pos: v2.add(spot, { x: 20, y: 0 }), cook: 2 }, bot.bot.model.time);
        expect(bot.bot.throws.active).toBe(true);
        placePlayer(game, "rusher", v2.add(spot, { x: 5, y: 1 }));
        for (let i = 0; i < 6; i++) {
            bot.update();
            game.step();
        }
        expect(bot.bot.throws.active).toBe(false);
    });
});

describe("trigger finger", () => {
    it("does not fire on the tick the brain's fire comes back: the confirmation starts over", () => {
        const params = DIFFICULTY_PRESETS.hard;
        const tc = new TriggerController(params, createRng(9));
        const sense = {
            dir: { x: 1, y: 0 },
            cursor: { x: 10, y: 0 },
            cursorVel: { x: 0, y: 0 },
            aim: { x: 10, y: 0 },
            aimVel: { x: 0, y: 0 },
            acquisition: 1,
            reexposed: true,
        };
        // the cursor rests on the covered target for a second with fire held back
        for (let k = 0; k < 100; k++) expect(tc.updateHuman(k * 0.01, false, sense, "ak47", 10).shootHold).toBe(false);
        let first = -1;
        for (let k = 100; k < 200 && first < 0; k++)
            if (tc.updateHuman(k * 0.01, true, sense, "ak47", 10).shootHold) first = k;
        expect(first).toBeGreaterThan(100);
        // a first sighting (or an obstacle being broken) is no new exposure: the reaction already covered the click
        const crate = new TriggerController(params, createRng(9));
        for (let k = 0; k < 100; k++) crate.updateHuman(k * 0.01, false, { ...sense, reexposed: false }, "ak47", 10);
        expect(crate.updateHuman(1, true, { ...sense, reexposed: false }, "ak47", 10).shootHold).toBe(true);
    });
});

describe("dodging", () => {
    it("runs from a grenade only a human reaction after it showed on the screen", () => {
        const w = testWorld();
        const frag = {
            id: 77,
            type: "frag",
            pos: v2.add(w.spot, { x: 4, y: 0 }),
            posZ: 0,
            dir: { x: -1, y: 0 },
            layer: 0,
        };
        w.model.projectiles = [frag];
        const brain = brainOf(w, []);
        // it just appeared: no dodge yet
        w.model.projectileSeen.set(77, NOW - 0.05);
        const intent = emptyIntent("explore");
        dodge(brain.context(NOW), intent);
        expect(intent.moveDir).toBeNull();
        const [, hi] = DIFFICULTY_PRESETS.normal.dodgeReaction;
        const later = emptyIntent("explore");
        dodge(brain.context(NOW - 0.05 + hi + 0.01), later);
        expect(later.moveDir?.x ?? 0).toBeLessThan(0);
    });
});

describe("melee", () => {
    it("reach, swing band and stand-off come from the weapon", () => {
        const fists = heldMelee(testWorld().model.self);
        expect(meleeReach(fists)).toBeCloseTo(3.25, 5);
        expect(swingBand(fists)).toBeCloseTo(2.8, 5);
        expect(standOff(fists)).toBeCloseTo(2.2, 5);
        const w = testWorld();
        w.model.self.weapons[2] = { type: "katana", ammo: 0 };
        expect(meleeReach(heldMelee(w.model.self))).toBeGreaterThan(4.5);
    });

    it("swings at the weapon's cooldown plus a human click gap, never a 0.25 s metronome", () => {
        const params = DIFFICULTY_PRESETS.normal;
        const tc = new TriggerController(params, createRng(5));
        const clicks: number[] = [];
        for (let k = 0; k < 400; k++) {
            const now = k * 0.01;
            if (tc.update(now, true, "fists", 2).shootStart) clicks.push(now);
        }
        const gaps = clicks.slice(1).map((c, i) => c - clicks[i]);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.25 + params.clickDelay[0] - 0.011);
        expect(new Set(gaps.map((g) => g.toFixed(2))).size).toBeGreaterThan(3);
    });

    it("keeps a stand-off and swings only inside its reach once reacted", () => {
        const w = testWorld();
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        const far = addEnemy(w, 2, { x: 3, y: 0 }, { activeWeapon: "fists" });
        const plan = planFight(brainOf(w, []).context(NOW));
        expect(plan.arriveDist).toBeCloseTo(2.2, 5);
        expect(plan.fire).toBe(false);
        far.pos = v2.add(w.spot, { x: 2.3, y: 0 });
        expect(planFight(brainOf(w, []).context(NOW)).fire).toBe(true);
        // a fresh sighting: no swing before the reaction
        far.firstSeen = NOW - 0.05;
        expect(planFight(brainOf(w, []).context(NOW)).fire).toBe(false);
    });

    it("a runner that bolts from the stand-off gets away from a normal bot on dry land (simulation)", () => {
        const spot = openSpot(flatGame(), 60);
        let deaths = 0;
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const game = flatGame({ sandbox: true });
            const me = placePlayer(game, "bot", spot);
            const runner = placePlayer(game, "runner", v2.add(spot, { x: 2.4, y: 0 }));
            const bot = new BotController(game, me.id, { seed, difficulty: "normal" });
            // it punches the bot first (the bot fights back), then runs straight away
            for (let i = 0; i < 80; i++) {
                const to = v2.normalizeSafe(v2.sub(me.pos, runner.pos));
                game.setInput(runner.id, { ...runner.input, toMouseDir: to, shootStart: i % 30 === 0 });
                bot.update();
                game.step();
            }
            for (let i = 0; i < 300 && !runner.dead && !runner.downed; i++) {
                game.setInput(runner.id, {
                    ...runner.input,
                    moveRight: true,
                    shootStart: false,
                    toMouseDir: { x: 1, y: 0 },
                });
                bot.update();
                game.step();
            }
            if (runner.dead || runner.downed) deaths++;
        }
        expect(deaths).toBe(0);
    });
});

/** Steps the game and its bot until `cond` or `ticks` ran; returns the ticks used or -1. */
function run(game: Game, bot: BotController, ticks: number, cond: () => boolean): number {
    for (let i = 0; i < ticks; i++) {
        bot.update();
        game.step();
        if (cond()) return i + 1;
    }
    return -1;
}

function shotsOf(p: Player, mag = 30): number {
    return mag - (p.weaponManager.weapons[WeaponSlot.Primary]?.ammo ?? mag);
}

describe("fire scenarios (simulation)", () => {
    const SPOT = openSpot(flatGame(), 40);

    it("shoots through a window at a dummy behind it", () => {
        const win = v2.add(SPOT, { x: 6, y: 0 });
        const game = flatGame({ sandbox: true }, 1, [{ type: "house_window_01", pos: win }]);
        const me = placePlayer(game, "bot", SPOT);
        giveGun(me, "ak47", 90);
        const dummy = placePlayer(game, "dummy", v2.add(SPOT, { x: 12, y: 0 }));
        const bot = new BotController(game, me.id, { seed: 2, difficulty: "normal" });
        expect(run(game, bot, 400, () => dummy.health < 100)).toBeGreaterThan(0);
    });

    it("a dummy behind a crate or a stone is shot within 5 s (both brains)", () => {
        for (const brain of ["smart", "baseline"] as const) {
            for (const type of ["crate_01", "stone_01"]) {
                const cover = v2.add(SPOT, { x: 8, y: 0 });
                const game = flatGame({ sandbox: true }, 1, [{ type, pos: cover }]);
                const me = placePlayer(game, "bot", SPOT);
                giveGun(me, "mp5", 90);
                const dummy = placePlayer(game, "dummy", v2.add(cover, { x: 3, y: 0 }));
                const bot = new BotController(game, me.id, { seed: 5, difficulty: "normal", brain });
                expect(
                    run(game, bot, 500, () => dummy.health < 100),
                    `${brain} ${type}`,
                ).toBeGreaterThan(0);
            }
        }
    });

    it("returns fire with a shotgun at 18 units; does not open fire there on a passive target", () => {
        const make = (shoot: boolean) => {
            const game = flatGame({ sandbox: true });
            const me = placePlayer(game, "bot", SPOT);
            giveGun(me, "m870", 30);
            const enemy = placePlayer(game, "enemy", v2.add(SPOT, { x: 18, y: 0 }));
            giveGun(enemy, "ak47", 90);
            const bot = new BotController(game, me.id, { seed: 4, difficulty: "normal", brain: "baseline" });
            let k = 0;
            const used = run(game, bot, 250, () => {
                game.teleportPlayer(me.id, SPOT);
                // a short burst every quarter second
                const ph = k++ % 25;
                if (shoot) {
                    const input = {
                        ...enemy.input,
                        toMouseDir: { x: -1, y: 0 },
                        shootStart: ph === 0,
                        shootHold: ph < 3,
                    };
                    game.setInput(enemy.id, input);
                }
                return shotsOf(me, 5) > 0;
            });
            return used;
        };
        expect(make(true)).toBeGreaterThan(0);
        expect(make(false)).toBe(-1);
    });
});
