// The baseline looting behaviours that left bots standing still (found with the idle detector on real-map matches): a
// container in a room is punched from inside the room (never shot through the wall), and explore does not pick the spot
// the bot stands on. Split out of brain-idlefix.test.ts in the bot overhaul's stage 0. Owner: LOOT.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { planExplore } from "../src/brain/explore.ts";
import { planBreak } from "../src/brain/scavenge.ts";
import { addObstacle, brainOf, ctxOf, NOW, testWorld } from "./brain-world.ts";

describe("idle fixes: looting", () => {
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

    it("explore does not keep picking a spot where the bot already stands", () => {
        const w = testWorld();
        const brain = brainOf(w, []);
        const a = planExplore(brain.context(NOW));
        expect(a.goal).not.toBeNull();
        expect(v2.distance(a.goal!, w.spot)).toBeGreaterThanOrEqual(4);
    });
});
