// Team play and guarding (duo / squad): a danger ping on first spotting an enemy no teammate is near (rate limited),
// teammates' pings followed as contacts (assist), focus fire on the enemy the team's bullets fly at, guarding a revive
// between the downed teammate and the threat, and smoke on the threat line before reviving under pressure.
import { type Vec2, v2 } from "@rebirth/core";
import type { BulletEvent, TeamMemberView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { airdropScore } from "../src/brain/airdrop.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { guardScore, planGuard } from "../src/brain/guard.ts";
import { fleeScore } from "../src/brain/survival.ts";
import { onLeash, planRevive, reviveScore } from "../src/brain/team.ts";
import { applyTeamplay, assistScore, focusMult, PING_DANGER, planAssist } from "../src/brain/teamplay.ts";
import { addEnemy, brainOf, FixedBoard, faceTo, NOW, type TestWorld, testWorld } from "./brain-world.ts";

function member(id: number, pos: Vec2, over: Partial<TeamMemberView> = {}): TeamMemberView {
    return { playerId: id, name: `m${id}`, health: 100, downed: false, dead: false, disconnected: false, pos, ...over };
}

/** A duo: the bot (id 1) and teammate 10 at `mateOff`. */
function duo(mateOff: Vec2, over: Partial<TeamMemberView> = {}): TestWorld {
    const w = testWorld();
    const mpos = v2.add(w.spot, mateOff);
    w.model.team = [member(1, w.spot), member(10, mpos, over)];
    w.model.teammates.add(10);
    addEnemy(w, 10, mateOff, { teammate: true, downed: !!over.downed });
    return w;
}

function bullet(from: Vec2, to: Vec2, shooterId: number): BulletEvent {
    return {
        id: 1,
        shooterId,
        bulletType: "bullet_mp5",
        sourceType: "mp5",
        pos: from,
        dir: v2.normalizeSafe(v2.sub(to, from)),
        layer: 0,
        maxDist: 100,
        reflectCount: 0,
        hitPlayer: false,
        shotFx: true,
        offHand: false,
    };
}

describe("team play", () => {
    it("pings a newly seen enemy no teammate is near, at most once per 4 s", () => {
        const w = duo({ x: -40, y: 0 });
        const e = addEnemy(w, 2, { x: 25, y: 5 }, { firstSeen: NOW - 0.2 });
        const brain = brainOf(w, ["teamplay"]);
        const intent = emptyIntent("explore");
        applyTeamplay(brain.context(NOW), intent);
        expect(intent.emote).toEqual({ type: PING_DANGER, pos: e.pos });
        addEnemy(w, 3, { x: 20, y: -10 }, { firstSeen: NOW + 1 });
        const soon = emptyIntent("explore");
        applyTeamplay(brain.context(NOW + 1.2), soon);
        expect(soon.emote).toBeUndefined();
        // the same enemy is not pinged again
        const later = emptyIntent("explore");
        w.model.contacts.get(3)!.firstSeen = NOW + 4.5;
        applyTeamplay(brain.context(NOW + 5), later);
        expect(later.emote?.pos).toEqual(w.model.contacts.get(3)!.pos);
    });

    it("does not ping an enemy a teammate stands next to, nor in solo", () => {
        const w = duo({ x: 22, y: 0 });
        addEnemy(w, 2, { x: 25, y: 5 }, { firstSeen: NOW - 0.2 });
        const intent = emptyIntent("explore");
        applyTeamplay(brainOf(w, ["teamplay"]).context(NOW), intent);
        expect(intent.emote).toBeUndefined();
        const solo = testWorld();
        addEnemy(solo, 2, { x: 25, y: 5 }, { firstSeen: NOW - 0.2 });
        const s = emptyIntent("explore");
        applyTeamplay(brainOf(solo, ["teamplay"]).context(NOW), s);
        expect(s.emote).toBeUndefined();
    });

    it("focuses the enemy the team's bullets fly at", () => {
        const w = duo({ x: -10, y: 0 });
        const a = addEnemy(w, 2, { x: 20, y: 0 });
        const b = addEnemy(w, 3, { x: 18, y: 12 });
        w.model.bullets = [bullet(v2.add(w.spot, { x: -10, y: 0 }), b.pos, 10)];
        const brain = brainOf(w, ["teamplay"]);
        applyTeamplay(brain.context(NOW), emptyIntent("fight"));
        const ctx = brain.context(NOW + 0.1);
        expect(focusMult(ctx, b)).toBe(1.3);
        expect(focusMult(ctx, a)).toBe(1);
        expect(ctx.target?.id).toBe(b.id);
        expect(focusMult(brain.context(NOW + 2), b)).toBe(1);
    });

    it("follows a teammate's danger ping (assist)", () => {
        const w = duo({ x: -30, y: 0 });
        const board = new FixedBoard();
        const at = v2.add(w.spot, { x: 45, y: 0 });
        board.reports = [{ kind: "ping", pos: at, time: NOW - 1, reporterId: 10, type: PING_DANGER }];
        w.model.threats = board;
        const brain = brainOf(w, ["teamplay"]);
        expect(assistScore(brain.context(NOW))).toBeGreaterThan(0.4);
        const plan = planAssist(brain.context(NOW));
        expect(v2.distance(plan.goal!, at)).toBeLessThan(3);
        expect(plan.lookAt).toEqual(at);
        // old pings, or pings of strangers, are ignored
        board.reports = [{ kind: "ping", pos: at, time: NOW - 20, reporterId: 10, type: PING_DANGER }];
        expect(assistScore(brain.context(NOW))).toBe(0);
        board.reports = [{ kind: "ping", pos: at, time: NOW - 1, reporterId: 99, type: PING_DANGER }];
        expect(assistScore(brain.context(NOW))).toBe(0);
    });
});

describe("guard", () => {
    it("stands 4-8 units off a revive, between the downed teammate and the threat", () => {
        const w = testWorld();
        const downedPos = v2.add(w.spot, { x: 10, y: 0 });
        const reviverPos = v2.add(w.spot, { x: 12, y: 2 });
        w.model.team = [member(1, w.spot), member(10, downedPos, { downed: true }), member(11, reviverPos)];
        w.model.teammates.add(10);
        w.model.teammates.add(11);
        addEnemy(w, 10, { x: 10, y: 0 }, { teammate: true, downed: true, reviving: true });
        addEnemy(w, 11, { x: 12, y: 2 }, { teammate: true, reviving: true });
        const threat = addEnemy(w, 2, { x: 10, y: 35 }, { lastShotAt: NOW - 1 });
        const brain = brainOf(w, ["guard"]);
        expect(guardScore(brain.context(NOW))).toBeGreaterThanOrEqual(0.8);
        const plan = planGuard(brain.context(NOW));
        const goal = plan.goal!;
        const d = v2.distance(goal, downedPos);
        expect(d).toBeGreaterThanOrEqual(3.5);
        expect(d).toBeLessThanOrEqual(8.5);
        // on the threat's side of the downed teammate
        expect(v2.distance(goal, threat.pos)).toBeLessThan(v2.distance(downedPos, threat.pos));
        expect(plan.lookAt).toEqual(threat.pos);
        // capped a little above the revive time
        expect(guardScore(brain.context(NOW + 12))).toBe(0);
    });

    it("guards nobody in solo or without a revive going on", () => {
        const w = testWorld();
        expect(guardScore(brainOf(w, ["guard"]).context(NOW))).toBe(0);
        const d = duo({ x: 10, y: 0 }, { downed: true });
        expect(guardScore(brainOf(d, ["guard"]).context(NOW))).toBe(0);
    });

    it("smokes the threat line before reviving under pressure", () => {
        const w = duo({ x: 2, y: 0 }, { downed: true });
        w.model.self.inventory.smoke = 1;
        const threat = addEnemy(w, 2, { x: 25, y: 0 });
        expect(reviveScore(brainOf(w, ["guard"]).context(NOW))).toBe(0.6);
        const smoke = planRevive(brainOf(w, ["guard"]).context(NOW));
        expect(smoke.throwPlan?.item).toBe("smoke");
        expect(v2.distance(smoke.throwPlan!.pos, threat.pos)).toBeLessThan(v2.distance(w.spot, threat.pos));
        // the baseline has no smoke plan: it does not go for the revive at all while the enemy covers the teammate
        expect(reviveScore(brainOf(w, []).context(NOW))).toBeLessThanOrEqual(0.2);
    });

    it("no revive with an enemy aiming at the downed teammate in the open, until it is safe", () => {
        const w = duo({ x: 4, y: 0 }, { downed: true });
        const enemy = addEnemy(w, 2, { x: 30, y: 6 });
        faceTo(enemy, v2.add(w.spot, { x: 4, y: 0 }));
        for (const f of [[], ["guard"]] as const) {
            // in the enemy's sights (no smoke to throw): fight or run first
            expect(reviveScore(brainOf(w, [...f]).context(NOW))).toBeLessThanOrEqual(0.2);
        }
        // a fleeing bot stays on its way: fleeing (unarmed, armed enemy close) beats the revive
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        const unarmed = brainOf(w, []).context(NOW);
        expect(fleeScore(unarmed)).toBeGreaterThan(reviveScore(unarmed));
        w.model.self.weapons[0] = { type: "mp5", ammo: 30 };
        // a smoke cloud on the line hides the teammate: revive
        w.model.smokes = [{ id: 1, pos: v2.add(w.spot, { x: 14, y: 2 }), rad: 6, layer: 0, interior: false }];
        expect(reviveScore(brainOf(w, []).context(NOW))).toBeGreaterThan(0.8);
        w.model.smokes = [];
        // the enemy gone for a few seconds: revive
        enemy.visible = false;
        enemy.lastSeen = NOW - 3;
        expect(reviveScore(brainOf(w, []).context(NOW))).toBeGreaterThan(0.8);
        // just hit: not now
        w.model.lastHurt = NOW - 0.5;
        expect(reviveScore(brainOf(w, []).context(NOW))).toBeLessThanOrEqual(0.2);
    });

    it("a follower's own errands stay within 30 units of its leader; the leader and solo bots go anywhere", () => {
        // the bot (id 1) follows teammate 0 (the lowest id leads)
        const w = testWorld();
        w.model.team = [
            { playerId: 0, name: "lead", health: 100, downed: false, dead: false, disconnected: false, pos: w.spot },
            { playerId: 1, name: "me", health: 100, downed: false, dead: false, disconnected: false, pos: w.spot },
        ];
        const ctx = brainOf(w, ["airdrop"]).context(NOW);
        expect(onLeash(ctx, v2.add(w.spot, { x: 20, y: 0 }))).toBe(true);
        expect(onLeash(ctx, v2.add(w.spot, { x: 60, y: 0 }))).toBe(false);
        // an air drop 60 units off is left to the leader
        const board = new FixedBoard();
        board.drops = [{ pos: v2.add(w.spot, { x: 60, y: 0 }), seenAt: NOW - 1, landed: true, crateId: 0 }];
        w.model.threats = board;
        expect(airdropScore(brainOf(w, ["airdrop"]).context(NOW))).toBe(0);
        // the leader goes
        w.model.team[0].playerId = 5;
        expect(airdropScore(brainOf(w, ["airdrop"]).context(NOW))).toBeGreaterThan(0.3);
        // solo
        w.model.team = [];
        expect(onLeash(brainOf(w, []).context(NOW), v2.add(w.spot, { x: 200, y: 0 }))).toBe(true);
    });
});
