// M4 client: red zone, planes and air drops, kill feed and kill messages, death / win screens and spectating,
// against the loopback simulation. Sandbox options used here: &gas=fast (shortened red-zone stage table),
// &sandbox=0 (a real match: two players alive for 10 s start it, the last one alive wins), &dummies=<n>,
// &give=<gun>, &lang=ko. The network flow is in m4-network.spec.ts. Screenshots go to __screens__/M4.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors, damage, killFeed, SCREENS, screenPosOf, statsRows, waitForStats } from "./m4-helpers.ts";

/** Teleports the local player to a free spot `offset` units outside (or inside, < 0) a circle's edge. */
async function standAtEdge(page: Page, which: "gas" | "safe", offset: number): Promise<boolean> {
    return page.evaluate(
        ({ which, offset }) => {
            const r = (window as any).__rebirth;
            const c = which === "gas" ? r.gas.circle : r.gas.safeZone;
            const g = r.game;
            for (let a = 0; a < 72; a++) {
                const ang = (a / 72) * Math.PI * 2;
                for (let d = c.rad + offset; d < c.rad + offset + 6; d += 0.5) {
                    const p = { x: c.pos.x + Math.cos(ang) * d, y: c.pos.y + Math.sin(ang) * d };
                    if (p.x < 60 || p.y < 60 || p.x > g.mapData.width - 60 || p.y > g.mapData.height - 60) continue;
                    if (g.canPlayerSpawn(p)) {
                        g.teleportPlayer(r.player.id, p);
                        return true;
                    }
                }
            }
            return false;
        },
        { which, offset },
    );
}

test.describe("M4 red zone, air drops, kills and results", () => {
    test("the fast red zone draws, counts down, advances and hurts players outside it", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&gas=fast&loot=0");
        // the sandbox match starts at once: the first circle waits 8 s
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode === "waiting", null, { timeout: 15_000 });
        await expect(page.locator("#ui-map-info")).toBeVisible();
        await expect(page.locator("#ui-gas-icon")).toHaveClass(/gas-icon/);
        await expect(page.locator("#ui-waiting-text")).toBeHidden();
        const first = await page.locator("#ui-gas-timer").textContent();
        expect(first).toMatch(/^0:0\d$/);
        await expect.poll(() => page.locator("#ui-gas-timer").textContent(), { timeout: 10_000 }).not.toBe(first);
        expect(Number((await page.locator("#ui-gas-timer").textContent())?.split(":")[1])).toBeLessThan(
            Number(first?.split(":")[1]),
        );
        expect(await page.evaluate(() => (window as any).__rebirth.gas.active)).toBe(true);

        // the minimap draws the zone, the next safe circle and the line to it; stand just outside the safe ring
        expect(await standAtEdge(page, "safe", 4)).toBe(true);
        await page.waitForTimeout(800);
        // (the black zone is only drawn where the minimap window reaches outside the red circle)
        const mapGas = await page.evaluate(() => (window as any).__rebirth.minimap.gas);
        expect(mapGas).toMatchObject({ ring: true, line: true });
        const rect = await page.evaluate(() => (window as any).__rebirth.minimap.rect);
        const minimapClip = { x: 0, y: rect.y - 50, width: rect.x + rect.width + 16, height: rect.height + 66 };
        await page.screenshot({ path: `${SCREENS}/minimap-safe-zone.png`, clip: minimapClip });

        // advancing: the announcement, the pulsing danger icon
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode === "moving", null, { timeout: 20_000 });
        await expect(page.locator("#ui-announcement")).toHaveText("Red zone advancing! Move to the safe zone");
        await expect(page.locator("#ui-gas-icon")).toHaveClass(/danger-icon/);
        await expect(page.locator("#ui-map-info")).toHaveClass(/icon-pulse/);

        // the next waiting stage announces the time left
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode === "waiting", null, { timeout: 20_000 });
        await expect(page.locator("#ui-announcement")).toHaveText(/^Red zone advances in \d+ seconds$/);

        // a player just outside the red zone takes the stage damage every 2 s
        expect(await standAtEdge(page, "gas", 3)).toBe(true);
        await page.waitForTimeout(600);
        // the red overlay covers the screen outside the circle, the minimap shows the zone in black
        expect(await page.evaluate(() => (window as any).__rebirth.gas.overlayVisible)).toBe(true);
        expect(await page.evaluate(() => (window as any).__rebirth.minimap.gas)).toMatchObject({
            zone: true,
            line: true,
        });
        await page.screenshot({ path: `${SCREENS}/minimap-gas.png`, clip: minimapClip });
        await page.screenshot({ path: `${SCREENS}/gas-overlay.png` });
        const inGas = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            return r.game.gas.isInGas(r.game.getPlayer(r.player.id).pos);
        });
        expect(inGas).toBe(true);
        await page.waitForFunction(() => (window as any).__rebirth.local.health < 100, null, { timeout: 10_000 });
        // a red-zone hit: no source, the stage damage (ignores armour)
        const hit = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            return { hit: r.game.getPlayer(r.player.id).lastHit, damage: r.game.gas.damage };
        });
        expect(hit.hit).toMatchObject({ sourceId: 0, gameSourceType: "" });
        expect(hit.hit.amount).toBeCloseTo(hit.damage, 5);
        expect(errors).toEqual([]);
    });

    test("a forced air drop: plane, falling crate, landing, the Unlock prompt and the opened crate", async ({
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&dummies=1");
        const target = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const p = r.game.getPlayer(r.player.id).pos;
            const t = { x: p.x + 4, y: p.y - 9 };
            r.game.planes.addAirdrop(t, "airdrop_crate_01");
            return t;
        });
        // the plane spawns 15 s of flight away and is drawn once its 150-unit body reaches the view
        await page.waitForFunction(() => (window as any).__rebirth.air.planes > 0, null, { timeout: 30_000 });
        await page.waitForFunction(
            (t) =>
                (window as any).__rebirth.lastSnapshot.planes.some(
                    (p: any) => Math.hypot(p.pos.x - t.x, p.pos.y - t.y) < 25,
                ),
            target,
            { timeout: 30_000 },
        );
        await page.screenshot({ path: `${SCREENS}/plane-overhead.png` });
        await page.waitForFunction(() => (window as any).__rebirth.air.airdrops > 0, null, { timeout: 20_000 });
        // the drop marker pulses on the minimap; the screen-edge indicator runs (hidden while the drop is on screen)
        await page.waitForFunction(() => (window as any).__rebirth.minimap.indicators > 0, null, { timeout: 10_000 });
        expect(await page.evaluate(() => (window as any).__rebirth.air.pingIndicator)).toBe(true);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENS}/falling-crate.png` });
        // it lands (8 s fall) as the air drop obstacle; the falling sprite goes away
        await page.waitForFunction(
            () =>
                (window as any).__rebirth.lastSnapshot.objects.some(
                    (o: any) => o.kind === "obstacle" && o.type === "airdrop_crate_01" && !o.dead,
                ),
            null,
            { timeout: 20_000 },
        );
        await page.waitForFunction(() => (window as any).__rebirth.air.airdrops === 0, null, { timeout: 10_000 });
        const crate = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const c = r.lastSnapshot.objects.find((o: any) => o.kind === "obstacle" && o.type === "airdrop_crate_01");
            r.game.teleportPlayer(r.player.id, { x: c.pos.x, y: c.pos.y + 3.4 });
            return c.id as number;
        });
        await page.waitForFunction(() => (window as any).__rebirth.interaction()?.text === "Unlock Air Drop", null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-interaction-press")).toHaveText("F");
        await expect(page.locator("#ui-interaction-description")).toHaveText("Unlock Air Drop");
        await page.screenshot({ path: `${SCREENS}/airdrop-prompt.png` });
        await page.keyboard.press("f");
        // opening: 2.5 s on the action timer, then the crate bursts into its loot crate
        await expect(page.locator("#ui-pie-timer")).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Unlock Air Drop");
        await expect(page.locator("#ui-interaction")).toBeHidden();
        await page.waitForFunction(
            () =>
                (window as any).__rebirth.lastSnapshot.objects.some(
                    (o: any) => o.kind === "obstacle" && (o.type === "crate_10" || o.type === "crate_11") && !o.dead,
                ),
            null,
            { timeout: 15_000 },
        );
        const opened = await page.evaluate(
            (id) => (window as any).__rebirth.lastSnapshot.objects.find((o: any) => o.id === id),
            crate,
        );
        expect(!opened || opened.dead).toBe(true);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCREENS}/airdrop-opened.png` });
        expect(errors).toEqual([]);
    });

    test("killing a dummy with the AK-47 adds a kill feed line and the kill message", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&dummies=1&loot=0");
        await expect(page.locator("#ui-leaderboard-alive")).toHaveText("2");
        await expect(page.locator("#ui-kill-leader-name")).toHaveText("Waiting for new leader");
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        const target = await screenPosOf(page, dummy);
        expect(target).not.toBeNull();
        await page.mouse.move(target!.x, target!.y);
        await page.waitForTimeout(500);
        await page.mouse.down();
        try {
            await page.waitForFunction((id) => (window as any).__rebirth.game.getPlayer(id).dead, dummy, {
                timeout: 30_000,
            });
        } finally {
            await page.mouse.up();
        }
        await expect.poll(() => killFeed(page), { timeout: 10_000 }).toContain("player killed dummy 1 with AK-47");
        await expect(page.locator("#ui-kill-text")).toHaveText("YOU killed dummy 1 with AK-47");
        await expect(page.locator("#ui-kill-count")).toHaveText("1 Kill");
        await expect(page.locator("#ui-kills")).toHaveCSS("opacity", "1");
        // the local player's kill is light blue in the feed
        const color = await page.evaluate(
            () =>
                [...document.querySelectorAll<HTMLElement>(".killfeed-text")].find((e) =>
                    e.textContent?.includes("killed dummy 1"),
                )?.style.color,
        );
        expect(color).toBe("rgb(0, 191, 255)");
        expect(await page.evaluate(() => (window as any).__rebirth.match.localKills)).toBe(1);
        await expect(page.locator(".ui-player-kills")).toHaveText("1");
        await expect(page.locator("#ui-leaderboard-alive")).toHaveText("1");
        await page.screenshot({ path: `${SCREENS}/kill-feed.png` });
        expect(errors).toEqual([]);
    });

    test("three kills make the local player kill leader", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&give=ak47&dummies=3&loot=0");
        const ids = await page.evaluate(() => ({
            me: (window as any).__rebirth.player.id as number,
            dummies: (window as any).__rebirth.dummies as number[],
        }));
        for (const dummy of ids.dummies) await damage(page, dummy, 100, ids.me);
        // GameConfig.player.killLeaderMinKills = 3: the role is announced in the feed in orange
        await expect.poll(() => killFeed(page), { timeout: 10_000 }).toContain("player promoted to Kill Leader!");
        await expect(page.locator("#ui-kill-leader-name")).toHaveText("player");
        await expect(page.locator("#ui-kill-leader-count")).toHaveText("3");
        await expect(page.locator("#ui-kill-count")).toHaveText("3 Kills");
        const color = await page.evaluate(
            () =>
                [...document.querySelectorAll<HTMLElement>(".killfeed-text")].find((e) =>
                    e.textContent?.includes("Kill Leader"),
                )?.style.color,
        );
        expect(color).toBe("rgb(255, 132, 0)");
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/kill-leader.png` });
        expect(errors).toEqual([]);
    });

    test("a real loopback match: killing the only other player shows the win screen", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=0&map=main&seed=1&give=ak47&dummies=1&loot=0");
        await expect(page.locator("#ui-waiting-text")).toHaveText("Waiting for players...");
        await expect(page.locator("#ui-gas-timer")).toHaveText("0:00");
        // two players alive for 10 s start the match
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode !== "inactive", null, { timeout: 40_000 });
        await expect(page.locator("#ui-waiting-text")).toBeHidden();
        const ids = await page.evaluate(() => ({
            me: (window as any).__rebirth.player.id,
            dummy: (window as any).__rebirth.dummies[0],
        }));
        await damage(page, ids.dummy, 100, ids.me);
        await waitForStats(page);
        await expect(page.locator(".ui-stats-header-title")).toHaveText("Winner winner chicken dinner!");
        await expect(page.locator(".ui-stats-header-overview")).toHaveText("Solo Rank #1");
        await expect(page.locator(".ui-stats-info-player-name")).toHaveText("player");
        const rows = await statsRows(page);
        expect(rows.map((r) => r[0])).toEqual(["Kills", "Damage Dealt", "Damage Taken", "Survived"]);
        expect(rows[0][1]).toBe("1");
        expect(rows[1][1]).toBe("100");
        expect(rows[2][1]).toBe("0");
        expect(rows[3][1]).toMatch(/^\d+s$/);
        // nobody is left to spectate
        await expect(page.locator(".ui-stats-spectate")).toHaveCount(0);
        await expect(page.locator(".ui-stats-restart")).toHaveText("Play New Game");
        await page.screenshot({ path: `${SCREENS}/win-screen.png` });
        // Play New Game boots a fresh match
        await page.locator(".ui-stats-restart").click();
        await page.waitForFunction(
            () => (window as any).__rebirth.ready && !(window as any).__rebirth.match.gameOver.visible,
            null,
            { timeout: 45_000 },
        );
        await expect(page.locator("#ui-stats")).toBeHidden();
        await expect(page.locator("#ui-waiting-text")).toBeVisible();
        expect(await page.locator("#ui-game").count()).toBe(1);
        expect(errors).toEqual([]);
    });

    test("dying shows the death screen, Spectate follows the others with next / previous", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&dummies=2&loot=0");
        const ids = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            return { me: r.player.id as number, d1: r.dummies[0] as number, d2: r.dummies[1] as number };
        });
        await damage(page, ids.me, 500, ids.d1);
        await page.waitForFunction(() => (window as any).__rebirth.local.dead === true, null, { timeout: 10_000 });
        await expect.poll(() => killFeed(page), { timeout: 10_000 }).toContain("dummy 1 killed player with AK-47");
        await waitForStats(page);
        await expect(page.locator(".ui-stats-header-title")).toHaveText("You died.");
        await expect(page.locator(".ui-stats-header-overview")).toHaveText("Solo Rank #3");
        const rows = await statsRows(page);
        expect(rows[2]).toEqual(["Damage Taken", "100"]);
        await expect(page.locator(".ui-stats-restart")).toHaveText("Play New Game");
        await expect(page.locator(".ui-stats-spectate")).toHaveText("Spectate");
        await page.screenshot({ path: `${SCREENS}/death-screen.png` });

        await page.locator(".ui-stats-spectate").click();
        await page.waitForFunction(() => (window as any).__rebirth.match.spectating === true, null, {
            timeout: 10_000,
        });
        await expect(page.locator("#ui-stats")).toBeHidden();
        // the killer is watched first (survev getAliveKiller)
        await expect(page.locator("#ui-spectate-text")).toBeVisible();
        await expect(page.locator(".spectate-desc")).toHaveText("Spectating");
        await expect(page.locator("#spectate-player")).toHaveText("dummy 1");
        await expect(page.locator("#ui-spectate-options")).toBeVisible();
        await expect(page.locator("#ui-spec-counter-number")).toHaveText("1");
        expect(await page.evaluate(() => (window as any).__rebirth.match.activeId)).toBe(ids.d1);
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SCREENS}/spectate-ui.png` });

        await page.locator("#btn-spectate-next-player").click();
        await expect(page.locator("#spectate-player")).toHaveText("dummy 2", { timeout: 10_000 });
        // next / prev have a 1 s cooldown
        await page.waitForTimeout(1200);
        await page.keyboard.press("ArrowLeft");
        await expect(page.locator("#spectate-player")).toHaveText("dummy 1", { timeout: 10_000 });
        await page.locator("#btn-spectate-view-stats").click();
        await expect(page.locator("#ui-spectate-stats")).toBeVisible();
        await expect(page.locator("#btn-spectate-view-stats")).toHaveText("Hide Match Stats");

        // Leave Game starts a new life in the sandbox
        await page.locator("#btn-spectate-quit").click();
        await page.waitForFunction(
            (old) => {
                const r = (window as any).__rebirth;
                return r.player.id !== old && !r.match.spectating && r.local && !r.local.dead;
            },
            ids.me,
            { timeout: 10_000 },
        );
        await expect(page.locator("#ui-spectate-options")).toBeHidden();
        await expect(page.locator("#ui-stats")).toBeHidden();
        expect(errors).toEqual([]);
    });

    test("Korean: red-zone announcements, waiting text and the death screen", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&gas=fast&loot=0&dummies=1&lang=ko");
        await expect(page.locator(".ui-leaderboard-header")).toHaveText("생존자");
        await expect(page.locator("#ui-kill-leader-name")).toHaveText("새 지휘관 대기 중");
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode === "moving", null, { timeout: 20_000 });
        await expect(page.locator("#ui-announcement")).toHaveText("레드존 접근 중! 세이프 존으로 이동하세요!");
        await page.waitForFunction(() => (window as any).__rebirth.gas.mode === "waiting", null, { timeout: 20_000 });
        await expect(page.locator("#ui-announcement")).toHaveText(/^레드존 전진 \d+ 초$/);
        await expect(page.locator("#ui-gas-timer")).toHaveText(/^0:0\d$/);
        await page.screenshot({ path: `${SCREENS}/gas-ko.png` });

        const ids = await page.evaluate(() => ({
            me: (window as any).__rebirth.player.id,
            d1: (window as any).__rebirth.dummies[0],
        }));
        await damage(page, ids.me, 500, ids.d1);
        await expect
            .poll(() => killFeed(page), { timeout: 10_000 })
            .toContain("dummy 1 이(가) 사살했습니다 player 을(를). 사용무기: AK-47");
        await waitForStats(page);
        await expect(page.locator(".ui-stats-header-title")).toHaveText("당신 사망했습니다.");
        await expect(page.locator(".ui-stats-header-overview")).toHaveText("개인전 등수 #2");
        const rows = await statsRows(page);
        expect(rows.map((r) => r[0])).toEqual(["킬", "입힌 대미지", "받은 대미지", "생존 시간"]);
        await expect(page.locator(".ui-stats-restart")).toHaveText("새 게임 플레이");
        await expect(page.locator(".ui-stats-spectate")).toHaveText("관전");
        await page.screenshot({ path: `${SCREENS}/death-screen-ko.png` });
        await page.locator(".ui-stats-spectate").click();
        await expect(page.locator(".spectate-desc")).toHaveText("관전 중");
        await expect(page.locator("#btn-spectate-quit")).toHaveText("게임 떠나기");
        expect(errors).toEqual([]);
    });

    test("Korean: waiting for players in a real match", async ({ page }) => {
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=0&map=main&seed=1&loot=0&dummies=1&lang=ko");
        await expect(page.locator("#ui-waiting-text")).toHaveText("플레이어 대기 중...");
        expect(errors).toEqual([]);
    });
});
