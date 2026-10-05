// revive.json (duo): knock-down, bleeding while downed, revive duration and result, revive cancellation.
import type { Ctx, FixtureResult } from "../lib/context.ts";
import { type DamageEvent, Harness } from "../lib/harness.ts";
import { actionName } from "../lib/measure.ts";
import { CENTERED } from "../lib/rng.ts";

export function revive(ctx: Ctx): FixtureResult {
    const { sv } = ctx;
    const { GameConfig, v2 } = sv;
    const h = new Harness(sv, { seed: 101, teamMode: "duo" });
    h.setMode(CENTERED, "never");
    let row = 0;

    const pair = () => {
        const { x, y } = h.rowPos(row++, 20);
        const group = h.game.playerBarn.addGroup(false);
        const mate = h.addPlayer({ x, y }, { group });
        const victim = h.addPlayer({ x: x + 2, y }, { group });
        mate.debug.godMode = true;
        return { mate, victim };
    };
    const knock = (p: any) => {
        p.damage({ amount: 150, damageType: GameConfig.DamageType.Player, dir: v2.create(1, 0) });
        return h.tick;
    };
    /** the knock pushes the victim ~2.5 m (vel = dir * 10, damped): put the teammate 2 m behind it again */
    const regroup = (mate: any, victim: any) => h.teleport(mate, { x: victim.pos.x - 2, y: victim.pos.y });
    const bleedEvents = (events: DamageEvent[]) =>
        events.filter((e) => e.damageType === GameConfig.DamageType.Bleeding);

    // 1. bleeding out with nobody reviving
    const a = pair();
    h.stepSeconds(1);
    const ev = h.watchDamage(a.victim);
    const knockTick = knock(a.victim);
    const healthAtKnock = a.victim.health;
    const deadTick = h.stepUntil(() => a.victim.dead, Math.round(200 / h.dt));
    const bleeds = bleedEvents(ev);
    const bleedOut = {
        downed: bleeds.length > 0,
        healthWhenDowned: healthAtKnock,
        secondsToDeath: deadTick === undefined ? null : h.span(knockTick, deadTick),
        bleedCalls: bleeds.length,
        firstBleeds: bleeds.slice(0, 5).map((e) => ({ time: h.span(knockTick, e.tick), damage: e.applied })),
        lastBleed: bleeds.length
            ? { time: h.span(knockTick, bleeds.at(-1)!.tick), damage: bleeds.at(-1)!.applied }
            : null,
    };

    // 2. revive by the teammate (Interact input), then a second knock (downedCount 2)
    const b = pair();
    h.stepSeconds(1);
    const evB = h.watchDamage(b.victim);
    const knockB = knock(b.victim);
    h.stepSeconds(2.5);
    regroup(b.mate, b.victim);
    const healthBeforeRevive = b.victim.health;
    const reviveStart = h.tick;
    h.press(b.mate, ["Interact"]);
    h.step();
    const mateAction = actionName(sv, b.mate.actionType);
    const victimAction = actionName(sv, b.victim.actionType);
    const revivedTick = h.stepUntil(() => !b.victim.downed, Math.round(20 / h.dt));
    const bleedDuringRevive = bleedEvents(evB).filter((e) => e.tick > reviveStart).length;
    const revived = {
        healthWhenReviveStarted: healthBeforeRevive,
        reviverAction: mateAction,
        downedAction: victimAction,
        reviveSeconds: revivedTick === undefined ? null : h.span(reviveStart, revivedTick),
        healthAfterRevive: b.victim.health,
        bleedHitsDuringRevive: bleedDuringRevive,
        bleedHitsBeforeRevive: bleedEvents(evB).filter((e) => e.tick <= reviveStart).length,
        secondsDownedBeforeRevive: h.span(knockB, reviveStart),
    };
    h.stepSeconds(1);
    const evB2 = h.watchDamage(b.victim);
    const knockB2 = knock(b.victim);
    const dead2 = h.stepUntil(() => b.victim.dead, Math.round(200 / h.dt));
    const secondKnock = {
        downedCount: b.victim.downedCount,
        secondsToDeath: dead2 === undefined ? null : h.span(knockB2, dead2),
        bleedDamage: [...new Set(bleedEvents(evB2).map((e) => e.applied))],
    };

    // 3. reviver walks out of range: the revive is cancelled and bleeding resumes
    const c = pair();
    h.stepSeconds(1);
    const evC = h.watchDamage(c.victim);
    knock(c.victim);
    h.stepSeconds(2.5);
    regroup(c.mate, c.victim);
    const startC = h.tick;
    h.press(c.mate, ["Interact"]);
    h.step();
    h.hold(c.mate, { moveLeft: true });
    const cancelTick = h.stepUntil(() => c.mate.actionType === GameConfig.Action.None, Math.round(10 / h.dt));
    h.hold(c.mate, {});
    const distanceAtCancel = v2.distance(c.mate.pos, c.victim.pos);
    h.stepSeconds(3);
    const cancelled = {
        cancelledAfterSeconds: cancelTick === undefined ? null : h.span(startC, cancelTick),
        distanceAtCancel,
        reviveRange: GameConfig.player.reviveRange,
        stillDowned: c.victim.downed,
        bleedHitsAfterCancel: bleedEvents(evC).filter((e) => cancelTick !== undefined && e.tick > cancelTick).length,
    };

    // 4. damage taken while downed (armor still applies), and the post-knock damage buffer
    const d = pair();
    h.stepSeconds(1);
    const evD = h.watchDamage(d.victim);
    knock(d.victim);
    d.victim.damage({ amount: 10, damageType: GameConfig.DamageType.Player, dir: v2.create(1, 0) });
    h.step(Math.round(GameConfig.player.downedDamageBuffer / h.dt) + 1);
    d.victim.damage({ amount: 10, damageType: GameConfig.DamageType.Player, dir: v2.create(1, 0) });
    const hits = evD.filter((e) => e.damageType === GameConfig.DamageType.Player).map((e) => e.applied);
    const downedDamage = { knockHitThenImmediateHit: hits.slice(1, 2), hitAfterBuffer: hits.slice(2, 3) };

    const mapConfig = h.game.map.mapDef.gameConfig;
    return {
        params: {
            teamMode: "duo, empty oracle map (survev test_normal gameConfig = main)",
            knock: "150 Player damage with no source (teammate alive -> downed)",
            revive: "teammate placed 2 m behind the downed player (after its knock-back slide) sends Interact",
            cancel: "the reviver walks away (moveLeft) until the revive is cancelled",
        },
        data: {
            config: {
                reviveDuration: GameConfig.player.reviveDuration,
                reviveHealth: GameConfig.player.reviveHealth,
                reviveRange: GameConfig.player.reviveRange,
                bleedTickRate: GameConfig.player.bleedTickRate,
                bleedDamage: mapConfig.bleedDamage,
                bleedDamageMult: mapConfig.bleedDamageMult,
                downedDamageBuffer: GameConfig.player.downedDamageBuffer,
            },
            notes: [
                "a downed player bleeds bleedDamage every bleedTickRate seconds while no action (revive) runs; " +
                    "with bleedDamageMult != 1 the damage is downedCount * bleedDamageMult * bleedDamage",
                "the first bleed tick right after the knock falls inside downedDamageBuffer and is ignored",
                "bleeding ignores armor",
            ],
            bleedOut,
            revived,
            secondKnock,
            cancelled,
            downedDamage,
        },
    };
}
