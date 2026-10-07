// Rebirth hit feedback (user/2026-10-07-hit-feedback): the damage pipeline logs every damaging hit, and each snapshot
// lists the hits its active player dealt or took since the viewer's previous snapshot (Snapshot.hits): headshot and
// armour flags, the direction of hits taken, the other player masked to 0 out of view, nothing for dropped hits.
import { v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    armorCovers,
    type DamageParams,
    defaultRules,
    type Game,
    type HitEvent,
    type Player,
    TICK_HZ,
} from "../src/index.ts";
import { flatGame, openSpot, spawnAt } from "./combatHelpers.ts";
import { addAt, flatTeamGame, party } from "./teamHelpers.ts";

function bulletHit(source: Player | null, amount = 20, weapon = "ak47"): DamageParams {
    return {
        amount,
        damageType: DamageType.Player,
        gameSourceType: weapon,
        sourceId: source?.id ?? 0,
        dir: { x: 2, y: 0 },
    };
}

/** Two players 6 units apart on open ground, both in each other's view; both snapshots taken once. */
function duel(seed = 12345): { game: Game; a: Player; b: Player } {
    const game = flatGame([], seed);
    const at = openSpot(game);
    const a = spawnAt(game, at);
    const b = spawnAt(game, v2.add(at, { x: 6, y: 0 }), { x: -1, y: 0 });
    game.step();
    game.getSnapshot(a.id);
    game.getSnapshot(b.id);
    return { game, a, b };
}

function hitsOf(game: Game, id: number): HitEvent[] {
    return game.getSnapshot(id).hits ?? [];
}

describe("armorCovers", () => {
    const rules = defaultRules();
    const wearing = (helmet: string, chest: string) => ({ helmet, chest, hasPerk: () => false });
    it("counts the helmet on a headshot and the chest on a body hit only", () => {
        const p = bulletHit(null);
        expect(armorCovers(p, true, wearing("helmet01", ""), rules)).toBe(true);
        expect(armorCovers(p, false, wearing("", "chest02"), rules)).toBe(true);
        // the helmet's 30 % share on body hits does not make a body hit "armoured"
        expect(armorCovers(p, false, wearing("helmet03", ""), rules)).toBe(false);
        expect(armorCovers(p, true, wearing("", "chest03"), rules)).toBe(false);
    });

    it("never for gas, bleeding or (by default) air drop crushes", () => {
        const all = wearing("helmet03", "chest03");
        for (const damageType of [DamageType.Gas, DamageType.Bleeding, DamageType.Airdrop]) {
            expect(armorCovers({ amount: 10, damageType }, false, all, rules)).toBe(false);
        }
    });
});

describe("Snapshot.hits", () => {
    it("lists a hit to the dealer and to the target, with the direction only for the target", () => {
        const { game, a, b } = duel();
        game.damagePlayer(b, bulletHit(a, 20));
        game.step();
        const dealt = hitsOf(game, a.id);
        const taken = hitsOf(game, b.id);
        expect(dealt).toEqual([
            { targetId: b.id, sourceId: a.id, amount: 20, damageType: 0, headshot: false, armored: false },
        ]);
        expect(taken).toHaveLength(1);
        expect(taken[0]).toMatchObject({ targetId: b.id, sourceId: a.id, amount: 20 });
        expect(taken[0].dir).toEqual({ x: 1, y: 0 });
        // listed once: the next snapshots are empty
        game.step();
        expect(game.getSnapshot(a.id).hits).toBeUndefined();
        expect(game.getSnapshot(b.id).hits).toBeUndefined();
    });

    it("lists a hit dealt between steps once, in the snapshot of the step after it", () => {
        const { game, a, b } = duel();
        game.damagePlayer(b, bulletHit(a, 9));
        // a snapshot taken before the next step does not list it yet
        expect(game.getSnapshot(a.id).hits).toBeUndefined();
        game.step();
        expect(hitsOf(game, a.id)).toHaveLength(1);
        game.step();
        expect(game.getSnapshot(a.id).hits).toBeUndefined();
    });

    it("sends nothing to a third player and masks a source out of view", () => {
        const { game, a, b } = duel();
        const far = spawnAt(game, v2.add(a.pos, { x: 200, y: 0 }));
        game.getSnapshot(far.id);
        game.step();
        game.getSnapshot(b.id);
        game.damagePlayer(b, bulletHit(far, 15));
        game.step();
        expect(hitsOf(game, a.id)).toEqual([]);
        const taken = hitsOf(game, b.id);
        expect(taken).toHaveLength(1);
        // the shooter is not in the target's view: anonymous, only the direction tells where it came from
        expect(taken[0].sourceId).toBe(0);
        expect(taken[0].dir).toBeDefined();
        // the shooter still learns that its hit landed, on a target it cannot see
        expect(hitsOf(game, far.id)).toEqual([expect.objectContaining({ targetId: 0, sourceId: far.id })]);
    });

    it("flags headshots and the armour that reduced them, after the multiplier and the reductions", () => {
        const { game, a, b } = duel();
        game.rules.headshotChance = 1;
        b.helmet = "helmet01";
        game.damagePlayer(b, bulletHit(a, 20));
        game.step();
        const [hit] = hitsOf(game, a.id);
        expect(hit.headshot).toBe(true);
        expect(hit.armored).toBe(true);
        expect(hit.amount).toBeCloseTo(b.lastHit!.amount, 9);
        expect(hit.amount).not.toBeCloseTo(20, 3);
    });

    it("clamps to the remaining health and lists environment damage with source 0", () => {
        const { game, a, b } = duel();
        b.health = 10;
        game.damagePlayer(b, bulletHit(a, 50));
        game.damagePlayer(a, { amount: 3, damageType: DamageType.Gas, dir: { x: 0, y: 1 } });
        game.step();
        expect(hitsOf(game, a.id).map((h) => [h.targetId, h.sourceId, h.amount, h.damageType])).toEqual([
            [b.id, a.id, 10, 0],
            [a.id, 0, 3, DamageType.Gas],
        ]);
    });

    it("lists self damage once, as taken", () => {
        const { game, a } = duel();
        game.damagePlayer(a, { ...bulletHit(a, 12, "frag"), isExplosion: true });
        game.step();
        const hits = hitsOf(game, a.id);
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatchObject({ targetId: a.id, sourceId: a.id, amount: 12 });
        expect(hits[0].dir).toBeDefined();
    });

    it("never lists hits the pipeline drops: teammates, the class menu, the knock buffer, zero damage", () => {
        const game = flatTeamGame(2);
        const at = openSpot(game);
        const [m1, m2] = party(game, "t", 2, at);
        const enemy = addAt(game, "enemy", v2.add(at, { x: 0, y: 5 }));
        game.step();
        for (const p of [m1, m2, enemy]) game.getSnapshot(p.id);
        game.damagePlayer(m2, bulletHit(m1, 30));
        enemy.awaitingClass = true;
        game.damagePlayer(enemy, bulletHit(m1, 30));
        enemy.awaitingClass = false;
        game.damagePlayer(enemy, bulletHit(m1, 0));
        game.step();
        expect(hitsOf(game, m1.id)).toEqual([]);
        expect(hitsOf(game, m2.id)).toEqual([]);
        expect(hitsOf(game, enemy.id)).toEqual([]);
        // a knock, then the buffer right after it
        game.damagePlayer(m2, bulletHit(enemy, 200));
        expect(m2.downed).toBe(true);
        game.step();
        expect(hitsOf(game, enemy.id)).toHaveLength(1);
        game.damagePlayer(m2, bulletHit(enemy, 5));
        game.step();
        expect(hitsOf(game, enemy.id)).toEqual([]);
    });

    it("follows the spectated player", () => {
        const { game, a, b } = duel();
        const viewer = spawnAt(game, v2.add(a.pos, { x: -3, y: 0 }));
        game.getSnapshot(viewer.id);
        game.damagePlayer(viewer, bulletHit(null, 500));
        expect(viewer.dead).toBe(true);
        game.spectate(viewer.id, "begin");
        game.step();
        const target = game.spectatingId(viewer.id);
        expect([a.id, b.id]).toContain(target);
        game.getSnapshot(viewer.id);
        const other = target === a.id ? b : a;
        game.damagePlayer(game.getPlayer(target)!, bulletHit(other, 7));
        game.step();
        const snap = game.getSnapshot(viewer.id);
        expect(snap.localPlayerId).toBe(target);
        expect(snap.hits).toEqual([expect.objectContaining({ targetId: target, sourceId: other.id, amount: 7 })]);
    });

    it("forgets hits after a second and is deterministic", () => {
        const run = () => {
            const { game, a, b } = duel(777);
            game.rules.headshotChance = 0.5;
            const out: Array<HitEvent[] | undefined> = [];
            for (let i = 0; i < 20; i++) {
                game.damagePlayer(b, bulletHit(a, 1 + i));
                game.step();
                out.push(game.getSnapshot(a.id).hits);
            }
            // reports live one second (BULLET_REPORT_TICKS)
            for (let i = 0; i <= TICK_HZ; i++) game.step();
            return { out, size: game.hitLog.size };
        };
        const first = run();
        expect(first.size).toBe(0);
        expect(JSON.stringify(run().out)).toBe(JSON.stringify(first.out));
        expect(first.out.some((hits) => hits?.[0].headshot)).toBe(true);
    });
});
