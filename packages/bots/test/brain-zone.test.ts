// Zone targets (brain/survival.ts): they lie deep enough in small circles to end the rotation, and with the threat
// board the bot rotates into the zone around a hot area. Split out of brain-idlefix.test.ts and brain-airdrop.test.ts
// in the bot overhaul's stage 0. Owner: MOVE.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { coolZoneTarget, planZone, zoneTarget } from "../src/brain/survival.ts";
import { ctxOf, FixedBoard, setGas, testWorld } from "./brain-world.ts";

describe("zone targets", () => {
    it("zone targets end the rotation inside the margin the zone behaviour lets go at", () => {
        for (const rad of [12, 20, 30, 60, 150]) {
            const w = testWorld();
            setGas(w, { x: 300, y: 0 }, rad, "moving");
            const gas = w.model.gas!;
            for (const jitter of [0, 0.5, 0.99]) {
                const t = zoneTarget(w.model, jitter);
                // arriving within 3 units of the target puts the bot inside rad - min(14, 0.4 rad)
                expect(v2.distance(t, gas.posNew) + 3).toBeLessThan(rad - Math.min(14, rad * 0.4) + 0.75);
            }
        }
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
});
