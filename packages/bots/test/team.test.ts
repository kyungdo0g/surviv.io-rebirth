// Gas and team behaviours: bots spread outside the next safe circle walk into it before the zone closes (fast gas
// stages), and a duo bot revives its downed teammate.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { gasCircle } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { BotController } from "../src/controller.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { FAST_GAS, flatGame, mainGame, openSpot, placeBot, runUntil } from "./helpers.ts";

describe("gas", () => {
    it("bots outside the next safe zone move into it when the gas starts", () => {
        // one squad (so the bots do not fight each other), the match starts with a single group
        const game = mainGame({ gasStages: FAST_GAS, minPlayers: 1 }, 4);
        game.rules.minActiveTime = 0;
        const party = { group: "zone", autoFill: false, partySize: 4 };
        // the first safe circle is centred in the south-west (not clamped: 75% of its radius stays on the map); the
        // north-east corner is outside it
        const center: Vec2 = { x: 300, y: 300 };
        game.gas.chooseCenter = () => center;
        const grid = NavGrid.forMap(game.mapData);
        const rad = FAST_GAS[1].rad * game.gas.mapSize;
        const bots: BotController[] = [];
        const placed: Vec2[] = [];
        for (let deg = 0; deg <= 90 && bots.length < 4; deg += 6) {
            const a = (deg * Math.PI) / 180;
            const want = v2.add(center, { x: Math.cos(a) * (rad + 40), y: Math.sin(a) * (rad + 40) });
            const cell = grid.nearestWalkable(want, 6);
            if (cell < 0) continue;
            const pos = grid.center(cell);
            const d = v2.distance(pos, center);
            if (grid.isWaterAt(pos) || d < rad + 20 || d > rad + 70) continue;
            if (placed.some((q) => v2.distance(q, pos) < 35)) continue;
            placed.push(pos);
            bots.push(placeBot(game, pos, { seed: 20 + bots.length, name: `zone${bots.length}`, addOptions: party }));
        }
        expect(bots.length).toBe(4);
        // first circle: waiting then moving; stop once the zone finished closing to its new radius
        const ticks = runUntil(game, bots, () => game.gas.circleIdx >= 1, 4000);
        expect(ticks).toBeGreaterThan(0);
        const circle = gasCircle(game.gas.view());
        expect(circle.rad).toBeCloseTo(rad, 0);
        expect(circle.pos).toEqual(center);
        for (const b of bots) {
            const p = game.getPlayer(b.playerId)!;
            expect(p.dead).toBe(false);
            expect(v2.distance(p.pos, center)).toBeLessThan(rad);
        }
    });
});

describe("teams", () => {
    it("a duo bot revives its downed teammate", () => {
        const game = flatGame({ sandbox: true }, 2);
        const spot = openSpot(game);
        const party = { group: "a", autoFill: false, partySize: 2 };
        const a = placeBot(game, spot, { seed: 30, addOptions: party, name: "a" });
        const m = placeBot(game, v2.add(spot, { x: 9, y: 4 }), { seed: 31, addOptions: party, name: "m" });
        // another group far away keeps the match going
        placeBot(game, v2.add(spot, { x: 0, y: -300 }), { seed: 32, addOptions: { group: "b", autoFill: false } });
        const mate = game.getPlayer(m.playerId)!;
        const reviver = game.getPlayer(a.playerId)!;
        expect(mate.groupId).toBe(reviver.groupId);
        runUntil(game, [a, m], () => false, 30);
        game.damagePlayer(mate, { amount: 150, damageType: DamageType.Gas, dir: { x: 1, y: 0 } });
        expect(mate.downed).toBe(true);
        let sawRevive = false;
        const ticks = runUntil(
            game,
            [a, m],
            () => {
                if (reviver.action.type === "revive") sawRevive = true;
                return !mate.downed;
            },
            2000,
        );
        expect(ticks).toBeGreaterThan(0);
        expect(sawRevive).toBe(true);
        expect(mate.dead).toBe(false);
        expect(mate.health).toBeGreaterThan(0);
    });

    it("duo bots stay together while exploring", () => {
        const game = mainGame({}, 2);
        const grid = NavGrid.forMap(game.mapData);
        const start = grid.center(grid.nearestWalkable({ x: 360, y: 300 }, 30));
        const party = { group: "p", autoFill: false, partySize: 2 };
        const a = placeBot(game, start, { seed: 40, addOptions: party });
        const b = placeBot(game, v2.add(start, { x: 3, y: 0 }), { seed: 41, addOptions: party });
        const pa = game.getPlayer(a.playerId)!;
        const pb = game.getPlayer(b.playerId)!;
        let maxApart = 0;
        runUntil(
            game,
            [a, b],
            () => {
                if (game.tick > 300) maxApart = Math.max(maxApart, v2.distance(pa.pos, pb.pos));
                return false;
            },
            3000,
        );
        expect(maxApart).toBeLessThan(60);
    });
});
