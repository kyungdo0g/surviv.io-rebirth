// Puzzles, buttons and recorders (M5b): pieces pressed in the code's order solve the puzzle and open its door after
// completeUseDelay; a wrong order or an idle pause is an error that locks the pieces for errorResetDelay, then
// resets them; solved puzzles switch their structure's interior music; buttons with a useType move their building's
// doors; Woods uses its own Eye code; recorders report a RecorderEvent to viewers in range.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import {
    type Building,
    type Game,
    interactObstacle,
    type Obstacle,
    type Player,
    PUZZLE_CODES,
    puzzleCode,
} from "../src/index.ts";
import {
    childObstacles,
    findBuilding,
    findStructure,
    interact,
    mapGame,
    placePlayer,
    stepSeconds,
} from "./buildingHelpers.ts";

/** The puzzle pieces of a building by label. */
function pieces(game: Game, building: Building): Map<string, Obstacle> {
    const out = new Map<string, Obstacle>();
    for (const o of childObstacles(game, building)) if (o.puzzlePiece && o.button) out.set(o.puzzlePiece, o);
    return out;
}

function press(game: Game, p: Player, piece: Obstacle): void {
    interactObstacle(game, piece, p);
}

/** Presses `labels` in order, one tick apart. */
function enter(game: Game, p: Player, building: Building, labels: readonly string[]): void {
    const byLabel = pieces(game, building);
    for (const label of labels) {
        const piece = byLabel.get(label);
        if (!piece) throw new Error(`no piece ${label}`);
        press(game, p, piece);
        game.step();
    }
}

describe("the puzzle engine", () => {
    it("opens the club's secret door 2 s after the switches are pressed in order", () => {
        const game = mapGame();
        const club = findBuilding(game, "club_01");
        const [door] = childObstacles(game, club, "secret_door_club");
        const p = placePlayer(game, club.pos);
        expect([...pieces(game, club).keys()].sort()).toEqual(["1", "2", "3", "4"]);
        enter(game, p, club, ["1", "2", "3", "4"]);
        expect(club.puzzle?.solved).toBe(true);
        expect(club.toView().puzzle).toEqual({ solved: true, errSeq: 0 });
        expect(door.door?.open).toBe(false);
        // enter() stepped once after the last piece
        stepSeconds(game, 1.97);
        expect(door.door?.open).toBe(false);
        stepSeconds(game, 0.03);
        expect(door.door?.open).toBe(true);
        // the pieces reset to off and stay locked once solved
        for (const piece of pieces(game, club).values())
            expect(piece.button).toMatchObject({ onOff: false, canUse: false });
    });

    it("a wrong order counts an error, locks the pieces for errorResetDelay, then resets them", () => {
        const game = mapGame();
        const club = findBuilding(game, "club_01");
        const [door] = childObstacles(game, club, "secret_door_club");
        const p = placePlayer(game, club.pos);
        enter(game, p, club, ["2", "1", "3"]);
        expect(club.puzzle?.errSeq).toBe(0);
        enter(game, p, club, ["4"]);
        expect(club.puzzle).toMatchObject({ solved: false, errSeq: 1 });
        const byLabel = pieces(game, club);
        // input is ignored while the reset runs (the used pieces are locked)
        for (const piece of byLabel.values()) expect(piece.button?.canUse).toBe(false);
        stepSeconds(game, 1);
        for (const piece of byLabel.values()) expect(piece.button).toMatchObject({ onOff: false, canUse: true });
        expect(club.puzzle?.inputCode).toEqual([]);
        // now the right code works
        enter(game, p, club, ["1", "2", "3", "4"]);
        stepSeconds(game, 2.1);
        expect(door.door?.open).toBe(true);
        expect(club.puzzle?.errSeq).toBe(1);
    });

    it("pressing nothing for pieceResetDelay is an error too", () => {
        const game = mapGame();
        const club = findBuilding(game, "club_01");
        const p = placePlayer(game, club.pos);
        enter(game, p, club, ["1"]);
        stepSeconds(game, 9.9);
        expect(club.puzzle?.errSeq).toBe(0);
        stepSeconds(game, 0.2);
        expect(club.puzzle?.errSeq).toBe(1);
        stepSeconds(game, 1.1);
        expect(pieces(game, club).get("1")?.button).toMatchObject({ onOff: false, canUse: true });
    });

    it("the players press the switches with Interact from up close", () => {
        const game = mapGame();
        const club = findBuilding(game, "club_01");
        const piece = pieces(game, club).get("1")!;
        const p = placePlayer(game, v2.add(piece.pos, { x: 0, y: 0 }));
        // nudge the player out of the switch's collider, keeping it within reach
        game.step();
        interact(game, p);
        expect(piece.button?.onOff).toBe(true);
        expect(club.puzzle?.inputCode).toEqual(["1"]);
    });

    it("the bathhouse switch opens both vault doors and switches the club music", () => {
        const game = mapGame();
        const bathhouse = findBuilding(game, "bathhouse_01");
        const structure = findStructure(game, "club_structure_01");
        const doors = childObstacles(game, bathhouse, "vault_door_bathhouse");
        expect(doors.length).toBe(2);
        const p = placePlayer(game, bathhouse.pos, 1);
        expect(structure.toView().interiorSoundAlt).toBe(false);
        enter(game, p, bathhouse, ["1"]);
        expect(structure.interiorSoundAlt).toBe(true);
        expect(structure.toView().interiorSoundAlt).toBe(true);
        stepSeconds(game, 2.1);
        for (const d of doors) expect(d.door?.open).toBe(true);
    });

    it("the saloon's rainbow bottles open the cellar door and stop the piano", () => {
        const game = mapGame("desert", 1);
        const saloon = findBuilding(game, "saloon_01");
        const structure = findStructure(game, "saloon_structure_01");
        const [door] = childObstacles(game, saloon, "saloon_door_secret");
        const p = placePlayer(game, saloon.pos);
        // the barrel, gun mount and column labels are not buttons
        expect([...pieces(game, saloon).keys()].sort()).toEqual([...PUZZLE_CODES.saloon].sort());
        enter(game, p, saloon, PUZZLE_CODES.saloon);
        expect(structure.interiorSoundAlt).toBe(true);
        const closed = v2.copy(door.pos);
        stepSeconds(game, 2.1);
        expect(door.door?.open).toBe(true);
        expect(v2.distance(door.pos, closed)).toBeCloseTo(4.5, 6);
    });

    it("Woods uses its own ten-panel Eye code", () => {
        const game = mapGame("woods", 1);
        const eye = findBuilding(game, "bunker_eye_sublevel_01");
        const code = puzzleCode(game, eye);
        expect(code).toEqual(PUZZLE_CODES.bunker_eye_02_woods);
        const [vault] = childObstacles(game, eye, "vault_door_eye");
        const p = placePlayer(game, eye.pos, 1);
        // the Halloween code is not complete here (6 of 10 pieces); the idle reset clears it
        enter(game, p, eye, PUZZLE_CODES.bunker_eye_02);
        expect(eye.puzzle?.solved).toBe(false);
        stepSeconds(game, 11.2);
        expect(eye.puzzle).toMatchObject({ errSeq: 1, inputCode: [] });
        enter(game, p, eye, code ?? []);
        expect(eye.puzzle?.solved).toBe(true);
        stepSeconds(game, 5.3);
        expect(vault.door?.open).toBe(true);
    });
});

describe("buttons", () => {
    it("the police control panel opens the four cell doors 1.1 s after its use, once", () => {
        const game = mapGame();
        const police = findBuilding(game, "police_01");
        const [panel] = childObstacles(game, police, "control_panel_01");
        const cells = childObstacles(game, police, "cell_door_01");
        expect(cells.length).toBe(4);
        const p = placePlayer(game, police.pos);
        interactObstacle(game, panel, p);
        expect(panel.button).toMatchObject({ onOff: true, canUse: false });
        stepSeconds(game, 1.05);
        for (const d of cells) expect(d.door?.open).toBe(false);
        stepSeconds(game, 0.1);
        for (const d of cells) {
            expect(d.door?.open).toBe(true);
            // useDir.x -1 picks the swing side (survev toggleDoor)
            expect(d.ori).toBe((d.door!.closedOri + 1) % 4);
        }
    });
});

describe("recorders", () => {
    it("report their recording once to viewers in range", () => {
        const game = mapGame("desert", 1);
        const cellar = findBuilding(game, "saloon_cellar_01");
        const [recorder] = childObstacles(game, cellar, "recorder_04");
        const near = placePlayer(game, v2.add(recorder.pos, { x: 2, y: 0 }), 1);
        const far = placePlayer(game, v2.add(recorder.pos, { x: 200, y: 0 }), 0);
        game.getSnapshot(near.id);
        game.getSnapshot(far.id);
        interactObstacle(game, recorder, near);
        game.step();
        expect(game.getSnapshot(near.id).recorders).toEqual([
            { id: recorder.id, type: "recorder_04", sound: "log_04", pos: recorder.pos, layer: recorder.layer },
        ]);
        expect(game.getSnapshot(far.id).recorders).toEqual([]);
        game.step();
        expect(game.getSnapshot(near.id).recorders).toEqual([]);
        // used once
        expect(recorder.button?.canUse).toBe(false);
    });
});
