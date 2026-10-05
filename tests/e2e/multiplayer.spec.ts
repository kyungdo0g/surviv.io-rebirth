import { type Browser, expect, type Page, test } from "@playwright/test";

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
