import { type Browser, expect, type Page, test } from "@playwright/test";
import { collectErrors, killFeed, SCREENS, screenPosOf, statsRows, waitForStats } from "./m4-helpers.ts";

// Two browser clients join the same game on the server (apps/server, started by playwright.config.ts with
// DEBUG_SPAWN_TOGETHER=1 so the second player spawns next to the first) over WebSocket.

async function joinAs(browser: Browser, name: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`/?net=1&name=${name}`);
    await page.waitForFunction(() => (window as any).__rebirth?.ready === true, null, { timeout: 45_000 });
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("network");
    return page;
}

const localId = (p: Page) => p.evaluate(() => (window as any).__rebirth.player.id as number);
const sees = (p: Page, id: number) =>
    p.evaluate((id) => {
        const s = (window as any).__rebirth.lastSnapshot;
        return !!s?.objects.some((o: any) => o.kind === "player" && o.id === id);
    }, id);
const posOf = (p: Page, id: number) =>
    p.evaluate((id) => {
        const s = (window as any).__rebirth.lastSnapshot;
        return s?.objects.find((o: any) => o.id === id)?.pos as { x: number; y: number } | undefined;
    }, id);

test("two network clients share a game, see each other and see each other move", async ({ browser }) => {
    test.setTimeout(150_000);
    const alice = await joinAs(browser, "Alice");
    const bob = await joinAs(browser, "Bob");
    const aliceId = await localId(alice);
    const bobId = await localId(bob);
    expect(aliceId).not.toBe(bobId);

    await expect.poll(() => sees(alice, bobId), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => sees(bob, aliceId), { timeout: 20_000 }).toBe(true);

    // Bob walks right; Alice's copy of Bob moves right
    const before = await posOf(alice, bobId);
    await bob.bringToFront();
    await bob.keyboard.down("d");
    await bob.waitForTimeout(1500);
    await bob.keyboard.up("d");
    await expect
        .poll(async () => ((await posOf(alice, bobId))?.x ?? 0) - (before?.x ?? 0), { timeout: 10_000 })
        .toBeGreaterThan(2);

    await alice.screenshot({ path: "tests/e2e/__screens__/M3/alice-sees-bob.png" });
    await bob.screenshot({ path: "tests/e2e/__screens__/M3/bob-sees-alice.png" });
});

// M4 over the network (same file so the two-browser tests never run at the same time): the network has no debug
// "give", so Alice kills Bob with her fists once the match started; both see the kill feed and the alive counter,
// Alice gets the win screen and Bob the death screen, the server closes the finished game with `game_closed`
// (expected, no error), and Bob's "Play New Game" joins a new game through a new WebSocket. It plays on its own map
// (main_spring) so it never shares a room with the M3 test's players.

async function joinM4(browser: Browser, name: string): Promise<{ page: Page; errors: string[] }> {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errors = collectErrors(page);
    await page.goto(`/?net=1&map=main_spring&name=${name}`);
    await page.waitForFunction(() => (window as any).__rebirth?.ready === true, null, { timeout: 45_000 });
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("network");
    return { page, errors };
}

test("network: kill feed, alive counter, win and death screens, game_closed and a new game", async ({ browser }) => {
    test.setTimeout(180_000);
    const alice = await joinM4(browser, "Alice");
    const bob = await joinM4(browser, "Bob");
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
