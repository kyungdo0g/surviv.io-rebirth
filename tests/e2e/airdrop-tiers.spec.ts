// Rebirth air drop tiers on the client (docs/research/rebirth-deviations.md "Air drop tiers"), against the loopback
// main map: a forced tier 1 drop, a forced tier 2 drop and a gold drop land side by side; the tier 1 and tier 2 shells
// are drawn exactly alike (same sprite, tint and size, no mark, the same pixels), as is the gold shell (on the main map
// v0.8.82 draws both of its shells with map-airdrop-01); the star images are preloaded; once opened, the tier 1 crate
// shows one silver star, the tier 2 crate two blue stars and the gold crate its gold corners without a mark. Drops are
// forced through the sandbox Game (window.__rebirth.game.planes.addAirdrop with a tier, as m4.spec.ts forces a drop).
// Screenshots go to __screens__/airdrop-tiers.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";
import { keepLocalAlive } from "./m5-helpers.ts";

const SCREENS = "tests/e2e/__screens__/airdrop-tiers";

type Pos = { x: number; y: number };

interface Drawn {
    id: number;
    type: string;
    texture: string;
    tint: number;
    scale: number;
    rotation: number;
    alpha: number;
    visible: boolean;
    mark: Array<{ texture: string; tint: number; visible: boolean; scale: number }>;
}

/** Live obstacles of these types in the latest snapshot. */
async function obstacles(page: Page, types: string[]): Promise<Array<{ id: number; type: string; pos: Pos }>> {
    return page.evaluate(
        (types) =>
            ((window as any).__rebirth.lastSnapshot.objects ?? [])
                .filter((o: any) => o.kind === "obstacle" && types.includes(o.type) && !o.dead)
                .map((o: any) => ({ id: o.id, type: o.type, pos: o.pos })),
        types,
    );
}

/** How the client draws obstacle `id`: its sprite and its tier stars. */
async function drawn(page: Page, id: number): Promise<Drawn> {
    return page.evaluate((id) => {
        const r = (window as any).__rebirth;
        const render = r.client.world.renderOf(id);
        const view = r.client.world.get(id);
        const { sprite, mark } = render.drawn;
        return {
            id,
            type: view.type,
            texture: sprite.texture.label,
            tint: sprite.tint,
            scale: sprite.scale.x,
            rotation: sprite.rotation,
            alpha: sprite.alpha,
            visible: sprite.visible,
            mark: mark.map((s: any) => ({
                texture: s.texture.label,
                tint: s.tint,
                visible: s.visible,
                scale: s.scale.x,
            })),
        };
    }, id);
}

/**
 * Mean absolute RGB difference (0-255) between the central `frac` of two square regions of `size` screen pixels
 * centred on `a` and `b` in a screenshot (decoded in the page).
 */
async function regionDiff(page: Page, png: Buffer, a: Pos, b: Pos, size: number, frac = 0.7): Promise<number> {
    return page.evaluate(
        async ({ data, a, b, size, frac }) => {
            const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
            const bmp = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(bmp, 0, 0);
            const w = Math.round(size * frac);
            const grab = (c: { x: number; y: number }) =>
                ctx.getImageData(Math.round(c.x - w / 2), Math.round(c.y - w / 2), w, w).data;
            const pa = grab(a);
            const pb = grab(b);
            let sum = 0;
            for (let i = 0; i < pa.length; i += 4) {
                sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
            }
            return sum / ((pa.length / 4) * 3);
        },
        { data: png.toString("base64"), a, b, size, frac },
    );
}

async function screenPos(page: Page, pos: Pos): Promise<Pos> {
    return page.evaluate((p) => (window as any).__rebirth.worldToScreen(p), pos);
}

/** Screen pixels per world unit at the current zoom. */
async function pixelsPerUnit(page: Page, at: Pos): Promise<number> {
    const a = await screenPos(page, at);
    const b = await screenPos(page, { x: at.x + 10, y: at.y });
    return Math.abs(b.x - a.x) / 10;
}

/** Teleports the local player 3.4 u south of a shell, opens it with F and waits for its inner crate. */
async function open(page: Page, shell: { id: number; pos: Pos }, inner: string): Promise<void> {
    await page.evaluate((pos) => {
        const r = (window as any).__rebirth;
        r.game.teleportPlayer(r.player.id, { x: pos.x, y: pos.y - 3.4 });
    }, shell.pos);
    await page.waitForFunction(() => (window as any).__rebirth.interaction()?.text === "Unlock Air Drop", null, {
        timeout: 10_000,
    });
    await page.keyboard.press("f");
    await expect.poll(async () => (await obstacles(page, [inner])).length, { timeout: 15_000 }).toBe(1);
}

test.describe("air drop tiers", () => {
    test("tier 1, tier 2 and gold drops: identical shells, the tier shown on the opened crate", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const stopKeepAlive = await keepLocalAlive(page);
        const spot = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const p = r.game.getPlayer(r.player.id).pos;
            const at = (dx: number) => ({ x: p.x + dx, y: p.y + 9 });
            // west to east: tier 1, tier 2, gold (the shells cannot overlap: pending drops push each other apart)
            r.game.planes.addAirdrop(at(-9), "airdrop_crate_01", "tier1");
            r.game.planes.addAirdrop(at(0), "airdrop_crate_01", "tier2");
            r.game.planes.addAirdrop(at(9), "airdrop_crate_02");
            return { x: p.x, y: p.y };
        });
        // 15 s of flight, then an 8 s fall
        await expect
            .poll(async () => (await obstacles(page, ["airdrop_crate_01", "airdrop_crate_02"])).length, {
                timeout: 60_000,
            })
            .toBe(3);
        const shells = (await obstacles(page, ["airdrop_crate_01", "airdrop_crate_02"])).sort(
            (a, b) => a.pos.x - b.pos.x,
        );
        expect(shells.map((s) => s.type)).toEqual(["airdrop_crate_01", "airdrop_crate_01", "airdrop_crate_02"]);
        await page.evaluate((p) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, p);
        }, spot);
        // the parachutes go away 1 s after their crate landed, then the landing smoke clears (the only particles here;
        // their life runs on frame time, slow under software GL)
        await page.waitForFunction(
            () => (window as any).__rebirth.air.airdrops === 0 && (window as any).__rebirth.worldFeel.particles === 0,
            null,
            { timeout: 45_000 },
        );
        await page.waitForTimeout(300);

        // before opening: the three shells are drawn alike, without any mark
        const outer = await Promise.all(shells.map((s) => drawn(page, s.id)));
        const look = (d: Drawn) => ({ ...d, id: 0, type: "" });
        expect(look(outer[1])).toEqual(look(outer[0]));
        expect(look(outer[2])).toEqual(look(outer[0]));
        expect(outer[0]).toMatchObject({ texture: "map-airdrop-01.img", visible: true, mark: [] });
        // the stars are preloaded with the map's crates, so the first crate opened shows its mark at once
        const starsLoaded = await page.evaluate(() =>
            ["star.img", "star-blue.img"].map((k) => (window as any).__rebirth.client.textures.isLoaded(k)),
        );
        expect(starsLoaded).toEqual([true, true]);
        const outerPng = await page.screenshot({ path: `${SCREENS}/outer.png` });
        const ppu = await pixelsPerUnit(page, spot);
        const outerScreen = await Promise.all(shells.map((s) => screenPos(page, s.pos)));
        // the same pixels, up to sub-pixel placement (the crates land at fractional positions)
        const outerDiff = await regionDiff(page, outerPng, outerScreen[0], outerScreen[1], 5 * ppu);
        expect(outerDiff).toBeLessThan(6);

        // open each: the shell bursts into its tier's crate
        await open(page, shells[0], "crate_10t1");
        await open(page, shells[1], "crate_10t2");
        await open(page, shells[2], "crate_11");
        await page.evaluate((p) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, p);
        }, spot);
        await page.waitForTimeout(800);
        const [t1] = await obstacles(page, ["crate_10t1"]);
        const [t2] = await obstacles(page, ["crate_10t2"]);
        const [gold] = await obstacles(page, ["crate_11"]);
        const inner = await Promise.all([t1, t2, gold].map((c) => drawn(page, c.id)));
        // the same crate_10 sprite underneath; tier 1 one silver star, tier 2 two blue stars, gold none
        expect(inner[0]).toMatchObject({ texture: "map-crate-10.img", visible: true });
        expect(inner[1]).toMatchObject({ texture: "map-crate-10.img", visible: true });
        expect(inner[2]).toMatchObject({ texture: "map-crate-11.img", visible: true, mark: [] });
        expect(inner[0].mark.map((m) => [m.texture, m.visible])).toEqual([["star.img", true]]);
        expect(inner[1].mark.map((m) => [m.texture, m.visible])).toEqual([
            ["star-blue.img", true],
            ["star-blue.img", true],
        ]);
        const openedPng = await page.screenshot({ path: `${SCREENS}/opened.png` });
        const innerScreen = await Promise.all([t1, t2, gold].map((c) => screenPos(page, c.pos)));
        const clipAround = (c: Pos[]) => {
            const xs = c.map((p) => p.x);
            const ys = c.map((p) => p.y);
            const pad = 4 * ppu;
            const x = Math.max(0, Math.min(...xs) - pad);
            const y = Math.max(0, Math.min(...ys) - pad);
            return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y };
        };
        await page.screenshot({ path: `${SCREENS}/opened-closeup.png`, clip: clipAround(innerScreen) });
        // tier 1 and tier 2 crates now read differently
        const innerDiff = await regionDiff(page, openedPng, innerScreen[0], innerScreen[1], 4.5 * ppu);
        expect(innerDiff).toBeGreaterThan(4 * outerDiff + 10);

        // breaking a tier crate drops its loot and takes its stars away with it
        await page.evaluate((id) => {
            const g = (window as any).__rebirth.game;
            g.damageObstacle(g.world.objects.get(id), {
                amount: 100_000,
                damageType: 0,
                gameSourceType: "",
                sourceId: 0,
            });
        }, t2.id);
        await expect.poll(async () => (await drawn(page, t2.id)).mark.map((m) => m.visible)).toEqual([false, false]);
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });
});
