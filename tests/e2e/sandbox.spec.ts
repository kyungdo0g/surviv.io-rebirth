// M1 sandbox: the loopback simulation rendered by the client (/?sandbox=1). Screenshots go to __screens__/M1.
import { expect, type Page, test } from "@playwright/test";

const SCREENS = "tests/e2e/__screens__/M1";
const SANDBOX = "/?sandbox=1&map=main&seed=1";
const TICK_HZ = 100;
/** player move speed with fists: GameConfig.player.moveSpeed 12 + fists speed.equip 1 */
const EXPECTED_SPEED = 13;

interface Sample {
    tick: number;
    pos: { x: number; y: number };
}

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });
    return errors;
}

async function boot(page: Page, query = SANDBOX) {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode !== undefined, null, { timeout: 30_000 });
    expect(await page.evaluate(() => (window as any).__rebirth.mode)).toBe("loopback");
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 45_000 });
    // let a few frames apply the loaded textures
    await page.waitForFunction(() => (window as any).__rebirth.renderer.spriteCount > 5, null, { timeout: 15_000 });
}

async function sample(page: Page): Promise<Sample> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        return { tick: r.tick, pos: r.player.pos };
    });
}

/** Waits until at least `ticks` more simulation ticks have run. */
async function waitTicks(page: Page, ticks: number) {
    const start = await page.evaluate(() => (window as any).__rebirth.tick);
    await page.waitForFunction((t) => (window as any).__rebirth.tick >= t, start + ticks, { timeout: 30_000 });
}

/**
 * Teleports the player to a grass spot where a straight `dist`-unit walk along `dir` is free of obstacles and
 * water, using the loopback Game's debug helpers (teleportPlayer, canPlayerSpawn). Keeps the spawn when it is
 * already clear.
 */
async function prepareClearRun(page: Page, dir: { x: number; y: number }, dist = 24) {
    const moved = await page.evaluate(
        ({ dir, dist }) => {
            const r = (window as any).__rebirth;
            const game = r.game;
            if (typeof game?.teleportPlayer !== "function" || typeof game?.canPlayerSpawn !== "function") return false;
            const clear = (p: { x: number; y: number }) => {
                for (let d = -2; d <= dist; d += 0.5) {
                    if (!game.canPlayerSpawn({ x: p.x + dir.x * d, y: p.y + dir.y * d })) return false;
                }
                return true;
            };
            const here = r.player.pos;
            if (clear(here)) return false;
            const { width, height } = game.mapData;
            for (let ring = 4; ring < width / 2; ring += 4) {
                for (let a = 0; a < 16; a++) {
                    const ang = (a / 16) * Math.PI * 2;
                    const p = { x: here.x + Math.cos(ang) * ring, y: here.y + Math.sin(ang) * ring };
                    if (p.x < 60 || p.y < 60 || p.x > width - 60 || p.y > height - 60) continue;
                    if (clear(p)) {
                        game.teleportPlayer(r.player.id, p);
                        return true;
                    }
                }
            }
            return false;
        },
        { dir, dist },
    );
    if (moved) await waitTicks(page, 20);
}

/** Holds `key` and measures the player's velocity from snapshot ticks and positions. */
async function measureWalk(page: Page, key: string): Promise<{ vx: number; vy: number; seconds: number }> {
    await page.keyboard.down(key);
    try {
        await waitTicks(page, 15); // input reaches the simulation, motion is steady
        const a = await sample(page);
        await page.waitForTimeout(1000);
        await waitTicks(page, 30);
        const b = await sample(page);
        const seconds = (b.tick - a.tick) / TICK_HZ;
        return { vx: (b.pos.x - a.pos.x) / seconds, vy: (b.pos.y - a.pos.y) / seconds, seconds };
    } finally {
        await page.keyboard.up(key);
    }
}

test.describe("loopback sandbox", () => {
    test("boots without page errors and renders the world", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page);
        await waitTicks(page, 30);
        const spawn = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            return {
                sprites: r.renderer.spriteCount,
                objects: r.renderer.objectCount,
                id: r.player.id,
            };
        });
        expect(spawn.id).toBeGreaterThan(0);
        expect(spawn.objects).toBeGreaterThan(5);
        expect(spawn.sprites).toBeGreaterThan(10);
        await page.screenshot({ path: `${SCREENS}/spawn.png` });

        // A 15x scope widens the zoom radius to 104 (GameConfig.scopeZoomRadius): the simulation streams the larger
        // view and the camera zooms out like the original, so far more of the map is on screen.
        const scoped = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const player = r.game.getPlayer?.(r.player.id);
            if (!player || !("scope" in player)) return false;
            player.scope = "15xscope";
            return true;
        });
        expect(scoped).toBe(true);
        await page.waitForFunction(() => (window as any).__rebirth.client.local?.zoom === 104, null, {
            timeout: 15_000,
        });
        await page.waitForFunction(() => (window as any).__rebirth.renderer.spriteCount > 100, null, {
            timeout: 20_000,
        });
        await page.waitForTimeout(2500); // zoom-out easing
        const wide = await page.evaluate(() => (window as any).__rebirth.renderer.spriteCount);
        expect(wide).toBeGreaterThan(100);
        await page.screenshot({ path: `${SCREENS}/spawn-15x.png` });

        const missing = await page.evaluate(() => (window as any).__rebirth.missingSprites as string[]);
        expect(missing.length).toBeLessThan(10);
        expect(errors).toEqual([]);
    });

    test("holding d moves the player +x at the original walk speed", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page);
        await prepareClearRun(page, { x: 1, y: 0 });
        const v = await measureWalk(page, "d");
        expect(v.seconds).toBeGreaterThan(0.5);
        expect(v.vx).toBeGreaterThan(EXPECTED_SPEED * 0.95);
        expect(v.vx).toBeLessThan(EXPECTED_SPEED * 1.05);
        expect(Math.abs(v.vy)).toBeLessThan(0.5);
        expect(errors).toEqual([]);
    });

    test("holding w moves the player +y", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page);
        await prepareClearRun(page, { x: 0, y: 1 });
        const v = await measureWalk(page, "w");
        expect(v.vy).toBeGreaterThan(EXPECTED_SPEED * 0.95);
        expect(v.vy).toBeLessThan(EXPECTED_SPEED * 1.05);
        expect(Math.abs(v.vx)).toBeLessThan(0.5);
        expect(errors).toEqual([]);
    });

    test("arrow keys move the player too", async ({ page }) => {
        await boot(page);
        await prepareClearRun(page, { x: -1, y: 0 });
        const v = await measureWalk(page, "ArrowLeft");
        expect(v.vx).toBeLessThan(-EXPECTED_SPEED * 0.95);
    });

    test("minimap is visible bottom-left and the debug HUD toggles with F3", async ({ page }) => {
        await boot(page);
        const mm = await page.evaluate(() => (window as any).__rebirth.minimap);
        expect(mm.visible).toBe(true);
        const viewport = page.viewportSize()!;
        expect(mm.rect.x).toBeGreaterThanOrEqual(0);
        expect(mm.rect.x).toBeLessThan(40);
        expect(mm.rect.width).toBeGreaterThan(150);
        expect(mm.rect.y + mm.rect.height).toBeGreaterThan(viewport.height - 40);
        expect(mm.rect.y + mm.rect.height).toBeLessThanOrEqual(viewport.height);
        await page.screenshot({
            path: `${SCREENS}/minimap.png`,
            clip: { x: mm.rect.x - 4, y: mm.rect.y - 4, width: mm.rect.width + 8, height: mm.rect.height + 8 },
        });

        expect(await page.evaluate(() => (window as any).__rebirth.hud.visible)).toBe(false);
        await page.keyboard.press("F3");
        await page.waitForFunction(() => (window as any).__rebirth.hud.visible === true, null, { timeout: 5_000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SCREENS}/debug-hud.png`, clip: { x: 0, y: 0, width: 360, height: 140 } });
    });

    test("buildings: roof outside, interior with the roof faded inside", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page);
        // pick a house from the map and stand just south of it, then inside it
        const house = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const objs = r.game.mapData.objects as Array<{
                id: number;
                type: string;
                pos: { x: number; y: number };
                ori: number;
            }>;
            const pick =
                objs.find((o) => o.type === "house_red_01" && o.ori === 0) ??
                objs.find((o) => o.type.startsWith("house_red"));
            return pick ?? null;
        });
        expect(house).not.toBeNull();
        await page.evaluate((h) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, { x: h.pos.x, y: h.pos.y - 22 });
        }, house!);
        await waitTicks(page, 40);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${SCREENS}/building-outside.png` });
        const outside = await page.evaluate(() => (window as any).__rebirth.renderer.spriteCount);
        expect(outside).toBeGreaterThan(10);
        const roofAlpha = (id: number) =>
            page.evaluate((id) => (window as any).__rebirth.client.world.renderOf(id)?.ceilingAlpha, id);
        expect(await roofAlpha(house!.id)).toBeGreaterThan(0.95);

        await page.evaluate((h) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, { x: h.pos.x, y: h.pos.y });
        }, house!);
        await waitTicks(page, 40);
        await page.waitForTimeout(1200); // ceiling fade
        await page.mouse.move(900, 220);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/building-inside.png` });
        expect(await roofAlpha(house!.id)).toBeLessThan(0.05);
        expect(errors).toEqual([]);
    });
});
