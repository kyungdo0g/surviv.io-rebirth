// Planes and air drops (M4): scheduled from the map's plane timings, crates land inside the next safe circle,
// crush what is under them, become an airdrop_crate obstacle opened with Interact, whose loot crate drops loot.
import { collider, type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Obstacle, type Player } from "../src/index.ts";
import { flatGame, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

const FALL_TICKS = GameConfig.airdrop.fallTime * 100;

function crates(game: Game, prefix: string): Obstacle[] {
    const out: Obstacle[] = [];
    for (const o of game.world.objects.values()) if (o.kind === "obstacle" && o.type.startsWith(prefix)) out.push(o);
    return out;
}

/** Steps until no plane or falling crate is left (at most `max` ticks). */
function untilLanded(game: Game, max = 6000): void {
    for (let i = 0; i < max; i++) {
        game.step();
        if (game.planes.planes.every((p) => p.actionComplete) && game.planes.airdrops.every((d) => d.landed)) return;
    }
    throw new Error("the crate did not land");
}

describe("air drops land inside the next safe circle", () => {
    it("100 seeds on 4 maps", () => {
        const maps = [cachedMap("main", 12345), cachedMap("main", 777), cachedMap("main", 4242), cachedMap("main", 99)];
        let outside = 0;
        for (let seed = 0; seed < 100; seed++) {
            const game = new Game(
                { mapName: "main", seed: 1000 + seed },
                { generation: maps[seed % maps.length], spawnLoot: false, sandbox: true },
            );
            game.step();
            const { posNew, radNew } = game.gas;
            game.planes.scheduleAirdrop();
            const before = new Set(game.world.objects.keys());
            untilLanded(game);
            const [crate] = crates(game, "airdrop_crate_");
            expect(crate).toBeDefined();
            if (v2.distance(crate.pos, posNew) >= radNew) outside++;
            // never on an indestructible obstacle (destroyed ones may leave a residue obstacle, e.g. broken windows)
            for (const o of game.world.query(crate.bounds)) {
                if (o.kind !== "obstacle" || !before.has(o.id) || o.destructible || o.dead || o.layer !== 0) continue;
                expect([o.type, collider.intersect(o.collider, crate.collider)]).toEqual([o.type, null]);
            }
        }
        expect(outside).toBe(0);
    }, 60_000);

    it("the main map schedules drops 10 s into circle 1 and 2 s into circle 3, with a minimap marker", () => {
        const game = new Game(
            { mapName: "main", seed: 5 },
            { generation: cachedMap("main", 12345), spawnLoot: false, sandbox: true },
        );
        const me = game.getPlayer(game.addPlayer("me"))!;
        game.rules.minActiveTime = 0;
        const planeTimes: Array<{ t: number; circleIdx: number }> = [];
        let seen = 0;
        let marker: { appeared: number; died: number } | null = null;
        let lastCount = 0;
        for (let i = 0; i < 300 * 100; i++) {
            game.teleportPlayer(me.id, game.gas.posNew);
            game.step();
            me.health = 100;
            if (game.planes.planes.length > lastCount)
                planeTimes.push({ t: game.tick / 100, circleIdx: game.gas.circleIdx });
            lastCount = game.planes.planes.length;
            const snap = game.getSnapshot(me.id);
            for (const ind of snap.mapIndicators ?? []) {
                expect(ind.type).toBe("ping_airdrop");
                if (!ind.dead && !marker) marker = { appeared: game.tick, died: -1 };
                if (ind.dead && marker && marker.died < 0) marker.died = game.tick;
            }
            seen += snap.planes?.length ?? 0;
        }
        // circle 1 waiting starts at 109.99 s after the start (tick 1), circle 3 at 269.99 s
        expect(planeTimes.map((p) => p.circleIdx)).toEqual([1, 3]);
        expect(planeTimes[0].t).toBeCloseTo(0.01 + 109.99 + 10, 1);
        expect(planeTimes[1].t).toBeCloseTo(0.01 + 269.99 + 2, 1);
        expect(crates(game, "airdrop_crate_").length + crates(game, "crate_1").length).toBeGreaterThanOrEqual(1);
        expect(marker).not.toBeNull();
        expect((marker!.died - marker!.appeared) / 100).toBeCloseTo(10, 1);
        expect(seen).toBeGreaterThan(0);
    }, 60_000);
});

describe("a landing crate", () => {
    function dropOn(game: Game, pos: Vec2, type = "airdrop_crate_01"): void {
        game.planes.addAirdrop(pos, type);
        const plane = game.planes.planes.at(-1)!;
        expect(plane.target).toEqual(pos);
    }

    it("falls for fallTime after the plane passed, then crushes the player under it", () => {
        const game = flatGame();
        const spot = openSpot(game);
        const victim = spawnAt(game, spot);
        const watcher = spawnAt(game, v2.add(spot, { x: 20, y: 0 }));
        game.getSnapshot(watcher.id);
        dropOn(game, spot);
        let releasedAt = -1;
        for (let i = 0; i < 3000 && releasedAt < 0; i++) {
            game.step();
            if (game.planes.airdrops.length > 0) releasedAt = game.tick;
        }
        // the plane spawned 15 s of flight away
        expect((releasedAt / 100) * GameConfig.airdrop.planeVel).toBeCloseTo(15 * GameConfig.airdrop.planeVel, -1);
        const drop = game.planes.airdrops[0];
        steps(game, FALL_TICKS / 2);
        const mid = game.getSnapshot(watcher.id).airdrops!;
        expect(mid).toEqual([{ id: drop.id, pos: spot, fallT: expect.closeTo(0.5, 2), landed: false }]);
        expect(victim.dead).toBe(false);
        steps(game, FALL_TICKS / 2);
        expect(drop.landed).toBe(true);
        expect(victim.dead).toBe(true);
        const kill = game.getSnapshot(watcher.id).kills!.find((k) => k.targetId === victim.id)!;
        expect(kill).toMatchObject({ damageType: DamageType.Airdrop, source: "airdrop", killerId: 0, killCreditId: 0 });
        const [crate] = crates(game, "airdrop_crate_01");
        expect(crate.pos).toEqual(spot);
        // the parachute object goes away 1 s after landing
        steps(game, 101);
        expect(game.planes.airdrops).toHaveLength(0);
        expect(game.getSnapshot(watcher.id).airdrops).toEqual([]);
    });

    it("crush damage is the client-visible 100 through perks, or survev's instant kill", () => {
        const game = flatGame();
        const spot = openSpot(game);
        const p = spawnAt(game, spot);
        p.perks.push("flak_jacket");
        p.helmet = "helmet03";
        dropOn(game, spot);
        untilLanded(game);
        expect(p.dead).toBe(false);
        expect(p.lastHit?.amount).toBeCloseTo(100 * 0.9, 9);
        const g2 = flatGame();
        const s2 = openSpot(g2);
        const q = spawnAt(g2, s2);
        q.perks.push("flak_jacket");
        g2.rules.airdropCrushInstantKill = true;
        g2.planes.addAirdrop(s2);
        untilLanded(g2);
        expect(q.dead).toBe(true);
    });

    it("is opened with Interact: 2.5 s later its loot crate appears, which drops loot when broken", () => {
        const game = flatGame();
        const spot = openSpot(game);
        dropOn(game, spot, "airdrop_crate_02");
        untilLanded(game);
        const [shell] = crates(game, "airdrop_crate_02");
        expect(shell.button).toEqual({ onOff: false, canUse: true, seq: 0 });
        const opener: Player = spawnAt(game, v2.add(spot, { x: 0, y: -2.5 - 1.6 }), { x: 0, y: 1 });
        const view = game.getSnapshot(opener.id).objects.find((o) => o.id === shell.id);
        expect(view).toMatchObject({ kind: "obstacle", type: "airdrop_crate_02", button: { canUse: true } });
        send(game, opener, { actions: [Input.Interact] });
        game.step();
        expect(shell.button).toEqual({ onOff: true, canUse: false, seq: 1 });
        steps(game, 248);
        expect(shell.dead).toBe(false);
        steps(game, 3);
        expect(shell.dead).toBe(true);
        const [inner] = crates(game, "crate_11");
        expect(inner.pos).toEqual(spot);
        const lootBefore = game.loot.items.size;
        game.damageObstacle(inner, { amount: 1000, damageType: DamageType.Player, sourceId: opener.id });
        expect(inner.dead).toBe(true);
        expect(game.loot.items.size).toBeGreaterThan(lootBefore + 5);
        // a second Interact on the dead shell does nothing
        send(game, opener, { actions: [Input.Interact] });
        game.step();
        expect(shell.button?.seq).toBe(1);
    });

    it("breaks destructible obstacles under it", () => {
        const game = flatGame([{ type: "barrel_01", pos: { x: 0, y: 0 } }]);
        const spot = openSpot(game);
        const barrel = [...game.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        const moved = flatGame([{ type: "crate_01", pos: spot }]);
        const crate = [...moved.world.objects.values()].find((o) => o.kind === "obstacle") as Obstacle;
        moved.planes.addAirdrop(spot);
        untilLanded(moved);
        expect(crate.dead).toBe(true);
        expect(barrel.dead).toBe(false);
    });
});
