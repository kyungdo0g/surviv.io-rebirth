// Building puzzles: pieces (buttons labelled with a `puzzlePiece`) must be pressed in the order of the puzzle's code.
// The full code solves it: the pieces lock, after `completeUseDelay` the building's `completeUseType` children are
// triggered (doors toggle, buttons are pressed, anything else is destroyed) and a structure whose interior sound
// names the puzzle switches to its alternate track. A wrong full-length input, or no new piece for
// `pieceResetDelay`, is an error: the pieces lock for `errorResetDelay`, then everything resets.
// Behaviour follows survev server/src/game/objects/building.ts (puzzlePieceToggled, update, startReset,
// resetPuzzle); docs/research/maps/puzzles.md "Puzzle engine".
import { DamageType } from "@rebirth/defs";
import { destroyObstacle } from "../combat/combat.ts";
import { simMapDef } from "../modes/mapFixes.ts";
import type { SimContext } from "./context.ts";
import { toggleDoor } from "./doors.ts";
import type { Building, Obstacle } from "./entities.ts";
import { useButton } from "./interact.ts";

/**
 * Puzzle codes (server-only data, survev shared/defs/puzzles.ts). Only the puzzles whose pieces the v0.8.82 client
 * places are listed: survev's `bunker_chrys_02` code (fork 7d063420; the original compartment holds a hand-opened
 * vault, conflicts.md chrys-vault-door-use), `bunker_twins` and `reserve_vault` are fork content. Woods uses its own
 * ten-panel Eye code (maps/puzzles.md CONFLICT woods-eye-code-era).
 */
export const PUZZLE_CODES: Readonly<Record<string, readonly string[]>> = {
    bunker_eye_02: ["egg", "hydra", "storm", "conch", "crossing", "hatchet"],
    bunker_eye_02_woods: [
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
    bunker_chrys_01: ["ichi", "ni", "san", "shi"],
    saloon: ["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
    club_01: ["1", "2", "3", "4"],
    club_02: ["1"],
};

/** Timer comparisons tolerate float drift of summed 0.01 s steps. */
const TIME_EPS = 1e-9;

/** The code a building's puzzle expects on this map (Woods swaps the Eye bunker code; survev building.ts). */
export function puzzleCode(ctx: SimContext, building: Building): readonly string[] | undefined {
    const def = building.def.puzzle;
    if (!def) return undefined;
    let name = def.name;
    if (name === "bunker_eye_02" && simMapDef(ctx.world.mapData.mapName).gameMode.woodsMode) {
        name = "bunker_eye_02_woods";
    }
    return PUZZLE_CODES[name];
}

/** Direct child obstacles of a building. */
function childObstacles(ctx: SimContext, building: Building): Obstacle[] {
    const out: Obstacle[] = [];
    for (const id of building.childIds) {
        const obj = ctx.world.get(id);
        if (obj?.kind === "obstacle") out.push(obj);
    }
    return out;
}

/** Locks every piece until the reset timer runs out (survev startReset). */
function startReset(ctx: SimContext, building: Building, time: number): void {
    const puzzle = building.puzzle;
    if (!puzzle) return;
    for (const piece of childObstacles(ctx, building)) {
        if (piece.button && piece.puzzlePiece) piece.button.canUse = false;
    }
    puzzle.resetTicker = time;
}

/** Clears the input; pieces switch off and become usable again unless the puzzle is solved (survev resetPuzzle). */
function resetPuzzle(ctx: SimContext, building: Building): void {
    const puzzle = building.puzzle;
    if (!puzzle) return;
    puzzle.inputCode.length = 0;
    puzzle.idleResetTicker = 0;
    puzzle.resetTicker = 0;
    for (const piece of childObstacles(ctx, building)) {
        if (!piece.button || !piece.puzzlePiece) continue;
        piece.button.canUse = !puzzle.solved;
        piece.button.onOff = false;
        piece.button.seq++;
    }
}

/** A piece was switched on (survev puzzlePieceToggled). */
export function puzzlePieceToggled(ctx: SimContext, building: Building, piece: Obstacle): void {
    const puzzle = building.puzzle;
    const def = building.def.puzzle;
    // input is ignored while a reset runs
    if (!puzzle || !def || puzzle.resetTicker > 0) return;
    const code = puzzleCode(ctx, building);
    if (!code) return;
    puzzle.idleResetTicker = 0;
    puzzle.inputCode.push(piece.puzzlePiece);
    if (puzzle.inputCode.join("-") === code.join("-")) {
        puzzle.solved = true;
        puzzle.solvedBy = piece.interactedBy;
        const structure = building.parentStructureId ? ctx.world.get(building.parentStructureId) : undefined;
        if (structure?.kind === "structure" && structure.def.interiorSound?.puzzle === def.name) {
            structure.interiorSoundAlt = true;
        }
        startReset(ctx, building, def.completeOffDelay);
        puzzle.completeTicker = def.completeUseDelay;
    } else if (puzzle.inputCode.length >= code.length) {
        puzzle.errSeq++;
        startReset(ctx, building, def.errorResetDelay);
    } else {
        puzzle.idleResetTicker = def.pieceResetDelay;
    }
}

/** The solution's effect: every `completeUseType` child is triggered (survev building.ts update). */
function completePuzzle(ctx: SimContext, building: Building): void {
    const type = building.def.puzzle?.completeUseType;
    const solvedBy = building.puzzle?.solvedBy ?? 0;
    for (const obj of childObstacles(ctx, building)) {
        if (obj.type !== type) continue;
        if (obj.door) toggleDoor(ctx, obj, null);
        else if (obj.button) useButton(ctx, obj, null);
        else destroyObstacle(ctx, obj, { x: 0, y: 0 }, { damageType: DamageType.Player, sourceId: solvedBy });
    }
}

/** Advances a puzzle building's timers (every tick; puzzle buildings are few). */
export function updatePuzzle(ctx: SimContext, building: Building, dt: number): void {
    const puzzle = building.puzzle;
    const def = building.def.puzzle;
    if (!puzzle || !def) return;
    if (puzzle.resetTicker > 0) {
        puzzle.resetTicker -= dt;
        if (puzzle.resetTicker <= TIME_EPS) resetPuzzle(ctx, building);
    }
    if (puzzle.solved && puzzle.completeTicker > 0) {
        puzzle.completeTicker -= dt;
        if (puzzle.completeTicker <= TIME_EPS) {
            puzzle.completeTicker = 0;
            completePuzzle(ctx, building);
        }
    }
    if (puzzle.idleResetTicker > 0) {
        puzzle.idleResetTicker -= dt;
        if (puzzle.idleResetTicker <= TIME_EPS) {
            puzzle.idleResetTicker = 0;
            puzzle.errSeq++;
            startReset(ctx, building, def.errorResetDelay);
        }
    }
}
