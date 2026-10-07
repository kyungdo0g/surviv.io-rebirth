// Rebirth air drop tiers on the client (docs/research/rebirth-deviations.md "Air drop tiers"): only the tier inner
// crates carry a mark, tier 1 one silver star and tier 2 two blue stars from the original star images, laid out
// across the crate and turning with it; the shells, crate_10 and the gold crate stay unmarked.
import { AIRDROP_TIER_CRATES, getMapObjectDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import {
    CRATE_TIER_MARKS,
    crateTierMarkLayout,
    crateTierMarkSprites,
    crateTierMarkStyle,
} from "../src/objects/crateTierMark.ts";

describe("air drop tier marks", () => {
    it("tier 1 crates get one silver star, tier 2 crates two blue stars; nothing else is marked", () => {
        expect(crateTierMarkStyle("crate_10t1")).toBe(CRATE_TIER_MARKS.tier1);
        expect(crateTierMarkStyle("crate_10svt1")).toBe(CRATE_TIER_MARKS.tier1);
        expect(crateTierMarkStyle("crate_10t2")).toBe(CRATE_TIER_MARKS.tier2);
        expect(crateTierMarkStyle("crate_10svt2")).toBe(CRATE_TIER_MARKS.tier2);
        for (const type of ["airdrop_crate_01", "airdrop_crate_02", "crate_10", "crate_10sv", "crate_11", "crate_01"]) {
            expect(crateTierMarkStyle(type), type).toBeUndefined();
        }
        expect([CRATE_TIER_MARKS.tier1.count, CRATE_TIER_MARKS.tier2.count]).toEqual([1, 2]);
        expect([CRATE_TIER_MARKS.tier1.sprite, CRATE_TIER_MARKS.tier2.sprite]).toEqual(["star.img", "star-blue.img"]);
        // no new art: both stars are frames of the original v0.8.82 atlases
        for (const style of Object.values(CRATE_TIER_MARKS)) {
            expect(SPRITES[style.sprite]?.source, style.sprite).toBe("original-0.8.82");
        }
    });

    it("the stars sit side by side across the crate, inside its 4.5 u, and turn and grow with it", () => {
        for (const type of AIRDROP_TIER_CRATES) {
            const style = crateTierMarkStyle(type)!;
            const crate = getMapObjectDefOfType("obstacle", type).collision;
            const width = crate.type === 1 ? crate.max.x - crate.min.x : 2 * crate.rad;
            // a star fills about 85 % of its frame
            expect((style.count - 1) * style.spacing + 0.85 * style.size, type).toBeLessThanOrEqual(width);
            // big enough to read at the 1x zoom (~23 px per unit on a 1280 px wide screen): over 40 px a star
            expect(style.size * 0.85 * 23).toBeGreaterThan(40);
        }
        const pos = { x: 100, y: 50 };
        expect(crateTierMarkLayout(CRATE_TIER_MARKS.tier1, pos, 0, 1)).toEqual([pos]);
        const two = crateTierMarkLayout(CRATE_TIER_MARKS.tier2, pos, 0, 1);
        const half = CRATE_TIER_MARKS.tier2.spacing / 2;
        expect(two).toEqual([
            { x: 100 - half, y: 50 },
            { x: 100 + half, y: 50 },
        ]);
        const turned = crateTierMarkLayout(CRATE_TIER_MARKS.tier2, pos, Math.PI / 2, 1.5);
        expect(turned[0].x).toBeCloseTo(100, 9);
        expect(turned[0].y).toBeCloseTo(50 - half * 1.5, 9);
        expect(turned[1].y).toBeCloseTo(50 + half * 1.5, 9);
    });

    it("a splittable shell preloads its tier crates and both stars; a gold or 50v50 shell adds nothing", () => {
        for (const shell of ["airdrop_crate_01", "airdrop_crate_01x", "airdrop_crate_01sv"]) {
            const sprites = new Map<string, number>();
            crateTierMarkSprites(shell, sprites);
            expect(sprites.get("star.img"), shell).toBe(1);
            expect(sprites.get("star-blue.img"), shell).toBe(1);
            // the tier crates draw crate_10's sprite
            expect(sprites.has("map-crate-10.img"), shell).toBe(true);
        }
        for (const shell of ["airdrop_crate_02", "airdrop_crate_02x", "airdrop_crate_03", "class_shell_02"]) {
            const sprites = new Map<string, number>();
            crateTierMarkSprites(shell, sprites);
            expect(sprites.size, shell).toBe(0);
        }
    });
});
