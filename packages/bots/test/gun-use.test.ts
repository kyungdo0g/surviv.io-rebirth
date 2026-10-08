// The owner's gun-use items (bot round 6, user reports 42-44), each behind its own flag: the potato guns as real guns
// (scored by their explosions), DMRs for average aim (a milder skill penalty than bolt snipers, a long gun of choice
// next to a close gun), and experts quick-switching after a slow gun's shot within the sim's switch rules.
import { v2 } from "@rebirth/core";
import { getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import type { Player } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { QUICK_CLICK, QUICK_HOLD, QuickSwitch, slowCycling } from "../src/brain/quickSwitch.ts";
import { BotController } from "../src/controller.ts";
import {
    DMR_AVERAGE_BONUS,
    gunDesire,
    gunPickupValue,
    slotToReplaceByDesire,
    type Taste,
} from "../src/knowledge/desire.ts";
import { gunClassOf, gunTier, skillFit } from "../src/knowledge/gunTiers.ts";
import { launcherSpec } from "../src/knowledge/launchers.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import type { SelfState } from "../src/perception/world.ts";
import { NEUTRAL } from "../src/persona.ts";
import { brainOf, giveGun as giveModelGun, NOW, testWorld } from "./brain-world.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";

const taste = (s: number, extra: Partial<Taste> = {}): Taste => ({ persona: NEUTRAL, s, ...extra });

describe("42: potato guns", () => {
    it("the Spud Gun is an SMG and the Potato Cannon a launcher, by their explosions; flare guns and the bugle stay useless", () => {
        const smg = gunInfo("potato_smg");
        expect(smg?.cls).toBe("smg");
        expect(smg?.damage).toBe(13);
        expect(smg?.range).toBe(60);
        expect(smg?.score ?? 0).toBeGreaterThan(0);
        // at its 13-damage blasts it kills at MP5 level (docs/design/gun-tiers.md: TTK 1.42 s at 5-20 u): B
        expect(gunTier("potato_smg")?.tier).toBe("B");
        const cannon = gunInfo("potato_cannon");
        expect(cannon?.cls).toBe("launcher");
        expect(gunClassOf("potato_cannon")).toBe("launcher");
        const spec = launcherSpec("potato_cannon");
        expect(spec?.blastDamage).toBe(95);
        expect(spec?.minDist).toBeCloseTo(6.5 + 1 + 2);
        expect(spec?.range ?? 0).toBeGreaterThan(40);
        // a 95-damage blast every 1.2 s from a 65 u/s lob: 2 hits even on bare players (docs/design/gun-tiers.md): C
        expect(gunTier("potato_cannon")?.tier).toBe("C");
        for (const id of ["flare_gun", "flare_gun_dual", "bugle"]) {
            expect(gunInfo(id)?.cls, id).toBe("useless");
            expect(gunTier(id), id).toBeUndefined();
        }
        // only spawned on potato maps
        expect(gunTier("potato_smg")?.mainMap).toBe(false);
    });

    it("only a brain with the flag wants or fights with them", () => {
        expect(gunDesire("potato_smg", taste(0.5))).toBe(0);
        expect(gunDesire("potato_smg", taste(0.5, { potatoGuns: true }))).toBeGreaterThan(40);
        expect(gunDesire("potato_cannon", taste(0.5, { potatoGuns: true }))).toBeGreaterThan(20);
        const w = testWorld();
        giveModelGun(w, 0, "potato_smg", 30, 0);
        expect(
            brainOf(w, ["pursuit"])
                .context(NOW)
                .guns.map((g) => g.info.id),
        ).toEqual([]);
        expect(
            brainOf(w, ["potatoGuns"])
                .context(NOW)
                .guns.map((g) => g.info.id),
        ).toEqual(["potato_smg"]);
    });
});

describe("42: potato guns in the simulation", () => {
    it("a bot holding only a Spud Gun or a Potato Cannon fires it at a dummy with the flag, not without", () => {
        const fired = (gun: string, off: number, potatoGuns: boolean): number => {
            const game = flatGame({ sandbox: true });
            const spot = openSpot(game);
            const p = placePlayer(game, "bot", spot);
            // (never-empty magazines of potato ammo, which is no bag item: straight into the slot)
            p.weaponManager.setWeapon(WeaponSlot.Primary, gun, getDefOfType("gun", gun).maxClip);
            p.weaponManager.setCurWeapIndex(WeaponSlot.Primary);
            p.weaponManager.weapons[WeaponSlot.Primary].cooldown = 0;
            const dummy = placePlayer(game, "dummy", v2.add(spot, { x: off, y: 0 }));
            let shots = 0;
            game.observer = {
                onShotFired: (shooter, weapon) => {
                    if (shooter.id === p.id && weapon === gun) shots++;
                },
            };
            const bot = new BotController(game, p.id, {
                seed: 4,
                skill: "intermediate",
                brain: { ...BRAIN_PRESETS.smart, potatoGuns },
            });
            for (let i = 0; i < 500 && shots < 3; i++) {
                bot.update();
                dummy.health = 100;
                game.step();
            }
            return shots;
        };
        expect(fired("potato_smg", 10, true)).toBeGreaterThan(0);
        expect(fired("potato_smg", 10, false)).toBe(0);
        // the cannon beyond its blast (minimum distance 9.5 u)
        expect(fired("potato_cannon", 18, true)).toBeGreaterThan(0);
        expect(fired("potato_cannon", 18, false)).toBe(0);
    });
});

describe("43: DMRs for average aim", () => {
    it("DMRs get a milder skill penalty than bolt snipers, which keep theirs", () => {
        for (const id of ["mk12", "m39", "garand", "vss", "svd", "scarssr", "mk14", "fal"]) {
            expect(gunClassOf(id), id).toBe("dmr");
            expect(skillFit(id, 0.5, true), id).toBeGreaterThan(skillFit(id, 0.5));
        }
        for (const id of ["awc", "barrett", "m200", "hecate", "lynx", "sv98", "mosin"]) {
            expect(gunClassOf(id), id).toBe("sniper");
            expect(skillFit(id, 0.5, true), id).toBe(skillFit(id, 0.5));
        }
    });

    it("pins the new desire: average aim wants a DMR above an assault rifle of its tier; experts and beginners less", () => {
        // NEUTRAL persona; mk12 B+ (62) with F 0.36 (docs/design/gun-tiers.md): skill demand 0.78
        expect(gunDesire("mk12", taste(0.5))).toBeCloseTo(62 * (1 - 0.6 * 0.28), 1);
        expect(gunDesire("mk12", taste(0.5, { dmrFit: true }))).toBeCloseTo(
            62 * (1 - 0.3 * 0.28) + DMR_AVERAGE_BONUS,
            1,
        );
        expect(gunDesire("mk12", taste(0.5, { dmrFit: true }))).toBeGreaterThan(gunDesire("ak47", taste(0.5)) + 10);
        // the bonus fades out by 0.3 of skill either way: an expert (0.85) and a beginner (0.15) get none
        // (demand 0.78 is under an expert's 0.85: no penalty left)
        expect(gunDesire("mk12", taste(0.85, { dmrFit: true }))).toBeCloseTo(62, 1);
        expect(gunDesire("mk12", taste(0.15, { dmrFit: true }))).toBeCloseTo(62 * (1 - 0.3 * 0.63), 1);
        // bolt snipers are unchanged
        expect(gunDesire("mosin", taste(0.5, { dmrFit: true }))).toBe(gunDesire("mosin", taste(0.5)));
    });

    it("a close gun plus a DMR: an average bot with an SMG and an AK takes a DMR for the AK", () => {
        const w = testWorld();
        giveModelGun(w, 0, "mp5", 30, 90);
        giveModelGun(w, 1, "ak47", 30, 90);
        const self = w.model.self;
        // the AK's slot is the one it would give up; only with dmrFit is the swap worth it (gain over the upgrade
        // threshold of 10)
        expect(slotToReplaceByDesire(self, taste(0.5, { dmrFit: true }), "mk12")).toBe(WeaponSlot.Secondary);
        expect(gunPickupValue(self, "mk12", taste(0.5))).toBe(0);
        expect(gunPickupValue(self, "mk12", taste(0.5, { dmrFit: true }))).toBeGreaterThan(30);
        // an expert keeps its AK (no average-aim bonus)
        expect(gunPickupValue(self, "mk12", taste(0.85, { dmrFit: true }))).toBe(0);
    });
});

describe("44: quick-switching", () => {
    /** A trigger finger that records its rearm times. */
    const finger = () => {
        const t = {
            lastClickAt: Number.NEGATIVE_INFINITY,
            rearms: [] as number[],
            rearm: (at: number) => t.rearms.push(at),
        };
        return t;
    };
    /** Clicks at `t`, lets the round leave the magazine (`fired`) and polls a tick later: the equip action or null. */
    const clickThenPoll = (q: QuickSwitch, self: SelfState, t: number, fired = true, trig = finger()) => {
        expect(q.step(t, self, trig, true)).toBeNull();
        if (fired) self.weapons[self.curWeapIdx].ammo--;
        return q.step(t + 0.02, self, trig, false);
    };

    it("after a slow gun's shot, with the cheap switch ready and another loaded gun of another deploy group", () => {
        expect(slowCycling("mosin")).toBe(true);
        expect(slowCycling("m870")).toBe(true);
        expect(slowCycling("mp5")).toBe(false);
        expect(slowCycling("mk12")).toBe(false);
        const w = testWorld();
        const self = w.model.self;
        giveModelGun(w, 0, "mosin", 5, 20);
        giveModelGun(w, 1, "mp5", 30, 90);
        const q = new QuickSwitch();
        // no click, no switch; a click arms it, and the key goes out only once the round left the magazine (the sim
        // handles a tick's actions before its shot: a key sent with the click would cancel the shot)
        expect(q.step(NOW, self, finger(), false)).toBeNull();
        const trig = finger();
        expect(clickThenPoll(q, self, NOW, true, trig)).toBe(Input.EquipSecondary);
        expect(q.count).toBe(1);
        // the trigger is rearmed for the other gun when the cheap switch is over
        expect(trig.rearms).toEqual([NOW + 0.02 + QUICK_CLICK]);
        expect(q.holdUntil).toBeCloseTo(NOW + 0.02 + QUICK_HOLD);
        // a click that fired nothing (lost) arms nothing for long
        const lost = new QuickSwitch();
        giveModelGun(w, 0, "mosin", 5, 20);
        expect(clickThenPoll(lost, self, NOW, false)).toBeNull();
        self.weapons[0].ammo--;
        expect(lost.step(NOW + 0.4, self, finger(), false)).toBeNull();
        // the cheap switch is spent for a second
        giveModelGun(w, 0, "mosin", 5, 20);
        expect(clickThenPoll(q, self, NOW + 0.5, true)).toBeNull();
        expect(clickThenPoll(q, self, NOW + 1.1, true)).not.toBeNull();
        // the snapshot's free-switch clock counts too
        const s = new QuickSwitch();
        s.observe(NOW, 0.6);
        expect(clickThenPoll(s, self, NOW + 0.3, true)).toBeNull();
        // an empty other gun, or two pumps of one deploy group: no
        giveModelGun(w, 0, "mosin", 5, 20);
        self.weapons[1] = { type: "mp5", ammo: 0 };
        expect(clickThenPoll(new QuickSwitch(), self, NOW, true)).toBeNull();
        giveModelGun(w, 0, "m870", 5, 20);
        giveModelGun(w, 1, "spas12", 9, 20);
        expect(clickThenPoll(new QuickSwitch(), self, NOW, true)).toBeNull();
    });

    it("clicks the other gun again when its first click came while it was still switching", () => {
        const w = testWorld();
        const self = w.model.self;
        giveModelGun(w, 0, "mosin", 5, 20);
        giveModelGun(w, 1, "sv98", 10, 20);
        const q = new QuickSwitch();
        const trig = finger();
        expect(clickThenPoll(q, self, NOW, true, trig)).toBe(Input.EquipSecondary);
        self.curWeapIdx = WeaponSlot.Secondary;
        // the trigger clicked at the rearm time, but no round left the SV-98: a click again after RECLICK
        trig.lastClickAt = NOW + 0.3;
        q.step(NOW + 0.35, self, trig, false);
        expect(trig.rearms.length).toBe(1);
        q.step(NOW + 0.45, self, trig, false);
        expect(trig.rearms).toEqual([NOW + 0.02 + QUICK_CLICK, NOW + 0.45]);
        // once it fired, nothing more
        self.weapons[1].ammo--;
        trig.lastClickAt = NOW + 0.46;
        q.step(NOW + 0.7, self, trig, false);
        expect(trig.rearms.length).toBe(2);
    });

    it("only experts quick-switch: intermediates (the owner's level) and beginners never", () => {
        const map = testWorld().model.map;
        expect(new Bot(map, { seed: 1, skill: "expert" }).quick).not.toBeNull();
        expect(new Bot(map, { seed: 1, skill: "intermediate" }).quick).toBeNull();
        expect(new Bot(map, { seed: 1, skill: "beginner" }).quick).toBeNull();
        expect(
            new Bot(map, { seed: 1, skill: "expert", brain: { ...BRAIN_PRESETS.smart, quickSwitch: false } }).quick,
        ).toBeNull();
    });

    it("in the simulation an expert's follow-up shot with two bolt snipers comes faster than without the switch", () => {
        const followUp = (quickSwitch: boolean): number => {
            const game = flatGame({ minPlayers: 99 });
            const spot = openSpot(game);
            const p = placePlayer(game, "bot", spot);
            giveGun(p, "sv98", 20, WeaponSlot.Secondary);
            giveGun(p, "mosin", 20, WeaponSlot.Primary);
            const dummy: Player = placePlayer(game, "dummy", v2.add(spot, { x: 22, y: 0 }));
            giveGun(dummy, "ak47", 90);
            dummy.health = 100;
            const shots: number[] = [];
            game.observer = {
                onShotFired: (shooter) => {
                    if (shooter.id === p.id) shots.push(game.time);
                },
            };
            const bot = new BotController(game, p.id, {
                seed: 3,
                skill: "expert",
                brain: { ...BRAIN_PRESETS.smart, quickSwitch },
            });
            for (let i = 0; i < 1200 && shots.length < 2; i++) {
                bot.update();
                dummy.health = 100;
                game.step();
            }
            expect(shots.length).toBe(2);
            return shots[1] - shots[0];
        };
        const slow = followUp(false);
        const fast = followUp(true);
        // without: the bolt cycle (1.5 s or more); with: a cheap switch (0.25 s) and the aim
        expect(slow).toBeGreaterThan(1.4);
        expect(fast).toBeLessThan(slow - 0.4);
    });
});
