// Point blank (owner report 2026-10-10; brain/pointBlank.ts): with the target's far side inside the muzzle, bullets
// spawn past the body (the sim, like survev); the bot does not fire then, and either backs off to where its gun hits
// or swaps to melee, a choice held per enemy by persona and skill.
import { type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { Game, Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { BrainProfile } from "../src/brain/brain.ts";
import { shotCheck, slotAgainst } from "../src/brain/combat.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import { keepGunRange, muzzlePast, pointBlankOdds } from "../src/brain/pointBlank.ts";
import { BotController } from "../src/controller.ts";
import { PERSONAS } from "../src/persona.ts";
import { addEnemy, brainOf, faceTo, giveGun, NOW, testWorld } from "./brain-world.ts";
import { flatGame, giveGun as giveSimGun, openSpot, placePlayer } from "./helpers.ts";

const SMART = BRAIN_PRESETS.smart;
const WITHOUT: Readonly<BrainFeatures> = { ...SMART, pointBlank: false };

/** The test bot with an AK-47 and an armed enemy `dist` units east, facing it. */
function close(dist: number) {
    const w = testWorld();
    giveGun(w, WeaponSlot.Primary, "ak47");
    w.model.self.curWeapIdx = WeaponSlot.Primary;
    const e = addEnemy(w, 2, { x: dist, y: 0 }, { activeWeapon: "ak47" });
    faceTo(e, w.spot);
    return w;
}

describe("point blank", () => {
    it("is where the bullets spawn past the body: the AK-47 hits at 2.5 u and not at 2, the MP5 at 2 and not at 1.6", () => {
        expect(muzzlePast("ak47", 2)).toBe(true);
        expect(muzzlePast("ak47", 2.6)).toBe(false);
        expect(muzzlePast("mp5", 1.6)).toBe(true);
        expect(muzzlePast("mp5", 2.1)).toBe(false);
        expect(muzzlePast("fists", 1)).toBe(false);
    });

    it("no shot at point blank; a step back and the gun's range allows it again", () => {
        for (const [features, d, held] of [
            [SMART, 2, true],
            [SMART, 3.5, false],
            [WITHOUT, 2, false],
        ] as const) {
            const w = close(d);
            const t = w.model.contacts.get(2);
            if (!t) throw new Error("no enemy");
            const check = shotCheck(brainOf(w, features).context(NOW), t, d);
            expect(check.ok === false && check.why === "range", `${d}`).toBe(held);
        }
    });

    it("bold, risk-taking personas swing more often; skilled bots back off to use the gun more often", () => {
        const odds = (name: keyof typeof PERSONAS, s: number) =>
            pointBlankOdds(
                brainOf(testWorld(), SMART, "normal", 1, {
                    persona: PERSONAS[name],
                    skill: { tier: "intermediate", s, g: s },
                } as BrainProfile).context(NOW),
            );
        expect(odds("rusher", 0.5)).toBeGreaterThan(odds("marksman", 0.5));
        expect(odds("rifleman", 0.2)).toBeGreaterThan(odds("rifleman", 0.9));
        // over many bots: some swing, some back off, and the choice holds per enemy
        let swings = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const w = close(2);
            const brain = brainOf(w, SMART, "normal", seed, { seed });
            const t = w.model.contacts.get(2);
            if (!t) throw new Error("no enemy");
            const s1 = slotAgainst(brain.context(NOW), t, 2);
            expect(slotAgainst(brain.context(NOW + 0.5), t, 2)).toBe(s1);
            if (s1 === WeaponSlot.Melee) swings++;
        }
        expect(swings).toBeGreaterThan(3);
        expect(swings).toBeLessThan(37);
        // without the feature: the gun, whatever the distance
        const w = close(2);
        const t = w.model.contacts.get(2);
        if (!t) throw new Error("no enemy");
        expect(slotAgainst(brainOf(w, WITHOUT).context(NOW), t, 2)).toBe(WeaponSlot.Primary);
    });

    it("a bot that backs off steps away from the enemy with its aim on it, and stops once its gun hits again", () => {
        const w = close(2);
        const brain = brainOf(w, SMART);
        brain.mem.fight.pointBlank.set(2, { yes: false, until: NOW + 10, since: NOW });
        const ctx = brain.context(NOW);
        const intent = emptyIntent("fight");
        intent.targetId = 2;
        intent.slot = WeaponSlot.Primary;
        intent.fire = true;
        keepGunRange(ctx, intent);
        expect(intent.fire).toBe(false);
        expect(intent.moveDir?.x ?? 0).toBeLessThan(-0.5);
        // far enough: left alone
        const far = close(5);
        const b2 = brainOf(far, SMART);
        b2.mem.fight.pointBlank.set(2, { yes: false, until: NOW + 10, since: NOW });
        const i2 = emptyIntent("fight");
        i2.targetId = 2;
        i2.slot = WeaponSlot.Primary;
        keepGunRange(b2.context(NOW), i2);
        expect(i2.moveDir).toBeNull();
    });
});

describe("point blank (simulation)", () => {
    /** An armed human that keeps pressing against the bot, body to body (2 u), never shooting. */
    function hug(game: Game, h: Player, target: Vec2): void {
        const gap = v2.distance(target, h.pos);
        const d = gap > 2 ? v2.normalizeSafe(v2.sub(target, h.pos)) : { x: 0, y: 0 };
        h.input = {
            ...h.input,
            moveRight: d.x > 0.3,
            moveLeft: d.x < -0.3,
            moveDown: d.y > 0.3,
            moveUp: d.y < -0.3,
            shootStart: false,
            shootHold: false,
        };
        void game;
    }

    it("an armed human pressing against a bot with an AK-47 gets hurt: the bot backs off and shoots, or swings", () => {
        let hurt = 0;
        const seeds = [1, 2, 3, 4, 5, 6];
        for (const seed of seeds) {
            const game = flatGame({ minPlayers: 99 });
            const spot = openSpot(game, 40);
            const p = placePlayer(game, "bot", spot);
            giveSimGun(p, "ak47", 30);
            const h = placePlayer(game, "human", v2.add(spot, { x: 2, y: 0 }));
            giveSimGun(h, "mp5", 30);
            for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, v2.add(spot, { x: 150 + k * 20, y: 150 }));
            const bot = new BotController(game, p.id, { seed });
            for (let i = 0; i < 400 && !h.dead; i++) {
                bot.update();
                hug(game, h, p.pos);
                game.step();
            }
            if (h.health < 100 || h.dead) hurt++;
        }
        expect(hurt).toBe(seeds.length);
    }, 30_000);
});
