// Threat reactions (BrainFeatures.threats): under fire from an unseen shooter the bot looks at it, drops looting and
// runs to cover against it; shooters on the threat board are heard; danger zones are dodged; the cursor pre-aims where
// an enemy that left view should reappear. Split out of brain-airdrop.test.ts in the bot overhaul's stage 0. Owner:
// COMBAT.
import { v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { likelyThreat, reactToThreats, unseenFire } from "../src/brain/alert.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, FixedBoard, NOW, testWorld } from "./brain-world.ts";

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

    it("pre-aims where an enemy that left view should reappear, else at heard gunfire", () => {
        const w = testWorld();
        addEnemy(w, 2, { x: 20, y: 5 }, { visible: false, lastSeen: NOW - 1, vel: { x: 0, y: 4 } });
        const intent = emptyIntent("loot");
        reactToThreats(ctxOf(w, ["threats"]), intent);
        // the last-seen spot, at most half a second along its way (no radar track: COMBAT-5)
        expect(intent.lookAt).toEqual(v2.add(w.spot, { x: 20, y: 7 }));
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
