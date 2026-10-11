// Plane positions (schema 23, maps grown by the player cap: defs mapDefForPlayers): planes fly while within 256 of the
// map, so a 1546-unit 50v50 map at cap 200 sends planes out to 1802; the rebirth's 11-bit range over -512..2560 keeps
// them within half a step, 3072 / 2047 / 2 (about 0.7504; the original's 10 bits over -512..1536 clamped them at 1536).
import { BitReader, BitWriter } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { readPlanes, writePlanes } from "../src/match.ts";

/** Half a quantization step (as test/gen.ts netTolerances). */
const HALF_STEP = 3072 / 2047 / 2 + 1e-9;

describe("plane positions", () => {
    it("round-trip anywhere a plane of a 2304-unit map can be, within half a step", () => {
        const at = [-512, -256, 0, 700.3, 1280, 1536, 1671, 1802, 2304 + 256];
        const planes = at.map((x, i) => ({
            id: i + 1,
            pos: { x, y: 2560 - (x + 512) },
            dir: { x: 1, y: 0 },
            planeType: "airdrop" as const,
            actionComplete: false,
        }));
        const w = new BitWriter(1024);
        writePlanes(w, planes);
        const back = readPlanes(new BitReader(w.getBuffer()));
        expect(back).toHaveLength(planes.length);
        back.forEach((p, i) => {
            expect(Math.abs(p.pos.x - planes[i].pos.x)).toBeLessThanOrEqual(HALF_STEP);
            expect(Math.abs(p.pos.y - planes[i].pos.y)).toBeLessThanOrEqual(HALF_STEP);
        });
    });
});
