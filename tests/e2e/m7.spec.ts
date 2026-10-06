import { expect, test } from "@playwright/test";
import { collectErrors, killFeed } from "./m4-helpers.ts";
import { bootMode, localId, localPerks, lootAtPlayer, lootNear, promote, SCREENS } from "./m7-helpers.ts";

// M7 client on the loopback event maps: faction alive counts, role announcements, the role badge and faction minimap
// icons (faction), perk slots with tooltips and right-click drops (savannah), the big map and the moved mute key. The
// Cobalt class menu, frozen players and the Korean strings are in m7-modes.spec.ts.

test.describe("faction", () => {
    test("red / blue alive counts, a role announcement, the role badge and minimap role icons", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=faction&team=4&dummies=3&loot=0");
        const me = await localId(page);

        // AliveCounts: red over blue in place of the single counter, matching the sim
        await expect(page.locator("#ui-leaderboard-alive-faction")).toBeVisible();
        await expect(page.locator("#ui-leaderboard-alive")).toBeHidden();
        const counts = await page.evaluate(() => (window as any).__rebirth.faction.alive as number[]);
        expect(counts).toHaveLength(2);
        expect(counts[0] + counts[1]).toBe(4);
        await expect(page.locator(".ui-players-alive-red")).toHaveText(String(counts[0]));
        await expect(page.locator(".ui-players-alive-blue")).toHaveText(String(counts[1]));
        await expect(page.locator(".ui-players-alive-red")).toHaveCSS("color", "rgb(255, 0, 0)");
        // the faction arm patches beside the health bar
        await expect(page.locator("#ui-health-flair-left")).toBeVisible();

        const info = await page.evaluate((me) => {
            const r = (window as any).__rebirth;
            const players = [...r.game.players()].map((p: any) => ({ id: p.id, team: p.teamId }));
            return { team: players.find((p: any) => p.id === me).team as number, players };
        }, me);
        const color = info.team === 1 ? "Red" : "Blue";

        // promoted to Commander: centre announcement, kill feed line in the team colour, badge, leadership perk
        await promote(page, me, "leader");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.match.announcement))
            .toBe(`YOU'VE BEEN PROMOTED TO ${color.toUpperCase()} COMMANDER!`);
        await expect.poll(() => killFeed(page)).toContain(`player promoted to ${color} Commander!`);
        await expect(page.locator("#ui-role-badge")).toBeVisible();
        await expect(page.locator("#ui-role-badge .ui-role-badge-name")).toHaveText(`${color} Commander`);
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.perks.slots)).toEqual(["leadership"]);
        await expect(page.locator("#ui-perk-0")).toHaveClass(/ui-perk-no-drop/);
        expect(await page.evaluate(() => (window as any).__rebirth.local.helmet)).toBe("helmet04_leader");
        await page.screenshot({ path: `${SCREENS}/faction-commander.png` });

        // a faction mate outside the group promoted to Medic: its role icon on the minimap in the team colour
        const mate = info.players.find((p: any) => p.id !== me && p.team === info.team);
        expect(mate).toBeTruthy();
        await promote(page, mate.id, "medic");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.faction.minimapRoleIcons), { timeout: 10_000 })
            .toContain("player-medic.img");
        await expect.poll(() => killFeed(page)).toContain("dummy 2 promoted to Medic!");
        // the Medic (Mass Medicate) using a bandage draws its heal aura
        await page.evaluate((id) => {
            const g = (window as any).__rebirth.game;
            g.getPlayer(id).health = 50;
            g.setInput(id, {
                seq: 1,
                moveLeft: false,
                moveRight: false,
                moveUp: false,
                moveDown: false,
                toMouseDir: { x: 1, y: 0 },
                toMouseLen: 4,
                shootStart: false,
                shootHold: false,
                actions: [],
                useItem: "bandage",
            });
        }, mate.id);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.playerFx(id)?.aura, mate.id), {
                timeout: 10_000,
            })
            .toBe(true);
        await page.screenshot({ path: `${SCREENS}/faction-medic.png` });
        expect(errors).toEqual([]);
    });
});

test.describe("perks", () => {
    test("a perk pickup fills a slot with a tooltip; right click drops it, a gun and ammo", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=savannah&loot=0&give=ak47");
        await lootAtPlayer(page, "splinter");
        await page.keyboard.press("f");
        await expect.poll(() => localPerks(page)).toEqual(["splinter"]);
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.perks.slots)).toEqual(["splinter"]);
        const slot = page.locator("#ui-perk-0");
        await expect(slot).toBeVisible();
        await expect(slot).toHaveClass(/ui-perk-pulse/);
        await expect(slot).toHaveAttribute("data-droppable", "true");
        await slot.hover();
        await expect(slot.locator(".tooltip-title")).toBeVisible();
        await expect(slot.locator(".tooltip-title")).toHaveText("Splinter Rounds");
        await expect(slot.locator(".tooltip-desc")).toHaveText("Rounds fragment into three less powerful bullets.");
        await page.screenshot({ path: `${SCREENS}/perk-tooltip.png` });

        // right click: the perk drops to the ground
        await slot.click({ button: "right" });
        await expect.poll(() => localPerks(page)).toEqual([]);
        await expect(slot).toBeHidden();
        await expect.poll(() => lootNear(page, "splinter")).toBe(1);

        // a gun drops from its slot, ammo half a stack
        await page.locator("#ui-weapon-id-1").click({ button: "right" });
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.weapons[0].type)).toBe("");
        await expect.poll(() => lootNear(page, "ak47")).toBe(1);
        const ammo = await page.evaluate(() => (window as any).__rebirth.local.inventory["762mm"] as number);
        expect(ammo).toBeGreaterThan(10);
        await page.locator("#ui-loot-762mm").click({ button: "right" });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.local.inventory["762mm"]))
            .toBe(ammo - Math.max(1, Math.floor(ammo / 2)));
        expect(errors).toEqual([]);
    });
});

test.describe("tracers", () => {
    test("Splinter Rounds fire small side tracers, One in the Chamber thick saturated ones", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=savannah&seed=1&loot=0&give=ak47");
        // holds the trigger until the gun fired (the loopback runs slower than the wall clock under load)
        const fire = async () => {
            const ammo = () => page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo as number);
            const before = await ammo();
            await page.mouse.move(640, 120);
            await page.mouse.down();
            await expect.poll(ammo, { timeout: 15_000 }).toBeLessThan(before);
            await page.mouse.up();
        };
        await lootAtPlayer(page, "splinter");
        await page.keyboard.press("f");
        await expect.poll(() => localPerks(page)).toEqual(["splinter"]);
        await fire();
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.tracerVariants().splinter), { timeout: 15_000 })
            .toBeGreaterThan(0);
        expect(await page.evaluate(() => (window as any).__rebirth.tracerVariants().thick)).toBe(0);
        await page.screenshot({ path: `${SCREENS}/tracers-splinter.png` });
        // a second loot perk replaces the first: One in the Chamber's first and last rounds are thick and saturated
        await lootAtPlayer(page, "chambered");
        await page.keyboard.press("f");
        await expect.poll(() => localPerks(page)).toEqual(["chambered"]);
        await page.keyboard.press("r");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo), { timeout: 20_000 })
            .toBe(30);
        await fire();
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.tracerVariants().thick), { timeout: 15_000 })
            .toBeGreaterThan(0);
        expect(await page.evaluate(() => (window as any).__rebirth.tracerVariants().saturated)).toBeGreaterThan(0);
        expect(errors).toEqual([]);
    });
});

test.describe("big map", () => {
    test("M toggles the full-screen map, Escape and G too; N mutes", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=main&seed=1&loot=0&dummies=1");
        await page.keyboard.press("m");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.bigMap.open)).toBe(true);
        const rect = await page.evaluate(() => (window as any).__rebirth.bigMap.rect);
        expect(rect.width).toBe(720);
        expect(rect.x).toBe(280);
        await expect(page.locator("#ui-bottom-right")).toBeHidden();
        await expect(page.locator("#ui-kill-counter-wrapper")).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/big-map.png` });
        await page.keyboard.press("Escape");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.bigMap.open)).toBe(false);
        await expect(page.locator("#ui-bottom-right")).toBeVisible();
        expect((await page.evaluate(() => (window as any).__rebirth.bigMap.rect)).width).toBe(192);
        await page.keyboard.press("g");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.bigMap.open)).toBe(true);
        await page.keyboard.press("g");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.bigMap.open)).toBe(false);
        expect(await page.evaluate(() => (window as any).__rebirth.audio.muted)).toBe(false);
        await page.keyboard.press("n");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.audio.muted)).toBe(true);
        expect(errors).toEqual([]);
    });
});
