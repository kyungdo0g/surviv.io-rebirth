// The rebirth buildings (packages/defs rebirth/buildings.ts, the owner's requests 2026-10-08): the clinic, fire station,
// library and radio station on the normal map; the faction command posts, the arsenal and the blockhouses on 50v50.
// Their layouts are checked as built (furniture clear of the walls and of each other, doors, windows and loopholes in
// wall gaps), the clinic's treatment rooms heal, each command post stands on its faction's side with its faction's
// crate. The second wave's mechanics are in rebirthBuildingsWave2.test.ts.
import { type Collider, collider, type Vec2, v2 } from "@rebirth/core";
import {
    CLINIC_HEAL_RATE,
    getMapObjectDef,
    getMapObjectDefOfType,
    MILITARY_BASE_BUILDINGS,
    OUTPOST_FACTIONS,
    REBIRTH_BUILDING_SPAWNS,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { toBounds, transformOri } from "../src/geom/transform.ts";
import { Game } from "../src/index.ts";
import { steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

const BUILDINGS = [
    "clinic_01",
    "outpost_01r",
    "outpost_01b",
    "firestation_01",
    "library_01",
    "radio_station_01",
    "arsenal_01",
    "blockhouse_01r",
    "blockhouse_01b",
    // the military bases' buildings (their structures are checked in militaryBase.test.ts)
    ...MILITARY_BASE_BUILDINGS,
];
/** Walls a building has at least: more than 8, but the military base's small parts have fewer. */
const MIN_WALLS: Readonly<Record<string, number>> = {
    military_stand_01: 4,
    military_stand_01r: 4,
    military_stand_01b: 4,
    military_gatehouse_01: 6,
    military_tower_01: 8,
    military_bunker_command_01: 0,
    military_bunker_magazine_01: 0,
    military_bunker_vault_01: 6,
};
/** objects that stand outside the walls on purpose (porticos, bollards, sandbags, bushes) */
const OUTSIDE = /^(bush_|sandbags_|bollard_|house_column_)/;
/** a loophole (brick_wall_ext_3_0_low) fills a wall gap: it is an opening, not a wall */
const WALL = /_wall_ext_(?!3_0_low)|^stone_wall_int_4$|^rebirth_wall_int_/;
const OPENING =
    /^(house_door_0[12]|house_window_01|lab_door_01|lab_door_locked_01|brick_wall_ext_3_0_low|vault_door_main|vault_door_bathhouse|saloon_door_secret|cell_door_01)$/;

interface Placed {
    type: string;
    col: Collider;
}

/** The building's obstacle children at ori 0 with their world colliders (weighted picks: the first choice). */
function children(type: string): Placed[] {
    const def = getMapObjectDefOfType("building", type);
    const out: Placed[] = [];
    for (const c of def.mapObjects) {
        const t = typeof c.type === "string" ? c.type : Object.keys(c.type)[0];
        if (!t) continue;
        const d = getMapObjectDef(t);
        if (d.type !== "obstacle") continue;
        out.push({ type: t, col: transformOri(d.collision, c.pos, c.ori, c.scale) });
    }
    return out;
}

/** Overlap deeper than `tol` (touching faces are fine). */
function overlaps(a: Collider, b: Collider, tol = 0.02): boolean {
    const res = collider.intersect(a, b);
    return !!res && res.pen > tol;
}

function inside(c: Collider, min: Vec2, max: Vec2): boolean {
    const b = toBounds(c);
    return b.min.x >= min.x - 1e-6 && b.min.y >= min.y - 1e-6 && b.max.x <= max.x + 1e-6 && b.max.y <= max.y + 1e-6;
}

describe("rebirth building layouts", () => {
    for (const type of BUILDINGS) {
        it(`${type}: furniture inside, clear of walls and of each other; doors and windows in wall gaps`, () => {
            const def = getMapObjectDefOfType("building", type);
            const floor = def.floor.surfaces[0].collision[0];
            const objs = children(type);
            const walls = objs.filter((o) => WALL.test(o.type));
            const openings = objs.filter((o) => OPENING.test(o.type));
            const furniture = objs.filter((o) => !WALL.test(o.type) && !OPENING.test(o.type));
            expect(walls.length).toBeGreaterThanOrEqual(MIN_WALLS[type] ?? 9);
            for (const f of furniture) {
                if (!OUTSIDE.test(f.type)) expect(inside(f.col, floor.min, floor.max), f.type).toBe(true);
                for (const w of walls) expect(overlaps(f.col, w.col), `${f.type} in a wall`).toBe(false);
            }
            for (let i = 0; i < furniture.length; i++) {
                for (let j = i + 1; j < furniture.length; j++) {
                    const [a, b] = [furniture[i], furniture[j]];
                    expect(overlaps(a.col, b.col), `${a.type} / ${b.type}`).toBe(false);
                }
            }
            // a door or window fills a gap: it overlaps no wall beyond its frame
            for (const o of openings) for (const w of walls) expect(overlaps(o.col, w.col, 0.6), o.type).toBe(false);
            // heal regions stay inside
            for (const h of def.healRegions ?? []) expect(inside(h.collision, floor.min, floor.max)).toBe(true);
        });
    }
});

describe("rebirth buildings in their maps", () => {
    it("spawn lists: the clinic, fire station, library and radio station on main; per faction a command post and two blockhouses, and the arsenal on 50v50", () => {
        expect(REBIRTH_BUILDING_SPAWNS).toEqual({
            main: { clinic_01: 1, firestation_01: 1, library_01: 1, radio_station_01: 1, military_base_01: 1 },
            faction: {
                outpost_01r: 1,
                outpost_01b: 1,
                arsenal_01: 1,
                blockhouse_01r: 2,
                blockhouse_01b: 2,
                military_base_01r: 1,
                military_base_01b: 1,
            },
        });
        for (const [map, teamMode] of [
            ["main", 1],
            ["faction", 4],
        ] as const) {
            for (const seed of [1, 7, 99]) {
                const gen = cachedMap(map, seed, teamMode);
                for (const [type, n] of Object.entries(REBIRTH_BUILDING_SPAWNS[map])) {
                    const placed = gen.objects.filter((o) => o.type === type && o.parentId === 0);
                    expect([map, seed, type, placed.length]).toEqual([map, seed, type, n]);
                }
            }
        }
    });

    it("the clinic's treatment rooms heal 2 HP/s (heal regions, survev camp_01's rate)", () => {
        const generation = cachedMap("main", 12345);
        const game = new Game({ mapName: "main", seed: 12345 }, { generation, spawnLoot: false });
        const clinic = generation.objects.find((o) => o.type === "clinic_01")!;
        const p = game.getPlayer(game.addPlayer("patient"))!;
        const ward = transformOri({ type: 0, pos: { x: -9, y: 4.5 }, rad: 0 }, clinic.pos, clinic.ori, 1);
        game.teleportPlayer(p.id, v2.copy((ward as { pos: Vec2 }).pos), 0);
        p.health = 50;
        steps(game, 100);
        expect(p.health).toBeCloseTo(50 + CLINIC_HEAL_RATE, 1);
    });

    it("each command post stands on its faction's side and holds its faction's crate", () => {
        for (const seed of [1, 7, 12345]) {
            const generation = cachedMap("faction", seed, 4);
            const game = new Game({ mapName: "faction", seed, teamMode: 4 }, { generation, spawnLoot: false });
            const faction = game.faction!;
            for (const f of OUTPOST_FACTIONS) {
                const post = generation.objects.find((o) => o.type === f.id)!;
                expect(post, `${f.id} seed ${seed}`).toBeDefined();
                const band = faction.spawnBand(f.teamId);
                const centre = { x: game.mapData.width / 2, y: game.mapData.height / 2 };
                const bandCentre = v2.mul(v2.add(band.min, band.max), 0.5);
                // the same half of the map as the faction's spawn band
                const axis = Math.abs(bandCentre.x - centre.x) > Math.abs(bandCentre.y - centre.y) ? "x" : "y";
                expect(Math.sign(post.pos[axis] - centre[axis]), `${f.id} seed ${seed}`).toBe(
                    Math.sign(bandCentre[axis] - centre[axis]),
                );
                const crates = generation.objects.filter((o) => o.parentId === post.id && o.type === f.crate);
                expect(crates).toHaveLength(1);
            }
        }
    });
});
