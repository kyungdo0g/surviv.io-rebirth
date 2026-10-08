// LOOT (bot overhaul): gun valuation by the shared tier list and the bot's taste (knowledge/desire.ts), the weapon to
// fight with by time to kill and range habits (arsenal.ts fightSlot), the carry slot, the empty-magazine and off-hand
// reload deadlocks and holstering (brain/weapons.ts). Owner: LOOT.
import { v2 } from "@rebirth/core";
import { Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { bestLoot } from "../src/brain/explore.ts";
import { manageWeapons } from "../src/brain/weapons.ts";
import { carrySlot, fightSlot, type HeldGun } from "../src/knowledge/arsenal.ts";
import { gunPickupValue } from "../src/knowledge/desire.ts";
import { expectedTtk } from "../src/knowledge/duel.ts";
import { lootValue, slotToReplace } from "../src/knowledge/loot.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import { PERSONAS } from "../src/persona.ts";
import { addEnemy, brainOf, ctxOf, faceTo, giveGun, NOW, testWorld } from "./brain-world.ts";

function held(slot: number, id: string, mag?: number, reserve = 90): HeldGun {
    const info = gunInfo(id)!;
    return { slot, info, mag: mag ?? info.def.maxClip, reserve };
}

/** A bot holding `a` (slot 0) and `b` (slot 1) with full magazines, slot `cur` in hand. */
function loadout(a: string, b: string, cur = 0) {
    const w = testWorld();
    giveGun(w, 0, a);
    giveGun(w, 1, b);
    w.model.self.curWeapIdx = cur;
    return w;
}

describe("gun valuation (desire)", () => {
    it("never swaps an S-tier gun for a pistol, and replaces the weaker gun instead", () => {
        const w = loadout("m249", "pkp");
        // both S: the best pistol of the game (dual P30L, A) is not worth an S gun
        expect(lootValue(w.model.self, "p30l_dual")).toBe(0);
        expect(lootValue(w.model.self, "ots38_dual")).toBe(0);
        expect(lootValue(w.model.self, "m9")).toBe(0);
        // M249 + M9: a pistol or an SMG found replaces the M9, never the M249
        const w2 = loadout("m249", "m9");
        expect(lootValue(w2.model.self, "p30l_dual")).toBeGreaterThan(0);
        expect(lootValue(w2.model.self, "mp5")).toBeGreaterThan(0);
        expect(slotToReplace(w2.model.self, undefined, "p30l_dual")).toBe(1);
        // ...for every persona at every skill, whatever the pistol
        for (const persona of Object.values(PERSONAS)) {
            for (const s of [0, 0.15, 0.5, 0.825, 1]) {
                for (const pistol of ["p30l_dual", "ots38_dual", "deagle_dual", "m9", "ot38"]) {
                    expect(gunPickupValue(w.model.self, pistol, { persona, s })).toBe(0);
                    expect(slotToReplace(w2.model.self, { persona, s }, pistol)).toBe(1);
                }
            }
        }
        // two guns of one class are not swapped back and forth (an MP5 for a UMP9 next to a shotgun, and back)
        const w3 = loadout("mp5", "m870");
        expect(lootValue(w3.model.self, "ump9")).toBe(0);
        // nor a loaded gun for an empty one: guns lie empty, without their ammo in the bag or close by they are dead
        const w4 = loadout("mp5", "hk416");
        w4.model.self.weapons[0].ammo = 0;
        w4.model.self.inventory["9mm"] = 200;
        w4.model.self.inventory["12gauge"] = 0;
        expect(lootValue(w4.model.self, "saiga", undefined, new Set())).toBe(0);
        expect(lootValue(w4.model.self, "saiga", undefined, new Set(["12gauge"]))).toBeGreaterThan(0);
        // an M870 is not worth the swap even with shells close by: since the stat rebuild (docs/design/gun-tiers.md)
        // it is B+, one step over the MP5 (B); its 0.9 s pump puts its 5-10 u kill time at 1.04 s against the Saiga's
        // 0.47, under the upgrade threshold
        expect(lootValue(w4.model.self, "m870", undefined, new Set(["12gauge"]))).toBe(0);
        // ...and once it holds the empty shotgun with shells lying close by, the MP5 is not taken back
        w4.model.self.weapons[0] = { type: "saiga", ammo: 0 };
        expect(lootValue(w4.model.self, "mp5", undefined, new Set(["12gauge"]))).toBe(0);
        // an S gun out of ammo with none in the bag may go
        w.model.self.weapons[1].ammo = 0;
        w.model.self.inventory["762mm"] = 0;
        expect(slotToReplace(w.model.self)).toBe(1);
    });

    it("ranks by the tier list: a Mosin over an M93R, an M249 carried over an M1100", () => {
        const w = loadout("m93r", "mp5");
        // the old DPS score kept the M93R over a Mosin (45.7 vs 42.7)
        expect(slotToReplace(w.model.self)).toBe(0);
        expect(lootValue(w.model.self, "mosin")).toBeGreaterThan(0);
        const self = loadout("m249", "m1100", 1).model.self;
        expect(carrySlot(self, [held(0, "m249"), held(1, "m1100")])).toBe(0);
        const mosin = loadout("mosin", "m93r", 1).model.self;
        expect(carrySlot(mosin, [held(0, "mosin"), held(1, "m93r")])).toBe(0);
    });

    it("an under-armed bot (weak guns only) wants any real gun at 88 or more", () => {
        const w = testWorld();
        giveGun(w, 0, "m9");
        expect(lootValue(w.model.self, "mp5")).toBeGreaterThanOrEqual(88);
        expect(lootValue(w.model.self, "ak47")).toBeGreaterThanOrEqual(88);
        // a P30L holder is not under-armed (critique C3: weak is the tier, not the pistol class)
        const p = testWorld();
        giveGun(p, 0, "p30l");
        expect(lootValue(p.model.self, "mp5")).toBeLessThan(88);
    });

    it("prefers its persona's class among guns of equal tier", () => {
        for (const [persona, want] of [
            ["marksman", "mk12"],
            ["rusher", "scar"],
        ] as const) {
            const w = testWorld();
            giveGun(w, 0, "m870");
            // an A-tier DMR and an A-tier rifle at the same distance
            w.model.loot.set(80, {
                id: 80,
                type: "mk12",
                pos: v2.add(w.spot, { x: 8, y: 0 }),
                count: 1,
                layer: 0,
                lastSeen: NOW,
            });
            w.model.loot.set(81, {
                id: 81,
                type: "scar",
                pos: v2.add(w.spot, { x: -8, y: 0 }),
                count: 1,
                layer: 0,
                lastSeen: NOW,
            });
            const ctx = ctxOf(w, [], "normal", {
                persona: PERSONAS[persona],
                skill: { tier: "intermediate", s: 0.6, g: 0.6 },
            });
            expect(bestLoot(ctx)?.loot.type).toBe(want);
        }
    });
});

describe("weapon to fight with", () => {
    it("picks the shotgun close, the rifle mid range and the sniper far", () => {
        const at = (a: string, b: string, d: number, cur = 2) =>
            fightSlot(loadout(a, b, cur).model.self, [held(0, a), held(1, b)], d);
        // drawing from the fists
        expect(at("m870", "ak47", 5)).toBe(0);
        expect(at("m870", "ak47", 20)).toBe(1);
        expect(at("ak47", "mosin", 20)).toBe(0);
        expect(at("ak47", "mosin", 60)).toBe(1);
        expect(at("m870", "mosin", 5)).toBe(0);
        expect(at("m870", "mosin", 50)).toBe(1);
        // with the rifle in hand, a close fight still takes the shotgun
        expect(at("m870", "ak47", 4, 1)).toBe(0);
    });

    it("keeps a loaded shotgun over a pistol at 12 units and a rifle over a G18C up close", () => {
        expect(fightSlot(loadout("m870", "m9").model.self, [held(0, "m870"), held(1, "m9")], 12)).toBe(0);
        expect(fightSlot(loadout("ak47", "glock", 2).model.self, [held(0, "ak47"), held(1, "glock")], 3)).toBe(0);
        expect(fightSlot(loadout("groza", "m9", 2).model.self, [held(0, "groza"), held(1, "m9")], 3)).toBe(0);
        // nothing loaded: fists
        expect(fightSlot(loadout("mp5", "m9").model.self, [held(0, "mp5", 0, 0), held(1, "m9", 0, 0)], 5)).toBe(
            WeaponSlot.Melee,
        );
    });

    it("time to kill counts whole hits, armour and the magazine", () => {
        const mosin = gunInfo("mosin")!;
        // three body hits through level 1 armour (72 x 0.694 = 49.95), two without
        const bare = expectedTtk(mosin, 5, 30, 10, { sigmaDeg: 0.1 });
        const armoured = expectedTtk(mosin, 5, 30, 10, { sigmaDeg: 0.1, helmet: "helmet01", chest: "chest01" });
        expect(bare).toBeCloseTo(mosin.cycle, 2);
        expect(armoured).toBeCloseTo(2 * mosin.cycle, 2);
        // an empty magazine adds the reload; no rounds at all: never
        const mp5 = gunInfo("mp5")!;
        expect(expectedTtk(mp5, 0, 90, 10, { sigmaDeg: 2 })).toBeGreaterThan(
            expectedTtk(mp5, 30, 90, 10, { sigmaDeg: 2 }),
        );
        expect(expectedTtk(mp5, 0, 0, 10, { sigmaDeg: 2 })).toBe(Number.POSITIVE_INFINITY);
    });
});

describe("reload deadlocks", () => {
    it("reloads an empty magazine with an enemy close by (both brains)", () => {
        for (const features of [[], ["smartReload"]] as const) {
            const w = testWorld();
            w.model.self.weapons[0].ammo = 0;
            faceTo(addEnemy(w, 2, { x: 8, y: 0 }), w.spot);
            const intent = emptyIntent("fight");
            intent.slot = 0;
            manageWeapons(ctxOf(w, [...features]), intent);
            expect(intent.actions).toContain(Input.Reload);
        }
    });

    it("reloads the gun in the other slot once things are quiet, and keeps it in hand meanwhile", () => {
        const w = testWorld();
        giveGun(w, 1, "m870", 0, 20);
        const brain = brainOf(w, []);
        const first = emptyIntent("explore");
        first.goal = v2.add(w.spot, { x: 30, y: 0 });
        manageWeapons(brain.context(NOW), first);
        expect(first.slot).toBe(1);
        // switched: the empty shotgun is not swapped back for the carried MP5 while it reloads
        w.model.self.curWeapIdx = 1;
        const next = emptyIntent("explore");
        next.goal = first.goal;
        manageWeapons(brain.context(NOW + 0.5), next);
        expect(next.slot).toBeNull();
        expect(next.actions).toContain(Input.Reload);
        // an enemy in view: no reload swap
        const w2 = testWorld();
        giveGun(w2, 1, "m870", 0, 20);
        addEnemy(w2, 2, { x: 25, y: 0 }, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
        const busy = emptyIntent("explore");
        manageWeapons(ctxOf(w2, []), busy);
        expect(busy.slot).not.toBe(1);
    });
});

describe("gun in hand after a fight", () => {
    it("goes back to the gun it wants most once things are quiet (both brains), not right away", () => {
        for (const features of [[], ["smartReload"]] as const) {
            const w = loadout("ak47", "m9", 1);
            const brain = brainOf(w, [...features]);
            // a moment ago an enemy was in view: keep the pistol it fought with
            brain.mem.loot2.lastThreat = NOW - 0.5;
            const soon = emptyIntent("explore");
            soon.goal = v2.add(w.spot, { x: 30, y: 0 });
            manageWeapons(brain.context(NOW), soon);
            expect(soon.slot).toBeNull();
            const later = emptyIntent("explore");
            later.goal = soon.goal;
            manageWeapons(brain.context(NOW + 3), later);
            expect(later.slot).toBe(0);
        }
    });
});

describe("holstering", () => {
    it("holsters while travelling with nobody around and draws when a threat appears (holster flag only)", () => {
        const w = testWorld();
        const travel = () => {
            const it = emptyIntent("explore");
            it.goal = v2.add(w.spot, { x: 40, y: 0 });
            return it;
        };
        const brain = brainOf(w, ["holster"]);
        const quiet = travel();
        manageWeapons(brain.context(NOW), quiet);
        expect(quiet.slot).toBe(WeaponSlot.Melee);
        // the baseline keeps its gun out
        const plain = travel();
        manageWeapons(brainOf(w, []).context(NOW), plain);
        expect(plain.slot).not.toBe(WeaponSlot.Melee);
        // holstered, an enemy shows: the fight gun is drawn at once
        w.model.self.curWeapIdx = WeaponSlot.Melee;
        faceTo(addEnemy(w, 2, { x: 20, y: 0 }), w.spot);
        const threat = travel();
        manageWeapons(brain.context(NOW + 1), threat);
        expect(threat.slot).toBe(0);
        // gone again: it stays drawn for a few seconds, then holsters
        w.model.contacts.delete(2);
        const after = travel();
        manageWeapons(brain.context(NOW + 2), after);
        expect(after.slot).toBe(0);
        const later = travel();
        manageWeapons(brain.context(NOW + 8), later);
        expect(later.slot).toBe(WeaponSlot.Melee);
    });
});
