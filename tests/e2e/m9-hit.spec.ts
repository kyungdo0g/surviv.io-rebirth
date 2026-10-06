// M9 hits against the loopback simulation: flare rounds draw a growing flare, a killed dummy leaves a grey skull with
// its name (and the kill frame plays the flesh hit), blood splats ride on the hit player while it moves, and bullets on a
// held pan throw chips instead of blood. Hooks: window.__rebirth.hits (debugM9.ts), deadBodies(), fx.particles(type).
// Screenshots go to __screens__/M9 (hit-*.png).
import { expect, type Page, test } from "@playwright/test";

const SCREENS = "tests/e2e/__screens__/M9";

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

/** Points the cursor at the first dummy and waits until the local player faces it. */
async function aimAtDummy(page: Page): Promise<number> {
    const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
    expect(dummy).toBeGreaterThan(0);
    const target = await page.evaluate((id) => {
        const r = (window as any).__rebirth;
        return r.worldToScreen(r.visualPos(id));
    }, dummy);
    await page.mouse.move(target.x, target.y);
    await page.waitForFunction(
        (id) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const d = r.game.getPlayer(id);
            const dx = d.pos.x - me.pos.x;
            const dy = d.pos.y - me.pos.y;
            return (me.dir.x * dx + me.dir.y * dy) / Math.hypot(dx, dy) > 0.995;
        },
        dummy,
        { timeout: 10_000 },
    );
    return dummy;
}

test.describe("M9 hits", () => {
    test("a flare round draws a growing flare", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=flare_gun&dummies=1");
        await aimAtDummy(page);
        // aim past the dummy so the flare's path is in open ground
        await page.mouse.click(1100, 360);
        await page.waitForFunction(() => (window as any).__rebirth.hits.flares.count > 0, null, { timeout: 10_000 });
        // easeOutExpo(t / 2.5) x maxFlareScale 2: nearly full size after 1.5 s
        await page.waitForFunction(() => (window as any).__rebirth.hits.flares.scale > 1.5, null, { timeout: 10_000 });
        await page.screenshot({ path: `${SCREENS}/hit-flare.png` });
        const flares = await page.evaluate(() => (window as any).__rebirth.hits.flares);
        expect(flares.spawned).toBe(1);
        expect(flares.scale).toBeLessThanOrEqual(2);
        // a flare is not a tracer
        expect(await page.evaluate(() => (window as any).__rebirth.renderer.tracersSpawned)).toBe(0);
        expect(errors).toEqual([]);
    });

    test("a killed dummy leaves a grey skull with its name", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&dummies=1");
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        expect(await page.evaluate(() => (window as any).__rebirth.deadBodies())).toEqual([]);
        const at = await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const d = r.game.getPlayer(id);
            const pos = { x: d.pos.x, y: d.pos.y };
            // a hit of the local player pushing the body towards +y
            r.game.damagePlayer(d, { amount: 500, damageType: 0, sourceId: r.player.id, dir: { x: 0, y: 1 } });
            return pos;
        }, dummy);
        await page.waitForFunction(
            () => (window as any).__rebirth.deadBodies().some((b: any) => b.name && b.skull),
            null,
            { timeout: 10_000 },
        );
        // the body slides 10 / 4 = 2.5 units along the hit
        await page.waitForFunction((y) => (window as any).__rebirth.deadBodies()[0].pos.y - y > 2.45, at.y, {
            timeout: 10_000,
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/hit-skull.png` });
        const bodies = await page.evaluate(() => (window as any).__rebirth.deadBodies());
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).toMatchObject({ playerId: dummy, name: "dummy 1", skull: true });
        expect(bodies[0].pos.x).toBeCloseTo(at.x, 1);
        // the Kill message of a Player-damage kill plays the flesh hit (survev game.ts)
        expect(await page.evaluate(() => (window as any).__rebirth.hits.killSounds)).toBe(1);
        expect(errors).toEqual([]);
    });

    test("blood splats ride on a moving target", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=ak47&dummies=1");
        const dummy = await aimAtDummy(page);
        // the dummy walks away along the line of fire
        await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const d = r.game.getPlayer(id);
            r.game.setInput(id, { ...d.input, moveRight: true, shootStart: false, shootHold: false, actions: [] });
        }, dummy);
        await page.mouse.down();
        let samples: any;
        try {
            samples = await page.evaluate(async (id) => {
                const r = (window as any).__rebirth;
                const frame = () => new Promise((res) => requestAnimationFrame(res));
                const t0 = performance.now();
                while (r.hits.on(id) === 0) {
                    if (performance.now() - t0 > 10_000) return null;
                    await frame();
                }
                const first = r.hits.splats(id);
                const start = performance.now();
                while (performance.now() - start < 150) await frame();
                return { first, second: r.hits.splats(id) };
            }, dummy);
        } finally {
            await page.mouse.up();
        }
        await page.screenshot({ path: `${SCREENS}/hit-blood.png` });
        expect(samples).not.toBeNull();
        const { first, second } = samples;
        expect(first.splats.length).toBeGreaterThan(0);
        expect(second.splats.length).toBeGreaterThan(0);
        const moved = { x: second.player.x - first.player.x, y: second.player.y - first.player.y };
        // the target moved on screen...
        expect(Math.hypot(moved.x, moved.y)).toBeGreaterThan(5);
        // ...and the first splat moved with it (it stays at the impact offset on the player)
        const s0 = first.splats[0];
        const s1 = second.splats[0];
        expect(Math.abs(s1.x - s0.x - moved.x)).toBeLessThan(1.5);
        expect(Math.abs(s1.y - s0.y - moved.y)).toBeLessThan(1.5);
        const hits = await page.evaluate(() => (window as any).__rebirth.hits.bullets);
        expect(hits.blood).toBeGreaterThan(0);
        expect(hits.sounds).toBeGreaterThan(0);
        expect(errors).toEqual([]);
    });

    test("bullets on a held pan throw chips, not blood", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=ak47&dummies=1");
        const dummy = await aimAtDummy(page);
        // the dummy holds a pan, turned 15 degrees from the shooter so the pan covers its front
        await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const d = r.game.getPlayer(id);
            d.weaponManager.setWeapon(2, "pan", 0);
            d.weaponManager.setCurWeapIndex(2);
            const a = Math.PI + (15 * Math.PI) / 180;
            r.game.setInput(id, { ...d.input, toMouseDir: { x: Math.cos(a), y: Math.sin(a) }, actions: [] });
        }, dummy);
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.activeWeapon === "pan", dummy, {
            timeout: 10_000,
        });
        const chipsBefore = await page.evaluate(() => (window as any).__rebirth.fx.particles("barrelChip"));
        await page.mouse.down();
        try {
            await page.waitForFunction(() => (window as any).__rebirth.hits.bullets.pan >= 3, null, {
                timeout: 10_000,
            });
            await page.screenshot({ path: `${SCREENS}/hit-pan.png` });
        } finally {
            await page.mouse.up();
        }
        const state = await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            return { health: r.game.getPlayer(id).health, hits: r.hits.bullets, chips: r.fx.particles("barrelChip") };
        }, dummy);
        expect(state.chips - chipsBefore).toBeGreaterThanOrEqual(3);
        // the pan stopped every round: no blood, no damage
        expect(state.hits.blood).toBe(0);
        expect(state.health).toBe(100);
        expect(errors).toEqual([]);
    });
});
