// The building showcase (rebirth test mode, survev content wave stage 3): /?building=<type> plays on a map holding
// only that building or structure, without gas, the local player standing next to it; [ and ] step through every
// building the maps spawn. Hooks: window.__rebirth.showcase (type, mapName, index, count, types, goto),
// window.__rebirth.game. Screenshots: __screens__/survev-buildings (SHOWCASE_ALL=1 shoots every building).
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-buildings";
/** survev content: the Reserve town, the Workshop, a snow camp, the Oasis, the Hunting Perch, Cloud and Cobalt bunkers */
const SURVEV_BUILDINGS = [
    "desert_town_02",
    "workshop_complex_01",
    "camp_01",
    "oasis_01",
    "perch_01",
    "bunker_structure_10",
    "bunker_structure_09",
];

async function showcaseState(page: Page) {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        const game = r.game;
        const objects = game.generation.objects as Array<{ id: number; type: string; parentId: number; pos: any }>;
        const top = objects.filter((o) => o.parentId === 0);
        const me = game.getPlayer(r.player.id);
        const root = top.find((o) => o.type === r.showcase.type);
        return {
            type: r.showcase.type as string,
            mapName: r.showcase.mapName as string,
            index: r.showcase.index as number,
            count: r.showcase.count as number,
            gameMap: game.options.mapName as string,
            tops: top.map((o) => o.type),
            gasMode: game.gas.mode as number,
            dist: root ? Math.hypot(me.pos.x - root.pos.x, me.pos.y - root.pos.y) : -1,
            mapSize: game.mapData.width as number,
        };
    });
}

test.describe("building showcase", () => {
    test("a map with only the Reserve town, no gas, the player beside it; [ and ] step through", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, "/?building=desert_town_02&seed=1");
        const s = await showcaseState(page);
        expect(s.type).toBe("desert_town_02");
        expect(s.mapName).toBe("desert");
        expect(s.gameMap).toBe("desert");
        expect(s.tops).toEqual(["desert_town_02"]);
        expect(s.gasMode).toBe(0);
        expect(s.dist).toBeGreaterThan(0);
        expect(s.dist).toBeLessThan(s.mapSize / 2);
        await expect(page.locator("#showcase-bar")).toBeVisible();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${SCREENS}/desert_town_02.png` });

        await page.keyboard.press("]");
        await page.waitForURL(/building=(?!desert_town_02)/, { timeout: 15_000 });
        await boot(page, page.url());
        const next = await showcaseState(page);
        expect(next.index).toBe(s.index + 1);
        expect(next.tops[0]).toBe(next.type);
        await page.keyboard.press("[");
        await page.waitForURL(/building=desert_town_02/, { timeout: 15_000 });
        await boot(page, page.url());
        expect((await showcaseState(page)).type).toBe("desert_town_02");
        expect(errors).toEqual([]);
    });

    test("the survev content wave's buildings each stand alone", async ({ page }) => {
        test.setTimeout(SURVEV_BUILDINGS.length * 45_000);
        const errors = collectErrors(page);
        for (const type of SURVEV_BUILDINGS) {
            await boot(page, `/?building=${type}&seed=1`);
            const s = await showcaseState(page);
            expect(s.type).toBe(type);
            expect(s.tops).toEqual([type]);
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${SCREENS}/${type}.png` });
        }
        expect(errors).toEqual([]);
    });

    test("every building (SHOWCASE_ALL=1)", async ({ page }) => {
        test.skip(!process.env.SHOWCASE_ALL, "set SHOWCASE_ALL=1 to shoot every building");
        test.setTimeout(30 * 60_000);
        const errors = collectErrors(page);
        await boot(page, "/?building=1&seed=1");
        const types: string[] = await page.evaluate(() => (window as any).__rebirth.showcase.types);
        for (const type of types) {
            await boot(page, `/?building=${type}&seed=1`);
            expect((await showcaseState(page)).tops.filter((t) => t !== "dock_01")).toEqual([type]);
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${SCREENS}/all/${type}.png` });
        }
        expect(errors).toEqual([]);
    });
});
