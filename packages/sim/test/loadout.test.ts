// Loadouts (survev content wave stage 4b; the lead's decision: everything unlocked, no accounts): validation against
// the defs like survev shared/utils/loadout.ts validate, and what a joining player's loadout does in the game (survev
// player.ts: outfit, melee, emotes, the death emote 0.3 s after dying and the win emote 1 s after the game over).
import { v2 } from "@rebirth/core";
import { DamageType, EmoteSlot, GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    DEATH_EMOTE_DELAY,
    defaultLoadout,
    disguiseOf,
    Game,
    isLoadoutItem,
    killPlayer,
    loadoutChoices,
    validateLoadout,
} from "../src/index.ts";
import { openSpot, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";
import { addAt, flatTeamGame } from "./teamHelpers.ts";

describe("loadout validation", () => {
    it("defaults to the standard-issue items and the default emote wheel", () => {
        expect(validateLoadout(undefined)).toEqual(defaultLoadout());
        expect(defaultLoadout()).toMatchObject({
            outfit: "outfitBase",
            melee: "fists",
            heal: "heal_basic",
            boost: "boost_basic",
            emotes: GameConfig.defaultEmoteLoadout,
            crosshair: { type: "crosshair_default", color: 0xffffff, size: 1, stroke: 0 },
        });
    });

    it("keeps every valid pick and replaces unknown or wrong-type ids with the default", () => {
        const picked = validateLoadout({
            outfit: "outfitCarbonFiber",
            melee: "karambit_prismatic",
            heal: "heal_heart",
            boost: "boost_star",
            emotes: ["emote_thumbsup", "emote_surviv", "nope", "ak47", "emote_happyface", ""],
            crosshair: { type: "crosshair_027", color: 0xff0000, size: 0.5, stroke: 1 },
        });
        expect(picked).toEqual({
            outfit: "outfitCarbonFiber",
            melee: "karambit_prismatic",
            heal: "heal_heart",
            boost: "boost_star",
            emotes: ["emote_thumbsup", "emote_surviv", "emote_surviv", "emote_sadface", "emote_happyface", ""],
            crosshair: { type: "crosshair_027", color: 0xff0000, size: 0.5, stroke: 1 },
        });
        expect(validateLoadout({ outfit: "heal_heart", melee: "outfitBase", heal: 3, emotes: "x" })).toEqual(
            defaultLoadout(),
        );
        // crosshair sliders clamp to survev's ranges, a bad colour takes white
        expect(validateLoadout({ crosshair: { type: "x", color: -1, size: 9, stroke: -2 } }).crosshair).toEqual({
            type: "crosshair_default",
            color: 0xffffff,
            size: 1,
            stroke: 0,
        });
    });

    it("everything is unlocked except role uniforms, loot melee weapons and the non-custom emotes", () => {
        // the Commander's and the class uniforms (noDrop), loot melee weapons, ammo pings and perk emotes
        for (const id of ["outfitRedLeader", "outfitMedic", "outfitClassless"])
            expect(isLoadoutItem("outfit", id)).toBe(false);
        for (const id of ["katana", "machete", "pan", "cutlass"]) expect(isLoadoutItem("melee", id)).toBe(false);
        for (const id of ["emote_ammo", "emote_loot", "emote_trick_size"])
            expect(isLoadoutItem("emote", id)).toBe(false);
        // survev's outfits, a disguise costume, a faction outfit and the melee skins are all there
        for (const id of ["outfitAurora", "outfitBarrel", "outfitRed"]) expect(isLoadoutItem("outfit", id)).toBe(true);
        for (const id of ["fists", "knuckles", "bowie_frontier", "karambit_borealis"]) {
            expect(isLoadoutItem("melee", id)).toBe(true);
        }
        expect(loadoutChoices("heal")).toContain("heal_moon");
        expect(loadoutChoices("boost")).toContain("boost_naturalize");
        expect(loadoutChoices("crosshair").length).toBeGreaterThan(20);
        // every melee skin keeps the fists' stats: picking one is cosmetic
        const fists = getDefOfType("melee", "fists");
        for (const id of loadoutChoices("melee")) {
            expect(getDefOfType("melee", id).damage, id).toBe(fists.damage);
        }
    });
});

describe("a joining player's loadout", () => {
    function join(loadout: Record<string, unknown>, teamMode: 1 | 2 | 4 = 1) {
        const game = flatTeamGame(teamMode);
        const at = openSpot(game, 40);
        const p = addAt(game, "p", at, { loadout });
        return { game, p, at };
    }

    it("wears the outfit, holds the melee skin and keeps the emote wheel; heal and boost reach PlayerInfo", () => {
        const emotes = [
            "emote_thumbsup",
            "emote_surviv",
            "emote_sadface",
            "emote_happyface",
            "emote_gg",
            "emote_tombstone",
        ];
        const { game, p } = join({
            outfit: "outfitCarbonFiber",
            melee: "bowie_vintage",
            heal: "heal_moon",
            boost: "boost_star",
            emotes,
        });
        expect(p.outfit).toBe("outfitCarbonFiber");
        expect(p.loadoutOutfit).toBe("outfitCarbonFiber");
        expect(p.weaponManager.weapons[WeaponSlot.Melee].type).toBe("bowie_vintage");
        expect(p.emoteLoadout).toEqual(validateLoadout({ emotes }).emotes);
        const info = game.getSnapshot(p.id).playerInfos?.find((i) => i.playerId === p.id);
        expect(info).toMatchObject({ heal: "heal_moon", boost: "boost_star" });
    });

    it("50v50: a faction outfit of the other side falls back to the base outfit, as a pickup would", () => {
        const game = new Game(
            { mapName: "faction", seed: 1, teamMode: 4 },
            { generation: cachedMap("faction", 1, 4), spawnLoot: false, sandbox: true },
        );
        for (let i = 0; i < 4; i++) {
            const p = game.getPlayer(game.addPlayer(`p${i}`, { loadout: { outfit: "outfitRed" } }))!;
            expect(p.outfit, `team ${p.teamId}`).toBe(p.teamId === 1 ? "outfitRed" : "outfitBase");
        }
    });

    it("a costume from the loadout puts its obstacle over the player from the start", () => {
        const { game, p } = join({ outfit: "outfitStone" });
        expect(disguiseOf(game, p)?.type).toBe("stone_01");
    });

    it("the loadout outfit and melee skin never drop on death", () => {
        const { game, p } = join({ outfit: "outfitAurora", melee: "huntsman_burnished" });
        killPlayer(game, p, { amount: 100, damageType: DamageType.Gas, dir: { x: 1, y: 0 } });
        const loot = [...game.world.objects.values()].filter((o) => o.kind === "loot").map((o) => o.type);
        expect(loot).not.toContain("outfitAurora");
        expect(loot).not.toContain("huntsman_burnished");
    });

    it("the death emote comes 0.3 s after dying; an empty slot sends nothing", () => {
        const { game, p, at } = join({ emotes: ["", "", "", "", "", "emote_tombstone"] });
        const viewer = addAt(game, "viewer", v2.add(at, { x: 5, y: 0 }));
        game.step();
        game.getSnapshot(viewer.id);
        killPlayer(game, p, { amount: 100, damageType: DamageType.Gas, dir: { x: 1, y: 0 } });
        steps(game, Math.round(DEATH_EMOTE_DELAY * 100) - 2);
        expect(game.getSnapshot(viewer.id).emotes ?? []).toEqual([]);
        steps(game, 4);
        expect(game.getSnapshot(viewer.id).emotes).toContainEqual({
            playerId: p.id,
            type: "emote_tombstone",
            itemType: "",
            isPing: false,
        });
        // the viewer's own death slot is empty (the default)
        expect(viewer.emoteLoadout[EmoteSlot.Death]).toBe("");
    });

    it("survivors send their win emote 1 s after the game over", () => {
        const { game, p, at } = join({ emotes: ["", "", "", "", "emote_gg", ""] });
        const viewer = addAt(game, "viewer", v2.add(at, { x: 5, y: 0 }));
        game.getSnapshot(viewer.id);
        const players = [p, viewer];
        for (let i = 0; i < 99; i++) game.emotes.updateSlotEmotes(0.01, players, true);
        expect(game.getSnapshot(viewer.id).emotes ?? []).toEqual([]);
        for (let i = 0; i < 2; i++) game.emotes.updateSlotEmotes(0.01, players, true);
        const got = (game.getSnapshot(viewer.id).emotes ?? []).filter((e) => e.type === "emote_gg");
        expect(got).toEqual([{ playerId: p.id, type: "emote_gg", itemType: "", isPing: false }]);
        // once only
        for (let i = 0; i < 200; i++) game.emotes.updateSlotEmotes(0.01, players, true);
        expect((game.getSnapshot(viewer.id).emotes ?? []).filter((e) => e.type === "emote_gg")).toEqual([]);
    });
});
