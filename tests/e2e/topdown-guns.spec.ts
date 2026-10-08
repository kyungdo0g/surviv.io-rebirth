// The drawn top-down held sprites (packages/defs rebirth/heldGunArt.ts, the owner 2026-10-08) in the loopback sandbox:
// the AK-47 (an original gun, through its def's worldImg), the M16A4, the WA2000 and the Hecate II (beta guns, switched
// by objects/heldGun.ts; the Hecate II's def borrowed the AWM-S art, the WA2000 is a bullpup held with survev's bullpup
// gun offset) are held with their own committed SVG from /rebirth/guns/, at 0.25 x the sprite's logical size, in their
// own colours, with no missing sprite and no console error; then all eleven drawn guns and the original M4A1 and AWM-S
// for comparison are held at the size the default zoom of a 1920 x 1080 screen draws them (1x scope: radius 28 over
// 960 px, the same 2.14 camera zoom as radius 18.67 over the 640 px of the test's 1280 x 720 page, which renders much
// faster), facing right. Hooks: window.__rebirth (game, player, client, heldGun, missingSprites). Screenshots:
// __screens__/topdown-guns.
import { expect, type Page, test } from "@playwright/test";
import { decodePng } from "../../tools/assets/png.ts";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/topdown-guns";
/** The drawn guns and their sprites' logical height (rebirth/heldGunArt.ts HELD_GUN_ART). */
const DRAWN: Readonly<Record<string, number>> = {
    ak47: 172,
    g36c: 136,
    m16a4: 220,
    sig550: 188,
    g3: 190,
    fal: 196,
    wa2000: 192,
    m200: 226,
    hecate: 232,
    lynx: 192,
    boys: 238,
};
/** The originals held next to them for comparison, by their own sprite. */
const ORIGINALS = ["m4a1", "awc"] as const;

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

/** Puts `gun` in the local player's primary slot (equipped) and waits until its held sprite shows `texture`. */
async function hold(page: Page, gun: string, texture: string): Promise<void> {
    await page.evaluate((gun) => {
        const r = (window as any).__rebirth;
        const wm = r.game.getPlayer(r.player.id).weaponManager;
        wm.setWeapon(0, gun, 1);
        wm.setCurWeapIndex(0, true);
    }, gun);
    await expect
        .poll(() =>
            page.evaluate(() => (window as any).__rebirth.heldGun((window as any).__rebirth.player.id)?.texture),
        )
        .toBe(texture);
}

/** Screen box of the local player's right-hand gun sprite as drawn. */
async function gunBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        const sprite = r.client.world.renderOf(r.player.id).gunR.container.children[0];
        const b = sprite.getBounds();
        return { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) };
    });
}

/** Pixels of a screenshot within `tol` (per channel) of the colour `rgb`. */
function pixelsNear(png: Buffer, rgb: number, tol = 24): number {
    const img = decodePng(png);
    const c = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
    let n = 0;
    for (let i = 0; i < img.data.length; i += 4) {
        if (c.every((v, k) => Math.abs(img.data[i + k]! - v) <= tol)) n++;
    }
    return n;
}

async function missing(page: Page): Promise<string[]> {
    return page.evaluate(() => [...((window as any).__rebirth.missingSprites ?? [])].map(String));
}

test.describe("top-down held sprites", () => {
    test("AK-47, M16A4, WA2000 and Hecate II hold their own committed SVG, in their own colours", async ({ page }) => {
        const errors = collectErrors(page);
        const fetched: string[] = [];
        page.on("response", (res) => {
            if (res.url().includes("/rebirth/guns/") && res.ok()) fetched.push(new URL(res.url()).pathname);
        });
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=ak47&zoom=12");
        await faceRight(page);
        // gun colour that only the drawn sprite has (the bars are a tinted near-black capsule): the AK-47's wood
        // handguard, the M16A4's rail, the WA2000's walnut, the Hecate II's scope strip
        for (const [gun, colour] of [
            ["ak47", 0x5c2a0c],
            ["m16a4", 0x8f8f8f],
            ["wa2000", 0x7d4b33],
            ["hecate", 0x8f8f8f],
        ] as const) {
            await hold(page, gun, `gun-${gun}-01.img`);
            const held = await page.evaluate(() =>
                (window as any).__rebirth.heldGun((window as any).__rebirth.player.id),
            );
            // drawn at worldImg.scale 0.5 x 0.5: 0.25 x the logical height in body pixels
            expect(held.height, gun).toBeCloseTo(DRAWN[gun]! * 0.25, 3);
            const tint = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                return r.client.world.renderOf(r.player.id).gunR.container.children[0].tint as number;
            });
            expect(tint, gun).toBe(0xffffff);
            // the gun sits at the hand offset (-4.25, -1.75) plus its gun offset: survev's bullpup (-8, 0) for the
            // WA2000's own sprite (rebirth/heldGunArt.ts HELD_GUN_ART_GUN_OFFSET), the def's for the others
            const pos = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                const p = r.client.world.renderOf(r.player.id).gunR.container.position;
                return { x: p.x as number, y: p.y as number };
            });
            const gunOffsetX = gun === "wa2000" || gun === "m16a4" ? -8 : 0;
            expect(pos.x, gun).toBeCloseTo(-4.25 + gunOffsetX, 6);
            expect(pos.y, gun).toBeCloseTo(-1.75, 6);
            await page.waitForTimeout(300);
            const png = await page.screenshot({ clip: await gunBox(page), path: `${SCREENS}/${gun}-close.png` });
            expect(pixelsNear(png, colour), `${gun}: ${colour.toString(16)} pixels`).toBeGreaterThan(20);
            expect(pixelsNear(png, 0xff00ff, 30), `${gun}: placeholder pixels`).toBe(0);
        }
        expect(fetched).toEqual(
            expect.arrayContaining([
                "/rebirth/guns/gun-ak47-01.svg",
                "/rebirth/guns/gun-m16a4-01.svg",
                "/rebirth/guns/gun-wa2000-01.svg",
                "/rebirth/guns/gun-hecate-01.svg",
            ]),
        );
        expect(await missing(page)).toEqual([]);
        expect(errors).toEqual([]);
    });

    test("all drawn guns and the original M4A1 and AWM-S at the 1080p default zoom, facing right", async ({ page }) => {
        test.setTimeout(360_000);
        const errors = collectErrors(page);
        await boot(page, `/?sandbox=1&map=main&seed=1&loot=0&give=ak47&zoom=${(28 * 640) / 960}`);
        await faceRight(page);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.cameraZoom))
            .toBeCloseTo(960 / (28 * 16), 2);
        for (const gun of [...Object.keys(DRAWN), ...ORIGINALS]) {
            const texture = `gun-${gun}-01.img`;
            await hold(page, gun, texture);
            await page.waitForTimeout(400);
            const me = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                return r.worldToScreen(r.visualPos(r.player.id)) as { x: number; y: number };
            });
            // wide enough for the longest sniper (the Boys: muzzle ~70 body px = 150 screen px ahead of the centre)
            const png = await page.screenshot({
                path: `${SCREENS}/${gun}.png`,
                clip: { x: Math.round(me.x) - 80, y: Math.round(me.y) - 60, width: 290, height: 120 },
            });
            expect(pixelsNear(png, 0xff00ff, 30), `${gun}: placeholder pixels`).toBe(0);
        }
        expect(await missing(page)).toEqual([]);
        expect(errors).toEqual([]);
    });
});
