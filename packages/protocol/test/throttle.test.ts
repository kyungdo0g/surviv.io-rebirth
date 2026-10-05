// InputThrottle: at most one message per 60 Hz slot, immediate on change, merged one-shots, 1 s keepalive.
import { Input } from "@rebirth/defs";
import { emptyInput, type PlayerInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { InputThrottle, inputChanged } from "../src/index.ts";

function harness() {
    let now = 0;
    const sent: PlayerInput[] = [];
    const timers: Array<{ at: number; fn: () => void }> = [];
    const throttle = new InputThrottle((i) => sent.push(i), {
        now: () => now,
        setTimer: (fn, ms) => {
            const t = { at: now + ms, fn };
            timers.push(t);
            return t;
        },
        clearTimer: (h) => {
            const i = timers.indexOf(h as (typeof timers)[number]);
            if (i >= 0) timers.splice(i, 1);
        },
    });
    const advance = (ms: number) => {
        now += ms;
        for (const t of [...timers].sort((a, b) => a.at - b.at)) {
            if (t.at > now) continue;
            timers.splice(timers.indexOf(t), 1);
            t.fn();
        }
    };
    return { throttle, sent, advance };
}

describe("InputThrottle", () => {
    it("sends the first input and changes at once, but at most once per frame", () => {
        const { throttle, sent, advance } = harness();
        throttle.push({ ...emptyInput(1) });
        expect(sent.length).toBe(1);
        advance(5);
        throttle.push({ ...emptyInput(2), moveUp: true });
        expect(sent.length).toBe(1); // too soon: scheduled for the next slot
        throttle.push({ ...emptyInput(3), moveUp: true, moveLeft: true });
        advance(12);
        expect(sent.length).toBe(2);
        expect(sent[1].seq).toBe(3);
        expect(sent[1].moveLeft).toBe(true);
    });

    it("skips unchanged inputs and sends a keepalive after a second", () => {
        const { throttle, sent, advance } = harness();
        throttle.push(emptyInput(1));
        for (let i = 0; i < 59; i++) {
            advance(1000 / 60);
            throttle.push(emptyInput(i + 2));
        }
        expect(sent.length).toBe(1);
        advance(20);
        throttle.push(emptyInput(100));
        expect(sent.length).toBe(2);
    });

    it("merges one-shot actions and shootStart of coalesced inputs", () => {
        const { throttle, sent, advance } = harness();
        throttle.push(emptyInput(1));
        advance(2);
        throttle.push({ ...emptyInput(2), shootStart: true, actions: [Input.Reload] });
        throttle.push({ ...emptyInput(3), actions: [Input.EquipPrimary] });
        throttle.push(emptyInput(4));
        advance(20);
        expect(sent.length).toBe(2);
        expect(sent[1].shootStart).toBe(true);
        expect(sent[1].actions).toEqual([Input.Reload, Input.EquipPrimary]);
        expect(sent[1].seq).toBe(4);
    });

    it("compares inputs as wire values", () => {
        const a = { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, toMouseLen: 10 };
        expect(inputChanged(a, { ...a, toMouseDir: { x: 1, y: 0.00001 } })).toBe(false);
        expect(inputChanged(a, { ...a, toMouseDir: { x: 0.99, y: 0.14 } })).toBe(true);
        expect(inputChanged(a, { ...a, toMouseLen: 10.01 })).toBe(false);
        expect(inputChanged(a, { ...a, shootHold: true })).toBe(true);
        expect(inputChanged(null, a)).toBe(true);
    });
});
