// Perks (M7a): every def perk has an effect, the perk list with sources, size and the adrenaline floor, haste, loot
// perk pickups (one droppable slot, swaps, Trick or Treat?), drops on death, gear perks and the contract views.
// Values: docs/research/items/perks.md and conflicts.md (perk-*), via rules.perks.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, idsOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Game, gunDef, type Player, pickupLoot } from "../src/index.ts";
import { PERK_EFFECTS } from "../src/perks/coverage.ts";
import { addPerk, removePerk } from "../src/perks/perks.ts";
import { flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";

function setup(): { game: Game; p: Player } {
    const game = flatGame();
    const p = spawnAt(game, openSpot(game));
    return { game, p };
}

/** Drops `type` at the player's feet and picks it up. */
function pick(game: Game, p: Player, type: string) {
    const loot = game.loot.addLoot(type, p.pos, p.layer, 1, { pushSpeed: 0 });
    if (!loot) throw new Error(`no loot ${type}`);
    p.pickupTicker = 0;
    return pickupLoot(game, p, loot);
}

describe("perk coverage", () => {
    it("every perk def of the v0.8.82 defs has an implemented effect (perks/coverage.ts)", () => {
        const ids = idsOfType("perk");
        expect(ids).toHaveLength(41);
        expect(ids.filter((id) => !PERK_EFFECTS[id])).toEqual([]);
        expect(Object.keys(PERK_EFFECTS).sort()).toEqual([...ids].sort());
    });
});

describe("perk list and size", () => {
    it("sums the perk sizes and clamps to 0.75..2 (perks.md size table; flak-size 0.2, gotw-values 0.25)", () => {
        const { p } = setup();
        const scales: Array<[string, number]> = [
            ["leadership", 1.25],
            ["steelskin", 1.4],
            ["flak_jacket", 1.2],
            ["small_arms", 0.75],
            ["trick_size", 1.25],
            ["gotw", 1.25],
        ];
        for (const [perk, scale] of scales) {
            addPerk(p, perk);
            expect([perk, p.scale]).toEqual([perk, scale]);
            expect(p.rad).toBeCloseTo(GameConfig.player.radius * scale, 9);
            removePerk(p, perk);
            expect(p.scale).toBe(1);
        }
        for (const perk of ["steelskin", "leadership", "trick_size", "gotw", "flak_jacket"]) addPerk(p, perk);
        expect(p.scale).toBe(2);
    });

    it("Leadership keeps adrenaline at 100 (perks.md leadership minBoost)", () => {
        const { game, p } = setup();
        addPerk(p, "leadership");
        p.boost = 10;
        steps(game, 200);
        expect(p.boost).toBe(100);
        removePerk(p, "leadership");
        steps(game, 100);
        expect(p.boost).toBeLessThan(100);
    });

    it("ignores perks beyond the net limit of 8 (net.ts MaxPerks)", () => {
        const { p } = setup();
        const ids = idsOfType("perk").slice(0, 10);
        const added = ids.map((id) => addPerk(p, id));
        expect(added.filter(Boolean)).toHaveLength(8);
        expect(p.perks).toHaveLength(8);
    });

    it("views carry the perks with their droppable flag, the role and the haste", () => {
        const { p } = setup();
        addPerk(p, "firepower", { fromRole: true });
        addPerk(p, "splinter", { droppable: true });
        expect(p.toView().perks).toEqual([
            { type: "firepower", droppable: false },
            { type: "splinter", droppable: true },
        ]);
        expect(p.localState().perks).toEqual(p.toView().perks);
        expect(p.toView().haste).toEqual({ type: "none", seq: 0 });
        expect(p.toView().role).toBe("");
    });
});

describe("loot perks", () => {
    it("one droppable slot: a second loot perk swaps the first, which drops (perks.md pickup rules)", () => {
        const { game, p } = setup();
        expect(pick(game, p, "splinter")).toBe("success");
        expect(p.perkSources[0]).toMatchObject({ type: "splinter", droppable: true });
        expect(pick(game, p, "splinter")).toBe("alreadyEquipped");
        expect(pick(game, p, "takedown")).toBe("success");
        expect(p.perks).toEqual(["takedown"]);
        expect([...game.loot.items.values()].some((l) => l.type === "splinter")).toBe(true);
    });

    it("refuses a loot perk with 3 non-droppable perks and no loot perk (conflicts.md perk-max-perks-rule)", () => {
        const { game, p } = setup();
        for (const perk of ["leadership", "firepower", "targeting"]) addPerk(p, perk, { fromRole: true });
        expect(pick(game, p, "splinter")).toBe("full");
        expect(p.hasPerk("splinter")).toBe(false);
    });

    it("Trick or Treat? rolls a trick / treat perk that drops back as Trick or Treat? on death (perks.md)", () => {
        const { game, p } = setup();
        expect(pick(game, p, "halloween_mystery")).toBe("success");
        const rolled = p.perks[0];
        expect(rolled === "halloween_mystery").toBe(false);
        expect(rolled.startsWith("trick_") || rolled.startsWith("treat_")).toBe(true);
        expect(p.perkSources[0]).toMatchObject({ droppable: false, replaceOnDeath: "halloween_mystery" });
        game.damagePlayer(p, { amount: 500, damageType: DamageType.Gas });
        expect(p.dead).toBe(true);
        const types = [...game.loot.items.values()].map((l) => l.type);
        expect(types).toContain("halloween_mystery");
        expect(types).not.toContain(rolled);
    });

    it("droppable perks drop on death, role perks do not", () => {
        const { game, p } = setup();
        pick(game, p, "scavenger");
        addPerk(p, "leadership", { fromRole: true });
        game.damagePlayer(p, { amount: 500, damageType: DamageType.Gas });
        const types = [...game.loot.items.values()].map((l) => l.type);
        expect(types).toContain("scavenger");
        expect(types).not.toContain("leadership");
    });

    it("perks with emoteOnPickup emote: trick_nothing and Perky Shoot's turkey (conflicts.md perk-perky-shoot-emote)", () => {
        const { game, p } = setup();
        const emotes: string[] = [];
        const add = game.addEmote.bind(game);
        game.addEmote = (player, type, item) => {
            emotes.push(type);
            add(player, type, item);
        };
        pick(game, p, "turkey_shoot");
        pick(game, p, "trick_nothing");
        expect(emotes).toEqual(["emote_turkeyanimal", "emote_trick_nothing"]);
        // One With Nothing does nothing at all
        expect(p.scale).toBe(1);
        expect(p.perks).toEqual(["trick_nothing"]);
    });
});

describe("gear perks", () => {
    it("the desert Lieutenant Helmet grants Firepower while worn (gear.md helmet03_lt_aged)", () => {
        const { game, p } = setup();
        pick(game, p, "helmet03_lt_aged");
        expect(p.helmet).toBe("helmet03_lt_aged");
        expect(p.hasPerk("firepower")).toBe(true);
        expect(p.toView().perks).toEqual([{ type: "firepower", droppable: false }]);
        pick(game, p, "helmet03_potato");
        expect(p.hasPerk("firepower")).toBe(false);
        expect(p.hasPerk("rare_potato")).toBe(true);
    });

    it("Shishigami no Kabuto makes its wearer the Woods King (gotw + windwalk) and is shown on the map", () => {
        const { game, p } = setup();
        const helmet = game.loot.addLoot("helmet03_forest", v2.add(p.pos, { x: 20, y: 0 }), 0, 1, { pushSpeed: 0 })!;
        game.step();
        expect(game.planes.indicators.map((i) => i.type)).toContain("helmet03_forest");
        p.pickupTicker = 0;
        pickupLoot(game, p, helmet);
        expect(p.role).toBe("woods_king");
        expect(p.perks).toEqual(["gotw", "windwalk"]);
        game.step();
        expect(game.planes.indicators.map((i) => i.type)).not.toContain("helmet03_forest");
        pick(game, p, "helmet03_potato");
        expect(p.role).toBe("");
        expect(p.perks).toEqual(["rare_potato"]);
    });
});

describe("firepower", () => {
    it("extends magazines; losing it deletes the extra rounds (conflicts.md perk-firepower-drop-ammo)", () => {
        const { p } = setup();
        giveGun(p, "m9", { reserve: 60 });
        addPerk(p, "firepower");
        expect(p.weaponManager.ammoStats(gunDef("m9")!).maxClip).toBe(30);
        p.weaponManager.weapons[WeaponSlot.Primary].ammo = 30;
        removePerk(p, "firepower");
        expect(p.weaponManager.weapons[WeaponSlot.Primary].ammo).toBe(15);
        expect(p.inv.get("9mm")).toBe(60);
        p.ctx!.rules.perks.firepowerExcess = "inventory";
        addPerk(p, "firepower");
        p.weaponManager.weapons[WeaponSlot.Primary].ammo = 30;
        removePerk(p, "firepower");
        expect(p.inv.get("9mm")).toBe(75);
    });
});
