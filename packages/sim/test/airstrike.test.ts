// Air strikes (M5): the 50v50 scheduled zones (ping, zone view, planes bombing it, zone expiry, "The air strike"
// kills), strike planes and their bomb strips, and the flare gun calling an air drop where it is fired.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, Plane } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Player } from "../src/index.ts";
import { giveGun, send, steps } from "./combatHelpers.ts";
import { clearSpot, logExplosions } from "./fxHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** A game with the flat test terrain running `mapName`'s plane timings. */
function flatMapGame(mapName: string, seed = 12345): Game {
    const gen = cachedMap("main", 12345);
    const generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    return new Game({ mapName, seed }, { generation, spawnLoot: false, sandbox: true });
}

function addAt(game: Game, pos: Vec2): Player {
    const id = game.addPlayer(`p${game.tick}`);
    game.teleportPlayer(id, pos);
    return game.getPlayer(id)!;
}

describe("scheduled air strikes (50v50)", () => {
    it("open a zone over the players, ping it, bomb it with 3-5 planes and close it after its duration", () => {
        const origin = clearSpot();
        const game = flatMapGame("faction");
        // the v0.8.82 strike: the rebirth variants (heavy, carpet) are covered by airstrikeVariants.test.ts
        game.rules.roles.factionAirstrikeVariants = { normal: 1 };
        const players = [0, 1, 2].map((i) => addAt(game, v2.add(origin, { x: i * 3, y: 0 })));
        const log = logExplosions(game);
        game.step();
        // circle 1: wait 10 s, zone radius 60, planes 1.5 s later and 1 s apart (factionDefs timings)
        game.planes.scheduleCircle(1);
        steps(game, 999);
        expect(game.planes.zones.zones).toHaveLength(0);
        game.step();
        const zones = game.getSnapshot(players[0].id).airstrikeZones ?? [];
        expect(zones).toHaveLength(1);
        const zone = zones[0];
        expect(zone.rad).toBe(60);
        expect(v2.distance(zone.pos, origin)).toBeLessThan(10);
        expect(game.planes.indicators.some((m) => m.type === "ping_airstrike")).toBe(true);
        const strikePlanes = new Set<number>();
        let zoneGoneAt = 0;
        for (let i = 0; i < 6000 && !zoneGoneAt; i++) {
            game.step();
            for (const p of game.planes.planes) if (p.type === Plane.Airstrike) strikePlanes.add(p.id);
            if (game.planes.zones.zones.length === 0) zoneGoneAt = i + 1;
        }
        expect(strikePlanes.size).toBeGreaterThanOrEqual(3);
        expect(strikePlanes.size).toBeLessThanOrEqual(5);
        // duration = wait + 2.5 + planes x delay + 2.5 (survev addAirstrikeZone)
        expect(zoneGoneAt * 0.01).toBeCloseTo(1.5 + 2.5 + strikePlanes.size + 2.5, 1);
        expect(zone.duration).toBeCloseTo(1.5 + 2.5 + strikePlanes.size + 2.5, 0);
        steps(game, 300);
        const bombs = log.filter((e) => e.type === "explosion_bomb_iron");
        expect(bombs.length).toBe(strikePlanes.size * GameConfig.airstrike.bombCount);
        expect(bombs.every((b) => b.damageType === DamageType.Airstrike && b.sourceId === 0)).toBe(true);
        expect(bombs.every((b) => v2.distance(b.pos, zone.pos) < zone.rad + 45)).toBe(true);
    });

    it("bombs a 38 u strip ahead of the target after the plane passes it, killing as 'the air strike'", () => {
        const origin = clearSpot(100);
        const game = flatMapGame("faction");
        const victim = addAt(game, v2.add(origin, { x: 10, y: 0 }));
        const log = logExplosions(game);
        game.planes.addAirstrike(origin, { x: 1, y: 0 }, 0);
        const plane = game.planes.planes[0];
        expect(plane.type).toBe(Plane.Airstrike);
        expect(v2.distance(plane.pos, origin)).toBeCloseTo(GameConfig.airstrike.planeVel * 2.5, 6);
        steps(game, 250);
        expect(game.projectiles.projectiles).toHaveLength(0);
        steps(game, 2);
        expect(game.projectiles.projectiles.map((p) => p.type)).toEqual(["bomb_iron"]);
        steps(game, 200);
        expect(plane.actionComplete).toBe(true);
        const bombs = log.filter((e) => e.type === "explosion_bomb_iron");
        expect(bombs).toHaveLength(GameConfig.airstrike.bombCount);
        const xs = bombs.map((b) => b.pos.x - origin.x);
        expect(Math.min(...xs)).toBeGreaterThan(-GameConfig.airstrike.bombJitter);
        expect(Math.max(...xs)).toBeLessThan(38 + GameConfig.airstrike.bombJitter + 4);
        if (victim.dead) {
            const kill = game.match.kills.since(0).find((k) => k.targetId === victim.id)!;
            expect(kill).toMatchObject({ killerId: 0, source: "airstrike", itemSourceType: "bomb_iron" });
        } else {
            expect(victim.damageTaken).toBeGreaterThan(0);
        }
    });
});

describe("air strike bombs", () => {
    it("never explode inside a building with an indestructible roof (survev canBombIronExplode)", () => {
        const game = new Game({ mapName: "main", seed: 5 }, { generation: cachedMap("main", 12345), spawnLoot: false });
        const building = game.world.buildings.find(
            (b) => !b.def.ceiling.destroy && b.layer === 0 && b.zoomRegions.some((r) => r.zoomIn),
        )!;
        const roof = building.zoomRegions.find((r) => r.zoomIn)!.zoomIn!;
        const inside = { x: (roof.min.x + roof.max.x) / 2, y: (roof.min.y + roof.max.y) / 2 };
        const log = logExplosions(game);
        const drop = (pos: Vec2) =>
            game.projectiles.add({
                ownerId: 0,
                type: "bomb_iron",
                pos,
                posZ: 0,
                layer: 0,
                vel: { x: 0, y: 0 },
                fuse: 4,
                damageType: DamageType.Airstrike,
            });
        const bomb = drop(inside);
        steps(game, 5);
        expect(bomb.dead).toBe(true);
        expect(log).toHaveLength(0);
        // and it does outside: the first spot east of the roof under no roof at all
        const roofed = (p: Vec2) =>
            game.world.buildings.some((b) =>
                b.zoomRegions.some(
                    (r) =>
                        r.zoomIn &&
                        p.x >= r.zoomIn.min.x - 1 &&
                        p.x <= r.zoomIn.max.x + 1 &&
                        p.y >= r.zoomIn.min.y - 1 &&
                        p.y <= r.zoomIn.max.y + 1,
                ),
            );
        let outside = { x: roof.max.x + 30, y: inside.y };
        while (roofed(outside)) outside = { x: outside.x + 5, y: outside.y };
        drop(outside);
        steps(game, 5);
        expect(log.map((e) => e.type)).toEqual(["explosion_bomb_iron"]);
    });
});

describe("flare gun", () => {
    it("calls an air drop where it is fired", () => {
        const origin = clearSpot();
        const game = flatMapGame("main");
        const p = addAt(game, origin);
        p.dir = { x: 1, y: 0 };
        giveGun(p, "flare_gun", { reserve: 1 });
        send(game, p, { shootStart: true, shootHold: true, toMouseDir: { x: 1, y: 0 } });
        game.step();
        send(game, p, { toMouseDir: { x: 1, y: 0 } });
        expect(p.shotSeq).toBe(1);
        const drops = game.planes.planes.filter((pl) => pl.type === Plane.Airdrop);
        expect(drops).toHaveLength(1);
        // the muzzle: barrelLength 2 ahead of the player
        expect(v2.distance(drops[0].target, v2.add(origin, { x: 2, y: 0 }))).toBeLessThan(1);
        steps(game, 3000);
        const crate = [...game.world.objects.values()].find((o) => o.type.startsWith("airdrop_crate_"));
        expect(crate).toBeDefined();
        expect(v2.distance(crate!.pos, origin)).toBeLessThan(4);
    });
});
