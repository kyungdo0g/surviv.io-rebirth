import { expect, test } from "@playwright/test";

const PAGES: [filter: string, page: number][] = [
    ["loot-weapon", 0],
    ["loot-", 3],
    ["map-", 0],
    ["map-", 4],
    ["map-building", 0],
    ["player-", 0],
];

for (const [filter, page] of PAGES) {
    test(`sprite gallery renders original ${filter} sprites, page ${page}`, async ({ page: tab }) => {
        const errors: string[] = [];
        tab.on("pageerror", (e) => errors.push(String(e)));
        await tab.goto(`/?gallery=${filter}&page=${page}`);
        await tab.waitForFunction(() => (window as any).__rebirth?.gallery?.done === true, null, { timeout: 45_000 });
        const state = await tab.evaluate(() => (window as any).__rebirth.gallery);
        expect(state.total).toBeGreaterThan(10);
        expect(state.failed).toEqual([]);
        expect(state.loaded).toBe(state.total);
        expect(errors).toEqual([]);
        await tab.screenshot({ path: `tests/e2e/__screens__/M0/gallery-${filter.replace(/-$/, "")}-${page}.png` });
    });
}
