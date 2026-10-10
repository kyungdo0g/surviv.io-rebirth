// The military base (packages/defs rebirth/buildings/military/; the owner, 2026-10-08): its structure data (five
// stairs, the mask clear of them, the stair-bottom doors, sliding doors with walls to slide into, the vault door's swing,
// images at most 72 units), and its mechanics in the real sim on generated maps: the stair-bottom doors switch to the
// basement, the gatehouse switch opens its weapons cage, Command's staff code opens the war chest, the vault opens
// 4.1 s after Interact, the wards heal 2 HP/s, the towers give the 4x view, players walk down the HQ stairs, up the
// sapper hatch and from outside the motor gate down the ramp; on 50v50 each faction's base stands in its own half,
// outside its spawn band.
import { type Collider, collider, type Vec2, v2 } from "@rebirth/core";
import {
    getMapObjectDef,
    getMapObjectDefOfType,
    LOOKOUT_ZOOM,
    MILITARY_BASES,
    MILITARY_BUNKER,
    MILITARY_COMMAND,
    MILITARY_COMMAND_CODE,
    MILITARY_GATEHOUSE_CAGE_DOOR,
    MILITARY_MASK,
    MILITARY_PARTS,
    MILITARY_STAIRS,
    MILITARY_VAULT_DOOR,
    MILITARY_WAR_CHEST_DOOR,
    MILITARY_WARD_HEAL_RATE,
    type MilitaryBox,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri, transformOri } from "../src/geom/transform.ts";
import { Game, interactObstacle, type Obstacle, type Structure } from "../src/index.ts";
import { childObstacles, findStructure, placePlayer, stepSeconds, walk } from "./buildingHelpers.ts";
import { cachedMap } from "./helpers.ts";

const aabb = (b: MilitaryBox): Collider => ({ type: 1, min: { x: b[0], y: b[1] }, max: { x: b[2], y: b[3] } });
const overlap = (a: MilitaryBox, b: MilitaryBox) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const inBox = (p: Vec2, b: MilitaryBox) => p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3];

/** A building's obstacle children (its own frame, weighted picks: the first choice) with their colliders. */
function obstacles(type: string): Array<{ type: string; col: Collider; pos: Vec2; ori: number }> {
    const def = getMapObjectDefOfType("building", type);
    const out: Array<{ type: string; col: Collider; pos: Vec2; ori: number }> = [];
    for (const c of def.mapObjects) {
        const t = typeof c.type === "string" ? c.type : Object.keys(c.type)[0];
        if (!t) continue;
        const d = getMapObjectDef(t);
        if (d.type !== "obstacle") continue;
        out.push({ type: t, col: transformOri(d.collision, c.pos, c.ori, c.scale), pos: c.pos, ori: c.ori });
    }
    return out;
}

/** The obstacles of a nested basement room, moved into the basement's frame (where the basement places it). */
function nested(type: string): ReturnType<typeof obstacles> {
    const placed = getMapObjectDefOfType("building", MILITARY_BUNKER.id).mapObjects.find((c) => c.type === type)!;
    return obstacles(type).map((o) => ({ ...o, col: transformOri(o.col, placed.pos, placed.ori, 1) }));
}

/**
 * Whether the wall boxes cover `box` (within `tol`): a run of collinear wall pieces (one wall split in several
 * lengths) counts as one wall.
 */
function coveredByWalls(
    box: { min: Vec2; max: Vec2 },
    walls: ReadonlyArray<{ min: Vec2; max: Vec2 }>,
    tol = 0.3,
): boolean {
    const vertical = box.max.y - box.min.y > box.max.x - box.min.x;
    const [a, c] = vertical ? (["y", "x"] as const) : (["x", "y"] as const);
    const spans = walls
        .filter((w) => w.min[c] <= box.min[c] + tol && w.max[c] >= box.max[c] - tol)
        .map((w) => [w.min[a], w.max[a]] as const)
        .sort((p, q) => p[0] - q[0]);
    let reach = box.min[a] + tol;
    for (const [lo, hi] of spans) if (lo <= reach + 1e-6) reach = Math.max(reach, hi);
    return reach >= box.max[a] - tol;
}

describe("the military base's data", () => {
    it("has five stairs with the mask clear of every stair box, and a steel door 0.75 past each doored stair's bottom", () => {
        expect(MILITARY_STAIRS).toHaveLength(5);
        const basement = obstacles(MILITARY_BUNKER.id);
        for (const s of MILITARY_STAIRS) {
            for (const m of MILITARY_MASK) expect(overlap(s.collision, m), `mask over ${s.host}'s stairs`).toBe(false);
            if (!s.bottomDoor) continue;
            const door = basement.find((o) => v2.distance(o.pos, s.bottomDoor!) < 1e-6);
            // a wooden door does not switch layers (sim checkDoorLayer), the steel one does
            expect(door?.type, s.host).toBe("house_door_02");
            // 0.75 past the bottom edge (the edge the down direction points at), inside the mask
            const [x0, y0, x1, y1] = s.collision;
            const bottom = s.downDir.y < 0 ? y0 : s.downDir.y > 0 ? y1 : s.downDir.x < 0 ? x0 : x1;
            const along = s.downDir.y !== 0 ? s.bottomDoor.y : s.bottomDoor.x;
            const sign = s.downDir.y !== 0 ? s.downDir.y : s.downDir.x;
            expect((along - bottom) * sign, s.host).toBeCloseTo(0.75, 6);
            expect(
                MILITARY_MASK.some((m) => inBox(s.bottomDoor!, m)),
                s.host,
            ).toBe(true);
        }
    });

    it("its sliding doors slide into walls (Command's into the basement's)", () => {
        const basementWalls = obstacles(MILITARY_BUNKER.id).filter((o) => /_wall_ext_/.test(o.type));
        const rooms = [
            { type: MILITARY_BUNKER.id, doors: obstacles(MILITARY_BUNKER.id), n: 3 },
            { type: MILITARY_COMMAND.id, doors: nested(MILITARY_COMMAND.id), n: 4 },
        ];
        for (const { type, doors, n } of rooms) {
            const labs = doors.filter((o) => o.type === "lab_door_01");
            expect(labs.length, type).toBe(n);
            for (const lab of labs) {
                const d = getMapObjectDef("lab_door_01");
                if (d.type !== "obstacle" || !d.door?.slideToOpen) throw new Error("lab_door_01 does not slide");
                // slid open: 3.75 along the door's local -y (survev's panels keep 0.25 in the doorway)
                const shift = rotateOri({ x: 0, y: -d.door.slideOffset }, lab.ori);
                const box = collider.toAabb(transformOri(lab.col, shift, 0, 1));
                expect([
                    type,
                    lab.pos,
                    coveredByWalls(
                        box,
                        basementWalls.map((w) => collider.toAabb(w.col)),
                    ),
                ]).toEqual([type, lab.pos, true]);
            }
        }
    });

    it("the vault door's open box is clear of every wall and prop", () => {
        const open = aabb(MILITARY_VAULT_DOOR.open);
        const blockers = [...obstacles(MILITARY_BUNKER.id), ...nested("military_bunker_vault_01")].filter(
            (o) => o.type !== "vault_door_main",
        );
        for (const o of blockers) {
            const res = collider.intersect(open, o.col);
            expect(!!res && res.pen > 0.02, `${o.type} in the open vault door's way`).toBe(false);
        }
    });

    it("its images are at most 72 units a side and its heal regions lie on the infirmary's floor", () => {
        for (const part of MILITARY_PARTS) {
            for (const img of part.images) expect(Math.max(...img.size), img.sprite).toBeLessThanOrEqual(72);
            const floor = part.surfaces[0].boxes[0];
            for (const h of part.heal ?? []) expect(h[0] >= floor[0] && h[2] <= floor[2]).toBe(true);
        }
        const ward = getMapObjectDefOfType("building", "military_infirmary_01").healRegions ?? [];
        expect(ward.map((h) => h.healRate)).toEqual([MILITARY_WARD_HEAL_RATE, MILITARY_WARD_HEAL_RATE]);
    });
});

/** Every door (hinged, sliding, the vault's) within the base's reach. */
function doorsNear(game: Game, s: Structure): Obstacle[] {
    const out: Obstacle[] = [];
    for (const o of game.world.objects.values()) {
        if (o.kind === "obstacle" && o.door && v2.distance(o.pos, s.pos) < 70) out.push(o);
    }
    return out;
}

/** The base's building of a type (the nearest one to the structure). */
function near(game: Game, s: Structure, type: string) {
    const b = game.world.buildings
        .filter((x) => x.type === type)
        .sort((a, c) => v2.distance(a.pos, s.pos) - v2.distance(c.pos, s.pos))[0];
    if (!b) throw new Error(`no ${type}`);
    return b;
}

/** A point of the compound frame, in the world. */
const worldOf = (s: Structure, x: number, y: number) => v2.add(s.pos, rotateOri({ x, y }, s.ori));
/** A world point back in the compound frame. */
const localOf = (s: Structure, p: Vec2) => rotateOri(v2.sub(p, s.pos), (4 - s.ori) % 4);

const CASES = [
    { map: "main", seed: 12345, teamMode: 1, base: "military_base_01" },
    { map: "faction", seed: 7, teamMode: 4, base: "military_base_01r" },
    { map: "faction", seed: 7, teamMode: 4, base: "military_base_01b" },
] as const;

describe.each(CASES)("$base on $map $seed", ({ map, seed, teamMode, base }) => {
    const game = () =>
        new Game(
            { mapName: map, seed: 1, teamMode },
            { generation: cachedMap(map, seed, teamMode), spawnLoot: false, sandbox: true },
        );

    it("its stair-bottom doors stand on the basement's floor (layer 3); no other door leaves its floor", () => {
        const g = game();
        const s = findStructure(g, base);
        const doors = doorsNear(g, s);
        const bottoms = MILITARY_STAIRS.flatMap((st) =>
            st.bottomDoor ? [worldOf(s, st.bottomDoor.x, st.bottomDoor.y)] : [],
        );
        for (const w of bottoms) expect(doors.find((d) => v2.distance(d.pos, w) < 1e-3)?.layer).toBe(3);
        const odd = doors.filter(
            (d) =>
                !bottoms.some((w) => v2.distance(d.pos, w) < 1e-3) &&
                d.layer !== d.originalLayer &&
                !(d.originalLayer === 0 && d.layer === 2) &&
                !(d.originalLayer === 1 && d.layer === 3),
        );
        expect(odd.map((d) => d.type)).toEqual([]);
    });

    it("the gatehouse switch opens its weapons cage, and only that (the gate's leaves stay free)", () => {
        const g = game();
        const s = findStructure(g, base);
        const gate = near(g, s, "military_gatehouse_01");
        const [sw] = childObstacles(g, gate, "switch_03");
        const cage = childObstacles(g, gate, MILITARY_GATEHOUSE_CAGE_DOOR.type);
        const leaves = childObstacles(g, gate, "house_door_02");
        expect([cage.length, leaves.length, sw?.puzzlePiece]).toEqual([1, 2, "1"]);
        const p = placePlayer(g, v2.add(sw.pos, rotateOri({ x: 0, y: 1.5 }, s.ori)));
        interactObstacle(g, cage[0], p);
        stepSeconds(g, 0.5);
        expect(cage[0].door!.open).toBe(false);
        interactObstacle(g, sw, p);
        stepSeconds(g, 2.5);
        expect(cage[0].door!.open).toBe(true);
        expect(leaves.map((d) => d.door!.locked)).toEqual([false, false]);
    });

    it("Command's staff code (red, yellow, green) opens the war chest; a wrong order resets the switches", () => {
        const g = game();
        const s = findStructure(g, base);
        const command = near(g, s, "military_bunker_command_01");
        const switches = childObstacles(g, command, "switch_03");
        const [chest] = childObstacles(g, command, MILITARY_WAR_CHEST_DOOR.type);
        const labs = childObstacles(g, command, "lab_door_01");
        expect([switches.length, labs.length, !!chest]).toEqual([3, 4, true]);
        const piece = (label: string) => switches.find((o) => o.puzzlePiece === label)!;
        const p = placePlayer(g, worldOf(s, 0, 12), 1);
        for (const label of ["yellow", "red", "green"]) interactObstacle(g, piece(label), p);
        stepSeconds(g, 3);
        expect(chest.door!.open).toBe(false);
        expect(switches.every((o) => o.button!.canUse && !o.button!.onOff)).toBe(true);
        for (const label of MILITARY_COMMAND_CODE) interactObstacle(g, piece(label), p);
        stepSeconds(g, 2.5);
        expect(chest.door!.open).toBe(true);
        // nothing locks Command any more
        expect(labs.some((d) => d.door!.locked)).toBe(false);
    });

    it("the vault door opens 4.1 s after Interact, swinging north into the checkpoint", () => {
        const g = game();
        const s = findStructure(g, base);
        const [door] = childObstacles(g, near(g, s, "military_bunker_vault_01"), "vault_door_main");
        interactObstacle(g, door, placePlayer(g, worldOf(s, -2.5, -2), 1));
        stepSeconds(g, 3.9);
        expect(door.door!.open).toBe(false);
        stepSeconds(g, 0.4);
        expect([door.door!.open, door.ori]).toEqual([true, (MILITARY_VAULT_DOOR.ori + 1 + s.ori) % 4]);
    });

    it("the wards heal 2 HP/s and the towers give the 4x view", () => {
        const g = game();
        const s = findStructure(g, base);
        const patient = placePlayer(g, worldOf(s, -37.5, 22));
        patient.health = 50;
        stepSeconds(g, 1);
        expect(patient.health).toBeCloseTo(50 + MILITARY_WARD_HEAL_RATE, 1);
        const lookout = placePlayer(g, worldOf(s, -47, -36));
        stepSeconds(g, 0.3);
        expect(lookout.zoom).toBe(LOOKOUT_ZOOM);
    });

    it("players walk down the HQ stairs into Command, up the sapper hatch, and from outside the motor gate down the ramp", () => {
        const g = game();
        const s = findStructure(g, base);
        const south = rotateOri({ x: 0, y: -1 }, s.ori);
        const west = rotateOri({ x: -1, y: 0 }, s.ori);
        // down S1 (Interact opens the steel door at its bottom)
        const a = placePlayer(g, worldOf(s, 0, 33));
        walk(g, a, south, 520, 12);
        expect([a.layer, v2.distance(localOf(s, a.pos), { x: 0, y: 17 }) < 10]).toEqual([1, true]);
        // up S5 from the tunnel and out of the hatch
        const b = placePlayer(g, worldOf(s, -30, -36), 1);
        walk(g, b, south, 700, 12);
        expect([b.layer, localOf(s, b.pos).y < -48]).toEqual([0, true]);
        // from outside the motor gate straight down the ramp into the motor pool
        const c = placePlayer(g, worldOf(s, 56, -10.5));
        walk(g, c, west, 700);
        expect([c.layer, localOf(s, c.pos).x < 35]).toEqual([1, true]);
    });
});

describe("the 50v50 military bases", () => {
    it("each stands in its own half, clear of its faction's spawn band", () => {
        for (const seed of [1, 7, 99]) {
            const generation = cachedMap("faction", seed, 4);
            const g = new Game({ mapName: "faction", seed, teamMode: 4 }, { generation, spawnLoot: false });
            const faction = g.faction!;
            const centre = { x: g.mapData.width / 2, y: g.mapData.height / 2 };
            for (const b of MILITARY_BASES.filter((x) => x.teamId)) {
                const s = generation.objects.find((o) => o.type === b.id)!;
                expect(s, `${b.id} seed ${seed}`).toBeDefined();
                const band = faction.spawnBand(b.teamId);
                const bandCentre = v2.mul(v2.add(band.min, band.max), 0.5);
                const axis = Math.abs(bandCentre.x - centre.x) > Math.abs(bandCentre.y - centre.y) ? "x" : "y";
                expect(Math.sign(s.pos[axis] - centre[axis]), `${b.id} seed ${seed}`).toBe(
                    Math.sign(bandCentre[axis] - centre[axis]),
                );
                // the compound (106 x 84, either way round) stays out of the band
                const r = 53;
                const clear =
                    s.pos.x + r <= band.min.x ||
                    s.pos.x - r >= band.max.x ||
                    s.pos.y + r <= band.min.y ||
                    s.pos.y - r >= band.max.y;
                expect(clear, `${b.id} seed ${seed}`).toBe(true);
            }
        }
    });
});
