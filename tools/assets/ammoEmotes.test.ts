// Ping emote icons of the new ammo (ammoEmotes.ts): the original ammo emotes' three squares (frame, mid, inner) in the
// ammo's loot tint at the originals' shades, transparent outside, one per new ammo with the texture its emote def names.

import { describe, expect, it } from "vitest";
import { getDefOfType, NEW_AMMO_EMOTES, NEW_AMMO_IDS } from "../../packages/defs/src/index.ts";
import { AMMO_EMOTE_SIZE, ammoEmoteIcon } from "./ammoEmotes.ts";

const pixel = (img: ReturnType<typeof ammoEmoteIcon>, x: number, y: number) => {
    const i = (y * img.width + x) * 4;
    return [...img.data.slice(i, i + 4)];
};

describe("new ammo ping emote icons", () => {
    it("frame, mid and inner squares at the originals' shades of the tint; transparent outside", () => {
        const tint = 0xff5fb4;
        const img = ammoEmoteIcon(tint);
        expect([img.width, img.height]).toEqual([AMMO_EMOTE_SIZE, AMMO_EMOTE_SIZE]);
        const shade = (k: number) => [0xff, 0x5f, 0xb4].map((c) => Math.round(c * k));
        expect(pixel(img, 2, 2)).toEqual([0, 0, 0, 0]);
        expect(pixel(img, 12, 64)).toEqual([...shade(0.21), 255]);
        expect(pixel(img, 30, 90)).toEqual([...shade(0.74), 255]);
        expect(pixel(img, 70, 55)).toEqual([...shade(1), 255]);
        // smooth edges: a pixel across the frame's edge is partly covered
        expect(pixel(img, 7, 64)[3]).toBe(0);
        expect(pixel(img, 8, 64)[3]).toBe(255);
        expect(pixel(img, 8, 8)[3]).toBeLessThan(255);
    });

    it("one per new ammo, in its loot tint, under the texture its emote names", () => {
        for (const id of NEW_AMMO_IDS) {
            expect(getDefOfType("emote", NEW_AMMO_EMOTES[id]).texture).toBe(`ammo-${id}.img`);
            const tint = getDefOfType("ammo", id).lootImg.tint;
            expect(pixel(ammoEmoteIcon(tint), 70, 55).slice(0, 3)).toEqual([tint >> 16, (tint >> 8) & 255, tint & 255]);
        }
    });
});
