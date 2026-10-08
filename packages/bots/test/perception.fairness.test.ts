// Perception fairness (bot overhaul COMBAT-1/2/4/5/14): a bot knows only what the original client draws on its 16:9
// screen. Synthetic snapshots: enemies and loot in the snapshot's margin are not seen, nor under a bush or a table
// until they shoot (under a tree canopy only faintly: round 3, test/combat-sight3.test.ts); bullets show only by the
// part of their tracer that crosses the screen, an off-screen shooter only by a fuzzy origin; grenades under someone
// else's roof are not seen. Simulation scenarios: an idle dummy 2 units past the side or vertical screen edge or in a
// bush is never targeted or shot; a dummy that steps out of cover is shot no sooner than a human could. Owner: COMBAT.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, WeaponSlot } from "@rebirth/defs";
import type { Game, ObstacleView, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { hash01 } from "../src/perception/bulletSight.ts";
import { concealed, humanScreen, onHumanScreen } from "../src/perception/sight.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";
import { bullet, member, newModel, ORIGIN, player, SELF, snap } from "./perceptionSnap.ts";

const ZOOM = 28;
const H = humanScreen(ZOOM);

function obstacle(id: number, type: string, pos: Vec2, extra: Partial<ObstacleView> = {}): ObstacleView {
    return { id, kind: "obstacle", type, pos, layer: 0, ori: 0, scale: 1, healthT: 1, dead: false, ...extra };
}

describe("the screen, not the snapshot", () => {
    it("sees enemies on the 16:9 screen only, not in the snapshot margin", () => {
        const model = newModel();
        const inside = v2.add(ORIGIN, { x: H.x - 1, y: 0 });
        const side = v2.add(ORIGIN, { x: H.x + 2, y: 0 });
        const below = v2.add(ORIGIN, { x: 0, y: -(H.y + 2) });
        model.observe(snap(1, { objects: [player(20, inside), player(21, side), player(22, below)] }));
        expect(model.contacts.get(20)?.visible).toBe(true);
        expect(model.contacts.has(21)).toBe(false);
        expect(model.contacts.has(22)).toBe(false);
        // one that walks off the screen is remembered where it was last seen, not followed through the margin
        model.observe(snap(1.1, { objects: [player(20, v2.add(ORIGIN, { x: H.x + 3, y: 0 }))] }));
        const c = model.contacts.get(20);
        expect(c?.visible).toBe(false);
        expect(c?.pos.x).toBeCloseTo(inside.x, 5);
    });

    it("sees loot and grenades on the screen only", () => {
        const model = newModel();
        const loot = (id: number, pos: Vec2) => ({ id, kind: "loot" as const, type: "mp5", pos, layer: 0, count: 1 });
        const frag = (id: number, pos: Vec2) => ({ id, type: "frag", pos, posZ: 0, dir: { x: 1, y: 0 }, layer: 0 });
        model.observe(
            snap(1, {
                objects: [loot(30, v2.add(ORIGIN, { x: 5, y: 3 })), loot(31, v2.add(ORIGIN, { x: 0, y: H.y + 2.5 }))],
                projectiles: [frag(1, v2.add(ORIGIN, { x: 4, y: 0 })), frag(2, v2.add(ORIGIN, { x: H.x + 3, y: 0 }))],
            }),
        );
        expect([...model.loot.keys()]).toEqual([30]);
        expect(model.projectiles.map((p) => p.id)).toEqual([1]);
        expect(model.projectileSeen.get(1)).toBe(1);
    });

    it("does not see a grenade under someone else's roof", () => {
        const model = newModel();
        const def = getMapObjectDef("house_red_01") as {
            ceiling: { zoomRegions: Array<{ zoomIn?: { min: Vec2; max: Vec2 } }> };
        };
        const z = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn as { min: Vec2; max: Vec2 };
        const housePos = v2.add(ORIGIN, { x: 20, y: 0 });
        const inside = v2.add(housePos, { x: (z.min.x + z.max.x) / 2, y: (z.min.y + z.max.y) / 2 });
        const house = {
            id: 950,
            kind: "building" as const,
            type: "house_red_01",
            pos: housePos,
            layer: 0,
            ori: 0,
            occupied: false,
            ceilingDead: false,
            ceilingDamaged: false,
        };
        const frag = { id: 5, type: "frag", pos: inside, posZ: 0, dir: { x: 1, y: 0 }, layer: 0 };
        model.observe(snap(1, { objects: [house], projectiles: [frag] }));
        expect(model.onScreen(inside)).toBe(true);
        expect(model.projectiles).toEqual([]);
    });

    it("keeps a teammate known off the screen (the team UI shows it)", () => {
        const model = newModel();
        const mate = v2.add(ORIGIN, { x: H.x + 3, y: 0 });
        model.observe(
            snap(1, {
                team: [member(SELF, ORIGIN), member(8, mate)],
                playerInfos: [
                    { playerId: SELF, teamId: 1, groupId: 1, name: "me" },
                    { playerId: 8, teamId: 1, groupId: 1, name: "mate" },
                ],
                objects: [player(8, mate)],
            }),
        );
        expect(model.contacts.get(8)?.visible).toBe(true);
    });
});

describe("bullets as a human sees them", () => {
    it("cuts a tracer from off the screen to where it enters, with a fuzzy origin behind it", () => {
        const model = newModel();
        const origin = v2.add(ORIGIN, { x: 45, y: 3 });
        const b = bullet(50, origin, { x: -1, y: 0 }, { maxDist: 100 });
        model.observe(snap(10, { bullets: [b] }));
        expect(model.bullets).toHaveLength(1);
        const seen = model.bullets[0];
        // it enters at the screen edge (plus half a unit of tracer slack), the end stays where it was
        expect(seen.pos.x - ORIGIN.x).toBeCloseTo(H.x + 0.5, 5);
        expect(seen.pos.x + seen.dir.x * seen.maxDist).toBeCloseTo(origin.x - 100, 5);
        expect(seen.clipped).toBe(true);
        // the origin: back along the tracer by 0.6-1.5x the way the tracer came from off the screen, then at most 15
        // degrees off as the bot sees it (turned about the bot, not about the entry point: adversarial review)
        const o = seen.origin as Vec2;
        const me = model.self.pos;
        const angle = Math.acos(v2.dot(v2.normalize(v2.sub(origin, me)), v2.normalize(v2.sub(o, me))));
        expect(angle).toBeLessThanOrEqual((15 * Math.PI) / 180 + 1e-9);
        const behind = v2.distance(origin, seen.pos);
        const lo = v2.distance(me, v2.add(seen.pos, v2.mul(seen.dir, -0.6 * behind)));
        const hi = v2.distance(me, v2.add(seen.pos, v2.mul(seen.dir, -1.5 * behind)));
        expect(v2.distance(me, o)).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(v2.distance(me, o)).toBeLessThanOrEqual(hi + 1e-6);
        expect(o).not.toEqual(origin);
    });

    it("drops a tracer that never crosses the screen; keeps one fired on it as it is", () => {
        const model = newModel();
        const far = bullet(51, v2.add(ORIGIN, { x: 0, y: H.y + 3 }), { x: 1, y: 0 }, { maxDist: 40 });
        const near = bullet(52, v2.add(ORIGIN, { x: 10, y: 0 }), { x: -1, y: 0 }, { maxDist: 40 });
        model.observe(snap(10, { bullets: [far, near], objects: [player(52, v2.add(ORIGIN, { x: 10, y: 0 }))] }));
        expect(model.bullets.map((b) => b.id)).toEqual([near.id]);
        expect(model.bullets[0].pos).toEqual(near.pos);
        expect(model.bullets[0].origin).toEqual(near.pos);
    });

    it("places a near miss from off the screen at the fuzzy origin, never the muzzle", () => {
        const model = newModel();
        const origin = v2.add(ORIGIN, { x: 0, y: 40 });
        model.observe(snap(5, { bullets: [bullet(53, origin, { x: 0, y: -1 }, { maxDist: 60 })] }));
        const uf = model.underFire;
        expect(uf?.shooterId).toBe(53);
        expect(uf?.from).not.toEqual(origin);
        // still roughly that way (the tracer passed right by the bot: its direction is plain to see)
        const to = v2.normalize(v2.sub(uf?.from as Vec2, ORIGIN));
        expect(to.y).toBeGreaterThan(Math.cos((16 * Math.PI) / 180));
    });

    it("hashes deterministically", () => {
        expect(hash01(3, 4)).toBe(hash01(3, 4));
        expect(hash01(3, 4)).not.toBe(hash01(4, 3));
        for (let i = 0; i < 50; i++) {
            const u = hash01(i, 7);
            expect(u).toBeGreaterThanOrEqual(0);
            expect(u).toBeLessThan(1);
        }
    });
});

describe("foliage", () => {
    it("hides an enemy under a bush or a table, not one only touching it; a canopy only makes it faint", () => {
        const model = newModel();
        const bush = v2.add(ORIGIN, { x: 12, y: 0 });
        const tree = v2.add(ORIGIN, { x: -12, y: 4 });
        const table = v2.add(ORIGIN, { x: 0, y: -10 });
        model.observe(
            snap(1, {
                objects: [
                    obstacle(900, "bush_01", bush),
                    obstacle(901, "tree_01", tree),
                    obstacle(902, "table_01", table),
                    player(40, v2.add(bush, { x: 0.3, y: 0.2 })),
                    // hugging the trunk on the bot's side, under the canopy
                    player(41, v2.add(tree, { x: 2.6, y: 0 })),
                    player(42, v2.add(table, { x: 0.4, y: 0 })),
                    // beside the bush: its body shows
                    player(43, v2.add(bush, { x: 0, y: 2.6 })),
                ],
            }),
        );
        expect(model.contacts.has(40)).toBe(false);
        // under the canopy: seen, faintly (round 3 item 26)
        expect(model.contacts.get(41)?.visible).toBe(true);
        expect(model.contacts.get(41)?.faint).toBe(true);
        expect(model.contacts.has(42)).toBe(false);
        expect(model.contacts.get(43)?.visible).toBe(true);
        expect(model.contacts.get(43)?.faint).toBeFalsy();
        expect(concealed(model, v2.add(bush, { x: 0.3, y: 0.2 }), 0)).toBe(true);
        expect(concealed(model, v2.add(bush, { x: 1.5, y: 0 }), 0)).toBe(false);
    });

    it("shows a concealed shooter for a moment: its muzzle flash and tracer give it away", () => {
        const model = newModel();
        const bush = v2.add(ORIGIN, { x: 12, y: 0 });
        const objs = [obstacle(900, "bush_01", bush), player(40, bush)];
        model.observe(snap(1, { objects: objs }));
        expect(model.contacts.has(40)).toBe(false);
        model.observe(snap(1.1, { objects: objs, bullets: [bullet(40, bush, { x: -1, y: 0 }, { maxDist: 30 })] }));
        expect(model.contacts.get(40)?.visible).toBe(true);
        model.observe(snap(1.6, { objects: objs }));
        expect(model.contacts.get(40)?.visible).toBe(true);
        model.observe(snap(2.3, { objects: objs }));
        expect(model.contacts.get(40)?.visible).toBe(false);
    });

    it("leaves a dead bush and players of other floors out", () => {
        const model = newModel();
        const bush = v2.add(ORIGIN, { x: 12, y: 0 });
        model.observe(snap(1, { objects: [obstacle(900, "bush_01", bush, { dead: true }), player(40, bush)] }));
        expect(model.contacts.get(40)?.visible).toBe(true);
        expect(concealed(model, bush, 1)).toBe(false);
    });

    it("hides loot under a bush and does not forget it there", () => {
        const model = newModel();
        const bush = v2.add(ORIGIN, { x: 8, y: 0 });
        const loot = { id: 70, kind: "loot" as const, type: "mp5", pos: bush, layer: 0, count: 1 };
        model.observe(snap(1, { objects: [obstacle(900, "bush_01", bush), loot] }));
        expect(model.loot.has(70)).toBe(false);
    });
});

describe("contacts keep their sighting behind a bush on the screen", () => {
    it("a 1 s dip on the screen keeps firstSeen; leaving the screen starts a new sighting", () => {
        const model = newModel();
        const p = v2.add(ORIGIN, { x: 10, y: 0 });
        const bush = obstacle(900, "bush_01", v2.add(p, { x: 0, y: 3 }));
        model.observe(snap(1, { objects: [bush, player(20, p)] }));
        // through the bush: hidden but on the screen for a second
        model.observe(snap(1.5, { objects: [bush, player(20, bush.pos)] }));
        model.observe(snap(2.4, { objects: [bush, player(20, bush.pos)] }));
        model.observe(snap(2.5, { objects: [bush, player(20, v2.add(bush.pos, { x: 0, y: 3 }))] }));
        expect(model.contacts.get(20)?.visible).toBe(true);
        expect(model.contacts.get(20)?.firstSeen).toBe(1);
        const off = v2.add(ORIGIN, { x: H.x - 0.6, y: 0 });
        model.observe(snap(3, { objects: [player(20, off)] }));
        model.observe(snap(3.1, { objects: [player(20, v2.add(off, { x: 5, y: 0 }))] }));
        model.observe(snap(4, { objects: [player(20, off)] }));
        expect(model.contacts.get(20)?.firstSeen).toBe(4);
    });
});

/** Steps a bot held at `spot` (teleported back every tick) with the game; calls `each` after every tick. */
function planted(game: Game, bot: BotController, spot: Vec2, ticks: number, each: () => boolean | undefined): number {
    for (let i = 0; i < ticks; i++) {
        bot.update();
        game.step();
        game.teleportPlayer(bot.playerId, spot);
        if (each()) return i + 1;
    }
    return -1;
}

const SPOT = openSpot(flatGame(), 40);

function duel(obstacles: Array<{ type: string; pos: Vec2 }> = [], difficulty: "easy" | "normal" | "hard" = "normal") {
    const game = flatGame({ sandbox: true }, 1, obstacles);
    const me = placePlayer(game, "bot", SPOT);
    giveGun(me, "ak47", 90, WeaponSlot.Primary);
    return { game, me, difficulty };
}

function shotsOf(p: Player): number {
    return 30 - (p.weaponManager.weapons[WeaponSlot.Primary]?.ammo ?? 30);
}

describe("fairness scenarios (simulation)", () => {
    it("never targets or shoots an idle dummy 2 units past the side or the vertical screen edge", () => {
        for (const seed of [1, 2]) {
            for (const off of [
                { x: H.x + 2, y: 0 },
                { x: 0, y: H.y + 2 },
                { x: -(H.x + 2), y: 3 },
            ]) {
                const { game, me } = duel();
                const dummy = placePlayer(game, "dummy", v2.add(SPOT, off));
                const bot = new BotController(game, me.id, { seed, difficulty: "hard" });
                planted(game, bot, SPOT, 250, () => undefined);
                expect(shotsOf(me), `seed ${seed} off ${JSON.stringify(off)}`).toBe(0);
                expect(dummy.health).toBe(100);
                expect(bot.bot.model.contacts.has(dummy.id)).toBe(false);
            }
        }
        // control: just inside the edge it is shot
        const { game, me } = duel();
        const dummy = placePlayer(game, "dummy", v2.add(SPOT, { x: H.x - 3, y: 0 }));
        const bot = new BotController(game, me.id, { seed: 1, difficulty: "hard" });
        expect(planted(game, bot, SPOT, 300, () => dummy.health < 100)).toBeGreaterThan(0);
    });

    it("never targets an idle dummy in a bush", () => {
        const bushPos = v2.add(SPOT, { x: 14, y: 0 });
        for (const seed of [1, 2, 3]) {
            const { game, me } = duel([{ type: "bush_01", pos: bushPos }]);
            const inBush = placePlayer(game, "bush", bushPos);
            const bot = new BotController(game, me.id, { seed, difficulty: "hard" });
            planted(game, bot, SPOT, 300, () => undefined);
            expect(inBush.health).toBe(100);
            expect(shotsOf(me)).toBe(0);
            expect(onHumanScreen(me.pos, me.zoom, inBush.pos, 1)).toBe(true);
        }
    });

    it("shoots back at a bush camper that opens fire on it", () => {
        const bushPos = v2.add(SPOT, { x: 14, y: 0 });
        const { game, me } = duel([{ type: "bush_01", pos: bushPos }]);
        const camper = placePlayer(game, "camper", bushPos);
        giveGun(camper, "m9", 60, WeaponSlot.Primary);
        const bot = new BotController(game, me.id, { seed: 4, difficulty: "normal" });
        // unseen until it fires (a shot every 0.3 s at the bot)
        planted(game, bot, SPOT, 100, () => undefined);
        expect(bot.bot.model.contacts.has(camper.id)).toBe(false);
        let tick = 0;
        const hit = planted(game, bot, SPOT, 400, () => {
            const shoot = tick++ % 30 === 0;
            game.setInput(camper.id, { ...camper.input, toMouseDir: { x: -1, y: 0 }, shootStart: shoot });
            return camper.health < 100;
        });
        expect(hit).toBeGreaterThan(0);
    });

    it("shoots a dummy that steps out of cover no sooner than a human could (hard: >= 0.15 s)", () => {
        for (const seed of [1, 2, 3, 4]) {
            const stone = v2.add(SPOT, { x: 14, y: 0 });
            const { game, me } = duel([{ type: "stone_01", pos: stone }]);
            const hide = v2.add(stone, { x: 3.2, y: 0 });
            const dummy = placePlayer(game, "dummy", hide);
            const bot = new BotController(game, me.id, { seed, difficulty: "hard" });
            // seen before it hides: the bot knows where it is and holds the angle
            game.teleportPlayer(dummy.id, v2.add(stone, { x: 0, y: 6 }));
            planted(game, bot, SPOT, 60, () => undefined);
            game.teleportPlayer(dummy.id, hide);
            planted(game, bot, SPOT, 250, () => undefined);
            const before = shotsOf(me);
            // it steps out sideways, 0.25 units per tick (a sprint), and stands there
            let exposedAt = -1;
            let tick = 0;
            const shotAt = planted(game, bot, SPOT, 200, () => {
                tick++;
                if (tick <= 20) game.teleportPlayer(dummy.id, v2.add(hide, { x: 0, y: tick * 0.25 }));
                const clear = bot.bot.model.lineOfFire(me.pos, v2.add(dummy.pos, { x: 0, y: 0.9 }));
                if (exposedAt < 0 && clear) exposedAt = tick;
                return shotsOf(me) > before;
            });
            expect(shotAt, `seed ${seed}`).toBeGreaterThan(0);
            expect(exposedAt).toBeGreaterThan(0);
            expect((shotAt - exposedAt) / 100, `seed ${seed} latency`).toBeGreaterThanOrEqual(0.15);
        }
    });
});
