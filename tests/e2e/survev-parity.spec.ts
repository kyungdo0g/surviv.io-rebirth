// survev parity wave (docs/handoff/survev-content.md item 2): a 50v50 enemy revealed by firing (survev
// timeUntilHidden) shows as a dot on the minimap in its faction's colour, then fades out 2-2.5 s after it is no longer
// listed. The rebirth turns the reveal off by default (the owner, 2026-10-08: in the original, enemies show only on
// screen; docs/research/rebirth-deviations.md), so the spec first checks that a shot in sight reveals nothing, then
// turns the sandbox game's rules.roles.factionRevealTime to survev's 1 s and checks the dot.
// The 50v50 game over (survev gameModeManager.ts getGameoverPlayers, ui.ts:1493-1522; the owner's screenshot of the
// original): four cards, the own, the Red and Blue Commanders' under a red and a blue star, the MVP's under a ribbon in
// its faction's colour.
// Hooks: window.__rebirth (game, faction, match). Screenshots: __screens__/survev-parity.
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, waitForStats } from "./m4-helpers.ts";
import { bootMode, localId, promote } from "./m7-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-parity";

const minimapDots = (page: Page) => page.evaluate(() => (window as any).__rebirth.faction.minimapDots as number);

/** The enemy fires within our view radius (the simulation's shot hook); returns the rule and its reveal timer. */
function enemyFires(page: Page, enemy: number) {
    return page.evaluate((id) => {
        const g = (window as any).__rebirth.game;
        g.faction.onShot(g.getPlayer(id));
        return { revealTime: g.rules.roles.factionRevealTime, timeUntilHidden: g.getPlayer(id).timeUntilHidden };
    }, enemy);
}

test.describe("50v50 shooter reveal", () => {
    test("off by default; with the rule on, a revealed enemy shows on the minimap, then fades out", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=faction&team=4&dummies=3&loot=0");
        const me = await localId(page);
        const enemy = await page.evaluate((me) => {
            const g = (window as any).__rebirth.game;
            const local = g.getPlayer(me);
            const foe = [...g.players()].find((p: any) => p.teamId !== local.teamId);
            // well within our view radius
            if (foe) g.teleportPlayer(foe.id, { x: local.pos.x + 6, y: local.pos.y });
            return foe?.id as number | undefined;
        }, me);
        expect(enemy).toBeTruthy();
        const dotsBefore = await minimapDots(page);

        // the rebirth default: the shot reveals nothing, through several faction status refreshes (0.5 s)
        expect(await enemyFires(page, enemy!)).toEqual({ revealTime: 0, timeUntilHidden: 0 });
        await page.waitForTimeout(1_500);
        expect(await minimapDots(page)).toBe(dotsBefore);

        // survev's reveal through the rule: the enemy shows for 1 s
        await page.evaluate(() => {
            (window as any).__rebirth.game.rules.roles.factionRevealTime = 1;
        });
        expect(await enemyFires(page, enemy!)).toEqual({ revealTime: 1, timeUntilHidden: 1 });
        await expect.poll(() => minimapDots(page), { timeout: 5_000 }).toBe(dotsBefore + 1);
        await page.screenshot({ path: `${SCREENS}/revealed.png` });
        // no longer listed after the next refresh, the dot stays 2 s and is gone by 2.5 s
        await expect.poll(() => minimapDots(page), { timeout: 8_000 }).toBe(dotsBefore);
        expect(errors).toEqual([]);
    });
});

test.describe("50v50 game over", () => {
    test("four cards: own, Red and Blue Commanders under their stars, the MVP under its faction's ribbon", async ({
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        // a real loopback match: me and dummy 2 Red, dummies 1 and 3 Blue (joiners take the smaller faction)
        await bootMode(page, "/?sandbox=0&map=faction&team=4&dummies=3&loot=0");
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode !== "inactive", null, { timeout: 60_000 });
        const me = await localId(page);
        const ids = await page.evaluate((me) => {
            const g = (window as any).__rebirth.game;
            const team = g.getPlayer(me).teamId;
            const dummies: number[] = (window as any).__rebirth.dummies;
            return { team, blue: dummies.filter((id) => g.getPlayer(id).teamId !== team) };
        }, me);
        expect(ids.blue).toHaveLength(2);
        await promote(page, me, "leader");
        await promote(page, ids.blue[0], "leader");
        await page.evaluate(
            ({ me, blue }) => {
                const g = (window as any).__rebirth.game;
                // the MVP: a Blue player with the most kills
                g.getPlayer(blue[1]).kills = 5;
                for (const id of blue) {
                    g.damagePlayer(g.getPlayer(id), {
                        amount: 1000,
                        damageType: 0,
                        gameSourceType: "ak47",
                        sourceId: me,
                    });
                }
            },
            { me, blue: ids.blue },
        );
        await waitForStats(page);
        const cards = await page.evaluate(() =>
            [...document.querySelectorAll("#ui-stats-info-box .ui-stats-info-player")].map(
                (c) => c.querySelector(".ui-stats-info-player-badge")?.className ?? "",
            ),
        );
        expect(cards).toEqual([
            "",
            "ui-stats-info-player-badge ui-stats-info-player-red-leader",
            "ui-stats-info-player-badge ui-stats-info-player-blue-leader",
            "ui-stats-info-player-badge ui-stats-info-player-blue-ribbon",
        ]);
        // the original GUI images load
        const images = await page.evaluate(() =>
            Promise.all(
                [...document.querySelectorAll<HTMLElement>(".ui-stats-info-player-badge")].map(async (b) => {
                    const url = /url\("?([^")]+)"?\)/.exec(getComputedStyle(b).backgroundImage)?.[1] ?? "";
                    const res = await fetch(url);
                    return `${url.replace(/^.*\/img\//, "img/")} ${res.ok} ${res.headers.get("content-type")}`;
                }),
            ),
        );
        expect(images).toEqual([
            "img/gui/star-red.svg true image/svg+xml",
            "img/gui/star-blue.svg true image/svg+xml",
            "img/gui/ribbon-blue.svg true image/svg+xml",
        ]);
        await page.screenshot({ path: `${SCREENS}/game-over.png` });
        expect(errors).toEqual([]);
    });
});
