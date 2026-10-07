// Running away, danger memory, items and revives with BrainFeatures.pursuit (bot overhaul MOVE-3/5/6/7): a threat
// counts only while it chases the bot, the flight radius follows its gun, an unarmed bot runs to a gun that is not
// towards the threat and to cover that breaks the line of fire, armed bots fight a brawl out; places the bot was
// chased out of are avoided; an item use under fire is cancelled, boosts wait for safety, the zone score has no edge;
// an enemy covering a downed teammate is remembered after it left view. Owner: MOVE.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import type { BuildingView, TeamMemberView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { avoidPos, dangerToLeave, noteDanger } from "../src/brain/danger.ts";
import { flightScore, planFlight } from "../src/brain/flight.ts";
import { fleeScore, healItem, healScore, planHeal, planZone, zoneScore } from "../src/brain/survival.ts";
import { planRevive, regroupScore, reviveScore, reviveThreat } from "../src/brain/team.ts";
import type { Contact } from "../src/perception/world.ts";
import {
    addEnemy,
    addObstacle,
    brainOf,
    ctxOf,
    faceTo,
    giveGun,
    NOW,
    setGas,
    type TestWorld,
    testWorld,
} from "./brain-world.ts";

/** A bot with no gun. */
function unarmedWorld(): TestWorld {
    const w = testWorld();
    w.model.self.weapons[0] = { type: "", ammo: 0 };
    return w;
}

/** An armed enemy (ak47) `off` from the bot, facing it unless told otherwise. */
function gunman(w: TestWorld, off: Vec2, facing = true, over: Partial<Contact> = {}): Contact {
    const e = addEnemy(w, 2, off, { activeWeapon: "ak47", ...over });
    faceTo(e, facing ? w.spot : v2.add(e.pos, v2.sub(e.pos, w.spot)));
    return e;
}

describe("flight", () => {
    it("runs only from an enemy that chases it, not from one busy elsewhere", () => {
        const w = unarmedWorld();
        const e = gunman(w, { x: 25, y: 0 }, false);
        // the baseline runs from every armed enemy within 35 units
        expect(fleeScore(ctxOf(w, []))).toBe(0.8);
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0);
        // it turns to face the bot, or walks at it, or shoots at it: run
        faceTo(e, w.spot);
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0.8);
        faceTo(e, v2.add(e.pos, { x: 10, y: 0 }));
        e.vel = { x: -6, y: 0 };
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0.8);
        e.vel = { x: 0, y: 0 };
        w.model.underFire = { time: NOW - 0.5, from: e.pos, shooterId: 2 };
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0.8);
    });

    it("takes the flight radius from the threat's gun, larger once running", () => {
        const w = unarmedWorld();
        const e = gunman(w, { x: 26, y: 0 }, true, { activeWeapon: "m870" });
        // a shotgun reaches 14 units: 22 units of flight radius
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0);
        e.pos = v2.add(w.spot, { x: 20, y: 0 });
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0.8);
        // already running: on to 28 units
        e.pos = v2.add(w.spot, { x: 26, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        brain.mem.current = "flee";
        brain.mem.currentSince = NOW - 1;
        expect(fleeScore(brain.context(NOW))).toBe(0.8);
    });

    it("an unarmed bot runs to a gun that is not towards the threat, and lets the loot behaviour take it", () => {
        const w = unarmedWorld();
        gunman(w, { x: 20, y: 0 });
        const towards = v2.add(w.spot, { x: 8, y: 2 });
        const behind = v2.add(w.spot, { x: -15, y: 3 });
        w.model.loot.set(50, { id: 50, type: "mp5", pos: towards, count: 1, layer: 0, lastSeen: NOW });
        w.model.loot.set(51, { id: 51, type: "ak47", pos: behind, count: 1, layer: 0, lastSeen: NOW });
        const intent = planFlight(ctxOf(w, ["pursuit"]));
        expect(intent.goal).toEqual(behind);
        // on it: picked up on the run
        w.model.loot.get(51)!.pos = v2.add(w.spot, { x: -1, y: 0 });
        expect(flightScore(ctxOf(w, ["pursuit"]))).toBe(0.8);
        const pick = planFlight(ctxOf(w, ["pursuit"]));
        expect(pick.behaviour).toBe("flee");
        expect(pick.actions).toContain(Input.Loot);
    });

    it("runs to cover that breaks the line of fire, away from the threat, and holds there", () => {
        const w = unarmedWorld();
        const e = gunman(w, { x: 22, y: 0 });
        addObstacle(w, { x: -6, y: 0 }, "stone_01");
        const brain = brainOf(w, ["pursuit"]);
        const intent = planFlight(brain.context(NOW));
        expect(intent.goal).not.toBeNull();
        const goal = intent.goal as Vec2;
        expect(goal.x).toBeLessThan(w.spot.x - 6);
        expect(w.model.lineOfFire(e.pos, goal)).toBe(false);
        // there: hold
        w.model.self.pos = v2.copy(goal);
        const hold = planFlight(brain.context(NOW + 1));
        expect(hold.stop).toBe(true);
    });

    it("punches back an armed chaser that holds its fists within reach", () => {
        const w = unarmedWorld();
        gunman(w, { x: 3, y: 0 }, true, { activeWeapon: "fists", lastArmedAt: NOW - 2 });
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0.3);
        expect(fleeScore(ctxOf(w, []))).toBe(0.5);
    });

    it("armed and hurt, it fights a brawl out instead of giving free shots, and runs from a far threat", () => {
        const w = testWorld();
        w.model.self.health = 20;
        w.model.self.inventory.bandage = 2;
        const e = gunman(w, { x: 8, y: 0 });
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0);
        expect(fleeScore(ctxOf(w, []))).toBe(0.72);
        e.pos = v2.add(w.spot, { x: 25, y: 0 });
        expect(fleeScore(ctxOf(w, ["pursuit"]))).toBe(0.72);
    });

    it("stops running from an armed player that only looks at it", () => {
        const w = unarmedWorld();
        gunman(w, { x: 25, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        brain.mem.current = "flee";
        brain.mem.currentSince = NOW - 6;
        expect(fleeScore(brain.context(NOW))).toBe(0);
        brain.mem.current = "explore";
        brain.mem.currentSince = NOW + 0.5;
        expect(fleeScore(brain.context(NOW + 1))).toBe(0);
        // it shoots: run again
        w.model.underFire = { time: NOW + 1.5, from: w.spot, shooterId: 2 };
        expect(fleeScore(brain.context(NOW + 2))).toBe(0.8);
    });
});

/** A red house at `at` (its roof standing). */
function house(id: number, at: Vec2): BuildingView {
    return {
        kind: "building",
        id,
        type: "house_red_01",
        pos: at,
        layer: 0,
        ori: 0,
        occupied: false,
        ceilingDead: false,
        ceilingDamaged: false,
    } as BuildingView;
}

describe("danger memory", () => {
    it("avoids the house an unarmed bot was chased out of, until it has a gun", () => {
        const w = unarmedWorld();
        const housePos = v2.add(w.spot, { x: 30, y: 0 });
        w.model.buildings = [house(77, housePos)];
        const e = gunman(w, { x: 30, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        brain.mem.exploreGoal = v2.add(housePos, { x: 2, y: 2 });
        noteDanger(brain.context(NOW), e);
        const ctx = brain.context(NOW + 1);
        expect(avoidPos(ctx, v2.add(housePos, { x: -5, y: 3 }))).toBe(true);
        expect(avoidPos(ctx, v2.add(w.spot, { x: -30, y: 0 }))).toBe(false);
        // its explore goal in there is dropped
        expect(brain.mem.exploreGoal).toBeNull();
        // still next to it: it walks on out of the way
        expect(dangerToLeave(ctx)).not.toBeNull();
        // 119 s later still avoided, 121 s later not (round 5: a house recorded unarmed waits 120 s per flight, it
        // was 45 s; the bot arms up elsewhere instead of walking back in to the same gunman)
        expect(avoidPos(brain.context(NOW + 119), housePos)).toBe(true);
        expect(avoidPos(brain.context(NOW + 121), housePos)).toBe(false);
        // armed: the place no longer applies
        giveGun(w, 0, "mp5");
        expect(avoidPos(brain.context(NOW + 10), housePos)).toBe(false);
        // without the flag nothing is avoided
        expect(avoidPos(brainOf(w, []).context(NOW + 1), housePos)).toBe(false);
    });

    it("a second flight from the same house keeps the bot away twice as long", () => {
        const w = unarmedWorld();
        const housePos = v2.add(w.spot, { x: 30, y: 0 });
        w.model.buildings = [house(78, housePos)];
        const e = gunman(w, { x: 30, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        noteDanger(brain.context(NOW), e);
        noteDanger(brain.context(NOW + 2), e);
        noteDanger(brain.context(NOW + 20), e);
        expect(avoidPos(brain.context(NOW + 258), housePos)).toBe(true);
        expect(avoidPos(brain.context(NOW + 262), housePos)).toBe(false);
    });

    it("unarmed, keeps out of the reach of the gun it ran from in the open, and does not regroup into it", () => {
        const w = unarmedWorld();
        const enemyPos = v2.add(w.spot, { x: 30, y: 0 });
        const e = gunman(w, { x: 30, y: 0 });
        // a follower (the leader has the lower id) whose leader stands 22 units from the gunman
        const leaderPos = v2.add(enemyPos, { x: 0, y: 22 });
        w.model.team = [member(0, leaderPos), member(1, w.spot)];
        const brain = brainOf(w, ["pursuit"]);
        noteDanger(brain.context(NOW), e);
        const ctx = brain.context(NOW + 1);
        // the AK reaches 55: avoided out to 40 units (the flight radius), not only the 14 around the spot
        expect(avoidPos(ctx, v2.add(enemyPos, { x: 25, y: 0 }))).toBe(true);
        expect(avoidPos(ctx, v2.add(enemyPos, { x: 0, y: 38 }))).toBe(true);
        // standing 30 units from it: a goal whose way stays as far from it is fine, one leading closer is not
        expect(avoidPos(ctx, v2.add(w.spot, { x: 0, y: 45 }))).toBe(false);
        expect(avoidPos(ctx, v2.add(enemyPos, { x: 0, y: 42 }))).toBe(true);
        expect(avoidPos(ctx, v2.add(w.spot, { x: -30, y: 0 }))).toBe(false);
        expect(regroupScore(ctx)).toBe(0);
        // a spot in the open is remembered half as long (22.5 s): then the follower regroups again
        expect(regroupScore(brain.context(NOW + 24))).toBeGreaterThan(0);
        // armed, only the spot itself would count, and this one was recorded unarmed: nothing
        giveGun(w, 0, "mp5");
        expect(avoidPos(brain.context(NOW + 2), v2.add(enemyPos, { x: 25, y: 0 }))).toBe(false);
        // a fist fighter's spot stays 14 units
        const w2 = unarmedWorld();
        const f = addEnemy(w2, 3, { x: 30, y: 0 }, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
        const b2 = brainOf(w2, ["pursuit"]);
        noteDanger(b2.context(NOW), f);
        const c2 = b2.context(NOW + 1);
        expect(avoidPos(c2, v2.add(f.pos, { x: 0, y: 12 }))).toBe(true);
        expect(avoidPos(c2, v2.add(f.pos, { x: 0, y: 16 }))).toBe(false);
    });

    it("in the open, one area per enemy that moves with it", () => {
        const w = unarmedWorld();
        const e = gunman(w, { x: 30, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        noteDanger(brain.context(NOW), e);
        e.pos = v2.add(w.spot, { x: 30, y: -60 });
        noteDanger(brain.context(NOW + 1), e);
        expect(brain.mem.pursuit.dangers.length).toBe(1);
        expect(brain.mem.pursuit.dangers[0].pos).toEqual(e.pos);
        // where it stood first (60 units from it now, the bot's way there leading no closer) is free again
        expect(avoidPos(brain.context(NOW + 2), v2.add(w.spot, { x: 30, y: 0 }))).toBe(false);
    });

    it("the zone rotation goes round a place the bot was chased out of, not through it", () => {
        const w = unarmedWorld();
        // the next circle 120 units ahead (the bot inside the current one, no hurry), the gunman it ran from on the way
        setGas(w, { x: 120, y: 0 }, 40);
        const gas = w.model.gas as NonNullable<typeof w.model.gas>;
        gas.radOld = 200;
        const e = gunman(w, { x: 35, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        noteDanger(brain.context(NOW), e);
        e.visible = false;
        const reach = brain.mem.pursuit.dangers[0].reach;
        expect(reach).toBe(40);
        // waypoints beside it, out of the AK's reach, until the straight way to the circle is clear
        const start = v2.copy(w.model.self.pos);
        let straightAt = -1;
        for (let k = 0; k < 6 && straightAt < 0; k++) {
            const goal = planZone(brain.context(NOW + 3 + k)).goal as Vec2;
            const plain = planZone(ctxOf(w, [])).goal as Vec2;
            if (v2.distance(goal, plain) < 0.01) {
                straightAt = k;
                break;
            }
            expect(v2.distance(goal, e.pos), `waypoint ${k}`).toBeGreaterThanOrEqual(reach);
            w.model.self.pos = goal;
        }
        expect(straightAt).toBeGreaterThan(0);
        // ...and in the gas it goes the straight way (the gas first)
        w.model.self.pos = start;
        gas.radOld = 100;
        expect(planZone(brain.context(NOW + 10)).goal).toEqual(planZone(ctxOf(w, [])).goal);
    });
});

describe("items", () => {
    it("cancels a heal under fire, finishes one about to end", () => {
        const w = testWorld();
        w.model.self.health = 40;
        w.model.self.action = { type: "use", item: "healthkit", time: 1, duration: 6, targetId: 0 };
        gunman(w, { x: 15, y: 0 });
        expect(healScore(ctxOf(w, []))).toBe(0.9);
        const brain = brainOf(w, ["pursuit"]);
        expect(healScore(brain.context(NOW))).toBe(0.95);
        const intent = planHeal(brain.context(NOW));
        expect(intent.actions).toContain(Input.Cancel);
        // right after: no new heal while it is in view
        w.model.self.action = { type: "none", item: "", time: 0, duration: 0, targetId: 0 };
        w.model.self.inventory.healthkit = 1;
        expect(healScore(brain.context(NOW + 1))).toBe(0);
        // a use 0.3 s from its end goes on
        w.model.self.action = { type: "use", item: "healthkit", time: 5.7, duration: 6, targetId: 0 };
        expect(healScore(brain.context(NOW + 5))).toBe(0.9);
    });

    it("never drinks with an enemy in view, and boosts when safe whatever the difficulty", () => {
        const w = testWorld();
        w.model.self.inventory.soda = 1;
        // the easy preset never boosts (boostAbove 0)
        expect(healItem(ctxOf(w, [], "easy"))).toBe("");
        expect(healItem(ctxOf(w, ["pursuit"], "easy"))).toBe("soda");
        expect(healScore(ctxOf(w, ["pursuit"], "easy"))).toBeCloseTo(0.28, 5);
        const e = gunman(w, { x: 40, y: 0 }, false);
        expect(healScore(ctxOf(w, ["pursuit"], "normal"))).toBe(0);
        e.downed = true;
        expect(healScore(ctxOf(w, ["pursuit"], "normal"))).toBeCloseTo(0.28, 5);
    });

    it("smokes its own feet before healing only when it cannot fight back", () => {
        const w = testWorld();
        w.model.self.health = 30;
        w.model.self.inventory.smoke = 1;
        w.model.self.inventory.bandage = 3;
        gunman(w, { x: 15, y: 0 });
        expect(planHeal(ctxOf(w, [])).throwPlan?.item).toBe("smoke");
        expect(planHeal(ctxOf(w, ["pursuit"])).throwPlan).toBeNull();
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        expect(planHeal(ctxOf(w, ["pursuit"])).throwPlan?.item).toBe("smoke");
    });

    it("the zone score ramps up outside the next circle instead of jumping", () => {
        const w = testWorld();
        // radius 300, centre 297 units away: 3 units outside the 6 u margin
        setGas(w, { x: 297, y: 0 }, 300);
        const flat = zoneScore(ctxOf(w, []));
        const ramp = zoneScore(ctxOf(w, ["pursuit"]));
        expect(ramp).toBeLessThan(flat * 0.5);
        setGas(w, { x: 360, y: 0 }, 300);
        expect(zoneScore(ctxOf(w, ["pursuit"]))).toBeCloseTo(zoneScore(ctxOf(w, [])), 5);
    });
});

function member(id: number, pos: Vec2, over: Partial<TeamMemberView> = {}): TeamMemberView {
    return { playerId: id, name: `m${id}`, health: 100, downed: false, dead: false, disconnected: false, pos, ...over };
}

describe("revives", () => {
    it("remembers an enemy that covered the downed teammate after it left view, and waits in cover", () => {
        const w = testWorld();
        const matePos = v2.add(w.spot, { x: 5, y: 0 });
        w.model.team = [member(1, w.spot), member(10, matePos, { downed: true })];
        w.model.teammates.add(10);
        addEnemy(w, 10, { x: 5, y: 0 }, { teammate: true, downed: true });
        const e = gunman(w, { x: 35, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        expect(reviveScore(brain.context(NOW))).toBe(0.2);
        // it steps out of view: 3 s later the baseline would kneel (its memory is 2 s)
        e.visible = false;
        expect(reviveThreat(brainOf(w, []).context(NOW + 3), matePos)).toBeNull();
        const ctx = brain.context(NOW + 3);
        expect(reviveThreat(ctx, matePos)).toBe(e);
        const intent = planRevive(ctx);
        expect(intent.actions).not.toContain(Input.Revive);
        // 9 s later it is forgotten: revive
        w.model.self.pos = v2.add(w.spot, { x: 4, y: 0 });
        expect(reviveThreat(brain.context(NOW + 9), matePos)).toBeNull();
        expect(planRevive(brain.context(NOW + 9)).actions).toContain(Input.Revive);
    });
});
