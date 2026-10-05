// Shared helpers of the M4 specs (battle-royale loop on the client): boot, page error collection, aiming and the
// test hooks on window.__rebirth. Screenshots go to __screens__/M4.
import { expect, type Page } from "@playwright/test";

export const SCREENS = "tests/e2e/__screens__/M4";

export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });
    return errors;
}

/** Loads a loopback route and waits for the first rendered frame with the local state. */
export async function boot(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 45_000 });
    await page.waitForFunction(() => (window as any).__rebirth.renderer.spriteCount > 5, null, { timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
}

/** Screen position of an object as drawn this frame, or null when it is not in view. */
export async function screenPosOf(page: Page, id: number): Promise<{ x: number; y: number } | null> {
    return page.evaluate((id) => {
        const r = (window as any).__rebirth;
        const pos = r.visualPos(id);
        return pos ? r.worldToScreen(pos) : null;
    }, id);
}

/** Deals `amount` damage to player `target` as a hit of `sourceId` with `weapon` (the sandbox Game). */
export async function damage(page: Page, target: number, amount: number, sourceId: number, weapon = "ak47") {
    await page.evaluate(
        ({ target, amount, sourceId, weapon }) => {
            const g = (window as any).__rebirth.game;
            g.damagePlayer(g.getPlayer(target), { amount, damageType: 0, gameSourceType: weapon, sourceId });
        },
        { target, amount, sourceId, weapon },
    );
}

/** Text of the kill feed lines currently shown, newest first. */
export async function killFeed(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__rebirth.match.killFeed as string[]);
}

/** Waits until the stats screen, buttons included, has faded in. */
export async function waitForStats(page: Page): Promise<void> {
    // the screen fades in from 2.5 s and its buttons appear about 6 s after the result (slow software GL: wait longer)
    await page.waitForFunction(() => (window as any).__rebirth.match.gameOver.settled === true, null, {
        timeout: 60_000,
    });
    await expect(page.locator("#ui-stats")).toBeVisible();
}

/** The stats card rows as [label, value] pairs. */
export async function statsRows(page: Page): Promise<string[][]> {
    return page.evaluate(() =>
        [...document.querySelectorAll("#ui-stats-info-box .ui-stats-info")].map((row) =>
            [...row.children].map((c) => c.textContent ?? ""),
        ),
    );
}
