// The M202 FLASH's rocket explosion on the client (owner, 2026-10-08: "shake like a magnitude-9 earthquake"): its own
// effect "m202" with by far the strongest, longest and widest camera shake of every explosion, falling off with
// distance, and none at all with the Screen shake setting off.
import { type ExplosionDef, GameObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { explosionSounds, explosionVisual } from "../src/fx/explosions.ts";
import { Camera } from "../src/render/camera.ts";

describe("M202 FLASH explosion", () => {
    const m202 = explosionVisual("explosion_m202");

    it("has its own effect, its burst drawn for its 16 u radius, an original boom", () => {
        if (!m202) throw new Error("no visual");
        expect(m202.effectType).toBe("m202");
        expect(m202.burstScale).toBeCloseTo(16 / 12, 9);
        expect(explosionSounds()).toContain(m202.effect.burst.grass);
    });

    it("shakes harder, longer and wider than any other explosion: 1.6 u for 1.6 s, felt to 120 u", () => {
        if (!m202) throw new Error("no visual");
        expect([m202.effect.shakeStr, m202.effect.shakeDur, m202.effect.shakeRange]).toEqual([1.6, 1.6, 3]);
        for (const [id, def] of Object.entries(GameObjectDefs)) {
            if (def.type !== "explosion" || id === "explosion_m202") continue;
            const v = explosionVisual(id);
            if (!v) continue;
            expect(v.effect.shakeStr, id).toBeLessThan(m202.effect.shakeStr / 2);
            expect(v.effect.shakeDur, id).toBeLessThan(m202.effect.shakeDur);
            expect(v.effect.shakeRange ?? 1, id).toBeLessThan(m202.effect.shakeRange ?? 1);
        }
        expect((GameObjectDefs.explosion_m202 as ExplosionDef).explosionEffectType).toBe("m202");
    });

    it("falls off with distance and is off with the Screen shake setting", () => {
        if (!m202) throw new Error("no visual");
        const shakeAt = (dist: number, enabled = true) => {
            const cam = new Camera();
            cam.shakeEnabled = enabled;
            cam.pos = { x: 0, y: 0 };
            cam.addShake({ x: dist, y: 0 }, m202.effect.shakeStr, m202.effect.shakeRange);
            cam.applyShake();
            return cam.lastShake;
        };
        expect(shakeAt(20)).toBeCloseTo(1.6, 9);
        expect(shakeAt(30)).toBeCloseTo(1.6, 9);
        expect(shakeAt(75)).toBeCloseTo(0.8, 9);
        expect(shakeAt(100)).toBeGreaterThan(0);
        expect(shakeAt(121)).toBe(0);
        expect(shakeAt(20, false)).toBe(0);
    });
});
