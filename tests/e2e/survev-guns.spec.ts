// The survev-only guns in the loopback sandbox (tools/port-survev/policy.json): each gun from ?give=<gun> is held with
// its survev sprite and HUD name, fires at a dummy, and every hit on the unarmoured body deals the survev.wiki.gg
// damage (headshots off; the bullet falloff over the distance the bullet travelled, as the sim applies it). The
// PMG-134's potato shots deal 8.5, slow the dummy and shrink its view. The winter sniper skins hit like their base
// guns. Also: the guns' loot icons on the ground, the Korean HUD names and .50 ammo, and the Barrett in the kill feed.
// Hooks: window.__rebirth.game (the sandbox Game: rules, observer, players, loot).
// Screenshots: __screens__/survev-guns.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors, killFeed } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/survev-guns";

/** survev.wiki.gg body damage per bullet (per pellet; the PMG-134: per potato explosion) */
const WIKI: ReadonlyArray<{ gun: string; damage: number; name: string; page: string }> = [
    { gun: "barrett", damage: 99, name: "Barrett M107", page: "Barrett_M107 rev 7220" },
    { gun: "ash12", damage: 31, name: "ASh-12", page: "ASh-12 rev 7221" },
    { gun: "sw500", damage: 64, name: "S&W 500", page: "S&W_500 rev 7223" },
    { gun: "imbel", damage: 12, name: "IMD-2", page: "IMD-2 rev 6441" },
    { gun: "spas16", damage: 8.75, name: "SPAS-16", page: "SPAS-16 rev 5932" },
];

interface Hit {
    amount: number;
    headshot: boolean;
    source: string;
    /** the hitting bullet's def damage, and its damage after the falloff over the distance it travelled */
    bulletDamage?: number;
    expected?: number;
    /** the dummy's slow and view shrink as the hit lands (a potato's effects apply before its damage) */
    frozen: number;
    shrink: number;
}

/** Turns headshots off and records every hit on the dummy (observer hooks only read the game). */
async function recordHits(page: Page, dummy: number): Promise<void> {
    await page.evaluate((dummy) => {
        const r = (window as any).__rebirth;
        const g = r.game;
        g.rules.headshotChance = 0;
        r.hits_survev = [] as Hit[];
        const pending: Array<{ bulletDamage: number; expected: number }> = [];
        const obs = g.observer ?? {};
        const onBullet = obs.onBulletHitPlayer?.bind(obs);
        const onDamaged = obs.onPlayerDamaged?.bind(obs);
        obs.onBulletHitPlayer = (b: any, target: any) => {
            if (target.id === dummy) {
                const t = Math.min(Math.max(b.distanceTraveled / b.distance, 0), 1);
                const base = b.damage / (b.reflectCount + 1);
                pending.push({ bulletDamage: b.def.damage, expected: base * (1 + (b.def.falloff - 1) * t) });
            }
            onBullet?.(b, target);
        };
        obs.onPlayerDamaged = (target: any, params: any, amount: number, headshot: boolean) => {
            if (target.id === dummy) {
                const bullet = params.isExplosion !== true ? pending.shift() : undefined;
                r.hits_survev.push({
                    amount,
                    headshot,
                    source: params.gameSourceType ?? "",
                    frozen: target.frozen.ticker,
                    shrink: target.viewShrink.amount,
                    ...bullet,
                });
                // keep the dummy alive for the next shot
                target.health = 100;
            }
            onDamaged?.(target, params, amount, headshot);
        };
        g.observer = obs;
    }, dummy);
}

/** Aims at the dummy and waits until the local player faces it. */
async function aimAt(page: Page, dummy: number): Promise<void> {
    const target = await page.evaluate((id) => {
        const r = (window as any).__rebirth;
        return r.worldToScreen(r.visualPos(id));
    }, dummy);
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

async function hits(page: Page): Promise<Hit[]> {
    return page.evaluate(() => (window as any).__rebirth.hits_survev as Hit[]);
}

/** Boots the sandbox with `give`, one dummy in front; returns the dummy's id. */
async function sandbox(page: Page, give: string, extra = ""): Promise<number> {
    await boot(page, `/?sandbox=1&map=main&seed=1&loot=0&give=${give}&dummies=1${extra}`);
    const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
    expect(dummy).toBeGreaterThan(0);
    return dummy;
}

/** Clicks (holding each press 200 ms: auto guns fire a few rounds) until `n` hits on the dummy are recorded. */
async function fireUntil(page: Page, n: number): Promise<void> {
    const deadline = Date.now() + 20_000;
    while ((await hits(page)).length < n) {
        expect(Date.now(), `fewer than ${n} hits on the dummy`).toBeLessThan(deadline);
        await page.mouse.down();
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(400);
    }
}

test.describe("survev-only guns in the sandbox", () => {
    for (const w of WIKI) {
        test(`${w.gun}: held, named, and each body hit deals the wiki damage ${w.damage}`, async ({ page }) => {
            const errors = collectErrors(page);
            const dummy = await sandbox(page, w.gun);
            const local = await page.evaluate(() => (window as any).__rebirth.local.weapons[0]);
            expect(local.type).toBe(w.gun);
            await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText(w.name);
            await recordHits(page, dummy);
            await aimAt(page, dummy);
            await fireUntil(page, w.gun === "spas16" ? 9 : 2);
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${SCREENS}/${w.gun}-firing.png` });
            const got = await hits(page);
            const bulletHits = got.filter((h) => h.bulletDamage !== undefined);
            expect(bulletHits.length).toBeGreaterThanOrEqual(w.gun === "spas16" ? 9 : 2);
            for (const h of bulletHits) {
                expect(h.headshot).toBe(false);
                expect(h.source).toBe(w.gun);
                // the bullet's damage is the wiki's, and the body took it less the falloff over its flight
                expect(h.bulletDamage, w.page).toBe(w.damage);
                expect(h.amount).toBeCloseTo(h.expected!, 6);
                expect(h.amount).toBeLessThanOrEqual(w.damage);
                expect(h.amount).toBeGreaterThan(w.damage * 0.97);
            }
            console.log(`${w.gun}: wiki ${w.damage}, hits ${bulletHits.map((h) => h.amount.toFixed(3)).join(", ")}`);
            // the sound engine was asked for the gun's sounds without throwing
            expect(await page.evaluate(() => (window as any).__rebirth.audio.requested)).toBeGreaterThan(0);
            expect(errors).toEqual([]);
        });
    }

    test("PMG-134: two potatoes a shot, 8.5 each, slow the dummy and shrink its view", async ({ page }) => {
        const errors = collectErrors(page);
        const dummy = await sandbox(page, "potato_lmg");
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("PMG-134");
        await recordHits(page, dummy);
        await aimAt(page, dummy);
        await fireUntil(page, 4);
        await page.screenshot({ path: `${SCREENS}/potato_lmg-firing.png` });
        const got = await hits(page);
        const potatoes = got.filter((h) => h.source === "potato_lmgshot");
        expect(potatoes.length).toBeGreaterThanOrEqual(4);
        // wikigg PMG-134 rev 6674: Explosion damage 8.5 (a direct hit, inside rad.min 1.25)
        for (const h of potatoes) expect(h.amount).toBeCloseTo(8.5, 6);
        // each potato slows the dummy for 0.25 s and takes 1.5 more off its view (survev decrementViewDistance)
        for (const [i, h] of potatoes.entries()) {
            expect(h.frozen).toBeCloseTo(0.25, 6);
            expect(h.shrink).toBe(Math.min(32, 1.5 * (i + 1)));
        }
        expect(errors).toEqual([]);
    });

    test("the winter sniper skins hit like their base guns", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        // the bases' bullets (bullet_svd 36, bullet_sv98 80, bullet_awc 180 in the defs: the skins keep the base's)
        for (const [skin, baseDamage] of [
            ["svd_winter", 36],
            ["sv98_winter", 80],
            ["awc_winter", 180],
        ] as const) {
            const dummy = await sandbox(page, skin);
            expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[0].type)).toBe(skin);
            await recordHits(page, dummy);
            await aimAt(page, dummy);
            await fireUntil(page, 1);
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${SCREENS}/${skin}-firing.png` });
            const [h] = (await hits(page)).filter((x) => x.bulletDamage !== undefined);
            expect(h.source).toBe(skin);
            expect(h.bulletDamage).toBe(baseDamage);
            // a hit is capped at the dummy's 100 health (the AWM-S's 180)
            expect(h.amount).toBeCloseTo(Math.min(100, h.expected!), 6);
        }
        expect(errors).toEqual([]);
    });

    test("loot icons on the ground, Korean names, .50 Caliber ammo and the Barrett in the kill feed", async ({
        page,
    }) => {
        const errors = collectErrors(page);
        const dummy = await sandbox(page, "barrett,sw500", "&lang=ko");
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("바렛 M107");
        await expect(page.locator("#ui-weapon-id-2 .ui-weapon-name")).toHaveText("S&W 500");
        // a full level 0 bag of .50 rounds (survev's 50, wikigg .50 Caliber)
        expect(await page.evaluate(() => (window as any).__rebirth.local.inventory["50AE"])).toBe(50);
        // every survev-only gun as loot around the player
        const guns = ["barrett", "ash12", "sw500", "imbel", "spas16", "potato_lmg", "svd_winter", "sv98_winter"];
        await page.evaluate((guns) => {
            const r = (window as any).__rebirth;
            const p = r.player.pos;
            guns.forEach((type: string, i: number) => {
                const a = (i / guns.length) * Math.PI * 2;
                r.game.loot.addLoot(type, { x: p.x + Math.cos(a) * 5, y: p.y - 4 + Math.sin(a) * 3 }, 0, 1, {
                    pushSpeed: 0,
                    noSideAmmo: true,
                });
            });
        }, guns);
        await page.waitForFunction(
            (n) =>
                ((window as any).__rebirth.lastSnapshot?.objects ?? []).filter((o: any) => o.kind === "loot").length >=
                n,
            guns.length,
            { timeout: 10_000 },
        );
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/loot-icons.png` });
        const lootTypes = await page.evaluate(() =>
            ((window as any).__rebirth.lastSnapshot.objects as any[])
                .filter((o) => o.kind === "loot")
                .map((o) => o.type),
        );
        expect([...lootTypes].sort()).toEqual([...guns].sort());
        // the Barrett kills the dummy: the kill feed names it (Korean)
        await aimAt(page, dummy);
        await page.evaluate((id) => {
            (window as any).__rebirth.game.getPlayer(id).health = 50;
        }, dummy);
        await page.mouse.down();
        try {
            await page.waitForFunction((id) => (window as any).__rebirth.game.getPlayer(id).dead === true, dummy, {
                timeout: 15_000,
            });
        } finally {
            await page.mouse.up();
        }
        await expect
            .poll(() => killFeed(page), { timeout: 5_000 })
            .toEqual(expect.arrayContaining([expect.stringContaining("바렛 M107")]));
        await page.screenshot({ path: `${SCREENS}/killfeed-ko.png` });
        expect(errors).toEqual([]);
    });
});
