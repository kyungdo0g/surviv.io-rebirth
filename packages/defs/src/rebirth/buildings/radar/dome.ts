// The radar base's dome tower (레이더 돔; the owner's wave 3, 2026-10-10: "a radar base of some size, not the radio
// station"; docs/research/rebirth-deviations.md "The radar base"): a square concrete tower under the white radome at the
// north end of the main road. Inside, the radar's pedestal (indestructible) stands in the middle of the operators'
// floor, the consoles line the north wall and the equipment rack the south wall; windows on three sides. Standing
// inside gives the 8x scope's zoom (68, survev shared/gameConfig.ts scopeZoomRadius), more than the military base's
// watchtowers (LOOKOUT_ZOOM, the 4x scope's), so the dome watches the whole base and its approaches.
import { type Box, fromWorld, fullZoom, hRun, type MilitaryPart, op, p, room, vRun } from "../military/part.ts";

/** The dome's view: the 8x scope's zoom (survev shared/gameConfig.ts scopeZoomRadius.desktop["8xscope"]). */
export const RADAR_DOME_ZOOM = 68;

/** The dome tower's floor box (compound frame) and its centre, where the radar's pedestal stands. */
export const RADAR_DOME_BOX: Box = [-11, 16, 11, 38];
export const RADAR_DOME_CENTRE = { x: 0, y: 27 } as const;
/** The radome's radius on the roof (it fills the roof but for the corners). */
export const RADAR_DOME_RADIUS = 10.6;

export const RADAR_DOME: MilitaryPart = fromWorld({
    id: "radar_dome_01",
    layer: 0,
    parent: "radar_base_01",
    centre: RADAR_DOME_CENTRE,
    zIdx: 1,
    layout: {
        bounds: { min: { x: -11, y: 16 }, max: { x: 11, y: 38 } },
        material: "concrete",
        walls: [
            // south: the steel door on the road's axis; north: two windows over the back lot
            ...hRun(16, -11.5, 11.5, [[-2, 2]]),
            ...hRun(38, -11.5, 11.5, [
                [-8, -4],
                [4, 8],
            ]),
            // west: two windows toward the antenna field; east: the side door facing the operations building, a window
            ...vRun(-11, 16.5, 37.5, [
                [21, 25],
                [29, 33],
            ]),
            ...vRun(11, 16.5, 37.5, [
                [24, 28],
                [31.5, 35.5],
            ]),
        ],
        openings: [
            op("house_door_02", -2, 15.75, 3),
            op("house_door_01", 11.25, 24, 0),
            op("house_window_01", -11.25, 23, 0),
            op("house_window_01", -11.25, 31, 0),
            op("house_window_01", -6, 38.25, 1),
            op("house_window_01", 6, 38.25, 1),
            op("house_window_01", 11.25, 33.5, 0),
        ],
        rooms: [room(-11, 16, 11, 38, "dome")],
    },
    props: [
        // the radar's pedestal (an invisible 2x2 steel block the floor art draws as the turntable's mount)
        p("metal_wall_ext_2x2", RADAR_DOME_CENTRE.x, RADAR_DOME_CENTRE.y, 0, { wallLike: true }),
        // the operators' consoles along the north wall (between and beside the windows), the equipment rack
        // (indestructible, ricochets) along the south wall west of the door, a crate in the south-east corner
        p("control_panel_02", 0, 35.8, 2),
        p("control_panel_03", -9.25, 36.3),
        p("control_panel_03", 9.25, 36.3),
        p("table_07", -7, 17.85),
        p("crate_01", 8.25, 18.75),
        // floor loot round the pedestal
        p("loot_tier_2", -5.5, 27),
        p("loot_tier_2", 5.5, 27),
        p("loot_tier_2", 0, 21.5),
        p("loot_tier_2", 0, 31.5),
    ],
    surfaces: [{ type: "tile", boxes: [RADAR_DOME_BOX] }],
    zoom: [fullZoom(RADAR_DOME_BOX, RADAR_DOME_ZOOM)],
    images: [
        { sprite: "map-building-radar-dome-floor-01.img", kind: "floor", centre: RADAR_DOME_CENTRE, size: [23, 23] },
        {
            sprite: "map-building-radar-dome-ceiling-01.img",
            kind: "ceiling",
            centre: RADAR_DOME_CENTRE,
            size: [23, 23],
        },
    ],
    mapShapes: [
        { box: [-11.5, 15.5, 11.5, 38.5], color: 0x5d6266 },
        { disc: [RADAR_DOME_CENTRE.x, RADAR_DOME_CENTRE.y, RADAR_DOME_RADIUS], color: 0xeceee8 },
        { disc: [RADAR_DOME_CENTRE.x, RADAR_DOME_CENTRE.y, 1.6], color: 0xd2402a },
    ],
});
