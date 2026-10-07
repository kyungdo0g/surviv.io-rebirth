// M9 sliding lab doors against the loopback simulation (main map, seed 1: the Hydra bunker). An automatic lab door
// slides its panel into the wall pocket next to the doorway, leaving only its 0.25 u edge in the doorway, under its
// slot casing, which stays where the closed door is; panel and casing are drawn over the bunker floor and under every
// ceiling (survev client obstacle.ts: zOrd = img.zIdx 15, casing zOrd + 1, the obstacle's layer; building.ts:
// ceilings at zOrd 750 - zIdx on layer | 2; server obstacle.ts toggleDoor). The vat lab's roof is survev's 816x720
// image (51 x 45 u) and reaches its walls, so from outside a closed lab door the lab's floor, the door and its casing
// stay under it (apps/client/src/objects/spriteSizeFix.ts). Screenshots go to __screens__/M9.
import { expect, type Page, test } from "@playwright/test";
import { boot, collectErrors } from "./m4-helpers.ts";

const SCREENS = "tests/e2e/__screens__/M9";
/** the panel slides 3.75 u at 7 u/s, but software GL on a busy machine can drop to a frame or two per second and
 * the loopback simulation ticks late */
const MOVE_TIMEOUT = 20_000;

interface Pt {
    x: number;
    y: number;
}

interface LabDoor {
    id: number;
    /** the compartment the door belongs to, and the vat lab on its other side */
    room: number;
    lab: number;
    closedPos: Pt;
    /** the door's local y axis (along the panel) and x axis (across the doorway), in world space */
    axis: Pt;
    normal: Pt;
    /** a point in the compartment, `side` along the normal from the doorway's middle */
    side: number;
    casingOffset: number;
}

interface DrawnPart {
    part: string;
    layer: number;
    stage: number;
    zIndex: number;
    alpha: number;
    visible: boolean;
    pos: Pt;
}

/** The first lab door of the Hydra bunker's first compartment, between it and the vat lab. */
async function labDoor(page: Page): Promise<LabDoor> {
    return page.evaluate(() => {
        const g = (window as any).__rebirth.game;
        const room = g.world.buildings.find((b: any) => b.type === "bunker_hydra_compartment_01");
        const lab = g.world.buildings.find((b: any) => b.type === "bunker_hydra_compartment_02");
        const door = room.childIds.map((id: number) => g.world.get(id)).find((o: any) => o?.type === "lab_door_01");
        const ori = door.ori;
        const axis = [
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 0, y: -1 },
            { x: 1, y: 0 },
        ][ori];
        const normal = { x: axis.y, y: -axis.x };
        const mid = { x: door.pos.x + axis.x * 2, y: door.pos.y + axis.y * 2 };
        const inRoom = (p: { x: number; y: number }) =>
            room.zoomRegions.some(
                (z: any) =>
                    z.zoomIn &&
                    p.x > z.zoomIn.min.x &&
                    p.x < z.zoomIn.max.x &&
                    p.y > z.zoomIn.min.y &&
                    p.y < z.zoomIn.max.y,
            );
        const side = inRoom({ x: mid.x + normal.x * 3, y: mid.y + normal.y * 3 }) ? 1 : -1;
        return {
            id: door.id,
            room: room.id,
            lab: lab.id,
            closedPos: { x: door.door.closedPos.x, y: door.door.closedPos.y },
            axis,
            normal,
            side,
            casingOffset: door.def.door.casingImg.pos.x,
        };
    });
}

/** Puts the local player in the compartment, `dist` units from the middle of the doorway. */
async function standAt(page: Page, door: LabDoor, dist: number): Promise<void> {
    await page.evaluate(
        ({ door, dist }) => {
            const r = (window as any).__rebirth;
            const mid = { x: door.closedPos.x + door.axis.x * 2, y: door.closedPos.y + door.axis.y * 2 };
            const p = { x: mid.x + door.normal.x * dist * door.side, y: mid.y + door.normal.y * dist * door.side };
            r.game.teleportPlayer(r.player.id, p, 1);
        },
        { door, dist },
    );
}

async function drawOrder(page: Page, id: number): Promise<DrawnPart[]> {
    return page.evaluate((id) => (window as any).__rebirth.drawOrder(id), id);
}

/** Whether `a` is drawn under `b` (render layers in scene order, then zIndex). */
function under(a: DrawnPart, b: DrawnPart): boolean {
    return a.stage < b.stage || (a.stage === b.stage && a.zIndex < b.zIndex);
}

test.describe("M9 sliding lab doors", () => {
    test("an automatic lab door slides into its wall pocket, under the ceilings, its casing staying put", async ({
        page,
    }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        const door = await labDoor(page);

        // closed: standing in the compartment out of the door's reach, the vat lab's roof drawn beyond it
        await standAt(page, door, 6);
        await expect.poll(() => drawOrder(page, door.id), { timeout: 10_000 }).not.toBeNull();
        await expect.poll(() => page.evaluate(() => (window as any).__rebirth.local.layer)).toBe(1);
        await expect
            .poll(async () => (await drawOrder(page, door.lab))?.find((p) => p.part === "ceiling")?.alpha ?? 0, {
                timeout: 10_000,
            })
            .toBe(1);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENS}/lab-door-closed.png` });
        const closed = await page.evaluate((id) => (window as any).__rebirth.doorState(id), door.id);
        expect(closed.moving).toBe(false);
        expect(closed.pos.x).toBeCloseTo(door.closedPos.x, 6);
        expect(closed.pos.y).toBeCloseTo(door.closedPos.y, 6);

        // render order: panel and casing on the underground layer, the casing just over the panel, both over the
        // compartment's floor and under the compartment's and the lab's ceilings
        const [panel, casing] = await drawOrder(page, door.id);
        expect(panel).toMatchObject({ part: "panel", layer: 1, visible: true });
        expect(casing).toMatchObject({ part: "casing", layer: 1, visible: true });
        expect(under(panel, casing)).toBe(true);
        const room = await drawOrder(page, door.room);
        const lab = await drawOrder(page, door.lab);
        for (const part of [...room, ...lab]) {
            if (part.part === "floor") expect(under(part, panel), "floor under the door").toBe(true);
            else expect(under(casing, part), "door and casing under the ceilings").toBe(true);
        }
        // the casing is centred on the wall pocket: closedPos + casingImg.pos.x along the panel
        const pocket = {
            x: door.closedPos.x + door.axis.x * door.casingOffset,
            y: door.closedPos.y + door.axis.y * door.casingOffset,
        };
        expect(casing.pos.x).toBeCloseTo(pocket.x, 4);
        expect(casing.pos.y).toBeCloseTo(pocket.y, 4);

        // open: step up to the doorway, the door opens by itself and the panel slides into the pocket
        await standAt(page, door, 1.6);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.game.world.get(id).door.open, door.id), {
                timeout: MOVE_TIMEOUT,
            })
            .toBe(true);
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${SCREENS}/lab-door-sliding.png` });
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.doorState(id).moving, door.id), {
                timeout: MOVE_TIMEOUT,
            })
            .toBe(false);
        await page.screenshot({ path: `${SCREENS}/lab-door-open.png` });
        const fit = await page.evaluate(
            ({ door }) => {
                const r = (window as any).__rebirth;
                const g = r.game;
                const drawn = r.doorState(door.id);
                const sim = g.world.get(door.id);
                // the drawn panel: collider x [-0.3, 0.3], y [0, 4] turned by the drawn rotation from the drawn position
                const along = (p: { x: number; y: number }) => p.x * door.axis.x + p.y * door.axis.y;
                const start = along(drawn.pos) - along(door.closedPos);
                const across = (p: { x: number; y: number }) => p.x * door.normal.x + p.y * door.normal.y;
                const lateral = across(drawn.pos) - across(door.closedPos);
                // its overlap with the doorway (the closed panel's span 0..4)
                const edge = Math.max(0, Math.min(start + 4, 4) - Math.max(start, 0));
                // share of the drawn panel inside the bunker's walls
                const walls = [...g.world.objects.values()].filter(
                    (o: any) => o.kind === "obstacle" && o.isWall && (o.layer & 1) === 1 && o.collider.type === 1,
                );
                let inside = 0;
                let total = 0;
                for (let s = 0.05; s < 4; s += 0.1) {
                    for (let t = -0.25; t <= 0.25; t += 0.1) {
                        const p = {
                            x: drawn.pos.x + door.axis.x * s + door.normal.x * t,
                            y: drawn.pos.y + door.axis.y * s + door.normal.y * t,
                        };
                        total++;
                        if (
                            walls.some(
                                (w: any) =>
                                    p.x >= w.collider.min.x &&
                                    p.x <= w.collider.max.x &&
                                    p.y >= w.collider.min.y &&
                                    p.y <= w.collider.max.y,
                            )
                        )
                            inside++;
                    }
                }
                const casing = r.drawOrder(door.id)[1];
                return {
                    start,
                    lateral,
                    edge,
                    inWalls: inside / total,
                    rotDiff: Math.abs(Math.sin(drawn.rot - (sim.ori * Math.PI) / 2)),
                    simPos: { x: sim.pos.x, y: sim.pos.y },
                    drawnPos: drawn.pos,
                    casing: casing.pos,
                };
            },
            { door },
        );
        // the drawn panel stopped where the simulation put it: slid 3.75 u along its own axis, not turned or shifted
        expect(fit.drawnPos.x).toBeCloseTo(fit.simPos.x, 6);
        expect(fit.drawnPos.y).toBeCloseTo(fit.simPos.y, 6);
        expect(fit.rotDiff).toBeLessThan(1e-6);
        expect(Math.abs(fit.lateral)).toBeLessThan(1e-6);
        expect(Math.abs(fit.start)).toBeCloseTo(3.75, 6);
        // only the panel's edge stays in the doorway; the rest is in the walls under the casing
        expect(fit.edge).toBeLessThanOrEqual(0.25 + 1e-6);
        expect(fit.inWalls).toBeGreaterThanOrEqual(0.7);
        expect(Math.abs(fit.start + 2 - door.casingOffset)).toBeLessThanOrEqual(0.5);
        expect(fit.casing.x).toBeCloseTo(pocket.x, 4);
        expect(fit.casing.y).toBeCloseTo(pocket.y, 4);

        // leaving: the door closes again after its delay and the panel slides back over the doorway
        await standAt(page, door, 8);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.game.world.get(id).door.open, door.id), {
                timeout: MOVE_TIMEOUT,
            })
            .toBe(false);
        await expect
            .poll(() => page.evaluate((id) => (window as any).__rebirth.doorState(id).moving, door.id), {
                timeout: MOVE_TIMEOUT,
            })
            .toBe(false);
        const back = await page.evaluate((id) => (window as any).__rebirth.doorState(id), door.id);
        expect(back.pos.x).toBeCloseTo(door.closedPos.x, 6);
        expect(back.pos.y).toBeCloseTo(door.closedPos.y, 6);
        expect(errors).toEqual([]);
    });

    test("the vat lab's roof reaches its walls: from outside a closed lab door its floor stays covered", async ({
        page,
    }) => {
        test.setTimeout(180_000);
        const errors = collectErrors(page);
        await boot(page, "/?sandbox=1&map=main&seed=1&loot=0");
        // the vat lab's one-way door to the corridor (lab_door_02)
        const door = await page.evaluate(() => {
            const g = (window as any).__rebirth.game;
            const lab = g.world.buildings.find((b: any) => b.type === "bunker_hydra_compartment_02");
            const d = lab.childIds.map((id: number) => g.world.get(id)).find((o: any) => o?.type === "lab_door_02");
            const axis = [
                { x: 0, y: 1 },
                { x: -1, y: 0 },
                { x: 0, y: -1 },
                { x: 1, y: 0 },
            ][d.ori];
            const normal = { x: axis.y, y: -axis.x };
            const mid = { x: d.door.closedPos.x + axis.x * 2, y: d.door.closedPos.y + axis.y * 2 };
            const zoomIn = lab.zoomRegions.filter((z: any) => z.zoomIn).map((z: any) => z.zoomIn);
            const inLab = (p: Pt) =>
                zoomIn.some((z: any) => p.x > z.min.x && p.x < z.max.x && p.y > z.min.y && p.y < z.max.y);
            const labSide = inLab({ x: mid.x + normal.x * 3, y: mid.y + normal.y * 3 }) ? 1 : -1;
            return { id: d.id, lab: lab.id, labOri: lab.ori, mid, axis, normal, labSide, zoomIn };
        });
        /** `dist` units from the doorway's middle towards the lab, `along` units along the closed panel */
        const at = (dist: number, along = 0): Pt => ({
            x: door.mid.x + door.normal.x * dist * door.labSide + door.axis.x * along,
            y: door.mid.y + door.normal.y * dist * door.labSide + door.axis.y * along,
        });
        // in the corridor, 3.5 u from the doorway: the door stays shut and the lab's roof is drawn
        await page.evaluate((p) => {
            const r = (window as any).__rebirth;
            r.game.teleportPlayer(r.player.id, p, 1);
        }, at(-3.5));
        const ceiling = async () => (await drawOrder(page, door.lab))?.find((p) => p.part === "ceiling");
        await expect.poll(async () => (await ceiling())?.alpha ?? 0, { timeout: MOVE_TIMEOUT }).toBe(1);
        await expect.poll(async () => (await ceiling())?.size.w ?? 0, { timeout: MOVE_TIMEOUT }).toBeGreaterThan(40);
        // a render fresh from the pool already has its texture and alpha before its first update places it: wait for
        // the roof to sit at the lab (the building is far from the map origin)
        await expect
            .poll(async () => Math.abs((await ceiling())?.pos.x ?? 0) + Math.abs((await ceiling())?.pos.y ?? 0), {
                timeout: MOVE_TIMEOUT,
            })
            .toBeGreaterThan(10);
        const roof = (await ceiling())!;
        // survev's 816x720 image (atlasDefs.ts scaledSprites 0.5 of the 1632x1440 file) at scale 1: 51 x 45 u
        expect(roof.size.w).toBeCloseTo(51, 3);
        expect(roof.size.h).toBeCloseTo(45, 3);
        // it covers the lab's zoomIn region (the building is turned by its ori)
        const [hw, hh] = door.labOri % 2 ? [roof.size.h / 2, roof.size.w / 2] : [roof.size.w / 2, roof.size.h / 2];
        for (const z of door.zoomIn) {
            expect(roof.pos.x - hw).toBeLessThanOrEqual(z.min.x + 1e-3);
            expect(roof.pos.x + hw).toBeGreaterThanOrEqual(z.max.x - 1e-3);
            expect(roof.pos.y - hh).toBeLessThanOrEqual(z.min.y + 1e-3);
            expect(roof.pos.y + hh).toBeGreaterThanOrEqual(z.max.y - 1e-3);
        }
        await page.waitForTimeout(500);
        const shot = await page.screenshot({ path: `${SCREENS}/lab-roof-from-corridor.png` });
        expect(await page.evaluate((id) => (window as any).__rebirth.game.world.get(id).door.open, door.id)).toBe(
            false,
        );
        // the lab's white tiled floor just past the closed door, beside its X marker, is under the dark roof (at
        // 736x656 the roof ended short of the doorway and the floor showed through at ~224 grey; the roof is ~22)
        const points = [at(0.9, -1.2), at(1.5, -1.5)];
        const screen = await page.evaluate(
            (pts) => pts.map((p: Pt) => (window as any).__rebirth.worldToScreen(p)),
            points,
        );
        const colors = await pixels(page, shot, screen);
        for (const [r, g, b] of colors) expect(Math.max(r, g, b), `lab floor colour ${r},${g},${b}`).toBeLessThan(80);
        expect(errors).toEqual([]);
    });
});

/** RGB of the screenshot `png` at each screen point (decoded by the page's own image decoder). */
async function pixels(page: Page, png: Buffer, points: Pt[]): Promise<Array<[number, number, number]>> {
    return page.evaluate(
        async ({ b64, points }) => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            const scale = img.width / window.innerWidth;
            return points.map((p) => {
                const d = ctx.getImageData(Math.round(p.x * scale), Math.round(p.y * scale), 1, 1).data;
                return [d[0]!, d[1]!, d[2]!] as [number, number, number];
            });
        },
        { b64: png.toString("base64"), points },
    );
}
