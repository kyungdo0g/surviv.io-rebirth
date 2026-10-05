// Id registries, protocol hash and typed getters.
import { describe, expect, it } from "vitest";
import {
    computeProtocolHash,
    DefRegistry,
    fnv1a32,
    GameObjectDefs,
    GameObjectRegistry,
    getDef,
    getDefOfType,
    getMapObjectDefOfType,
    MapObjectDefs,
    MapObjectRegistry,
    PROTOCOL_HASH,
    PROTOCOL_SCHEMA_VERSION,
} from "../src/index.ts";

describe("DefRegistry", () => {
    it("assigns ids in JSON key order after the empty type", () => {
        expect(GameObjectRegistry.typeToId("")).toBe(0);
        expect(MapObjectRegistry.typeToId("")).toBe(0);
        expect(Object.keys(GameObjectDefs).map((id) => GameObjectRegistry.typeToId(id))).toEqual(
            Object.keys(GameObjectDefs).map((_, i) => i + 1),
        );
        expect(Object.keys(MapObjectDefs).map((id) => MapObjectRegistry.typeToId(id))).toEqual(
            Object.keys(MapObjectDefs).map((_, i) => i + 1),
        );
        expect(GameObjectRegistry.bits).toBe(10);
        expect(MapObjectRegistry.bits).toBe(12);
    });

    it("is stable: rebuilding from the same ids gives the same mapping", () => {
        const again = new DefRegistry("again", Object.keys(GameObjectDefs), 10);
        expect(again.types).toEqual(GameObjectRegistry.types);
        expect(GameObjectRegistry.idToType(1)).toBe("bullet_mp5");
        expect(MapObjectRegistry.idToType(1)).toBe("barrel_01");
    });

    it("round-trips every id and type", () => {
        for (const reg of [GameObjectRegistry, MapObjectRegistry]) {
            for (const type of reg.types) expect(reg.idToType(reg.typeToId(type))).toBe(type);
            for (let id = 0; id < reg.size; id++) expect(reg.typeToId(reg.idToType(id))).toBe(id);
            expect(() => reg.typeToId("no_such_type")).toThrow();
            expect(() => reg.idToType(reg.size)).toThrow();
        }
    });

    it("guards the bit width and duplicates", () => {
        const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
        expect(new DefRegistry("fits", ids(1023), 10).size).toBe(1024);
        expect(() => new DefRegistry("overflow", ids(1024), 10)).toThrow(/10 bits/);
        expect(() => new DefRegistry("dup", ["a", "b", "a"], 10)).toThrow(/duplicate/);
        expect(() => new DefRegistry("empty", ["a", ""], 10)).toThrow(/duplicate/);
        expect(GameObjectRegistry.size).toBeLessThanOrEqual(2 ** 10);
        expect(MapObjectRegistry.size).toBeLessThanOrEqual(2 ** 12);
    });
});

describe("PROTOCOL_HASH", () => {
    it("is a 32-bit unsigned integer derived from the schema version and both id lists", () => {
        expect(Number.isInteger(PROTOCOL_HASH)).toBe(true);
        expect(PROTOCOL_HASH).toBeGreaterThanOrEqual(0);
        expect(PROTOCOL_HASH).toBeLessThan(2 ** 32);
        expect(PROTOCOL_SCHEMA_VERSION).toBe(4);
        expect(PROTOCOL_HASH).toBe(
            computeProtocolHash(PROTOCOL_SCHEMA_VERSION, GameObjectRegistry.types, MapObjectRegistry.types),
        );
    });

    it("changes when an id is added or the schema version changes", () => {
        const go = GameObjectRegistry.types;
        const mo = MapObjectRegistry.types;
        const v = PROTOCOL_SCHEMA_VERSION;
        expect(computeProtocolHash(v, [...go, "new_gun"], mo)).not.toBe(PROTOCOL_HASH);
        expect(computeProtocolHash(v, go, [...mo, "new_obstacle"])).not.toBe(PROTOCOL_HASH);
        expect(computeProtocolHash(v + 1, go, mo)).not.toBe(PROTOCOL_HASH);
    });

    it("uses FNV-1a 32", () => {
        expect(fnv1a32("")).toBe(0x811c9dc5);
        expect(fnv1a32("a")).toBe(0xe40c292c);
        expect(fnv1a32("foobar")).toBe(0xbf9cf968);
    });
});

describe("typed getters", () => {
    it("return defs of the requested type and throw on mismatch", () => {
        expect(getDefOfType("gun", "ak47").bulletType).toBe("bullet_ak47");
        expect(getDef("frag").type).toBe("throwable");
        expect(() => getDefOfType("melee", "ak47")).toThrow(/is a gun/);
        expect(() => getDef("barrett")).toThrow(/unknown/);
        expect(getMapObjectDefOfType("building", "warehouse_01").mapObjects.length).toBeGreaterThan(0);
        expect(() => getMapObjectDefOfType("obstacle", "warehouse_01")).toThrow();
    });
});
