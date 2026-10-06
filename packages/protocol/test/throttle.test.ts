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

    it("compares the touch stick as wire values (M8: active bit, 8-bit direction, u8 pull)", () => {
        const a = { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, toMouseLen: 10 };
        const t = { ...a, touchMoveActive: true, touchMoveDir: { x: 0, y: 1 }, touchMoveLen: 200 };
        // turning the stick on or off is a change
        expect(inputChanged(a, t)).toBe(true);
        expect(inputChanged(t, a)).toBe(true);
        expect(inputChanged(t, { ...t, touchMoveActive: false })).toBe(true);
        // an inactive stick's fields are not sent, so they never count
        const off = { ...a, touchMoveActive: false, touchMoveDir: { x: 0, y: 1 }, touchMoveLen: 3 };
        expect(inputChanged(a, off)).toBe(false);
        expect(inputChanged(off, { ...off, touchMoveDir: { x: -1, y: 0 }, touchMoveLen: 250 })).toBe(false);
        // the direction counts once it moves by a quantization step (8 bits over +-1: ~0.0078)
        expect(inputChanged(t, { ...t, touchMoveDir: { x: 0.001, y: 0.9999995 } })).toBe(false);
        expect(inputChanged(t, { ...t, touchMoveDir: { x: 0.05, y: 0.99875 } })).toBe(true);
        // the pull counts by whole steps (rounded)
        expect(inputChanged(t, { ...t, touchMoveLen: 200.3 })).toBe(false);
        expect(inputChanged(t, { ...t, touchMoveLen: 201 })).toBe(true);
        expect(inputChanged(t, { ...t, touchMoveLen: undefined })).toBe(true);
        expect(inputChanged({ ...t, touchMoveLen: 255 }, { ...t, touchMoveLen: undefined })).toBe(false);
    });

    it("sends touch stick changes at once and repeats a held stick as a keepalive", () => {
        const { throttle, sent, advance } = harness();
        const stick = (seq: number, x: number, y: number) => ({
            ...emptyInput(seq),
            touchMoveActive: true,
            touchMoveDir: { x, y },
            touchMoveLen: 255,
        });
        throttle.push(stick(1, 1, 0));
        advance(20);
        throttle.push(stick(2, 1, 0));
        expect(sent.length).toBe(1);
        throttle.push(stick(3, 0, 1));
        expect(sent.length).toBe(2);
        expect(sent[1].touchMoveDir).toEqual({ x: 0, y: 1 });
        advance(20);
        throttle.push({ ...emptyInput(4) });
        expect(sent.length).toBe(3);
        expect(sent[2].touchMoveActive).toBeUndefined();
    });

    it("treats useItem as a one-shot: sent at once and kept when coalesced", () => {
        const { throttle, sent, advance } = harness();
        throttle.push({ ...emptyInput(1) });
        expect(inputChanged(sent[0], { ...emptyInput(2), useItem: "bandage" })).toBe(true);
        advance(2);
        throttle.push({ ...emptyInput(2), useItem: "bandage" });
        throttle.push({ ...emptyInput(3) });
        advance(20);
        expect(sent.map((s) => s.useItem ?? "")).toEqual(["", "bandage"]);
    });
});
