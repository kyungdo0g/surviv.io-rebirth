// Doors (BrainFeatures.doors), opening: a bot walks through a closed hinged house door and a closed sliding teahouse
// door to a goal behind it on the real main map, opening each on the way without walking into the closed panel; the
// path follower's door rule with the feature (a door used on the way out of one room no longer holds the next one shut,
// a door across the leg after a close bend counts) and without it (unchanged); a door only a switch or a puzzle opens,
// or a locked one, is never used. The flag is on in the smart preset and off in the baseline, where no door brain
// exists. Plus the door geometry the closing relies on: the doorway, the leaf's sweep, Use's reach.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { closeChance } from "../src/brain/doorClose.ts";
import { DoorBrain } from "../src/brain/doors.ts";
import { BRAIN_PRESETS, type BrainName } from "../src/brain/features.ts";
import { BotController } from "../src/controller.ts";
import { distanceToCollider, obstacleCollider, obstacleDef } from "../src/geom.ts";
import {
    clearOfSweep,
    doorMiddle,
    doorShape,
    inDoorway,
    reaches,
    sideOf,
    sweepLines,
    useReach,
} from "../src/nav/doorGeom.ts";
import { PathFollower } from "../src/nav/follower.ts";
import { NavGrid } from "../src/nav/grid.ts";
import type { SeenObstacle } from "../src/perception/world.ts";
import { NEUTRAL, PERSONAS } from "../src/persona.ts";
import { brainOf, testWorld } from "./brain-world.ts";
import { seenDoor } from "./doorWorld.ts";
import { cachedMap, firstOfType, mainGame, placePlayer, runUntil } from "./helpers.ts";

const gen = cachedMap("main", 12345);
const grid = NavGrid.forMap(gen.mapData);
const walkable = (p: Vec2): Vec2 => grid.center(grid.nearestWalkable(p, 8));

/** Walks a bot of `brain` from `start` to `goal` through door `doorId`: ticks, stuck events, ticks pressed against it. */
function walkThrough(doorId: number, start: Vec2, goal: Vec2, brain: BrainName, seed = 7) {
    const game = mainGame();
    const p = placePlayer(game, "bot", start);
    const bot = new BotController(game, p.id, { seed, brain });
    bot.bot.setOrder({ type: "goto", pos: goal, arriveDist: 1 });
    let pressed = 0;
    const ticks = runUntil(
        game,
        [bot],
        () => {
            const o = game.world.get(doorId);
            if (o?.kind === "obstacle" && o.door && !o.door.open) {
                const def = obstacleDef(o.type)!;
                if (distanceToCollider(p.pos, obstacleCollider(def, o.pos, o.ori, o.scale)) < 1.1) pressed++;
            }
            return v2.distance(p.pos, goal) < 1.5;
        },
        2500,
    );
    const o = game.world.get(doorId);
    const door = o?.kind === "obstacle" ? o : null;
    return { ticks, stuck: bot.bot.follower.stuckEvents, pressed, door };
}

/** A door of `building` (the first of `type`), and a walkable spot `out` units out of it and `inside` units in. */
function doorWay(buildingType: string, doorType: string, out: number, inside: number) {
    const b = firstOfType(gen, buildingType, buildingType === "house_red_02" ? 0 : undefined);
    const d = gen.objects.find(
        (o) => o.parentId === b.id && o.type === doorType && (doorType !== "house_door_01" || o.ori === 1),
    );
    if (!d) throw new Error(`no ${doorType} in ${buildingType}`);
    const def = obstacleDef(d.type)!;
    const shape = doorShape(d.id, def, d.pos, d.ori, d.scale)!;
    const mid = doorMiddle(shape);
    // the outer side: the one farther from the building's centre
    const outward = sideOf(shape, b.pos) > 0 ? -1 : 1;
    const start = walkable(v2.add(mid, v2.mul(shape.normal, outward * out)));
    const goal = walkable(v2.sub(mid, v2.mul(shape.normal, outward * inside)));
    return { id: d.id, start, goal, closedPos: v2.copy(d.pos) };
}

describe("doors: opening on the way", () => {
    it("opens and passes a closed hinged house door without walking into it", () => {
        const w = doorWay("house_red_02", "house_door_01", 5, 6);
        const run = walkThrough(w.id, w.start, w.goal, "smart");
        expect(run.ticks).toBeGreaterThan(0);
        expect(run.ticks).toBeLessThan(400);
        expect(run.door?.door?.open).toBe(true);
        expect(run.pressed).toBe(0);
        expect(run.stuck).toBe(0);
    });

    it("opens and passes a closed sliding teahouse door", () => {
        const w = doorWay("teahouse_01", "teahouse_door_01", 5, 5);
        const run = walkThrough(w.id, w.start, w.goal, "smart");
        expect(run.ticks).toBeGreaterThan(0);
        expect(run.ticks).toBeLessThan(400);
        // slid open: the panel moved off the doorway
        expect(run.door?.door?.open).toBe(true);
        expect(v2.distance(run.door!.pos, w.closedPos)).toBeGreaterThan(3);
        expect(run.pressed).toBe(0);
        expect(run.stuck).toBe(0);
    });

    it("the follower's door rule: per-door retry and the next leg with the feature, the old rule without", () => {
        const w = testWorld();
        const s = w.spot;
        const a = seenDoor(9001, "house_door_01", v2.add(s, { x: 2, y: -2 }), 0);
        const b = seenDoor(9002, "house_door_01", v2.add(s, { x: 8, y: -2 }), 0);
        const c = seenDoor(9003, "house_door_01", v2.add(s, { x: 2.5, y: 1.6 }), 1);
        type Rule = { doorToOpen(m: unknown, pos: Vec2, wp: Vec2, now: number, next?: Vec2): number };
        const uses: number[] = [];
        const sense = new PathFollower(createRng(1), { noteUse: (t) => uses.push(t) }) as unknown as Rule;
        const plain = new PathFollower(createRng(1)) as unknown as Rule;
        const at = (obs: SeenObstacle[], pos: Vec2) => {
            w.model.obstacles = obs;
            w.model.self.pos = v2.copy(pos);
        };
        for (const f of [sense, plain]) {
            // the first door, in reach and on the way
            at([a, b], v2.add(s, { x: 0.6, y: 0 }));
            expect(f.doorToOpen(w.model, w.model.self.pos, v2.add(s, { x: 6, y: 0 }), 10)).toBe(a.view.id);
        }
        // 0.3 s later the next door: the old rule waits 0.7 s after any door, the new one only for the same door
        at([a, b], v2.add(s, { x: 6.6, y: 0 }));
        const wp = v2.add(s, { x: 12, y: 0 });
        expect(plain.doorToOpen(w.model, w.model.self.pos, wp, 10.3)).toBe(0);
        expect(sense.doorToOpen(w.model, w.model.self.pos, wp, 10.3)).toBe(b.view.id);
        expect(uses).toEqual([10, 10.3]);
        // a door across the leg after a close bend (the straight ray misses it)
        at([c], s);
        const bend = v2.add(s, { x: 1.5, y: 0 });
        const next = v2.add(s, { x: 1.5, y: 5 });
        expect(plain.doorToOpen(w.model, s, bend, 20, next)).toBe(0);
        expect(sense.doorToOpen(w.model, s, bend, 20, next)).toBe(c.view.id);
    });

    it("holds Use back while an open door stands within the sim's reach plus a margin (it would shut it too)", () => {
        // (review of the interactions: a bot opening a house door shut the open one beside it, 1.70 away against the
        // sim's reach of 1.75, on four allies; the old hold-back stopped at 1.60)
        const w = testWorld();
        const s = w.spot;
        const pos = v2.add(s, { x: 0.6, y: 0 });
        const wp = v2.add(s, { x: 6, y: 0 });
        const closed = seenDoor(9201, "house_door_01", v2.add(s, { x: 2, y: -2 }), 0);
        type Rule = { doorToOpen(m: unknown, pos: Vec2, wp: Vec2, now: number): number };
        const reach = useReach(closed.def);
        expect(reach).toBe(1.75);
        // an open door beside the way, its panel `gap` from the bot (house_door_01: 0.6 wide, 4 long)
        const openAt = (gap: number) =>
            seenDoor(9202, "house_door_01", v2.add(pos, { x: -gap - 0.3, y: -2 }), 0, { open: true });
        for (const [gap, use] of [
            [1.55, false],
            [1.7, false],
            [reach + 0.25, false],
            [reach + 0.4, true],
        ] as const) {
            const other = openAt(gap);
            expect(distanceToCollider(pos, other.col)).toBeCloseTo(gap, 6);
            w.model.obstacles = [closed, other];
            w.model.self.pos = v2.copy(pos);
            const f = new PathFollower(createRng(1), { noteUse: () => {} }) as unknown as Rule;
            expect(f.doorToOpen(w.model, pos, wp, 10), `open door ${gap} away`).toBe(use ? closed.view.id : 0);
        }
        // the baseline's rule is untouched (it holds back within its reach less the slack only)
        const plain = new PathFollower(createRng(1)) as unknown as Rule;
        w.model.obstacles = [closed, openAt(1.7)];
        expect(plain.doorToOpen(w.model, pos, wp, 10)).toBe(closed.view.id);
    });

    it("never uses a door that only a switch, a puzzle or a scheduled unlock opens", () => {
        const w = testWorld();
        const s = w.spot;
        const pos = v2.add(s, { x: 0.6, y: 0 });
        const wp = v2.add(s, { x: 6, y: 0 });
        for (const type of ["secret_door_club", "cell_door_01", "lab_door_locked_01"]) {
            const d = seenDoor(9100, type, v2.add(s, { x: 2, y: -2 }), 0);
            expect(d.def.door!.canUse && !d.def.door!.locked).toBe(false);
            w.model.obstacles = [d];
            w.model.self.pos = pos;
            const f = new PathFollower(createRng(1), { noteUse: () => {} }) as unknown as {
                doorToOpen(m: unknown, p: Vec2, wp: Vec2, now: number): number;
            };
            expect(f.doorToOpen(w.model, pos, wp, 10)).toBe(0);
        }
    });

    it("is a smart feature: on in the smart preset, off in the baseline, where no door brain exists", () => {
        expect(BRAIN_PRESETS.smart.doors).toBe(true);
        expect(BRAIN_PRESETS.baseline.doors).toBe(false);
        const w = testWorld();
        expect(brainOf(w, []).doors).toBeNull();
        expect(brainOf(w, ["doors"]).doors).toBeInstanceOf(DoorBrain);
        const game = mainGame();
        const spot = walkable({ x: gen.mapData.width / 2, y: gen.mapData.height / 2 });
        const base = new BotController(game, placePlayer(game, "b", spot).id, { seed: 2, brain: "baseline" });
        const smart = new BotController(game, placePlayer(game, "s", v2.add(spot, { x: 30, y: 0 })).id, { seed: 2 });
        expect(base.bot.brain.doors).toBeNull();
        expect(smart.bot.brain.doors).toBeInstanceOf(DoorBrain);
    });
});

describe("doors: geometry", () => {
    // a house door closed along -x from its hinge (ori 1), opened from its +y side: it turns to ori 2 (along -y)
    const def = obstacleDef("house_door_01")!;
    const hinge = { x: 100, y: 100 };
    const shape = doorShape(1, def, hinge, 1, 1)!;

    it("knows the doorway, the sides and Use's reach", () => {
        expect(shape.along).toEqual({ x: -1, y: 0 });
        expect(shape.normal).toEqual({ x: -0, y: 1 });
        expect(doorMiddle(shape)).toEqual({ x: 98, y: 100 });
        expect(inDoorway(shape, { x: 98, y: 100.8 })).toBe(true);
        expect(inDoorway(shape, { x: 98, y: 102.5 })).toBe(false);
        expect(inDoorway(shape, { x: 104, y: 100 })).toBe(false);
        expect(Math.sign(sideOf(shape, { x: 98, y: 103 }))).toBe(1);
        expect(useReach(def)).toBeCloseTo(1.75);
        expect(reaches(def, shape.closedCol, { x: 98, y: 101.6 }, 0)).toBe(true);
        expect(reaches(def, shape.closedCol, { x: 98, y: 102.2 }, 0)).toBe(false);
    });

    it("sweeps the hinged leaf's quarter turn back to closed, and a sliding door's span", () => {
        const lines = sweepLines(shape, hinge, 2);
        expect(lines.length).toBe(9);
        // from the open leaf (along -y) to the closed one (along -x)
        expect(v2.distance(lines[0].b, { x: 100, y: 96 })).toBeLessThan(1e-9);
        expect(v2.distance(lines[8].b, { x: 96, y: 100 })).toBeLessThan(1e-9);
        // inside the quarter disc the leaf passes over the body; past the hinge it does not
        expect(clearOfSweep(shape, lines, { x: 98, y: 97.5 }, 1.2)).toBe(false);
        expect(clearOfSweep(shape, lines, { x: 101.6, y: 97 }, 1.2)).toBe(true);
        // a closed door sweeps nothing but itself
        expect(sweepLines(shape, hinge, 1).length).toBe(1);
        const tea = obstacleDef("teahouse_door_01")!;
        const slide = doorShape(2, tea, hinge, 1, 1)!;
        const open = v2.add(hinge, { x: 3.75, y: 0 });
        const span = sweepLines(slide, open, 1);
        expect(span.length).toBe(1);
        const xs = [span[0].a.x, span[0].b.x].sort((p, q) => p - q);
        expect(xs[0]).toBeCloseTo(96);
        expect(xs[1]).toBeCloseTo(103.75);
    });

    it("closes more often with game sense and caution, and more to heal or hold than to loot", () => {
        const beginner = { tier: "beginner" as const, s: 0.15, g: 0.15 };
        const mid = { tier: "intermediate" as const, s: 0.5, g: 0.5 };
        const expert = { tier: "expert" as const, s: 0.85, g: 0.85 };
        const rusher = closeChance(beginner, PERSONAS.rusher, "loot");
        const neutral = closeChance(mid, NEUTRAL, "loot");
        const camper = closeChance(expert, PERSONAS.camper, "loot");
        expect(rusher).toBeLessThan(neutral);
        expect(neutral).toBeLessThan(closeChance(expert, NEUTRAL, "loot"));
        expect(closeChance(expert, NEUTRAL, "loot")).toBeLessThan(camper);
        expect(closeChance(mid, NEUTRAL, "heal")).toBeGreaterThan(neutral);
        expect(closeChance(mid, NEUTRAL, "hold")).toBeGreaterThan(neutral);
        for (const p of [rusher, neutral, camper]) {
            expect(p).toBeGreaterThanOrEqual(0.03);
            expect(p).toBeLessThanOrEqual(0.95);
        }
    });
});
