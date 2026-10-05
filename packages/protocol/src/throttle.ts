// Client input throttle: at most one Input message per `minIntervalMs` (one per 60 Hz frame), sent at once when the
// input changed, delayed to the next slot when the previous send was too recent, and repeated every `keepaliveMs`
// when nothing changes (the original client sends on change or after 1 s; netcode.md "Rates and timing").
// One-shot parts (shootStart, actions) of inputs coalesced into one message are merged, never dropped.
import type { PlayerInput } from "@rebirth/sim";
import { NetLimits } from "./constants.ts";
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
    if (next.shootStart || next.actions.length > 0) return true;
    if (
        prev.moveLeft !== next.moveLeft ||
        prev.moveRight !== next.moveRight ||
        prev.moveUp !== next.moveUp ||
        prev.moveDown !== next.moveDown ||
        prev.shootHold !== next.shootHold
    ) {
        return true;
    }
    const lenQ = (v: number) => quantize(v, 0, NetLimits.MouseMaxDist, 8);
    if (lenQ(prev.toMouseLen) !== lenQ(next.toMouseLen)) return true;
    return (
        quantizeUnit(prev.toMouseDir.x, 10) !== quantizeUnit(next.toMouseDir.x, 10) ||
        quantizeUnit(prev.toMouseDir.y, 10) !== quantizeUnit(next.toMouseDir.y, 10)
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
        if (this.pending) {
            merged.shootStart ||= this.pending.shootStart;
            merged.actions = [...this.pending.actions, ...input.actions].slice(0, NetLimits.MaxInputActions);
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
