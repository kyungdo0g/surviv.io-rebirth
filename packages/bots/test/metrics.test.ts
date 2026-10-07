// Match metrics (bot overhaul HARNESS): the pure state machines on scripted streams, then each collector on a scripted
// scenario (players placed on flat ground, the bot's intent, throws and actions set by hand, the game stepped without
// bot updates), and a whole match that replays identically with the metrics on.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, WeaponSlot } from "@rebirth/defs";
import { type Game, type Player, VIEW_ASPECT } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { emptyIntent, type Intent } from "../src/brain/context.ts";
import { BotController } from "../src/controller.ts";
import { loadoutOf } from "../src/metrics/arsenal.ts";
import { MetricsCollector } from "../src/metrics/collector.ts";
import { EpisodeClock, FleeSpots, PairClock, quantile } from "../src/metrics/episodes.ts";
import type { BotMetrics } from "../src/metrics/types.ts";
import { runMatch, scaledGas } from "../src/runner.ts";
import { flatGame, giveGun, openSpot, placePlayer } from "./helpers.ts";

describe("metric state machines", () => {
    it("episodes bridge gaps up to 3 s and report their duration when they close", () => {
        const c = new EpisodeClock(3);
        expect(c.on(0)).toBe(-1);
        expect(c.on(2)).toBe(-1);
        expect(c.off(4)).toBe(-1); // within the gap: still open
        expect(c.on(5)).toBe(-1);
        expect(c.off(8.5)).toBe(5); // 0..5
        expect(c.open).toBe(false);
        c.on(10);
        expect(c.on(20)).toBe(0); // a 10 s gap: the lone sample at 10 was a 0 s episode
        expect(c.close()).toBe(0);
    });

    it("a flight from a spot the bot came back to on its own is a cycle; a fight dragging it back is not", () => {
        const s = new FleeSpots();
        expect(s.flee(0, 0, 0)).toBe(false);
        s.move(15, 0, false); // fled 15 u away
        s.move(5, 0, true); // walked back, exploring
        expect(s.flee(10, 2, 1)).toBe(true);
        s.move(12, 0, false);
        s.move(1, 0, true);
        expect(s.flee(20, 0, 0)).toBe(true);
        // another spot: fled, then a fight brought it back
        expect(s.flee(30, 200, 200)).toBe(false);
        s.move(215, 200, false);
        s.move(201, 200, false);
        expect(s.flee(40, 200, 200)).toBe(false);
        expect(s.summary()).toEqual({ spots: 1, cycles: 2, max: 2 });
        // fleeing again without having got away first: no cycle
        const t = new FleeSpots();
        t.flee(0, 0, 0);
        t.move(3, 0, true);
        expect(t.flee(5, 0, 0)).toBe(false);
        // fleeing in steps along one line, exploring in between: it never came back
        const u = new FleeSpots();
        u.flee(0, 0, 0);
        u.move(10, 0, false);
        u.move(12, 0, true);
        expect(u.flee(5, 12, 0)).toBe(false);
    });

    it("the exposure clock times one shot per exposure from the line of fire opening", () => {
        const c = new PairClock();
        // visible from 1.0, the bot's target from 1.0 but behind cover until 2.0
        for (let t = 1; t < 2; t += 0.03) {
            c.see(t, true);
            c.track(true);
            c.expose(t, false);
        }
        expect(c.shot(1.9)).toBeNull(); // shooting at cover: no exposure
        c.see(2.01, true);
        c.expose(2.01, true);
        c.see(2.04, true);
        c.expose(2.04, true);
        expect(c.shot(2.06)).toBeCloseTo(0.05, 5);
        expect(c.shot(2.1)).toBeNull(); // the same exposure
        // hidden for more than the gap, then out again
        c.see(3, true);
        c.expose(3, true);
        expect(c.shot(3.4)).toBeCloseTo(0.4, 5);
        // an enemy that was never the target: from the start of the sighting
        const u = new PairClock();
        u.see(5, true);
        u.see(5.03, true);
        expect(u.shot(5.05)).toBeCloseTo(0.05, 5);
        // not on screen: no latency
        expect(new PairClock().shot(1)).toBeNull();
        // tracking that starts on a target already in sight with a clear line: from the sighting
        const w = new PairClock();
        w.see(7, true);
        w.see(7.5, true);
        w.track(true);
        w.expose(7.5, true);
        expect(w.shot(7.6)).toBeCloseTo(0.6, 5);
    });

    it("quantiles use the nearest rank", () => {
        expect(quantile([5, 1, 3, 2, 4], 0.1)).toBe(1);
        expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
        expect(quantile([5, 1, 3, 2, 4], 0.95)).toBe(5);
        expect(quantile([], 0.5)).toBeNaN();
    });
});

/** A sandbox with the bot at `at` and the collector started; the bot is never updated (its intent is set by hand). */
function scene(teamMode: 1 | 2 | 4 = 1, obstacles: Array<{ type: string; pos: Vec2 }> = []) {
    const probe = flatGame({ sandbox: true });
    const at = openSpot(probe);
    const game = flatGame(
        { sandbox: true },
        teamMode,
        obstacles.map((o) => ({ ...o, pos: v2.add(at, o.pos) })),
    );
    const p = placePlayer(game, "bot", at);
    const bot = new BotController(game, p.id, { seed: 1, difficulty: "normal" });
    const bots = [bot];
    const col = new MetricsCollector();
    const add = (name: string, offset: Vec2) => placePlayer(game, name, v2.add(at, offset));
    const begin = () => col.start(game, bots);
    const m = () => (col as unknown as { ctx: { metrics: Map<number, BotMetrics> } }).ctx.metrics.get(p.id)!;
    const intent = (over: Partial<Intent>) => {
        bot.bot.intent = { ...emptyIntent(over.behaviour ?? "idle"), ...over };
    };
    const look = () => bot.bot.observe(game.getSnapshot(p.id));
    return { game, at, p, bot, bots, col, add, begin, m, intent, look };
}

/** Steps the game (no bot updates) until its tick is a multiple of `k`. */
function stepTo(game: Game, k: number): void {
    do game.step();
    while (game.tick % k !== 0);
}

/** Steps `seconds` of game time, ticking the collector after each step like runMatch. */
function run(s: ReturnType<typeof scene>, seconds: number, each?: (i: number) => void): void {
    const n = Math.round(seconds * 100);
    for (let i = 0; i < n; i++) {
        each?.(i);
        s.game.step();
        s.col.tick(s.game);
    }
}

describe("fairness collector", () => {
    it("classifies shots at a target off the 16:9 screen and at one on it", () => {
        const s = scene();
        giveGun(s.p, "mp5");
        const halfH = s.p.zoom / VIEW_ASPECT;
        const enemy = s.add("enemy", { x: 0, y: halfH + 2.5 });
        s.begin();
        s.intent({ behaviour: "fight", targetId: enemy.id, aim: v2.copy(enemy.pos), fire: true });
        s.col.observer.onShotFired?.(s.p, "mp5", []);
        expect(s.m().targetedShots).toBe(1);
        expect(s.m().offScreenShots).toBe(1);
        expect(s.m().firstShots).toBe(1);
        // within the body slack of the edge: on the screen
        s.game.teleportPlayer(enemy.id, v2.add(s.at, { x: 0, y: halfH + 0.8 }));
        s.col.observer.onShotFired?.(s.p, "mp5", []);
        expect(s.m().targetedShots).toBe(2);
        expect(s.m().offScreenShots).toBe(1);
        expect(s.m().firstShots).toBe(1); // the same engagement
        // a shot with no player target counts as a shot only
        s.intent({ behaviour: "break", targetId: 0, aim: v2.copy(s.at), fire: true });
        s.col.observer.onShotFired?.(s.p, "mp5", []);
        expect(s.m().shots).toBe(3);
        expect(s.m().targetedShots).toBe(2);
    });

    it("times the first shot from the target showing on the screen", () => {
        const s = scene();
        giveGun(s.p, "mp5");
        const enemy = s.add("enemy", { x: 12, y: 0 });
        s.begin();
        s.look();
        s.intent({ behaviour: "fight", targetId: enemy.id, aim: v2.copy(enemy.pos), fire: true });
        run(s, 0.3);
        s.col.observer.onShotFired?.(s.p, "mp5", []);
        const lat = s.m().exposureLatency;
        expect(lat).toHaveLength(1);
        expect(lat[0]).toBeGreaterThan(0.2);
        expect(lat[0]).toBeLessThan(0.35);
    });

    it("counts aim acquisitions of a player off the screen", () => {
        const s = scene();
        const motor = s.bot.bot.motor;
        expect(motor).not.toBeNull();
        const enemy = s.add("enemy", { x: s.p.zoom + 3, y: 0 });
        s.begin();
        s.intent({ behaviour: "fight", targetId: enemy.id, aim: v2.copy(enemy.pos) });
        s.col.tick(s.game);
        if (motor) motor.acquisition++;
        s.col.tick(s.game);
        expect(s.m().aimStarts).toBe(1);
        expect(s.m().offScreenAimStarts).toBe(1);
    });
});

describe("looting collector", () => {
    it("counts containers hit while breaking, broken, abandoned and plated", () => {
        const s = scene(1, [
            { type: "crate_01", pos: { x: 3, y: 0 } },
            { type: "crate_02", pos: { x: 0, y: 3 } },
            { type: "crate_04", pos: { x: -3, y: 0 } },
        ]);
        s.begin();
        const obstacle = (type: string) => [...s.game.world.objects.values()].find((o) => o.type === type)!;
        const hit = (type: string, amount: number) =>
            s.game.damageObstacle(obstacle(type) as never, {
                amount,
                damageType: DamageType.Player,
                gameSourceType: "fists",
                sourceId: s.p.id,
            });
        s.intent({ behaviour: "break" });
        hit("crate_04", 20); // armour plating: no effect without a piercing melee
        hit("crate_01", 1000);
        hit("crate_02", 10);
        // a stray hit outside looting is not counted
        s.intent({ behaviour: "fight" });
        hit("crate_02", 10);
        run(s, 11);
        const out = s.col.finish(s.game);
        expect(out.containers).toEqual({ hit: 3, broken: 1, abandoned: 1, plated: 1 });
        expect(s.m().containersHit).toBe(3);
        expect(s.m().containersBroken).toBe(1);
        expect(s.m().containersAbandoned).toBe(1);
        expect(s.m().platedHits).toBe(1);
    });
});

describe("weapon collector", () => {
    it("reads pistol-only and weak loadouts by gun tier", () => {
        const s = scene();
        s.begin();
        expect(loadoutOf(s.bot, s.p, 60, true)).toMatchObject({ unarmed: true, best: "none" });
        giveGun(s.p, "m9", 60, WeaponSlot.Secondary);
        expect(loadoutOf(s.bot, s.p, 60, true)).toMatchObject({ weakOnly: true, pistolOnly: true, best: "D" });
        giveGun(s.p, "ak47", 90, WeaponSlot.Primary);
        expect(loadoutOf(s.bot, s.p, 60, true)).toMatchObject({ weakOnly: false, pistolOnly: false, bestId: "ak47" });
    });

    it("flags a pistol in hand while the rifle suits the range better, and holstering on the way", () => {
        const s = scene();
        giveGun(s.p, "ak47", 90, WeaponSlot.Primary);
        giveGun(s.p, "m9", 60, WeaponSlot.Secondary); // in hand
        const enemy = s.add("enemy", { x: 20, y: 0 });
        s.begin();
        s.intent({ behaviour: "fight", targetId: enemy.id, aim: v2.copy(enemy.pos), fire: true });
        stepTo(s.game, 50);
        s.col.tick(s.game);
        expect(s.m()).toMatchObject({ fightGunSamples: 1, fightPistol: 1, wrongSlotPistol: 1, twoGunSamples: 1 });
        expect(s.m().rightGun).toBe(0);
        // travelling with nothing in view: holstered or not
        s.game.teleportPlayer(enemy.id, v2.add(s.at, { x: 150, y: 0 }));
        s.look();
        s.intent({ behaviour: "explore" });
        stepTo(s.game, 50);
        s.col.tick(s.game);
        s.p.weaponManager.setCurWeapIndex(WeaponSlot.Melee);
        stepTo(s.game, 50);
        s.col.tick(s.game);
        expect(s.m().travelSamples).toBe(2);
        expect(s.m().travelHolstered).toBe(1);
    });
});

describe("movement collector", () => {
    it("records a chase of a target beyond the gun's ideal range", () => {
        const s = scene();
        giveGun(s.p, "mp5");
        const enemy = s.add("enemy", { x: 30, y: 0 });
        s.begin();
        s.intent({ behaviour: "fight", targetId: enemy.id, aim: v2.copy(enemy.pos), fire: true });
        run(s, 35);
        s.col.finish(s.game);
        const c = s.m().chases;
        expect(c).toHaveLength(1);
        expect(c[0].duration).toBeGreaterThanOrEqual(34);
        expect(c[0].patience).toBe(30); // neutral persona: infinite patience, capped
        expect(c[0].unarmedTarget).toBe(true);
    });

    it("counts flee-and-return cycles at a contested spot and long flights", () => {
        const s = scene();
        s.begin();
        const at = s.at;
        const phase = (behaviour: Intent["behaviour"], to: Vec2, seconds: number) => {
            s.intent({ behaviour });
            const from = v2.copy(s.p.pos);
            run(s, seconds, (i) => {
                const k = Math.min(1, (i + 1) / (seconds * 100));
                s.game.teleportPlayer(s.p.id, v2.lerp(k, from, v2.add(at, to)));
            });
        };
        for (let k = 0; k < 3; k++) {
            phase("flee", { x: 15, y: 0 }, 2);
            phase("explore", { x: 1, y: 0 }, 2);
        }
        phase("flee", { x: 40, y: 0 }, 6);
        s.col.finish(s.game);
        expect(s.m().oscMaxCycles).toBe(3);
        expect(s.m().oscSpots).toBe(1);
        // flee -> explore -> flee ... every 2 s: each switch back after the first two is a flip
        expect(s.m().flips).toBe(5);
        expect(s.m().flees.some((d) => d >= 5)).toBe(true);
    });

    it("counts frags started and released with an enemy close, and smoke at the bot's feet", () => {
        const s = scene();
        const enemy = s.add("enemy", { x: 4, y: 0 });
        s.begin();
        s.bot.bot.throws.start({ item: "frag", pos: v2.copy(enemy.pos), cook: 1 }, 0);
        s.col.tick(s.game);
        s.bot.bot.throws.throws++;
        s.bot.bot.throws.cancel();
        s.col.tick(s.game);
        s.bot.bot.throws.start({ item: "smoke", pos: v2.add(s.at, { x: 1, y: 0 }), cook: 0 }, 0);
        s.col.tick(s.game);
        expect(s.m()).toMatchObject({ fragStarts: 1, fragStartsNear: 1, fragReleases: 1, fragReleasesNear: 1 });
        expect(s.m().smokeAtFeet).toBe(1);
    });

    it("counts boosts taken when safe and the safe time with a boost in the bag", () => {
        const s = scene();
        s.p.inv.set("soda", 2);
        s.begin();
        s.look();
        s.intent({ behaviour: "explore" });
        stepTo(s.game, 50);
        s.col.tick(s.game);
        expect(s.m().safeBoostSeconds).toBeCloseTo(0.5, 5);
        stepTo(s.game, 5);
        s.p.action.type = "use";
        s.p.action.item = "soda";
        s.p.action.seq++;
        s.col.tick(s.game);
        expect(s.m()).toMatchObject({ boostUses: 1, safeBoostUses: 1, healUses: 0 });
    });

    it("counts a revive started in an armed enemy's sights as unsafe", () => {
        const s = scene(2);
        const mate = s.add("mate", { x: 2, y: 0 });
        const enemy = s.add("enemy", { x: 20, y: 0 });
        expect(mate.teamId).toBe(s.p.teamId);
        expect(enemy.teamId).not.toBe(s.p.teamId);
        giveGun(enemy, "ak47");
        s.begin();
        s.game.damagePlayer(mate, { amount: 150, damageType: DamageType.Player, sourceId: enemy.id });
        expect(mate.downed).toBe(true);
        const revive = (p: Player, seenFor = 0.5) => {
            stepTo(s.game, 5);
            s.look();
            // the bot had the enemy in view a moment before it began (one sighted as it began is counted apart)
            if (seenFor > 0) {
                for (let i = 0; i < seenFor * 100; i++) s.game.step();
                stepTo(s.game, 5);
                s.look();
            }
            p.action.type = "revive";
            p.action.targetId = mate.id;
            p.action.seq++;
            s.col.tick(s.game);
        };
        revive(s.p);
        expect(s.m()).toMatchObject({ revives: 1, unsafeRevives: 1, revivesSurprised: 0 });
        // the enemy gone (out of view for longer than the threat memory, and the 8 s a smart bot remembers an enemy
        // that covered the teammate: team.ts COVER_MEMORY): safe
        s.game.teleportPlayer(enemy.id, v2.add(s.at, { x: 200, y: 0 }));
        for (let i = 0; i < 900; i++) s.game.step();
        revive(s.p);
        expect(s.m()).toMatchObject({ revives: 2, unsafeRevives: 1 });
        // an enemy that comes into view in the very moment the revive begins: counted apart, not as unsafe
        s.game.teleportPlayer(enemy.id, v2.add(s.at, { x: 20, y: 0 }));
        revive(s.p, 0);
        expect(s.m()).toMatchObject({ revives: 3, unsafeRevives: 1, revivesSurprised: 1 });
    });
});

describe("metrics in a match", () => {
    it("replay identically with the metrics on, and the counters agree with the match statistics", () => {
        const cfg = { bots: 10, seed: 6, gasStages: scaledGas(4), maxTicks: 4000 };
        const a = runMatch(cfg);
        const b = runMatch({ ...cfg, metrics: true });
        expect(b.players).toEqual(a.players);
        expect(b.ticks).toBe(a.ticks);
        expect(b.idle).toEqual(a.idle);
        expect(a.metrics).toBeUndefined();
        const m = b.metrics;
        expect(m).toBeDefined();
        if (!m) return;
        expect(m.bots).toHaveLength(10);
        const shots = (id: number) => b.players.find((p) => p.id === id)?.shots;
        for (const x of m.bots) {
            expect(x.shots).toBe(shots(x.id));
            expect(x.offScreenShots).toBeLessThanOrEqual(x.targetedShots);
            expect(x.targetedShots).toBeLessThanOrEqual(x.shots);
            expect(x.containersBroken).toBeLessThanOrEqual(x.containersHit);
            expect(x.aimNoFire).toBeLessThanOrEqual(x.aimSamples);
            expect(x.deathAt >= 0).toBe(b.players.find((p) => p.id === x.id)?.dead);
        }
        expect(m.alive.map((s) => s.t)).toEqual([30]);
        // JSON-safe (worker threads ship it)
        expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    }, 120_000);
});
