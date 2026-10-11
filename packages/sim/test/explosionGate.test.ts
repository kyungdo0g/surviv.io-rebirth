// Explosion-gated obstacles (the owner's wave 3, 2026-10-10: "a bunker only strong firepower like the M202 can open";
// "an abandoned subway station: strong firepower must blast its door"; ObstacleDef.explosionGate, combat.ts
// canDamageObstacle): the blast door counts hits (the owner, 2026-10-11: one M202 rocket, the 2nd NLAW round or the
// 6th RPG-7 rocket opens it, nothing else; explosionGate.hitsToOpen, combat.ts gateHitShare), the subway gate takes
// launcher rounds and air strike bombs only; bullets, melee, shrapnel, hand grenades and barrels never hurt either.
import { type Vec2, v2 } from "@rebirth/core";
import { BLAST_DOOR, DamageType, SUBWAY_GATE } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Game, Obstacle } from "../src/index.ts";
import { constantRng, flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";

const PLAYER_SRC = { damageType: DamageType.Player, sourceId: 0 };

/** A flat game with one door of `type` 20 u east of an open spot (its long side facing the spot). */
function doorGame(type: string): { game: Game; door: Obstacle; origin: Vec2 } {
    const origin = openSpot(flatGame(), 70);
    const game = flatGame([{ type, pos: v2.add(origin, { x: 20, y: 0 }) }]);
    game.combatRng = constantRng();
    const door = [...game.world.objects.values()].find((o): o is Obstacle => o.kind === "obstacle" && o.type === type)!;
    return { game, door, origin };
}

/** One explosion of `type` 2 u in front of the door (well inside every blast's full-damage radius). */
function blast(game: Game, door: Obstacle, type: string, source: Record<string, unknown> = PLAYER_SRC): void {
    game.explosions.add(type, v2.add(door.pos, { x: -2, y: 0 }), 0, { ...source } as typeof PLAYER_SRC);
    game.step();
}

/** Fires `gun` from the open spot at the door for `ticks` ticks. */
function shoot(game: Game, origin: Vec2, gun: string, ticks: number): void {
    const p = spawnAt(game, origin);
    giveGun(p, gun, { reserve: 300 });
    send(game, p, { shootHold: true, shootStart: true, toMouseLen: 40 });
    game.step();
    send(game, p, { shootHold: true, toMouseLen: 40 });
    steps(game, ticks);
    send(game, p, {});
    steps(game, 100);
}

describe("blast_door_01", () => {
    it("the shooting set-up hits: the same fire breaks an ungated wooden wall in its place", () => {
        const { game, door, origin } = doorGame("rebirth_wall_int_4");
        shoot(game, origin, "ak47", 30);
        expect(door.health).toBeLessThan(door.maxHealth);
    });

    it("ignores bullets, melee, shrapnel and projectile impacts however hard they hit", () => {
        const { game, door, origin } = doorGame(BLAST_DOOR);
        shoot(game, origin, "ak47", 200);
        for (const gameSourceType of ["fists", "sledgehammer", "katana"]) {
            game.damageObstacle(door, { amount: 10_000, damageType: DamageType.Player, gameSourceType });
        }
        // shrapnel is an explosion's bullet, without an explosion id
        game.damageObstacle(door, { amount: 10_000, damageType: DamageType.Player, isExplosion: true });
        expect([door.dead, door.health, door.gateHits]).toEqual([false, door.maxHealth, 0]);
    });

    it("ignores every other explosive: Panzerfaust, 40 mm grenades, frags, Bazooka, barrels, air strike bombs", () => {
        const { game, door } = doorGame(BLAST_DOOR);
        // the M79 and the MGL share explosion_m79
        const others = [
            "explosion_panzerfaust",
            "explosion_m79",
            "explosion_gl06",
            "explosion_paw20",
            "explosion_frag",
            "explosion_bazooka",
            "explosion_barrel",
        ];
        for (const type of others) {
            for (let i = 0; i < 8; i++) blast(game, door, type);
        }
        for (const type of ["explosion_bomb_iron", "explosion_bomb_heavy"]) {
            for (let i = 0; i < 8; i++) blast(game, door, type, { damageType: DamageType.Airstrike });
        }
        expect([door.dead, door.health, door.gateHits]).toEqual([false, door.maxHealth, 0]);
    });

    it("ignores a real Pvg m/42 and Panzerfaust", () => {
        for (const gun of ["pvg42", "panzerfaust"]) {
            const { game, door, origin } = doorGame(BLAST_DOOR);
            shoot(game, origin, gun, 300);
            expect([gun, door.dead, door.health]).toEqual([gun, false, door.maxHealth]);
        }
    });

    it("opens to one M202 rocket", () => {
        const { game, door } = doorGame(BLAST_DOOR);
        blast(game, door, "explosion_m202", { ...PLAYER_SRC, gameSourceType: "m202" });
        expect([door.dead, door.gateHits]).toEqual([true, 1]);
    });

    it("opens to the 2nd NLAW round", () => {
        const { game, door } = doorGame(BLAST_DOOR);
        blast(game, door, "explosion_nlaw");
        expect([door.dead, door.gateHits, door.healthT]).toEqual([false, 1, 0.5]);
        blast(game, door, "explosion_nlaw");
        expect(door.dead).toBe(true);
    });

    it("opens to exactly the 6th RPG-7 rocket, its health showing the hits left", () => {
        const { game, door } = doorGame(BLAST_DOOR);
        for (let i = 1; i <= 5; i++) {
            blast(game, door, "explosion_rpg7");
            expect([i, door.dead, door.gateHits]).toEqual([i, false, i]);
            expect(door.healthT).toBeCloseTo((6 - i) / 6, 9);
        }
        blast(game, door, "explosion_rpg7");
        expect([door.dead, door.health, door.gateHits]).toEqual([true, 0, 6]);
    });

    it("adds up mixed rounds and counts only the qualifying hits", () => {
        const { game, door } = doorGame(BLAST_DOOR);
        blast(game, door, "explosion_nlaw");
        blast(game, door, "explosion_frag");
        blast(game, door, "explosion_panzerfaust");
        blast(game, door, "explosion_rpg7");
        blast(game, door, "explosion_bomb_heavy", { damageType: DamageType.Airstrike });
        blast(game, door, "explosion_rpg7");
        // a half (NLAW) and two sixths (RPG-7): a sixth left
        expect([door.dead, door.gateHits, door.gateShares]).toEqual([false, 3, 5]);
        blast(game, door, "explosion_rpg7");
        expect([door.dead, door.gateHits]).toEqual([true, 4]);
    });

    it("counts the same on every run (deterministic)", () => {
        const run = () => {
            const { game, door } = doorGame(BLAST_DOOR);
            for (const type of ["explosion_rpg7", "explosion_m79", "explosion_rpg7", "explosion_frag"]) {
                blast(game, door, type);
            }
            return [door.gateHits, door.gateShares, door.health];
        };
        expect(run()).toEqual(run());
    });

    it("opens to a real M202 volley; a real RPG-7 rocket takes a sixth", () => {
        const m202 = doorGame(BLAST_DOOR);
        shoot(m202.game, m202.origin, "m202", 20);
        expect(m202.door.dead).toBe(true);
        const rpg = doorGame(BLAST_DOOR);
        shoot(rpg.game, rpg.origin, "rpg7", 20);
        expect([rpg.door.dead, rpg.door.gateHits]).toEqual([false, 1]);
        expect(rpg.door.healthT).toBeCloseTo(5 / 6, 9);
    });

    it("is not crushed by a landing air drop crate (nothing but its rounds opens it)", () => {
        const { game, door } = doorGame(BLAST_DOOR);
        game.damageObstacle(door, { amount: 1e6, damageType: DamageType.Airdrop });
        expect([door.dead, door.health]).toEqual([false, door.maxHealth]);
    });
});

describe("subway_gate_01", () => {
    it.each([
        ["explosion_rpg7", 3],
        ["explosion_m79", 3],
        ["explosion_nlaw", 3],
        ["explosion_m202", 1],
    ] as const)("opens to %s in %i hits", (type, hits) => {
        const { game, door } = doorGame(SUBWAY_GATE);
        for (let i = 0; i < hits - 1; i++) blast(game, door, type);
        expect(door.dead).toBe(false);
        if (hits > 1) expect(door.health).toBeLessThan(door.maxHealth);
        blast(game, door, type);
        expect(door.dead).toBe(true);
    });

    it("is still crushed by a landing air drop crate", () => {
        const { game, door } = doorGame(SUBWAY_GATE);
        game.damageObstacle(door, { amount: 1e6, damageType: DamageType.Airdrop });
        expect(door.dead).toBe(true);
    });

    it("opens to air strike bombs", () => {
        const { game, door } = doorGame(SUBWAY_GATE);
        for (let i = 0; i < 4 && !door.dead; i++) {
            blast(game, door, "explosion_bomb_iron", { damageType: DamageType.Airstrike });
        }
        expect(door.dead).toBe(true);
    });

    it("ignores hand grenades, barrels, stoves, bullets and melee", () => {
        const { game, door, origin } = doorGame(SUBWAY_GATE);
        for (const type of ["explosion_frag", "explosion_barrel", "explosion_stove", "explosion_mirv"]) {
            for (let i = 0; i < 5; i++) blast(game, door, type);
        }
        shoot(game, origin, "ak47", 200);
        game.damageObstacle(door, { amount: 10_000, damageType: DamageType.Player, gameSourceType: "sledgehammer" });
        expect([door.dead, door.health]).toEqual([false, door.maxHealth]);
    });
});
