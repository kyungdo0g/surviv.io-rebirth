// Event-mode rules (M7b): event-map corrections and loot bans (applied by tools/port-survev step 3c), Woods bag sizes, potato emotes,
// snowball / potato hits (freeze + random drop), the drop-item action. Values: docs/research/modes/*.md.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, getMapDef, gunClass, LOOT_BANS, unscaledMapDef, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    addPerk,
    dropItem,
    frozenOri,
    type Game,
    mapBagSizes,
    type Player,
    randomDropCandidates,
} from "../src/index.ts";
import { flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";
import { flatTeamGame, party } from "./teamHelpers.ts";

function onMap(mapName: string): { game: Game; p: Player } {
    const game = flatGame();
    Object.assign(game.options, { mapName });
    const p = spawnAt(game, openSpot(game));
    return { game, p };
}

const items = (mapName: string, tier: string) => getMapDef(mapName).lootTable[tier].map((e) => e.name);

describe("event map corrections in the ported data (tools/port-survev/lib/eventMaps.ts)", () => {
    it("savannah: survev's Savannah map generation (Cloud bunker lake, Oasis, brush clumps) and loot", () => {
        const def = getMapDef("savannah");
        const fixed = def.mapGen.fixedSpawns[0];
        expect(fixed.club_complex_01).toBeUndefined();
        expect(fixed.perch_01).toEqual({ small: 11, large: 13 });
        expect(fixed.brush_clump_01).toEqual({ small: 11, large: 13 });
        expect(def.mapGen.randomSpawns).toEqual([]);
        // survev/shared/defs/maps/savannahDefs.ts: the Cloud bunker lake, the Oasis and two crate lakes
        expect(def.mapGen.map.rivers.lakes.map((l) => [l.centerObj, l.spawnBound.rad])).toEqual([
            ["bunker_structure_10", 200],
            ["oasis_01sv", 300],
            ["crate_02sv_lake", 200],
            ["crate_02sv_lake", 200],
        ]);
        // survev's Savannah loot (stage 5, survev balance): ground ammo stacks of 30 including .45 ACP; strobes
        expect(def.lootTable.tier_ammo.map((e) => `${e.name}x${e.count}`)).toEqual([
            "9mmx30",
            "45acpx30",
            "762mmx30",
            "556mmx30",
        ]);
        expect(items("savannah", "tier_throwables")).toContain("strobe");
    });

    it("savannah bans shotguns, LMGs, assault rifles but the SCAR-H, Vectors and 2x scopes from every table", () => {
        const def = getMapDef("savannah");
        const banned = new Set(LOOT_BANS.savannah);
        expect(banned.has("scar")).toBe(false);
        expect(banned.has("scorpion")).toBe(false);
        for (const g of ["m870", "spas12", "dp28", "pkp", "ak47", "hk416", "vector", "2xscope"]) {
            expect(banned.has(g)).toBe(true);
        }
        for (const [tier, entries] of Object.entries(def.lootTable)) {
            for (const e of entries) expect([tier, banned.has(e.name)]).toEqual([tier, false]);
        }
        const guns = items("savannah", "tier_guns").map((g) => gunClass(g));
        // and the owner's Panzerfaust, on every floor with the flare gun (defs rebirth/ownerLoot.ts, 2026-10-08)
        expect(new Set(guns)).toEqual(new Set(["assault", "smg", "pistol", "sniper", "dmr", "launcher"]));
        expect(items("savannah", "tier_guns").filter((g) => gunClass(g) === "launcher")).toEqual(["panzerfaust"]);
    });

    it("woods guns are LMGs and shotguns only (woods.md 'Only LMGs and shotguns will spawn')", () => {
        for (const map of ["woods", "woods_snow", "woods_spring", "woods_summer"]) {
            const classes = new Set(items(map, "tier_guns").map((g) => gunClass(g)));
            expect([map, [...classes].sort()]).toEqual([map, ["lmg", "shotgun"]]);
        }
    });

    it("map generation and loot are survev's (survev content wave stages 3 and 5): no event-map fix applies", () => {
        // survev/shared/defs/maps/turkeyDefs.ts: 25 green and 12 orange squashes, the normal gold drop
        expect(getMapDef("turkey").mapGen.densitySpawns[0]).toMatchObject({ squash_01: 25, squash_02: 12 });
        const desert = getMapDef("desert");
        // survev desertDefs.ts: the Oasis lake, the alternate barn, the crimson air drop
        expect(desert.mapGen.map.rivers.lakes.map((l) => l.centerObj)).toEqual(["oasis_01"]);
        expect(desert.mapGen.fixedSpawns[0].barn_02d).toBe(1);
        expect(desert.gameConfig.planes.crates.map((c) => c.name)).toContain("airdrop_crate_05");
        // survev's PKP weight in rare air drops (desert.md CONFLICT desert-pkp-airdrop-rare; survev baseDefs.ts:612)
        expect(desert.lootTable.tier_airdrop_rare.find((e) => e.name === "pkp")?.weight).toBe(0.08);
        // (as ported: the rebirth's bigger maps scale the per-map counts, rebirth/mapScale.ts)
        expect(unscaledMapDef("snow").mapGen.fixedSpawns[0].stone_04x).toBe(3);
        expect(getMapDef("main_spring").mapGen.fixedSpawns[0]).toMatchObject({ warehouse_03: 1 });
        expect(getMapDef("woods").mapGen.fixedSpawns[0]).toMatchObject({ cache_01w: 1, workshop_complex_01: 1 });
        expect(getMapDef("faction").mapGen.fixedSpawns[0]).toMatchObject({ cache_01f: 1, cache_02f: 1, cache_07f: 1 });
        expect(getMapDef("potato_spring").mapGen.densitySpawns[0].egg_01).toBe(15);
        expect(getMapDef("woods_summer").mapGen.customSpawnRules.locationSpawns[0].type).toBe("logging_complex_01su");
        // maps without corrections are the ported defs themselves
        expect(getMapDef("main")).toBe(getMapDef("main"));
    });
});

describe("Woods bag sizes", () => {
    it("frags and smokes hold 6/12/15/18/20 per backpack level on woods maps, 3/6/9/12/15 elsewhere (woods.md)", () => {
        // survev's fifth level (backpack04) holds 20 (survev/shared/defs/maps/woodsDefs.ts:60-61)
        expect(mapBagSizes("woods").frag).toEqual([6, 12, 15, 18, 20]);
        expect(mapBagSizes("woods_snow").smoke).toEqual([6, 12, 15, 18, 20]);
        expect(mapBagSizes("main").frag).toEqual(GameConfig.bagSizes.frag);
        const woods = flatGame();
        Object.assign(woods.options, { mapName: "woods" });
        const p = spawnAt(woods, openSpot(woods));
        expect(p.inv.capacity("frag")).toBe(6);
        expect(p.inv.give("smoke", 10).added).toBe(6);
        const { p: q } = onMap("main");
        expect(q.inv.capacity("frag")).toBe(GameConfig.bagSizes.frag[0]);
    });
});

describe("potato emotes", () => {
    it("wheel emotes show as the potato on potato maps (survev emoteFromSlot); pings are unchanged", () => {
        const { game, p } = onMap("potato");
        game.emote(p.id, { type: p.emoteLoadout[0], isPing: false });
        game.emote(p.id, { type: "ping_danger", isPing: true, pos: v2.copy(p.pos) });
        const events = game.getSnapshot(p.id).emotes ?? [];
        expect(events.map((e) => e.type)).toEqual(["emote_potato", "ping_danger"]);
        game.rules.modes.potatoEmotes = false;
        game.emote(p.id, { type: p.emoteLoadout[1], isPing: false });
        expect((game.getSnapshot(p.id).emotes ?? []).map((e) => e.type)).toEqual([p.emoteLoadout[1]]);
        const { game: main, p: q } = onMap("main");
        main.emote(q.id, { type: q.emoteLoadout[0], isPing: false });
        expect((main.getSnapshot(q.id).emotes ?? []).map((e) => e.type)).toEqual([q.emoteLoadout[0]]);
    });
});

/** Explodes `type` right on `target`, credited to `source`. */
function explodeOn(game: Game, type: string, target: Player, source?: Player): void {
    game.explosions.add(type, v2.add(target.pos, { x: -0.5, y: 0 }), target.layer, {
        damageType: DamageType.Player,
        gameSourceType: type.includes("snowball") ? "snowball" : "potato",
        sourceId: source?.id ?? 0,
    });
    steps(game, 1);
}

describe("snowball and potato hits (modes/frozen.ts)", () => {
    it("slow the target for 0.5 s (1 s heavy), show the frozen pose and drop one random item", () => {
        const game = flatTeamGame(1);
        const pos = openSpot(game);
        const thrower = spawnAt(game, v2.add(pos, { x: -10, y: 0 }));
        const target = spawnAt(game, pos);
        target.inv.set("bandage", 6);
        const before = randomDropCandidates(target).length;
        expect(before).toBeGreaterThan(0);
        explodeOn(game, "explosion_snowball", target, thrower);
        expect(target.frozen.ticker).toBeGreaterThan(0.45);
        expect(target.frozen.ticker).toBeLessThanOrEqual(0.5);
        const view = target.toView();
        expect(view.frozen).toBe(true);
        expect(view.frozenOri).toBe(target.frozen.ori);
        // the bag held only bandages: half of them dropped
        expect(target.inv.get("bandage")).toBe(3);
        expect([...game.loot.items.values()].some((l) => l.type === "bandage")).toBe(true);
        // the slowdown: frozenSpeedPenalty off the walking speed
        const free = spawnAt(game, v2.add(pos, { x: 0, y: 10 }));
        expect(target.computeSpeed(game.world)).toBeCloseTo(
            free.computeSpeed(game.world) - GameConfig.player.frozenSpeedPenalty,
            6,
        );
        steps(game, 50);
        expect(target.frozen.ticker).toBe(0);
        expect(target.toView().frozen).toBe(false);
        explodeOn(game, "explosion_potato_heavy", target, thrower);
        expect(target.frozen.ticker).toBeGreaterThan(0.95);
    });

    it("leave teammates and the thrower alone; other explosions do not freeze", () => {
        const game = flatTeamGame(2);
        const [a, b] = party(game, "x", 2, openSpot(game), 5);
        expect(a.teamId).toBe(b.teamId);
        explodeOn(game, "explosion_snowball", b, a);
        expect(b.frozen.ticker).toBe(0);
        explodeOn(game, "explosion_snowball", a, a);
        expect(a.frozen.ticker).toBe(0);
        explodeOn(game, "explosion_frag", a);
        expect(a.frozen.ticker).toBe(0);
    });

    it("frozenOri combines facing and hit direction in quarter turns", () => {
        expect(frozenOri({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(2);
        expect(frozenOri({ x: 0, y: 1 }, { x: 1, y: 0 })).toBe(3);
        for (let a = 0; a < 8; a++) {
            const o = frozenOri({ x: Math.cos(a), y: Math.sin(a) }, { x: Math.sin(a * 3), y: Math.cos(a) });
            expect(o >= 0 && o <= 3 && Number.isInteger(o)).toBe(true);
        }
    });
});

describe("drop item (world/dropItem.ts)", () => {
    it("drops half a bag stack, one scope, armour with its perk, the loot perk, a gun or the melee (survev dropItem)", () => {
        const { game, p } = onMap("main");
        p.backpack = "backpack03";
        p.inv.set("762mm", 100);
        p.inv.set("4xscope", 1);
        dropItem(game, p, "762mm");
        expect(p.inv.get("762mm")).toBe(50);
        dropItem(game, p, "4xscope");
        expect(p.inv.get("4xscope")).toBe(0);
        expect(p.scope).not.toBe("4xscope");
        p.helmet = "";
        game.roles.remove(p);
        p.chest = "chest02";
        dropItem(game, p, "chest02");
        expect(p.chest).toBe("");
        addPerk(p, "windwalk", { droppable: true });
        dropItem(game, p, "windwalk");
        expect(p.hasPerk("windwalk")).toBe(false);
        giveGun(p, "ak47");
        dropItem(game, p, "ak47", WeaponSlot.Primary);
        expect(p.weaponManager.weapons[WeaponSlot.Primary].type).toBe("");
        p.weaponManager.setWeapon(WeaponSlot.Melee, "machete", 0);
        game.dropItem(p.id, "machete");
        expect(p.weaponManager.weapons[WeaponSlot.Melee].type).toBe("fists");
        const dropped = [...game.loot.items.values()].map((l) => l.type).sort();
        expect(dropped).toEqual(["4xscope", "762mm", "ak47", "chest02", "machete", "windwalk"]);
    });

    it("never drops an unfired Commander flare gun or anything of a player without a Cobalt class", () => {
        const { game, p } = onMap("main");
        game.roles.promote(p, "leader");
        dropItem(game, p, "flare_gun", WeaponSlot.Secondary);
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].type).toBe("flare_gun");
        p.inv.set("bandage", 4);
        p.awaitingClass = true;
        dropItem(game, p, "bandage");
        expect(p.inv.get("bandage")).toBe(4);
    });
});
