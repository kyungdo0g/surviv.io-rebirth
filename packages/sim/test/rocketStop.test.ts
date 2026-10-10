// A launcher rocket (RPG-7, Panzerfaust, M202) is gone the moment it detonates (owner report 2026-10-10): the sim
// stops it on the first obstacle or player it hits, explodes it once there, and reports where it stopped (`endDist`)
// so clients stop drawing its sprite and smoke trail at that point, even when the obstacle it hit is destroyed by the
// blast before the client's own tracer reaches it.
import { type Vec2, v2 } from "@rebirth/core";
import { getDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { BulletEvent, Game, Player } from "../src/index.ts";
import { bulletEventsIn } from "../src/match/reports.ts";
import { constantRng, flatGame, giveGun, type ObstacleSpec, openSpot, send, spawnAt } from "./combatHelpers.ts";
import { logExplosions } from "./fxHelpers.ts";

const ROCKETS = [
    ["rpg7", "bullet_rpg7", "explosion_rpg7"],
    ["panzerfaust", "bullet_panzerfaust", "explosion_panzerfaust"],
    ["m202", "bullet_m202", "explosion_m202"],
] as const;

function range(gun: string, obstacles: Array<Omit<ObstacleSpec, "pos"> & { at: Vec2 }> = []) {
    const origin = openSpot(flatGame(), 90);
    const game = flatGame(obstacles.map(({ at, ...o }) => ({ ...o, pos: v2.add(origin, at) })));
    game.combatRng = constantRng();
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

const WORLD = { min: { x: 0, y: 0 }, max: { x: 10000, y: 10000 } };

interface Seen {
    /** the latest snapshot event of the rocket, as a client receives it */
    event: BulletEvent;
    /** the rocket the sim still moved after a snapshot already reported it stopped */
    movedAfterStop: boolean;
}

/** Fires once at a cursor far ahead and keeps the latest snapshot event of every `bulletType` bullet. */
function fireAndWatch(game: Game, p: Player, bulletType: string, ticks: number): Seen[] {
    const seen = new Map<number, Seen>();
    send(game, p, { shootStart: true, shootHold: true, toMouseLen: 200 });
    for (let i = 0; i < ticks; i++) {
        const since = game.bullets.tick;
        game.step();
        send(game, p, { toMouseLen: 200 });
        for (const b of game.bullets.active) {
            const s = seen.get(b.id);
            if (s && s.event.endDist !== undefined) s.movedAfterStop = true;
        }
        for (const e of bulletEventsIn(game.bullets.reports, since, WORLD)) {
            if (e.bulletType !== bulletType) continue;
            const s = seen.get(e.id);
            if (s) s.event = e;
            else seen.set(e.id, { event: e, movedAfterStop: false });
        }
    }
    return [...seen.values()];
}

describe("a rocket vanishes when it detonates", () => {
    it.each(ROCKETS)(
        "%s: a crate stops it, it explodes once and is reported stopped there",
        (gun, bullet, explosion) => {
            const { game, p, log } = range(gun, [{ type: "crate_01", at: { x: 15, y: 0 } }]);
            // Test one projectile's stop, including an M202 with its final charge remaining.
            // A full sequential burst can destroy this crate and let later rockets through.
            if (gun === "m202") p.weaponManager.activeSlot.ammo = 1;
            const behind = target(game, v2.add(p.pos, { x: 45, y: 0 }));
            const rockets = fireAndWatch(game, p, bullet, 150);
            expect(rockets.length).toBeGreaterThan(0);
            for (const r of rockets) {
                expect(r.movedAfterStop).toBe(false);
                // Every rocket stopped on the crate and reports where.
                expect(r.event.endDist).toBeDefined();
            }
            // one burst per rocket, never a second one further on
            expect(log.filter((x) => x.type === explosion)).toHaveLength(rockets.length);
            // at least one rocket stopped on the crate, well short of the path the client was first told it could fly
            const onCrate = rockets.filter((r) => r.event.endDist! < 15);
            expect(onCrate.length).toBeGreaterThan(0);
            for (const r of onCrate) expect(r.event.maxDist).toBeGreaterThan(30);
            // nothing flew on to the player behind the crate
            expect(behind.health).toBe(100);
        },
    );

    it.each(ROCKETS)(
        "%s: a direct hit stops it on the player, rocket damage plus the blast",
        (gun, bullet, explosion) => {
            const { game, p, log } = range(gun);
            // Centered RNG aims every launcher straight ahead, including the new narrow M202 burst.
            const t = target(game, v2.add(p.pos, { x: 18, y: 0 }));
            const damage: number[] = [];
            const orig = game.bullets.damages.push.bind(game.bullets.damages);
            game.bullets.damages.push = (...d) => {
                for (const q of d) if (q.target === t) damage.push(q.params.amount);
                return orig(...d);
            };
            const rockets = fireAndWatch(game, p, bullet, 150);
            const hits = rockets.filter((r) => r.event.hitPlayer);
            expect(hits.length).toBeGreaterThan(0);
            for (const r of hits) expect(r.event.endDist!).toBeLessThan(18);
            // each rocket that hit dealt its own damage once, and burst once
            expect(damage).toEqual(hits.map(() => getDefOfType("bullet", bullet).damage));
            expect(log.filter((x) => x.type === explosion)).toHaveLength(rockets.length);
            // the rocket alone (25-80) does not kill an unarmoured player, its blast on top does
            expect(getDefOfType("bullet", bullet).damage).toBeLessThan(100);
            expect(t.health).toBe(0);
        },
    );

    it("M202 sequential rockets can pass a crate destroyed by an earlier rocket, without any rocket continuing after detonation", () => {
        const { game, p, log } = range("m202", [{ type: "crate_01", at: { x: 15, y: 0 } }]);
        const behind = target(game, v2.add(p.pos, { x: 45, y: 0 }));
        const rockets = fireAndWatch(game, p, "bullet_m202", 150);
        expect(rockets).toHaveLength(4);
        expect(rockets[0].event.endDist!).toBeLessThan(15);
        expect(rockets.some((r) => r.event.hitPlayer)).toBe(true);
        expect(behind.health).toBe(0);
        expect(rockets.every((r) => !r.movedAfterStop)).toBe(true);
        expect(log.filter((x) => x.type === "explosion_m202")).toHaveLength(4);
    });
});
