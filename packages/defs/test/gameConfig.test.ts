// GameConfig merge result and the const enum objects in src/constants.ts.
import { describe, expect, it } from "vitest";
import {
    Action,
    Anim,
    DamageType,
    EmoteSlot,
    FactionTeam,
    GameConfig,
    GasMode,
    HasteType,
    Input,
    MapDefs,
    MapId,
    Plane,
    Rarity,
    TeamMode,
    WeaponSlot,
} from "../src/index.ts";
import { readOptionalJson } from "./helpers.ts";

const live = readOptionalJson("research-cache/live/defs.json");

describe("GameConfig", () => {
    it("const enum objects match the generated config", () => {
        const enums = {
            Input,
            EmoteSlot,
            WeaponSlot,
            DamageType,
            Action,
            Anim,
            GasMode,
            Plane,
            HasteType,
            MapId,
            Rarity,
            TeamMode,
            FactionTeam,
        };
        for (const [name, values] of Object.entries(enums)) {
            expect(values, name).toEqual(GameConfig[name as keyof typeof enums]);
        }
    });

    it("keeps original client values: protocol 78, 4-level bag sizes", () => {
        expect(GameConfig.protocolVersion).toBe(78);
        expect(GameConfig.bagSizes["308sub"]).toEqual([10, 20, 40, 80]);
        expect(GameConfig.bagSizes["50AE"]).toEqual([49, 98, 147, 196]);
        for (const [item, sizes] of Object.entries(GameConfig.bagSizes)) expect(sizes, item).toHaveLength(4);
    });

    it("carries survev server constants", () => {
        expect(GameConfig.player.moveSpeed).toBe(12);
        expect(GameConfig.gas.stages.length).toBeGreaterThan(10);
        expect(GameConfig.gas.stages[0].mode).toBe(GameConfig.GasMode.Inactive);
    });

    it.skipIf(!live)("original client keys win everywhere", () => {
        const original = Object.values<any>(live.gameConfig).find((c) => "protocolVersion" in c);
        const check = (o: any, g: any, path: string) => {
            if (typeof o !== "object" || o === null || Array.isArray(o)) return expect(g, path).toEqual(o);
            for (const k of Object.keys(o)) check(o[k], g?.[k], `${path}.${k}`);
        };
        check(original, GameConfig, "GameConfig");
    });

    it("map ids of the original modes", () => {
        const ids = Object.fromEntries(Object.entries(MapDefs).map(([k, m]) => [k, m.mapId]));
        expect(ids).toMatchObject({ main: 0, desert: 1, woods: 2, faction: 3, potato: 4, savannah: 5, halloween: 6 });
        expect(ids.cobalt).toBe(7);
    });
});
