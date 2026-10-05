import { v2 } from "@rebirth/core";
import { GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Obstacle } from "../src/index.ts";
import {
    constantRng,
    fireOnce,
    flatGame,
    giveGun,
    type ObstacleSpec,
    openSpot,
    recordShots,
    spawnAt,
    steps,
} from "./combatHelpers.ts";

/** Shooter at an open spot facing +x with `gun`, plus obstacles placed relative to it. */
function range(gun: string, obstacles: Array<Omit<ObstacleSpec, "pos"> & { at: { x: number; y: number } }> = []) {
    const probe = flatGame();
    const origin = openSpot(probe, 70);
    const game = flatGame(obstacles.map(({ at, ...o }) => ({ ...o, pos: v2.add(origin, at) })));
    game.combatRng = constantRng();
    const p = spawnAt(game, origin);
    const def = giveGun(p, gun, { reserve: 200 });
    return { game, p, def, origin };
}

describe("bullet flight", () => {
    it("travels at its speed and dies at its range", () => {
        const { game, p } = range("ak47");
        fireOnce(game, p);
        const b = game.bullets.active[0];
        const def = getDefOfType("bullet", "bullet_ak47");
        expect(b.distance).toBe(def.distance);
        expect(b.distanceTraveled).toBeCloseTo(def.speed * 0.01, 9);
        steps(game, Math.ceil(def.distance / def.speed / 0.01) + 2);
        expect(game.bullets.active).not.toContain(b);
        expect(b.distanceTraveled).toBeCloseTo(def.distance, 6);
    });

    it("jitters the range by up to 1 unit except for shotgun pellets", () => {
        for (const [value, adj] of [
            [0, -1],
            [0.999999, 1],
        ]) {
            const { game, p } = range("ak47");
            game.combatRng = constantRng(value);
            fireOnce(game, p);
            game.step();
            expect(game.bullets.active[0].distance).toBeCloseTo(200 + adj, 9);
            const sg = range("m870");
            sg.game.combatRng = constantRng(value);
            fireOnce(sg.game, sg.p);
            expect(sg.game.bullets.active.every((b) => b.distance === 27)).toBe(true);
        }
    });

    it("loses damage linearly with the distance travelled (falloff)", () => {
        for (const dist of [5, 20, 50, 120]) {
            const { game, p, def } = range("ak47");
            const target = spawnAt(game, v2.add(p.pos, { x: dist, y: 0 }), { x: -1, y: 0 });
            fireOnce(game, p);
            steps(game, 200);
            const bullet = getDefOfType("bullet", def.bulletType);
            // the bullet starts barrelLength ahead and moves speed * dt per tick; falloff uses the distance
            // travelled at the end of the tick it hits (survev bullet.ts)
            const stepLen = bullet.speed * 0.01;
            const travelled = Math.ceil((dist - 1 - def.barrelLength) / stepLen - 1e-9) * stepLen;
            const expected = bullet.damage * (1 + (bullet.falloff - 1) * (travelled / bullet.distance));
            expect(100 - target.health).toBeCloseTo(expected, 9);
        }
    });

    it("stops at walls and does not hurt players behind them", () => {
        const { game, p } = range("ak47", [{ type: "brick_wall_ext_10", at: { x: 10, y: 0 } }]);
        const target = spawnAt(game, v2.add(p.pos, { x: 16, y: 0 }));
        fireOnce(game, p);
        const b = game.bullets.active[0];
        // clients draw the tracer up to the indestructible wall
        expect(b.clientDistance).toBeCloseTo(10 - 0.5 - 3.15, 6);
        steps(game, 50);
        expect(b.alive).toBe(false);
        expect(b.distanceTraveled).toBeCloseTo(10 - 0.5 - 3.15, 6);
        expect(target.health).toBe(100);
    });

    it("passes through non-collidable obstacles (bushes) while damaging them", () => {
        const { game, p } = range("ak47", [{ type: "bush_01", at: { x: 10, y: 0 } }]);
        const target = spawnAt(game, v2.add(p.pos, { x: 20, y: 0 }));
        const bush = [...game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        fireOnce(game, p);
        steps(game, 40);
        expect(bush.health).toBeLessThan(bush.maxHealth);
        expect(target.health).toBeLessThan(100);
    });

    it("ricochets off metal: mirrored direction, range / 1.5^n, damage / (n + 1), at most maxReflect times", () => {
        // a corridor of metal walls along +x: the bullet zigzags between them
        const walls = [];
        for (let x = 5; x <= 95; x += 10) {
            walls.push({ type: "metal_wall_ext_10", ori: 1, at: { x, y: 3 } });
            walls.push({ type: "metal_wall_ext_10", ori: 1, at: { x, y: -3 } });
        }
        const { game, p } = range("ak47", walls);
        p.dir = v2.normalize({ x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) });
        fireOnce(game, p);
        const fired = new Map<number, (typeof game.bullets.active)[number]>();
        for (let i = 0; i < 300; i++) {
            for (const r of game.bullets.reports) fired.set(r.bullet.id, r.bullet);
            game.step();
        }
        const chain = [...fired.values()].sort((a, b) => a.reflectCount - b.reflectCount);
        expect(chain.map((b) => b.reflectCount)).toEqual([0, 1, 2, 3]);
        for (const b of chain) {
            expect(b.distance).toBeCloseTo(200 / GameConfig.bullet.reflectDistDecay ** b.reflectCount, 9);
            expect(b.alive).toBe(false);
        }
        // each reflection mirrors the vertical component
        expect(chain[1].dir.y).toBeCloseTo(-chain[0].dir.y, 9);
        expect(chain[1].dir.x).toBeCloseTo(chain[0].dir.x, 9);
        expect(chain[2].dir.y).toBeCloseTo(chain[0].dir.y, 9);
    });

    it("halves the damage of a ricochet that hits a player", () => {
        const { game, p, def } = range("ak47", [{ type: "metal_wall_ext_10", at: { x: 10, y: 0 } }]);
        const a = (20 * Math.PI) / 180;
        p.dir = { x: Math.cos(a), y: Math.sin(a) };
        // the bullet meets the wall face (x = 9.5) and leaves along (-cos a, sin a)
        const hit = v2.add(p.pos, { x: 9.5, y: 9.5 * Math.tan(a) });
        const target = spawnAt(game, v2.add(hit, v2.mul({ x: -Math.cos(a), y: Math.sin(a) }, 6)));
        fireOnce(game, p);
        steps(game, 60);
        const bullet = getDefOfType("bullet", def.bulletType);
        const dealt = 100 - target.health;
        expect(dealt).toBeGreaterThan((bullet.damage / 2) * bullet.falloff);
        expect(dealt).toBeLessThanOrEqual(bullet.damage / 2);
        expect(target.lastHit?.sourceId).toBe(p.id);
    });

    it("lets ricochets hit their own shooter", () => {
        const { game, p } = range("ak47", [{ type: "metal_wall_ext_10", at: { x: 8, y: 0 } }]);
        fireOnce(game, p);
        steps(game, 30);
        expect(p.health).toBeLessThan(100);
    });

    it("never hurts its shooter directly, and does no player damage once the shooter is dead", () => {
        const { game, p } = range("ak47");
        const target = spawnAt(game, v2.add(p.pos, { x: 40, y: 0 }));
        fireOnce(game, p);
        expect(p.health).toBe(100);
        p.dead = true;
        steps(game, 60);
        expect(target.health).toBe(100);
    });

    it("damages obstacles by obstacleDamage and drops their loot when destroyed", () => {
        const { game, p } = range("ak47", [{ type: "crate_01", at: { x: 10, y: 0 } }]);
        const crate = [...game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        fireOnce(game, p);
        steps(game, 30);
        const bullet = getDefOfType("bullet", "bullet_ak47");
        expect(crate.maxHealth - crate.health).toBeCloseTo(
            bullet.damage * bullet.obstacleDamage * (1 - 0.1 * (5 / 200)),
            6,
        );
        expect(game.loot.items.size).toBe(0);
        recordShots(game, p, 300, () => ({ shootHold: true }));
        expect(crate.dead).toBe(true);
        expect(game.loot.items.size).toBeGreaterThan(0);
        for (const loot of game.loot.items.values()) expect(v2.distance(loot.pos, crate.pos)).toBeLessThan(6);
    });

    it("does not damage armour-plated obstacles with bullets", () => {
        const { game, p } = range("ak47", [{ type: "crate_04", at: { x: 10, y: 0 } }]);
        const crate = [...game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        recordShots(game, p, 100, () => ({ shootHold: true }));
        expect(crate.health).toBe(crate.maxHealth);
    });

    it("turns destroyed windows into broken windows (destroyType)", () => {
        const { game, p } = range("ak47", [{ type: "house_window_01", at: { x: 10, y: 0 } }]);
        fireOnce(game, p);
        steps(game, 20);
        const types = [...game.world.objects.values()].filter((o) => o.kind === "obstacle").map((o) => o.type);
        expect(types).toContain("house_window_broken_01");
    });
});

describe("shotgun point blank", () => {
    it("pulls pellet spawns back in front of a wall the muzzle is pressed against", () => {
        const { game, p } = range("m870", [{ type: "brick_wall_ext_10", at: { x: 2.2, y: 0 } }]);
        game.combatRng = constantRng(0.9); // spread and jitter: pellets scatter
        const target = spawnAt(game, v2.add(p.pos, { x: 5, y: 0 }));
        fireOnce(game, p);
        const pellets = game.bullets.reports.map((r) => r.bullet).filter((b) => b.reflectCount === 0);
        expect(pellets).toHaveLength(9);
        const wallFace = p.pos.x + 2.2 - 0.5;
        for (const b of pellets) expect(b.startPos.x).toBeLessThan(wallFace);
        steps(game, 30);
        expect(target.health).toBe(100);
    });

    it("misses a player hugging the muzzle: pellets spawn barrelLength ahead, past the target", () => {
        const { game, p } = range("m870");
        const target = spawnAt(game, v2.add(p.pos, { x: 2, y: 0 }));
        fireOnce(game, p);
        steps(game, 30);
        expect(target.health).toBe(100);
        // one step back and every pellet hits
        const far = range("m870");
        const t2 = spawnAt(far.game, v2.add(far.p.pos, { x: 4.5, y: 0 }));
        fireOnce(far.game, far.p);
        steps(far.game, 30);
        expect(t2.health).toBeLessThan(100 - 8 * 10);
    });
});

describe("snapshot bullet events", () => {
    it("reports new bullets to viewers that can see their path, once, with the drawn distance", () => {
        const { game, p } = range("ak47", [{ type: "brick_wall_ext_10", at: { x: 30, y: 0 } }]);
        const far = spawnAt(game, v2.add(p.pos, { x: 0, y: 200 }));
        game.getSnapshot(p.id);
        game.getSnapshot(far.id);
        fireOnce(game, p);
        const snap = game.getSnapshot(p.id);
        expect(snap.bullets).toHaveLength(1);
        const ev = snap.bullets![0];
        expect(ev).toMatchObject({
            shooterId: p.id,
            bulletType: "bullet_ak47",
            sourceType: "ak47",
            layer: 0,
            reflectCount: 0,
            hitPlayer: false,
            shotFx: true,
        });
        expect(ev.maxDist).toBeCloseTo(30 - 0.5 - 3.15, 6);
        expect(ev.pos.x).toBeCloseTo(p.pos.x + 3.15, 6);
        expect(ev.dir).toEqual({ x: 1, y: 0 });
        expect(ev.endDist).toBeUndefined();
        expect(game.getSnapshot(far.id).bullets).toEqual([]);
        steps(game, 3);
        expect(game.getSnapshot(p.id).bullets).toEqual([]);
        // the player view carries the shot for muzzle flashes
        const view = snap.objects.find((o) => o.id === p.id);
        expect(view).toMatchObject({ kind: "player", shot: { seq: 1, offHand: false } });
    });

    it("reports a bullet again when it hits a player after its first report", () => {
        const { game, p } = range("ak47");
        const target = spawnAt(game, v2.add(p.pos, { x: 25, y: 0 }));
        game.getSnapshot(p.id);
        fireOnce(game, p);
        const first = game.getSnapshot(p.id).bullets!;
        expect(first[0].hitPlayer).toBe(false);
        let again = first;
        for (let i = 0; i < 10; i++) {
            steps(game, 3);
            again = game.getSnapshot(p.id).bullets!;
            if (again.length) break;
        }
        expect(again).toHaveLength(1);
        expect(again[0].id).toBe(first[0].id);
        expect(again[0].hitPlayer).toBe(true);
        expect(again[0].endDist).toBeCloseTo(25 - 1 - 3.15, 6);
        expect(target.health).toBeLessThan(100);
        expect(p.weapons[WeaponSlot.Primary].ammo).toBe(29);
    });
});
