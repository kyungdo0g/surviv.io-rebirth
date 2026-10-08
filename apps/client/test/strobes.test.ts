// Rebirth variant strobes on the client (docs/research/rebirth-deviations.md "Variant strobes"): English and Korean
// names, the kill feed naming their strike, their colours shared with the zone markers, the HUD tint of their icon
// and the greyscale copy that lets a tint recolour their yellow-green art.
import { AIRSTRIKE_VARIANT_COLORS, getDefOfType, STROBE_VARIANT_TYPES } from "@rebirth/defs";
import { afterEach, describe, expect, it } from "vitest";
import { lootHudTint } from "../src/assets/hudImages.ts";
import { greySpriteId, greyscalePixels } from "../src/assets/textures.ts";
import { hudItemName, itemName, setLang } from "../src/l10n/index.ts";
import { CARPET_ZONE_COLOR, HEAVY_ZONE_COLOR, NORMAL_ZONE_COLOR } from "../src/ui/airstrikeVariantStyle.ts";
import { airstrikeName } from "../src/ui/killFeed.ts";

afterEach(() => setLang("en"));

describe("variant strobe names", () => {
    it("name both strobes in English and Korean, after the strike they call", () => {
        const names = () => STROBE_VARIANT_TYPES.map((id) => [itemName(id), hudItemName(id)]);
        expect(names()).toEqual([
            ["Heavy Shell Strobe", "Heavy"],
            ["Carpet Bombing Strobe", "Carpet"],
        ]);
        setLang("ko");
        expect(names()).toEqual([
            ["고폭탄 스트로브", "고폭탄"],
            ["대공습 스트로브", "대공습"],
        ]);
        expect(itemName("strobe")).toBe("스트로브");
    });

    it("the kill feed says what the strike was: an air strike, a heavy shell strike or carpet bombing", () => {
        expect(["bomb_iron", "strobe", "strobe_heavy", "strobe_carpet", ""].map(airstrikeName)).toEqual([
            "an air strike",
            "an air strike",
            "a heavy shell strike",
            "carpet bombing",
            "an air strike",
        ]);
        setLang("ko");
        expect(["strobe", "strobe_heavy", "strobe_carpet"].map(airstrikeName)).toEqual([
            "공습",
            "고폭탄 공습",
            "대공습",
        ]);
    });
});

describe("variant strobe colours", () => {
    it("are the zone marker colours: heavy orange-red, carpet magenta", () => {
        expect([NORMAL_ZONE_COLOR, HEAVY_ZONE_COLOR, CARPET_ZONE_COLOR]).toEqual([0xeaff00, 0xff3c1e, 0xe040ff]);
        expect(lootHudTint("strobe_heavy")).toBe(HEAVY_ZONE_COLOR);
        expect(lootHudTint("strobe_carpet")).toBe(CARPET_ZONE_COLOR);
        expect(lootHudTint("strobe")).toBeUndefined();
        expect(getDefOfType("throwable", "strobe_carpet").worldImg.tint).toBe(AIRSTRIKE_VARIANT_COLORS.carpet);
    });

    it("recolour through a greyscale copy whose brightest parts take the full tint", () => {
        expect(greySpriteId("proj-strobe-armed.img")).toBe("proj-strobe-armed.img#grey");
        expect(greySpriteId("none")).toBe("none");
        // the armed strobe's yellow-green light (#bdd511), its dark body and a transparent pixel
        const px = new Uint8ClampedArray([0xbd, 0xd5, 0x11, 255, 0x1e, 0x1e, 0x1e, 255, 10, 200, 30, 0]);
        greyscalePixels(px);
        expect(px[0]).toBe(px[1]);
        expect(px[1]).toBe(px[2]);
        expect(px[0]).toBeGreaterThan(230);
        expect(px[4]).toBeLessThan(50);
        expect([px[3], px[7], px[11]]).toEqual([255, 255, 0]);
    });
});
