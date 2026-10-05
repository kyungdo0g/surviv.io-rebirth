import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import {
    emptyInput,
    Game,
    type Obstacle,
    SNAPSHOT_EVERY_TICKS,
    TICK_HZ,
    VIEW_ASPECT,
    VIEW_MARGIN,
    viewBounds,
} from "../src/index.ts";

function newGame(): Game {
    return new Game({ mapName: "main", seed: 12345 });
}

describe("snapshots", () => {
    it("exposes the contract constants", () => {
        expect(TICK_HZ).toBe(100);
        expect(SNAPSHOT_EVERY_TICKS).toBe(3);
        const b = viewBounds({ x: 100, y: 100 }, 28);
        expect(b.max.x - 100).toBe(28 + VIEW_MARGIN);
        expect(b.max.y - 100).toBeCloseTo(28 / VIEW_ASPECT + VIEW_MARGIN, 9);
    });

    it("includes the local player and the map objects around it", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        // stand next to a house so buildings, walls and props are in view
        const house = game.mapData.objects.find((o) => o.type === "house_red_01")!;
        game.teleportPlayer(id, { x: house.pos.x, y: house.pos.y - 20 });
        const snap = game.getSnapshot(id);
        expect(snap.localPlayerId).toBe(id);
        expect(snap.deletedIds).toEqual([]);
        const ids = new Set(snap.objects.map((o) => o.id));
        expect(ids.has(id)).toBe(true);
        expect(ids.has(house.id)).toBe(true);
        const p = game.getPlayer(id)!;
        // every map object positioned within 10 units of the player is sent
        for (const o of game.mapData.objects) {
            if (v2.distance(o.pos, p.pos) < 10) expect(ids.has(o.id)).toBe(true);
        }
        // nothing far outside the view is sent
        for (const view of snap.objects) {
            const entity = game.world.get(view.id)!;
            const b = viewBounds(p.pos, p.zoom);
            const eb = entity.bounds;
            expect(eb.min.x <= b.max.x && eb.max.x >= b.min.x && eb.min.y <= b.max.y && eb.max.y >= b.min.y).toBe(true);
        }
        expect(snap.objects.some((o) => o.kind === "obstacle")).toBe(true);
        expect(snap.local.zoom).toBe(28);
        expect(snap.local.weapons[snap.local.curWeapIdx].type).toBe("fists");
    });

    it("reports deletedIds after the player moves far away", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        const first = game.getSnapshot(id);
        const before = new Set(first.objects.map((o) => o.id));
        expect(before.size).toBeGreaterThan(1);
        const p = game.getPlayer(id)!;
        const far = { x: game.mapData.width - p.pos.x, y: game.mapData.height - p.pos.y };
        game.teleportPlayer(id, far);
        game.step();
        const second = game.getSnapshot(id);
        const after = new Set(second.objects.map((o) => o.id));
        const expectedDeleted = [...before].filter((x) => !after.has(x)).sort((a, b) => a - b);
        expect(expectedDeleted.length).toBeGreaterThan(0);
        expect(second.deletedIds).toEqual(expectedDeleted);
        expect(second.deletedIds.includes(id)).toBe(false);
        // nothing new to delete when standing still
        expect(game.getSnapshot(id).deletedIds).toEqual([]);
    });

    it("reports walking out of view and removed players", () => {
        const game = newGame();
        const a = game.addPlayer("a");
        const b = game.addPlayer("b");
        const pa = game.getPlayer(a)!;
        game.teleportPlayer(b, { x: pa.pos.x + 5, y: pa.pos.y });
        expect(game.getSnapshot(a).objects.some((o) => o.id === b && o.kind === "player")).toBe(true);
        game.removePlayer(b);
        expect(game.getSnapshot(a).deletedIds).toContain(b);
        expect(game.getPlayer(b)).toBeUndefined();
    });

    it("reflects dynamic changes of static objects", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        const p = game.getPlayer(id)!;
        const tree = game.mapData.objects.find((o) => o.type === "tree_01")!;
        game.teleportPlayer(id, { x: tree.pos.x, y: tree.pos.y - 8 });
        const view0 = game.getSnapshot(id).objects.find((o) => o.id === tree.id);
        expect(view0).toMatchObject({ kind: "obstacle", healthT: 1, dead: false, scale: tree.scale });
        (game.world.get(tree.id) as Obstacle).damage(1e6);
        const view1 = game.getSnapshot(id).objects.find((o) => o.id === tree.id);
        expect(view1).toMatchObject({ kind: "obstacle", healthT: 0, dead: true });
        expect(p.pos.y).toBeCloseTo(tree.pos.y - 8, 9);
    });

    it("advances tick and time by fixed steps", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        game.setInput(id, { ...emptyInput(), moveUp: true });
        for (let i = 0; i < 30; i++) game.step();
        const snap = game.getSnapshot(id);
        expect(snap.tick).toBe(30);
        expect(game.tick).toBe(30);
        expect(snap.time).toBeCloseTo(0.3, 12);
    });

    it("is deterministic for the same inputs", () => {
        const run = () => {
            const game = newGame();
            const a = game.addPlayer("a");
            const b = game.addPlayer("b");
            for (let i = 0; i < 300; i++) {
                game.setInput(a, { ...emptyInput(i), moveRight: i % 50 < 30, moveUp: i % 70 < 20 });
                game.setInput(b, { ...emptyInput(i), moveLeft: i % 40 < 25, moveDown: true });
                game.step();
            }
            return [game.getSnapshot(a), game.getSnapshot(b)];
        };
        expect(run()).toEqual(run());
    });
});
