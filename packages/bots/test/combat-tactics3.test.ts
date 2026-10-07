// Round 3 tactics (bot overhaul COMBAT, user reports 19, 20, 23, 24, 25, 27). Synthetic worlds: the computed cook
// (fuse - flight - a human margin, only with a reason, never past the fuse less a safety margin, radii from the defs),
// the reaction to fire from an unseen shooter (return fire in bursts at the fuzzy origin, hold the angle, or leave it to
// MOVE; persona-dependent, one decision per episode), smoke stand-offs (spray, frag or hold the exit; no tracking
// through smoke), the prefire at a bush a hostile enemy just ran into, and trading from cover a few steps away.
// Simulations: a cooked frag at a dummy behind a stone bursts at it, not seconds later; an off-screen shooter gets
// fire back towards it without ever being targeted. Owner: COMBAT.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import {
    airburstPoint,
    airTime,
    cookDeadline,
    cookFor,
    flightTime,
    fragBlast,
    fragMinDist,
    fragNoThrowNear,
} from "../src/brain/fragMath.ts";
import { smartGrenade } from "../src/brain/grenades.ts";
import { prefireCorner } from "../src/brain/lostTarget.ts";
import { planFight } from "../src/brain/tactics.ts";
import { ThrowController } from "../src/brain/trigger.ts";
import { applyUnseenReaction, unseenReaction } from "../src/brain/unseenFire.ts";
import { BotController } from "../src/controller.ts";
import { screenBounds } from "../src/perception/sight.ts";
import type { SelfState } from "../src/perception/world.ts";
import { PERSONAS } from "../src/persona.ts";
import { addEnemy, addObstacle, brainOf, faceTo, NOW, type TestWorld, testWorld } from "./brain-world.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";

const SMART = BRAIN_PRESETS.smart;

/** A world whose screen is set (the model's screen bounds are filled by observe(), not by testWorld). */
function world(): TestWorld {
    const w = testWorld();
    w.model.screen = screenBounds(w.spot, 28);
    w.model.screenZoom = 28;
    return w;
}

/** Unsigned angle between two vectors (radians). */
function angleBetween(a: Vec2, b: Vec2): number {
    return Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
}

describe("grenade numbers come from the defs", () => {
    it("blast, minimum distance, no-throw distance and fuse deadline follow the defs", () => {
        const b = fragBlast("frag");
        expect(b.max).toBeGreaterThan(b.min);
        // out of the blast's whole reach: its outer radius plus the body radius and a little slack (evaluation F3)
        expect(fragMinDist("frag")).toBe(b.max + 1.5);
        expect(fragNoThrowNear("frag")).toBe(b.min + 3);
        expect(cookDeadline("frag")).toBeLessThan(4);
        expect(cookDeadline("smoke")).toBe(Number.POSITIVE_INFINITY);
        // the flight model: about a second in the air, longer to come to rest farther out
        expect(airTime("frag")).toBeGreaterThan(0.95);
        expect(airTime("frag")).toBeLessThan(1.15);
        const f12 = flightTime("frag", 12, "land") as number;
        const f24 = flightTime("frag", 24, "land") as number;
        expect(f24).toBeGreaterThan(f12);
        expect(flightTime("frag", 20, "air")).toBeCloseTo(airTime("frag"), 6);
        expect(flightTime("frag", 40, "air")).toBeNull();
        // an air burst is aimed past the target, on its line
        const p = airburstPoint("frag", { x: 0, y: 0 }, { x: 18, y: 0 }) as Vec2;
        expect(p.x).toBeGreaterThan(18);
        expect(p.y).toBeCloseTo(0, 6);
    });
});

describe("the computed cook (user report 24)", () => {
    it("fuse - flight - a skill margin with a reason; the bare minimum without one", () => {
        const w = world();
        const expert = brainOf(w, SMART, "hard").context(NOW);
        const beginner = brainOf(w, SMART, "easy", 1, {
            skill: { tier: "beginner", s: 0.15, g: 0.1 },
        }).context(NOW);
        const left = (ctx: typeof expert) => {
            const plans = Array.from({ length: 40 }, () => cookFor(ctx, "frag", 20, "cover", "land"));
            for (const p of plans) {
                expect(p.cook).toBeGreaterThanOrEqual(0.1);
                expect(p.cook).toBeLessThanOrEqual(cookDeadline("frag") - 0.1 + 1e-9);
                expect(p.cook + p.flight).toBeLessThan(p.fuse);
            }
            return plans.reduce((a, p) => a + (p.fuse - p.flight - p.cook), 0) / plans.length;
        };
        const e = left(expert);
        const b = left(beginner);
        expect(e).toBeGreaterThan(0.1);
        expect(e).toBeLessThan(0.35);
        expect(b).toBeGreaterThan(e + 0.15);
        const none = cookFor(expert, "frag", 20, "none", "land");
        expect(none.cook).toBe(0.1);
        expect(none.reason).toBe("none");
    });

    it("a frag at a target behind a stone is an air burst; behind a tree it lands past it; a revive is denied", () => {
        const mk = (cover: string, over: Parameters<typeof addEnemy>[3] = {}) => {
            const w = world();
            w.model.self.inventory.frag = 2;
            addObstacle(w, { x: 16, y: 0 }, cover);
            const e = addEnemy(w, 2, { x: 18.5, y: 0 }, over);
            const brain = brainOf(w, SMART, "hard");
            const f = brain.mem.fight;
            brain.mem.engagedTarget = 2;
            brain.mem.engageStart = NOW - 5;
            brain.mem.reaction = 0.2;
            f.coverTarget = 2;
            f.coveredSince = NOW - 2;
            f.throwNow = NOW;
            const plan = smartGrenade(brain.context(NOW), 0.03);
            return { w, e, plan, trace: f.trace.last("cook")?.detail ?? "" };
        };
        const stone = mk("stone_01");
        expect(stone.plan?.item).toBe("frag");
        expect(stone.trace).toMatch(/^airburst/);
        expect(v2.distance(stone.plan?.pos as Vec2, stone.w.spot)).toBeGreaterThan(18.5);
        const tree = mk("tree_01");
        expect(tree.trace).toMatch(/^cover/);
        const revive = mk("tree_01", { reviving: true });
        expect(revive.trace).toMatch(/^revive/);
    });

    it("denies a push: a frag in front of an enemy rushing in while the bot has no loaded shot", () => {
        const w = world();
        w.model.self.inventory.frag = 2;
        w.model.self.weapons[0].ammo = 0;
        const e = addEnemy(w, 2, { x: 20, y: 0 }, { vel: { x: -5.5, y: 0 }, lastShotAt: NOW - 0.5 });
        faceTo(e, w.spot);
        let thrown = 0;
        for (let seed = 1; seed <= 20 && !thrown; seed++) {
            const brain = brainOf(w, SMART, "hard", seed);
            brain.mem.engagedTarget = 2;
            brain.mem.engageStart = NOW - 5;
            brain.mem.reaction = 0.2;
            for (let k = 0; k < 30 && !thrown; k++) {
                const plan = smartGrenade(brain.context(NOW + k * 0.03), 0.03);
                if (!plan) continue;
                thrown++;
                expect(brain.mem.fight.trace.last("cook")?.detail).toMatch(/^push/);
                // ahead of it, towards the bot, never inside the minimum distance
                expect(plan.pos.x - w.spot.x).toBeLessThan(20);
                expect(v2.distance(plan.pos, w.spot)).toBeGreaterThanOrEqual(fragMinDist("frag") - 1e-6);
            }
        }
        expect(thrown).toBe(1);
    });

    it("a cooking frag always leaves the hand with fuse to spare, whatever the planned cook or the aim", () => {
        const tc = new ThrowController();
        const self = {
            pos: { x: 0, y: 0 },
            curWeapIdx: WeaponSlot.Throwable,
            weapons: [
                { type: "", ammo: 0 },
                { type: "", ammo: 0 },
                { type: "fists", ammo: 0 },
                { type: "frag", ammo: 1 },
            ],
            inventory: { frag: 1 },
        } as unknown as SelfState;
        tc.start({ item: "frag", pos: { x: 20, y: 0 }, cook: 10 }, 0);
        let released = -1;
        for (let t = 0; t <= 5; t += 0.01) {
            tc.update(t, self, false);
            if (released < 0 && tc.active && !tc.cooking && t > 0.05) released = t;
        }
        expect(released).toBeGreaterThan(0);
        expect(released).toBeLessThanOrEqual(cookDeadline("frag") + 0.011);
    });
});

describe("fire from an unseen shooter (user report 20)", () => {
    function underFire(w: TestWorld, shooter = 9, at = NOW, from: Vec2 = { x: 40, y: 5 }): Vec2 {
        const origin = v2.add(w.spot, from);
        w.model.underFire = { time: at, from: origin, shooterId: shooter };
        return origin;
    }

    it("a neutral bot with a loaded gun returns short bursts at the estimated origin, then stops", () => {
        const w = world();
        const origin = underFire(w);
        const brain = brainOf(w, SMART, "normal");
        let fired = 0;
        let longest = 0;
        let run = 0;
        const offs = new Set<string>();
        for (let k = 0; k < 120; k++) {
            const t = NOW + k * 0.03;
            // the shooter keeps firing for 2 s, then stops
            if (t - NOW < 2) w.model.underFire = { time: t, from: origin, shooterId: 9 };
            const ctx = brain.context(t);
            const intent = emptyIntent("loot");
            applyUnseenReaction(ctx, intent);
            expect(intent.targetId).toBe(0);
            // at the origin's distance, sprayed around its bearing by a few degrees per burst (suppression)
            const aim = intent.aim ?? w.spot;
            const me = w.model.self.pos;
            expect(v2.distance(aim, me)).toBeCloseTo(v2.distance(origin, me), 6);
            const off = Math.abs(angleBetween(v2.sub(aim, me), v2.sub(origin, me)));
            expect(off).toBeLessThan((30 * Math.PI) / 180);
            if (intent.fire) offs.add(off.toFixed(4));
            if (intent.fire) {
                fired++;
                run++;
                longest = Math.max(longest, run);
                // nothing after the shooter has been quiet a while
                expect(t - NOW).toBeLessThan(2 + 1.25);
            } else run = 0;
        }
        expect(unseenReaction(brain.context(NOW + 1))?.choice).toBe("return");
        expect(fired).toBeGreaterThan(10);
        // a new spray angle per burst, not a lock on the estimate
        expect(offs.size).toBeGreaterThan(1);
        // bursts of at most 0.55 s (19 thinks of 0.03 s)
        expect(longest).toBeLessThanOrEqual(19);
        expect(brain.mem.fight.unseenFired).toBeLessThanOrEqual(2.5 + 0.05);
    });

    it("unarmed: holds the angle from cover when there is some, else leaves it to MOVE", () => {
        const w = world();
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        underFire(w);
        addObstacle(w, { x: 3, y: 0 }, "stone_01");
        const brain = brainOf(w, SMART, "normal");
        const intent = emptyIntent("loot");
        applyUnseenReaction(brain.context(NOW), intent);
        expect(unseenReaction(brain.context(NOW))?.choice).toBe("hold");
        expect(intent.fire).toBe(false);
        expect(intent.goal).not.toBeNull();
        const open = world();
        open.model.self.weapons[0] = { type: "", ammo: 0 };
        underFire(open);
        expect(unseenReaction(brainOf(open, SMART, "normal").context(NOW))?.choice).toBe("evade");
    });

    it("one decision per episode; persona-dependent (rushers shoot back, rats evade)", () => {
        const share = (persona: "rusher" | "rat") => {
            let ret = 0;
            let evade = 0;
            for (let seed = 1; seed <= 120; seed++) {
                const w = world();
                addObstacle(w, { x: 3, y: 0 }, "stone_01");
                underFire(w);
                const brain = brainOf(w, SMART, "normal", seed, {
                    persona: PERSONAS[persona],
                    personaRng: createRng(seed),
                });
                const first = unseenReaction(brain.context(NOW))?.choice;
                // the same episode keeps its choice
                underFire(w, 9, NOW + 0.5);
                expect(unseenReaction(brain.context(NOW + 0.5))?.choice).toBe(first);
                if (first === "return") ret++;
                if (first === "evade") evade++;
            }
            return { ret: ret / 120, evade: evade / 120 };
        };
        const rusher = share("rusher");
        const rat = share("rat");
        expect(rusher.ret).toBeGreaterThan(0.45);
        expect(rat.ret).toBeLessThan(0.2);
        expect(rat.evade).toBeGreaterThan(rusher.evade);
    });
});

describe("smoke stand-offs (user report 23)", () => {
    /** An enemy seen walking +x into a smoke cloud 0.3 s ago, `d` units away. */
    function intoSmoke(d = 14, hostile = false) {
        const w = world();
        const e = addEnemy(w, 2, { x: d, y: 0 }, { vel: { x: 3, y: 0 }, lastShotAt: hostile ? NOW - 0.5 : -Infinity });
        w.model.lastSeen.note(w.model, [], () => false);
        e.visible = false;
        e.lastSeen = NOW - 0.3;
        const cloud = { id: 1, pos: v2.add(w.spot, { x: d + 4.5, y: 0 }), rad: 5, layer: 0, interior: false };
        w.model.smokes = [cloud];
        w.model.lastSeen.note(w.model, [], () => false);
        return { w, e, cloud };
    }

    function think(brain: ReturnType<typeof brainOf>, w: TestWorld, t: number) {
        w.model.time = t;
        brain.mem.engagedTarget = 2;
        brain.mem.engageStart = NOW - 5;
        brain.mem.reaction = 0.2;
        return planFight(brain.context(t));
    }

    it("sprays short bursts into the cloud at fresh guesses (no tracking), capped, then holds the exit", () => {
        const { w, cloud } = intoSmoke();
        expect(w.model.lastSeen.get(2)?.cause).toBe("smoke");
        const brain = brainOf(w, SMART, "normal");
        const aims: Vec2[] = [];
        let fireThinks = 0;
        // (a normal bot remembers the target 4 s: the spray runs within that)
        for (let k = 0; k < 120; k++) {
            const t = NOW + k * 0.03;
            const intent = think(brain, w, t);
            if (intent.fire) {
                fireThinks++;
                expect(intent.targetId).toBe(0);
                const a = intent.aim as Vec2;
                if (!aims.some((p) => v2.distance(p, a) < 1e-9)) aims.push(a);
                expect(v2.distance(a, cloud.pos)).toBeLessThan(cloud.rad + 4);
            }
        }
        expect(brain.mem.fight.smoke?.target).toBe(2);
        expect(brain.mem.fight.trace.last("smoke")?.detail).toMatch(/^spray/);
        // at most 2 s of trigger time, in several bursts at different guesses
        expect(fireThinks * 0.03).toBeLessThanOrEqual(2.1);
        expect(aims.length).toBeGreaterThanOrEqual(3);
        // once the spray is spent it holds the exit: aimed at the cloud's far edge along the heading, no fire
        const st = brain.mem.fight.smoke;
        if (st) st.sprayed = 2;
        const hold = think(brain, w, NOW + 120 * 0.03);
        expect(hold.fire).toBe(false);
        expect((hold.aim as Vec2).x).toBeGreaterThan(cloud.pos.x + cloud.rad - 0.1);
    });

    it("throws a cooked frag into the smoke when it has one and the target was shooting", () => {
        const { w } = intoSmoke(14, true);
        w.model.self.inventory.frag = 1;
        const brain = brainOf(w, SMART, "normal");
        const intent = think(brain, w, NOW);
        expect(intent.throwPlan?.item).toBe("frag");
        expect(brain.mem.fight.trace.last("cook")?.detail).toMatch(/^smoke/);
    });

    it("a marksman mostly holds the exit", () => {
        let hold = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const { w } = intoSmoke();
            const brain = brainOf(w, SMART, "normal", seed, {
                persona: PERSONAS.marksman,
                personaRng: createRng(seed),
            });
            think(brain, w, NOW);
            if (brain.mem.fight.smoke?.choice === "hold") hold++;
        }
        expect(hold / 60).toBeGreaterThan(0.6);
    });
});

describe("a lost target's corner (user report 25)", () => {
    function intoBush(hostile: boolean, gun = "mp5") {
        const w = world();
        if (gun !== "mp5") w.model.self.weapons[0] = { type: gun, ammo: 5 };
        addObstacle(w, { x: 14, y: 0 }, "bush_01");
        w.model.obstacles[0].blocksBullets = false;
        const e = addEnemy(w, 2, { x: 12, y: 0 }, { vel: { x: 4, y: 0 }, lastShotAt: hostile ? NOW - 1 : -Infinity });
        w.model.lastSeen.note(w.model, [], () => false);
        e.visible = false;
        e.lastSeen = NOW - 0.1;
        w.model.lastSeen.note(w.model, [], () => false);
        return w;
    }

    it("prefires the bush a hostile enemy just ran into: one short burst, at the bush, untargeted", () => {
        const w = intoBush(true);
        expect(w.model.lastSeen.get(2)?.cause).toBe("foliage");
        const brain = brainOf(w, SMART, "normal");
        let fire = 0;
        for (let k = 0; k < 60; k++) {
            const intent = emptyIntent("fight");
            const t = NOW + k * 0.03;
            w.model.time = t;
            if (prefireCorner(brain.context(t), intent, 2)) {
                fire++;
                expect(intent.targetId).toBe(0);
                expect(v2.distance(intent.aim as Vec2, v2.add(w.spot, { x: 14, y: 0 }))).toBeLessThan(0.01);
            }
        }
        expect(fire).toBeGreaterThan(5);
        expect(fire * 0.03).toBeLessThanOrEqual(0.75);
        expect(brain.mem.fight.trace.last("prefire")?.detail).toMatch(/^foliage/);
    });

    it("no prefire at an enemy that was not shooting, nor with a single-shot rifle", () => {
        const calm = intoBush(false);
        expect(prefireCorner(brainOf(calm, SMART, "normal").context(NOW), emptyIntent("fight"), 2)).toBe(false);
        const sniper = intoBush(true, "mosin");
        expect(prefireCorner(brainOf(sniper, SMART, "normal").context(NOW), emptyIntent("fight"), 2)).toBe(false);
    });
});

describe("trading from cover (user report 19)", () => {
    function exchange(persona?: "rusher") {
        const w = world();
        w.model.self.weapons[0] = { type: "ak47", ammo: 30 };
        w.model.self.inventory["762mm"] = 90;
        addObstacle(w, { x: 2.5, y: 2.5 }, "stone_01");
        const e = addEnemy(w, 2, { x: 18, y: 0 }, { lastShotAt: NOW - 0.3 });
        faceTo(e, w.spot);
        const brain = brainOf(w, SMART, "normal", 1, persona ? { persona: PERSONAS[persona] } : {});
        brain.mem.engagedTarget = 2;
        brain.mem.engageStart = NOW - 5;
        brain.mem.reaction = 0.2;
        brain.mem.tacticsUntil = NOW + 5;
        brain.mem.useCover = true;
        return { w, e, brain, intent: planFight(brain.context(NOW)) };
    }

    it("in an even exchange with a stone a few steps away, it fights from behind the stone", () => {
        const { w, e, brain, intent } = exchange();
        expect(brain.mem.fight.trace.last("cover")?.detail).toMatch(/^trade/);
        expect(brain.mem.fight.tradeSession).toBe(true);
        const goal = intent.goal as Vec2;
        expect(goal).not.toBeNull();
        expect(v2.distance(goal, w.spot)).toBeLessThan(5);
        expect(w.model.lineOfFire(e.pos, goal)).toBe(false);
    });

    it("a rusher stays in the open; no exchange, no cover trade", () => {
        const rusher = exchange("rusher");
        expect(rusher.brain.mem.fight.trace.last("cover")).toBeUndefined();
        const w = world();
        addObstacle(w, { x: 2.5, y: 2.5 }, "stone_01");
        w.model.self.weapons[0] = { type: "ak47", ammo: 30 };
        w.model.self.inventory["762mm"] = 90;
        addEnemy(w, 2, { x: 18, y: 0 });
        const brain = brainOf(w, SMART, "normal");
        brain.mem.tacticsUntil = NOW + 5;
        brain.mem.useCover = true;
        planFight(brain.context(NOW));
        expect(brain.mem.fight.trace.last("cover")).toBeUndefined();
    });
});

describe("simulations", () => {
    const SPOT = openSpot(flatGame(), 40);

    it("a cooked frag at a dummy behind a stone bursts at it, as it arrives", () => {
        let checked = 0;
        for (const seed of [1, 2, 3]) {
            const stone = v2.add(SPOT, { x: 18, y: 0 });
            const game = flatGame({ sandbox: true }, 1, [{ type: "stone_01", pos: stone }]);
            const me = placePlayer(game, "bot", SPOT);
            giveGun(me, "ak47", 90, WeaponSlot.Primary);
            me.inv.set("frag", 3);
            const dummy = placePlayer(game, "dummy", v2.add(stone, { x: 0, y: 7 }));
            const bot = new BotController(game, me.id, { seed, difficulty: "hard" });
            const hide = v2.add(stone, { x: 2.6, y: 0 });
            let release = -1;
            let last: Vec2 | null = null;
            let burst: { at: number; pos: Vec2 } | null = null;
            for (let i = 0; i < 1500 && !burst; i++) {
                if (i === 60) game.teleportPlayer(dummy.id, hide);
                bot.update();
                game.step();
                game.teleportPlayer(me.id, SPOT);
                dummy.health = 100;
                const box = { min: v2.sub(SPOT, { x: 60, y: 60 }), max: v2.add(SPOT, { x: 60, y: 60 }) };
                const frag = game.projectiles.views(box).find((p) => p.type === "frag");
                if (frag) {
                    if (release < 0) release = i;
                    last = v2.copy(frag.pos);
                } else if (last) burst = { at: i, pos: last };
            }
            if (!burst) continue;
            checked++;
            // it burst at the dummy (inside the full-damage radius), far from the thrower, about as it arrived
            expect(v2.distance(burst.pos, hide), `seed ${seed}`).toBeLessThan(fragBlast("frag").min);
            expect(v2.distance(burst.pos, SPOT)).toBeGreaterThan(fragNoThrowNear("frag"));
            expect((burst.at - release) / 100, `seed ${seed} flight`).toBeLessThan(2);
            expect(bot.bot.brain.mem.fight.trace.last("cook")?.detail).toMatch(/^(airburst|cover)/);
        }
        expect(checked).toBeGreaterThanOrEqual(2);
    });

    it("returns fire towards an off-screen shooter without ever targeting it", () => {
        const game = flatGame({ sandbox: true });
        const me = placePlayer(game, "bot", SPOT);
        giveGun(me, "mp5", 120, WeaponSlot.Primary);
        const shooterPos = v2.add(SPOT, { x: 36, y: 4 });
        const shooter = placePlayer(game, "shooter", shooterPos);
        giveGun(shooter, "m9", 120, WeaponSlot.Primary);
        const bot = new BotController(game, me.id, { seed: 3, difficulty: "normal" });
        const toShooter = Math.atan2(4, 36);
        let shots = 0;
        let worst = 0;
        for (let i = 0; i < 600; i++) {
            const aim = v2.normalize(v2.sub(SPOT, shooterPos));
            game.setInput(shooter.id, { ...shooter.input, toMouseDir: aim, shootStart: i % 35 === 0 });
            const ammo = me.weaponManager.weapons[WeaponSlot.Primary].ammo;
            bot.update();
            game.step();
            game.teleportPlayer(me.id, SPOT);
            game.teleportPlayer(shooter.id, shooterPos);
            me.health = 100;
            expect(bot.bot.intent.targetId).not.toBe(shooter.id);
            if (me.weaponManager.weapons[WeaponSlot.Primary].ammo < ammo) {
                shots++;
                const err = Math.abs(Math.atan2(me.dir.y, me.dir.x) - toShooter);
                worst = Math.max(worst, err);
            }
        }
        expect(shots).toBeGreaterThan(3);
        // towards the estimate: within its bearing error (15 degrees) plus the hand's scatter
        expect((worst * 180) / Math.PI).toBeLessThan(25);
        expect(bot.bot.model.contacts.has(shooter.id)).toBe(false);
    });
});
