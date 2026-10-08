// The baseline behaviours that left bots standing still (found with the idle detector on real-map matches): a fight
// with an obstacle between keeps walking round it (or gives up when there is no way round). The container and explore
// cases are loot-idlefix.test.ts (LOOT), the zone depth brain-zone.test.ts (MOVE). Owner: COMBAT.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { fightScore } from "../src/brain/fightScore.ts";
import { planFight } from "../src/brain/tactics.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, NOW, testWorld } from "./brain-world.ts";

describe("idle fixes", () => {
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
