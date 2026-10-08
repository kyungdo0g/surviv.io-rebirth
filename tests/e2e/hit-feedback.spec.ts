// Rebirth Enhanced hit effects (user/2026-10-07-hit-feedback; fx/hitFeedback.ts) in the loopback sandbox: a light (M9,
// 12 damage) and a heavy (Barrett, 99) hit on a dummy, a headshot and a kill, then hits taken from a scripted shooter
// (vignette, arc toward it, camera kick; no kick with Screen shake off), the setting off (only the original v0.8.82
// effects) and the frame time with the setting off and on of a busy scene (16 dummies) and of an 80-player fight (the
// load limits of fx/hitFeedbackMath.ts: at most 8 flashes, shared blood budgets). Hooks: window.__rebirth.hitFx
// (game/debugHitFx.ts), hits (debugM9.ts), config (debugM8.ts), game (the sandbox Game).
// Screenshots: __screens__/hitfx (taken with the renderer paused on the frame the effect shows).
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/hitfx";

interface FxState {
    markerVisible: boolean;
    markers: number[];
    arcs: number;
    arcsStarted: number;
    flashes: number;
    flashesStarted: number;
    vignette: number;
    kick: { x: number; y: number };
    lastShake: number;
    confirms: number;
    extraBlood: number;
    bursts: number;
    kicks: number;
    vignetteHits: number;
    serverOnly: number;
    dropped: number;
    flashesSkipped: number;
}

const BODY = 0;
const HEADSHOT = 2;
const KILL = 4;

async function fx(page: Page): Promise<FxState> {
    return page.evaluate(() => (window as any).__rebirth.hitFx.state as FxState);
}

/** Aims at player `id` and waits until the local player faces it. */
async function aimAt(page: Page, id: number): Promise<void> {
    const target = await page.evaluate((id) => {
        const r = (window as any).__rebirth;
        return r.worldToScreen(r.visualPos(id));
    }, id);
    await page.mouse.move(target.x, target.y);
    await page.waitForFunction(
        (id) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const d = r.game.getPlayer(id);
            const dx = d.pos.x - me.pos.x;
            const dy = d.pos.y - me.pos.y;
            return (me.dir.x * dx + me.dir.y * dy) / Math.hypot(dx, dy) > 0.998;
        },
        id,
        { timeout: 10_000 },
    );
}

/** Equips the local player's slot holding `gun` (keys 1 / 2) and waits until it can fire. */
async function equip(page: Page, gun: string): Promise<void> {
    const slot = await page.evaluate((gun) => {
        const r = (window as any).__rebirth;
        return (r.local.weapons as Array<{ type: string }>).findIndex((w) => w.type === gun);
    }, gun);
    expect(slot, gun).toBeGreaterThanOrEqual(0);
    await page.keyboard.press(String(slot + 1));
    await page.waitForFunction(
        ({ slot }) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            return me.weaponManager.curWeapIdx === slot;
        },
        { slot },
        { timeout: 10_000 },
    );
    // the Barrett's 1 s switch delay
    await page.waitForTimeout(1200);
}

/**
 * Waits (frame by frame) until `cond` holds on window.__rebirth, pauses the renderer on that frame for a screenshot and
 * resumes it. Returns whether the condition was met.
 */
async function freezeWhen(page: Page, cond: string, path: string, timeout = 5000): Promise<boolean> {
    const met = await page.evaluate(
        async ({ cond, timeout }) => {
            const r = (window as any).__rebirth;
            const test = new Function("r", `return (${cond});`) as (r: unknown) => boolean;
            const frame = () => new Promise((res) => requestAnimationFrame(res));
            const t0 = performance.now();
            while (!test(r)) {
                if (performance.now() - t0 > timeout) return false;
                await frame();
            }
            r.client.app.ticker.stop();
            return true;
        },
        { cond, timeout },
    );
    if (met) {
        await page.screenshot({ path });
        await page.evaluate(() => (window as any).__rebirth.client.app.ticker.start());
    }
    return met;
}

/** Lets `frames` more frames run (the blood spreads out), then pauses the renderer for a screenshot and resumes it. */
async function freezeAfter(page: Page, frames: number, path: string): Promise<void> {
    await page.evaluate(async (frames) => {
        const r = (window as any).__rebirth;
        for (let i = 0; i < frames; i++) await new Promise((res) => requestAnimationFrame(res));
        r.client.app.ticker.stop();
    }, frames);
    await page.screenshot({ path });
    await page.evaluate(() => (window as any).__rebirth.client.app.ticker.start());
}

/** One click of the trigger. */
async function shoot(page: Page): Promise<void> {
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
}

/** Arms player `id` with an AK-47 aimed at `targetId` and holds its trigger (`on`) or releases it. */
async function scriptShooter(page: Page, id: number, targetId: number, on: boolean): Promise<void> {
    await page.evaluate(
        ({ id, targetId, on }) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const p = g.getPlayer(id);
            const t = g.getPlayer(targetId);
            if (on && p.weaponManager.weapons[0].type !== "ak47") {
                p.backpack = "backpack03";
                p.inv.set("762mm", 300);
                p.weaponManager.setWeapon(0, "ak47", 30);
                p.weaponManager.setCurWeapIndex(0);
                p.weaponManager.weapons[0].cooldown = 0;
                p.weaponManager.freeSwitchTimer = 0;
            }
            const dx = t.pos.x - p.pos.x;
            const dy = t.pos.y - p.pos.y;
            const len = Math.hypot(dx, dy);
            g.setInput(id, {
                ...p.input,
                toMouseDir: { x: dx / len, y: dy / len },
                toMouseLen: len,
                shootStart: on,
                shootHold: on,
                actions: [],
            });
        },
        { id, targetId, on },
    );
}

/**
 * Keeps the local player alive while scripted shooters fire at it (`on`), or stops doing so: every hit on it first
 * restores its health, inside the simulation's damage pipeline, so it holds even when the page renders at 1 fps under
 * load (a timer healing it falls behind four AK-47s). The hits still land and reach its snapshots.
 */
async function keepAlive(page: Page, on: boolean): Promise<void> {
    await page.evaluate((on) => {
        const r = (window as any).__rebirth;
        const g = r.game;
        if (!on) {
            delete g.damagePlayer;
            return;
        }
        const proto = Object.getPrototypeOf(g);
        g.damagePlayer = function (target: { id: number; health: number }, params: unknown) {
            if (target.id === r.player.id) target.health = 100;
            return proto.damagePlayer.call(this, target, params);
        };
    }, on);
}

/**
 * Fills the sandbox up to `total` players (the 16 dummies plus added ones) in a 9 x 9 grid around the local player,
 * 3.2 x 3 units apart so all are on screen, and keeps everyone alive: every hit first restores its target's health
 * inside the simulation's damage pipeline. Returns the other players' ids.
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
 * Starts (or stops) `count` crowd players firing AK-47s, the first four at the local player and the rest at a
 * neighbour; they are re-armed and re-aimed every second while it runs.
 */
async function crowdFire(page: Page, ids: number[], count: number, on: boolean): Promise<void> {
    await page.evaluate(
        ({ ids, count, on }) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            clearInterval(r.__crowdFire);
            const pairs: Array<[number, number]> = [];
            for (let k = 0; k < count; k++)
                pairs.push([ids[k * 3], k < 4 ? r.player.id : ids[(k * 3 + 1) % ids.length]]);
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
                    if (fire) p.inv.set("762mm", 300);
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

interface FrameTimes {
    trimmedMs: number;
    medianMs: number;
    maxMs: number;
}

/** Sets the Enhanced hit effects, lets the scene settle for a second and samples `frames` frame times. */
async function sampleFrameTimes(page: Page, on: boolean, frames: number): Promise<FrameTimes> {
    await page.evaluate((on) => (window as any).__rebirth.config.set("enhancedHitFx", on), on);
    await page.waitForTimeout(1000);
    const t0 = Date.now();
    const res = await (page.evaluate(
        (n) => (window as any).__rebirth.perf.sampleFrames(n),
        frames,
    ) as Promise<FrameTimes>);
    console.log(`sample ${on ? "on" : "off"}: ${JSON.stringify(res)} in ${Date.now() - t0} ms`);
    return res;
}

test.describe("Enhanced hit effects", () => {
    test("light and heavy hits, a headshot and a kill on a dummy", async ({ page }) => {
        test.setTimeout(240_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=m9,barrett&dummies=2");
        expect(await page.evaluate(() => (window as any).__rebirth.hitFx.enabled)).toBe(true);
        const [d0, d1] = await page.evaluate(() => (window as any).__rebirth.dummies as number[]);
        await page.evaluate(() => {
            (window as any).__rebirth.game.rules.headshotChance = 0;
        });

        // a 9 mm hit: white marker, a light flash and two extra splats
        await equip(page, "m9");
        await aimAt(page, d0);
        const s0 = await fx(page);
        await shoot(page);
        expect(
            await freezeWhen(
                page,
                "r.hitFx.state.markerVisible && r.hitFx.state.flashes > 0",
                `${SCREENS}/dealt-light.png`,
            ),
        ).toBe(true);
        await freezeAfter(page, 6, `${SCREENS}/dealt-light-blood.png`);
        await page.waitForTimeout(500);
        const s1 = await fx(page);
        expect(s1.markers[BODY] - s0.markers[BODY]).toBe(1);
        expect(s1.flashesStarted - s0.flashesStarted).toBe(1);
        expect(s1.confirms - s0.confirms).toBe(1);
        const lightBlood = s1.extraBlood - s0.extraBlood;
        expect(lightBlood).toBe(2);

        // a Barrett hit on the other dummy: the same marker, bigger, and more blood
        await equip(page, "barrett");
        await aimAt(page, d1);
        await shoot(page);
        expect(
            await freezeWhen(
                page,
                "r.hitFx.state.markerVisible && r.hitFx.state.flashes > 0",
                `${SCREENS}/dealt-heavy.png`,
            ),
        ).toBe(true);
        await freezeAfter(page, 6, `${SCREENS}/dealt-heavy-blood.png`);
        await page.waitForTimeout(500);
        const s2 = await fx(page);
        expect(s2.markers[BODY] - s1.markers[BODY]).toBe(1);
        const heavyBlood = s2.extraBlood - s1.extraBlood;
        expect(heavyBlood).toBe(5);
        expect(heavyBlood).toBeGreaterThan(lightBlood);

        // a headshot: the gold marker
        await page.evaluate(() => {
            (window as any).__rebirth.game.rules.headshotChance = 1;
        });
        await equip(page, "m9");
        await aimAt(page, d0);
        await shoot(page);
        expect(
            await freezeWhen(
                page,
                `r.hitFx.state.markers[${HEADSHOT}] > ${s2.markers[HEADSHOT]}`,
                `${SCREENS}/dealt-headshot.png`,
            ),
        ).toBe(true);
        await page.waitForTimeout(400);
        const s3 = await fx(page);
        expect(s3.markers[HEADSHOT] - s2.markers[HEADSHOT]).toBe(1);

        // the kill: the red marker with its ring, and the blood burst
        await page.evaluate((id) => {
            (window as any).__rebirth.game.getPlayer(id).health = 1;
        }, d0);
        await aimAt(page, d0);
        await shoot(page);
        expect(
            await freezeWhen(page, `r.hitFx.state.markers[${KILL}] > ${s3.markers[KILL]}`, `${SCREENS}/dealt-kill.png`),
        ).toBe(true);
        await freezeAfter(page, 6, `${SCREENS}/dealt-kill-burst.png`);
        await page.waitForTimeout(400);
        const s4 = await fx(page);
        expect(s4.markers[KILL] - s3.markers[KILL]).toBe(1);
        expect(s4.bursts - s3.bursts).toBe(1);
        expect(errors).toEqual([]);
    });

    test("hits taken from a scripted shooter: vignette, an arc toward it and the camera kick", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=ak47&dummies=1");
        const [shooter] = await page.evaluate(() => (window as any).__rebirth.dummies as number[]);
        const me = await page.evaluate(() => (window as any).__rebirth.player.id as number);
        // the shooter stands up and to the right of the player: walk it off-axis so the arc is not straight ahead
        await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const p = r.game.getPlayer(r.player.id);
            r.game.teleportPlayer(id, { x: p.pos.x + 6, y: p.pos.y + 6 });
        }, shooter);
        await page.mouse.move(640, 600);
        await page.waitForTimeout(500);
        await keepAlive(page, true);
        await scriptShooter(page, shooter, me, true);
        let shook = 0;
        try {
            expect(
                await freezeWhen(
                    page,
                    "r.hitFx.state.arcs > 0 && r.hitFx.state.vignette > 0.3",
                    `${SCREENS}/taken-arc.png`,
                ),
            ).toBe(true);
            shook = await page.evaluate(async () => {
                const r = (window as any).__rebirth;
                let max = 0;
                for (let i = 0; i < 60; i++) {
                    max = Math.max(max, r.hitFx.state.lastShake);
                    await new Promise((res) => requestAnimationFrame(res));
                }
                return max;
            });
        } finally {
            await scriptShooter(page, shooter, me, false);
            await keepAlive(page, false);
        }
        const s = await fx(page);
        expect(s.vignetteHits).toBeGreaterThan(0);
        expect(s.arcsStarted).toBeGreaterThan(0);
        expect(s.kicks).toBeGreaterThan(0);
        expect(shook).toBeGreaterThan(0);
        expect(await page.locator("#ui-hit-vignette").count()).toBe(1);
        // the arc aims at the shooter: up-right on screen
        const arc = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.client.renderer.screen.children.find((c: any) => c.label === "damage-arc" && c.visible);
            return g ? g.rotation : null;
        });
        if (arc !== null) expect(arc).toBeLessThan(0);

        // one heavy hit (85 of the 100 HP): the strongest vignette and a bigger, longer arc
        await page.waitForTimeout(1500);
        await page.evaluate((id) => {
            // AK-47 bullets still in flight when the healing stopped may have landed: start from full health
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).health = 100;
            r.hitFx.hurtLocal(id, 85);
        }, shooter);
        expect(
            await freezeWhen(
                page,
                "r.hitFx.state.vignette > 0.7 && r.hitFx.state.arcs > 0",
                `${SCREENS}/taken-heavy.png`,
            ),
        ).toBe(true);

        // low health: the vignette keeps a pulsing floor
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).health = 8;
        });
        await page.waitForFunction(() => (window as any).__rebirth.hitFx.state.vignette > 0.15, null, {
            timeout: 5000,
        });
        await page.screenshot({ path: `${SCREENS}/taken-low-health.png` });
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).health = 100;
        });

        // Screen shake off: no camera kick, the vignette and the arc stay
        await page.evaluate(() => (window as any).__rebirth.config.set("screenShake", false));
        const kicksBefore = (await fx(page)).kicks;
        await page.evaluate((id) => (window as any).__rebirth.hitFx.hurtLocal(id, 40), shooter);
        await page.waitForFunction(() => (window as any).__rebirth.hitFx.state.vignette > 0.4, null, { timeout: 5000 });
        const noShake = await page.evaluate(async () => {
            const r = (window as any).__rebirth;
            let max = 0;
            for (let i = 0; i < 30; i++) {
                max = Math.max(max, r.hitFx.state.lastShake);
                await new Promise((res) => requestAnimationFrame(res));
            }
            return max;
        });
        expect(noShake).toBe(0);
        expect((await fx(page)).kicks).toBe(kicksBefore);
        expect(errors).toEqual([]);
    });

    test("off: only the original effects", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=m9&dummies=1");
        await page.evaluate(() => (window as any).__rebirth.config.set("enhancedHitFx", false));
        expect(await page.evaluate(() => (window as any).__rebirth.hitFx.enabled)).toBe(false);
        expect(await page.evaluate(() => (window as any).__rebirth.client.match.hud.gasFlashEnabled)).toBe(false);
        const [dummy] = await page.evaluate(() => (window as any).__rebirth.dummies as number[]);
        await page.evaluate(() => {
            (window as any).__rebirth.game.rules.headshotChance = 0;
        });
        const before = await fx(page);
        const original = await page.evaluate(() => (window as any).__rebirth.hits.bullets);
        await page.waitForTimeout(800);
        await aimAt(page, dummy);
        await shoot(page);
        await page.waitForFunction((n) => (window as any).__rebirth.hits.bullets.blood > n, original.blood, {
            timeout: 10_000,
        });
        await page.evaluate((id) => (window as any).__rebirth.hitFx.hurtLocal(id, 40), dummy);
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${SCREENS}/off.png` });
        await page.waitForTimeout(400);
        const after = await fx(page);
        // the original blood splat and flesh hit played; nothing of the enhanced effects
        const bullets = await page.evaluate(() => (window as any).__rebirth.hits.bullets);
        expect(bullets.blood - original.blood).toBe(1);
        expect(bullets.sounds - original.sounds).toBe(1);
        expect(after.markers).toEqual(before.markers);
        expect(after.flashesStarted).toBe(before.flashesStarted);
        expect(after.extraBlood).toBe(before.extraBlood);
        expect(after.confirms).toBe(before.confirms);
        expect(after.vignetteHits).toBe(before.vignetteHits);
        expect(after.arcsStarted).toBe(before.arcsStarted);
        expect(after.vignette).toBe(0);
        expect(after.lastShake).toBe(0);
        expect(await page.locator("#ui-hit-vignette").isVisible()).toBe(false);
        // the local player did take the hit
        expect(await page.evaluate(() => (window as any).__rebirth.local.health)).toBeLessThan(70);
        // and back on, from the settings
        await page.evaluate(() => (window as any).__rebirth.config.set("enhancedHitFx", true));
        expect(await page.evaluate(() => (window as any).__rebirth.client.match.hud.gasFlashEnabled)).toBe(true);
        expect(errors).toEqual([]);
    });

    test("frame time of a busy scene, off then on (16 dummies, 4 firing back)", async ({ page }) => {
        test.setTimeout(300_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&dummies=16");
        const dummies = await page.evaluate(() => (window as any).__rebirth.dummies as number[]);
        const me = await page.evaluate(() => (window as any).__rebirth.player.id as number);
        await keepAlive(page, true);
        // the dummies stand in a row 3.5 apart: aim at the middle one, four around it fire back
        const shooters = dummies.slice(6, 10);
        for (const id of shooters) await scriptShooter(page, id, me, true);
        await aimAt(page, dummies[8]);
        await page.mouse.down();
        const runs: Array<{ on: boolean; trimmedMs: number }> = [];
        try {
            for (const on of [false, true, false, true]) runs.push({ on, ...(await sampleFrameTimes(page, on, 45)) });
        } finally {
            await page.mouse.up();
            for (const id of shooters) await scriptShooter(page, id, me, false);
            await keepAlive(page, false);
        }
        const best = (on: boolean) => Math.min(...runs.filter((r) => r.on === on).map((r) => r.trimmedMs));
        const s = await fx(page);
        expect(await page.evaluate(() => (window as any).__rebirth.local.dead)).toBe(false);
        console.log(
            `hit feedback frame time: off ${best(false).toFixed(2)} ms, on ${best(true).toFixed(2)} ms (trimmed, best of 2); ` +
                `runs ${JSON.stringify(runs)}; flashes ${s.flashesStarted}, extra blood ${s.extraBlood}`,
        );
        expect(s.flashesStarted).toBeGreaterThan(0);
        expect(best(true)).toBeLessThanOrEqual(best(false) * 1.15 + 1);
        expect(errors).toEqual([]);
    });
    test("frame time of an 80-player fight, off then on (24 firing, 4 of them at the local player)", async ({
        page,
    }) => {
        test.setTimeout(540_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=ak47&dummies=16");
        const ids = await crowd(page, 80);
        expect(ids.length).toBe(79);
        expect(
            await page.evaluate((ids) => ids.every((id) => !!(window as any).__rebirth.game.getPlayer(id)), ids),
        ).toBe(true);
        // the most flashes running at once, over every frame of the run
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.__maxFlashes = 0;
            r.__flashWatch = () => {
                r.__maxFlashes = Math.max(r.__maxFlashes, r.client.hitFx.flashes.count);
            };
            r.client.app.ticker.add(r.__flashWatch);
        });
        await crowdFire(page, ids, 24, true);
        await page.waitForTimeout(2000);
        const runs: Array<{ on: boolean; trimmedMs: number; medianMs: number }> = [];
        const blood = { off: 0, on: 0 };
        try {
            for (const on of [false, true, false, true, false, true]) {
                const before = (await fx(page)).extraBlood;
                runs.push({ on, ...(await sampleFrameTimes(page, on, 60)) });
                blood[on ? "on" : "off"] += (await fx(page)).extraBlood - before;
            }
        } finally {
            await crowdFire(page, ids, 24, false);
            await page.evaluate(() => {
                const r = (window as any).__rebirth;
                r.client.app.ticker.remove(r.__flashWatch);
            });
        }
        const best = (on: boolean) => Math.min(...runs.filter((r) => r.on === on).map((r) => r.trimmedMs));
        const s = await fx(page);
        const maxFlashes = await page.evaluate(() => (window as any).__rebirth.__maxFlashes as number);
        console.log(
            `80-player frame time: off ${best(false).toFixed(2)} ms, on ${best(true).toFixed(2)} ms (trimmed, best of 3); ` +
                `runs ${JSON.stringify(runs)}; flashes ${s.flashesStarted} (at most ${maxFlashes} at once), ` +
                `${s.flashesSkipped} skipped, extra blood off ${blood.off} / on ${blood.on}, dropped ${s.dropped}`,
        );
        expect(await page.evaluate(() => (window as any).__rebirth.local.dead)).toBe(false);
        // the effects ran, within their caps, and only with the setting on
        expect(s.flashesStarted).toBeGreaterThan(0);
        expect(blood.on).toBeGreaterThan(0);
        expect(blood.off).toBe(0);
        expect(maxFlashes).toBeLessThanOrEqual(8);
        expect(best(true)).toBeLessThanOrEqual(best(false) * 1.15 + 1);
        expect(errors).toEqual([]);
    });
});
