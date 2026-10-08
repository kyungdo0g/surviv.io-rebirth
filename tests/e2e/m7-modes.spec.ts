import { expect, test } from "@playwright/test";
import { collectErrors, killFeed, screenPosOf } from "./m4-helpers.ts";
import { bootMode, localId, localPerks, lootAtPlayer, promote, SCREENS } from "./m7-helpers.ts";

// M7 client on the loopback event maps, part 2: the Cobalt class menu (choice and timeout), frozen players on the snow
// map, haste and size effects, and the Korean perk / role / class menu strings.

const CLASSES = ["scout", "sniper", "healer", "demo", "assault", "tank"];

test.describe("cobalt", () => {
    test("the class menu over the waiting room: choosing Sniper gives the class and its kit", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=cobalt&seed=1&loot=0");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.roleMenu.active)).toBe(true);
        const menu = page.locator("#ui-role-menu-wrapper");
        await expect(menu).toBeVisible();
        // the player waits without a class in the Twins bunker (underground)
        const before = await page.evaluate(() => (window as any).__rebirth.local);
        expect(before.role).toBe("");
        expect(before.layer).toBe(1);
        const options = page.locator("#ui-role-header .ui-role-option");
        await expect(options).toHaveCount(6);
        expect(await options.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.role))).toEqual(CLASSES);
        await expect(page.locator("#ui-role-footer-desc")).toHaveText("SELECT A CLASS");
        await expect(page.locator("#ui-role-footer-enter")).toHaveText(/^ENTER GAME \((20|19|18|17)\)$/);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/cobalt-menu.png` });

        await page.locator('#ui-role-header .ui-role-option[data-role="sniper"]').click();
        await expect(page.locator(".ui-role-body-name")).toHaveText("Sniper");
        await expect(page.locator(".ui-role-body-perk-name")).toHaveText(["One In The Chamber", "Takedown"]);
        await expect(page.locator(".ui-role-loadout-item[data-item='2xscope']")).toBeVisible();
        await page.screenshot({ path: `${SCREENS}/cobalt-menu-sniper.png` });
        await page.locator("#ui-role-footer-enter").click();
        await expect(menu).toBeHidden();
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.role)).toBe("sniper");
        const after = await page.evaluate(() => (window as any).__rebirth.local);
        expect(after.layer).toBe(0);
        expect(after.outfit).toBe("outfitSniper");
        expect(after.inventory["2xscope"]).toBe(1);
        expect(await localPerks(page)).toEqual(expect.arrayContaining(["chambered", "takedown"]));
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.perks.slots))
            .toEqual(expect.arrayContaining(["chambered", "takedown"]));
        await expect(page.locator("#ui-role-badge .ui-role-badge-name")).toHaveText("Sniper");
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENS}/cobalt-sniper.png` });
        expect(errors).toEqual([]);
    });

    test("without a choice the class arrives from the server and the menu closes", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=cobalt&seed=2&loot=0");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.roleMenu.active)).toBe(true);
        // the server's 25 s random class (rules.roles.perkModeRoleSelectTime), shortened so it comes before the menu's own
        // 20 s countdown confirms the highlighted class
        await page.evaluate(() => {
            (window as any).__rebirth.game.rules.roles.perkModeRoleSelectTime = 3;
        });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.local.role), { timeout: 30_000 })
            .not.toBe("");
        const role = await page.evaluate(() => (window as any).__rebirth.local.role as string);
        expect(CLASSES).toContain(role);
        await expect(page.locator("#ui-role-menu-wrapper")).toBeHidden();
        expect(await page.evaluate(() => (window as any).__rebirth.roleMenu.confirmed)).toBe("");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.layer)).toBe(0);
        expect(errors).toEqual([]);
    });
});

test.describe("snow", () => {
    test("a snowball hit freezes the dummy: frozen view and the frozen overlay", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=snow&seed=1&dummies=1&loot=0&give=snowball");
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        // a longer freeze than the light snowball's 0.5 s (rules.modes.throwableHits) so the overlay can be photographed
        await page.evaluate(() => {
            const hits = (window as any).__rebirth.game.rules.modes.throwableHits;
            hits.explosion_snowball = { ...hits.explosion_snowball, freeze: 6 };
        });
        const target = await screenPosOf(page, dummy);
        expect(target).toBeTruthy();
        await page.mouse.move(target!.x, target!.y);
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.mouse.up();
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.playerView(id)?.frozen, dummy), {
                timeout: 15_000,
            })
            .toBe(true);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.playerFx(id)?.frozen, dummy))
            .toBe(true);
        const view = await page.evaluate((id) => (window as any).__rebirth.playerView(id), dummy);
        expect(view.frozenOri).toBeGreaterThanOrEqual(0);
        expect(view.frozenOri).toBeLessThanOrEqual(3);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/snow-frozen.png` });
        // thawed: the overlay fades out
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.playerFx(id)?.frozen, dummy), {
                timeout: 20_000,
            })
            .toBe(false);
        expect(errors).toEqual([]);
    });
});

test.describe("potato", () => {
    test("wheel emotes arrive as emote_potato and render as bubbles", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=potato&seed=1&loot=0");
        const me = await localId(page);
        await page.evaluate((me) => {
            (window as any).__rebirth.game.emote(me, { type: "emote_happyface", isPing: false });
        }, me);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.emotes.received.map((e: any) => e.type)))
            .toContain("emote_potato");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.emotes.bubbles)).toBeGreaterThan(0);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/potato-emote.png` });
        expect(errors).toEqual([]);
    });
});

test.describe("map indicators", () => {
    test("The Hunted is announced and marked on the map; the Woods King helmet too", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=savannah&seed=1&loot=0");
        const indicators = () => page.evaluate(() => (window as any).__rebirth.minimap.indicators as number);
        const before = await indicators();
        await promote(page, await localId(page), "the_hunted");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.match.announcement))
            .toBe("YOU'VE BEEN PROMOTED TO THE HUNTED!");
        await expect.poll(() => killFeed(page)).toContain("player promoted to The Hunted!");
        await expect.poll(indicators).toBe(before + 1);
        await expect(page.locator("#ui-role-badge .ui-role-badge-name")).toHaveText("The Hunted");
        await page.screenshot({ path: `${SCREENS}/savannah-hunted.png` });

        await bootMode(page, "/?map=woods&seed=1&loot=0");
        const woodsBefore = await indicators();
        await lootAtPlayer(page, "helmet03_forest");
        await expect.poll(indicators).toBe(woodsBefore + 1);
        await page.screenshot({ path: `${SCREENS}/woods-king-helmet.png` });
        expect(errors).toEqual([]);
    });
});

test.describe("haste and size", () => {
    test("Windwalk haste runs its particles; Cast Ironskin enlarges the player", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=savannah&seed=1&loot=0");
        const me = await localId(page);
        // a 5 s Windwalk burst, as the sim's giveHaste starts it when its holder takes fire
        await page.evaluate((me) => {
            const haste = (window as any).__rebirth.game.getPlayer(me).haste;
            haste.type = "windwalk";
            haste.ticker = 5;
            haste.seq++;
        }, me);
        await expect
            .poll(() => page.evaluate((me) => (window as any).__rebirth.playerView(me)?.haste?.type, me))
            .toBe("windwalk");
        await expect.poll(() => page.evaluate((me) => (window as any).__rebirth.playerFx(me)?.haste, me)).toBe(true);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.particles("leafStim")))
            .toBeGreaterThan(0);
        await lootAtPlayer(page, "steelskin");
        await page.keyboard.press("f");
        await expect
            .poll(() => page.evaluate((me) => (window as any).__rebirth.playerView(me)?.scale, me))
            .toBeCloseTo(1.4);
        await page.screenshot({ path: `${SCREENS}/haste-steelskin.png` });
        expect(errors).toEqual([]);
    });
});

test.describe("korean", () => {
    test("perk tooltip, class menu and role announcement in Korean", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await bootMode(page, "/?map=savannah&seed=1&loot=0&lang=ko");
        await lootAtPlayer(page, "flak_jacket");
        await page.keyboard.press("f");
        const slot = page.locator("#ui-perk-0");
        await expect(slot).toBeVisible();
        await slot.hover();
        await expect(slot.locator(".tooltip-title")).toHaveText("방폭 재킷");
        await expect(slot.locator(".tooltip-desc")).toHaveText("폭발물 및 파편탄으로부터의 대미지를 크게 줄여줍니다.");
        await page.screenshot({ path: `${SCREENS}/ko-perk.png` });

        await bootMode(page, "/?map=cobalt&seed=1&loot=0&lang=ko");
        await expect(page.locator("#ui-role-menu-wrapper")).toBeVisible();
        await expect(page.locator("#ui-role-footer-desc")).toHaveText("클래스를 선택하세요");
        await expect(page.locator("#ui-role-footer-enter")).toHaveText(/^게임에 입장 \(\d+\)$/);
        const names: string[] = [];
        for (const role of CLASSES) {
            await page.locator(`#ui-role-header .ui-role-option[data-role="${role}"]`).click();
            names.push((await page.locator(".ui-role-body-name").textContent()) ?? "");
        }
        expect(names).toEqual(["스카우트", "저격수", "메딕", "폭파병", "돌격병", "장갑병"]);
        await page.locator('#ui-role-header .ui-role-option[data-role="healer"]').click();
        // survev roleDefs.ts healer: Field Medic + Combat Stimulants (survev balance; Windwalk in v0.8.82)
        await expect(page.locator(".ui-role-body-perk-name")).toHaveText(["전투 의무병", "전투 각성제"]);
        await page.screenshot({ path: `${SCREENS}/ko-cobalt-menu.png` });

        await bootMode(page, "/?map=faction&team=4&dummies=1&loot=0&lang=ko");
        const me = await localId(page);
        const team = await page.evaluate((me) => (window as any).__rebirth.game.getPlayer(me).teamId as number, me);
        const leader = team === 1 ? "홍팀 지휘관" : "청팀 지휘관";
        await promote(page, me, "leader");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.match.announcement))
            .toBe(`${leader} 으(로) 승진했습니다!`);
        await expect.poll(() => killFeed(page)).toContain(`player ${leader} 으(로) 승진했습니다!`);
        await expect(page.locator("#ui-role-badge .ui-role-badge-name")).toHaveText(leader);
        await page.locator("#ui-perk-0").hover();
        await expect(page.locator("#ui-perk-0 .tooltip-title")).toHaveText("리더십");
        await page.screenshot({ path: `${SCREENS}/ko-faction.png` });
        expect(errors).toEqual([]);
    });
});
