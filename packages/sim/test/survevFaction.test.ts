// 50v50 buildings and structures (survev content wave, 50v50 stage): faction sides come from survev's `teamId`
// (tools/port-survev applySurvevMapGenFields; survev map.ts genOnGrass): Red (1) on the low side of the split, Blue
// (2) on the high side. The Faction Soviet / Blue Initiative crates spawn in their team's furthest strip from the river
// and 32 apart (survev crateDefs crate_02f / crate_22 minDistanceFromSameType; wikigg Faction_Crates "Around 11 faction
// crates of corresponding colors spawn on the corresponding teams' side, farthest away from the center river"), the
// Silo Shack on Blue (wikigg 50v50_mode "the Blue faction has the special Silo Shack"), potatoes on Blue and tomatoes
// on Red (wikigg 50v50_mode Potato vs Tomato), River Town and two Faction Bridges on the river (wikigg 50v50_mode
// "3 buildings spawn on top of the river").
import type { Vec2 } from "@rebirth/core";
import { getDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type GeneratedObject, type GenerateMapResult, pickupLoot } from "../src/index.ts";
import { cachedMap } from "./helpers.ts";

const SEEDS = [1, 2, 3];

/** Distance along the faction split axis: Red has the low values (generate.ts factionSplitOri). */
function sideOf(g: GenerateMapResult, p: Vec2): number {
    return g.factionSplitOri === 1 ? p.x : p.y;
}

function tops(g: GenerateMapResult, type: string): GeneratedObject[] {
    return g.objects.filter((o) => o.parentId === 0 && o.type === type);
}

function all(g: GenerateMapResult, type: string): GeneratedObject[] {
    return g.objects.filter((o) => o.type === type);
}

describe("50v50 map: faction sides", () => {
    for (const seed of SEEDS) {
        it(`seed ${seed}: team buildings, faction crates and their spacing`, () => {
            const g = cachedMap("faction", seed, 4);
            const mid = g.mapData.width / 2;
            const red = ["crate_02f", "bank_01", "mansion_structure_01"];
            const blue = ["crate_22", "police_01", "warehouse_complex_01"];
            for (const type of red) for (const o of tops(g, type)) expect(sideOf(g, o.pos), type).toBeLessThan(mid);
            for (const type of blue) for (const o of tops(g, type)) expect(sideOf(g, o.pos), type).toBeGreaterThan(mid);
            for (const type of ["crate_02f", "crate_22"]) {
                const crates = tops(g, type);
                // round(5 x shore area / 250000) per team: about 11 on the 880-wide map
                expect(crates.length, type).toBeGreaterThanOrEqual(8);
                // the furthest tenth of the spawn strip
                for (const c of crates) {
                    const d = type === "crate_02f" ? sideOf(g, c.pos) : g.mapData.width - sideOf(g, c.pos);
                    expect(d, type).toBeLessThan(g.mapData.width * 0.2);
                }
                const placed = all(g, type);
                for (let i = 0; i < placed.length; i++) {
                    for (let j = i + 1; j < placed.length; j++) {
                        const dx = placed[i].pos.x - placed[j].pos.x;
                        const dy = placed[i].pos.y - placed[j].pos.y;
                        expect(Math.hypot(dx, dy), type).toBeGreaterThan(32);
                    }
                }
            }
        });
    }

    it("River Town and two Faction Bridges stand on the river; River Town's Red half faces Red", () => {
        for (const seed of SEEDS) {
            const g = cachedMap("faction", seed, 4);
            const [town] = tops(g, "river_town_01");
            expect(town).toBeDefined();
            expect(tops(g, "bridge_xlg_structure_01")).toHaveLength(2);
            const children = g.objects.filter((o) => o.parentId === town.id);
            const redCrate = children.find((o) => o.type === "crate_02f")!;
            const blueCrate = children.find((o) => o.type === "crate_22")!;
            expect(sideOf(g, redCrate.pos)).toBeLessThan(sideOf(g, town.pos));
            expect(sideOf(g, blueCrate.pos)).toBeGreaterThan(sideOf(g, town.pos));
            // the Red and Blue Commander statues, one on each side
            const statues = children.filter((o) => o.type.startsWith("statue_structure_0"));
            expect(statues.map((s) => s.type).sort()).toEqual(["statue_structure_01", "statue_structure_02"]);
            const redStatue = statues.find((s) => s.type === "statue_structure_01")!;
            expect(sideOf(g, redStatue.pos)).toBeLessThan(sideOf(g, town.pos));
            // the faction river chest
            expect(all(g, "chest_03f")).toHaveLength(1);
        }
    });

    it("Potato vs Tomato: the Silo Shack and potatoes on Blue, tomatoes on Red", () => {
        for (const seed of SEEDS) {
            const g = cachedMap("faction_potato", seed, 4);
            const mid = g.mapData.width / 2;
            const [silo] = tops(g, "shilo_01");
            expect(silo).toBeDefined();
            expect(sideOf(g, silo.pos)).toBeGreaterThan(mid);
            for (const type of ["potato_01f", "potato_02f", "potato_03f"])
                for (const o of tops(g, type)) expect(sideOf(g, o.pos), type).toBeGreaterThan(mid);
            for (const type of ["tomato_01", "tomato_02", "tomato_03"])
                for (const o of tops(g, type)) expect(sideOf(g, o.pos), type).toBeLessThan(mid);
        }
    });
});

describe("50v50 outfits", () => {
    // survev outfitDefs.ts teamId (Target Practice red, Cobalt Shell blue) and player.ts:3898-3903 (survev balance)
    it("a faction outfit fits its own faction only; elsewhere anyone wears it", () => {
        const pick = (mapName: string, teamId: number, outfit: string) => {
            const game = new Game(
                { mapName, seed: 1 },
                { generation: cachedMap(mapName, 1, 4), spawnLoot: false, sandbox: true },
            );
            const p = game.getPlayer(game.addPlayer("p"))!;
            p.teamId = teamId;
            const loot = game.loot.addLoot(outfit, p.pos, p.layer, 1, { pushSpeed: 0 })!;
            p.pickupTicker = 0;
            pickupLoot(game, p, loot);
            return p.outfit;
        };
        expect(getDefOfType("outfit", "outfitRed").teamId).toBe(1);
        expect(pick("faction", 2, "outfitRed")).not.toBe("outfitRed");
        expect(pick("faction", 1, "outfitRed")).toBe("outfitRed");
        expect(pick("main", 2, "outfitRed")).toBe("outfitRed");
    });
});
