// The baseline behaviours that left bots standing still (found with the idle detector on real-map matches): a container
// in a room is punched from inside the room, a building the bot cannot get into stops being its explore goal, zone
// targets in small circles lie deep enough to end the rotation, and a fight with an obstacle between keeps walking
// round it (or gives up when there is no way round).
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { planExplore } from "../src/brain/explore.ts";
import { planBreak } from "../src/brain/scavenge.ts";
import { zoneTarget } from "../src/brain/survival.ts";
import { fightScore, planFight } from "../src/brain/tactics.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, NOW, setGas, testWorld } from "./brain-world.ts";

describe("idle fixes", () => {
    it("punches a container from the side that is not behind a wall", () => {
        const w = testWorld();
        // a toilet behind a wall from the bot
        addObstacle(w, { x: 3, y: 0 }, "brick_wall_ext_12");
        addObstacle(w, { x: 5, y: 0 }, "toilet_01");
        const toilet = w.model.obstacles[w.model.obstacles.length - 1];
        // with plenty of ammo the bot would shoot it from 7 units: not through the wall
        const shoot = planBreak(ctxOf(w, []), { obstacle: toilet, value: 32, dist: 3.8 });
        expect(shoot.fire).toBe(false);
        expect(shoot.goal).not.toBeNull();
        // punching: the stand point is past the wall (the old one was against the wall on the bot's side)
        w.model.self.inventory["9mm"] = 0;
        const intent = planBreak(ctxOf(w, []), { obstacle: toilet, value: 32, dist: 3.8 });
        expect(intent.goal).not.toBeNull();
        expect(intent.goal!.x).toBeGreaterThan(3.6);
        expect(intent.stop).toBe(false);
    });

    it("zone targets end the rotation inside the margin the zone behaviour lets go at", () => {
        for (const rad of [12, 20, 30, 60, 150]) {
            const w = testWorld();
            setGas(w, { x: 300, y: 0 }, rad, "moving");
            const gas = w.model.gas!;
            for (const jitter of [0, 0.5, 0.99]) {
                const t = zoneTarget(w.model, jitter);
                // arriving within 3 units of the target puts the bot inside rad - min(14, 0.4 rad)
                expect(v2.distance(t, gas.posNew) + 3).toBeLessThan(rad - Math.min(14, rad * 0.4) + 0.75);
            }
        }
    });

    it("explore does not keep picking a spot where the bot already stands", () => {
        const w = testWorld();
        const brain = brainOf(w, []);
        const a = planExplore(brain.context(NOW));
        expect(a.goal).not.toBeNull();
        expect(v2.distance(a.goal!, w.spot)).toBeGreaterThanOrEqual(4);
    });

    it("an enemy behind a tree at the stopping distance: walk on round it; no way round: move on", () => {
        const w = testWorld();
        addObstacle(w, { x: 2.85, y: 0 }, "tree_01");
        const e = addEnemy(w, 2, { x: 5.7, y: 0 });
        const ctx = ctxOf(w, []);
        expect(w.model.lineOfFire(w.spot, e.pos)).toBe(false);
        const intent = planFight(ctx);
        expect(intent.goal).not.toBeNull();
        // the follower must not count it as arrived where it stands
        expect(intent.arriveDist).toBeLessThan(v2.distance(w.spot, e.pos));
        expect(fightScore(ctx)).toBeGreaterThan(0.5);
        // the way round just failed (no path): another behaviour takes over unless the bot is being hurt
        const brain = brainOf(w, []);
        brain.mem.failedGoal = v2.copy(e.pos);
        brain.mem.failedUntil = NOW + 20;
        expect(fightScore(brain.context(NOW))).toBeLessThan(0.12);
        w.model.lastHurt = NOW - 1;
        expect(fightScore(brain.context(NOW))).toBeGreaterThan(0.5);
        expect(emptyIntent("fight").stop).toBe(false);
    });
});
