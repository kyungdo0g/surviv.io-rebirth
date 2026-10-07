// The survev-only guns (tools/port-survev/policy.json; docs/adr/0003-survev-baseline.md): every stat pinned to its
// survev.wiki.gg infobox (the owner, 2026-10-07: "specs follow the wiki"), the generated JSON holding survev's source
// value, and the two fields where they differ, where the rebirth layer applies the wiki's (rebirth/survevGuns.ts). The
// winter sniper skins keep their base's stats; the fields where that differs from the wiki are pinned one by one
// (SKIN_WIKI_GAPS). Wiki revisions are the 2026-10-05 dump (research-cache/wikigg/pages), re-checked live on
// 2026-10-07.
import { describe, expect, it } from "vitest";
import {
    GameConfig,
    GameObjectDefs,
    GameObjectRegistry,
    getDefOfType,
    gunClass,
    rebirthDeviations,
    rebirthOnlyIds,
    SKIN_WIKI_GAPS,
    SURVEV_GUN_SKINS,
    SURVEV_ONLY_GUNS,
    WIKI_STAT_OVERRIDES,
} from "../src/index.ts";
import { gameObjects, PORTED_SURVEV_IDS, portPolicy, provenance, readOptionalJson } from "./helpers.ts";

type Pins = Readonly<Record<string, unknown>>;

interface WikiGun {
    /** wikigg page and revision */
    page: string;
    /** infobox values by def field path (gun fields, then its bullet, projectile and explosion) */
    gun: Pins;
    bullet: Pins;
    projectile?: Pins;
    explosion?: Pins;
}

// Field mapping: Magazine capacity maxClip, Extended capacity extendedClip, Ammo spawn ammoSpawnCount, Reload time
// reloadTime, Shots per reload maxReload, Fire delay fireDelay, Switch delay switchDelay, Standing / Moving spread
// shotSpread / moveSpread, FSA delay recoilTime, Barrel length barrelLength, Player speed speed.equip, Recoil speed
// speed.attack, Headshot multiplier headshotMult, Bullet count bulletCount, Jitter jitter, Empty fire 2
// sound.empty "empty_fire_02", class 50cal / 556mm / 12g / potato ammo 50AE / 556mm / 12gauge / potato_ammo; bullet
// Damage damage, Falloff falloff, Obstacle multiplier obstacleDamage, Distance distance, Speed speed.
const WIKI: Readonly<Record<(typeof SURVEV_ONLY_GUNS)[number], WikiGun>> = {
    barrett: {
        page: "wikigg/Barrett_M107 rev 7220",
        gun: {
            fireMode: "single",
            ammo: "50AE",
            maxClip: 10,
            extendedClip: 12,
            ammoSpawnCount: 30,
            reloadTime: 3.75,
            fireDelay: 0.925,
            switchDelay: 1,
            shotSpread: 1,
            moveSpread: 4,
            barrelLength: 4.2,
            "speed.equip": -1,
            "speed.attack": -4,
            headshotMult: 1.25,
            quality: 1,
            "sound.empty": "empty_fire_02",
        },
        bullet: { damage: 99, falloff: 0.975, obstacleDamage: 3, distance: 400, speed: 214 },
    },
    ash12: {
        page: "wikigg/ASh-12 rev 7221",
        gun: {
            fireMode: "auto",
            ammo: "50AE",
            maxClip: 10,
            extendedClip: 20,
            ammoSpawnCount: 70,
            reloadTime: 3.1,
            maxReload: 10,
            fireDelay: 0.1,
            switchDelay: 0.75,
            shotSpread: 3.5,
            moveSpread: 3.5,
            recoilTime: 0.35,
            barrelLength: 2.8,
            "speed.equip": -1,
            headshotMult: 2,
            quality: 1,
        },
        bullet: { damage: 31, falloff: 0.875, obstacleDamage: 1, distance: 70, speed: 85 },
    },
    sw500: {
        page: "wikigg/S&W_500 rev 7223",
        gun: {
            fireMode: "single",
            ammo: "50AE",
            pistol: true,
            maxClip: 5,
            // no Extended capacity on the page: Firepower adds nothing (survev extendedClip 5)
            extendedClip: 5,
            ammoSpawnCount: 35,
            reloadTime: 2.7,
            fireDelay: 0.65,
            switchDelay: 0.3,
            shotSpread: 1,
            moveSpread: 3.5,
            barrelLength: 2.7,
            "speed.equip": 0.5,
            "speed.attack": 0,
            headshotMult: 1.5,
            quality: 1,
        },
        bullet: { damage: 64, falloff: 0.92, obstacleDamage: 1, distance: 160, speed: 150 },
    },
    imbel: {
        page: "wikigg/IMD-2 rev 6441",
        gun: {
            fireMode: "auto",
            ammo: "556mm",
            maxClip: 40,
            extendedClip: 50,
            ammoSpawnCount: 120,
            reloadTime: 2.1,
            fireDelay: 0.092,
            switchDelay: 0.75,
            shotSpread: 3,
            moveSpread: 5,
            barrelLength: 3.9,
            headshotMult: 2,
            quality: 0,
            "sound.empty": "empty_fire_02",
        },
        bullet: { damage: 12, falloff: 0.9, obstacleDamage: 1.3, distance: 200, speed: 92 },
    },
    spas16: {
        page: "wikigg/SPAS-16 rev 5932",
        gun: {
            fireMode: "auto",
            ammo: "12gauge",
            "speed.attack": -1,
            maxClip: 6,
            extendedClip: 8,
            ammoSpawnCount: 18,
            reloadTime: 2.9,
            fireDelay: 0.35,
            switchDelay: 0.75,
            shotSpread: 5.5,
            moveSpread: 1.5,
            barrelLength: 3.65,
            bulletCount: 9,
            jitter: 0.3,
            headshotMult: 1.5,
            quality: 1,
        },
        // its pellets are the original client's bullet_flechette (survev/shared/defs/gameObjects/gunDefs.ts:2009)
        bullet: { damage: 8.75, falloff: 0.85, obstacleDamage: 1, distance: 45, speed: 88 },
    },
    potato_lmg: {
        page: "wikigg/PMG-134 rev 6674",
        gun: {
            fireMode: "auto",
            ammo: "potato_ammo",
            "speed.equip": -1.5,
            "speed.attack": -6,
            maxClip: 150,
            extendedClip: 250,
            reloadTime: 5.8,
            fireDelay: 0.07,
            switchDelay: 0.75,
            shotSpread: 8,
            moveSpread: 4,
            barrelLength: 4.5,
            ammoInfinite: true,
            noPotatoSwap: true,
            noSplinter: true,
            headshotMult: 1.5,
            bulletCount: 2,
            quality: 0,
        },
        // Bullet damage 0, Falloff 1: the invisible carrier bullet; the damage is the projectile's explosion
        bullet: { damage: 0, falloff: 1, obstacleDamage: 1 },
        // Projectile speed 96 (PMG-134); the projectile's own page, wikigg/Petite_Potato rev 4006
        projectile: {
            fuseTime: 999,
            rad: 0.1,
            explodeOnImpact: true,
            forceMaxThrowDistance: true,
            playerCollision: true,
            "throwPhysics.velZ": 3,
            "throwPhysics.speed": 96,
            "throwPhysics.spinDrag": 1,
            "throwPhysics.fixedCollisionHeight": 0.25,
        },
        // Explosion damage 8.5, obstacle x1.3, Min rad 1.25, Max rad 1.75 (PMG-134 rev 6674 and survev; the older
        // Petite_Potato rev 4006 says 1.7, so the two wiki pages disagree and the newer one, matching survev, is kept)
        explosion: { damage: 8.5, obstacleDamage: 1.3, "rad.min": 1.25, "rad.max": 1.75 },
    },
};

/**
 * The winter skins' wiki infoboxes: each skin is the "World image 2" of its base gun's page, so these are the base
 * pages (survev's rebalanced base guns; every value equals survev's source, survev/shared/defs/gameObjects/gunDefs.ts
 * and bulletDefs.ts). Same field mapping as above.
 */
const SKIN_WIKI: Readonly<Record<string, { page: string; gun: Pins; bullet: Pins }>> = {
    svd_winter: {
        page: "wikigg/SVD-63 rev 7355",
        gun: {
            fireMode: "single",
            ammo: "762mm",
            maxClip: 10,
            extendedClip: 20,
            ammoSpawnCount: 60,
            reloadTime: 2.5,
            fireDelay: 0.25,
            switchDelay: 0.75,
            shotSpread: 1,
            moveSpread: 4.5,
            barrelLength: 4.2,
            headshotMult: 1.5,
            quality: 0,
        },
        bullet: { damage: 37, falloff: 0.9, obstacleDamage: 1, distance: 425, speed: 127 },
    },
    sv98_winter: {
        page: "wikigg/SV-98 rev 7360",
        gun: {
            fireMode: "single",
            ammo: "762mm",
            maxClip: 10,
            extendedClip: 15,
            ammoSpawnCount: 30,
            reloadTime: 2.7,
            fireDelay: 1.5,
            switchDelay: 1,
            shotSpread: 1,
            moveSpread: 2.5,
            barrelLength: 4.1,
            headshotMult: 1.25,
            quality: 1,
        },
        bullet: { damage: 80, falloff: 0.96, obstacleDamage: 1.5, distance: 520, speed: 182 },
    },
    awc_winter: {
        page: "wikigg/AWM-S rev 7321",
        gun: {
            fireMode: "single",
            ammo: "308sub",
            maxClip: 5,
            extendedClip: 7,
            ammoSpawnCount: 20,
            reloadTime: 3.6,
            fireDelay: 1.5,
            switchDelay: 1,
            shotSpread: 0.5,
            moveSpread: 4,
            barrelLength: 4,
            headshotMult: 1,
            quality: 1,
        },
        bullet: { damage: 180, falloff: 0.94, obstacleDamage: 1.5, distance: 300, speed: 136 },
    },
};

const get = (o: unknown, path: string) =>
    path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);

/** [def id, field path, wiki value] of every pin. */
function pins(): Array<[string, string, unknown]> {
    const out: Array<[string, string, unknown]> = [];
    for (const [id, w] of Object.entries(WIKI)) {
        const gun = getDefOfType("gun", id);
        for (const [f, v] of Object.entries(w.gun)) out.push([id, f, v]);
        for (const [f, v] of Object.entries(w.bullet)) out.push([gun.bulletType, f, v]);
        if (w.projectile) for (const [f, v] of Object.entries(w.projectile)) out.push([gun.projType!, f, v]);
        if (w.explosion) {
            const explosion = getDefOfType("throwable", gun.projType!).explosionType;
            for (const [f, v] of Object.entries(w.explosion)) out.push([explosion, f, v]);
        }
    }
    return out;
}

describe("survev-only guns: stats", () => {
    it("are the six guns only survev has, each with a class", () => {
        expect([...SURVEV_ONLY_GUNS]).toEqual(["imbel", "spas16", "barrett", "sw500", "ash12", "potato_lmg"]);
        expect(Object.keys(WIKI).sort()).toEqual([...SURVEV_ONLY_GUNS].sort());
        const classes = SURVEV_ONLY_GUNS.map((id) => gunClass(id));
        expect(classes).toEqual(["lmg", "shotgun", "sniper", "pistol", "assault", "special"]);
    });

    it("every infobox value of the wiki is the game's value", () => {
        const all = pins();
        expect(all.length).toBeGreaterThan(100);
        for (const [id, field, wiki] of all) expect(get(GameObjectDefs[id], field), `${id}.${field}`).toEqual(wiki);
    });

    it("the generated JSON holds survev's source value, which only two fields change to the wiki's", () => {
        const overridden = new Map(WIKI_STAT_OVERRIDES.map((o) => [`${o.id}.${o.field}`, o]));
        expect([...overridden.keys()]).toEqual(["potato_lmg.barrelLength", "potato_lmgshot.throwPhysics.velZ"]);
        for (const [id, field, wiki] of pins()) {
            const o = overridden.get(`${id}.${field}`);
            expect(get(gameObjects[id], field), `generated ${id}.${field}`).toEqual(o ? o.survev : wiki);
        }
        // survev: PMG-134 barrelLength 5 (gunDefs.ts:3543), Petite Potato velZ 5 (throwableDefs.ts:762)
        expect(WIKI_STAT_OVERRIDES.map((o) => [o.id, o.field, o.survev, o.wiki])).toEqual([
            ["potato_lmg", "barrelLength", 5, 4.5],
            ["potato_lmgshot", "throwPhysics.velZ", 5, 3],
        ]);
        for (const o of WIKI_STAT_OVERRIDES) {
            const dev = rebirthDeviations.find((d) => d.id === o.id && d.field === o.field);
            expect(dev, `${o.id}.${o.field}`).toMatchObject({ original: o.survev, rebirth: o.wiki });
            expect(dev?.reason).toContain(o.wikiRef);
            expect(dev?.reason).toContain(o.survevRef);
        }
    });

    it("presentation: survev's art and sounds, the .50 casing on the Barrett and the ASh-12, the minigun pose", () => {
        for (const id of SURVEV_ONLY_GUNS) {
            const gun = getDefOfType("gun", id);
            const art = id.replace("_", "-");
            expect(gun.lootImg.sprite, id).toBe(`loot-weapon-${art}.img`);
            expect(gun.worldImg.sprite, id).toBe(
                id === "potato_lmg" ? "gun-potato-lmg-top-01.img" : `gun-${id}-01.img`,
            );
            expect(gun.sound.shoot, id).toBe(`${id}_01`);
            expect(gun.sound.reload, id).toBe(`${id}_reload_01`);
            expect(gun.sound.deploy, id).toBe(`${id}_switch_01`);
        }
        expect(getDefOfType("gun", "barrett").particle.casing).toBe("50cal");
        expect(getDefOfType("gun", "ash12").particle.casing).toBe("50cal");
        expect(getDefOfType("gun", "potato_lmg").isMinigun).toBe(true);
        // the S&W 500 is a revolver: its casings drop on reload
        expect(getDefOfType("gun", "sw500").caseTiming).toBe("reload");
    });

    it("the winter sniper skins are their base with survev's winter world image", () => {
        expect(portPolicy.survevSkins).toMatchObject(SURVEV_GUN_SKINS);
        for (const [skin, base] of Object.entries(SURVEV_GUN_SKINS)) {
            const s = getDefOfType("gun", skin);
            const b = getDefOfType("gun", base);
            expect(s.worldImg.sprite).toBe(`gun-${base}-02.img`);
            expect(s.baseType).toBe(base);
            expect(s.noPotatoSwap).toBe(true);
            expect(gunClass(skin)).toBe(gunClass(base));
            const { worldImg: _w, baseType: _t, noPotatoSwap: _n, ...stats } = s;
            const { worldImg: _bw, ...baseStats } = b;
            expect(stats, skin).toEqual(baseStats);
        }
    });

    it("the winter skins match their wiki infobox except the listed gaps, which they share with the base", () => {
        expect(Object.keys(SKIN_WIKI).sort()).toEqual(Object.keys(SURVEV_GUN_SKINS).sort());
        const gaps = new Map(SKIN_WIKI_GAPS.map((g) => [`${g.id}.${g.field}`, g]));
        const seen = new Set<string>();
        for (const [skin, w] of Object.entries(SKIN_WIKI)) {
            const gun = getDefOfType("gun", skin);
            const base = getDefOfType("gun", SURVEV_GUN_SKINS[skin]);
            const fields: Array<[string, unknown, unknown, unknown]> = [
                ...Object.entries(w.gun).map(([f, v]): [string, unknown, unknown, unknown] => [
                    f,
                    v,
                    get(gun, f),
                    get(base, f),
                ]),
                ...Object.entries(w.bullet).map(([f, v]): [string, unknown, unknown, unknown] => [
                    `bullet.${f}`,
                    v,
                    get(GameObjectDefs[gun.bulletType], f),
                    get(GameObjectDefs[base.bulletType], f),
                ]),
            ];
            for (const [field, wiki, ours, baseValue] of fields) {
                const key = `${skin}.${field}`;
                const gap = gaps.get(key);
                // a skin always hits like its base (survev's defineGunSkin)
                expect(ours, `${key} = base`).toEqual(baseValue);
                if (!gap) {
                    expect(ours, `${key} (${w.page})`).toEqual(wiki);
                    continue;
                }
                seen.add(key);
                // a listed gap: ours is the base's 0.8.82 value; the entry fails once option B closes it
                expect([gap.wiki, gap.rebirth], key).toEqual([wiki, ours]);
                expect(ours, key).not.toEqual(wiki);
                expect(gap.wikiRef, key).toContain(w.page.split(" rev ")[0]);
            }
        }
        expect([...seen].sort()).toEqual([...gaps.keys()].sort());
        expect(SKIN_WIKI_GAPS.map((g) => `${g.id}.${g.field}`)).toEqual([
            "svd_winter.barrelLength",
            "svd_winter.headshotMult",
            "svd_winter.bullet.damage",
            "sv98_winter.barrelLength",
            "sv98_winter.headshotMult",
            "awc_winter.barrelLength",
        ]);
        // the damage and headshot gaps are survev balance changes the port reverts on the base guns (balance.txt
        // lines 61, 62, 93): the revert record holds the wiki's number as survev's
        const revert: Array<{ target: string; forkValue: unknown; originalValue: unknown }> =
            readOptionalJson("docs/research/provenance/balance-revert.json") ?? [];
        for (const g of SKIN_WIKI_GAPS.filter((x) => x.field !== "barrelLength")) {
            const base = getDefOfType("gun", SURVEV_GUN_SKINS[g.id]);
            const target = g.field.startsWith("bullet.")
                ? `${base.bulletType}.${g.field.slice("bullet.".length)}`
                : `${SURVEV_GUN_SKINS[g.id]}.${g.field}`;
            expect(
                revert.find((e) => e.target === target),
                target,
            ).toMatchObject({ forkValue: g.wiki, originalValue: g.rebirth });
        }
    });
});

describe("survev-only guns: ammo, ids", () => {
    // wikigg .50 Caliber rev 7198: 50 / 100 / 150 / 200 / 250; the game has four packs
    it(".50 ammo: survev's bag sizes for the four packs", () => {
        expect(GameConfig.bagSizes["50AE"]).toEqual([50, 100, 150, 200]);
        for (const id of ["barrett", "ash12", "sw500", "deagle"]) expect(getDefOfType("gun", id).ammo).toBe("50AE");
        // the S&W 500's 35 and the ASh-12's 70 spawn rounds fit a level 0 bag
        expect(GameConfig.bagSizes["50AE"][0]).toBeGreaterThanOrEqual(35);
    });

    it("take wire ids after every original id and before the rebirth-only ones", () => {
        expect(PORTED_SURVEV_IDS).toEqual(
            expect.arrayContaining([
                ...SURVEV_ONLY_GUNS,
                ...Object.keys(SURVEV_GUN_SKINS),
                "bullet_barrett",
                "bullet_sw500",
                "bullet_ash12",
                "bullet_imbel",
                "bullet_invis",
                "potato_lmgshot",
                "explosion_potato_lmgshot",
            ]),
        );
        const ids = Object.keys(GameObjectDefs);
        const firstSurvev = Math.min(...PORTED_SURVEV_IDS.map((id) => ids.indexOf(id)));
        const original = ids.slice(0, firstSurvev);
        expect(original.every((id) => provenance.gameObjects[id] === "original")).toBe(true);
        expect(ids.slice(firstSurvev, firstSurvev + PORTED_SURVEV_IDS.length).sort()).toEqual(
            [...PORTED_SURVEV_IDS].sort(),
        );
        expect(ids.slice(firstSurvev + PORTED_SURVEV_IDS.length)).toEqual([...rebirthOnlyIds]);
        expect(GameObjectRegistry.typeToId("barrett")).toBe(ids.indexOf("barrett") + 1);
        expect(GameObjectRegistry.size).toBeLessThanOrEqual(2 ** 10);
    });
});
