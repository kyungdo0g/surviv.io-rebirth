import { expect, type Page, test } from "@playwright/test";
import { collectErrors, damage } from "./m4-helpers.ts";
import { lootAtPlayer } from "./m7-helpers.ts";
import { bootLoopback, SCREENS, TouchDriver } from "./m8-helpers.ts";

// M8 small HUD layout (the original UiLayout.Sm; docs/research/ui/hud.md "Layout") in phone emulation, landscape and
// portrait: the 108 px minimap (192 x 0.5626) in the top-left corner clear of the sticks and the weapon slots, a bottom
// HUD whose parts never overlap, the sticks' range circles reaching the canvas, the touch emote button and pings by
// tapping the big map. On desktop: Toggle Minimap (V), Hide UI and the class picker hidden behind the in-game menu.

type Box = { sel: string; x: number; y: number; width: number; height: number };

const PHONE_QUERY = "/?sandbox=1&touch=1&map=main&seed=1&give=ak47,m9,frag,bandage,soda,2xscope&loot=0&dummies=2";
/** the HUD parts that must not overlap each other (leaf elements, visible ones only) */
const HUD_PARTS = [
    ".ui-weapon-switch",
    "#ui-ammo-interactive .ui-ammo",
    "#ui-medical-interactive .ui-loot",
    "#ui-current-clip",
    "#ui-remaining-ammo",
    "#ui-reload-button",
    "#ui-health-counter",
    "#ui-boost-counter",
    "#ui-bottom-center-right .ui-armor-counter",
    "#ui-bottom-center-left .ui-armor-counter",
    "#ui-emote-button",
    "#ui-map-info",
    "#ui-alive-info",
    "#ui-top-center-scopes .ui-zoom",
    "#ui-interaction",
];

/** Screen boxes of every visible element matching the selectors. */
async function boxes(page: Page, selectors: string[]): Promise<Box[]> {
    return page.evaluate((sels) => {
        const out: Box[] = [];
        for (const sel of sels) {
            document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                if (r.width < 1 || r.height < 1 || cs.visibility === "hidden") return;
                out.push({ sel: `${sel}#${el.id || i}`, x: r.x, y: r.y, width: r.width, height: r.height });
            });
        }
        return out;
    }, selectors);
}

function overlap(a: Omit<Box, "sel">, b: Omit<Box, "sel">): number {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
}

/** Distance from a point to the nearest point of a box. */
function distToBox(p: { x: number; y: number }, b: Omit<Box, "sel">): number {
    const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.width));
    const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.height));
    return Math.hypot(dx, dy);
}

async function rebirth<T>(page: Page, fn: string): Promise<T> {
    return page.evaluate((f) => new Function("r", `return ${f}`)((window as any).__rebirth), fn) as Promise<T>;
}

/** Records every transform written on the bandage image (the item count pop, survev ui2.ts). */
async function watchBandagePop(page: Page): Promise<void> {
    await page.evaluate(() => {
        const img = document.querySelector<HTMLElement>("#ui-loot-bandage .ui-loot-image");
        const seen: string[] = [];
        (window as any).__bandagePop = seen;
        if (img) new MutationObserver(() => seen.push(img.style.transform)).observe(img, { attributes: true });
    });
}

async function bandagePops(page: Page): Promise<string[]> {
    return page.evaluate(() => ((window as any).__bandagePop as string[]).filter((t) => t.startsWith("scale(")));
}

/** Gear, a perk, two kills and a gun the full slots refuse: the HUD parts that are hidden at first show up. */
async function fillHud(page: Page): Promise<void> {
    const me = await rebirth<number>(page, "r.player.id");
    const dummies = await rebirth<number[]>(page, "r.dummies");
    for (const item of ["helmet02", "chest02", "backpack02", "steelskin"]) await lootAtPlayer(page, item);
    // mobile players auto-loot armour, packs and a first perk (survev player.ts mobile auto loot)
    await expect.poll(() => rebirth(page, "r.local.helmet"), { timeout: 15_000 }).toBe("helmet02");
    await expect.poll(() => rebirth(page, "(r.local.perks ?? []).length"), { timeout: 15_000 }).toBe(1);
    for (const d of dummies) await damage(page, d, 500, me);
    await expect.poll(() => rebirth<string[]>(page, "r.match.killFeed"), { timeout: 10_000 }).toHaveLength(2);
    // kill feed at top 24 / left 6, lines 15 px apart, at full opacity at once on mobile (no fade, survev ui2.ts)
    await expect(page.locator("#ui-killfeed-wrapper")).toHaveCSS("top", "24px");
    await expect(page.locator("#ui-killfeed-wrapper")).toHaveCSS("left", "6px");
    const lines = () =>
        page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>(".killfeed-div")]
                .filter((d) => Number(d.style.opacity) > 0)
                .map((d) => [d.style.top, Number(d.style.opacity)])
                .sort(),
        );
    await expect.poll(lines).toEqual([
        ["0px", 1],
        ["15px", 1],
    ]);
    // more bandages: the count goes up without the pop on mobile
    await watchBandagePop(page);
    const bandages = await rebirth<number>(page, "r.local.inventory.bandage ?? 0");
    await lootAtPlayer(page, "bandage", 3);
    await expect.poll(() => rebirth(page, "r.local.inventory.bandage"), { timeout: 15_000 }).toBe(bandages + 3);
    await page.waitForTimeout(300);
    expect(await bandagePops(page)).toEqual([]);
    await lootAtPlayer(page, "mp5");
    await expect(page.locator("#ui-interaction")).toBeVisible({ timeout: 10_000 });
}

/** The small layout's geometry: minimap corner, nothing overlapping, sticks clear and reaching the canvas. */
async function checkLayout(page: Page, landscape: boolean): Promise<void> {
    expect(await rebirth(page, "r.layout.name")).toBe("sm");
    expect(await rebirth(page, "r.layout.landscape")).toBe(landscape);
    await expect(page.locator("#ui-game")).toHaveClass(/ui-layout-sm/);
    const vw = page.viewportSize()?.width ?? 0;
    const vh = page.viewportSize()?.height ?? 0;

    // minimap: 192 x 0.5626 px, 4 px from the top-left corner (survev ui.ts getMinimapSize / Margin, redraw)
    const map = await rebirth<Omit<Box, "sel">>(page, "r.minimap.rect");
    expect(map.x).toBe(4);
    expect(map.y).toBe(4);
    expect(map.width).toBeCloseTo(192 * 0.5626, 1);

    const parts = await boxes(page, HUD_PARTS);
    expect(parts.filter((b) => b.sel.startsWith(".ui-weapon-switch"))).toHaveLength(4);
    expect(parts.filter((b) => b.sel.startsWith("#ui-ammo-interactive"))).toHaveLength(8);
    expect(parts.filter((b) => b.sel.startsWith("#ui-medical-interactive"))).toHaveLength(4);
    expect(parts.filter((b) => b.sel.startsWith("#ui-bottom-center-right"))).toHaveLength(3);
    expect(parts.filter((b) => b.sel.startsWith("#ui-bottom-center-left"))).toHaveLength(1);
    const clashes: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        if (a.x < -0.5 || a.y < -0.5 || a.x + a.width > vw + 0.5 || a.y + a.height > vh + 0.5) {
            clashes.push(`${a.sel} off screen`);
        }
        if (overlap(a, map) > 0.5) clashes.push(`${a.sel} x minimap`);
        for (let j = i + 1; j < parts.length; j++) {
            if (overlap(a, parts[j]) > 0.5) clashes.push(`${a.sel} x ${parts[j].sel}`);
        }
    }
    expect(clashes).toEqual([]);

    // the locked sticks: centres and range circles clear of the minimap and every HUD part; the drawn pads clear of
    // the minimap (pad.img 208 px x 0.6 x the pad scale)
    const centers = await rebirth<{ left: { x: number; y: number }; right: { x: number; y: number } }>(
        page,
        "r.touch.lockedCenters",
    );
    const range = await rebirth<number>(page, "r.touch.range");
    const padRadius = (208 * 0.6 * (landscape ? 1 : 0.8)) / 2;
    for (const c of [centers.left, centers.right]) {
        expect(distToBox(c, map)).toBeGreaterThan(padRadius);
        for (const b of parts) {
            if (distToBox(c, b) <= range) clashes.push(`${b.sel} inside the stick range at ${c.x},${c.y}`);
        }
    }
    expect(clashes).toEqual([]);
    // taps anywhere in the stick ranges reach the canvas (no HUD element swallows them)
    const swallowed = await page.evaluate(
        ({ centers, range }) => {
            const canvas = (window as any).__rebirth.app.canvas as HTMLCanvasElement;
            const out: string[] = [];
            for (const c of centers) {
                for (let a = 0; a < 16; a++) {
                    for (const f of [0, 0.5, 1]) {
                        const x = c.x + Math.cos((a / 16) * Math.PI * 2) * range * f;
                        const y = c.y + Math.sin((a / 16) * Math.PI * 2) * range * f;
                        const el = document.elementFromPoint(x, y);
                        if (el !== canvas) out.push(`${Math.round(x)},${Math.round(y)}: ${el?.id || el?.className}`);
                    }
                }
            }
            return out;
        },
        { centers: [centers.left, centers.right], range },
    );
    expect(swallowed).toEqual([]);
}

/** The emote button opens the emote wheel at the screen centre; a tap on the top wedge sends that emote. */
async function emoteByTouch(page: Page): Promise<void> {
    const vw = page.viewportSize()?.width ?? 0;
    const vh = page.viewportSize()?.height ?? 0;
    const sent = () => rebirth<Array<{ type: string; isPing: boolean }>>(page, "r.emotes.sent");
    const before = (await sent()).length;
    await page.locator("#ui-emote-button").tap();
    await expect.poll(() => rebirth(page, "r.emotes.wheel")).toBe("emote");
    await expect(page.locator("#ui-emote-top .ui-emote-bg-quarter")).toBeVisible();
    await page.touchscreen.tap(vw / 2, vh / 2 - 78);
    await expect.poll(async () => (await sent()).length).toBe(before + 1);
    expect((await sent()).at(-1)).toEqual({ type: "emote_happyface", isPing: false });
    await expect.poll(() => rebirth(page, "r.emotes.wheel")).toBe(null);
    // a tap away from the wheel closes it without sending
    await page.locator("#ui-emote-button").tap();
    await expect.poll(() => rebirth(page, "r.emotes.wheel")).toBe("emote");
    await page.touchscreen.tap(vw / 2, Math.max(8, vh / 2 - 170));
    await expect.poll(() => rebirth(page, "r.emotes.wheel")).toBe(null);
    expect(await sent()).toHaveLength(before + 1);
}

/** A tap on the minimap opens the big map; a tap on the big map opens the ping wheel; the top wedge pings there. */
async function pingByTouch(page: Page, name: string): Promise<void> {
    const vw = page.viewportSize()?.width ?? 0;
    const vh = page.viewportSize()?.height ?? 0;
    const map = await rebirth<Omit<Box, "sel">>(page, "r.minimap.rect");
    await page.touchscreen.tap(map.x + map.width * 0.6, map.y + map.height * 0.6);
    await expect.poll(() => rebirth(page, "r.bigMap.open")).toBe(true);
    await expect(page.locator("#big-map-close")).toBeVisible();
    await expect(page.locator("#ui-emote-button")).toBeHidden();
    const big = await rebirth<Omit<Box, "sel">>(page, "r.bigMap.rect");
    const at = { x: big.x + big.width * 0.25, y: big.y + big.height * 0.2 };
    const expected = await page.evaluate((p) => (window as any).__rebirth.client.minimap.screenToWorld(p), at);
    expect(expected).not.toBeNull();
    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(() => rebirth(page, "r.emotes.wheel")).toBe("ping");
    await page.screenshot({ path: `${SCREENS}/layout-${name}-ping-wheel.png` });
    await page.touchscreen.tap(vw / 2, vh / 2 - 78);
    await expect
        .poll(async () => (await rebirth<Array<{ type: string }>>(page, "r.emotes.sent")).at(-1)?.type)
        .toBe("ping_danger");
    const ping = (await rebirth<Array<{ isPing: boolean; pos: { x: number; y: number } }>>(page, "r.emotes.sent")).at(
        -1,
    );
    expect(ping?.isPing).toBe(true);
    expect(Math.abs((ping?.pos.x ?? 0) - expected.x)).toBeLessThan(1);
    expect(Math.abs((ping?.pos.y ?? 0) - expected.y)).toBeLessThan(1);
    await expect.poll(() => rebirth(page, "r.emotes.mapPings")).toBe(1);
    // the big map stays open after a ping (survev triggerPing); its close button closes it
    expect(await rebirth(page, "r.bigMap.open")).toBe(true);
    await page.screenshot({ path: `${SCREENS}/layout-${name}-ping.png` });
    await page.locator("#big-map-close").tap();
    await expect.poll(() => rebirth(page, "r.bigMap.open")).toBe(false);
}

const AMMO_IDS = () =>
    [...document.querySelectorAll("#ui-ammo-interactive .ui-ammo")].map((e) => e.id.replace("ui-loot-", ""));

test.describe("phone landscape", () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test("small layout: minimap top left, no overlaps, sticks clear; emote button and big map pings", async ({
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await bootLoopback(page, PHONE_QUERY);
        await fillHud(page);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/layout-landscape.png` });
        await checkLayout(page, true);
        // landscape ammo grid: specials on the left, the common calibres on the right (survev touch.ts)
        expect(await page.evaluate(AMMO_IDS)).toEqual([
            "50AE",
            "9mm",
            "308sub",
            "12gauge",
            "flare",
            "762mm",
            "45acp",
            "556mm",
        ]);
        // hidden on the small layout: leaderboard and kill leader; the alive count sits under the minimap
        await expect(page.locator("#ui-leaderboard-wrapper")).toBeHidden();
        await expect(page.locator("#ui-kill-leader-wrapper")).toBeHidden();
        await expect(page.locator("#ui-map-counter-default")).toHaveText("1");
        // the touch prompt shows the tap icon; the reload button reloads
        await expect(page.locator("#ui-interaction-press")).toHaveCSS("background-image", /tap\.svg/);
        await expect(page.locator("#ui-reload-button-container")).toBeVisible();
        const touch = await TouchDriver.create(page);
        await touch.start(2, 620, 200);
        await touch.move(2, 700, 200);
        await expect.poll(() => rebirth<number>(page, "r.local.weapons[0].ammo"), { timeout: 10_000 }).toBeLessThan(30);
        await touch.endAll();
        await page.locator("#ui-reload-button-container").tap();
        await expect.poll(() => rebirth(page, "r.local.action?.type")).toBe("reload");
        await expect(page.locator("#ui-pie-timer")).toBeVisible();
        await page.screenshot({ path: `${SCREENS}/layout-landscape-reload.png` });

        // the locked move stick: a drag from its centre walks
        await page.evaluate(() => (window as any).__rebirth.config.set("touchMoveStyle", "locked"));
        const c = await rebirth<{ left: { x: number; y: number } }>(page, "r.touch.lockedCenters");
        await touch.start(1, c.left.x, c.left.y);
        await touch.move(1, c.left.x + 40, c.left.y);
        await expect
            .poll(() => rebirth(page, "r.lastInput"), { timeout: 5_000 })
            .toMatchObject({ touchMoveActive: true });
        expect(await rebirth<number>(page, "r.lastInput.touchMoveLen")).toBeGreaterThan(150);
        await touch.endAll();

        await emoteByTouch(page);
        await pingByTouch(page, "landscape");
        expect(errors).toEqual([]);
    });
});

test.describe("phone portrait", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("portrait: bars on top, slots along the bottom, portrait ammo order; turning re-lays out", async ({
        page,
    }) => {
        test.setTimeout(150_000);
        const errors = collectErrors(page);
        await bootLoopback(page, PHONE_QUERY);
        await fillHud(page);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/layout-portrait.png` });
        await checkLayout(page, false);
        // portrait: the common calibres first (survev touch.ts), the scopes hidden
        expect(await page.evaluate(AMMO_IDS)).toEqual([
            "9mm",
            "12gauge",
            "762mm",
            "556mm",
            "50AE",
            "308sub",
            "flare",
            "45acp",
        ]);
        await expect(page.locator("#ui-top-center-scopes")).toBeHidden();
        const health = await page.locator("#ui-health-counter").boundingBox();
        const slot = await page.locator("#ui-weapon-id-1").boundingBox();
        expect(health?.y ?? 999).toBeLessThan(40);
        expect((slot?.y ?? 0) + (slot?.height ?? 0)).toBeGreaterThan(844 - 40);
        await emoteByTouch(page);
        await pingByTouch(page, "portrait");

        // turning the phone re-evaluates the layout: landscape order and positions
        await page.setViewportSize({ width: 844, height: 390 });
        await expect.poll(() => rebirth(page, "r.layout.landscape")).toBe(true);
        await expect(page.locator("#ui-game")).toHaveClass(/ui-landscape/);
        expect((await page.evaluate(AMMO_IDS))[0]).toBe("50AE");
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/layout-rotated.png` });
        await checkLayout(page, true);
        expect(errors).toEqual([]);
    });
});

test.describe("desktop", () => {
    test("small windows use the small layout; V toggles the minimap; Hide UI hides the HUD until Escape", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await bootLoopback(page, "/?sandbox=1&map=main&seed=1&give=ak47&loot=0");
        expect(await rebirth(page, "r.layout.name")).toBe("lg");
        const lg = await rebirth<Omit<Box, "sel">>(page, "r.minimap.rect");
        expect(lg.y).toBeGreaterThan(300);
        // a window whose longer side is 850 px or less switches to the small layout (survev device.ts)
        await page.setViewportSize({ width: 800, height: 600 });
        await expect.poll(() => rebirth(page, "r.layout.name")).toBe("sm");
        await expect.poll(() => rebirth(page, "r.minimap.rect.y")).toBe(4);
        await page.screenshot({ path: `${SCREENS}/layout-desktop-small.png` });
        await page.setViewportSize({ width: 1280, height: 720 });
        await expect.poll(() => rebirth(page, "r.layout.name")).toBe("lg");
        await expect.poll(() => rebirth<number>(page, "r.minimap.rect.y")).toBeGreaterThan(300);

        // desktop item counts pop when they go up (survev ui2.ts updateAnimationWidth)
        await watchBandagePop(page);
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).inv.give("bandage", 3);
        });
        await expect.poll(() => rebirth(page, "r.local.inventory.bandage"), { timeout: 10_000 }).toBe(3);
        await expect.poll(() => bandagePops(page)).not.toEqual([]);
        await expect
            .poll(async () => (await page.locator("#ui-loot-bandage .ui-loot-image").getAttribute("style")) ?? "")
            .not.toMatch(/scale/);

        // Toggle Minimap (V): hides the minimap, the red-zone timer drops to the corner; V again shows it
        const info = page.locator("#ui-map-info");
        const infoTop = (await info.boundingBox())?.y ?? 0;
        await page.keyboard.press("v");
        await expect.poll(() => rebirth(page, "r.minimap.visible")).toBe(false);
        expect(await rebirth(page, "r.hudToggles.minimapHidden")).toBe(true);
        await expect.poll(async () => (await info.boundingBox())?.y ?? 0).toBeGreaterThan(infoTop + 100);
        await page.screenshot({ path: `${SCREENS}/layout-minimap-hidden.png` });
        // the big map still opens (and V does nothing while it is open)
        await page.keyboard.press("m");
        await expect.poll(() => rebirth(page, "r.minimap.visible")).toBe(true);
        await page.keyboard.press("v");
        await page.keyboard.press("m");
        await expect.poll(() => rebirth(page, "r.minimap.visible")).toBe(false);
        await page.keyboard.press("v");
        await expect.poll(() => rebirth(page, "r.minimap.visible")).toBe(true);
        await expect.poll(async () => (await info.boundingBox())?.y ?? 0).toBeCloseTo(infoTop, 0);

        // bind Hide UI (unbound by default) to H in the in-game menu's Keybinds tab
        await page.keyboard.press("Escape");
        await page.locator("#btn-game-keybinds").click();
        const row = page.locator('#ui-game-tab-keybinds .ui-keybind-container[data-action="34"]');
        await expect(row.locator(".btn-keybind-display")).toHaveText("");
        await row.locator(".btn-keybind-desc").click();
        await page.keyboard.press("h");
        await expect(row.locator(".btn-keybind-display")).toHaveText("H");
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeHidden();

        await page.keyboard.press("h");
        await expect(page.locator("#ui-game")).toBeHidden();
        await expect.poll(() => rebirth(page, "r.minimap.visible")).toBe(false);
        await page.screenshot({ path: `${SCREENS}/layout-hide-ui.png` });
        await page.keyboard.press("h");
        await expect(page.locator("#ui-game")).toBeVisible();
        await expect.poll(() => rebirth(page, "r.minimap.visible")).toBe(true);
        // Escape brings a hidden HUD back (and opens the menu, survev game.ts)
        await page.keyboard.press("h");
        await expect(page.locator("#ui-game")).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game")).toBeVisible();
        await expect(page.locator("#ui-game-menu")).toBeVisible();
        await page.keyboard.press("Escape");
        expect(errors).toEqual([]);
    });

    test("the in-game menu hides the class picker until it is closed", async ({ page }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await bootLoopback(page, "/?map=cobalt&seed=1&loot=0");
        await expect.poll(() => rebirth(page, "r.roleMenu.active")).toBe(true);
        await expect(page.locator("#ui-role-menu-wrapper")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeVisible();
        await expect(page.locator("#ui-role-menu-wrapper")).toBeHidden();
        expect(await rebirth(page, "r.roleMenu.active")).toBe(true);
        expect(await rebirth(page, "r.roleMenu.shown")).toBe(false);
        const left = await rebirth<number>(page, "r.roleMenu.timeLeft");
        await page.waitForTimeout(1200);
        // the countdown keeps running behind the menu
        expect(await rebirth<number>(page, "r.roleMenu.timeLeft")).toBeLessThan(left);
        await page.screenshot({ path: `${SCREENS}/layout-menu-over-class-picker.png` });
        await page.keyboard.press("Escape");
        await expect(page.locator("#ui-game-menu")).toBeHidden();
        await expect(page.locator("#ui-role-menu-wrapper")).toBeVisible();
        expect(await rebirth(page, "r.roleMenu.shown")).toBe(true);
        expect(errors).toEqual([]);
    });
});
