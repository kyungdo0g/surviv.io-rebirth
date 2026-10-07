// Round 3 perception (bot overhaul COMBAT, user reports 25 and 26). Synthetic snapshots: an enemy under a tree canopy is
// seen faintly (not hidden like in a bush), plain within 5 units or once its own shot gives it away; the last-seen
// record of an enemy that drops out of sight (into a bush, under a roof, into smoke, off the screen) keeps where, why
// and which way it went, outlives the contact's memory, decays and is dropped when the enemy shows again or dies.
// Simulation: a hard bot engages a faint dummy under a canopy, but later, only in short bursts at a guess, hitting less
// than a dummy in the open, and gives up on it after a few seconds. Owner: COMBAT.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, WeaponSlot } from "@rebirth/defs";
import type { Game, ObstacleView, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { lastSeenConfidence, lastSeenPredicted, lastSeenRadius, searchPoints } from "../src/perception/lastSeen.ts";
import { underCanopy } from "../src/perception/sight.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";
import { bullet, newModel, ORIGIN, player, snap } from "./perceptionSnap.ts";

function obstacle(id: number, type: string, pos: Vec2, extra: Partial<ObstacleView> = {}): ObstacleView {
    return { id, kind: "obstacle", type, pos, layer: 0, ori: 0, scale: 1, healthT: 1, dead: false, ...extra };
}

describe("tree canopies make a body faint, not hidden", () => {
    it("faint under the canopy, plain within 5 units, plain for a moment after its own shot", () => {
        const model = newModel();
        const tree = v2.add(ORIGIN, { x: -12, y: 4 });
        const under = v2.add(tree, { x: 2.6, y: 0 });
        const objs = [obstacle(901, "tree_01", tree), player(41, under)];
        model.observe(snap(1, { objects: objs }));
        expect(underCanopy(model, under, 0)).toBe(true);
        expect(model.contacts.get(41)?.visible).toBe(true);
        expect(model.contacts.get(41)?.faint).toBe(true);
        // it fires: the muzzle flash gives it away for a moment
        model.observe(snap(1.1, { objects: objs, bullets: [bullet(41, under, { x: 1, y: 0 }, { maxDist: 30 })] }));
        expect(model.contacts.get(41)?.faint).toBe(false);
        model.observe(snap(2.5, { objects: objs }));
        expect(model.contacts.get(41)?.faint).toBe(true);
        // a tree right next to the bot: what pokes out from under the canopy is plain that close
        const near = newModel();
        const tree2 = v2.add(ORIGIN, { x: 4, y: 0 });
        near.observe(
            snap(1, { objects: [obstacle(902, "tree_01", tree2), player(42, v2.add(tree2, { x: 0, y: 1 }))] }),
        );
        expect(near.contacts.get(42)?.faint).toBeFalsy();
    });
});

describe("the last-seen record (where and why an enemy vanished)", () => {
    const step = (model: ReturnType<typeof newModel>, t: number, objects: Parameters<typeof snap>[1] = {}) =>
        model.observe(snap(t, objects));

    it("into a bush: cause foliage, the bush is the spot to hold, hostile when it had been shooting", () => {
        const model = newModel();
        const bush = v2.add(ORIGIN, { x: 12, y: 0 });
        const b = obstacle(900, "bush_01", bush);
        // walking +x into the bush, firing on the way
        step(model, 1, { objects: [b, player(40, v2.add(bush, { x: -3, y: 0 }))] });
        step(model, 1.1, {
            objects: [b, player(40, v2.add(bush, { x: -2.5, y: 0 }))],
            bullets: [bullet(40, v2.add(bush, { x: -2.5, y: 0 }), { x: -1, y: 0 }, { maxDist: 30 })],
        });
        step(model, 1.2, { objects: [b, player(40, v2.add(bush, { x: -2, y: 0 }))] });
        step(model, 2.4, { objects: [b, player(40, bush)] });
        const tr = model.lastSeen.get(40);
        expect(tr?.cause).toBe("foliage");
        expect(tr?.hostile).toBe(true);
        expect(v2.distance(tr?.corner ?? ORIGIN, bush)).toBeLessThan(0.1);
        expect(tr?.heading.x).toBeGreaterThan(0.9);
    });

    it("under a roof: cause roof, the door it went in by; predicted at most 3 units in", () => {
        const model = newModel();
        const def = getMapObjectDef("house_red_01") as {
            ceiling: { zoomRegions: Array<{ zoomIn?: { min: Vec2; max: Vec2 } }> };
        };
        const z = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn as { min: Vec2; max: Vec2 };
        const housePos = v2.add(ORIGIN, { x: 15, y: 0 });
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
        const edgeX = housePos.x + z.min.x;
        const midY = housePos.y + (z.min.y + z.max.y) / 2;
        step(model, 1, { objects: [house, player(40, { x: edgeX - 2, y: midY })] });
        step(model, 1.1, { objects: [house, player(40, { x: edgeX - 1, y: midY })] });
        step(model, 1.2, { objects: [house, player(40, { x: edgeX + 1.5, y: midY })] });
        const tr = model.lastSeen.get(40);
        expect(tr?.cause).toBe("roof");
        expect(tr?.pos.x).toBeCloseTo(edgeX - 1, 5);
        const p = lastSeenPredicted(tr as NonNullable<typeof tr>, 20);
        expect(v2.distance(p, tr?.pos ?? ORIGIN)).toBeLessThanOrEqual(3 + 1e-9);
    });

    it("into smoke: cause smoke, the cloud is the spot", () => {
        const model = newModel();
        const cloud = { id: 3, pos: v2.add(ORIGIN, { x: 10, y: 0 }), rad: 5, layer: 0, interior: false };
        step(model, 1, { objects: [player(40, v2.add(cloud.pos, { x: -6, y: 0 }))], smokes: [cloud] });
        step(model, 1.1, { objects: [player(40, v2.add(cloud.pos, { x: -5.2, y: 0 }))], smokes: [cloud] });
        // its centre is in the cloud now: the simulation leaves it out of the snapshot
        step(model, 1.2, { objects: [], smokes: [cloud] });
        const tr = model.lastSeen.get(40);
        expect(tr?.cause).toBe("smoke");
        expect(tr?.corner).toEqual(cloud.pos);
    });

    it("off the screen: cause offscreen; outlives the contact, decays, dropped when seen again or dead", () => {
        const model = newModel();
        const edge = v2.add(ORIGIN, { x: 27, y: 0 });
        step(model, 1, { objects: [player(40, v2.add(edge, { x: -1, y: 0 }))] });
        step(model, 1.1, { objects: [player(40, edge)] });
        step(model, 1.2, { objects: [player(40, v2.add(edge, { x: 2, y: 0 }))] });
        const tr = model.lastSeen.get(40);
        expect(tr?.cause).toBe("offscreen");
        expect(searchPoints(tr as NonNullable<typeof tr>, 3).length).toBeGreaterThanOrEqual(1);
        // the contact is forgotten after its memory; the record is not
        for (let t = 2; t <= 12; t += 1) step(model, t);
        expect(model.contacts.has(40)).toBe(false);
        const kept = model.lastSeen.get(40);
        expect(kept).toBeDefined();
        const k = kept as NonNullable<typeof kept>;
        expect(lastSeenConfidence(k, k.at)).toBeCloseTo(1, 5);
        expect(lastSeenConfidence(k, k.at + 5)).toBeCloseTo(Math.exp(-1), 5);
        expect(lastSeenRadius(k, k.at + 4)).toBeGreaterThan(lastSeenRadius(k, k.at + 1));
        // seen again: dropped
        step(model, 13, { objects: [player(40, v2.add(ORIGIN, { x: 5, y: 0 }))] });
        expect(model.lastSeen.get(40)).toBeUndefined();
        // seen dead: nothing to look for
        step(model, 13.1, { objects: [player(40, v2.add(ORIGIN, { x: 5, y: 0 }), { dead: true })] });
        step(model, 13.2);
        expect(model.lastSeen.get(40)).toBeUndefined();
        // a record is kept 20 s at most
        step(model, 14, { objects: [player(41, v2.add(ORIGIN, { x: 3, y: 0 }))] });
        step(model, 14.1, { objects: [player(41, v2.add(ORIGIN, { x: 40, y: 0 }))] });
        expect(model.lastSeen.get(41)).toBeDefined();
        step(model, 34.5);
        expect(model.lastSeen.get(41)).toBeUndefined();
    });
});

/** Steps a bot held at `spot` (teleported back every tick) with the game; calls `each` after every tick. */
function planted(game: Game, bot: BotController, spot: Vec2, ticks: number, each: (tick: number) => void): void {
    for (let i = 0; i < ticks; i++) {
        bot.update();
        game.step();
        game.teleportPlayer(bot.playerId, spot);
        each(i);
    }
}

const SPOT = openSpot(flatGame(), 40);

interface FaintRun {
    firstFire: number;
    longestBurst: number;
    /** the longest stretch without fire after the first shot (ticks) */
    longestQuiet: number;
    fireTicks: number;
    damage: number;
}

/** A hard bot planted at SPOT for `ticks` against an idle dummy at `off` (under a canopy when `tree` is given). */
function faintRun(seed: number, off: Vec2, tree: Vec2 | null, ticks: number): FaintRun {
    const game = flatGame({ sandbox: true }, 1, tree ? [{ type: "tree_01", pos: tree }] : []);
    const me = placePlayer(game, "bot", SPOT);
    giveGun(me, "ak47", 300, WeaponSlot.Primary);
    const dummy: Player = placePlayer(game, "dummy", v2.add(SPOT, off));
    const bot = new BotController(game, me.id, { seed, difficulty: "hard" });
    const out: FaintRun = { firstFire: -1, longestBurst: 0, longestQuiet: 0, fireTicks: 0, damage: 0 };
    let run = 0;
    let quiet = 0;
    planted(game, bot, SPOT, ticks, (i) => {
        // the dummy stays put with full health (it is a target, not a fight)
        out.damage += 100 - dummy.health;
        dummy.health = 100;
        if (bot.bot.intent.fire) {
            if (out.firstFire < 0) out.firstFire = i;
            out.fireTicks++;
            run++;
            quiet = 0;
            out.longestBurst = Math.max(out.longestBurst, run);
        } else {
            run = 0;
            if (out.firstFire >= 0) out.longestQuiet = Math.max(out.longestQuiet, ++quiet);
        }
    });
    return out;
}

describe("a faint body under a canopy (simulation, hard bot)", () => {
    it("is engaged, but noticed later, in short bursts, hit less, and given up on after a few seconds", () => {
        const tree = v2.add(SPOT, { x: 12, y: 2 });
        const under = v2.sub(v2.add(tree, { x: -2.6, y: 0 }), SPOT);
        const runs = [1, 2, 3, 4].map((seed) => ({
            faint: faintRun(seed, under, tree, 1200),
            open: faintRun(seed, under, null, 1200),
        }));
        for (const [i, r] of runs.entries()) {
            // not blind: it shoots at the faint body
            expect(r.faint.firstFire, `seed ${i + 1}`).toBeGreaterThan(0);
            // later than at the same body in the open
            expect(r.faint.firstFire, `seed ${i + 1}`).toBeGreaterThan(r.open.firstFire);
            // short bursts (0.2-0.45 s plus a think), never the open-field stream
            expect(r.faint.longestBurst, `seed ${i + 1}`).toBeLessThanOrEqual(55);
            // gives up: after its patience (3.5-4.3 s for hard) it leaves the body alone for 5 s
            expect(r.faint.longestQuiet, `seed ${i + 1}`).toBeGreaterThanOrEqual(450);
            expect(r.open.longestQuiet, `seed ${i + 1}`).toBeLessThan(400);
        }
        const faintDamage = runs.reduce((a, r) => a + r.faint.damage, 0);
        const openDamage = runs.reduce((a, r) => a + r.open.damage, 0);
        expect(faintDamage).toBeGreaterThan(0);
        expect(faintDamage).toBeLessThan(openDamage * 0.5);
    });
});
