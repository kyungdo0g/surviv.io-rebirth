// The survev-only melee weapons and throwables in the loopback sandbox (survev content wave stage 1,
// tools/port-survev/policy.json): the Gold Cutlass from ?give= is held with its HUD name and Pirate's Bounty, and each
// swing at a dummy deals the survev.wiki.gg damage 35; a coconut thrown at the dummy deals 22 and slows it 1 s, a
// tomato deals 11, slows 0.5 s and makes it drop an item. Also: the items' loot icons on the ground and their Korean
// names. Hooks: window.__rebirth.game (the sandbox Game: rules, observer, players, loot).
// Screenshots: __screens__/survev-melee-throwables.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-melee-throwables";

interface Hit {
    amount: number;
    source: string;
    frozen: number;
}

/** Records every hit on the dummy and keeps it alive (observer hooks only read the game). */
async function recordHits(page: Page, dummy: number): Promise<void> {
    await page.evaluate((dummy) => {
        const r = (window as any).__rebirth;
        const g = r.game;
        g.rules.headshotChance = 0;
        r.hits_survev = [] as Hit[];
        const obs = g.observer ?? {};
        const onDamaged = obs.onPlayerDamaged?.bind(obs);
        obs.onPlayerDamaged = (target: any, params: any, amount: number, headshot: boolean) => {
            if (target.id === dummy) {
                r.hits_survev.push({ amount, source: params.gameSourceType ?? "", frozen: target.frozen.ticker });
                target.health = 100;
            }
            onDamaged?.(target, params, amount, headshot);
        };
        g.observer = obs;
    }, dummy);
}

async function hits(page: Page): Promise<Hit[]> {
    return page.evaluate(() => (window as any).__rebirth.hits_survev as Hit[]);
}

/** Boots the sandbox with `give` and one dummy; returns the dummy's id. */
async function sandbox(page: Page, give: string, extra = ""): Promise<number> {
    await boot(page, `/?sandbox=1&map=main&seed=1&loot=0&give=${give}&dummies=1${extra}`);
    const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
    expect(dummy).toBeGreaterThan(0);
    return dummy;
}

/** Moves the dummy `dist` units in front of the local player (facing +x) and aims at it. */
async function dummyAhead(page: Page, dummy: number, dist: number): Promise<void> {
    const target = await page.evaluate(
        ({ id, dist }) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const d = r.game.getPlayer(id);
            d.pos = { x: me.pos.x + dist, y: me.pos.y };
            return r.worldToScreen(d.pos);
        },
        { id: dummy, dist },
    );
    await page.waitForTimeout(200);
    await page.mouse.move(target.x, target.y);
    await page.waitForFunction(
        (id) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const d = r.game.getPlayer(id);
            const dx = d.pos.x - me.pos.x;
            const dy = d.pos.y - me.pos.y;
            return (me.dir.x * dx + me.dir.y * dy) / Math.hypot(dx, dy) > 0.998;
        },
        dummy,
        { timeout: 10_000 },
    );
}

/** Clicks until `n` hits on the dummy are recorded. */
async function attackUntil(page: Page, n: number): Promise<void> {
    const deadline = Date.now() + 20_000;
    while ((await hits(page)).length < n) {
        expect(Date.now(), `fewer than ${n} hits on the dummy`).toBeLessThan(deadline);
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.mouse.up();
        await page.waitForTimeout(600);
    }
}

test.describe("survev-only melee and throwables in the sandbox", () => {
    test("Gold Cutlass: held, named, gives Pirate's Bounty, each swing deals the wiki's 35", async ({ page }) => {
        const errors = collectErrors(page);
        const dummy = await sandbox(page, "cutlass_gold");
        const local = await page.evaluate(() => (window as any).__rebirth.local.weapons[2]);
        expect(local.type).toBe("cutlass_gold");
        await expect(page.locator("#ui-weapon-id-3 .ui-weapon-name")).toHaveText("Cutlass");
        expect(
            await page.evaluate(
                () => (window as any).__rebirth.game.getPlayer((window as any).__rebirth.player.id).perks,
            ),
        ).toContain("pirate");
        await recordHits(page, dummy);
        await dummyAhead(page, dummy, 2.5);
        await attackUntil(page, 2);
        await page.screenshot({ path: `${SCREENS}/cutlass_gold-swing.png` });
        // wikigg/Cutlass rev 5250, tab Gold Cutlass: Damage 35
        for (const h of await hits(page)) {
            expect(h.source).toBe("cutlass_gold");
            expect(h.amount).toBe(35);
        }
        expect(errors).toEqual([]);
    });

    for (const t of [
        { item: "coconut", damage: 22, frozen: 1, drops: 0 },
        { item: "tomato", damage: 11, frozen: 0.5, drops: 1 },
    ]) {
        test(`${t.item}: a hit deals ${t.damage} and slows the dummy ${t.frozen} s`, async ({ page }) => {
            const errors = collectErrors(page);
            const dummy = await sandbox(page, t.item);
            expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[3].type)).toBe(t.item);
            await page.evaluate((id) => {
                (window as any).__rebirth.game.getPlayer(id).inv.set("bandage", 10);
            }, dummy);
            await recordHits(page, dummy);
            await dummyAhead(page, dummy, 7);
            const lootBefore = await page.evaluate(() => (window as any).__rebirth.game.loot.items.size as number);
            await attackUntil(page, 1);
            await page.waitForTimeout(200);
            await page.screenshot({ path: `${SCREENS}/${t.item}-hit.png` });
            const [h] = await hits(page);
            expect(h.source).toBe(t.item);
            expect(h.amount).toBeCloseTo(t.damage, 6);
            // the slow starts as the hit lands, before its damage (survev explosion.ts)
            expect(h.frozen).toBeCloseTo(t.frozen, 6);
            const lootAfter = await page.evaluate(() => (window as any).__rebirth.game.loot.items.size as number);
            expect(lootAfter - lootBefore).toBe(t.drops);
            expect(errors).toEqual([]);
        });
    }

    test("loot icons on the ground and Korean names", async ({ page }) => {
        const errors = collectErrors(page);
        await sandbox(page, "iceaxe", "&lang=ko");
        await expect(page.locator("#ui-weapon-id-3 .ui-weapon-name")).toHaveText("얼음 도끼");
        const items = [
            "iceaxe",
            "cutlass",
            "cutlass_gold",
            "naginata_daemon",
            "karambit_borealis",
            "coconut",
            "tomato",
        ];
        await page.evaluate((items) => {
            const r = (window as any).__rebirth;
            const p = r.player.pos;
            items.forEach((type: string, i: number) => {
                const a = (i / items.length) * Math.PI * 2;
                r.game.loot.addLoot(type, { x: p.x + Math.cos(a) * 5, y: p.y - 4 + Math.sin(a) * 3 }, 0, 1, {
                    pushSpeed: 0,
                });
            });
        }, items);
        await page.waitForFunction(
            (n) =>
                ((window as any).__rebirth.lastSnapshot?.objects ?? []).filter((o: any) => o.kind === "loot").length >=
                n,
            items.length,
            { timeout: 10_000 },
        );
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/loot-icons.png` });
        const lootTypes = await page.evaluate(() =>
            ((window as any).__rebirth.lastSnapshot.objects as any[])
                .filter((o) => o.kind === "loot")
                .map((o) => o.type),
        );
        expect([...lootTypes].sort()).toEqual([...items].sort());
        expect(errors).toEqual([]);
    });
});
