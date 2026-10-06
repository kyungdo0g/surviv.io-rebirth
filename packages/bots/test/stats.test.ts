// Match statistics: the finish order from death ticks (players and teams, ties), the combat observer in a scripted
// fight (shots, bullets, hits, damage, the kill, forwarding to the host's observer) and the per-bot records of a short
// match with assigned brains and custom difficulty parameters.
import { v2 } from "@rebirth/core";
import type { CombatObserver } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS } from "../src/difficulty.ts";
import { runMatch } from "../src/runner.ts";
import { finishOrder, MatchStats } from "../src/stats.ts";
import { flatGame, giveGun, openSpot, placeBot, placePlayer, QUICK_GAS, runUntil } from "./helpers.ts";

describe("match stats", () => {
    it("finish order: later deaths place better, the living share first, teams finish with their last member", () => {
        const f = finishOrder([
            { id: 1, teamId: 1, deathTick: 100 },
            { id: 2, teamId: 1, deathTick: 300 },
            { id: 3, teamId: 2, deathTick: 200 },
            { id: 4, teamId: 2, deathTick: 200 },
            { id: 5, teamId: 3, deathTick: -1 },
        ]);
        expect([1, 2, 3, 4, 5].map((id) => f.get(id)?.placement)).toEqual([5, 2, 3, 3, 1]);
        // team 3 alive, team 1 lasted until 300, team 2 until 200
        expect([1, 2, 3, 4, 5].map((id) => f.get(id)?.teamPlacement)).toEqual([2, 2, 3, 3, 1]);
    });

    it("counts shots, hits, damage and the kill of a scripted fight and forwards to the host's observer", () => {
        const game = flatGame({ sandbox: true });
        const forwarded = { shots: 0, hits: 0, damage: 0, kills: 0 };
        const host: CombatObserver = {
            onShotFired: () => forwarded.shots++,
            onBulletHitPlayer: () => forwarded.hits++,
            onPlayerDamaged: (_t, _p, amount) => (forwarded.damage += amount),
            onPlayerKilled: () => forwarded.kills++,
        };
        const stats = new MatchStats(game, host);
        game.observer = stats;
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 5 });
        const p = game.getPlayer(bot.playerId)!;
        giveGun(p, "ak47", 90);
        const dummy = placePlayer(game, "dummy", v2.add(spot, { x: 14, y: 3 }));
        expect(runUntil(game, [bot], () => dummy.dead, 2000)).toBeGreaterThan(0);
        const s = stats.of(p.id);
        const d = stats.of(dummy.id);
        expect(s.shots).toBeGreaterThan(0);
        expect(s.bullets).toBe(s.shots);
        expect(s.bulletHits).toBeGreaterThan(0);
        expect(s.bulletHits).toBeLessThanOrEqual(s.bullets);
        // damage is clamped to the remaining health: a full-health dummy takes exactly 100
        expect(s.damageDealt).toBeCloseTo(100, 6);
        expect(d.damageTaken).toBeCloseTo(100, 6);
        expect(s.kills).toBe(1);
        expect(d.killerId).toBe(p.id);
        expect(d.deathTick).toBeGreaterThan(0);
        expect(s.deathTick).toBe(-1);
        expect(forwarded).toEqual({ shots: s.shots, hits: s.bulletHits, damage: s.damageDealt, kills: 1 });
    });

    it("runMatch records brains, combat stats and placements per bot", () => {
        const custom = { ...DIFFICULTY_PRESETS.hard, aimErrorDeg: 2.2 };
        let observed = 0;
        const report = runMatch({
            bots: 12,
            seed: 3,
            gasStages: QUICK_GAS,
            maxTicks: 20000,
            assign: (i) => ({ brain: i % 2 === 0 ? "smart" : "baseline", difficulty: i < 6 ? custom : "normal" }),
            observer: { onShotFired: () => observed++ },
        });
        expect(report.exceptions).toBe(0);
        expect(report.over).toBe(true);
        const ps = report.players;
        expect(ps.map((p) => p.brain)).toEqual(ps.map((_, i) => (i % 2 === 0 ? "smart" : "baseline")));
        expect(ps.map((p) => p.difficulty)).toEqual(ps.map((_, i) => (i < 6 ? "hard" : "normal")));
        expect(ps.reduce((a, p) => a + p.shots, 0)).toBe(observed);
        // one winner in solo; the others all placed 2..12 and the order follows survival
        expect(ps.filter((p) => p.placement === 1).map((p) => p.id)).toEqual(report.winners);
        expect(Math.max(...ps.map((p) => p.placement))).toBeLessThanOrEqual(12);
        for (const p of ps) {
            expect(p.bulletHits).toBeLessThanOrEqual(p.bullets);
            expect(p.shots).toBeLessThanOrEqual(p.bullets);
            if (p.killerId && p.killerId !== p.id)
                expect(p.killerBrain).toBe(ps.find((q) => q.id === p.killerId)?.brain);
        }
        // enemy damage is counted on both sides
        const dealt = ps.reduce((a, p) => a + p.damageDealt, 0);
        const taken = ps.reduce((a, p) => a + p.damageTaken, 0);
        expect(dealt).toBeCloseTo(taken, 6);
        expect(dealt).toBeGreaterThan(0);
        const kills = ps.reduce((a, p) => a + p.kills, 0);
        expect(ps.filter((p) => p.killerBrain !== null).length).toBe(kills);
    }, 60_000);
});
