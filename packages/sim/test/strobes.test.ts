// Strobes in the simulation: survev master's strike pattern (the baseline; conflicts.md strobe-airstrike-offset,
// broken-arrow-check-time) and the rebirth variant strobes (defs rebirth/strobes.ts; docs/research/rebirth-deviations.md
// "Variant strobes"): the heavy strobe calls 3 lines of heavy shells (5 with Broken Arrow), the carpet strobe 6 lines
// of iron bombs 1.4x wider apart (8), each marked by its own ping and credited to the strobe in the kill feed; their
// loot comes from the rare crates of the strobe modes only.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import {
    AIRSTRIKE_VARIANTS,
    DamageType,
    GameConfig,
    getMapDef,
    getMapObjectDefOfType,
    Plane,
    STROBE_VARIANT_TYPES,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Game, type Player, rollLootList } from "../src/index.ts";
import { constantRng } from "./combatHelpers.ts";
import { clearSpot, cookAndThrow, fxGame, holdThrowable, type LoggedExplosion, logExplosions } from "./fxHelpers.ts";

interface StrobeRun {
    game: Game;
    p: Player;
    strobe: { pos: Vec2 };
    log: LoggedExplosion[];
    /** each strike plane's target relative to the strobe, in the order the planes came, and the tick it came */
    lines: Vec2[];
    lineTicks: number[];
    pings: string[];
    pingTick: number;
    thrownTick: number;
    bombTypes: Set<string>;
}

/**
 * `p` throws one `type` strobe 4 u ahead (+x) from a clear spot and walks off 60 u behind; runs until every bomb fell.
 * `setup` runs before the throw; `afterThrow` right after it.
 */
function throwStrobe(
    type: string,
    setup: (game: Game, p: Player) => void = () => {},
    afterThrow: (game: Game, p: Player) => void = () => {},
): StrobeRun {
    const origin = clearSpot(200);
    const { game, p } = fxGame(origin);
    setup(game, p);
    holdThrowable(p, type, 1);
    const log = logExplosions(game);
    cookAndThrow(game, p, 10, 4);
    const thrownTick = game.tick - 1;
    const strobe = game.projectiles.projectiles[0];
    expect(strobe.type).toBe(type);
    game.teleportPlayer(p.id, v2.add(origin, { x: -60, y: 0 }));
    afterThrow(game, p);
    const lines: Vec2[] = [];
    const lineTicks: number[] = [];
    const pings: string[] = [];
    const seen = new Set<number>();
    const seenPings = new Set<number>();
    const bombTypes = new Set<string>();
    let pingTick = 0;
    for (let i = 0; i < 1500; i++) {
        game.step();
        for (const ind of game.planes.indicators) {
            if (seenPings.has(ind.id)) continue;
            seenPings.add(ind.id);
            pings.push(ind.type);
            pingTick ||= game.tick;
        }
        for (const plane of game.planes.planes) {
            if (plane.type !== Plane.Airstrike || seen.has(plane.id)) continue;
            seen.add(plane.id);
            lines.push(v2.sub(plane.target, strobe.pos));
            lineTicks.push(game.tick);
        }
        for (const proj of game.projectiles.projectiles) if (proj !== strobe) bombTypes.add(proj.type);
    }
    return { game, p, strobe, log, lines, lineTicks, pings, pingTick, thrownTick, bombTypes };
}

/** Sideways offsets of the lines (+y left of the +x throw), rounded to 1 mm (the strobe still creeps a little). */
const sideways = (run: StrobeRun): number[] => run.lines.map((l) => Math.round(l.y * 1e3) / 1e3 + 0);

describe("strobe strike pattern (survev master)", () => {
    it("the first line starts at the strobe, the next ones 5 and 10 u beside it on alternating sides", () => {
        const run = throwStrobe("strobe");
        expect(run.pings).toEqual(["ping_airstrike"]);
        expect((run.pingTick - run.thrownTick) * 0.01).toBeCloseTo(3, 6);
        // the fx rng's 0.5 keeps the default side: the second line to the right of the throw
        expect(sideways(run)).toEqual([0, -5, 5]);
        for (const l of run.lines) expect(Math.abs(l.x)).toBeLessThan(1e-3);
        const ba = throwStrobe("strobe", (_, p) => p.perks.push("broken_arrow"));
        expect(sideways(ba)).toEqual([0, -5, 5, -10, 10]);
    });

    it("starts on a random side (survev: 'was not in surviv'); offset 0 puts every line on the strobe", () => {
        const flipped = throwStrobe("strobe", (game) => {
            game.fxRng = constantRng(0.25);
        });
        expect(sideways(flipped)).toEqual([0, 5, -5]);
        const fixed = throwStrobe("strobe", (game) => {
            game.fxRng = constantRng(0.25);
            game.rules.strobeRandomSide = false;
        });
        expect(sideways(fixed)).toEqual([0, -5, 5]);
        const stacked = throwStrobe("strobe", (game) => {
            game.rules.strobeAirstrikeOffset = 0;
        });
        expect(sideways(stacked)).toEqual([0, 0, 0]);
    });

    it("counts Broken Arrow when the strobe is thrown (survev); rules.brokenArrowAtPing counts it at the ping", () => {
        const pickUpAfterThrow = (_: Game, p: Player) => p.perks.push("broken_arrow");
        expect(throwStrobe("strobe", () => {}, pickUpAfterThrow).lines).toHaveLength(3);
        const atPing = throwStrobe(
            "strobe",
            (game) => {
                game.rules.brokenArrowAtPing = true;
            },
            pickUpAfterThrow,
        );
        expect(atPing.lines).toHaveLength(5);
    });
});

describe("variant strobes (rebirth)", () => {
    it("the heavy strobe calls 3 lines of heavy shells (5 with Broken Arrow) under its own ping", () => {
        for (const brokenArrow of [false, true]) {
            const run = throwStrobe("strobe_heavy", (_, p) => {
                if (brokenArrow) p.perks.push("broken_arrow");
            });
            const n = brokenArrow ? 5 : 3;
            expect(run.pings).toEqual(["ping_airstrike_heavy"]);
            expect((run.pingTick - run.thrownTick) * 0.01).toBeCloseTo(3, 6);
            expect(sideways(run)).toEqual([0, -5, 5, -10, 10].slice(0, n));
            expect(run.bombTypes).toEqual(new Set(["bomb_heavy"]));
            const bombs = run.log.filter((e) => e.type.startsWith("explosion_bomb"));
            expect(bombs).toHaveLength(n * AIRSTRIKE_VARIANTS.heavy.bombCount);
            expect(bombs.every((e) => e.type === "explosion_bomb_heavy")).toBe(true);
            // the thrower's air strike, credited to the strobe
            expect(bombs.every((e) => e.sourceId === run.p.id && e.damageType === DamageType.Airstrike)).toBe(true);
            expect(bombs.every((e) => e.gameSourceType === "strobe_heavy")).toBe(true);
        }
    });

    it("the carpet strobe calls 6 lines of iron bombs (8 with Broken Arrow), 0 / 7 / 7 / 14 / 14 / 21 u to the sides", () => {
        for (const brokenArrow of [false, true]) {
            const run = throwStrobe("strobe_carpet", (_, p) => {
                if (brokenArrow) p.perks.push("broken_arrow");
            });
            const n = brokenArrow ? 8 : 6;
            expect(run.pings).toEqual(["ping_airstrike_carpet"]);
            expect(sideways(run)).toEqual([0, 7, -7, 14, -14, 21, -21, 28].slice(0, n));
            expect(run.bombTypes).toEqual(new Set(["bomb_iron"]));
            const bombs = run.log.filter((e) => e.type.startsWith("explosion_bomb"));
            expect(bombs).toHaveLength(n * GameConfig.airstrike.bombCount);
            expect(bombs.every((e) => e.type === "explosion_bomb_iron" && e.gameSourceType === "strobe_carpet")).toBe(
                true,
            );
            // the first line 1 s after the ping, the rest within the strobe's 3 s window: 3 / n s apart
            expect((run.lineTicks[0] - run.pingTick) * 0.01).toBeCloseTo(1, 6);
            expect((run.lineTicks[n - 1] - run.lineTicks[0]) * 0.01).toBeCloseTo(3 - 3 / n, 1);
        }
    });

    it("a kill by a variant strobe's bombs is the thrower's air strike kill with the strobe as its source", () => {
        let victim: Player | undefined;
        const run = throwStrobe("strobe_heavy", undefined, (game) => {
            const id = game.addPlayer("victim");
            const strobe = game.projectiles.projectiles[0];
            game.teleportPlayer(id, v2.add(strobe.pos, { x: 12, y: 0 }));
            victim = game.getPlayer(id);
        });
        expect(victim?.dead).toBe(true);
        const kill = run.game.match.kills.since(0).find((k) => k.targetId === victim?.id && k.killed);
        expect(kill).toMatchObject({
            killCreditId: run.p.id,
            damageType: DamageType.Airstrike,
            source: "airstrike",
            itemSourceType: "strobe_heavy",
        });
    });

    it("the original strobe's bombs keep bomb_iron as their source, as in v0.8.82", () => {
        const run = throwStrobe("strobe");
        const bombs = run.log.filter((e) => e.type === "explosion_bomb_iron");
        expect(bombs).toHaveLength(3 * GameConfig.airstrike.bombCount);
        expect(bombs.every((e) => e.gameSourceType === "bomb_iron")).toBe(true);
    });
});

describe("variant strobe loot (rebirth)", () => {
    /** Share of `crate`'s loot rolls on `map` that hold each variant strobe, over `n` crates. */
    function variantShare(map: string, crate: string, n = 4000): { heavy: number; carpet: number; strobe: number } {
        const tables = getMapDef(map).lootTable;
        const loot = getMapObjectDefOfType("obstacle", crate).loot;
        const rng = createRng(77);
        const counts = { heavy: 0, carpet: 0, strobe: 0 };
        for (let i = 0; i < n; i++) {
            const items = rollLootList(tables, loot, rng).map((it) => it.type);
            if (items.includes("strobe_heavy")) counts.heavy++;
            if (items.includes("strobe_carpet")) counts.carpet++;
            if (items.includes("strobe")) counts.strobe++;
        }
        return { heavy: counts.heavy / n, carpet: counts.carpet / n, strobe: counts.strobe / n };
    }

    it("a desert or woods gold drop holds each variant strobe about 1 time in 20, rarer than the strobe", () => {
        for (const [map, crate] of [
            ["desert", "crate_11de"],
            ["woods", "crate_11"],
            ["savannah", "crate_11sv"],
        ] as const) {
            const s = variantShare(map, crate);
            expect(s.heavy, map).toBeGreaterThan(0.035);
            expect(s.heavy, map).toBeLessThan(0.065);
            expect(s.carpet, map).toBeGreaterThan(0.035);
            expect(s.carpet, map).toBeLessThan(0.065);
            expect(s.strobe, map).toBeGreaterThan(s.heavy * 3);
        }
    });

    it("about 1 in 6 50v50 military crates holds one; the main map, potato modes and normal drops never do", () => {
        for (const crate of ["crate_12", "crate_13"]) {
            const s = variantShare("faction", crate);
            expect(s.heavy + s.carpet, crate).toBeGreaterThan(0.11);
            expect(s.heavy + s.carpet, crate).toBeLessThan(0.22);
        }
        expect(variantShare("main", "crate_11", 1000)).toMatchObject({ heavy: 0, carpet: 0 });
        expect(variantShare("faction_potato", "crate_12po", 500)).toMatchObject({ heavy: 0, carpet: 0 });
        for (const crate of ["crate_10", "crate_10t1", "crate_10t2"]) {
            expect(variantShare("desert", crate, 1000), crate).toMatchObject({ heavy: 0, carpet: 0 });
        }
        expect(STROBE_VARIANT_TYPES).toEqual(["strobe_heavy", "strobe_carpet"]);
    });
});
