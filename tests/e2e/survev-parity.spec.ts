// survev parity wave (docs/handoff/survev-content.md item 2): a 50v50 enemy revealed by firing (survev
// timeUntilHidden) shows as a dot on the minimap in its faction's colour, then fades out 2-2.5 s after it is no longer
// listed. Hooks: window.__rebirth (game, faction). Screenshots: __screens__/survev-parity.
import { expect, test } from "@playwright/test";
import { collectErrors } from "./m4-helpers.ts";
import { bootMode, localId } from "./m7-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-parity";

test.describe("50v50 shooter reveal", () => {
    test("a revealed enemy shows on the minimap for its reveal time, then fades out", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=faction&team=4&dummies=3&loot=0");
        const me = await localId(page);
        const enemy = await page.evaluate((me) => {
            const g = (window as any).__rebirth.game;
            const team = g.getPlayer(me).teamId;
            return [...g.players()].find((p: any) => p.teamId !== team)?.id as number | undefined;
        }, me);
        expect(enemy).toBeTruthy();
        const dotsBefore = await page.evaluate(() => (window as any).__rebirth.faction.minimapDots as number);

        // the enemy fired in sight of one of ours: revealed for 1 s
        await page.evaluate((id) => {
            (window as any).__rebirth.game.getPlayer(id).timeUntilHidden = 1;
        }, enemy);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.faction.minimapDots), { timeout: 5_000 })
            .toBe(dotsBefore + 1);
        await page.screenshot({ path: `${SCREENS}/revealed.png` });
        // no longer listed after the next refresh, the dot stays 2 s and is gone by 2.5 s
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.faction.minimapDots), { timeout: 8_000 })
            .toBe(dotsBefore);
        expect(errors).toEqual([]);
    });
});
