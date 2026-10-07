// Air drops (BrainFeatures.airdrop): a drop the bot can reach in time is approached; with gunfire around it the bot
// stops in cover 15-25 units off and scans for 3-6 s first, otherwise it walks straight in; an unarmed bot leaves
// contested drops alone; a hot drop and one it cannot reach in time are skipped; the bot knows drops from its own
// snapshots (perception/airdrops.ts, every brain). Threat reactions are brain-threats.test.ts (COMBAT). Owner: LOOT.
import { v2 } from "@rebirth/core";
import type { Snapshot } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { airdropScore, planAirdrop } from "../src/brain/airdrop.ts";
import { AirdropMemory } from "../src/perception/airdrops.ts";
import { brainOf, ctxOf, FixedBoard, NOW, testWorld } from "./brain-world.ts";

describe("air drops", () => {
    it("with gunfire around: approaches to 15-25 units, scans, then goes for the crate; capped", () => {
        const w = testWorld();
        const drop = v2.add(w.spot, { x: 70, y: 0 });
        const board = new FixedBoard();
        board.drops = [{ pos: drop, seenAt: NOW - 1, landed: true, crateId: 0 }];
        board.hot = [{ pos: v2.add(drop, { x: 5, y: 0 }), heat: 1 }];
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
        // capped at 45 s from the landing, then left alone for a while
        expect(airdropScore(brain.context(NOW + 50))).toBe(0);
        expect(airdropScore(brain.context(NOW + 60))).toBe(0);
    });

    it("quiet around the drop: walks straight in", () => {
        const w = testWorld();
        const drop = v2.add(w.spot, { x: 70, y: 0 });
        const board = new FixedBoard();
        board.drops = [{ pos: drop, seenAt: NOW - 1, landed: true, crateId: 0 }];
        w.model.threats = board;
        const brain = brainOf(w, ["airdrop"]);
        expect(airdropScore(brain.context(NOW))).toBeGreaterThan(0.3);
        const go = planAirdrop(brain.context(NOW));
        expect(brain.mem.smart.airdropState).toBe("loot");
        expect(v2.distance(go.goal!, drop)).toBeLessThan(5);
    });

    it("unarmed, leaves contested drops alone", () => {
        const w = testWorld();
        const board = new FixedBoard();
        board.drops = [{ pos: v2.add(w.spot, { x: 40, y: 0 }), seenAt: NOW - 1, landed: true, crateId: 0 }];
        w.model.threats = board;
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBeGreaterThan(0.3);
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBe(0);
    });

    it("skips a hot drop and one it cannot reach in time; a full loadout still goes", () => {
        const w = testWorld();
        const drop = v2.add(w.spot, { x: 70, y: 0 });
        const board = new FixedBoard();
        board.drops = [{ pos: drop, seenAt: NOW - 1, landed: true, crateId: 0 }];
        board.hot = [{ pos: drop, heat: 10 }];
        w.model.threats = board;
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBe(0);
        board.hot = [];
        // landed 250 units away: a 29 s run, others get there first
        board.drops = [{ pos: v2.add(w.spot, { x: 250, y: 0 }), seenAt: NOW - 1, landed: true, crateId: 0 }];
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBe(0);
        // kitted (two guns, armour, backpack): the drop is still worth it (the old score shrank with the loot need)
        board.drops = [{ pos: drop, seenAt: NOW - 1, landed: true, crateId: 0 }];
        Object.assign(w.model.self, { helmet: "helmet02", chest: "chest02", backpack: "backpack03" });
        w.model.self.weapons[1] = { type: "m870", ammo: 5 };
        w.model.self.inventory["12gauge"] = 30;
        expect(airdropScore(ctxOf(w, ["airdrop"]))).toBeGreaterThan(0.4);
    });

    it("every brain remembers drops from its snapshots: the marker, the falling crate, the landing", () => {
        const w = testWorld();
        const mem = new AirdropMemory();
        const pos = v2.add(w.spot, { x: 120, y: 30 });
        const snap = (over: Partial<Snapshot>) => over as Snapshot;
        w.model.time = 10;
        mem.ingest(
            snap({ mapIndicators: [{ id: 1, type: "ping_airdrop", pos, dead: false, equipped: false }] }),
            w.model,
        );
        expect(mem.known()).toHaveLength(1);
        expect(mem.known()[0].stage).toBe("marked");
        expect(mem.known()[0].landsAt).toBeCloseTo(18, 3);
        // the marker dies after its 10 s life: the drop stays known
        w.model.time = 12;
        mem.ingest(
            snap({ mapIndicators: [{ id: 1, type: "ping_airdrop", pos, dead: true, equipped: false }] }),
            w.model,
        );
        mem.ingest(snap({ airdrops: [{ id: 9, pos, fallT: 0.5, landed: false }] }), w.model);
        expect(mem.known()[0].stage).toBe("falling");
        w.model.time = 19;
        mem.ingest(snap({}), w.model);
        expect(mem.known()[0].stage).toBe("landed");
        expect(mem.open()).toHaveLength(1);
        // and the smart behaviour reads it without the threat board
        const b = testWorld();
        b.model.time = NOW;
        (b.model.airdrops as AirdropMemory).ingest(
            snap({
                mapIndicators: [
                    { id: 2, type: "ping_airdrop", pos: v2.add(b.spot, { x: 60, y: 0 }), dead: false, equipped: false },
                ],
            }),
            b.model,
        );
        expect(airdropScore(ctxOf(b, ["airdrop"]))).toBeGreaterThan(0.3);
    });
});
