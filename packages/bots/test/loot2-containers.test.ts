// LOOT2 (user report 21): a container a bot started breaking ends broken unless a real interruption comes. The finishing
// exemption (a damaged crate one or two hits from breaking outlasts a weak zone score, an item or an air drop run),
// the commit pick (no swapping a damaged crate for another), the attack held through a visible enemy that does not
// threaten the bot, the no-progress clock that runs at full rate only while the bot attacks, and the stand spot from
// which a punch lands on the target instead of the plated crate next to it. Owner: LOOT.
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { Game, type Obstacle } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { BrainCtx } from "../src/brain/context.ts";
import { bestBreakable, breakScore, planBreak } from "../src/brain/scavenge.ts";
import { zonePressure } from "../src/brain/survival.ts";
import { BotController } from "../src/controller.ts";
import type { SeenObstacle } from "../src/perception/world.ts";
import { addEnemy, addObstacle, ctxOf, giveGun, NOW, setGas, type TestWorld, testWorld } from "./brain-world.ts";
import { cachedMap, flatGame, giveGun as giveSimGun, openSpot, placePlayer, runUntil } from "./helpers.ts";

/** A crate_01 `off` from the bot, at `healthT`. */
function crate(w: TestWorld, off = { x: 2.6, y: 0 }, healthT = 1): SeenObstacle {
    addObstacle(w, off, "crate_01");
    const o = w.model.obstacles[w.model.obstacles.length - 1];
    o.view.healthT = healthT;
    return o;
}

/** The bot damaged `o` itself and is still on it (scavenge.ts committed). */
function commit(ctx: BrainCtx, o: SeenObstacle): void {
    ctx.mem.breakTarget = o.view.id;
    ctx.mem.loot2.breakId = o.view.id;
    ctx.mem.loot2.breakHit = true;
    ctx.mem.loot2.breakHealthT = o.view.healthT;
    ctx.mem.loot2.breakTracked = NOW;
    ctx.mem.loot2.stallPos = v2.copy(ctx.self.pos);
    ctx.mem.loot2.stallSince = NOW;
}

/** The next circle 190 units away (radius 100, the current one 200 around the same centre): early zone pressure. */
function earlyZone(w: TestWorld): void {
    setGas(w, { x: 190, y: 0 }, 100, "waiting");
}

const SMART = ["steady", "pursuit", "sweep", "airdrop"] as const;

describe("finishing a container (zone, items, air drops)", () => {
    it("a crate one or two punches from breaking outlasts the early zone; a fresh one does not", () => {
        const w = testWorld();
        earlyZone(w);
        const o = crate(w, { x: 2.6, y: 0 }, 0.1);
        const fresh = ctxOf(w, [...SMART]);
        const p = zonePressure(w.model);
        // the zone presses a little (steady.ts leaves goals outside the next circle above 0.15), the bot is not in gas
        expect(p).toBeGreaterThan(0.15);
        expect(p).toBeLessThan(0.6);
        expect(w.model.inGasNow()).toBe(false);
        expect(bestBreakable(fresh)).toBeNull();
        const ctx = ctxOf(w, [...SMART]);
        commit(ctx, o);
        const choice = bestBreakable(ctx);
        expect(choice?.obstacle).toBe(o);
        // above the zone (0.2 + 0.8 p) and the air drop's cap (0.66 with the hysteresis 0.08 on top)
        expect(breakScore(ctx, choice)).toBeGreaterThanOrEqual(0.62);
    });

    it("leaves it for the gas itself, or once the bot was pulled away from it", () => {
        // in the gas: the zone comes first
        const gas = testWorld();
        setGas(gas, { x: 190, y: 0 }, 60, "waiting");
        expect(gas.model.inGasNow()).toBe(true);
        const g = crate(gas, { x: 2.6, y: 0 }, 0.1);
        const inGas = ctxOf(gas, [...SMART]);
        commit(inGas, g);
        expect(bestBreakable(inGas)).toBeNull();
        // 12 units off (a flight took it away; the mp5 shoots crates from 7): the zone filter is back
        const away = testWorld();
        earlyZone(away);
        const f = crate(away, { x: 14, y: 0 }, 0.1);
        const ctx = ctxOf(away, [...SMART]);
        commit(ctx, f);
        expect(bestBreakable(ctx)).toBeNull();
    });

    it("a threat still takes the bot off it (no finishing floor under threat)", () => {
        const w = testWorld();
        const o = crate(w, { x: 2.6, y: 0 }, 0.1);
        // an armed enemy that shot a moment ago, 20 units off
        addEnemy(w, 9, { x: -20, y: 0 }, { lastShotAt: NOW - 0.5 });
        const ctx = ctxOf(w, [...SMART]);
        commit(ctx, o);
        const choice = bestBreakable(ctx);
        expect(choice?.obstacle).toBe(o);
        expect(breakScore(ctx, choice)).toBeLessThan(0.62);
    });

    it("never swaps a damaged crate for a more valuable one next to it", () => {
        const w = testWorld();
        const o = crate(w, { x: 6, y: 0 }, 0.5);
        addObstacle(w, { x: -3.2, y: 0 }, "chest_01");
        const ctx = ctxOf(w, [...SMART]);
        // undamaged: the chest (value 45) wins over the crate (32)
        expect(bestBreakable(ctx)?.obstacle.def.loot.length).toBeGreaterThan(0);
        expect(bestBreakable(ctx)?.obstacle).not.toBe(o);
        commit(ctx, o);
        expect(bestBreakable(ctx)?.obstacle).toBe(o);
        // a moment on another target (a fight, an item) does not make the bot forget the crate it damaged
        ctx.mem.loot2.damaged.set(o.view.id, NOW - 20);
        ctx.mem.breakTarget = 0;
        ctx.mem.loot2.breakId = 0;
        expect(bestBreakable(ctx)?.obstacle).toBe(o);
    });
});

describe("attacking through a visible enemy", () => {
    it("keeps punching a crate while a far enemy that does not threaten it is in view", () => {
        const w = testWorld();
        // (crate_01 is 4.5 units wide: its surface 1.4 units from the bot's centre, in the fists' reach of 2.05)
        const o = crate(w, { x: 3.65, y: 0 }, 0.6);
        // an mp5 with too little ammo to shoot crates: it punches; fists in hand
        giveGun(w, WeaponSlot.Primary, "mp5", 30, 10);
        w.model.self.curWeapIdx = WeaponSlot.Melee;
        // armed, 60 units off, facing away, never fired: no threat (lootRisk.ts)
        addEnemy(w, 9, { x: -60, y: 0 }, { dir: { x: -1, y: 0 } });
        const ctx = ctxOf(w, [...SMART]);
        expect(ctx.target?.id).toBe(9);
        commit(ctx, o);
        const intent = planBreak(ctx, { obstacle: o, value: 32, dist: 1.4 });
        expect(intent.slot).toBe(WeaponSlot.Melee);
        expect(intent.fire).toBe(true);
        expect(intent.targetId).toBe(0);
        // a close armed enemy facing the bot is a threat: the combat layer keeps the gun
        const w2 = testWorld();
        const o2 = crate(w2, { x: 3.65, y: 0 }, 0.6);
        giveGun(w2, WeaponSlot.Primary, "mp5", 30, 10);
        w2.model.self.curWeapIdx = WeaponSlot.Melee;
        const e = addEnemy(w2, 9, { x: -15, y: 0 });
        e.dir = { x: 1, y: 0 };
        const ctx2 = ctxOf(w2, [...SMART]);
        commit(ctx2, o2);
        expect(planBreak(ctx2, { obstacle: o2, value: 32, dist: 1.4 }).slot).toBe(WeaponSlot.Primary);
    });
});

type Placed = Array<{ type: string; off: { x: number; y: number }; ori: number }>;

/** A warehouse corner from a match (seed 8): a crate_01 between a metal wall, a crate_08 and a plated crate_06. */
const WAREHOUSE: Placed = [
    { type: "crate_01", off: { x: 0, y: 0 }, ori: 0 },
    { type: "crate_06", off: { x: 4, y: 0 }, ori: 1 },
    { type: "crate_08", off: { x: 0, y: 5 }, ori: 0 },
    { type: "metal_wall_ext_43", off: { x: 0, y: -7 }, ori: 1 },
];

/** A crate stack from a match (seed 9): a crate_02 with crate_01s left and right, plated crate_04s above and below. */
const PLUS: Placed = [
    { type: "crate_02", off: { x: 0, y: 0 }, ori: 0 },
    { type: "crate_01", off: { x: 5, y: 0 }, ori: 0 },
    { type: "crate_01", off: { x: -5, y: 0 }, ori: 0 },
    { type: "crate_04", off: { x: 0, y: 5 }, ori: 0 },
    { type: "crate_04", off: { x: 0, y: -5 }, ori: 0 },
];

/**
 * A flat game with `placed` (the first one is the target, id 1), also in the map data so the navigation grid knows
 * them, a bot at `start` from it and a far dummy.
 */
function clusterGame(placed: Placed, start: { x: number; y: number }) {
    const spot = openSpot(flatGame(), 60);
    const gen = cachedMap("main", 12345);
    const spawns = placed.map((o, i) => ({
        id: i + 1,
        type: o.type,
        pos: v2.add(spot, o.off),
        ori: o.ori,
        scale: 1,
        layer: 0,
    }));
    const objects = spawns.map((o) => ({ ...o, kind: "obstacle" as const, parentId: 0 }));
    const generation = { ...gen, objects, lootSpawns: [], mapData: { ...gen.mapData, objects: spawns } };
    const game = new Game(
        { mapName: "main", seed: 12345, teamMode: 1 },
        { generation, spawnLoot: false, sandbox: true },
    );
    const p = placePlayer(game, "bot", v2.add(spot, start));
    placePlayer(game, "dummy", v2.add(spot, { x: 250, y: 250 }));
    return { game, p, crate: game.world.objects.get(1) as Obstacle };
}

describe("punches that land", () => {
    it("breaks a crate pressed against a plated crate from the corner where punches hit the plating", () => {
        // from (3.3, -3.3) the swing overlapped the plated crate_06 more than the target: every punch hit the plating
        // and the crate was given up at 68% after 3 s (sim weapons/melee.ts takes the deepest overlap)
        for (const start of [
            { x: 3.34, y: -3.25 },
            { x: 6, y: -3.5 },
            { x: -6, y: -3.5 },
        ]) {
            for (const seed of [1, 2]) {
                const { game, p, crate } = clusterGame(WAREHOUSE, start);
                const bot = new BotController(game, p.id, { seed });
                expect(
                    runUntil(game, [bot], () => crate.dead, 900),
                    `${start.x},${start.y} seed ${seed}`,
                ).toBeGreaterThan(0);
            }
        }
    }, 20000);

    it("finishes a crate inside a stack: repositions off the plating, clears a neighbour, comes back to it", () => {
        // from the diagonal gaps the punches went into the plated crate_04s, and once the crate shrank the fists could
        // not reach it at all: before LOOT2 it was left at 92-116 of 140 from every side (0/12 in 30 s)
        for (const seed of [1, 2]) {
            const { game, p, crate } = clusterGame(PLUS, { x: 3.25, y: -3.36 });
            const bot = new BotController(game, p.id, { seed });
            expect(
                runUntil(game, [bot], () => crate.dead, 3000),
                `seed ${seed}`,
            ).toBeGreaterThan(0);
        }
    }, 30000);
});

describe("finishing in the simulation", () => {
    it("finishes a half-broken crate before it runs to a called air drop", () => {
        const spot = openSpot(flatGame(), 60);
        for (const seed of [3, 5]) {
            const game = flatGame({ sandbox: true }, 1, [{ type: "crate_02", pos: spot }]);
            const p = placePlayer(game, "bot", v2.add(spot, { x: 6, y: 0 }));
            // armed (the air drop behaviour ignores unarmed bots), too little ammo to shoot the crate
            giveSimGun(p, "mp5", 20);
            placePlayer(game, "dummy", v2.add(spot, { x: 250, y: 250 }));
            const c = [...game.world.objects.values()].find((o) => o.kind === "obstacle" && o.type === "crate_02") as
                | Obstacle
                | undefined;
            expect(c).toBeDefined();
            const crate = c as Obstacle;
            const bot = new BotController(game, p.id, { seed });
            expect(runUntil(game, [bot], () => crate.health < crate.maxHealth * 0.6, 900)).toBeGreaterThan(0);
            // held still until it knows the drop (its marker), then let go with a half-broken crate next to it
            bot.bot.brain.mem.order = { type: "hold" };
            game.planes.addAirdrop(v2.add(spot, { x: 70, y: 0 }));
            expect(runUntil(game, [bot], () => bot.bot.model.airdrops.open().length > 0, 4000)).toBeGreaterThan(0);
            bot.bot.brain.mem.order = null;
            let farthest = 0;
            const broke = runUntil(
                game,
                [bot],
                () => {
                    farthest = Math.max(farthest, v2.distance(p.pos, crate.pos));
                    return crate.dead;
                },
                900,
            );
            expect(broke, `seed ${seed}`).toBeGreaterThan(0);
            // it stayed at the crate until it broke
            expect(farthest).toBeLessThan(6);
        }
    }, 20000);
});
