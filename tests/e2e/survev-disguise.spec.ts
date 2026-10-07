// Obstacle disguises in the loopback sandbox (survev content wave, from the wiki audit of the Junkyard): picking up the
// Barrel Costume puts a non-collidable barrel over the wearer that follows them on the wire (isSkin + skinPlayerId),
// and the barrel blows up when the wearer dies. Hooks: window.__rebirth.game (the sandbox Game), lastSnapshot.
// Screenshots: __screens__/survev-disguise.
import { expect, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-disguise";

test.describe("obstacle disguises in the sandbox", () => {
    test("the Barrel Costume puts a barrel over its wearer that follows them and blows up with them", async ({
        page,
    }) => {
        test.setTimeout(60_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=halloween&seed=1&loot=0&lang=ko");
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            r.game.loot.addLoot("outfitBarrel", me.pos, me.layer, 1, { pushSpeed: 0 });
        });
        await page.waitForTimeout(300);
        await page.keyboard.press("f");
        const skin = () =>
            page.evaluate(() => {
                const r = (window as any).__rebirth;
                const o = ((r.lastSnapshot?.objects ?? []) as any[]).find(
                    (x) => x.kind === "obstacle" && x.skinPlayerId === r.player.id,
                );
                const me = r.game.getPlayer(r.player.id);
                return o ? { type: o.type, dead: o.dead, pos: o.pos, me: { x: me.pos.x, y: me.pos.y } } : null;
            });
        await expect.poll(skin, { timeout: 20_000 }).not.toBeNull();
        expect((await skin())!.type).toBe("barrel_01");
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/worn.png` });
        // walk: the barrel stays on the wearer
        await page.keyboard.down("d");
        await page.waitForTimeout(600);
        await page.keyboard.up("d");
        await page.waitForTimeout(300);
        const walked = (await skin())!;
        expect(Math.hypot(walked.pos.x - walked.me.x, walked.pos.y - walked.me.y)).toBeLessThan(0.5);
        // the wearer dies: the barrel dies with them
        const id = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const o = ((r.lastSnapshot?.objects ?? []) as any[]).find(
                (x) => x.kind === "obstacle" && x.skinPlayerId === r.player.id,
            );
            r.game.damagePlayer(me, { amount: 500, damageType: 2, dir: { x: 1, y: 0 } });
            return o.id as number;
        });
        await page.waitForFunction(
            (id) =>
                (((window as any).__rebirth.lastSnapshot?.objects ?? []) as any[]).some((o) => o.id === id && o.dead),
            id,
            { timeout: 20_000 },
        );
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCREENS}/dead.png` });
        expect(errors).toEqual([]);
    });
});
