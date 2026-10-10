// The radar base (rebirth/buildings/radar/; the owner's wave 3, 2026-10-10): one building, radar_base_01 (the fenced
// compound), whose children are the dome tower, the operations building, the barracks, the guard post and the
// generator shed, each a building of its own placed by the compound (no basement, so no structure). Built from the
// military base's part records (military/part.ts); this module turns the parts into BuildingDefs and lists their
// images.
import type { BuildingChildDef, BuildingDef, MapObjectDef } from "../../../types/index.ts";
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
import type { Box, MilitaryPart, PartImage } from "../military/part.ts";
import { RADAR_BARRACKS, RADAR_GENERATOR, RADAR_GUARD } from "./annex.ts";
import { RADAR_COMPOUND, RADAR_GROUND_PATCHES } from "./compound.ts";
import { RADAR_DOME } from "./dome.ts";
import { RADAR_OPS } from "./ops.ts";

/** Every part, the compound first. */
export const RADAR_PARTS: readonly MilitaryPart[] = [
    RADAR_COMPOUND,
    RADAR_DOME,
    RADAR_OPS,
    RADAR_BARRACKS,
    RADAR_GUARD,
    RADAR_GENERATOR,
];

/** The radar base's map types in wire order: the child buildings, then the compound (the spawned type). */
export const RADAR_BASE_TYPES: readonly string[] = [
    RADAR_DOME.id,
    RADAR_OPS.id,
    RADAR_BARRACKS.id,
    RADAR_GUARD.id,
    RADAR_GENERATOR.id,
    RADAR_COMPOUND.id,
];

const aabb = (b: Box) => box(b[0], b[1], b[2], b[3]);
const ppuOf = (img: PartImage) => img.ppu ?? REBIRTH_ART_PX_PER_UNIT;

function radarBuilding(part: MilitaryPart, known: (id: string) => boolean): BuildingDef {
    const L = part.layout;
    const kids: BuildingChildDef[] = [
        ...wallChildren(L, known),
        ...openingChildren(L),
        ...part.props.map((q) => ({
            ...child(q.type as BuildingChildDef["type"], q.x, q.y, q.ori),
            ...(q.piece ? { puzzlePiece: q.piece } : {}),
        })),
    ];
    for (const c of RADAR_PARTS.filter((q) => q.parent === part.id)) {
        for (const pl of c.placements) kids.push(child(c.id, pl.pos.x, pl.pos.y, pl.ori));
    }
    const imgs = (kind: PartImage["kind"]) =>
        part.images
            .filter((a) => a.kind === kind)
            .map((a) => ({
                sprite: a.sprite,
                pos: { ...a.centre },
                scale: (ART_SCALE * REBIRTH_ART_PX_PER_UNIT) / ppuOf(a),
                alpha: 1,
                tint: a.tint ?? 0xffffff,
            }));
    const def: BuildingDef = {
        type: "building",
        map: {
            display: part.mapShapes.length > 0,
            shapes: part.mapShapes.map((s) => ({
                collider: s.disc
                    ? { type: 0 as const, pos: { x: s.disc[0], y: s.disc[1] }, rad: s.disc[2] }
                    : aabb(s.box as Box),
                color: s.color as number,
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
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: imgs("ceiling"),
        },
        mapObjects: kids,
    };
    if (part.puzzle) def.puzzle = rebirthPuzzle(part.puzzle.name, part.puzzle.door);
    if (part === RADAR_COMPOUND) {
        def.mapGroundPatches = RADAR_GROUND_PATCHES.map((g) => ({
            bound: aabb(g.box),
            color: g.color,
            order: 1,
            roughness: 0,
            offsetDist: 0,
        }));
    }
    return def;
}

/** The radar base's six map types in wire order (RADAR_BASE_TYPES). */
export function radarBaseDefs(known: (id: string) => boolean): Record<string, MapObjectDef> {
    const byId = new Map(RADAR_PARTS.map((part) => [part.id, part]));
    const outp: Record<string, MapObjectDef> = {};
    for (const id of RADAR_BASE_TYPES) outp[id] = radarBuilding(byId.get(id) as MilitaryPart, known);
    return outp;
}

/** The radar base's images, one record each (a roofless record whose `floor` is the image), at their pixel size. */
export function radarBaseArt(): RebirthBuildingArt[] {
    const outp = new Map<string, RebirthBuildingArt>();
    for (const part of RADAR_PARTS) {
        for (const img of part.images) {
            const ppu = ppuOf(img);
            outp.set(img.sprite, { floor: img.sprite, size: [img.size[0] * ppu, img.size[1] * ppu] });
        }
    }
    return [...outp.values()];
}
