// The M202 FLASH as the owner specified it (2026-10-08; defs rebirth/newGuns.json, docs/design/new-gun-stats.md
// 2.8): one trigger pull fires all four rockets in a fixed, evenly spaced fan that bursts at the cursor, then the
// launcher is discarded; the four blasts tile a strip at 15-25 u and kill a level 2 armoured player anywhere across
// it; the shooter slides about 2 u back, never through a wall; each blast breaks every destructible obstacle (plated
// ones included) and leaves indestructible walls alone. Each blast stays smaller than an air strike bomb's
// (explosion_bomb_iron, rad 5-14; user/2026-10-08-faction-feedback): rad 4-11, so the fan narrowed from 60° to 52°,
// the widest whole-degree fan that keeps both goals.
import { createRng, math, type Vec2, v2 } from "@rebirth/core";
import { DamageType, getDefOfType, MapObjectDefs, type ObstacleDef, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Game, Player } from "../src/index.ts";
import { fanDeviation } from "../src/weapons/gun.ts";
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

const FAN = 52;
/** The four rockets' angles off the aim: outermost to outermost, 52 / 3 degrees apart. */
const ANGLES = [-26, -26 / 3, 26 / 3, 26];

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
    it("fires all 4 rockets in one shot, in a fixed fan at -26 / -8.67 / 8.67 / 26 degrees, then is discarded", () => {
        const def = getDefOfType("gun", "m202");
        expect([def.bulletCount, def.fanAngle, def.shotSpread, def.moveSpread, def.toMouseHit]).toEqual([
            4,
            FAN,
            0,
            0,
            true,
        ]);
        for (const i of [0, 1, 2, 3]) expect(fanDeviation(FAN, i, 4)).toBeCloseTo(ANGLES[i], 9);
        const shots: number[][] = [];
        for (const [rng, moving] of [
            [constantRng(0.1), false],
            [createRng(99), true],
            [constantRng(0.9), true],
        ] as const) {
            const { game, p, wm } = shooter();
            game.combatRng = rng;
            fire(game, p, 20, moving ? { moveUp: true } : {});
            const r = rockets(game);
            expect(r).toHaveLength(4);
            expect(p.shotSeq).toBe(1);
            // one muzzle point (no pellet jitter), each rocket flying to the cursor (20 u minus the 2.2 u barrel)
            for (const b of r) {
                expect(b.startPos.x).toBeCloseTo(r[0].startPos.x, 9);
                expect(b.startPos.y).toBeCloseTo(r[0].startPos.y, 9);
                expect(b.distance).toBeCloseTo(20 - def.barrelLength, 6);
            }
            shots.push(r.map((b) => degOff(b.dir) - degOff(p.dir)));
            // the single charge is spent: the empty launcher leaves the slot after its fire delay
            expect(wm.weapons[WeaponSlot.Primary].ammo).toBe(0);
            steps(game, Math.ceil(def.fireDelay / DT) + 2);
            expect(wm.weapons[WeaponSlot.Primary].type).toBe("");
        }
        // the same evenly spaced fan whatever the random streams and whether the shooter moves
        for (const s of shots) {
            expect(s.map((a) => +a.toFixed(6))).toEqual(ANGLES.map((a) => +a.toFixed(6)));
        }
    });

    it("the four blasts tile a strip at 15-25 u: no gap between neighbouring full-damage discs", () => {
        const exp = getDefOfType("explosion", "explosion_m202");
        expect([exp.damage, exp.rad.min, exp.rad.max, exp.obstacleDamage]).toEqual([125, 4, 11, 42]);
        // smaller than an air strike bomb's blast (user/2026-10-08-faction-feedback)
        expect(exp.rad.max).toBeLessThan(getDefOfType("explosion", "explosion_bomb_iron").rad.max);
        // neighbouring rockets 52 / 3 degrees apart burst on an arc around the muzzle, their centres 2 d sin(26 / 3°)
        // apart: 4.5 u at 15 u, 6.0 u at 20 u, 7.5 u at 25 u
        for (const d of [15, 20, 25]) {
            const gap = 2 * d * Math.sin(math.deg2rad(FAN / 3 / 2));
            expect(gap, `${d} u`).toBeLessThanOrEqual(2 * exp.rad.min);
        }
    });

    it.each([15, 20, 25])("kills a full-health level 2 armoured player anywhere across the strip at %i u", (d) => {
        // every FAN / 24 from the aim point (between the inner rockets) to the edge (an outer rocket's line): the inner
        // rocket's line at 4, between inner and outer at 8; the weakest spot lies at about 10 (21° at 25 u: ~101 damage)
        for (let k = 0; k <= 12; k++) {
            const angle = (FAN / 2) * (k / 12);
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
        expect(getDefOfType("gun", "m202").recoilKnockback).toBe(2);
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
