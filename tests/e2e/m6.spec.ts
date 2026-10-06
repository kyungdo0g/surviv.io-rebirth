import { expect, test } from "@playwright/test";
import { collectErrors } from "./m4-helpers.ts";
import { bootTeam, ids, killFeed, knock, placeNear, pressInteract, SCREENS, simPlayer } from "./m6-helpers.ts";

// M6 client on the loopback team sandbox: team HUD, downed visuals and bleeding, reviving (both sides), the revive
// prompt, emotes and pings (wheel, bubbles, minimap marker). The party lobby over the network is in multiplayer.spec.ts
// and the start page / lobby strings in m6-menu.spec.ts. Waits on simulation durations (bleed ticks, the 8 s revive)
// get generous timeouts: under the load of the parallel specs the loopback simulation runs slower than the wall clock.

test.describe("team sandbox", () => {
    test("squad: team HUD, knocked down, bleeding, revived by a teammate", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await bootTeam(page, "/?team=4&teammates=1&dummies=1&loot=0", 2);
        const { local, teammates, dummies } = await ids(page);
        const mate = teammates[0];
        expect(teammates).toHaveLength(1);

        // team HUD: both members in join order with full health, group colours, the teammate's name in the world
        const rows = page.locator("#ui-team .ui-team-member");
        await expect(rows.nth(0)).toBeVisible();
        await expect(rows.nth(1)).toBeVisible();
        await expect(rows.nth(2)).toBeHidden();
        await expect(rows.nth(0).locator(".ui-team-member-name")).toHaveText("player");
        await expect(rows.nth(1).locator(".ui-team-member-name")).toHaveText("teammate 1");
        await expect(rows.nth(1).locator(".ui-bar-inner")).toHaveCSS("width", "200px");
        await expect(rows.nth(1).locator(".ui-team-member-color")).toHaveCSS("background-color", "rgb(255, 0, 255)");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.team.names)).toEqual(["teammate 1"]);
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.team.minimapDots)).toBe(1);
        const members = await page.evaluate(() => (window as any).__rebirth.team.members);
        expect(members.map((m: any) => m.playerId)).toEqual([local, mate]);
        await page.screenshot({ path: `${SCREENS}/team-hud.png` });

        // an off-screen teammate gets an edge indicator in its colour
        await placeNear(page, mate, local, { x: 48, y: -12 });
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.team.indicators)).toBe(1);
        await expect(page.locator(".ui-team-indicator[data-id='1']")).toBeVisible();
        await expect(page.locator(".ui-team-indicator[data-id='0']")).toBeHidden();
        await page.screenshot({ path: `${SCREENS}/team-indicator.png` });
        await placeNear(page, mate, local, { x: -4, y: 0 });
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.team.indicators)).toBe(0);

        // knocked down by the dummy: crawl pose, red health bar, "knocked YOU out", the feed's knock wording
        await knock(page, local, { sourceId: dummies[0] });
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === true, local);
        await expect(page.locator("#ui-kill-text")).toHaveText("dummy 1 knocked YOU out with Fists");
        await expect.poll(() => killFeed(page)).toContain("dummy 1 knocked out player with Fists");
        await expect(page.locator("#ui-health-actual")).toHaveCSS("background-color", "rgb(255, 0, 0)");
        await expect(rows.nth(0)).toHaveAttribute("data-state", "downed");
        await expect(rows.nth(0).locator(".ui-team-member-status")).toHaveClass(/ui-team-member-status-downed/);
        expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[2].type)).toBe("fists");
        // bleeding: a splat every second, the bleeding health drops
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.playerBleeds(id), local), { timeout: 30_000 })
            .toBeGreaterThanOrEqual(2);
        expect((await simPlayer(page, local)).health).toBeLessThan(100);
        // crawling: the downed player moves slowly and plays the crawl animation
        await page.keyboard.down("s");
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.playerAnim(id), local), { timeout: 15_000 })
            .toMatch(/^crawl_/);
        await page.keyboard.up("s");
        await page.screenshot({ path: `${SCREENS}/downed.png` });

        // the teammate revives: both sides run an 8 s revive, the downed side's pie reads "Reviving"
        await placeNear(page, mate, local, { x: -2, y: 0 });
        await pressInteract(page, mate);
        await page.waitForFunction(() => (window as any).__rebirth.local.action?.type === "revive");
        await expect.poll(() => page.evaluate((id) => (window as any).__rebirth.playerAnim(id), mate)).toBe("revive");
        await expect(page.locator("#ui-pie-timer")).toBeVisible();
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Reviving");
        expect(await page.evaluate(() => (window as any).__rebirth.local.action.targetId)).toBe(0);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/being-revived.png` });

        // back up with 24 HP
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === false, local, {
            timeout: 45_000,
        });
        const after = await simPlayer(page, local);
        expect(after.downed).toBe(false);
        expect(after.health).toBe(24);
        await expect(rows.nth(0)).toHaveAttribute("data-state", "alive");
        await expect(page.locator("#ui-pie-timer")).toBeHidden();
        expect(errors).toEqual([]);
    });

    test("revive prompt next to a downed teammate, F revives it", async ({ page }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await bootTeam(page, "/?team=4&teammates=1&loot=0", 2);
        const { local, teammates } = await ids(page);
        const mate = teammates[0];

        await knock(page, mate, { gas: true });
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === true, mate);
        await expect.poll(() => killFeed(page)).toContain("The red zone knocked out teammate 1");
        await expect(page.locator("#ui-team .ui-team-member").nth(1)).toHaveAttribute("data-state", "downed");
        await placeNear(page, mate, local, { x: 2.5, y: 0 });
        await page.waitForFunction(() => (window as any).__rebirth.interaction()?.text === "Revive Teammate");
        await expect(page.locator("#ui-interaction-press")).toHaveText("F");
        await expect(page.locator("#ui-interaction-description")).toHaveText("Revive Teammate");

        await page.keyboard.down("f");
        await page.waitForFunction(() => (window as any).__rebirth.local.action?.type === "revive", null, {
            timeout: 15_000,
        });
        await page.keyboard.up("f");
        expect(await page.evaluate(() => (window as any).__rebirth.local.action.targetId)).toBe(mate);
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Reviving teammate 1");
        // the reviver can cancel: the prompt turns into "[X] Cancel"
        await expect(page.locator("#ui-interaction-description")).toHaveText("Cancel");
        await expect(page.locator("#ui-interaction-press")).toHaveText("X");
        await expect.poll(() => page.evaluate((id) => (window as any).__rebirth.playerAnim(id), local)).toBe("revive");
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENS}/reviving.png` });

        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === false, mate, {
            timeout: 45_000,
        });
        expect((await simPlayer(page, mate)).health).toBe(24);
        await expect(page.locator("#ui-team .ui-team-member").nth(1)).toHaveAttribute("data-state", "alive");
        await expect(page.locator("#ui-interaction")).toBeHidden();
        expect(errors).toEqual([]);
    });

    test("emote wheel, emote over the head, ping on the minimap", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootTeam(page, "/?team=4&teammates=1&loot=0", 2);
        const { local } = await ids(page);
        const vw = 1280;
        const vh = 720;

        // hold right mouse: the emote wheel opens at the cursor; drag up onto the top wedge and release
        await page.mouse.move(vw / 2 + 150, vh / 2 - 60);
        await page.mouse.down({ button: "right" });
        await page.waitForFunction(() => (window as any).__rebirth.emotes.wheel === "emote");
        await expect(page.locator("#ui-emote-top .ui-emote-bg-quarter")).toBeVisible();
        await page.mouse.move(vw / 2 + 150, vh / 2 - 160, { steps: 5 });
        await expect(page.locator("#ui-emote-top")).toHaveClass(/ui-emote-selected/);
        await page.screenshot({ path: `${SCREENS}/emote-wheel.png` });
        await page.mouse.up({ button: "right" });
        await expect(page.locator("#ui-emote-top .ui-emote-bg-quarter")).toBeHidden();
        await page.waitForFunction(() => (window as any).__rebirth.emotes.sent.length === 1);
        expect(await page.evaluate(() => (window as any).__rebirth.emotes.sent)).toEqual([
            { type: "emote_happyface", isPing: false },
        ]);
        // the snapshot brings it back and it pops over the player
        await page.waitForFunction(
            (id) =>
                (window as any).__rebirth.emotes.received.some(
                    (e: any) => e.playerId === id && e.type === "emote_happyface" && !e.isPing,
                ),
            local,
        );
        await page.waitForFunction(() => (window as any).__rebirth.emotes.bubbles === 1);
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SCREENS}/emote-above-head.png` });

        // hold C, then right mouse on the minimap: the ping wheel; top wedge = danger, at that map position
        const rect = await page.evaluate(() => (window as any).__rebirth.minimap.rect);
        const at = { x: rect.x + rect.width * 0.7, y: rect.y + rect.height * 0.35 };
        const expected = await page.evaluate((p) => (window as any).__rebirth.client.minimap.screenToWorld(p), at);
        expect(expected).not.toBeNull();
        await page.keyboard.down("c");
        await page.mouse.move(at.x, at.y);
        await page.mouse.down({ button: "right" });
        await page.waitForFunction(() => (window as any).__rebirth.emotes.wheel === "ping");
        await page.mouse.move(at.x, at.y - 90, { steps: 5 });
        await expect(page.locator("#ui-team-ping-top")).toHaveClass(/ui-emote-selected/);
        await page.mouse.up({ button: "right" });
        await page.keyboard.up("c");
        await page.waitForFunction(() => (window as any).__rebirth.emotes.sent.length === 2);
        const sent = await page.evaluate(() => (window as any).__rebirth.emotes.sent.at(-1));
        expect(sent.type).toBe("ping_danger");
        expect(sent.isPing).toBe(true);
        expect(Math.abs(sent.pos.x - expected.x)).toBeLessThan(1);
        expect(Math.abs(sent.pos.y - expected.y)).toBeLessThan(1);
        await page.waitForFunction(() => (window as any).__rebirth.emotes.mapPings === 1);
        const pings = await page.evaluate(() => (window as any).__rebirth.emotes.pings);
        expect(pings).toHaveLength(1);
        expect(pings[0].type).toBe("ping_danger");
        // the pinger sees no edge arrow for its own ping; a teammate's off-screen ping gets one in its colour
        expect(pings[0].indicator).toBe(false);
        const mate = (await ids(page)).teammates[0];
        await page.evaluate(
            ({ mate, local }) => {
                const g = (window as any).__rebirth.game;
                const p = g.getPlayer(local).pos;
                g.emote(mate, { type: "ping_coming", isPing: true, pos: { x: p.x - 40, y: p.y + 25 } });
            },
            { mate, local },
        );
        await page.waitForFunction(() => (window as any).__rebirth.emotes.pings.some((p: any) => p.indicator));
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.emotes.mapPings)).toBe(2);
        await page.mouse.move(vw / 2, vh / 2);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCREENS}/map-ping.png` });
        expect(errors).toEqual([]);
    });

    test("finished off while the team plays on: the short death screen, then spectating the teammate", async ({
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await bootTeam(page, "/?team=2&teammates=1&dummies=1&loot=0", 2);
        const { local, teammates } = await ids(page);
        await knock(page, local, { gas: true });
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === true, local);
        // finish it off (a hit within the 0.1 s after the knock is absorbed by the damage buffer: hit until dead)
        await expect
            .poll(
                async () => {
                    await knock(page, local, { gas: true });
                    return (await simPlayer(page, local)).dead;
                },
                { timeout: 30_000 },
            )
            .toBe(true);
        await page.waitForFunction(() => (window as any).__rebirth.local?.dead === true);
        await expect.poll(() => killFeed(page)).toContain("player died outside the safe zone");
        await page.waitForFunction(() => (window as any).__rebirth.match.gameOver.settled === true, null, {
            timeout: 60_000,
        });
        await expect(page.locator(".ui-stats-header-title")).toHaveText("You died.");
        await expect(page.locator(".ui-stats-header-overview")).toHaveText("Kills 0");
        await expect(page.locator("#ui-team .ui-team-member").nth(0)).toHaveAttribute("data-state", "dead");
        await page.screenshot({ path: `${SCREENS}/team-death.png` });
        await page.locator(".ui-stats-spectate").click();
        await page.waitForFunction((id) => (window as any).__rebirth.match.activeId === id, teammates[0], {
            timeout: 20_000,
        });
        expect(errors).toEqual([]);
    });

    test("Revivify: a downed holder revives itself", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootTeam(page, "/?team=2&teammates=1&dummies=1&loot=0", 2);
        const { local } = await ids(page);
        // the perk, as the sim's addPerk stores it (pickups are not part of this test)
        await page.evaluate((id) => {
            const p = (window as any).__rebirth.game.getPlayer(id);
            p.perks.push("self_revive");
            p.perkSources.push({
                type: "self_revive",
                droppable: false,
                fromRole: false,
                fromGear: false,
                replaceOnDeath: "",
            });
        }, local);
        await knock(page, local, { gas: true });
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === true, local);
        await expect(page.locator("#ui-interaction-description")).toHaveText("Revive Self");
        await page.keyboard.press("f");
        await page.waitForFunction(() => (window as any).__rebirth.local.action?.type === "revive");
        expect(await page.evaluate(() => (window as any).__rebirth.local.action.targetId)).toBe(local);
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Reviving");
        await expect(page.locator("#ui-interaction-description")).toHaveText("Cancel");
        await page.waitForFunction((id) => (window as any).__rebirth.playerView(id)?.downed === false, local, {
            timeout: 45_000,
        });
        expect((await simPlayer(page, local)).health).toBe(24);
        expect(errors).toEqual([]);
    });

    test("Korean: knock wording and the revive prompt", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootTeam(page, "/?team=2&teammates=1&loot=0&lang=ko", 2);
        const { local, teammates } = await ids(page);
        await knock(page, teammates[0], { gas: true });
        await expect.poll(() => killFeed(page)).toContain("레드존이 이(가) 기절시켰습니다 teammate 1");
        await placeNear(page, teammates[0], local, { x: 2.5, y: 0 });
        await expect(page.locator("#ui-interaction-description")).toHaveText("팀원 소생");
        expect(errors).toEqual([]);
    });
});
