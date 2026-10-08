// Rebirth rainy matches (user/2026-10-08-rain; fx/weather.ts) in the loopback sandbox with ?rain=1 (seed 1 of main is
// dry by its own roll, so the override is what makes it rain): streaks, rings and the world tint are drawn, the tint sits
// under the red zone and the UI (the minimap keeps its colours), no streak falls over the roof the player stands under
// while it keeps raining around the house, none in a bunker, the drops on the 50v50 river bridge ripple only on the
// water and splash on the deck, the Weather effects setting turns it off, ?rain=0 keeps a match dry, and the frame time
// of an 80-player fight with the rain on stays close to the dry one. Hooks: window.__rebirth.worldFeel.rain
// (sandbox.ts), client.particles and client.worldQueries, config (debugM8.ts), game (the sandbox Game). Screenshots go
// to $RAIN_SCREENS (default __screens__/rain): rain-1x.png, rain-off.png, rain-indoors.png, rain-bunker.png,
// rain-bridge.png.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = process.env.RAIN_SCREENS ?? "tests/e2e/__screens__/rain";
const RAINY = "/?sandbox=1&map=main&seed=1&loot=0&rain=1";

interface Pos {
    x: number;
    y: number;
}

interface Box {
    min: Pos;
    max: Pos;
}

interface RainState {
    enabled: boolean;
    running: boolean;
    rainAlpha: number;
    tint: number;
    drops: number;
    splashes: number;
    ripples: number;
    roofs: number;
}

async function rain(page: Page): Promise<RainState | null> {
    return page.evaluate(() => (window as any).__rebirth.worldFeel.rain as RainState | null);
}

/** Stops the renderer (the frame stays on screen) for a screenshot; `resume` starts it again. */
async function pause(page: Page): Promise<void> {
    await page.evaluate(() => (window as any).__rebirth.client.app.ticker.stop());
}

async function resume(page: Page): Promise<void> {
    await page.evaluate(() => (window as any).__rebirth.client.app.ticker.start());
}

/** Mean RGB (0-255) of a screen rectangle of a screenshot, decoded in the page. */
async function meanColor(page: Page, png: Buffer, r: { x: number; y: number; w: number; h: number }) {
    return page.evaluate(
        async ({ data, r }) => {
            const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
            const bmp = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(bmp, 0, 0);
            const px = ctx.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)).data;
            const sum = [0, 0, 0];
            for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += px[i + c];
            const n = px.length / 4;
            return { r: sum[0] / n, g: sum[1] / n, b: sum[2] / n };
        },
        { data: png.toString("base64"), r },
    );
}

/**
 * Teleports the local player into the first ground-floor house whose roof covers a free spot; returns that spot and the
 * house's zoomIn regions (its roof).
 */
async function intoHouse(page: Page): Promise<{ spot: Pos; roof: Box[] }> {
    const spot = await page.evaluate(() => {
        const r = (window as any).__rebirth;
        const g = r.game;
        const me = g.getPlayer(r.player.id).pos;
        const houses = [...g.world.objects.values()]
            .filter(
                (o: any) =>
                    o.kind === "building" &&
                    o.layer === 0 &&
                    /^(house_red|cabin)_0/.test(o.type) &&
                    o.zoomRegions.length,
            )
            .sort(
                (a: any, b: any) =>
                    Math.hypot(a.pos.x - me.x, a.pos.y - me.y) - Math.hypot(b.pos.x - me.x, b.pos.y - me.y),
            );
        for (const h of houses as any[]) {
            for (const z of h.zoomRegions) {
                const b = z.zoomIn;
                if (!b) continue;
                // the free spot nearest the middle of the room, 2 units inside its walls
                const mid = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 };
                const spots: Array<{ x: number; y: number }> = [];
                for (let x = b.min.x + 2; x <= b.max.x - 2; x += 0.5) {
                    for (let y = b.min.y + 2; y <= b.max.y - 2; y += 0.5) spots.push({ x, y });
                }
                spots.sort((a, c) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(c.x - mid.x, c.y - mid.y));
                // clear of every live collidable obstacle (walls, furniture) by more than a player's radius
                const obstacles = [...g.world.objects.values()].filter(
                    (o: any) => o.kind === "obstacle" && o.collidable && !o.dead && o.layer === 0,
                ) as any[];
                const free = (q: { x: number; y: number }) =>
                    !obstacles.some(
                        (o) =>
                            q.x > o.bounds.min.x - 1.5 &&
                            q.x < o.bounds.max.x + 1.5 &&
                            q.y > o.bounds.min.y - 1.5 &&
                            q.y < o.bounds.max.y + 1.5,
                    );
                const p = spots.find(free);
                if (p) {
                    g.teleportPlayer(r.player.id, p, 0);
                    const roof = h.zoomRegions.filter((zr: any) => zr.zoomIn).map((zr: any) => zr.zoomIn);
                    return { spot: p, roof };
                }
            }
        }
        return null;
    });
    expect(spot, "a house with a free spot under its roof").not.toBeNull();
    return spot as { spot: Pos; roof: Box[] };
}

/**
 * Watches the live rain streaks for `frames` animation frames: how many were seen in all and how many stood inside
 * `boxes` (world positions).
 */
async function streaksIn(page: Page, boxes: Box[], frames: number): Promise<{ seen: number; inside: number }> {
    return page.evaluate(
        async ({ boxes, frames }) => {
            const ps = (window as any).__rebirth.client.particles;
            let seen = 0;
            let inside = 0;
            for (let i = 0; i < frames; i++) {
                await new Promise((res) => requestAnimationFrame(res));
                for (const p of ps.particles) {
                    if (p.type !== "rain") continue;
                    seen++;
                    const { x, y } = p.pos;
                    if (boxes.some((b) => x >= b.min.x && x <= b.max.x && y >= b.min.y && y <= b.max.y)) inside++;
                }
            }
            return { seen, inside };
        },
        { boxes, frames },
    );
}

/**
 * Teleports the local player to the top of the bunker's entrance stairs and walks down them until it is underground.
 */
async function intoBunker(page: Page): Promise<void> {
    const key = await page.evaluate(() => {
        const r = (window as any).__rebirth;
        const g = r.game;
        const s = [...g.world.objects.values()].find(
            (o: any) => o.kind === "structure" && o.type === "bunker_structure_08",
        ) as any;
        const st = s.stairs[0];
        const c = st.collision;
        const center = { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
        const d = st.downDir;
        const half = Math.abs(d.x) > 0.5 ? (c.max.x - c.min.x) / 2 : (c.max.y - c.min.y) / 2;
        g.teleportPlayer(r.player.id, { x: center.x - d.x * (half + 1.5), y: center.y - d.y * (half + 1.5) }, 0);
        return d.x > 0.5 ? "KeyD" : d.x < -0.5 ? "KeyA" : d.y > 0.5 ? "KeyW" : "KeyS";
    });
    await page.waitForTimeout(500);
    await page.keyboard.down(key);
    await expect
        .poll(() => page.evaluate(() => (window as any).__rebirth.local.layer), { timeout: 15_000, intervals: [30] })
        .toBe(1);
    await page.keyboard.up(key);
}

/**
 * Fills the sandbox up to `total` players in a 9 x 9 grid around the local player, all on screen, kept alive (every
 * hit restores its target's health first). Returns the other players' ids (as in hit-feedback.spec.ts).
 */
async function crowd(page: Page, total: number): Promise<number[]> {
    return page.evaluate((total) => {
        const r = (window as any).__rebirth;
        const g = r.game;
        const me = g.getPlayer(r.player.id);
        const ids: number[] = [...r.dummies];
        while (ids.length < total - 1) ids.push(g.addPlayer(`crowd ${ids.length + 1}`));
        let k = 0;
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (i === 4 && j === 4) continue;
                if (k < ids.length)
                    g.teleportPlayer(ids[k++], { x: me.pos.x + (i - 4) * 3.2, y: me.pos.y + (j - 4) * 3 });
            }
        }
        const proto = Object.getPrototypeOf(g);
        g.damagePlayer = function (target: { health: number }, params: unknown) {
            target.health = 100;
            return proto.damagePlayer.call(this, target, params);
        };
        return ids;
    }, total);
}

/**
 * Starts (or stops) `count` crowd players firing AK-47s at a neighbour, re-armed, reloaded and re-aimed every second.
 */
async function crowdFire(page: Page, ids: number[], count: number, on: boolean): Promise<void> {
    await page.evaluate(
        ({ ids, count, on }) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            clearInterval(r.__crowdFire);
            const pairs: Array<[number, number]> = [];
            for (let k = 0; k < count; k++) pairs.push([ids[k * 3], ids[(k * 3 + 1) % ids.length]]);
            const aim = (fire: boolean) => {
                for (const [id, targetId] of pairs) {
                    const p = g.getPlayer(id);
                    const t = g.getPlayer(targetId);
                    if (!p || !t) continue;
                    if (fire && p.weaponManager.weapons[0].type !== "ak47") {
                        p.backpack = "backpack03";
                        p.weaponManager.setWeapon(0, "ak47", 30);
                        p.weaponManager.setCurWeapIndex(0);
                        p.weaponManager.freeSwitchTimer = 0;
                    }
                    if (fire) {
                        p.inv.set("762mm", 300);
                        // a full magazine every second (10 rounds a second): nobody reloads, so the fight's load stays
                        // the same in every sample instead of dropping while all of them reload together
                        p.weaponManager.weapons[0].ammo = 30;
                    }
                    const dx = t.pos.x - p.pos.x;
                    const dy = t.pos.y - p.pos.y;
                    const len = Math.hypot(dx, dy);
                    g.setInput(id, {
                        ...p.input,
                        toMouseDir: { x: dx / len, y: dy / len },
                        toMouseLen: len,
                        shootStart: fire,
                        shootHold: fire,
                        actions: [],
                    });
                }
            };
            aim(on);
            if (on) r.__crowdFire = setInterval(() => aim(true), 1000);
            else delete r.game.damagePlayer;
        },
        { ids, count, on },
    );
}

test.describe("rainy matches", () => {
    test("a forced rainy match: streaks, rings and the world tint under an untinted HUD", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, RAINY);
        await expect.poll(async () => (await rain(page))?.drops ?? 0, { timeout: 15_000 }).toBeGreaterThan(60);
        await expect.poll(async () => (await rain(page))?.splashes ?? 0, { timeout: 10_000 }).toBeGreaterThan(5);
        const s = (await rain(page))!;
        expect(s.enabled).toBe(true);
        expect(s.running).toBe(true);
        expect(s.rainAlpha).toBeGreaterThan(0.95);
        expect(s.tint).toBe(1);
        expect(s.drops).toBeLessThanOrEqual(240);
        // the tint is a multiply quad over the world, under the red zone, the screen effects and the UI overlay
        const scene = await page.evaluate(() => {
            const c = (window as any).__rebirth.client;
            const tint = c.renderer.weather.children[0];
            return {
                stage: c.app.stage.children.map((ch: any) => ch.label),
                blend: tint?.blendMode,
                size: [tint?.width, tint?.height],
                screen: [c.app.screen.width, c.app.screen.height],
                minimap: c.minimap?.rect ?? null,
            };
        });
        expect(scene.stage).toEqual(["world", "weather", "gas", "screen-fx", "overlay"]);
        expect(scene.blend).toBe("multiply");
        expect(scene.size).toEqual(scene.screen);
        await pause(page);
        const wet = await page.screenshot({ path: `${SCREENS}/rain-1x.png` });
        await resume(page);

        // the setting off: no streaks, no tint
        await page.evaluate(() => (window as any).__rebirth.config.set("weatherFx", false));
        await expect.poll(async () => (await rain(page))?.tint, { timeout: 5_000 }).toBe(0);
        await expect.poll(async () => (await rain(page))?.drops, { timeout: 5_000 }).toBe(0);
        expect((await rain(page))?.running).toBe(false);
        await pause(page);
        const dry = await page.screenshot({ path: `${SCREENS}/rain-off.png` });
        await resume(page);

        // the world is darker and cooler under the rain: a patch of ground left of the player
        const ground = { x: 120, y: 200, w: 260, h: 140 };
        const w = await meanColor(page, wet, ground);
        const d = await meanColor(page, dry, ground);
        console.log(`ground with rain ${JSON.stringify(w)}, without ${JSON.stringify(d)}`);
        expect(w.r).toBeLessThan(d.r * 0.9);
        expect(w.g).toBeLessThan(d.g * 0.93);
        expect(w.b / d.b).toBeGreaterThan(w.r / d.r);
        // still light: far from the Halloween night
        expect(w.g).toBeGreaterThan(d.g * 0.7);
        // the minimap (UI overlay, drawn over the tint) keeps its colours: at most the faint world showing through it
        const mm = scene.minimap as { x: number; y: number; width: number; height: number } | null;
        expect(mm).not.toBeNull();
        const inner = {
            x: mm!.x + mm!.width * 0.3,
            y: mm!.y + mm!.height * 0.3,
            w: mm!.width * 0.4,
            h: mm!.height * 0.4,
        };
        const mw = await meanColor(page, wet, inner);
        const md = await meanColor(page, dry, inner);
        console.log(`minimap with rain ${JSON.stringify(mw)}, without ${JSON.stringify(md)}`);
        for (const c of ["r", "g", "b"] as const) expect(Math.abs(mw[c] - md[c]) / md[c]).toBeLessThan(0.04);

        // back on
        await page.evaluate(() => (window as any).__rebirth.config.set("weatherFx", true));
        await expect.poll(async () => (await rain(page))?.drops ?? 0, { timeout: 10_000 }).toBeGreaterThan(60);
        await expect.poll(async () => (await rain(page))?.tint, { timeout: 5_000 }).toBe(1);
        expect(errors).toEqual([]);
    });

    test("no rain over the player's roof (it keeps raining around the house) nor in a bunker", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, `${RAINY}&dummies=1`);
        await expect.poll(async () => (await rain(page))?.drops ?? 0, { timeout: 15_000 }).toBeGreaterThan(60);
        const { roof } = await intoHouse(page);
        expect(roof.length).toBeGreaterThan(0);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.client.world.localIndoors()), {
                timeout: 10_000,
            })
            .toBe(true);
        await expect.poll(async () => (await rain(page))?.roofs ?? 0, { timeout: 5_000 }).toBeGreaterThan(0);
        // streaks keep falling at full strength on the open ground around the house, none over its roof
        const watched = await streaksIn(page, roof, 90);
        console.log(`indoors: ${watched.seen} streak frames, ${watched.inside} over the roof`);
        expect(watched.inside).toBe(0);
        expect(watched.seen / 90).toBeGreaterThan(30);
        const s = (await rain(page))!;
        expect(s.rainAlpha).toBeGreaterThan(0.95);
        expect(s.drops).toBeGreaterThan(30);
        // the dim daylight stays inside, and drops still land outside
        expect(s.tint).toBe(1);
        const splashes = s.splashes;
        await page.waitForTimeout(1000);
        expect((await rain(page))!.splashes).toBeGreaterThan(splashes);
        await pause(page);
        await page.screenshot({ path: `${SCREENS}/rain-indoors.png` });
        await resume(page);

        // a bunker: no streaks, no rings, no tint (the fades take a few frames: slow software GL under load)
        await intoBunker(page);
        await expect.poll(async () => (await rain(page))?.tint ?? 1, { timeout: 15_000 }).toBe(0);
        await expect.poll(async () => (await rain(page))?.drops ?? 1, { timeout: 15_000 }).toBe(0);
        const rings = (await rain(page))!;
        await page.waitForTimeout(1000);
        const later = (await rain(page))!;
        expect(later.splashes + later.ripples).toBe(rings.splashes + rings.ripples);
        await pause(page);
        await page.screenshot({ path: `${SCREENS}/rain-bunker.png` });
        await resume(page);
        expect(errors).toEqual([]);
    });

    test("the drops on the 50v50 river bridge ripple only on the water and splash on the deck", async ({ page }) => {
        test.setTimeout(240_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=faction&seed=1&loot=0&rain=1");
        const bridge = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const all = [...g.world.objects.values()] as any[];
            const br = all.find((o) => o.kind === "structure" && /^bridge_xlg_structure/.test(o.type));
            if (!br) return null;
            g.teleportPlayer(r.player.id, { x: br.pos.x, y: br.pos.y }, 0);
            return br.type as string;
        });
        expect(bridge, "the faction map's xlg river bridge").not.toBeNull();
        // settle on the deck, then watch every ring that lands for two seconds
        await page.waitForTimeout(1500);
        const rings = await page.evaluate(async () => {
            const c = (window as any).__rebirth.client;
            const ps = c.particles;
            const seen = new Set<unknown>();
            const out = { ripples: 0, offWater: 0, wrongColour: 0, splashes: 0, splashesOnWater: 0, onDeck: 0 };
            for (let i = 0; i < 120; i++) {
                await new Promise((res) => requestAnimationFrame(res));
                for (const p of ps.particles) {
                    if (seen.has(p) || (p.type !== "rainRipple" && p.type !== "rainSplash")) continue;
                    seen.add(p);
                    const ground = c.worldQueries.groundSurface(p.pos, 0);
                    if (p.type === "rainRipple") {
                        out.ripples++;
                        if (ground.type !== "water") out.offWater++;
                        else if (p.sprite.tint !== ground.rippleColor) out.wrongColour++;
                    } else {
                        out.splashes++;
                        if (ground.type === "water") out.splashesOnWater++;
                        // the xlg bridge's deck floor
                        else if (ground.type === "asphalt") out.onDeck++;
                    }
                }
            }
            return out;
        });
        console.log(`bridge ${bridge}: ${JSON.stringify(rings)}`);
        expect(rings.offWater).toBe(0);
        expect(rings.wrongColour).toBe(0);
        expect(rings.splashesOnWater).toBe(0);
        // the river around the deck ripples, the deck splashes
        expect(rings.ripples).toBeGreaterThan(5);
        expect(rings.onDeck).toBeGreaterThan(20);
        await pause(page);
        await page.screenshot({ path: `${SCREENS}/rain-bridge.png` });
        await resume(page);
        expect(errors).toEqual([]);
    });

    test("the Weather effects checkbox of the settings modal: on by default, en and ko, off keeps it dry", async ({
        page,
    }) => {
        const errors = collectErrors(page);
        await page.goto("/?menu=1&lang=ko");
        await page.waitForFunction(() => !!(window as any).__rebirth?.menu, null, { timeout: 30_000 });
        await page.locator("#btn-start-settings").click();
        const modal = page.locator("#modal-settings");
        await expect(modal).toBeVisible();
        const box = modal.locator("#weatherFx");
        const item = modal.locator(".modal-settings-item", { has: page.locator("#weatherFx") });
        await expect(box).toBeChecked();
        await expect(item).toHaveText("날씨 효과");
        // next to the other effect settings
        await expect(modal.locator(".modal-settings-item", { has: page.locator("#enhancedHitFx") })).toBeVisible();
        await modal.locator(".language-select").selectOption("en");
        await expect(item).toHaveText("Weather effects");
        await box.uncheck();
        await page.keyboard.press("Escape");
        // a rainy match with the setting off: no streaks, no rings, no tint
        await boot(page, RAINY);
        await page.waitForTimeout(1500);
        const s = (await rain(page))!;
        expect(s.enabled).toBe(false);
        expect(s.running).toBe(false);
        expect(s.tint).toBe(0);
        expect(s.drops).toBe(0);
        expect(s.splashes + s.ripples).toBe(0);
        await page.evaluate(() => (window as any).__rebirth.config.set("weatherFx", true));
        await expect.poll(async () => (await rain(page))?.drops ?? 0, { timeout: 10_000 }).toBeGreaterThan(60);
        expect(errors).toEqual([]);
    });

    test("?rain=0 keeps a match dry", async ({ page }) => {
        const errors = collectErrors(page);
        // seed 2 of main rolls rain on its own (packages/defs/test/weather.test.ts)
        await boot(page, "/?sandbox=1&map=main&seed=2&loot=0");
        await expect.poll(async () => (await rain(page))?.drops ?? 0, { timeout: 15_000 }).toBeGreaterThan(0);
        await boot(page, "/?sandbox=1&map=main&seed=2&loot=0&rain=0");
        await page.waitForTimeout(1000);
        expect(await rain(page)).toBeNull();
        expect(await page.evaluate(() => (window as any).__rebirth.client.renderer.weather.children.length)).toBe(0);
        expect(errors).toEqual([]);
    });

    test("frame time of an 80-player fight with the rain off and on", async ({ page }) => {
        test.setTimeout(540_000);
        const errors = collectErrors(page);
        await boot(page, `${RAINY}&give=ak47&dummies=16`);
        const ids = await crowd(page, 80);
        expect(ids.length).toBe(79);
        await crowdFire(page, ids, 24, true);
        await page.waitForTimeout(2000);
        const runs: Array<{ on: boolean; trimmedMs: number; medianMs: number; particles: number }> = [];
        try {
            for (const on of [false, true, false, true, false, true]) {
                await page.evaluate((on) => (window as any).__rebirth.config.set("weatherFx", on), on);
                await page.waitForTimeout(1000);
                const t = (await page.evaluate(() => (window as any).__rebirth.perf.sampleFrames(60))) as {
                    trimmedMs: number;
                    medianMs: number;
                };
                const particles = await page.evaluate(() => (window as any).__rebirth.renderer.particleCount as number);
                runs.push({ on, trimmedMs: t.trimmedMs, medianMs: t.medianMs, particles });
            }
        } finally {
            await crowdFire(page, ids, 24, false);
        }
        const best = (on: boolean) => Math.min(...runs.filter((r) => r.on === on).map((r) => r.trimmedMs));
        const drops = (await rain(page))?.drops ?? 0;
        console.log(
            `80-player frame time: rain off ${best(false).toFixed(2)} ms, on ${best(true).toFixed(2)} ms ` +
                `(trimmed, best of 3); runs ${JSON.stringify(runs)}; streaks alive ${drops}`,
        );
        expect(drops).toBeGreaterThan(0);
        expect(drops).toBeLessThanOrEqual(240);
        expect(best(true)).toBeLessThanOrEqual(best(false) * 1.15 + 1);
        expect(errors).toEqual([]);
    });
});
