// The 50v50 faction brain on synthetic worlds (bot round 6): faction perception (allies never targets, shared boards),
// the front estimate, squad spacing, the no-solo-crossing rule, push / fall back by local numbers, the Medic's and the
// Bugler's decisions, reviving any downed faction member, and the brain staying inert off faction maps.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { FACTION_TUNING, factionOf, favourable, localOdds, outnumbered } from "../src/brain/factionCtx.ts";
import { factionScores } from "../src/brain/factionFight.ts";
import { defaultFront, objective } from "../src/brain/factionFront.ts";
import { factionDowned, planSelfRevive } from "../src/brain/factionRevive.ts";
import { bugleSlot, medicHealItem, wantsBugle } from "../src/brain/factionRoles.ts";
import { formationSlot, guardCrossing, rallyScore } from "../src/brain/factionSquad.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { FactionBoard, SquadBoard } from "../src/perception/factionBoard.ts";
import { FactionIntel } from "../src/perception/factionIntel.ts";
import { crossesRiver, factionMapOf, riverSide } from "../src/perception/factionMap.ts";
import { ThreatTracker } from "../src/perception/threatTracker.ts";
import { addEnemy, brainOf, ctxOf, giveGun, NOW, testWorld } from "./brain-world.ts";
import { FACTION_MAP, factionWorld, kit, RIVER_WIDTH, RIVER_X, row, SPOT, stubSnap, TEAM } from "./faction-world.ts";

describe("faction perception", () => {
    it("knows its faction, squad, role and side; faction members are never targets", () => {
        const w = factionWorld({ mates: [{ x: -6, y: 0 }], allies: [{ off: { x: -10, y: 8 } }], role: "medic" });
        expect(w.fi.team).toBe(1);
        expect(w.fi.group).toBe(5);
        expect(w.fi.role).toBe("medic");
        expect(w.fi.side).toBe(1);
        // a faction member outside the squad on the screen is a teammate contact (WorldModel.isTeammate: same team)
        w.model.team.push({ ...w.model.team[0], playerId: 99 });
        w.model.teamOf.set(20, 1);
        expect(w.model.isTeammate(20)).toBe(true);
        addEnemy(w, 20, { x: 12, y: 0 }, { teammate: true });
        const e = addEnemy(w, 30, { x: 18, y: 4 });
        const ctx = ctxOf(w, ["faction"]);
        expect(ctx.enemies.map((c) => c.id)).toEqual([e.id]);
        expect(ctx.target?.id).toBe(e.id);
    });

    it("files its own sightings on the squad board and reads the faction's knocks, deaths and Commander pings", () => {
        const w = factionWorld({ mates: [{ x: -6, y: 0 }] });
        addEnemy(w, 30, { x: 60, y: 0 });
        w.fi.ingest(stubSnap(), w.model);
        expect(w.fi.squadBoard?.sightings.get(30)?.pos).toEqual(v2.add(SPOT, { x: 60, y: 0 }));
        // a squadmate's own board is the same object (shared per squad)
        expect(w.boards.squad(5)).toBe(w.fi.squadBoard);
        // a faction member knocked on the minimap is a front event
        const fb = w.fi.factionBoard as FactionBoard;
        const at = v2.add(SPOT, { x: 50, y: 30 });
        const teamOf = (id: number) => (id === 40 ? TEAM : id === 70 ? TEAM + 1 : undefined);
        fb.fileStatus([row(40, at)], NOW + 1, teamOf);
        fb.fileStatus([row(40, at, { downed: true })], NOW + 1.5, teamOf);
        expect(fb.events.map((e) => e.kind)).toEqual(["knock"]);
        expect(w.fi.downedAllies().map((r) => r.playerId)).toEqual([40]);
        // sim schema 18: an enemy shooter revealed on the minimap for 1 s rides in the same rows: a front event where it
        // fired, never an ally (not even downed); a row of unknown team is skipped
        const shooter = v2.add(SPOT, { x: 80, y: -20 });
        fb.fileStatus(
            [row(40, at, { downed: true }), row(70, shooter, { downed: true }), row(71, shooter)],
            NOW + 2,
            teamOf,
        );
        expect(fb.events.map((e) => e.kind)).toEqual(["knock", "reveal"]);
        expect(fb.events[1].pos).toEqual(shooter);
        expect(w.fi.downedAllies().map((r) => r.playerId)).toEqual([40]);
        expect(fb.members.has(70) || fb.members.has(71)).toBe(false);
        // still on the list half a second later: one event per second
        fb.fileStatus([row(70, shooter)], NOW + 2.5, teamOf);
        expect(fb.events.length).toBe(2);
    });
});

describe("friendly information", () => {
    it("a faction member's bullets, shots and kills are no threat: its kills go to the faction front", () => {
        const w = factionWorld({ allies: [{ off: { x: 30, y: 10 } }] });
        const board = new ThreatTracker();
        w.model.threats = board;
        // ally 20 (another squad) fires past the bot from off the screen
        w.model.bullets = [
            {
                id: 77,
                shooterId: 20,
                bulletType: "bullet_mp5",
                sourceType: "mp5",
                pos: v2.add(SPOT, { x: -20, y: 1 }),
                dir: { x: 1, y: 0 },
                layer: 0,
                maxDist: 100,
                reflectCount: 0,
                hitPlayer: false,
                shotFx: true,
                offHand: false,
            },
        ];
        const kill = {
            targetId: 99,
            killerId: 20,
            killCreditId: 20,
            killerKills: 1,
            damageType: 0,
            source: "gun" as const,
            itemSourceType: "mp5",
            mapSourceType: "",
            downed: false,
            killed: true,
        };
        board.ingest(stubSnap({ kills: [kill] }), w.model);
        expect(board.unseenShooters()).toEqual([]);
        expect(board.reported()).toEqual([]);
        expect(board.events().length).toBe(0);
        w.fi.ingest(stubSnap({ kills: [kill] }), w.model);
        expect(w.fi.factionBoard?.events.map((e) => e.kind)).toEqual(["kill"]);
    });
});

describe("front estimate", () => {
    it("the faction front is the recency-weighted centre of its knocks, deaths, kills and Commander pings", () => {
        const fb = new FactionBoard(1);
        expect(fb.front(NOW)).toBeNull();
        fb.fileKill(5, 77, { x: 100, y: 100 }, NOW);
        fb.filePing(6, { x: 140, y: 100 }, NOW, "ping_danger");
        const f = fb.front(NOW + 0.6) as { x: number; y: number };
        expect(f.y).toBeCloseTo(100);
        // the ping weighs 2, the kill 1.5 (both fresh): nearer the ping
        expect(f.x).toBeGreaterThan(120);
        expect(f.x).toBeLessThan(140);
        // old evidence fades out
        expect(fb.front(NOW + 60)).toBeNull();
        // the faction fights in two places: a squad takes the fight nearest to it, not the middle between them
        const two = new FactionBoard(1);
        two.fileKill(5, 70, { x: 100, y: 100 }, NOW);
        two.fileKill(6, 71, { x: 104, y: 100 }, NOW);
        two.fileKill(7, 72, { x: 600, y: 600 }, NOW);
        two.fileKill(8, 73, { x: 604, y: 600 }, NOW);
        const mid = two.front(NOW) as { x: number; y: number };
        expect(mid.x).toBeCloseTo(352);
        const near = two.frontNear({ x: 150, y: 130 }, NOW) as { x: number; y: number };
        expect(near.x).toBeCloseTo(102, 0);
        expect(two.frontNear({ x: 350, y: 350 }, NOW)).toBeNull();
    });

    it("the squad front is where the squad saw its standing enemies lately, ahead of the faction's", () => {
        const sb = new SquadBoard(5);
        sb.see(30, { x: 200, y: 50 }, NOW, false, 1);
        sb.see(31, { x: 210, y: 60 }, NOW, false, 2);
        sb.see(32, { x: 0, y: 0 }, NOW, true, 2);
        const f = sb.front(NOW) as { x: number; y: number };
        expect(f.x).toBeCloseTo(205);
        expect(f.y).toBeCloseTo(55);
        sb.prune(NOW + 20);
        expect(sb.front(NOW + 20)).toBeNull();
        const w = factionWorld();
        w.fi.factionBoard?.fileKill(5, 77, v2.add(SPOT, { x: 0, y: 90 }), NOW);
        expect(w.fi.front(NOW)).toEqual(w.fi.factionBoard?.front(NOW));
        w.fi.squadBoard?.see(30, v2.add(SPOT, { x: 70, y: 0 }), NOW, false, 1);
        expect(w.fi.front(NOW)).toEqual(v2.add(SPOT, { x: 70, y: 0 }));
    });

    it("with no enemy known the front is the river bank; the objective holds on the faction's side of it", () => {
        const w = factionWorld();
        giveGun(w, 0, "ak47", 30, 120);
        const ctx = ctxOf(w, ["faction"]);
        const f = defaultFront(ctx, SPOT);
        expect(f.x).toBeCloseTo(RIVER_X);
        const obj = objective(ctx, SPOT);
        expect(obj).not.toBeNull();
        // on the own (left) bank, out of the water
        expect(obj?.pos.x).toBeLessThan(RIVER_X - RIVER_WIDTH / 2);
        expect(obj?.push).toBe(false);
    });

    it("pushes with 1.5 allies per enemy around, falls back when clearly outnumbered", () => {
        expect(favourable({ allies: 4, enemies: 2 })).toBe(true);
        expect(favourable({ allies: 2, enemies: 1 })).toBe(false);
        expect(outnumbered({ allies: 1, enemies: 2 })).toBe(true);
        expect(outnumbered({ allies: 3, enemies: 3 })).toBe(false);
        const strong = factionWorld({
            mates: [
                { x: -4, y: 3 },
                { x: -4, y: -3 },
                { x: -8, y: 0 },
            ],
        });
        giveGun(strong, 0, "ak47", 30, 120);
        strong.fi.squadBoard?.see(30, v2.add(SPOT, { x: 25, y: 0 }), NOW, false, 10);
        const push = objective(ctxOf(strong, ["faction"]), SPOT);
        expect(push?.push).toBe(true);
        // a push closes to 12 u of the enemy (the hold is at rifle range: 24 u)
        expect(v2.distance(push?.pos ?? SPOT, v2.add(SPOT, { x: 25, y: 0 }))).toBeLessThan(15);
        const weak = factionWorld();
        giveGun(weak, 0, "ak47", 30, 120);
        for (const [id, y] of [
            [30, 0],
            [31, 5],
            [32, -5],
        ])
            weak.fi.squadBoard?.see(id, v2.add(SPOT, { x: 25, y }), NOW, false, 1);
        const back = objective(ctxOf(weak, ["faction"]), SPOT);
        expect(back?.fallback).toBe(true);
        expect(back?.pos.x).toBeLessThan(SPOT.x);
    });

    it("an unprovoked fight is taken with the numbers", () => {
        const strong = factionWorld({
            mates: [
                { x: -4, y: 3 },
                { x: -4, y: -3 },
                { x: -8, y: 0 },
            ],
        });
        giveGun(strong, 0, "ak47", 30, 120);
        addEnemy(strong, 30, { x: 30, y: 0 }, { firstSeen: NOW - 5 });
        const ctx = ctxOf(strong, ["faction"]);
        expect(localOdds(ctx)).toEqual({ allies: 4, enemies: 1 });
        const opts: Array<[import("../src/brain/context.ts").BehaviourName, number, () => never]> = [
            ["fight", 0.4, () => undefined as never],
            ["regroup", 0.6, () => undefined as never],
        ];
        factionScores(ctx, opts);
        expect(opts[0][1]).toBeCloseTo(0.55);
        // the faction's formation replaces the squad regroup
        expect(opts[1][1]).toBe(0);
        const weak = factionWorld();
        giveGun(weak, 0, "ak47", 30, 120);
        for (const [id, y] of [
            [30, 0],
            [31, 4],
            [32, -4],
        ])
            addEnemy(weak, id, { x: 28, y }, { firstSeen: NOW - 5 });
        const wctx = ctxOf(weak, ["faction"]);
        const wopts: Array<[import("../src/brain/context.ts").BehaviourName, number, () => never]> = [
            ["fight", 0.6, () => undefined as never],
        ];
        // outnumbered: the fight is left as it is (holding fire in front of enemies lost big battles: the squad falls
        // back through its objective instead); the old cap stays behind FACTION_TUNING.outnumberedCap
        factionScores(wctx, wopts);
        expect(wopts[0][1]).toBe(0.6);
        FACTION_TUNING.outnumberedCap = true;
        factionScores(wctx, wopts);
        FACTION_TUNING.outnumberedCap = false;
        expect(wopts[0][1]).toBe(0.3);
    });
});

describe("squad cohesion", () => {
    it("followers keep distinct slots a few units behind and beside the leader", () => {
        const leaderOff = { x: 0, y: 0 };
        const slots = [];
        // the bot is the follower ranked 0..2 (ids 11, 12, 13 with the leader 10)
        for (const self of [11, 12, 13]) {
            const w = factionWorld({
                mates: [
                    { x: 6, y: 0 },
                    { x: 0, y: 6 },
                    { x: 0, y: -6 },
                ],
            });
            // renumber: the leader is the lowest id; make the bot's id `self`
            w.model.selfId = self;
            w.model.self.id = self;
            w.model.team = [
                { ...w.model.team[1], playerId: 10 },
                { ...w.model.team[0], playerId: self },
                ...[11, 12, 13].filter((id) => id !== self).map((id, i) => ({ ...w.model.team[2 + i], playerId: id })),
            ];
            w.model.teammates.clear();
            for (const m of w.model.team) if (m.playerId !== self) w.model.teammates.add(m.playerId);
            const ctx = ctxOf(w, ["faction"]);
            const leader = w.model.team[0].pos;
            slots.push(formationSlot(ctx, 10, v2.add(leader, leaderOff)));
            // every slot is behind the leader (towards the faction's own side: -x) and within 13 u
            const s = slots[slots.length - 1];
            expect(s.x).toBeLessThan(leader.x);
            expect(v2.distance(s, leader)).toBeLessThan(14);
        }
        for (let i = 0; i < slots.length; i++)
            for (let j = i + 1; j < slots.length; j++) expect(v2.distance(slots[i], slots[j])).toBeGreaterThan(5);
    });

    it("a follower far from its leader rallies; in its slot it holds rather than wanders", () => {
        const far = factionWorld({ mates: [{ x: -40, y: 0 }] });
        // the bot (id 1) is the leader of a squad with mate 10: make the mate the leader
        far.model.selfId = 12;
        far.model.self.id = 12;
        far.model.team = [
            { ...far.model.team[1], playerId: 10 },
            { ...far.model.team[0], playerId: 12 },
        ];
        far.model.teammates.clear();
        far.model.teammates.add(10);
        giveGun(far, 0, "ak47", 30, 120);
        expect(rallyScore(ctxOf(far, ["faction"]))).toBeGreaterThanOrEqual(0.5);
        const near = factionWorld({ mates: [{ x: 4, y: 7 }] });
        near.model.selfId = 12;
        near.model.self.id = 12;
        near.model.team = [
            { ...near.model.team[1], playerId: 10 },
            { ...near.model.team[0], playerId: 12 },
        ];
        near.model.teammates.clear();
        near.model.teammates.add(10);
        giveGun(near, 0, "ak47", 30, 120);
        // the squad still loots (no call from the leader): within the leash it loots and explores freely
        kit(near);
        expect(rallyScore(ctxOf(near, ["faction"]))).toBe(0);
        // the leader calls the squad to the front: formation
        const sb = near.fi.squadBoard;
        if (sb)
            sb.plan = {
                leader: 10,
                objective: v2.add(SPOT, { x: 20, y: 0 }),
                front: v2.add(SPOT, { x: 40, y: 0 }),
                time: NOW,
            };
        const s = rallyScore(ctxOf(near, ["faction"]));
        expect(s).toBeGreaterThan(0.12);
        expect(s).toBeLessThan(0.2);
    });
});

describe("no solo crossing", () => {
    const across = v2.add(SPOT, { x: 80, y: 0 });
    const cluster = (w: ReturnType<typeof factionWorld>) => {
        addEnemy(w, 30, { x: 75, y: 3 });
        addEnemy(w, 31, { x: 78, y: -4 });
    };

    it("crosses the river by a straight line test, bank to bank", () => {
        const geo = factionMapOf(FACTION_MAP);
        expect(geo).not.toBeNull();
        if (!geo) return;
        expect(riverSide(geo, SPOT)).toBeGreaterThan(0);
        expect(crossesRiver(geo, SPOT, across)).toBe(true);
        expect(crossesRiver(geo, SPOT, v2.add(SPOT, { x: 20, y: 30 }))).toBe(false);
    });

    it("a lone bot does not go over the river to a known enemy cluster: it holds its own bank by the crossing", () => {
        const w = factionWorld();
        cluster(w);
        const intent = emptyIntent("explore");
        intent.goal = v2.copy(across);
        guardCrossing(ctxOf(w, ["faction"]), intent);
        expect(intent.goal).not.toEqual(across);
        expect(intent.goal?.x ?? 0).toBeLessThan(RIVER_X - RIVER_WIDTH / 2);
        expect(intent.lookAt?.x ?? 0).toBeGreaterThan(RIVER_X);
    });

    it("crosses with two squadmates beside it, with no enemy known over there, or when the gas presses", () => {
        const backed = factionWorld({
            mates: [
                { x: -3, y: 4 },
                { x: -3, y: -4 },
            ],
        });
        cluster(backed);
        const a = emptyIntent("advance");
        a.goal = v2.copy(across);
        guardCrossing(ctxOf(backed, ["faction"]), a);
        expect(a.goal).toEqual(across);
        const quiet = factionWorld();
        const b = emptyIntent("explore");
        b.goal = v2.copy(across);
        guardCrossing(ctxOf(quiet, ["faction"]), b);
        expect(b.goal).toEqual(across);
        const fleeing = factionWorld();
        cluster(fleeing);
        const c = emptyIntent("evacuate");
        c.goal = v2.copy(across);
        guardCrossing(ctxOf(fleeing, ["faction"]), c);
        expect(c.goal).toEqual(across);
    });
});

describe("roles", () => {
    it("the Medic revives any downed faction member near it, farther than anyone else, and heals the squad", () => {
        const w = factionWorld({ allies: [{ off: { x: 50, y: 10 }, downed: true }], role: "medic" });
        const ctx = ctxOf(w, ["faction"]);
        expect(factionDowned(ctx)?.playerId).toBe(20);
        // not a medic: 50 u is too far for a faction member outside the squad
        const plain = factionWorld({ allies: [{ off: { x: 50, y: 10 }, downed: true }] });
        expect(factionDowned(ctxOf(plain, ["faction"]))).toBeUndefined();
        const near = factionWorld({ allies: [{ off: { x: 20, y: 0 }, downed: true }] });
        expect(factionDowned(ctxOf(near, ["faction"]))?.playerId).toBe(20);
        // ...unless another standing ally is clearly closer to it
        const crowd = factionWorld({ allies: [{ off: { x: 20, y: 0 }, downed: true }, { off: { x: 22, y: 2 } }] });
        expect(factionDowned(ctxOf(crowd, ["faction"]))).toBeUndefined();
        // the Medic's revive outranks everything but the gas
        const opts: Array<[import("../src/brain/context.ts").BehaviourName, number, () => never]> = [
            ["revive", 0.88, () => undefined as never],
        ];
        factionScores(ctx, opts);
        expect(opts[0][1]).toBeGreaterThan(0.95);
        // a hurt squadmate next to the Medic gets a heal (Mass Medicate reaches 8 u)
        const heal = factionWorld({ mates: [{ x: 3, y: 2 }], mateHealth: [40], role: "medic" });
        heal.model.self.inventory.bandage = 10;
        expect(medicHealItem(ctxOf(heal, ["faction"]))).toBe("bandage");
        const healthy = factionWorld({ mates: [{ x: 3, y: 2 }], role: "medic" });
        healthy.model.self.inventory.bandage = 10;
        expect(medicHealItem(ctxOf(healthy, ["faction"]))).toBe("");
    });

    it("a downed Medic revives itself when no enemy is in its face", () => {
        const w = factionWorld({ role: "medic", perks: ["aoe_heal", "self_revive"] });
        w.model.self.downed = true;
        const intent = planSelfRevive(ctxOf(w, ["faction"]));
        expect(intent?.actions.length).toBe(1);
        addEnemy(w, 30, { x: 10, y: 0 });
        expect(planSelfRevive(ctxOf(w, ["faction"]))).toBeNull();
    });

    it("the Bugler plays with three allies around and a fight near, never with an enemy in its face", () => {
        const bugler = (allies: number) =>
            factionWorld({
                role: "bugler",
                allies: Array.from({ length: allies }, (_, i) => ({ off: { x: -5 - i * 3, y: 4 } })),
            });
        const w = bugler(3);
        w.model.self.weapons[1] = { type: "bugle", ammo: 1 };
        giveGun(w, 0, "ak47", 30, 120);
        addEnemy(w, 30, { x: 45, y: 0 }, { lastSeen: NOW - 2, visible: false });
        const ctx = ctxOf(w, ["faction"]);
        expect(bugleSlot(ctx)).toBe(1);
        expect(wantsBugle(ctx, emptyIntent("advance"))).toBe(true);
        const alone = bugler(1);
        alone.model.self.weapons[1] = { type: "bugle", ammo: 1 };
        addEnemy(alone, 30, { x: 45, y: 0 }, { lastSeen: NOW - 2, visible: false });
        expect(wantsBugle(ctxOf(alone, ["faction"]), emptyIntent("advance"))).toBe(false);
        addEnemy(w, 31, { x: 10, y: 0 });
        expect(wantsBugle(ctxOf(w, ["faction"]), emptyIntent("advance"))).toBe(false);
        // no charge, no call
        const empty = bugler(3);
        empty.model.self.weapons[1] = { type: "bugle", ammo: 0 };
        expect(bugleSlot(ctxOf(empty, ["faction"]))).toBe(-1);
    });
});

describe("outside faction maps", () => {
    it("the faction brain stays inert: no intel, no options, no score changes", () => {
        const w = testWorld();
        const fi = new FactionIntel(w.model.map);
        expect(fi.active).toBe(false);
        expect(factionMapOf(w.model.map)).toBeNull();
        w.model.faction = fi;
        const ctx = brainOf(w, BRAIN_PRESETS.smart).context(NOW);
        expect(factionOf(ctx)).toBeNull();
        const opts: Array<[import("../src/brain/context.ts").BehaviourName, number, () => never]> = [
            ["regroup", 0.6, () => undefined as never],
        ];
        factionScores(ctx, opts);
        expect(opts[0][1]).toBe(0.6);
        // and off with the flag, on the faction map
        const f = factionWorld();
        expect(factionOf(ctxOf(f, ["pursuit"]))).toBeNull();
    });
});
