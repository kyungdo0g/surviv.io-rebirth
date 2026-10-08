// The rebirth's launchers in the simulation (beta; docs/design/new-gun-stats.md 4.4): the M79 / MGL lob a 40 mm
// grenade (the potato cannon's projectile path), the GL-06 round bursts at the cursor (the USAS-12 path), the RPG-7,
// Panzerfaust and M202 fire exploding rockets; each explodes with the sheet's explosion, which walls block and which
// hurts its shooter too (never a teammate); rockets and the GL-06 round explode on metal instead of ricocheting, fly their exact range and
// are duds before their arming distance. GUN_BETA puts the beta guns on the floor of a real map.
import { type Vec2, v2 } from "@rebirth/core";
import {
    DamageType,
    GUN_BETA_FLOOR_COPIES,
    GUN_BETA_GUNS,
    getDefOfType,
    getGunBetaGuns,
    getGunBetaLootTables,
    NEW_GUN_IDS,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Player } from "../src/index.ts";
import { floorGunSpots } from "../src/loot/gunBeta.ts";
import { constantRng, flatGame, giveGun, type ObstacleSpec, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { clearSpot, fxGame, logExplosions } from "./fxHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** Shooter at an open spot facing +x with `gun` (full magazine), obstacles placed relative to it. */
function range(gun: string, obstacles: Array<Omit<ObstacleSpec, "pos"> & { at: Vec2 }> = []) {
    const origin = openSpot(flatGame(), 90);
    const game = flatGame(obstacles.map(({ at, ...o }) => ({ ...o, pos: v2.add(origin, at) })));
    game.combatRng = constantRng();
    // shrapnel flies towards +x with the constant fx stream
    game.fxRng = constantRng(0);
    const p = spawnAt(game, origin);
    giveGun(p, gun, { reserve: 20 });
    return { game, p, origin, log: logExplosions(game) };
}

function target(game: Game, pos: Vec2): Player {
    const t = game.getPlayer(game.addPlayer("target"))!;
    game.teleportPlayer(t.id, pos);
    return t;
}

/** Pulls the trigger once with the cursor `mouse` units ahead, then lets `ticks` ticks pass. */
function fire(game: Game, p: Player, ticks: number, mouse = 30): void {
    send(game, p, { shootStart: true, shootHold: true, toMouseLen: mouse });
    game.step();
    send(game, p, { toMouseLen: mouse });
    steps(game, ticks);
}

const EXPLOSION: Readonly<Record<string, string>> = {
    m79: "explosion_m79",
    mgl: "explosion_m79",
    gl06: "explosion_gl06",
    rpg7: "explosion_rpg7",
    panzerfaust: "explosion_panzerfaust",
    m202: "explosion_m202",
};

describe("launchers fire the sheet's explosions", () => {
    it("explosion defs: damage, radius, shrapnel and obstacle multiplier of new-gun-stats.md 4.4", () => {
        const sheet = {
            explosion_m79: [125, 5, 12, 12, 1.1],
            explosion_gl06: [100, 4, 10, 6, 1.1],
            explosion_rpg7: [150, 6, 14, 12, 0.9],
            explosion_panzerfaust: [140, 4, 9, 4, 0.9],
            // the owner's M202 rework (2026-10-08; new-gun-stats.md 2.8, packages/sim/test/m202.test.ts)
            explosion_m202: [125, 5, 16, 0, 42],
        };
        for (const [id, want] of Object.entries(sheet)) {
            const e = getDefOfType("explosion", id);
            expect([e.damage, e.rad.min, e.rad.max, e.shrapnelCount, e.obstacleDamage], id).toEqual(want);
        }
        // its own def, not the frag's: the rebirth frag radius x1.3 does not reach the M79 (plan 5.4)
        expect(getDefOfType("explosion", "explosion_frag").rad).toEqual({ min: 6.5, max: 15.6 });
    });

    it.each(["m79", "mgl"])("%s lobs a 40 mm grenade that bursts about 52 u away (1.3 s fuse at 40 u/s)", (gun) => {
        const { game, p, log } = range(gun);
        fire(game, p, 5);
        const proj = game.projectiles.projectiles.find((x) => x.type === "m79_grenade");
        expect(proj?.ownerId).toBe(p.id);
        steps(game, 140);
        const e = log.filter((x) => x.type === "explosion_m79");
        expect(e).toHaveLength(1);
        const dist = v2.distance(e[0].pos, p.pos);
        expect(dist).toBeGreaterThan(48);
        expect(dist).toBeLessThan(56);
        expect(e[0]).toMatchObject({ sourceId: p.id, damageType: DamageType.Player });
    });

    it("the 40 mm lob bursts on the first player it touches: a direct hit kills an unarmoured target", () => {
        const { game, p, origin, log } = range("m79");
        const t = target(game, v2.add(origin, { x: 15, y: 0 }));
        fire(game, p, 100);
        expect(log.filter((x) => x.type === "explosion_m79")).toHaveLength(1);
        expect(t.dead || t.downed || t.health <= 0).toBe(true);
    });

    it("the GL-06 round bursts at the cursor", () => {
        for (const mouse of [12, 25]) {
            const { game, p, log } = range("gl06");
            fire(game, p, 100, mouse);
            const e = log.filter((x) => x.type === "explosion_gl06");
            expect(e, `${mouse}`).toHaveLength(1);
            // the round's range ends at the cursor, barrel excluded (toMouseHit)
            expect(v2.distance(e[0].pos, p.pos)).toBeCloseTo(mouse, 0);
        }
    });

    it("RPG-7 and Panzerfaust rockets kill an unarmoured target with a direct hit (rocket + blast)", () => {
        for (const gun of ["rpg7", "panzerfaust"]) {
            const { game, p, origin, log } = range(gun);
            const t = target(game, v2.add(origin, { x: 20, y: 0 }));
            fire(game, p, 150);
            expect(
                log.filter((x) => x.type === EXPLOSION[gun]),
                gun,
            ).toHaveLength(1);
            expect(t.health, gun).toBe(0);
            // the shooter, 20 u away, is past the blast
            expect(p.health, gun).toBe(100);
        }
    });

    it("M202: the 4 rockets of the volley burst at the cursor, at most at the end of their 75 u range", () => {
        const { game, p, log } = range("m202");
        const start = v2.copy(p.pos);
        fire(game, p, 200, 200);
        const e = log.filter((x) => x.type === "explosion_m202");
        expect(e).toHaveLength(4);
        // 75 u from the muzzle, 2.2 u ahead of where the shooter stood (it then slid back with the recoil)
        for (const x of e) expect(v2.distance(x.pos, start)).toBeGreaterThan(70);
        // rockets fly their exact range (noDistAdj): the cursor (30 u) minus the barrel
        game.combatRng = constantRng(0);
        giveGun(p, "m202");
        fire(game, p, 1, 30);
        const b = game.bullets.active.filter((x) => x.bulletType === "bullet_m202");
        expect(b.map((x) => +x.distance.toFixed(6))).toEqual([27.8, 27.8, 27.8, 27.8]);
    });
});

describe("launcher explosions in the world", () => {
    /** Explosion damage to a target 6 u from the blast, with or without a wall between them, enemy or teammate. */
    const blast = (type: string, wall: boolean, teammate = false) => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin, wall ? [{ type: "warehouse_wall_side", pos: { x: 3, y: 0 }, ori: 1 }] : []);
        game.fxRng = constantRng(0);
        game.teleportPlayer(p.id, v2.add(origin, { x: 0, y: -40 }));
        const t = target(game, v2.add(origin, { x: 6, y: 0 }));
        if (teammate) t.teamId = p.teamId;
        game.explosions.add(type, origin, 0, { damageType: DamageType.Player, sourceId: p.id });
        steps(game, 100);
        return 100 - t.health;
    };

    it.each(Object.values(EXPLOSION).filter((e, i, a) => a.indexOf(e) === i))("%s is blocked by walls", (type) => {
        expect(blast(type, false)).toBeGreaterThan(0);
        expect(blast(type, true)).toBe(0);
    });

    it.each(Object.values(EXPLOSION).filter((e, i, a) => a.indexOf(e) === i))("%s spares the teammates", (type) => {
        expect(blast(type, false, true)).toBe(0);
    });

    it("hurts its shooter: an RPG-7 rocket on a wall 8 u ahead hurts, the same rocket 25 u ahead does not", () => {
        const near = range("rpg7", [{ type: "metal_wall_ext_10", at: { x: 8, y: 0 } }]);
        fire(near.game, near.p, 60);
        expect(near.log.filter((x) => x.type === "explosion_rpg7")).toHaveLength(1);
        expect(near.p.health).toBeLessThan(100);
        const far = range("rpg7", [{ type: "metal_wall_ext_10", at: { x: 25, y: 0 } }]);
        fire(far.game, far.p, 100);
        expect(far.log.filter((x) => x.type === "explosion_rpg7")).toHaveLength(1);
        expect(far.p.health).toBe(100);
    });

    it("rockets explode on metal instead of ricocheting (an AK-47 round ricochets)", () => {
        const rpg = range("rpg7", [{ type: "metal_wall_ext_10", at: { x: 12, y: 0 } }]);
        fire(rpg.game, rpg.p, 100);
        const e = rpg.log.filter((x) => x.type === "explosion_rpg7");
        expect(e).toHaveLength(1);
        // 0.1 in front of the wall face (x = 11.5)
        expect(e[0].pos.x - rpg.p.pos.x).toBeCloseTo(11.4, 1);
        // (its shrapnel may ricochet off the wall, the rocket itself never does)
        const rocketRicochets = rpg.game.bullets.reports.filter(
            (r) => r.bullet.bulletType === "bullet_rpg7" && r.bullet.reflectCount > 0,
        );
        expect(rocketRicochets).toEqual([]);
        const ak = range("ak47", [{ type: "metal_wall_ext_10", at: { x: 12, y: 0 } }]);
        fire(ak.game, ak.p, 30);
        expect(ak.game.bullets.reports.some((r) => r.bullet.reflectCount > 0)).toBe(true);
    });

    it("a rocket stopped before its arming distance is a dud (no point-blank suicide); the hit still counts", () => {
        for (const gun of ["rpg7", "panzerfaust"]) {
            const { game, p, log } = range(gun, [{ type: "metal_wall_ext_10", at: { x: 5, y: 0 } }]);
            fire(game, p, 60);
            expect(
                log.filter((x) => x.type === EXPLOSION[gun]),
                gun,
            ).toEqual([]);
            expect(p.health, gun).toBe(100);
        }
        const { game, p, origin, log } = range("rpg7");
        const t = target(game, v2.add(origin, { x: 5.5, y: 0 }));
        fire(game, p, 30);
        expect(log.filter((x) => x.type === "explosion_rpg7")).toEqual([]);
        expect(100 - t.health).toBeCloseTo(getDefOfType("bullet", "bullet_rpg7").damage, 0);
    });
});

describe("GUN_BETA (rules.gunBeta)", () => {
    const betaLoot = (gunBeta: boolean) => {
        const game = new Game({ mapName: "main", seed: 7 }, { generation: cachedMap("main", 7), gunBeta });
        const types = [...game.loot.items.values()].map((l) => l.type);
        return { game, types, beta: types.filter((t) => GUN_BETA_GUNS.includes(t)) };
    };

    it("off by default; on, the new and survev-only guns are common floor loot on the map", () => {
        const off = betaLoot(false);
        expect(off.game.rules.gunBeta).toBe(false);
        const on = betaLoot(true);
        expect(on.game.rules.gunBeta).toBe(true);
        expect(on.beta.length).toBeGreaterThan(off.beta.length * 2);
        // every beta gun main allows lies there at least GUN_BETA_FLOOR_COPIES times, the Barrett included
        for (const gun of getGunBetaGuns("main")) {
            expect(on.beta.filter((t) => t === gun).length, gun).toBeGreaterThanOrEqual(GUN_BETA_FLOOR_COPIES);
        }
        expect(on.beta).toContain("barrett");
        expect(on.types.some((t) => NEW_GUN_IDS.includes(t) && t.endsWith("_dual"))).toBe(false);
        // deterministic: the same seed gives the same loot
        expect(betaLoot(true).types).toEqual(on.types);
    });

    it("the copies lie at distinct floor gun spots (loot spawners that can roll tier_guns), with their ammo", () => {
        const { game } = betaLoot(true);
        const spots = floorGunSpots(getGunBetaLootTables("main"), game.generation.lootSpawns);
        const guns = getGunBetaGuns("main");
        expect(spots.length).toBeGreaterThanOrEqual(guns.length * GUN_BETA_FLOOR_COPIES);
        const spotKeys = new Set(spots.map((s) => `${s.pos.x},${s.pos.y},${s.layer}`));
        const copies = new Map<string, number>();
        for (const l of game.loot.items.values()) {
            const key = `${l.pos.x},${l.pos.y},${l.layer}`;
            if (GUN_BETA_GUNS.includes(l.type) && spotKeys.has(key)) copies.set(key, (copies.get(key) ?? 0) + 1);
        }
        // one copy per spot while spots last: at least that many spots hold a beta gun
        expect(copies.size).toBeGreaterThanOrEqual(guns.length * GUN_BETA_FLOOR_COPIES);
        // a P90 copy comes with its 5.7x28 side stacks
        expect([...game.loot.items.values()].some((l) => l.type === "57mm")).toBe(true);
        // a map without floor gun spots gets none and draws nothing from the loot rng
        expect(floorGunSpots(getGunBetaLootTables("main"), [])).toEqual([]);
    });
});
