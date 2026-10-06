// M5 client: throwables, explosions, smoke, heals, air strikes, doors, roofs and layers, against the loopback
// simulation. Sandbox options used here: &give=<item,...> (guns and bag items for the local player), &dummies=<n>,
// &loot=0. Screenshots go to __screens__/M5.
import { expect, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";
import { aimAt, equipped, keepLocalAlive, localPos, moveLocalAway, SCREENS } from "./m5-helpers.ts";

test.describe("M5 throwables, explosions, smoke and heals", () => {
    test("frag: cook and throw, the grenade flies with a shadow, explodes and hurts a dummy", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&dummies=1&give=frag");
        await expect.poll(() => equipped(page)).toBe("frag");
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        const target = await page.evaluate((id) => {
            const p = (window as any).__rebirth.game.getPlayer(id).pos;
            return { x: p.x, y: p.y };
        }, dummy);
        // the equipped frag is drawn in the right hand with its pin
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__rebirth.throwableSprites((window as any).__rebirth.player.id)),
            )
            .toMatchObject({ state: "equip", right: true });

        await aimAt(page, target);
        await page.mouse.down();
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.playerAnim((window as any).__rebirth.player.id)))
            .toBe("cook");
        // after the pin is pulled the hand holds the pinless grenade and the other hand the pin
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__rebirth.throwableSprites((window as any).__rebirth.player.id)),
            )
            .toMatchObject({ state: "cook", left: true, right: true });
        await page.waitForTimeout(400);
        await page.mouse.up();
        await page.waitForFunction(() => ((window as any).__rebirth.fx.projectiles?.visible ?? 0) > 0, null, {
            timeout: 5_000,
        });
        // near the top of its arc the grenade is drawn bigger and its shadow lies apart on the ground
        await page.waitForFunction(() => (window as any).__rebirth.fx.projectiles.topZ > 1.2, null, { timeout: 5_000 });
        const proj = await page.evaluate(() => (window as any).__rebirth.fx.projectiles);
        expect(proj.shadows).toBeGreaterThan(0);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("fragPin"))).toBeGreaterThan(0);
        await page.screenshot({ path: `${SCREENS}/grenade-mid-air.png` });

        // step back out of the blast while the fuse burns; the explosion stays in view
        const me = await localPos(page);
        expect(await moveLocalAway(page, target, 15, me)).not.toBeNull();
        // record the camera shake every frame
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.maxShake = 0;
            let frames = 0;
            const tick = () => {
                r.maxShake = Math.max(r.maxShake, r.fx.shake);
                if (frames++ < 600) requestAnimationFrame(tick);
            };
            tick();
        });
        await page.waitForFunction(() => (window as any).__rebirth.fx.explosions > 0, null, { timeout: 8_000 });
        await page.screenshot({ path: `${SCREENS}/explosion.png` });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("explosionBurst"))).toBeGreaterThan(0);
        // the dummy took the blast (and the shrapnel)
        const hit = await page.evaluate((id) => {
            const p = (window as any).__rebirth.game.getPlayer(id);
            return { health: p?.health ?? 0, dead: p?.dead ?? true };
        }, dummy);
        expect(hit.dead || hit.health < 100).toBe(true);
        // the scorch mark decal appears and the camera shook
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => (window as any).__rebirth.maxShake)).toBeGreaterThan(0);
        expect(
            await page.evaluate(() =>
                (window as any).__rebirth.lastSnapshot.objects.some((o: any) => o.type === "decal_frag_explosion"),
            ),
        ).toBe(true);
        await page.screenshot({ path: `${SCREENS}/explosion-after.png` });
        expect(errors).toEqual([]);
    });

    test("smoke: the cloud grows around the dummy, covers players and forces the 1x view inside", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&dummies=1&give=smoke,4xscope");
        await expect.poll(() => equipped(page)).toBe("smoke");
        // the 4x scope widens the view
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.zoom)).toBe(48);
        const dummy = await page.evaluate(() => (window as any).__rebirth.dummies[0] as number);
        const target = await page.evaluate((id) => {
            const p = (window as any).__rebirth.game.getPlayer(id).pos;
            return { x: p.x, y: p.y };
        }, dummy);
        await aimAt(page, target);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.waitForFunction(() => ((window as any).__rebirth.fx.projectiles?.visible ?? 0) > 0, null, {
            timeout: 5_000,
        });
        // the 2.5 s fuse, then the clouds grow
        await page.waitForFunction(() => ((window as any).__rebirth.fx.smokes?.visible ?? 0) >= 3, null, {
            timeout: 10_000,
        });
        await page.waitForTimeout(1500);
        const zoomOutside = await page.evaluate(() => (window as any).__rebirth.fx.cameraZoom);
        await page.screenshot({ path: `${SCREENS}/smoke.png` });
        const cloud = await page.evaluate(() => {
            const s = (window as any).__rebirth.lastSnapshot.smokes as Array<{
                pos: { x: number; y: number };
                rad: number;
            }>;
            return s[0];
        });
        expect(cloud.rad).toBeGreaterThan(1);

        // inside the cloud the camera is forced to the 1x radius
        await page.evaluate((p) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, p);
        }, cloud.pos);
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.zoom), { timeout: 5_000 }).toBe(28);
        // the camera zooms in towards the smaller radius
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.cameraZoom), { timeout: 5_000 })
            .toBeGreaterThan(zoomOutside * 1.2);
        await page.screenshot({ path: `${SCREENS}/smoke-inside.png` });
        expect(errors).toEqual([]);
    });

    test("bandage with 7 after taking damage: the action timer, heal particles, then health rises", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=bandage,soda");
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            g.damagePlayer(g.getPlayer(r.player.id), { amount: 50, damageType: 0, gameSourceType: "", sourceId: 0 });
        });
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.health)).toBeLessThan(51);
        const before = await page.evaluate(() => (window as any).__rebirth.local.health as number);
        await page.keyboard.press("Digit7");
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.action?.type)).toBe("use");
        expect(await page.evaluate(() => (window as any).__rebirth.local.action.item)).toBe("bandage");
        await expect(page.locator("#ui-pie-timer")).toBeVisible();
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Using Bandage");
        await page.waitForTimeout(1200);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("heal_basic"))).toBeGreaterThan(0);
        await page.screenshot({ path: `${SCREENS}/healing.png` });
        // a bandage takes 3 s and heals 15
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.local.health), { timeout: 6_000 })
            .toBeGreaterThan(before + 10);
        await expect(page.locator("#ui-pie-timer")).toBeHidden();

        // hovering an item shows its tooltip; clicking the soda uses it (InputMsg.useItem): boost particles, boost bar
        await page.locator("#ui-loot-soda").hover();
        await expect(page.locator("#ui-loot-soda .tooltip-text")).toBeVisible();
        await expect(page.locator("#ui-loot-soda .tooltip-title")).toHaveText("Soda");
        await expect(page.locator("#ui-loot-soda .tooltip-description")).toContainText(
            "Left-click to boost adrenaline by 25.",
        );
        await page.screenshot({
            path: `${SCREENS}/meds-tooltip.png`,
            clip: { x: 900, y: 100, width: 380, height: 220 },
        });
        await page.locator("#ui-loot-soda").click();
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.action?.item)).toBe("soda");
        await expect(page.locator("#ui-pie-timer .ui-pie-label")).toHaveText("Using Soda");
        // a 3 s use in simulation time: allow for a simulation slowed down by the parallel specs
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.local.boost), { timeout: 15_000 })
            .toBeGreaterThan(0);
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("boost_basic"))).toBeGreaterThan(0);
        await expect(page.locator("#ui-boost-counter")).toHaveCSS("opacity", "1");
        expect(errors).toEqual([]);
    });
});

test.describe("M5 doors, roofs, layers and air strikes", () => {
    test("F opens a house door: the panel swings, the prompt toggles Open / Close", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        // stand next to the first usable house door, on its outer side
        const doorId = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const door = [...g.world.objects.values()].find(
                (o: any) => o.kind === "obstacle" && o.type === "house_door_01" && o.door.canUse && !o.door.locked,
            ) as any;
            const c = door.collider;
            const center = { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
            const thinX = c.max.x - c.min.x < c.max.y - c.min.y;
            g.teleportPlayer(r.player.id, { x: center.x - (thinX ? 1.7 : 0), y: center.y - (thinX ? 0 : 1.7) });
            return door.id as number;
        });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.interaction()?.text ?? ""), { timeout: 10_000 })
            .toBe("Open Door");
        await expect(page.locator("#ui-interaction-press")).toHaveText("F");
        await expect(page.locator("#ui-interaction-description")).toHaveText("Open Door");
        const closed = await page.evaluate((id) => (window as any).__rebirth.doorState(id), doorId);
        expect(closed).not.toBeNull();

        // record the drawn panel rotation every frame while it swings
        await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            r.doorSamples = [];
            const tick = () => {
                r.doorSamples.push(r.doorState(id)?.rot ?? 0);
                if (r.doorSamples.length < 240) requestAnimationFrame(tick);
            };
            tick();
        }, doorId);
        await page.keyboard.press("KeyF");
        // the simulation turns the door at once, the panel follows at the door's open speed
        await expect
            .poll(() =>
                page.evaluate(
                    (id) => (window as any).__rebirth.lastSnapshot.objects.find((o: any) => o.id === id)?.door?.open,
                    doorId,
                ),
            )
            .toBe(true);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.doorState(id).moving, doorId), {
                timeout: 5_000,
            })
            .toBe(false);
        const open = await page.evaluate((id) => (window as any).__rebirth.doorState(id), doorId);
        const turned = Math.abs(Math.atan2(Math.sin(open.rot - closed.rot), Math.cos(open.rot - closed.rot)));
        expect(turned).toBeCloseTo(Math.PI / 2, 2);
        // it was drawn part way open on some frames (animated, not snapped)
        const samples = await page.evaluate(() => (window as any).__rebirth.doorSamples as number[]);
        const between = samples.filter((rot) => {
            const d = Math.abs(Math.atan2(Math.sin(rot - closed.rot), Math.cos(rot - closed.rot)));
            return d > 0.05 && d < Math.PI / 2 - 0.05;
        });
        expect(between.length).toBeGreaterThan(0);
        // the door swung away from the player: step up to the open panel, on the same side
        await page.evaluate((id) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const c = g.world.objects.get(id).collider;
            const me = g.getPlayer(r.player.id).pos;
            const center = { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
            const thinX = c.max.x - c.min.x < c.max.y - c.min.y;
            const a = { x: center.x - (thinX ? 1.7 : 0), y: center.y - (thinX ? 0 : 1.7) };
            const b = { x: center.x + (thinX ? 1.7 : 0), y: center.y + (thinX ? 0 : 1.7) };
            const da = Math.hypot(a.x - me.x, a.y - me.y);
            const db = Math.hypot(b.x - me.x, b.y - me.y);
            g.teleportPlayer(r.player.id, da < db ? a : b);
        }, doorId);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.interaction()?.text ?? ""))
            .toBe("Close Door");
        await page.screenshot({ path: `${SCREENS}/door-open.png` });

        await page.keyboard.press("KeyF");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.interaction()?.text ?? ""))
            .toBe("Open Door");
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.doorState(id).moving, doorId), {
                timeout: 5_000,
            })
            .toBe(false);
        const reclosed = await page.evaluate((id) => (window as any).__rebirth.doorState(id), doorId);
        expect(Math.abs(Math.sin(reclosed.rot - closed.rot))).toBeLessThan(1e-3);
        expect(errors).toEqual([]);
    });

    test("walking down bunker stairs switches to the underground layer and shows the bunker", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        // the Chrysanthemum bunker's entrance (seed 1); start just above its stairs
        const key = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const s = [...g.world.objects.values()].find(
                (o: any) => o.kind === "structure" && o.type === "bunker_structure_08",
            ) as any;
            const st = s.stairs[0];
            const c = st.collision;
            const center = { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
            const d = st.downDir;
            const half = Math.abs(d.x) > 0.5 ? (c.max.x - c.min.x) / 2 : (c.max.y - c.min.y) / 2;
            g.teleportPlayer(r.player.id, { x: center.x - d.x * (half + 1.5), y: center.y - d.y * (half + 1.5) }, 0);
            return d.x > 0.5 ? "KeyD" : d.x < -0.5 ? "KeyA" : d.y > 0.5 ? "KeyW" : "KeyS";
        });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/bunker-entrance.png` });
        expect(await page.evaluate(() => (window as any).__rebirth.local.layer)).toBe(0);
        await page.keyboard.down(key);
        let sawStairs = false;
        await expect
            .poll(
                async () => {
                    const layer = await page.evaluate(() => (window as any).__rebirth.local.layer);
                    if (layer & 2) sawStairs = true;
                    return layer;
                },
                { timeout: 15_000, intervals: [50] },
            )
            .toBe(1);
        await page.keyboard.up(key);
        expect(sawStairs).toBe(true);
        // the ground fades out under the underground fill and the bunker layer fades in
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.layerFade), { timeout: 5_000 })
            .toEqual({ layer: 1, ground: 1 });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.underground)).toBe(true);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCREENS}/bunker-interior.png` });
        // sounds ring in the bunker reverb (the key presses unlocked the audio)
        if (await page.evaluate(() => (window as any).__rebirth.audio.unlocked)) {
            await expect
                .poll(() => page.evaluate(() => (window as any).__rebirth.fx.reverb), { timeout: 10_000 })
                .toBeGreaterThan(0.5);
        }
        expect(errors).toEqual([]);
    });

    test("club: music inside and through the club filter outside, puzzle sounds, the alternate track", async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const club = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const s = [...g.world.objects.values()].find((o: any) => o.type === "club_structure_01") as any;
            const b = g.world.objects.get(s.layerObjIds[0]);
            const z = b.zoomRegions[0].zoomIn;
            const center = { x: (z.min.x + z.max.x) / 2, y: (z.min.y + z.max.y) / 2 };
            g.teleportPlayer(r.player.id, center);
            return { min: z.min, max: z.max, center };
        });
        // any key press unlocks the audio
        await page.keyboard.press("KeyX");
        expect(await page.evaluate(() => (window as any).__rebirth.audio.unlocked)).toBe(true);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.ambience.interior_0?.sound ?? ""), {
                timeout: 20_000,
            })
            .toBe("club_music_01");
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.ambience.interior_0?.volume ?? 0), {
                timeout: 5_000,
            })
            .toBeGreaterThan(0.5);
        // a few units outside the walls only the filtered track is heard, quieter (M9: south of the east entrance, where
        // the original's ceiling ray scan cannot peek inside)
        await page.evaluate((c) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, { x: c.max.x + 4, y: c.center.y - 8 });
        }, club);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.ambience.interior_1?.volume ?? 0), {
                timeout: 10_000,
            })
            .toBeGreaterThan(0.01);
        // once the roof closed again (its vision linger) the unfiltered track is gone
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.ambience.interior_0?.volume ?? 0), {
                timeout: 10_000,
            })
            .toBeLessThan(0.05);
        const outside = await page.evaluate(() => (window as any).__rebirth.fx.ambience);
        expect(outside.interior_1.sound).toBe("club_music_01");
        expect(outside.interior_1.volume).toBeLessThan(0.3);

        // a failed attempt at the club's puzzle (errSeq) and its completion play the puzzle sounds
        const clubId = await page.evaluate(() => {
            const g = (window as any).__rebirth.game;
            const b = [...g.world.objects.values()].find((o: any) => o.type === "club_01") as any;
            b.puzzle.errSeq++;
            return b.id as number;
        });
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.buildingState(id)?.puzzleFails, clubId))
            .toBe(1);
        await page.evaluate((id) => {
            (window as any).__rebirth.game.world.objects.get(id).puzzle.solved = true;
        }, clubId);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.buildingState(id)?.puzzleSolves, clubId))
            .toBe(1);
        // the bathhouse switch (interiorSoundAlt) crossfades the club to its second track
        await page.evaluate(() => {
            const g = (window as any).__rebirth.game;
            const s = [...g.world.objects.values()].find((o: any) => o.type === "club_structure_01") as any;
            s.interiorSoundAlt = true;
        });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.ambience.interior_1?.sound ?? ""), {
                timeout: 20_000,
            })
            .toBe("club_music_02");
        expect(errors).toEqual([]);
    });

    test("breaking a shack's walls collapses its roof", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const shack = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const b = [...g.world.objects.values()].find(
                (o: any) => o.kind === "building" && o.type === "shack_01",
            ) as any;
            // stand a few units south of it, on free ground
            for (let d = 9; d < 20; d += 0.5) {
                for (const dx of [0, 3, -3, 6, -6]) {
                    const p = { x: b.pos.x + dx, y: b.pos.y - d };
                    if (g.canPlayerSpawn(p)) {
                        g.teleportPlayer(r.player.id, p);
                        return { id: b.id as number, pos: { x: b.pos.x, y: b.pos.y } };
                    }
                }
            }
            return null;
        });
        expect(shack).not.toBeNull();
        if (!shack) return;
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.buildingState(id)?.ceilingAlpha, shack.id))
            .toBe(1);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCREENS}/roof-before.png` });
        await page.evaluate((id) => {
            const g = (window as any).__rebirth.game;
            const b = g.world.objects.get(id);
            for (const childId of b.childIds) {
                const o = g.world.objects.get(childId);
                if (o?.kind === "obstacle" && o.def.isWall && o.def.destructible) {
                    g.damageObstacle(o, { amount: 10_000, damageType: 0, gameSourceType: "", sourceId: 0 });
                }
            }
        }, shack.id);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.buildingState(id)?.collapses, shack.id))
            .toBe(1);
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${SCREENS}/roof-collapse.png` });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("shackBreak"))).toBeGreaterThan(0);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.buildingState(id)?.ceilingAlpha, shack.id), {
                timeout: 5_000,
            })
            .toBe(0);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${SCREENS}/roof-gone.png` });
        expect(errors).toEqual([]);
    });

    test("a forced air strike zone: the minimap circle, planes, falling bombs and explosions", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0&give=4xscope");
        const stopKeepAlive = await keepLocalAlive(page);
        const zone = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const g = r.game;
            const p = g.getPlayer(r.player.id).pos;
            const pos = { x: p.x + 22, y: p.y + 6 };
            g.planes.zones.addZone(pos, 10, 3, 1, 1.2);
            return pos;
        });
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones.length), { timeout: 5_000 })
            .toBe(1);
        await expect
            .poll(() => page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones[0].alpha), { timeout: 5_000 })
            .toBeGreaterThan(0.9);
        const rect = await page.evaluate(() => (window as any).__rebirth.minimap.rect);
        await page.screenshot({
            path: `${SCREENS}/airstrike-minimap.png`,
            clip: { x: 0, y: rect.y - 10, width: rect.x + rect.width + 16, height: rect.height + 20 },
        });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.airstrikeZones[0].pos)).toEqual(zone);
        // the planes fly in and drop their bombs, which explode on the ground
        await page.waitForFunction(() => (window as any).__rebirth.fx.explosions > 0, null, { timeout: 20_000 });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${SCREENS}/airstrike.png` });
        expect(await page.evaluate(() => (window as any).__rebirth.fx.particles("explosionBomb"))).toBeGreaterThan(0);
        await page.waitForFunction(() => (window as any).__rebirth.fx.explosions >= 10, null, { timeout: 20_000 });
        await stopKeepAlive();
        expect(errors).toEqual([]);
    });
});
