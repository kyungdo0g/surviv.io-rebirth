// Downed players and revives compared with the survev oracle (revive.json: bleed-out timeline, revive duration and
// health, second knock, revive cancelled by distance, damage buffer; movement.json "downed": crawl, reviver and
// being-revived speeds). Our timers carry no float residue (survev's 8.01 s revive is our 8.00 s); speeds differ from
// survev by the KB's resolutions (conflicts.md downed-melee-equip-bonus, reviver-speed), which the survev knobs undo.
import { DamageType, Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Game, Player } from "../src/index.ts";
import { openSpot, send, steps } from "./combatHelpers.ts";
import { hasFixture, loadFixture, Mismatches, TICK } from "./oracleHelpers.ts";
import { addAt, flatTeamGame, stepUntil, watchDamage } from "./teamHelpers.ts";

const SECOND = 100;

/** The fixture's pair: a teammate and the victim 2 units to its right, in a duo. */
function pair(game: Game, n: number): { mate: Player; victim: Player } {
    const at = openSpot(game, 40);
    const y = at.y + n * 12;
    const opts = { group: `pair${n}`, partySize: 2, autoFill: false };
    const mate = addAt(game, `mate${n}`, { x: at.x, y }, opts);
    const victim = addAt(game, `victim${n}`, { x: at.x + 2, y }, opts);
    return { mate, victim };
}

/** survev knock: 150 Player damage without a source. */
function knock(game: Game, p: Player): number {
    game.damagePlayer(p, { amount: 150, damageType: DamageType.Player, dir: { x: 1, y: 0 } });
    return game.tick;
}

/** The knock-back slid the victim away: the teammate goes 2 units behind it again. */
function regroup(game: Game, mate: Player, victim: Player): void {
    game.teleportPlayer(mate.id, { x: victim.pos.x - 2, y: victim.pos.y });
}

const span = (a: number, b: number) => (b - a) * TICK;

describe.skipIf(!hasFixture("revive"))("oracle: revive.json", () => {
    const fx = loadFixture("revive");

    it("uses the fixture's config", () => {
        const game = flatTeamGame(2);
        expect(game.rules.downedDamageBuffer).toBe(fx.config.downedDamageBuffer);
    });

    it("bleeds out like survev: 2 HP every second after a buffered first tick, dead at 50.01 s", () => {
        const m = new Mismatches();
        const game = flatTeamGame(2);
        const { victim } = pair(game, 0);
        steps(game, SECOND);
        const ev = watchDamage(game, victim);
        const knockTick = knock(game, victim);
        m.equal("downed", victim.downed, fx.bleedOut.downed);
        m.equal("healthWhenDowned", victim.health, fx.bleedOut.healthWhenDowned);
        const dead = stepUntil(game, () => victim.dead, 200 * SECOND);
        const bleeds = ev.filter((e) => e.damageType === DamageType.Bleeding);
        m.near("secondsToDeath", dead === undefined ? null : span(knockTick, dead), fx.bleedOut.secondsToDeath, TICK);
        m.equal("bleedCalls", bleeds.length, fx.bleedOut.bleedCalls);
        fx.bleedOut.firstBleeds.forEach((want: { time: number; damage: number }, i: number) => {
            m.near(`firstBleeds[${i}].time`, bleeds[i] ? span(knockTick, bleeds[i].tick) : null, want.time, TICK);
            m.equal(`firstBleeds[${i}].damage`, bleeds[i]?.applied, want.damage);
        });
        const last = bleeds.at(-1);
        m.near("lastBleed.time", last ? span(knockTick, last.tick) : null, fx.bleedOut.lastBleed.time, TICK);
        m.equal("lastBleed.damage", last?.applied, fx.bleedOut.lastBleed.damage);
        expect(m.list).toEqual([]);
    });

    it("revives in 8 s to 24 HP with no bleeding meanwhile; a second knock bleeds out the same way", () => {
        const m = new Mismatches();
        const want = fx.revived;
        const game = flatTeamGame(2);
        const { mate, victim } = pair(game, 0);
        steps(game, SECOND);
        const ev = watchDamage(game, victim);
        const knockTick = knock(game, victim);
        steps(game, 250);
        regroup(game, mate, victim);
        m.near("healthWhenReviveStarted", victim.health, want.healthWhenReviveStarted, 1e-9);
        const start = game.tick;
        send(game, mate, { actions: [Input.Interact] });
        game.step();
        send(game, mate, {});
        m.equal("reviverAction", mate.action.type, "revive");
        m.equal("downedAction", victim.action.type, "revive");
        expect(mate.toView().anim?.type).toBe("revive");
        expect(mate.localState().action?.targetId).toBe(victim.id);
        expect(victim.localState().action?.targetId).toBe(0);
        const revived = stepUntil(game, () => !victim.downed, 20 * SECOND);
        m.near("reviveSeconds", revived === undefined ? null : span(start, revived), want.reviveSeconds, TICK);
        m.equal("healthAfterRevive", victim.health, want.healthAfterRevive);
        const bleeds = ev.filter((e) => e.damageType === DamageType.Bleeding);
        m.equal("bleedHitsDuringRevive", bleeds.filter((e) => e.tick > start).length, want.bleedHitsDuringRevive);
        m.equal("bleedHitsBeforeRevive", bleeds.filter((e) => e.tick <= start).length, want.bleedHitsBeforeRevive);
        m.near("secondsDownedBeforeRevive", span(knockTick, start), want.secondsDownedBeforeRevive, 1e-9);
        // both actions ended, the revive animation too
        expect(mate.action.type).toBe("none");
        expect(victim.action.type).toBe("none");
        expect(mate.animType).toBe("none");

        steps(game, SECOND);
        const ev2 = watchDamage(game, victim);
        const knock2 = knock(game, victim);
        const dead = stepUntil(game, () => victim.dead, 200 * SECOND);
        m.equal("secondKnock.downedCount", victim.downedCount, fx.secondKnock.downedCount);
        m.near("secondKnock.secondsToDeath", dead === undefined ? null : span(knock2, dead), fx.secondKnock.secondsToDeath, TICK);
        const dmg = [...new Set(ev2.filter((e) => e.damageType === DamageType.Bleeding).map((e) => e.applied))];
        m.equal("secondKnock.bleedDamage", dmg, fx.secondKnock.bleedDamage);
        expect(m.list).toEqual([]);
    });

    /** Walks the reviver away from the downed teammate; the tick the revive ends and the distance then. */
    function cancelRun(reviverSpeed: "half" | "survev") {
        const game = flatTeamGame(2);
        game.rules.reviverSpeed = reviverSpeed;
        const { mate, victim } = pair(game, 0);
        steps(game, SECOND);
        const ev = watchDamage(game, victim);
        knock(game, victim);
        steps(game, 250);
        regroup(game, mate, victim);
        const start = game.tick;
        send(game, mate, { actions: [Input.Interact] });
        game.step();
        send(game, mate, { moveLeft: true });
        const cancel = stepUntil(game, () => mate.action.type === "none", 10 * SECOND);
        send(game, mate, {});
        const distance = Math.hypot(mate.pos.x - victim.pos.x, mate.pos.y - victim.pos.y);
        steps(game, 3 * SECOND);
        const after = ev.filter((e) => e.damageType === DamageType.Bleeding && cancel !== undefined && e.tick > cancel);
        return { game, mate, victim, start, cancel, distance, bleedsAfter: after.length };
    }

    it("cancels the revive once the reviver walks out of reviveRange; bleeding resumes at once", () => {
        const m = new Mismatches();
        const want = fx.cancelled;
        // survev's reviver speed (downedMoveSpeed + 2 + fists equip = 7 u/s) reproduces the fixture exactly
        const sv = cancelRun("survev");
        m.near("cancelledAfterSeconds", sv.cancel === undefined ? null : span(sv.start, sv.cancel), want.cancelledAfterSeconds, TICK);
        m.near("distanceAtCancel", sv.distance, want.distanceAtCancel, 0.01);
        m.equal("stillDowned", sv.victim.downed, want.stillDowned);
        m.equal("bleedHitsAfterCancel", sv.bleedsAfter, want.bleedHitsAfterCancel);
        expect(m.list).toEqual([]);
        // our default (normal speed x 0.5 = 6.5 u/s with fists) cancels on the first tick past the range too; the
        // check runs before that tick's movement, which is already at the full 13 u/s (as in survev: 5.14 = 2 + 7 x
        // 0.43 + 13 x 0.01)
        const ours = cancelRun("half");
        const atCheck = ours.distance - 13 * TICK;
        expect(atCheck).toBeGreaterThan(want.reviveRange);
        expect(atCheck - 6.5 * TICK).toBeLessThanOrEqual(want.reviveRange);
        expect(ours.victim.downed).toBe(true);
        expect(ours.bleedsAfter).toBe(want.bleedHitsAfterCancel);
    });

    it("ignores damage during the 0.1 s buffer after a knock", () => {
        const game = flatTeamGame(2);
        const { victim } = pair(game, 0);
        steps(game, SECOND);
        const ev = watchDamage(game, victim);
        knock(game, victim);
        game.damagePlayer(victim, { amount: 10, damageType: DamageType.Player, dir: { x: 1, y: 0 } });
        steps(game, Math.round(game.rules.downedDamageBuffer / TICK) + 1);
        game.damagePlayer(victim, { amount: 10, damageType: DamageType.Player, dir: { x: 1, y: 0 } });
        const hits = ev.filter((e) => e.damageType === DamageType.Player).map((e) => e.applied);
        expect(hits.slice(1, 2)).toEqual(fx.downedDamage.knockHitThenImmediateHit);
        expect(hits.slice(2, 3)).toEqual(fx.downedDamage.hitAfterBuffer);
    });
});

describe.skipIf(!hasFixture("movement"))("oracle: movement.json downed speeds", () => {
    const fx = loadFixture("movement").downed;

    /** Speed of `p` moving right for `ticks` ticks. */
    function speedOf(game: Game, p: Player, ticks: number): number {
        const start = { ...p.pos };
        send(game, p, { moveRight: true });
        steps(game, ticks);
        send(game, p, {});
        return Math.hypot(p.pos.x - start.x, p.pos.y - start.y) / (ticks * TICK);
    }

    function speeds(survevKnobs: boolean) {
        const game = flatTeamGame(2);
        if (survevKnobs) {
            game.rules.downedEquipBonus = true;
            game.rules.reviverSpeed = "survev";
        }
        const pairs = [0, 1, 2].map((n) => pair(game, n));
        for (const { victim } of pairs) {
            game.damagePlayer(victim, { amount: 200, damageType: DamageType.Player, dir: { x: 1, y: 0 } });
        }
        // the knock-back slide stops well within 3 s
        steps(game, 3 * SECOND);
        const crawl = speedOf(game, pairs[0].victim, 50);
        const b = pairs[1];
        game.teleportPlayer(b.mate.id, b.victim.pos);
        send(game, b.mate, { actions: [Input.Interact] });
        game.step();
        const reviving = b.mate.action.type === "revive";
        const reviver = speedOf(game, b.mate, 30);
        const c = pairs[2];
        game.teleportPlayer(c.mate.id, c.victim.pos);
        send(game, c.mate, { actions: [Input.Interact] });
        game.step();
        const beingRevived = speedOf(game, c.victim, 30);
        return { crawl, reviving, reviver, beingRevived };
    }

    it("matches survev with the survev knobs (equip bonus while downed, reviver at downedMoveSpeed + 2)", () => {
        const s = speeds(true);
        expect(s.crawl).toBeCloseTo(fx.downedCrawl, 6);
        expect(s.reviving).toBe(fx.reviving.active);
        expect(s.reviver).toBeCloseTo(fx.reviving.speed, 6);
        expect(s.beingRevived).toBeCloseTo(fx.beingRevived.speed, 6);
    });

    it("defaults to the KB resolutions: 4 u/s crawl, 2 u/s being revived, reviver at half speed (6.5 with fists)", () => {
        const s = speeds(false);
        expect(s.crawl).toBeCloseTo(4, 6);
        expect(s.reviver).toBeCloseTo(6.5, 6);
        expect(s.beingRevived).toBeCloseTo(2, 6);
    });
});
