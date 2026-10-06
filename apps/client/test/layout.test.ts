// HUD layout rules (M8; survev device.ts onResize, ui.ts resize, touch.ts setMobileStyling, ui2.ts mobile animations;
// docs/research/ui/hud.md "Layout", "Kill feed", "Inventory, gear and perks").
import { describe, expect, it } from "vitest";
import {
    AMMO_ORDER_LANDSCAPE,
    AMMO_ORDER_PORTRAIT,
    ammoOrder,
    hudScale,
    itemPopScale,
    killFeedOpacity,
    killFeedSpacing,
    layoutState,
    SM_HUD_SCALE,
    uiLayoutFor,
} from "../src/ui/uiLayout.ts";

describe("ui layout", () => {
    it("is small on mobile, at a longer side <= 850 px, or <= 900 px at pixel ratio >= 3", () => {
        expect(uiLayoutFor(1280, 720, 1, false)).toBe("lg");
        expect(uiLayoutFor(1280, 720, 1, true)).toBe("sm");
        expect(uiLayoutFor(844, 390, 1, false)).toBe("sm");
        expect(uiLayoutFor(390, 844, 1, false)).toBe("sm");
        expect(uiLayoutFor(851, 600, 1, false)).toBe("lg");
        expect(uiLayoutFor(890, 400, 3, false)).toBe("sm");
        expect(uiLayoutFor(890, 400, 2, false)).toBe("lg");
        // the longer side decides: a tall narrow desktop window keeps the large layout
        expect(uiLayoutFor(800, 1000, 1, false)).toBe("lg");
    });

    it("scales the small HUD by 0.5626, the large one by the desktop factor", () => {
        expect(hudScale(layoutState(844, 390, 1, true))).toBe(SM_HUD_SCALE);
        expect(hudScale(layoutState(1920, 1080, 1, false))).toBe(1);
        expect(hudScale(layoutState(1280, 720, 1, false))).toBeCloseTo(0.75 * 1);
    });

    it("lists the common calibres first on small portrait screens", () => {
        expect(ammoOrder(layoutState(844, 390, 1, true))).toEqual(AMMO_ORDER_LANDSCAPE);
        expect(ammoOrder(layoutState(390, 844, 1, true))).toEqual(AMMO_ORDER_PORTRAIT);
        expect(ammoOrder(layoutState(1280, 720, 1, false))).toEqual(AMMO_ORDER_LANDSCAPE);
        expect(AMMO_ORDER_PORTRAIT.slice(0, 4)).toEqual(["9mm", "12gauge", "762mm", "556mm"]);
    });
});

describe("mobile animations", () => {
    it("spaces kill feed lines 15 px on the small layout and does not fade them on mobile", () => {
        expect(killFeedSpacing(false)).toBe(35);
        expect(killFeedSpacing(true)).toBe(15);
        expect(killFeedOpacity(0.1, false)).toBeGreaterThan(0);
        expect(killFeedOpacity(0.1, false)).toBeLessThan(1);
        expect(killFeedOpacity(0.1, true)).toBe(1);
        expect(killFeedOpacity(6.25, true)).toBe(1);
        expect(killFeedOpacity(6.5, true)).toBe(0);
        expect(killFeedOpacity(7, false)).toBe(0);
    });

    it("pops item images to 1.33 when the count goes up, except on mobile", () => {
        expect(itemPopScale(0, false)).toBe(1);
        expect(itemPopScale(0.05 * (Math.PI / 2), false)).toBeCloseTo(1.33);
        expect(itemPopScale(1, false)).toBe(1);
        expect(itemPopScale(0.05 * (Math.PI / 2), true)).toBe(1);
    });
});
