// Patience in fights (BrainFeatures.pursuit, bot overhaul MOVE-1/2/4): the progress clock gives up a target the bot
// cannot get at (a runner out of reach at once, a stand-off behind cover after one reposition), ignores it until it
// comes back, halves the patience for a second give-up, ends a fist chase after 3 s, and the fight score no longer
// holds targets out of reach, starts fights with a weak gun as readily, or holds a lost trade. Owner: MOVE.
import { type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import type { Brain } from "../src/brain/brain.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { fightScore } from "../src/brain/fightScore.ts";
import { ignoredTarget, NEUTRAL_PATIENCE, patienceOf } from "../src/brain/pursuit.ts";
import type { Contact } from "../src/perception/world.ts";
import { PERSONAS } from "../src/persona.ts";
import {
    addEnemy,
    addObstacle,
    brainOf,
    ctxOf,
    faceTo,
    giveGun,
    NOW,
    type TestWorld,
    testWorld,
} from "./brain-world.ts";

/** An unarmed runner holding its fists `off` from the bot, never seen with a gun. */
function runner(w: TestWorld, off: Vec2): Contact {
    return addEnemy(w, 2, off, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
}

/**
 * Thinks every 0.1 s for `secs` seconds with the bot fighting contact 2 (as if planFight had run), the contact kept
 * `at(t)` from the bot and in view; returns the first time it stopped being worth fighting (no target or score 0), or
 * -1. `each` runs before every think.
 */
function fightFor(
    brain: Brain,
    w: TestWorld,
    c: Contact,
    secs: number,
    at: (t: number) => Vec2,
    each?: (t: number) => void,
) {
    for (let i = 0; i <= secs * 10; i++) {
        const t = i / 10;
        c.pos = v2.add(w.spot, at(t));
        c.lastSeen = NOW + t;
        w.model.time = NOW + t;
        each?.(t);
        const ctx = brain.context(NOW + t);
        const s = ctx.target === c ? fightScore(ctx) : 0;
        if (s <= 0) return t;
        brain.mem.current = "fight";
        brain.mem.targetId = c.id;
    }
    return -1;
}

describe("pursuit: futile chases", () => {
    it("gives up an unarmed runner it cannot reach after 6 s and ignores it until it comes back", () => {
        const w = testWorld();
        giveGun(w, 0, "m870");
        const c = runner(w, { x: 20, y: 0 });
        c.vel = { x: 12, y: 0 };
        const brain = brainOf(w, ["pursuit"]);
        const t = fightFor(brain, w, c, 20, () => ({ x: 20, y: 0 }));
        expect(t).toBeGreaterThan(5.5);
        expect(t).toBeLessThan(7);
        // still out of reach and running: not a target for the ignore window
        c.lastSeen = NOW + t + 5;
        expect(brain.context(NOW + t + 5).target).toBeNull();
        // it shoots at the bot: back on
        w.model.underFire = { time: NOW + t + 5, from: c.pos, shooterId: 2 };
        expect(brain.context(NOW + t + 5.1).target).toBe(c);
    });

    it("keeps chasing while it closes in, and an armed target gets the full patience", () => {
        const w = testWorld();
        giveGun(w, 0, "m870");
        const c = addEnemy(w, 2, { x: 30, y: 0 }, { activeWeapon: "mp5" });
        faceTo(c, v2.add(w.spot, { x: 0, y: 60 }));
        const brain = brainOf(w, ["pursuit"]);
        // closing 3 units every 2 s: never futile
        expect(fightFor(brain, w, c, 14, (t) => ({ x: 30 - 1.5 * t, y: 0 }))).toBe(-1);
        // standing off at 25 units: the neutral patience (12 s)
        const w2 = testWorld();
        giveGun(w2, 0, "m870");
        const c2 = addEnemy(w2, 2, { x: 16, y: 0 }, { activeWeapon: "mp5" });
        faceTo(c2, v2.add(w2.spot, { x: 0, y: 60 }));
        const t = fightFor(brainOf(w2, ["pursuit"]), w2, c2, 20, () => ({ x: 16, y: 0 }));
        expect(t).toBeGreaterThan(NEUTRAL_PATIENCE - 0.5);
        expect(t).toBeLessThan(NEUTRAL_PATIENCE + 1);
    });

    it("damage counts as progress only as a total (chip hits do not hold it up forever)", () => {
        const w = testWorld();
        giveGun(w, 0, "m870");
        const c = runner(w, { x: 20, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        // 2 HP taken from it every second (attributed: its bullets pass close): 10 HP every 5 s keeps the clock fresh
        const t = fightFor(
            brain,
            w,
            c,
            14,
            () => ({ x: 20, y: 0 }),
            (s) => {
                w.model.self.health = 100 - 2 * Math.floor(s);
                w.model.underFire = { time: NOW + s, from: c.pos, shooterId: 99 };
            },
        );
        expect(t).toBeGreaterThan(5.5);
        const w2 = testWorld();
        giveGun(w2, 0, "m870");
        const c2 = runner(w2, { x: 20, y: 0 });
        c2.activeWeapon = "mp5";
        c2.lastArmedAt = NOW;
        faceTo(c2, v2.add(w2.spot, { x: 0, y: 60 }));
        const brain2 = brainOf(w2, ["pursuit"]);
        // 4 HP a second from the target itself: progress every 2.5 s, the chase goes on
        const t2 = fightFor(
            brain2,
            w2,
            c2,
            14,
            () => ({ x: 20, y: 0 }),
            (s) => {
                w2.model.self.health = 100 - 4 * Math.floor(s);
                w2.model.underFire = { time: NOW + s, from: c2.pos, shooterId: 2 };
            },
        );
        expect(t2).toBe(-1);
    });

    it("patience comes from the persona (capped), and a second give-up halves it", () => {
        const w = testWorld();
        giveGun(w, 0, "m870");
        const c = addEnemy(w, 2, { x: 20, y: 0 }, { activeWeapon: "mp5" });
        expect(patienceOf(ctxOf(w, ["pursuit"]), c)).toBe(NEUTRAL_PATIENCE);
        expect(patienceOf(ctxOf(w, ["pursuit"], "normal", { persona: PERSONAS.marksman }), c)).toBe(6);
        expect(patienceOf(ctxOf(w, ["pursuit"], "normal", { persona: PERSONAS.rusher }), c)).toBe(18);
        // the rat never chases: the floor of 2 s
        expect(patienceOf(ctxOf(w, ["pursuit"], "normal", { persona: PERSONAS.rat }), c)).toBe(2);
        const brain = brainOf(w, ["pursuit"]);
        brain.mem.pursuit.strikes.set(2, { n: 1, at: NOW });
        expect(patienceOf(brain.context(NOW), c)).toBe(NEUTRAL_PATIENCE / 2);
    });

    it("flags a stand-off behind cover futile once (COMBAT repositions), then drops it", () => {
        const w = testWorld();
        const c = addEnemy(w, 2, { x: 9, y: 0 }, { activeWeapon: "mp5" });
        faceTo(c, v2.add(w.spot, { x: 0, y: 60 }));
        addObstacle(w, { x: 4.5, y: 0 }, "stone_01");
        const brain = brainOf(w, ["pursuit"]);
        let flaggedAt = -1;
        const t = fightFor(
            brain,
            w,
            c,
            25,
            () => ({ x: 9, y: 0 }),
            (s) => {
                if (flaggedAt < 0 && brain.mem.pursuit.isFutile(2)) flaggedAt = s;
            },
        );
        expect(flaggedAt).toBeGreaterThan(NEUTRAL_PATIENCE - 0.5);
        expect(t - flaggedAt).toBeGreaterThan(2.5);
        expect(t - flaggedAt).toBeLessThan(4);
        expect(brain.mem.pursuit.isFutile(2)).toBe(false);
        // it peeks (a line of fire in reach): picked up again
        w.model.obstacles.length = 0;
        expect(brain.context(NOW + t + 1).target).toBe(c);
    });

    it("fights an exchange in reach to the end with three players left; a chase or a stand-off still ends", () => {
        // in reach (m870: 14 x 0.85 = 11.9 units) with a line of fire: fought out
        const w = testWorld();
        giveGun(w, 0, "m870");
        const c = runner(w, { x: 10, y: 0 });
        w.model.aliveCount = 3;
        expect(fightFor(brainOf(w, ["pursuit"]), w, c, 20, () => ({ x: 10, y: 0 }))).toBe(-1);
        // out of reach: the clock runs with twice the patience (unarmed target: 6 s -> 12 s)
        const w2 = testWorld();
        giveGun(w2, 0, "m870");
        const c2 = runner(w2, { x: 20, y: 0 });
        w2.model.aliveCount = 3;
        const t2 = fightFor(brainOf(w2, ["pursuit"]), w2, c2, 20, () => ({ x: 20, y: 0 }));
        expect(t2).toBeGreaterThan(11.5);
        expect(t2).toBeLessThan(13);
        // in reach behind cover (the last three AK rushers of a match probe, 73 s without a line of fire): twice the
        // neutral patience, the one reposition, then dropped
        const w3 = testWorld();
        const c3 = addEnemy(w3, 2, { x: 9, y: 0 }, { activeWeapon: "mp5" });
        faceTo(c3, v2.add(w3.spot, { x: 0, y: 60 }));
        addObstacle(w3, { x: 4.5, y: 0 }, "stone_01");
        w3.model.aliveCount = 2;
        const t3 = fightFor(brainOf(w3, ["pursuit"]), w3, c3, 40, () => ({ x: 9, y: 0 }));
        expect(t3).toBeGreaterThan(2 * NEUTRAL_PATIENCE + 2.5);
        expect(t3).toBeLessThan(2 * NEUTRAL_PATIENCE + 4.5);
    });

    it("fights a downed target to the end", () => {
        const w = testWorld();
        giveGun(w, 0, "m870");
        const c = runner(w, { x: 20, y: 0 });
        c.downed = true;
        expect(fightFor(brainOf(w, ["pursuit"]), w, c, 15, () => ({ x: 20, y: 0 }))).toBe(-1);
    });

    it("ends a fist chase after about 3 s, and punches back when hit", () => {
        const w = testWorld();
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        const c = runner(w, { x: 3, y: 0 });
        c.vel = { x: 13, y: 0 };
        const brain = brainOf(w, ["pursuit"]);
        const t = fightFor(brain, w, c, 10, () => ({ x: 3, y: 0 }));
        expect(t).toBeGreaterThan(2.5);
        expect(t).toBeLessThan(4);
        // the baseline brain follows it for ever
        const w2 = testWorld();
        w2.model.self.weapons[0] = { type: "", ammo: 0 };
        const c2 = runner(w2, { x: 3, y: 0 });
        expect(fightFor(brainOf(w2, []), w2, c2, 10, () => ({ x: 3, y: 0 }))).toBe(-1);
        // hit by it: the 0.7 retaliation
        w.model.lastHurt = NOW + t + 1;
        const ctx = brain.context(NOW + t + 1.2);
        expect(ctx.target).toBe(c);
        expect(fightScore(ctx)).toBe(0.7);
    });

    it("a baseline bot ignores nothing", () => {
        const w = testWorld();
        const c = runner(w, { x: 20, y: 0 });
        const brain = brainOf(w, []);
        brain.mem.pursuit.ignored.set(2, { until: NOW + 100, dist: 20 });
        expect(ignoredTarget(brain.context(NOW), c)).toBe(false);
        expect(brain.context(NOW).target).toBe(c);
    });
});

describe("pursuit: fight score", () => {
    /** An unprovoked fight 20 units away (the enemy looks elsewhere) with `gun` in hand. */
    function unprovoked(gun: string, persona?: keyof typeof PERSONAS): number {
        const w = testWorld();
        giveGun(w, 0, gun);
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        faceTo(e, v2.add(w.spot, { x: 0, y: 60 }));
        return fightScore(ctxOf(w, ["pursuit"], "normal", persona ? { persona: PERSONAS[persona] } : {}));
    }

    it("starts fights less readily with a weak gun (loadout confidence), rushers less so", () => {
        const pistol = unprovoked("ot38");
        const smg = unprovoked("mp5");
        expect(pistol).toBeCloseTo(0.56 * 0.55, 5);
        expect(smg).toBeGreaterThan(pistol);
        expect(unprovoked("ot38", "rusher")).toBeCloseTo((0.56 + 0.15) * 0.8, 5);
    });

    it("does not start a chase for a target far out of reach, and holds a running one only while patient", () => {
        const w = testWorld();
        giveGun(w, 0, "m870");
        const e = addEnemy(w, 2, { x: 30, y: 0 });
        faceTo(e, v2.add(w.spot, { x: 0, y: 60 }));
        expect(fightScore(ctxOf(w, ["pursuit"]))).toBeCloseTo(0.1, 5);
        // the baseline score keeps 0.35 out there for ever
        expect(fightScore(ctxOf(w, []))).toBeCloseTo(0.35, 5);
        const brain = brainOf(w, ["pursuit"]);
        brain.mem.current = "fight";
        brain.mem.targetId = 2;
        expect(fightScore(brain.context(NOW))).toBeCloseTo(0.3, 5);
    });

    it("leaves a clearly lost trade the target has not started (0.1), fights one that is only behind", () => {
        const w = testWorld();
        const e = addEnemy(w, 2, { x: 25, y: 0 }, { activeWeapon: "m249", helmet: "helmet03", chest: "chest03" });
        faceTo(e, v2.add(w.spot, { x: 0, y: 50 }));
        w.model.self.health = 25;
        const lost = ctxOf(w, ["assess", "pursuit"]);
        expect(lost.assessment?.advantage).toBeLessThan(-1);
        expect(fightScore(ctxOf(w, ["assess"]))).toBeCloseTo(0.25, 5);
        expect(fightScore(lost)).toBeLessThanOrEqual(0.1);
        // shot at by it: fight back whatever the assessment says
        w.model.underFire = { time: NOW - 0.3, from: e.pos, shooterId: 2 };
        expect(fightScore(ctxOf(w, ["assess", "pursuit"]))).toBeGreaterThanOrEqual(0.78);
        // only behind (-1 < A < -0.3: the smart bot still won 56% of those): an ordinary fight, no stand-off cap
        const w2 = testWorld();
        const e2 = addEnemy(w2, 2, { x: 22, y: 0 }, { activeWeapon: "mp5" });
        faceTo(e2, v2.add(w2.spot, { x: 0, y: 50 }));
        w2.model.self.health = 45;
        const behind = ctxOf(w2, ["assess", "pursuit"]);
        const a = behind.assessment?.advantage ?? 0;
        expect(a).toBeLessThan(-0.3);
        expect(a).toBeGreaterThan(-1);
        expect(fightScore(ctxOf(w2, ["assess"]))).toBeCloseTo(0.25, 5);
        expect(fightScore(behind)).toBeGreaterThan(0.3);
    });

    it("an enemy firing at someone else is not a threat to the bot (only to the baseline's lastShotAt)", () => {
        const w = testWorld();
        const e = addEnemy(w, 2, { x: 20, y: 0 }, { lastShotAt: NOW - 0.5 });
        faceTo(e, v2.add(w.spot, { x: 20, y: 60 }));
        expect(fightScore(ctxOf(w, []))).toBeCloseTo(0.78, 5);
        expect(fightScore(ctxOf(w, ["pursuit"]))).toBeLessThan(0.78);
    });

    it("an ammo-starved bot restocks before an unprovoked fight", () => {
        const w = testWorld();
        giveGun(w, 0, "mp5", 6, 0);
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        faceTo(e, v2.add(w.spot, { x: 0, y: 60 }));
        expect(fightScore(ctxOf(w, ["assess", "pursuit"]))).toBeLessThanOrEqual(0.3);
    });

    it("the smart preset carries the flag", () => {
        expect(BRAIN_PRESETS.smart.pursuit).toBe(true);
        expect(BRAIN_PRESETS.baseline.pursuit).toBe(false);
    });
});
