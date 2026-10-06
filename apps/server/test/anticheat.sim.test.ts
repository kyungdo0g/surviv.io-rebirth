// Anti-cheat telemetry wired to a real simulation (M8): the sim's CombatObserver hooks feed shots, hits, damage and
// kills; observing never changes the game; rooms track humans only (fill bots are excluded).
import { v2 } from "@rebirth/core";
import { emptyInput, type Game, type Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { constantRng, flatGame, giveGun, openSpot, spawnAt } from "../../../packages/sim/test/combatHelpers.ts";
import { MatchTelemetry } from "../src/anticheat/match.ts";
import { DEFAULT_THRESHOLDS } from "../src/anticheat/thresholds.ts";
import { makeConfig } from "../src/config.ts";
import { GameRoom, type RoomMember } from "../src/room.ts";

/** A shooter with an AK-47 and a target 15 units to its right on an empty map; no spread, no headshots. */
function duel(): { game: Game; shooter: Player; target: Player } {
    const game = flatGame();
    game.combatRng = constantRng(0.5);
    const pos = openSpot(game, 30);
    const shooter = spawnAt(game, pos);
    const target = spawnAt(game, v2.add(pos, { x: 15, y: 0 }), { x: -1, y: 0 });
    giveGun(shooter, "ak47", { reserve: 90 });
    return { game, shooter, target };
}

/** Holds the trigger towards +x for `ticks` ticks (inputs go to the telemetry too when given). */
function fire(game: Game, shooter: Player, ticks: number, telemetry?: MatchTelemetry): void {
    for (let i = 0; i < ticks; i++) {
        const input = {
            ...emptyInput(i),
            toMouseDir: { x: 1, y: 0 },
            toMouseLen: 15,
            shootStart: i === 0,
            shootHold: true,
        };
        telemetry?.onInput(shooter.id, input);
        game.setInput(shooter.id, input);
        game.step();
    }
}

describe("telemetry from the simulation", () => {
    it("counts shots, bullet hits, damage and the kill of a tracked shooter", () => {
        const { game, shooter, target } = duel();
        const telemetry = new MatchTelemetry(game, {
            gameId: "g",
            mapName: "main",
            teamMode: 1,
            thresholds: DEFAULT_THRESHOLDS,
        });
        game.observer = telemetry;
        telemetry.track(shooter.id, shooter.name, "127.0.0.1");
        fire(game, shooter, 300, telemetry);
        expect(target.dead).toBe(true);
        const snap = telemetry.snapshot(shooter.id)!;
        expect(snap.shots).toBeGreaterThan(3);
        expect(snap.byClass.assault?.shots).toBe(snap.shots);
        expect(snap.bulletHits).toBeGreaterThan(0);
        expect(snap.bulletHits).toBeLessThanOrEqual(snap.bullets);
        expect(snap.byClass.assault?.damage).toBeCloseTo(100, 0);
        // the constant rng never rolls a headshot
        expect(snap.headshots).toBe(0);
        expect(snap.kills).toBe(1);
        expect(snap.killDistance.max).toBeCloseTo(15, 0);
        expect(snap.input.messages).toBe(300);
        // the target is not tracked
        expect(telemetry.snapshot(target.id)).toBeNull();
    });

    it("observing does not change the game", () => {
        const plain = duel();
        const observed = duel();
        observed.game.observer = new MatchTelemetry(observed.game, {
            gameId: "g",
            mapName: "main",
            teamMode: 1,
            thresholds: DEFAULT_THRESHOLDS,
        });
        (observed.game.observer as MatchTelemetry).track(observed.shooter.id, "s", "");
        fire(plain.game, plain.shooter, 120);
        fire(observed.game, observed.shooter, 120);
        expect(observed.target.health).toBe(plain.target.health);
        expect(observed.shooter.weaponManager.activeSlot.ammo).toBe(plain.shooter.weaponManager.activeSlot.ammo);
        expect(observed.game.bullets.active.length).toBe(plain.game.bullets.active.length);
    });
});

describe("rooms", () => {
    const member = (ip: string): RoomMember => ({ ack: 0, bufferedAmount: 0, ip, sendFrame: () => {} });

    it("track joined humans, never fill bots, and remember players for reports", () => {
        const config = makeConfig({ log: false, botFill: 6, botFillIntervalMs: 0 });
        const room = new GameRoom(config, "main", 99, 0);
        const { playerId } = room.join(member("198.51.100.9"), "human");
        for (let i = 0; i < 20; i++) room.tick();
        const bots = [...room.game.players()].filter((p) => p.id !== playerId);
        expect(bots.length).toBeGreaterThan(0);
        expect([...room.telemetry!.players.keys()]).toEqual([playerId]);
        expect(room.playerRecord(playerId)).toMatchObject({ name: "human", ip: "198.51.100.9", bot: false });
        expect(room.playerRecord(playerId)?.telemetry?.playerId).toBe(playerId);
        expect(room.playerRecord(bots[0].id)).toMatchObject({ bot: true, ip: null, telemetry: null });
        room.leave(playerId, 0);
        expect(room.playerRecord(playerId)?.name).toBe("human");
        expect(room.playerRecords().length).toBe(bots.length + 1);
        expect(room.game.observer).toBe(room.telemetry);
    });

    it("run without telemetry when the anti-cheat is off", () => {
        const room = new GameRoom(makeConfig({ log: false, antiCheat: null }), "main", 98, 0);
        const { playerId } = room.join(member("198.51.100.9"), "human");
        expect(room.telemetry).toBeNull();
        expect(room.game.observer).toBeNull();
        expect(room.playerRecord(playerId)).toMatchObject({ name: "human", telemetry: null });
    });
});
