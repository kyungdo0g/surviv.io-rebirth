// The owner's 2026-10-10 sheet in the loopback sandbox (docs/research/rebirth-deviations.md "Molotov and flashbang",
// "Discarded launchers"): an NLAW fired empty drops its body at the shooter's feet, the five launcher bodies lie
// turned to their facings; the Molotov in the hand, on the ground as loot and burning where it lands; the flashbang
// whites the screen out. Screenshots go to __screens__/decals-throwables (gitignored): with the owner's sheet
// installed (pnpm assets) they show its art, else the stand-ins.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";
import { aimAt, keepLocalAlive, localPos } from "./m5-helpers.ts";

const SCREENS = "tests/e2e/__screens__/decals-throwables";

/** Object types of the latest snapshot. */
async function objectTypes(page: Page): Promise<string[]> {
    return page.evaluate(() => ((window as any).__rebirth.lastSnapshot?.objects ?? []).map((o: any) => o.type));
}

test.describe("Molotov, flashbang and discarded launchers", () => {
    test("an NLAW fired empty leaves its body; every launcher body lies along its facing", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=nlaw");
        const me = await localPos(page);
        await aimAt(page, { x: me.x + 20, y: me.y + 6 });
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.mouse.up();
        await expect.poll(() => objectTypes(page), { timeout: 10_000 }).toContain("decal_nlaw_discard");
        // the other bodies around the player, each turned another way (game.decals: the sim's timed decals)
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const p = g.getPlayer(r.player.id);
            const guns = ["bazooka", "pvg42", "m202", "panzerfaust"];
            guns.forEach((gun, i) => {
                const a = (i / guns.length) * Math.PI * 2 + 0.6;
                const pos = { x: p.pos.x + Math.cos(a) * 6, y: p.pos.y + Math.sin(a) * 6 };
                g.decals.spawn(`decal_${gun}_discard`, pos, p.layer, { rot: a - Math.PI / 2 });
            });
        });
        await expect
            .poll(async () => (await objectTypes(page)).filter((t) => t.endsWith("_discard")).length, {
                timeout: 5000,
            })
            .toBe(5);
        await page.mouse.move(640, 600);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCREENS}/launcher-decals.png` });
        // a rotated decal decodes with its rotation
        const rots = await page.evaluate(() =>
            ((window as any).__rebirth.lastSnapshot.objects as any[])
                .filter((o) => o.type.endsWith("_discard"))
                .map((o) => o.rot ?? 0),
        );
        expect(rots.filter((r) => Math.abs(r) > 0.01).length).toBeGreaterThanOrEqual(4);
        expect(errors).toEqual([]);
    });

    test("the Molotov in the hand, as loot, and burning where it lands", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=molotov,flashbang");
        const stop = await keepLocalAlive(page);
        const me = await localPos(page);
        // the two throwables as loot beside the player
        await page.evaluate((me) => {
            const g = (window as any).__rebirth.game;
            g.loot.addLoot("molotov", { x: me.x - 4, y: me.y + 3 }, 0, 1);
            g.loot.addLoot("flashbang", { x: me.x - 1.5, y: me.y + 3 }, 0, 1);
        }, me);
        await aimAt(page, { x: me.x + 9, y: me.y });
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.curWeapIdx)).toBe(3);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const l = (window as any).__rebirth.local;
                    return l.weapons[3].type;
                }),
            )
            .toBe("molotov");
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/molotov-held-and-loot.png` });
        await page.mouse.down();
        await page.waitForTimeout(250);
        await page.mouse.up();
        await expect.poll(() => objectTypes(page), { timeout: 20_000 }).toContain("decal_molotov_fire");
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/molotov-fire.png` });
        await stop();
        expect(errors).toEqual([]);
    });

    test("a flashbang whites the screen out and muffles the sound", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=flashbang");
        const me = await localPos(page);
        await page.keyboard.press("4");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.weapons[3].type)).toBe("flashbang");
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/flashbang-held.png` });
        await aimAt(page, { x: me.x + 6, y: me.y });
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.mouse.up();
        // the 2.5 s fuse in simulation time (a loaded machine runs the sandbox slower than real time)
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.game.explosions.count), { timeout: 30_000 })
            .toBeGreaterThan(0);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.client.flashFx.count), { timeout: 10_000 })
            .toBeGreaterThan(0);
        await page.waitForTimeout(300);
        const state = await page.evaluate(() => {
            const c = (window as any).__rebirth.client;
            return { shown: c.flashFx.shown, deaf: c.audio.deafness };
        });
        expect(state.shown).toBeGreaterThan(0.8);
        expect(state.deaf).toBeGreaterThan(0.5);
        await page.screenshot({ path: `${SCREENS}/flashbang-whiteout.png` });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.client.flashFx.shown), { timeout: 15_000 })
            .toBeLessThan(0.6);
        await page.screenshot({ path: `${SCREENS}/flashbang-fading.png` });
        expect(errors).toEqual([]);
    });
});
