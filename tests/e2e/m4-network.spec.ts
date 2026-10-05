// M4 over the network: two browser clients join a game on the server (playwright.config.ts starts it with
// DEBUG_SPAWN_TOGETHER=1, so the second player spawns 3 units from the first). The network has no debug "give", so
// Alice kills Bob with her fists once the match started: both see the kill feed and the alive counter, Alice gets
// the win screen and Bob the death screen, the server closes the finished game with `game_closed` (expected, no
// error), and Bob's "Play New Game" joins a new game through a new WebSocket. The game uses its own map
// (main_spring) so it never shares a room with the other network spec's players.
import { type Browser, expect, type Page, test } from "@playwright/test";
import { collectErrors, killFeed, SCREENS, screenPosOf, statsRows, waitForStats } from "./m4-helpers.ts";

async function joinAs(browser: Browser, name: string): Promise<{ page: Page; errors: string[] }> {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errors = collectErrors(page);
    await page.goto(`/?net=1&map=main_spring&name=${name}`);
    await page.waitForFunction(() => (window as any).__rebirth?.ready === true, null, { timeout: 45_000 });
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("network");
    return { page, errors };
}

const localId = (p: Page) => p.evaluate(() => (window as any).__rebirth.player.id as number);

test("network: kill feed, alive counter, win and death screens, game_closed and a new game", async ({ browser }) => {
    test.setTimeout(180_000);
    const alice = await joinAs(browser, "Alice");
    const bob = await joinAs(browser, "Bob");
    const a = alice.page;
    const b = bob.page;
    const bobId = await localId(b);
    // names, alive counts and the red-zone timer come from the server
    for (const p of [a, b]) {
        await expect(p.locator("#ui-leaderboard-alive")).toHaveText("2", { timeout: 20_000 });
        await expect(p.locator("#ui-kill-leader-name")).toHaveText("Waiting for new leader");
        await expect(p.locator("#ui-map-info")).toBeVisible();
    }
    // two players alive for 10 s start the match
    await a.waitForFunction(() => (window as any).__rebirth.gas.mode !== "inactive", null, { timeout: 40_000 });
    await expect(a.locator("#ui-waiting-text")).toBeHidden();

    // Alice punches Bob (fists: 24 damage, Bob stands 3 units away)
    await a.bringToFront();
    for (let i = 0; i < 80; i++) {
        if (await b.evaluate(() => !!(window as any).__rebirth.local?.dead)) break;
        const target = await screenPosOf(a, bobId);
        if (target) await a.mouse.move(target.x, target.y);
        await a.mouse.down();
        await a.waitForTimeout(60);
        await a.mouse.up();
        await a.waitForTimeout(200);
    }
    await b.waitForFunction(() => (window as any).__rebirth.local?.dead === true, null, { timeout: 10_000 });
    for (const p of [a, b]) {
        await expect.poll(() => killFeed(p), { timeout: 10_000 }).toContain("Alice killed Bob with Fists");
    }
    await expect(a.locator("#ui-kill-text")).toHaveText("YOU killed Bob with Fists");
    await expect(a.locator("#ui-kill-count")).toHaveText("1 Kill");
    await expect(a.locator("#ui-leaderboard-alive")).toHaveText("1");

    await waitForStats(a);
    await expect(a.locator(".ui-stats-header-title")).toHaveText("Winner winner chicken dinner!");
    await expect(a.locator(".ui-stats-header-overview")).toHaveText("Solo Rank #1");
    await expect(a.locator(".ui-stats-info-player-name")).toHaveText("Alice");
    expect((await statsRows(a))[0]).toEqual(["Kills", "1"]);
    await a.screenshot({ path: `${SCREENS}/network-win.png` });

    await waitForStats(b);
    await expect(b.locator(".ui-stats-header-title")).toHaveText("You died.");
    await expect(b.locator(".ui-stats-header-overview")).toHaveText("Solo Rank #2");
    expect((await statsRows(b))[2]).toEqual(["Damage Taken", "100"]);
    // the game is over: nobody to spectate
    await expect(b.locator(".ui-stats-spectate")).toHaveCount(0);
    await b.screenshot({ path: `${SCREENS}/network-death.png` });

    // the server closes the finished game 1.8 s after the win: a normal end, not an error
    for (const p of [a, b]) {
        await p.waitForFunction(() => !!(window as any).__rebirth.disconnect, null, { timeout: 20_000 });
        expect(await p.evaluate(() => (window as any).__rebirth.disconnect)).toMatchObject({
            reason: "game_closed",
            normal: true,
        });
        await expect(p.locator("#ui-stats")).toBeVisible();
    }

    // Play New Game: a new WebSocket game
    await b.bringToFront();
    await b.locator(".ui-stats-restart").click();
    await b.waitForFunction(
        (old) => {
            const r = (window as any).__rebirth;
            return r.mode === "network" && r.ready && r.player.id !== old && !r.match.gameOver.visible;
        },
        bobId,
        { timeout: 45_000 },
    );
    await expect(b.locator("#ui-stats")).toBeHidden();
    await expect(b.locator("#ui-waiting-text")).toBeVisible();
    expect(await b.evaluate(() => (window as any).__rebirth.disconnect ?? null)).toBeNull();
    expect(alice.errors).toEqual([]);
    expect(bob.errors).toEqual([]);
});
