// The rebirth buildings (packages/defs rebirth/buildings.ts, the owner's requests 2026-10-08) in the building showcase:
// the clinic, fire station, library and radio station (main), the faction command posts, arsenal and blockhouses (50v50)
// draw their own floor and roof (committed SVGs, no missing sprite), the roof hides once the player is inside, the
// clinic's treatment rooms heal and show it, each post holds its faction's crate; every hidden room from inside (the
// rework of 2026-10-10: the clinic's safe, the posts' armories, the cage, the rare-books room, the signals vault, the
// magazines, the war chest, the gatehouse and armory cages, the HQ archive, the infirmary store, the vault); the military bases (main and both 50v50 factions) from above,
// on the ground, in the infirmary's wards and in the basement. Hooks: window.__rebirth (showcase, game, player, missingSprites). Screenshots: __screens__/rebirth-buildings.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/rebirth-buildings";

/** Teleports the local player to the building's local point (x, y), turned by the building's ori, on `layer`. */
async function standAt(page: Page, type: string, x: number, y: number, layer = 0): Promise<void> {
    await page.evaluate(
        ({ type, x, y, layer }) => {
            const r = (window as any).__rebirth;
            const game = r.game;
            const root = game.generation.objects.find((o: any) => o.parentId === 0 && o.type === type);
            const ori = ((root.ori % 4) + 4) % 4;
            const rot = [
                [x, y],
                [-y, x],
                [-x, -y],
                [y, -x],
            ][ori];
            game.teleportPlayer(r.player.id, { x: root.pos.x + rot[0], y: root.pos.y + rot[1] }, layer);
        },
        { type, x, y, layer },
    );
}

async function missing(page: Page): Promise<string[]> {
    return page.evaluate(() => [...((window as any).__rebirth.missingSprites ?? [])].map(String));
}

test.describe("rebirth buildings", () => {
    test("the clinic: its roof outside, its rooms inside, the treatment rooms heal", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?building=clinic_01&seed=1");
        expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("main");
        await standAt(page, "clinic_01", 0, -16);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/clinic-outside.png` });
        await standAt(page, "clinic_01", 0, -4);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/clinic-inside.png` });

        // a treatment room: 2 HP/s
        await standAt(page, "clinic_01", -9, 4.5);
        const before = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const me = r.game.getPlayer(r.player.id);
            me.health = 50;
            return me.health as number;
        });
        await page.waitForTimeout(2500);
        const after = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            return r.game.getPlayer(r.player.id).health as number;
        });
        expect(after).toBeGreaterThan(before + 2);
        await page.screenshot({ path: `${SCREENS}/clinic-ward.png` });
        // the treatment rooms show that they heal: glow, rising crosses and ring pulses (healRegionFx.ts)
        const healFx = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const clinic = r.game.generation.objects.find((o: any) => o.type === "clinic_01");
            return r.buildingState(clinic.id)?.healFx as number;
        });
        expect(healFx).toBeGreaterThan(3);
        await standAt(page, "clinic_01", 0, -3);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SCREENS}/clinic-wards-from-lobby.png` });
        // the drug safe (its door opens on the switch behind the reception desk)
        await standAt(page, "clinic_01", 13, 5.5);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${SCREENS}/clinic-safe.png` });
        expect((await missing(page)).filter((s) => s.includes("clinic"))).toEqual([]);
        expect(errors).toEqual([]);
    });

    for (const [type, crate] of [
        ["outpost_01r", "crate_02f"],
        ["outpost_01b", "crate_22"],
    ] as const) {
        test(`the ${type} command post: faction roof, armory with its faction crate`, async ({ page }) => {
            test.setTimeout(120_000);
            const errors = collectErrors(page);
            await boot(page, `/?building=${type}&seed=1`);
            expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("faction");
            const crates = await page.evaluate(
                (crate) =>
                    (window as any).__rebirth.game.generation.objects.filter((o: any) => o.type === crate).length,
                crate,
            );
            expect(crates).toBe(1);
            await standAt(page, type, 0, -15);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-outside.png` });
            await standAt(page, type, -3, -4);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-inside.png` });
            // the armory behind its bars
            await standAt(page, type, -7, 5.5);
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${SCREENS}/${type}-armory.png` });
            expect((await missing(page)).filter((s) => s.includes("outpost"))).toEqual([]);
            expect(errors).toEqual([]);
        });
    }

    // the second wave (the owner, 2026-10-08: "more buildings, the maps get bigger"): [type, map, sprite name, a
    // spot outside, a spot inside, a spot in its hidden room, the camera zoom for the roof shot]
    for (const [type, map, art, outside, inside, hidden, zoom] of [
        ["firestation_01", "main", "firestation", [-7.5, -20], [-8, 0], [-1.5, 7], 34],
        ["library_01", "main", "library", [1, -18], [0, 5], [14.88, -7], 32],
        ["radio_station_01", "main", "radio", [0, -15], [0, 3], [0.5, 7.5], 28],
        ["arsenal_01", "faction", "arsenal", [0, -17], [-11.5, 0], [0, 0], 30],
        ["blockhouse_01r", "faction", "blockhouse", [0, -16], [0, 6], [0.42, 0.62], 24],
        ["blockhouse_01b", "faction", "blockhouse", [0, -16], [0, 6], [0.42, 0.62], 24],
    ] as const) {
        test(`${type}: its own roof outside, its rooms inside`, async ({ page }) => {
            test.setTimeout(120_000);
            const errors = collectErrors(page);
            await boot(page, `/?building=${type}&seed=1&zoom=${zoom}`);
            expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe(map);
            await standAt(page, type, outside[0], outside[1]);
            // the camera on the building, not the player, for the whole roof (window.__rebirth.cameraAt)
            await page.evaluate((type) => {
                const r = (window as any).__rebirth;
                const root = r.game.generation.objects.find((o: any) => o.parentId === 0 && o.type === type);
                r.cameraAt = { x: root.pos.x, y: root.pos.y };
            }, type);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-outside.png` });
            await page.evaluate(() => {
                (window as any).__rebirth.cameraAt = undefined;
            });
            await standAt(page, type, inside[0], inside[1]);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-inside.png` });
            await standAt(page, type, hidden[0], hidden[1]);
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${SCREENS}/${type}-hidden.png` });
            expect((await missing(page)).filter((s) => s.includes(art))).toEqual([]);
            expect(errors).toEqual([]);
        });
    }

    /**
     * The camera on the structure (window.__rebirth.cameraAt) for a shot of the whole base, then back on the player;
     * the player holds a 15x scope meanwhile (the simulation streams only what is in the player's view).
     */
    async function aerial(page: Page, type: string, path: string): Promise<void> {
        await page.evaluate((type) => {
            const r = (window as any).__rebirth;
            const root = r.game.generation.objects.find((o: any) => o.parentId === 0 && o.type === type);
            r.game.getPlayer(r.player.id).scope = "15xscope";
            r.cameraAt = { x: root.pos.x, y: root.pos.y };
        }, type);
        await page.waitForTimeout(2500);
        await page.screenshot({ path });
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).scope = "1xscope";
            r.cameraAt = undefined;
        });
    }

    // the military base (the owner, 2026-10-08: "군부대는 둘다 있음 연병장 의무실 차고 병기고 본부 창고 이렇게 있게 또 지하실도
    // 좀 규모가 크게"): the compound from above, the parade ground, the HQ inside, the infirmary's wards healing, and the
    // basement's Command, checkpoint and vault, motor pool and sapper tunnel (layer 1)
    test("military_base_01: the compound from above, its buildings, the wards and the basement", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        const type = "military_base_01";
        await boot(page, `/?building=${type}&seed=1&zoom=86`);
        expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("main");
        await standAt(page, type, 0, -15);
        await aerial(page, type, `${SCREENS}/${type}-aerial.png`);
        for (const [name, x, y, layer] of [
            ["parade", 0, -20, 0],
            ["hq", 0, 33, 0],
            ["command", 0, 17, 1],
            ["checkpoint", -2.5, -1, 1],
            ["motorpool", 25, -10, 1],
            ["tunnel", -30, -34, 1],
        ] as const) {
            await standAt(page, type, x, y, layer);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-${name}.png` });
        }
        // a ward heals 2 HP/s and shows it (the clinic's heal effect)
        await standAt(page, type, -37.5, 22);
        await page.evaluate(() => {
            const r = (window as any).__rebirth;
            r.game.getPlayer(r.player.id).health = 50;
        });
        await page.waitForTimeout(2500);
        const ward = await page.evaluate(() => {
            const r = (window as any).__rebirth;
            const infirmary = r.game.generation.objects.find((o: any) => o.type === "military_infirmary_01");
            return {
                health: r.game.getPlayer(r.player.id).health as number,
                healFx: r.buildingState(infirmary.id)?.healFx as number,
            };
        });
        // 2 HP/s (the sim steps slower than real time on a loaded machine)
        expect(ward.health).toBeGreaterThan(51);
        expect(ward.healFx).toBeGreaterThan(3);
        await page.screenshot({ path: `${SCREENS}/${type}-ward.png` });
        // the hidden rooms: the war chest, the vault, the gatehouse's and the armory's cages, the HQ archive, the infirmary store
        for (const [name, x, y, layer] of [
            ["war-chest", 0, 14.75, 1],
            ["vault", 0, -13, 1],
            ["gatehouse-cage", 14.63, -37, 0],
            ["hq-archive", 11, 33, 0],
            ["armory-cage", 36, 32.5, 0],
            ["infirmary-store", -25, 32, 0],
        ] as const) {
            await standAt(page, type, x, y, layer);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-${name}.png` });
        }
        expect((await missing(page)).filter((s) => s.includes("milbase"))).toEqual([]);
        expect(errors).toEqual([]);
    });

    for (const type of ["military_base_01r", "military_base_01b"]) {
        test(`${type}: the faction's emblem, HQ roof and flags`, async ({ page }) => {
            test.setTimeout(120_000);
            const errors = collectErrors(page);
            await boot(page, `/?building=${type}&seed=1&zoom=86`);
            expect(await page.evaluate(() => (window as any).__rebirth.showcase.mapName)).toBe("faction");
            await standAt(page, type, 0, -15);
            await aerial(page, type, `${SCREENS}/${type}-aerial.png`);
            expect((await missing(page)).filter((s) => s.includes("milbase"))).toEqual([]);
            expect(errors).toEqual([]);
        });
    }
    // the mall's keypad (the owner's design, 2026-10-11): the fallen "SINCE 1987" sign on the entrance plaza, the five
    // number buttons in the security office, and 1 9 8 7 pressed with the Use key opening the vault
    test("mall_01: the fallen sign, the keypad, and 1 9 8 7 opening the vault", async ({ page }) => {
        test.setTimeout(120_000);
        const errors = collectErrors(page);
        await boot(page, "/?building=mall_01&seed=1");
        await standAt(page, "mall_01", -5.5, -33);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/mall_01-sign.png` });
        await standAt(page, "mall_01", 8, 21.3);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/mall_01-keypad.png` });
        const state = () =>
            page.evaluate(() => {
                const game = (window as any).__rebirth.game;
                const mall = game.world.buildings.find((b: any) => b.type === "mall_01");
                const vault = mall.childIds
                    .map((id: number) => game.world.get(id))
                    .find((o: any) => o?.type === "vault_door_bathhouse");
                return { input: mall.puzzle.inputCode.join(""), solved: mall.puzzle.solved, open: vault.door.open };
            });
        // the buttons' x in the mall's frame (mallLayout.ts MALL_KEYPAD), pressed from before each one
        const keyX: Record<string, number> = { "1": 3.6, "2": 5.8, "7": 8, "8": 10.2, "9": 12.4 };
        for (const [i, digit] of ["1", "9", "8", "7"].entries()) {
            await standAt(page, "mall_01", keyX[digit], 20.75);
            await page.waitForTimeout(400);
            await page.keyboard.press("f");
            await expect.poll(async () => (await state()).input.length >= i + 1 || (await state()).solved).toBe(true);
        }
        await expect.poll(async () => (await state()).solved).toBe(true);
        await expect.poll(async () => (await state()).open, { timeout: 10_000 }).toBe(true);
        await standAt(page, "mall_01", 7, 21.5);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENS}/mall_01-vault-open.png` });
        expect(errors).toEqual([]);
    });

    // the owner's wave 3 (2026-10-10): each new building from above, then the player standing at its centre (the blast
    // bunker and the subway open only to explosives, so their basements come in their sim tests)
    for (const [type, art] of [
        ["gas_station_01", "gas"],
        ["church_01", "church"],
        ["mall_01", "mall"],
        ["power_plant_01", "power"],
        ["radar_base_01", "radar"],
        ["capitol_01", "capitol"],
        ["apartment_01", "apartment"],
        ["port_checkpoint_01", "port"],
        ["cargo_ship_01", "ship"],
        ["bunker_blast_01", "bunker"],
        ["subway_station_01", "subway"],
    ] as const) {
        test(`${type}: from above and inside (wave 3)`, async ({ page }) => {
            test.setTimeout(120_000);
            const errors = collectErrors(page);
            await boot(page, `/?building=${type}&seed=1`);
            await aerial(page, type, `${SCREENS}/${type}-above.png`);
            await standAt(page, type, 0, 0);
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SCREENS}/${type}-inside.png` });
            expect((await missing(page)).filter((s) => s.includes(art))).toEqual([]);
            expect(errors).toEqual([]);
        });
    }
});
