// The rebirth's new guns in the defs layer (src/rebirth/newGuns.ts; the beta of 2026-10-07): every def is the decided
// balance sheet's (docs/design/new-gun-stats.json), the owner's loot icons included, every infobox number of
// new-gun-stats.md is what the defs hold, the new ammo joins GameConfig, every reference resolves, and the art and sound
// fallbacks (src/rebirth/newGunAssets.ts) are the sheet's but for the owner's later sound decisions.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    CHARGE_AMMO_IDS,
    GameConfig,
    GameObjectDefs,
    type GunDef,
    getDefOfType,
    gunClass,
    hasDef,
    hasMapObjectDef,
    NEW_AMMO_BAG_AFTER,
    NEW_AMMO_EMOTES,
    NEW_AMMO_IDS,
    NEW_GUN_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    NEW_GUN_LOOT_ICONS,
    NEW_GUN_SOUND_DONORS,
    newAmmoEmoteTexture,
    newGunDefs,
    rebirthOnlyIds,
} from "../src/index.ts";
import { gameConfig, gameObjects, REPO_ROOT } from "./helpers.ts";

const sheet = JSON.parse(readFileSync(`${REPO_ROOT}docs/design/new-gun-stats.json`, "utf8"));
const gun = (id: string) => getDefOfType("gun", id);
/** The leading number of an infobox text ("0.09 (667 rpm)" -> 0.09), NaN for "none (...)". */
const num = (v: unknown): number => (typeof v === "number" ? v : Number.parseFloat(String(v)));

describe("new guns: the sheet's defs", () => {
    it("are the sheet's 30 guns plus the dual TEC-9 and dual vz. 61, in its order, after the air strike shell", () => {
        expect(NEW_GUN_IDS).toEqual(Object.keys(sheet.guns));
        expect(NEW_GUN_IDS).toHaveLength(32);
        expect(NEW_GUN_IDS).not.toContain("spas15");
        for (const id of Object.keys(newGunDefs())) {
            expect(rebirthOnlyIds, id).toContain(id);
            expect(Object.hasOwn(gameObjects, id), id).toBe(false);
        }
    });

    it.each(Object.keys(sheet.guns))("%s: gun, bullet, explosion and projectile defs equal the sheet's", (id) => {
        const entry = sheet.guns[id];
        // the loot icon is the owner's (loot-weapon-<id>.img); the client falls back to the sheet's while it is missing
        expect(gun(id)).toEqual(entry.gun);
        expect(NEW_GUN_LOOT_ICONS[id]).toBe(entry.gun.lootImg.sprite);
        expect(NEW_GUN_LOOT_FALLBACKS[id]).toBe(entry.assets.lootImg.fallback);
        for (const [bid, def] of Object.entries(entry.bullets)) expect(GameObjectDefs[bid], bid).toEqual(def);
        for (const [eid, def] of Object.entries(entry.explosions)) expect(GameObjectDefs[eid], eid).toEqual(def);
        for (const [tid, def] of Object.entries<any>(entry.throwables)) {
            const { assetNote: _, ...rest } = def;
            expect(GameObjectDefs[tid], tid).toEqual(rest);
        }
        for (const shared of entry.sharedDefs) expect(hasDef(shared), shared).toBe(true);
        expect(gunClass(id)).toBe(sheet.gunClasses[id]);
    });

    it.each(Object.keys(sheet.guns))("%s: every infobox number of new-gun-stats.md is in the defs", (id) => {
        const box = sheet.guns[id].infobox;
        const def = gun(id);
        const bullet = getDefOfType("bullet", def.bulletType);
        expect(def.speed.equip, "player speed").toBe(box.playerSpeed);
        expect(def.speed.attack, "recoil speed").toBe(box.recoilSpeed);
        expect(def.speed.carry ?? 0, "carry speed").toBe(box.carrySpeed);
        expect(def.maxClip, "magazine").toBe(num(box.magazineCapacity));
        const ext = /ext (\d+)/.exec(box.magazineCapacity);
        expect(def.extendedClip, "extended magazine").toBe(ext ? Number(ext[1]) : def.maxClip);
        expect(def.ammoSpawnCount, "ammo spawn").toBe(box.ammoSpawn);
        if (def.charges) expect(box.reloadTime).toMatch(/^none/);
        else expect(def.reloadTime, "reload").toBe(num(box.reloadTime));
        expect(def.fireDelay, "fire delay").toBe(num(box.fireDelay));
        expect(def.switchDelay, "switch delay").toBe(box.switchDelay);
        expect([def.shotSpread, def.moveSpread], "standing / moving spread").toEqual([
            box.standingSpread,
            box.movingSpread,
        ]);
        expect(def.barrelLength, "barrel").toBe(box.barrelLength);
        expect(def.headshotMult, "headshot").toBe(box.bullet.headshotMultiplier);
        expect(bullet.damage, "damage").toBe(num(box.bullet.damage.replace(/^\d+ x \(/, "")));
        if (typeof box.bullet.falloff === "number") expect(bullet.falloff, "falloff").toBe(box.bullet.falloff);
        const obstacle = /^(?:bullet x)?([\d.]+)/.exec(box.bullet.obstacleMultiplier);
        if (obstacle) expect(bullet.obstacleDamage, "obstacle").toBe(Number(obstacle[1]));
        if (def.projType) {
            // the 40 mm lob: the infobox gives the grenade's speed, its range comes from the 1.3 s fuse
            const proj = getDefOfType("throwable", def.projType);
            expect(proj.throwPhysics.speed).toBe(box.bullet.speed);
            expect(proj.throwPhysics.speed * proj.fuseTime).toBeCloseTo(box.bullet.distance, 6);
        } else {
            expect([bullet.distance, bullet.speed], "range / speed").toEqual([box.bullet.distance, box.bullet.speed]);
        }
        const blast = /(\d+) explosion \(rad ([\d.]+)-([\d.]+)\)/.exec(box.bullet.damage);
        if (blast) {
            const exp = getDefOfType(
                "explosion",
                bullet.onHit ?? getDefOfType("throwable", def.projType!).explosionType,
            );
            expect([exp.damage, exp.rad.min, exp.rad.max]).toEqual([
                Number(blast[1]),
                Number(blast[2]),
                Number(blast[3]),
            ]);
            const shrapnel = /(\d+) x 20 shrapnel/.exec(box.bullet.damage);
            expect(exp.shrapnelCount, "shrapnel").toBe(shrapnel ? Number(shrapnel[1]) : 0);
            const expObstacle = /explosion x([\d.]+)/.exec(box.bullet.obstacleMultiplier);
            if (expObstacle) expect(exp.obstacleDamage).toBe(Number(expObstacle[1]));
        }
    });
});

describe("new guns: mechanics fields (new-gun-stats.md section 4)", () => {
    const guns = () => NEW_GUN_IDS.map((id) => [id, gun(id)] as [string, GunDef]);

    it("single-use guns: Boys 7, Panzerfaust 1, M202 1 (a volley of 4); no reload, no bag ammo, no Firepower", () => {
        const charges = Object.fromEntries(
            guns()
                .filter(([, d]) => d.charges)
                .map(([id, d]) => [id, d.charges]),
        );
        expect(charges).toEqual({ boys: 7, panzerfaust: 1, m202: 1 });
        for (const id of Object.keys(charges)) {
            const d = gun(id);
            expect([d.maxClip, d.extendedClip, d.maxReload, d.extendedReload], id).toEqual(Array(4).fill(d.charges));
            expect(d.discardWhenEmpty && d.ignoreEndlessAmmo, id).toBe(true);
            expect(d.ammoSpawnCount, id).toBe(0);
            expect(CHARGE_AMMO_IDS, id).toContain(d.ammo);
            // pseudo ammo: no def, no bag row
            expect(hasDef(d.ammo) || Object.hasOwn(GameConfig.bagSizes, d.ammo), id).toBe(false);
        }
        expect(gun("m202").bulletCount).toBe(4);
        expect(sheet.chargeAmmoIds).toEqual([...CHARGE_AMMO_IDS]);
    });

    it("DP-12: two shots 0.2 s apart, then a 0.7 s pump; 2 shells per reload", () => {
        expect(
            guns()
                .filter(([, d]) => d.pumpEvery)
                .map(([id]) => id),
        ).toEqual(["dp12"]);
        const d = gun("dp12");
        expect([d.pumpEvery, d.fireDelay, d.pumpDelay, d.maxReload, d.reloadTime]).toEqual([2, 0.2, 0.7, 2, 1.2]);
        expect([d.bulletType, d.bulletCount, d.fireMode]).toEqual(["bullet_buckshot", 9, "single"]);
    });

    it("DShK: carry -2 in a slot, equip -1, attack -5; no other gun carries weight", () => {
        expect(
            guns()
                .filter(([, d]) => d.speed.carry)
                .map(([id]) => id),
        ).toEqual(["dshk"]);
        expect(gun("dshk").speed).toEqual({ carry: -2, equip: -1, attack: -5 });
    });

    it("launchers: six, Endless Ammo never applies, rockets and the GL-06 round do not ricochet and arm", () => {
        const launchers = guns()
            .filter(([, d]) => d.isLauncher)
            .map(([id]) => id);
        expect(launchers).toEqual(["m79", "mgl", "gl06", "rpg7", "panzerfaust", "m202"]);
        for (const id of launchers) {
            const d = gun(id);
            expect([d.ignoreEndlessAmmo, d.noPotatoSwap, d.noSplinter, d.deployGroup], id).toEqual([
                true,
                true,
                true,
                3,
            ]);
            expect(gunClass(id)).toBe("launcher");
        }
        // the 40 mm lob is a projectile with no arming (as the original M79); the others are exploding bullets
        expect([gun("m79").projType, gun("mgl").projType]).toEqual(["m79_grenade", "m79_grenade"]);
        const arm = { gl06: 4, rpg7: 5, panzerfaust: 4, m202: 5 };
        for (const [id, dist] of Object.entries(arm)) {
            const b = getDefOfType("bullet", gun(id).bulletType);
            expect([b.noReflect, b.noDistAdj, b.armDistance], id).toEqual([true, true, dist]);
            expect(hasDef(b.onHit ?? ""), id).toBe(true);
        }
        expect(gun("gl06").toMouseHit).toBe(true);
        const lob = getDefOfType("throwable", "m79_grenade");
        expect([lob.explosionType, lob.explodeOnImpact, lob.playerCollision, lob.fuseTime]).toEqual([
            "explosion_m79",
            true,
            true,
            1.3,
        ]);
    });

    it("gold-only guns: RPG-7, MGL, Hécate II, Lynx, DShK; M16A4 3-round burst; AA-12 slugs on full auto", () => {
        const goldOnly = guns()
            .filter(([, d]) => d.goldOnly)
            .map(([id]) => id);
        expect(goldOnly.sort()).toEqual([...sheet.loot.goldOnly].sort());
        const m16 = gun("m16a4");
        expect([m16.fireMode, m16.burstCount, m16.burstDelay, m16.fireDelay]).toEqual(["burst", 3, 0.075, 0.3]);
        const aa12 = gun("aa12");
        expect([aa12.fireMode, aa12.bulletCount, getDefOfType("bullet", aa12.bulletType).damage]).toEqual([
            "auto",
            1,
            64,
        ]);
    });
});

describe("new ammo (new-gun-stats.md 4.5)", () => {
    it("40mm teal, rocket brown, 5.7x28 pink: defs, bags after .45 ACP (the sheet's first four sizes), tracers", () => {
        expect([...NEW_AMMO_IDS]).toEqual(["40mm", "rocket", "57mm"]);
        for (const id of NEW_AMMO_IDS) {
            const a = sheet.ammo[id];
            expect(GameObjectDefs[id]).toEqual(a.def);
            expect(GameConfig.bagSizes[id]).toEqual(a.bagSizes.slice(0, 4));
            expect(GameConfig.tracerColors[id]).toEqual(a.tracerColor);
        }
        expect(getDefOfType("ammo", "40mm").lootImg.tint).toBe(0x0cddab);
        expect(getDefOfType("ammo", "rocket").lootImg.tint).toBe(0x8b4513);
        expect(getDefOfType("ammo", "57mm").lootImg.tint).toBe(0xff5fb4);
        const keys = Object.keys(GameConfig.bagSizes);
        const at = keys.indexOf(NEW_AMMO_BAG_AFTER);
        expect(keys.slice(at, at + 5)).toEqual(["45acp", "40mm", "rocket", "57mm", "frag"]);
        // every other row keeps its place and sizes; the generated config is untouched
        expect(keys.filter((k) => !(NEW_AMMO_IDS as readonly string[]).includes(k))).toEqual(
            Object.keys(gameConfig.bagSizes),
        );
        for (const k of Object.keys(gameConfig.bagSizes))
            expect(GameConfig.bagSizes[k]).toEqual(gameConfig.bagSizes[k]);
        expect(gameConfig.bagSizes["40mm"]).toBeUndefined();
        // 9-bit inventory counts on the wire
        expect(Math.max(...NEW_AMMO_IDS.map((id) => GameConfig.bagSizes[id][3]))).toBeLessThan(512);
    });

    it("each gets the sheet's ping emote, an original ammo emote but for its own texture (ammo-<id>.img)", () => {
        const original = GameObjectDefs.emote_ammo45acp as Record<string, unknown>;
        for (const id of NEW_AMMO_IDS) {
            const emote = sheet.ammo[id].emote.id as string;
            expect(NEW_AMMO_EMOTES[id], id).toBe(emote);
            expect(GameObjectDefs[emote], emote).toEqual({ ...original, texture: `ammo-${id}.img` });
            expect(newAmmoEmoteTexture(id)).toBe(`ammo-${id}.img`);
        }
        // last in the registry, after the guns, so no other id moves
        expect(Object.keys(newGunDefs()).slice(-3)).toEqual(NEW_AMMO_IDS.map((id) => NEW_AMMO_EMOTES[id]));
    });
});

describe("new guns: references", () => {
    it("bullets, projectiles, explosions, shrapnel, decals, tracer colours, ammo and dual pairs resolve", () => {
        for (const id of NEW_GUN_IDS) {
            const d = gun(id);
            const b = getDefOfType("bullet", d.bulletType);
            expect(Object.hasOwn(GameConfig.tracerColors, b.tracerColor), `${id} tracer ${b.tracerColor}`).toBe(true);
            if (!d.charges) getDefOfType("ammo", d.ammo);
            if (d.dualWieldType) expect(gun(d.dualWieldType).isDual, id).toBe(true);
            const explosions = [b.onHit, d.projType ? getDefOfType("throwable", d.projType).explosionType : undefined];
            for (const e of explosions.filter((x): x is string => !!x)) {
                const exp = getDefOfType("explosion", e);
                if (exp.shrapnelType) getDefOfType("bullet", exp.shrapnelType);
                expect(hasMapObjectDef(exp.decalType), `${e} decal`).toBe(true);
            }
        }
        expect([gun("tec9").dualWieldType, gun("vz61").dualWieldType]).toEqual(["tec9_dual", "vz61_dual"]);
    });
});

describe("new guns: art and sound fallbacks (src/rebirth/newGunAssets.ts)", () => {
    /** the owner's decisions after the sheet (assets-user/audio/guns/MANIFEST.md "Owner decisions") */
    const OWNER: Readonly<Record<string, string>> = {
        mk14_01: "mk12_01",
        mk14_reload_01: "scar_reload_01",
        mk14_switch_01: "scar_switch_01",
        tec9_reload_01: "glock_reload_01",
        // the dual TEC-9 follows the single's G18C reload: the dual G18C's
        tec9_reload_02: "glock_reload_02",
        asval_reload_01: "ak47_reload_01",
    };

    it("every sound a new gun names has a donor: the sheet's (a shared name: the first gun's), or the owner's", () => {
        const expected: Record<string, string> = {};
        for (const entry of Object.values<any>(sheet.guns)) {
            for (const [name, donor] of Object.entries<string>(entry.assets.sounds)) expected[name] ??= donor;
        }
        expect(NEW_GUN_SOUND_DONORS).toEqual({ ...expected, ...OWNER });
        const shared = new Set(["empty_fire_01", "empty_fire_02", "gun_pickup_01"]);
        for (const id of NEW_GUN_IDS) {
            for (const [field, name] of Object.entries(gun(id).sound)) {
                if (typeof name !== "string" || !name || shared.has(name)) continue;
                expect(NEW_GUN_SOUND_DONORS[name], `${id}.sound.${field}`).toBeDefined();
            }
        }
        // donors are sounds of original or survev guns, never another new gun's
        for (const donor of Object.values(NEW_GUN_SOUND_DONORS)) expect(NEW_GUN_SOUND_DONORS[donor]).toBeUndefined();
    });

    it("every new gun has a fallback loot icon: an original gun's", () => {
        expect(Object.keys(NEW_GUN_LOOT_FALLBACKS)).toEqual(NEW_GUN_IDS);
        const iconsOfOtherGuns = new Set(
            Object.entries(GameObjectDefs)
                .filter(([id, d]) => d.type === "gun" && !NEW_GUN_IDS.includes(id))
                .map(([, d]) => (d as GunDef).lootImg.sprite),
        );
        for (const [id, icon] of Object.entries(NEW_GUN_LOOT_FALLBACKS))
            expect(iconsOfOtherGuns.has(icon), id).toBe(true);
    });
});
