// Validation of decoded client inputs before they reach the simulation: unit vectors normalized, lengths clamped,
// unknown or non-discrete actions dropped, the action list capped.
import { Input } from "@rebirth/defs";
import { NetLimits } from "@rebirth/protocol";
import type { PlayerInput } from "@rebirth/sim";

/** Discrete inputs a client may send (movement and fire are flags of the Input message, not actions). */
const ACCEPTED_ACTIONS = new Set<number>(
    Object.values(Input).filter(
        (v) =>
            v !== Input.Count &&
            v !== Input.MoveLeft &&
            v !== Input.MoveRight &&
            v !== Input.MoveUp &&
            v !== Input.MoveDown &&
            v !== Input.Fire,
    ),
);

/** Most actions accepted per message (the original client sends at most 7; survev inputMsg.ts). */
export const MAX_ACTIONS_PER_INPUT = 7;

export function sanitizeInput(input: PlayerInput, prevDir: { x: number; y: number }): PlayerInput {
    const { x, y } = input.toMouseDir;
    const len = Math.hypot(x, y);
    const toMouseDir = Number.isFinite(len) && len > 1e-6 ? { x: x / len, y: y / len } : { x: prevDir.x, y: prevDir.y };
    const mouseLen = Number.isFinite(input.toMouseLen) ? input.toMouseLen : 0;
    const actions: number[] = [];
    for (const a of input.actions) {
        if (actions.length >= MAX_ACTIONS_PER_INPUT) break;
        if (Number.isInteger(a) && ACCEPTED_ACTIONS.has(a)) actions.push(a);
    }
    const out: PlayerInput = {
        seq: input.seq & 0xff,
        moveLeft: input.moveLeft === true,
        moveRight: input.moveRight === true,
        moveUp: input.moveUp === true,
        moveDown: input.moveDown === true,
        toMouseDir,
        toMouseLen: Math.min(Math.max(mouseLen, 0), NetLimits.MouseMaxDist),
        shootStart: input.shootStart === true,
        shootHold: input.shootHold === true,
        actions,
    };
    // the item to use (M5): any non-empty string; the simulation ignores ids that are not bag items
    if (typeof input.useItem === "string" && input.useItem !== "") out.useItem = input.useItem;
    return out;
}
