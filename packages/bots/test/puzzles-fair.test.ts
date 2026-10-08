// Puzzles and doors are perceived like a player sees and hears them (review of the interactions): the snapshot also
// carries the obstacles of the other floor, the ones under roofs the bot is not under and a margin past the screen
// edge, and the puzzle behaviour and the door watch read them all. A bot outside the bank makes the same first decision
// about its vault whether or not someone opened the vault door already (only the bank's roof shows from there); the
// bathhouse's vault door, a floor down and off the screen, opening finishes nothing; a door watch on the surface takes
// no "passed" news (no alert, no gun out) from an underground door it cannot see. And the round 5 house loop does not
// come back through the puzzle behaviour: an unarmed bot chased out of the police station by a gunman at the panel
// does not walk back in for the panel while its danger memory holds the building. On the main map, seed 12345 (no
// loot spawned). Owner: bot interactions.
import { type Vec2, v2 } from "@rebirth/core";
import { Game, interactObstacle } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { floorGrid, type PuzzleSite, pieceFront, puzzleSites } from "../src/brain/puzzleSites.ts";
import { BotController } from "../src/controller.ts";
import { pointInBounds } from "../src/geom.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { installPerception } from "../src/perception/install.ts";
import { roofRegions } from "../src/perception/roofs.ts";
import { WorldModel } from "../src/perception/world.ts";
import { cachedMap, firstOfType, giveGun, mainGame, placePlayer, runUntil } from "./helpers.ts";

function site(game: Game, building: string): PuzzleSite {
    const s = puzzleSites(game.mapData).find((x) => x.entry.building === building);
    if (!s) throw new Error(`no ${building} site`);
    return s;
}

function doorOpen(game: Game, id: number): boolean {
    const o = game.world.get(id);
    return o?.kind === "obstacle" && !!o.door?.open;
}

/** A human solves the site (the pieces in the code's order) and walks off; returns once its first door is open. */
function solveByHand(game: Game, s: PuzzleSite): void {
    const human = placePlayer(game, "human", s.pieces[0].pos);
    game.teleportPlayer(human.id, s.pieces[0].pos, s.pieces[0].layer);
    const labels = s.entry.kind === "code" ? s.code : [s.pieces[0].label];
    for (const label of labels) {
        const piece = s.pieces.find((p) => p.label === label) ?? s.pieces[0];
        const o = game.world.get(piece.id);
        if (o?.kind === "obstacle") interactObstacle(game, o, human);
        runUntil(game, [], () => false, 30);
    }
    expect(runUntil(game, [], () => doorOpen(game, s.doors[0].id), 2000)).toBeGreaterThan(0);
    game.teleportPlayer(human.id, { x: 5, y: 5 }, 0);
}

/** A walkable ground spot `off` units from the site's door, under no roof (as the probe player's snapshot shows). */
function spotOutside(game: Game, s: PuzzleSite, off: number): Vec2 {
    const nav = NavGrid.forMap(game.mapData);
    const door = s.doors[0];
    const probe = placePlayer(game, "probe", door.pos);
    try {
        for (let a = 0; a < 64; a++) {
            const ang = (a / 64) * Math.PI * 2;
            const c = nav.nearestWalkable(
                v2.add(door.pos, { x: Math.cos(ang) * off, y: Math.sin(ang) * off * 0.5 }),
                2,
            );
            if (c < 0) continue;
            const at = nav.center(c);
            game.teleportPlayer(probe.id, at, 0);
            const buildings = game.getSnapshot(probe.id).objects.filter((o) => o.kind === "building");
            const roofs = roofRegions(buildings, new Map());
            if (!roofs.some((r) => r.regions.some((b) => pointInBounds(at, b)))) return at;
        }
    } finally {
        game.teleportPlayer(probe.id, { x: 8, y: 8 }, 0);
    }
    throw new Error("no spot outside");
}

/** The first decision an expert `off` units out of the site makes about it, with its door opened by hand first or not. */
function firstDecision(building: string, open: boolean, off: number) {
    const game = mainGame();
    const s = site(game, building);
    if (open) solveByHand(game, s);
    const p = placePlayer(game, "bot", spotOutside(game, s, off));
    giveGun(p, "mp5", 90);
    const bot = new BotController(game, p.id, { seed: 7, skill: "expert", brain: "smart" });
    const pm = bot.bot.brain.mem.puzzle;
    let doorInSnapshot: boolean | undefined;
    runUntil(
        game,
        [bot],
        () => {
            doorInSnapshot = bot.bot.model.obstacleById.get(s.doors[0].id)?.view.door?.open;
            return pm.site === s.index || pm.finished.has(s.index);
        },
        150,
    );
    return { chosen: pm.site === s.index, finished: pm.finished.has(s.index), doorInSnapshot };
}

describe("puzzles as a player sees them", () => {
    it("a bot outside the bank decides the same about its vault whether the vault door is open or shut", () => {
        // 24 units out of the vault door, outside the bank: the door is on the screen, under the bank's roof
        const shut = firstDecision("vault_01", false, 24);
        const opened = firstDecision("vault_01", true, 24);
        expect(shut).toEqual({ chosen: true, finished: false, doorInSnapshot: false });
        // the snapshot shows the door open (under the roof), and the bot goes to look all the same
        expect(opened).toEqual({ chosen: true, finished: false, doorInSnapshot: true });
    }, 60_000);

    it("the bathhouse's vault door opening a floor down, off the screen, finishes nothing", () => {
        const s = site(mainGame(), "bathhouse_01");
        expect(s.doors[0].layer & 1).toBe(1);
        const shut = firstDecision("bathhouse_01", false, 30);
        const opened = firstDecision("bathhouse_01", true, 30);
        expect(shut.chosen).toBe(true);
        expect(opened.chosen).toBe(true);
        expect(opened.finished).toBe(false);
    }, 60_000);

    it("a door watch on the surface takes no news from an underground door it cannot see", () => {
        const game = mainGame();
        const s = site(game, "bathhouse_01");
        const door = s.doors[0];
        const nav = NavGrid.forMap(game.mapData);
        // a ground spot about 12 units from the underground door: on the screen, but a floor up
        let spot = door.pos;
        for (let a = 0; a < 32; a++) {
            const q = v2.add(door.pos, { x: Math.cos((a / 32) * 6.283) * 12, y: Math.sin((a / 32) * 6.283) * 6 });
            const c = nav.nearestWalkable(q, 2);
            if (c >= 0) {
                spot = nav.center(c);
                break;
            }
        }
        const p = placePlayer(game, "bot", spot);
        giveGun(p, "mp5", 90);
        // a beginner who knows no code (the puzzle behaviour does not walk it off)
        const bot = new BotController(game, p.id, { seed: 11, skill: "beginner", brain: "smart" });
        const hold = () => game.teleportPlayer(p.id, spot, 0);
        const step = (n: number, each: () => void = () => {}) => {
            for (let i = 0; i < n; i++) {
                each();
                bot.update();
                game.step();
            }
        };
        step(20, hold);
        const watch = bot.bot.brain.doors?.watch;
        expect(watch).toBeDefined();
        expect(bot.bot.model.self.layer).toBe(0);
        expect(bot.bot.model.obstacleById.get(door.id)?.view.layer).toBe(1);
        // never seen (another floor): no belief
        expect(watch?.belief(door.id)).toBeUndefined();
        // the bot goes far away; a human opens the vault meanwhile; the bot comes back
        game.teleportPlayer(p.id, { x: spot.x + 200, y: spot.y }, 0);
        step(20);
        solveByHand(game, s);
        step(10, hold);
        expect(bot.bot.model.obstacleById.get(door.id)?.view.door?.open).toBe(true);
        expect(watch?.events.filter((e) => e.id === door.id)).toEqual([]);
        expect(bot.bot.brain.doors?.alert).toBeNull();
        expect(bot.bot.brain.mem.loot2.lastThreat).toBe(Number.NEGATIVE_INFINITY);
    }, 60_000);
});

/**
 * Main 12345 with only the building `type` (and what belongs to it) on the terrain: no other building and no crate to
 * break, so a bot stays as armed as it starts.
 */
function onlyBuilding(type: string): Game {
    const gen = cachedMap("main", 12345);
    const root = firstOfType(gen, type);
    const byId = new Map(gen.objects.map((o) => [o.id, o]));
    const keep = new Set<number>();
    for (const o of gen.objects) {
        let top = o;
        while (top.parentId) top = byId.get(top.parentId) ?? top;
        if (top.id === root.id) keep.add(o.id);
    }
    const objects = gen.objects.filter((o) => keep.has(o.id));
    const mapData = { ...gen.mapData, objects: gen.mapData.objects.filter((o) => keep.has(o.id)) };
    const generation = { ...gen, objects, lootSpawns: [], mapData };
    return new Game({ mapName: "main", seed: 12345, teamMode: 1 }, { generation, spawnLoot: false });
}

describe("puzzles and the danger memory", () => {
    it("an unarmed bot chased out of the police station by a gunman at the panel does not walk back in for it", () => {
        // the police station alone (the military base moved it next to a bridge whose crates armed the bot within the
        // 15 s of the last phase: the danger memory holds for an unarmed bot, so the run needs one that stays unarmed)
        const game = onlyBuilding("police_01");
        const s = site(game, "police_01");
        const first = s.pieces[0];
        const model = new WorldModel(game.mapData);
        installPerception(model, BRAIN_PRESETS.smart);
        const grid = floorGrid(model, first.layer, first.pos);
        const front = grid ? pieceFront(s, first, grid) : null;
        if (!grid || !front) throw new Error("no front");
        // the gunman stands a little inside the panel's front, where the bot must stand
        const enemy = placePlayer(
            game,
            "gunman",
            grid.center(grid.nearestWalkable(v2.add(front.spot, v2.mul(front.face, 2.5)), 3)),
        );
        giveGun(enemy, "ak47", 90);
        // the bot, unarmed, about 40 units out, with a way to the panel
        let start: Vec2 | null = null;
        for (const d of [40, 36, 44, 32, 48, 30]) {
            for (let a = 0; a < 16 && !start; a++) {
                const ang = (a / 16) * Math.PI * 2;
                const c = grid.nearestWalkable(v2.add(first.pos, { x: Math.cos(ang) * d, y: Math.sin(ang) * d }), 2);
                if (c >= 0 && model.nav.reachable(grid.center(c), front.spot)) start = grid.center(c);
            }
            if (start) break;
        }
        if (!start) throw new Error("no start");
        const me = placePlayer(game, "bot", start);
        const bot = new BotController(game, me.id, { seed: 3, skill: "intermediate", brain: "smart" });
        const pm = bot.bot.brain.mem.puzzle;
        // the gunman stands and aims at the bot (no shots)
        const step = (n: number, stop: () => boolean = () => false): number => {
            for (let i = 0; i < n; i++) {
                bot.update();
                enemy.input = { ...enemy.input, toMouseDir: v2.normalizeSafe(v2.sub(me.pos, enemy.pos)) };
                game.step();
                if (stop()) return i + 1;
            }
            return -1;
        };
        const policeDanger = () =>
            bot.bot.brain.mem.pursuit.dangers.find(
                (a) => a.building !== 0 && a.unarmed && game.time < a.until && v2.distance(first.pos, a.pos) < a.rad,
            );
        // it goes for the panel, sees the gunman and runs: the building is remembered
        expect(step(2000, () => bot.bot.intent.behaviour === "flee")).toBeGreaterThan(0);
        expect(policeDanger()).toBeDefined();
        expect(step(3000, () => bot.bot.intent.behaviour !== "flee")).toBeGreaterThan(0);
        // a while later, still unarmed: the site's own cooldown is over, and the bot is back where it started
        pm.cooldown.set(s.index, 0);
        game.teleportPlayer(me.id, start, 0);
        let pickedPolice = 0;
        step(1500, () => {
            if (pm.site === s.index && policeDanger()) pickedPolice++;
            return false;
        });
        expect(me.weaponManager.weapons[0].type).toBe("");
        expect(policeDanger()).toBeDefined();
        expect(pickedPolice).toBe(0);
    }, 60_000);
});
