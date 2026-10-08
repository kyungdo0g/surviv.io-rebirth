// Rebirth air strike variants and blast radii on the client (docs/research/rebirth-deviations.md "Client
// presentation"): every variant has a distinct zone style (normal keeps the original yellow circle), heavy and carpet
// zones an announcement in both languages, and explosion bursts follow the def's blast radius (frag x1.3, the iron
// bomb x1.25, the heavy shell's own effect).
import {
    AIRSTRIKE_BOMB_RADIUS_MULT,
    AIRSTRIKE_VARIANT_IDS,
    AIRSTRIKE_VARIANTS,
    FRAG_RADIUS_MULT,
    getDefOfType,
    HEAVY_BOMB_EFFECT_TYPE,
    IRON_BOMB_RAD_MAX,
} from "@rebirth/defs";
import { afterEach, describe, expect, it } from "vitest";
import { explosionSounds, explosionVisual } from "../src/fx/explosions.ts";
import { ALL_PARTICLE_DEFS } from "../src/fx/particleDefsAll.ts";
import { setLang } from "../src/l10n/index.ts";
import { Camera } from "../src/render/camera.ts";
import {
    AIRSTRIKE_ZONE_STYLES,
    airstrikeAnnouncement,
    blinkAlpha,
    innerRingRad,
    NORMAL_ZONE_COLOR,
    zoneStyle,
    zoneVariant,
} from "../src/ui/airstrikeVariantStyle.ts";
import { AirstrikeZones } from "../src/ui/airstrikeZones.ts";

afterEach(() => setLang("en"));

describe("air strike zone styles", () => {
    it("keeps the original look for normal zones (survev AirstrikeZone: 0xeaff00, 1.5 px, 20 % fill)", () => {
        const s = AIRSTRIKE_ZONE_STYLES.normal;
        expect([s.color, s.mapLineWidth, s.mapFillAlpha, s.innerRing, s.blink]).toEqual([0xeaff00, 1.5, 0.2, null, 0]);
        expect(getDefOfType("ping", "ping_airstrike").tint).toBe(NORMAL_ZONE_COLOR);
    });

    it("gives heavy and carpet zones their own colour and a stronger outline", () => {
        const colors = AIRSTRIKE_VARIANT_IDS.map((v) => AIRSTRIKE_ZONE_STYLES[v].color);
        expect(new Set(colors).size).toBe(AIRSTRIKE_VARIANT_IDS.length);
        for (const v of ["heavy", "carpet"] as const) {
            const s = AIRSTRIKE_ZONE_STYLES[v];
            expect(s.mapLineWidth).toBeGreaterThan(AIRSTRIKE_ZONE_STYLES.normal.mapLineWidth);
            expect(s.worldLineWidth).toBeGreaterThan(AIRSTRIKE_ZONE_STYLES.normal.worldLineWidth);
            expect(s.innerRing).not.toBeNull();
        }
    });

    it("treats a missing or unknown variant as normal", () => {
        expect(zoneVariant(undefined)).toBe("normal");
        expect(zoneVariant("bogus")).toBe("normal");
        expect(zoneVariant("heavy")).toBe("heavy");
        expect(zoneStyle(undefined)).toBe(AIRSTRIKE_ZONE_STYLES.normal);
    });

    it("rings the heavy zone's aim radius inside its grown outline", () => {
        const aim = 60;
        const rad = aim + AIRSTRIKE_VARIANTS.heavy.zoneRadAdd;
        expect(innerRingRad("heavy", rad)).toBe(aim);
        expect(innerRingRad("normal", 60)).toBe(0);
        expect(innerRingRad("carpet", 60)).toBeCloseTo(54);
    });

    it("blinks only the carpet zone, between 0.35 and 1", () => {
        expect(blinkAlpha(AIRSTRIKE_ZONE_STYLES.normal, 0.3)).toBe(1);
        const carpet = AIRSTRIKE_ZONE_STYLES.carpet;
        const samples = Array.from({ length: 40 }, (_, i) => blinkAlpha(carpet, (i / 40) * carpet.blink));
        expect(Math.max(...samples)).toBeCloseTo(1);
        expect(Math.min(...samples)).toBeCloseTo(0.35);
    });
});

describe("air strike announcements", () => {
    it("names the heavy and carpet variants in English and Korean; a normal zone stays silent as in v0.8.82", () => {
        expect(AIRSTRIKE_VARIANT_IDS.map((v) => airstrikeAnnouncement(v))).toEqual([
            null,
            "Heavy shell strike incoming",
            "Carpet bombing incoming",
        ]);
        expect(airstrikeAnnouncement(undefined)).toBeNull();
        setLang("ko");
        expect(AIRSTRIKE_VARIANT_IDS.map((v) => airstrikeAnnouncement(v))).toEqual([
            null,
            "고폭탄 공습 경보",
            "대공습 경보",
        ]);
    });
});

describe("explosion visuals follow the blast radius", () => {
    it("draws the rebirth frag burst x1.3 over the original effect", () => {
        const frag = explosionVisual("explosion_frag");
        expect(frag?.effectType).toBe("frag");
        expect(frag?.burstScale).toBeCloseTo(FRAG_RADIUS_MULT);
        expect(getDefOfType("explosion", "explosion_frag").rad.max).toBeCloseTo(12 * FRAG_RADIUS_MULT);
    });

    it("keeps every explosion the rebirth did not resize at its original scale", () => {
        // the MIRV shares the frag's original numbers and effect scale (1)
        expect(explosionVisual("explosion_mirv")?.burstScale).toBe(1);
        expect(explosionVisual("explosion_barrel")?.burstScale).toBe(1);
        expect(explosionVisual("explosion_frag")?.airstrike).toBe(false);
    });

    it("draws the iron bomb's burst x1.25 over the original effect (scale 2 for 14 u), with its blast", () => {
        const iron = explosionVisual("explosion_bomb_iron");
        expect([iron?.effectType, iron?.burstScale, iron?.airstrike]).toEqual(["bomb_iron", 2.5, true]);
        expect(getDefOfType("explosion", "explosion_bomb_iron").rad.max).toBe(14 * AIRSTRIKE_BOMB_RADIUS_MULT);
        // the iron bomb's shake is the original's, not tied to its radius
        expect([iron?.effect.shakeStr, iron?.effect.shakeDur, iron?.effect.shakeRange]).toEqual([0.25, 0.4, undefined]);
    });

    it("gives the heavy shell its own, radius-sized effect with a stronger shake and a lower, louder boom", () => {
        const heavy = explosionVisual("explosion_bomb_heavy");
        const iron = explosionVisual("explosion_bomb_iron");
        if (!heavy || !iron) throw new Error("missing visual");
        expect(heavy.effectType).toBe(HEAVY_BOMB_EFFECT_TYPE);
        expect(heavy.airstrike).toBe(true);
        const rad = getDefOfType("explosion", "explosion_bomb_heavy").rad.max;
        expect(heavy.burstScale).toBeCloseTo((iron.burstScale * rad) / IRON_BOMB_RAD_MAX);
        // the original iron burst (scale 2 for 14 u) grown to 47.5 u
        expect(heavy.burstScale).toBeCloseTo((2 * 47.5) / 14, 9);
        expect(heavy.effect.burst.particle).toBe("explosionBombHeavy");
        expect(ALL_PARTICLE_DEFS.explosionBombHeavy).toBeDefined();
        expect(heavy.effect.shakeStr).toBeGreaterThan(iron.effect.shakeStr);
        expect(heavy.effect.shakeDur).toBeGreaterThan(iron.effect.shakeDur);
        expect(heavy.effect.burst.detune ?? 0).toBeLessThan(0);
        expect(heavy.effect.burst.volume ?? 1).toBeGreaterThan(1);
        expect(heavy.effect.shakeRange ?? 1).toBeGreaterThan(iron.effect.shakeRange ?? 1);
        // it reuses an original boom: nothing new to preload
        expect(explosionSounds()).toContain(heavy.effect.burst.grass);
    });

    it("draws the falling heavy shell 1.5x the iron bomb (its def's worldImg scale)", () => {
        const iron = getDefOfType("throwable", "bomb_iron").worldImg.scale;
        expect(getDefOfType("throwable", "bomb_heavy").worldImg.scale).toBeCloseTo(iron * 1.5);
    });

    it("has a visual for every explosion an air strike variant drops", () => {
        for (const v of Object.values(AIRSTRIKE_VARIANTS)) {
            const explosion = getDefOfType("throwable", v.bombType).explosionType;
            expect(explosionVisual(explosion)?.airstrike).toBe(true);
        }
    });
});

describe("camera shake reach", () => {
    function shakeAt(dist: number, rangeMult?: number): number {
        const cam = new Camera();
        cam.pos = { x: 0, y: 0 };
        cam.addShake({ x: dist, y: 0 }, 1, rangeMult);
        cam.applyShake();
        return cam.lastShake;
    }

    it("keeps the original 10..40 u falloff by default and stretches it for the heavy shell", () => {
        expect(shakeAt(5)).toBe(1);
        expect(shakeAt(25)).toBeCloseTo(0.5);
        expect(shakeAt(45)).toBe(0);
        const heavy = explosionVisual("explosion_bomb_heavy")?.effect.shakeRange ?? 1;
        expect(shakeAt(45, heavy)).toBeGreaterThan(0);
        expect(shakeAt(10 * heavy, heavy)).toBe(1);
        expect(shakeAt(40 * heavy + 1, heavy)).toBe(0);
    });
});

describe("air strike zone tracking", () => {
    const view = (id: number, variant: string | undefined, zoneT = 0) =>
        ({ id, pos: { x: id * 100, y: 50 }, rad: 40, duration: 12, zoneT, variant }) as never;

    it("reports zones that just appeared with their variant, announcing only early ones", () => {
        const zones = new AirstrikeZones();
        const added = zones.apply([view(1, "heavy"), view(2, undefined), view(3, "carpet", 0.8)]);
        expect(added.map((z) => [z.id, z.variant, z.announce])).toEqual([
            [1, "heavy", true],
            [2, "normal", true],
            [3, "carpet", false],
        ]);
        expect(zones.list.map((z) => z.color)).toEqual([
            AIRSTRIKE_ZONE_STYLES.heavy.color,
            AIRSTRIKE_ZONE_STYLES.normal.color,
            AIRSTRIKE_ZONE_STYLES.carpet.color,
        ]);
        // the next snapshot repeats them: nothing new
        expect(zones.apply([view(1, "heavy", 0.1), view(2, undefined, 0.1), view(3, "carpet", 0.9)])).toEqual([]);
        // the ping_airstrike marker at a zone's centre finds its variant
        expect(zones.variantNear({ x: 100.5, y: 50 })).toBe("heavy");
        expect(zones.variantNear({ x: 150, y: 50 })).toBeNull();
        // a zone that left the snapshot is dropped
        zones.apply([view(1, "heavy", 0.2)]);
        expect(zones.count).toBe(1);
    });
});
