// Early-game pacing (owner's early-deaths report, 2026-10-08; brain/earlyPace.ts): in the loot phase an armed bot
// starts fights only if it hunts (one roll per bot for the match, under persona and loadout odds that grow as the
// phase fades); one that does not hunt neither takes on nor shoots at an enemy that has not provoked it, and loots
// away from armed ones; up close or shot at it fights as before. The fist rush breaks off when it loses the race, and
// two unarmed bots fist-fight less readily in the loot phase and with loot close by (brain/early.ts, brain/fists.ts).
import { WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { holdFire } from "../src/brain/assess.ts";
import type { BrainProfile } from "../src/brain/brain.ts";
import { avoidPos } from "../src/brain/danger.ts";
import { rushScore } from "../src/brain/early.ts";
import { huntOdds, leftBe, pacedExtension, paceStrength } from "../src/brain/earlyPace.ts";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import { fightScore } from "../src/brain/fightScore.ts";
import { fightOdds, fistDuelScore, losingFistFight } from "../src/brain/fists.ts";
import { fleeScore } from "../src/brain/survival.ts";
import { PERSONAS } from "../src/persona.ts";
import { addEnemy, brainOf, faceTo, NOW, setGas, TableIntel, type TestWorld, testWorld } from "./brain-world.ts";

const SMART = BRAIN_PRESETS.smart;
const WITHOUT: Readonly<BrainFeatures> = { ...SMART, earlyPace: false };
const persona = (name: keyof typeof PERSONAS): BrainProfile => ({ persona: PERSONAS[name] });

/** The armed test bot with a quiet armed enemy `dist` units away, facing off. */
function farEnemy(dist: number): TestWorld {
    const w = testWorld();
    addEnemy(w, 2, { x: dist, y: 0 });
    return w;
}

function score(w: TestWorld, features: Readonly<BrainFeatures>, seed = 1, profile: BrainProfile = {}): number {
    return fightScore(brainOf(w, features, "normal", seed, profile).context(NOW));
}

/** Past the loot phase: the third circle's wait. */
function late(w: TestWorld): void {
    setGas(w, { x: 0, y: 0 }, 100, "waiting");
    if (w.model.gas) w.model.gas.circleIdx = 3;
}

describe("early-game pacing: the loot phase", () => {
    it("fades with the gas: full through the first wait and move, gone once the third circle has closed", () => {
        const w = testWorld();
        const strength = () => paceStrength(brainOf(w, SMART).context(NOW));
        expect(strength()).toBe(1);
        const steps: Array<[number, "waiting" | "moving", number, number]> = [
            [0, "waiting", 0.9, 1],
            [0, "moving", 0.5, 1],
            [1, "waiting", 0, 1],
            [1, "waiting", 0.5, 7 / 8],
            [1, "moving", 0, 3 / 4],
            [2, "waiting", 0, 1 / 2],
            [2, "moving", 0, 1 / 4],
            [2, "moving", 1, 0],
            [3, "waiting", 0, 0],
        ];
        for (const [circle, mode, gasT, want] of steps) {
            setGas(w, { x: 0, y: 0 }, 100, mode);
            if (w.model.gas) Object.assign(w.model.gas, { circleIdx: circle, gasT });
            expect(strength(), `circle ${circle} ${mode} ${gasT}`).toBeCloseTo(want, 6);
        }
    });

    it("a quiet armed enemy far off is mostly left be: few bots hunt, bold personas more often", () => {
        const leaveRate = (name: keyof typeof PERSONAS) => {
            let left = 0;
            for (let seed = 1; seed <= 60; seed++) {
                const w = farEnemy(25);
                const brain = brainOf(w, SMART, "normal", seed, persona(name));
                const s1 = fightScore(brain.context(NOW));
                // held: the same answer on the next think, from the same roll
                const roll = brain.mem.early.huntRoll;
                expect(fightScore(brain.context(NOW + 0.5))).toBe(s1);
                expect(brain.mem.early.huntRoll).toBe(roll);
                expect(brain.mem.early.hunting).toBe(s1 >= 0.12);
                if (s1 < 0.12) left++;
            }
            return left / 60;
        };
        const rifleman = leaveRate("rifleman");
        const rusher = leaveRate("rusher");
        expect(rifleman).toBeGreaterThan(0.75);
        expect(leaveRate("camper")).toBeGreaterThan(0.9);
        expect(rusher).toBeLessThan(rifleman);
        expect(rusher).toBeGreaterThan(0.5);
        // the odds behind it: a rusher most, a rat least, a better gun more
        const w = farEnemy(25);
        const odds = (name: keyof typeof PERSONAS, confidence = 1) =>
            huntOdds(brainOf(w, SMART, "normal", 1, persona(name)).context(NOW), confidence);
        expect(odds("rusher")).toBeGreaterThan(odds("rifleman"));
        expect(odds("rifleman")).toBeGreaterThan(odds("rat"));
        expect(odds("rifleman", 1.1)).toBeGreaterThan(odds("rifleman", 0.55));
    });

    it("the roll is the bot's, not the enemy's: a bot that does not hunt leaves every quiet enemy be", () => {
        const w = farEnemy(25);
        addEnemy(w, 3, { x: 0, y: 20 });
        const brain = brainOf(w, SMART, "normal", 1, persona("rusher"));
        brain.mem.early.huntRoll = 0.99;
        expect(fightScore(brain.context(NOW))).toBeLessThan(0.12);
        // the first one gone: the second is the target now, with the same verdict
        w.model.contacts.delete(2);
        const ctx = brain.context(NOW + 0.5);
        expect(ctx.target?.id).toBe(3);
        expect(fightScore(ctx)).toBeLessThan(0.12);
        expect(brain.mem.early.huntRoll).toBe(0.99);
        // a hunter takes it on as before
        const hunter = brainOf(w, SMART, "normal", 1, persona("rusher"));
        hunter.mem.early.huntRoll = 0;
        expect(fightScore(hunter.context(NOW + 1))).toBe(score(w, WITHOUT, 1, persona("rusher")));
    });

    it("at arm's reach, shooting at the bot, or past the loot phase: the score is untouched", () => {
        const quiet = (w: TestWorld) => {
            const brain = brainOf(w, SMART);
            brain.mem.early.huntRoll = 0.99;
            return fightScore(brain.context(NOW));
        };
        const close = farEnemy(2.5);
        const c = close.model.contacts.get(2);
        if (!c) throw new Error("no enemy");
        // its back to the bot: walking past
        expect(quiet(close)).toBeLessThan(0.12);
        faceTo(c, close.spot);
        expect(quiet(close)).toBe(score(close, WITHOUT));
        const shooting = farEnemy(25);
        const e = shooting.model.contacts.get(2);
        if (!e) throw new Error("no enemy");
        faceTo(e, shooting.spot);
        e.lastShotAt = NOW - 0.5;
        expect(quiet(shooting)).toBe(score(shooting, WITHOUT));
        const after = farEnemy(25);
        late(after);
        const brain = brainOf(after, SMART);
        expect(fightScore(brain.context(NOW))).toBe(score(after, WITHOUT));
        expect(brain.mem.early.hunting).toBe(true);
        expect(Number.isNaN(brain.mem.early.huntRoll)).toBe(true);
    });

    it("a bare-handed enemy rushing the bot is a threat; an armed one walking its way is still a choice", () => {
        const w = farEnemy(3.8);
        const e = w.model.contacts.get(2);
        if (!e) throw new Error("no enemy");
        faceTo(e, w.spot);
        e.vel = { x: -6, y: 0 };
        e.activeWeapon = "fists";
        e.lastArmedAt = Number.NEGATIVE_INFINITY;
        const quiet = () => {
            const brain = brainOf(w, SMART, "normal", 1, persona("camper"));
            brain.mem.early.huntRoll = 0.99;
            return fightScore(brain.context(NOW));
        };
        expect(quiet()).toBe(score(w, WITHOUT, 1, persona("camper")));
        // the same approach holding a gun (walking to loot near the bot, as bots look where they walk): left be
        e.activeWeapon = "mp5";
        e.lastArmedAt = NOW;
        expect(quiet()).toBeLessThan(0.12);
        expect(score(w, WITHOUT, 1, persona("camper"))).toBeGreaterThan(0.5);
    });

    it("a provocation holds a while after its last sign, not for as long as the bot keeps shooting", () => {
        const w = farEnemy(25);
        const e = w.model.contacts.get(2);
        if (!e) throw new Error("no enemy");
        faceTo(e, w.spot);
        e.lastShotAt = NOW - 0.5;
        const brain = brainOf(w, SMART);
        brain.mem.early.huntRoll = 0.99;
        const at = (t: number) => {
            w.model.time = t;
            e.lastSeen = t;
            return fightScore(brain.context(t));
        };
        const fighting = at(NOW);
        expect(fighting).toBeGreaterThan(0.5);
        // it stopped shooting: held 6 s after its last shot, though the bot fires at it all the while
        brain.mem.fight.fireTarget = 2;
        brain.mem.fight.fireAt = NOW + 4;
        expect(at(NOW + 4)).toBeGreaterThan(0.5);
        expect(at(NOW + 7)).toBeLessThan(0.12);
    });

    it("once a bot hunts it keeps hunting, and the phase's end makes every bot a hunter", () => {
        const w = farEnemy(25);
        const brain = brainOf(w, SMART, "normal", 1, persona("rat"));
        brain.mem.early.huntRoll = 0.5;
        expect(fightScore(brain.context(NOW))).toBeLessThan(0.12);
        setGas(w, { x: 0, y: 0 }, 100, "waiting");
        if (w.model.gas) Object.assign(w.model.gas, { circleIdx: 2, gasT: 0.2 });
        // 1 - 0.45 x (1 - 0.02) > 0.5: hunting now
        expect(fightScore(brain.context(NOW))).toBe(score(w, WITHOUT, 1, persona("rat")));
        expect(brain.mem.early.hunting).toBe(true);
        // back in a full phase (as a test can do): still hunting
        if (w.model.gas) Object.assign(w.model.gas, { circleIdx: 0, gasT: 0 });
        expect(fightScore(brain.context(NOW))).toBe(score(w, WITHOUT, 1, persona("rat")));
    });

    it("a bot that does not hunt neither joins others' fights nor searches for a lost enemy", () => {
        const w = farEnemy(25);
        const brain = brainOf(w, SMART);
        const ctx = brain.context(NOW);
        brain.mem.early.hunting = false;
        expect(pacedExtension(ctx, "thirdparty", 0.7)).toBe(0);
        expect(pacedExtension(ctx, "search", 0.5)).toBe(0);
        expect(pacedExtension(ctx, "loot" as never, 0.5)).toBe(0.5);
        expect(pacedExtension(ctx, "airdrop", 0.6)).toBe(0.6);
        brain.mem.early.hunting = true;
        expect(pacedExtension(ctx, "thirdparty", 0.7)).toBe(0.7);
    });

    it("a bot that does not hunt looks for loot away from armed enemies; a hunter does not, nor anyone after it", () => {
        const w = farEnemy(20);
        const brain = brainOf(w, SMART);
        const nearIt = { x: w.spot.x + 16, y: w.spot.y };
        const farFromIt = { x: w.spot.x - 10, y: w.spot.y };
        brain.mem.early.hunting = false;
        expect(avoidPos(brain.context(NOW), nearIt)).toBe(true);
        expect(avoidPos(brain.context(NOW), farFromIt)).toBe(false);
        brain.mem.early.hunting = true;
        expect(avoidPos(brain.context(NOW), nearIt)).toBe(false);
        brain.mem.early.hunting = false;
        late(w);
        expect(avoidPos(brain.context(NOW), nearIt)).toBe(false);
    });

    it("an enemy left be is not shot at on the move; by a hunter, or once it shoots, it is", () => {
        const w = farEnemy(25);
        const brain = brainOf(w, SMART);
        brain.mem.early.hunting = false;
        const ctx = brain.context(NOW);
        const e = ctx.model.contacts.get(2);
        if (!e) throw new Error("no enemy");
        expect(leftBe(ctx, e, 25)).toBe(true);
        expect(holdFire(ctx, e, 25)).toBe(true);
        brain.mem.early.hunting = true;
        expect(holdFire(brain.context(NOW), e, 25)).toBe(false);
        brain.mem.early.hunting = false;
        faceTo(e, w.spot);
        e.lastShotAt = NOW - 0.5;
        expect(holdFire(brain.context(NOW), e, 25)).toBe(false);
    });
});

describe("early-game fists made sane", () => {
    function unarmedWithGunman(dist: number): TestWorld {
        const w = testWorld();
        w.model.self.weapons[WeaponSlot.Primary] = { type: "", ammo: 0 };
        w.model.self.curWeapIdx = WeaponSlot.Melee;
        addEnemy(w, 2, { x: dist, y: 0 }, { activeWeapon: "mp5" });
        return w;
    }

    it("a rusher that loses the race breaks off: hit short of the punch with little health, or not closing in", () => {
        const hit = unarmedWithGunman(10);
        const brain = brainOf(hit, ["fistRush"]);
        brain.mem.early.rush.set(2, { yes: true, until: NOW + 19 });
        expect(rushScore(brain.context(NOW))).toBeGreaterThan(0);
        hit.model.self.health = 40;
        hit.model.lastHurt = NOW - 0.2;
        expect(rushScore(brain.context(NOW))).toBe(0);
        expect(brain.mem.early.rush.get(2)?.yes).toBe(false);
        const slow = unarmedWithGunman(10);
        const b2 = brainOf(slow, ["fistRush"]);
        // decided 6 s ago and still 10 u away
        b2.mem.early.rush.set(2, { yes: true, until: NOW + 14 });
        expect(rushScore(b2.context(NOW))).toBe(0);
    });

    it("no rush is decided at a gunman already shooting at the bot", () => {
        const w = unarmedWithGunman(10);
        const e = w.model.contacts.get(2);
        if (!e) throw new Error("no enemy");
        faceTo(e, w.spot);
        e.lastShotAt = NOW - 0.3;
        const brain = brainOf(w, ["fistRush"], "normal", 1, persona("rusher"));
        expect(rushScore(brain.context(NOW))).toBe(0);
        expect(brain.mem.early.rush.size).toBe(0);
    });

    function bareHands(): { w: TestWorld; odds: (f: Readonly<BrainFeatures>) => number } {
        const w = testWorld();
        w.model.self.weapons[WeaponSlot.Primary] = { type: "", ammo: 0 };
        w.model.self.curWeapIdx = WeaponSlot.Melee;
        const c = addEnemy(w, 2, { x: 6, y: 0 }, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
        faceTo(c, w.spot);
        return { w, odds: (f) => fightOdds(brainOf(w, f).context(NOW), c) };
    }

    it("two unarmed bots with a gun lying close: the odds of a fist fight drop", () => {
        const { w, odds } = bareHands();
        const bare = odds(SMART);
        const without = odds(WITHOUT);
        w.model.loot.set(50, {
            id: 50,
            type: "mp5",
            pos: { x: w.spot.x - 8, y: w.spot.y },
            count: 1,
            layer: 0,
            lastSeen: NOW,
        });
        expect(odds(SMART)).toBeLessThan(bare);
        expect(odds(WITHOUT)).toBe(without);
    });

    it("a bot losing a fist fight in the loot phase gets out of it: no duel, no punch-back, it runs", () => {
        const { w } = bareHands();
        const c = w.model.contacts.get(2);
        if (!c) throw new Error("no enemy");
        c.pos = { x: w.spot.x + 2.5, y: w.spot.y };
        w.model.lastHurt = NOW - 0.5;
        const brain = brainOf(w, SMART);
        brain.mem.pursuit.fists.set(2, { fight: true, until: NOW + 18 });
        // the fight begins at full health: it fights on (the punch-back)
        expect(fightScore(brain.context(NOW))).toBe(0.7);
        // one punch taken: still on
        w.model.self.health = 76;
        expect(fightScore(brain.context(NOW + 1))).toBe(0.7);
        // 70 taken, the enemy untouched: it gets out
        w.model.self.health = 30;
        const losing = brain.context(NOW + 2);
        expect(losingFistFight(losing, c)).toBe(true);
        expect(fightScore(losing)).toBe(0);
        expect(fistDuelScore(losing)).toBe(0);
        expect(fleeScore(brain.context(NOW + 2))).toBeGreaterThan(0.7);
        // an even trade goes on until the bot is low
        const intel = new TableIntel();
        intel.table.set(2, { estHealth: 55 });
        w.model.intel = intel;
        w.model.self.health = 50;
        expect(losingFistFight(brain.context(NOW + 2.5), c)).toBe(false);
        w.model.self.health = 35;
        intel.table.set(2, { estHealth: 40 });
        expect(losingFistFight(brain.context(NOW + 3), c)).toBe(true);
        w.model.self.health = 30;
        // a fight first seen with the bot already hurt is no lost fight (round 5: it punches back)
        const hurt = bareHands().w;
        hurt.model.self.health = 30;
        hurt.model.lastHurt = NOW - 0.5;
        const c2 = hurt.model.contacts.get(2);
        if (c2) c2.pos = { x: hurt.spot.x + 2.5, y: hurt.spot.y };
        expect(fightScore(brainOf(hurt, SMART).context(NOW))).toBe(0.7);
        // without the feature, or past the loot phase, the old rule: punch back whatever the health
        w.model.intel = new TableIntel();
        const old = brainOf(w, WITHOUT);
        old.context(NOW - 2);
        expect(fightScore(old.context(NOW))).toBe(0.7);
        expect(fleeScore(old.context(NOW))).toBe(0);
        late(w);
        const after = brainOf(w, SMART);
        w.model.self.health = 100;
        after.context(NOW - 2);
        w.model.self.health = 30;
        expect(losingFistFight(after.context(NOW), c)).toBe(false);
        expect(fightScore(after.context(NOW))).toBe(0.7);
    });

    it("the loot phase takes the edge off fist fights; past it the odds are the old ones", () => {
        const { w, odds } = bareHands();
        expect(odds(SMART)).toBeLessThan(odds(WITHOUT));
        late(w);
        expect(odds(SMART)).toBe(odds(WITHOUT));
    });
});
