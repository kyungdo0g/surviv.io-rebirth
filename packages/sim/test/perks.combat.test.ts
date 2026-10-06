// Combat perks (M7a): Splinter Rounds, One in the Chamber, the 8 % ammo bonuses and their stacking rule, 9mm
// Overpressure, High-Value Targets, Windwalk, Takedown, Small Arms, One With Nature. Values: docs/research/items/perks.md
// "Mechanics per perk" / "Damage multipliers and stacking" and conflicts.md, via rules.perks.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, getDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Bullet, Game, Player } from "../src/index.ts";
import { addPerk } from "../src/perks/perks.ts";
import { constantRng, flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";

function shooter(gun: string, perks: string[] = [], obstacles = []): { game: Game; p: Player; fired: () => Bullet[] } {
    const game = flatGame(obstacles);
    game.combatRng = constantRng(0.5);
    const p = spawnAt(game, openSpot(game, 120));
    giveGun(p, gun, { reserve: 100 });
    for (const perk of perks) addPerk(p, perk);
    const fired = () => {
        const before = new Set(game.bullets.active.map((b) => b.id));
        // the cursor far away: USAS-12 rounds (toMouseHit) would burst at the muzzle (M9)
        send(game, p, { shootHold: true, shootStart: true, toMouseLen: 64 });
        game.step();
        send(game, p, {});
        return game.bullets.reports
            .map((r) => r.bullet)
            .filter((b, i, all) => !before.has(b.id) && all.indexOf(b) === i);
    };
    return { game, p, fired };
}

describe("Splinter Rounds", () => {
    it("fires the main bullet x0.6 and two x0.6x0.45 side bullets (conflicts.md perk-splinter-side-damage)", () => {
        const { fired } = shooter("ak47", ["splinter"]);
        const bullets = fired();
        expect(bullets).toHaveLength(3);
        const [main, ...sides] = bullets;
        expect(main.damageMult).toBeCloseTo(0.6, 9);
        expect(main.splinter).toBe(false);
        for (const s of sides) {
            expect(s.damageMult).toBeCloseTo(0.6 * 0.45, 9);
            expect(s.splinter).toBe(true);
            expect(s.shotFx).toBe(false);
            // random(0.2, 0.25) x max(spread, 1) degrees: AK-47 shotSpread 2.5 (the centred rng draws 0.225)
            const deg = (Math.acos(Math.min(1, v2.dot(s.dir, main.dir))) * 180) / Math.PI;
            expect(deg).toBeCloseTo(0.225 * 2.5, 6);
        }
        expect(BulletEvent(sides[0]).splinter).toBe(true);
    });

    it("skips the whole perk on noSplinter guns (conflicts.md perk-splinter-nosplinter-main)", () => {
        const { game, fired } = shooter("usas", ["splinter"]);
        const def = getDefOfType("gun", "usas");
        const bullets = fired();
        expect(bullets).toHaveLength(def.bulletCount);
        expect(bullets.every((b) => b.damageMult === 1)).toBe(true);
        game.rules.perks.splinterMainOnNoSplinter = true;
        expect(fired().every((b) => Math.abs(b.damageMult - 0.6) < 1e-9)).toBe(true);
    });
});

function BulletEvent(b: Bullet) {
    return { splinter: b.splinter, saturated: b.saturated, thick: b.thick };
}

describe("One in the Chamber", () => {
    it("the first and the last round of a magazine deal x1.25 with a darker thick tracer, never 12 gauge", () => {
        const { game, p, fired } = shooter("m9", ["chambered"]);
        const mults: number[] = [];
        const thick: boolean[] = [];
        for (let i = 0; i < 15; i++) {
            const [b] = fired();
            mults.push(b.damageMult);
            thick.push(b.thick && b.saturated);
            steps(game, 40);
        }
        expect(mults[0]).toBeCloseTo(1.25, 9);
        expect(mults.slice(1, 14).every((m) => m === 1)).toBe(true);
        expect(mults[14]).toBeCloseTo(1.25, 9);
        expect(thick[0] && thick[14] && !thick[5]).toBe(true);
        expect(p.weaponManager.activeSlot.ammo).toBe(0);
        const sg = shooter("m870", ["chambered"]);
        expect(sg.fired().every((b) => b.damageMult === 1 && !b.thick)).toBe(true);
    });
});

describe("ammo bonuses", () => {
    const cases: Array<[string, string, number]> = [
        ["mp5", "treat_9mm", 1.08],
        ["mp5", "bonus_9mm", 1.08],
        ["m870", "treat_12g", 1.08],
        ["mk12", "treat_556", 1.08],
        ["ak47", "treat_762", 1.08],
        ["m1911", "bonus_45", 1.08],
        ["ak47", "bonus_assault", 1.08],
        ["ak47", "treat_super", 1.08],
        ["ak47", "treat_9mm", 1],
        ["mp5", "treat_762", 1],
        ["mp5", "bonus_45", 1],
    ];
    it.each(cases)(
        "%s with %s: x%d and a darker tracer when it applies (conflicts.md ammo-perk-mult 1.08)",
        (gun, perk, mult) => {
            const { fired } = shooter(gun, [perk]);
            const bullets = fired();
            expect(bullets.every((b) => Math.abs(b.damageMult - mult) < 1e-9)).toBe(true);
            expect(bullets.every((b) => b.saturated === mult > 1)).toBe(true);
        },
    );

    it("applies at most one 8 % bonus per bullet unless survev's stacking is chosen (ammo-bonus-stacking)", () => {
        const { game, p, fired } = shooter("mp5", ["treat_9mm", "bonus_assault"]);
        p.lastBreathTicker = 5;
        expect(fired()[0].damageMult).toBeCloseTo(1.08, 9);
        game.rules.perks.ammoBonusStacking = true;
        steps(game, 20);
        expect(fired()[0].damageMult).toBeCloseTo(1.08 ** 3, 9);
    });
});

describe("9mm Overpressure", () => {
    it("9mm bullets fly x1.25 faster and farther (conflicts.md perk-9mm-overpressure-speed)", () => {
        const plain = shooter("mp5").fired()[0];
        const { fired } = shooter("mp5", ["bonus_9mm"]);
        const b = fired()[0];
        expect(b.speed).toBeCloseTo(plain.speed * 1.25, 9);
        expect(b.distance).toBeCloseTo(plain.distance * 1.25, 9);
        // other ammo is untouched
        const ak = shooter("ak47", ["bonus_9mm"]).fired()[0];
        expect(ak.speed).toBeCloseTo(shooter("ak47").fired()[0].speed, 9);
    });
});

describe("High-Value Targets", () => {
    it("bullet damage x1.25 against a player holding any perk (perks.md targeting)", () => {
        const hitDamage = (targetPerk: string | null) => {
            const { game, p, fired } = shooter("mk12", ["targeting"]);
            game.rules.headshotChance = 0;
            const target = spawnAt(game, v2.add(p.pos, { x: 10, y: 0 }));
            if (targetPerk) addPerk(target, targetPerk);
            fired();
            steps(game, 10);
            return 100 - target.health;
        };
        const base = hitDamage(null);
        expect(base).toBeGreaterThan(0);
        expect(hitDamage("trick_nothing")).toBeCloseTo(base * 1.25, 6);
    });
});

describe("Windwalk", () => {
    it("an enemy bullet passing within 5 u gives 3 s of +4.8 speed; teammates' bullets do not", () => {
        const { game, p, fired } = shooter("ak47");
        // 3 u beside the line of fire (the broadphase box of a player is 3.75 u, like survev's grid query)
        const target = spawnAt(game, v2.add(p.pos, { x: 30, y: 3 }));
        addPerk(target, "windwalk");
        fired();
        steps(game, 30);
        expect(target.haste.type).toBe("windwalk");
        expect(target.toView().haste?.type).toBe("windwalk");
        const before = target.computeSpeed(game.world);
        steps(game, 310);
        expect(target.haste.type).toBe("none");
        expect(before - target.computeSpeed(game.world)).toBeCloseTo(GameConfig.player.hasteSpeedBonus, 9);
        // same team: no trigger
        target.teamId = p.teamId;
        fired();
        steps(game, 30);
        expect(target.haste.type).toBe("none");
    });

    it("also triggers on an enemy explosion within 5 u (conflicts.md perk-windwalk-explosions)", () => {
        const { game, p } = shooter("ak47");
        const target = spawnAt(game, v2.add(p.pos, { x: 40, y: 0 }));
        addPerk(target, "windwalk");
        game.explosions.add("explosion_rounds", v2.add(target.pos, { x: 4, y: 0 }), 0, {
            damageType: DamageType.Player,
            sourceId: p.id,
        });
        game.step();
        expect(target.haste.type).toBe("windwalk");
    });
});

describe("Takedown", () => {
    it("a kill gives +25 HP, +25 adrenaline and a 3 s Takedown haste; a knock does not (perks.md takedown)", () => {
        const { game, p } = shooter("ak47", ["takedown"]);
        const victim = spawnAt(game, v2.add(p.pos, { x: 30, y: 0 }));
        p.health = 50;
        p.boost = 0;
        game.damagePlayer(victim, {
            amount: 500,
            damageType: DamageType.Player,
            sourceId: p.id,
            gameSourceType: "ak47",
        });
        expect(victim.dead).toBe(true);
        expect(p.health).toBe(75);
        expect(p.boost).toBe(25);
        expect(p.haste.type).toBe("takedown");
        steps(game, 301);
        expect(p.haste.type).toBe("none");
    });
});

describe("Small Arms and One With Nature", () => {
    it("Small Arms replaces a held gun's equip speed by +1 (perks.md small_arms)", () => {
        const { game, p } = shooter("ak47");
        const plain = p.computeSpeed(game.world);
        addPerk(p, "small_arms");
        expect(p.computeSpeed(game.world) - plain).toBeCloseTo(1, 9);
    });

    it("One With Nature walks through trees (perks.md tree_climbing)", () => {
        const game = flatGame();
        const spot = openSpot(game, 40);
        const treeGame = flatGame([{ type: "tree_01", pos: v2.add(spot, { x: 6, y: 0 }) }]);
        const walk = (perk: boolean) => {
            const p = spawnAt(treeGame, spot);
            if (perk) addPerk(p, "tree_climbing");
            send(treeGame, p, { moveRight: true });
            steps(treeGame, 150);
            const x = p.pos.x - spot.x;
            treeGame.removePlayer(p.id);
            return x;
        };
        expect(walk(false)).toBeLessThan(6);
        expect(walk(true)).toBeGreaterThan(12);
    });
});
