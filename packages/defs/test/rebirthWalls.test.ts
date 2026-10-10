// The breakable exterior walls of the collapsing buildings (the owner, 2026-10-10; rebirth/buildings/walls.ts):
// rebirth_wall_brk_<len> for every partition length, brick (brick_wall_ext_4's chips, sounds and material), 300
// health, the original rounded wall sprite tinted brick; a layout's "brittle" walls are built from them.
import { describe, expect, it } from "vitest";
import {
    getMapObjectDefOfType,
    REBIRTH_WALL_BRK_HEALTH,
    REBIRTH_WALL_BRK_TINT,
    REBIRTH_WALL_INT_LENGTHS,
    type RebirthBuildingLayout,
    rebirthWallBrk,
    rebirthWallInt,
    wallChildren,
} from "../src/index.ts";
import { WALL_LENGTHS } from "../src/rebirth/buildings/military/part.ts";

describe("rebirth_wall_brk_*", () => {
    it("are brick walls of every partition length, breakable at 300 health", () => {
        const brick = getMapObjectDefOfType("obstacle", "brick_wall_ext_4");
        expect(REBIRTH_WALL_BRK_HEALTH).toBe(300);
        for (const len of REBIRTH_WALL_INT_LENGTHS) {
            const d = getMapObjectDefOfType("obstacle", rebirthWallBrk(len));
            const part = getMapObjectDefOfType("obstacle", rebirthWallInt(len));
            expect([len, d.destructible, d.health, d.isWall, d.material, d.hitParticle]).toEqual([
                len,
                true,
                300,
                true,
                "brick",
                brick.hitParticle,
            ]);
            expect(d.sound).toEqual(brick.sound);
            expect(d.sound.bullet).toBe("wall_brick_bullet");
            expect(d.collision).toEqual(part.collision);
            expect(d.extents).toEqual({ x: 0.5, y: len / 2 });
            expect(d.img.sprite).toMatch(/^map-wall-\d\d(-5)?-rounded\.img$/);
            expect(d.img.sprite).toBe(part.img.sprite);
            expect(d.img.tint).toBe(REBIRTH_WALL_BRK_TINT);
        }
        expect(rebirthWallBrk(2.5)).toBe("rebirth_wall_brk_2_5");
    });

    it("build a layout's brittle walls", () => {
        expect(WALL_LENGTHS.brittle).toEqual(REBIRTH_WALL_INT_LENGTHS);
        const layout: RebirthBuildingLayout = {
            bounds: { min: { x: 0, y: 0 }, max: { x: 4, y: 4 } },
            material: "brittle",
            walls: [
                [0, 0, 4, 0],
                [0, 0, 0, 2.5],
                [4, 0, 4, 4, "brick"],
            ],
            openings: [],
            rooms: [],
        };
        const types = wallChildren(layout, () => true).map((c) => [c.type, c.ori]);
        expect(types).toEqual([
            ["rebirth_wall_brk_4", 1],
            ["rebirth_wall_brk_2_5", 0],
            ["brick_wall_ext_4", 0],
        ]);
        expect(() => wallChildren({ ...layout, walls: [[0, 0, 0, 1.5]] }, () => true)).toThrow(/length 1.5/);
    });
});
