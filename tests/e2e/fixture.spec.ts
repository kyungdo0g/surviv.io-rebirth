// Renderer fixture (/?fixture=1): hand-made map and views, no simulation. Guards the rendering path on its own.
import { expect, test } from "@playwright/test";

test("renderer fixture draws buildings, obstacles and the player", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/?fixture=1");
    await page.waitForFunction(() => (window as any).__rebirth?.ready === true, null, { timeout: 45_000 });
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("fixture");
    await page.waitForFunction(() => (window as any).__rebirth.renderer.spriteCount > 20, null, { timeout: 15_000 });

    // walk up to the house; the fixture moves the player at 13 units/s without collisions
    await page.keyboard.down("w");
    await page.waitForFunction(() => (window as any).__rebirth.player.pos.y > 140, null, { timeout: 20_000 });
    await page.keyboard.up("w");
    await page.keyboard.down("d");
    await page.waitForFunction(() => (window as any).__rebirth.player.pos.x > 138, null, { timeout: 20_000 });
    await page.keyboard.up("d");
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => {
        const r = (window as any).__rebirth;
        return { sprites: r.renderer.spriteCount, missing: r.missingSprites as string[] };
    });
    expect(state.sprites).toBeGreaterThan(20);
    expect(state.missing.length).toBeLessThan(10);
    await page.screenshot({ path: "tests/e2e/__screens__/M1/fixture-house.png" });
    expect(errors).toEqual([]);
});
