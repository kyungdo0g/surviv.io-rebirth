// The hand-held grenade launchers' spent 40 mm cases in the loopback sandbox (GunDef.handHeld, owner 2026-10-08: the
// M79, GL-06 and MGL are held like a rifle): no case on the shot; the reload drops one from the breech, just in front
// of the right hand on the aim line (pos + dir * (radius + particle.shellOffset), survev shot.ts createCasingParticle),
// thrown back beside the player, and it is the big brass case (fx/particleDefs.ts "40mm", part-shell-01.img). The M79
// and GL-06 reload after their one round; the MGL is reloaded by hand after one of its six, one case per chamber.
// Hooks: window.__rebirth (game, player, client, local). Screenshots: __screens__/launcher-casings.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/launcher-casings";
/** particle.shellOffset of each (rebirth/newGuns.json): the case starts 1 + this ahead of the body centre */
const SHELL_OFFSET: Readonly<Record<string, number>> = { m79: 0.1, gl06: -0.05, mgl: 0.15 };

interface CaseSpawn {
    type: string;
    rel: { x: number; y: number };
    vel: { x: number; y: number };
    action: string;
}

/** Records every 40 mm case the client spawns, relative to the local player, with the sim player's action then. */
async function recordCases(page: Page): Promise<void> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        const ps = r.client.particles;
        const add = ps.add.bind(ps);
        r.cases = [];
        ps.add = (type: string, layer: number, pos: any, vel: any, opts: any, emitter: any) => {
            if (type === "40mm") {
                const p = r.game.getPlayer(r.player.id);
                r.cases.push({
                    type,
                    rel: { x: pos.x - p.pos.x, y: pos.y - p.pos.y },
                    vel: { x: vel.x, y: vel.y },
                    action: p.action?.type ?? "none",
                });
            }
            return add(type, layer, pos, vel, opts, emitter);
        };
    });
}

async function cases(page: Page): Promise<CaseSpawn[]> {
    return page.evaluate(() => (window as any).__rebirth.cases as CaseSpawn[]);
}

/**
 * Lets the particles run `after` seconds past the next 40 mm case, then holds them still (dt 0) for a screenshot.
 */
async function freezeAfterCase(page: Page, after: number): Promise<void> {
    await page.evaluate((after) => {
        const ps = (window as any).__rebirth.client.particles;
        ps.realUpdate ??= ps.update.bind(ps);
        const base = ps.spawnedByType.get("40mm") ?? 0;
        let left = after;
        ps.update = (dt: number) => {
            if ((ps.spawnedByType.get("40mm") ?? 0) === base) return ps.realUpdate(dt);
            const step = Math.min(dt, left);
            left -= step;
            ps.realUpdate(step);
        };
    }, after);
}

/** Waits until no 40 mm case is alive (a slow headless frame rate can run the particles behind the clock). */
async function casesGone(page: Page): Promise<void> {
    await expect
        .poll(
            () =>
                page.evaluate(
                    () =>
                        (window as any).__rebirth.client.particles.particles.filter(
                            (p: { type: string }) => p.type === "40mm",
                        ).length,
                ),
            { timeout: 10_000 },
        )
        .toBe(0);
}

async function thaw(page: Page): Promise<void> {
    await page.evaluate(() => {
        const ps = (window as any).__rebirth.client.particles;
        ps.update = ps.realUpdate;
    });
}

/** Points the mouse to the right of the local player, so it faces +x. */
async function faceRight(page: Page): Promise<void> {
    const me = await page.evaluate(() => {
        const r = (window as any).__rebirth;
        return r.worldToScreen(r.visualPos(r.player.id)) as { x: number; y: number };
    });
    await page.mouse.move(me.x + 300, me.y);
    await expect
        .poll(() =>
            page.evaluate(() => (window as any).__rebirth.game.getPlayer((window as any).__rebirth.player.id).dir.x),
        )
        .toBeGreaterThan(0.999);
}

/** Puts `gun` in the primary slot with `ammo` rounds loaded, equipped, and waits for its held sprite. */
async function hold(page: Page, gun: string, ammo: number): Promise<void> {
    await page.evaluate(
        ({ gun, ammo }) => {
            const r = (window as any).__rebirth;
            const wm = r.game.getPlayer(r.player.id).weaponManager;
            wm.setWeapon(0, gun, ammo);
            wm.setCurWeapIndex(0, true);
        },
        { gun, ammo },
    );
    await expect
        .poll(() =>
            page.evaluate(() => (window as any).__rebirth.heldGun((window as any).__rebirth.player.id)?.texture),
        )
        .toBe(`gun-${gun}-01.img`);
    // the switch delay (at most 1 s) shows in the local cooldowns only a few snapshots later: let it run out
    await page.waitForTimeout(1300);
}

/** Waits until the held gun's clip holds `ammo` rounds (a reload has ended). */
async function clipIs(page: Page, ammo: number): Promise<void> {
    await expect.poll(() => clipAmmo(page), { timeout: 10_000 }).toBe(ammo);
}

/** Rounds in the held gun's clip (the local state). */
async function clipAmmo(page: Page): Promise<number> {
    return page.evaluate(() => {
        const l = (window as any).__rebirth.local;
        return l.weapons[l.curWeapIdx]?.ammo ?? -1;
    });
}

/**
 * Fires one round: waits until the held gun can fire (its switch delay over), clicks, and clicks again while the clip
 * did not go down (a busy machine can still be in the switch delay the local cooldowns showed late).
 */
async function fire(page: Page): Promise<void> {
    const start = await clipAmmo(page);
    for (let attempt = 0; attempt < 5; attempt++) {
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const l = (window as any).__rebirth.local;
                    return l.cooldowns?.weapons?.[l.curWeapIdx] ?? 0;
                }),
            )
            .toBe(0);
        await page.waitForTimeout(100);
        await page.mouse.down();
        await page.waitForTimeout(120);
        await page.mouse.up();
        const fired = await expect
            .poll(() => clipAmmo(page), { timeout: 1500 })
            .toBeLessThan(start)
            .then(
                () => true,
                () => false,
            );
        if (fired) return;
    }
    throw new Error("the gun did not fire");
}

/** Presses R until a 40 mm case drops (`count` cases recorded in all). */
async function reloadUntilCase(page: Page, count: number): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
        await page.keyboard.press("r");
        const dropped = await expect
            .poll(async () => (await cases(page)).length, { timeout: 2000 })
            .toBe(count)
            .then(
                () => true,
                () => false,
            );
        if (dropped) return;
    }
    throw new Error("no case after the reload");
}

/** Screen box around the local player, `back` px behind it (it faces right). */
async function aroundMe(page: Page, w: number, h: number, back: number) {
    const p = await page.evaluate(() => {
        const r = (window as any).__rebirth;
        return r.worldToScreen(r.visualPos(r.player.id)) as { x: number; y: number };
    });
    return { x: Math.round(p.x) - back, y: Math.round(p.y - h / 2), width: w, height: h };
}

/** Checks the cases recorded from index `from` on: dropped by a reload, at `gun`'s breech, thrown back. */
async function checkCases(page: Page, gun: string, from: number): Promise<void> {
    for (const c of (await cases(page)).slice(from)) {
        expect(c.action, `${gun}: dropped by the reload`).toMatch(/^reload/);
        // on the aim line (facing +x), at the breech just ahead of the right hand (0.875 u)
        expect(c.rel.x, gun).toBeCloseTo(1 + SHELL_OFFSET[gun]!, 1);
        expect(Math.abs(c.rel.y), gun).toBeLessThan(0.1);
        expect(c.vel.x, `${gun}: thrown back`).toBeLessThan(0);
    }
}

test.describe("hand-held launcher casings", () => {
    test("M79, GL-06 and MGL drop their spent 40 mm case from the breech on the reload, not on the shot", async ({
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=m79&zoom=10");
        await faceRight(page);
        await recordCases(page);
        const clip = await aroundMe(page, 360, 260, 150);

        for (const gun of ["m79", "gl06", "mgl"] as const) {
            await hold(page, gun, gun === "mgl" ? 6 : 1);
            await casesGone(page);
            let before = (await cases(page)).length;
            // photographed shortly after the case leaves the breech (the launch smoke drifts over the muzzle)
            await freezeAfterCase(page, 0.07);
            await fire(page);
            // the shot itself drops nothing; the single shots reload by themselves, the MGL is reloaded by hand
            if (gun === "mgl") {
                expect((await cases(page)).length, `${gun}: no case on the shot`).toBe(before);
                await reloadUntilCase(page, before + 1);
            }
            await expect.poll(async () => (await cases(page)).length, { timeout: 10_000 }).toBe(before + 1);
            await checkCases(page, gun, before);
            await page.waitForTimeout(250);
            await page.screenshot({ path: `${SCREENS}/${gun}-shot-reload.png`, clip });
            await thaw(page);
            await clipIs(page, gun === "mgl" ? 6 : 1);
            if (gun !== "m79") continue;
            // an empty M79 reloaded with no shot before it (no smoke): the case at the breech, then beside the player
            for (const [name, after] of [
                ["m79-reload", 0.07],
                ["m79-reload-landed", 0.4],
            ] as const) {
                before = (await cases(page)).length;
                await casesGone(page);
                await freezeAfterCase(page, after);
                await hold(page, gun, 0);
                await reloadUntilCase(page, before + 1);
                await checkCases(page, gun, before);
                await page.waitForTimeout(600);
                await page.screenshot({ path: `${SCREENS}/${name}.png`, clip });
                await thaw(page);
                await clipIs(page, 1);
            }
        }
        expect(errors).toEqual([]);
    });
});
