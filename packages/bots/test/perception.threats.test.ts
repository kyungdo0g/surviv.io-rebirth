// The threat board from synthetic snapshots: off-screen gunfire becomes unseen shooters and fading ghost contacts at
// the fuzzy origin the tracer gives (perception/bulletSight.ts), explosions, the kill feed and teammates' pings warm
// the area they happened in, air drops are tracked from their map marker to the opened crate, air strikes and falling
// crates are danger zones, the ring buffer keeps 64 events.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { REPORT_LIFE, ThreatTracker } from "../src/perception/threatTracker.ts";
import { bullet, crate, member, newModel, ORIGIN, player, SELF, snap } from "./perceptionSnap.ts";

function setup() {
    const model = newModel();
    const board = new ThreatTracker();
    model.threats = board;
    return { model, board };
}

const EAST = { x: 1, y: 0 };
const WEST = { x: -1, y: 0 };

describe("threat board", () => {
    it("turns bullets of an off-screen shooter into an unseen shooter and a fading ghost contact", () => {
        const { model, board } = setup();
        const origin = v2.add(ORIGIN, { x: 45, y: 3 });
        const b = bullet(50, origin, WEST, { sourceType: "ak47", bulletType: "bullet_ak47" });
        model.observe(snap(10, { bullets: [b] }));
        // placed where the tracer and the shot sound put it: behind where the tracer enters the screen, not the muzzle
        const est = model.bullets[0].origin as typeof origin;
        expect(est).not.toEqual(origin);
        expect(est.x).toBeGreaterThan(ORIGIN.x + 28);
        expect(v2.distance(est, origin)).toBeLessThan(12);
        expect(board.unseenShooters()).toEqual([{ id: 50, pos: est, lastShot: 10, shots: 1, weapon: "ak47" }]);
        const ghost = board.reported().find((r) => r.kind === "gunfire");
        expect(ghost).toMatchObject({ pos: est, reporterId: 50, type: "ak47", time: 10, confidence: 1 });
        expect(board.heat(est, 10)).toBeGreaterThan(0);
        expect(board.heat(v2.add(ORIGIN, { x: -100, y: 0 }), 10)).toBe(0);
        // the same bullet reported again when it hits someone, and an extra pellet, are not new shots
        model.observe(
            snap(10.1, {
                bullets: [
                    { ...b, hitPlayer: true, endDist: 40 },
                    { ...b, id: 9999, shotFx: false },
                ],
            }),
        );
        expect(board.unseenShooters()[0].shots).toBe(1);
        model.observe(snap(10.2, { bullets: [bullet(50, origin, WEST, { sourceType: "ak47" })] }));
        expect(board.unseenShooters()[0].shots).toBe(2);
        // the ghost fades over ~6 s, the heat with it
        const hot = board.heat(est, 10);
        model.observe(snap(10.2 + REPORT_LIFE / 2));
        expect(board.reported()[0].confidence).toBeCloseTo(0.5, 5);
        expect(board.heat(est, 10)).toBeLessThan(hot);
        model.observe(snap(10.3 + REPORT_LIFE));
        expect(board.reported()).toEqual([]);
        // still remembered as a shooter for a while, then forgotten
        expect(board.unseenShooters().length).toBe(1);
        model.observe(snap(25));
        expect(board.unseenShooters()).toEqual([]);
    });

    it("knows a shooter on screen is no unseen shooter, and ignores its own and its teammates' bullets", () => {
        const { model, board } = setup();
        const enemy = v2.add(ORIGIN, { x: 12, y: 0 });
        const mate = v2.add(ORIGIN, { x: -5, y: 0 });
        const team = [member(SELF, ORIGIN), member(8, mate)];
        model.observe(
            snap(5, {
                team,
                playerInfos: [
                    { playerId: SELF, teamId: 1, groupId: 1, name: "me" },
                    { playerId: 8, teamId: 1, groupId: 1, name: "mate" },
                ],
                objects: [player(60, enemy), player(8, mate)],
                bullets: [bullet(60, enemy, WEST), bullet(SELF, ORIGIN, EAST), bullet(8, mate, EAST)],
            }),
        );
        expect(board.unseenShooters()).toEqual([]);
        expect(board.reported()).toEqual([]);
        const events = board.events();
        expect(events.map((e) => [e.kind, e.sourceId])).toEqual([["gunfire", 60]]);
        expect(board.heat(enemy, 5)).toBeGreaterThan(0);
    });

    it("warms the place of explosions and kills, and reports teammates' pings", () => {
        const { model, board } = setup();
        const blast = v2.add(ORIGIN, { x: 20, y: 20 });
        model.observe(snap(1, { explosions: [{ type: "explosion_frag", pos: blast, layer: 0 }] }));
        model.observe(snap(1.1, { explosions: [{ type: "explosion_smoke", pos: ORIGIN, layer: 0 }] }));
        expect(board.heat(blast, 5)).toBeGreaterThan(0);
        expect(board.heat(ORIGIN, 5)).toBe(0);
        // a kill whose killer the bot saw a moment ago is placed there
        const killerPos = v2.add(ORIGIN, { x: -15, y: 4 });
        model.observe(snap(2, { objects: [player(61, killerPos)] }));
        const kill = {
            targetId: 62,
            killerId: 61,
            killCreditId: 61,
            killerKills: 1,
            damageType: 0,
            source: "gun" as const,
            itemSourceType: "mp5",
            mapSourceType: "",
            downed: false,
            killed: true,
        };
        model.observe(snap(2.1, { kills: [kill, { ...kill, targetId: 63, killerId: 99, killCreditId: 99 }] }));
        const kills = board.reported().filter((r) => r.kind === "kill");
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ pos: killerPos, reporterId: 61, type: "mp5" });
        // pings: a teammate's danger ping heats its spot, an enemy's ping means nothing
        const team = [member(SELF, ORIGIN), member(8, ORIGIN)];
        const infos = [
            { playerId: SELF, teamId: 1, groupId: 1, name: "me" },
            { playerId: 8, teamId: 1, groupId: 1, name: "mate" },
        ];
        const pingPos = v2.add(ORIGIN, { x: 0, y: -40 });
        model.observe(
            snap(3, {
                team,
                playerInfos: infos,
                emotes: [
                    { playerId: 8, type: "ping_danger", itemType: "", isPing: true, pos: pingPos },
                    { playerId: 99, type: "ping_danger", itemType: "", isPing: true, pos: ORIGIN },
                ],
            }),
        );
        const pings = board.reported().filter((r) => r.kind === "ping");
        expect(pings).toEqual([expect.objectContaining({ pos: pingPos, reporterId: 8, type: "ping_danger" })]);
        expect(board.heat(pingPos, 3)).toBeGreaterThan(0);
    });

    it("tracks an air drop from its marker to the landed crate and forgets it once opened", () => {
        const { model, board } = setup();
        const drop = v2.add(ORIGIN, { x: 30, y: -10 });
        const marker = { id: 3, type: "ping_airdrop", pos: drop, dead: false, equipped: false };
        model.observe(snap(100, { mapIndicators: [marker] }));
        expect(board.airdrops()).toEqual([{ pos: drop, seenAt: 100, landed: false, crateId: 0 }]);
        expect(board.dangerZones()).toEqual([{ kind: "airdrop", pos: drop, rad: 6, until: 108 }]);
        expect(board.heat(drop, 4)).toBeGreaterThan(0);
        // falling in view: the fall progress refines the landing time
        model.observe(
            snap(104, { mapIndicators: [marker], airdrops: [{ id: 900, pos: drop, fallT: 0.75, landed: false }] }),
        );
        expect(board.airdrops()).toHaveLength(1);
        expect(board.dangerZones()[0].until).toBeCloseTo(106, 5);
        model.observe(snap(106.5, { mapIndicators: [marker] }));
        expect(board.airdrops()[0].landed).toBe(true);
        expect(board.dangerZones()).toEqual([]);
        model.observe(snap(110, { mapIndicators: [{ ...marker, dead: true }], objects: [crate(901, drop)] }));
        expect(board.airdrops()).toEqual([{ pos: drop, seenAt: 100, landed: true, crateId: 901 }]);
        model.observe(snap(115, { objects: [crate(901, drop, false)] }));
        expect(board.airdrops()).toEqual([]);
    });

    it("keeps out of air strikes: zones and strobe markers are danger zones until they end", () => {
        const { model, board } = setup();
        const zonePos = v2.add(ORIGIN, { x: -50, y: 50 });
        const strobe = v2.add(ORIGIN, { x: 50, y: 0 });
        model.observe(
            snap(20, {
                airstrikeZones: [{ id: 1, pos: zonePos, rad: 40, duration: 30, zoneT: 0.5 }],
                mapIndicators: [{ id: 4, type: "ping_airstrike", pos: strobe, dead: false, equipped: false }],
            }),
        );
        const zones = board.dangerZones();
        expect(zones).toContainEqual({ kind: "airstrike", pos: zonePos, rad: 40, until: 35 });
        const strike = zones.find((z) => v2.distance(z.pos, strobe) < 1);
        expect(strike?.kind).toBe("airstrike");
        expect(strike?.until).toBeGreaterThan(20);
        expect(board.heat(strobe, 2)).toBeGreaterThan(0);
        model.observe(snap(40));
        expect(board.dangerZones()).toEqual([]);
        // a strike plane coming into view warms its spot once, not every snapshot it stays in view
        const plane = {
            id: 9,
            pos: v2.add(ORIGIN, { x: 30, y: 30 }),
            dir: { x: 1, y: 0 },
            planeType: "airstrike" as const,
        };
        const before = board.events().length;
        model.observe(snap(41, { planes: [{ ...plane, actionComplete: false }] }));
        model.observe(snap(41.1, { planes: [{ ...plane, actionComplete: false }] }));
        expect(board.events().length).toBe(before + 1);
        expect(board.events().at(-1)).toMatchObject({ kind: "airstrike", pos: plane.pos });
    });

    it("keeps the last 64 events and the kill leader", () => {
        const { model, board } = setup();
        for (let i = 0; i < 100; i++) {
            model.observe(
                snap(1 + i * 0.1, {
                    explosions: [{ type: "explosion_frag", pos: v2.add(ORIGIN, { x: i, y: 0 }), layer: 0 }],
                }),
            );
        }
        const events = board.events();
        expect(events).toHaveLength(64);
        expect(events[0].pos.x).toBeCloseTo(ORIGIN.x + 36, 5);
        expect(events[63].pos.x).toBeCloseTo(ORIGIN.x + 99, 5);
        model.observe(snap(20, { killLeader: { id: 77, kills: 5 } }));
        expect(board.killLeader()).toEqual({ id: 77, kills: 5 });
        model.observe(snap(21, { killLeader: { id: 0, kills: 0 } }));
        expect(board.killLeader()).toBeNull();
    });
});
