// M9 bullets: USAS-12 toMouseHit (clipped ranges), the tracer speed factor of reports, full-range flare reports.
import { v2 } from "@rebirth/core";
import { getDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { BulletSystem } from "../src/index.ts";
import { constantRng, flatGame, giveGun, type ObstacleSpec, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { logExplosions } from "./fxHelpers.ts";

function range(gun: string, obstacles: Array<Omit<ObstacleSpec, "pos"> & { at: { x: number; y: number } }> = []) {
    const probe = flatGame();
    const origin = openSpot(probe, 70);
    const game = flatGame(obstacles.map(({ at, ...o }) => ({ ...o, pos: v2.add(origin, at) })));
    game.combatRng = constantRng();
    game.fxRng = constantRng();
    const p = spawnAt(game, origin);
    const def = giveGun(p, gun, { reserve: 200 });
    return { game, p, def, origin };
}

/** Fires once with the cursor `mouseLen` units ahead and returns the new bullets. */
function fireAt(gun: string, mouseLen: number) {
    const r = range(gun);
    send(r.game, r.p, { shootHold: true, shootStart: true, toMouseLen: mouseLen });
    r.game.step();
    send(r.game, r.p, { toMouseLen: mouseLen });
    return { ...r, bullets: r.game.bullets.reports.map((x) => x.bullet).filter((b) => b.reflectCount === 0) };
}

describe("USAS-12 toMouseHit (survev weaponManager.ts:916-930, bullet.ts:233-240)", () => {
    it("cuts the range at the cursor minus the barrel length", () => {
        const { bullets, def } = fireAt("usas", 12);
        expect(def.toMouseHit).toBe(true);
        expect(bullets).toHaveLength(1);
        // bullet_frag has no range jitter (noDistAdj) and no variance
        expect(bullets[0].distance).toBeCloseTo(12 - def.barrelLength, 9);
        expect(bullets[0].clipDistance).toBe(true);
        expect(BulletSystem.toEvent(bullets[0]).maxDist).toBeCloseTo(12 - def.barrelLength, 9);
    });

    it("never exceeds the def range and stops at the muzzle with the cursor on the player", () => {
        const far = fireAt("usas", 64);
        expect(far.bullets[0].distance).toBe(getDefOfType("bullet", "bullet_frag").distance);
        const near = fireAt("usas", 1);
        expect(near.bullets[0].distance).toBe(0);
    });

    it("bursts the frag round at the cursor", () => {
        const r = range("usas");
        const log = logExplosions(r.game);
        send(r.game, r.p, { shootHold: true, shootStart: true, toMouseLen: 15 });
        r.game.step();
        send(r.game, r.p, { toMouseLen: 15 });
        steps(r.game, 40);
        const usas = log.filter((e) => e.type === "explosion_usas");
        expect(usas).toHaveLength(1);
        // spawned 0.1 behind the stopping point (survev bullet.ts update)
        expect(v2.distance(usas[0].pos, r.origin)).toBeCloseTo(15 - 0.1, 6);
    });

    it("leaves other guns at their full range whatever the cursor distance", () => {
        const { bullets } = fireAt("ak47", 5);
        expect(bullets[0].distance).toBe(getDefOfType("bullet", "bullet_ak47").distance);
        expect(bullets[0].clipDistance).toBe(false);
    });

    it("applies distanceMult once and keeps a clipped range on ricochets", () => {
        const { game, p } = range("usas");
        const base = { shooterId: p.id, bulletType: "bullet_frag", sourceType: "usas", dir: { x: 1, y: 0 }, layer: 0 };
        const capped = game.bullets.fire({ ...base, pos: p.pos, clipDistance: true, distance: 100, distanceMult: 2 });
        expect(capped.distance).toBe(48);
        expect(capped.distanceMult).toBe(1);
        const short = game.bullets.fire({ ...base, pos: p.pos, clipDistance: true, distance: 7, distanceMult: 2 });
        expect(short.distance).toBe(7);
    });
});

describe("bullet reports (M9)", () => {
    it("carry the tracer speed factor: 1 for gun bullets, the variance for shrapnel", () => {
        const { game, p } = range("ak47");
        const ak = game.bullets.fire({
            shooterId: p.id,
            bulletType: "bullet_ak47",
            sourceType: "ak47",
            pos: p.pos,
            dir: { x: 1, y: 0 },
            layer: 0,
        });
        expect(BulletSystem.toEvent(ak).speedMult).toBe(1);
        const perk = game.bullets.fire({
            shooterId: p.id,
            bulletType: "bullet_mp5",
            sourceType: "mp5",
            pos: p.pos,
            dir: { x: 1, y: 0 },
            layer: 0,
            speedMult: 1.25,
        });
        expect(BulletSystem.toEvent(perk).speedMult).toBeCloseTo(1.25, 9);
        const shrapnel = game.bullets.fire({
            shooterId: 0,
            bulletType: "shrapnel_frag",
            sourceType: "frag",
            pos: p.pos,
            dir: { x: 1, y: 0 },
            layer: 0,
            varianceT: 0.5,
        });
        const def = getDefOfType("bullet", "shrapnel_frag");
        expect(shrapnel.speed).toBeCloseTo(def.speed * (1 + 0.5 * def.variance), 9);
        expect(BulletSystem.toEvent(shrapnel).speedMult).toBeCloseTo(1 + 0.5 * def.variance, 9);
    });

    it("report the whole range of flares, which fly through walls (skipCollision)", () => {
        const { game, p } = range("flare_gun", [{ type: "metal_wall_ext_10", at: { x: 8, y: 0 } }]);
        const fire = (bulletType: string) =>
            game.bullets.fire({
                shooterId: p.id,
                bulletType,
                sourceType: "flare_gun",
                pos: v2.add(p.pos, { x: 2, y: 0 }),
                dir: { x: 1, y: 0 },
                layer: 0,
            });
        const flare = fire("bullet_flare");
        expect(BulletSystem.toEvent(flare).maxDist).toBeCloseTo(flare.distance, 9);
        const ak = fire("bullet_ak47");
        expect(BulletSystem.toEvent(ak).maxDist).toBeLessThan(8);
    });
});
