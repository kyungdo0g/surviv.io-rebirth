// Air drops and threat reactions: an air drop worth the trip is approached to a cover spot 15-25 units off, scanned
// for 3-6 s, then opened; a hot drop is skipped; under fire from an unseen shooter the bot looks at it, drops looting
// and runs to cover against it; danger zones are dodged; hot areas weigh loot down.
import { v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { airdropScore, planAirdrop } from "../src/brain/airdrop.ts";
import { likelyThreat, reactToThreats, unseenFire } from "../src/brain/alert.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { coolZoneTarget, planZone, zoneTarget } from "../src/brain/survival.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, FixedBoard, NOW, setGas, testWorld } from "./brain-world.ts";

describe("air drops", () => {
    it("approaches to 15-25 units, scans, then goes for the crate; capped", () => {
        const w = testWorld();
        const drop = v2.add(w.spot, { x: 70, y: 0 });
        const board = new FixedBoard();
        board.drops = [{ pos: drop, seenAt: NOW - 1, landed: true, crateId: 0 }];
        w.model.threats = board;
        const brain = brainOf(w, ["airdrop"]);
        expect(airdropScore(brain.context(NOW))).toBeGreaterThan(0.3);
        const approach = planAirdrop(brain.context(NOW));
        const r = v2.distance(approach.goal!, drop);
        expect(r).toBeGreaterThanOrEqual(14);
        expect(r).toBeLessThanOrEqual(26);
        // there: scan for 3-6 s
        w.model.self.pos = v2.copy(approach.goal!);
        const scan = planAirdrop(brain.context(NOW + 5));
        expect(brain.mem.smart.airdropState).toBe("scan");
        expect(scan.stop).toBe(true);
        expect(scan.lookAt).toEqual(drop);
        planAirdrop(brain.context(NOW + 12));
        expect(brain.mem.smart.airdropState).toBe("loot");
        // capped at 45 s, then left alone for a while
        expect(airdropScore(brain.context(NOW + 50))).toBe(0);
        expect(airdropScore(brain.context(NOW + 60))).toBe(0);
    });

    it("skips a hot drop and one out of reach", () => {
        const w = testWorld();
        const drop = v2.add(w.spot, { x: 70, y: 0 });
        const board = new FixedBoard();
        board.drops = [{ pos: drop, seenAt: NOW - 1, landed: true, crateId: 0 }];
        board.hot = [{ pos: drop, heat: 10 }];
        w.model.threats = board;
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBe(0);
        board.hot = [];
        board.drops = [{ pos: v2.add(w.spot, { x: 150, y: 0 }), seenAt: NOW - 1, landed: true, crateId: 0 }];
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBe(0);
    });
});

describe("threat reactions", () => {
    it("under fire from an unseen shooter: look at it; hit, stop looting and take cover against it", () => {
        const w = testWorld();
        const from = v2.add(w.spot, { x: -30, y: 0 });
        w.model.underFire = { time: NOW - 0.2, from, shooterId: 9 };
        // a near miss: just a glance
        const glance = emptyIntent("loot");
        glance.actions.push(Input.Loot);
        reactToThreats(ctxOf(w, ["threats"]), glance);
        expect(glance.lookAt).toEqual(from);
        expect(glance.actions).toContain(Input.Loot);
        w.model.lastHurt = NOW - 0.2;
        addObstacle(w, { x: -4, y: 1 });
        const ctx = ctxOf(w, ["threats"]);
        expect(unseenFire(ctx)).toEqual(from);
        const intent = emptyIntent("loot");
        intent.actions.push(Input.Loot);
        intent.goal = v2.add(w.spot, { x: 10, y: 0 });
        reactToThreats(ctx, intent);
        expect(intent.lookAt).toEqual(from);
        expect(intent.actions).not.toContain(Input.Loot);
        expect(w.model.lineOfFire(from, intent.goal!)).toBe(false);
        // a fight is left alone (it shoots back)
        const fight = emptyIntent("fight");
        fight.fire = true;
        reactToThreats(ctx, fight);
        expect(fight.goal).toBeNull();
    });

    it("hears shooters on the threat board", () => {
        const w = testWorld();
        const board = new FixedBoard();
        board.shooters = [
            { id: 9, pos: v2.add(w.spot, { x: 40, y: 5 }), lastShot: NOW - 0.5, shots: 4, weapon: "ak47" },
        ];
        w.model.threats = board;
        expect(unseenFire(ctxOf(w, ["threats"]))).toEqual(board.shooters[0].pos);
        board.shooters[0].lastShot = NOW - 5;
        expect(unseenFire(ctxOf(w, ["threats"]))).toBeNull();
    });

    it("dodges danger zones of the threat board", () => {
        const w = testWorld();
        const board = new FixedBoard();
        board.zones = [{ kind: "airstrike", pos: v2.add(w.spot, { x: 3, y: 0 }), rad: 8, until: NOW + 3 }];
        w.model.threats = board;
        w.model.snapshots = 10;
        const intent = brainOf(w, ["threats"]).think(NOW, 0.1);
        expect(intent.moveDir).not.toBeNull();
        expect(intent.moveDir!.x).toBeLessThan(0);
        const plain = brainOf(w, []).think(NOW, 0.1);
        expect(plain.moveDir?.x ?? 0).toBeGreaterThanOrEqual(0);
    });

    it("rotates into the zone around a hot area", () => {
        const w = testWorld();
        setGas(w, { x: 120, y: 0 }, 50, "moving");
        const straight = zoneTarget(w.model, 0.5);
        expect(coolZoneTarget(w.model, 0.5)).toEqual(straight);
        const board = new FixedBoard();
        board.hot = [{ pos: straight, heat: 6 }];
        w.model.threats = board;
        const cool = coolZoneTarget(w.model, 0.5);
        expect(v2.distance(cool, straight)).toBeGreaterThan(10);
        expect(board.heat(cool, 20)).toBeLessThan(board.heat(straight, 20));
        // only the smart brain with the threats feature takes the detour
        const jitter = 1 / 7; // planZone's jitter for the bot id 1
        expect(planZone(ctxOf(w, ["threats"])).goal).toEqual(coolZoneTarget(w.model, jitter));
        expect(planZone(ctxOf(w, [])).goal).toEqual(zoneTarget(w.model, jitter));
    });

    it("pre-aims where an enemy that left view should reappear, else at heard gunfire", () => {
        const w = testWorld();
        addEnemy(w, 2, { x: 20, y: 5 }, { visible: false, lastSeen: NOW - 1, vel: { x: 0, y: 4 } });
        const intent = emptyIntent("loot");
        reactToThreats(ctxOf(w, ["threats"]), intent);
        expect(intent.lookAt).toEqual(v2.add(w.spot, { x: 20, y: 9 }));
        expect(likelyThreat(ctxOf(w, ["threats"]))).toEqual(intent.lookAt);
        // an aim already set is left alone
        const aiming = emptyIntent("fight");
        aiming.aim = v2.add(w.spot, { x: -5, y: 0 });
        reactToThreats(ctxOf(w, ["threats"]), aiming);
        expect(aiming.lookAt).toBeUndefined();
        const w2 = testWorld();
        const board = new FixedBoard();
        board.reports = [
            { kind: "gunfire", pos: v2.add(w2.spot, { x: -30, y: 0 }), time: NOW - 2, reporterId: 9, type: "ak47" },
        ];
        w2.model.threats = board;
        expect(likelyThreat(ctxOf(w2, ["threats"]))).toEqual(v2.add(w2.spot, { x: -30, y: 0 }));
    });
});
