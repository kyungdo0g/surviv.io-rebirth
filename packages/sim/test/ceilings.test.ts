// Ceilings and walls (M5b): a broken wall takes the doors hinged on it and the broken windows set in it down with it,
// the roof collapses once the def's ceiling.destroy.wallCount walls are broken (doors do not count), a destroyed
// stove damages the roof and stops the chimney smoke, windows break into low walls, zoom regions keep working.
import { v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Building, Game, Obstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer } from "./buildingHelpers.ts";
import { flatGame, openSpot, steps } from "./combatHelpers.ts";

const HIT = { amount: 10_000, damageType: DamageType.Player };

function breakObstacle(game: Game, o: Obstacle): void {
    game.damageObstacle(o, HIT);
    expect(o.dead).toBe(true);
}

/** The door of `building` whose hinge lies on the end of `wall` (0.5 hinge circle, survev). */
function doorOnWall(game: Game, building: Building, wall: Obstacle, doorType: string): Obstacle | undefined {
    return childObstacles(game, building, doorType).find((d) => {
        const c = wall.collider;
        if (c.type !== 1) return false;
        const dx = d.pos.x - Math.min(Math.max(d.pos.x, c.min.x), c.max.x);
        const dy = d.pos.y - Math.min(Math.max(d.pos.y, c.min.y), c.max.y);
        return dx * dx + dy * dy < 0.25;
    });
}

describe("walls", () => {
    it("take the doors hinged on them and the broken windows in them down, not intact windows", () => {
        const probe = flatGame();
        const at = v2.add(openSpot(probe, 30), { x: 10, y: 0 });
        // a destructible shack wall (box +-0.35 x 3.43 around its centre at ori 0) with a door hinged on its top end,
        // a broken window set in it and an intact window further along
        const game = flatGame([
            { type: "shack_wall_side_left", pos: at },
            { type: "house_door_01", pos: v2.add(at, { x: 0, y: 3.5 }) },
            { type: "house_window_broken_01", pos: v2.add(at, { x: 0, y: -1 }) },
            { type: "house_window_01", pos: v2.add(at, { x: 0, y: -10 }) },
        ]);
        const [wall, door, broken, window] = [1, 2, 3, 4].map((id) => game.world.get(id) as Obstacle);
        breakObstacle(game, wall);
        expect(door.dead).toBe(true);
        expect(broken.dead).toBe(true);
        expect(window.dead).toBe(false);
    });

    it("windows break in one hit into a low wall bullets fly over but players cannot cross", () => {
        const probe = flatGame();
        const at = v2.add(openSpot(probe, 30), { x: 10, y: 0 });
        const game = flatGame([{ type: "house_window_01", pos: at }]);
        const window = game.world.get(1) as Obstacle;
        game.damageObstacle(window, { amount: 1, damageType: DamageType.Player });
        expect(window.dead).toBe(true);
        const broken = [...game.world.objects.values()].find((o) => o.type === "house_window_broken_01") as Obstacle;
        expect(broken).toBeDefined();
        expect(broken.pos).toEqual(at);
        expect(broken.blocking).toBe(true);
        expect(broken.height).toBeLessThan(0.25);
        // like survev's genAuto the replacement has no parent building (it never counts as a wall of it)
        expect(broken.parentId).toBe(0);
    });
});

describe("roof collapse", () => {
    it("happens once ceiling.destroy.wallCount walls broke; doors falling with a wall do not count", () => {
        const game = mapGame();
        const greenhouse = findBuilding(game, "greenhouse_01");
        const wallCount = greenhouse.def.ceiling.destroy?.wallCount ?? 0;
        expect(wallCount).toBe(7);
        const walls = childObstacles(game, greenhouse, "glass_wall_10");
        expect(walls.length).toBe(12);
        // a player inside is indoors (zoom regions) and the building is occupied
        const inside = greenhouse.zoomRegions[0].zoomIn!;
        const p = placePlayer(game, v2.mul(v2.add(inside.min, inside.max), 0.5));
        game.step();
        expect(p.indoors).toBe(true);
        expect(greenhouse.occupied).toBe(true);
        // break the walls the doors hang on first
        const hinged = walls.filter((w) => doorOnWall(game, greenhouse, w, "house_door_05"));
        expect(hinged.length).toBe(2);
        const ordered = [...hinged, ...walls.filter((w) => !hinged.includes(w))];
        for (let i = 0; i < wallCount; i++) {
            const door = doorOnWall(game, greenhouse, ordered[i], "house_door_05");
            expect(greenhouse.ceilingDead).toBe(false);
            breakObstacle(game, ordered[i]);
            if (door) expect(door.dead).toBe(true);
        }
        expect(greenhouse.wallsToDestroy).toBe(0);
        expect(greenhouse.ceilingDead).toBe(true);
        expect(greenhouse.toView()).toMatchObject({ ceilingDead: true, ceilingDamaged: false });
        // a dead ceiling no longer makes the player indoors (survev player.ts)
        game.step();
        expect(p.indoors).toBe(false);
        const snap = game.getSnapshot(p.id);
        expect(snap.objects.find((o) => o.id === greenhouse.id)).toMatchObject({ ceilingDead: true });
    });

    it("an explosion breaking the walls collapses the roof too", () => {
        const game = mapGame();
        const shack = findBuilding(game, "shack_01");
        expect(shack.def.ceiling.destroy?.wallCount).toBe(2);
        game.explosions.add("explosion_barrel", shack.pos, 0, { damageType: DamageType.Player });
        for (let i = 0; i < 5 && !shack.ceilingDead; i++) {
            game.explosions.add("explosion_barrel", shack.pos, 0, { damageType: DamageType.Player });
            game.step();
        }
        expect(childObstacles(game, shack).filter((o) => o.isWall && o.dead).length).toBeGreaterThanOrEqual(2);
        expect(shack.ceilingDead).toBe(true);
    });

    it("a destroyed stove damages the cabin roof and stops its occupied emitters for good", () => {
        const game = mapGame();
        const cabin = findBuilding(game, "cabin_01");
        const [stove] = childObstacles(game, cabin, "stove_01");
        expect(stove.def.damageCeiling && stove.def.disableBuildingOccupied).toBe(true);
        breakObstacle(game, stove);
        // the stove explodes as well (explosion_stove) once the explosions resolve
        steps(game, 1);
        expect(cabin.ceilingDamaged).toBe(true);
        expect(cabin.occupiedDisabled).toBe(true);
        expect(cabin.ceilingDead).toBe(false);
        expect(cabin.toView()).toMatchObject({ ceilingDamaged: true, occupiedDisabled: true, ceilingDead: false });
    });
});
