// Puzzles in a real game (BrainFeatures.puzzles) on the main map, seed 12345 (no loot spawned; alone, the gas waits):
// an expert next to the club presses its switches in the круг order, breaks the bookshelf hiding the secret door and
// the deposit boxes in the vault; a beginner who never learned the club code leaves its switches alone but presses the
// bathhouse's single switch, and the ring-case vault opens; anyone uses the police cell panel and the bank vault door;
// a bot at work walks off the moment an enemy shows up and stays off while it is around; in the greenhouse bunker, the
// last room (behind a glass wall, no route) is given up at once instead of walked at along the glass, but a room the
// bot can walk into is kept after a goal in it failed while the doors were shut. Owner: bot interactions.
import { type Vec2, v2 } from "@rebirth/core";
import type { Game } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { floorGrid, type PuzzleSite, pieceFront, puzzleSites } from "../src/brain/puzzleSites.ts";
import { BotController } from "../src/controller.ts";
import { distanceToCollider, obstacleCollider, obstacleDef } from "../src/geom.ts";
import { drawPuzzleKnowledge } from "../src/knowledge/puzzles.ts";
import { installPerception } from "../src/perception/install.ts";
import { WorldModel } from "../src/perception/world.ts";
import { NEUTRAL } from "../src/persona.ts";
import { giveGun, mainGame, placePlayer, runUntil } from "./helpers.ts";

type Tier = "beginner" | "intermediate" | "expert";
const SECOND = 100;

function site(game: Game, building: string): PuzzleSite {
    const s = puzzleSites(game.mapData).find((x) => x.entry.building === building);
    if (!s) throw new Error(`no ${building} site`);
    return s;
}

function doorOpen(game: Game, id: number): boolean {
    const o = game.world.get(id);
    return o?.kind === "obstacle" && !!o.door?.open;
}

function alive(game: Game, id: number): boolean {
    const o = game.world.get(id);
    return o?.kind === "obstacle" && !o.dead;
}

/** Club pieces switched on right now. */
function piecesOn(game: Game, s: PuzzleSite): number {
    let n = 0;
    for (const p of s.pieces) {
        const o = game.world.get(p.id);
        if (o?.kind === "obstacle" && o.button?.onOff) n++;
    }
    return n;
}

/** A bot of `tier` with an MP5, `off` units out from the front of the site's first piece (on its floor). */
function botAt(game: Game, s: PuzzleSite, tier: Tier, seed: number, off = 6): BotController {
    const first = s.pieces.find((p) => p.label === (s.code[0] ?? p.label)) ?? s.pieces[0];
    const model = new WorldModel(game.mapData);
    installPerception(model, BRAIN_PRESETS.smart);
    const grid = floorGrid(model, first.layer, first.pos);
    if (!grid) throw new Error("no grid");
    const front = pieceFront(s, first, grid);
    if (!front) throw new Error("no front");
    const cell = grid.nearestWalkable(v2.add(front.spot, v2.mul(front.face, off)), 4);
    const pos: Vec2 = cell >= 0 ? grid.center(cell) : front.spot;
    const p = placePlayer(game, `${tier}-${seed}`, pos);
    game.teleportPlayer(p.id, pos, first.layer);
    giveGun(p, "mp5", 90);
    return new BotController(game, p.id, { seed, skill: tier, brain: "smart" });
}

describe("puzzles in a game", () => {
    it("an expert solves the club puzzle, breaks the bookshelf and loots the secret room", () => {
        const game = mainGame();
        const club = site(game, "club_01");
        const bot = botAt(game, club, "expert", 7);
        expect(bot.bot.brain.mem.puzzle.seed).toBe(7);
        // the switches go on in the code's order (к р у г), never another
        const order: string[] = [];
        const door = club.doors[0];
        const t = runUntil(
            game,
            [bot],
            () => {
                for (const p of club.pieces) {
                    const o = game.world.get(p.id);
                    if (o?.kind === "obstacle" && o.button?.onOff && !order.includes(p.label)) order.push(p.label);
                }
                return doorOpen(game, door.id);
            },
            30 * SECOND,
        );
        expect(t).toBeGreaterThan(0);
        expect(order).toEqual(["1", "2", "3", "4"]);
        const b = game.world.get(club.buildingId);
        expect(b?.kind === "building" && b.puzzle?.solved).toBe(true);
        // in through the bookshelf: both deposit boxes of the vault get broken
        const boxes = club.rooms[0].containers;
        const t2 = runUntil(game, [bot], () => boxes.every((id) => !alive(game, id)), 40 * SECOND);
        expect(t2).toBeGreaterThan(0);
        expect(alive(game, club.blockers[0].id)).toBe(false);
        // (with the doors flag on too: the secret door it opened from the switches is its own doing, no door alert
        // that would end the attempt before the room)
        const doors = bot.bot.brain.doors;
        expect(doors).not.toBeNull();
        const heard = doors?.watch.events.filter((e) => e.id === door.id) ?? [];
        expect(heard.length).toBeGreaterThan(0);
        expect(heard.every((e) => e.cause === "self")).toBe(true);
    });

    it("a beginner without the club code leaves its switches alone but presses the bathhouse switch", () => {
        let seed = 1;
        const beginner = { tier: "beginner" as const, s: 0.15, g: 0.15 };
        while (drawPuzzleKnowledge(seed, beginner, NEUTRAL).has("club_01")) seed++;
        const game = mainGame();
        const club = site(game, "club_01");
        const bath = site(game, "bathhouse_01");
        const bot = botAt(game, club, "beginner", seed);
        expect(bot.bot.skill.tier).toBe("beginner");
        let pressed = 0;
        const t = runUntil(
            game,
            [bot],
            () => {
                pressed = Math.max(pressed, piecesOn(game, club));
                return bath.doors.every((d) => doorOpen(game, d.id));
            },
            90 * SECOND,
        );
        expect(pressed).toBe(0);
        expect(doorOpen(game, club.doors[0].id)).toBe(false);
        // the obvious switch: the ring-case vault opens
        expect(t).toBeGreaterThan(0);
        const known = bot.bot.brain.mem.puzzle.known;
        expect(known?.has("club_01")).toBe(false);
        expect(known?.has("club_02")).toBe(true);
    });

    it("anyone opens the police cells with the panel and the bank vault by hand", () => {
        for (const [building, seed] of [
            ["police_01", 11],
            ["vault_01", 12],
        ] as const) {
            const game = mainGame();
            const s = site(game, building);
            const bot = botAt(game, s, "intermediate", seed);
            const t = runUntil(game, [bot], () => s.doors.every((d) => doorOpen(game, d.id)), 30 * SECOND);
            expect(t, building).toBeGreaterThan(0);
            // then into the room: something in it gets broken
            const boxes = s.rooms[0].containers;
            const t2 = runUntil(game, [bot], () => boxes.some((id) => !alive(game, id)), 40 * SECOND);
            expect(t2, building).toBeGreaterThan(0);
        }
    });

    it("walks off the moment an enemy shows up, and stays off while it is around", () => {
        const game = mainGame();
        const club = site(game, "club_01");
        const bot = botAt(game, club, "expert", 7);
        const pm = bot.bot.brain.mem.puzzle;
        expect(runUntil(game, [bot], () => pm.step >= 1, 20 * SECOND)).toBeGreaterThan(0);
        const on = piecesOn(game, club);
        expect(on).toBeGreaterThanOrEqual(1);
        // an enemy walks into view across the room
        const me = game.getPlayer(bot.playerId);
        if (!me) throw new Error("no bot");
        const enemy = placePlayer(game, "enemy", v2.add(me.pos, { x: -14, y: 0 }));
        let more = 0;
        let puzzling = 0;
        let around = 0;
        for (let i = 0; i < 12 * SECOND; i++) {
            bot.update();
            game.step();
            const there = !game.getPlayer(enemy.id)?.dead;
            if (there) around++;
            // (a moment to see it: the next decision after the snapshot it shows in)
            if (there && i > 0.6 * SECOND && bot.bot.intent.behaviour === "puzzle") puzzling++;
            // (the input resets after the piece window: switches only ever go off)
            more = Math.max(more, piecesOn(game, club) - on);
        }
        expect(around).toBeGreaterThan(SECOND);
        expect(puzzling).toBe(0);
        // the club waits (it may have gone for another site once the enemy was dealt with and it was quiet again)
        expect(pm.site).not.toBe(club.index);
        expect(pm.cooldown.get(club.index)).toBeGreaterThan(game.time - 12);
        expect(more).toBe(0);
        expect(doorOpen(game, club.doors[0].id)).toBe(false);
    });

    it("gives the greenhouse bunker's room behind the glass up at once instead of sliding along the glass", () => {
        // move-slide: an expert who knows both chrys codes presses 一二三四, then the planters, and loots compartment 2;
        // compartment 3 lies behind a glass wall (only breaking it lets a player in) with no route on the grid: the bot
        // walked straight at the room's middle and slid along the glass for 30 s, until the room stage ran out
        const game = mainGame();
        const sub = site(game, "bunker_chrys_sublevel_01");
        const comp = site(game, "bunker_chrys_compartment_01");
        expect(comp.rooms.length).toBe(2);
        const behind = comp.rooms[1];
        const glassSpawn = game.mapData.objects
            .filter((o) => o.type === "glass_wall_12")
            .sort((a, b) => v2.distance(a.pos, behind.center) - v2.distance(b.pos, behind.center))[0];
        const def = obstacleDef("glass_wall_12");
        if (!glassSpawn || !def) throw new Error("no glass wall");
        const glass = obstacleCollider(def, glassSpawn.pos, glassSpawn.ori, glassSpawn.scale);
        // (seed 5 since PR #19's wave 3 moved main 12345: with seed 3 the expert now gives the planter code up after
        // its third planter, and the compartment waits out its cooldown; seeds 1, 2, 5 and 8 reach the room, 3, 4, 6
        // and 7 do not within the 50 s)
        const bot = botAt(game, sub, "expert", 5);
        const pm = bot.bot.brain.mem.puzzle;
        const t = runUntil(game, [bot], () => pm.site === comp.index && pm.stage === "room", 50 * SECOND);
        expect(t).toBeGreaterThan(0);
        expect(pm.known?.has("bunker_chrys_01")).toBe(true);
        let done = -1;
        let atGlass = 0;
        for (let i = 0; i < 15 * SECOND; i++) {
            bot.update();
            game.step();
            const me = game.getPlayer(bot.playerId);
            if (me && me.layer === 1 && distanceToCollider(me.pos, glass) < 2.5) atGlass++;
            if (done < 0 && pm.finished.has(comp.index)) done = i;
        }
        // compartment 2 looted and compartment 3 given up within seconds; at the glass for a moment only
        expect(done).toBeGreaterThan(0);
        expect(done).toBeLessThan(8 * SECOND);
        expect(atGlass).toBeLessThan(3 * SECOND);
        expect(pm.site).not.toBe(comp.index);
    }, 60_000);

    it("keeps a room it can walk into although a goal in it failed while the doors were shut", () => {
        // move-slide review: a failed goal in the bathhouse vault's far end (15 units out, past the 12 the room stage
        // forgets on its own) from before the switch was pressed gave the vault up untouched, 0 of its 9 containers
        const game = mainGame();
        const bath = site(game, "bathhouse_01");
        const room = bath.rooms[0];
        const corner = { x: room.bounds.max.x - 1.5, y: room.bounds.max.y - 1.5 };
        expect(v2.distance(corner, room.center)).toBeGreaterThan(12);
        const bot = botAt(game, bath, "expert", 3);
        const mem = bot.bot.brain.mem;
        const broken = () => room.containers.filter((id) => !alive(game, id)).length;
        for (let i = 0; i < 60 * SECOND && broken() < 5; i++) {
            // (the failure is fresh when the vault opens: the switch takes about 3 s)
            if (i < 1.5 * SECOND) {
                mem.failedGoal = v2.copy(corner);
                mem.failedUntil = game.time + 20;
            }
            bot.update();
            game.step();
        }
        expect(mem.puzzle.stage === "room" || mem.puzzle.finished.has(bath.index)).toBe(true);
        expect(broken()).toBeGreaterThanOrEqual(5);
    }, 60_000);
});
