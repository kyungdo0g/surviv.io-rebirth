// Rebirth air drop tiers in the simulation (rules.airdropTiers; docs/research/rebirth-deviations.md "Air drop
// tiers"): a normal drop is a tier 1 or a tier 2 drop picked by the gas circle, lands as the normal shell (the same
// object on the wire for both tiers) and opens into its tier's inner crate; the gold drop keeps its chance and its
// draws; AIRDROP_TIERS=off restores the v0.8.82 picks; explicit and special crates never split.
import { type Vec2, v2 } from "@rebirth/core";
import {
    AIRDROP_TIER1_ARMOR_TABLE,
    AIRDROP_TIER1_TABLE,
    AIRDROP_TIER2_TABLE,
    DamageType,
    GameObjectDefs,
    getMapDef,
    Input,
    type LootTableEntry,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Obstacle } from "../src/index.ts";
import { flatGame, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

type Choice = { type: string; inner: string };

/** The plane system's crate pick (what a scheduled or flare drop without a crate type gets). */
const pick = (game: Game): Choice => (game.planes as unknown as { crateChoice(): Choice }).crateChoice();

/** A game on `mapName`'s rules (plane timings, crates, loot) over the flat test terrain. */
function flatMapGame(mapName: string, seed = 12345): Game {
    const gen = cachedMap("main", 12345);
    const generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    return new Game({ mapName, seed }, { generation, spawnLoot: false, sandbox: true });
}

function untilLanded(game: Game, max = 6000): void {
    for (let i = 0; i < max; i++) {
        game.step();
        if (game.planes.planes.every((p) => p.actionComplete) && game.planes.airdrops.every((d) => d.landed)) return;
    }
    throw new Error("the crates did not land");
}

function obstaclesOf(game: Game, type: string): Obstacle[] {
    const out: Obstacle[] = [];
    for (const o of game.world.objects.values()) if (o.kind === "obstacle" && o.type === type && !o.dead) out.push(o);
    return out.sort((a, b) => a.pos.x - b.pos.x);
}

/** Item names reachable from a loot table of `mapName`. */
function itemsOf(mapName: string, tier: string, out = new Set<string>()): Set<string> {
    for (const e of getMapDef(mapName).lootTable[tier] as LootTableEntry[]) {
        if (e.name.startsWith("tier_")) itemsOf(mapName, e.name, out);
        else if (e.name) out.add(e.name);
    }
    return out;
}

/** Opens a landed shell with Interact from just south of it and waits for it to burst. */
function open(game: Game, shell: Obstacle): void {
    const opener = spawnAt(game, v2.add(shell.pos, { x: 0, y: -2.5 - 1.6 }), { x: 0, y: 1 });
    send(game, opener, { actions: [Input.Interact] });
    game.step();
    send(game, opener, {});
    steps(game, 260);
    expect(shell.dead).toBe(true);
}

/** Breaks `n` crates of `type` and returns the guns and armour they dropped. */
function crateLoot(type: string, n: number): { guns: string[]; armor: string[]; items: number } {
    const origin = openSpot(flatGame(), 8);
    const at = (i: number): Vec2 => ({ x: origin.x + (i % 10) * 8, y: origin.y + Math.floor(i / 10) * 8 });
    const placed = flatGame(Array.from({ length: n }, (_, i) => ({ type, pos: at(i) })));
    const before = new Set(placed.loot.items.keys());
    for (const o of obstaclesOf(placed, type)) {
        placed.damageObstacle(o, { amount: 1e6, damageType: DamageType.Player, sourceId: 0 });
    }
    const drops = [...placed.loot.items.values()].filter((l) => !before.has(l.id)).map((l) => l.type);
    const kind = (t: string) => GameObjectDefs[t]?.type;
    return {
        guns: drops.filter((t) => kind(t) === "gun"),
        armor: drops.filter((t) => ["helmet", "chest", "backpack"].includes(kind(t) ?? "")),
        items: drops.length,
    };
}

describe("air drop tiers (rebirth)", () => {
    it("a tier drop lands as the normal shell, alike on the wire, and opens into its tier's crate", () => {
        const game = flatGame();
        const spot = openSpot(game, 40);
        game.planes.addAirdrop(spot, "airdrop_crate_01", "tier1");
        game.planes.addAirdrop(v2.add(spot, { x: 14, y: 0 }), "airdrop_crate_01", "tier2");
        game.planes.addAirdrop(v2.add(spot, { x: 28, y: 0 }), "airdrop_crate_02");
        expect(game.planes.planes.map((p) => [p.crateType, p.innerType])).toEqual([
            ["airdrop_crate_01", "crate_10t1"],
            ["airdrop_crate_01", "crate_10t2"],
            ["airdrop_crate_02", ""],
        ]);
        untilLanded(game);
        const [t1, t2] = obstaclesOf(game, "airdrop_crate_01");
        const [gold] = obstaclesOf(game, "airdrop_crate_02");
        expect([t1.destroyTypeOverride, t2.destroyTypeOverride, gold.destroyTypeOverride]).toEqual([
            "crate_10t1",
            "crate_10t2",
            "",
        ]);
        // a client is told the same about both shells but their id and position: the tier stays on the server
        const watcher = spawnAt(game, v2.add(spot, { x: 7, y: -10 }));
        const objects = game.getSnapshot(watcher.id).objects;
        const seen = (o: Obstacle) => {
            const { id: _id, pos: _pos, ...rest } = objects.find((v) => v.id === o.id)!;
            return rest;
        };
        expect(seen(t2)).toEqual(seen(t1));
        expect(JSON.stringify(objects)).not.toMatch(/crate_10t/);

        open(game, t1);
        open(game, t2);
        open(game, gold);
        expect(obstaclesOf(game, "crate_10t1").map((c) => c.pos)).toEqual([t1.pos]);
        expect(obstaclesOf(game, "crate_10t2").map((c) => c.pos)).toEqual([t2.pos]);
        expect(obstaclesOf(game, "crate_11").map((c) => c.pos)).toEqual([gold.pos]);
        expect(obstaclesOf(game, "crate_10")).toEqual([]);
    });

    it("tier crates drop their tier's loot: tier 1 guns (now and then a tier 2 gun) and mostly level 2 gear", () => {
        const tier1Guns = itemsOf("main", AIRDROP_TIER1_TABLE);
        const tier2Guns = itemsOf("main", AIRDROP_TIER2_TABLE);
        const t1 = crateLoot("crate_10t1", 40);
        expect(t1.guns).toHaveLength(40);
        for (const g of t1.guns) expect(tier1Guns.has(g), g).toBe(true);
        // tier 2 shares tier 1's low end; a gun only tier 2 has comes from tier 1's 10 % tier 2 roll
        const tier1Own = new Set(getMapDef("main").lootTable[AIRDROP_TIER1_TABLE].map((e) => e.name));
        expect(t1.guns.filter((g) => tier2Guns.has(g) && !tier1Own.has(g)).length).toBeLessThan(12);
        const t1Armor = itemsOf("main", AIRDROP_TIER1_ARMOR_TABLE);
        expect(t1.armor).toHaveLength(40);
        for (const a of t1.armor) expect(t1Armor.has(a), a).toBe(true);
        expect(t1.armor.filter((a) => a.endsWith("02")).length).toBeGreaterThan(t1.armor.length / 2);

        const t2 = crateLoot("crate_10t2", 40);
        expect(t2.guns).toHaveLength(40);
        for (const g of t2.guns) expect(tier2Guns.has(g), g).toBe(true);
        for (const a of t2.armor) expect(["helmet03", "chest03", "backpack03"]).toContain(a);
        // tier 1 is leaner: one medical roll instead of two, two ammo stacks instead of three, no outfit or melee roll
        expect(t1.items).toBeLessThan(t2.items);
    });

    it("main: circle 1 drops are mostly tier 1, circle 3 drops mostly tier 2, gold stays 1 of 11", () => {
        const game = flatGame();
        const share = (circle: number, n = 3000) => {
            game.gas.circleIdx = circle;
            const counts: Record<string, number> = {};
            for (let i = 0; i < n; i++) {
                const c = pick(game);
                const key = c.inner || c.type;
                counts[key] = (counts[key] ?? 0) + 1;
            }
            return (k: string) => (counts[k] ?? 0) / n;
        };
        const early = share(1);
        expect(Math.abs(early("crate_10t1") - (10 / 11) * 0.7)).toBeLessThan(0.03);
        expect(Math.abs(early("crate_10t2") - (10 / 11) * 0.3)).toBeLessThan(0.03);
        expect(Math.abs(early("airdrop_crate_02") - 1 / 11)).toBeLessThan(0.02);
        const late = share(3);
        expect(Math.abs(late("crate_10t1") - (10 / 11) * 0.3)).toBeLessThan(0.03);
        expect(Math.abs(late("crate_10t2") - (10 / 11) * 0.7)).toBeLessThan(0.03);
        expect(Math.abs(late("airdrop_crate_02") - 1 / 11)).toBeLessThan(0.02);
    });

    it("deterministic per seed; with AIRDROP_TIERS off the v0.8.82 picks, in step with the tiered ones", () => {
        const picks = (tiers: boolean, seed: number) => {
            const game = flatGame([], seed);
            game.rules.airdropTiers = tiers;
            game.gas.circleIdx = 1;
            return Array.from({ length: 300 }, () => pick(game));
        };
        expect(picks(true, 7)).toEqual(picks(true, 7));
        const on = picks(true, 7);
        const off = picks(false, 7);
        // off: only the original crates, opening into their own crates
        expect(new Set(off.map((c) => `${c.type}:${c.inner}`))).toEqual(
            new Set(["airdrop_crate_01:", "airdrop_crate_02:"]),
        );
        // one weighted draw either way: the same drops are gold, the normal ones only gain a tier
        expect(on.map((c) => c.type)).toEqual(off.map((c) => c.type));
        expect(on.filter((c) => c.type === "airdrop_crate_01").every((c) => c.inner.startsWith("crate_10t"))).toBe(
            true,
        );

        // a scheduled drop with the tiers off opens into crate_10
        const game = flatGame();
        game.rules.airdropTiers = false;
        const spot = openSpot(game, 20);
        game.planes.addAirdrop(spot);
        expect(game.planes.planes[0].innerType).toBe("");
    });

    it("mode crates: snow and savannah split into their own crates, special and explicit crates never split", () => {
        const kinds = (mapName: string, circle: number) => {
            const game = flatMapGame(mapName);
            game.gas.circleIdx = circle;
            return new Set(Array.from({ length: 400 }, () => pick(game)).map((c) => `${c.type}:${c.inner}`));
        };
        expect(kinds("snow", 0)).toEqual(
            new Set(["airdrop_crate_01x:crate_10t1", "airdrop_crate_01x:crate_10t2", "airdrop_crate_02x:"]),
        );
        expect(kinds("savannah", 1)).toEqual(
            new Set(["airdrop_crate_01sv:crate_10svt1", "airdrop_crate_01sv:crate_10svt2", "airdrop_crate_02sv:"]),
        );
        // desert's crimson air drop (survev content wave stage 3) is a special crate: never split
        expect(kinds("desert", 1)).toEqual(
            new Set([
                "airdrop_crate_01:crate_10t1",
                "airdrop_crate_01:crate_10t2",
                "airdrop_crate_02de:",
                "airdrop_crate_05:",
            ]),
        );
        expect(kinds("faction", 2)).toEqual(new Set(["airdrop_crate_03:"]));
        expect(kinds("cobalt", 1)).toEqual(new Set(["class_shell_02:", "class_shell_03:"]));
        // potato: the gold drop keeps its 1 in 2
        const potato = flatMapGame("potato");
        potato.gas.circleIdx = 1;
        const golds = Array.from({ length: 2000 }, () => pick(potato)).filter((c) => c.type === "airdrop_crate_02");
        expect(Math.abs(golds.length / 2000 - 0.5)).toBeLessThan(0.04);
        // explicit crates (the 50v50 gold drop, a halloween timing's crate) are dropped as asked
        const faction = flatMapGame("faction");
        faction.planes.scheduleCrate("airdrop_crate_04", 0);
        faction.planes.addAirdrop({ x: 300, y: 300 }, "airdrop_crate_01");
        faction.step();
        expect(faction.planes.planes.map((p) => [p.crateType, p.innerType])).toEqual([
            ["airdrop_crate_01", ""],
            ["airdrop_crate_04", ""],
        ]);
    });

    it("the main map's scheduled drops carry their circle's tier odds", () => {
        // the first drop comes 10 s into circle 1, the second 2 s into circle 3 (airdrop.test.ts)
        const inner: string[] = [];
        for (let seed = 1; seed <= 24; seed++) {
            const game = new Game(
                { mapName: "main", seed },
                { generation: cachedMap("main", 12345), spawnLoot: false, sandbox: true },
            );
            game.step();
            for (const circle of [1, 3]) {
                game.gas.circleIdx = circle;
                game.planes.scheduleAirdrop();
                inner.push(`${circle}:${game.planes.planes.at(-1)!.innerType}`);
            }
        }
        const count = (k: string) => inner.filter((i) => i === k).length;
        expect(count("1:crate_10t1")).toBeGreaterThan(count("1:crate_10t2"));
        expect(count("3:crate_10t2")).toBeGreaterThan(count("3:crate_10t1"));
    });
});
