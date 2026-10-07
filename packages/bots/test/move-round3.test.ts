// Round 3 movement (BrainFeatures.pursuit, user reports 19, 20, 25, 27) on synthetic worlds: the answer to fire from an
// unseen shooter (run in irregular legs, cover, push by persona), the search for a lost target (its last sighting, its
// heading, the hiding places around there; never where it is now), fighting from the edge of cover, and air strikes
// (zone radius from the view plus the bombs' blast from the defs, falling bombs by their own explosion). Owner: MOVE.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { Brain } from "../src/brain/brain.ts";
import { avoidPos } from "../src/brain/danger.ts";
import { evadeScore, planEvade, styleWeights } from "../src/brain/evade.ts";
import { searchScore, searchSpot } from "../src/brain/search.ts";
import { blastRadius, isFallingBomb, planEvacuate, strikeDangers, strikeScore } from "../src/brain/strikes.ts";
import { planFight } from "../src/brain/tactics.ts";
import { planDowned, reviveScore } from "../src/brain/team.ts";
import { PERSONA_SALT, PERSONAS } from "../src/persona.ts";
import {
    addEnemy,
    addObstacle,
    brainOf,
    ctxOf,
    FixedBoard,
    faceTo,
    giveGun,
    NOW,
    type TestWorld,
    testWorld,
} from "./brain-world.ts";

/**
 * A bullet from an unseen shooter (id 77) passed close at `t`, seemingly fired from `off` (by default long enough ago
 * that it has flown by and the bot reacted: about 0.4 s of flight from 40 units plus the normal 0.3-0.5 s reaction).
 */
function shotAt(w: TestWorld, off: Vec2, t = NOW - 0.95): void {
    w.model.underFire = { time: t, from: v2.add(w.spot, off), shooterId: 77 };
}

/** Thinks of `brain` at `t` (the model's clock follows). */
function at(w: TestWorld, brain: Brain, t: number) {
    w.model.time = t;
    return brain.context(t);
}

describe("unseen fire (report 20)", () => {
    it("starts an episode on a close bullet from a shooter off the screen, higher when hit, none for the baseline", () => {
        const w = testWorld();
        shotAt(w, { x: 40, y: 0 });
        expect(evadeScore(ctxOf(w, []))).toBe(0);
        expect(evadeScore(ctxOf(w, ["pursuit"]))).toBeCloseTo(0.64, 5);
        // a bullet just fired has not reached the bot yet, and a human takes a moment to react
        shotAt(w, { x: 40, y: 0 }, NOW - 0.1);
        expect(evadeScore(ctxOf(w, ["pursuit"]))).toBe(0);
        shotAt(w, { x: 40, y: 0 });
        w.model.lastHurt = NOW - 0.9;
        expect(evadeScore(ctxOf(w, ["pursuit"]))).toBeCloseTo(0.82, 5);
        // the shooter on the screen: an ordinary fight
        addEnemy(w, 77, { x: 20, y: 0 });
        expect(evadeScore(ctxOf(w, ["pursuit"]))).toBe(0);
    });

    it("ends once it has been quiet, and gives way to a visible enemy fighting the bot", () => {
        const w = testWorld();
        shotAt(w, { x: 40, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        expect(evadeScore(at(w, brain, NOW))).toBeGreaterThan(0.6);
        expect(evadeScore(at(w, brain, NOW + 1.2))).toBeCloseTo(0.56, 5);
        expect(evadeScore(at(w, brain, NOW + 5))).toBe(0);
        const w2 = testWorld();
        shotAt(w2, { x: -40, y: 0 });
        const e = addEnemy(w2, 2, { x: 15, y: 0 }, { lastShotAt: NOW - 0.2 });
        faceTo(e, w2.spot);
        expect(evadeScore(ctxOf(w2, ["pursuit"]))).toBeLessThanOrEqual(0.5);
    });

    it("picks the style by persona: rushers push, cautious bots cover or run, the unarmed never push", () => {
        const w = testWorld();
        const rusher = styleWeights(ctxOf(w, ["pursuit"], "normal", { persona: PERSONAS.rusher }));
        const camper = styleWeights(ctxOf(w, ["pursuit"], "normal", { persona: PERSONAS.camper }));
        const neutral = styleWeights(ctxOf(w, ["pursuit"]));
        expect(rusher.push).toBeGreaterThan(neutral.push);
        expect(rusher.push).toBeGreaterThan(rusher.cover);
        expect(camper.push).toBe(0);
        expect(camper.cover).toBeGreaterThan(neutral.cover);
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        expect(styleWeights(ctxOf(w, ["pursuit"], "normal", { persona: PERSONAS.rusher })).push).toBe(0);
        // over many episodes the persona's own stream gives each its mix
        const counts = { rusher: 0, camper: 0 };
        for (let seed = 1; seed <= 40; seed++) {
            for (const name of ["rusher", "camper"] as const) {
                const w3 = testWorld();
                shotAt(w3, { x: 40, y: 0 });
                const personaRng = createRng(seed ^ PERSONA_SALT);
                const b = brainOf(w3, ["pursuit"], "normal", seed, { persona: PERSONAS[name], personaRng });
                evadeScore(b.context(NOW));
                if (b.mem.pursuit.evade?.style === "push") counts[name]++;
            }
        }
        expect(counts.rusher).toBeGreaterThan(10);
        expect(counts.camper).toBe(0);
    });

    /** A brain whose episode against a shooter seemingly at `origin` has `style`. */
    function episode(w: TestWorld, origin: Vec2, style: "run" | "cover" | "push"): Brain {
        shotAt(w, origin);
        const brain = brainOf(w, ["pursuit"]);
        evadeScore(brain.context(NOW));
        const ev = brain.mem.pursuit.evade;
        if (!ev) throw new Error("no episode");
        ev.style = style;
        return brain;
    }

    it("runs away in irregular zigzag legs, glancing back at the origin", () => {
        const w = testWorld();
        const origin = { x: 40, y: 0 };
        const brain = episode(w, origin, "run");
        const legs: number[] = [];
        let lastSide = 0;
        let since = 0;
        for (let i = 0; i < 80; i++) {
            const t = NOW + i * 0.05;
            if (i % 10 === 0) shotAt(w, origin, t);
            const intent = planEvade(at(w, brain, t));
            expect(intent.lookAt).toEqual(v2.add(w.spot, origin));
            const dir = intent.moveDir as Vec2;
            // away from the origin, never straight back towards it
            expect(dir.x).toBeLessThan(-0.3);
            const side = Math.sign(dir.y);
            if (lastSide !== 0 && side !== lastSide) {
                legs.push(t - since);
                since = t;
            }
            if (lastSide === 0) since = t;
            lastSide = side;
        }
        // several legs, not a fixed rhythm
        expect(legs.length).toBeGreaterThanOrEqual(3);
        expect(Math.max(...legs) - Math.min(...legs)).toBeGreaterThan(0.1);
    });

    it("takes cover that breaks the estimated line of fire, not towards it", () => {
        const w = testWorld();
        addObstacle(w, { x: -4, y: 0 }, "stone_01");
        const origin = { x: 40, y: 0 };
        const brain = episode(w, origin, "cover");
        const intent = planEvade(at(w, brain, NOW));
        const goal = intent.goal as Vec2;
        expect(goal).not.toBeNull();
        expect(w.model.lineOfFire(v2.add(w.spot, origin), goal)).toBe(false);
        expect(v2.distance(goal, v2.add(w.spot, origin))).toBeGreaterThan(38);
    });

    it("pushes towards the origin from cover to cover", () => {
        const w = testWorld();
        addObstacle(w, { x: 10, y: 3 }, "stone_01");
        const origin = { x: 40, y: 0 };
        const brain = episode(w, origin, "push");
        const intent = planEvade(at(w, brain, NOW));
        const goal = intent.goal as Vec2;
        expect(goal).not.toBeNull();
        expect(v2.distance(goal, v2.add(w.spot, origin))).toBeLessThan(37);
        expect(w.model.lineOfFire(v2.add(w.spot, origin), goal)).toBe(false);
    });
});

describe("search (report 25)", () => {
    /** The bot fights contact 2 (armed, in view) running +x at 6 u/s from `off`. */
    function chase(w: TestWorld, off: Vec2 = { x: 15, y: 0 }): Brain {
        giveGun(w, 0, "ak47");
        const c = addEnemy(w, 2, off, { activeWeapon: "mp5", vel: { x: 6, y: 0 } });
        faceTo(c, v2.add(c.pos, { x: 10, y: 0 }));
        const brain = brainOf(w, ["pursuit"]);
        brain.mem.current = "fight";
        brain.mem.targetId = 2;
        return brain;
    }

    it("keeps the last sighting and searches it, then where its heading led, after the contact is forgotten", () => {
        const w = testWorld();
        const brain = chase(w);
        expect(searchScore(at(w, brain, NOW))).toBe(0);
        const seenAt = v2.add(w.spot, { x: 15, y: 0 });
        // out of sight: it moved on (the model keeps the last position; the truth is elsewhere)
        const c = w.model.contacts.get(2) as NonNullable<ReturnType<typeof w.model.contacts.get>>;
        c.visible = false;
        brain.mem.current = "explore";
        expect(searchScore(at(w, brain, NOW + 0.2))).toBe(0);
        expect(searchScore(at(w, brain, NOW + 1))).toBeCloseTo(0.44, 5);
        const spots = brain.mem.pursuit.search?.spots ?? [];
        expect(spots.length).toBeGreaterThanOrEqual(2);
        expect(v2.distance(spots[0], seenAt)).toBeLessThan(1.5);
        // where its heading led (+x)
        expect(spots[1].x - seenAt.x).toBeGreaterThan(8);
        // the world model forgot it: the bot did not
        w.model.contacts.delete(2);
        expect(searchScore(at(w, brain, NOW + 6))).toBeCloseTo(0.44, 5);
        expect(searchSpot(at(w, brain, NOW + 6))).not.toBeNull();
    });

    it("checks the spots one by one and gives up when they are done or its time is up", () => {
        const w = testWorld();
        const brain = chase(w);
        searchScore(at(w, brain, NOW));
        (w.model.contacts.get(2) as { visible: boolean }).visible = false;
        brain.mem.current = "explore";
        expect(searchScore(at(w, brain, NOW + 1))).toBeGreaterThan(0);
        const spots = brain.mem.pursuit.search?.spots ?? [];
        let t = NOW + 1;
        for (const p of spots) {
            w.model.self.pos = v2.copy(p);
            t += 1;
            searchScore(at(w, brain, t));
        }
        expect(brain.mem.pursuit.search).toBeNull();
        expect(brain.mem.pursuit.track).toBeNull();
        // a second loss: its patience (12 s for a neutral bot) ends it
        const w2 = testWorld();
        const b2 = chase(w2, { x: 0, y: 25 });
        searchScore(at(w2, b2, NOW));
        (w2.model.contacts.get(2) as { visible: boolean }).visible = false;
        b2.mem.current = "explore";
        expect(searchScore(at(w2, b2, NOW + 1))).toBeGreaterThan(0);
        expect(searchScore(at(w2, b2, NOW + 13))).toBe(0);
    });

    it("looks into the bushes along its way; no search for a given-up, unarmed or out-of-reach target, or by the rat", () => {
        const w = testWorld();
        addObstacle(w, { x: 24, y: 5 }, "bush_01");
        const brain = chase(w);
        searchScore(at(w, brain, NOW));
        (w.model.contacts.get(2) as { visible: boolean }).visible = false;
        brain.mem.current = "explore";
        searchScore(at(w, brain, NOW + 1));
        const bush = v2.add(w.spot, { x: 24, y: 5 });
        expect(brain.mem.pursuit.search?.spots.some((p) => v2.distance(p, bush) < 2)).toBe(true);
        const w2 = testWorld();
        const b2 = chase(w2);
        searchScore(at(w2, b2, NOW));
        (w2.model.contacts.get(2) as { visible: boolean }).visible = false;
        b2.mem.pursuit.ignored.set(2, { until: NOW + 30, dist: 15 });
        expect(searchScore(at(w2, b2, NOW + 1))).toBe(0);
        // a runner that never had a gun, or one already out of reach, is not hunted down (report 11)
        for (const [off, over] of [
            [
                { x: 15, y: 0 },
                { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY },
            ],
            [{ x: 70, y: 0 }, {}],
        ] as const) {
            const w4 = testWorld();
            giveGun(w4, 0, "ak47");
            const c = addEnemy(w4, 2, off, { vel: { x: 6, y: 0 }, ...over });
            const b4 = brainOf(w4, ["pursuit"]);
            b4.mem.current = "fight";
            b4.mem.targetId = 2;
            searchScore(at(w4, b4, NOW));
            c.visible = false;
            b4.mem.current = "explore";
            expect(searchScore(at(w4, b4, NOW + 1))).toBe(0);
        }
        const w3 = testWorld();
        giveGun(w3, 0, "ak47");
        addEnemy(w3, 2, { x: 15, y: 0 });
        const rat = brainOf(w3, ["pursuit"], "normal", 1, { persona: PERSONAS.rat });
        rat.mem.current = "fight";
        rat.mem.targetId = 2;
        searchScore(at(w3, rat, NOW));
        (w3.model.contacts.get(2) as { visible: boolean }).visible = false;
        expect(searchScore(at(w3, rat, NOW + 1))).toBe(0);
    });
});

describe("fighting positions (report 19)", () => {
    /** An even fight: the bot's ak47 against a visible mp5 holder `off` away, facing the bot. */
    function fight(w: TestWorld, off: Vec2 = { x: 20, y: 0 }): void {
        giveGun(w, 0, "ak47");
        const e = addEnemy(w, 2, off);
        faceTo(e, w.spot);
    }

    it("fights from the edge of cover next to it instead of strafing in the open", () => {
        const w = testWorld();
        fight(w);
        addObstacle(w, { x: 2, y: 4 }, "stone_01");
        const target = v2.add(w.spot, { x: 20, y: 0 });
        const brain = brainOf(w, ["pursuit"]);
        const intent = planFight(at(w, brain, NOW));
        const post = brain.mem.pursuit.post;
        expect(post).not.toBeNull();
        expect(w.model.lineOfFire(target, post?.hide as Vec2)).toBe(false);
        expect(w.model.lineOfFire(post?.edge as Vec2, target)).toBe(true);
        expect(v2.distance(post?.edge as Vec2, post?.hide as Vec2)).toBeLessThan(3.5);
        // next to the edge it strafes as usual (no goal); strayed farther than the leash, it walks back to the edge
        expect(intent.goal === null || v2.distance(intent.goal, post?.edge as Vec2) < 0.1).toBe(true);
        w.model.self.pos = v2.add(post?.edge as Vec2, { x: -1, y: -5 });
        const back = planFight(at(w, brain, NOW + 0.1));
        expect(back.goal).toEqual(brain.mem.pursuit.post?.edge);
        // without the flag nothing holds it there
        const plain = brainOf(w, []);
        planFight(at(w, plain, NOW + 0.2));
        expect(plain.mem.pursuit.post).toBeNull();
    });

    it("steps behind the cover while reloading", () => {
        const w = testWorld();
        fight(w);
        addObstacle(w, { x: 2, y: 4 }, "stone_01");
        const brain = brainOf(w, ["pursuit"]);
        planFight(at(w, brain, NOW));
        w.model.self.action = { type: "reload", item: "", time: 0, duration: 2.7, targetId: 0 };
        const intent = planFight(at(w, brain, NOW + 0.1));
        expect(intent.goal).toEqual(brain.mem.pursuit.post?.hide);
    });

    it("no post in a brawl, without cover, or for a healthy rusher", () => {
        const w = testWorld();
        fight(w, { x: 5, y: 0 });
        addObstacle(w, { x: 2, y: 4 }, "stone_01");
        const b1 = brainOf(w, ["pursuit"]);
        planFight(at(w, b1, NOW));
        expect(b1.mem.pursuit.post).toBeNull();
        const w2 = testWorld();
        fight(w2);
        const b2 = brainOf(w2, ["pursuit"]);
        planFight(at(w2, b2, NOW));
        expect(b2.mem.pursuit.post).toBeNull();
        const w3 = testWorld();
        fight(w3);
        addObstacle(w3, { x: 2, y: 4 }, "stone_01");
        const b3 = brainOf(w3, ["pursuit"], "normal", 1, { persona: PERSONAS.rusher });
        planFight(at(w3, b3, NOW));
        expect(b3.mem.pursuit.post).toBeNull();
    });
});

describe("air strikes (report 27)", () => {
    it("reads the danger radii from the data: the view's zone radius plus the bomb's blast, a bomb's own blast", () => {
        const iron = GameObjectDefs.explosion_bomb_iron as unknown as { rad: { max: number } };
        expect(blastRadius("bomb_iron")).toBe(iron.rad.max);
        expect(isFallingBomb("bomb_iron")).toBe(true);
        expect(isFallingBomb("frag")).toBe(false);
        const w = testWorld();
        const board = new FixedBoard();
        board.zones = [
            { kind: "airstrike", pos: v2.add(w.spot, { x: 10, y: 0 }), rad: 20, until: NOW + 10 },
            { kind: "grenade", pos: v2.add(w.spot, { x: 3, y: 0 }), rad: 8, until: NOW + 1 },
        ];
        w.model.threats = board;
        w.model.projectiles = [
            { id: 1, type: "bomb_iron", pos: v2.add(w.spot, { x: -50, y: 0 }), posZ: 3, dir: { x: 1, y: 0 }, layer: 0 },
            { id: 2, type: "frag", pos: v2.add(w.spot, { x: -60, y: 0 }), posZ: 1, dir: { x: 1, y: 0 }, layer: 0 },
        ];
        const list = strikeDangers(ctxOf(w, ["pursuit"]));
        expect(list).toHaveLength(2);
        expect(list[0].rad).toBe(20 + iron.rad.max);
        expect(list[1].bomb).toBe(true);
        expect(list[1].rad).toBeGreaterThan(iron.rad.max);
        expect(strikeDangers(ctxOf(w, []))).toHaveLength(0);
    });

    it("leaves a strike zone by the shortest way out, past its blast margin", () => {
        const w = testWorld();
        const board = new FixedBoard();
        const centre = v2.add(w.spot, { x: 10, y: 0 });
        board.zones = [{ kind: "airstrike", pos: centre, rad: 20, until: NOW + 10 }];
        w.model.threats = board;
        const ctx = ctxOf(w, ["pursuit"]);
        expect(strikeScore(ctx)).toBeCloseTo(0.9, 5);
        const intent = planEvacuate(ctx);
        const goal = intent.goal as Vec2;
        expect(v2.distance(goal, centre)).toBeGreaterThan(20 + blastRadius("bomb_iron"));
        // out the near side (away from the centre), not across it
        expect(goal.x).toBeLessThan(w.spot.x);
        // loot in it is left alone
        expect(avoidPos(ctx, centre)).toBe(true);
        expect(strikeScore(ctxOf(w, []))).toBe(0);
    });

    it("runs from a falling bomb's blast, and goals behind a zone are not walked to through it", () => {
        const w = testWorld();
        w.model.projectiles = [
            { id: 1, type: "bomb_iron", pos: v2.add(w.spot, { x: 4, y: 0 }), posZ: 3, dir: { x: 1, y: 0 }, layer: 0 },
        ];
        const ctx = ctxOf(w, ["pursuit"]);
        expect(strikeScore(ctx)).toBeCloseTo(0.96, 5);
        const goal = planEvacuate(ctx).goal as Vec2;
        expect(v2.distance(goal, v2.add(w.spot, { x: 4, y: 0 }))).toBeGreaterThan(blastRadius("bomb_iron"));
        const w2 = testWorld();
        const board = new FixedBoard();
        board.zones = [{ kind: "airstrike", pos: v2.add(w2.spot, { x: 40, y: 0 }), rad: 10, until: NOW + 10 }];
        w2.model.threats = board;
        const c2 = ctxOf(w2, ["pursuit"]);
        expect(strikeScore(c2)).toBe(0);
        expect(avoidPos(c2, v2.add(w2.spot, { x: 80, y: 0 }))).toBe(true);
        expect(avoidPos(c2, v2.add(w2.spot, { x: 0, y: 40 }))).toBe(false);
    });

    it("nobody kneels in a strike, and a downed bot crawls out of it first", () => {
        const w = testWorld();
        const matePos = v2.add(w.spot, { x: 3, y: 0 });
        const member = (id: number, pos: Vec2, downed: boolean): TeamMemberView => ({
            playerId: id,
            name: `m${id}`,
            health: 100,
            downed,
            dead: false,
            disconnected: false,
            pos,
        });
        w.model.team = [member(1, w.spot, false), member(10, matePos, true)];
        w.model.teammates.add(10);
        addEnemy(w, 10, { x: 3, y: 0 }, { teammate: true, downed: true });
        expect(reviveScore(ctxOf(w, ["pursuit"]))).toBeGreaterThan(0.3);
        const board = new FixedBoard();
        board.zones = [{ kind: "airstrike", pos: v2.add(w.spot, { x: 5, y: 0 }), rad: 15, until: NOW + 10 }];
        w.model.threats = board;
        expect(reviveScore(ctxOf(w, ["pursuit"]))).toBe(0);
        // the downed one (here: the bot itself) crawls out past the blast margin
        w.model.self.downed = true;
        const out = planDowned(ctxOf(w, ["pursuit"]));
        expect(v2.distance(out.goal as Vec2, v2.add(w.spot, { x: 5, y: 0 }))).toBeGreaterThan(
            15 + blastRadius("bomb_iron"),
        );
    });
});
