// Maps follow the player cap (the owner via the lead, 2026-10-08; defs mapDefForPlayers, match/gasScale.ts): a game
// whose cap is above its map's design count plays on a larger map, stretches its gas and the waits counted from a
// circle's start by how much wider the map is, and lets that many players join (never more than the wire's 255); at
// the default cap nothing changes. At the largest maps every fixed spawn still lands within the validation budgets and
// buildings per land area stay within 10 % of the design map.
import { GameConfig, getMapDef, getMapObjectDef, type MapDef, mapDefForPlayers, mapWidth } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type GenerateMapResult, generateMap } from "../src/index.ts";
import { MAX_PLAYERS_IN_GAME } from "../src/match/match.ts";
import { cachedMap, objectsHash } from "./helpers.ts";
import { MAP_CASES, validateSeed } from "./mapValidation.ts";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("a game's player cap", () => {
    it("grows a classic squad game at cap 160 to 1225 a side and stretches its gas by 1225 / 899", () => {
        const game = new Game({ mapName: "main", seed: 1, teamMode: 4, maxPlayers: 160 }, { spawnLoot: false });
        expect(game.mapData.width).toBe(1225);
        expect(game.gas.mapSize).toBe(1225);
        const s = 1225 / 899;
        expect(game.gas.timeScale).toBeCloseTo(s, 12);
        const base = GameConfig.gas.stages;
        expect(game.gas.stages.map((x) => x.duration)).toEqual(base.map((x) => Math.round(x.duration * s * 100) / 100));
        expect(game.gas.stages.map((x) => [x.mode, x.rad, x.damage])).toEqual(
            base.map((x) => [x.mode, x.rad, x.damage]),
        );
        // the whole cycle: s times as long, within a tick per stage
        expect(
            Math.abs(sum(game.gas.stages.map((x) => x.duration)) - sum(base.map((x) => x.duration)) * s),
        ).toBeLessThan(base.length * 0.01);
        // the same options give the same map
        const again = new Game({ mapName: "main", seed: 1, teamMode: 4, maxPlayers: 160 }, { spawnLoot: false });
        expect(objectsHash(again.generation.objects)).toBe(objectsHash(game.generation.objects));
    });

    it("changes nothing without a cap or at the design count", () => {
        for (const maxPlayers of [undefined, 80, 40]) {
            const game = new Game({ mapName: "main", seed: 1, teamMode: 4, maxPlayers }, { spawnLoot: false });
            expect(objectsHash(game.generation.objects)).toBe(objectsHash(cachedMap("main", 1, 4).objects));
            expect(game.gas.stages).toBe(GameConfig.gas.stages);
            expect(game.gas.timeScale).toBe(1);
        }
        // explicit stages (fast gas) are used as given
        const fast = [{ mode: 0, duration: 1, rad: 0.7, damage: 1 }];
        const game = new Game({ mapName: "main", seed: 1, maxPlayers: 200 }, { spawnLoot: false, gasStages: fast });
        expect(game.gas.stages).toBe(fast);
    });

    it("grows a 50v50 game at cap 200 to 1415 with one arsenal and both bases", () => {
        const game = new Game({ mapName: "faction", seed: 7, teamMode: 4, maxPlayers: 200 }, { spawnLoot: false });
        expect(game.mapData.width).toBe(1415);
        const top = game.generation.objects.filter((o) => o.parentId === 0);
        expect(top.filter((o) => o.type === "arsenal_01")).toHaveLength(1);
        expect(top.filter((o) => o.type.startsWith("military_base_01"))).toHaveLength(2);
        expect(game.gas.timeScale).toBeCloseTo(1415 / 1034, 12);
    });

    it("lets as many players join as a cap that grows the map (else the mode's maxPlayers; 255 at most)", () => {
        const fill = (game: Game) => {
            let n = 0;
            while (game.canJoin() && n < 400) {
                game.addPlayer(`p${n}`);
                n++;
            }
            return n;
        };
        const joinable = (maxPlayers: number | undefined, generation: GenerateMapResult) =>
            fill(new Game({ mapName: "main", seed: 2, maxPlayers }, { generation, spawnLoot: false }));
        const design = cachedMap("main", 2);
        expect(joinable(undefined, design)).toBe(80);
        expect(joinable(40, design)).toBe(80);
        expect(joinable(120, generateMap("main", 2, 1, mapDefForPlayers("main", 120)))).toBe(120);
        const big = generateMap("main", 2, 1, mapDefForPlayers("main", 255));
        expect(MAX_PLAYERS_IN_GAME).toBe(255);
        expect(joinable(255, big)).toBe(255);
        expect(joinable(400, big)).toBe(255);
        // test_faction (mode 80) under the default 50v50 cap of 100, its design count: still 80
        const faction = (maxPlayers: number) =>
            fill(new Game({ mapName: "test_faction", seed: 2, maxPlayers }, { spawnLoot: false }));
        expect(faction(100)).toBe(80);
        expect(faction(120)).toBe(120);
    }, 60_000);

    it("stretches the gas by the width a generation passed in is played at", () => {
        const design = cachedMap("main", 1, 4);
        const capped = new Game({ mapName: "main", seed: 1, teamMode: 4, maxPlayers: 160 }, { generation: design });
        expect(capped.mapData.width).toBe(899);
        expect(capped.gas.timeScale).toBe(1);
        expect(capped.gas.stages).toBe(GameConfig.gas.stages);
        const grown = generateMap("main", 1, 4, mapDefForPlayers("main", 160));
        const game = new Game({ mapName: "main", seed: 1, teamMode: 4, maxPlayers: 160 }, { generation: grown });
        expect(game.gas.timeScale).toBeCloseTo(1225 / 899, 12);
    });

    it("stretches the circle-1 air drop wait with the gas", () => {
        const game = new Game({ mapName: "main", seed: 5, maxPlayers: 160 }, { spawnLoot: false, sandbox: true });
        const me = game.getPlayer(game.addPlayer("me"))!;
        game.rules.minActiveTime = 0;
        let circle1 = -1;
        let plane = -1;
        for (let i = 0; i < 400 * 100 && plane < 0; i++) {
            game.teleportPlayer(me.id, game.gas.posNew);
            game.step();
            me.health = 100;
            if (circle1 < 0 && game.gas.circleIdx === 1) circle1 = game.tick;
            if (game.planes.planes.length > 0) plane = game.tick;
        }
        // main's first drop: 10 s into circle 1, times 1144 / 842
        expect(circle1).toBeGreaterThan(0);
        expect((plane - circle1) / 100).toBeCloseTo(10 * (1144 / 842), 1);
    }, 60_000);
});

describe("maps at the largest player cap", () => {
    /** Top-level buildings and structures per 100 000 units² of land (inside the shore inset). */
    function density(def: MapDef, g: GenerateMapResult): number {
        const land = (g.mapData.width - 2 * def.mapGen.map.shoreInset) ** 2;
        let n = 0;
        for (const o of g.objects) {
            if (o.parentId !== 0) continue;
            const t = getMapObjectDef(o.type).type;
            if (t === "building" || t === "structure") n++;
        }
        return (n / land) * 1e5;
    }

    const CASES: ReadonlyArray<readonly [string, number, 1 | 4]> = [
        ["main", 255, 1],
        ["main", 255, 4],
        ["faction", 255, 4],
        ["snow", 255, 4],
        ["cobalt", 255, 4],
    ];
    for (const [map, cap, teamMode] of CASES) {
        it(`${map} at cap ${cap} (team mode ${teamMode}): every fixed spawn placed, warnings in budget, density kept`, () => {
            const c = MAP_CASES.find((x) => x.map === map)!;
            const def = mapDefForPlayers(map, cap);
            expect(mapWidth(def, teamMode > 2 ? "large" : "small")).toBeGreaterThan(
                mapWidth(getMapDef(map), teamMode > 2 ? "large" : "small"),
            );
            const issues: string[] = [];
            let warnings = 0;
            let grown = 0;
            let design = 0;
            for (const seed of [1, 2, 3]) {
                const r = validateSeed(c, seed, teamMode, def);
                for (const i of r.issues) issues.push(`seed ${seed}: ${i}`);
                warnings += r.warnings.length;
                grown += density(def, generateMap(map, seed, teamMode, def));
                design += density(getMapDef(map), cachedMap(map, seed, teamMode));
            }
            expect(issues).toEqual([]);
            expect(warnings / 3).toBeLessThanOrEqual(c.maxWarnings);
            const ratio = grown / design;
            expect(ratio, `${map}: ${(ratio * 100 - 100).toFixed(1)} %`).toBeGreaterThan(0.9);
            expect(ratio, `${map}: ${(ratio * 100 - 100).toFixed(1)} %`).toBeLessThan(1.1);
        }, 120_000);
    }
});
