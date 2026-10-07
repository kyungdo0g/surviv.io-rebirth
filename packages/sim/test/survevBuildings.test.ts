// The survev buildings in the simulation (survev content wave stage 3: survev's map generation and structures,
// tools/port-survev/policy.json survevMapGen / survevMapObjects): the Reserve's vault opens to the МИХАИЛ switches
// (pieces 1 2 3 4 2 5, survev shared/defs/puzzles.ts reserve_vault; wikigg The_Reserve), its security panel closes
// and locks the basement doors for 12 s (survev furnitureDefs control_panel_07de), camps and the Oasis heal (building
// healRegions, survev modeBuildingDefs camp_01 / oasis_01), the Workshop's wall mount holds the SPAS-16, Cobalt's
// Augmenting Vat promotes to Classless, and the Cloud bunker's panel locks its lab doors.
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Building, type Game, interactObstacle, type Obstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds } from "./buildingHelpers.ts";

/** The puzzle pieces of a building in child order (labels may repeat: the Reserve has two "2" switches). */
function pieceList(game: Game, building: Building): Obstacle[] {
    return childObstacles(game, building).filter((o) => o.puzzlePiece && o.button);
}

describe("the Reserve", () => {
    it("is the desert's small town: the vault opens to the МИХАИЛ switches 1 2 3 4 2 5", () => {
        const game = mapGame("desert", 1);
        const vault = findBuilding(game, "reserve_vault_01");
        const pieces = pieceList(game, vault);
        expect(pieces.map((o) => o.puzzlePiece).sort()).toEqual(["1", "2", "2", "3", "4", "5"]);
        const [door] = childObstacles(game, vault, "vault_door_reserve");
        expect(door.door?.open).toBe(false);
        const p = placePlayer(game, vault.pos, 1);
        const used = new Set<Obstacle>();
        for (const label of ["1", "2", "3", "4", "2", "5"]) {
            const piece = pieces.find((o) => o.puzzlePiece === label && !used.has(o))!;
            used.add(piece);
            interactObstacle(game, piece, p);
            game.step();
        }
        expect(vault.puzzle?.solved).toBe(true);
        stepSeconds(game, 10);
        expect(door.door?.open).toBe(true);
    });

    it("a wrong order is an error and the vault stays shut", () => {
        const game = mapGame("desert", 1);
        const vault = findBuilding(game, "reserve_vault_01");
        const pieces = pieceList(game, vault);
        const [door] = childObstacles(game, vault, "vault_door_reserve");
        const p = placePlayer(game, vault.pos, 1);
        for (const label of ["2", "1", "3", "4", "5", "2"]) {
            const piece = pieces.find((o) => o.puzzlePiece === label && o.button?.canUse)!;
            interactObstacle(game, piece, p);
            game.step();
        }
        expect(vault.puzzle).toMatchObject({ solved: false, errSeq: 1 });
        stepSeconds(game, 10);
        expect(door.door?.open).toBe(false);
    });

    it("the security panel closes and locks the basement doors for 12 s, then restores them", () => {
        const game = mapGame("desert", 1);
        const basement = findBuilding(game, "reserve_basement_01");
        const [panel] = childObstacles(game, basement, "control_panel_07de");
        const doors = childObstacles(game, basement, "house_door_02");
        expect(doors.length).toBe(3);
        const p = placePlayer(game, panel.pos, 1);
        interactObstacle(game, panel, p);
        stepSeconds(game, 1);
        for (const d of doors) expect(d.door).toMatchObject({ open: false, locked: true });
        stepSeconds(game, 12);
        for (const d of doors) expect(d.door?.locked).toBe(false);
    });
});

describe("heal regions, mounts and vats", () => {
    it("a snow camp's campfire heals 2 HP/s within 15 u", () => {
        const game = mapGame("snow", 1);
        const camp = findBuilding(game, "camp_01");
        const p = placePlayer(game, { x: camp.pos.x + 6, y: camp.pos.y });
        p.health = 50;
        stepSeconds(game, 1);
        expect(p.health).toBeCloseTo(52, 1);
        expect(p.healEffect).toBe(true);
    });

    it("the desert Oasis heals 1 HP/s on its island and in its water", () => {
        const game = mapGame("desert", 1);
        const oasis = findBuilding(game, "oasis_01");
        const p = placePlayer(game, { x: oasis.pos.x + 12, y: oasis.pos.y });
        p.health = 50;
        stepSeconds(game, 1);
        expect(p.health).toBeCloseTo(51, 1);
    });

    it("the Workshop's wall mount drops the SPAS-16", () => {
        const game = mapGame("woods", 1);
        const workshop = findBuilding(game, "workshop_01");
        const [mount] = childObstacles(game, workshop, "gun_mount_07");
        const before = [...game.loot.items.values()].filter((l) => l.type === "spas16").length;
        game.damageObstacle(mount, { amount: 10_000, damageType: DamageType.Player });
        expect(mount.dead).toBe(true);
        expect([...game.loot.items.values()].filter((l) => l.type === "spas16").length).toBe(before + 1);
    });

    it("Cobalt's Augmenting Vat makes its user Classless and is used up", () => {
        const game = mapGame("cobalt", 1);
        const compartment = findBuilding(game, "bunker_twins_compartment_01");
        const [vat] = childObstacles(game, compartment, "vat_03");
        const p = placePlayer(game, vat.pos, 1);
        p.awaitingClass = false;
        interactObstacle(game, vat, p);
        expect(p.role).toBe("classless");
        expect(p.perks).toHaveLength(1);
        stepSeconds(game, 0.5);
        expect(vat.dead).toBe(true);
    });

    it("the Cloud bunker's panel closes and locks its lab doors for 10 s", () => {
        const game = mapGame("savannah", 1);
        const sub = findBuilding(game, "bunker_cloud_sublevel_01");
        const [panel] = childObstacles(game, sub, "control_panel_07sv");
        const doors = childObstacles(game, sub, "lab_door_01");
        expect(doors.length).toBe(5);
        const p = placePlayer(game, panel.pos, 1);
        interactObstacle(game, panel, p);
        stepSeconds(game, 1);
        for (const d of doors) expect(d.door).toMatchObject({ open: false, locked: true });
        stepSeconds(game, 10);
        for (const d of doors) expect(d.door?.locked).toBe(false);
    });
});
