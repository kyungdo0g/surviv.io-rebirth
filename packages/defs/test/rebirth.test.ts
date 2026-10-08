// The rebirth defs layer (src/rebirth/, docs/research/rebirth-deviations.md): user-requested deviations from v0.8.82
// are applied to a copy of the generated defs when the package loads, rebirth-only defs come after every generated id,
// and the air strike variant table agrees with the defs it names.
import { describe, expect, it } from "vitest";
import {
    AIRDROP_TIER_CRATES,
    AIRSTRIKE_BOMB_RADIUS_MULT,
    AIRSTRIKE_VARIANT_IDS,
    AIRSTRIKE_VARIANTS,
    airstrikeBombReach,
    airstrikeZoneRad,
    CLUB_VAULT_BOX,
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
    HELD_GUN_ART,
    HELD_GUN_ART_EMPTY,
    HELD_GUN_ART_GUN_OFFSET,
    HELD_GUN_ART_HANDS_BELOW,
    HELD_GUN_ART_LEFT_HAND_OFFSET,
    heldGunArt,
    heldGunArtEmpty,
    IRON_BOMB_DECAL_TYPE,
    IRON_BOMB_RAD_MAX,
    isAirstrikeBomb,
    LAUNCHER_ROUND_ART,
    launcherRound,
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
        // the other deviations are the air strike iron bomb's radius and scorch decal (below), the survev guns' wiki
        // stats (survevGuns.test.ts) and the owner's PMG-134 move speed (gunSpeeds.ts, ownerLoot.test.ts); survev's
        // strobe strikeDelay is already the generated one under survev balance (strobes.test.ts)
        expect(rebirthDeviations.filter((d) => d.id !== "explosion_frag").map((d) => `${d.id}.${d.field}`)).toEqual([
            "explosion_bomb_iron.rad",
            "potato_lmg.barrelLength",
            "potato_lmgshot.throwPhysics.velZ",
            "potato_lmg.speed",
            "ak47.worldImg",
            "decal_bomb_iron_explosion.img.scale",
        ]);
    });

    it("the AK-47 holds its own drawn top-down sprite (presentation only), the generated JSON keeps the bar", () => {
        expect(gameObjects.ak47.worldImg).toEqual({
            sprite: "gun-long-01.img",
            scale: { x: 0.5, y: 0.435 },
            tint: 0x622a12,
            leftHandOffset: { x: 2.8, y: 0 },
            recoil: 1.33,
        });
        const ak47 = getDefOfType("gun", "ak47");
        expect(ak47.worldImg).toEqual({
            sprite: "gun-ak47-01.img",
            scale: { x: 0.5, y: 0.5 },
            tint: 0xffffff,
            leftHandOffset: { x: 2.8, y: 0 },
            recoil: 1.33,
        });
        // nothing else changes: the gun plays and fires as before
        expect({ ...ak47, worldImg: gameObjects.ak47.worldImg }).toEqual(gameObjects.ak47);
        expect(rebirthDeviations.filter((d) => d.id === "ak47")).toEqual([
            {
                id: "ak47",
                field: "worldImg",
                original: { sprite: "gun-long-01.img", scale: { x: 0.5, y: 0.435 }, tint: 0x622a12 },
                rebirth: { sprite: "gun-ak47-01.img", scale: { x: 0.5, y: 0.5 }, tint: 0xffffff },
                reason: "owner: own top-down held sprite instead of the tinted bar (presentation only)",
            },
        ]);
        expect(heldGunArt()).toEqual([
            { id: "ak47", sprite: "gun-ak47-01.img", size: [48, 172] },
            { id: "g36c", sprite: "gun-g36c-01.img", size: [48, 136] },
            { id: "m16a4", sprite: "gun-m16a4-01.img", size: [48, 220] },
            { id: "sig550", sprite: "gun-sig550-01.img", size: [48, 188] },
            { id: "g3", sprite: "gun-g3-01.img", size: [48, 190] },
            { id: "fal", sprite: "gun-fal-01.img", size: [48, 196] },
            { id: "wa2000", sprite: "gun-wa2000-01.img", size: [60, 192] },
            { id: "m200", sprite: "gun-m200-01.img", size: [60, 226] },
            { id: "hecate", sprite: "gun-hecate-01.img", size: [60, 232] },
            { id: "lynx", sprite: "gun-lynx-01.img", size: [60, 192] },
            { id: "boys", sprite: "gun-boys-01.img", size: [60, 238] },
            { id: "bizon", sprite: "gun-bizon-01.img", size: [48, 140] },
            { id: "asval", sprite: "gun-asval-01.img", size: [48, 152] },
            { id: "p90", sprite: "gun-p90-01.img", size: [48, 116] },
            { id: "tec9", sprite: "gun-tec9-01.img", size: [40, 116] },
            { id: "dp12", sprite: "gun-dp12-01.img", size: [48, 140] },
            { id: "aa12", sprite: "gun-aa12-01.img", size: [48, 194] },
            { id: "m60", sprite: "gun-m60-01.img", size: [80, 212] },
            { id: "mg42", sprite: "gun-mg42-01.img", size: [80, 218] },
            { id: "dshk", sprite: "gun-dshk-01.img", size: [88, 250] },
            { id: "m79", sprite: "gun-m79-01.img", size: [56, 138] },
            { id: "gl06", sprite: "gun-gl06-01.img", size: [56, 130] },
            { id: "mgl", sprite: "gun-mgl-01.img", size: [64, 144] },
            { id: "rpg7", sprite: "gun-rpg7-01.img", size: [64, 204] },
            { id: "panzerfaust", sprite: "gun-panzerfaust-01.img", size: [56, 210] },
            { id: "m202", sprite: "gun-m202-01.img", size: [64, 196] },
        ]);
        // the RPG-7 also without its warhead, at the same size (shown while its round is fired; the client decides)
        expect(HELD_GUN_ART_EMPTY).toEqual(["rpg7"]);
        expect(heldGunArtEmpty()).toEqual([{ id: "rpg7", sprite: "gun-rpg7-empty-01.img", size: [64, 204] }]);
        // the launchers' defs keep the sheet's borrowed potato cannon (the client switches them) and its hands, but the
        // hand-held M79, GL-06 and MGL, held like a rifle (owner, 2026-10-08): rifle hands over the gun, (-8, 0)
        for (const id of ["rpg7", "panzerfaust", "m202"]) {
            expect(getDefOfType("gun", id).worldImg, id).toMatchObject({
                sprite: "gun-potato-cannon-01.img",
                leftHandOffset: { x: 7, y: 2 },
                gunOffset: { x: -10, y: -4 },
                handsBelow: true,
            });
        }
        for (const id of ["m79", "gl06", "mgl"]) {
            const def = getDefOfType("gun", id);
            expect(def.handHeld, id).toBe(true);
            expect(def.worldImg, id).toMatchObject({ sprite: "gun-potato-cannon-01.img", gunOffset: { x: -8, y: 0 } });
            expect(def.worldImg.handsBelow, id).toBeUndefined();
        }
        // the beta guns keep the balance sheet's held image in their defs (the client switches them, heldGun.ts): its
        // bar, or the AWM-S art it borrowed for the Hecate II and the Lynx, or the PKP's for the belt guns; the own
        // sprites' overrides are client-only
        for (const id of [
            ...["g36c", "m16a4", "sig550", "g3", "fal", "wa2000", "m200", "boys"],
            ...["bizon", "asval", "p90", "dp12", "aa12"],
        ]) {
            expect(getDefOfType("gun", id).worldImg.sprite, id).toMatch(/^gun-(med|long)-01\.img$/);
        }
        for (const id of ["m60", "mg42", "dshk"]) {
            expect(getDefOfType("gun", id).worldImg, id).toMatchObject({
                sprite: "gun-pkp-top-01.img",
                leftHandOffset: { x: 12.5, y: 0 },
                magImg: { sprite: "gun-pkp-bot-01.img" },
            });
        }
        for (const id of ["tec9", "tec9_dual"])
            expect(getDefOfType("gun", id).worldImg.sprite, id).toBe("gun-short-01.img");
        for (const id of ["hecate", "lynx"]) expect(getDefOfType("gun", id).worldImg.sprite, id).toBe("gun-awc-01.img");
        expect(HELD_GUN_ART_GUN_OFFSET).toEqual({
            wa2000: { x: -8, y: 0 },
            lynx: { x: -8, y: 0 },
            p90: { x: -8, y: 0 },
            dp12: { x: -8, y: 0 },
        });
        expect(HELD_GUN_ART_HANDS_BELOW).toEqual({ p90: true });
        expect(HELD_GUN_ART_LEFT_HAND_OFFSET).toEqual({ asval: { x: 4, y: 0 }, rpg7: { x: -2, y: 2 } });
        for (const id of ["wa2000", "lynx", "p90", "dp12"]) {
            expect(getDefOfType("gun", id).worldImg.gunOffset, id).toBeUndefined();
        }
        expect(getDefOfType("gun", "p90").worldImg.handsBelow).toBeUndefined();
        expect(getDefOfType("gun", "asval").worldImg.leftHandOffset).toEqual({ x: 9, y: 0 });
        // bars on purpose (owner); a dual pistol shares its single's sprite (the client's ownHeldSprite)
        for (const id of ["mk14", "m1928", "vz61", "vz61_dual", "tec9_dual"]) {
            expect(Object.hasOwn(HELD_GUN_ART, id), id).toBe(false);
        }
        expect(getDefOfType("gun", "mk14").worldImg).toMatchObject({
            sprite: "gun-long-01.img",
            scale: { x: 0.5, y: 0.47 },
            tint: 0xa08c6a,
        });
    });

    it("launcher rounds in flight: the 40 mm grenade for the M79, MGL and GL-06, each rocket its own", () => {
        expect(Object.keys(LAUNCHER_ROUND_ART)).toEqual([
            "proj-40mm-01.img",
            "proj-rpg7-01.img",
            "proj-m202-01.img",
            "proj-panzerfaust-01.img",
        ]);
        // the M79 and MGL lob the m79_grenade projectile (their bullets are invisible); the others fly as bullets
        const sprite = (type: string) => launcherRound(type)?.sprite;
        expect(getDefOfType("gun", "m79").projType).toBe("m79_grenade");
        expect(getDefOfType("gun", "mgl").projType).toBe("m79_grenade");
        for (const gun of ["gl06", "rpg7", "panzerfaust", "m202"])
            expect(getDefOfType("gun", gun).projType).toBeFalsy();
        expect(sprite("m79_grenade")).toBe("proj-40mm-01.img");
        expect(sprite(getDefOfType("gun", "gl06").bulletType)).toBe("proj-40mm-01.img");
        expect(sprite(getDefOfType("gun", "rpg7").bulletType)).toBe("proj-rpg7-01.img");
        expect(sprite(getDefOfType("gun", "panzerfaust").bulletType)).toBe("proj-panzerfaust-01.img");
        expect(sprite(getDefOfType("gun", "m202").bulletType)).toBe("proj-m202-01.img");
        for (const type of ["bullet_m79", "bullet_mgl", "bullet_ak47", "frag", "toString"]) {
            expect(launcherRound(type), type).toBeUndefined();
        }
        // world px per sprite px: the RPG-7's 58 px round about one body (32 px) across, the 40 mm about a frag's
        expect(launcherRound("bullet_rpg7")!.scale * LAUNCHER_ROUND_ART["proj-rpg7-01.img"][1]).toBeCloseTo(34.8, 6);
        expect(launcherRound("m79_grenade")!.scale * 34).toBeCloseTo(13.6, 6);
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

    it("air strike iron bomb blast radius x1.25 (owner, 2026-10-08), the generated JSON keeps survev's 5-14", () => {
        expect(AIRSTRIKE_BOMB_RADIUS_MULT).toBe(1.25);
        expect(gameObjects.explosion_bomb_iron.rad).toEqual({ min: 5, max: 14 });
        const iron = getDefOfType("explosion", "explosion_bomb_iron");
        expect(iron.rad).toEqual({ min: 6.25, max: 17.5 });
        expect(IRON_BOMB_RAD_MAX).toBe(14 * AIRSTRIKE_BOMB_RADIUS_MULT);
        // only the radius changes: 40 damage, x2 vs obstacles, 2 shrapnel, the effect and the decal type stay
        const original = gameObjects.explosion_bomb_iron;
        expect({ ...iron, rad: original.rad }).toEqual(original);
        expect(rebirthDeviations.filter((d) => d.id === "explosion_bomb_iron")).toEqual([
            expect.objectContaining({
                field: "rad",
                original: { min: 5, max: 14 },
                rebirth: { min: 6.25, max: 17.5 },
            }),
        ]);
        // its scorch mark grows in place with the blast (only the iron bomb leaves it: no new map type id)
        expect(iron.decalType).toBe(IRON_BOMB_DECAL_TYPE);
        const decal = getMapObjectDefOfType("decal", IRON_BOMB_DECAL_TYPE);
        const originalDecal = mapObjects.decal_bomb_iron_explosion;
        expect([originalDecal.img.scale, decal.img.scale]).toEqual([0.2, 0.25]);
        expect({ ...decal, img: { ...decal.img, scale: originalDecal.img.scale } }).toEqual(originalDecal);
        expect(MapObjectRegistry.typeToId(IRON_BOMB_DECAL_TYPE)).toBe(
            Object.keys(mapObjects).indexOf(IRON_BOMB_DECAL_TYPE) + 1,
        );
        for (const [id, def] of Object.entries(GameObjectDefs)) {
            if (def.type !== "explosion" || id === "explosion_bomb_iron") continue;
            expect(def.decalType, id).not.toBe(IRON_BOMB_DECAL_TYPE);
        }
    });

    it("a normal air strike bomb clearly outsizes an M202 FLASH rocket (the owner, 2026-10-08)", () => {
        const iron = getDefOfType("explosion", "explosion_bomb_iron");
        const m202 = getDefOfType("explosion", "explosion_m202");
        expect([m202.rad.min, m202.rad.max]).toEqual([5, 16]);
        expect(iron.rad.min).toBeGreaterThan(m202.rad.min);
        expect(iron.rad.max).toBeGreaterThanOrEqual(m202.rad.max + 1.5);
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
        // the rebirth scorch decals, air drop tier crates, the club's gun box (ownerLoot.ts) and the rebirth buildings
        // likewise come after every generated map object
        const generatedMap = Object.keys(mapObjects);
        expect(rebirthOnlyMapObjectIds).toEqual([
            HEAVY_BOMB_DECAL_TYPE,
            FRAG_DECAL_TYPE,
            ...AIRDROP_TIER_CRATES,
            CLUB_VAULT_BOX,
            "loot_tier_medical",
            "clinic_01",
            "outpost_01r",
            "outpost_01b",
            "firestation_01",
            "library_01",
            "radio_station_01",
            "arsenal_01",
            "blockhouse_01r",
            "blockhouse_01b",
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
        // 14-38 grown x1.25 with the iron bomb (owner, 2026-10-08)
        expect(heavyEx.rad).toEqual({ min: 14 * AIRSTRIKE_BOMB_RADIUS_MULT, max: 38 * AIRSTRIKE_BOMB_RADIUS_MULT });
        expect(heavyEx.rad).toEqual({ min: 17.5, max: 47.5 });
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
        // 0.2 x 1.25 x 47.5 / 17.5 = 0.2 x 47.5 / 14 (the original decal for the original 14 u blast)
        expect(decal.img.scale).toBeCloseTo((mapObjects.decal_bomb_iron_explosion.img.scale * 47.5) / 14, 6);
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
        // iron bomb's 17.5 u blast (14 x 1.25), the 1 u body, + 1 for the wire
        expect(carpet).toEqual({ ...normal, planeCount: 6, aimRadMult: 1.4, zoneRadAdd: 46 });
        expect(airstrikeBombReach(carpet)).toBe(25.75);
        expect(airstrikeBombReach(normal)).toBe(25.75);
        expect(carpet.zoneRadAdd).toBe(Math.ceil(25.75 + IRON_BOMB_RAD_MAX + GameConfig.player.radius + 1));
        expect([60, 40].map((r) => airstrikeZoneRad("carpet", r))).toEqual([130, 102]);
        expect([60, 40].map((r) => airstrikeZoneRad("normal", r))).toEqual([60, 40]);
        expect(heavy.bombType).toBe("bomb_heavy");
        expect(heavy.bombCount).toBeLessThan(normal.bombCount);
        expect(heavy.bombOffset).toBeGreaterThan(normal.bombOffset);
        // the marker grows by the heavy shell's extra reach (47.5 - 17.5); its planes keep the map's aim radius
        expect(heavy.zoneRadAdd).toBe(HEAVY_BOMB_EXPLOSION.rad.max - IRON_BOMB_RAD_MAX);
        expect(heavy.zoneRadAdd).toBe(30);
        expect(heavy.aimRadMult).toBe(1);
        expect([60, 40].map((r) => airstrikeZoneRad("heavy", r))).toEqual([90, 70]);
        expect(DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS).toEqual({ normal: 60, heavy: 25, carpet: 15 });
    });

    it("every marker covers its bombs' blasts as before the x1.25: carpet all of them, heavy as far as normal", () => {
        const body = GameConfig.player.radius;
        const blast = (v: keyof typeof AIRSTRIKE_VARIANTS) =>
            getDefOfType("explosion", getDefOfType("throwable", AIRSTRIKE_VARIANTS[v].bombType).explosionType).rad.max;
        // carpet: a bomb's farthest reach from its aim point plus its blast to a body stays inside the marker
        const carpet = AIRSTRIKE_VARIANTS.carpet;
        expect(carpet.zoneRadAdd).toBeGreaterThanOrEqual(airstrikeBombReach(carpet) + blast("carpet") + body);
        // normal and heavy: planes aim inside the map's radius, so the blast reaches past the marker by the same
        // margin, the iron bomb's rad.max
        const past = (v: "normal" | "heavy") => blast(v) - AIRSTRIKE_VARIANTS[v].zoneRadAdd;
        expect([past("normal"), past("heavy")]).toEqual([17.5, 17.5]);
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
