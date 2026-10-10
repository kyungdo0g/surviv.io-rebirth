// The building showcase (rebirth test mode, sim mapgen/showcase.ts): every building and structure the maps spawn at
// the top level gets a map holding only it (and its children), on its home map, with its lake or river where it
// needs one; the result runs as a normal game.
import { getMapObjectDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, generateShowcase, showcaseEntries, showcaseMapOf, showcaseSpawnSpots } from "../src/index.ts";
import { childObstacles, findBuilding } from "./buildingHelpers.ts";

/** ids of an object and everything below it */
function subtree(objects: ReadonlyArray<{ id: number; parentId: number }>, root: number): Set<number> {
    const ids = new Set([root]);
    for (const o of objects) if (ids.has(o.parentId)) ids.add(o.id);
    return ids;
}

describe("building showcase", () => {
    it("lists each spawned building and structure once, with the survev content wave's buildings", () => {
        const entries = showcaseEntries();
        const types = entries.map((e) => e.type);
        expect(new Set(types).size).toBe(types.length);
        for (const e of entries) expect(["building", "structure"]).toContain(getMapObjectDef(e.type).type);
        // the Reserve town, the Workshop, the camps, the Oasis, the Hunting Perch, the Cloud and Cobalt bunkers
        for (const type of [
            "desert_town_02",
            "workshop_complex_01",
            "camp_01",
            "oasis_01",
            "perch_01",
            "bunker_structure_10",
            "bunker_structure_09",
            "river_town_01",
        ]) {
            expect(types).toContain(type);
        }
        expect(showcaseMapOf("oasis_01")).toBe("desert");
        expect(showcaseMapOf("camp_01")).toBe("snow");
        expect(showcaseMapOf("house_red_01")).toBe("main");
        expect(showcaseMapOf("river_town_01")).toBe("faction");
        // the container port's checkpoint and ship, children of warehouse_complex_01, are shown on their own
        for (const type of ["port_checkpoint_01", "cargo_ship_01"]) {
            expect(types).toContain(type);
            expect(showcaseMapOf(type)).toBe(showcaseMapOf("warehouse_complex_01"));
        }
    });

    it("every entry generates a map holding only it, without warnings, and runs as a game", () => {
        for (const e of showcaseEntries()) {
            const show = generateShowcase(e.type);
            const { objects, warnings, mapData } = show.generation;
            expect(warnings, e.type).toEqual([]);
            expect(show.mapName).toBe(e.mapName);
            expect(mapData.mapName).toBe(e.mapName);
            const tops = objects.filter((o) => o.parentId === 0);
            // a river cabin brings its dock
            expect(
                tops.map((o) => o.type).filter((t) => t !== "dock_01"),
                e.type,
            ).toEqual([e.type]);
            const dockIds = tops.filter((o) => o.type === "dock_01").flatMap((o) => [...subtree(objects, o.id)]);
            expect(subtree(objects, show.object.id).size + dockIds.length).toBe(objects.length);
            const game = new Game({ mapName: show.mapName, seed: 1 }, { generation: show.generation, sandbox: true });
            expect(
                showcaseSpawnSpots(show).some((p) => game.canPlayerSpawn(p)),
                e.type,
            ).toBe(true);
            game.step();
        }
    });

    it("is deterministic and gives lake centres their lake and bridges their river", () => {
        const a = generateShowcase("bridge_lg_structure_01", 7);
        const b = generateShowcase("bridge_lg_structure_01", 7);
        expect(JSON.stringify(a.generation.mapData)).toBe(JSON.stringify(b.generation.mapData));
        expect(a.generation.mapData.rivers.filter((r) => !r.looped)).toHaveLength(1);
        const oasis = generateShowcase("oasis_01");
        const lakes = oasis.generation.mapData.rivers.filter((r) => r.looped);
        expect(lakes).toHaveLength(1);
        expect(oasis.generation.terrain.rivers[0].center.x).toBeCloseTo(oasis.object.pos.x, 6);
        expect(generateShowcase("house_red_01").generation.mapData.rivers).toEqual([]);
        // River Town sits on a 20-wide river, like the 50v50 one
        const town = generateShowcase("river_town_01");
        expect(town.generation.mapData.rivers.map((r) => r.width)).toEqual([20]);
    });

    it("the showcased Reserve keeps its vault and puzzle", () => {
        const show = generateShowcase("desert_town_02");
        const game = new Game({ mapName: show.mapName, seed: 1 }, { generation: show.generation, sandbox: true });
        const vault = findBuilding(game, "reserve_vault_01");
        expect(childObstacles(game, vault, "vault_door_reserve")).toHaveLength(1);
        expect(vault.puzzle?.solved).toBe(false);
    });
});
