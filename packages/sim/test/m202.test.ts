// Owner update 2026-10-10: four sequential rockets in a narrow cone; existing damage,
// obstacle penetration and total recoil are retained. Specs: second-wave-gun-specs-draft.md.
import { math, type Vec2, v2 } from "@rebirth/core";
import { DamageType, getDefOfType, MapObjectDefs, type ObstacleDef, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Game, Player } from "../src/index.ts";
import {
    constantRng,
    DT,
    flatGame,
    giveGun,
    type ObstacleSpec,
    openSpot,
    send,
    spawnAt,
    steps,
} from "./combatHelpers.ts";

const FAN = 4;

/** A shooter facing +x at an open spot (or at `origin` among `obstacles`) with an M202 in hand. */
function shooter(obstacles: ObstacleSpec[] = [], origin?: Vec2) {
    const game = flatGame(obstacles);
    game.combatRng = constantRng();
    const p = spawnAt(game, origin ?? openSpot(game, 70));
    giveGun(p, "m202");
    return { game, p, wm: p.weaponManager };
}

/** Pulls the trigger once with the cursor `mouseLen` ahead (the rockets burst there). */
function fire(game: Game, p: Player, mouseLen: number, extra: Record<string, unknown> = {}): void {
    send(game, p, { shootHold: true, shootStart: true, toMouseLen: mouseLen, ...extra });
    game.step();
    send(game, p, { toMouseLen: mouseLen });
}

const rockets = (game: Game) => game.bullets.active.filter((b) => b.bulletType === "bullet_m202");
const degOff = (dir: Vec2) => math.rad2deg(Math.atan2(dir.y, dir.x));

describe("M202 FLASH: the volley", () => {
    it("fires four separate rockets after a tap, with a narrow spread, then discards", () => {
        const def = getDefOfType("gun", "m202");
        expect([def.fireMode, def.burstCount, def.burstDelay, def.bulletCount, def.charges]).toEqual([
            "burst",
            4,
            0.035,
            1,
            4,
        ]);
        expect([def.fanAngle, def.shotSpread, def.moveSpread]).toEqual([undefined, 2, 4]);
        const { game, p, wm } = shooter();
        fire(game, p, 70);
        expect(rockets(game)).toHaveLength(1);
        expect(wm.activeSlot.ammo).toBe(3);
        const fired = [game.tick];
        for (let i = 0; i < 12; i++) {
            const before = p.shotSeq;
            game.step();
            if (p.shotSeq !== before) fired.push(game.tick);
        }
        expect(fired).toHaveLength(4);
        for (let i = 1; i < fired.length; i++) {
            expect(fired[i]).toBeGreaterThan(fired[i - 1]);
            expect((fired[i] - fired[i - 1]) * DT).toBeLessThanOrEqual(0.035 + DT);
        }
        expect((fired[3] - fired[0]) * DT).toBeCloseTo(0.105, 1);
        expect(p.shotSeq).toBe(4);
        for (const b of rockets(game)) expect(Math.abs(degOff(b.dir) - degOff(p.dir))).toBeLessThanOrEqual(4);
        expect(wm.activeSlot.ammo).toBe(0);
        steps(game, Math.ceil(def.fireDelay / DT) + 2);
        expect(wm.weapons[WeaponSlot.Primary].type).toBe("");
    });

    it("the four blasts keep their damage and overlap across the narrower aim cone", () => {
        const exp = getDefOfType("explosion", "explosion_m202");
        expect([exp.damage, exp.rad.min, exp.rad.max, exp.obstacleDamage]).toEqual([125, 5, 16, 42]);
        // the frag's large scorch mark, drawn for its 15.6 u blast
        expect(exp.decalType).toBe("decal_frag_large_explosion");
        // a normal air strike bomb still clearly outsizes it (user/2026-10-08-strike-size)
        expect(getDefOfType("explosion", "explosion_bomb_iron").rad).toEqual({ min: 6.25, max: 17.5 });
        // neighbouring rockets 20 degrees apart burst on an arc around the muzzle, their centres 2 d sin(10°) apart
        for (const d of [15, 20, 25]) {
            const gap = 2 * d * Math.sin(math.deg2rad(FAN / 3 / 2));
            expect(gap, `${d} u`).toBeLessThanOrEqual(2 * exp.rad.min);
        }
    });

    it.each([15, 20, 25])("kills a full-health level 2 armoured player across the aim cone at %i u", (d) => {
        // at the aim point (between the inner rockets), on an inner rocket's line, between inner and outer, on the edge
        for (const angle of [0, 1, 2]) {
            const { game, p } = shooter();
            const at = v2.add(p.pos, v2.mul(v2.rotate(p.dir, math.deg2rad(angle)), d));
            const t = game.getPlayer(game.addPlayer("target"))!;
            game.teleportPlayer(t.id, at);
            t.helmet = "helmet02";
            t.chest = "chest02";
            fire(game, p, d);
            steps(game, 100);
            expect(t.dead, `${d} u, ${angle} degrees: ${t.health} HP left`).toBe(true);
        }
    });
});

describe("M202 FLASH: recoil", () => {
    it("slides the shooter about 2 u back against the aim", () => {
        const { game, p } = shooter();
        const start = v2.copy(p.pos);
        fire(game, p, 40);
        steps(game, 150);
        const moved = v2.sub(p.pos, start);
        expect(moved.x).toBeCloseTo(-2, 1);
        expect(Math.abs(moved.y)).toBeLessThan(1e-9);
        expect(getDefOfType("gun", "m202").recoilKnockback).toBe(0.5);
    });

    it("never through a wall: a wall 0.9 u behind stops the slide", () => {
        const origin = openSpot(flatGame(), 70);
        // an indestructible wall, 1.2 u thick, across the line behind the shooter
        const wall = { type: "warehouse_wall_side", pos: v2.add(origin, { x: -2.5, y: 0 }), ori: 1 };
        const { game, p } = shooter([wall], origin);
        const obstacle = [...game.world.objects.values()].find((o) => o.type === "warehouse_wall_side")!;
        expect(obstacle.kind).toBe("obstacle");
        fire(game, p, 40);
        steps(game, 150);
        // the wall's front face is at x - 1.9; the body (radius 1) stops against it
        expect(p.pos.x - p.rad).toBeGreaterThan(origin.x - 1.9 - 0.02);
        expect(origin.x - p.pos.x).toBeLessThan(1);
        expect(origin.x - p.pos.x).toBeGreaterThan(0.8);
    });
});

describe("M202 FLASH: obstacles", () => {
    /** One M202 blast centred on an obstacle of `type`, credited to a shooter as its rockets are. */
    function blast(type: string) {
        const origin = openSpot(flatGame(), 70);
        const pos = v2.add(origin, { x: 40, y: 0 });
        const { game, p } = shooter([{ type, pos }], origin);
        const obstacle = [...game.world.objects.values()].find((o) => o.type === type && o.kind === "obstacle")!;
        const health = (obstacle as { health: number }).health;
        game.explosions.add("explosion_m202", pos, 0, {
            gameSourceType: "m202",
            damageType: DamageType.Player,
            sourceId: p.id,
        });
        game.step();
        return { obstacle: obstacle as unknown as { dead: boolean; health: number }, health };
    }

    it.each([
        "tree_01",
        "stone_01",
        "stone_03",
        "crate_01",
        "house_wall_int_4",
        "barn_wall_int_2",
        // armour- and stone-plated: the M202 breaks them like a piercing melee weapon
        "crate_04",
        "stone_04",
        // the toughest destructible obstacles: the bunker glass wall (5000) and the potato silo (2500)
        "glass_wall_12_2",
        "silo_01po",
    ])("breaks %s in one blast", (type) => {
        expect(blast(type).obstacle.dead).toBe(true);
    });

    it("leaves indestructible walls alone (building exterior walls)", () => {
        const { obstacle, health } = blast("warehouse_wall_side");
        expect(obstacle.dead).toBe(false);
        expect(obstacle.health).toBe(health);
    });

    it("one blast's full damage breaks every destructible obstacle def", () => {
        const exp = getDefOfType("explosion", "explosion_m202");
        const tough = Object.values(MapObjectDefs)
            .filter((d): d is ObstacleDef => d.type === "obstacle" && d.destructible)
            .reduce((m, d) => Math.max(m, d.health), 0);
        expect(tough).toBe(5000);
        expect(exp.damage * exp.obstacleDamage).toBeGreaterThanOrEqual(tough);
    });
});
