// Fight assessment (BrainFeatures.assess): the duel arithmetic (armour, hit chance), the advantage A = ln(TTK_them /
// TTK_me) in even and uneven trades (health, armour, numbers, magazine, intel estimates), and the fight score it
// shapes (push a won trade, do not start a lost one).
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { assess } from "../src/brain/assess.ts";
import { fightScore } from "../src/brain/tactics.ts";
import { armourFactor, erf, hitChance } from "../src/knowledge/duel.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import { addEnemy, ctxOf, faceTo, NOW, TableIntel, testWorld } from "./brain-world.ts";

describe("duel arithmetic", () => {
    it("armour lowers the expected damage of a bullet; headshots are counted", () => {
        expect(armourFactor("", "")).toBeCloseTo(0.85 + 0.15 * 2, 6);
        expect(armourFactor("helmet01", "chest01")).toBeLessThan(armourFactor("", ""));
        expect(armourFactor("helmet03", "chest03")).toBeLessThan(armourFactor("helmet01", "chest01"));
    });

    it("hit chance falls with distance and with spread; erf is accurate", () => {
        expect(erf(0)).toBeCloseTo(0, 6);
        expect(erf(1)).toBeCloseTo(0.8427, 4);
        expect(erf(-1)).toBeCloseTo(-0.8427, 4);
        const mp5 = gunInfo("mp5")!;
        const near = hitChance(mp5, 5, 3, true);
        const far = hitChance(mp5, 40, 3, true);
        expect(near).toBeGreaterThan(far);
        expect(near).toBeLessThanOrEqual(1);
        expect(hitChance(mp5, 20, 3, false)).toBeGreaterThan(hitChance(mp5, 20, 3, true));
        expect(hitChance(mp5, mp5.range + 1, 3, false)).toBe(0);
    });
});

describe("fight assessment", () => {
    it("an even duel is close to 0, a hurt enemy is a won trade, a hurt bot a lost one", () => {
        const w = testWorld();
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        faceTo(e, w.spot);
        const even = ctxOf(w, ["assess"]).assessment!;
        expect(Math.abs(even.advantage)).toBeLessThan(0.3);

        const intel = new TableIntel();
        intel.table.set(2, { estHealth: 30 });
        w.model.intel = intel;
        expect(ctxOf(w, ["assess"]).assessment!.advantage).toBeGreaterThan(0.3);

        intel.table.clear();
        w.model.self.health = 30;
        expect(ctxOf(w, ["assess"]).assessment!.advantage).toBeLessThan(-0.3);
    });

    it("armour, numbers and a short magazine move the advantage", () => {
        const w = testWorld();
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        faceTo(e, w.spot);
        const base = ctxOf(w, ["assess"]).assessment!.advantage;
        e.helmet = "helmet03";
        e.chest = "chest03";
        const armoured = ctxOf(w, ["assess"]).assessment!.advantage;
        expect(armoured).toBeLessThan(base - 0.2);
        e.helmet = "";
        e.chest = "";
        // two more armed enemies within 25 units, facing the bot
        for (const [id, off] of [
            [3, { x: 15, y: 10 }],
            [4, { x: 12, y: -12 }],
        ] as const) {
            faceTo(addEnemy(w, id, off), w.spot);
        }
        const crowd = ctxOf(w, ["assess"]).assessment!;
        expect(crowd.threats).toBe(3);
        expect(crowd.advantage).toBeLessThan(-0.3);
        w.model.contacts.delete(3);
        w.model.contacts.delete(4);
        w.model.self.weapons[0].ammo = 3;
        w.model.self.inventory["9mm"] = 90;
        const short = ctxOf(w, ["assess"]).assessment!;
        expect(short.magShots).toBe(3);
        expect(short.advantage).toBeLessThan(base);
    });

    it("an enemy that has not noticed the bot or is reloading gives it an edge", () => {
        const w = testWorld();
        const e = addEnemy(w, 2, { x: 20, y: 0 });
        e.dir = { x: 1, y: 0 }; // facing away
        const unaware = ctxOf(w, ["assess"]).assessment!.advantage;
        faceTo(e, w.spot);
        const aware = ctxOf(w, ["assess"]).assessment!.advantage;
        expect(unaware).toBeGreaterThan(aware);
        const intel = new TableIntel();
        intel.table.set(2, { action: "reload" });
        w.model.intel = intel;
        expect(ctxOf(w, ["assess"]).assessment!.advantage).toBeGreaterThan(aware);
    });

    it("unarmed, the bot cannot win the trade", () => {
        const w = testWorld();
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        faceTo(addEnemy(w, 2, { x: 15, y: 0 }), w.spot);
        expect(ctxOf(w, ["assess"]).assessment!.advantage).toBeLessThan(-1);
    });

    it("the fight score pushes a won trade and does not start a lost one", () => {
        const w = testWorld();
        // 25 units away, not shooting at the bot: an unprovoked fight
        const e = addEnemy(w, 2, { x: 25, y: 0 });
        faceTo(e, v2.add(w.spot, { x: 0, y: 50 }));
        const plain = fightScore(ctxOf(w, []));
        const intel = new TableIntel();
        intel.table.set(2, { estHealth: 25 });
        w.model.intel = intel;
        expect(fightScore(ctxOf(w, ["assess"]))).toBeGreaterThan(plain);
        intel.table.clear();
        w.model.self.health = 25;
        expect(fightScore(ctxOf(w, ["assess"]))).toBeLessThanOrEqual(0.25);
        // shot at: it fights back whatever the assessment says
        e.lastShotAt = NOW - 0.5;
        expect(fightScore(ctxOf(w, ["assess"]))).toBeGreaterThanOrEqual(0.78);
    });

    it("is computed only while a feature reads it", () => {
        const w = testWorld();
        addEnemy(w, 2, { x: 20, y: 0 });
        expect(ctxOf(w, []).assessment).toBeNull();
        expect(ctxOf(w, ["opportunism"]).assessment).toBeNull();
        expect(ctxOf(w, ["disengage"]).assessment).not.toBeNull();
        expect(assess(ctxOf(w, []), w.model.contacts.get(2)!).targetId).toBe(2);
    });
});
