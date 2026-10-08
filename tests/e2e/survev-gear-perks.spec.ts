// The survev-only packs, role helmets and perks in the loopback sandbox (survev content wave stage 2): their loot
// icons on the ground, the Experimental Pack picked up with two loot perks held at once, survev's fifth bag column.
// Hooks: window.__rebirth.game (the sandbox Game: players, loot). Screenshots: __screens__/survev-gear-perks.
import { expect, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-gear-perks";
const ITEMS = [
    "backpack04",
    "backpack04_cloud",
    "assume_leadership",
    "ap_rounds",
    "lifeline",
    "combat_stims",
    "amped_explosives",
    "high_velocity",
];

test.describe("survev-only gear and perks in the sandbox", () => {
    test("loot icons, the Experimental Pack's two perk slots and the fifth bag column", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&lang=ko");
        await page.evaluate((items) => {
            const r = (window as any).__rebirth;
            const p = r.player.pos;
            items.forEach((type: string, i: number) => {
                const a = (i / items.length) * Math.PI * 2;
                r.game.loot.addLoot(type, { x: p.x + Math.cos(a) * 6, y: p.y - 4 + Math.sin(a) * 3 }, 0, 1, {
                    pushSpeed: 0,
                });
            });
        }, ITEMS);
        await page.waitForFunction(
            (n) =>
                ((window as any).__rebirth.lastSnapshot?.objects ?? []).filter((o: any) => o.kind === "loot").length >=
                n,
            ITEMS.length,
            { timeout: 20_000 },
        );
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/loot-icons.png` });
        const lootTypes = await page.evaluate(() =>
            ((window as any).__rebirth.lastSnapshot.objects as any[])
                .filter((o) => o.kind === "loot")
                .map((o) => o.type),
        );
        expect([...lootTypes].sort()).toEqual([...ITEMS].sort());
        // wear the Experimental Pack and pick up two loot perks (F, the interact key)
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            me.backpack = "backpack04_cloud";
        });
        for (const perk of ["ap_rounds", "high_velocity"]) {
            await page.evaluate((perk) => {
                const r = (window as any).__rebirth;
                const me = r.game.getPlayer(r.player.id);
                for (const l of [...r.game.loot.items.values()]) r.game.loot.remove(l);
                r.game.loot.addLoot(perk, me.pos, me.layer, 1, { pushSpeed: 0 });
            }, perk);
            await page.waitForTimeout(300);
            await page.keyboard.press("f");
            await page.waitForFunction(
                (perk) => {
                    const r = (window as any).__rebirth;
                    return r.game.getPlayer(r.player.id).perks.includes(perk);
                },
                perk,
                { timeout: 20_000 },
            );
        }
        const state = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            return { perks: [...me.perks], bandage: me.inv.capacity("bandage") };
        });
        expect(state.perks).toEqual(["ap_rounds", "high_velocity"]);
        // survev/shared/gameConfig.ts:432: bandages 5 / 10 / 15 / 30 / 45
        expect(state.bandage).toBe(45);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/two-perks.png` });
        expect(errors).toEqual([]);
    });
});
