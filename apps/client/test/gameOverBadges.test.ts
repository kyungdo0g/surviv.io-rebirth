// 50v50 game-over badges (survev ui.ts:1493-1522, game.css .ui-stats-info-player-badge; the owner's screenshot of the
// original, docs/research/rebirth-deviations.md "50v50 game-over cards"): the Commanders' stars above the 2nd and 3rd
// cards, the MVP's ribbon in its faction's colour above the 4th, drawn with the original GUI images, and only once the
// game is over.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FactionTeam } from "@rebirth/defs";
import type { GameOverEvent } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { cardBadgeClass, factionBadgeClass } from "../src/ui/gameOver.ts";

const ASSETS = join(import.meta.dirname, "../public/assets");
const CSS = readFileSync(join(import.meta.dirname, "../src/ui/gameOver.css"), "utf8");

const BADGES = [
    ["ui-stats-info-player-red-leader", "star-red.svg"],
    ["ui-stats-info-player-blue-leader", "star-blue.svg"],
    ["ui-stats-info-player-red-ribbon", "ribbon-red.svg"],
    ["ui-stats-info-player-blue-ribbon", "ribbon-blue.svg"],
] as const;

/** A 50v50 result: the viewer (Blue 10), the Red (20) and Blue (30) Commanders and the MVP (Red 40). */
function result(gameOver: boolean): GameOverEvent {
    const card = (playerId: number) => ({
        playerId,
        timeAlive: 600,
        kills: 2,
        dead: true,
        damageDealt: 300,
        damageTaken: 100,
    });
    return {
        teamId: 2,
        teamRank: 2,
        gameOver,
        winningTeamId: gameOver ? 1 : 0,
        playerStats: [10, 20, 30, 40].map(card),
    };
}
const TEAMS = new Map([
    [10, FactionTeam.Blue],
    [20, FactionTeam.Red],
    [30, FactionTeam.Blue],
    [40, FactionTeam.Red],
]);
const teamOf = (id: number) => TEAMS.get(id) ?? 0;
const badges = (info: Parameters<typeof cardBadgeClass>[0]) =>
    info.event.playerStats.map((s, i) => cardBadgeClass(info, i, s.playerId));

describe("50v50 game-over badges", () => {
    it("none on the own card, a red star, a blue star, the MVP's ribbon in its faction's colour", () => {
        expect([0, 1, 2].map((i) => factionBadgeClass(i, FactionTeam.Blue))).toEqual([
            "",
            "ui-stats-info-player-red-leader",
            "ui-stats-info-player-blue-leader",
        ]);
        expect(factionBadgeClass(3, FactionTeam.Red)).toBe("ui-stats-info-player-red-ribbon");
        expect(factionBadgeClass(3, FactionTeam.Blue)).toBe("ui-stats-info-player-blue-ribbon");
        expect(factionBadgeClass(4, FactionTeam.Red)).toBe("");
    });

    it("on the four cards of a 50v50 game over, the MVP's ribbon from the player infos", () => {
        expect(badges({ event: result(true), factionMode: true, teamOf })).toEqual([
            "",
            "ui-stats-info-player-red-leader",
            "ui-stats-info-player-blue-leader",
            "ui-stats-info-player-red-ribbon",
        ]);
        TEAMS.set(40, FactionTeam.Blue);
        expect(badges({ event: result(true), factionMode: true, teamOf })[3]).toBe("ui-stats-info-player-blue-ribbon");
        TEAMS.set(40, FactionTeam.Red);
    });

    it("never on a result sent while the factions play on, nor off faction maps", () => {
        expect(badges({ event: result(false), factionMode: true, teamOf })).toEqual(["", "", "", ""]);
        expect(badges({ event: result(true), factionMode: false, teamOf })).toEqual(["", "", "", ""]);
        expect(badges({ event: result(true), teamOf })).toEqual(["", "", "", ""]);
    });

    it("each badge class draws its original GUI image (survev game.css)", () => {
        const installed = existsSync(join(ASSETS, "img/gui"));
        for (const [cls, img] of BADGES) {
            const rule = new RegExp(`\\.${cls}\\s*\\{[^}]*url\\(/assets/(img/gui/${img.replace(".", "\\.")})\\)`).exec(
                CSS,
            );
            expect(rule, cls).not.toBeNull();
            if (installed) expect(existsSync(join(ASSETS, rule![1])), img).toBe(true);
        }
        expect(CSS).toMatch(/\.ui-stats-info-player-badge\s*\{[^}]*position: absolute;[^}]*top: -40px;/);
    });
});
