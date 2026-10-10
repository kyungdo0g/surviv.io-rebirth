// The military base (군부대; the owner, 2026-10-08: "군부대는 둘다 있음 연병장 의무실 차고 병기고 본부 창고 이렇게 있게
// 또 지하실도 좀 규모가 크게 해주고"; docs/research/rebirth-deviations.md "The military base"): one structure per base,
// military_base_01 on the normal map, military_base_01r / _01b (teamId 1 / 2, in their own half: sim mapgen
// placement.ts REBIRTH_OWN_HALF_BUILDINGS) on 50v50. Its two layers are the walled compound (layer 0, with the HQ,
// reviewing stand, infirmary, armory, storehouse, garage, gatehouse and two towers as children) and the basement
// (layer 1, with Command, the Magazine and the vault as children), joined by five stairs. This module turns the parts
// (military/*.ts) into BuildingDefs and the StructureDefs, and lists their images.
import type { BuildingChildDef, BuildingDef, MapObjectDef, StructureDef } from "../../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    openingChildren,
    REBIRTH_ART_PX_PER_UNIT,
    type RebirthBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "../layout.ts";
import { MILITARY_ARMORY } from "./armory.ts";
import { MILITARY_BUNKER, MILITARY_COMMAND, MILITARY_MAGAZINE, MILITARY_VAULT } from "./bunker.ts";
import { MILITARY_COMPOUND, MILITARY_GROUND_PATCHES } from "./compound.ts";
import { MILITARY_GATEHOUSE, MILITARY_TOWER } from "./guard.ts";
import { MILITARY_HQ, MILITARY_STAND } from "./hq.ts";
import { MILITARY_INFIRMARY, MILITARY_WARD_HEAL_RATE } from "./infirmary.ts";
import type { Box, MilitaryPart, PartImage } from "./part.ts";
import { MILITARY_GARAGE, MILITARY_STOREHOUSE } from "./yard.ts";

/** A stair (compound frame): its box and down direction, the building whose floor holds its top, its bottom door. */
export interface MilitaryStair {
    readonly collision: Box;
    readonly downDir: { readonly x: number; readonly y: number };
    readonly host: string;
    /** the steel door's hinge 0.75 past the bottom edge (none on the open ramp) */
    readonly bottomDoor: { readonly x: number; readonly y: number } | null;
}

/** The five stairs. */
export const MILITARY_STAIRS: readonly MilitaryStair[] = [
    // S1: the HQ's hall down to Command
    { collision: [-2, 25, 2, 31], downDir: { x: 0, y: -1 }, host: "military_hq_01", bottomDoor: { x: -2, y: 24.25 } },
    // S2: the armory's issue hall down to the Magazine
    {
        collision: [22, 25, 26, 31],
        downDir: { x: 0, y: -1 },
        host: "military_armory_01",
        bottomDoor: { x: 22, y: 24.25 },
    },
    // S3: the storehouse's freight stairs down to the Spine's west end
    {
        collision: [-43, 5, -37, 9],
        downDir: { x: 1, y: 0 },
        host: "military_storehouse_01",
        bottomDoor: { x: -36.25, y: 5 },
    },
    // S4: the garage's vehicle ramp down to the motor pool (no door)
    { collision: [36.5, -15, 43.5, -6], downDir: { x: -1, y: 0 }, host: "military_garage_01", bottomDoor: null },
    // S5: the sapper hatch outside the south wall down to the tunnel and the Depot
    {
        collision: [-32, -48, -28, -42],
        downDir: { x: 0, y: 1 },
        host: "military_compound_01",
        bottomDoor: { x: -32, y: -41.25 },
    },
];

/**
 * One box over the basement and one over the tunnel, each ending 0.01 short of the stair boxes (survev's
 * bunker_structure_01 mask ends on its stair's bottom edge), so the stair-bottom doors and doorway strips are in.
 */
export const MILITARY_MASK: readonly Box[] = [
    [-36.99, -26.5, 36.49, 24.99],
    [-32.5, -41.99, -27.5, -26.5],
];

/** Trees and random obstacles stay off the compound, the hatch and the gate aprons. */
export const MILITARY_OBSTACLE_BOUNDS: readonly Box[] = [[-56, -52, 56, 44]];

/** Every part: the parents before their children. */
export const MILITARY_PARTS: readonly MilitaryPart[] = [
    MILITARY_COMPOUND,
    MILITARY_HQ,
    MILITARY_STAND,
    MILITARY_INFIRMARY,
    MILITARY_ARMORY,
    MILITARY_STOREHOUSE,
    MILITARY_GARAGE,
    MILITARY_GATEHOUSE,
    MILITARY_TOWER,
    MILITARY_BUNKER,
    MILITARY_COMMAND,
    MILITARY_MAGAZINE,
    MILITARY_VAULT,
];

/** The bases: main's, and one per 50v50 faction (side suffix of the faction variants, emblem colours). */
export const MILITARY_BASES = [
    { id: "military_base_01", side: "", teamId: 0, emblem: 0x3f4a28, star: 0xe0b030 },
    { id: "military_base_01r", side: "r", teamId: 1, emblem: 0xb3261e, star: 0xf4f4f0 },
    { id: "military_base_01b", side: "b", teamId: 2, emblem: 0x1f5fbf, star: 0xf4f4f0 },
] as const;
export type MilitaryBase = (typeof MILITARY_BASES)[number];

/** A part's id in a base (its faction variant's on 50v50). */
export function militaryPartId(part: MilitaryPart, base: MilitaryBase): string {
    return part.factionVariants && base.side ? `${part.id}${base.side}` : part.id;
}

/** An image's sprite in a base: a faction image's red or blue version on 50v50. */
export function militarySprite(img: PartImage, base: MilitaryBase): string {
    if (!img.faction || !base.side) return img.sprite;
    return img.sprite.replace(/-01\.img$/, base.side === "r" ? "-red.img" : "-blue.img");
}

/** Pixels per unit an image is drawn at. */
export const imagePpu = (img: PartImage) => img.ppu ?? REBIRTH_ART_PX_PER_UNIT;

const aabb = (b: Box) => box(b[0], b[1], b[2], b[3]);

function militaryBuilding(part: MilitaryPart, base: MilitaryBase, known: (id: string) => boolean): BuildingDef {
    const L = part.layout;
    const kids: BuildingChildDef[] = [
        ...wallChildren(L, known),
        ...openingChildren(L),
        ...part.props.map((q) => ({
            ...child(q.type as BuildingChildDef["type"], q.x, q.y, q.ori),
            ...(q.piece ? { puzzlePiece: q.piece } : {}),
        })),
    ];
    // the child buildings, where the parent places them (the parents sit at the structure's origin)
    for (const c of MILITARY_PARTS.filter((q) => q.parent === part.id)) {
        for (const pl of c.placements) kids.push(child(militaryPartId(c, base), pl.pos.x, pl.pos.y, pl.ori));
    }
    const imgs = (kind: PartImage["kind"]) =>
        part.images
            .filter((a) => a.kind === kind)
            .map((a) => ({
                sprite: militarySprite(a, base),
                pos: { ...a.centre },
                scale: (ART_SCALE * REBIRTH_ART_PX_PER_UNIT) / imagePpu(a),
                alpha: 1,
                tint: a.tint ?? 0xffffff,
                ...(a.rot ? { rot: a.rot } : {}),
            }));
    const color = (c: (typeof part.mapShapes)[number]["color"]) =>
        c === "emblem" ? base.emblem : c === "star" ? base.star : c;
    const def: BuildingDef = {
        type: "building",
        map: {
            display: part.mapShapes.length > 0,
            shapes: part.mapShapes.map((s) => ({
                collider: s.disc
                    ? { type: 0 as const, pos: { x: s.disc[0], y: s.disc[1] }, rad: s.disc[2] }
                    : aabb(s.box as Box),
                color: color(s.color),
            })),
        },
        terrain: { grass: true, beach: false },
        zIdx: part.zIdx,
        floor: {
            surfaces: part.surfaces.map((s) => ({ type: s.type, collision: s.boxes.map(aabb) })),
            imgs: imgs("floor"),
        },
        ceiling: {
            zoomRegions: part.zoom.map((z) => ({
                zoomIn: aabb(z.zoomIn),
                ...(z.zoomOut ? { zoomOut: aabb(z.zoomOut) } : {}),
                ...(z.zoom ? { zoom: z.zoom } : {}),
            })),
            vision:
                part.layer === 1
                    ? { dist: 7, width: 3, linger: 0.5, fadeRate: 6 }
                    : { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: imgs("ceiling"),
        },
        mapObjects: kids,
    };
    if (part.puzzle) def.puzzle = rebirthPuzzle(part.puzzle.name, part.puzzle.door);
    if (part.heal) def.healRegions = part.heal.map((b) => ({ collision: aabb(b), healRate: MILITARY_WARD_HEAL_RATE }));
    if (part === MILITARY_COMPOUND) {
        def.mapGroundPatches = MILITARY_GROUND_PATCHES.map((g) => ({
            bound: aabb(g.box),
            color: g.color,
            order: 1,
            roughness: 0,
            offsetDist: 0,
        }));
    }
    return def;
}

function militaryStructure(base: MilitaryBase): StructureDef {
    return {
        type: "structure",
        terrain: { grass: true, beach: false },
        mapObstacleBounds: MILITARY_OBSTACLE_BOUNDS.map(aabb),
        layers: [
            { type: militaryPartId(MILITARY_COMPOUND, base), pos: { x: 0, y: 0 }, ori: 0 },
            { type: MILITARY_BUNKER.id, pos: { x: 0, y: 0 }, ori: 0 },
        ],
        stairs: MILITARY_STAIRS.map((s) => ({ collision: aabb(s.collision), downDir: { ...s.downDir } })),
        mask: MILITARY_MASK.map(aabb),
        ...(base.teamId ? { teamId: base.teamId } : {}),
    };
}

/** The bases' buildings in wire order: the shared parts, the faction parts (main, red, blue), the basement's rooms. */
const BUILDING_ORDER: ReadonlyArray<readonly [MilitaryPart, MilitaryBase]> = [
    ...[
        MILITARY_INFIRMARY,
        MILITARY_ARMORY,
        MILITARY_STOREHOUSE,
        MILITARY_GARAGE,
        MILITARY_GATEHOUSE,
        MILITARY_TOWER,
    ].map((part) => [part, MILITARY_BASES[0]] as const),
    ...[MILITARY_HQ, MILITARY_STAND, MILITARY_COMPOUND].flatMap((part) =>
        MILITARY_BASES.map((base) => [part, base] as const),
    ),
    ...[MILITARY_COMMAND, MILITARY_MAGAZINE, MILITARY_VAULT, MILITARY_BUNKER].map(
        (part) => [part, MILITARY_BASES[0]] as const,
    ),
];

/** The 19 building types of the military bases (the structures aside). */
export const MILITARY_BASE_BUILDINGS: readonly string[] = BUILDING_ORDER.map(([part, base]) =>
    militaryPartId(part, base),
);

/** The 22 map types of the military bases in wire order: the buildings, then the three structures. */
export function militaryBaseDefs(known: (id: string) => boolean): Record<string, MapObjectDef> {
    const out: Record<string, MapObjectDef> = {};
    for (const [part, base] of BUILDING_ORDER) out[militaryPartId(part, base)] = militaryBuilding(part, base, known);
    for (const base of MILITARY_BASES) out[base.id] = militaryStructure(base);
    return out;
}

/**
 * The military bases' images, one record each (a roofless record whose `floor` is the image, roof images included),
 * at their pixel size.
 */
export function militaryBaseArt(): RebirthBuildingArt[] {
    const out = new Map<string, RebirthBuildingArt>();
    for (const part of MILITARY_PARTS) {
        for (const img of part.images) {
            for (const base of part.factionVariants ? MILITARY_BASES : [MILITARY_BASES[0]]) {
                const sprite = militarySprite(img, base);
                const ppu = imagePpu(img);
                out.set(sprite, { floor: sprite, size: [img.size[0] * ppu, img.size[1] * ppu] });
            }
        }
    }
    return [...out.values()];
}
