// Door fixtures for the door tests (test/doors*.test.ts): a door obstacle as a snapshot shows it, and frames of a
// synthetic world (brain-world.ts) fed to a door brain one decision at a time.
import { type Vec2, v2 } from "@rebirth/core";
import type { Brain } from "../src/brain/brain.ts";
import type { BrainCtx } from "../src/brain/context.ts";
import { obstacleCollider, obstacleDef } from "../src/geom.ts";
import { screenBounds } from "../src/perception/sight.ts";
import type { SeenObstacle } from "../src/perception/world.ts";
import type { TestWorld } from "./brain-world.ts";

/** A door obstacle of `type` at `pos` / `ori` as a snapshot shows it (closed unless `open`; `seq` its use count). */
export function seenDoor(
    id: number,
    type: string,
    pos: Vec2,
    ori: number,
    over: { open?: boolean; seq?: number } = {},
): SeenObstacle {
    const def = obstacleDef(type)!;
    const d = def.door!;
    return {
        view: {
            kind: "obstacle",
            id,
            type,
            pos: v2.copy(pos),
            layer: 0,
            ori,
            scale: 1,
            healthT: 1,
            dead: false,
            door: { open: over.open ?? false, locked: d.locked ?? false, canUse: d.canUse, seq: over.seq ?? 0 },
        },
        def,
        col: obstacleCollider(def, pos, ori, 1),
        solid: true,
        blocksBullets: true,
        blocksMove: true,
    };
}

/** Puts the bot's 16:9 screen at its position for `zoom` (WorldModel.observe does it from a snapshot). */
export function setScreen(w: TestWorld, zoom = 28): void {
    w.model.self.zoom = zoom;
    w.model.screenZoom = zoom;
    w.model.screen = screenBounds(w.model.self.pos, zoom);
}

/** One decision's door observation at time `t` with `obstacles` in the snapshot; returns the context it used. */
export function doorFrame(w: TestWorld, brain: Brain, t: number, obstacles: SeenObstacle[]): BrainCtx {
    w.model.time = t;
    w.model.obstacles = obstacles;
    w.model.obstacleById.clear();
    for (const o of obstacles) w.model.obstacleById.set(o.view.id, o);
    const ctx = brain.context(t);
    brain.doors?.observe(ctx);
    return ctx;
}
