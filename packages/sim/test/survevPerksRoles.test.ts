// The survev-only perks, packs and roles in the simulation (survev content wave, stage 2): AP Rounds, High-Velocity
// Rounds, Hyperfragmentation, Combat Stimulants, Indomitable Spirit, Assume Leadership (survev perkDefs.ts
// PerkProperties and the server code each test cites), the Experimental Pack's second loot perk slot (survev
// player.ts:3954-3975) and the Classless role (survev player.ts:935-972, 2768-2797). The Captain is in faction.test.ts.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { BulletSystem } from "../src/combat/bullets.ts";
import { type Game, type Player, pickupLoot } from "../src/index.ts";
import { addPerk } from "../src/perks/perks.ts";
import { completeUse, updateBoost } from "../src/world/consumables.ts";
import { playerView } from "../src/world/playerView.ts";
import { constantRng, fireOnce, flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";
import { clearSpot, cookAndThrow, fxGame, holdThrowable, logExplosions } from "./fxHelpers.ts";

function range(perk?: string): { game: Game; p: Player } {
    const game = flatGame();
    game.combatRng = constantRng();
    game.rules.headshotChance = 0;
    const p = spawnAt(game, openSpot(game, 70));
    if (perk) addPerk(p, perk);
    return { game, p };
}

function pick(game: Game, p: Player, type: string) {
    const loot = game.loot.addLoot(type, p.pos, p.layer, 1, { pushSpeed: 0 });
    if (!loot) throw new Error(`no loot ${type}`);
    p.pickupTicker = 0;
    return pickupLoot(game, p, loot);
}

/** Damage one M9 bullet deals to a target 6 u ahead wearing `chest`. */
function m9Hit(perk: string | undefined, chest = ""): number {
    const { game, p } = range(perk);
    giveGun(p, "m9");
    const t = spawnAt(game, v2.add(p.pos, { x: 6, y: 0 }), { x: -1, y: 0 });
    t.chest = chest;
    fireOnce(game, p);
    steps(game, 60);
    return 100 - t.health;
}

describe("AP Rounds and High-Velocity Rounds", () => {
    it("AP Rounds: armour works at 80 % (a chest03's 45 % becomes 36 %), unarmoured hits unchanged", () => {
        const bare = m9Hit(undefined);
        expect(m9Hit("ap_rounds")).toBeCloseTo(bare, 9);
        const reduction = getDefOfType("chest", "chest03").damageReduction;
        expect(m9Hit(undefined, "chest03")).toBeCloseTo(bare * (1 - reduction), 9);
        expect(m9Hit("ap_rounds", "chest03")).toBeCloseTo(bare * (1 - reduction * 0.8), 9);
    });

    it("AP Rounds: bullets deal x1.5 to obstacles", () => {
        const hit = (perk?: string) => {
            const probe = flatGame();
            const at = openSpot(probe, 30);
            const game = flatGame([{ type: "crate_01", pos: v2.add(at, { x: 8, y: 0 }) }]);
            game.combatRng = constantRng();
            const p = spawnAt(game, at);
            if (perk) addPerk(p, perk);
            giveGun(p, "m9");
            const crate = game.world.get(1) as { health: number; maxHealth: number };
            fireOnce(game, p);
            steps(game, 60);
            return crate.maxHealth - crate.health;
        };
        expect(hit("ap_rounds")).toBeCloseTo(hit() * 1.5, 9);
    });

    it("AP Rounds: the bullet report carries the flag for the tracer colour (survev bullet apRounds)", () => {
        const flag = (perk?: string) => {
            const { game, p } = range(perk);
            giveGun(p, "m9");
            fireOnce(game, p);
            return BulletSystem.toEvent(game.bullets.active.at(-1)!).apRounds;
        };
        expect(flag("ap_rounds")).toBe(true);
        expect(flag()).toBe(false);
    });

    it("High-Velocity Rounds: bullets fly x1.4 as fast and x1.3 as far", () => {
        const shot = (perk?: string) => {
            const { game, p } = range(perk);
            giveGun(p, "m9");
            fireOnce(game, p);
            return game.bullets.active.at(-1)!;
        };
        const base = shot();
        const fast = shot("high_velocity");
        expect(fast.speed).toBeCloseTo(base.speed * 1.4, 9);
        expect(fast.distance).toBeCloseTo(base.distance * 1.3, 9);
    });
});

describe("Combat Stimulants", () => {
    it("for 5 s after a heal its bullets deal x1.15, then not", () => {
        const bare = m9Hit(undefined);
        const { game, p } = range("combat_stims");
        giveGun(p, "m9");
        p.inv.set("bandage", 1);
        completeUse(p, "bandage", game);
        expect(p.combatStimsTicker).toBe(5);
        const t = spawnAt(game, v2.add(p.pos, { x: 6, y: 0 }), { x: -1, y: 0 });
        fireOnce(game, p);
        steps(game, 60);
        expect(100 - t.health).toBeCloseTo(bare * 1.15, 9);
        steps(game, 500);
        expect(p.combatStimsTicker).toBe(0);
    });

    it("while it runs, gun hits on a teammate heal it 6 % of the hit instead", () => {
        const { game, p } = range("combat_stims");
        const mate = spawnAt(game, v2.add(p.pos, { x: 6, y: 0 }));
        mate.teamId = p.teamId;
        mate.health = 50;
        game.damagePlayer(mate, { amount: 20, damageType: DamageType.Player, gameSourceType: "m9", sourceId: p.id });
        expect(mate.health).toBe(50);
        p.combatStimsTicker = 5;
        game.damagePlayer(mate, { amount: 20, damageType: DamageType.Player, gameSourceType: "m9", sourceId: p.id });
        expect(mate.health).toBeCloseTo(51.2, 9);
        // melee never heals
        game.damagePlayer(mate, { amount: 20, damageType: DamageType.Player, gameSourceType: "fists", sourceId: p.id });
        expect(mate.health).toBeCloseTo(51.2, 9);
    });
});

describe("Indomitable Spirit", () => {
    it("a fatal hit leaves 1 HP when the adrenaline covers the excess at 2 per HP", () => {
        const { game, p } = range("lifeline");
        const t = spawnAt(game, v2.add(p.pos, { x: 6, y: 0 }));
        addPerk(t, "lifeline");
        t.health = 10;
        t.boost = 40;
        game.damagePlayer(t, { amount: 25, damageType: DamageType.Player, sourceId: p.id });
        // excess 25 - 10 + 1 = 16 HP costs 32 adrenaline
        expect(t.health).toBe(1);
        expect(t.boost).toBe(8);
        expect(t.lastStandTicker).toBe(1);
        // the client shows the last stand effect for that second (survev lastStandEffect)
        expect(playerView(t).lastStand).toBe(true);
        expect(playerView(p).lastStand).toBe(false);
        game.damagePlayer(t, { amount: 25, damageType: DamageType.Player, sourceId: p.id });
        expect(t.health).toBe(0);
        expect(playerView(t).lastStand).toBe(false);
    });

    it("adrenaline decays x0.75", () => {
        const { p } = range("lifeline");
        p.boost = 50;
        updateBoost(p, { boostModel: "tiers" } as never, 1);
        expect(50 - p.boost).toBeCloseTo(GameConfig.player.boostDecay * 0.75, 9);
    });
});

describe("Hyperfragmentation and Assume Leadership", () => {
    it("a frag's shrapnel doubles, hits x1.5 and flies x1.4 as fast", () => {
        const shards = (perk?: string) => {
            const origin = clearSpot();
            const { game, p } = fxGame(origin);
            if (perk) addPerk(p, perk);
            holdThrowable(p, "frag", 1);
            const log = logExplosions(game);
            cookAndThrow(game, p, 2, 10);
            const before = game.bullets.active.length;
            for (let i = 0; i < 600 && log.length === 0; i++) game.step();
            return game.bullets.active.slice(before).filter((b) => b.bulletType === "shrapnel_frag");
        };
        const base = shards();
        const amped = shards("amped_explosives");
        expect(base.length).toBe(getDefOfType("explosion", "explosion_frag").shrapnelCount);
        expect(amped.length).toBe(base.length * 2);
        expect(amped[0].damageMult).toBeCloseTo(1.5, 9);
        expect(amped[0].speed).toBeCloseTo(base[0].speed * 1.4, 9);
        expect(amped[0].saturated).toBe(true);
    });

    it("a frag thrown at full aim flies x2 as fast and reaches x1.75 as far", () => {
        const throwSpeed = (perk?: string) => {
            const origin = clearSpot();
            const { game, p } = fxGame(origin);
            if (perk) addPerk(p, perk);
            holdThrowable(p, "frag", 1);
            cookAndThrow(game, p, 20, 1000);
            return v2.length(game.projectiles.projectiles[0].vel);
        };
        expect(throwSpeed("amped_explosives")).toBeCloseTo(throwSpeed() * 2, 6);
    });

    it("Assume Leadership keeps adrenaline at 50 and makes its holder 15 % bigger", () => {
        const { game, p } = range("assume_leadership");
        p.boost = 0;
        game.step();
        expect(p.boost).toBeGreaterThanOrEqual(49);
        expect(p.scale).toBeCloseTo(1.15, 9);
    });
});

describe("Experimental Pack and Classless", () => {
    it("the Experimental Pack holds two loot perks; a third swaps the first", () => {
        const { game, p } = range();
        p.backpack = "backpack04_cloud";
        expect(pick(game, p, "scavenger")).toBe("success");
        expect(pick(game, p, "takedown")).toBe("success");
        expect(p.perks).toEqual(["scavenger", "takedown"]);
        pick(game, p, "windwalk");
        expect([...p.perks].sort()).toEqual(["takedown", "windwalk"]);
        // a normal pack swaps at once
        p.backpack = "backpack03";
        pick(game, p, "field_medic");
        expect(p.perks.filter((x) => ["takedown", "windwalk", "field_medic"].includes(x))).toHaveLength(2);
    });

    it("the Tactical / Experimental Packs are level 4 with survev's fifth bag column", () => {
        const { p } = range();
        p.backpack = "backpack04";
        expect(p.inv.capacity("9mm")).toBe(510);
        p.backpack = "backpack04_cloud";
        expect(p.inv.capacity("bandage")).toBe(45);
    });

    it("Classless draws one class perk on promotion and swaps one per kill", () => {
        const { game, p } = range();
        game.roles.promote(p, "classless");
        const pool = game.rules.roles.classlessPerkPool;
        expect(p.role).toBe("classless");
        expect(p.helmet).toBe("helmet04_classless");
        expect(p.outfit).toBe("outfitClassless");
        expect(p.perks).toHaveLength(1);
        expect(pool).toContain(p.perks[0]);
        const first = p.perks[0];
        const victim = spawnAt(game, v2.add(p.pos, { x: 4, y: 0 }));
        victim.health = 1;
        game.damagePlayer(victim, {
            amount: 10,
            damageType: DamageType.Player,
            sourceId: p.id,
            gameSourceType: "fists",
        });
        expect(victim.dead).toBe(true);
        expect(p.perks).toHaveLength(1);
        expect(p.perks[0]).not.toBe(first);
        expect(pool).toContain(p.perks[0]);
        expect(p.weaponManager.weapons[WeaponSlot.Melee].type).toBe("fists");
    });
});
