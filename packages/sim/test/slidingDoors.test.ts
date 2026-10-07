// Sliding door geometry (lab doors, tea house, club and bath house secret doors, saloon): opening moves the panel by
// `slideOffset` along its local y axis into the wall pocket, leaving only the panel's last `4 - |slideOffset|` units in
// the doorway, under the def's slot casing; closing puts it back exactly. Checked on the real layouts of a generated
// main map (survev server/src/game/objects/obstacle.ts toggleDoor; client obstacle.ts casingSprite: the casing is drawn
// at closedPos + rotate(casingImg.pos, rot + pi/2), i.e. local y = casingImg.pos.x).
import type { Collider } from "@rebirth/core";
import { MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Obstacle, toggleDoor } from "../src/index.ts";
import { mapGame } from "./buildingHelpers.ts";

type Box = Extract<Collider, { type: 1 }>;

function asBox(c: Collider): Box {
    if (c.type !== 1) throw new Error("door colliders are boxes");
    return c;
}

/** The door's local y axis in world space (ori quarter turns counter-clockwise). */
function axisOf(ori: number): { x: number; y: number } {
    return [
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: 0 },
    ][((ori % 4) + 4) % 4];
}

/** Length of the overlap of two boxes along an axis-aligned unit axis. */
function overlapAlong(a: Box, b: Box, axis: { x: number; y: number }): number {
    return Math.abs(axis.x) > 0.5
        ? Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x))
        : Math.max(0, Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y));
}

/** Share of `box` (sampled on a 0.05 u grid) inside any of `walls`. */
function shareInside(box: Box, walls: Box[]): number {
    const step = 0.05;
    let inside = 0;
    let total = 0;
    for (let x = box.min.x + step / 2; x < box.max.x; x += step) {
        for (let y = box.min.y + step / 2; y < box.max.y; y += step) {
            total++;
            if (walls.some((w) => x >= w.min.x && x <= w.max.x && y >= w.min.y && y <= w.max.y)) inside++;
        }
    }
    return inside / total;
}

describe("sliding door definitions", () => {
    const sliding = Object.entries(MapObjectDefs).filter(
        (e): e is [string, ObstacleDef] => e[1].type === "obstacle" && !!(e[1] as ObstacleDef).door?.slideToOpen,
    );

    it("cover the lab, tea house and secret doors", () => {
        const types = sliding.map(([type]) => type);
        expect(types).toEqual(expect.arrayContaining(["lab_door_01", "lab_door_02", "teahouse_door_01"]));
    });

    it.each(sliding.filter(([, def]) => def.door?.casingImg))("%s ends under its slot casing", (_type, def) => {
        const door = def.door!;
        const col = asBox(def.collision);
        // closed panel local y [min, max]; open = shifted by -slideOffset
        const openCenter = (col.min.y + col.max.y) / 2 - door.slideOffset;
        // the casing is centred at local y = casingImg.pos.x (rotated by rot + pi/2 in the client)
        expect(Math.abs(openCenter - door.casingImg!.pos.x)).toBeLessThanOrEqual(0.5);
    });
});

describe("sliding doors on a generated map", () => {
    // main map, seed 1: the Hydra bunker (lab doors, one-way doors), two more bunkers, the Chrysanthemum bunker, the
    // club, the bath house and a tea house
    const game = mapGame("main", 1);
    const objects = [...game.world.objects.values()];
    const doors = objects.filter((o): o is Obstacle => o.kind === "obstacle" && !!o.door?.slideToOpen);
    const walls = (layer: number): Box[] =>
        objects.flatMap((o) =>
            o.kind === "obstacle" && o.isWall && o.collider.type === 1 && (o.layer & 1) === (layer & 1)
                ? [o.collider]
                : [],
        );

    it("has lab doors to check", () => {
        expect(doors.filter((d) => d.type.startsWith("lab_door")).length).toBeGreaterThanOrEqual(8);
    });

    it("open into the wall pocket, leaving only the panel edge in the doorway, and close back exactly", () => {
        const report: string[] = [];
        for (const door of doors) {
            const state = door.door!;
            if (state.open) continue;
            const closedPos = { ...door.pos };
            const closed = asBox(door.collider);
            const axis = axisOf(door.ori);
            toggleDoor(game, door, null);
            expect(state.open).toBe(true);
            const open = asBox(door.collider);
            const length = overlapAlong(closed, closed, axis);
            // what stays in the doorway: the panel length minus the slide (0.25 u for the lab doors)
            const edge = overlapAlong(open, closed, axis);
            expect(edge).toBeCloseTo(Math.max(0, length - Math.abs(state.slideOffset)), 9);
            expect(edge).toBeLessThanOrEqual(0.25 + 1e-9);
            // the slid panel sits in the walls next to the doorway (the rest pokes out behind thin walls)
            const pocket = shareInside(open, walls(door.originalLayer));
            report.push(`${door.type}#${door.id} ${pocket.toFixed(2)}`);
            expect(pocket, `${door.type}#${door.id} open panel inside walls`).toBeGreaterThanOrEqual(0.7);
            // ...while the closed panel spans an open doorway
            expect(shareInside(closed, walls(door.originalLayer))).toBeLessThanOrEqual(0.3);
            toggleDoor(game, door, null);
            expect(state.open).toBe(false);
            expect(door.pos).toEqual(closedPos);
        }
        expect(report.length).toBeGreaterThanOrEqual(10);
    });
});
