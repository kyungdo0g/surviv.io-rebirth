import { type Browser, expect, type Page, test } from "@playwright/test";
import { collectErrors } from "./m4-helpers.ts";

// M6 start page and team lobby strings and errors (no game is started): Korean labels, joining by a pasted link, the
// leader's duo switch dropping the last joiner ("kicked"), a full room and an unknown code. Pages are closed when done:
// the server allows 5 lobby sockets per IP and the network party test may run at the same time.

async function open(browser: Browser, query: string): Promise<{ page: Page; errors: string[] }> {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errors = collectErrors(page);
    await page.goto(query);
    await page.waitForFunction(() => !!(window as any).__rebirth?.menu, null, { timeout: 20_000 });
    return { page, errors };
}

const players = (p: Page) => p.evaluate(() => (window as any).__rebirth.menu.lobby?.players.length ?? 0);

test("menu and lobby: Korean strings, join by pasted link, kicked, full room, unknown code", async ({ browser }) => {
    test.setTimeout(120_000);
    const leader = await open(browser, "/?menu=1&lang=ko&name=방장");
    const a = leader.page;
    await expect(a.locator("#btn-start-mode-0")).toHaveText("개인전 플레이");
    await expect(a.locator("#btn-start-mode-1")).toHaveText("2인 팀전 플레이");
    await expect(a.locator("#btn-start-mode-2")).toHaveText("분대(4명) 플레이");
    await expect(a.locator("#btn-create-team")).toHaveText("팀 만들기");
    await expect(a.locator("#btn-join-team")).toHaveText("팀에 합류");
    await expect(a.locator("#btn-help")).toHaveText("플레이 방법");
    await expect(a.locator("#player-name-input-solo")).toHaveAttribute("placeholder", "여기에 이름을 입력하세요");
    await a.screenshot({ path: "tests/e2e/__screens__/M6/main-menu-ko.png" });

    await a.locator("#btn-create-team").click();
    await a.waitForFunction(() => !!(window as any).__rebirth.menu.lobby?.code, null, { timeout: 20_000 });
    const { code, link } = await a.evaluate(() => (window as any).__rebirth.menu.lobby);
    await expect(a.locator("#btn-team-leave")).toHaveText("팀 떠나기");
    await expect(a.locator("#btn-team-queue-mode-1")).toHaveText("2인 팀전");
    await expect(a.locator("#btn-team-queue-mode-2")).toHaveText("분대(4명)");
    await expect(a.locator("#btn-team-fill-auto")).toHaveText("자동 채우기");
    await expect(a.locator("#btn-team-fill-none")).toHaveText("채우지 않기");
    await expect(a.locator("#btn-start-team")).toHaveText("플레이");
    await expect(a.locator("#team-code-text")).toContainText(`초대 코드: ${code}`);
    // the default room is a squad: four rows
    await expect(a.locator("#team-menu-member-list .team-menu-member")).toHaveCount(4);

    // B joins by the link (Korean), E through the Join Team panel with the pasted link (English)
    const b = (await open(browser, `/?team=${code}&lang=ko&name=B`)).page;
    await expect.poll(() => players(b), { timeout: 20_000 }).toBe(2);
    await expect(b.locator("#msg-wait-reason")).toHaveText("방장이 게임을 시작하길 기다리는 중 ...");
    await a.screenshot({ path: "tests/e2e/__screens__/M6/lobby-ko.png" });
    const e = (await open(browser, "/?menu=1&lang=en&name=E")).page;
    await e.locator("#btn-join-team").click();
    await expect(e.locator("#team-join .team-join-help")).toHaveText("Got a team link or code? Paste it here:");
    await e.locator("#team-link-input").fill(link);
    await e.locator("#btn-team-link-join").click();
    await expect.poll(() => players(e), { timeout: 20_000 }).toBe(3);
    await expect.poll(() => players(a)).toBe(3);

    // duo keeps two seats: the last joiner is kicked
    await a.locator("#btn-team-queue-mode-1").click();
    await e.waitForFunction(() => (window as any).__rebirth.menu.panel === "start");
    await expect(e.locator("#server-warning")).toHaveText("You were kicked from the team!");
    await expect.poll(() => players(a)).toBe(2);
    await e.context().close();

    // a third player finds the duo full; an unknown code fails
    const c = (await open(browser, `/?team=${code}&lang=ko`)).page;
    await c.waitForFunction(() => (window as any).__rebirth.menu.error !== "", null, { timeout: 20_000 });
    await expect(c.locator("#server-warning")).toHaveText("팀이 꽉 찼습니다!");
    await c.context().close();
    const d = (await open(browser, "/?team=ZZZZ&lang=ko")).page;
    await d.waitForFunction(() => (window as any).__rebirth.menu.error !== "", null, { timeout: 20_000 });
    await expect(d.locator("#server-warning")).toHaveText("팀 합류에 실패했습니다.");

    // the language toggle switches the page
    await d.locator("#btn-lang-en").click();
    await expect(d.locator("#btn-start-mode-1")).toHaveText("Play Duo");
    await expect(d.locator("#btn-create-team")).toHaveText("Create Team");
    // the leader kicks B
    await a.locator("#team-menu-member-list .icon-kick").first().click();
    await b.waitForFunction(() => (window as any).__rebirth.menu.panel === "start");
    await expect(b.locator("#server-warning")).toHaveText("팀으로부터 쫓겨났습니다!");
    expect(leader.errors).toEqual([]);
    for (const p of [a, b, d]) await p.context().close();
});
