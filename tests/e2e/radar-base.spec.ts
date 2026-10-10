// The radar base (packages/defs rebirth/buildings/radar/, the owner's wave 3, 2026-10-10) in the building showcase:
// the fenced compound from above, the yard at the main gate, inside the dome tower (the 8x lookout), the operations
// room, the crypto vault, the barracks and the generator shed; every image drawn (no missing sprite). Screenshots:
// __screens__/radar-base (SCREENS_DIR overrides it).
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = process.env.SCREENS_DIR ?? "tests/e2e/__screens__/radar-base";
const TYPE = "radar_base_01";

/** Teleports the local player to the base's local point (x, y), turned by its ori. */
async function standAt(page: Page, x: number, y: number): Promise<void> {
    await page.evaluate(
        ({ type, x, y }) => {
            const r = (window as any).__rebirth;
            const game = r.game;
            const root = game.generation.objects.find((o: any) => o.parentId === 0 && o.type === type);
            const ori = ((root.ori % 4) + 4) % 4;
            const rot = [
                [x, y],
                [-y, x],
                [-x, -y],
                [y, -x],
            ][ori];
            game.teleportPlayer(r.player.id, { x: root.pos.x + rot[0], y: root.pos.y + rot[1] }, 0);
        },
        { type: TYPE, x, y },
    );
}

test("radar_base_01: the compound from above, the dome's lookout, the ops building and the vault", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await boot(page, `/?building=${TYPE}&seed=1&zoom=86`);
    expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("faction");
    await standAt(page, 0, -30);
    // the whole base: the camera on the compound, a 15x scope so the simulation streams all of it
    await page.evaluate((type) => {
        const r = (window as any).__rebirth;
        const root = r.game.generation.objects.find((o: any) => o.parentId === 0 && o.type === type);
        r.game.getPlayer(r.player.id).scope = "15xscope";
        r.cameraAt = { x: root.pos.x, y: root.pos.y };
    }, TYPE);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENS}/${TYPE}-aerial.png` });
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.game.getPlayer(r.player.id).scope = "1xscope";
        r.cameraAt = undefined;
    });
    for (const [name, x, y] of [
        ["gate", 0, -38],
        ["dome", 0, 21],
        ["ops", 24, 21],
        ["vault", 38, 22],
        ["barracks", -26, -9],
        ["generator", 30, -35],
    ] as const) {
        await standAt(page, x, y);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/${TYPE}-${name}.png` });
    }
    // the dome gives the 8x scope's view
    await standAt(page, 0, 21);
    await page.waitForTimeout(500);
    expect(
        await page.evaluate(() => (window as any).__rebirth.game.getPlayer((window as any).__rebirth.player.id).zoom),
    ).toBe(68);
    expect(
        (await page.evaluate(() => [...((window as any).__rebirth.missingSprites ?? [])].map(String))).filter((s) =>
            s.includes("radar"),
        ),
    ).toEqual([]);
    expect(errors).toEqual([]);
});
