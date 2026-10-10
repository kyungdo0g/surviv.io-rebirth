// GameConfig merge result and the const enum objects in src/constants.ts. The original client's keys win, except the
// paths tools/port-survev/policy.json takes from survev (the .50 bag sizes of the survev .50 guns).
import { readFileSync } from "node:fs";
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
    REBIRTH_THROWABLE_TYPES,
    STROBE_VARIANT_TYPES,
    TeamMode,
    WeaponSlot,
} from "../src/index.ts";
import { REPO_ROOT, readOptionalJson } from "./helpers.ts";

const live = readOptionalJson("research-cache/live/defs.json");
const policy = JSON.parse(readFileSync(`${REPO_ROOT}tools/port-survev/policy.json`, "utf8"));

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

    it("keeps the original protocol version 78; bag sizes are survev's five levels (backpack04)", () => {
        expect(GameConfig.protocolVersion).toBe(78);
        // survev content wave stage 2: survev/shared/gameConfig.ts:415-441, the original's rows first
        expect(policy.survevGameConfig).toEqual(["bagSizes"]);
        for (const [item, sizes] of Object.entries(GameConfig.bagSizes)) expect(sizes, item).toHaveLength(5);
        // survev's last rows, then the rebirth's variant strobes (rebirth/strobes.ts), Molotov and flashbang
        // (rebirth/throwables.ts)
        const rebirthRows: readonly string[] = [...STROBE_VARIANT_TYPES, ...REBIRTH_THROWABLE_TYPES];
        const survevRows = Object.keys(GameConfig.bagSizes).filter((k) => !rebirthRows.includes(k));
        expect(survevRows.slice(-2)).toEqual(["tomato", "coconut"]);
        // v0.8.82 10 / 20 / 40 / 80 (wikigg .308 Subsonic rev 7199: 20 / 40 / 55 / 70 / 85)
        expect(GameConfig.bagSizes["308sub"]).toEqual([20, 40, 55, 70, 85]);
        // v0.8.82 49 / 98 / 147 / 196 (wikigg .50 Caliber rev 7198)
        expect(GameConfig.bagSizes["50AE"]).toEqual([50, 100, 150, 200, 250]);
    });

    it("carries survev server constants", () => {
        expect(GameConfig.player.moveSpeed).toBe(12);
        expect(GameConfig.gas.stages.length).toBeGreaterThan(10);
        expect(GameConfig.gas.stages[0].mode).toBe(GameConfig.GasMode.Inactive);
    });

    it.skipIf(!live)("original client keys win everywhere but the policy's survev paths", () => {
        const original = Object.values<any>(live.gameConfig).find((c) => "protocolVersion" in c);
        const fromSurvev = new Set(policy.survevGameConfig.map((p: string) => `GameConfig.${p}`));
        const check = (o: any, g: any, path: string) => {
            if (fromSurvev.has(path)) return expect(g, path).not.toEqual(o);
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
