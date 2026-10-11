// Field coverage (M5b): every field present in the obstacle, building and structure defs (and their door, button,
// explosion gate, ceiling, floor, puzzle, child, heal region, stair, layer and interior sound sub-fields) is listed in
// BEHAVIOUR_FIELDS as implemented, handled elsewhere (client, map generation, data) or deferred to a milestone.
import { MapObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { BEHAVIOUR_FIELDS, FIELDS_AWAITING_DEFS } from "../src/index.ts";

/** Every field path present in the map object defs. */
function fieldPaths(): Set<string> {
    const paths = new Set<string>();
    const keys = (prefix: string, obj: object | undefined) => {
        if (obj) for (const k of Object.keys(obj)) paths.add(`${prefix}.${k}`);
    };
    for (const def of Object.values(MapObjectDefs)) {
        if (def.type === "obstacle") {
            keys("obstacle", def);
            keys("obstacle.door", def.door);
            keys("obstacle.button", def.button);
            keys("obstacle.explosionGate", def.explosionGate);
        } else if (def.type === "building") {
            keys("building", def);
            keys("building.ceiling", def.ceiling);
            keys("building.ceiling.destroy", def.ceiling.destroy);
            keys("building.floor", def.floor);
            keys("building.puzzle", def.puzzle);
            for (const child of def.mapObjects) keys("building.mapObjects", child);
            for (const region of def.healRegions ?? []) keys("building.healRegions", region);
        } else if (def.type === "structure") {
            keys("structure", def);
            for (const stair of def.stairs) keys("structure.stairs", stair);
            for (const layer of def.layers) keys("structure.layers", layer);
            keys("structure.interiorSound", def.interiorSound);
        }
    }
    return paths;
}

describe("behaviour field coverage", () => {
    const paths = fieldPaths();

    it("every field of the defs is triaged", () => {
        const missing = [...paths].filter((p) => !(p in BEHAVIOUR_FIELDS)).sort();
        expect(missing).toEqual([]);
    });

    it("the table lists no field the defs do not have", () => {
        const stale = Object.keys(BEHAVIOUR_FIELDS)
            .filter((p) => !paths.has(p) && !FIELDS_AWAITING_DEFS.has(p))
            .sort();
        expect(stale).toEqual([]);
    });

    it("implemented fields name their code and deferred fields their milestone", () => {
        for (const [path, entry] of Object.entries(BEHAVIOUR_FIELDS)) {
            if (entry.status === "implemented") expect([path, entry.where.length > 0]).toEqual([path, true]);
            if (entry.status === "deferred") expect([path, /^M\d+$/.test(entry.milestone)]).toEqual([path, true]);
        }
    });

    it("the M5b behaviour fields are implemented", () => {
        const required = [
            "obstacle.door",
            "obstacle.door.autoOpen",
            "obstacle.door.autoClose",
            "obstacle.door.openOnce",
            "obstacle.door.openOneWay",
            "obstacle.door.openDelay",
            "obstacle.door.slideToOpen",
            "obstacle.door.locked",
            "obstacle.isWindow",
            "obstacle.isWall",
            "obstacle.button.useType",
            "obstacle.damageCeiling",
            "obstacle.regrow",
            "obstacle.smartLoot",
            "obstacle.armorPlated",
            "obstacle.stonePlated",
            "obstacle.explosionGate",
            "obstacle.explosionGate.hitsToOpen",
            "obstacle.explosionGate.explosionTypes",
            "obstacle.destroyType",
            "obstacle.swapWeaponOnDestroy",
            "obstacle.createSmoke",
            "obstacle.teamId",
            "obstacle.isDecalAnchor",
            "building.ceiling.destroy.wallCount",
            "building.puzzle",
            "building.healRegions",
            "building.mapObjects.puzzlePiece",
            "structure.stairs",
            "structure.stairs.downDir",
        ];
        for (const path of required) expect([path, BEHAVIOUR_FIELDS[path]?.status]).toEqual([path, "implemented"]);
    });

    it("lists the deferred fields with their milestones", () => {
        const deferred = Object.entries(BEHAVIOUR_FIELDS)
            .filter(([, e]) => e.status === "deferred")
            .map(([p, e]) => `${p}: ${e.status === "deferred" ? e.milestone : ""}`)
            .sort();
        expect(deferred).toEqual(["obstacle.airdropCrate: M8", "obstacle.isTree: M8", "obstacle.obstacleType: M8"]);
    });
});
