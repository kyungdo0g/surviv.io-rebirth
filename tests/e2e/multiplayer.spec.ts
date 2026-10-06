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

    // Bob walks right; Alice's copy of Bob moves right (d stays held until it shows: a page starved of frames under
    // the load of the parallel specs samples the key rarely)
    const before = await posOf(alice, bobId);
    await bob.bringToFront();
    await bob.keyboard.down("d");
    await bob.waitForTimeout(1500);
    await expect
        .poll(async () => ((await posOf(alice, bobId))?.x ?? 0) - (before?.x ?? 0), { timeout: 10_000 })
        .toBeGreaterThan(2);
    await bob.keyboard.up("d");

    await alice.screenshot({ path: "tests/e2e/__screens__/M3/alice-sees-bob.png" });
    await bob.screenshot({ path: "tests/e2e/__screens__/M3/bob-sees-alice.png" });
    // manually created contexts outlive the test: close them so two idle games do not slow the next tests down
    await alice.context().close();
    await bob.context().close();
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
    // rasterizing the map's sprites is slow on software GL while other specs run: allow more than the M3 test
    await page.waitForFunction(() => (window as any).__rebirth?.ready === true, null, { timeout: 90_000 });
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("network");
    return { page, errors };
}

test("network: kill feed, alive counter, win and death screens, game_closed and a new game", async ({ browser }) => {
    test.setTimeout(300_000);
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
        { timeout: 90_000 },
    );
    await expect(b.locator("#ui-stats")).toBeHidden();
    await expect(b.locator("#ui-waiting-text")).toBeVisible();
    expect(await b.evaluate(() => (window as any).__rebirth.disconnect ?? null)).toBeNull();
    expect(alice.errors).toEqual([]);
    expect(bob.errors).toEqual([]);
    await a.context().close();
    await b.context().close();
});

// M6 party lobby (same file so the two-browser tests never run at the same time): Alice opens the start page and
// creates a team, Bob joins it through the invite link `/?team=CODE`, Alice switches the room to duo and starts; both
// land in the same game as one group (LocalPlayerState.team lists both), and leaving the game takes Alice back to the
// lobby (gameComplete) while Bob plays on.
test("network party: create, join by link, duo start, same team, back to the lobby", async ({ browser }) => {
    test.setTimeout(240_000);
    const M6 = "tests/e2e/__screens__/M6";
    const newPage = async () => {
        const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
        return { page, errors: collectErrors(page) };
    };
    const lobby = (p: Page) => p.evaluate(() => (window as any).__rebirth.menu?.lobby ?? null);
    // contexts of earlier tests that are still open would keep rendering their games
    for (const ctx of browser.contexts()) await ctx.close();
    const alice = await newPage();
    const a = alice.page;
    await a.goto("/?menu=1&name=Alice");
    await expect(a.locator("#start-menu")).toBeVisible();
    await expect(a.locator("#player-name-input-solo")).toHaveValue("Alice");
    await a.screenshot({ path: `${M6}/main-menu.png` });
    await a.locator("#btn-create-team").click();
    await a.waitForFunction(() => !!(window as any).__rebirth.menu?.lobby?.code, null, { timeout: 45_000 });
    const code: string = (await lobby(a)).code;
    expect(code).toMatch(/^[A-Za-z1-9]{4}$/);
    await expect(a.locator("#team-code")).toHaveText(code);
    await expect(a.locator("#team-url")).toContainText(`?team=${code}`);

    const bob = await newPage();
    const b = bob.page;
    await b.goto(`/?team=${code}&name=Bob`);
    for (const p of [a, b]) {
        await p.waitForFunction(() => (window as any).__rebirth.menu?.lobby?.players.length === 2, null, {
            timeout: 45_000,
        });
        await expect(p.locator("#team-menu-member-list .name").nth(0)).toHaveText("Alice");
        await expect(p.locator("#team-menu-member-list .name").nth(1)).toHaveText("Bob");
    }
    expect((await lobby(a)).leader).toBe(true);
    expect((await lobby(b)).leader).toBe(false);
    await expect(a.locator("#team-menu-member-list .icon-leader")).toHaveCount(1);
    await expect(a.locator("#team-menu-member-list .icon-kick")).toHaveCount(1);
    await expect(b.locator("#team-menu-member-list .icon-kick")).toHaveCount(0);
    await expect(a.locator("#btn-start-team")).toBeVisible();
    await expect(b.locator("#btn-start-team")).toBeHidden();
    await expect(b.locator("#msg-wait-reason")).toHaveText("Waiting for leader to start game ...");

    // the leader picks duo: both lobbies follow
    await a.locator("#btn-team-queue-mode-1").click();
    for (const p of [a, b]) {
        await p.waitForFunction(() => (window as any).__rebirth.menu.lobby.room.gameModeIdx === 1);
        await expect(p.locator("#btn-team-queue-mode-1")).toHaveClass(/btn-hollow-selected/);
        await expect(p.locator("#team-menu-member-list .team-menu-member")).toHaveCount(2);
    }
    // the button under the cursor is darkened on hover: move away for the screenshot
    await a.mouse.move(5, 5);
    await a.screenshot({ path: `${M6}/lobby-leader.png` });
    await b.screenshot({ path: `${M6}/lobby-member.png` });

    await a.locator("#btn-start-team").click();
    for (const p of [a, b]) {
        await p.waitForFunction(
            () => {
                const r = (window as any).__rebirth;
                return r.mode === "network" && r.ready === true && r.menu.visible === false;
            },
            null,
            { timeout: 90_000 },
        );
    }
    const aliceId = await localId(a);
    const bobId = await localId(b);
    for (const p of [a, b]) {
        await p.waitForFunction(
            (ids) => {
                const team = (window as any).__rebirth.local?.team ?? [];
                return ids.every((id: number) => team.some((m: any) => m.playerId === id));
            },
            [aliceId, bobId],
            { timeout: 20_000 },
        );
        await expect(p.locator("#ui-team .ui-team-member").nth(1)).toBeVisible();
    }
    const names = await a.evaluate(() => (window as any).__rebirth.local.team.map((m: any) => m.name));
    expect(names).toEqual(expect.arrayContaining(["Alice", "Bob"]));
    await a.screenshot({ path: `${M6}/network-team.png` });

    // emotes and team pings go through the Emote message: Bob sees Alice's emote, Alice gets Bob's ping
    await a.evaluate(() => (window as any).__rebirth.transport.emote({ type: "emote_thumbsup", isPing: false }));
    await b.waitForFunction(
        (id) => (window as any).__rebirth.emotes.received.some((e: any) => e.playerId === id && !e.isPing),
        aliceId,
        { timeout: 10_000 },
    );
    const bobPos = await b.evaluate(() => (window as any).__rebirth.player.pos);
    await b.evaluate(
        (pos) => (window as any).__rebirth.transport.emote({ type: "ping_danger", isPing: true, pos }),
        bobPos,
    );
    await a.waitForFunction(
        (id) =>
            (window as any).__rebirth.emotes.received.some(
                (e: any) => e.playerId === id && e.isPing && e.type === "ping_danger",
            ),
        bobId,
        { timeout: 10_000 },
    );
    await a.waitForFunction(() => (window as any).__rebirth.emotes.mapPings === 1);

    // Alice leaves the game: back in the lobby (gameComplete), Bob still in game
    await a.evaluate(() => (window as any).__rebirth.playAgain());
    await a.waitForFunction(() => {
        const r = (window as any).__rebirth;
        const l = r.menu.lobby;
        return (
            r.menu.visible &&
            r.menu.panel === "lobby" &&
            l?.players.find((p: any) => p.playerId === l.localPlayerId)?.inGame === false
        );
    });
    await expect(a.locator("#msg-wait-reason")).toHaveText("Game in progress ...");
    expect(alice.errors).toEqual([]);
    expect(bob.errors).toEqual([]);
    // manual contexts outlive the test: close them so they do not load the next ones
    await a.context().close();
    await b.context().close();
});
