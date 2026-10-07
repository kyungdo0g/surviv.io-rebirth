// What a viewer in a bunker sees of the surface (the owner's 2026-10-07 report: a flare-gun air drop falling outside
// was drawn over the bunker), against the loopback main map, seed 1, at the Chrysanthemum bunker. The original
// (survev client airdrop.ts:108-115, plane.ts:268-276, flare.ts:158-168, smoke.ts:145-159, emote.ts:1088-1092) draws
// these over everything only while the viewer's floor sees the ground: underground the plane, the falling crate, its
// landing smoke, surface smoke, flares, the in-world air strike circle and the emotes of surface players are not
// drawn, and on the surface they are; a bunker smoke is not drawn on the surface; on the stairs a surface smoke shows
// over everything outside the bunker's stair mask and stays under the bunker inside it. Visibility is read from
// window.__rebirth.layerFx (game/debugLayers.ts: the display objects of each kind, drawn or not, and their render
// layers). Screenshots go to __screens__/underground-fx.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";
import { aimAt, keepLocalAlive } from "./m5-helpers.ts";

const SCREENS = "tests/e2e/__screens__/underground-fx";

type Pos = { x: number; y: number };

interface Kind {
    live: number;
    drawn: number;
    layers: number[];
    liveLayers: number[];
}

type Kinds = Record<"planes" | "airdrops" | "airdropSmoke" | "smokes" | "flares" | "zones" | "emotes", Kind>;

async function kinds(page: Page): Promise<Kinds> {
    return page.evaluate(() => (window as any).__rebirth.layerFx.kinds);
}

async function localLayer(page: Page): Promise<number> {
    return page.evaluate(() => (window as any).__rebirth.local.layer);
}

/** Waits until the renderer's layer fade has settled for the local player's layer. */
async function settled(page: Page, underground: boolean): Promise<void> {
    const want = underground ? { layer: 1, ground: 1 } : { layer: 0, ground: 0 };
    await expect
        .poll(() => page.evaluate(() => (window as any).__rebirth.fx.layerFade), { timeout: 10_000 })
        .toEqual(want);
}

/**
 * Teleports the local player to the top of the bunker's entrance stairs and returns the key that walks down them,
 * the top spot and the structure id.
 */
async function toStairs(page: Page): Promise<{ key: string; top: Pos; structure: number }> {
    return page.evaluate(() => {
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
        const top = { x: center.x - d.x * (half + 1.5), y: center.y - d.y * (half + 1.5) };
        g.teleportPlayer(r.player.id, top, 0);
        const key = d.x > 0.5 ? "KeyD" : d.x < -0.5 ? "KeyA" : d.y > 0.5 ? "KeyW" : "KeyS";
        return { key, top, structure: s.id as number };
    });
}

/** Walks down the bunker stairs until `until(layer)` holds; returns where the player stands then and the bunker. */
async function walkDown(page: Page, until: (layer: number) => boolean): Promise<{ pos: Pos; structure: number }> {
    const { key, structure } = await toStairs(page);
    await page.waitForTimeout(500);
    await page.keyboard.down(key);
    await expect.poll(async () => until(await localLayer(page)), { timeout: 15_000, intervals: [30] }).toBe(true);
    await page.keyboard.up(key);
    const pos = await page.evaluate(() => {
        const r = (window as any).__rebirth;
        const p = r.game.getPlayer(r.player.id).pos;
        return { x: p.x, y: p.y };
    });
    return { pos, structure };
}

async function teleport(page: Page, pos: Pos, layer: number): Promise<void> {
    await page.evaluate(
        ({ pos, layer }) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, pos, layer);
        },
        { pos, layer },
    );
}

/** A free surface spot (canPlayerSpawn) near `around`, at least `minDist` from it and not under a roof. */
async function surfaceSpot(page: Page, around: Pos, minDist = 0): Promise<Pos> {
    const spot = await page.evaluate(
        ({ around, minDist }) => {
            const r = (window as any).__rebirth;
            for (let ring = minDist; ring < 40; ring++) {
                for (let a = 0; a < 24; a++) {
                    const ang = (a / 24) * Math.PI * 2;
                    const p = { x: around.x + Math.cos(ang) * ring, y: around.y + Math.sin(ang) * ring };
                    if (r.game.canPlayerSpawn(p) && !r.client.world.insideCeiling(p, 0)) return p;
                }
            }
            return null;
        },
        { around, minDist },
    );
    expect(spot).not.toBeNull();
    return spot as Pos;
}

/** The dummy emotes (its bubble lives about 1.85 s). */
async function dummyEmote(page: Page): Promise<void> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.game.addEmote(r.game.getPlayer(r.dummies[0]), "emote_thumbsup");
    });
}

const SURFACE_ONLY = ["planes", "airdrops", "airdropSmoke", "smokes", "flares", "zones", "emotes"] as const;

test.describe("underground view", () => {
    test("surface effects are not drawn in a bunker and are drawn again on the surface", async ({ page }) => {
        test.setTimeout(300_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=flare_gun&dummies=1");
        const stopKeepAlive = await keepLocalAlive(page);
        const below = (await walkDown(page, (layer) => layer === 1)).pos;
        await settled(page, true);
        expect(await page.evaluate(() => (window as any).__rebirth.layerFx.view.underground)).toBe(true);

        // above the bunker: the dummy stands on the surface, an air strike zone is announced and an air drop comes
        const above = await surfaceSpot(page, below);
        await page.evaluate(
            ({ below, above }) => {
                const r = (window as any).__rebirth;
                const g = r.game;
                r.keepDummy = setInterval(() => {
                    const d = g.getPlayer(r.dummies[0]);
                    if (d && !d.dead) d.health = 100;
                }, 20);
                g.teleportPlayer(r.dummies[0], { x: above.x + 2, y: above.y }, 0);
                // a long warning keeps the circle up for the whole test; the bombs come down far to the west
                g.planes.zones.addZone({ x: below.x - 16, y: below.y }, 6, 3, 40, 1.2, "normal");
                g.planes.addAirdrop({ x: below.x + 5, y: below.y + 5 });
            },
            { below, above },
        );

        // underground until the crate has been falling for a moment (a surface smoke starts with its fall): nothing
        // from the surface is drawn
        const seen: Record<string, number> = {};
        const leaks: string[] = [];
        let fallingFrames = 0;
        for (let i = 0; i < 400 && fallingFrames < 4; i++) {
            if (i % 6 === 0) await dummyEmote(page);
            const k = await kinds(page);
            for (const name of SURFACE_ONLY) {
                seen[name] = Math.max(seen[name] ?? 0, k[name].live);
                if (k[name].drawn > 0) leaks.push(`${name} drawn on layers ${k[name].layers.join(",")}`);
            }
            if (k.airdrops.live > 0 && fallingFrames++ === 0) {
                await page.evaluate((p) => (window as any).__rebirth.game.smokes.addEmitter(p, 0), {
                    x: below.x - 5,
                    y: below.y + 4,
                });
            }
            if (fallingFrames === 3) await page.screenshot({ path: `${SCREENS}/underground-airdrop-falling.png` });
            await page.waitForTimeout(200);
        }
        expect(leaks).toEqual([]);
        // each of them existed meanwhile (the plane passed over, the crate is falling); the dummy's emotes do not even
        // reach the bunker: the server leaves players on the other floor out of the snapshot (rules.cullOtherFloors)
        for (const name of ["planes", "airdrops", "smokes", "zones"]) expect(seen[name], name).toBeGreaterThan(0);
        expect(seen.emotes).toBe(0);
        expect(await localLayer(page)).toBe(1);

        // up on the surface (beside the dummy) the falling crate, the smoke, the zone and the dummy's emote show, over
        // everything (the stairs layers)
        await teleport(page, above, 0);
        await settled(page, false);
        await expect
            .poll(
                async () => {
                    const k = await kinds(page);
                    return [k.airdrops.drawn, k.smokes.drawn > 0, k.zones.drawn];
                },
                { timeout: 10_000, intervals: [50] },
            )
            .toEqual([1, true, 1]);
        const surface = await kinds(page);
        expect(new Set([...surface.airdrops.layers, ...surface.smokes.layers, ...surface.zones.layers])).toEqual(
            new Set([3]),
        );
        await page.screenshot({ path: `${SCREENS}/surface-airdrop-falling.png` });
        // a new emote hides the dummy's bubble until the next frame draws it: emote again only every 2.5 s, so a slow
        // frame rate under load still shows one
        let polls = 0;
        await expect
            .poll(
                async () => {
                    if (polls++ % 10 === 0) await dummyEmote(page);
                    return (await kinds(page)).emotes.drawn;
                },
                { timeout: 20_000, intervals: [250] },
            )
            .toBe(1);

        // it lands while the viewer is on the surface: its smoke shows; back underground the smoke still alive is not
        await expect.poll(async () => (await kinds(page)).airdropSmoke.drawn, { timeout: 30_000 }).toBeGreaterThan(0);
        await page.screenshot({ path: `${SCREENS}/surface-landing-smoke.png` });
        await teleport(page, below, 1);
        await expect
            .poll(
                async () => {
                    const k = (await kinds(page)).airdropSmoke;
                    return k.live === 0 || k.liveLayers.every((l) => l === 0);
                },
                { timeout: 5_000, intervals: [20] },
            )
            .toBe(true);
        await settled(page, true);
        const afterLanding = await kinds(page);
        for (const name of SURFACE_ONLY) expect(afterLanding[name].drawn, name).toBe(0);
        await page.screenshot({ path: `${SCREENS}/underground-after-landing.png` });

        // a flare fired on the surface: drawn there, not once the shooter is underground, drawn again back up
        const open = await surfaceSpot(page, above, 2);
        await teleport(page, open, 0);
        await settled(page, false);
        await page.keyboard.press("Digit1");
        await aimAt(page, { x: open.x + 10, y: open.y + 10 });
        await page.waitForTimeout(300);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.up();
        await expect.poll(async () => (await kinds(page)).flares.drawn, { timeout: 5_000 }).toBe(2);
        await teleport(page, below, 1);
        await settled(page, true);
        const flareBelow = (await kinds(page)).flares;
        expect(flareBelow.live).toBe(2);
        expect(flareBelow.drawn).toBe(0);
        await page.screenshot({ path: `${SCREENS}/underground-flare.png` });
        await teleport(page, open, 0);
        await settled(page, false);
        expect((await kinds(page)).flares.drawn).toBe(2);

        // the flare called an air drop here: its plane is drawn over everything on the surface (and was not in the
        // bunker above)
        await expect.poll(async () => (await kinds(page)).planes.drawn, { timeout: 30_000 }).toBeGreaterThan(0);
        expect(new Set((await kinds(page)).planes.layers)).toEqual(new Set([3]));
        await page.screenshot({ path: `${SCREENS}/surface-plane.png` });

        // the reverse: a bunker smoke is not drawn on the surface (it stays on the faded underground layer)
        await page.evaluate((below) => (window as any).__rebirth.game.smokes.addEmitter(below, 1), below);
        await expect
            .poll(async () => (await kinds(page)).smokes.liveLayers.includes(1), { timeout: 10_000 })
            .toBe(true);
        const bunkerSmoke = (await kinds(page)).smokes;
        expect(bunkerSmoke.layers.includes(1)).toBe(false);
        await teleport(page, below, 1);
        await settled(page, true);
        await expect.poll(async () => (await kinds(page)).smokes.layers, { timeout: 5_000 }).toContain(3);
        await page.screenshot({ path: `${SCREENS}/underground-bunker-smoke.png` });

        await page.evaluate(() => clearInterval((window as any).__rebirth.keepDummy));
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });

    test("on the stairs a surface smoke shows over everything outside the stair mask, under the bunker inside it", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const { pos: onStairs, structure } = await walkDown(page, (layer) => (layer & 2) !== 0);
        await page.waitForTimeout(300);
        expect((await localLayer(page)) & 2).toBe(2);
        // the stair mask of the bunker in view, and a spot outside it in view
        const spots = await page.evaluate(
            ({ structure, onStairs }) => {
                const r = (window as any).__rebirth;
                const masks = r.client.world.renderOf(structure).masks as Array<{ min: Pos; max: Pos }>;
                const m = masks[0];
                const inside = { x: (m.min.x + m.max.x) / 2, y: (m.min.y + m.max.y) / 2 };
                const inMask = (p: Pos) =>
                    masks.some((k) => p.x > k.min.x - 2 && p.x < k.max.x + 2 && p.y > k.min.y - 2 && p.y < k.max.y + 2);
                let outside: Pos | null = null;
                for (let d = 6; d < 30 && !outside; d++) {
                    for (const dir of [
                        { x: 1, y: 0 },
                        { x: -1, y: 0 },
                        { x: 0, y: 1 },
                        { x: 0, y: -1 },
                    ]) {
                        const p = { x: onStairs.x + dir.x * d, y: onStairs.y + dir.y * d };
                        if (!inMask(p)) {
                            outside = p;
                            break;
                        }
                    }
                }
                return { inside, outside };
            },
            { structure, onStairs },
        );
        expect(spots.outside).not.toBeNull();
        await page.evaluate(
            ({ outside }) => (window as any).__rebirth.game.smokes.addEmitter(outside, 0),
            spots as { outside: Pos },
        );
        await expect.poll(async () => (await kinds(page)).smokes.layers, { timeout: 10_000 }).toContain(3);
        await page.screenshot({ path: `${SCREENS}/stairs-surface-smoke.png` });
        await page.evaluate(({ inside }) => (window as any).__rebirth.game.smokes.addEmitter(inside, 0), spots);
        await expect.poll(async () => (await kinds(page)).smokes.liveLayers, { timeout: 10_000 }).toContain(0);
        // still on the stairs: the masked cloud is drawn on the ground layer, under the bunker's floor
        expect((await localLayer(page)) & 2).toBe(2);
        const k = await kinds(page);
        expect(k.smokes.layers).toContain(0);
        expect(k.smokes.layers).toContain(3);
        await page.screenshot({ path: `${SCREENS}/stairs-masked-smoke.png` });
        expect(errors).toEqual([]);
    });
});
