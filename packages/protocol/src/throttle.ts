// Client input throttle: at most one Input message per `minIntervalMs` (one per 60 Hz frame), sent at once when the
// input changed, delayed to the next slot when the previous send was too recent, and repeated every `keepaliveMs`
// when nothing changes (the original client sends on change or after 1 s; netcode.md "Rates and timing").
// One-shot parts (shootStart, actions, useItem) of inputs coalesced into one message are merged, never dropped.
import type { Vec2 } from "@rebirth/core";
import type { PlayerInput } from "@rebirth/sim";
import { NetLimits } from "./constants.ts";
import { INPUT_MOUSE_DIR_BITS, INPUT_MOUSE_LEN_BITS, INPUT_TOUCH_DIR_BITS, touchMoveLenWire } from "./messages.ts";
import { quantize, quantizeUnit } from "./quant.ts";

export interface InputThrottleOptions {
    /** minimum time between two messages (default 1000 / 60 ms) */
    minIntervalMs?: number;
    /** resend an unchanged input after this long (default 1000 ms) */
    keepaliveMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
}

/** Whether `next` must be sent given the last sent input (compared as wire values). */
export function inputChanged(prev: PlayerInput | null, next: PlayerInput): boolean {
    if (!prev) return true;
    if (next.shootStart || next.actions.length > 0 || next.useItem) return true;
    if (
        prev.moveLeft !== next.moveLeft ||
        prev.moveRight !== next.moveRight ||
        prev.moveUp !== next.moveUp ||
        prev.moveDown !== next.moveDown ||
        prev.shootHold !== next.shootHold
    ) {
        return true;
    }
    // the touch stick (M8): its active bit, and while active its 8-bit direction and pull
    const touch = next.touchMoveActive === true;
    if ((prev.touchMoveActive === true) !== touch) return true;
    if (touch) {
        if (touchMoveLenWire(prev.touchMoveLen) !== touchMoveLenWire(next.touchMoveLen)) return true;
        if (unitChanged(prev.touchMoveDir, next.touchMoveDir, INPUT_TOUCH_DIR_BITS)) return true;
    }
    const lenQ = (v: number) => quantize(v, 0, NetLimits.MouseMaxDist, INPUT_MOUSE_LEN_BITS);
    if (lenQ(prev.toMouseLen) !== lenQ(next.toMouseLen)) return true;
    return unitChanged(prev.toMouseDir, next.toMouseDir, INPUT_MOUSE_DIR_BITS);
}

/** Whether two unit vectors differ on the wire (`bits` per component; absent is the writer's +x default). */
function unitChanged(a: Vec2 | undefined, b: Vec2 | undefined, bits: number): boolean {
    const pa = a ?? { x: 1, y: 0 };
    const pb = b ?? { x: 1, y: 0 };
    return (
        quantizeUnit(pa.x, bits) !== quantizeUnit(pb.x, bits) || quantizeUnit(pa.y, bits) !== quantizeUnit(pb.y, bits)
    );
}

export class InputThrottle {
    private readonly send: (input: PlayerInput) => void;
    private readonly minInterval: number;
    private readonly keepalive: number;
    private readonly now: () => number;
    private readonly setTimer: (fn: () => void, ms: number) => unknown;
    private readonly clearTimer: (handle: unknown) => void;
    private lastSent: PlayerInput | null = null;
    private lastSentTime = Number.NEGATIVE_INFINITY;
    private pending: PlayerInput | null = null;
    private timer: unknown = null;
    /** messages sent so far */
    sent = 0;

    constructor(send: (input: PlayerInput) => void, opts: InputThrottleOptions = {}) {
        this.send = send;
        this.minInterval = opts.minIntervalMs ?? 1000 / 60;
        this.keepalive = opts.keepaliveMs ?? 1000;
        this.now = opts.now ?? (() => performance.now());
        this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
        this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    }

    /** Offers the latest input; it is sent now, later (merged with newer inputs) or not at all if unchanged. */
    push(input: PlayerInput): void {
        const merged: PlayerInput = { ...input, toMouseDir: { ...input.toMouseDir }, actions: [...input.actions] };
        if (input.touchMoveDir) merged.touchMoveDir = { ...input.touchMoveDir };
        if (this.pending) {
            merged.shootStart ||= this.pending.shootStart;
            merged.actions = [...this.pending.actions, ...input.actions].slice(0, NetLimits.MaxInputActions);
            // the wire carries one useItem per message: keep the earlier request (a second one within the same
            // 16 ms slot is dropped)
            merged.useItem = this.pending.useItem || input.useItem;
        }
        this.pending = merged;
        const now = this.now();
        const since = now - this.lastSentTime;
        if (this.timer !== null) return;
        if (!inputChanged(this.lastSent, merged)) {
            if (since >= this.keepalive) this.flush();
            else this.pending = null;
            return;
        }
        if (since >= this.minInterval) this.flush();
        else this.timer = this.setTimer(this.onTimer, this.minInterval - since);
    }

    /** Sends the pending input now (if any). */
    flush(): void {
        if (this.timer !== null) {
            this.clearTimer(this.timer);
            this.timer = null;
        }
        const input = this.pending;
        if (!input) return;
        this.pending = null;
        this.lastSent = input;
        this.lastSentTime = this.now();
        this.sent++;
        this.send(input);
    }

    dispose(): void {
        if (this.timer !== null) this.clearTimer(this.timer);
        this.timer = null;
        this.pending = null;
    }

    private readonly onTimer = (): void => {
        this.timer = null;
        this.flush();
    };
}
