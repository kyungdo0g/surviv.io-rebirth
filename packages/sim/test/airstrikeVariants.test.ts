// Rebirth air strike variants (deliberate deviation requested by the user, docs/research/rebirth-deviations.md):
// scheduled 50v50 zones roll normal / heavy / carpet from rules.roles.factionAirstrikeVariants on their own seeded
// stream; heavy zones drop 5 heavy shells per plane whose blast reaches 47.5 u over a zone grown by 30 u, carpet zones
// send 6 planes that aim inside 1.4x the radius under a marker that covers every blast; the original strobe and other
// maps stay normal, and a zone that rolls normal is the original strike. The air strike bombs blast x1.25 wider than
// survev's (owner, 2026-10-08): the iron bomb 6.25-17.5, the heavy shell 17.5-47.5.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import {
    AIRSTRIKE_AIM_LEAD,
    AIRSTRIKE_VARIANTS,
    airstrikeBombReach,
    DamageType,
    GameConfig,
    getDefOfType,
    getMapDef,
    Plane,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Player, pickAirstrikeVariant } from "../src/index.ts";
import { steps } from "./combatHelpers.ts";
import { clearSpot, type LoggedExplosion, logExplosions } from "./fxHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** A game with the flat test terrain running `mapName`'s plane timings (airstrike.test.ts). */
function flatMapGame(mapName: string, seed = 12345): Game {
    const gen = cachedMap("main", 12345);
    const generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    return new Game({ mapName, seed }, { generation, spawnLoot: false, sandbox: true });
}

function addAt(game: Game, pos: Vec2): Player {
    const id = game.addPlayer(`p${game.tick}`);
    game.teleportPlayer(id, pos);
    return game.getPlayer(id)!;
}

/** The faction map's circle 1 strike timing: zone radius 60, planes 1.5 s after the ping and 1 s apart. */
const CIRCLE1 = getMapDef("faction").gameConfig.planes.timings.find((t) => t.circleIdx === 1)!.options;

interface StrikeRun {
    game: Game;
    log: LoggedExplosion[];
    zone: NonNullable<ReturnType<Game["getSnapshot"]>["airstrikeZones"]>[number];
    planes: number;
    bombTypes: Set<string>;
    zoneTicks: number;
    /** each strike plane's aim point (its target moved forward by half the strip and the aim lead) */
    aims: Vec2[];
}

/**
 * Schedules one circle-1 strike over players at `origin` (three in a row, or `spread` around it) and runs it until its
 * zone closes and the bombs land.
 */
function runStrike(game: Game, origin: Vec2, spread: Vec2[] = [0, 1, 2].map((i) => ({ x: i * 3, y: 0 }))): StrikeRun {
    const players = spread.map((d) => addAt(game, v2.add(origin, d)));
    const log = logExplosions(game);
    game.step();
    game.planes.scheduleAirstrike(CIRCLE1, 0);
    game.step();
    const zone = (game.getSnapshot(players[0].id).airstrikeZones ?? [])[0];
    const planes = new Set<number>();
    const aims: Vec2[] = [];
    const bombTypes = new Set<string>();
    let zoneTicks = 1;
    for (; zoneTicks < 6000 && game.planes.zones.zones.length > 0; zoneTicks++) {
        game.step();
        for (const p of game.planes.planes) {
            if (p.type !== Plane.Airstrike || planes.has(p.id)) continue;
            planes.add(p.id);
            const strip = AIRSTRIKE_VARIANTS[zone.variant ?? "normal"];
            const back = ((strip.bombCount - 1) * strip.bombOffset) / 2 + AIRSTRIKE_AIM_LEAD;
            aims.push(v2.add(p.target, v2.mul(p.dir, back)));
        }
        for (const p of game.projectiles.projectiles) bombTypes.add(p.type);
    }
    steps(game, 300);
    return { game, log, zone, planes: planes.size, bombTypes, zoneTicks, aims };
}

describe("air strike variants (rebirth)", () => {
    it("a forced heavy zone grows by 30 u and drops 5 heavy shells per plane, all inside its marker", () => {
        const game = flatMapGame("faction");
        game.rules.roles.factionAirstrikeVariants = { heavy: 1 };
        const origin = clearSpot(100);
        const run = runStrike(game, origin);
        expect(run.zone.variant).toBe("heavy");
        // the heavy shell's extra reach over an iron bomb: 47.5 - 17.5
        expect(run.zone.rad).toBe(60 + 30);
        expect(run.planes).toBeGreaterThanOrEqual(3);
        expect(run.planes).toBeLessThanOrEqual(5);
        expect(run.bombTypes).toEqual(new Set(["bomb_heavy"]));
        expect(run.log.length).toBe(run.planes * AIRSTRIKE_VARIANTS.heavy.bombCount);
        expect(run.log.every((e) => e.type === "explosion_bomb_heavy" && e.damageType === DamageType.Airstrike)).toBe(
            true,
        );
        expect(getDefOfType("explosion", "explosion_bomb_heavy").rad).toEqual({ min: 17.5, max: 47.5 });
        // planes aim inside the map's 60 u, so every shell lands inside the grown marker
        expect(run.log.every((e) => v2.distance(e.pos, run.zone.pos) < run.zone.rad)).toBe(true);
        // and no shell's blast reaches farther past the marker than an iron bomb's can past a normal marker (a bomb's
        // reach from its aim point plus its 17.5 u blast)
        const ironPast =
            airstrikeBombReach(AIRSTRIKE_VARIANTS.normal) + getDefOfType("explosion", "explosion_bomb_iron").rad.max;
        for (const e of run.log) expect(v2.distance(e.pos, run.zone.pos) + 47.5 - run.zone.rad).toBeLessThan(ironPast);
    });

    it("a heavy shell hurts a player farther away than any iron bomb of the same strike could reach", () => {
        const origin = clearSpot(100);
        const strike = (variant: "normal" | "heavy") => {
            const game = flatMapGame("faction");
            // 17 u along the strip, 24 u to its side: iron bombs land within 4 u (jitter) of the line, so the nearest
            // is >= 20 u away, beyond explosion_bomb_iron's 17.5 u and the 1 u body (and its shrapnel's 12 u); heavy
            // shells reach 47.5 u
            const victim = addAt(game, v2.add(origin, { x: 17, y: 24 }));
            const log = logExplosions(game);
            game.planes.addAirstrike(origin, { x: 1, y: 0 }, 0, variant);
            steps(game, 600);
            return { victim, log };
        };
        const ironReach = getDefOfType("explosion", "explosion_bomb_iron").rad.max + GameConfig.player.radius;
        expect(ironReach).toBe(18.5);
        const iron = strike("normal");
        expect(iron.log.map((e) => e.type)).toEqual(Array(GameConfig.airstrike.bombCount).fill("explosion_bomb_iron"));
        expect(Math.min(...iron.log.map((e) => v2.distance(e.pos, iron.victim.pos)))).toBeGreaterThan(ironReach);
        expect(iron.victim.damageTaken).toBe(0);

        const heavy = strike("heavy");
        expect(heavy.log.map((e) => e.type)).toEqual(Array(5).fill("explosion_bomb_heavy"));
        expect(Math.min(...heavy.log.map((e) => v2.distance(e.pos, heavy.victim.pos)))).toBeGreaterThan(ironReach);
        expect(heavy.victim.dead || heavy.victim.damageTaken > 0).toBe(true);
    });

    it("a forced carpet zone sends 6 planes of iron bombs and lasts 1.5 + 2.5 + 6 + 2.5 s", () => {
        const game = flatMapGame("faction");
        game.rules.roles.factionAirstrikeVariants = { carpet: 1 };
        const run = runStrike(game, clearSpot(100));
        expect(run.zone.variant).toBe("carpet");
        // planes aim inside 60 x 1.4 = 84 u; the marker adds a bomb's reach, its blast and the body (25.75 + 17.5 +
        // 1 u, + 1 u for the wire, rounded up): 130 u
        expect(run.zone.rad).toBe(60 * 1.4 + 46);
        expect(run.planes).toBe(6);
        expect(run.zoneTicks * 0.01).toBeCloseTo(12.5, 1);
        expect(run.zone.duration).toBeCloseTo(12.5, 0);
        expect(run.bombTypes).toEqual(new Set(["bomb_iron"]));
        expect(run.log.filter((e) => e.type === "explosion_bomb_iron")).toHaveLength(
            6 * GameConfig.airstrike.bombCount,
        );
    });

    it("every carpet blast stays inside the marker, and the planes aim over the wider area", () => {
        // a carpet bomb lands at most 25.75 u from its plane's aim point (half the 38 u strip plus the 2.75 u lead
        // behind it, or the strip's front plus the ~2.9 u drift, then the 4 u jitter); its blast hurts a player whose
        // body (1 u) it reaches within rad.max
        expect(airstrikeBombReach(AIRSTRIKE_VARIANTS.carpet)).toBe(25.75);
        const blast = getDefOfType("explosion", "explosion_bomb_iron").rad.max + GameConfig.player.radius;
        expect(blast).toBe(17.5 + 1);
        let farthestAim = 0;
        let closestToEdge = Number.POSITIVE_INFINITY;
        let bombs = 0;
        for (let seed = 1; seed <= 8; seed++) {
            const game = flatMapGame("faction", 1000 + seed);
            game.rules.roles.factionAirstrikeVariants = { carpet: 1 };
            // players spread over the zone: half the aim points follow a player (up to 10 u off), half are anywhere
            const ring = [0, 1, 2, 3, 4, 5].map((i) => v2.mul({ x: Math.cos(i), y: Math.sin(i) }, 12 * i));
            const run = runStrike(game, clearSpot(100), ring);
            expect(run.zone.variant).toBe("carpet");
            expect(run.planes).toBe(6);
            const iron = run.log.filter((e) => e.type === "explosion_bomb_iron");
            expect(iron).toHaveLength(6 * GameConfig.airstrike.bombCount);
            bombs += iron.length;
            for (const e of iron) {
                const d = v2.distance(e.pos, run.zone.pos) + blast;
                expect(d).toBeLessThan(run.zone.rad);
                closestToEdge = Math.min(closestToEdge, run.zone.rad - d);
            }
            for (const aim of run.aims) {
                const d = v2.distance(aim, run.zone.pos);
                expect(d).toBeLessThanOrEqual(60 * 1.4 + 1e-6);
                farthestAim = Math.max(farthestAim, d);
            }
        }
        expect(bombs).toBe(8 * 6 * 20);
        // the planes use the wider aim radius (beyond the map's 60 u); the marker is not much larger than the blasts
        expect(farthestAim).toBeGreaterThan(60);
        expect(closestToEdge).toBeLessThan(15);
    }, 60_000);

    it("forced variants work through addZone too (carpet fixes the plane count and widens the zone)", () => {
        const game = flatMapGame("faction");
        game.planes.zones.addZone({ x: 300, y: 300 }, 50, 3, 1.5, 1, "carpet");
        game.planes.zones.addZone({ x: 300, y: 300 }, 50, 3, 1.5, 1, "heavy");
        expect(game.planes.zoneViews().map((z) => [z.variant, z.rad, z.duration])).toEqual([
            ["carpet", 50 * 1.4 + 46, 1.5 + 2.5 + 6 + 2.5],
            ["heavy", 50 + 30, 1.5 + 2.5 + 3 + 2.5],
        ]);
    });

    it("the default weights roll all three variants, deterministically per seed", () => {
        const weights = new Game({ mapName: "faction", seed: 1 }).rules.roles.factionAirstrikeVariants;
        expect(weights).toEqual({ normal: 60, heavy: 25, carpet: 15 });
        const counts = { normal: 0, heavy: 0, carpet: 0 };
        const rng = createRng(7);
        for (let i = 0; i < 4000; i++) counts[pickAirstrikeVariant(rng, weights)]++;
        expect(counts.normal / 4000).toBeCloseTo(0.6, 1);
        expect(counts.heavy / 4000).toBeCloseTo(0.25, 1);
        expect(counts.carpet / 4000).toBeCloseTo(0.15, 1);
        // through the game: the zone variant of a scheduled faction strike over many seeds
        const seen = new Set<string>();
        for (let seed = 1; seed <= 40 && seen.size < 3; seed++) {
            const variantOf = () => {
                const game = flatMapGame("faction", seed);
                game.planes.scheduleAirstrike(CIRCLE1, 0);
                game.step();
                return game.planes.zoneViews()[0].variant;
            };
            const v = variantOf();
            expect(variantOf()).toBe(v);
            seen.add(v as string);
        }
        expect(seen).toEqual(new Set(["normal", "heavy", "carpet"]));
    });

    it("weights: missing, non-positive or non-finite never win, none left means normal", () => {
        const rng = createRng(3);
        for (let i = 0; i < 50; i++) expect(pickAirstrikeVariant(rng, { heavy: 1, carpet: 0 })).toBe("heavy");
        expect(pickAirstrikeVariant(rng, {})).toBe("normal");
        expect(pickAirstrikeVariant(rng, { normal: 0, heavy: -1 })).toBe("normal");
        // non-finite weights never win; huge finite ones still split evenly instead of overflowing the sum
        expect(pickAirstrikeVariant(rng, { heavy: Number.POSITIVE_INFINITY, carpet: Number.NaN })).toBe("normal");
        const huge = { normal: 1e308, heavy: 1e308 };
        const counts = { normal: 0, heavy: 0, carpet: 0 };
        for (let i = 0; i < 1000; i++) counts[pickAirstrikeVariant(rng, huge)]++;
        expect(counts.carpet).toBe(0);
        expect(counts.normal / 1000).toBeCloseTo(0.5, 1);
    });

    it("a zone that rolls normal is the original strike: same planes, aim points and bombs as variants off", () => {
        const origin = clearSpot(100);
        const bombs = (weights: Record<string, number>) => {
            const game = flatMapGame("faction");
            game.rules.roles.factionAirstrikeVariants = weights;
            const run = runStrike(game, origin);
            expect(run.zone.variant).toBe("normal");
            return run.log.map((e) => [e.tick, e.type, e.pos.x, e.pos.y]);
        };
        // seed 12345 rolls normal with the default weights
        const withDefaults = bombs({ normal: 60, heavy: 25, carpet: 15 });
        expect(withDefaults.length).toBeGreaterThan(0);
        expect(withDefaults).toEqual(bombs({ normal: 1 }));
    });

    it("off faction maps scheduled zones and the original strobe's strikes stay normal whatever the weights", () => {
        const main = flatMapGame("main");
        main.rules.roles.factionAirstrikeVariants = { heavy: 1 };
        main.planes.scheduleAirstrike(CIRCLE1, 0);
        main.step();
        expect(main.planes.zoneViews().map((z) => [z.variant, z.rad])).toEqual([["normal", 60]]);

        // a strobe on the faction map with heavy-only weights still calls normal strikes
        const game = flatMapGame("faction");
        game.rules.roles.factionAirstrikeVariants = { heavy: 1 };
        const origin = clearSpot(100);
        const log = logExplosions(game);
        const strobe = game.projectiles.add({
            ownerId: 0,
            type: "strobe",
            pos: origin,
            posZ: 0,
            layer: 0,
            vel: { x: 0, y: 0 },
            fuse: 13.5,
            throwDir: { x: 1, y: 0 },
        });
        game.projectiles.armStrobe(strobe, 2.5);
        steps(game, 1200);
        const bombs = log.filter((e) => e.type.startsWith("explosion_bomb"));
        expect(bombs.length).toBe(3 * GameConfig.airstrike.bombCount);
        expect(bombs.every((e) => e.type === "explosion_bomb_iron")).toBe(true);
    });
});
