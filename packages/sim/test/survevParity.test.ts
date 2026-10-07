// survev server parity (docs/handoff/survev-content.md "Survev parity wave", item 2): behaviours of survev's server
// that the audit found missing or different. Each case cites the survev source it follows.
import { v2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { defaultModeRules, type Game, type Player, randomDropCandidates, randomWeaponSwap } from "../src/index.ts";
import { flatGame, openSpot, spawnAt, steps } from "./combatHelpers.ts";
import { cookAndThrow, holdThrowable } from "./fxHelpers.ts";

/** A flat game on `mapName` with a killer and a victim 10 units apart. */
function duel(mapName: string): { game: Game; killer: Player; victim: Player } {
    const game = flatGame();
    Object.assign(game.options, { mapName });
    const pos = openSpot(game);
    const killer = spawnAt(game, pos);
    const victim = spawnAt(game, v2.add(pos, { x: 10, y: 0 }));
    return { game, killer, victim };
}

describe("throwable hits come from the explosion defs (survev explosion.ts:209-243, explosionsDefs.ts)", () => {
    it("every explosion with a freezeDuration has a rule; the heavy snowball slows 2 s, the heavy potato drops 2", () => {
        const hits = defaultModeRules().throwableHits;
        const frozen = Object.entries(GameObjectDefs).filter(
            ([, d]) => d.type === "explosion" && d.freezeDuration !== undefined,
        );
        expect(Object.keys(hits).sort()).toEqual(frozen.map(([id]) => id).sort());
        expect(hits.explosion_snowball_heavy).toMatchObject({ freeze: 2, dropRandomLoot: 1 });
        expect(hits.explosion_potato_heavy).toMatchObject({ freeze: 1, dropRandomLoot: 2 });
        expect(hits.explosion_potato_lmgshot).toMatchObject({ freeze: 0.25, dropRandomLoot: 0, viewShrink: 1.5 });
    });

    it("a heavy potato makes the target drop two random items", () => {
        const { game, killer, victim } = duel("potato");
        victim.inv.set("bandage", 6);
        expect(randomDropCandidates(victim).length).toBeGreaterThan(0);
        game.explosions.add("explosion_potato_heavy", v2.add(victim.pos, { x: -0.5, y: 0 }), victim.layer, {
            damageType: DamageType.Player,
            gameSourceType: "potato_heavy",
            weaponSourceType: "potato",
            sourceId: killer.id,
        });
        steps(game, 1);
        const dropped = [...game.loot.items.values()].filter((l) => l.type === "bandage");
        expect(dropped.length).toBe(2);
        expect(victim.inv.get("bandage") + dropped.reduce((n, l) => n + l.count, 0)).toBe(6);
    });
});

describe("potato swaps follow the weapon the hit started from (survev player.ts:2837-2845, 4046-4049)", () => {
    it("a heavy potato leaves the hand as potato_heavy but credits the potato in hand", () => {
        const { game, killer } = duel("potato");
        holdThrowable(killer, "potato", 3);
        cookAndThrow(game, killer, 110);
        const proj = game.projectiles.projectiles.find((p) => p.ownerId === killer.id);
        expect(proj).toMatchObject({ type: "potato_heavy", sourceType: "potato" });
    });

    it("a MIRV bomblet kill swaps the killer's MIRV (bomblets themselves are noPotatoSwap)", () => {
        const { game, killer, victim } = duel("potato");
        holdThrowable(killer, "mirv", 2);
        game.damagePlayer(victim, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "mirv_mini",
            weaponSourceType: "mirv",
            sourceId: killer.id,
            isExplosion: true,
        });
        expect(victim.dead).toBe(true);
        const slot = killer.weaponManager.weapons[WeaponSlot.Throwable].type;
        expect(slot).not.toBe("mirv");
        expect(GameObjectDefs[slot]?.type).toBe("throwable");
    });

    it("no swap when the victim's own hit kills it, nor for a Lone Survivr", () => {
        const { game, killer, victim } = duel("potato");
        holdThrowable(killer, "frag", 2);
        game.damagePlayer(victim, { amount: 10, damageType: DamageType.Player, sourceId: killer.id });
        expect(victim.lastDamagedBy).toBe(killer.id);
        // the victim's own frag finishes it: params.source is the victim
        game.damagePlayer(victim, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "frag",
            sourceId: victim.id,
            isExplosion: true,
        });
        expect(victim.dead).toBe(true);
        expect(killer.weaponManager.weapons[WeaponSlot.Throwable].type).toBe("frag");

        const other = duel("potato");
        holdThrowable(other.killer, "frag", 2);
        other.killer.role = "last_man";
        other.game.damagePlayer(other.victim, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "frag",
            sourceId: other.killer.id,
            isExplosion: true,
        });
        expect(other.victim.dead).toBe(true);
        expect(other.killer.weaponManager.weapons[WeaponSlot.Throwable].type).toBe("frag");
    });
});

describe("potato swap pool", () => {
    // survev meleeDefs.ts crowbar has no noPotatoSwap (the original's true); port lib/objects.ts SURVEV_ABSENT_IS_OFF
    it("the Crowbar swaps like any melee weapon", () => {
        const { game, killer } = duel("potato");
        killer.weaponManager.setWeapon(WeaponSlot.Melee, "crowbar", 0);
        expect((GameObjectDefs.crowbar as { noPotatoSwap?: boolean }).noPotatoSwap).toBeUndefined();
        randomWeaponSwap(game, killer, { amount: 1, damageType: DamageType.Player, gameSourceType: "crowbar" });
        const melee = killer.weaponManager.weapons[WeaponSlot.Melee].type;
        expect(melee).not.toBe("crowbar");
        expect(GameObjectDefs[melee]?.type).toBe("melee");
    });
});
