// 50v50 buildings and structures in the client (survev content wave, 50v50 stage): River Town, the Faction Bridge,
// the 50v50 warehouse, the Silo Shack and the faction caches in the building showcase (zoomed out), and the faction
// crates on a real 50v50 map, Red's on the Red side and Blue's on the Blue side. Hooks: window.__rebirth.showcase,
// window.__rebirth.game (generation, teleportPlayer), window.__rebirth.lastSnapshot. Screenshots:
// __screens__/survev-faction.
import { expect, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-faction";
const SHOWCASE: Array<{ type: string; zoom: number }> = [
    { type: "river_town_01", zoom: 150 },
    { type: "bridge_xlg_structure_01", zoom: 70 },
    { type: "warehouse_01f", zoom: 40 },
    { type: "shilo_01", zoom: 30 },
    { type: "cache_01f", zoom: 24 },
];

test.describe("50v50 buildings", () => {
    test("River Town, the Faction Bridge, the 50v50 warehouse, the Silo Shack and a cache", async ({ page }) => {
        test.setTimeout(SHOWCASE.length * 45_000);
        const errors = collectErrors(page);
        for (const { type, zoom } of SHOWCASE) {
            await boot(page, `/?building=${type}&seed=1&zoom=${zoom}`);
            // stand in the middle of it for the overview
            const info = await page.evaluate((type) => {
                const r = (window as any).__rebirth;
                const game = r.game;
                const root = game.generation.objects.find((o: any) => o.parentId === 0 && o.type === type);
                game.teleportPlayer(r.player.id, { x: root.pos.x, y: root.pos.y + 0.01 });
                const ids = new Set([root.id]);
                for (const o of game.generation.objects) if (ids.has(o.parentId)) ids.add(o.id);
                return {
                    map: r.showcase.mapName,
                    types: game.generation.objects.filter((o: any) => ids.has(o.id)).map((o: any) => o.type),
                };
            }, type);
            expect(info.map.startsWith("faction"), type).toBe(true);
            if (type === "river_town_01") {
                for (const t of ["statue_structure_01", "statue_structure_02", "crate_02f", "crate_22"])
                    expect(info.types).toContain(t);
            }
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${SCREENS}/${type}.png` });
        }
        expect(errors).toEqual([]);
    });

    test("faction crates on a 50v50 map: Red's on the Red side, Blue's on the Blue side", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?map=faction&seed=1&team=4&loot=0");
        const sides = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game.generation;
            const side = (p: any) => (g.factionSplitOri === 1 ? p.x : p.y);
            const mid = r.game.mapData.width / 2;
            const crates = g.objects.filter(
                (o: any) => o.parentId === 0 && (o.type === "crate_02f" || o.type === "crate_22"),
            );
            return {
                redOk: crates.filter((o: any) => o.type === "crate_02f").every((o: any) => side(o.pos) < mid),
                blueOk: crates.filter((o: any) => o.type === "crate_22").every((o: any) => side(o.pos) > mid),
                first: crates.find((o: any) => o.type === "crate_02f")?.pos,
            };
        });
        expect(sides.redOk).toBe(true);
        expect(sides.blueOk).toBe(true);
        await page.evaluate((pos) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, { x: pos.x, y: pos.y - 5 });
        }, sides.first);
        await page.waitForFunction(
            () => ((window as any).__rebirth.lastSnapshot?.objects ?? []).some((o: any) => o.type === "crate_02f"),
            null,
            { timeout: 10_000 },
        );
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${SCREENS}/crate_02f-on-map.png` });
        // the full map: River Town and the two Faction Bridges on the river, team buildings at the edges
        await page.keyboard.press("m");
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENS}/faction-map.png` });
        await page.keyboard.press("m");
        expect(errors).toEqual([]);
    });
});
