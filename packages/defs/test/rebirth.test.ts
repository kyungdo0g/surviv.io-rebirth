// The rebirth defs layer (src/rebirth/, docs/research/rebirth-deviations.md): user-requested deviations from v0.8.82
// are applied to a copy of the generated defs when the package loads, rebirth-only defs come after every generated id,
// and the air strike variant table agrees with the defs it names.
import { describe, expect, it } from "vitest";
import {
    AIRDROP_TIER_CRATES,
    AIRSTRIKE_VARIANT_IDS,
    AIRSTRIKE_VARIANTS,
    airstrikeBombReach,
    airstrikeZoneRad,
    DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS,
    FRAG_DECAL_TYPE,
    FRAG_RADIUS_MULT,
    GameConfig,
    GameObjectDefs,
    GameObjectRegistry,
    getDefOfType,
    getMapObjectDefOfType,
    HEAVY_BOMB_DECAL_TYPE,
    HEAVY_BOMB_EFFECT_TYPE,
    HEAVY_BOMB_EXPLOSION,
    IRON_BOMB_RAD_MAX,
    isAirstrikeBomb,
    MapObjectDefs,
    MapObjectRegistry,
    newGunDefs,
    rebirthDeviations,
    rebirthOnlyIds,
    rebirthOnlyMapObjectIds,
} from "../src/index.ts";
import { gameObjects, mapObjects } from "./helpers.ts";

describe("rebirth balance deviations", () => {
    it("frag grenade blast radius x1.3 (user request), the generated JSON keeps the original 5-12", () => {
        expect(FRAG_RADIUS_MULT).toBe(1.3);
        expect(gameObjects.explosion_frag.rad).toEqual({ min: 5, max: 12 });
        const frag = getDefOfType("explosion", "explosion_frag");
        expect(frag.rad).toEqual({ min: 6.5, max: 15.6 });
        // only the radius and its scorch decal change
        const original = gameObjects.explosion_frag;
        expect({ ...frag, rad: original.rad, decalType: original.decalType }).toEqual(original);
        expect(rebirthDeviations.filter((d) => d.id === "explosion_frag")).toEqual([
            expect.objectContaining({
                id: "explosion_frag",
                field: "rad",
                original: { min: 5, max: 12 },
                rebirth: { min: 6.5, max: 15.6 },
            }),
            expect.objectContaining({
                id: "explosion_frag",
                field: "decalType",
                original: "decal_frag_explosion",
                rebirth: FRAG_DECAL_TYPE,
            }),
        ]);
        // the other deviations are the survev guns' wiki stats (survevGuns.test.ts); survev's strobe strikeDelay is
        // already the generated one under survev balance (strobes.test.ts)
        expect(rebirthDeviations.filter((d) => d.id !== "explosion_frag").map((d) => `${d.id}.${d.field}`)).toEqual([
            "potato_lmg.barrelLength",
            "potato_lmgshot.throwPhysics.velZ",
        ]);
    });

    it("the frag scorch mark grows x1.3 with its blast; the MIRV keeps the original decal", () => {
        expect(getDefOfType("explosion", "explosion_frag").decalType).toBe(FRAG_DECAL_TYPE);
        expect(getDefOfType("explosion", "explosion_mirv").decalType).toBe("decal_frag_explosion");
        const decal = getMapObjectDefOfType("decal", FRAG_DECAL_TYPE);
        const original = mapObjects.decal_frag_explosion;
        expect(decal.img.scale).toBeCloseTo(original.img.scale * FRAG_RADIUS_MULT, 6);
        expect({ ...decal, img: { ...decal.img, scale: original.img.scale } }).toEqual(original);
        expect(MapObjectDefs.decal_frag_explosion).toEqual(original);
    });

    it("leaves the other explosions and the frag shrapnel at their original values", () => {
        for (const id of ["explosion_mirv", "explosion_mirv_mini", "explosion_martyr_nade", "explosion_barrel"]) {
            expect(GameObjectDefs[id], id).toEqual(gameObjects[id]);
        }
        expect(GameObjectDefs.shrapnel_frag).toEqual(gameObjects.shrapnel_frag);
        expect(GameObjectDefs.frag).toEqual(gameObjects.frag);
    });
});

describe("rebirth-only defs", () => {
    it("come after every generated id (original, then survev-only), which keep their wire ids", () => {
        const generated = Object.keys(gameObjects);
        // the air strike shell first, then the new guns with their ammo, bullets and explosions (rebirth/newGuns.ts),
        // then the variant strobes and their pings (rebirth/strobes.ts)
        expect(rebirthOnlyIds).toEqual([
            "bomb_heavy",
            "explosion_bomb_heavy",
            ...Object.keys(newGunDefs()),
            "strobe_heavy",
            "strobe_carpet",
            "ping_airstrike_heavy",
            "ping_airstrike_carpet",
        ]);
        expect(Object.keys(GameObjectDefs)).toEqual([...generated, ...rebirthOnlyIds]);
        expect(generated.map((id) => GameObjectRegistry.typeToId(id))).toEqual(generated.map((_, i) => i + 1));
        for (const id of rebirthOnlyIds) expect(Object.hasOwn(gameObjects, id)).toBe(false);
        // the rebirth scorch decals, air drop tier crates and buildings likewise come after every generated map object
        const generatedMap = Object.keys(mapObjects);
        expect(rebirthOnlyMapObjectIds).toEqual([
            HEAVY_BOMB_DECAL_TYPE,
            FRAG_DECAL_TYPE,
            ...AIRDROP_TIER_CRATES,
            "loot_tier_medical",
            "clinic_01",
            "outpost_01r",
            "outpost_01b",
        ]);
        expect(AIRDROP_TIER_CRATES).toEqual(["crate_10t1", "crate_10t2", "crate_10svt1", "crate_10svt2"]);
        expect(Object.keys(MapObjectDefs)).toEqual([...generatedMap, ...rebirthOnlyMapObjectIds]);
        expect(generatedMap.map((id) => MapObjectRegistry.typeToId(id))).toEqual(generatedMap.map((_, i) => i + 1));
        for (const id of rebirthOnlyMapObjectIds) expect(Object.hasOwn(mapObjects, id)).toBe(false);
    });

    it("the heavy shell is the iron bomb with its own, much larger explosion", () => {
        const iron = getDefOfType("throwable", "bomb_iron");
        const heavy = getDefOfType("throwable", "bomb_heavy");
        expect(heavy.explosionType).toBe("explosion_bomb_heavy");
        expect(heavy.explodeOnImpact).toBe(true);
        expect([heavy.rad, heavy.fuseTime, heavy.throwPhysics]).toEqual([iron.rad, iron.fuseTime, iron.throwPhysics]);
        expect(heavy.worldImg.sprite).toBe(iron.worldImg.sprite);
        expect(heavy.worldImg.scale).toBeGreaterThan(iron.worldImg.scale);

        const ironEx = getDefOfType("explosion", "explosion_bomb_iron");
        const heavyEx = getDefOfType("explosion", "explosion_bomb_heavy");
        expect(IRON_BOMB_RAD_MAX).toBe(ironEx.rad.max);
        expect(heavyEx.rad).toEqual(HEAVY_BOMB_EXPLOSION.rad);
        // "very large": 2.5-3x the iron bomb's radius
        for (const k of ["min", "max"] as const) {
            expect(heavyEx.rad[k] / ironEx.rad[k]).toBeGreaterThanOrEqual(2.5);
            expect(heavyEx.rad[k] / ironEx.rad[k]).toBeLessThanOrEqual(3);
        }
        expect(heavyEx.damage).toBe(HEAVY_BOMB_EXPLOSION.damage);
        expect(heavyEx.shrapnelType).toBe(ironEx.shrapnelType);
        // a scorch mark that matches the blast: the iron bomb's grown by the radius ratio, same sprite and fade
        expect(heavyEx.decalType).toBe(HEAVY_BOMB_DECAL_TYPE);
        const decal = getMapObjectDefOfType("decal", HEAVY_BOMB_DECAL_TYPE);
        const ironDecal = getMapObjectDefOfType("decal", ironEx.decalType);
        expect(decal.img.scale).toBeCloseTo((ironDecal.img.scale * heavyEx.rad.max) / ironEx.rad.max, 6);
        expect({ ...decal, img: { ...decal.img, scale: ironDecal.img.scale } }).toEqual(ironDecal);
        // its own client effect (apps/client fx/explosions.ts "bomb_heavy"), not the iron bomb's
        expect(heavyEx.explosionEffectType).toBe(HEAVY_BOMB_EFFECT_TYPE);
        expect(ironEx.explosionEffectType).toBe("bomb_iron");
    });
});

describe("air strike variant table", () => {
    it("normal is v0.8.82's strike, carpet sends 6 planes of normal bombs wider, heavy drops the heavy shell", () => {
        expect(AIRSTRIKE_VARIANT_IDS).toEqual(["normal", "heavy", "carpet"]);
        const { normal, heavy, carpet } = AIRSTRIKE_VARIANTS;
        const s = GameConfig.airstrike;
        expect(normal).toEqual({
            bombType: "bomb_iron",
            bombCount: s.bombCount,
            bombOffset: s.bombOffset,
            bombJitter: s.bombJitter,
            planeCount: null,
            aimRadMult: 1,
            zoneRadAdd: 0,
        });
        // carpet: the planes aim inside 1.4x the radius (about twice the area for twice the planes) and the marker
        // covers every blast: a bomb's reach (half the 38 u strip + the 2.75 u lead + the 4 u jitter = 25.75), the
        // iron bomb's 14 u blast, the 1 u body, + 1 for the wire
        expect(carpet).toEqual({ ...normal, planeCount: 6, aimRadMult: 1.4, zoneRadAdd: 42 });
        expect(airstrikeBombReach(carpet)).toBe(25.75);
        expect(airstrikeBombReach(normal)).toBe(25.75);
        expect(carpet.zoneRadAdd).toBe(Math.ceil(25.75 + IRON_BOMB_RAD_MAX + GameConfig.player.radius + 1));
        expect([60, 40].map((r) => airstrikeZoneRad("carpet", r))).toEqual([126, 98]);
        expect([60, 40].map((r) => airstrikeZoneRad("normal", r))).toEqual([60, 40]);
        expect(heavy.bombType).toBe("bomb_heavy");
        expect(heavy.bombCount).toBeLessThan(normal.bombCount);
        expect(heavy.bombOffset).toBeGreaterThan(normal.bombOffset);
        // the marker grows by the heavy shell's extra reach; its planes keep the map's aim radius
        expect(heavy.zoneRadAdd).toBe(HEAVY_BOMB_EXPLOSION.rad.max - IRON_BOMB_RAD_MAX);
        expect(heavy.aimRadMult).toBe(1);
        expect(airstrikeZoneRad("heavy", 60)).toBe(84);
        expect(DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS).toEqual({ normal: 60, heavy: 25, carpet: 15 });
    });

    it("every variant bomb is an impact throwable, and only those count as air strike bombs", () => {
        for (const v of Object.values(AIRSTRIKE_VARIANTS)) {
            expect(getDefOfType("throwable", v.bombType).explodeOnImpact).toBe(true);
            expect(isAirstrikeBomb(v.bombType)).toBe(true);
        }
        expect(isAirstrikeBomb("frag")).toBe(false);
        expect(isAirstrikeBomb("strobe")).toBe(false);
    });
});
