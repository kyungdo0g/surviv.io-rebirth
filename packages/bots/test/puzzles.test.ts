// Puzzle knowledge and sites (BrainFeatures.puzzles): the knowledge table agrees with the building defs for every
// puzzle (pieces, labels, positions, the doors the solution moves, delays) and its codes with the server's; the sites
// of the main map resolve to real obstacles with fronts to press from and rooms with containers; who knows which code
// is a per-bot draw from its own stream, by tier and persona; every site a bot may know on every map has a front for
// each piece (the saloon's bottles stand on bar counters: pressed from farther out); puzzle doors stop being walls in
// the navigation of the puzzle bots once a snapshot shows them open, and never in the baseline's (its replay stays as
// before the puzzles existed); and a brain without the flag never touches any of it. Owner: bot interactions.
import { createHash } from "node:crypto";
import { v2 } from "@rebirth/core";
import { type BuildingDef, MapDefs, MapObjectDefs } from "@rebirth/defs";
import { generateMap, interactObstacle, PUZZLE_CODES } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { floorGrid, pieceFront, puzzleSites } from "../src/brain/puzzleSites.ts";
import { BotController } from "../src/controller.ts";
import { distanceToCollider } from "../src/geom.ts";
import { codeOf, drawPuzzleKnowledge, knowsChance, PUZZLES } from "../src/knowledge/puzzles.ts";
import { doorKey } from "../src/nav/cellGrid.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { installPerception } from "../src/perception/install.ts";
import { WorldModel } from "../src/perception/world.ts";
import { NEUTRAL, PERSONAS } from "../src/persona.ts";
import type { SkillProfile } from "../src/skill.ts";
import { cachedMap, giveGun, mainGame, placePlayer, runUntil } from "./helpers.ts";

function buildings(): Array<[string, BuildingDef]> {
    const out: Array<[string, BuildingDef]> = [];
    for (const [id, d] of Object.entries(MapObjectDefs)) if (d.type === "building") out.push([id, d]);
    return out;
}

function tier(t: SkillProfile["tier"]): SkillProfile {
    return { tier: t, s: 0.5, g: 0.5 };
}

describe("puzzle knowledge", () => {
    it("matches the building defs for every puzzle: pieces, labels, positions, doors, delays, codes", () => {
        const puzzles = buildings().filter(([, d]) => d.puzzle);
        expect(puzzles.length).toBeGreaterThanOrEqual(10);
        for (const [id, def] of puzzles) {
            const entry = PUZZLES.get(id);
            expect(entry, id).toBeDefined();
            if (!entry || !def.puzzle) continue;
            expect(entry.kind).toBe("code");
            expect(entry.name).toBe(def.puzzle.name);
            // every labelled button child is a piece, at its def position, and nothing else is
            const pieces = def.mapObjects.filter((c) => {
                const t = typeof c.type === "string" ? MapObjectDefs[c.type] : undefined;
                return !!c.puzzlePiece && t?.type === "obstacle" && !!t.button;
            });
            expect(entry.pieces.map((p) => [p.type, p.label, p.pos.x, p.pos.y])).toEqual(
                pieces.map((c) => [c.type, c.puzzlePiece, c.pos.x, c.pos.y]),
            );
            const opens = def.mapObjects.filter((c) => c.type === def.puzzle?.completeUseType);
            expect(entry.opens.length).toBe(opens.length);
            expect(entry.openAfter).toBe(def.puzzle.completeUseDelay);
            expect(entry.pieceWindow).toBe(def.puzzle.pieceResetDelay);
            expect(entry.errorReset).toBe(def.puzzle.errorResetDelay);
            if (entry.pieces.length === 0) continue;
            expect(opens.length, id).toBeGreaterThan(0);
            // the learned code is the server's, and every label of it is painted on a piece
            expect(codeOf(entry, "main")).toEqual(PUZZLE_CODES[entry.name]);
            for (const label of codeOf(entry, "main")) expect(entry.pieces.some((p) => p.label === label)).toBe(true);
            for (const r of entry.rooms) if (r.building) expect(MapObjectDefs[r.building]?.type).toBe("building");
        }
        // Woods has its own Eye bunker code (sim world/puzzles.ts puzzleCode)
        const eye = PUZZLES.get("bunker_eye_sublevel_01");
        expect(eye && codeOf(eye, "woods")).toEqual(PUZZLE_CODES.bunker_eye_02_woods);
        expect(eye && codeOf(eye, "halloween")).toEqual(PUZZLE_CODES.bunker_eye_02);
    });

    it("knows the panels and vault doors: the panel moves its doors after useDelay, the door opens after openDelay", () => {
        for (const id of ["police_01", "police_01x", "bunker_crossing_compartment_01"]) {
            const e = PUZZLES.get(id);
            expect(e?.kind).toBe("panel");
            expect(e?.lore).toBe("obvious");
            expect(e?.pieces).toHaveLength(1);
            expect(e?.opens.length).toBeGreaterThanOrEqual(2);
        }
        expect(PUZZLES.get("police_01")?.openAfter).toBe(1.1);
        expect(PUZZLES.get("bunker_crossing_compartment_01")?.openAfter).toBe(4.25);
        for (const id of ["vault_01", "vault_01b"]) {
            const e = PUZZLES.get(id);
            expect(e?.kind).toBe("door");
            expect(e?.opens.map((o) => o.type)).toEqual(["vault_door_main"]);
            expect(e?.openAfter).toBe(4.1);
        }
        // the bathhouse switch is the one obvious code puzzle; the Twins need a squad
        expect(PUZZLES.get("bathhouse_01")?.lore).toBe("obvious");
        expect(PUZZLES.get("bunker_twins_sublevel_01")?.lore).toBe("squad");
    });

    it("draws who knows which code once per bot: experts almost always, intermediates often, beginners rarely", () => {
        const share = (t: SkillProfile["tier"], name: string, persona = NEUTRAL) => {
            let n = 0;
            for (let seed = 1; seed <= 400; seed++) if (drawPuzzleKnowledge(seed, tier(t), persona).has(name)) n++;
            return n / 400;
        };
        expect(share("expert", "club_01")).toBeGreaterThan(0.88);
        expect(share("intermediate", "club_01")).toBeGreaterThan(0.5);
        expect(share("intermediate", "club_01")).toBeLessThan(0.8);
        expect(share("beginner", "club_01")).toBeLessThan(0.2);
        expect(share("expert", "reserve_vault")).toBeGreaterThan(0.65);
        expect(share("beginner", "reserve_vault")).toBeLessThan(0.08);
        // obvious ones: everyone
        for (const t of ["beginner", "intermediate", "expert"] as const) {
            expect(share(t, "club_02")).toBe(1);
            expect(share(t, "police_01")).toBe(1);
            expect(share(t, "vault_01")).toBe(1);
        }
        // thorough looters learn more codes than rushers
        expect(knowsChance("common", "intermediate", PERSONAS.looter)).toBeGreaterThan(
            knowsChance("common", "intermediate", PERSONAS.rusher),
        );
        // the same seed, the same knowledge
        expect([...drawPuzzleKnowledge(42, tier("intermediate"), NEUTRAL)]).toEqual([
            ...drawPuzzleKnowledge(42, tier("intermediate"), NEUTRAL),
        ]);
    });
});

describe("puzzle sites", () => {
    it("resolves the main map's sites to obstacles, with fronts, doors, rooms and containers", () => {
        const gen = cachedMap("main", 12345);
        const sites = puzzleSites(gen.mapData);
        const kinds = sites.map((s) => s.entry.building).sort();
        expect(kinds).toEqual(
            expect.arrayContaining(["bathhouse_01", "club_01", "police_01", "vault_01", "bunker_chrys_sublevel_01"]),
        );
        const model = new WorldModel(gen.mapData);
        installPerception(model, BRAIN_PRESETS.smart);
        for (const s of sites) {
            expect(s.pieces.length).toBe(s.entry.pieces.length);
            for (const p of s.pieces) {
                const o = gen.objects.find((x) => x.id === p.id);
                expect(o?.type).toBe(p.type);
                if (s.entry.kind === "code") expect(o?.puzzlePiece).toBe(p.label);
                const grid = floorGrid(model, p.layer, p.pos);
                expect(grid, `${s.entry.building} ${p.label}`).not.toBeNull();
                if (grid) expect(pieceFront(s, p, grid), `${s.entry.building} ${p.label}`).not.toBeNull();
            }
            expect(s.doors.length).toBeGreaterThan(0);
        }
        const club = sites.find((s) => s.entry.building === "club_01");
        expect(club?.code).toEqual(["1", "2", "3", "4"]);
        // the vault behind the secret door holds two deposit boxes; the bookshelf in front of it must be broken first
        expect(club?.rooms[0].containers).toHaveLength(2);
        expect(club?.blockers.map((b) => b.type)).toEqual(["bookshelf_01"]);
        const bath = sites.find((s) => s.entry.building === "bathhouse_01");
        expect(bath?.rooms[0].layer).toBe(1);
        expect(bath?.rooms[0].containers.some((id) => gen.objects.find((x) => x.id === id)?.type === "case_07")).toBe(
            true,
        );
    });

    it("gives every piece of every site a bot may know a front, on every map (the saloon's bottles too)", () => {
        let saloon = false;
        for (const name of Object.keys(MapDefs)) {
            const gen = generateMap(name, 1, 1);
            const sites = puzzleSites(gen.mapData).filter((s) => s.entry.lore !== "squad");
            if (sites.length === 0) continue;
            const model = new WorldModel(gen.mapData);
            installPerception(model, BRAIN_PRESETS.smart);
            for (const s of sites) {
                if (s.entry.building === "saloon_01") saloon = true;
                for (const p of s.pieces) {
                    const grid = floorGrid(model, p.layer, p.pos);
                    const front = grid ? pieceFront(s, p, grid) : null;
                    expect(front, `${name} ${s.entry.building} ${p.label}`).not.toBeNull();
                    if (!front || !grid) continue;
                    // a walkable spot from which the last steps (towards `lean`) come within the piece's reach
                    expect(grid.walkableAt(front.spot) || grid.nearestWalkable(front.spot, 0.8) >= 0).toBe(true);
                    expect(distanceToCollider(front.lean, p.col)).toBeLessThan(1e-6);
                }
            }
        }
        expect(saloon).toBe(true);
    }, 60_000);
});

describe("puzzle doors in the navigation", () => {
    it("a cell door the panel opened stops being a wall once a snapshot shows it open", () => {
        const game = mainGame();
        const police = puzzleSites(game.mapData).find((s) => s.entry.building === "police_01");
        if (!police) throw new Error("no police station");
        const nav = new NavGrid(game.mapData, { sealedDoors: true });
        // the cell next to the panel (the others are out of its view)
        const panelPos = police.pieces[0].pos;
        const door = [...police.doors].sort((a, b) => v2.distance(a.pos, panelPos) - v2.distance(b.pos, panelPos))[0];
        // sealed: stamped closed, no door cell
        expect(nav.sealedDoors.has(door.id)).toBe(true);
        expect(nav.isStamped(doorKey(door.id))).toBe(true);
        expect(nav.doors.has(door.id)).toBe(false);
        const cells = police.rooms[0];
        // a spot in that cell: inside the cell block, the nearest free cell to the door
        let inside = -1;
        let best = Number.POSITIVE_INFINITY;
        for (let dx = -4; dx <= 4; dx++) {
            for (let dy = -4; dy <= 4; dy++) {
                const p = v2.add(door.pos, { x: dx, y: dy });
                const c = nav.cellOf(p);
                const at = nav.center(c);
                if (!nav.walkable(c) || at.x < cells.bounds.min.x || at.x > cells.bounds.max.x) continue;
                if (at.y < cells.bounds.min.y || at.y > cells.bounds.max.y || v2.distance(at, door.pos) >= best)
                    continue;
                best = v2.distance(at, door.pos);
                inside = c;
            }
        }
        const hall = nav.nearestWalkable(panelPos, 4);
        expect(inside).toBeGreaterThanOrEqual(0);
        expect(nav.component(inside)).not.toBe(nav.component(hall));
        // a player presses the panel; a bot standing by sees the cells open
        const p = placePlayer(game, "presser", police.pieces[0].pos);
        const panel = game.world.get(police.pieces[0].id);
        if (panel?.kind !== "obstacle") throw new Error("no panel");
        interactObstacle(game, panel, p);
        const model = new WorldModel(game.mapData, nav);
        runUntil(
            game,
            [],
            () => {
                const o = game.world.get(door.id);
                return o?.kind === "obstacle" && !!o.door?.open;
            },
            300,
        );
        model.observe(game.getSnapshot(p.id));
        const view = model.obstacleById.get(door.id)?.view;
        expect(view?.door?.open).toBe(true);
        // the closed panel is no wall any more: the cell joins the hall
        expect(nav.component(inside)).toBe(nav.component(hall));
    });

    it("only the puzzle bots' grid learns them: a baseline bot replays the same whether or not a human opens the cells", () => {
        // (THE RULE, brain/features.ts: with the sealed doors in the one shared grid, a baseline bot standing in the
        // police station walked off elsewhere once a human pressed the cell panel)
        const run = (press: boolean) => {
            const game = mainGame();
            const police = puzzleSites(game.mapData).find((s) => s.entry.building === "police_01");
            if (!police) throw new Error("no police station");
            const panel = police.pieces[0];
            const p = placePlayer(game, "base", panel.pos);
            giveGun(p, "mp5", 90);
            const bot = new BotController(game, p.id, { seed: 5, skill: "intermediate", brain: "baseline" });
            const human = placePlayer(game, "human", panel.pos);
            const o = game.world.get(panel.id);
            if (press && o?.kind === "obstacle") interactObstacle(game, o, human);
            game.teleportPlayer(human.id, { x: 5, y: 5 }, 0);
            const h = createHash("sha256");
            for (let t = 0; t < 3000; t++) {
                bot.update();
                game.step();
                if (t % 25 === 0) h.update(`${p.pos.x.toFixed(3)},${p.pos.y.toFixed(3)};`);
            }
            const door = [...police.doors].sort(
                (a, b) => v2.distance(a.pos, panel.pos) - v2.distance(b.pos, panel.pos),
            )[0];
            const nav = bot.bot.model.nav;
            let inside = -1;
            for (let dx = -4; dx <= 4 && inside < 0; dx++) {
                for (let dy = -4; dy <= 4 && inside < 0; dy++) {
                    const c = nav.cellOf(v2.add(door.pos, { x: dx, y: dy }));
                    if (nav.walkable(c) && nav.component(c) !== nav.component(nav.nearestWalkable(panel.pos, 4))) {
                        inside = c;
                    }
                }
            }
            const open = game.world.get(door.id);
            return {
                open: open?.kind === "obstacle" && !!open.door?.open,
                cutOff: inside >= 0,
                trajectory: h.digest("hex"),
                nav,
                map: game.mapData,
                game,
            };
        };
        const quiet = run(false);
        const pressed = run(true);
        expect(quiet.open).toBe(false);
        expect(pressed.open).toBe(true);
        // the cells stay walls in its grid, and it walks exactly as when nobody touched the panel
        expect(pressed.cutOff).toBe(true);
        expect(pressed.trajectory).toBe(quiet.trajectory);
        // its own grid, its game's plain one (the cells stamped under the door's own id), apart from the puzzle bots'
        expect(pressed.nav).toBe(NavGrid.forMap(pressed.map, { game: pressed.game }));
        expect(pressed.nav).not.toBe(NavGrid.forMap(pressed.map, { sealedDoors: true, game: pressed.game }));
        expect(pressed.nav.learnsSealed).toBe(false);
        expect(pressed.nav.sealedDoors.size).toBe(0);
    }, 60_000);
});

describe("the puzzles flag", () => {
    it("is on in the smart preset and off in the baseline, which never draws or scores it", () => {
        expect(BRAIN_PRESETS.smart.puzzles).toBe(true);
        expect(BRAIN_PRESETS.baseline.puzzles).toBe(false);
        const game = mainGame();
        const club = puzzleSites(game.mapData).find((s) => s.entry.building === "club_01");
        if (!club) throw new Error("no club");
        const p = placePlayer(game, "base", v2.add(club.pieces[0].pos, { x: -4, y: 0 }));
        const bot = new BotController(game, p.id, { seed: 3, skill: "expert", brain: "baseline" });
        runUntil(game, [bot], () => false, 300);
        const mem = bot.bot.brain.mem.puzzle;
        expect(mem.known).toBeNull();
        expect(mem.site).toBe(-1);
        expect(bot.bot.brain.lastScores.puzzle).toBeUndefined();
    });
});
