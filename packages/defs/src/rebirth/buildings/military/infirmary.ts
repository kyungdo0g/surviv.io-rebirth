// military_infirmary_01 (의무실), the military base's north-west building (rebirth/buildings/military/): two healing
// wards (heal regions, the clinic's 2 HP/s; the client draws their glow, REBIRTH_HEAL_FX_BUILDINGS), a triage hall and
// a pharmacy. The north ward's window lines up with a perimeter loophole, so outsiders can shoot into a heal camp. An
// olive roof with a white panel and a red cross (a military medical marking, unlike the clinic's white roof).
// The narcotics store (added 2026-10-10, the owner: "more hidden rooms"): a 6 x 10 strongroom behind the pharmacy's
// steel door (vault_door_bathhouse: only the puzzle opens it; it slides north into the wall), opened by the switch in
// the triage hall (a one-switch puzzle, as the clinic's drug safe); the triage hall gives up 2 units to make room.
import { fromWorld, fullZoom, hRun, type MilitaryPart, op, out, p, room, vRun } from "./part.ts";

/** HP per second in the wards: the clinic's CLINIC_HEAL_RATE (survev camp_01). */
export const MILITARY_WARD_HEAL_RATE = 2;

/** The narcotics store's door (vault_door_bathhouse: only the puzzle opens it; slides 3.75 north into the wall). */
export const MILITARY_NARCOTICS_DOOR = { type: "vault_door_bathhouse", hinge: { x: -28.5, y: 31 }, ori: 2 } as const;
export const MILITARY_INFIRMARY_PUZZLE = "rebirth_milbase_infirmary";

export const MILITARY_INFIRMARY: MilitaryPart = fromWorld({
    id: "military_infirmary_01",
    layer: 0,
    parent: "military_compound_01",
    centre: { x: -33.5, y: 28.5 },
    zIdx: 1,
    layout: {
        bounds: { min: { x: -45.5, y: 19.5 }, max: { x: -21.5, y: 37.5 } },
        material: "brick",
        walls: [
            ...hRun(
                19.5,
                -46,
                -21,
                [
                    [-42, -38],
                    [-30, -26],
                ],
                undefined,
                "brick",
            ),
            // north: a window into the north ward only (none into the store)
            ...hRun(37.5, -46, -21, [[-42, -38]], undefined, "brick"),
            ...vRun(
                -45.5,
                20,
                37,
                [
                    [22, 26],
                    [31, 35],
                ],
                undefined,
                "brick",
            ),
            ...vRun(-21.5, 20, 37, [[21, 25]], undefined, "brick"),
            // the wards | the east half, a door into each ward
            ...vRun(
                -34.5,
                20,
                37,
                [
                    [21, 25],
                    [32, 36],
                ],
                undefined,
                "brick",
            ),
            // south ward | north ward
            ...hRun(28.5, -45, -35, [], undefined, "brick"),
            // triage hall | pharmacy and store
            ...hRun(26.5, -34, -22, [[-33, -29]], undefined, "brick"),
            // pharmacy | narcotics store: the store's door (y 27..31) slides north into the wall
            ...vRun(-28.5, 27, 37, [[27, 31]], undefined, "brick"),
        ],
        openings: [
            op("house_door_01", -30, 19.25, 3),
            op("house_window_01", -40, 19.25, 3),
            op("house_window_01", -40, 37.75, 1),
            op("house_window_01", -45.75, 24, 0),
            op("house_window_01", -45.75, 33, 0),
            op("house_door_01", -21.25, 21, 0),
            op("house_door_01", -34.5, 21, 0),
            op("house_door_01", -34.5, 32, 0),
            op("house_door_01", -29, 26.5, 1),
        ],
        rooms: [
            room(-45.5, 19.5, -34.5, 28.5, "ward"),
            room(-45.5, 28.5, -34.5, 37.5, "ward"),
            room(-34.5, 19.5, -21.5, 26.5, "triage"),
            room(-34.5, 26.5, -28.5, 37.5, "pharmacy"),
            room(-28.5, 26.5, -21.5, 37.5, "narcotics"),
        ],
    },
    puzzle: { name: MILITARY_INFIRMARY_PUZZLE, door: MILITARY_NARCOTICS_DOOR.type },
    props: [
        p(
            MILITARY_NARCOTICS_DOOR.type,
            MILITARY_NARCOTICS_DOOR.hinge.x,
            MILITARY_NARCOTICS_DOOR.hinge.y,
            MILITARY_NARCOTICS_DOOR.ori,
            { wallLike: true },
        ),
        // the south ward
        p("bed_sm_01", -43.4, 24),
        p("bed_sm_01", -40, 24),
        p("loot_tier_medical", -37, 26.5),
        // the north ward
        p("bed_sm_01", -43.4, 33),
        p("bed_sm_01", -40, 33),
        p("decal_caduceus_01", -37.5, 34.5),
        p("loot_tier_medical", -37, 30.5),
        // the triage hall: the exam table, the store's switch on the north wall, clear of the east door's swing
        p("table_01", -28, 23),
        p("switch_03", -24, 25.45, 2, { piece: "1" }),
        // the pharmacy: the fridge in the north-east corner, medical loot
        p("refrigerator_01", -30.7, 35.9, 2),
        p("loot_tier_medical", -31.5, 29.5),
        // the narcotics store: the drug safe (deposit boxes, the jackpot) against the north wall, the guard's riot
        // locker under it, medical loot and confiscated arms on the floor, clear of the door
        p("deposit_box_02", -24.5, 35.85),
        p("locker_02", -22.75, 33.5, 3),
        p("loot_tier_medical", -25.5, 28.5),
        p("loot_tier_medical", -26.5, 32.5),
        p("loot_tier_police_floor", -24.5, 30.5),
        out("bush_01", -36, 17.6),
    ],
    surfaces: [{ type: "tile", boxes: [[-45.5, 19.5, -21.5, 37.5]] }],
    zoom: [fullZoom([-45.5, 19.5, -21.5, 37.5])],
    heal: [
        [-45, 20, -35, 28],
        [-45, 29, -35, 37],
    ],
    images: [
        {
            sprite: "map-building-milbase-infirmary-floor-01.img",
            kind: "floor",
            centre: { x: -33.5, y: 28.5 },
            size: [25, 19],
        },
        {
            sprite: "map-building-milbase-infirmary-ceiling-01.img",
            kind: "ceiling",
            centre: { x: -33.5, y: 28.5 },
            size: [25, 19],
        },
    ],
    mapShapes: [
        { box: [-46, 19, -21, 38], color: 0x5b6b3a },
        { box: [-38, 24, -29, 33], color: 0xf4f4f0 },
        { box: [-34.6, 25, -32.4, 32], color: 0xc8312e },
        { box: [-37, 27.4, -30, 29.6], color: 0xc8312e },
    ],
});
