// Player input sent from client to simulation every client frame (the original InputMsg).
import type { Vec2 } from "@rebirth/core";

export interface PlayerInput {
    /** increments every message; acknowledged in snapshots later for prediction */
    seq: number;
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    /** unit vector from the player towards the mouse, in world space (+y is up) */
    toMouseDir: Vec2;
    /** distance from the player to the mouse in world units */
    toMouseLen: number;
    shootStart: boolean;
    shootHold: boolean;
    /** one-shot actions this frame: values of the defs `Input` constants (reload, interact, equip...) */
    actions: number[];
    /**
     * Bag item to use this frame (M5; the original InputMsg.useItem): a heal or boost starts its use action, a scope
     * is equipped, a throwable is selected in the throwable slot. Absent or "" for none.
     */
    useItem?: string;
    /**
     * Touch movement stick (M8; the original InputMsg touchMoveActive / touchMoveDir / touchMoveLen, survev
     * shared/net/inputMsg.ts:39-43): while active with a non-zero length the player walks along `touchMoveDir` instead
     * of the move keys; the length (0-255, 8 bits on the wire) does not scale the speed (survev player.ts:1925-1928).
     */
    touchMoveActive?: boolean;
    /** unit vector of the touch movement stick, world space (+y is up) */
    touchMoveDir?: Vec2;
    /** pull of the touch movement stick, 0-255 */
    touchMoveLen?: number;
}

export function emptyInput(seq = 0): PlayerInput {
    return {
        seq,
        moveLeft: false,
        moveRight: false,
        moveUp: false,
        moveDown: false,
        toMouseDir: { x: 1, y: 0 },
        toMouseLen: 0,
        shootStart: false,
        shootHold: false,
        actions: [],
    };
}
