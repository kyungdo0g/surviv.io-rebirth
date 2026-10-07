// Rebirth air strike variants and blast radii on the client (docs/research/rebirth-deviations.md), against the
// loopback 50v50 map (?map=faction): a forced heavy-shell zone and a forced carpet zone reach the client with their
// variant (zone colour, ping tint, announcement), the carpet zone sends 6 planes, the heavy shells burst at the size of
// their 38 u radius and leave a matching scorch, a normal zone keeps the original yellow marker without an
// announcement, and the frag burst and scorch follow its x1.3 radius. Zones are forced through the sandbox Game
// (window.__rebirth.game.planes.zones.addZone, as m5.spec.ts does). Screenshots go to __screens__/airstrike-variants.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";
import { keepLocalAlive } from "./m5-helpers.ts";

const SCREENS = "tests/e2e/__screens__/airstrike-variants";

/** Forces a zone of `variant` `dx` units east of the local player; returns its centre. */
async function forceZone(page: Page, variant: string, dx: number): Promise<{ x: number; y: number }> {
    return page.evaluate(
        ({ variant, dx }) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const p = g.getPlayer(r.player.id).pos;
            const pos = { x: p.x + dx, y: p.y + 4 };
            // aim radius 10, 3 planes (the carpet variant fixes 6), 1 s warning, a plane every 1.2 s
            g.planes.zones.addZone(pos, 10, 3, 1, 1.2, variant);
            return pos;
        },
        { variant, dx },
    );
}

async function zoneList(page: Page): Promise<Array<{ variant: string; pos: { x: number; y: number }; rad: number }>> {
    return page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones);
}

/**
 * Records every projectile type the client is sent from now on in window.__rebirth.projectileTypesSeen, so a short
 * bomb run is not missed while the test takes screenshots (the heavy strike drops all its shells within ~10 s).
 */
async function recordProjectiles(page: Page): Promise<void> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.projectileTypesSeen = [];
        let frames = 0;
        const tick = () => {
            for (const o of r.lastSnapshot?.projectiles ?? []) {
                if (!r.projectileTypesSeen.includes(o.type)) r.projectileTypesSeen.push(o.type);
            }
            if (frames++ < 3600) requestAnimationFrame(tick);
        };
        tick();
    });
}

/** Types of the decals in the latest snapshot. */
async function decalTypes(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        ((window as any).__rebirth.lastSnapshot.objects ?? [])
            .filter((o: any) => o.kind === "decal")
            .map((o: any) => o.type),
    );
}

async function minimapShot(page: Page, path: string): Promise<void> {
    const rect = await page.evaluate(() => (window as any).__rebirth.minimap.rect);
    await page.screenshot({
        path,
        clip: { x: 0, y: rect.y - 10, width: rect.x + rect.width + 16, height: rect.height + 20 },
    });
}

/** Records the strongest camera shake from now on in window.__rebirth.maxShake. */
async function recordShake(page: Page): Promise<void> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.maxShake = 0;
        let frames = 0;
        const tick = () => {
            r.maxShake = Math.max(r.maxShake, r.fx.shake);
            if (frames++ < 1200) requestAnimationFrame(tick);
        };
        tick();
    });
}

test.describe("50v50 air strike variants", () => {
    test("a heavy shell zone: red marker and ping, its announcement, big shells and bursts", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?map=faction&loot=0&give=4xscope");
        const stopKeepAlive = await keepLocalAlive(page);
        const planesBefore = await page.evaluate(() => (window as any).__rebirth.strikePlanesSeen as number);
        // record from the start: the bombs may all have fallen by the time the screenshots below are taken
        await recordShake(page);
        await recordProjectiles(page);
        const pos = await forceZone(page, "heavy", 24);

        await expect
            .poll(async () => (await zoneList(page)).map((z) => z.variant), { timeout: 5_000 })
            .toEqual(["heavy"]);
        const zone = (await zoneList(page))[0];
        expect(zone.pos).toEqual(pos);
        // the shown radius grows by the heavy shells' extra reach (38 - 14)
        expect(zone.rad).toBe(10 + 24);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones[0].color)).toBe(0xff3c1e);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.match.announcement))
            .toBe("Heavy shell strike incoming");
        // the ping_airstrike marker's edge indicator takes the heavy colour
        expect(await page.evaluate(() => (window as any).__rebirth.fx.pingTint)).toBe(0xff3c1e);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones[0].alpha), { timeout: 5_000 })
            .toBeGreaterThan(0.9);
        await minimapShot(page, `${SCREENS}/heavy-minimap.png`);
        await page.screenshot({ path: `${SCREENS}/heavy-zone.png` });

        // the planes drop heavy shells (drawn bigger than iron bombs)
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.projectileTypesSeen), { timeout: 20_000 })
            .toContain("bomb_heavy");
        await page.screenshot({ path: `${SCREENS}/heavy-falling.png` });
        // each burst is the iron bomb's (scale 2 for 14 u) grown to the 38 u radius
        await page.waitForFunction(() => (window as any).__rebirth.fx.burstScale("explosion_bomb_heavy") > 0, null, {
            timeout: 20_000,
        });
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${SCREENS}/heavy-explosion.png` });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.burstScale("explosion_bomb_heavy"))).toBeCloseTo(
            (2 * 38) / 14,
            5,
        );
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("explosionBombHeavy"))).toBeGreaterThan(
            0,
        );
        // the shells leave the heavy scorch mark (the iron bomb's grown by 38 / 14), not the iron bomb's
        await expect.poll(() => decalTypes(page), { timeout: 5_000 }).toContain("decal_bomb_heavy_explosion");
        // the planes keep the map's count (3)
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.strikePlanesSeen - 0), { timeout: 20_000 })
            .toBe(planesBefore + 3);
        expect(await page.evaluate(() => (window as any).__rebirth.maxShake)).toBeGreaterThan(0);
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });

    test("a carpet zone: magenta marker, Korean announcement and six planes", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?map=faction&loot=0&give=4xscope&lang=ko");
        const stopKeepAlive = await keepLocalAlive(page);
        const planesBefore = await page.evaluate(() => (window as any).__rebirth.strikePlanesSeen as number);
        await forceZone(page, "carpet", 20);

        await expect
            .poll(async () => (await zoneList(page)).map((z) => z.variant), { timeout: 5_000 })
            .toEqual(["carpet"]);
        expect((await zoneList(page))[0].rad).toBe(10);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones[0].color)).toBe(0xe040ff);
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.match.announcement)).toBe("대공습 경보");
        expect(await page.evaluate(() => (window as any).__rebirth.fx.pingTint)).toBe(0xe040ff);
        await page.waitForTimeout(600);
        await minimapShot(page, `${SCREENS}/carpet-minimap.png`);
        await page.screenshot({ path: `${SCREENS}/carpet-zone.png` });

        // six passes instead of the map's three, dropping ordinary iron bombs
        await page.waitForFunction(() => (window as any).__rebirth.fx.burstScale("explosion_bomb_iron") > 0, null, {
            timeout: 20_000,
        });
        await page.screenshot({ path: `${SCREENS}/carpet-bombing.png` });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.strikePlanesSeen - 0), { timeout: 30_000 })
            .toBe(planesBefore + 6);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.burstScale("explosion_bomb_iron"))).toBe(2);
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });

    test("a normal zone keeps the v0.8.82 look: the yellow marker and no announcement", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await boot(page, "/?map=faction&loot=0&give=4xscope");
        const stopKeepAlive = await keepLocalAlive(page);
        await forceZone(page, "normal", 24);

        await expect
            .poll(async () => (await zoneList(page)).map((z) => z.variant), { timeout: 5_000 })
            .toEqual(["normal"]);
        expect((await zoneList(page))[0].rad).toBe(10);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones[0].color)).toBe(0xeaff00);
        // only heavy and carpet zones are announced (gas announcements may still show here)
        await page.waitForTimeout(1_000);
        expect(String(await page.evaluate(() => (window as any).__rebirth.match.announcement ?? ""))).not.toMatch(
            /air strike|shell strike|carpet|공습/i,
        );
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });

    test("the frag burst follows the x1.3 radius; the MIRV keeps the original size", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await boot(page, "/?map=faction&loot=0");
        const stopKeepAlive = await keepLocalAlive(page);
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const p = g.getPlayer(r.player.id).pos;
            // side by side on open ground west of the spawn (frag above, MIRV below)
            g.explosions.add("explosion_frag", { x: p.x - 13, y: p.y + 6 }, 0, { damageType: 0 });
            g.explosions.add("explosion_mirv", { x: p.x - 13, y: p.y - 6 }, 0, { damageType: 0 });
        });
        await page.waitForFunction(
            () =>
                (window as any).__rebirth.fx.burstScale("explosion_frag") > 0 &&
                (window as any).__rebirth.fx.burstScale("explosion_mirv") > 0,
            null,
            { timeout: 10_000 },
        );
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${SCREENS}/frag-vs-mirv.png` });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.burstScale("explosion_frag"))).toBeCloseTo(
            1.3,
            5,
        );
        expect(await page.evaluate(() => (window as any).__rebirth.fx.burstScale("explosion_mirv"))).toBe(1);
        // scorch marks: the frag's x1.3 decal, the MIRV's original one
        await expect.poll(() => decalTypes(page), { timeout: 5_000 }).toContain("decal_frag_large_explosion");
        expect(await decalTypes(page)).toContain("decal_frag_explosion");
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });
});
