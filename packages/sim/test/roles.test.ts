// Roles (M7a): role kits per team (KB kits, map overrides with $byTeam / $weighted rolled by the seeded rng), role
// perks and role changes, announcements, Lone Survivr's refill, The Hunted, the Woods King's kill ping, Cobalt classes,
// the Commander's outfit block and flare lock, promotion picks with the AFK filter. Values: docs/research/items/roles.md
// and conflicts.md (role-*, grenadier-*); since the survev content wave's stage 5 (survev balance, design option B) the
// kits and perks are survev's roleDefs.ts defaultItems / perks (healing items, the Bugler's pan, the Grenadier's Saiga).
import { createRng, v2 } from "@rebirth/core";
import { DamageType, getMapDef, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Game, type Player, pickupLoot, type RoleAnnouncementEvent } from "../src/index.ts";
import { resolveLoadout, roleLoadout } from "../src/roles/loadouts.ts";
import { flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

function setup(mapName = "main"): { game: Game; p: Player } {
    const game = flatGame();
    if (mapName !== "main") Object.assign(game.options, { mapName });
    const p = spawnAt(game, openSpot(game));
    return { game, p };
}

function watchRoles(game: Game): RoleAnnouncementEvent[] {
    const out: RoleAnnouncementEvent[] = [];
    const announce = game.match.announce.bind(game.match);
    game.match.announce = (e) => {
        out.push({ ...e });
        announce(e);
    };
    return out;
}

describe("role kits", () => {
    it("the Commander's kit depends on the team: Super 90 / AN-94, machete / kukri, red / blue outfit (roles.md)", () => {
        for (const [teamId, gun, ammo, melee, outfit] of [
            [1, "m1014", "12gauge", "machete_taiga", "outfitRedLeader"],
            [2, "an94", "762mm", "kukri_trad", "outfitBlueLeader"],
        ] as const) {
            const { game, p } = setup();
            p.teamId = teamId;
            game.roles.promote(p, "leader");
            const wm = p.weaponManager;
            expect(wm.weapons.map((w) => w.type)).toEqual([gun, "flare_gun", melee, ""]);
            expect(wm.weapons[WeaponSlot.Secondary].ammo).toBe(1);
            expect([p.helmet, p.chest, p.backpack, p.outfit]).toEqual([
                "helmet04_leader",
                "chest03",
                "backpack03",
                outfit,
            ]);
            expect(p.hasRoleHelmet).toBe(true);
            // fillInv: the gun's ammo fills the Military Pack
            expect(p.inv.get(ammo)).toBe(p.inv.capacity(ammo));
            expect(p.scope).toBe("8xscope");
            // survev's promotion heals: 10 bandages and a med kit (survev roleDefs.ts leader; role-promotion-heals)
            expect([p.inv.get("bandage"), p.inv.get("healthkit")]).toEqual([10, 1]);
            expect(p.perks).toEqual(["leadership"]);
            expect(p.boost).toBe(0);
            steps(game, 1);
            expect(p.boost).toBe(100);
        }
    });

    it("Grenadier: survev's Saiga-12, katana, 15 frags + 10 MIRVs (survev roleDefs.ts grenadier)", () => {
        const { game, p } = setup();
        game.roles.promote(p, "grenadier");
        expect(p.weaponManager.weapons.map((w) => w.type)).toEqual(["", "saiga", "katana", "mirv"]);
        // the Military Pack holds 12 frags and 8 MIRVs; the rest drops (survev invManager.giveAndDrop)
        expect([p.inv.get("frag"), p.inv.get("mirv")]).toEqual([12, 8]);
        const dropped = (t: string) =>
            [...game.loot.items.values()].filter((l) => l.type === t).reduce((n, l) => n + l.count, 0);
        expect([dropped("frag"), dropped("mirv")]).toEqual([3, 2]);
        expect(p.perks).toEqual(["flak_jacket"]);
        expect(p.helmet).toBe("helmet03_grenadier");
    });

    it("Bugler: the bugle and survev's pan (role-bugler-pan); Medic: medical supplies and smoke", () => {
        const a = setup();
        a.game.roles.promote(a.p, "bugler");
        expect(a.p.weaponManager.weapons.map((w) => w.type)).toEqual(["", "bugle", "pan", ""]);
        expect(a.p.perks).toEqual(["inspiration", "final_bugle"]);
        const b = setup();
        b.game.roles.promote(b.p, "medic");
        expect(b.p.weaponManager.weapons[WeaponSlot.Throwable].type).toBe("smoke");
        expect(["bandage", "healthkit", "soda", "painkiller", "smoke"].map((i) => b.p.inv.get(i))).toEqual([
            30, 4, 15, 4, 6,
        ]);
        expect(b.p.perks).toEqual(["aoe_heal", "self_revive"]);
    });

    it("Marksman rolls L86A2 / SVD-63 90 % or Mk 20 SSR 10 % per team with the seeded rng", () => {
        const map = getMapDef("faction");
        const kit = roleLoadout("marksman", map)!;
        const roll = (team: number, seed: number) => resolveLoadout(kit, team, createRng(seed)).weapons[1].type;
        const red = new Set(Array.from({ length: 200 }, (_, i) => roll(1, i)));
        const blue = new Set(Array.from({ length: 200 }, (_, i) => roll(2, i)));
        expect([...red].sort()).toEqual(["l86", "scarssr"]);
        expect([...blue].sort()).toEqual(["scarssr", "svd"]);
        expect(roll(1, 42)).toBe(roll(1, 42));
    });

    it("map roleOverrides merge over the kit: faction_potato's $byTeam / $weighted guns (survev mergeDeep)", () => {
        const kit = roleLoadout("lieutenant", getMapDef("faction_potato"))!;
        const guns = (team: number) =>
            new Set(Array.from({ length: 300 }, (_, i) => resolveLoadout(kit, team, createRng(i)).weapons[1].type));
        expect([...guns(1)].sort()).toEqual(["m4a1", "potato_smg"]);
        expect([...guns(2)].sort()).toEqual(["grozas", "potato_smg"]);
        // the kit's helmet and scope are kept (only the weapons are overridden)
        const r = resolveLoadout(kit, 1, createRng(1));
        expect([r.helmet, r.inventory["4xscope"]]).toEqual(["helmet03_lt", 1]);
        const plain = resolveLoadout(roleLoadout("lieutenant", getMapDef("faction"))!, 2, createRng(1));
        expect(plain.weapons.map((w) => w.type)).toEqual(["", "grozas", "spade_assault", ""]);
    });

    it("Lone Survivr: 100 HP and adrenaline, a 5 s Windwalk, survev's four perks (role-lone-survivr-perks)", () => {
        const { game, p } = setup();
        p.teamId = 2;
        p.health = 20;
        game.roles.promote(p, "lieutenant");
        expect(p.hasPerk("firepower")).toBe(true);
        game.roles.promote(p, "last_man");
        expect([p.health, p.boost, p.haste.type]).toEqual([100, 100, "windwalk"]);
        // survev roleDefs.ts last_man: Cast Ironskin, AP Rounds or Splinter, Takedown, Windwalk or Field Medic
        expect(p.perks).toHaveLength(4);
        expect([p.perks[0], p.perks[2]]).toEqual(["steelskin", "takedown"]);
        expect(["ap_rounds", "splinter"]).toContain(p.perks[1]);
        expect(["windwalk", "field_medic"]).toContain(p.perks[3]);
        // the Lieutenant's perk and no-drop helmet left with the old role
        expect(p.hasPerk("firepower")).toBe(false);
        expect([p.helmet, p.chest]).toEqual(["helmet04_last_man_blue", "chest04"]);
        expect(["m249", "pkp"]).toContain(p.weaponManager.weapons[WeaponSlot.Secondary].type);
    });

    it("an empty kit slot refills the gun already there (fandom: promotion refills the magazine)", () => {
        const { game, p } = setup();
        giveGun(p, "ak47", { ammo: 3, reserve: 0 });
        game.roles.promote(p, "lieutenant");
        // the Lieutenant's Firepower comes first: the AK-47 refills to its extended 40 rounds
        expect(p.weaponManager.weapons[WeaponSlot.Primary]).toMatchObject({ type: "ak47", ammo: 40 });
    });
});

describe("announcements and role holders", () => {
    it("announces promotions and role holders' deaths with their killer (survev RoleAnnouncement)", () => {
        const { game, p } = setup();
        const killer = spawnAt(game, v2.add(p.pos, { x: 20, y: 0 }));
        const events = watchRoles(game);
        // (a Medic would be downed by Revivify instead of dying)
        game.roles.promote(p, "recon");
        game.damagePlayer(p, {
            amount: 500,
            damageType: DamageType.Player,
            sourceId: killer.id,
            gameSourceType: "ak47",
        });
        expect(events).toEqual([
            { playerId: p.id, killerId: 0, role: "recon", assigned: true, killed: false },
            { playerId: p.id, killerId: killer.id, role: "recon", assigned: false, killed: true },
        ]);
        // the snapshot carries them
        const snap = game.getSnapshot(killer.id);
        expect(snap.roleAnnouncements?.map((e) => e.role)).toEqual(["recon", "recon"]);
    });

    it("the Commander cannot swap its outfit nor its flare gun before firing it (role-commander-outfit-block)", () => {
        const { game, p } = setup();
        p.teamId = 1;
        game.roles.promote(p, "leader");
        const outfit = game.loot.addLoot("outfitGhillie", p.pos, 0, 1, { pushSpeed: 0 })!;
        p.pickupTicker = 0;
        expect(pickupLoot(game, p, outfit)).toBe("betterItemEquipped");
        expect(p.outfit).toBe("outfitRedLeader");
        p.weaponManager.setCurWeapIndex(WeaponSlot.Secondary, true);
        const gun = game.loot.addLoot("ak47", p.pos, 0, 1, { pushSpeed: 0, noSideAmmo: true })!;
        p.pickupTicker = 0;
        expect(pickupLoot(game, p, gun)).toBeNull();
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].type).toBe("flare_gun");
        p.firedFlare = true;
        p.pickupTicker = 0;
        expect(pickupLoot(game, p, gun)).toBe("success");
    });

    it("the Woods King's kills ping the map (roles.md Map roles)", () => {
        const { game, p } = setup();
        const victim = spawnAt(game, v2.add(p.pos, { x: 20, y: 0 }));
        game.roles.promote(p, "woods_king");
        game.damagePlayer(victim, {
            amount: 500,
            damageType: DamageType.Player,
            sourceId: p.id,
            gameSourceType: "ak47",
        });
        expect(game.planes.indicators.map((i) => i.type)).toContain("ping_woodsking");
    });
});

describe("The Hunted (Savannah)", () => {
    it("the kill leader becomes The Hunted with its map indicator; dying ends it (roles.md Map roles)", () => {
        const gen = cachedMap("savannah", 3);
        const game = new (flatGame().constructor as typeof import("../src/index.ts").Game)(
            { mapName: "savannah", seed: 3 },
            {
                generation: { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } },
                spawnLoot: false,
            },
        );
        game.rules.minActiveTime = 0;
        const spot = openSpot(game);
        const p = spawnAt(game, spot);
        const victims = [1, 2, 3].map((i) => spawnAt(game, v2.add(spot, { x: 10 * i, y: 0 })));
        const enemy = spawnAt(game, v2.add(spot, { x: 0, y: 20 }));
        const events = watchRoles(game);
        steps(game, 2);
        for (const v of victims) {
            game.damagePlayer(v, {
                amount: 500,
                damageType: DamageType.Player,
                sourceId: p.id,
                gameSourceType: "ak47",
            });
        }
        expect(p.role).toBe("the_hunted");
        expect(p.perks).toEqual(["hunted"]);
        steps(game, 1);
        expect(game.planes.indicators.find((i) => i.type === "the_hunted")).toMatchObject({ equipped: true });
        expect(events.at(-1)).toMatchObject({ role: "the_hunted", assigned: true });
        game.damagePlayer(p, {
            amount: 500,
            damageType: DamageType.Player,
            sourceId: enemy.id,
            gameSourceType: "ak47",
        });
        expect(p.role).toBe("");
        expect(events.at(-1)).toMatchObject({ role: "the_hunted", killed: true, killerId: enemy.id });
        steps(game, 1);
        expect(game.planes.indicators.find((i) => i.type === "the_hunted")).toBeUndefined();
    });
});

describe("Cobalt classes", () => {
    it("a class is chosen once from the map's perkModeRoles, else given at random after 20 s (cobalt-role-timeout)", () => {
        const gen = cachedMap("cobalt", 5);
        const Game = flatGame().constructor as typeof import("../src/index.ts").Game;
        const game = new Game(
            { mapName: "cobalt", seed: 5 },
            {
                generation: { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } },
                spawnLoot: false,
            },
        );
        const a = spawnAt(game, openSpot(game));
        const b = spawnAt(game, v2.add(a.pos, { x: 10, y: 0 }));
        expect(game.selectRole(a.id, "leader")).toBe(false);
        expect(game.selectRole(a.id, "tank")).toBe(true);
        expect(game.selectRole(a.id, "scout")).toBe(false);
        expect([a.role, a.perks, a.outfit, a.chest]).toEqual([
            "tank",
            ["steelskin", "endless_ammo"],
            "outfitTank",
            "chest01",
        ]);
        // no emotes before a class (survev emoteFromMsg)
        game.emote(b.id, { type: "emote_thumbsup", isPing: false });
        expect(game.getSnapshot(b.id).emotes).toEqual([]);
        steps(game, 2001);
        expect(getMapDef("cobalt").gameMode.perkModeRoles).toContain(b.role);
    });
});
