// The radar base (packages/defs rebirth/buildings/radar/, the owner's wave 3, 2026-10-10; docs/research/rebirth-deviations.md
// "The radar base") in the simulation: the crypto vault opens on its duty code only, its sliding door slides into a
// wall, the dome tower gives the 8x scope's view, the generator shed's power boxes and drums set each other off, and
// the antenna masts and the radar's pedestal never break.
import { type Collider, collider, type Vec2, v2 } from "@rebirth/core";
import {
    DamageType,
    getMapObjectDef,
    getMapObjectDefOfType,
    RADAR_CODE,
    RADAR_DOME_CENTRE,
    RADAR_DOME_ZOOM,
    RADAR_VAULT_DOOR,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri, transformOri } from "../src/geom/transform.ts";
import { interactObstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds } from "./buildingHelpers.ts";

/** A compound-local point in world space. */
const at = (b: { pos: Vec2; ori: number }, x: number, y: number) => v2.add(b.pos, rotateOri({ x, y }, b.ori));

describe("the radar base", () => {
    it("opens the crypto vault on the duty code only (blue, yellow, red)", () => {
        const game = mapGame("faction", 7);
        const ops = findBuilding(game, "radar_ops_01");
        const switches = childObstacles(game, ops, "switch_03").filter((o) => o.puzzlePiece);
        const doors = childObstacles(game, ops, RADAR_VAULT_DOOR.type);
        expect([switches.length, doors.length]).toEqual([RADAR_CODE.length, 1]);
        const piece = (label: string) => switches.find((o) => o.puzzlePiece === label)!;
        const p = placePlayer(game, piece(RADAR_CODE[0]).pos);
        // the door ignores Interact
        interactObstacle(game, doors[0], p);
        stepSeconds(game, 0.5);
        expect(doors[0].door!.open).toBe(false);
        // the code backwards: an error, the switches reset, the vault stays shut
        for (const label of [...RADAR_CODE].reverse()) interactObstacle(game, piece(label), p);
        stepSeconds(game, 3);
        expect(doors[0].door!.open).toBe(false);
        expect(switches.every((o) => o.button!.canUse && !o.button!.onOff)).toBe(true);
        for (const label of RADAR_CODE) interactObstacle(game, piece(label), p);
        stepSeconds(game, 2.5);
        expect(doors[0].door!.open).toBe(true);
    });

    it("slides the vault door into the vault's wall", () => {
        const def = getMapObjectDefOfType("building", "radar_ops_01");
        const walls: Array<{ min: Vec2; max: Vec2 }> = [];
        let door: Collider | undefined;
        for (const c of def.mapObjects) {
            if (typeof c.type !== "string") continue;
            const d = getMapObjectDef(c.type);
            if (d.type !== "obstacle") continue;
            if (/_wall_ext_/.test(c.type)) walls.push(collider.toAabb(transformOri(d.collision, c.pos, c.ori, 1)));
            if (d.door?.slideToOpen) {
                const slid = v2.add(c.pos, rotateOri({ x: 0, y: -d.door.slideOffset }, c.ori));
                door = transformOri(d.collision, slid, c.ori, 1);
            }
        }
        expect(door).toBeDefined();
        const box = collider.toAabb(door!);
        let n = 0;
        let inside = 0;
        for (let x = box.min.x + 0.025; x < box.max.x; x += 0.05) {
            for (let y = box.min.y + 0.025; y < box.max.y; y += 0.05) {
                n++;
                if (walls.some((w) => x >= w.min.x && x <= w.max.x && y >= w.min.y && y <= w.max.y)) inside++;
            }
        }
        expect(inside / n).toBeGreaterThanOrEqual(0.93);
    });

    it("gives the 8x scope's view in the dome tower and the indoor view in the operations building", () => {
        const game = mapGame("faction", 7);
        const base = findBuilding(game, "radar_base_01");
        const p = placePlayer(game, at(base, RADAR_DOME_CENTRE.x, RADAR_DOME_CENTRE.y - 6));
        stepSeconds(game, 0.2);
        expect(p.zoom).toBe(RADAR_DOME_ZOOM);
        game.teleportPlayer(p.id, at(base, 24, 20), 0);
        stepSeconds(game, 0.2);
        expect(p.zoom).toBeLessThan(RADAR_DOME_ZOOM);
    });

    it("sets off the generator shed's whole row from either end", () => {
        for (const trigger of ["power_box_01", "barrel_01"]) {
            const game = mapGame("faction", 7);
            const shed = findBuilding(game, "radar_generator_01");
            const row = ["power_box_01", "propane_01", "barrel_01"].flatMap((type) => childObstacles(game, shed, type));
            expect(row.length).toBe(5);
            game.damageObstacle(childObstacles(game, shed, trigger)[0], { amount: 1e4, damageType: DamageType.Player });
            stepSeconds(game, 2);
            expect([trigger, row.filter((o) => !o.dead).map((o) => o.type)]).toEqual([trigger, []]);
        }
    });

    it("keeps the antenna masts and the radar's pedestal standing", () => {
        const game = mapGame("faction", 7);
        const base = findBuilding(game, "radar_base_01");
        const dome = findBuilding(game, "radar_dome_01");
        const steel = [
            ...childObstacles(game, base, "metal_wall_ext_2x2"),
            ...childObstacles(game, dome, "metal_wall_ext_2x2"),
        ];
        expect(steel.length).toBe(5);
        for (const o of steel) game.damageObstacle(o, { amount: 1e6, damageType: DamageType.Player });
        stepSeconds(game, 0.2);
        expect(steel.every((o) => !o.dead)).toBe(true);
    });
});
