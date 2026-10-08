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
            for (const sprite of [art.floor, art.ceiling]) {
                const file = join(REBIRTH_ART_DIR, rebirthArtFile(sprite));
                expect(existsSync(file), file).toBe(true);
                const text = readFileSync(file, "utf8");
                expect(text, `${file} is stale: rerun tools/assets/rebirthBuildingArt.ts`).toBe(svgs.get(sprite));
                expect(text).toContain(`width="${art.size[0]}" height="${art.size[1]}"`);
            }
        }
    });
});
