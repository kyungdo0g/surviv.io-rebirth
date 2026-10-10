// The rebirth's Molotov and flashbang for bots (brain/rebirthThrows.ts): a Molotov at a camper (no cook), a flashbang
// before a push (cooked like a frag), never fire on a teammate; burning ground avoided and left; an incoming Molotov's
// flight line stepped off; a flashed bot stops aiming and backs off (its own state only).
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { avoidPos } from "../src/brain/danger.ts";
import { dodge } from "../src/brain/dodge.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { keepClear, rebirthThrow } from "../src/brain/rebirthThrows.ts";
import { lootValue } from "../src/knowledge/loot.ts";
import { addEnemy, brainOf, FixedBoard, NOW, type TestWorld, testWorld } from "./brain-world.ts";

const SMART = BRAIN_PRESETS.smart;

/** The bot with `item` in its bag and a still enemy 15 u east, out of sight a while (a camper). */
function camper(item: string): TestWorld {
    const w = testWorld();
    w.model.self.inventory[item] = 1;
    addEnemy(w, 2, { x: 15, y: 0 }, { visible: false, lastSeen: NOW - 0.5, lastShotAt: NOW - 1 });
    // it shot at the bot a moment ago: a fight on (not one the early-game pacing holds back)
    w.model.underFire = { time: NOW - 0.5, from: v2.add(w.spot, { x: 15, y: 0 }), shooterId: 2 };
    return w;
}

function think(w: TestWorld) {
    const brain = brainOf(w, SMART, "hard");
    brain.mem.targetId = 2;
    return brain.context(NOW);
}

describe("the rebirth throwables", () => {
    it("are worth picking up", () => {
        const w = testWorld();
        expect(lootValue(w.model.self, "molotov")).toBeGreaterThan(0);
        expect(lootValue(w.model.self, "flashbang")).toBeGreaterThan(0);
    });

    it("a Molotov goes at a camper with no cook; never with a teammate next to it", () => {
        const plan = rebirthThrow(think(camper("molotov")));
        expect(plan?.item).toBe("molotov");
        expect(plan?.cook).toBe(0);
        const w = camper("molotov");
        addEnemy(w, 3, { x: 16, y: 2 }, { teammate: true });
        expect(rebirthThrow(think(w))).toBeNull();
    });

    it("a flashbang goes at a camper before the push, cooked like a frag", () => {
        const plan = rebirthThrow(think(camper("flashbang")));
        expect(plan?.item).toBe("flashbang");
        expect(plan?.cook ?? 0).toBeGreaterThanOrEqual(0);
    });

    it("burning ground is avoided and left", () => {
        const w = testWorld();
        const board = new FixedBoard();
        board.zones = [{ kind: "fire", pos: v2.add(w.spot, { x: 1, y: 0 }), rad: 5.5, until: NOW + 0.5 }];
        w.model.threats = board;
        const ctx = think(w);
        expect(avoidPos(ctx, v2.add(w.spot, { x: 2, y: 0 }))).toBe(true);
        expect(avoidPos(ctx, v2.add(w.spot, { x: 20, y: 0 }))).toBe(false);
        const intent = emptyIntent("loot");
        dodge(ctx, intent);
        expect(intent.moveDir?.x ?? 0).toBeLessThan(-0.5);
    });

    it("an incoming Molotov's flight line is stepped off", () => {
        const w = testWorld();
        addEnemy(w, 2, { x: 20, y: 0 });
        w.model.projectiles = [
            { id: 9, type: "molotov", pos: v2.add(w.spot, { x: 10, y: 0.5 }), posZ: 1, dir: { x: -1, y: 0 }, layer: 0 },
        ];
        w.model.projectileSeen.set(9, NOW - 1);
        const brain = brainOf(w, SMART, "hard");
        dodge(brain.context(NOW - 0.9), emptyIntent("loot"));
        const intent = emptyIntent("loot");
        dodge(brain.context(NOW), intent);
        expect(intent.moveDir).not.toBeNull();
        expect(Math.abs(intent.moveDir?.y ?? 0)).toBeGreaterThan(0.5);
    });

    it("a flashed bot stops aiming and backs off from where it saw enemies", () => {
        const w = testWorld();
        addEnemy(w, 2, { x: 10, y: 0 });
        const board = Object.assign(new FixedBoard(), { blindUntil: () => NOW + 2 });
        w.model.threats = board;
        const intent = emptyIntent("fight");
        intent.targetId = 2;
        intent.fire = true;
        intent.aim = v2.add(w.spot, { x: 10, y: 0 });
        keepClear(think(w), intent);
        expect(intent.fire).toBe(false);
        expect(intent.aim).toBeNull();
        expect(intent.moveDir?.x ?? 0).toBeLessThan(-0.5);
        // not flashed: untouched
        const calm = testWorld();
        addEnemy(calm, 2, { x: 10, y: 0 });
        const i2 = emptyIntent("fight");
        i2.fire = true;
        keepClear(think(calm), i2);
        expect(i2.fire).toBe(true);
    });
});
