// M2 client: weapons, tracers, loot pickup, reloads and the HUD in English and Korean, against the loopback
// simulation. The sandbox options used here: &give=<gun> (gun in slot 1 with full ammo), &dummies=<n> (players
// standing in front of the local player), &lang=ko. Screenshots go to __screens__/M2.
import { expect, type Page, test } from "@playwright/test";

const SCREENS = "tests/e2e/__screens__/M2";
const TICK_HZ = 100;
/** AK-47 reloadTime (packages/defs gameObjects.json) */
const AK_RELOAD_TIME = 2.5;

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });
    return errors;
}

async function boot(page: Page, query: string) {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 45_000 });
    await page.waitForFunction(() => (window as any).__rebirth.renderer.spriteCount > 5, null, { timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
}

/** Screen position of an object as drawn this frame. */
async function screenPosOf(page: Page, id: number): Promise<{ x: number; y: number }> {
    const p = await page.evaluate((id) => {
        const r = (window as any).__rebirth;
        const pos = r.visualPos(id);
        return pos ? r.worldToScreen(pos) : null;
    }, id);
    expect(p).not.toBeNull();
    return p!;
}

async function local(page: Page) {
    return page.evaluate(() => {
        const l = (window as any).__rebirth.local;
        return { weapons: l.weapons, cur: l.curWeapIdx, inventory: l.inventory, action: l.action };
    });
}

/** Spawns loot of `type` at `offset` from the local player (no physics push) and returns its id. */
async function spawnLoot(page: Page, type: string, count: number, offset: { x: number; y: number }) {
    return page.evaluate(
        ({ type, count, offset }) => {
            const r = (window as any).__rebirth;
            const p = r.player.pos;
            const loot = r.game.loot.addLoot(type, { x: p.x + offset.x, y: p.y + offset.y }, 0, count, {
                pushSpeed: 0,
                noSideAmmo: true,
            });
            return loot.id as number;
        },
        { type, count, offset },
    );
}

/** Teleports the local player onto loot `id` and waits until the HUD offers it. */
async function standOn(page: Page, id: number, promptText: string) {
    await page.evaluate((id) => {
        const r = (window as any).__rebirth;
        const loot = r.game.loot.items.get(id);
        r.game.teleportPlayer(r.player.id, loot.pos);
    }, id);
    await page.waitForFunction((text) => (window as any).__rebirth.interaction()?.text === text, promptText, {
        timeout: 15_000,
    });
    await expect(page.locator("#ui-interaction")).toBeVisible();
    await expect(page.locator("#ui-interaction-press")).toHaveText("F");
    await expect(page.locator("#ui-interaction-description")).toHaveText(promptText);
}

test.describe("M2 weapons, loot and HUD", () => {
    test("firing the AK-47 at a dummy draws tracers and damages it", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&dummies=1");
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        expect(dummy).toBeGreaterThan(0);
        const state = await local(page);
        expect(state.weapons[0]).toEqual({ type: "ak47", ammo: 30 });
        expect(state.cur).toBe(0);
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("AK-47");
        await expect(page.locator("#ui-current-clip")).toHaveText("30");
        await expect(page.locator("#ui-remaining-ammo")).toHaveText("90");

        const healthBefore = await page.evaluate((id) => (window as any).__rebirth.game.getPlayer(id).health, dummy);
        expect(healthBefore).toBe(100);
        // aim at the dummy and wait for the player to face it
        const target = await screenPosOf(page, dummy);
        await page.mouse.move(target.x, target.y);
        await page.waitForFunction(
            (id) => {
                const r = (window as any).__rebirth;
                const me = r.game.getPlayer(r.player.id);
                const d = r.game.getPlayer(id);
                const dx = d.pos.x - me.pos.x;
                const dy = d.pos.y - me.pos.y;
                return (me.dir.x * dx + me.dir.y * dy) / Math.hypot(dx, dy) > 0.99;
            },
            dummy,
            { timeout: 10_000 },
        );
        await page.mouse.down();
        try {
            await page.waitForFunction(() => (window as any).__rebirth.renderer.tracerCount > 0, null, {
                timeout: 10_000,
            });
            await page.screenshot({ path: `${SCREENS}/firing.png` });
            await page.waitForFunction((id) => (window as any).__rebirth.game.getPlayer(id).health < 100, dummy, {
                timeout: 10_000,
            });
        } finally {
            await page.mouse.up();
        }
        const after = await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            return {
                health: r.game.getPlayer(id).health,
                spawned: r.renderer.tracersSpawned,
                clip: r.local.weapons[0].ammo,
                audio: { requested: r.audio.requested, unlocked: r.audio.unlocked },
            };
        }, dummy);
        expect(after.health).toBeLessThan(healthBefore);
        expect(after.spawned).toBeGreaterThan(0);
        expect(after.clip).toBeLessThan(30);
        // shots asked the audio engine for sounds; headless audio must not throw
        expect(after.audio.requested).toBeGreaterThan(0);
        expect(errors).toEqual([]);
    });

    test("walking onto loot shows the prompt and F picks it up", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&dummies=1");
        // the dummy option moved the player to open ground with a clear strip towards +x: lay the loot out there
        const gun = await spawnLoot(page, "m870", 1, { x: 2.5, y: -1 });
        const bandages = await spawnLoot(page, "bandage", 5, { x: 5.5, y: -1 });
        const helmet = await spawnLoot(page, "helmet02", 1, { x: 4, y: 1.8 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENS}/loot-ground.png` });

        await standOn(page, gun, "M870");
        await page.screenshot({ path: `${SCREENS}/loot-prompt.png` });
        await page.keyboard.press("f");
        await page.waitForFunction(() => (window as any).__rebirth.local.weapons[0].type === "m870", null, {
            timeout: 10_000,
        });
        // the gun is drawn because fists were out (survev pickupLoot)
        await page.waitForFunction(() => (window as any).__rebirth.local.curWeapIdx === 0, null, { timeout: 10_000 });
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("M870");
        await expect(page.locator("#ui-weapon-id-1")).toHaveClass(/ui-weapon-equipped/);

        await standOn(page, bandages, "Bandage (5)");
        await page.keyboard.press("f");
        await page.waitForFunction(() => (window as any).__rebirth.local.inventory.bandage === 5, null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-loot-bandage .ui-loot-count")).toHaveText("5");

        await standOn(page, helmet, "Level 2 Helmet");
        await page.keyboard.press("f");
        await page.waitForFunction(() => (window as any).__rebirth.local.helmet === "helmet02", null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-armor-helmet")).toBeVisible();
        await expect(page.locator("#ui-armor-helmet .ui-armor-level")).toHaveText("Lvl. 2");
        await expect(page.locator("#ui-interaction")).toBeHidden();

        // a better scope is equipped on pickup; clicking a scope button switches back
        const scope = await spawnLoot(page, "2xscope", 1, { x: 0, y: 0 });
        await standOn(page, scope, "2x Scope");
        await page.keyboard.press("f");
        await page.waitForFunction(() => (window as any).__rebirth.local.scope === "2xscope", null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-scope-2xscope")).toHaveClass(/ui-zoom-active/);
        await page.locator("#ui-scope-1xscope").click();
        await page.waitForFunction(() => (window as any).__rebirth.local.scope === "1xscope", null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-scope-1xscope")).toHaveClass(/ui-zoom-active/);
        expect(errors).toEqual([]);
    });

    test("R reloads a partly empty magazine after the reload time", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&loot=0");
        // fire a short burst into the distance
        const vp = page.viewportSize()!;
        await page.mouse.move(vp.width / 2 + 300, vp.height / 2 - 200);
        await page.mouse.down();
        try {
            await page.waitForFunction(() => (window as any).__rebirth.local.weapons[0].ammo <= 27, null, {
                timeout: 15_000,
            });
        } finally {
            await page.mouse.up();
        }
        await page.waitForTimeout(500);
        const before = await local(page);
        const clip = before.weapons[0].ammo;
        expect(clip).toBeGreaterThan(0);
        expect(clip).toBeLessThan(30);
        await expect(page.locator("#ui-current-clip")).toHaveText(String(clip));
        const reserve = before.inventory["762mm"];
        expect(reserve).toBe(90);

        const startTick = await page.evaluate(() => (window as any).__rebirth.tick);
        await page.keyboard.press("r");
        await page.waitForFunction(() => (window as any).__rebirth.local.action?.type === "reload", null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-pie-timer")).toBeVisible();
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Reloading");
        await page.screenshot({ path: `${SCREENS}/reloading.png` });
        await page.waitForFunction(() => (window as any).__rebirth.local.weapons[0].ammo === 30, null, {
            timeout: 20_000,
        });
        const endTick = await page.evaluate(() => (window as any).__rebirth.tick);
        // the refill lands one reload time after the key press, in simulation time
        expect((endTick - startTick) / TICK_HZ).toBeGreaterThanOrEqual(AK_RELOAD_TIME - 0.05);
        await expect(page.locator("#ui-current-clip")).toHaveText("30");
        await expect(page.locator("#ui-remaining-ammo")).toHaveText(String(reserve - (30 - clip)));
        await expect(page.locator("#ui-pie-timer")).toBeHidden();
        const vpSize = page.viewportSize()!;
        await page.screenshot({
            path: `${SCREENS}/hud-closeup.png`,
            clip: { x: 0, y: vpSize.height - 300, width: vpSize.width, height: 300 },
        });
        expect(errors).toEqual([]);
    });

    test("the HUD renders in Korean with ?lang=ko", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&dummies=1&lang=ko");
        expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
        await expect(page.locator(".ui-kill-counter-header")).toHaveText("킬");
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("AK-47");
        await expect(page.locator("#ui-weapon-id-3 .ui-weapon-name")).toHaveText("주먹");
        const bandages = await spawnLoot(page, "bandage", 5, { x: 3, y: 0 });
        await standOn(page, bandages, "붕대 (5)");
        // fire a little so R has something to reload
        await page.mouse.move(100, 100);
        await page.mouse.down();
        await page.waitForFunction(() => (window as any).__rebirth.local.weapons[0].ammo < 30, null, {
            timeout: 15_000,
        });
        await page.mouse.up();
        await page.keyboard.press("r");
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("재장전", { timeout: 10_000 });
        await page.screenshot({ path: `${SCREENS}/hud-ko.png` });
        expect(errors).toEqual([]);
    });

    test("number keys and the mouse wheel switch weapons, M mutes", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&loot=0");
        await page.keyboard.press("3");
        await page.waitForFunction(() => (window as any).__rebirth.local.curWeapIdx === 2, null, { timeout: 10_000 });
        await expect(page.locator("#ui-weapon-id-3")).toHaveClass(/ui-weapon-equipped/);
        await expect(page.locator("#ui-current-clip")).toHaveCSS("opacity", "0");
        await page.keyboard.press("q");
        await page.waitForFunction(() => (window as any).__rebirth.local.curWeapIdx === 0, null, { timeout: 10_000 });
        await page.mouse.move(400, 300);
        await page.mouse.wheel(0, 120);
        await page.waitForFunction(() => (window as any).__rebirth.local.curWeapIdx === 2, null, { timeout: 10_000 });
        // clicking a weapon slot equips it without firing
        await page.locator("#ui-weapon-id-1").click();
        await page.waitForFunction(() => (window as any).__rebirth.local.curWeapIdx === 0, null, { timeout: 10_000 });
        expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo)).toBe(30);
        expect(await page.evaluate(() => (window as any).__rebirth.audio.muted)).toBe(false);
        await page.keyboard.press("m");
        await page.waitForFunction(() => (window as any).__rebirth.audio.muted === true, null, { timeout: 5_000 });
        expect(errors).toEqual([]);
    });

    test("dying shows the death screen and the sandbox respawns the player", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&dummies=1&loot=0");
        const before = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const killer = r.dummies[0];
            r.game.damagePlayer(r.game.getPlayer(r.player.id), {
                amount: 500,
                damageType: 0,
                gameSourceType: "ak47",
                sourceId: killer,
            });
            return r.player.id as number;
        });
        await page.waitForFunction(() => (window as any).__rebirth.local.dead === true, null, { timeout: 10_000 });
        await expect(page.locator("#ui-health-actual")).toHaveCSS("width", "0px");
        // M4: the original stats screen replaced the M2 overlay; the killer is named in the kill feed
        await page.waitForFunction(() => (window as any).__rebirth.match.gameOver.settled === true, null, {
            timeout: 20_000,
        });
        await expect(page.locator("#ui-stats")).toBeVisible();
        await expect(page.locator(".ui-stats-header-title")).toHaveText("You died.");
        expect(await page.evaluate(() => (window as any).__rebirth.match.killFeed)).toContain(
            "dummy 1 killed player with AK-47",
        );
        await page.screenshot({ path: `${SCREENS}/death.png` });
        await page.locator(".ui-stats-restart").click();
        await page.waitForFunction(
            (old) => {
                const r = (window as any).__rebirth;
                return r.player.id !== old && r.local && !r.local.dead && r.local.health === 100;
            },
            before,
            { timeout: 10_000 },
        );
        await expect(page.locator("#ui-stats")).toBeHidden();
        expect(errors).toEqual([]);
    });
});
