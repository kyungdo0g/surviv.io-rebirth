// The owner's new guns (beta, 2026-10-07) in the loopback sandbox: one gun per class from ?give=<gun> is held as a
// plain bar sized by its barrel, or by its own top-down sprite once one is drawn (packages/defs rebirth/heldGunArt.ts;
// tests/e2e/topdown-guns.spec.ts checks those in detail), fires at a dummy, and every body hit deals the balance sheet's
// damage (docs/design/new-gun-stats.json; the falloff over the distance the bullet travelled, as the sim applies it).
// The RPG-7's rocket hits for its direct damage, then explodes, trailing and puffing smoke; the Boys AT rifle fires its
// 7 rounds and is discarded (the slot empties, the discard sound plays); the DShK slows its carrier. Also: the owner's
// loot icons on the ground (cut from the line-art sheets by tools/assets/newGuns.ts), the new ammo's HUD rows, the
// Korean names, the kill feed, the new ammo's ping emotes, and the beta switch (?beta=1, the server's GUN_BETA) putting
// every beta gun on the floor.
// No screenshot may show the missing-sprite placeholder (magenta and black squares).
// Hooks: window.__rebirth.game (the sandbox Game: rules, observer, players, loot), .audio, .fx, .missingSprites.
// Screenshots: __screens__/new-guns-beta.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { HELD_GUN_ART, type HeldGunArtId } from "../../packages/defs/src/rebirth/heldGunArt.ts";
import { decodePng } from "../../tools/assets/png.ts";
import { boot, collectErrors, killFeed } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/new-guns-beta";
const SHEET = JSON.parse(readFileSync("docs/design/new-gun-stats.json", "utf8"));

/** The sheet's damage of a gun's bullet (a shared bullet, the DP-12's buckshot: survev's 12.5 per pellet). */
function sheetDamage(gun: string): number {
    const g = SHEET.guns[gun];
    return g.bullets[g.gun.bulletType]?.damage ?? (g.gun.bulletType === "bullet_buckshot" ? 12.5 : Number.NaN);
}

/** One gun per class (the Boys and the DShK have their own tests below). */
const SAMPLE: ReadonlyArray<{ gun: string; name: string; hits: number }> = [
    { gun: "ak74", name: "AK-74", hits: 3 },
    { gun: "fal", name: "FN FAL", hits: 2 },
    { gun: "tec9", name: "TEC-9", hits: 3 },
    { gun: "p90", name: "P90", hits: 3 },
    { gun: "dp12", name: "DP-12", hits: 9 },
    { gun: "m200", name: "M200 Intervention", hits: 1 },
    { gun: "mg42", name: "MG 42", hits: 3 },
];

interface Hit {
    amount: number;
    headshot: boolean;
    source: string;
    explosion: boolean;
    bulletDamage?: number;
    expected?: number;
}

/** Turns headshots off and records every hit on the dummy, keeping it alive (observer hooks only read the game). */
async function recordHits(page: Page, dummy: number): Promise<void> {
    await page.evaluate((dummy) => {
        const r = (window as any).__rebirth;
        const g = r.game;
        g.rules.headshotChance = 0;
        r.hits_new = [] as Hit[];
        const pending: Array<{ bulletDamage: number; expected: number }> = [];
        const obs = g.observer ?? {};
        const onBullet = obs.onBulletHitPlayer?.bind(obs);
        const onDamaged = obs.onPlayerDamaged?.bind(obs);
        obs.onBulletHitPlayer = (b: any, target: any) => {
            // shrapnel hits count as explosion damage (the sim's isExplosion)
            if (target.id === dummy && !b.def.shrapnel) {
                const t = Math.min(Math.max(b.distanceTraveled / b.distance, 0), 1);
                const base = b.damage / (b.reflectCount + 1);
                pending.push({ bulletDamage: b.def.damage, expected: base * (1 + (b.def.falloff - 1) * t) });
            }
            onBullet?.(b, target);
        };
        obs.onPlayerDamaged = (target: any, params: any, amount: number, headshot: boolean) => {
            if (target.id === dummy) {
                const explosion = params.isExplosion === true;
                const bullet = explosion ? undefined : pending.shift();
                r.hits_new.push({ amount, headshot, source: params.gameSourceType ?? "", explosion, ...bullet });
                target.health = 100;
            }
            onDamaged?.(target, params, amount, headshot);
        };
        g.observer = obs;
    }, dummy);
}

async function hits(page: Page): Promise<Hit[]> {
    return page.evaluate(() => (window as any).__rebirth.hits_new as Hit[]);
}

/** Records the names of the sounds the client asks for (the engine plays them once the audio is unlocked). */
async function recordSounds(page: Page): Promise<void> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.soundLog = [] as string[];
        const audio = r.client.audio;
        const play = audio.playSound.bind(audio);
        audio.playSound = (name: string, opts: unknown) => {
            if (name) r.soundLog.push(name);
            return play(name, opts);
        };
    });
}

async function sounds(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__rebirth.soundLog as string[]);
}

/** Aims at the dummy (re-aiming while the camera settles) until the local player faces it. */
async function aimAt(page: Page, dummy: number): Promise<void> {
    const deadline = Date.now() + 10_000;
    for (;;) {
        const target = await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            return r.worldToScreen(r.visualPos(id));
        }, dummy);
        await page.mouse.move(target.x, target.y);
        await page.waitForTimeout(100);
        const facing = await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const d = r.game.getPlayer(id);
            const dx = d.pos.x - me.pos.x;
            const dy = d.pos.y - me.pos.y;
            return (me.dir.x * dx + me.dir.y * dy) / Math.hypot(dx, dy);
        }, dummy);
        if (facing > 0.998) return;
        expect(Date.now(), `not facing the dummy (cos ${facing})`).toBeLessThan(deadline);
    }
}

/** Boots the sandbox with `give`, one dummy in front; returns the dummy's id. */
async function sandbox(page: Page, give: string, extra = ""): Promise<number> {
    await boot(page, `/?sandbox=1&map=main&seed=1&loot=0&give=${give}&dummies=1${extra}`);
    const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
    expect(dummy).toBeGreaterThan(0);
    return dummy;
}

/** Clicks (holding each press `hold` ms) until `n` bullet hits on the dummy are recorded. */
async function fireUntil(page: Page, n: number, hold = 200, gap = 400): Promise<void> {
    const deadline = Date.now() + 25_000;
    while ((await hits(page)).filter((h) => !h.explosion).length < n) {
        expect(Date.now(), `fewer than ${n} hits on the dummy`).toBeLessThan(deadline);
        await page.mouse.down();
        await page.waitForTimeout(hold);
        await page.mouse.up();
        await page.waitForTimeout(gap);
    }
}

/** Pixels of the missing-sprite placeholder's magenta (#ff00ff) in a screenshot. */
function magentaPixels(png: Buffer): number {
    const img = decodePng(png);
    let n = 0;
    for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i]! > 230 && img.data[i + 1]! < 40 && img.data[i + 2]! > 230) n++;
    }
    return n;
}

/** Screenshot to __screens__ that must not show a placeholder. */
async function shot(page: Page, name: string): Promise<void> {
    const png = await page.screenshot({ path: `${SCREENS}/${name}.png` });
    expect(magentaPixels(png), `${name}: placeholder pixels`).toBeLessThan(20);
}

/** Sprites that failed to load, and new-gun icons drawn from their fallback. */
async function spriteTrouble(page: Page): Promise<{ missing: string[]; fallbacks: string[] }> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        return { missing: [...(r.missingSprites ?? [])], fallbacks: [...(r.spriteFallbacks ?? [])] };
    });
}

/** The local player's held gun as drawn: its sprite and length in sprite pixels (objects/heldGun.ts). */
async function heldGun(page: Page): Promise<{ texture: string; height: number } | null> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        return r.heldGun(r.player.id) as { texture: string; height: number } | null;
    });
}

test.describe("new guns (beta) in the sandbox", () => {
    for (const s of SAMPLE) {
        test(`${s.gun}: held (bar or own sprite), named, each body hit deals the sheet's ${sheetDamage(s.gun)}`, async ({
            page,
        }) => {
            const errors = collectErrors(page);
            const dummy = await sandbox(page, s.gun, "&zoom=14");
            expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[0].type)).toBe(s.gun);
            await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText(s.name);
            // a drawn gun: its own top-down sprite at 0.25 x its logical height (give or take the raster's whole
            // texels); else a plain bar (an original bar sprite, never the placeholder), 11-15 sprite px per unit of
            // barrel
            const drawn: readonly [number, number] | undefined = HELD_GUN_ART[s.gun as HeldGunArtId];
            await expect
                .poll(async () => (await heldGun(page))?.texture, { timeout: 5_000 })
                .toMatch(drawn ? `gun-${s.gun}-01.img` : /^gun-(short|med|long)-01\.img$/);
            const held = (await heldGun(page))!;
            if (drawn) {
                expect(held.height, s.gun).toBeCloseTo(drawn[1] * 0.25, 0);
            } else {
                const perUnit = held.height / SHEET.guns[s.gun].gun.barrelLength;
                expect(perUnit, s.gun).toBeGreaterThan(10.5);
                expect(perUnit, s.gun).toBeLessThan(15);
            }
            await recordHits(page, dummy);
            await recordSounds(page);
            await aimAt(page, dummy);
            await fireUntil(page, s.hits);
            await page.waitForTimeout(300);
            await shot(page, `${s.gun}-firing`);
            const damage = sheetDamage(s.gun);
            const bulletHits = (await hits(page)).filter((h) => h.bulletDamage !== undefined);
            expect(bulletHits.length).toBeGreaterThanOrEqual(s.hits);
            for (const h of bulletHits) {
                expect(h.headshot).toBe(false);
                expect(h.source).toBe(s.gun);
                expect(h.bulletDamage, `${s.gun} bullet damage (new-gun-stats.json)`).toBe(damage);
                // a hit is capped at the dummy's 100 health (the M200's 115)
                expect(h.amount).toBeCloseTo(Math.min(100, h.expected!), 6);
            }
            console.log(`${s.gun}: sheet ${damage}, hits ${bulletHits.map((h) => h.amount.toFixed(3)).join(", ")}`);
            // the gun's own fire sound was asked for (the owner's clip, installed by tools/assets/newGuns.ts)
            expect(await sounds(page)).toContain(SHEET.guns[s.gun].gun.sound.shoot);
            expect((await spriteTrouble(page)).missing).toEqual([]);
            expect(errors).toEqual([]);
        });
    }

    test("RPG-7: the rocket hits for 60, explodes, trails smoke; the brown rocket row and Korean name", async ({
        page,
    }) => {
        const errors = collectErrors(page);
        const dummy = await sandbox(page, "rpg7", "&lang=ko&zoom=20");
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("RPG-7");
        // a full level 0 bag of rockets (the sheet's 4) in a brown HUD row
        expect(await page.evaluate(() => (window as any).__rebirth.local.inventory.rocket)).toBe(4);
        await expect(page.locator("#ui-loot-rocket")).toBeVisible();
        await expect(page.locator("#ui-loot-rocket .ui-loot-overlay")).toHaveCSS(
            "background-color",
            "rgba(139, 69, 19, 0.75)",
        );
        // the dummy 16 u away: past the arming distance (5 u) and the blast's reach of the shooter (14 u)
        await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            const d = r.game.getPlayer(id);
            const dx = d.pos.x - me.pos.x;
            const dy = d.pos.y - me.pos.y;
            const len = Math.hypot(dx, dy);
            r.game.teleportPlayer(id, { x: me.pos.x + (dx / len) * 16, y: me.pos.y + (dy / len) * 16 });
        }, dummy);
        await page.waitForTimeout(300);
        await recordHits(page, dummy);
        await aimAt(page, dummy);
        const smokeBefore = await page.evaluate(() => (window as any).__rebirth.fx.particles("airdropSmoke"));
        const explosionsBefore = await page.evaluate(() => (window as any).__rebirth.fx.explosions);
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.mouse.up();
        await page.waitForTimeout(80);
        await shot(page, "rpg7-launch");
        await expect.poll(async () => (await hits(page)).length, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
        await page.waitForTimeout(150);
        await shot(page, "rpg7-explosion");
        const got = await hits(page);
        const direct = got.filter((h) => !h.explosion);
        const blast = got.filter((h) => h.explosion);
        expect(direct.map((h) => h.bulletDamage)).toEqual([sheetDamage("rpg7")]);
        expect(direct[0]!.amount).toBeCloseTo(60, 6);
        // the dummy is inside the blast's full-damage radius (6 u): 150, capped at its 100 health (then shrapnel)
        expect(blast.length).toBeGreaterThanOrEqual(1);
        expect(blast[0]!.amount).toBeCloseTo(100, 6);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.explosions)).toBeGreaterThan(explosionsBefore);
        // muzzle puffs, the back-blast and the trail (airdropSmoke puffs; fx/newGunFx.ts)
        const smoke = (await page.evaluate(() => (window as any).__rebirth.fx.particles("airdropSmoke"))) - smokeBefore;
        expect(smoke).toBeGreaterThan(10);
        // the shooter, 16 u from the blast, is out of its reach (14 u); a stray shrapnel piece may still hit it
        expect(await page.evaluate(() => (window as any).__rebirth.local.health)).toBeGreaterThan(70);
        expect((await spriteTrouble(page)).missing).toEqual([]);
        expect(errors).toEqual([]);
    });

    test("Boys AT rifle: 7 rounds of 96, no reload, then discarded: the slot empties and the AK-74 is drawn", async ({
        page,
    }) => {
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        const dummy = await sandbox(page, "boys,ak74", "&lang=ko&zoom=14");
        await expect(page.locator("#ui-weapon-id-1 .ui-weapon-name")).toHaveText("보이스 대전차 소총");
        expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo)).toBe(7);
        await recordHits(page, dummy);
        await recordSounds(page);
        await aimAt(page, dummy);
        await shot(page, "boys-held");
        // R does nothing: no reload, no reserve
        await page.keyboard.press("KeyR");
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => (window as any).__rebirth.local.weapons[0].ammo)).toBe(7);
        for (let fired = 0; fired < 7; ) {
            await page.mouse.down();
            await page.waitForTimeout(120);
            await page.mouse.up();
            await page.waitForTimeout(1500);
            const ammo = await page.evaluate(() => (window as any).__rebirth.local.weapons[0]?.ammo ?? 0);
            const type = await page.evaluate(() => (window as any).__rebirth.local.weapons[0]?.type ?? "");
            fired = type === "boys" ? 7 - ammo : 7;
        }
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.local.weapons[0].type), { timeout: 5_000 })
            .toBe("");
        await expect(page.locator("#ui-weapon-id-1")).toHaveClass(/ui-weapon-empty/);
        expect(await page.evaluate(() => (window as any).__rebirth.local.curWeapIdx)).toBe(1);
        await page.waitForTimeout(400);
        await shot(page, "boys-discarded");
        const bulletHits = (await hits(page)).filter((h) => h.bulletDamage !== undefined);
        expect(bulletHits.length).toBe(7);
        for (const h of bulletHits) {
            expect(h.bulletDamage).toBe(sheetDamage("boys"));
            expect(h.amount).toBeCloseTo(Math.min(100, h.expected!), 6);
        }
        const log = await sounds(page);
        expect(log.filter((n) => n === "boys_01")).toHaveLength(7);
        expect(log).toContain("boys_discard_01");
        expect(log).not.toContain("boys_pull_01");
        // nothing was dropped
        expect(await page.evaluate(() => [...(window as any).__rebirth.game.loot.items.values()].length)).toBe(0);
        expect(errors).toEqual([]);
    });

    test("DShK: 9 u/s held, 11 with the fists out, 13 (the fists' own +1) once it is gone", async ({ page }) => {
        const errors = collectErrors(page);
        await sandbox(page, "dshk", "&zoom=14");
        const speed = () =>
            page.evaluate(() => {
                const r = (window as any).__rebirth;
                return r.game.getPlayer(r.player.id).computeSpeed(r.game.world) as number;
            });
        expect(await speed()).toBe(9);
        await shot(page, "dshk-held");
        // the client walks at the sim's speed: measured in sim time while walking towards the dummy (open ground, 8 u
        // to the right), then walking back as long
        const walk = async () => {
            const sample = () =>
                page.evaluate(() => {
                    const r = (window as any).__rebirth;
                    return { ...r.game.getPlayer(r.player.id).pos, t: r.game.time as number };
                });
            const until = (t: number) =>
                page.waitForFunction((t) => (window as any).__rebirth.game.time >= t, t, { timeout: 10_000 });
            const start = await sample();
            await page.keyboard.down("KeyD");
            await until(start.t + 0.1);
            const a = await sample();
            await until(a.t + 0.2);
            const b = await sample();
            await page.keyboard.up("KeyD");
            const end = await sample();
            await page.keyboard.down("KeyA");
            await until(end.t + (end.t - start.t));
            await page.keyboard.up("KeyA");
            await page.waitForTimeout(200);
            return Math.hypot(b.x - a.x, b.y - a.y) / (b.t - a.t);
        };
        const held = await walk();
        await page.keyboard.press("Digit3");
        await expect.poll(speed, { timeout: 5_000 }).toBe(11);
        const fists = await walk();
        console.log(`DShK: walked ${held.toFixed(2)} u/s held, ${fists.toFixed(2)} u/s with the fists out`);
        expect(held).toBeCloseTo(9, 0);
        expect(fists).toBeCloseTo(11, 0);
        // without it: the move speed 12 and the fists' +1
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).weaponManager.setWeapon(0, "", 0);
        });
        expect(await speed()).toBe(13);
        expect(errors).toEqual([]);
    });

    test("loot icons on the ground, ammo rows, the kill feed; ?beta=1 puts the beta guns on the floor", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        const dummy = await sandbox(page, "p90,ak74", "&zoom=18");
        // the pink 5.7x28 row of the P90 (shown while carried)
        await expect(page.locator("#ui-loot-57mm")).toBeVisible();
        await expect(page.locator("#ui-loot-57mm .ui-loot-overlay")).toHaveCSS(
            "background-color",
            "rgba(255, 95, 180, 0.75)",
        );
        await expect(page.locator("#ui-loot-40mm")).toHaveCount(0);
        const all = Object.keys(SHEET.guns) as string[];
        await page.evaluate((guns) => {
            const r = (window as any).__rebirth;
            const p = r.player.pos;
            guns.forEach((type: string, i: number) => {
                const ring = i < 16 ? 7 : 11;
                const k = i < 16 ? i / 16 : (i - 16) / (guns.length - 16);
                const a = k * Math.PI * 2;
                r.game.loot.addLoot(type, { x: p.x + Math.cos(a) * ring, y: p.y + Math.sin(a) * ring }, 0, 1, {
                    pushSpeed: 0,
                    noSideAmmo: true,
                });
            });
        }, all);
        await page.waitForFunction(
            (n) =>
                ((window as any).__rebirth.lastSnapshot?.objects ?? []).filter((o: any) => o.kind === "loot").length >=
                n,
            all.length,
            { timeout: 10_000 },
        );
        await page.waitForTimeout(1200);
        await shot(page, "loot-icons");
        const trouble = await spriteTrouble(page);
        expect(trouble.missing).toEqual([]);
        // every icon is installed (the owner's cut, or the M79's copy of its fallback): none loaded its fallback
        expect(trouble.fallbacks).toEqual([]);
        // the new ammo's ping emotes pop over the player with their own drawn icons (no fallback, no placeholder)
        const ammoEmotes = ["emote_ammo40mm", "emote_ammorocket", "emote_ammo57mm"];
        await page.evaluate((types) => {
            const r = (window as any).__rebirth;
            for (const type of types) r.game.emote(r.player.id, { type, isPing: false });
        }, ammoEmotes);
        await page.waitForFunction(
            (types) => {
                const r = (window as any).__rebirth;
                const got = new Set(r.emotes.received.filter((e: any) => !e.isPing).map((e: any) => e.type));
                return types.every((t: string) => got.has(t));
            },
            ammoEmotes,
            { timeout: 5_000 },
        );
        await page.waitForTimeout(600);
        await shot(page, "ammo-emotes");
        const emoteTrouble = await spriteTrouble(page);
        expect(emoteTrouble.missing).toEqual([]);
        expect(emoteTrouble.fallbacks).toEqual([]);
        // the AK-74 kills the dummy: the kill feed names it
        await page.keyboard.press("Digit2");
        await aimAt(page, dummy);
        await page.evaluate((id) => {
            (window as any).__rebirth.game.getPlayer(id).health = 20;
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
            .toEqual(expect.arrayContaining([expect.stringContaining("AK-74")]));
        await shot(page, "killfeed");
        expect(errors).toEqual([]);

        // the beta switch: the map's floor holds the new and the survev-only guns
        const floorGuns = async (beta: string) => {
            await boot(page, `/?sandbox=1&map=main&seed=2${beta}`);
            return page.evaluate(() => {
                const r = (window as any).__rebirth;
                const types = [...r.game.loot.items.values()].map((l: any) => l.type as string);
                return { types, gunBeta: r.game.rules.gunBeta as boolean };
            });
        };
        const betaIds = [
            ...Object.keys(SHEET.guns).filter((id) => !id.endsWith("_dual")),
            ...["barrett", "ash12", "sw500", "imbel", "spas16"],
        ];
        const on = await floorGuns("&beta=1");
        expect(on.gunBeta).toBe(true);
        const onFound = new Set(on.types.filter((t) => betaIds.includes(t)));
        const off = await floorGuns("");
        expect(off.gunBeta).toBe(false);
        const offCount = off.types.filter((t) => betaIds.includes(t)).length;
        const onCount = on.types.filter((t) => betaIds.includes(t)).length;
        console.log(
            `floor beta guns: ${onCount} with ?beta=1 (${onFound.size} kinds: ${[...onFound]}), ${offCount} without`,
        );
        expect(onCount).toBeGreaterThan(offCount + 10);
        // every beta gun lies on the floor (each at least twice), the Barrett included
        expect(betaIds.filter((id) => !onFound.has(id))).toEqual([]);
        for (const id of betaIds) expect(on.types.filter((t) => t === id).length, id).toBeGreaterThanOrEqual(2);
    });
});
