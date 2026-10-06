import { type Browser, expect, type Page, test } from "@playwright/test";
import { collectErrors, screenPosOf, waitForStats } from "./m4-helpers.ts";
import { bootLoopback, openMenu, SCREENS, TouchDriver } from "./m8-helpers.ts";

// M8 client polish: routing (`/` opens the menu), the settings store with the main page's settings modal and the
// in-game (Esc) menu, keybind rebinding and share codes, the region select and a banned find_game, touch controls in
// mobile emulation (move stick -> touchMoveActive input, aim stick fires, slot taps) and a player report in a network
// game (the e2e server runs with DEBUG_SPAWN_TOGETHER=1, so two players meet).

const INPUT_RELOAD = 5;

const cfg = (page: Page, key: string) => page.evaluate((k) => (window as any).__rebirth.config.get(k), key);

test.describe("routing and menu", () => {
    test("/ opens the start menu and the menu music starts with the first gesture", async ({ page }) => {
        const errors = collectErrors(page);
        await openMenu(page, "/");
        await expect(page.locator("#start-menu")).toBeVisible();
        expect(await page.evaluate(() => (window as any).__rebirth.mode ?? null)).toBeNull();
        expect(await page.evaluate(() => (window as any).__rebirth.menu.visible)).toBe(true);
        // one region (the e2e server's own): no region select
        await expect(page.locator("#server-select-main")).toBeHidden();
        await page.locator("#start-bottom-left").click();
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.menu.musicPlaying)).toBe(true);
        expect(errors).toEqual([]);
    });

    test("region select from site_info; Play goes to the region's server; banned find_game", async ({ page }) => {
        const errors = collectErrors(page);
        await page.route("**/api/site_info", (route) =>
            route.fulfill({
                json: {
                    modes: [],
                    pops: { na: { playerCount: 3, l10n: "en" }, kr: { playerCount: 5, l10n: "ko" } },
                    regions: { na: "", kr: "http://127.0.0.1:9" },
                    youtube: { name: "", link: "" },
                    twitch: [],
                    country: "US",
                    gitRevision: "test",
                    captchaEnabled: false,
                    clientTheme: "main",
                },
            }),
        );
        let findGameAt = "";
        await page.route("http://127.0.0.1:9/api/find_game", (route) => {
            findGameAt = route.request().url();
            return route.fulfill({ status: 403, json: { error: "banned" } });
        });
        await openMenu(page, "/?menu=1&name=Region");
        const select = page.locator("#server-select-main");
        await expect(select).toBeVisible();
        await expect(select.locator("option")).toHaveText(["North America [3 players]", "South Korea [5 players]"]);
        await select.selectOption("kr");
        expect(await cfg(page, "region")).toBe("kr");
        await page.screenshot({ path: `${SCREENS}/region-select.png` });
        await page.locator("#btn-start-mode-0").click();
        await page.waitForFunction(
            () => (window as any).__rebirth.menu.visible && !(window as any).__rebirth.menu.inGame,
        );
        await expect(page.locator("#server-warning")).toHaveText("You have been banned from this server.");
        expect(findGameAt).toBe("http://127.0.0.1:9/api/find_game");
        // the choice survives a reload
        await page.reload();
        await page.waitForFunction(() => !!(window as any).__rebirth?.menu);
        await expect(page.locator("#server-select-main")).toHaveValue("kr");
        expect(errors.filter((e) => !/403|Failed to load resource/.test(e))).toEqual([]);
    });
});

test.describe("settings", () => {
    test("main menu settings modal: music volume and screen shake persist", async ({ page }) => {
        const errors = collectErrors(page);
        await openMenu(page, "/?menu=1");
        await page.locator("#btn-start-settings").click();
        const modal = page.locator("#modal-settings");
        await expect(modal).toBeVisible();
        await modal.locator(".sl-music-volume").fill("40");
        await modal.locator("#screenShake").uncheck();
        await modal.locator(".language-select").selectOption("ko");
        await expect(modal.locator("h2")).toHaveText("설정");
        await page.screenshot({ path: `${SCREENS}/settings-modal-ko.png` });
        await modal.locator(".language-select").selectOption("en");
        await page.keyboard.press("Escape");
        await expect(modal).toBeHidden();
        await page.reload();
        await page.waitForFunction(() => !!(window as any).__rebirth?.menu);
        expect(await cfg(page, "musicVolume")).toBeCloseTo(0.4);
        expect(await cfg(page, "screenShake")).toBe(false);
        await page.locator("#btn-start-settings").click();
        await expect(modal.locator(".sl-music-volume")).toHaveValue("40");
        await expect(modal.locator("#screenShake")).not.toBeChecked();
        await modal.locator(".close-corner").click();
        await expect(modal).toBeHidden();

        // the in-game menu shows and applies the same settings
        await bootLoopback(page, "/?sandbox=1&map=main&seed=1&loot=0");
        expect(await page.evaluate(() => (window as any).__rebirth.cameraShake.enabled)).toBe(false);
        expect((await page.evaluate(() => (window as any).__rebirth.audioVolumes())).music).toBeCloseTo(0.4);
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeVisible();
        expect(await page.evaluate(() => (window as any).__rebirth.gameMenu.open)).toBe(true);
        await expect(page.locator("#ui-game-menu .sl-music-volume")).toHaveValue("40");
        await page.locator("#ui-game-menu .sl-master-volume").fill("70");
        expect((await page.evaluate(() => (window as any).__rebirth.audioVolumes())).master).toBeCloseTo(0.7);
        await page.locator("#btn-game-sound").click();
        expect(await page.evaluate(() => (window as any).__rebirth.audio.muted)).toBe(true);
        await page.screenshot({ path: `${SCREENS}/game-menu.png` });
        await page.locator("#btn-game-resume").click();
        await expect(page.locator("#ui-game-menu")).toBeHidden();
        // Escape closes the big map first, then toggles the menu
        await page.keyboard.press("m");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.bigMap.open)).toBe(true);
        await page.keyboard.press("Escape");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.bigMap.open)).toBe(false);
        expect(await page.evaluate(() => (window as any).__rebirth.gameMenu.open)).toBe(false);
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeHidden();
        expect(errors).toEqual([]);
    });
});

test.describe("keybinds", () => {
    test("rebinding Reload to K: K reloads and R does not; share code round trip", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootLoopback(page, "/?sandbox=1&map=main&seed=1&give=ak47&loot=0");
        const ammo = () => page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo as number);
        const reloading = () => page.evaluate(() => (window as any).__rebirth.local.action?.type === "reload");
        await page.mouse.move(900, 360);
        await page.mouse.down();
        await expect.poll(ammo, { timeout: 10_000 }).toBeLessThan(25);
        await page.mouse.up();

        await page.keyboard.press("Escape");
        await page.locator("#btn-game-keybinds").click();
        const tab = page.locator("#ui-game-tab-keybinds");
        await expect(tab).toBeVisible();
        const row = tab.locator(`.ui-keybind-container[data-action="${INPUT_RELOAD}"]`);
        await expect(row.locator(".btn-keybind-display")).toHaveText("R");
        await row.locator(".btn-keybind-desc").click();
        await expect(row.locator(".btn-keybind-desc")).toHaveClass(/btn-keybind-desc-selected/);
        // refused keys keep the row waiting
        await page.keyboard.press("Control");
        await expect(row.locator(".btn-keybind-desc")).toHaveClass(/btn-keybind-desc-selected/);
        await page.keyboard.press("k");
        await expect(row.locator(".btn-keybind-display")).toHaveText("K");
        expect(await cfg(page, "binds")).not.toBe("");
        // binding a key another action uses unbinds that action (E: Stow Weapons)
        const stow = tab.locator('.ui-keybind-container[data-action="27"]');
        await expect(stow.locator(".btn-keybind-display")).toHaveText("E");
        await page.screenshot({ path: `${SCREENS}/keybinds-tab.png` });
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeHidden();

        await page.keyboard.press("r");
        await page.waitForTimeout(600);
        expect(await reloading()).toBe(false);
        await page.keyboard.press("k");
        await expect.poll(reloading, { timeout: 5_000 }).toBe(true);

        // share code: copy, restore defaults, load it back; a bad code is refused
        await page.keyboard.press("Escape");
        await page.locator("#btn-game-keybinds").click();
        const code: string = await page.evaluate(() => (window as any).__rebirth.binds.code);
        await tab.locator(".js-btn-keybind-share").click();
        await expect(tab.locator(".js-keybind-link")).toHaveText(code);
        await tab.locator(".js-btn-keybind-restore").click();
        await expect(row.locator(".btn-keybind-display")).toHaveText("R");
        const bad = `${code.slice(0, 10)}${code[10] === "A" ? "B" : "A"}${code.slice(11)}`;
        await tab.locator(".js-keybind-code-input").fill(bad);
        await tab.locator(".js-btn-keybind-code-load").click();
        await expect(tab.locator(".js-keybind-warning")).toBeVisible();
        await expect(row.locator(".btn-keybind-display")).toHaveText("R");
        await tab.locator(".js-keybind-code-input").fill(code);
        await tab.locator(".js-btn-keybind-code-load").click();
        await expect(tab.locator(".js-keybind-warning")).toBeHidden();
        await expect(row.locator(".btn-keybind-display")).toHaveText("K");
        await page.keyboard.press("Escape");

        // the main page's keybind modal shows the stored binds
        await openMenu(page, "/?menu=1");
        await page.locator("#btn-start-keybind").click();
        const modal = page.locator("#ui-modal-keybind");
        await expect(modal).toBeVisible();
        await expect(
            modal.locator(`.ui-keybind-container[data-action="${INPUT_RELOAD}"] .btn-keybind-display`),
        ).toHaveText("K");
        await page.screenshot({ path: `${SCREENS}/keybind-modal.png` });
        expect(errors).toEqual([]);
    });
});

test.describe("touch controls", () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test("move stick input, aim stick fires, slot taps switch weapons", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootLoopback(page, "/?sandbox=1&touch=1&map=main&seed=1&give=ak47&loot=0");
        expect(await page.evaluate(() => (window as any).__rebirth.touch.enabled)).toBe(true);
        expect(await page.evaluate(() => (window as any).__rebirth.touch.range)).toBe(48);
        const touch = await TouchDriver.create(page);
        const start = await page.evaluate(() => (window as any).__rebirth.player.pos as { x: number; y: number });

        // left half: the move stick (anywhere: centred where the finger went down), dragged to the right
        await touch.start(1, 250, 150);
        await touch.move(1, 300, 150);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.lastInput), { timeout: 5_000 })
            .toMatchObject({ touchMoveActive: true });
        const input = await page.evaluate(() => (window as any).__rebirth.lastInput);
        expect(input.touchMoveLen).toBeGreaterThan(200);
        expect(input.touchMoveDir.x).toBeGreaterThan(0.95);
        await page.screenshot({ path: `${SCREENS}/touch-move.png` });
        let moved = 0;
        try {
            await expect
                .poll(
                    async () => (await page.evaluate(() => (window as any).__rebirth.player.pos.x as number)) - start.x,
                    { timeout: 8_000 },
                )
                .toBeGreaterThan(2);
            moved = 1;
        } finally {
            await touch.endAll();
        }
        expect(moved).toBe(1);
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.lastInput.touchMoveLen)).toBe(0);

        // right half: the aim stick; beyond range / 1.075 it fires (and the aim line shows)
        const ammo = () => page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo as number);
        expect(await ammo()).toBe(30);
        await touch.start(2, 600, 150);
        await touch.move(2, 680, 150);
        await expect.poll(ammo, { timeout: 10_000 }).toBeLessThan(30);
        expect(await page.evaluate(() => (window as any).__rebirth.touch.aimLineDots)).toBeGreaterThan(3);
        await page.screenshot({ path: `${SCREENS}/touch-aim.png` });
        await touch.endAll();

        // tapping a weapon slot switches to it; the menu button opens the in-game menu
        await page.locator("#ui-weapon-id-3").tap();
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.curWeapIdx)).toBe(2);
        await page.locator("#ui-weapon-id-1").tap();
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.curWeapIdx)).toBe(0);
        await page.locator("#ui-menu-display").tap();
        await expect(page.locator("#ui-game-menu")).toBeVisible();
        await expect(page.locator("#btn-game-move-style")).toBeVisible();
        await expect(page.locator("#btn-game-keybinds")).toBeHidden();
        await page.locator("#btn-game-move-style").tap();
        expect(await cfg(page, "touchMoveStyle")).toBe("locked");
        await page.screenshot({ path: `${SCREENS}/touch-menu.png` });
        expect(errors).toEqual([]);
    });
});

// Two network players: Alice kills Bob with her fists, Bob reports Alice from the death screen.

async function joinNet(browser: Browser, name: string): Promise<{ page: Page; errors: string[] }> {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errors = collectErrors(page);
    await page.goto(`/?net=1&map=main_summer&name=${name}`);
    await page.waitForFunction(() => (window as any).__rebirth?.ready === true, null, { timeout: 90_000 });
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("network");
    return { page, errors };
}

test("network: the death screen reports the killer", async ({ browser }) => {
    test.setTimeout(300_000);
    const alice = await joinNet(browser, "Alice");
    const bob = await joinNet(browser, "Bob");
    const a = alice.page;
    const b = bob.page;
    const aliceId = await a.evaluate(() => (window as any).__rebirth.player.id as number);
    const bobId = await b.evaluate(() => (window as any).__rebirth.player.id as number);
    expect(await b.evaluate(() => (window as any).__rebirth.reports.enabled)).toBe(true);
    await a.waitForFunction(() => (window as any).__rebirth.gas.mode !== "inactive", null, { timeout: 60_000 });
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
    expect(await b.evaluate(() => (window as any).__rebirth.reports.killerId)).toBe(aliceId);
    await b.bringToFront();
    await waitForStats(b);
    await b.locator("#btn-stats-report").click();
    const dialog = b.locator("#ui-report-modal");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".ui-report-target")).toHaveText("Alice");
    await dialog.locator('.btn-report-reason[data-reason="cheating"]').click();
    await expect(dialog.locator('.btn-report-reason[data-reason="cheating"]')).toHaveClass(
        /btn-report-reason-selected/,
    );
    await dialog.locator("#ui-report-text").fill("aimbot");
    await b.screenshot({ path: `${SCREENS}/report-dialog.png` });
    await dialog.locator("#btn-report-submit").click();
    await expect(b.locator(".ui-toast")).toHaveText("Report sent. Thank you!");
    await expect(dialog).toBeHidden();
    expect(await b.evaluate(() => (window as any).__rebirth.reports.results)).toMatchObject([{ ok: true }]);
    // the same player cannot be reported twice
    await b.locator("#btn-stats-report").click();
    await dialog.locator('.btn-report-reason[data-reason="teaming"]').click();
    await dialog.locator("#btn-report-submit").click();
    await expect(b.locator(".ui-toast").last()).toHaveText("You already reported this player.");
    expect(alice.errors).toEqual([]);
    // the refused duplicate is an HTTP 409, which the browser logs
    expect(bob.errors.filter((e) => !/status of 409/.test(e))).toEqual([]);
    await a.context().close();
    await b.context().close();
});
