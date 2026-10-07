// Disengaging (BrainFeatures.disengage): the trade monitor (damage taken vs dealt over 3 s), the triggers (a lost
// assessment in a fight that is on, or a losing trade under 60 health) only when the retreat is cheap (cover a few
// steps away, or a far threat), never in a brawl or in team modes, the 2 s hysteresis and the 6 s episode cap, the
// retreat itself (cover to cover away from the threat, smoke when it has to cross open ground), and turning to fight
// when caught in the open.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { disengageScore, losingTrade, planDisengage, tradeTotals, updateTrade } from "../src/brain/disengage.ts";
import { fleeScore, healScore } from "../src/brain/survival.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, faceTo, NOW, setGas, testWorld } from "./brain-world.ts";

describe("disengage", () => {
    it("the trade monitor counts health lost to enemies and hits dealt over 3 s", () => {
        const w = testWorld();
        const brain = brainOf(w, ["disengage"]);
        updateTrade(brain.context(NOW));
        w.model.self.health = 70;
        updateTrade(brain.context(NOW + 0.5));
        // the bot's own bullet seen hitting a player (scaled by the snapshots since the last think)
        w.model.bullets = [
            {
                id: 1,
                shooterId: 1,
                bulletType: "bullet_mp5",
                sourceType: "mp5",
                pos: w.spot,
                dir: { x: 1, y: 0 },
                layer: 0,
                maxDist: 100,
                reflectCount: 0,
                hitPlayer: true,
                endDist: 10,
                shotFx: true,
                offHand: false,
            },
        ];
        w.model.snapshots += 2;
        w.model.self.health = 50;
        updateTrade(brain.context(NOW + 1));
        const totals = tradeTotals(brain.context(NOW + 1));
        expect(totals.taken).toBe(50);
        expect(totals.dealt).toBeGreaterThan(10);
        expect(losingTrade(brain.context(NOW + 1))).toBe(true);
        // 3 s later the window forgets it
        w.model.bullets = [];
        updateTrade(brain.context(NOW + 4.5));
        expect(tradeTotals(brain.context(NOW + 4.5)).taken).toBe(0);
    });

    it("an outgunned bot with cover a few steps behind disengages, with a 2 s hysteresis and a 6 s cap", () => {
        const w = testWorld();
        w.model.self.health = 35;
        const e = addEnemy(w, 2, { x: 15, y: 0 }, { lastShotAt: NOW - 0.3 });
        faceTo(e, w.spot);
        addObstacle(w, { x: -2.4, y: 0.6 }, "stone_01");
        const brain = brainOf(w, ["disengage"]);
        expect(brain.context(NOW).assessment!.advantage).toBeLessThan(-0.3);
        expect(disengageScore(brain.context(NOW))).toBeGreaterThan(0.8);
        // the enemy heals up (out of the losing band): the bot keeps disengaging for 2 s, then stops
        w.model.self.health = 100;
        e.lastShotAt = Number.NEGATIVE_INFINITY;
        e.dir = { x: 1, y: 0 };
        w.model.lastHurt = Number.NEGATIVE_INFINITY;
        expect(disengageScore(brain.context(NOW + 1.5))).toBeGreaterThan(0.8);
        expect(disengageScore(brain.context(NOW + 2.5))).toBe(0);
        // an episode that never ends is cut after 6 s
        w.model.self.health = 35;
        faceTo(e, w.spot);
        e.lastShotAt = NOW + 3;
        let t = NOW + 3;
        let last = 1;
        for (; t < NOW + 20 && last > 0; t += 0.5) {
            e.lastShotAt = t;
            e.lastSeen = t;
            last = disengageScore(brain.context(t));
        }
        expect(last).toBe(0);
        expect(t - (NOW + 3)).toBeGreaterThan(6);
        expect(t - (NOW + 3)).toBeLessThan(8);
        expect(disengageScore(brain.context(t + 1))).toBe(0);
    });

    it("fights it out without cover close by, in a brawl, in team modes, in the last circles, or unarmed", () => {
        const outgunned = (off: { x: number; y: number }, cover: boolean) => {
            const w = testWorld();
            w.model.self.health = 30;
            const e = addEnemy(w, 2, off, { lastShotAt: NOW - 0.3 });
            faceTo(e, w.spot);
            if (cover) addObstacle(w, { x: -2.4 * Math.sign(off.x), y: 0.6 }, "stone_01");
            return w;
        };
        // no cover within a few steps: running across open ground only gives free shots
        expect(disengageScore(brainOf(outgunned({ x: 15, y: 0 }, false), ["disengage"]).context(NOW))).toBe(0);
        // a far threat: backing off is cheap
        expect(disengageScore(brainOf(outgunned({ x: 32, y: 0 }, false), ["disengage"]).context(NOW))).toBeGreaterThan(
            0.8,
        );
        // a brawl, even with cover close
        expect(disengageScore(brainOf(outgunned({ x: 8, y: 0 }, true), ["disengage"]).context(NOW))).toBe(0);
        const w = outgunned({ x: 15, y: 0 }, true);
        expect(disengageScore(brainOf(w, ["disengage"]).context(NOW))).toBeGreaterThan(0.8);
        // no threat
        const calm = testWorld();
        calm.model.self.health = 30;
        expect(disengageScore(brainOf(calm, ["disengage"]).context(NOW))).toBe(0);
        // the last circles
        setGas(w, { x: 2, y: 0 }, 20, "waiting");
        expect(disengageScore(brainOf(w, ["disengage"]).context(NOW))).toBe(0);
        w.model.gas = null;
        // team modes: the team trades together
        w.model.team = [
            { playerId: 1, name: "a", health: 30, downed: false, dead: false, disconnected: false, pos: w.spot },
            { playerId: 9, name: "b", health: 100, downed: false, dead: false, disconnected: false, pos: w.spot },
        ];
        expect(disengageScore(brainOf(w, ["disengage"]).context(NOW))).toBe(0);
        w.model.team = [];
        // unarmed
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        expect(disengageScore(brainOf(w, ["disengage"]).context(NOW))).toBe(0);
    });

    it("retreats to cover that shields it and lies farther from the threat", () => {
        const w = testWorld();
        w.model.self.health = 35;
        const e = addEnemy(w, 2, { x: 15, y: 0 }, { lastShotAt: NOW - 0.3 });
        faceTo(e, w.spot);
        // one crate towards the enemy (no use), one behind the bot
        addObstacle(w, { x: 5, y: 0 });
        addObstacle(w, { x: -2.4, y: 0.6 }, "stone_01");
        const brain = brainOf(w, ["disengage"]);
        expect(disengageScore(brain.context(NOW))).toBeGreaterThan(0);
        const intent = planDisengage(brain.context(NOW));
        expect(intent.behaviour).toBe("disengage");
        expect(intent.goal).not.toBeNull();
        const goal = intent.goal!;
        expect(v2.distance(goal, e.pos)).toBeGreaterThan(v2.distance(w.spot, e.pos));
        expect(v2.distance(goal, w.spot)).toBeLessThan(6.5);
        expect(w.model.lineOfFire(e.pos, goal)).toBe(false);
    });

    it("hit in the open on the way to cover with the threat close: turns and fights", () => {
        const w = testWorld();
        w.model.self.health = 35;
        const e = addEnemy(w, 2, { x: 15, y: 0 }, { lastShotAt: NOW - 0.3 });
        faceTo(e, w.spot);
        addObstacle(w, { x: -2.4, y: 0.6 }, "stone_01");
        const brain = brainOf(w, ["disengage"]);
        expect(disengageScore(brain.context(NOW))).toBeGreaterThan(0.8);
        w.model.lastHurt = NOW + 0.4;
        expect(disengageScore(brain.context(NOW + 0.5))).toBe(0);
        // and does not start again right away
        expect(disengageScore(brain.context(NOW + 3))).toBe(0);
    });

    it("smokes the line to a far threat when there is no cover to run to", () => {
        const w = testWorld();
        w.model.self.health = 35;
        w.model.self.inventory.smoke = 1;
        const e = addEnemy(w, 2, { x: 32, y: 0 }, { lastShotAt: NOW - 0.3 });
        faceTo(e, w.spot);
        const brain = brainOf(w, ["disengage"]);
        expect(disengageScore(brain.context(NOW))).toBeGreaterThan(0.8);
        const intent = planDisengage(brain.context(NOW));
        expect(intent.throwPlan?.item).toBe("smoke");
        const p = intent.throwPlan!.pos;
        expect(p.x).toBeGreaterThan(w.spot.x);
        // and runs away from it next
        const next = planDisengage(brain.context(NOW + 0.1));
        expect(next.throwPlan).toBeNull();
        expect(next.goal!.x).toBeLessThan(w.spot.x);
    });

    it("patches up right after a fight before looting, and never flees deeper into the gas", () => {
        const w = testWorld();
        w.model.self.health = 50;
        w.model.self.inventory.bandage = 4;
        w.model.lastHurt = NOW - 4;
        const smart = healScore(ctxOf(w, ["disengage"]));
        const plain = healScore(ctxOf(w, []));
        expect(smart).toBeGreaterThanOrEqual(0.78);
        expect(plain).toBeLessThan(smart);
        // unarmed with an armed enemy close: flee, but in the gas the zone comes first
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        addEnemy(w, 2, { x: 15, y: 0 });
        setGas(w, { x: 200, y: 0 }, 50, "moving");
        expect(fleeScore(ctxOf(w, []))).toBeGreaterThan(0.75);
        expect(fleeScore(ctxOf(w, ["disengage"]))).toBeLessThanOrEqual(0.6);
    });
});
