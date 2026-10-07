// M9 visual diff against recorded survev.io gameplay (docs/research/provenance/visual-diff.md), at the recordings'
// 1704 x 903 viewport: the armour level labels sit above their boxes, the equipped weapon slot keeps the 160 px width
// after its pulse, the desktop minimap has its magnifier and minimize buttons (the magnifier stays on the big map), the
// big map's place names are 22 px like the original's screen-sized map texture, teammate names grow on high-density
// screens, and the end screen has the large rank / team kills values and the logo. Hooks: window.__rebirth.bigMap,
// minimap, visual (debugM9.ts), match.gameOver. Screenshots go to __screens__/M9 (visual-*.png).
import { type Browser, expect, type Page, test } from "@playwright/test";

const SCREENS = "tests/e2e/__screens__/M9";
const VIEWPORT = { width: 1704, height: 903 };

test.use({ viewport: VIEWPORT });

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });
    return errors;
}

async function boot(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 45_000 });
    await page.waitForFunction(() => (window as any).__rebirth.renderer.spriteCount > 5, null, { timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
}

type Box = { x: number; y: number; width: number; height: number };

async function box(page: Page, selector: string): Promise<Box> {
    const b = await page.locator(selector).boundingBox();
    expect(b, selector).not.toBeNull();
    return b as Box;
}

/** Font sizes of the teammate names drawn with a device pixel ratio of `dpr`. */
async function nameFontSizes(browser: Browser, dpr: number): Promise<number[]> {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: dpr });
    const page = await context.newPage();
    try {
        await boot(page, "/?sandbox=1&map=main&seed=1&team=4&teammates=2&loot=0");
        await page.waitForFunction(() => (window as any).__rebirth.visual.nameFontSizes.length > 0, null, {
            timeout: 15_000,
        });
        return await page.evaluate(() => (window as any).__rebirth.visual.nameFontSizes as number[]);
    } finally {
        await context.close();
    }
}

test.describe("M9 visual diff", () => {
    test("armour labels, weapon slot width, minimap buttons and the big map", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=3&team=4&teammates=2&lang=ko&loot=0&give=groza,mac10,2xscope");
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            me.helmet = "helmet02";
            me.chest = "chest01";
        });

        // the level label sits above its box (game.css .ui-armor-level: relative, bottom 24px)
        await expect(page.locator("#ui-armor-helmet .ui-armor-level")).toHaveText("레벨 2");
        const helmet = await box(page, "#ui-armor-helmet");
        const level = await box(page, "#ui-armor-helmet .ui-armor-level");
        // (its line box may touch the border; the text is above it)
        expect(level.y + level.height / 2).toBeLessThan(helmet.y);
        expect(level.y + level.height).toBeLessThanOrEqual(helmet.y + 4);
        expect(helmet.y - level.y).toBeLessThan(30);

        // the equipped slot pulses wider when equipped (the HUD clamps frames to 0.1 s, so a frame sees the pulse),
        // then keeps 83.33 % of the 192 px column like the others
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.maxSlotWidth = 0;
            const sample = () => {
                const w = Number.parseFloat((document.getElementById("ui-weapon-id-2") as HTMLElement).style.width);
                if (w > r.maxSlotWidth) r.maxSlotWidth = w;
                r.slotSampler = requestAnimationFrame(sample);
            };
            sample();
        });
        await page.locator("#ui-weapon-id-2").click();
        await expect(page.locator("#ui-weapon-id-2")).toHaveClass(/ui-weapon-equipped/, { timeout: 15_000 });
        await page.waitForFunction(
            () => {
                const r = (window as any).__rebirth;
                const w = (document.getElementById("ui-weapon-id-2") as HTMLElement).getBoundingClientRect().width;
                return r.maxSlotWidth > 95 && Math.abs(w - 164) < 1;
            },
            null,
            { timeout: 20_000 },
        );
        await page.evaluate(() => cancelAnimationFrame((window as any).__rebirth.slotSampler));
        const slot2 = await box(page, "#ui-weapon-id-2");
        const slot1 = await box(page, "#ui-weapon-id-1");
        expect(Math.abs(slot1.width - slot2.width)).toBeLessThanOrEqual(1);

        // the minimap's buttons sit inside its bottom corners
        const rect = await page.evaluate(() => (window as any).__rebirth.minimap.rect as Box);
        const expand = await box(page, "#ui-map-expand-desktop");
        const minimize = await box(page, "#ui-map-minimize");
        expect(expand.x - rect.x).toBeGreaterThan(4);
        expect(expand.x - rect.x).toBeLessThan(20);
        expect(rect.y + rect.height - (expand.y + expand.height)).toBeGreaterThan(4);
        expect(rect.y + rect.height - (expand.y + expand.height)).toBeLessThan(20);
        expect(rect.x + rect.width - (minimize.x + minimize.width)).toBeGreaterThan(0);
        expect(rect.x + rect.width - (minimize.x + minimize.width)).toBeLessThan(20);
        expect(Math.abs(expand.width - minimize.width)).toBeLessThan(1);
        // place names as large as on the original's screen-sized texture: 22 px once the big map shows it
        const label = await page.evaluate(() => {
            const v = (window as any).__rebirth.visual;
            return { size: v.mapTextureSize as number, px: v.mapLabelPx as number };
        });
        expect(label.size).toBeGreaterThanOrEqual(1333);
        expect((label.px * VIEWPORT.height) / label.size).toBeCloseTo(22, 1);
        // teammate names at 22 px on a screen of pixel ratio 1
        await page.waitForFunction(() => (window as any).__rebirth.visual.nameFontSizes.length > 0);
        expect(await page.evaluate(() => (window as any).__rebirth.visual.nameFontSizes)).toContain(22);
        await page.screenshot({ path: `${SCREENS}/visual-hud.png` });

        // the magnifier opens the big map and stays to close it; the minimize button hides with the big map
        await page.locator("#ui-map-expand-desktop").click();
        await page.waitForFunction(() => (window as any).__rebirth.bigMap.open === true);
        await expect(page.locator("#ui-map-expand-desktop")).toBeVisible();
        await expect(page.locator("#ui-map-minimize")).toBeHidden();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/visual-bigmap.png` });
        await page.locator("#ui-map-expand-desktop").click();
        await page.waitForFunction(() => (window as any).__rebirth.bigMap.open === false);
        await expect(page.locator("#ui-map-minimize")).toBeVisible();

        // minimize toggles the minimap; the buttons stay
        await page.locator("#ui-map-minimize").click();
        await page.waitForFunction(() => (window as any).__rebirth.minimap.visible === false);
        await expect(page.locator("#ui-map-minimize")).toBeVisible();
        await page.locator("#ui-map-minimize").click();
        await page.waitForFunction(() => (window as any).__rebirth.minimap.visible === true);
        expect(errors).toEqual([]);
    });

    test("teammate names are 30 px on high-density screens", async ({ browser }) => {
        test.setTimeout(120_000);
        expect(await nameFontSizes(browser, 2)).toContain(30);
    });

    test("the end screen: large rank and team kills, the logo", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=0&map=main&seed=1&loot=0&team=4&teammates=3&dummies=1&lang=ko&give=mac10");
        // the match starts once two teams have been alive for 10 s (the red zone wakes up)
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode !== "inactive", null, { timeout: 60_000 });
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            r.finish = setInterval(() => {
                for (const d of r.dummies) {
                    const p = g.getPlayer(d);
                    if (p && !p.dead) {
                        g.damagePlayer(p, {
                            amount: 250,
                            damageType: 0,
                            gameSourceType: "mac10",
                            sourceId: r.player.id,
                            dir: { x: 0, y: 1 },
                        });
                    }
                }
            }, 500);
        });
        await page.waitForFunction(() => (window as any).__rebirth.match.gameOver.settled === true, null, {
            timeout: 90_000,
        });
        await page.evaluate(() => clearInterval((window as any).__rebirth.finish));
        expect(await page.evaluate(() => (window as any).__rebirth.match.gameOver.won)).toBe(true);
        const sizes = await page.evaluate(() => {
            const px = (sel: string) => getComputedStyle(document.querySelector(sel) as Element).fontSize;
            return { stat: px(".ui-stats-header-stat"), value: px(".ui-stats-header-value") };
        });
        expect(sizes).toEqual({ stat: "32px", value: "48px" });
        const logo = await box(page, "#ui-stats-logo");
        expect(logo.x).toBeCloseTo(20, 0);
        expect(logo.width).toBeCloseTo(250, 0);
        await page.screenshot({ path: `${SCREENS}/visual-gameover.png` });
        expect(errors).toEqual([]);
    });
});
