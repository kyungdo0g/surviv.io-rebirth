// mall_01, a rebirth building of the normal map (the owner's wave 3, 2026-10-10: "a big shopping mall";
// docs/research/rebirth-deviations.md "The shopping mall"): a concrete mall 92 x 68 (layout: mallLayout.ts). Seven
// entrances: the main entrance's sliding doors south, a sliding door at the east end of each concourse, the
// supermarket's side door and the stockroom's back door, and the loading dock's open truck bay. Twelve shops along the
// two concourses, behind glass fronts and 4-unit doorways, the atrium with its fountain between them. The security
// office's vault opens on the shop-switch code: a switch in the clothing shop, the sports shop, the electronics store and
// the pharmacy (a green, a red, a yellow and a blue plate), pressed in the order of the duty note on the security
// office's floor (survev bathhouse_01's code room). The vault (11 x 10 inside) holds a sniper crate, a safe, a shotgun
// mount, deposit boxes, level 3 armour and loot. Loot is dense but spread: shelves, cases and drawers in every shop.
import type { BuildingChildDef, BuildingDef } from "../../types/index.ts";
import { MEDICAL_LOOT_SPAWNER } from "./clinic.ts";
import {
    ART_SCALE,
    box,
    child,
    floorArtPos,
    layoutArt,
    openingChildren,
    piece,
    type RoofedBuildingArt,
    rebirthPuzzle,
    wallChildren,
} from "./layout.ts";
import { MALL_LAYOUT, MALL_STRIPS, MALL_VAULT_DOOR } from "./mallLayout.ts";

export * from "./mallLayout.ts";

export const MALL_PUZZLE = "rebirth_mall";
/** The shop switches, flush to concrete walls: the clothing and sports shops', the electronics store's, the pharmacy's. */
export const MALL_SWITCHES = [
    { label: "red", x: -24.95, y: -6, ori: 1 },
    { label: "green", x: -24.95, y: 6, ori: 1 },
    { label: "yellow", x: 44.95, y: 0, ori: 3 },
    { label: "blue", x: 12, y: -32.95, ori: 2 },
] as const;
export const MALL_CODE: readonly string[] = ["green", "yellow", "red", "blue"];
/**
 * The duty note with the code on the security office's floor, before the vault door (4.1 wide: the office's 3-wide bay
 * would hide its outer marks under the walls).
 */
export const MALL_NOTE = { x: 7, y: 20 } as const;

export const MALL_ART: RoofedBuildingArt = layoutArt(
    MALL_LAYOUT,
    "map-building-mall-floor-01.img",
    "map-building-mall-ceiling-01.img",
);

/**
 * The back of a piece of furniture (its collider's +y extent at ori 0, generated mapObjects.json), so `flush` can stand
 * it against a wall face.
 */
const BACK: Readonly<Record<string, number>> = {
    bookshelf_01: 1,
    towelrack_01: 1,
    drawers_01: 1.4,
    locker_01: 0.75,
    locker_02: 0.75,
    vending_01: 1.4,
    refrigerator_01: 1.4,
    stand_01: 1.4,
    gun_mount_01: 0.9,
    gun_mount_02: 0.9,
    mil_crate_05: 1.25,
    crate_06: 1.1,
    screen_01: 0.25,
    piano_01: 1,
    sink_01: 1.5,
    deposit_box_02: 1.15,
    deposit_box_01: 1.15,
    safe_01: 1.35,
    toilet_01: 1.43,
    case_01: 1.6,
    case_04: 1.6,
    chest_02: 1.6,
    couch_02: 1.5,
    table_08: 1.45,
    crate_01: 2.25,
    crate_02: 2.25,
    crate_04: 2.25,
    planter_04: 1.5,
    recorder_01: 1.5,
    crate_03: 1.575,
};

/** A piece of furniture with its back against the wall face on side `side` (n/s/e/w of the room) at `face`. */
function flush(type: string, side: "n" | "s" | "e" | "w", face: number, along: number): BuildingChildDef {
    const back = BACK[type];
    if (back === undefined) throw new Error(`mall: no back extent for ${type}`);
    if (side === "n") return child(type, along, face - back, 0);
    if (side === "s") return child(type, along, face + back, 2);
    if (side === "e") return child(type, face - back, along, 3);
    return child(type, face + back, along, 1);
}

/** The supermarket's shelf runs (bookshelf_01 turned north-south, 2 x 7): the wall run and two islands, 3-unit aisles. */
const SHELF_X = [-44.5, -39.5, -34.5] as const;
const SHELF_Y = [-23.5, -16.5, -9.5, 1.5, 8.5] as const;

function furniture(): BuildingChildDef[] {
    return [
        // ---- the supermarket (x -45.5..-26.5, y -33.5..17.5 inside): the shelf runs with a cross aisle at the side
        // door, freezers along the south and north walls, checkout counters against the east island, soda machines
        ...SHELF_X.flatMap((x) => SHELF_Y.map((y) => child("bookshelf_01", x, y, 1))),
        flush("refrigerator_01", "s", -33.5, -43.8),
        flush("refrigerator_01", "s", -33.5, -40.4),
        flush("refrigerator_01", "s", -33.5, -37),
        flush("refrigerator_01", "n", 17.5, -43.8),
        flush("refrigerator_01", "n", 17.5, -40.4),
        child("table_01", -31.5, -9.5, 1),
        child("table_01", -31.5, 1.5, 1),
        flush("vending_01", "n", 17.5, -31),
        flush("vending_01", "s", -33.5, -30),
        child("loot_tier_1", -37, -4),
        child("loot_tier_1", -30, -24),
        child("loot_tier_2", -42, 14),
        // ---- the stockroom (x -45.5..-26.5, y 18.5..33.5): pallets of crates in the corners, the ammunition crate
        flush("crate_01", "w", -45.5, 31.25),
        flush("crate_02", "w", -45.5, 20.75),
        flush("crate_04", "e", -26.5, 31.25),
        flush("crate_01", "e", -26.5, 20.75),
        child("loot_tier_1", -31, 26),
        // ---- the jewellery shop (x -25.5..-12.5, y -33.5..-18.5): display cases, a safe
        flush("case_01", "s", -33.5, -15.75),
        flush("case_04", "w", -25.5, -27),
        flush("safe_01", "e", -12.5, -21.5),
        child("loot_tier_1", -19, -26),
        // ---- the phone shop (x -11.5..-5.5): a counter and a drawer
        flush("drawers_01", "s", -33.5, -8),
        child("loot_tier_1", -8.5, -25),
        // ---- the entrance hall (x -4.5..4.5): planters flush to its walls
        flush("planter_04", "w", -4.5, -26),
        flush("planter_04", "e", 4.5, -26),
        // ---- the pharmacy (x 5.5..18.5): shelves of medicine, the counter
        flush("drawers_01", "e", 18.5, -31),
        flush("drawers_01", "e", 18.5, -26),
        flush("drawers_01", "w", 5.5, -28),
        child(MEDICAL_LOOT_SPAWNER, 12, -27),
        child(MEDICAL_LOOT_SPAWNER, 11, -21.5),
        // ---- the hardware store (x 19.5..33.5): tool racks, crates, a fire axe
        flush("towelrack_01", "s", -33.5, 22.5),
        flush("crate_01", "e", 33.5, -31.25),
        flush("drawers_01", "e", 33.5, -22),
        child("loot_tier_fireaxe", 26, -23),
        child("loot_tier_1", 26, -28),
        // ---- the toy shop (x 34.5..45.5): shelves, a crate of fireworks (throwables)
        flush("bookshelf_01", "e", 45.5, -30),
        flush("crate_03", "w", 34.5, -31.5),
        child("crate_03", 39, -24),
        child("loot_tier_1", 41, -20.5),
        // ---- the clothing shop (x -25.5..-11.5, y -10.5..-0.5): clothes rails and a dresser along the back wall
        flush("towelrack_01", "n", -0.5, -14.5),
        flush("drawers_01", "n", -0.5, -20),
        child("loot_tier_1", -18, -6),
        // ---- the sports shop (x -25.5..-11.5, y 0.5..10.5): the gun rack, a crate of ammunition
        flush("gun_mount_01", "s", 0.5, -13.75),
        flush("crate_06", "s", 0.5, -18.25),
        child("loot_tier_2", -18, 6),
        // ---- the atrium: the fountain's statue, planters flush to the shop glass, loot by the fountain
        child("statue_01", 0, 0),
        flush("planter_04", "w", -10.5, 0),
        flush("planter_04", "e", 10.5, 0),
        child("loot_tier_2", -6, 7.5),
        child("loot_tier_1", 6, -7.5),
        // ---- the food court (x 11.5..29.5, y -10.5..10.5): round tables, soda machines along the east wall
        child("table_03", 17, -5),
        child("table_03", 17, 5),
        child("table_03", 23.5, 0),
        flush("vending_01", "e", 29.5, -8.8),
        flush("vending_01", "e", 29.5, 8.8),
        child("loot_tier_1", 23.5, -6.5),
        child("loot_tier_1", 23.5, 6.5),
        // ---- the electronics store (x 30.5..45.5): display tables, deposit boxes behind the counter
        child("table_04", 39.5, 0, 1),
        flush("deposit_box_01", "w", 30.5, 0),
        flush("locker_01", "e", 45.5, -7),
        flush("locker_01", "e", 45.5, 7),
        child("loot_tier_2", 42.5, -8),
        child("loot_tier_1", 42.5, 8),
        // ---- the concourses: loot
        child("loot_tier_1", -18, -14.5),
        child("loot_tier_1", 26, -14.5),
        child("loot_tier_1", -18, 14.5),
        child("loot_tier_1", 38, 14.5),
        // ---- the toilets (x -25.5..-14.5, y 18.5..33.5): toilets along the north wall, sinks on the west wall
        flush("toilet_01", "n", 33.5, -23.5),
        flush("toilet_01", "n", 33.5, -19.5),
        flush("toilet_01", "n", 33.5, -16),
        flush("sink_01", "w", -25.5, 24),
        child("loot_tier_1", -18, 25),
        // ---- the café (x -13.5..-2.5): a counter and tables
        flush("refrigerator_01", "n", 33.5, -11.8),
        flush("stand_01", "n", 33.5, -8.85),
        child("table_03", -8, 24.5),
        child("loot_tier_1", -5, 30),
        // ---- the security office (x -1.5..13.5, y 18.5..22.5, and its west bay x -1.5..1.5 to y 33.5): a locker by
        // the vault door, the duty note on the floor beside the door (floor art)
        flush("locker_01", "n", 22.5, 11.5),
        child("loot_tier_1", 0, 27),
        // ---- the vault (x 2.5..13.5, y 23.5..33.5): the sniper crate and the safe along the north wall, the shotgun
        // mount on the west wall under the crate, the deposit boxes on the east wall, armour and loot on the floor
        flush("mil_crate_05", "n", 33.5, 5.2),
        flush("safe_01", "n", 33.5, 9.15),
        flush("gun_mount_02", "w", 2.5, 28.75),
        flush("deposit_box_02", "e", 13.5, 26),
        child("loot_tier_airdrop_armor", 7, 27.5),
        child("loot_tier_2", 11.5, 31),
        // ---- the music shop (x 14.5..25.5): the piano, a speaker stand
        flush("piano_01", "n", 33.5, 20),
        flush("stand_01", "e", 25.5, 26),
        child("loot_tier_1", 20, 25),
        // ---- the loading dock (x 26.5..45.5, y 18.5..33.5): crates and barrels by the truck bay
        flush("crate_01", "w", 26.5, 31.25),
        flush("crate_02", "w", 26.5, 26.75),
        flush("crate_01", "e", 45.5, 31.25),
        child("barrel_01", 43.75, 20.25),
        child("loot_tier_1", 36, 24),
        // ---- outside: bollards along the plaza, bushes by the entrance
        child("bollard_01", -10, -38.8),
        child("bollard_01", 10, -38.8),
        child("bush_01", -14, -36.1),
        child("bush_01", 14, -36.1),
    ];
}

export function mall(known: (id: string) => boolean): BuildingDef {
    const L = MALL_LAYOUT;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(-46.5, -34.5, 46.5, 34.5), color: 0x8f969c },
                // the glass vaults over the concourses and the dome over the atrium
                { collider: box(-26, -17.5, 46, -11.5), color: 0x9fc4d6 },
                { collider: box(-26, 11.5, 46, 17.5), color: 0x9fc4d6 },
                { collider: box(-8, -8, 8, 8), color: 0xb7d8e6 },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [
                { type: "tile", collision: [box(-46, -34, 46, 34)] },
                { type: "house", collision: [box(-46, -34, -26, 34)] },
                { type: "carpet", collision: [box(-26, -11, -11, 11)] },
                { type: "stone", collision: [box(2, 23, 14, 34), box(26, 18, 46, 34)] },
                { type: "asphalt", collision: [box(26, 34, 46.5, 42)] },
            ],
            imgs: [{ sprite: MALL_ART.floor, pos: floorArtPos(L), scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [{ zoomIn: box(-46, -34, 46, 34), zoomOut: box(-46.5, -34.5, 46.5, 34.5) }],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: MALL_ART.ceiling, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        puzzle: rebirthPuzzle(MALL_PUZZLE, MALL_VAULT_DOOR.type),
        // the hum of the mall (the clinic's sound) round the atrium
        soundEmitters: [
            {
                sound: "ambient_lab_01",
                channel: "ambient",
                pos: { x: 0, y: 0 },
                range: { min: 6, max: 20 },
                falloff: 1,
                volume: 0.08,
            },
        ],
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            ...MALL_STRIPS.glass,
            child(MALL_VAULT_DOOR.type, MALL_VAULT_DOOR.pos.x, MALL_VAULT_DOOR.pos.y, MALL_VAULT_DOOR.ori),
            ...MALL_SWITCHES.map((sw) => piece("switch_03", sw.x, sw.y, sw.ori, sw.label)),
            ...furniture(),
        ],
    };
}
