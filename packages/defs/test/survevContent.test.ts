// The survev-only melee weapons, throwables and perk of the survev content wave, stage 1 (tools/port-survev/policy.json;
// docs/adr/0003-survev-baseline.md): every infobox stat pinned to survev.wiki.gg, the generated JSON holding survev's
// source value, the two fields where they differ taking the wiki's (survev/wikiSpecs.ts), and the loot placements
// survev gives them on the maps we have. Wiki revisions are the 2026-10-07 dump (research-cache/wikigg/pages).
import { describe, expect, it } from "vitest";
import {
    GameConfig,
    getDefOfType,
    getMapDef,
    SURVEV_MELEE_SKINS,
    SURVEV_ONLY_MELEE,
    SURVEV_ONLY_THROWABLES,
    survevWikiSpecs,
    WIKI_SPEC_OVERRIDES,
} from "../src/index.ts";
import { gameObjects, mapObjects, PORTED_SURVEV_IDS, portPolicy } from "./helpers.ts";

/** wikigg Melee infobox (Damage, Obstacle multiplier, Damage timestamps, Cooldown, Switch delay, Radius, X offset) */
const WIKI_MELEE: Readonly<Record<string, Record<string, unknown>>> = {
    // wikigg/Ice_Axe rev 5181
    iceaxe: {
        damage: 44,
        obstacleDamage: 2.4,
        "attack.damageTimes": [0.21],
        "attack.cooldownTime": 0.4,
        switchDelay: 0.25,
        "attack.rad": 1.3,
        "attack.offset": { x: 1.4, y: 0 },
        armorPiercing: true,
        stonePiercing: true,
        cleave: undefined,
        "sound.pickup": "heavy_pickup_01",
        "sound.swing": "medium_swing_01",
    },
    // wikigg/Cutlass rev 5250, tab Cutlass
    cutlass: {
        damage: 30,
        obstacleDamage: 1,
        "attack.damageTimes": [0.1],
        "attack.cooldownTime": 0.225,
        switchDelay: 0.25,
        "attack.rad": 1.75,
        "attack.offset": { x: 2.25, y: 0 },
        cleave: true,
        perk: undefined,
        "sound.deploy": "knife_deploy_01",
    },
    // wikigg/Cutlass rev 5250, tab Gold Cutlass: "Gives Pirate's Bounty when in inventory", Potato swap False
    cutlass_gold: {
        damage: 35,
        obstacleDamage: 1,
        "attack.damageTimes": [0.1],
        "attack.cooldownTime": 0.225,
        switchDelay: 0.25,
        "attack.rad": 1.75,
        "attack.offset": { x: 2.25, y: 0 },
        cleave: true,
        perk: "pirate",
        noPotatoSwap: true,
    },
    // wikigg/Naginata rev 5067, tab Naginata Daemon (the Naginata's stats)
    naginata_daemon: {
        damage: 56,
        obstacleDamage: 1.92,
        "attack.damageTimes": [0.27],
        "attack.cooldownTime": 0.54,
        "attack.rad": 2,
        "attack.offset": { x: 3.5, y: 0 },
        cleave: true,
        armorPiercing: true,
    },
    // wikigg/Karambit rev 6968, tab Borealis (the Karambit's stats)
    karambit_borealis: {
        damage: 24,
        obstacleDamage: 1,
        "attack.damageTimes": [0.1],
        "attack.cooldownTime": 0.25,
        "attack.rad": 0.9,
        "attack.offset": { x: 1.35, y: 0 },
    },
};

/** wikigg Throwable infobox: the throwable's fields, its explosion's and its bag row (Bag, Pack01-04) */
const WIKI_THROWABLE: Readonly<
    Record<string, { item: Record<string, unknown>; explosion: Record<string, unknown>; bag: number[] }>
> = {
    // wikigg/Coconut rev 7413 (Cookable True: the wiki wins over the source's false)
    coconut: {
        item: {
            cookable: true,
            fuseTime: 9999,
            rad: 1.15,
            explodeOnImpact: true,
            forceMaxThrowDistance: true,
            playerCollision: true,
            noPotatoSwap: true,
            "throwPhysics.playerVelMult": 0,
            "throwPhysics.velZ": 3.35,
            "throwPhysics.speed": 45,
            "throwPhysics.spinDrag": 1,
            "throwPhysics.fixedCollisionHeight": 0.25,
        },
        explosion: {
            damage: 22,
            obstacleDamage: 1,
            "rad.min": 1.34,
            "rad.max": 1.35,
            freezeDuration: 1,
            healTeam: true,
            healAmount: 7,
        },
        bag: [3, 6, 9, 12, 15],
    },
    // wikigg/Tomato_(Throwable) rev 7178 (Cookable False: the wiki wins over the source's true)
    tomato: {
        item: {
            cookable: false,
            fuseTime: 9999,
            rad: 1,
            explodeOnImpact: true,
            forceMaxThrowDistance: true,
            playerCollision: true,
            "throwPhysics.playerVelMult": 0,
            "throwPhysics.velZ": 3.35,
            "throwPhysics.speed": 55,
            "throwPhysics.spinDrag": 1,
            "throwPhysics.fixedCollisionHeight": 0.25,
        },
        explosion: {
            damage: 11,
            obstacleDamage: 1,
            "rad.min": 1.29,
            "rad.max": 1.3,
            freezeDuration: 0.5,
            dropRandomLoot: 1,
        },
        bag: [10, 20, 30, 40, 50],
    },
};

const at = (def: unknown, path: string): unknown =>
    path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), def);

describe("survev-only melee and throwables: specs", () => {
    it("the policy ports them (and the Gold Cutlass's perk) after the survev-only guns", () => {
        expect(PORTED_SURVEV_IDS).toEqual(
            expect.arrayContaining([
                ...SURVEV_ONLY_MELEE,
                ...Object.keys(SURVEV_MELEE_SKINS),
                ...Object.keys(SURVEV_ONLY_THROWABLES),
                ...Object.values(SURVEV_ONLY_THROWABLES),
                "pirate",
            ]),
        );
        expect(portPolicy.survevSkins).toMatchObject(SURVEV_MELEE_SKINS);
    });

    it.each(Object.keys(WIKI_MELEE))("%s matches its wiki infobox", (id) => {
        const def = getDefOfType("melee", id);
        for (const [field, value] of Object.entries(WIKI_MELEE[id]))
            expect(at(def, field), `${id}.${field}`).toEqual(value);
    });

    it("the melee skins are their original base with survev's name, images, rarity and lore", () => {
        for (const [skin, base] of Object.entries(SURVEV_MELEE_SKINS)) {
            const s = getDefOfType("melee", skin);
            const b = getDefOfType("melee", base);
            expect(s.baseType).toBe(base);
            expect(s.lootImg?.sprite).toBe(`loot-melee-${skin.replace("_", "-")}.img`);
            const {
                name: _m,
                lootImg: _l,
                worldImg: _w,
                baseType: _t,
                noPotatoSwap: _n,
                rarity: _r,
                lore: _o,
                ...stats
            } = s as any;
            const { name: _bm, lootImg: _bl, worldImg: _bw, noPotatoSwap: _bn, ...baseStats } = b as any;
            expect(stats, skin).toEqual(baseStats);
        }
    });

    it.each(Object.keys(WIKI_THROWABLE))("%s matches its wiki infobox, explosion and bag row", (id) => {
        const w = WIKI_THROWABLE[id];
        const def = getDefOfType("throwable", id);
        for (const [field, value] of Object.entries(w.item)) expect(at(def, field), `${id}.${field}`).toEqual(value);
        expect(def.explosionType).toBe(SURVEV_ONLY_THROWABLES[id]);
        const explosion = getDefOfType("explosion", def.explosionType);
        for (const [field, value] of Object.entries(w.explosion)) {
            expect(at(explosion, field), `${def.explosionType}.${field}`).toEqual(value);
        }
        expect(GameConfig.bagSizes[id]).toEqual(w.bag);
    });

    it("only the cookable flags differ between the wiki and survev's source; the wiki's apply", () => {
        expect(survevWikiSpecs).toBe(WIKI_SPEC_OVERRIDES);
        expect(WIKI_SPEC_OVERRIDES.map((o) => `${o.id}.${o.field}`)).toEqual(["coconut.cookable", "tomato.cookable"]);
        for (const o of WIKI_SPEC_OVERRIDES) {
            expect(gameObjects[o.id][o.field], "generated JSON keeps survev's value").toBe(o.survev);
            expect((getDefOfType("throwable", o.id) as any)[o.field]).toBe(o.wiki);
        }
    });
});

describe("survev-only melee and throwables: placements", () => {
    const tableHas = (map: string, tier: string, name: string) =>
        getMapDef(map).lootTable[tier]?.find((e) => e.name === name);

    it.each([
        ["snow", "tier_airdrop_melee", "iceaxe", 1, 1],
        ["snow", "tier_sledgehammer", "iceaxe", 1, 1],
        ["woods_snow", "tier_airdrop_melee", "iceaxe", 1, 3],
        ["woods_snow", "tier_hatchet_melee", "iceaxe", 1, 1],
        ["beach", "tier_airdrop_melee", "cutlass", 1, 4],
        ["beach", "tier_pirate_melee", "cutlass", 1, 2],
        ["beach", "tier_throwables", "coconut", 3, 0.4],
        ["beach", "tier_airdrop_throwables", "coconut", 4, 1],
        ["faction_potato", "tier_throwables", "tomato", 10, 1],
        ["faction_potato", "tier_airdrop_throwables", "tomato", 30, 0.5],
    ] as const)("%s %s has %s x%d at weight %d (survev's table)", (map, tier, name, count, weight) => {
        expect(tableHas(map, tier, name)).toEqual({ name, count, weight });
    });

    it("map objects drop them as survev's do", () => {
        const autoLoot = (id: string) =>
            mapObjects[id].loot.filter((l: any) => l.type).map((l: any) => [l.type, l.count]);
        expect(autoLoot("gun_mount_06")).toEqual([["cutlass_gold", 1]]);
        expect(autoLoot("barrel_05")).toEqual([["coconut", 4]]);
        expect(autoLoot("tree_14")).toEqual([["coconut", 3]]);
    });

    it("the melee skins and the Gold Cutlass spawn from nothing yet but its mount and later-stage buildings", () => {
        for (const map of Object.values(maps())) {
            for (const entries of Object.values(map.lootTable)) {
                for (const e of entries)
                    expect(["naginata_daemon", "karambit_borealis", "cutlass_gold"]).not.toContain(e.name);
            }
        }
    });
});

function maps() {
    return ["main", "desert", "beach", "snow", "woods", "cobalt", "savannah", "faction"].map((m) => getMapDef(m));
}

describe("survev-only gear, perks and roles (stage 2)", () => {
    it("ports the level-4 packs, the role helmets, six perks and two roles as survev has them", () => {
        // survev gearDefs.ts:290-306, 885-923; wikigg/Equipment
        expect(getDefOfType("backpack", "backpack04")).toMatchObject({ level: 4, name: "Tactical Pack" });
        expect(getDefOfType("backpack", "backpack04_cloud")).toMatchObject({ level: 4, maxPerks: 2 });
        for (const id of ["helmet04_captain", "helmet04_classless"]) {
            expect(getDefOfType("helmet", id)).toMatchObject({ level: 4, noDrop: true });
        }
        for (const id of [
            "assume_leadership",
            "ap_rounds",
            "lifeline",
            "combat_stims",
            "amped_explosives",
            "high_velocity",
        ]) {
            expect(getDefOfType("perk", id).type).toBe("perk");
        }
        // survev roleDefs.ts:162-193, 557-571
        expect(getDefOfType("role", "captain").perks).toEqual(["assume_leadership", "firepower"]);
        expect(getDefOfType("role", "classless").perks).toEqual([]);
    });
});
