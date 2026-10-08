// Building visual parity (survev parity wave, task 4): every survev-only (or survev-overridden) building and structure
// the maps spawn, shot in the showcase from above with its roofs, then with every roof open (window.__rebirth.hideRoofs),
// then its underground floor if it has one, to compare with survev (the survev.wiki.gg layout and roof images in
// research-cache/wikigg-buildings/img). Hooks: window.__rebirth (showcase, game, player, hideRoofs, cameraAt).
// PARITY_ALL=1 shoots all of them; by default a few representative ones. Screenshots: __screens__/survev-parity.
import { expect, type Page, test } from "@playwright/test";
import { collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-parity";
/** the survev-only and survev-overridden showcase entries (provenance.json mapObjects), with their size */
const ALL: ReadonlyArray<readonly [string, number]> = [
    ["warehouse_03", 64],
    ["cache_04", 8],
    ["cache_02sp", 8],
    ["cache_02su", 8],
    ["oasis_01", 69],
    ["cache_02d", 8],
    ["desert_town_02", 166],
    ["cache_01f", 8],
    ["cache_02f", 8],
    ["cache_07f", 8],
    ["cache_02h", 8],
    ["warehouse_03x", 64],
    ["house_red_01x", 33],
    ["house_red_02x", 33],
    ["barn_02x", 52],
    ["cache_01x", 8],
    ["cache_02x", 8],
    ["teahouse_complex_01x", 38],
    ["camp_01", 34],
    ["mansion_structure_01x", 70],
    ["cache_01w", 8],
    ["cache_02w", 8],
    ["cache_07w", 8],
    ["workshop_complex_01", 58],
    ["camp_01w", 34],
    ["logging_complex_02x", 48],
    ["logging_complex_03x", 10],
    ["teahouse_01x", 28],
    ["workshop_complex_01w", 58],
    ["logging_complex_03sp", 10],
    ["logging_complex_03su", 10],
    ["bunker_structure_10", 121],
    ["oasis_01sv", 69],
    ["perch_01", 13],
    ["warehouse_03sv", 64],
    ["bunker_structure_09", 65],
    ["cache_01cb", 8],
    ["cache_02cb", 8],
    ["cache_04cb", 8],
    ["teahouse_complex_01cb", 38],
    ["cache_06cb", 8],
    ["cache_03tr", 8],
    ["hut_01bh", 38],
    ["hut_04", 46],
    ["cache_01bh", 8],
    ["cache_02bh", 8],
    ["cache_07bh", 8],
    ["mansion_structure_03", 70],
    ["cache_06bh", 8],
];
const DEFAULT = new Set(["warehouse_03", "workshop_complex_01", "bunker_structure_09", "hut_04", "perch_01"]);
/** close-ups of the big structures' buildings: [structure, child building, size shown, layer] */
const CLOSEUPS: ReadonlyArray<readonly [string, string, number, number]> = [
    ["desert_town_02", "reserve_01", 70, 0],
    ["desert_town_02", "reserve_basement_01", 70, 1],
    ["bunker_structure_10", "bunker_cloud_sublevel_01", 46, 1],
    ["bunker_structure_09", "bunker_twins_sublevel_01", 60, 1],
    ["mansion_structure_03", "mansion_03", 50, 0],
    ["mansion_structure_03", "mansion_cellar_03", 30, 1],
    ["barn_02x", "barn_basement_floor_01", 30, 1],
];

/** m4-helpers boot, without its sprite count wait: a lone cache draws only a handful of sprites. */
async function boot(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 45_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
}

/** Places the player outside the object, centres the camera on it; returns its underground room (if any). */
async function frame(page: Page, type: string, size: number) {
    return page.evaluate(
        ({ type, size }) => {
            const r = (window as any).__rebirth;
            const game = r.game;
            const objs = game.generation.objects as Array<any>;
            const root = objs.find((o) => o.parentId === 0 && o.type === type);
            // Cobalt: pick a class first, its menu covers the screen
            if (!game.getPlayer(r.player.id).role && game.selectRole) game.selectRole(r.player.id, "scout");
            const me = game.getPlayer(r.player.id);
            // a view radius of 300 units for every scope: the snapshot carries the whole object (the player stands beside
            // it, outside every zoom region, which would shrink the view)
            me.zoomRadius = Object.fromEntries(Object.keys(me.zoomRadius).map((k) => [k, 300]));
            // underground rooms are zoom regions, which set their own small view: keep 300 there too
            const updateZoom = me.updateZoom.bind(me);
            me.updateZoom = (objs: unknown) => {
                updateZoom(objs);
                me.zoom = 300;
            };
            game.teleportPlayer(me.id, { x: root.pos.x - size / 2 - 8, y: root.pos.y }, 0);
            r.cameraAt = { x: root.pos.x, y: root.pos.y };
            // the first descendant on the underground layer
            const ids = new Set([root.id]);
            let under: any = null;
            for (const o of objs) {
                if (!ids.has(o.parentId)) continue;
                ids.add(o.id);
                if (!under && o.layer === 1 && o.kind === "building") under = o;
            }
            return under ? { x: under.pos.x, y: under.pos.y } : null;
        },
        { type, size },
    );
}

async function shoot(page: Page, file: string): Promise<void> {
    await page.waitForTimeout(1500);
    await page.locator("canvas").first().screenshot({ path: file });
}

const types = process.env.PARITY_ALL ? ALL : ALL.filter(([t]) => DEFAULT.has(t));

test.describe("survev building visual parity", () => {
    for (const [type, size] of types) {
        test(`${type}: roof, floor plan and underground`, async ({ page }) => {
            test.setTimeout(90_000);
            const errors = collectErrors(page);
            // the camera shows about 0.93 x zoom units from top to bottom (1280 x 720)
            const zoom = Math.min(190, Math.max(14, Math.ceil(size * 1.1 + 6)));
            await boot(page, `/?building=${type}&seed=1&zoom=${zoom}`);
            const under = await frame(page, type, size);
            await shoot(page, `${SCREENS}/${type}-roof.png`);
            await page.evaluate(() => {
                (window as any).__rebirth.hideRoofs = true;
            });
            await shoot(page, `${SCREENS}/${type}-floor.png`);
            if (under) {
                await page.evaluate((at) => {
                    const r = (window as any).__rebirth;
                    r.game.teleportPlayer(r.player.id, at, 1);
                    r.cameraAt = at;
                }, under);
                await shoot(page, `${SCREENS}/${type}-underground.png`);
            }
            const missing = await page.evaluate(() => [...((window as any).__rebirth.missingSprites ?? [])]);
            expect(missing).toEqual([]);
            expect(errors).toEqual([]);
        });
    }
});

test.describe("survev building visual parity: close-ups", () => {
    for (const [type, child, size, layer] of process.env.PARITY_ALL ? CLOSEUPS : CLOSEUPS.slice(0, 1)) {
        test(`${child} in ${type}`, async ({ page }) => {
            test.setTimeout(90_000);
            const errors = collectErrors(page);
            const zoom = Math.ceil(size * 1.1 + 6);
            await boot(page, `/?building=${type}&seed=1&zoom=${zoom}`);
            await frame(page, type, size);
            await page.evaluate(
                ({ child, layer }) => {
                    const r = (window as any).__rebirth;
                    const c = r.game.generation.objects.find((o: any) => o.type === child);
                    const at = { x: c.pos.x, y: c.pos.y };
                    // underground: stand in the room; on the surface the player stays beside the structure (frame)
                    if (layer) r.game.teleportPlayer(r.player.id, at, layer);
                    r.cameraAt = at;
                },
                { child, layer },
            );
            await shoot(page, `${SCREENS}/closeup-${child}.png`);
            await page.evaluate(() => {
                (window as any).__rebirth.hideRoofs = true;
            });
            await shoot(page, `${SCREENS}/closeup-${child}-floor.png`);
            expect(errors).toEqual([]);
        });
    }
});
