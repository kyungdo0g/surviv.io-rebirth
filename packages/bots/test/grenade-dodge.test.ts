// Grenade dodging (owner report 2026-10-10; brain/dodge.ts): teammates cannot hurt each other in any mode, so a frag
// seen leaving a teammate's hand is not run from (its own still is: self-damage counts); and a frag lying behind a wall
// that stops the explosion's rays to the bot's whole body is not run from either (sim combat/explosions.ts: rays stop
// at collidable obstacles taller than 0.5; a crate, 0.5 high, does not shield).
import type { Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { dodge } from "../src/brain/dodge.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { addEnemy, addObstacle, brainOf, NOW, type TestWorld, testWorld } from "./brain-world.ts";

const SMART = BRAIN_PRESETS.smart;

/** A frag `off` from the bot, flying along `dir` (posZ 0: on the ground), first seen `shown` seconds ago. */
function frag(w: TestWorld, off: Vec2, dir: Vec2 = { x: -1, y: 0 }, shown = 0) {
    w.model.projectiles = [{ id: 9, type: "frag", pos: v2.add(w.spot, off), posZ: 0, dir, layer: 0 }];
    w.model.projectileSeen.set(9, NOW - shown);
}

/** Thinks at NOW (the attribution), then dodges at `later` (after the reaction); the move direction or null. */
function dodged(w: TestWorld, later = 1): Vec2 | null {
    const brain = brainOf(w, SMART, "hard");
    dodge(brain.context(NOW), emptyIntent("loot"));
    const intent = emptyIntent("loot");
    dodge(brain.context(NOW + later), intent);
    return intent.moveDir;
}

describe("grenade dodging", () => {
    it("an enemy's frag landing 6 u away is run from", () => {
        const w = testWorld();
        addEnemy(w, 2, { x: 14, y: 0 });
        frag(w, { x: 6, y: 0 });
        expect(dodged(w)?.x ?? 0).toBeLessThan(-0.5);
    });

    it("a teammate's frag (seen leaving its hand) is not run from: teammates cannot hurt each other", () => {
        const w = testWorld();
        addEnemy(w, 3, { x: 8, y: 0 }, { teammate: true });
        addEnemy(w, 2, { x: 0, y: 25 });
        // just out of the teammate's hand, flying west towards the bot
        frag(w, { x: 6.5, y: 0 });
        expect(dodged(w)).toBeNull();
        // the same frag coming from an enemy's side is run from
        const e = testWorld();
        addEnemy(e, 2, { x: 8, y: 0 });
        addEnemy(e, 3, { x: 0, y: 25 }, { teammate: true });
        frag(e, { x: 6.5, y: 0 });
        expect(dodged(e)).not.toBeNull();
    });

    it("a frag behind a wall is not run from; behind a crate (too low to stop the blast) it is", () => {
        const wall = testWorld();
        addEnemy(wall, 2, { x: 14, y: 0 });
        addObstacle(wall, { x: 3, y: 0 }, "metal_wall_ext_10");
        frag(wall, { x: 6, y: 0 });
        expect(dodged(wall)).toBeNull();
        const crate = testWorld();
        addEnemy(crate, 2, { x: 14, y: 0 });
        addObstacle(crate, { x: 3, y: 0 }, "crate_01");
        frag(crate, { x: 6, y: 0 });
        expect(dodged(crate)).not.toBeNull();
    });
});
