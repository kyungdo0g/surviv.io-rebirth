// Round 4 grenades (bot overhaul COMBAT2, user reports 29 and 30). Synthetic worlds and seeded simulations.
// Report 29: a bot running from a chaser throws frags back at the chaser's path, uncooked and on the run, behind it;
// the more frags it carries the more freely (one is mostly kept), never with an enemy inside the no-throw distance.
// Report 30: grenade use and judgement scale with the skill parameters (DifficultyParams.frag, misjudge and
// overconfidence, composed from s and g by skill.ts): beginners forget frags, waste them, throw late, short and into
// trees; experts check the path (the arc check matches the simulation's projectile physics), throw early, tight and
// purposefully; beginners misjudge fights; the persona's caution and boldness shift escape, push and flush frags.
// Owner: COMBAT.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { type ObstacleDef, WeaponSlot } from "@rebirth/defs";
import { emptyInput, type Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { assess } from "../src/brain/assess.ts";
import { Brain } from "../src/brain/brain.ts";
import { emptyIntent, type Intent } from "../src/brain/context.ts";
import { dodge } from "../src/brain/dodge.ts";
import { escapeFrag } from "../src/brain/escapeFrag.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import {
    arcBlocker,
    cookDeadline,
    fragBlast,
    fragMinDist,
    fragNoThrowNear,
    runningThrowPoint,
    standDist,
} from "../src/brain/fragMath.ts";
import {
    boldTaste,
    cautionTaste,
    checksPath,
    clearLanding,
    recallsFrags,
    throwBlocker,
} from "../src/brain/fragSkill.ts";
import { behindCoverPoint, fragGates, fragPlan, smartGrenade } from "../src/brain/grenades.ts";
import { ThrowController, throwMouseLen } from "../src/brain/trigger.ts";
import { BotController } from "../src/controller.ts";
import { DIFFICULTY_PRESETS, type DifficultyParams } from "../src/difficulty.ts";
import { obstacleCollider, obstacleDef } from "../src/geom.ts";
import { screenBounds } from "../src/perception/sight.ts";
import type { SeenObstacle, SelfState } from "../src/perception/world.ts";
import { PERSONAS, type PersonaParams } from "../src/persona.ts";
import { skillParams } from "../src/skill.ts";
import { addEnemy, addObstacle, faceTo, NOW, type TestWorld, testWorld } from "./brain-world.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";

const SMART = BRAIN_PRESETS.smart;

/** A world whose screen is set (testWorld leaves the screen bounds to observe()). */
function world(): TestWorld {
    const w = testWorld();
    w.model.screen = screenBounds(w.spot, 28);
    w.model.screenZoom = 28;
    return w;
}

/**
 * A smart brain on `w` with the given parameters (a preset, or a skill profile's composed parameters); its persona
 * stream is seeded with `personaSeed` (default `seed`).
 */
function brain(
    w: TestWorld,
    params: DifficultyParams,
    seed = 1,
    persona?: Readonly<PersonaParams>,
    personaSeed = seed,
): Brain {
    return new Brain(w.model, params, createRng(seed), SMART, { persona, personaRng: createRng(personaSeed ^ 0x5bd1) });
}

const EASY = DIFFICULTY_PRESETS.easy;
const NORMAL = DIFFICULTY_PRESETS.normal;
const HARD = DIFFICULTY_PRESETS.hard;

/** The bot reacted to contact `id` long ago. */
function reacted(b: Brain, id: number): void {
    b.mem.engagedTarget = id;
    b.mem.engageStart = NOW - 5;
    b.mem.reaction = 0.2;
}

/** The bot flees: a flight intent running away along +x. */
function flight(w: TestWorld): Intent {
    const intent = emptyIntent("flee");
    intent.goal = v2.add(w.spot, { x: 25, y: 0 });
    return intent;
}

/** A world with `frags` frags and a chaser `dist` units behind (-x) closing at `closing` u/s. */
function chased(frags: number, dist = 16, closing = 9): { w: TestWorld; e: ReturnType<typeof addEnemy> } {
    const w = world();
    w.model.self.weapons[0] = { type: "", ammo: 0 };
    w.model.self.inventory.frag = frags;
    const e = addEnemy(w, 2, { x: -dist, y: 0 }, { vel: { x: closing, y: 0 }, activeWeapon: "ak47" });
    faceTo(e, w.spot);
    return { w, e };
}

describe("frags thrown back on the run (user report 29)", () => {
    it("at a closing chaser's path: uncooked, on the run, behind the bot and in front of the chaser", () => {
        const { w, e } = chased(3);
        const b = brain(w, HARD);
        const plan = escapeFrag(b.context(NOW), flight(w), 100);
        expect(plan?.item).toBe("frag");
        const p = plan as NonNullable<typeof plan>;
        expect(p.cook).toBe(0);
        expect(p.run).toBe(true);
        expect(p.comp).toBe(HARD.frag.motionComp);
        // behind the bot (towards the chaser), outside its own blast, on the chaser's way to it
        const toChaser = v2.sub(e.pos, w.spot);
        expect(v2.dot(v2.sub(p.pos, w.spot), toChaser)).toBeGreaterThan(0);
        expect(v2.distance(p.pos, w.spot)).toBeGreaterThanOrEqual(fragMinDist("frag") - 1e-6);
        expect(Math.abs(p.pos.y - w.spot.y)).toBeLessThan(2.5);
        expect(v2.distance(p.pos, w.spot)).toBeLessThan(v2.distance(e.pos, w.spot) + 1);
        expect(b.mem.fight.trace.last("cook")?.detail).toMatch(/^escape cook 0\.00/);
        expect(b.mem.fight.escapes).toBe(1);
    });

    it("not with an enemy inside the no-throw distance, nor while holding a spot or not running; the last frag is kept while shooting back", () => {
        const near = chased(3, fragNoThrowNear("frag") - 1);
        expect(escapeFrag(brain(near.w, HARD).context(NOW), flight(near.w), 100)).toBeNull();
        const { w } = chased(3);
        const stop = flight(w);
        stop.stop = true;
        expect(escapeFrag(brain(w, HARD).context(NOW), stop, 100)).toBeNull();
        // shooting back while it runs: the last frag is kept, with frags to spare one goes
        const fire = flight(w);
        fire.fire = true;
        expect(escapeFrag(brain(w, HARD).context(NOW), fire, 100)).not.toBeNull();
        const last = chased(1, 12);
        expect(escapeFrag(brain(last.w, HARD).context(NOW), { ...flight(last.w), fire: true }, 100)).toBeNull();
        expect(escapeFrag(brain(last.w, HARD).context(NOW), flight(last.w), 100)).not.toBeNull();
        expect(escapeFrag(brain(w, HARD).context(NOW), emptyIntent("fight"), 100)).toBeNull();
        // a standing enemy is no chaser
        const still = chased(3, 16, 0);
        expect(escapeFrag(brain(still.w, HARD).context(NOW), flight(still.w), 100)).toBeNull();
        // and the baseline brain never throws one (its flee behaviour is unchanged)
        expect(BRAIN_PRESETS.baseline.grenades).toBe(false);
    });

    it("the more frags it carries, the more freely: more often, at slower and farther chasers", () => {
        const count = (frags: number, dist: number, closing: number) => {
            let n = 0;
            for (let seed = 1; seed <= 200; seed++) {
                const { w } = chased(frags, dist, closing);
                if (escapeFrag(brain(w, NORMAL, seed).context(NOW), flight(w), 0.5)) n++;
            }
            return n;
        };
        const one = count(1, 14, 9);
        const two = count(2, 14, 9);
        const four = count(4, 14, 9);
        expect(one).toBeLessThan(two);
        expect(two).toBeLessThan(four);
        expect(one).toBeLessThan(20);
        // a chaser barely closing in, or 24 units away: only with plenty of frags
        expect(count(1, 14, 1)).toBe(0);
        expect(count(4, 14, 1)).toBeGreaterThan(0);
        expect(count(1, 24, 9)).toBe(0);
        expect(count(4, 24, 9)).toBeGreaterThan(0);
    });

    it("cautious personas cover their escapes more than bold ones", () => {
        expect(cautionTaste(PERSONAS.neutral)).toBe(1);
        expect(boldTaste(PERSONAS.neutral)).toBe(1);
        expect(cautionTaste(PERSONAS.rat)).toBeGreaterThan(cautionTaste(PERSONAS.rusher));
        expect(boldTaste(PERSONAS.rusher)).toBeGreaterThan(boldTaste(PERSONAS.rat));
        const count = (persona: Readonly<PersonaParams>) => {
            let n = 0;
            for (let seed = 1; seed <= 200; seed++) {
                const { w } = chased(3);
                if (escapeFrag(brain(w, NORMAL, seed, persona).context(NOW), flight(w), 0.5)) n++;
            }
            return n;
        };
        expect(count(PERSONAS.rat)).toBeGreaterThan(count(PERSONAS.rusher));
    });

    it("the hand allows for its own run as its skill lets it; the throw never stands still, the pin waits for the aim", () => {
        const from = { x: 100, y: 100 };
        const target = { x: 85, y: 100 };
        const vel = { x: 9, y: 0 };
        // where a throw aimed at `aim` from a runner comes to rest (the throw inherits 0.6 of the motion)
        const rest = (aim: Vec2) => {
            const speed = (v2.distance(aim, from) - 0.5) / ((standDist("frag", 20) - 0.5) / 20);
            const world = v2.add(v2.mul(v2.normalize(v2.sub(aim, from)), speed), v2.mul(vel, 0.6));
            return v2.add(from, v2.mul(world, (standDist("frag", 20) - 0.5) / 20));
        };
        expect(v2.distance(rest(runningThrowPoint("frag", from, target, vel, 1)), target)).toBeLessThan(0.6);
        // no allowance: it lands well short of the point, towards the runner
        expect(v2.distance(rest(runningThrowPoint("frag", from, target, vel, 0)), from)).toBeLessThan(8);
        const tc = new ThrowController();
        const self = {
            pos: from,
            curWeapIdx: WeaponSlot.Throwable,
            weapons: [{ type: "" }, { type: "" }, { type: "fists" }, { type: "frag", ammo: 1 }],
            inventory: { frag: 1 },
            action: { type: "none" },
        } as unknown as SelfState;
        tc.start({ item: "frag", pos: target, cook: 0, run: true, comp: 1 }, 0);
        let pin = -1;
        for (let t = 0; t <= 1; t += 0.01) {
            expect(tc.holdStill(t)).toBe(false);
            const out = tc.update(t, self, t >= 0.3, vel);
            if (out.shootStart && pin < 0) pin = t;
        }
        // the pin is pulled once the cursor rests on the throw point, not while it still swings round
        expect(pin).toBeGreaterThanOrEqual(0.3 - 1e-9);
        expect(pin).toBeLessThan(0.33);
        // a cooked throw stands still for its release
        const cooked = new ThrowController();
        cooked.start({ item: "frag", pos: target, cook: 1 }, 0);
        cooked.update(0, self, true);
        expect(cooked.holdStill(0.9)).toBe(true);
    });

    it("a checked throw is called off when its path is blocked at the pin, and held briefly while blocked in the cook", () => {
        const self = {
            pos: { x: 0, y: 0 },
            curWeapIdx: WeaponSlot.Throwable,
            weapons: [{ type: "" }, { type: "" }, { type: "fists" }, { type: "frag", ammo: 1 }],
            inventory: { frag: 1 },
            action: { type: "none" },
        } as unknown as SelfState;
        const check = { to: { x: 15, y: 0 }, mode: "land" as const };
        const off = new ThrowController();
        off.start({ item: "frag", pos: check.to, cook: 1, check }, 0);
        const out = off.update(0, self, true, { x: 0, y: 0 }, false);
        expect(out.shootStart).toBe(false);
        expect(off.active).toBe(false);
        expect(off.calledOff).toBe(1);
        // pin pulled with a clear path, then blocked: held (standing still) until it clears a moment later
        const held = new ThrowController();
        held.start({ item: "frag", pos: check.to, cook: 1, check }, 0);
        expect(held.update(0, self, true, { x: 0, y: 0 }, true).shootStart).toBe(true);
        let released = -1;
        for (let t = 0.01; t <= 4 && released < 0; t += 0.01) {
            held.update(t, self, true, { x: 0, y: 0 }, t > 1.2);
            expect(held.holdStill(t) || !held.cooking).toBe(true);
            if (!held.cooking) released = t;
        }
        expect(released).toBeGreaterThan(1.2);
        expect(released).toBeLessThan(1.25);
        // blocked for good: released 0.4 s past its plan, far before the fuse deadline (evaluation F2: held to the
        // deadline, frags burst in the air 8-38 u from the aim)
        const late = new ThrowController();
        late.start({ item: "frag", pos: check.to, cook: 1, check }, 0);
        late.update(0, self, true, { x: 0, y: 0 }, true);
        let at = -1;
        for (let t = 0.01; t <= 4 && at < 0; t += 0.01) {
            late.update(t, self, true, { x: 0, y: 0 }, false);
            if (!late.cooking) at = t;
        }
        expect(at).toBeGreaterThan(1.39);
        expect(at).toBeLessThan(1.42);
        expect(at).toBeLessThan(cookDeadline("frag") - 1);
        // an uncooked one (escape, waste) or one thrown on the run is never held for its path
        const quick = new ThrowController();
        quick.start({ item: "frag", pos: check.to, cook: 0, check, run: true }, 0);
        quick.update(0, self, true, { x: 0, y: 0 }, true);
        quick.update(0.01, self, true, { x: 0, y: 0 }, false);
        expect(quick.cooking).toBe(false);
    });

    it("simulation: an unarmed bot chased by a gunman throws frags back while running, uncooked, in front of the chaser", () => {
        const SPOT = { x: 200, y: 420 };
        let checked = 0;
        for (const seed of [1, 2, 3]) {
            const game = flatGame({ minPlayers: 99 });
            const p = placePlayer(game, "bot", SPOT);
            p.inv.set("frag", 3);
            const chaser = placePlayer(game, "chaser", { x: SPOT.x - 22, y: SPOT.y });
            giveGun(chaser, "ak47", 90);
            for (let k = 0; k < 4; k++) placePlayer(game, `idle${k}`, { x: 600 + k * 20, y: 120 });
            const bot = new BotController(game, p.id, { seed, skill: 0.85, sense: 0.95 });
            const seen = new Set<number>();
            for (let i = 0; i < 600 && !p.dead; i++) {
                bot.update();
                run(chaser, p.pos);
                const before = v2.copy(p.pos);
                game.step();
                const speed = v2.distance(before, p.pos) * 100;
                for (const pr of game.projectiles.projectiles) {
                    if (pr.ownerId !== p.id || seen.has(pr.id)) continue;
                    seen.add(pr.id);
                    const label = `seed ${seed} frag ${seen.size}`;
                    // released running, with the fuse barely touched (the simulation's 0.1 s minimum hold)
                    expect(speed, label).toBeGreaterThan(6);
                    expect(pr.fuse, label).toBeGreaterThan(4 - 0.16);
                    expect(v2.distance(chaser.pos, p.pos), label).toBeGreaterThan(fragNoThrowNear("frag"));
                    // it comes to rest between the bot and the chaser, near the chaser's line
                    const end = v2.add(pr.pos, v2.mul(pr.vel, 1.04 + 1 / 2.3));
                    const seg = v2.sub(chaser.pos, p.pos);
                    const along = v2.dot(v2.sub(end, p.pos), seg) / v2.lengthSqr(seg);
                    expect(along, label).toBeGreaterThan(0.4);
                    expect(along, label).toBeLessThan(1.25);
                    expect(Math.abs(v2.det(v2.normalize(seg), v2.sub(end, p.pos))), label).toBeLessThan(4);
                    checked++;
                }
            }
            expect(seen.size, `seed ${seed}`).toBeGreaterThan(0);
        }
        expect(checked).toBeGreaterThanOrEqual(3);
    });
});

/** Steers a scripted player straight at `to`, not shooting. */
function run(p: Player, to: Vec2): void {
    const d = v2.normalizeSafe(v2.sub(to, p.pos));
    p.input = {
        ...p.input,
        moveLeft: d.x < -0.38,
        moveRight: d.x > 0.38,
        moveUp: d.y > 0.38,
        moveDown: d.y < -0.38,
        toMouseDir: d,
        shootStart: false,
        shootHold: false,
    };
}

/** A seen obstacle of `type` at `pos` (synthetic, for the arc check). */
function seenObstacle(type: string, pos: Vec2): SeenObstacle {
    const def = obstacleDef(type) as ObstacleDef;
    return {
        view: { kind: "obstacle", id: 1, type, pos, layer: 0, ori: 0, scale: 1, healthT: 1, dead: false },
        def,
        col: obstacleCollider(def, pos, 0, 1),
        solid: true,
        blocksBullets: true,
        blocksMove: true,
    };
}

describe("grenade craft and judgement by skill (user report 30)", () => {
    it("composed from the skill axes: decisions follow g, the hand follows s, no tier branches", () => {
        const at = (s: number, g: number) => skillParams(s, g).frag;
        for (const [lo, hi] of [
            [0, 0.3],
            [0.3, 0.6],
            [0.6, 1],
        ]) {
            expect(at(0.5, hi).recall).toBeGreaterThanOrEqual(at(0.5, lo).recall);
            expect(at(0.5, hi).craft).toBeGreaterThan(at(0.5, lo).craft);
            expect(at(0.5, hi).pathCheck).toBeGreaterThan(at(0.5, lo).pathCheck);
            expect(at(0.5, hi).coverWait).toBeLessThan(at(0.5, lo).coverWait);
            expect(at(0.5, hi).waste).toBeLessThanOrEqual(at(0.5, lo).waste);
            expect(at(hi, 0.5).shortBias).toBeLessThan(at(lo, 0.5).shortBias);
            expect(at(hi, 0.5).rangeSd).toBeLessThan(at(lo, 0.5).rangeSd);
            expect(at(hi, 0.5).lateralDeg).toBeLessThan(at(lo, 0.5).lateralDeg);
            expect(at(hi, 0.5).motionComp).toBeGreaterThan(at(lo, 0.5).motionComp);
            expect(skillParams(0.5, hi).misjudge).toBeLessThanOrEqual(skillParams(0.5, lo).misjudge);
        }
        // the hand does not change with g, the decisions not with s
        expect(at(0.2, 0.1).shortBias).toBe(at(0.2, 0.9).shortBias);
        expect(at(0.1, 0.4).craft).toBe(at(0.9, 0.4).craft);
        // the presets are the sense anchors: a beginner forgets and wastes frags, an expert never does
        expect(skillParams(1, 1).frag).toEqual(HARD.frag);
        expect(EASY.frag.recall).toBeLessThan(1);
        expect(EASY.frag.waste).toBeGreaterThan(0);
        expect(HARD.frag.waste).toBe(0);
        expect(HARD.misjudge).toBe(0);
    });

    it("the arc check matches the simulation: trees always stop a frag, low cover only a rolling one", () => {
        const SPOT = openSpot(flatGame({ sandbox: true }));
        const cases: Array<[string, number, number]> = [
            ["stone_01", 4, 14],
            ["stone_01", 12, 14],
            ["stone_01", 16, 26],
            ["stone_01", 9, 22],
            ["crate_01", 18, 22],
            ["crate_01", 6, 18],
            ["tree_01", 6, 26],
            ["tree_01", 15, 22],
        ];
        for (const [type, k, d] of cases) {
            const pos = v2.add(SPOT, { x: k, y: 0 });
            const passed = simulatedRest(SPOT, type, pos, d) > k + 1;
            const clear = arcBlocker("frag", SPOT, v2.add(SPOT, { x: d, y: 0 }), [seenObstacle(type, pos)], 0) === null;
            expect(clear, `${type} at ${k}, thrown to ${d}`).toBe(passed);
        }
    });

    it("an expert throws round a tree in the way; a beginner mostly throws into it", () => {
        const setup = () => {
            const w = world();
            addObstacle(w, { x: 16, y: 0 }, "tree_01");
            const target = v2.add(w.spot, { x: 18.6, y: 0 });
            return { w, target, aim: behindCoverPoint(w.model, w.spot, target) };
        };
        const { w, target, aim } = setup();
        expect(throwBlocker("frag", w.spot, aim, w.model.obstacles, 0)).not.toBeNull();
        const expert = brain(w, HARD).context(NOW);
        expect(checksPath(expert)).toBe(true);
        const pick = clearLanding(expert, "frag", aim, target, true) as Vec2;
        expect(pick).not.toBeNull();
        expect(throwBlocker("frag", w.spot, pick, w.model.obstacles, 0)).toBeNull();
        expect(v2.distance(pick, target)).toBeLessThanOrEqual(fragBlast("frag").min + 0.5);
        let straight = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const s = setup();
            const ctx = brain(s.w, EASY, seed).context(NOW);
            const p = clearLanding(ctx, "frag", s.aim, s.target, checksPath(ctx));
            if (p && v2.distance(p, s.aim) < 1e-9) straight++;
        }
        expect(straight).toBeGreaterThan(28);
    });

    it("beginners forget their frags for a whole engagement; experts never do, and draw nothing for it", () => {
        let forgot = 0;
        for (let seed = 1; seed <= 100; seed++) {
            const w = world();
            const b = brain(w, EASY, seed);
            const first = recallsFrags(b.context(NOW), 2);
            // the same engagement keeps the answer
            for (let k = 1; k <= 5; k++) expect(recallsFrags(b.context(NOW + k), 2)).toBe(first);
            if (!first) forgot++;
        }
        expect(forgot).toBeGreaterThan(40);
        expect(forgot).toBeLessThan(80);
        const w = world();
        const b = brain(w, HARD, 7);
        expect(recallsFrags(b.context(NOW), 2)).toBe(true);
        expect(b.context(NOW).rng.next()).toBe(createRng(7).next());
    });

    it("beginners throw late (longer behind cover first) and waste frags on enemies in the open; experts do neither", () => {
        const covered = (params: DifficultyParams, since: number) => {
            const w = world();
            w.model.self.inventory.frag = 2;
            addObstacle(w, { x: 16, y: 0 });
            addEnemy(w, 2, { x: 19.5, y: 0 });
            const b = brain(w, params);
            reacted(b, 2);
            b.mem.fight.coverTarget = 2;
            b.mem.fight.coveredSince = NOW - since;
            const ctx = b.context(NOW);
            return fragGates(ctx, ctx.target as NonNullable<typeof ctx.target>);
        };
        expect(covered(HARD, 1)).toBe(true);
        expect(covered(EASY, 1)).toBe(false);
        expect(covered(EASY, 2.5)).toBe(true);
        const wasted = (params: DifficultyParams, dist: number) => {
            let n = 0;
            for (let seed = 1; seed <= 120; seed++) {
                const w = world();
                w.model.self.inventory.frag = 3;
                giveGunTo(w);
                addEnemy(w, 2, { x: dist, y: 0 });
                const b = brain(w, { ...params, frag: { ...params.frag, recall: 1 } }, seed);
                reacted(b, 2);
                const plan = smartGrenade(b.context(NOW), 2);
                if (plan) {
                    expect(b.mem.fight.trace.last("cook")?.detail).toMatch(/^waste/);
                    // out of reach it is thrown as far as it goes and falls short
                    expect(v2.distance(plan.pos, w.spot)).toBeLessThan(33);
                    n++;
                }
            }
            return n;
        };
        expect(wasted(HARD, 18)).toBe(0);
        expect(wasted(HARD, 36)).toBe(0);
        expect(wasted(EASY, 18)).toBeGreaterThan(3);
        expect(wasted(EASY, 36)).toBeGreaterThan(3);
    });

    it("beginners throw short and wide, experts tight", () => {
        const spread = (params: DifficultyParams) => {
            const w = world();
            const b = brain(w, params, 3);
            const ctx = b.context(NOW);
            const target = v2.add(w.spot, { x: 20, y: 0 });
            const d: number[] = [];
            const side: number[] = [];
            for (let k = 0; k < 300; k++) {
                const plan = fragPlan(ctx, "frag", target, "cover");
                d.push(v2.distance(plan.pos, w.spot));
                side.push(Math.abs(plan.pos.y - w.spot.y));
            }
            const mean = d.reduce((a, x) => a + x, 0) / d.length;
            const sd = Math.sqrt(d.reduce((a, x) => a + (x - mean) ** 2, 0) / d.length);
            return { mean, sd, side: side.reduce((a, x) => a + x, 0) / side.length };
        };
        const easy = spread(EASY);
        const hard = spread(HARD);
        expect(easy.mean).toBeLessThan(19.2);
        expect(easy.mean).toBeGreaterThan(17);
        expect(easy.sd).toBeGreaterThan(1.6);
        expect(Math.abs(hard.mean - 20)).toBeLessThan(0.3);
        expect(hard.sd).toBeLessThan(1);
        expect(easy.side).toBeGreaterThan(2 * hard.side);
        // the baseline brain's frags go where they are aimed
        const w = world();
        const base = new Brain(w.model, EASY, createRng(1), BRAIN_PRESETS.baseline).context(NOW);
        const target = v2.add(w.spot, { x: 20, y: 0 });
        expect(fragPlan(base, "frag", target, "none").pos).toEqual(target);
    });

    it("beginners misjudge a fight for the whole engagement (mostly overconfident); average and better bots do not", () => {
        const lost = (params: DifficultyParams, seed: number) => {
            const w = world();
            w.model.self.health = 20;
            const e = addEnemy(w, 2, { x: 20, y: 0 }, { helmet: "helmet03", chest: "chest03" });
            faceTo(e, w.spot);
            return { w, b: brain(w, params, 1, undefined, seed), e };
        };
        for (const params of [NORMAL, HARD]) {
            const { b, e } = lost(params, 1);
            const ctx = b.context(NOW);
            expect(ctx.assessment?.advantage).toBe(assess(ctx, e).advantage);
        }
        const errors: number[] = [];
        let bold = 0;
        for (let seed = 1; seed <= 200; seed++) {
            const { b, e } = lost(EASY, seed);
            const ctx = b.context(NOW);
            const raw = assess(ctx, e).advantage;
            const err = (ctx.assessment?.advantage ?? 0) - raw;
            // the same belief a moment later
            const again = b.context(NOW + 0.5);
            expect((again.assessment?.advantage ?? 0) - assess(again, e).advantage).toBeCloseTo(err, 6);
            errors.push(err);
            // a clearly lost trade (-1.9 here) it now believes it might win
            if ((ctx.assessment?.advantage ?? 0) > -1) bold++;
        }
        const mean = errors.reduce((a, x) => a + x, 0) / errors.length;
        const sd = Math.sqrt(errors.reduce((a, x) => a + (x - mean) ** 2, 0) / errors.length);
        expect(mean).toBeGreaterThan(0.15);
        expect(mean).toBeLessThan(0.45);
        expect(sd).toBeGreaterThan(0.4);
        expect(sd).toBeLessThan(0.8);
        expect(bold).toBeGreaterThan(10);
        expect(b2(EASY).mem.fight.trace.last("judge")).toBeUndefined();
    });

    it("simulation: an expert's frag goes round the tree a target hides behind and hurts it; most beginners' do not", () => {
        const hurt = (skill: number, sense: number) => {
            let hits = 0;
            for (const seed of [1, 2, 3, 4]) {
                const SPOT = openSpot(flatGame({ sandbox: true }));
                const tree = v2.add(SPOT, { x: 18, y: 0 });
                const game = flatGame({ sandbox: true }, 1, [{ type: "tree_01", pos: tree }]);
                const me = placePlayer(game, "bot", SPOT);
                giveGun(me, "ak47", 90, WeaponSlot.Primary);
                me.inv.set("frag", 3);
                const dummy = placePlayer(game, "dummy", v2.add(tree, { x: 0, y: 7 }));
                const bot = new BotController(game, me.id, { seed, skill, sense });
                const hide = v2.add(tree, { x: 2.6, y: 0 });
                let worst = 0;
                for (let i = 0; i < 1200 && me.inv.get("frag") === 3; i++) {
                    if (i === 60) game.teleportPlayer(dummy.id, hide);
                    bot.update();
                    game.step();
                    game.teleportPlayer(me.id, SPOT);
                    dummy.health = 100;
                }
                for (let i = 0; i < 500; i++) {
                    bot.update();
                    game.step();
                    game.teleportPlayer(me.id, SPOT);
                    worst = Math.max(worst, 100 - dummy.health);
                    dummy.health = 100;
                    if (game.projectiles.projectiles.length === 0) break;
                }
                if (worst > 20) hits++;
            }
            return hits;
        };
        expect(hurt(0.85, 0.95)).toBeGreaterThanOrEqual(3);
        expect(hurt(0.15, 0.1)).toBeLessThanOrEqual(1);
    });
});

describe("its own frag", () => {
    it("is run from once it lies within its blast (smart), never in the hand; the baseline keeps ignoring it", () => {
        const setup = (shown: number) => {
            const w = world();
            const at = v2.add(w.spot, { x: 6, y: 0 });
            w.model.projectiles = [{ id: 9, type: "frag", pos: at, posZ: 0, dir: { x: 1, y: 0 }, layer: 0 }];
            w.model.projectileSeen.set(9, NOW - shown);
            return { w, at };
        };
        const run = (features: typeof SMART, shown: number) => {
            const { w, at } = setup(shown);
            const b = new Brain(w.model, NORMAL, createRng(1), features);
            b.mem.lastThrow = NOW - 2;
            b.mem.lastThrowPos = v2.copy(at);
            const intent = emptyIntent("fight");
            intent.goal = v2.copy(at);
            dodge(b.context(NOW), intent);
            return intent.moveDir;
        };
        // landed 6 units ahead of a bot walking up to it: it backs away
        const away = run(SMART, 1.5);
        expect(away).not.toBeNull();
        expect((away as Vec2).x).toBeLessThan(-0.5);
        // just out of the hand: not yet
        expect(run(SMART, 0.2)).toBeNull();
        expect(run(BRAIN_PRESETS.baseline, 1.5)).toBeNull();
    });
});

/** A fresh beginner brain with no target in sight (no assessment, so no belief is drawn). */
function b2(params: DifficultyParams): Brain {
    const w = world();
    const b = brain(w, params);
    b.context(NOW);
    return b;
}

/** The bot holds an mp5 with a full magazine (testWorld's default) and ammo. */
function giveGunTo(w: TestWorld): void {
    w.model.self.weapons[0] = { type: "mp5", ammo: 30 };
    w.model.self.inventory["9mm"] = 90;
}

/** Throws a frag along +x from `spot` past an obstacle at `pos` with the mouse distance for `dist`; where it rests. */
function simulatedRest(spot: Vec2, type: string, pos: Vec2, dist: number): number {
    const game = flatGame({ sandbox: true }, 1, [{ type, pos }]);
    const p = placePlayer(game, "thrower", spot);
    p.inv.set("frag", 1);
    p.weaponManager.setWeapon(WeaponSlot.Throwable, "frag", 0);
    p.weaponManager.setCurWeapIndex(WeaponSlot.Throwable);
    const len = throwMouseLen("frag", dist);
    const send = (o: object) =>
        game.setInput(p.id, { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, toMouseLen: len, ...o });
    send({ shootStart: true, shootHold: true });
    game.step();
    for (let i = 0; i < 15; i++) {
        send({ shootHold: true });
        game.step();
    }
    send({});
    let x = spot.x;
    const all = { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } };
    for (let i = 0; i < 300; i++) {
        game.step();
        const proj = game.projectiles.views(all);
        if (proj.length) x = proj[0].pos.x;
    }
    return x - spot.x;
}
