// M9 world feel against the loopback simulation: obstacle break debris (crate planks, tree logs, barrel shards, window
// glass), the maps' falling camera particles (woods leaves, snow), water wading (ripples, splashes, the wading ring),
// bush entry effects, and a frame-time check of a busy scene. Particle counts come from window.__rebirth.fx.particles
// (spawned per type since boot) and the world-feel hooks (window.__rebirth.worldFeel). Screenshots go to __screens__/M9.
import { expect, type Page, test } from "@playwright/test";

const SCREENS = "tests/e2e/__screens__/M9";

interface StepCounts {
    steps: number;
    waterSteps: number;
    bush: number;
    surface: string;
    depth: number;
}

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

async function particles(page: Page, type: string): Promise<number> {
    return page.evaluate((t) => (window as any).__rebirth.fx.particles(t), type);
}

/** footsteps, splashes and bush effects of the local player's view */
async function steps(page: Page): Promise<StepCounts | null> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        return r.worldFeel.steps(r.player.id);
    });
}

/** Keeps the local player alive in the simulation (exploding barrels); returns a stop function. */
async function keepLocalAlive(page: Page): Promise<() => Promise<void>> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.keepAlive = setInterval(() => {
            const p = r.game.getPlayer(r.player.id);
            if (p && !p.dead) p.health = 100;
        }, 20);
    });
    return async () => {
        await page.evaluate(() => clearInterval((window as any).__rebirth.keepAlive));
    };
}

/**
 * Teleports the local player `dist` units (or more) from the nearest live ground-floor obstacle `kind` ("window" for
 * any breakable window) and returns it with its break particle, or null.
 */
async function standNear(page: Page, kind: string, dist: number) {
    return page.evaluate(
        ({ kind, dist }) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const me = g.getPlayer(r.player.id).pos;
            let best: any = null;
            let bestDist = Number.POSITIVE_INFINITY;
            for (const o of g.world.objects.values()) {
                if (o.kind !== "obstacle" || o.dead || o.layer !== 0) continue;
                const match = kind === "window" ? o.def.isWindow && o.def.destructible : o.type === kind;
                if (!match) continue;
                const d = Math.hypot(o.pos.x - me.x, o.pos.y - me.y);
                if (d < bestDist) {
                    best = o;
                    bestDist = d;
                }
            }
            if (!best) return null;
            for (let ring = dist; ring < dist + 8; ring += 0.5) {
                for (let a = 0; a < 16; a++) {
                    const ang = (a / 16) * Math.PI * 2;
                    const p = { x: best.pos.x + Math.cos(ang) * ring, y: best.pos.y + Math.sin(ang) * ring };
                    if (g.canPlayerSpawn(p)) {
                        g.teleportPlayer(r.player.id, p);
                        const particle = best.def.explodeParticle;
                        return {
                            id: best.id as number,
                            particle: (Array.isArray(particle) ? particle[0] : particle) as string,
                        };
                    }
                }
            }
            return null;
        },
        { kind, dist },
    );
}

test.describe("M9 world feel", () => {
    test("breaking a crate, a tree, a barrel and a window throws their debris", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const stopKeepAlive = await keepLocalAlive(page);
        const cases = [
            { kind: "crate_01", dist: 3.5 },
            { kind: "tree_01", dist: 4 },
            { kind: "barrel_01", dist: 10 },
            { kind: "window", dist: 3 },
        ];
        for (const c of cases) {
            const target = await standNear(page, c.kind, c.dist);
            expect(target, c.kind).not.toBeNull();
            if (!target) continue;
            // the obstacle is drawn by the client before it breaks
            await page.waitForFunction((id) => !!(window as any).__rebirth.client.world?.get(id), target.id, {
                timeout: 10_000,
            });
            await page.waitForTimeout(600);
            const before = await particles(page, target.particle);
            await page.evaluate((id) => {
                const g = (window as any).__rebirth.game;
                const o = g.world.objects.get(id);
                g.damageObstacle(o, { amount: 100_000, damageType: 0, gameSourceType: "", sourceId: 0 });
            }, target.id);
            await page.waitForFunction(
                ({ type, before }) => (window as any).__rebirth.fx.particles(type) >= before + 5,
                { type: target.particle, before },
                { timeout: 10_000 },
            );
            await page.waitForTimeout(120);
            await page.screenshot({ path: `${SCREENS}/break-${c.kind}.png` });
            // survev obstacle.ts: 5-10 explode particles
            const spawned = (await particles(page, target.particle)) - before;
            expect(spawned, c.kind).toBeGreaterThanOrEqual(5);
            expect(spawned, c.kind).toBeLessThanOrEqual(10);
            await page.waitForTimeout(300);
        }
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });

    test("woods drops autumn leaves and the snow map snowflakes around the camera", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        for (const { map, particle } of [
            { map: "woods", particle: "leafAutumn" },
            { map: "snow", particle: "snow" },
        ]) {
            await boot(page, `/?sandbox=1&map=${map}&seed=1&loot=0`);
            const camera = await page.evaluate(() => (window as any).__rebirth.worldFeel.cameraEmitter);
            expect(camera.running).toBe(true);
            await page.waitForFunction((t) => (window as any).__rebirth.fx.particles(t) >= 12, particle, {
                timeout: 60_000,
            });
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/camera-${map}.png` });
            expect(await page.evaluate(() => (window as any).__rebirth.worldFeel.particles)).toBeGreaterThan(5);
        }
        // the main map has no camera particles
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        expect(await page.evaluate(() => (window as any).__rebirth.worldFeel.cameraEmitter)).toEqual({
            type: "",
            running: false,
        });
        expect(errors).toEqual([]);
    });

    test("wading through a river splashes, ripples and tints the body", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        // points along the widest river (players cannot spawn in water, so try them until one is open water)
        // each candidate carries the river's direction there, so the wade below follows the river instead of
        // leaving it (a straight walk north crossed a narrow stretch in a few units)
        const candidates: Array<{ x: number; y: number; dx: number; dy: number }> = await page.evaluate(() => {
            const g = (window as any).__rebirth.game;
            const river = [...g.mapData.rivers].sort((a: any, b: any) => b.width - a.width)[0];
            if (!river) return [];
            const pts = river.points;
            return Array.from({ length: 8 }, (_, k) => {
                const i = Math.min(pts.length - 2, Math.floor(((k + 0.5) / 8) * pts.length));
                const a = pts[Math.max(0, i - 2)];
                const b = pts[Math.min(pts.length - 1, i + 2)];
                return { x: pts[i].x, y: pts[i].y, dx: b.x - a.x, dy: b.y - a.y };
            });
        });
        expect(candidates.length).toBeGreaterThan(0);
        let inWater: (typeof candidates)[number] | null = null;
        for (const p of candidates) {
            await page.evaluate((p) => {
                const r = (window as any).__rebirth;
                r.game.teleportPlayer(r.player.id, { x: p.x, y: p.y });
            }, p);
            await page.waitForTimeout(500);
            if ((await steps(page))?.surface === "water") {
                inWater = p;
                break;
            }
        }
        expect(inWater).not.toBeNull();
        // standing in the river the body sinks into the water ring (0.6 at the shore, deeper inside)
        await expect.poll(async () => (await steps(page))?.depth ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.3);
        await page.screenshot({
            path: `${SCREENS}/wading-zoom.png`,
            clip: { x: 560, y: 280, width: 160, height: 160 },
        });
        const ripplesBefore = await particles(page, "waterRipple");
        const splashesBefore = (await steps(page))?.waterSteps ?? 0;
        // the 8-way keys closest to the river's direction there (world +y is up)
        const ang = Math.atan2(inWater!.dy, inWater!.dx);
        const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
        const keys = [["d"], ["d", "w"], ["w"], ["a", "w"], ["a"], ["a", "s"], ["s"], ["d", "s"]][oct];
        for (const k of keys) await page.keyboard.down(k);
        try {
            // a splash and a ripple every 5 units waded
            await expect
                .poll(async () => (await steps(page))?.waterSteps ?? 0, { timeout: 45_000 })
                .toBeGreaterThanOrEqual(splashesBefore + 2);
        } finally {
            for (const k of keys) await page.keyboard.up(k);
        }
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${SCREENS}/wading.png` });
        expect(await particles(page, "waterRipple")).toBeGreaterThanOrEqual(ripplesBefore + 2);
        expect(errors).toEqual([]);
    });

    test("walking through a bush rustles it and throws leaves; footsteps on grass", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const bush = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const me = g.getPlayer(r.player.id).pos;
            const dist = (o: any) => Math.hypot(o.pos.x - me.x, o.pos.y - me.y);
            const bushes = [...g.world.objects.values()]
                .filter((o: any) => o.kind === "obstacle" && o.def.isBush && !o.dead && o.layer === 0)
                .sort((a: any, b: any) => dist(a) - dist(b));
            for (const b of bushes) {
                // a clear lane from 5 units left of the bush to 4 units right of it
                const lane = [-5, -4, -3, 3, 4].map((dx) => ({ x: b.pos.x + dx, y: b.pos.y }));
                if (lane.every((p) => g.canPlayerSpawn(p))) {
                    g.teleportPlayer(r.player.id, lane[0]);
                    return { hitParticle: b.def.hitParticle as string };
                }
            }
            return null;
        });
        expect(bush).not.toBeNull();
        if (!bush) return;
        await page.waitForTimeout(800);
        const leavesBefore = await particles(page, bush.hitParticle);
        const before = await steps(page);
        await page.keyboard.down("d");
        try {
            await expect
                .poll(async () => (await steps(page))?.bush ?? 0, { timeout: 30_000 })
                .toBeGreaterThan(before?.bush ?? 0);
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${SCREENS}/bush-enter.png` });
        } finally {
            await page.keyboard.up("d");
        }
        const after = await steps(page);
        expect((await particles(page, bush.hitParticle)) - leavesBefore).toBeGreaterThanOrEqual(3);
        expect(after?.steps ?? 0).toBeGreaterThan(before?.steps ?? 0);
        expect(errors).toEqual([]);
    });

    test("frame time of a busy scene (16 dummies, firing)", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&dummies=16");
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        const target = await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            return r.worldToScreen(r.game.getPlayer(id).pos);
        }, dummy);
        await page.mouse.move(target.x, target.y);
        await page.waitForTimeout(1500);
        await page.mouse.down();
        let result: { avgMs: number; maxMs: number; frames: number };
        let alive = 0;
        try {
            await page.waitForTimeout(500);
            const sample = page.evaluate(() => (window as any).__rebirth.perf.sampleFrames(90));
            await page.waitForTimeout(3000);
            alive = await page.evaluate(() => (window as any).__rebirth.renderer.particleCount);
            result = await sample;
        } finally {
            await page.mouse.up();
        }
        const fps = await page.evaluate(() => (window as any).__rebirth.renderer.fps);
        console.log(`M9 frame time: ${JSON.stringify(result)} particles alive: ${alive} fps: ${fps}`);
        expect(result.frames).toBe(90);
        expect(errors).toEqual([]);
    });
});
