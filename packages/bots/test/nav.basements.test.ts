// Underground navigation (BrainFeatures.basements) on the main map, seed 12345: every structure with walkable stairs
// gets an underground grid and stair portals; a player led by the path follower walks down into bunkers and back up
// (in through one entrance of a multi-entrance bunker, out through another), and narrow doorways (the storm bunker's
// entrance hut, shacks) are passable for the planner.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { emptyInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BRAIN_PRESETS, withFeatures } from "../src/brain/features.ts";
import { PathFollower } from "../src/nav/follower.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { UndergroundNav } from "../src/nav/underground.ts";
import { installPerception } from "../src/perception/install.ts";
import { WorldModel } from "../src/perception/world.ts";
import { cachedMap, mainGame } from "./helpers.ts";

const gen = cachedMap("main", 12345);
const ground = NavGrid.forMap(gen.mapData);
const ug = UndergroundNav.forMap(gen.mapData, ground);
const mainComp = ground.component(ground.nearestWalkable({ x: 360, y: 360 }, 30));
const DIRS: readonly Vec2[] = Array.from({ length: 8 }, (_, k) => ({
    x: Math.cos((k * Math.PI) / 4),
    y: Math.sin((k * Math.PI) / 4),
}));

function region(type: string) {
    const r = ug.regions.find((x) => x.type === type);
    if (!r) throw new Error(`no ${type}`);
    return r;
}

/** An underground floor cell about `cost` units of walking from the portal's bottom. */
function floorPoint(type: string, portal: number, cost: number): Vec2 {
    const r = region(type);
    const p = r.portals[portal];
    let best: Vec2 = p.bottom as Vec2;
    let err = Number.POSITIVE_INFINITY;
    for (let i = 0; i < r.w * r.h; i++) {
        if (!r.walkable(i)) continue;
        const c = r.center(i);
        const e = Math.abs(r.costToPortal(p, c) - cost);
        if (e < err) {
            err = e;
            best = c;
        }
    }
    return best;
}

/** A player in a real game led by a PathFollower over a model with underground navigation installed. */
function walker(start: Vec2) {
    const game = mainGame();
    const id = game.addPlayer("walker");
    game.teleportPlayer(id, start);
    const player = game.getPlayer(id)!;
    const model = new WorldModel(game.mapData);
    installPerception(model, withFeatures(BRAIN_PRESETS.baseline, ["basements"]));
    const follower = new PathFollower(createRng(5));
    let err = { x: 0, y: 0 };
    let dir: Vec2 | null = null;
    let actions: number[] = [];
    let failed = false;
    /** Ticks until the player stands within 1.5 of `goal` on `layer`, or -1. */
    const walkTo = (goal: Vec2, layer: number, maxTicks: number): number => {
        for (let t = 0; t < maxTicks; t++) {
            if (game.tick % 3 === 0) {
                model.observe(game.getSnapshot(id));
                const r = follower.steer(model, goal, model.time, 1, layer);
                dir = r.dir;
                if (r.openDoor) actions.push(Input.Use);
                failed ||= r.failed;
            }
            // 8-way keys whose average follows the direction (like Bot.keys)
            const input = emptyInput(game.tick & 0xff);
            if (dir) {
                err = v2.add(err, dir);
                let best = 0;
                for (let k = 1; k < 8; k++) if (v2.dot(err, DIRS[k]) > v2.dot(err, DIRS[best])) best = k;
                err = v2.sub(err, DIRS[best]);
                input.moveRight = DIRS[best].x > 0.3;
                input.moveLeft = DIRS[best].x < -0.3;
                input.moveUp = DIRS[best].y > 0.3;
                input.moveDown = DIRS[best].y < -0.3;
            }
            input.actions = actions;
            actions = [];
            game.setInput(id, input);
            game.step();
            if (player.layer === layer && v2.distance(player.pos, goal) < 1.5) return t + 1;
        }
        return -1;
    };
    return { game, player, model, follower, walkTo, failed: () => failed };
}

describe("underground navigation", () => {
    it("builds an underground grid with stair portals for every structure with walkable stairs", () => {
        const types = ug.regions.map((r) => r.type).sort();
        expect(types).toEqual([
            "barn_basement_structure_01",
            "bunker_structure_02",
            "bunker_structure_03",
            "bunker_structure_04",
            "bunker_structure_05",
            "bunker_structure_08",
            "club_structure_01",
            // the mansion's cellar: on the rebirth's bigger main map the random rotation spawns all of mansion, police
            // and bank (packages/defs rebirth/mapScale.ts, choose 3)
            "mansion_structure_01",
            // the military base's basement: five stairs (packages/defs rebirth/buildings/military)
            "military_base_01",
        ]);
        // bridges only have loot stairs
        expect(gen.mapData.objects.some((o) => o.type.startsWith("bridge_"))).toBe(true);
        // two per structure (the mansion cellar's two stairs among them), five for the military base
        expect(ug.portals).toHaveLength(21);
        for (const p of ug.portals) {
            // every portal leads from the main ground area to its underground floor
            expect(p.top && p.bottom).toBeTruthy();
            expect(ground.component(ground.cellOf(p.top as Vec2))).toBe(mainComp);
            expect(p.region.walkableAt(p.bottom as Vec2)).toBe(true);
            expect(ug.handles(p.center, 2)).toBe(true);
            expect(ug.handles(p.bottom as Vec2, 1)).toBe(true);
            expect(ug.handles(p.top as Vec2, 0)).toBe(false);
        }
        // the hydra bunker: its second and third stairs lead in through one-way automatic doors (lab_door_02 opens only
        // for players on one side), so from them the main hall and the first stair can be reached, but not back
        const hydra = region("bunker_structure_02");
        const [h0, h1, h2] = hydra.portals;
        expect(hydra.costToPortal(h1, h0.bottom as Vec2)).toBeLessThan(150);
        expect(hydra.costToPortal(h2, h0.bottom as Vec2)).toBeLessThan(150);
        expect(hydra.costToPortal(h0, h1.bottom as Vec2, true)).toBeLessThan(150);
        expect(hydra.costToPortal(h0, h1.bottom as Vec2)).toBe(Number.POSITIVE_INFINITY);
        expect(hydra.costToPortal(h0, h2.bottom as Vec2)).toBe(Number.POSITIVE_INFINITY);
        const deep = floorPoint("bunker_structure_08", 0, 25);
        const outside = ground.center(ground.nearestWalkable({ x: 160, y: 540 }, 8, mainComp));
        expect(ug.canPathTo(ground, outside, 0, deep, 1)).toBe(true);
        expect(ug.canPathTo(ground, deep, 1, outside, 0)).toBe(true);
        expect(ug.canPathTo(ground, deep, 1, floorPoint("bunker_structure_02", 0, 20), 1)).toBe(true);
        // a ground point is no underground goal
        expect(ug.canPathTo(ground, outside, 0, { x: 360, y: 360 }, 1)).toBe(false);
    });

    it("walks down into a bunker and back out", () => {
        const p = region("bunker_structure_08").portals[0];
        const start = ground.center(ground.nearestWalkable(v2.sub(p.top as Vec2, v2.mul(p.down, 10)), 6, mainComp));
        const goal = floorPoint("bunker_structure_08", 0, 25);
        const w = walker(start);
        const down = w.walkTo(goal, 1, 3000);
        expect(down).toBeGreaterThan(0);
        expect(w.player.layer).toBe(1);
        const up = w.walkTo(start, 0, 3000);
        expect(up).toBeGreaterThan(0);
        expect(w.player.layer).toBe(0);
        expect(w.failed()).toBe(false);
        expect(w.follower.stuckEvents).toBeLessThanOrEqual(1);
    });

    it("enters a multi-entrance bunker through one stair and leaves through the nearest other one", () => {
        const hydra = region("bunker_structure_02");
        const [b, a] = hydra.portals;
        // in through the second stair (its one-way door lets players into the main hall), to a goal by the first
        // stair, then up to the ground just outside the first stair
        const start = ground.center(ground.nearestWalkable(v2.sub(a.top as Vec2, v2.mul(a.down, 8)), 6, mainComp));
        const goal = floorPoint("bunker_structure_02", 0, 6);
        const exit = ground.center(ground.nearestWalkable(v2.sub(b.top as Vec2, v2.mul(b.down, 6)), 6, mainComp));
        const w = walker(start);
        expect(w.walkTo(goal, 1, 4000)).toBeGreaterThan(0);
        const up = w.walkTo(exit, 0, 3000);
        expect(up).toBeGreaterThan(0);
        // the way out was the near stair: far shorter than walking back through the bunker and around on the ground
        expect(up).toBeLessThan(400);
        expect(w.failed()).toBe(false);
    });

    it("plans through narrow doorways: the storm bunker's entrance hut, a shack's door", () => {
        const storm = region("bunker_structure_03").portals[0];
        const top = storm.top as Vec2;
        expect(ground.component(ground.cellOf(top))).toBe(mainComp);
        // the hut's door is 2.9 units wide: no cell centre is a full clearance from both jambs, its cells (within 3
        // cells of the stair top, inside the hut) are tight
        let tight = 0;
        const c = ground.cellOf(top);
        const [cx, cy] = [c % ground.w, Math.floor(c / ground.w)];
        for (let y = cy - 3; y <= cy + 3; y++) {
            for (let x = cx - 3; x <= cx + 3; x++) tight += ground.tight[y * ground.w + x];
        }
        expect(tight).toBeGreaterThan(0);
        // a shack of another seed (found by type: map generation changes move the objects)
        const g1000 = cachedMap("main", 1000);
        const grid = new NavGrid(g1000.mapData);
        const shack = g1000.objects.find((o) => o.type === "shack_01")!;
        const inside = grid.center(grid.nearestWalkable(shack.pos, 3));
        const centre = grid.center(grid.nearestWalkable({ x: 360, y: 360 }, 30));
        expect(grid.reachable(centre, inside)).toBe(true);
    });
});
