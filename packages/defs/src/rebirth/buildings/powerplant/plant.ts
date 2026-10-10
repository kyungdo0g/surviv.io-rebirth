// The power plant (power_plant_01; the owner's wave 3, 2026-10-10; docs/research/rebirth-deviations.md "The power
// plant"): one building with child buildings, no basement. Its parts (compound.ts the walled yard, turbine.ts the
// turbine hall, control.ts the control building with the strongroom) are written like the military base's
// (military/part.ts) and turned into BuildingDefs here, with their images.
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
import { PLANT_COMPOUND, PLANT_GROUND_PATCHES } from "./compound.ts";
import { PLANT_CODE, PLANT_CONTROL, PLANT_PUZZLE } from "./control.ts";
import { PLANT_TURBINE } from "./turbine.ts";

/** Every part, in wire order (the children before the compound). */
export const PLANT_PARTS: readonly MilitaryPart[] = [PLANT_TURBINE, PLANT_CONTROL, PLANT_COMPOUND];

/** The power plant's map types in wire order: the turbine hall, the control building, the compound. */
export const POWER_PLANT_TYPES: readonly string[] = PLANT_PARTS.map((part) => part.id);

/** The plant's puzzle codes (REBIRTH_PUZZLE_CODES). */
export const POWER_PLANT_PUZZLE_CODES: Readonly<Record<string, readonly string[]>> = { [PLANT_PUZZLE]: PLANT_CODE };

/** Pixels per unit an image is drawn at. */
const ppuOf = (img: PartImage) => img.ppu ?? REBIRTH_ART_PX_PER_UNIT;
const aabb = (b: Box) => box(b[0], b[1], b[2], b[3]);

function plantBuilding(part: MilitaryPart, known: (id: string) => boolean): BuildingDef {
    const L = part.layout;
    const kids: BuildingChildDef[] = [
        ...wallChildren(L, known),
        ...openingChildren(L),
        ...part.props.map((q) => ({
            ...child(q.type as BuildingChildDef["type"], q.x, q.y, q.ori, (q as { scale?: number }).scale ?? 1),
            ...(q.piece ? { puzzlePiece: q.piece } : {}),
        })),
    ];
    for (const c of PLANT_PARTS.filter((q) => q.parent === part.id)) {
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
                tint: 0xffffff,
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
            })),
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: imgs("ceiling"),
        },
        mapObjects: kids,
    };
    if (part.puzzle) def.puzzle = rebirthPuzzle(part.puzzle.name, part.puzzle.door);
    if (part === PLANT_COMPOUND) {
        def.mapGroundPatches = PLANT_GROUND_PATCHES.map((g) => ({
            bound: aabb(g.box),
            color: g.color,
            order: 1,
            roughness: 0,
            offsetDist: 0,
        }));
    }
    return def;
}

/** The power plant's three map types in wire order. */
export function powerPlantDefs(known: (id: string) => boolean): Record<string, MapObjectDef> {
    return Object.fromEntries(PLANT_PARTS.map((part) => [part.id, plantBuilding(part, known)]));
}

/** The power plant's images, one record each (a roofless record whose `floor` is the image), at their pixel size. */
export function powerPlantArt(): RebirthBuildingArt[] {
    const out = new Map<string, RebirthBuildingArt>();
    for (const part of PLANT_PARTS) {
        for (const img of part.images) {
            const ppu = ppuOf(img);
            out.set(img.sprite, { floor: img.sprite, size: [img.size[0] * ppu, img.size[1] * ppu] });
        }
    }
    return [...out.values()];
}
