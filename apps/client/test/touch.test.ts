// Touch stick geometry and touch-mode detection (M8; survev ui/touch.ts, device.ts; controls.md "Mobile and touch
// controls").
import { describe, expect, it } from "vitest";
import { detectTouch } from "../src/input/device.ts";
import { isIphoneX, isShooting, movePull, padLayout, readStick } from "../src/input/touchSticks.ts";

const PC = { ios: false, iphoneX: false };

describe("pad layout", () => {
    it("uses range 48 x 1 in landscape and the 126 / 100 px locked centres", () => {
        const l = padLayout(844, 390, PC);
        expect(l.scale).toBe(1);
        expect(l.range).toBe(48);
        expect(l.left).toEqual({ x: 126, y: 290 });
        expect(l.right).toEqual({ x: 844 - 126, y: 290 });
    });

    it("uses range 48 x 0.8 in portrait and the 96 / 160 px locked centres", () => {
        const l = padLayout(390, 844, PC);
        expect(l.scale).toBe(0.8);
        expect(l.range).toBeCloseTo(38.4);
        expect(l.left).toEqual({ x: 96, y: 844 - 160 });
    });

    it("raises the sticks on iOS Safari and moves them in on an iPhone X", () => {
        expect(padLayout(844, 390, { ios: true, iphoneX: false }).left.y).toBe(390 - 120);
        expect(padLayout(390, 844, { ios: true, iphoneX: false }).left.y).toBe(844 - 240);
        const x = padLayout(812, 375, { ios: true, iphoneX: true });
        expect(x.left).toEqual({ x: 126 + 56, y: 375 - 90 });
        expect(isIphoneX(true, 375, 812)).toBe(true);
        expect(isIphoneX(false, 375, 812)).toBe(false);
    });
});

describe("sticks", () => {
    it("ignores the 2 px dead zone and clamps the knob to the range", () => {
        expect(readStick({ x: 100, y: 100 }, { x: 101, y: 101 }, 48).dir).toBeNull();
        const r = readStick({ x: 100, y: 100 }, { x: 200, y: 100 }, 48);
        expect(r.dir).toEqual({ x: 1, y: 0 });
        expect(r.dist).toBe(100);
        expect(r.knob).toEqual({ x: 148, y: 100 });
    });

    it("pulls 0-1 between the dead zone and the range, and shoots beyond range / 1.075", () => {
        expect(movePull(2, 48)).toBe(0);
        expect(movePull(25, 48)).toBeCloseTo(0.5);
        expect(movePull(80, 48)).toBe(1);
        expect(isShooting(44, 48)).toBe(false);
        expect(isShooting(45, 48)).toBe(true);
    });
});

describe("touch mode", () => {
    it("follows ?touch=, coarse pointers and mobile user agents", () => {
        const desktop = "Mozilla/5.0 (X11; Linux x86_64) Chrome/130";
        expect(detectTouch("", false, desktop)).toBe(false);
        expect(detectTouch("?touch=1", false, desktop)).toBe(true);
        expect(detectTouch("?touch=0", true, "Android")).toBe(false);
        expect(detectTouch("", true, desktop)).toBe(true);
        expect(detectTouch("", false, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(true);
        expect(detectTouch("", false, "Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5)).toBe(true);
    });
});
