// gas_station_01, a rebirth building of the normal map and 50v50 (the owner's wave 3, 2026-10-10: "the gas station and
// the church: their exterior walls can be broken; when a certain amount collapses the whole building caves in", "a gas
// station with a huge number of oil drums"; docs/research/rebirth-deviations.md "The gas station"). A roadside site:
// the convenience store (gas_station_store_01, a child building) in the north-west, a fenced drum yard in the
// north-east, and the forecourt to the south with four fuel islands under a canopy (the site's own roof image).
//
// The store's shell is breakable brick (rebirth_wall_brk_*, 300 health) and its roof sets `ceiling.destroy.collapse`:
// once 40 % of its wall pieces are down (wood partitions count too, as every broken wall child does) it caves in,
// killing everyone inside and burying its furniture and loot (sim world/collapse.ts). Inside: the shop floor with
// shelves, a drinks cooler and the cashier counter; the storeroom; the toilet; the back office, whose sliding steel door
// opens on the switch behind the counter (a one-switch puzzle like the clinic's) onto the safe, a chest, a riot locker,
// a shotgun mount and level 3 armour. The back office's walls, inner and outer, are unbreakable brick: neither a
// broken partition nor a breached shell opens it (it is buried with the rest of the store when the roof falls).
//
// Explosives everywhere, so chain reactions are the point: oil drums (barrel_01) interleaved with propane tanks
// (propane_01: 50 health, so one drum's blast sets the tank off and the tank's finishes the next drum) along the
// store's west wall, in the drum yard and in two drum stacks by the forecourt, and every fuel island is a pump
// (gas_pump_01, a rebirth obstacle that explodes like a drum) between a tank and a drum. Drums against the store's west
// wall can breach its brick and bring it down.
import type { BuildingDef, MapObjectDef, ObstacleDef } from "../../types/index.ts";
import {
    ART_SCALE,
    box,
    child,
    floorArtPos,
    layoutArt,
    openingChildren,
    piece,
    type RebirthBuildingArt,
    type RebirthBuildingLayout,
    type RoofedBuildingArt,
    rebirthPuzzle,
    roofArtPos,
    type WallSeg,
    wallChildren,
    wallMaterial,
} from "./layout.ts";
import { hRun, op, room, splitLength, vRun } from "./military/part.ts";

export const GAS_STATION = "gas_station_01";
export const GAS_STATION_STORE = "gas_station_store_01";
export const GAS_PUMP = "gas_pump_01";

// ---------------------------------------------------------------------------------------------------------------------
// the store: wall lines x -21..11, y 0..17 in the site frame (the child building sits at the site's origin). West: the
// shop floor (15 x 16 inside); east: the storeroom (south, 15 x 7), the toilet and the back office (north, 4 x 8 and
// 10 x 8 inside). Doorways 4 units, furniture flush against the walls or 2.6+ clear.

/** The longest breakable brick piece: a broken one opens a hole about a doorway wide, not a whole side. */
const SHELL_PIECE = 4;

/**
 * The shell's runs (segments without their own material, the layout's brittle) re-cut into pieces of SHELL_PIECE,
 * the remainder folded into the last one (split into existing lengths), so breaches stay local and the collapse
 * threshold counts real damage.
 */
function chop(segs: readonly WallSeg[]): WallSeg[] {
    const out: WallSeg[] = [];
    for (const seg of segs) {
        const [x0, y0, x1, y1] = seg;
        const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        if (seg[4] || len <= SHELL_PIECE) {
            out.push(seg);
            continue;
        }
        const n = Math.floor(len / SHELL_PIECE);
        const rest = len - n * SHELL_PIECE;
        const pieces =
            rest > 0
                ? [...Array(n - 1).fill(SHELL_PIECE), ...splitLength(SHELL_PIECE + rest, "brittle")]
                : Array(n).fill(SHELL_PIECE);
        const dx = Math.sign(x1 - x0);
        const dy = Math.sign(y1 - y0);
        let at = 0;
        for (const piece of pieces) {
            out.push([x0 + dx * at, y0 + dy * at, x0 + dx * (at + piece), y0 + dy * (at + piece)]);
            at += piece;
        }
    }
    return out;
}

export const GAS_STATION_STORE_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -21, y: 0 }, max: { x: 11, y: 17 } },
    material: "brittle",
    walls: chop([
        // south: the shop window and the glass front door (the shelves and the cooler stand against the north and west
        // walls, the drums outside the west wall); east: the back door to the drum yard
        ...hRun(
            0,
            -21.5,
            11.5,
            [
                [-18, -14],
                [-13, -9],
            ],
            undefined,
            "brittle",
        ),
        // north and east: the back office's two outer walls are solid brick (a hidden room never opens to a breach;
        // its safe stands against them), the rest of the shell breaks
        ...hRun(17, -21.5, 0, [], undefined, "brittle"),
        ...hRun(17, 0, 11.5, [], "brick", "brittle"),
        ...vRun(-21, 0.5, 16.5, [], undefined, "brittle"),
        ...vRun(11, 0.5, 8.5, [[2.5, 6.5]], undefined, "brittle"),
        ...vRun(11, 8.5, 16.5, [], "brick", "brittle"),
        // shop | east rooms: the storeroom door, the brick piece the office switch stands on, the toilet door
        // (partitions breakable wood, the owner, 2026-10-10)
        ...vRun(-5, 0, 3, [], "wood", "brittle"),
        ...vRun(-5, 7, 11, [], "brick", "brittle"),
        ...vRun(-5, 15, 17, [], "wood", "brittle"),
        // storeroom | toilet (wood), storeroom | office (brick, the office's sliding door slides east into it)
        ...hRun(8, -5, 0, [], "wood", "brittle"),
        ...hRun(8, 0, 11, [[3, 7]], "brick", "brittle"),
        // toilet | office (brick)
        ...vRun(0, 8, 17, [], "brick", "brittle"),
    ]),
    openings: [
        op("house_window_01", -16, -0.25, 3),
        op("house_door_01", -13, -0.25, 3),
        op("house_door_01", 11.25, 2.5, 0),
        op("house_door_01", -5, 3, 0),
        op("house_door_01", -5, 11, 0),
    ],
    rooms: [
        room(-21, 0, -5, 17, "shop"),
        room(-5, 0, 11, 8, "store"),
        room(-5, 8, 0, 17, "toilet"),
        room(0, 8, 11, 17, "office"),
    ],
};

/** The back office's door (vault_door_bathhouse: only the puzzle opens it; slides east into the wall). */
export const GAS_STATION_OFFICE_DOOR = { type: "vault_door_bathhouse", pos: { x: 7, y: 8 }, ori: 1 } as const;
export const GAS_STATION_PUZZLE = "rebirth_gas_station";
/** The switch behind the cashier counter, on the brick piece of the shop | storeroom wall. */
export const GAS_STATION_SWITCH = { x: -6.05, y: 9, ori: 3 } as const;

/** The store's breakable brick pieces, and how many broken walls bring it down (40 % of them, the owner's threshold). */
export const GAS_STATION_BRITTLE_WALLS = GAS_STATION_STORE_LAYOUT.walls.filter(
    (s) => wallMaterial(GAS_STATION_STORE_LAYOUT, s) === "brittle",
).length;
export const GAS_STATION_COLLAPSE_WALLS = Math.round(GAS_STATION_BRITTLE_WALLS * 0.4);

export const GAS_STATION_STORE_ART: RoofedBuildingArt = layoutArt(
    GAS_STATION_STORE_LAYOUT,
    "map-building-gas-station-store-floor-01.img",
    "map-building-gas-station-store-ceiling-01.img",
);
/** The rubble left on the store's floor when it caves in (its roof's residue: the floor image's size and place). */
export const GAS_STATION_RUBBLE: RebirthBuildingArt = {
    floor: "map-building-gas-station-rubble-01.img",
    size: GAS_STATION_STORE_ART.size,
};

// ---------------------------------------------------------------------------------------------------------------------
// the site: 53 x 38 (x -26.5..26.5, y -19..19). The drum yard's fence (steel, wall lines x 15..26, y 3..17) has its
// gate on the west side, off the 3-wide lane between the store and the yard; the canopy covers the four islands.

export const GAS_STATION_SITE_LAYOUT: RebirthBuildingLayout = {
    bounds: { min: { x: -26.5, y: -19 }, max: { x: 26.5, y: 19 } },
    material: "metal",
    walls: [
        ...vRun(15, 2.5, 17.5, [[8.5, 12.5]], undefined, "metal"),
        ...vRun(26, 2.5, 17.5, [], undefined, "metal"),
        ...hRun(17, 15.5, 25.5, [], undefined, "metal"),
        ...hRun(3, 15.5, 25.5, [], undefined, "metal"),
    ],
    openings: [],
    rooms: [room(-26.5, -19, 26.5, 19, "asphalt"), room(15, 3, 26, 17, "yard"), room(-21, 0, 11, 17, "slab")],
};

/** The forecourt canopy (the site's roof image and zoom region) and the four islands' centres (the pump on each). */
export const GAS_STATION_CANOPY = { min: { x: -16, y: -19 }, max: { x: 16, y: -5 } } as const;
export const GAS_STATION_ISLANDS: ReadonlyArray<{ x: number; y: number }> = [
    { x: -9, y: -8.5 },
    { x: 9, y: -8.5 },
    { x: -9, y: -15.5 },
    { x: 9, y: -15.5 },
];

const canopySize = (): [number, number] => [
    (GAS_STATION_CANOPY.max.x - GAS_STATION_CANOPY.min.x) * 32,
    (GAS_STATION_CANOPY.max.y - GAS_STATION_CANOPY.min.y) * 32,
];

/** The site's floor (asphalt, islands, the yard) and the canopy roof (one image each, no roof over the site). */
export const GAS_STATION_SITE_ART: readonly RebirthBuildingArt[] = [
    { floor: "map-building-gas-station-floor-01.img", size: layoutArt(GAS_STATION_SITE_LAYOUT, "").size },
    { floor: "map-building-gas-station-canopy-01.img", size: canopySize() },
];

/** The pump's sprite pixels per world unit (drawn at img.scale 0.25, 16 px per unit on screen). */
const PUMP_PPU = 64;
/** The fuel pump's half extents. */
export const GAS_PUMP_HALF = { x: 1.25, y: 0.75 } as const;
export const GAS_PUMP_ART: RebirthBuildingArt = {
    floor: "map-gas-pump-01.img",
    size: [GAS_PUMP_HALF.x * 2 * PUMP_PPU, GAS_PUMP_HALF.y * 2 * PUMP_PPU],
};

/**
 * gas_pump_01: a fuel dispenser, survev barrel_01's def (its explosion_barrel blast, metal chips and sounds) on a
 * 2.5 x 1.5 box with 100 health, so a drum's blast (125 to obstacles) next to it sets it off.
 */
export function gasPumpDef(generated: Readonly<Record<string, MapObjectDef>>): ObstacleDef {
    const barrel = generated.barrel_01;
    if (barrel?.type !== "obstacle") throw new Error("gas station: no barrel_01 to copy");
    const h = GAS_PUMP_HALF;
    return {
        ...barrel,
        collision: { type: 1, min: { x: -h.x, y: -h.y }, max: { x: h.x, y: h.y }, height: 0 },
        extents: { x: h.x, y: h.y },
        health: 100,
        loot: [],
        map: { display: true, color: 0xc8312e, scale: 1 },
        img: { ...barrel.img, sprite: GAS_PUMP_ART.floor, scale: 0.25, tint: 0xffffff },
    };
}

// ---------------------------------------------------------------------------------------------------------------------
// explosive rows: drums (radius 1.75) and tanks (radius 1.25) set side by side just touching

const DRUM = 1.75;
const TANK = 1.25;
/** a hair between touching props (the layout test allows 0.02 of overlap, the probe calls under 0.3 flush) */
const KISS = 0.01;

const drum = (x: number, y: number) => child("barrel_01", x, y);
const tank = (x: number, y: number) => child("propane_01", x, y);

/** A column of drums and tanks up from y0 (bottom edge), alternating from a drum, centred on the line x (drums) / x+dx. */
function column(x: number, y0: number, n: number, tankDx: number) {
    const out = [];
    let y = y0 + DRUM;
    for (let i = 0; i < n; i++) {
        const isDrum = i % 2 === 0;
        out.push(isDrum ? drum(x, y) : tank(x + tankDx, y));
        // the next one's centre: just touching (the tank sits tankDx off the drums' line)
        const r = DRUM + TANK + KISS;
        y += Math.sqrt(r * r - tankDx * tankDx);
    }
    return out;
}

/** A drum stack two wide: a column of drums beside a column of tanks, rows touching (x0 the drums' west edge). */
function stack(x0: number, yTop: number, rows: number) {
    const out = [];
    for (let i = 0; i < rows; i++) {
        const y = yTop - DRUM - i * (2 * DRUM + KISS);
        out.push(drum(x0 + DRUM, y), tank(x0 + 2 * DRUM + TANK + KISS, y));
    }
    return out;
}

/** A fuel island: a tank, the pump, a drum, west to east, centred on the pump. */
function island(x: number, y: number) {
    return [
        tank(x - GAS_PUMP_HALF.x - TANK - KISS, y),
        child(GAS_PUMP, x, y),
        drum(x + GAS_PUMP_HALF.x + DRUM + KISS, y),
    ];
}

/** The drum yard's load (clear x 15.5..25.5, y 3.5..16.5): a drum-tank-drum row along the north fence, a tank-drum-tank
 * column down the east fence, two drums along the south fence; the gate on the west opens onto the middle. */
function yardDrums() {
    const east = 25.5;
    const north = 16.5;
    const r = DRUM + TANK + KISS;
    const b2 = { x: east - DRUM, y: north - DRUM };
    const p1 = { x: b2.x - r, y: north - TANK };
    const b1 = { x: p1.x - r, y: b2.y };
    // down the east fence from below b2: tank, drum, tank (tanks flush with the fence, drums on b2's line)
    const dy = Math.sqrt(r * r - (DRUM - TANK) ** 2);
    const p2 = { x: east - TANK, y: b2.y - dy };
    const b3 = { x: b2.x, y: p2.y - dy };
    const p3 = { x: p2.x, y: b3.y - dy };
    return [
        drum(b1.x, b1.y),
        tank(p1.x, p1.y),
        drum(b2.x, b2.y),
        tank(p2.x, p2.y),
        drum(b3.x, b3.y),
        tank(p3.x, p3.y),
        drum(15.5 + DRUM, 3.5 + DRUM),
        drum(15.5 + 3 * DRUM + KISS, 3.5 + DRUM),
    ];
}

// ---------------------------------------------------------------------------------------------------------------------
// the defs

export function gasStationStore(known: (id: string) => boolean): BuildingDef {
    const L = GAS_STATION_STORE_LAYOUT;
    const { min, max } = L.bounds;
    const roof = roofArtPos(L);
    const floorPos = floorArtPos(L);
    const door = GAS_STATION_OFFICE_DOOR;
    return {
        type: "building",
        map: {
            display: true,
            shapes: [{ collider: box(min.x - 0.5, min.y - 0.5, max.x + 0.5, max.y + 0.5), color: 0xb7553a }],
        },
        terrain: { grass: true, beach: false },
        zIdx: 1,
        floor: {
            surfaces: [{ type: "tile", collision: [box(min.x, min.y, max.x, max.y)] }],
            imgs: [{ sprite: GAS_STATION_STORE_ART.floor, pos: floorPos, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            zoomRegions: [
                {
                    zoomIn: box(min.x, min.y, max.x, max.y),
                    zoomOut: box(min.x - 0.5, min.y - 0.5, max.x + 0.5, max.y + 0.5),
                },
            ],
            vision: { dist: 5.5, width: 2.75, linger: 0.5, fadeRate: 6 },
            imgs: [{ sprite: GAS_STATION_STORE_ART.ceiling, pos: roof, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
            // the owner's collapse (2026-10-10): brick-red roof debris (survev archway_01's), a roof-break sound, the
            // rubble image over the floor
            destroy: {
                wallCount: GAS_STATION_COLLAPSE_WALLS,
                particle: "archwayBreak",
                particleCount: 80,
                residue: GAS_STATION_RUBBLE.floor,
                sound: "ceiling_break_02",
                collapse: true,
            },
        },
        puzzle: rebirthPuzzle(GAS_STATION_PUZZLE, door.type),
        mapObjects: [
            ...wallChildren(L, known),
            ...openingChildren(L),
            child(door.type, door.pos.x, door.pos.y, door.ori),
            // the shop: shelves along the west and north walls (two deep), the drinks cooler, the cashier counter with
            // the office switch on the wall behind it
            child("bookshelf_01", -19.5, 4, 1),
            child("bookshelf_01", -17, 15.5),
            child("bookshelf_01", -17, 13.5),
            child("refrigerator_01", -11.8, 15.1),
            child("table_01", -11.6, 6.5, 1),
            piece("switch_03", GAS_STATION_SWITCH.x, GAS_STATION_SWITCH.y, GAS_STATION_SWITCH.ori, "1"),
            child("loot_tier_1", -15, 9.5),
            child("loot_tier_1", -8, 13),
            child("loot_tier_2", -16, 2.5),
            // the storeroom: an ammo crate and a shelf against the south wall
            child("crate_06", -2.25, 1.6),
            child("bookshelf_02", 7, 1.5),
            child("loot_tier_1", 2, 5),
            // the toilet
            child("toilet_01", -1.68, 15.07),
            // the back office: the safe, a riot locker and the chest along the north wall, a shotgun mount on the east
            // wall, level 3 armour and two weapon drops
            child("safe_01", 1.75, 15.15),
            child("locker_02", 4.5, 15.75),
            child("chest_02", 8.25, 14.9),
            child("gun_mount_01", 9.6, 10.77, 3),
            child("loot_tier_airdrop_armor", 4, 11),
            child("loot_tier_2", 6.5, 12.5),
            child("loot_tier_2", 2.5, 9.5),
        ],
    };
}

export function gasStation(known: (id: string) => boolean): BuildingDef {
    const S = GAS_STATION_SITE_LAYOUT;
    const c = GAS_STATION_CANOPY;
    const canopyPos = { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2 };
    const site = box(S.bounds.min.x, S.bounds.min.y, S.bounds.max.x, S.bounds.max.y);
    return {
        type: "building",
        map: {
            display: true,
            shapes: [
                { collider: box(c.min.x, c.min.y, c.max.x, c.max.y), color: 0xd9d6cf },
                { collider: box(c.min.x, c.max.y - 1.5, c.max.x, c.max.y), color: 0xc8312e },
                { collider: box(15, 3, 26, 17), color: 0x6e6a5e },
            ],
        },
        terrain: { grass: true, beach: false },
        zIdx: 0,
        floor: {
            surfaces: [{ type: "asphalt", collision: [site] }],
            imgs: [{ sprite: GAS_STATION_SITE_ART[0].floor, scale: ART_SCALE, alpha: 1, tint: 0xffffff }],
        },
        ceiling: {
            // an open canopy: the view keeps its zoom under it (noZoom), and the roof only opens for a player under or
            // right at its edge (a short vision scan; a walled roof opens from 5.5 away)
            zoomRegions: [{ zoomIn: box(c.min.x, c.min.y, c.max.x, c.max.y), noZoom: true }],
            vision: { dist: 1, width: 1, linger: 0.3, fadeRate: 6 },
            imgs: [
                { sprite: GAS_STATION_SITE_ART[1].floor, pos: canopyPos, scale: ART_SCALE, alpha: 1, tint: 0xffffff },
            ],
        },
        mapObjects: [
            child(GAS_STATION_STORE, 0, 0),
            ...wallChildren(S, known),
            // drums and tanks against the store's west wall, a stack each side of the forecourt, the yard's load
            ...column(-21.5 - DRUM - KISS, -0.33, 3, 0.5),
            ...stack(-26, -0.2, 2),
            ...stack(18, -0.2, 4),
            ...yardDrums(),
            // the fuel islands
            ...GAS_STATION_ISLANDS.flatMap((p) => island(p.x, p.y)),
            // two soda machines against the shop front
            child("vending_01", -6.1, -1.9),
            child("vending_01", -2.7, -1.9),
            // loose loot on the forecourt and in the yard
            child("loot_tier_1", 0, -12),
            child("loot_tier_1", 19, 10),
        ],
    };
}
