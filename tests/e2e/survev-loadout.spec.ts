// Loadouts (survev content wave stage 4b; everything unlocked): the main menu's Loadout button opens the loadout menu,
// picks are stored in localStorage and survive a reload, and a network game joins with them (Join carries the loadout,
// the server validates it): the player wears the outfit and holds the melee skin, Joined returns the emote loadout,
// PlayerInfo carries the heal / boost particles, and the crosshair is the cursor over the game. Hooks:
// window.__rebirth (menu, lastSnapshot, transport). Screenshots: __screens__/survev-loadout.
import { expect, test } from "@playwright/test";
import { collectErrors } from "./m4-helpers.ts";
import { openMenu } from "./m8-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-loadout";

test.describe("loadout menu", () => {
    test("pick a loadout in the menu, keep it over a reload, join a network game with it", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await openMenu(page, "/?menu=1&name=Loadout&lang=ko");
        await page.locator("#btn-customize").click();
        const modal = page.locator("#modal-customize");
        await expect(modal).toBeVisible();
        await expect(page.locator("#loadout-tab-outfit")).toHaveText("의상");
        const pick = async (tab: string, id: string) => {
            await page.locator(`#loadout-tab-${tab}`).click();
            await page.locator(`#loadout-grid [data-id="${id}"]`).click();
            await expect(page.locator(`#loadout-grid [data-id="${id}"]`)).toHaveClass(/selected/);
        };
        await pick("outfit", "outfitCarbonFiber");
        await page.screenshot({ path: `${SCREENS}/outfits.png` });
        await pick("melee", "karambit_prismatic");
        await pick("heal", "heal_moon");
        await pick("boost", "boost_star");
        // the death slot (EmoteSlot 5)
        await page.locator("#loadout-tab-emote").click();
        await page.locator("#loadout-emote-slot-5").click();
        await page.locator('#loadout-grid [data-id="emote_tombstone"]').click();
        await page.screenshot({ path: `${SCREENS}/emotes.png` });
        await pick("crosshair", "crosshair_027");
        await page.locator("#loadout-crosshair-size").fill("0.5");
        await page.screenshot({ path: `${SCREENS}/crosshair.png` });
        await page.keyboard.press("Escape");
        await expect(modal).toBeHidden();

        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rebirth.loadout") ?? "{}"));
        expect(stored).toMatchObject({
            outfit: "outfitCarbonFiber",
            melee: "karambit_prismatic",
            heal: "heal_moon",
            boost: "boost_star",
            crosshair: { type: "crosshair_027", size: 0.5 },
        });
        expect(stored.emotes[5]).toBe("emote_tombstone");

        // a reload keeps it
        await page.reload();
        await page.waitForFunction(() => !!(window as any).__rebirth?.menu);
        await page.locator("#btn-customize").click();
        await expect(page.locator('#loadout-grid [data-id="outfitCarbonFiber"]')).toHaveClass(/selected/);
        await page.keyboard.press("Escape");

        // play: Join carries the loadout
        await page.locator("#btn-start-mode-0").click();
        await page.waitForFunction(() => (window as any).__rebirth.mode === "network", null, { timeout: 30_000 });
        await page.waitForFunction(
            () => {
                const r = (window as any).__rebirth;
                const s = r.lastSnapshot;
                const me = s?.objects?.find((o: any) => o.id === s.localPlayerId);
                return me?.outfit === "outfitCarbonFiber";
            },
            null,
            { timeout: 30_000 },
        );
        const state = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const s = r.lastSnapshot;
            const canvas = document.querySelector("canvas") as HTMLCanvasElement;
            return {
                melee: s.local.weapons[2].type,
                emotes: [...(r.transport.emoteLoadout ?? [])],
                cursor: canvas.style.cursor,
            };
        });
        expect(state.melee).toBe("karambit_prismatic");
        expect(state.emotes[5]).toBe("emote_tombstone");
        expect(state.cursor).toContain("data:image/svg+xml");
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/in-game.png` });
        expect(errors).toEqual([]);
    });
});
