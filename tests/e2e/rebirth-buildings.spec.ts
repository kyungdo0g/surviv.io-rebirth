// The rebirth buildings (packages/defs rebirth/buildings.ts, the owner's request 2026-10-08) in the building showcase:
// the clinic (main) and the faction command posts (50v50) draw their own floor and roof (committed SVGs, no missing
// sprite), the roof hides once the player is inside, the clinic's treatment rooms heal, each post holds its faction's
// crate. Hooks: window.__rebirth (showcase, game, player, missingSprites). Screenshots: __screens__/rebirth-buildings.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/rebirth-buildings";

/** Teleports the local player to the building's local point (x, y), turned by the building's ori. */
async function standAt(page: Page, type: string, x: number, y: number): Promise<void> {
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
        { type, x, y },
    );
}

async function missing(page: Page): Promise<string[]> {
    return page.evaluate(() => [...((window as any).__rebirth.missingSprites ?? [])].map(String));
}

test.describe("rebirth buildings", () => {
    test("the clinic: its roof outside, its rooms inside, the treatment rooms heal", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?building=clinic_01&seed=1");
        expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("main");
        await standAt(page, "clinic_01", 0, -16);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/clinic-outside.png` });
        await standAt(page, "clinic_01", 0, -4);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/clinic-inside.png` });

        // a treatment room: 2 HP/s
        await standAt(page, "clinic_01", -9, 4.5);
        const before = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            me.health = 50;
            return me.health as number;
        });
        await page.waitForTimeout(2500);
        const after = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            return r.game.getPlayer(r.player.id).health as number;
        });
        expect(after).toBeGreaterThan(before + 2);
        await page.screenshot({ path: `${SCREENS}/clinic-ward.png` });
        // the treatment rooms show that they heal: glow, rising crosses and ring pulses (healRegionFx.ts)
        const healFx = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const clinic = r.game.generation.objects.find((o: any) => o.type === "clinic_01");
            return r.buildingState(clinic.id)?.healFx as number;
        });
        expect(healFx).toBeGreaterThan(3);
        await standAt(page, "clinic_01", 0, 0);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SCREENS}/clinic-wards-from-lobby.png` });
        expect((await missing(page)).filter((s) => s.includes("clinic"))).toEqual([]);
        expect(errors).toEqual([]);
    });

    for (const [type, crate] of [
        ["outpost_01r", "crate_02f"],
        ["outpost_01b", "crate_22"],
    ] as const) {
        test(`the ${type} command post: faction roof, armory with its faction crate`, async ({ page }) => {
            test.setTimeout(120_000);
            const errors = collectErrors(page);
            await boot(page, `/?building=${type}&seed=1`);
            expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("faction");
            const crates = await page.evaluate(
                (crate) =>
                    (window as any).__rebirth.game.generation.objects.filter((o: any) => o.type === crate).length,
                crate,
            );
            expect(crates).toBe(1);
            await standAt(page, type, 0, -15);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-outside.png` });
            await standAt(page, type, -3, -4);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-inside.png` });
            expect((await missing(page)).filter((s) => s.includes("outpost"))).toEqual([]);
            expect(errors).toEqual([]);
        });
    }
});
