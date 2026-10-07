// Round 5 (user report 35): everyone bare-handed. Fists against fists is a fight or nothing, never a flight, and an
// unarmed enemy no longer chases a bot off its loot or out of the house it sweeps (the roof hid the enemy again the
// moment the bot stepped out, so it walked back in: the in-out loop). An armed enemy in the house the bot loots on
// marks the house as contested (no walking back in). Unit checks on synthetic worlds, then the simulation.
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { BuildingView, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { BrainProfile } from "../src/brain/brain.ts";
import { type BrainCtx, emptyIntent } from "../src/brain/context.ts";
import { avoidPos, noteContested } from "../src/brain/danger.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { DECIDE_RANGE, DUEL_SCORE, fightOdds, meleeDps } from "../src/brain/fists.ts";
import { flightScore } from "../src/brain/flight.ts";
import { lootDamping, threatening } from "../src/brain/lootRisk.ts";
import { BotController } from "../src/controller.ts";
import { personaParams } from "../src/persona.ts";
import { addEnemy, brainOf, faceTo, NOW, type TestWorld, testWorld } from "./brain-world.ts";
import { flatGame, placePlayer } from "./helpers.ts";

/** The test world's bot with its gun taken away (fists only). */
function unarmed(): TestWorld {
    const w = testWorld();
    w.model.self.weapons[WeaponSlot.Primary] = { type: "", ammo: 0 };
    w.model.self.curWeapIdx = WeaponSlot.Melee;
    return w;
}

function ctxOf(w: TestWorld, features: typeof BRAIN_PRESETS.smart, profile: BrainProfile = {}): BrainCtx {
    return brainOf(w, features, "normal", 1, profile).context(NOW);
}

function fistEnemy(w: TestWorld, id: number, off: { x: number; y: number }) {
    const c = addEnemy(w, id, off, { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY });
    faceTo(c, w.spot);
    return c;
}

describe("bare hands against bare hands (unit)", () => {
    it("an unarmed enemy close by does not damp the loot of an unarmed bot (smart), it still does for the baseline", () => {
        const w = unarmed();
        fistEnemy(w, 2, { x: 5, y: 0 });
        const smart = ctxOf(w, BRAIN_PRESETS.smart);
        expect(threatening(smart, smart.visibleEnemies[0])).toBe(false);
        expect(lootDamping(smart)).toBe(0.9);
        const base = ctxOf(w, BRAIN_PRESETS.baseline);
        expect(threatening(base, base.visibleEnemies[0])).toBe(true);
    });

    it("an unarmed bot never runs from one unarmed enemy, even hurt with heals in the bag", () => {
        const w = unarmed();
        w.model.self.health = 20;
        w.model.self.inventory.bandage = 5;
        fistEnemy(w, 2, { x: 3, y: 0 });
        const ctx = ctxOf(w, BRAIN_PRESETS.smart);
        expect(flightScore(ctx)).toBe(0);
        // two of them, hurt: running is allowed
        fistEnemy(w, 3, { x: -3, y: 1 });
        expect(flightScore(ctxOf(w, BRAIN_PRESETS.smart))).toBeGreaterThan(0.5);
        // an armed one: the flight as before
        const w2 = unarmed();
        addEnemy(w2, 2, { x: 10, y: 0 }, { activeWeapon: "ak47" });
        faceTo(w2.model.contacts.get(2)!, w2.spot);
        expect(flightScore(ctxOf(w2, BRAIN_PRESETS.smart))).toBeGreaterThan(0.7);
    });

    it("the choice to fight is taken once per enemy and held, and some bots take it while others loot on", () => {
        let fights = 0;
        for (let seed = 1; seed <= 24; seed++) {
            const w = unarmed();
            fistEnemy(w, 2, { x: 6, y: 0 });
            const brain = brainOf(w, BRAIN_PRESETS.smart, "normal", seed);
            const first = brain.think(100, 0.1);
            const s1 = brain.lastScores.fight ?? 0;
            // the enemy steps out of view and back (a roof, the screen edge): the same decision
            w.model.contacts.get(2)!.visible = false;
            brain.think(100.5, 0.5);
            w.model.contacts.get(2)!.visible = true;
            w.model.time = 101;
            brain.think(101, 0.5);
            const s2 = brain.lastScores.fight ?? 0;
            expect(first.behaviour, `seed ${seed}`).not.toBe("flee");
            expect(s2, `seed ${seed}`).toBe(s1);
            if (s1 === DUEL_SCORE) fights++;
        }
        expect(fights).toBeGreaterThan(4);
        expect(fights).toBeLessThan(22);
    });

    it("the odds follow the persona, the health and the melee weapon", () => {
        const w = unarmed();
        const c = fistEnemy(w, 2, { x: DECIDE_RANGE - 1, y: 0 });
        const neutral = fightOdds(ctxOf(w, BRAIN_PRESETS.smart), c);
        const rusher = fightOdds(ctxOf(w, BRAIN_PRESETS.smart, { persona: personaParams("rusher") }), c);
        const rat = fightOdds(ctxOf(w, BRAIN_PRESETS.smart, { persona: personaParams("rat") }), c);
        expect(rusher).toBeGreaterThan(neutral);
        expect(rat).toBeLessThan(neutral);
        w.model.self.health = 30;
        expect(fightOdds(ctxOf(w, BRAIN_PRESETS.smart), c)).toBeLessThan(neutral);
        w.model.self.health = 100;
        w.model.self.weapons[WeaponSlot.Melee] = { type: "machete", ammo: 0 };
        expect(meleeDps("machete")).toBeGreaterThan(meleeDps("fists"));
        expect(fightOdds(ctxOf(w, BRAIN_PRESETS.smart), c)).toBeGreaterThan(neutral);
    });
});

describe("contested house (unit)", () => {
    it("an armed enemy in the house the bot loots on keeps its loot out of reach for a while; an unarmed one does not", () => {
        for (const enemyGun of ["ak47", "fists"]) {
            const w = testWorld();
            const housePos = v2.add(w.spot, { x: 4, y: 0 });
            w.model.buildings = [
                {
                    kind: "building",
                    id: 91,
                    type: "house_red_01",
                    pos: housePos,
                    layer: 0,
                    ori: 0,
                    occupied: false,
                    ceilingDead: false,
                    ceilingDamaged: false,
                } as BuildingView,
            ];
            const e = addEnemy(
                w,
                2,
                { x: 6, y: 1 },
                enemyGun === "fists"
                    ? { activeWeapon: "fists", lastArmedAt: Number.NEGATIVE_INFINITY }
                    : { activeWeapon: enemyGun },
            );
            faceTo(e, v2.add(e.pos, { x: 0, y: 1 }));
            const brain = brainOf(w, BRAIN_PRESETS.smart);
            const loot = emptyIntent("loot");
            loot.goal = v2.add(housePos, { x: -2, y: 1 });
            noteContested(brain.context(NOW), loot);
            const later = brain.context(NOW + 10);
            expect(avoidPos(later, v2.add(housePos, { x: 1, y: -2 })), enemyGun).toBe(enemyGun !== "fists");
            // fighting it is no contest: nothing recorded
            const w2 = testWorld();
            w2.model.buildings = w.model.buildings;
            addEnemy(w2, 2, { x: 6, y: 1 }, { activeWeapon: "ak47" });
            const b2 = brainOf(w2, BRAIN_PRESETS.smart);
            noteContested(b2.context(NOW), emptyIntent("fight"));
            expect(avoidPos(b2.context(NOW + 10), housePos)).toBe(false);
        }
    });
});

/** Steps the scripted fist player: walks to `goal`, faces the bot, swings (a human's 0.3 s reaction, a swing every 0.6 s) at a bot in reach when `punch`. */
function human(
    game: ReturnType<typeof flatGame>,
    h: Player,
    p: Player,
    goal: { x: number; y: number },
    tick: number,
    st: { since: number; swing: number },
    punch: boolean,
): void {
    const to = v2.sub(goal, h.pos);
    const d = v2.length(to);
    const toBot = v2.sub(p.pos, h.pos);
    const near = punch && v2.length(toBot) < 3;
    if (!near) st.since = -1;
    else if (st.since < 0) st.since = tick;
    const swing = near && tick - st.since >= 30 && tick - st.swing >= 60;
    if (swing) st.swing = tick;
    game.setInput(h.id, {
        ...h.input,
        seq: tick & 255,
        moveRight: d > 0.8 && to.x > d * 0.38,
        moveLeft: d > 0.8 && to.x < -d * 0.38,
        moveUp: d > 0.8 && to.y > d * 0.38,
        moveDown: d > 0.8 && to.y < -d * 0.38,
        toMouseDir: v2.normalizeSafe(toBot),
        shootStart: swing,
        shootHold: false,
    });
}

describe("bare hands against bare hands (simulation)", () => {
    it("an unarmed bot next to an unarmed player loots on or fights it, never runs off", () => {
        let fought = 0;
        let looted = 0;
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const spot = { x: 200, y: 420 };
            const game = flatGame({ minPlayers: 99 });
            const p = placePlayer(game, "bot", spot);
            const h = placePlayer(game, "human", v2.add(spot, { x: 7, y: 0 }));
            for (const [k, item] of ["bandage", "soda", "helmet01", "backpack01", "painkiller"].entries())
                game.loot.addLoot(item, v2.add(spot, { x: -4 + 2.5 * k, y: k % 2 ? 3 : -3 }), 0, 1);
            for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, { x: 600 + k * 20, y: 120 });
            const bot = new BotController(game, p.id, { seed, skill: "intermediate" });
            const st = { since: -1, swing: -1000 };
            let flee = 0;
            let left = false;
            const hp0 = h.health;
            for (let i = 0; i < 1500 && !p.dead && !h.dead; i++) {
                bot.update();
                // the human strolls back and forth beside the loot, never attacking
                const goal = v2.add(spot, { x: 7, y: i % 600 < 300 ? -4 : 4 });
                human(game, h, p, goal, i, st, false);
                game.step();
                const b = bot.bot.intent.behaviour;
                if (b === "flee" || b === "evade" || b === "disengage") flee++;
                // more than 18 units away while nothing was picked up yet and the player did not chase it off
                const nothing = p.inv.get("bandage") === 0 && p.helmet === "" && p.backpack === "backpack00";
                if (nothing && v2.distance(p.pos, spot) > 18) left = true;
            }
            const picked = p.inv.get("bandage") > 0 || p.helmet !== "" || p.backpack !== "backpack00";
            if (h.health < hp0) fought++;
            if (picked) looted++;
            expect(flee, `seed ${seed}`).toBe(0);
            // (the old bot left the loot to an unarmed player 4-6 units away and explored elsewhere)
            expect(h.health < hp0 || picked, `seed ${seed}: neither fought nor looted`).toBe(true);
            expect(left, `seed ${seed}: walked off with the loot still there`).toBe(false);
        }
        expect(fought + looted).toBeGreaterThanOrEqual(6);
    }, 30_000);

    it("punched once by an unarmed player, a hurt bot with bandages punches back instead of running", () => {
        for (const seed of [1, 2, 3, 4]) {
            const spot = { x: 200, y: 420 };
            const game = flatGame({ minPlayers: 99 });
            const p = placePlayer(game, "bot", spot);
            p.health = 40;
            p.inv.set("bandage", 5);
            const h = placePlayer(game, "human", v2.add(spot, { x: 2.5, y: 0 }));
            for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, { x: 600 + k * 20, y: 120 });
            const bot = new BotController(game, p.id, { seed, skill: "intermediate" });
            const st = { since: -1, swing: -1000 };
            let flee = 0;
            const hp0 = h.health;
            for (let i = 0; i < 600 && !p.dead && !h.dead; i++) {
                bot.update();
                // one punch that lands (from 0.3 s on), then it stands there
                human(game, h, p, p.health >= 40 ? p.pos : h.pos, i, st, p.health >= 40);
                game.step();
                if (bot.bot.intent.behaviour === "flee") flee++;
            }
            expect(flee, `seed ${seed}`).toBe(0);
            expect(h.health, `seed ${seed}: never punched back`).toBeLessThan(hp0);
        }
    }, 20_000);
});
