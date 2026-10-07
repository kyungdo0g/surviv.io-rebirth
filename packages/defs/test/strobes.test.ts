// Strobes in the defs: the strobe's numbers against survev.wiki.gg (research-cache/wikigg/pages/Strobe.json, rev 7010)
// and survev master, survev's strikeDelay applied over the original client's, and the rebirth variant strobes
// (rebirth/strobes.ts, strobeLoot.ts; docs/research/rebirth-deviations.md "Variant strobes"): same throw physics,
// their variant's colour, their own pings, bag rows after the original items, and loot only in the rare crates of the
// modes that already drop strobes.
import { describe, expect, it } from "vitest";
import {
    AIRSTRIKE_PINGS,
    AIRSTRIKE_VARIANT_COLORS,
    AIRSTRIKE_VARIANTS,
    airstrikePingVariant,
    dropsStrobeVariants,
    FACTION_STROBE_VARIANT_ROLL_SHARE,
    GameConfig,
    GameObjectDefs,
    GameObjectRegistry,
    getDefOfType,
    getMapObjectDefOfType,
    isAirstrikePing,
    isStrobe,
    MapDefs,
    RARE_THROWABLE_CRATES,
    RARE_THROWABLES_TABLE,
    rebirthDeviations,
    rebirthOnlyIds,
    STROBE_STRIKE_DELAY,
    STROBE_STRIKES,
    STROBE_VARIANT_ROLL_SHARE,
    STROBE_VARIANT_TYPES,
    strobeStrikeOf,
} from "../src/index.ts";
import { gameObjects, mapObjects } from "./helpers.ts";

const VARIANTS = STROBE_VARIANT_TYPES;

describe("the strobe (survev master, survev.wiki.gg)", () => {
    it("matches every number of the wiki infobox", () => {
        const s = getDefOfType("throwable", "strobe");
        // Cookable false, Fuse time 13.5, Hitbox radius 1, Quality 1
        expect([s.cookable, s.fuseTime, s.rad, s.quality]).toEqual([false, 13.5, 1, 1]);
        // PlayerVelMult 0.6, VelZ 5, Speed 25, SpinVel 6 (x pi rad/s), SpinDrag 1
        const t = s.throwPhysics;
        expect([t.playerVelMult, t.velZ, t.speed, t.spinDrag]).toEqual([0.6, 5, 25, 1]);
        expect(t.spinVel).toBeCloseTo(6 * Math.PI, 9);
        expect([s.explodeOnImpact, s.playerCollision]).toEqual([false, false]);
        // Explosion damage 1, obstacle x5, rad 1.5-2.5, 3 shrapnel
        const e = getDefOfType("explosion", s.explosionType);
        expect([s.explosionType, e.damage, e.obstacleDamage, e.rad, e.shrapnelCount]).toEqual([
            "explosion_strobe",
            1,
            5,
            { min: 1.5, max: 2.5 },
            3,
        ]);
        // Shrapnel damage 3, obstacle x1, falloff 1, speed 20, distance 3, variance 1.5
        const b = getDefOfType("bullet", e.shrapnelType);
        expect([e.shrapnelType, b.damage, b.obstacleDamage, b.falloff, b.speed, b.distance, b.variance]).toEqual([
            "shrapnel_strobe",
            3,
            1,
            1,
            20,
            3,
            1.5,
        ]);
        // Bag 2, Pack01-03 3 / 4 / 5 (the wiki's Pack04 6 is survev's level 4 pack, not in v0.8.82)
        expect(GameConfig.bagSizes.strobe).toEqual([2, 3, 4, 5]);
        // Pin strobe_click_01 (the explosion sounds are the client's "strobe" effect)
        expect(s.sound.pullPin).toBe("strobe_click_01");
        expect([s.lootImg.sprite, s.worldImg.sprite]).toEqual(["loot-throwable-strobe.img", "proj-strobe-armed.img"]);
    });

    it("takes survev's 3 s strike delay over the original client's 2.5 (conflicts.md strobe-strike-delay)", () => {
        expect(gameObjects.strobe.strikeDelay).toBe(2.5);
        expect(STROBE_STRIKE_DELAY).toBe(3);
        expect(getDefOfType("throwable", "strobe").strikeDelay).toBe(3);
        expect(rebirthDeviations.find((d) => d.id === "strobe")).toMatchObject({
            field: "strikeDelay",
            original: 2.5,
            rebirth: 3,
        });
        // nothing else of the strobe changes
        expect({ ...GameObjectDefs.strobe, strikeDelay: 2.5 }).toEqual(gameObjects.strobe);
    });

    it("calls 3 normal strikes, 5 with Broken Arrow, 5 u apart (survev weaponManager.ts:1337-1362)", () => {
        expect(STROBE_STRIKES.strobe).toEqual({
            variant: "normal",
            strikes: 3,
            brokenArrowBonus: 2,
            offsetMult: 1,
            ping: "ping_airstrike",
        });
    });
});

describe("variant strobes (rebirth)", () => {
    it("come after the other rebirth-only ids with their pings", () => {
        expect(VARIANTS).toEqual(["strobe_heavy", "strobe_carpet"]);
        // after the air strike shell and the beta new guns (rebirth/newGuns.ts)
        expect(rebirthOnlyIds.slice(-4)).toEqual([...VARIANTS, "ping_airstrike_heavy", "ping_airstrike_carpet"]);
        const last = GameObjectRegistry.typeToId(rebirthOnlyIds[rebirthOnlyIds.length - 5]);
        expect(VARIANTS.map((id) => GameObjectRegistry.typeToId(id))).toEqual([last + 1, last + 2]);
    });

    it("call 3 heavy shell lines (5 with Broken Arrow) and 6 carpet lines 1.4x wider apart (8)", () => {
        expect(STROBE_STRIKES.strobe_heavy).toMatchObject({ variant: "heavy", strikes: 3, brokenArrowBonus: 2 });
        expect(STROBE_STRIKES.strobe_heavy.offsetMult).toBe(1);
        expect(STROBE_STRIKES.strobe_carpet).toMatchObject({ variant: "carpet", strikes: 6, brokenArrowBonus: 2 });
        expect(STROBE_STRIKES.strobe_carpet.offsetMult).toBe(1.4);
        expect(AIRSTRIKE_VARIANTS.heavy.bombType).toBe("bomb_heavy");
        expect(VARIANTS.map((id) => strobeStrikeOf(id)?.ping)).toEqual([
            "ping_airstrike_heavy",
            "ping_airstrike_carpet",
        ]);
        expect(["strobe", ...VARIANTS].every(isStrobe)).toBe(true);
        expect(["frag", "smoke", "bomb_iron", "ping_airstrike"].some(isStrobe)).toBe(false);
    });

    it("are thrown like the strobe and drawn in their variant's colour", () => {
        const strobe = getDefOfType("throwable", "strobe");
        for (const id of VARIANTS) {
            const def = getDefOfType("throwable", id);
            const color = AIRSTRIKE_VARIANT_COLORS[STROBE_STRIKES[id].variant];
            expect([def.throwPhysics, def.fuseTime, def.rad, def.cookable]).toEqual([
                strobe.throwPhysics,
                strobe.fuseTime,
                strobe.rad,
                strobe.cookable,
            ]);
            expect([def.strikeDelay, def.explosionType, def.inventoryOrder, def.sound]).toEqual([
                3,
                "explosion_strobe",
                strobe.inventoryOrder,
                strobe.sound,
            ]);
            expect(def.lootImg).toEqual({ ...strobe.lootImg, tint: color, hudTint: color });
            expect(def.worldImg).toEqual({ ...strobe.worldImg, tint: color, recolor: true });
            expect(def.handImg?.equip?.right).toEqual({ ...strobe.handImg?.equip?.right, tint: color, recolor: true });
            expect(def.handImg?.cook?.right).toEqual({ ...strobe.handImg?.cook?.right, tint: color, recolor: true });
            // potato kills never hand them out
            expect(def.noPotatoSwap).toBe(true);
        }
        expect(getDefOfType("throwable", "strobe_heavy").name).toBe("Heavy Shell Strobe");
        expect(getDefOfType("throwable", "strobe_carpet").name).toBe("Carpet Bombing Strobe");
        // heavy orange-red, carpet magenta: the zone marker colours
        expect(AIRSTRIKE_VARIANT_COLORS).toEqual({ normal: 0xeaff00, heavy: 0xff3c1e, carpet: 0xe040ff });
    });

    it("mark their strike with a copy of ping_airstrike in the variant colour", () => {
        const ping = getDefOfType("ping", "ping_airstrike");
        expect(ping.tint).toBe(AIRSTRIKE_VARIANT_COLORS.normal);
        for (const v of ["heavy", "carpet"] as const) {
            const def = getDefOfType("ping", AIRSTRIKE_PINGS[v]);
            expect(def).toEqual({ ...ping, tint: AIRSTRIKE_VARIANT_COLORS[v] });
            // a map event: players cannot send it as a team ping (sim match/emotes.ts)
            expect(def.mapEvent).toBe(true);
            expect(airstrikePingVariant(AIRSTRIKE_PINGS[v])).toBe(v);
        }
        expect(airstrikePingVariant("ping_airstrike")).toBe("normal");
        expect(isAirstrikePing("ping_airdrop")).toBe(false);
    });

    it("stack like the strobe, as the last bag items (the original ones keep their protocol order)", () => {
        const items = Object.keys(GameConfig.bagSizes);
        expect(items.slice(-2)).toEqual([...VARIANTS]);
        for (const id of VARIANTS) expect(GameConfig.bagSizes[id]).toEqual(GameConfig.bagSizes.strobe);
        // after the 8 original ammo rows, the beta's 40mm / rocket / 57mm rows, frag and smoke
        expect(items.indexOf("strobe")).toBe(13);
    });
});

describe("variant strobe loot", () => {
    const reachable = (
        tables: Record<string, { name: string }[]>,
        tier: string,
        seen = new Set<string>(),
    ): string[] => {
        if (seen.has(tier)) return [];
        seen.add(tier);
        return (tables[tier] ?? []).flatMap((e) =>
            e.name.startsWith("tier_") ? reachable(tables, e.name, seen) : [e.name],
        );
    };

    it("drops in the rare crates of the modes whose air drops hold strobes, never in potato modes", () => {
        const maps = Object.keys(MapDefs).filter((name) => dropsStrobeVariants(MapDefs[name]));
        expect(maps).toEqual([
            "desert",
            "faction",
            "woods",
            "woods_snow",
            "woods_spring",
            "woods_summer",
            "savannah",
            "test_faction",
        ]);
    });

    it("is the rare crates' throwable roll: each variant 5 % in a gold drop, 1.25 % per 50v50 crate roll", () => {
        expect([STROBE_VARIANT_ROLL_SHARE, FACTION_STROBE_VARIANT_ROLL_SHARE]).toEqual([0.05, 0.0125]);
        for (const [name, def] of Object.entries(MapDefs)) {
            const base = def.lootTable.tier_airdrop_throwables;
            const rare = def.lootTable[RARE_THROWABLES_TABLE];
            if (!base) continue;
            if (!dropsStrobeVariants(def)) {
                // an exact copy: the rare crates drop what they always did
                expect(rare, name).toEqual(base);
                continue;
            }
            expect(rare.slice(0, base.length), name).toEqual(base);
            const added = rare.slice(base.length);
            expect(
                added.map((e) => [e.name, e.count]),
                name,
            ).toEqual(VARIANTS.map((id) => [id, 1]));
            const total = rare.reduce((sum, e) => sum + e.weight, 0);
            const share = def.gameMode.factionMode ? 0.0125 : 0.05;
            for (const e of added) expect(e.weight / total, name).toBeCloseTo(share, 5);
            // rarer than the strobe wherever the table holds one
            const strobe = rare.find((e) => e.name === "strobe");
            if (strobe) expect(strobe.weight).toBeGreaterThan(added[0].weight * 4);
        }
        expect(MapDefs.desert.lootTable[RARE_THROWABLES_TABLE].slice(-2).map((e) => e.weight)).toEqual([
            0.061111, 0.061111,
        ]);
    });

    it("comes only from the rare table: no floor loot, normal air drops or other tables", () => {
        for (const [name, def] of Object.entries(MapDefs)) {
            const tables = def.lootTable as Record<string, { name: string }[]>;
            for (const tier of Object.keys(tables)) {
                if (tier === RARE_THROWABLES_TABLE) continue;
                const items = reachable(tables, tier);
                for (const id of VARIANTS) expect(items, `${name}.${tier}`).not.toContain(id);
            }
        }
    });

    it("the gold drops and the 50v50 military crates roll the rare table instead of tier_airdrop_throwables", () => {
        expect(RARE_THROWABLE_CRATES).toEqual([
            "crate_11",
            "crate_11de",
            "crate_11sv",
            "crate_11tr",
            "crate_12",
            "crate_13",
        ]);
        for (const id of RARE_THROWABLE_CRATES) {
            const crate = getMapObjectDefOfType("obstacle", id);
            const original = mapObjects[id];
            expect(
                crate.loot.map((l) => l.tier ?? l.type),
                id,
            ).toEqual(
                original.loot.map((l: { tier?: string; type?: string }) =>
                    l.tier === "tier_airdrop_throwables" ? RARE_THROWABLES_TABLE : (l.tier ?? l.type),
                ),
            );
            expect({ ...crate, loot: original.loot }).toEqual(original);
        }
        // normal drops, their tier crates and the potato 50v50 crates keep tier_airdrop_throwables
        for (const id of ["crate_10", "crate_10sv", "crate_10t1", "crate_10t2", "crate_12po"]) {
            const tiers = getMapObjectDefOfType("obstacle", id).loot.map((l) => l.tier);
            expect(tiers, id).toContain("tier_airdrop_throwables");
            expect(tiers, id).not.toContain(RARE_THROWABLES_TABLE);
        }
    });
});
