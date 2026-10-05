import { createRng, v2 } from "@rebirth/core";
import { DamageType, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { canHeadshot, computeDamage, type DamageParams, defaultRules, rollHeadshot } from "../src/index.ts";
import { constantRng, fireOnce, flatGame, giveGun, openSpot, recordShots, spawnAt, steps } from "./combatHelpers.ts";

const HELMETS = ["", "helmet01", "helmet02", "helmet03", "helmet04"];
const CHESTS = ["", "chest01", "chest02", "chest03", "chest04"];
const PERKS = ["", "steelskin", "flak_jacket"];
const AMOUNTS = [1, 10, 13.5, 24, 50, 72, 125];

function reduction(id: string): number {
    return id ? (getDefOfType(id.startsWith("helmet") ? "helmet" : "chest", id).damageReduction ?? 0) : 0;
}

function armor(helmet: string, chest: string, perk: string) {
    return { helmet, chest, hasPerk: (p: string) => p === perk };
}

describe("damage pipeline", () => {
    const rules = defaultRules();

    it("matches the closed-form formula for every armour, perk and hit combination", () => {
        const headshotMult = getDefOfType("gun", "ak47").headshotMult;
        for (const amount of AMOUNTS) {
            for (const helmet of HELMETS) {
                for (const chest of CHESTS) {
                    for (const perk of PERKS) {
                        const perkMult =
                            perk === "steelskin" ? 1 - rules.steelskinReduction : perk === "flak_jacket" ? 0.9 : 1;
                        const target = armor(helmet, chest, perk);
                        const body: DamageParams = { amount, damageType: DamageType.Player, gameSourceType: "ak47" };
                        // body: chest and 30 % of the helmet
                        const bodyExpected = amount * perkMult * (1 - reduction(chest)) * (1 - 0.3 * reduction(helmet));
                        expect(computeDamage(body, false, target, rules)).toBeCloseTo(bodyExpected, 10);
                        // head: headshotMult, the full helmet, no chest
                        const headExpected = amount * headshotMult * perkMult * (1 - reduction(helmet));
                        expect(computeDamage(body, true, target, rules)).toBeCloseTo(headExpected, 10);
                        // explosions: Flak Jacket takes 90 %
                        const boom: DamageParams = { ...body, gameSourceType: "frag", isExplosion: true };
                        const flak = perk === "flak_jacket" ? 0.1 : perkMult;
                        const boomExpected = amount * flak * (1 - reduction(chest)) * (1 - 0.3 * reduction(helmet));
                        expect(computeDamage(boom, false, target, rules)).toBeCloseTo(boomExpected, 10);
                        // gas and bleeding ignore everything
                        for (const damageType of [DamageType.Gas, DamageType.Bleeding]) {
                            expect(computeDamage({ amount, damageType }, false, target, rules)).toBe(amount);
                        }
                    }
                }
            }
        }
    });

    it("can make a headshot deal less than a body shot when the helmet beats the vest", () => {
        const target = armor("helmet03", "", "");
        const p: DamageParams = { amount: 20, damageType: DamageType.Player, gameSourceType: "m870" };
        // m870 headshotMult 1.5 x (1 - 0.55) = 0.675 < body 1 x (1 - 0.165)
        expect(computeDamage(p, true, target, rules)).toBeLessThan(computeDamage(p, false, target, rules));
    });

    it("rolls headshots only for sources with headshotMult > 1 (original rule), never for explosions", () => {
        const hit = (gameSourceType: string, isExplosion = false): DamageParams => ({
            amount: 10,
            damageType: DamageType.Player,
            gameSourceType,
            isExplosion,
        });
        expect(canHeadshot(hit("ak47"), rules)).toBe(true);
        expect(canHeadshot(hit("awc"), rules)).toBe(false);
        expect(canHeadshot(hit("fists"), rules)).toBe(false);
        expect(canHeadshot(hit("ak47", true), rules)).toBe(false);
        expect(canHeadshot({ amount: 1, damageType: DamageType.Gas }, rules)).toBe(false);
        expect(canHeadshot(hit("awc"), { ...rules, headshotNeedsMultAboveOne: false })).toBe(true);
        // 15 % of hits with the seeded rng
        const rng = createRng(77);
        let heads = 0;
        const n = 20000;
        for (let i = 0; i < n; i++) if (rollHeadshot(hit("ak47"), rules, rng)) heads++;
        expect(heads / n).toBeGreaterThan(0.14);
        expect(heads / n).toBeLessThan(0.16);
    });

    it("applies headshots through the game with the headshot chance knob", () => {
        const game = flatGame();
        game.combatRng = constantRng();
        game.rules.headshotChance = 1;
        const p = spawnAt(game, openSpot(game, 30));
        giveGun(p, "ak47", { reserve: 0 });
        const target = spawnAt(game, v2.add(p.pos, { x: 5, y: 0 }));
        target.helmet = "helmet02";
        target.chest = "chest03";
        fireOnce(game, p);
        steps(game, 5);
        const falloff = 1 - 0.1 * (1 / 200);
        expect(target.lastHit?.headshot).toBe(true);
        expect(100 - target.health).toBeCloseTo(13.5 * 2 * falloff * (1 - 0.4), 9);
    });
});

describe("death", () => {
    function duel() {
        const game = flatGame();
        game.combatRng = constantRng();
        const p = spawnAt(game, openSpot(game, 30));
        giveGun(p, "m870", { reserve: 30 });
        const target = spawnAt(game, v2.add(p.pos, { x: 5, y: 0 }), { x: -1, y: 0 });
        return { game, p, target };
    }

    it("kills at 0 HP with kill credit, and dead players stop colliding", () => {
        const { game, p, target } = duel();
        target.health = 30;
        fireOnce(game, p);
        steps(game, 5);
        expect(target.health).toBe(0);
        expect(target.dead).toBe(true);
        expect(target.killedBy).toBe(p.id);
        expect(p.kills).toBe(1);
        const view = game.getSnapshot(target.id);
        expect(view.local.dead).toBe(true);
        expect(view.objects.find((o) => o.id === target.id)).toMatchObject({ kind: "player", dead: true });
        // a second shot flies through the body
        const behind = spawnAt(game, v2.add(p.pos, { x: 8, y: 0 }));
        steps(game, 100);
        recordShots(game, p, 1, () => ({ shootHold: true, shootStart: true }));
        steps(game, 10);
        expect(behind.health).toBeLessThan(100);
    });

    it("drops every weapon, item and piece of gear on death, except fists, the 1x scope and the base outfit", () => {
        const { game, p, target } = duel();
        giveGun(target, "ak47", { slot: WeaponSlot.Primary, reserve: 0 });
        target.weaponManager.weapons[WeaponSlot.Primary].ammo = 12;
        giveGun(target, "m9", { slot: WeaponSlot.Secondary, reserve: 0 });
        target.weaponManager.setWeapon(WeaponSlot.Melee, "machete", 0);
        target.backpack = "backpack02";
        target.helmet = "helmet02";
        target.chest = "chest01";
        target.inv.set("762mm", 100);
        target.inv.set("bandage", 7);
        target.inv.set("4xscope", 1);
        target.inv.set("frag", 2);
        target.health = 1;
        fireOnce(game, p);
        steps(game, 5);
        expect(target.dead).toBe(true);
        const dropped = new Map<string, number>();
        for (const l of game.loot.items.values()) dropped.set(l.type, (dropped.get(l.type) ?? 0) + l.count);
        expect(dropped.get("ak47")).toBe(1);
        expect(dropped.get("m9")).toBe(1);
        expect(dropped.get("machete")).toBe(1);
        // the magazine goes back into the bag before everything drops
        expect(dropped.get("762mm")).toBe(112);
        expect(dropped.get("9mm")).toBe(15);
        expect(dropped.get("bandage")).toBe(7);
        expect(dropped.get("4xscope")).toBe(1);
        expect(dropped.get("frag")).toBe(2);
        expect(dropped.get("helmet02")).toBe(1);
        expect(dropped.get("chest01")).toBe(1);
        expect(dropped.get("backpack02")).toBe(1);
        for (const kept of ["fists", "1xscope", "outfitBase", "backpack00"]) expect(dropped.has(kept)).toBe(false);
        expect(target.helmet).toBe("");
        expect(target.backpack).toBe("backpack00");
        expect(Object.values(target.inventory).every((n) => n === 0)).toBe(true);
        expect(target.activeWeapon).toBe("fists");
        // loot scatters around the body
        for (const l of game.loot.items.values()) expect(v2.distance(l.pos, target.pos)).toBeLessThan(3);
        steps(game, 200);
        for (const l of game.loot.items.values()) expect(v2.distance(l.pos, target.pos)).toBeGreaterThan(0.5);
    });

    it("drops dual pistols as two singles", () => {
        const { game, p, target } = duel();
        giveGun(target, "m9_dual", { reserve: 0 });
        target.health = 1;
        fireOnce(game, p);
        steps(game, 5);
        const types = [...game.loot.items.values()].map((l) => l.type).filter((t) => t === "m9");
        expect(types).toHaveLength(2);
    });

    it("keeps everything when a non-lethal hit lands", () => {
        const { game, p, target } = duel();
        target.helmet = "helmet03";
        target.chest = "chest03";
        target.inv.set("bandage", 3);
        fireOnce(game, p);
        steps(game, 5);
        expect(target.dead).toBe(false);
        expect(target.inv.get("bandage")).toBe(3);
        expect(game.loot.items.size).toBe(0);
        expect(target.damageTaken).toBeCloseTo(100 - target.health, 9);
        expect(p.damageDealt).toBeCloseTo(target.damageTaken, 9);
    });
});
