// The owner's early-game items (bot round 6, user reports 38-41), each behind its own flag: the fist rush at an armed
// enemy (persona mix, juking, punch at point blank, early only), the answer to a bare-handed rusher (melee or keep the
// gun, persona mix), loot routing towards buildings likely to hold good guns, and breaking a cheap crate first when
// unarmed with an enemy near.
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    ANSWER_DIST,
    answerSlot,
    CRATE_SCORE,
    crateFirstChoice,
    crateFirstScore,
    EARLY_ALIVE,
    planRush,
    RUSH_SCORE,
    rushOdds,
    rushScore,
    swapOdds,
} from "../src/brain/early.ts";
import { planExplore } from "../src/brain/explore.ts";
import { brainFeatures } from "../src/brain/features.ts";
import { buildingLootValue, tierGunWorth } from "../src/knowledge/buildingValue.ts";
import { PERSONAS } from "../src/persona.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, giveGun, NOW, testWorld } from "./brain-world.ts";

const persona = (name: keyof typeof PERSONAS) => ({ persona: PERSONAS[name] });

describe("38: early fist rush", () => {
    it("aggressive personas rush often, cautious ones rarely; a long gun is rushed less readily", () => {
        const w = testWorld();
        const pistol = addEnemy(w, 2, { x: 12, y: 0 }, { activeWeapon: "m9" });
        const rifle = addEnemy(w, 3, { x: 12, y: 4 }, { activeWeapon: "ak47" });
        const odds = (name: keyof typeof PERSONAS, e = pistol) =>
            rushOdds(ctxOf(w, ["fistRush"], "normal", persona(name)), e);
        expect(odds("rusher")).toBeGreaterThan(odds("neutral"));
        expect(odds("neutral")).toBeGreaterThan(odds("camper"));
        expect(odds("camper")).toBeLessThan(0.1);
        expect(odds("rat")).toBeLessThan(0.1);
        expect(odds("rusher", rifle)).toBeLessThan(odds("rusher", pistol));
        expect(odds("rusher", rifle)).toBeGreaterThan(0.3);
    });

    it("decided once per enemy: a rusher rushes far more often than a camper across bots", () => {
        const rate = (name: keyof typeof PERSONAS) => {
            let n = 0;
            for (let seed = 1; seed <= 60; seed++) {
                const w = testWorld();
                w.model.self.weapons[0] = { type: "", ammo: 0 };
                addEnemy(w, 2, { x: 12, y: 0 }, { activeWeapon: "m9" });
                const brain = brainOf(w, ["fistRush"], "normal", seed, persona(name));
                if (rushScore(brain.context(NOW)) > 0) n++;
            }
            return n / 60;
        };
        const rusher = rate("rusher");
        const camper = rate("camper");
        expect(rusher).toBeGreaterThan(0.4);
        expect(camper).toBeLessThan(0.15);
    });

    it("jukes all the way in (no straight line), punches at point blank, only early and only unarmed", () => {
        const w = testWorld();
        // unarmed (no gun), an armed enemy 14 u away
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        const e = addEnemy(w, 2, { x: 14, y: 0 }, { activeWeapon: "mp5" });
        const brain = brainOf(w, ["fistRush"]);
        brain.mem.early.rush.set(2, { yes: true, until: NOW + 20 });
        const ctx = brain.context(NOW);
        expect(rushScore(ctx)).toBe(RUSH_SCORE);
        const angles: number[] = [];
        for (let k = 0; k < 6; k++) {
            const intent = planRush(brain.context(NOW + k * 0.8));
            expect(intent.behaviour).toBe("rush");
            expect(intent.slot).toBe(WeaponSlot.Melee);
            const dir = intent.moveDir ?? { x: 1, y: 0 };
            angles.push(Math.atan2(dir.y, dir.x));
        }
        // every leg is off the straight line, on both sides
        expect(angles.every((a) => Math.abs(a) > 0.3)).toBe(true);
        expect(angles.some((a) => a > 0) && angles.some((a) => a < 0)).toBe(true);
        // in reach: the punch
        e.pos = v2.add(w.spot, { x: 2.2, y: 0 });
        const punch = planRush(brain.context(NOW + 6));
        expect(punch.fire).toBe(true);
        // armed, or past the early game: no rush
        expect(rushScore(brain.context(NOW + EARLY_ALIVE + 1))).toBe(0);
        giveGun(w, 0, "mp5");
        const armed = brainOf(w, ["fistRush"]);
        armed.mem.early.rush.set(2, { yes: true, until: NOW + 20 });
        expect(rushScore(armed.context(NOW))).toBe(0);
    });
});

describe("39: answering a fist rusher", () => {
    it("aggressive personas swap to melee, cautious and skilled ones keep the gun", () => {
        const w = testWorld();
        const odds = (name: keyof typeof PERSONAS) => swapOdds(ctxOf(w, ["meleeAnswer"], "normal", persona(name)));
        expect(odds("rusher")).toBeGreaterThan(odds("neutral"));
        expect(odds("neutral")).toBeGreaterThan(odds("camper"));
        const skilled = swapOdds(ctxOf(w, ["meleeAnswer"], "hard"));
        const beginner = swapOdds(ctxOf(w, ["meleeAnswer"], "easy"));
        expect(skilled).toBeLessThan(beginner);
    });

    it("melee at point blank once decided, the gun otherwise; armed rushers always get the gun", () => {
        const w = testWorld();
        const rusher = addEnemy(w, 2, { x: 3, y: 0 }, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
        const brain = brainOf(w, ["meleeAnswer"]);
        brain.mem.early.answer.set(2, { yes: true, until: NOW + 20 });
        const ctx = brain.context(NOW);
        expect(answerSlot(ctx, rusher, 3, WeaponSlot.Primary)).toBe(WeaponSlot.Melee);
        brain.mem.early.answer.set(2, { yes: false, until: NOW + 20 });
        expect(answerSlot(brain.context(NOW), rusher, 3, WeaponSlot.Primary)).toBe(WeaponSlot.Primary);
        // not decided yet and still out of ANSWER_DIST: the gun, no decision taken
        const far = brainOf(w, ["meleeAnswer"]);
        expect(answerSlot(far.context(NOW), rusher, ANSWER_DIST + 3, WeaponSlot.Primary)).toBe(WeaponSlot.Primary);
        expect(far.mem.early.answer.size).toBe(0);
        const gunman = addEnemy(w, 3, { x: 3, y: 1 }, { activeWeapon: "ak47" });
        expect(answerSlot(brain.context(NOW), gunman, 3, WeaponSlot.Primary)).toBe(WeaponSlot.Primary);
    });
});

describe("40: loot routing", () => {
    it("buildings likely to hold good guns are worth more than shacks and outhouses (from the defs)", () => {
        expect(tierGunWorth("main", "tier_police")).toBeGreaterThan(tierGunWorth("main", "tier_world"));
        for (const big of ["warehouse_01", "bank_01", "mansion_01", "barn_01"])
            for (const small of ["shack_01", "outhouse_01", "container_01"])
                expect(buildingLootValue("main", big), `${big} > ${small}`).toBeGreaterThan(
                    buildingLootValue("main", small),
                );
        expect(buildingLootValue("main", "tree_01")).toBe(0);
    });

    it("exploring goes to the valuable building a little farther away, spread over bots", () => {
        const base = testWorld();
        const spot = base.spot;
        const map: MapData = {
            ...base.model.map,
            objects: [
                { id: 901, type: "shack_01", pos: v2.add(spot, { x: 40, y: 0 }), ori: 0, scale: 1, layer: 0 },
                { id: 902, type: "warehouse_01", pos: v2.add(spot, { x: -70, y: 0 }), ori: 0, scale: 1, layer: 0 },
            ],
        };
        const picks = (lootRoute: boolean) => {
            let warehouse = 0;
            for (let seed = 1; seed <= 16; seed++) {
                const w = testWorld(map, spot);
                w.model.self.id = seed;
                const f = { ...brainFeatures("smart"), lootRoute };
                const intent = planExplore(brainOf(w, f, "normal", seed).context(NOW));
                if (intent.goal && intent.goal.x < spot.x) warehouse++;
            }
            return warehouse;
        };
        const routed = picks(true);
        expect(routed).toBeGreaterThan(picks(false));
        expect(routed).toBeGreaterThanOrEqual(10);
        // ...but not every bot: the per-bot spread keeps some on the near shack
        expect(routed).toBeLessThanOrEqual(16);
    });
});

describe("41: crate first when unarmed near an enemy", () => {
    function setup(enemyOff: { x: number; y: number }, crateOff: { x: number; y: number }) {
        const w = testWorld();
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        addEnemy(w, 2, enemyOff, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
        addObstacle(w, crateOff, "crate_01");
        const o = w.model.obstacles[w.model.obstacles.length - 1];
        return { w, choice: { obstacle: o, value: 32, dist: v2.length(crateOff) - 1 } };
    }

    it("breaks a cheap crate close by before fighting, while the enemy is not yet in melee range", () => {
        const { w, choice } = setup({ x: 15, y: 0 }, { x: -6, y: 0 });
        expect(crateFirstScore(ctxOf(w, ["crateFirst"]), choice)).toBe(CRATE_SCORE);
        // its own pick: the nearest cheap crate, not a richer one farther away; none without an enemy near
        addObstacle(w, { x: -10, y: 8 }, "crate_01");
        expect(crateFirstChoice(ctxOf(w, ["crateFirst"]))?.obstacle).toBe(choice.obstacle);
        const alone = testWorld();
        alone.model.self.weapons[0] = { type: "", ammo: 0 };
        addObstacle(alone, { x: -6, y: 0 }, "crate_01");
        expect(crateFirstChoice(ctxOf(alone, ["crateFirst"]))).toBeNull();
    });

    it("fights when the enemy is in melee range, ignores crates past the enemy or far away, and once armed", () => {
        const close = setup({ x: 3, y: 0 }, { x: -6, y: 0 });
        expect(crateFirstScore(ctxOf(close.w, ["crateFirst"]), close.choice)).toBe(0);
        const past = setup({ x: 10, y: 0 }, { x: 14, y: 0 });
        expect(crateFirstScore(ctxOf(past.w, ["crateFirst"]), past.choice)).toBe(0);
        const far = setup({ x: 15, y: 0 }, { x: -20, y: 0 });
        expect(crateFirstScore(ctxOf(far.w, ["crateFirst"]), far.choice)).toBe(0);
        const armed = setup({ x: 15, y: 0 }, { x: -6, y: 0 });
        giveGun(armed.w, 0, "mp5");
        expect(crateFirstScore(ctxOf(armed.w, ["crateFirst"]), armed.choice)).toBe(0);
    });
});
