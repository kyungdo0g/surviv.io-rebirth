// The container port's rebirth additions (the owner's wave 3, 2026-10-10: "the container port gets port things like a
// security checkpoint and a ship"; docs/research/rebirth-deviations.md "Container port additions"): survev's
// warehouse_complex_01 (survev shared/defs/mapObjects/buildings/baseBuildingDefs.ts; generated mapObjects.json), which
// stands on the water's edge with its quay on the -x side (terrain.waterEdge dir (-1, 0)), gains two children:
// - port_checkpoint_01 in its land-side north-east corner, the free notch x 73..108, y 42..78 between the yard's east
//   block and its north band, so the road from inland (+x) runs through the checkpoint into the yard;
// - cargo_ship_01 on the water along the quay (the yard's edge at x -42): its starboard rail 3.5 west of the quay, its
//   gangway landing between the bollards at y 2 and 20.5. The ship needs no space on land: the complex stands 78.5
//   from the map's edge (sim mapgen placement.ts genOnWaterEdge), the ship's port side 10 from it, on the sea.
// The patched def keeps every original child in its order and appends the two; the checkpoint's notch and the ship's
// hull join the complex's obstacle bounds (nothing else spawns there), the notch its asphalt ground patches and map
// shape.
import type { AABB, BuildingDef, MapObjectDef } from "../../types/index.ts";
import { CARGO_SHIP_BOW_TIP, CARGO_SHIP_HULL } from "./cargoShip.ts";
import { box, child } from "./layout.ts";
import { PORT_CHECKPOINT_PLAZA } from "./portCheckpoint.ts";

export const PORT_COMPLEX = "warehouse_complex_01";
/** Where the complex places its new children (complex frame, ori 0). */
export const PORT_CHECKPOINT_POS = { x: 90.5, y: 60 } as const;
export const CARGO_SHIP_POS = { x: -57, y: 8 } as const;
/** The quay's edge (the complex's asphalt ends here on the water side). */
export const PORT_QUAY_X = -42;

const shift = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, p: { x: number; y: number }) =>
    box(b.min.x + p.x, b.min.y + p.y, b.max.x + p.x, b.max.y + p.y);

/** The checkpoint's plaza in the complex frame (the notch it fills). */
export const PORT_CHECKPOINT_BOX: AABB = shift(PORT_CHECKPOINT_PLAZA, PORT_CHECKPOINT_POS);
/** The ship's hull with its bow, in the complex frame. */
export const CARGO_SHIP_BOX: AABB = shift(
    { min: CARGO_SHIP_HULL.min, max: { x: CARGO_SHIP_HULL.max.x, y: CARGO_SHIP_BOW_TIP } },
    CARGO_SHIP_POS,
);

/** warehouse_complex_01 with the checkpoint and the ship (a copy; the generated def is left as it is). */
export function portComplex(current: Readonly<Record<string, MapObjectDef>>): Record<string, BuildingDef> {
    const def = current[PORT_COMPLEX] as BuildingDef;
    if (def?.type !== "building") throw new Error(`"${PORT_COMPLEX}" is not a building`);
    if (!def.terrain.waterEdge || def.terrain.waterEdge.dir.x !== -1) {
        throw new Error(`${PORT_COMPLEX}: the quay is no longer on the -x side`);
    }
    for (const t of ["port_checkpoint_01", "cargo_ship_01"]) {
        if (current[t]?.type !== "building") throw new Error(`${PORT_COMPLEX}: no building "${t}"`);
        if (def.mapObjects.some((c) => c.type === t)) throw new Error(`${PORT_COMPLEX} already has ${t}`);
    }
    const n = PORT_CHECKPOINT_BOX;
    return {
        [PORT_COMPLEX]: {
            ...def,
            map: {
                ...def.map,
                shapes: [...(def.map?.shapes ?? []), { collider: n, color: 0x595959 }],
            },
            mapObstacleBounds: [
                ...(def.mapObstacleBounds ?? []),
                box(n.min.x, n.min.y, n.max.x, n.max.y),
                box(CARGO_SHIP_BOX.min.x, CARGO_SHIP_BOX.min.y, CARGO_SHIP_BOX.max.x, CARGO_SHIP_BOX.max.y),
            ],
            // the yard's asphalt border and fill (the colours and the 1-unit inset of its own patches)
            mapGroundPatches: [
                ...(def.mapGroundPatches ?? []),
                { bound: n, color: 0x8e8573, order: 1 },
                // the fill runs 1 unit into the yard on the sides it joins (west, south), like the yard's own fills
                { bound: box(n.min.x - 1, n.min.y - 1, n.max.x - 1, n.max.y - 1), color: 0x595959, order: 1 },
            ],
            mapObjects: [
                ...def.mapObjects,
                child("port_checkpoint_01", PORT_CHECKPOINT_POS.x, PORT_CHECKPOINT_POS.y),
                child("cargo_ship_01", CARGO_SHIP_POS.x, CARGO_SHIP_POS.y),
            ],
        },
    };
}
