// Crawling while knocked (owner report 2026-10-10; brain/downed.ts): towards the nearest standing friend (a teammate in
// view counts, not only the squad list), to cover from a close enemy, away from enemies; not standing still.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import { planDowned } from "../src/brain/team.ts";
import { addEnemy, addObstacle, brainOf, NOW, type TestWorld, testWorld } from "./brain-world.ts";

const SMART = BRAIN_PRESETS.smart;
const WITHOUT: Readonly<BrainFeatures> = { ...SMART, crawl: false };

function knocked(): TestWorld {
    const w = testWorld();
    w.model.self.downed = true;
    return w;
}

const plan = (w: TestWorld, f: Readonly<BrainFeatures> = SMART) => planDowned(brainOf(w, f).context(NOW));

describe("crawling while knocked", () => {
    it("crawls to a standing teammate in view (one the squad list does not have), not standing still", () => {
        const w = knocked();
        addEnemy(w, 3, { x: 30, y: 0 }, { teammate: true });
        const goal = plan(w).goal;
        expect(goal).not.toBeNull();
        expect(v2.distance(goal ?? w.spot, v2.add(w.spot, { x: 30, y: 0 }))).toBeLessThan(1);
        // the old rule knew only the squad list: it stood still
        expect(plan(w, WITHOUT).goal).toBeNull();
    });

    it("with an enemy close it crawls behind the cover next to it", () => {
        const w = knocked();
        addEnemy(w, 2, { x: 12, y: 0 });
        addObstacle(w, { x: 3, y: 4 }, "stone_01");
        const goal = plan(w).goal;
        expect(goal).not.toBeNull();
        // behind the stone as seen from the enemy: farther from the enemy than the stone, near it
        const stone = v2.add(w.spot, { x: 3, y: 4 });
        expect(v2.distance(goal ?? w.spot, stone)).toBeLessThan(4);
        const enemy = v2.add(w.spot, { x: 12, y: 0 });
        expect(v2.distance(goal ?? w.spot, enemy)).toBeGreaterThan(v2.distance(stone, enemy));
    });

    it("with an enemy close and no cover it crawls away from it, bent towards a friend", () => {
        const w = knocked();
        addEnemy(w, 2, { x: 10, y: 0 });
        const away = plan(w).goal;
        expect((away?.x ?? w.spot.x) - w.spot.x).toBeLessThan(-3);
        addEnemy(w, 3, { x: 0, y: 40 }, { teammate: true });
        const bent = plan(w).goal;
        expect((bent?.y ?? w.spot.y) - w.spot.y).toBeGreaterThan(1);
        expect((bent?.x ?? w.spot.x) - w.spot.x).toBeLessThan(0);
    });
});
