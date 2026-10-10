// The drawn top-down held sprites (packages/defs rebirth/heldGunArt.ts, the owner 2026-10-08) in the loopback sandbox:
// the AK-47 (an original gun, through its def's worldImg), the M16A4, the WA2000 and the Hecate II (beta guns, switched
// by objects/heldGun.ts; the Hecate II's def borrowed the AWM-S art, the WA2000 is a bullpup held with survev's bullpup
// gun offset) are held with their own committed SVG from /rebirth/guns/, at 0.25 x the sprite's logical size, in their
// own colours, with no missing sprite and no console error; so are the SMGs and machine pistols (the P90 with the
// bullpup offset and both hands under it, the AS Val with its left hand on the forend, the dual TEC-9 with the TEC-9's
// sprite in each hand); so are the shotguns and machine guns (the DP-12 with the bullpup offset, the belt guns with
// box and belt in their one sprite and no magazine sprite, all with the sheet's left hands); then all twenty drawn
// guns, the dual TEC-9 and the original M4A1, AWM-S, Vector (a bar), Scorpion, P30L, Saiga and PKP (with its box
// sprite) for comparison are held at the size the default zoom of a 1920 x 1080 screen draws them (1x scope: radius
// 28 over 960 px, the same 2.14 camera zoom as radius 18.67 over the 640 px of the test's 1280 x 720 page, which
// renders much faster), facing right. The RPG-7, Panzerfaust and M202 are held on the shoulder with the hands under
// them, the M79, GL-06 and MGL like a rifle with the hands over them (handHeld, owner 2026-10-08); the RPG-7
// shows its empty sprite (no warhead) from its shot until its reload ends; the rounds fly with their own sprite (the
// rockets frozen mid-flight for the screenshot); the Panzerfaust and the M202 leave the slot after their shot. Hooks: window.__rebirth (game, player, client, heldGun, missingSprites).
// Screenshots: __screens__/topdown-guns.
import { expect, type Page, test } from "@playwright/test";
import { decodePng } from "../../tools/assets/png.ts";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/topdown-guns";
/** The drawn guns and their sprites' logical height (rebirth/heldGunArt.ts HELD_GUN_ART). */
const DRAWN: Readonly<Record<string, number>> = {
    ak47: 172,
    ak74: 172,
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
    bizon: 140,
    asval: 152,
    p90: 116,
    tec9: 116,
    dp12: 140,
    aa12: 194,
    m60: 212,
    mg42: 218,
    dshk: 250,
    m79: 138,
    gl06: 130,
    mgl: 144,
    rpg7: 204,
    panzerfaust: 210,
    m202: 196,
};
/**
 * The launchers: the RPG-7, Panzerfaust and M202 held on the shoulder with both hands under the gun (the sheet's potato
 * cannon worldImg); the M79, GL-06 and MGL held like a rifle (GunDef.handHeld, owner 2026-10-08), with their left hands.
 */
const LAUNCHERS = ["m79", "gl06", "mgl", "rpg7", "panzerfaust", "m202"] as const;
const HAND_HELD: Readonly<Record<string, { x: number; y: number }>> = {
    m79: { x: -2, y: 0 },
    gl06: { x: -2, y: 0 },
    mgl: { x: 0, y: 0 },
};
/** The dual pistols that hold a drawn sprite: their single's, one in each hand (objects/heldGun.ts ownHeldSprite). */
const DRAWN_DUALS = ["tec9_dual"] as const;
/**
 * The originals held next to them for comparison, by the texture they hold: their own sprite (the PKP's top one, its
 * box a second sprite under it), or the Vector's gun-med-01 bar (it has no held sprite of its own in 0.8.82).
 */
const ORIGINALS: Readonly<Record<string, string>> = {
    m4a1: "gun-m4a1-01.img",
    awc: "gun-awc-01.img",
    vector: "gun-med-01.img",
    scorpion: "gun-scorpion-01.img",
    p30l: "gun-p30l-01.img",
    saiga: "gun-saiga-01.img",
    pkp: "gun-pkp-top-01.img",
};

/** The held sprite a gun draws (a dual pistol its single's). */
const textureOf = (gun: string) => `gun-${gun.replace(/_dual$/, "")}-01.img`;

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
        const sprite = r.client.world.renderOf(r.player.id).gunR.barrel;
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

/** Waits until the held gun can fire (its switch delay over), then clicks once. */
async function fire(page: Page): Promise<void> {
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
    await page.waitForTimeout(150);
    await page.mouse.up();
}

/**
 * Freezes the next launcher round a few units into its flight for a screenshot: once a round sprite flies, the
 * tracers get 0.06 s more, then dt 0 (they stay put and keep being drawn).
 */
async function freezeBullets(page: Page): Promise<void> {
    await page.evaluate(() => {
        const b = (window as any).__rebirth.client.bullets;
        const update = b.update.bind(b);
        b.realUpdate = update;
        let left = 0.06;
        b.update = (dt: number, scene: unknown) => {
            if (b.roundHeads.length === 0) return update(dt, scene);
            const step = Math.min(dt, left);
            left -= step;
            update(step, scene);
        };
    });
}

async function thawBullets(page: Page): Promise<void> {
    await page.evaluate(() => {
        const b = (window as any).__rebirth.client.bullets;
        b.update = b.realUpdate;
    });
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

    test("SMGs and machine pistols: own SVG, the P90 hands below, the dual TEC-9 one per hand", async ({ page }) => {
        const errors = collectErrors(page);
        const fetched: string[] = [];
        page.on("response", (res) => {
            if (res.url().includes("/rebirth/guns/") && res.ok()) fetched.push(new URL(res.url()).pathname);
        });
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=bizon&zoom=12");
        await faceRight(page);
        // a colour only the drawn sprite has (the bars are a tinted near-black capsule): the Bizon's grey helical
        // magazine, the AS Val's silver scope, the P90's amber magazine (only visible with the hands under the gun),
        // the TEC-9's steel shroud
        for (const [gun, colour] of [
            ["bizon", 0x5a5a5a],
            ["asval", 0x999999],
            ["p90", 0x8c5f3c],
            ["tec9", 0x555555],
            ["tec9_dual", 0x555555],
        ] as const) {
            await hold(page, gun, textureOf(gun));
            // the left hand at rest sits at its idle pose's place plus the left-hand offset: the sheet's, but the AS
            // Val's own sprite's (4, 0) instead of (9, 0) (HELD_GUN_ART_LEFT_HAND_OFFSET); it moves on the next frame
            const lho = { bizon: 0, asval: 4, p90: 7, tec9: 0.8, tec9_dual: 0 }[gun];
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const r = (window as any).__rebirth;
                        return r.client.world.renderOf(r.player.id).handL.position.x as number;
                    }),
                )
                .toBeCloseTo(lho, 1);
            await page.waitForTimeout(400);
            const state = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                const view = r.client.world.renderOf(r.player.id);
                const sprite = (g: any) => g.container.children[0];
                return {
                    height: r.heldGun(r.player.id).height as number,
                    tint: sprite(view.gunR).tint as number,
                    posR: { x: view.gunR.container.position.x as number, y: view.gunR.container.position.y as number },
                    leftVisible: view.gunL.container.visible as boolean,
                    leftTexture: sprite(view.gunL).texture?.label as string,
                    posL: { x: view.gunL.container.position.x as number, y: view.gunL.container.position.y as number },
                    gunOverHand: view.handR.children.at(-1) === view.gunR.container,
                    handL: { x: view.handL.position.x as number, y: view.handL.position.y as number },
                };
            });
            expect(state.height, gun).toBeCloseTo(DRAWN[gun.replace(/_dual$/, "")]! * 0.25, 3);
            expect(state.tint, gun).toBe(0xffffff);
            if (gun === "tec9_dual") {
                // one copy of the sprite in each hand at the dual hand offset (-5.95, 0), not mirrored
                expect(state.leftVisible).toBe(true);
                expect(state.leftTexture).toBe("gun-tec9-01.img");
                for (const pos of [state.posR, state.posL]) {
                    expect(pos.x).toBeCloseTo(-5.95, 6);
                    expect(pos.y).toBeCloseTo(0, 6);
                }
            } else {
                expect(state.leftVisible, gun).toBe(false);
                // the hand offset (-4.25, -1.75), plus survev's bullpup (-8, 0) for the P90's own sprite
                expect(state.posR.x, gun).toBeCloseTo(-4.25 + (gun === "p90" ? -8 : 0), 6);
                expect(state.posR.y, gun).toBeCloseTo(-1.75, 6);
            }
            // only the P90's hands go under the gun (HELD_GUN_ART_HANDS_BELOW)
            expect(state.gunOverHand, gun).toBe(gun === "p90");
            expect(state.handL.x, gun).toBeCloseTo(lho, 1);
            expect(state.handL.y, gun).toBeCloseTo(0, 1);
            const png = await page.screenshot({ clip: await gunBox(page), path: `${SCREENS}/${gun}-close.png` });
            expect(pixelsNear(png, colour), `${gun}: ${colour.toString(16)} pixels`).toBeGreaterThan(20);
            expect(pixelsNear(png, 0xff00ff, 30), `${gun}: placeholder pixels`).toBe(0);
        }
        expect(fetched).toEqual(
            expect.arrayContaining([
                "/rebirth/guns/gun-bizon-01.svg",
                "/rebirth/guns/gun-asval-01.svg",
                "/rebirth/guns/gun-p90-01.svg",
                "/rebirth/guns/gun-tec9-01.svg",
            ]),
        );
        expect(await missing(page)).toEqual([]);
        expect(errors).toEqual([]);
    });

    test("shotguns and machine guns: own SVG, the DP-12 bullpup offset, box and belt in the one sprite", async ({
        page,
    }) => {
        const errors = collectErrors(page);
        const fetched: string[] = [];
        page.on("response", (res) => {
            if (res.url().includes("/rebirth/guns/") && res.ok()) fetched.push(new URL(res.url()).pathname);
        });
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=dp12&zoom=12");
        await faceRight(page);
        // a colour only the drawn sprite has, and neither the grass nor the hands (the shotguns' bars are tinted brown
        // and dark grey, the machine guns' near-black): the DP-12's grey polymer (its thin highlight strip is mostly
        // under the left hand), the AA-12's grey highlight strip, the M60's steel receiver (its OD box is too close to
        // the grass's shades), the MG 42's cold blue-grey highlight, the DShK's lit radiator fins
        for (const [gun, colour] of [
            ["dp12", 0x484848],
            ["aa12", 0x8f8f8f],
            ["m60", 0x555555],
            ["mg42", 0xa3b1c0],
            ["dshk", 0x6a7078],
        ] as const) {
            await hold(page, gun, textureOf(gun));
            // the left hand at rest: the sheet's offset (the machine guns keep the PKP's 12.5)
            const lho = { dp12: 7, aa12: 8, m60: 12.5, mg42: 12.5, dshk: 12.5 }[gun];
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const r = (window as any).__rebirth;
                        return r.client.world.renderOf(r.player.id).handL.position.x as number;
                    }),
                )
                .toBeCloseTo(lho, 1);
            await page.waitForTimeout(400);
            const state = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                const view = r.client.world.renderOf(r.player.id);
                return {
                    height: r.heldGun(r.player.id).height as number,
                    tint: view.gunR.barrel.tint as number,
                    shown: view.gunR.container.children.filter((c: any) => c.visible).length as number,
                    magTop: view.gunR.magTop as boolean,
                    posR: { x: view.gunR.container.position.x as number, y: view.gunR.container.position.y as number },
                    leftVisible: view.gunL.container.visible as boolean,
                    gunOverHand: view.handR.children.at(-1) === view.gunR.container,
                    handL: { x: view.handL.position.x as number, y: view.handL.position.y as number },
                };
            });
            // 0.25 x the logical height, give or take the raster's rounding up to whole texels (textures.ts: at 0.75
            // texels per px the AA-12's 194 px become 146 texels, so the texture reports 194.67)
            expect(state.height, gun).toBeCloseTo(DRAWN[gun]! * 0.25, 0);
            expect(state.tint, gun).toBe(0xffffff);
            // the barrel sprite only: no magazine sprite (the sheet's borrowed gun-pkp-bot-01 stays off the belt guns)
            expect(state.shown, gun).toBe(1);
            expect(state.magTop, gun).toBe(false);
            expect(state.leftVisible, gun).toBe(false);
            // the hand offset (-4.25, -1.75), plus survev's bullpup (-8, 0) for the DP-12's own sprite
            expect(state.posR.x, gun).toBeCloseTo(-4.25 + (gun === "dp12" ? -8 : 0), 6);
            expect(state.posR.y, gun).toBeCloseTo(-1.75, 6);
            expect(state.gunOverHand, gun).toBe(false);
            expect(state.handL.x, gun).toBeCloseTo(lho, 1);
            expect(state.handL.y, gun).toBeCloseTo(0, 1);
            const png = await page.screenshot({ clip: await gunBox(page), path: `${SCREENS}/${gun}-close.png` });
            expect(pixelsNear(png, colour, 16), `${gun}: ${colour.toString(16)} pixels`).toBeGreaterThan(20);
            expect(pixelsNear(png, 0xff00ff, 30), `${gun}: placeholder pixels`).toBe(0);
        }
        expect(fetched).toEqual(
            expect.arrayContaining([
                "/rebirth/guns/gun-dp12-01.svg",
                "/rebirth/guns/gun-aa12-01.svg",
                "/rebirth/guns/gun-m60-01.svg",
                "/rebirth/guns/gun-mg42-01.svg",
                "/rebirth/guns/gun-dshk-01.svg",
            ]),
        );
        expect(await missing(page)).toEqual([]);
        expect(errors).toEqual([]);
    });

    test("launchers: own SVG, three like a rifle and three on the shoulder, the RPG-7 empty after its shot, own rounds", async ({
        page,
    }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, `/?sandbox=1&map=main&seed=1&loot=0&give=rpg7&zoom=${(28 * 640) / 960}`);
        await faceRight(page);
        const me = async () =>
            page.evaluate(() => {
                const r = (window as any).__rebirth;
                return r.worldToScreen(r.visualPos(r.player.id)) as { x: number; y: number };
            });
        const near = async (w: number, h: number, back = 80) => {
            const p = await me();
            return { x: Math.round(p.x) - back, y: Math.round(p.y) - h / 2, width: w, height: h };
        };
        for (const gun of LAUNCHERS) {
            await hold(page, gun, textureOf(gun));
            await page.waitForTimeout(400);
            const state = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                const view = r.client.world.renderOf(r.player.id);
                return {
                    height: r.heldGun(r.player.id).height as number,
                    tint: view.gunR.barrel.tint as number,
                    gunOverHand: view.handR.children.at(-1) === view.gunR.container,
                    gunUnderHand: view.handR.children[0] === view.gunR.container,
                    posR: { x: view.gunR.container.position.x as number, y: view.gunR.container.position.y as number },
                    // where the hands are (the pose's pivot; the left hand's position carries its offset)
                    handR: { x: -view.handR.pivot.x as number, y: -view.handR.pivot.y as number },
                    handL: {
                        x: (view.handL.position.x - view.handL.pivot.x) as number,
                        y: (view.handL.position.y - view.handL.pivot.y) as number,
                    },
                };
            });
            expect(state.height, gun).toBeCloseTo(DRAWN[gun]! * 0.25, 0);
            expect(state.tint, gun).toBe(0xffffff);
            const lho = HAND_HELD[gun];
            if (lho) {
                // like a rifle: rifle pose hands (14, 1.75) and (28, 5.25) + its left hand, both over the gun; gun
                // offset (-8, 0) on the hand offset (-4.25, -1.75)
                expect(state.gunUnderHand, gun).toBe(true);
                expect(state.handR, gun).toEqual({ x: expect.closeTo(14, 6), y: expect.closeTo(1.75, 6) });
                expect(state.handL, gun).toEqual({
                    x: expect.closeTo(28 + lho.x, 6),
                    y: expect.closeTo(5.25 + lho.y, 6),
                });
                expect(state.posR.x, gun).toBeCloseTo(-12.25, 6);
                expect(state.posR.y, gun).toBeCloseTo(-1.75, 6);
            } else {
                // on the shoulder, hands under the gun; the potato cannon's gun offset (-10, -4) on the hand offset
                expect(state.gunOverHand, gun).toBe(true);
                expect(state.handR, gun).toEqual({ x: expect.closeTo(2, 6), y: expect.closeTo(22, 6) });
                expect(state.posR.x, gun).toBeCloseTo(-14.25, 6);
                expect(state.posR.y, gun).toBeCloseTo(-5.75, 6);
            }
            const png = await page.screenshot({ path: `${SCREENS}/${gun}-held.png`, clip: await near(290, 120) });
            expect(pixelsNear(png, 0xff00ff, 30), `${gun}: placeholder pixels`).toBe(0);
        }

        // the RPG-7: its warhead leaves with the shot, the rocket flies with its own sprite, the reload brings it back
        await hold(page, "rpg7", "gun-rpg7-01.img");
        await freezeBullets(page);
        await fire(page);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.client.bullets.roundHeads.length), {
                timeout: 10_000,
            })
            .toBeGreaterThan(0);
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__rebirth.heldGun((window as any).__rebirth.player.id)?.texture),
            )
            .toBe("gun-rpg7-empty-01.img");
        await page.waitForTimeout(300);
        const heads = await page.evaluate(() => (window as any).__rebirth.client.bullets.roundHeads);
        expect(heads.map((h: { bulletType: string }) => h.bulletType)).toEqual(["bullet_rpg7"]);
        expect(heads[0].rotation).toBeCloseTo(Math.PI / 2, 2);
        let png = await page.screenshot({ path: `${SCREENS}/rpg7-fired.png`, clip: await near(420, 160) });
        expect(pixelsNear(png, 0xff00ff, 30), "rpg7 fired: placeholder pixels").toBe(0);
        await thawBullets(page);
        // the reload (a rocket left in the bag) loads the next warhead
        await page.keyboard.press("KeyR");
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () => (window as any).__rebirth.heldGun((window as any).__rebirth.player.id)?.texture,
                    ),
                { timeout: 10_000 },
            )
            .toBe("gun-rpg7-01.img");

        // the M79's 40 mm grenade: its own round sprite, nose along the throw, growing with its height
        await hold(page, "m79", "gun-m79-01.img");
        await fire(page);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.client.worldFx.projectiles.count), {
                timeout: 10_000,
            })
            .toBeGreaterThan(0);
        // freeze it a few frames into the flight for the screenshot (no new snapshots, no time), until its sprite shows
        await page.evaluate(() => {
            const ps = (window as any).__rebirth.client.worldFx.projectiles;
            const update = ps.update.bind(ps);
            ps.realApply = ps.apply;
            ps.realUpdate = update;
            let left = 0.12;
            ps.update = (dt: number, layer: number) => {
                const step = Math.min(dt, left);
                left -= step;
                update(step, layer);
            };
            ps.apply = () => {};
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        [...(window as any).__rebirth.client.worldFx.projectiles.projs.values()][0].sprite.texture
                            .label,
                ),
            )
            .toBe("proj-40mm-01.img");
        await page.waitForTimeout(300);
        const round = await page.evaluate(() => {
            const p = [...(window as any).__rebirth.client.worldFx.projectiles.projs.values()][0];
            return {
                texture: p.sprite.texture.label as string,
                rotation: p.sprite.rotation as number,
                tint: p.sprite.tint,
            };
        });
        expect(round).toEqual({
            texture: "proj-40mm-01.img",
            rotation: expect.closeTo(Math.PI / 2, 2),
            tint: 0xffffff,
        });
        // around the player and the grenade, wherever the snapshots had it when frozen
        const box = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const p = [...r.client.worldFx.projectiles.projs.values()][0];
            const b = p.sprite.getBounds();
            const me = r.worldToScreen(r.visualPos(r.player.id));
            const x0 = Math.max(0, Math.min(me.x - 80, b.x - 40));
            const x1 = Math.min(1280, Math.max(me.x + 120, b.x + b.width + 40));
            const y0 = Math.max(0, Math.min(me.y - 80, b.y - 40));
            const y1 = Math.min(720, Math.max(me.y + 80, b.y + b.height + 40));
            return { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
        });
        png = await page.screenshot({ path: `${SCREENS}/m79-grenade.png`, clip: box });
        expect(pixelsNear(png, 0xff00ff, 30), "m79 grenade: placeholder pixels").toBe(0);
        await page.evaluate(() => {
            const ps = (window as any).__rebirth.client.worldFx.projectiles;
            ps.update = ps.realUpdate;
            ps.apply = ps.realApply;
        });
        // the M202 bursts its fan at the cursor: aim far out of the blasts' reach
        const pos = await me();
        await page.mouse.move(pos.x + 620, pos.y);

        // the Panzerfaust and the M202 are thrown away after their shot: the slot empties
        for (const gun of ["panzerfaust", "m202"] as const) {
            await hold(page, gun, textureOf(gun));
            await freezeBullets(page);
            await fire(page);
            await expect
                .poll(() => page.evaluate(() => (window as any).__rebirth.client.bullets.roundHeads.length), {
                    timeout: 10_000,
                })
                .toBeGreaterThan(0);
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${SCREENS}/${gun}-fired.png`, clip: await near(420, 200) });
            await thawBullets(page);
            await expect
                .poll(() => page.evaluate(() => (window as any).__rebirth.local.weapons[0].type), { timeout: 5_000 })
                .toBe("");
            await page.screenshot({ path: `${SCREENS}/${gun}-discarded.png`, clip: await near(290, 120) });
        }
        expect(await missing(page)).toEqual([]);
        expect(errors).toEqual([]);
    });

    test("all drawn guns and seven originals for comparison at the 1080p default zoom, facing right", async ({
        page,
    }) => {
        test.setTimeout(600_000);
        const errors = collectErrors(page);
        await boot(page, `/?sandbox=1&map=main&seed=1&loot=0&give=ak47&zoom=${(28 * 640) / 960}`);
        await faceRight(page);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.cameraZoom))
            .toBeCloseTo(960 / (28 * 16), 2);
        for (const gun of [...Object.keys(DRAWN), ...DRAWN_DUALS, ...Object.keys(ORIGINALS)]) {
            await hold(page, gun, ORIGINALS[gun] ?? textureOf(gun));
            await page.waitForTimeout(400);
            const me = await page.evaluate(() => {
                const r = (window as any).__rebirth;
                return r.worldToScreen(r.visualPos(r.player.id)) as { x: number; y: number };
            });
            // wide enough for the longest guns (the Boys' muzzle ~70 body px = 150 screen px ahead of the centre, the
            // DShK's ~3 body px further)
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
