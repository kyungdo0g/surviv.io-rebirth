// Strobes in the sandbox (?give=strobe,strobe_heavy,strobe_carpet; docs/research/rebirth-deviations.md "Variant
// strobes"): each strobe is thrown from the throwable slot (4 cycles the type), drawn in its colour in the hand, in
// flight and in the weapon slot, its ping marks the map 3 s later in the variant's colour (the zone marker's), and its
// planes drop their bombs: the strobe 3 lines of iron bombs, the heavy strobe 3 lines of heavy shells, the carpet strobe
// 6 lines of iron bombs. A target standing in the heavy strike shows the kill feed's "with a heavy shell strike".
// Screenshots go to __screens__/strobes.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";
import { aimAt, keepLocalAlive, localPos } from "./m5-helpers.ts";

const SCREENS = "tests/e2e/__screens__/strobes";

interface StrobeCase {
    type: string;
    ping: string;
    color: number;
    planes: number;
    bomb: string;
    explosion: string;
}

const CASES: StrobeCase[] = [
    {
        type: "strobe",
        ping: "ping_airstrike",
        color: 0xeaff00,
        planes: 3,
        bomb: "bomb_iron",
        explosion: "explosion_bomb_iron",
    },
    {
        type: "strobe_heavy",
        ping: "ping_airstrike_heavy",
        color: 0xff3c1e,
        planes: 3,
        bomb: "bomb_heavy",
        explosion: "explosion_bomb_heavy",
    },
    {
        type: "strobe_carpet",
        ping: "ping_airstrike_carpet",
        color: 0xe040ff,
        planes: 6,
        bomb: "bomb_iron",
        explosion: "explosion_bomb_iron",
    },
];

/**
 * Records from now on every projectile type, map-event ping (type and icon tint) and kill feed line the client shows,
 * in window.__rebirth.strobeLog, so short-lived pings, bombs and lines are not missed between polls on a slow machine.
 */
async function record(page: Page): Promise<void> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.strobeLog = {
            projectiles: [] as string[],
            pings: [] as Array<{ type: string; tint: number }>,
            killFeed: [] as string[],
        };
        const tick = () => {
            const log = r.strobeLog;
            for (const o of r.lastSnapshot?.projectiles ?? []) {
                if (!log.projectiles.includes(o.type)) log.projectiles.push(o.type);
            }
            for (const ping of r.fx.mapPings ?? []) {
                if (!log.pings.some((p: { type: string }) => p.type === ping.type)) log.pings.push(ping);
            }
            for (const line of r.match?.killFeed ?? []) if (!log.killFeed.includes(line)) log.killFeed.push(line);
            // a target 12 u along the strike line of the strobe named in targetAt, placed in the frame its ping
            // appears (the planes come 3.5 s later): test round trips on a loaded machine could miss the strike
            const want = r.targetAt as { strobe: string; ping: string } | undefined;
            if (want && (r.fx.mapPings ?? []).some((p: { type: string }) => p.type === want.ping)) {
                const g = r.game;
                const strobe = g.projectiles.projectiles.find((o: any) => o.type === want.strobe);
                if (strobe) {
                    const id = g.addPlayer("target");
                    g.teleportPlayer(id, { x: strobe.pos.x + 12, y: strobe.pos.y });
                }
                r.targetAt = undefined;
            }
            requestAnimationFrame(tick);
        };
        tick();
    });
}

/** Type in the throwable slot (slot 4). */
async function throwableSlot(page: Page): Promise<string> {
    return page.evaluate(() => (window as any).__rebirth.local.weapons[3]?.type ?? "");
}

/** Presses 4 until the throwable slot shows `type` (4 on the equipped slot cycles the throwable type). */
async function selectThrowable(page: Page, type: string): Promise<void> {
    for (let i = 0; i < 4; i++) {
        const before = await throwableSlot(page);
        if (before === type) break;
        await page.keyboard.press("Digit4");
        // one press at a time: a slow frame may take a while to show the next type
        await expect.poll(() => throwableSlot(page), { timeout: 10_000 }).not.toBe(before);
    }
    await expect.poll(() => throwableSlot(page)).toBe(type);
    await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.curWeapIdx)).toBe(3);
}

/** World position of the live strobe of `type`, or null. */
async function strobePos(page: Page, type: string): Promise<{ x: number; y: number } | null> {
    return page.evaluate((type) => {
        const p = (window as any).__rebirth.game.projectiles.projectiles.find((o: any) => o.type === type);
        return p ? { x: p.pos.x, y: p.pos.y } : null;
    }, type);
}

async function shotAround(page: Page, pos: { x: number; y: number }, path: string, half = 110): Promise<void> {
    const s = await page.evaluate((p) => (window as any).__rebirth.worldToScreen(p), pos);
    const x = Math.max(0, Math.round(s.x - half));
    const y = Math.max(0, Math.round(s.y - half));
    await page.screenshot({ path, clip: { x, y, width: half * 2, height: half * 2 } });
}

async function minimapShot(page: Page, path: string): Promise<void> {
    const rect = await page.evaluate(() => (window as any).__rebirth.minimap.rect);
    await page.screenshot({
        path,
        clip: { x: 0, y: rect.y - 10, width: rect.x + rect.width + 16, height: rect.height + 20 },
    });
}

test.describe("strobes", () => {
    test("each strobe calls its strike: colours, map marker, planes and bombs", async ({ page }) => {
        test.setTimeout(360_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=strobe,strobe_heavy,strobe_carpet,4xscope");
        const stopKeepAlive = await keepLocalAlive(page);
        await record(page);
        await expect.poll(() => throwableSlot(page)).toBe("strobe");

        for (const c of CASES) {
            await selectThrowable(page, c.type);
            // the strobe in the hand and its weapon slot icon take the strobe's colour (the original stays untinted)
            const handTint = c.type === "strobe" ? 0xffffff : c.color;
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).__rebirth.throwableSprites((window as any).__rebirth.player.id)?.rightTint,
                    ),
                )
                .toBe(handTint);
            const slotSrc = () =>
                page.evaluate(() => document.querySelector("#ui-weapon-id-4 img")?.getAttribute("src"));
            if (c.type === "strobe") expect(await slotSrc()).toMatch(/loot-throwable-strobe/);
            else await expect.poll(slotSrc, { timeout: 15_000 }).toMatch(/^data:image\/png/);
            await page.locator("#ui-weapon-id-4").screenshot({ path: `${SCREENS}/${c.type}-slot.png` });

            const planesBefore = await page.evaluate(() => (window as any).__rebirth.strikePlanesSeen as number);
            const explosionsBefore = await page.evaluate(() => (window as any).__rebirth.fx.explosions as number);
            if (c.type === "strobe_heavy") {
                await page.evaluate((c) => {
                    (window as any).__rebirth.targetAt = { strobe: c.type, ping: c.ping };
                }, c);
            }
            const me = await localPos(page);
            // a full-strength throw (~37 u east): far enough that no blast reaches the thrower, still in the 4x view
            await aimAt(page, { x: me.x + 20, y: me.y });
            await page.mouse.down();
            // hold until the cook starts (slow software-GL frames could miss a short click)
            await expect
                .poll(
                    () =>
                        page.evaluate(() => (window as any).__rebirth.playerAnim((window as any).__rebirth.player.id)),
                    { timeout: 10_000 },
                )
                .toBe("cook");
            await page.waitForTimeout(300);
            await page.mouse.up();
            await expect.poll(() => strobePos(page, c.type), { timeout: 15_000 }).not.toBeNull();
            // the thrown strobe and its light pulse in the strobe's colour
            await expect
                .poll(
                    () =>
                        page.evaluate(
                            (type) =>
                                ((window as any).__rebirth.fx.projectiles?.strobes ?? []).find(
                                    (s: any) => s.type === type,
                                ) ?? null,
                            c.type,
                        ),
                    { timeout: 10_000 },
                )
                .toEqual({ type: c.type, tint: c.type === "strobe" ? 0xffffff : c.color, lightTint: handTint });
            // the ping 3 s after the throw, in the variant's colour on the map and on the screen-edge indicator
            await expect
                .poll(() => page.evaluate(() => (window as any).__rebirth.strobeLog.pings), { timeout: 20_000 })
                .toContainEqual({ type: c.ping, tint: c.color });
            expect(await page.evaluate(() => (window as any).__rebirth.fx.pingTint)).toBe(c.color);
            await minimapShot(page, `${SCREENS}/${c.type}-minimap.png`);
            // the strobe has come to rest by now: a close-up of it
            const rest = await strobePos(page, c.type);
            if (rest) await shotAround(page, rest, `${SCREENS}/${c.type}-thrown.png`, 70);

            // its planes and their bombs
            await expect
                .poll(() => page.evaluate(() => (window as any).__rebirth.strikePlanesSeen - 0), { timeout: 30_000 })
                .toBe(planesBefore + c.planes);
            await expect
                .poll(() => page.evaluate(() => (window as any).__rebirth.strobeLog.projectiles), { timeout: 20_000 })
                .toContain(c.bomb);
            // this strike's own bursts (a strike drops 15 to 120 bombs)
            await page.waitForFunction((n) => (window as any).__rebirth.fx.explosions >= n, explosionsBefore + 10, {
                timeout: 20_000,
            });
            expect(
                await page.evaluate((type) => (window as any).__rebirth.fx.burstScale(type), c.explosion),
            ).toBeGreaterThan(0);
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${SCREENS}/${c.type}-bombing.png` });
            if (c.type === "strobe_heavy") {
                // the target died "with a heavy shell strike" (the bombs are credited to the strobe)
                await expect
                    .poll(
                        () =>
                            page.evaluate(() => ((window as any).__rebirth.strobeLog.killFeed as string[]).join("\n")),
                        { timeout: 15_000 },
                    )
                    .toMatch(/killed target with a heavy shell strike/);
                await page.screenshot({ path: `${SCREENS}/${c.type}-killfeed.png` });
            }
            // let the last bombs land before the next strobe
            await page.waitForTimeout(2_500);
        }

        const pings = await page.evaluate(() => (window as any).__rebirth.strobeLog.pings);
        expect(pings.map((p: { type: string }) => p.type)).toEqual(CASES.map((c) => c.ping));
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });
});
