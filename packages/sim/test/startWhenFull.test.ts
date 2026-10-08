// Start when full (rules.startWhenFull, match/match.ts checkStart): the owner's ruling of 2026-10-08 starts a game at
// its player cap at once (docs/research/rebirth-deviations.md "Start when full"); otherwise the match waits for two
// sides with a player alive minActiveTime (10 s), as survev does (survev gameModeManager.ts:47-63, 135-137).
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { defaultRules, Game, type GameInit, type Player } from "../src/index.ts";
import { steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

function mainGame(init: GameInit = {}): Game {
    return new Game({ mapName: "main", seed: 7 }, { generation: cachedMap("main", 12345), spawnLoot: false, ...init });
}

function addPlayers(game: Game, n: number): Player[] {
    return Array.from({ length: n }, (_, i) => game.getPlayer(game.addPlayer(`p${i}`)) as Player);
}

/** Kills `p` (a knocked squad player after the downed damage buffer). */
function kill(game: Game, p: Player): void {
    game.damagePlayer(p, { amount: 1000, damageType: DamageType.Gas });
    if (!p.downed) return;
    steps(game, 12);
    game.damagePlayer(p, { amount: 1000, damageType: DamageType.Gas });
}

describe("start when full (the owner's ruling; survev waits for players alive 10 s)", () => {
    it("is on by default", () => {
        expect(defaultRules().startWhenFull).toBe(true);
    });

    it("a classic game at its 80 players starts on the next tick", () => {
        const game = mainGame();
        addPlayers(game, 80);
        expect(game.canJoin()).toBe(false);
        game.step();
        expect(game.started).toBe(true);
        expect(game.match.startTick).toBe(0);
        expect(game.getSnapshot([...game.players()][0].id).gas?.mode).toBe("waiting");
    });

    it("one player short of the cap still waits for players alive minActiveTime (survev)", () => {
        const game = mainGame();
        addPlayers(game, 79);
        steps(game, 999);
        expect(game.started).toBe(false);
        steps(game, 2);
        expect(game.started).toBe(true);
    }, 60_000);

    it("the last player joining a waiting game starts it at once", () => {
        const game = mainGame();
        addPlayers(game, 60);
        steps(game, 300);
        expect(game.started).toBe(false);
        for (let i = 0; i < 20; i++) game.addPlayer(`late ${i}`);
        game.step();
        expect(game.started).toBe(true);
    }, 60_000);

    it("off: a full game waits like survev", () => {
        const game = mainGame();
        game.rules.startWhenFull = false;
        addPlayers(game, 80);
        steps(game, 999);
        expect(game.started).toBe(false);
        steps(game, 2);
        expect(game.started).toBe(true);
    }, 60_000);

    it("a full game still needs minPlayers sides alive", () => {
        const game = mainGame({ minPlayers: 81 });
        addPlayers(game, 80);
        steps(game, 5);
        expect(game.started).toBe(false);
    });

    it("a 50v50 game at its 100 starts at once and keeps the 60 s join window for late joiners", () => {
        const game = new Game(
            { mapName: "faction", seed: 7, teamMode: 4, maxPlayers: 100 },
            { generation: cachedMap("faction", 7, 4), spawnLoot: false },
        );
        const players = addPlayers(game, 100);
        expect(players.filter((p) => p.teamId === 1)).toHaveLength(50);
        game.step();
        expect(game.started).toBe(true);
        // full: nobody joins until a place frees up, then joins stay open until 60 s after the start
        expect(game.canJoin()).toBe(false);
        kill(game, players[0]);
        expect(players[0].dead).toBe(true);
        expect(game.canJoin()).toBe(true);
        while (game.match.startedSeconds < 59.98) game.step();
        expect(game.canJoin()).toBe(true);
        steps(game, 2);
        expect(game.match.startedSeconds).toBeCloseTo(60, 6);
        expect(game.canJoin()).toBe(false);
    }, 120_000);
});
