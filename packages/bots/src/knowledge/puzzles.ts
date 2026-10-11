// What players learn about the map's locked rooms (BrainFeatures.puzzles): every building whose room opens by a code
// puzzle, a single switch, a control panel or a hand-opened vault door. The pieces (switches, panels, bottles,
// planters with their painted labels), where they sit in the building, the doors the solution opens, the delays and
// the room behind come from the building defs (the client ships the same defs: the labels are painted next to the
// pieces); only the solutions are learned knowledge, written here with their source (the bot never reads the
// simulation's server-only PUZZLE_CODES). Who knows a solution is drawn once per bot from its own stream
// (createRng(seed ^ PUZZLE_SALT)), by skill tier and persona: the community codes (club круг, chrys 一二三四, the saloon
// rainbow) most experts and many intermediates know, the rarer ones (the eye bunker logos, the planters, МИХАИЛ) mostly
// experts; the obvious ones (a single switch, a control panel labelled "Use", a vault door) everyone.
// Sources: docs/research/maps/puzzles.md; survev shared/defs/puzzles.ts; MAP.md section 2.4 (bot interaction notes).
import { type Bounds, createRng, type Vec2 } from "@rebirth/core";
import { type BuildingDef, getMapDef, hasMapObjectDef, MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import type { PersonaParams } from "../persona.ts";
import type { SkillProfile } from "../skill.ts";

/** Salt of the puzzle-knowledge stream: createRng(seed ^ PUZZLE_SALT), apart from the brain, motor and persona. */
export const PUZZLE_SALT = 0x3c6ef372;

/**
 * How widely a solution is known: `obvious` (one switch, a panel, a vault door: everyone), `common` (codes every
 * guide shows), `rare` (codes only seasoned players remember), `squad` (pieces on two floors inside 6 s: a squad's
 * job, never tried alone).
 */
export type PuzzleLore = "obvious" | "common" | "rare" | "squad";

/** `code`: pieces pressed in order; `panel`: one control panel moves the doors; `door`: a vault door used by hand. */
export type PuzzleKind = "code" | "panel" | "door";

/** A room the solution opens: a building (its ceiling regions; the nearest instance to the site) or a local box. */
export interface RoomSpec {
    building?: string;
    /** in the site building's own frame (rotated and moved with it) */
    box?: Bounds;
}

interface PuzzleSpec {
    /** building def that holds the pieces */
    building: string;
    kind: PuzzleKind;
    lore: PuzzleLore;
    /** piece labels in order (code puzzles) */
    code?: readonly string[];
    /** the Woods maps' own Eye bunker code (sim world/puzzles.ts puzzleCode) */
    woodsCode?: readonly string[];
    /** the obstacle a panel or door site is used with */
    use?: string;
    rooms: readonly RoomSpec[];
    /** rough worth of what is inside (0..100; containers.ts scale) */
    value: number;
    source: string;
}

export interface PuzzlePiece {
    type: string;
    /** position in the building's frame */
    pos: Vec2;
    ori: number;
    /** painted label (puzzlePiece); "" for panels and doors */
    label: string;
    /** a child placed on its own floor (the Twins bunker's surface buttons) */
    layer?: number;
    /** Use reaches it within this distance of the collider (interactionRad; the player's radius comes on top) */
    reach: number;
}

export interface PuzzleOpens {
    type: string;
    pos: Vec2;
    ori: number;
}

export interface PuzzleEntry extends PuzzleSpec {
    /** knowledge key: the def's puzzle name (shared by variants of one puzzle), else the building id */
    name: string;
    pieces: readonly PuzzlePiece[];
    /** what the solution moves: doors (or the Twins walls) of the building */
    opens: readonly PuzzleOpens[];
    /** seconds from the last press to the doors moving (completeUseDelay, a panel's useDelay, a door's openDelay) */
    openAfter: number;
    /** the next piece must come within this long or the input resets (pieceResetDelay; Infinity: one press) */
    pieceWindow: number;
    /** pieces stay locked this long after a wrong code (errorResetDelay) */
    errorReset: number;
}

const RAINBOW = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
const POLICE_CELLS: Bounds = { min: { x: -42.25, y: -1.25 }, max: { x: -6.75, y: 7.5 } };
const CROSSING_STORAGE: Bounds = { min: { x: -26.5, y: -20 }, max: { x: -17.5, y: -2 } };
const PUZZLES_KB = "docs/research/maps/puzzles.md";

const SPECS: readonly PuzzleSpec[] = [
    {
        building: "club_01",
        kind: "code",
        lore: "common",
        code: ["1", "2", "3", "4"],
        rooms: [{ building: "club_vault" }],
        value: 50,
        source: `club switches к р у г, "круг" (circle): ${PUZZLES_KB}; survev shared/defs/puzzles.ts club_01`,
    },
    {
        building: "bathhouse_01",
        kind: "code",
        lore: "obvious",
        code: ["1"],
        rooms: [{ building: "bathhouse_sideroom_02" }],
        value: 90,
        source: `the bathhouse's single switch opens the ring-case vault: ${PUZZLES_KB} club_02`,
    },
    {
        building: "bunker_chrys_sublevel_01",
        kind: "code",
        lore: "common",
        code: ["ichi", "ni", "san", "shi"],
        rooms: [{ building: "bunker_chrys_compartment_01" }],
        value: 35,
        source: `一 二 三 四 counted in order: ${PUZZLES_KB} bunker_chrys_01`,
    },
    {
        building: "bunker_chrys_compartment_01",
        kind: "code",
        lore: "rare",
        code: ["flower", "leaves", "moon", "frost"],
        rooms: [{ building: "bunker_chrys_compartment_02" }, { building: "bunker_chrys_compartment_03" }],
        value: 70,
        source: `survev fork planter code (conflict chrys-vault-door-use): ${PUZZLES_KB} bunker_chrys_02`,
    },
    {
        building: "bunker_chrys_compartment_01b",
        kind: "code",
        lore: "rare",
        code: ["flower", "leaves", "moon", "frost"],
        rooms: [],
        value: 0,
        source: "aged greenhouse variant without pieces: its vault never opens (MAP.md 2.4)",
    },
    {
        building: "saloon_01",
        kind: "code",
        lore: "common",
        code: RAINBOW,
        rooms: [{ building: "saloon_cellar_01" }],
        value: 40,
        source: `bottles in rainbow order: ${PUZZLES_KB} saloon`,
    },
    {
        building: "bunker_eye_sublevel_01",
        kind: "code",
        lore: "rare",
        code: ["egg", "hydra", "storm", "conch", "crossing", "hatchet"],
        woodsCode: [
            "swine",
            "hydra",
            "crossing",
            "hatchet",
            "harpsichord",
            "caduceus",
            "egg",
            "cloud",
            "storm",
            "conch",
        ],
        rooms: [{ building: "bunker_eye_compartment_01" }],
        value: 60,
        source: `bunker logos in release order (recorder_01 hints it); Woods its own ten: ${PUZZLES_KB} bunker_eye_02`,
    },
    {
        building: "bunker_eye_01",
        kind: "code",
        lore: "rare",
        code: [],
        rooms: [],
        value: 0,
        source: "surface eye bunker: a puzzle block without pieces (MAP.md 2.4)",
    },
    {
        building: "bunker_twins_sublevel_01",
        kind: "code",
        lore: "squad",
        code: ["scout", "sniper", "medic", "demo", "assault", "tank"],
        rooms: [{ building: "bunker_twins_compartment_01" }],
        value: 90,
        source: `class colours in menu order, pieces on two floors, 6 s window: ${PUZZLES_KB} bunker_twins`,
    },
    {
        building: "reserve_vault_01",
        kind: "code",
        lore: "rare",
        code: ["1", "2", "3", "4", "2", "5"],
        rooms: [{ building: "reserve_vault_01" }],
        value: 95,
        source: `Cyrillic switches М И Х А И Л: ${PUZZLES_KB} reserve_vault; wikigg The_Reserve`,
    },
    {
        building: "police_01",
        kind: "panel",
        lore: "obvious",
        use: "control_panel_01",
        rooms: [{ box: POLICE_CELLS }],
        value: 35,
        source: "the cell block panel opens the four cells 1.1 s later (control_panel_01 useType cell_door_01)",
    },
    {
        building: "police_01x",
        kind: "panel",
        lore: "obvious",
        use: "control_panel_01",
        rooms: [{ box: POLICE_CELLS }],
        value: 35,
        source: "snow police station: the same cell block panel",
    },
    {
        building: "bunker_crossing_compartment_01",
        kind: "panel",
        lore: "obvious",
        use: "control_panel_04",
        rooms: [{ box: CROSSING_STORAGE }],
        value: 25,
        source: "the crossing bunker panel opens its storage 4.25 s later (control_panel_04 useType crossing_door_01)",
    },
    {
        building: "vault_01",
        kind: "door",
        lore: "obvious",
        use: "vault_door_main",
        rooms: [{ building: "vault_01" }],
        value: 60,
        source: "bank vault door: used by hand, opens 4.1 s later (vault_door_main openDelay)",
    },
    {
        building: "vault_01b",
        kind: "door",
        lore: "obvious",
        use: "vault_door_main",
        rooms: [{ building: "vault_01b" }],
        value: 60,
        source: "desert bank vault door: used by hand, opens 4.1 s later",
    },
    {
        building: "military_bunker_vault_01",
        kind: "door",
        lore: "obvious",
        use: "vault_door_main",
        rooms: [{ building: "military_bunker_vault_01" }],
        value: 75,
        source:
            "the military base's basement vault: the bank vault door, used by hand, opens 4.1 s later (rebirth " +
            "military base, docs/research/rebirth-deviations.md; packages/defs rebirth/buildings/military/bunker.ts)",
    },
    // The rebirth buildings' hidden rooms (2026-10-10 rework, grown and four more added by PR #18 the same day;
    // docs/research/rebirth-deviations.md "Hidden rooms expanded"; packages/defs rebirth/buildings/). Appended last so
    // every older entry keeps its knowledge draw (the PR #18 buildings after the first eight). A single switch is
    // obvious; a two- or three-switch code whose order a note in the same building shows is common (the players who
    // notice the note). Rooms: the layout's hidden room in the building's own frame (a military part's: its compound
    // box less its centre).
    ...(
        [
            ["clinic_01", "obvious", ["1"], [9, -1, 17, 12], 55, "the drug safe"],
            ["radio_station_01", "common", ["yellow", "red", "blue"], [-5, 3, 6, 12], 60, "the signals vault"],
            // three switches since PR #18, the order on the note on the archive floor
            ["library_01", "common", ["red", "yellow", "green"], [10.75, -14, 19, 0], 60, "the rare-books vault"],
            ["firestation_01", "obvious", ["1"], [-6.5, 1.5, 3.5, 12.5], 60, "the gear cage"],
            ["outpost_01r", "obvious", ["1"], [-14, 0, 0, 11], 55, "the armory"],
            ["outpost_01b", "obvious", ["1"], [-14, 0, 0, 11], 55, "the armory"],
            ["military_gatehouse_01", "obvious", ["1"], [-1.75, -3.5, 6, 3.5], 35, "the weapons cage"],
            ["military_bunker_command_01", "common", ["red", "yellow", "green"], [-5, -7, 5, 2.5], 60, "the war chest"],
            // PR #18: the code chalked on the floor before the magazine's door
            ["blockhouse_01r", "common", ["blue", "red"], [-6, -3.5, 6, 3.5], 60, "the blockhouse magazine"],
            ["blockhouse_01b", "common", ["blue", "red"], [-6, -3.5, 6, 3.5], 60, "the blockhouse magazine"],
            ["military_armory_01", "obvious", ["1"], [0.5, -1, 9.5, 9], 60, "the gun cage"],
            // PR #18: the staff code, its note on the commander's office floor
            ["military_hq_01", "common", ["blue", "red", "green"], [6.5, 0, 15.5, 9], 45, "the commander's archive"],
            ["military_hq_01r", "common", ["blue", "red", "green"], [6.5, 0, 15.5, 9], 45, "the commander's archive"],
            ["military_hq_01b", "common", ["blue", "red", "green"], [6.5, 0, 15.5, 9], 45, "the commander's archive"],
            ["military_infirmary_01", "obvious", ["1"], [5, -2, 12, 9], 40, "the narcotics store"],
            // PR #19, the owner's wave 3 (2026-10-10), appended so every older entry keeps its draw: a single switch is
            // obvious, every code has its note in the same building (common). Rooms in the puzzle building's frame
            // (the radar's ops room and the plant's control building: their compound rooms less the building's offset,
            // radar_ops_01 at (30.5, 13), power_plant_control_01 at (-0.5, -21.5)).
            ["gas_station_store_01", "obvious", ["1"], [0, 8, 11, 17], 55, "the gas station's back office"],
            ["church_01", "common", ["blue", "yellow", "red"], [-17, 14, -8, 26], 55, "the church's reliquary"],
            ["mall_01", "common", ["green", "yellow", "red", "blue"], [2, 23, 14, 34], 65, "the mall's security vault"],
            [
                "power_plant_control_01",
                "common",
                ["green", "red", "yellow"],
                [4.5, 1.5, 17.5, 13.5],
                60,
                "the plant's strongroom",
            ],
            ["radar_ops_01", "common", ["blue", "yellow", "red"], [1.5, 4, 14.5, 15], 65, "the radar's crypto vault"],
            ["capitol_01", "common", ["red", "green", "blue"], [24, 9, 32, 23], 60, "the governor's vault"],
            ["apartment_01", "obvious", ["1"], [17, 7, 31, 16], 55, "the caretaker's storeroom"],
            ["port_checkpoint_01", "obvious", ["1"], [-17, 2, -6, 17], 65, "the checkpoint's evidence vault"],
            ["cargo_ship_01", "common", ["red", "green"], [-10.5, -41.5, 1, -33], 65, "the captain's cabin"],
            [
                "subway_platform_01",
                "common",
                ["red", "yellow", "blue"],
                [21, -6, 32, 4],
                60,
                "the station master's safe",
            ],
        ] as const
    ).map(
        ([building, lore, code, [x0, y0, x1, y1], value, room]): PuzzleSpec => ({
            building,
            kind: "code",
            lore,
            code,
            rooms: [{ box: { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } } }],
            value,
            source: `${room}: rebirth switch puzzle (REBIRTH_PUZZLE_CODES, docs/research/rebirth-deviations.md)`,
        }),
    ),
];

function obstacle(type: string): ObstacleDef | undefined {
    if (!hasMapObjectDef(type)) return undefined;
    const d = MapObjectDefs[type];
    return d.type === "obstacle" ? d : undefined;
}

function building(type: string): BuildingDef | undefined {
    if (!hasMapObjectDef(type)) return undefined;
    const d = MapObjectDefs[type];
    return d.type === "building" ? d : undefined;
}

/** The pieces, the moved doors and the delays of a spec, read from its building def. */
function derive(spec: PuzzleSpec): PuzzleEntry {
    const def = building(spec.building);
    if (!def) throw new Error(`puzzle building ${spec.building} is not a building def`);
    const pieces: PuzzlePiece[] = [];
    const opens: PuzzleOpens[] = [];
    let openAfter = 0;
    let pieceWindow = Number.POSITIVE_INFINITY;
    let errorReset = 0;
    const puzzle = def.puzzle;
    for (const c of def.mapObjects) {
        if (typeof c.type !== "string") continue;
        const ob = obstacle(c.type);
        if (!ob) continue;
        const pos = { x: c.pos.x, y: c.pos.y };
        if (spec.kind === "code") {
            // labels on things that are no buttons (the saloon's barrel, gun mount, column) are scenery
            if (c.puzzlePiece && ob.button) {
                pieces.push({ type: c.type, pos, ori: c.ori, label: c.puzzlePiece, reach: ob.button.interactionRad });
                if (c.layer !== undefined) pieces[pieces.length - 1].layer = c.layer;
            }
            if (puzzle && c.type === puzzle.completeUseType) opens.push({ type: c.type, pos, ori: c.ori });
        } else if (c.type === spec.use) {
            const reach = ob.button?.interactionRad ?? ob.door?.interactionRad ?? 0;
            pieces.push({ type: c.type, pos, ori: c.ori, label: "", reach });
            if (spec.kind === "door") {
                opens.push({ type: c.type, pos, ori: c.ori });
                openAfter = ob.door?.openDelay ?? 0;
            } else {
                openAfter = ob.button?.useDelay ?? 0;
            }
        }
    }
    if (spec.kind === "panel") {
        const use = obstacle(spec.use ?? "")?.button?.useType ?? "";
        for (const c of def.mapObjects) {
            if (c.type === use) opens.push({ type: use, pos: { x: c.pos.x, y: c.pos.y }, ori: c.ori });
        }
    }
    if (spec.kind === "code" && puzzle) {
        openAfter = puzzle.completeUseDelay;
        pieceWindow = puzzle.pieceResetDelay;
        errorReset = puzzle.errorResetDelay;
    }
    return { ...spec, name: puzzle?.name ?? spec.building, pieces, opens, openAfter, pieceWindow, errorReset };
}

/** Every locked room a player can open, by building def id. */
export const PUZZLES: ReadonlyMap<string, PuzzleEntry> = new Map(SPECS.map((s) => [s.building, derive(s)]));

/** The code of an entry on a map (the Woods maps' Eye bunker code), or [] for panels and doors. */
export function codeOf(entry: PuzzleEntry, mapName: string): readonly string[] {
    if (entry.woodsCode && hasWoods(mapName)) return entry.woodsCode;
    return entry.code ?? [];
}

function hasWoods(mapName: string): boolean {
    try {
        return !!getMapDef(mapName).gameMode.woodsMode;
    } catch {
        return false;
    }
}

/** Chance (per tier) that a bot learned a solution of each lore (persona-scaled in knowsChance). */
const LORE_CHANCE: Readonly<Record<PuzzleLore, Readonly<Record<SkillProfile["tier"], number>>>> = {
    obvious: { beginner: 1, intermediate: 1, expert: 1 },
    common: { beginner: 0.12, intermediate: 0.65, expert: 0.95 },
    rare: { beginner: 0.03, intermediate: 0.3, expert: 0.8 },
    squad: { beginner: 0.03, intermediate: 0.3, expert: 0.8 },
};

/** Chance a bot of this tier and persona knows an entry (thorough looters learn more codes, rushers fewer). */
export function knowsChance(lore: PuzzleLore, tier: SkillProfile["tier"], persona: Readonly<PersonaParams>): number {
    const base = LORE_CHANCE[lore][tier];
    if (base >= 1) return 1;
    return Math.min(1, base * (0.8 + 0.4 * persona.lootThoroughness));
}

/** Chance per attempt that a bot who knows a code slips and presses two pieces the wrong way round (error, retry). */
export const SLIP_CHANCE: Readonly<Record<SkillProfile["tier"], number>> = {
    beginner: 0.3,
    intermediate: 0.1,
    expert: 0.03,
};

/**
 * The solutions a bot knows (knowledge keys, PuzzleEntry.name), drawn once from its own stream: one draw per puzzle in
 * table order, so the result depends only on the seed, the tier and the persona.
 */
export function drawPuzzleKnowledge(
    seed: number,
    skill: Readonly<SkillProfile>,
    persona: Readonly<PersonaParams>,
): Set<string> {
    const rng = createRng((seed ^ PUZZLE_SALT) >>> 0);
    const known = new Set<string>();
    const drawn = new Set<string>();
    for (const e of PUZZLES.values()) {
        // variants of one puzzle (the chrys compartments) share one draw
        if (drawn.has(e.name)) continue;
        drawn.add(e.name);
        const u = rng.next();
        if (u < knowsChance(e.lore, skill.tier, persona)) known.add(e.name);
    }
    return known;
}
