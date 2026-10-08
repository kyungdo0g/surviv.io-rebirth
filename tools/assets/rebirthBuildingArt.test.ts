// The rebirth buildings' committed SVGs (apps/client/public/rebirth/map/) are what rebirthBuildingArt.ts draws from the
// current layouts (rerun `node tools/assets/rebirthBuildingArt.ts` after changing packages/defs rebirth/buildings.ts),
// at the size the client's sprite entries give them.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rebirthBuildingArt } from "../../packages/defs/src/rebirth/buildings.ts";
import { REBIRTH_ART_DIR, rebirthArtFile, rebirthBuildingSvgs } from "./rebirthBuildingArt.ts";

describe("rebirth building art", () => {
    it("every floor and roof has a current committed SVG of its sprite size", () => {
        const svgs = rebirthBuildingSvgs();
        for (const art of rebirthBuildingArt()) {
            // the floor image is larger than the roof's where an outdoor apron widens it
            const images: Array<readonly [string, readonly [number, number]]> = [
                [art.floor, art.floorSize ?? art.size],
            ];
            if (art.ceiling) images.push([art.ceiling, art.size]);
            for (const [sprite, size] of images) {
                const file = join(REBIRTH_ART_DIR, rebirthArtFile(sprite));
                expect(existsSync(file), file).toBe(true);
                const text = readFileSync(file, "utf8");
                expect(text, `${file} is stale: rerun tools/assets/rebirthBuildingArt.ts`).toBe(svgs.get(sprite));
                expect(text).toContain(`width="${size[0]}" height="${size[1]}"`);
            }
        }
    });
});
