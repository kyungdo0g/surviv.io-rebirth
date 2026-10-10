// The owner's held sprites (ownerHeldArt.ts): each drawing of the top-down sheets is fitted into its gun's frame, the
// length to the frame height (butt flush at the bottom, muzzle 1 px from the top), the bore on the centre line, the
// width widened but never past the frame; every listed gun has a layout, and a gun without a drawing installs nothing.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { OWNER_HELD_GUN_ART } from "../../packages/defs/src/index.ts";
import { opaqueBox } from "./gunIcons.ts";
import {
    boreX,
    fitHeldDrawing,
    installOwnerHeldArt,
    OWNER_HELD_LAYOUT,
    OWNER_HELD_RES,
    TOPDOWN_ALT_SHEET,
    TOPDOWN_SHEET,
} from "./ownerHeldArt.ts";
import { createImage, type RgbaImage } from "./png.ts";

const tmp = mkdtempSync(join(tmpdir(), "rebirth-ownerheld-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fill(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, v: number): void {
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            img.data.set([v, v, v, 255], (y * img.width + x) * 4);
        }
    }
}

/** A barrel-up gun on a transparent cell: barrel 6 wide at x 47..53, body 20 wide, a box sticking out on the left. */
function gun(): RgbaImage {
    const img = createImage(100, 420);
    fill(img, 47, 10, 53, 200, 40); // barrel, bore at x 50
    fill(img, 40, 200, 60, 410, 60); // body
    fill(img, 10, 250, 40, 300, 90); // box on the left
    return img;
}

describe("owner held sprites from the top-down sheets", () => {
    it("finds the bore at the muzzle, not the middle of a lopsided drawing", () => {
        const img = gun();
        const box = opaqueBox(img)!;
        expect(box).toEqual({ x0: 10, y0: 10, x1: 59, y1: 409 });
        expect(boreX(img, box)).toBe(50);
    });

    it("fits a drawing into its frame: length to the height, bore on the centre line, butt flush", () => {
        const { image, widen } = fitHeldDrawing(gun(), 80, 212, 1.5);
        expect([image.width, image.height]).toEqual([80 * OWNER_HELD_RES, 212 * OWNER_HELD_RES]);
        const box = opaqueBox(image, 16)!;
        expect(box.y0).toBe(OWNER_HELD_RES); // muzzle 1 logical px from the top
        expect(box.y1).toBe(image.height - 1); // butt flush with the bottom edge
        // the barrel straddles the centre line
        const row = 20 * OWNER_HELD_RES;
        const alpha = (x: number) => image.data[(row * image.width + x) * 4 + 3]!;
        expect(alpha(image.width / 2 - 1)).toBe(255);
        expect(alpha(image.width / 2)).toBe(255);
        expect(widen).toBe(1.5);
        // a frame too narrow for the widening cuts it, nothing crosses the edge
        const narrow = fitHeldDrawing(gun(), 48, 212, 3);
        expect(narrow.widen).toBeLessThan(3);
        const nb = opaqueBox(narrow.image, 16)!;
        expect(nb.x0).toBeGreaterThanOrEqual(OWNER_HELD_RES - 1);
    });

    it("every owner held gun has a layout on the main sheet; the alternative sheet holds the Bren, MG3 and Negev", () => {
        expect(Object.keys(OWNER_HELD_LAYOUT).sort()).toEqual(Object.keys(OWNER_HELD_GUN_ART).sort());
        expect([...TOPDOWN_SHEET.drawings].sort()).toEqual(Object.keys(OWNER_HELD_GUN_ART).sort());
        // the bulky black bullpup of row 1 is the Jackhammer; the PAW20 has no cell (it is drawn)
        expect(TOPDOWN_SHEET.drawings.slice(0, 3)).toEqual(["nlaw", "jackhammer", "pvg42"]);
        expect(TOPDOWN_SHEET.drawings).not.toContain("paw20");
        expect(TOPDOWN_ALT_SHEET.drawings).toEqual(["bren", "mg3", "negev"]);
        for (const [id, layout] of Object.entries(OWNER_HELD_LAYOUT)) {
            expect(
                layout.prefer.every((s) => s.drawings.includes(id)),
                id,
            ).toBe(true);
        }
    });

    it("installs nothing without the sheets, and says so", () => {
        const warnings: string[] = [];
        const rows = installOwnerHeldArt(
            join(tmp, "dest"),
            join(tmp, "no-sheets"),
            () => createImage(1, 1),
            warnings,
            true,
        );
        expect(rows).toEqual({});
        expect(warnings.join("\n")).toContain("the owner's held sprites are not installed");
    });
});
