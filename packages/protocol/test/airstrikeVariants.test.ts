// Rebirth air strike variants on the wire (schema 9, docs/research/rebirth-deviations.md): every AirstrikeZones record
// carries its variant, a zone without one is sent as normal, the rebirth-only heavy shell and its explosion serialize
// like every other projectile and explosion through the game type registry, and the rebirth scorch decals and air drop
// tier crates like every other decal and obstacle through the map type registry. A carpet zone's 8-bit radius still
// covers every blast.
import { BitReader, BitWriter, type Vec2 } from "@rebirth/core";
import {
    AIRDROP_TIER_CRATES,
    AIRSTRIKE_VARIANT_IDS,
    AIRSTRIKE_VARIANTS,
    airstrikeAimRad,
    airstrikeBombReach,
    airstrikeZoneRad,
    CLUB_VAULT_BOX,
    GameConfig,
    GameObjectRegistry,
    getDefOfType,
    getMapDef,
    MapObjectRegistry,
    PROTOCOL_SCHEMA_VERSION,
    rebirthOnlyIds,
    rebirthOnlyMapObjectIds,
} from "@rebirth/defs";
import type { AirstrikeZoneView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    codecOf,
    OBJECT_TYPE_BITS,
    readAirstrikeZones,
    readExplosions,
    readFullFields,
    readProjectiles,
    writeAirstrikeZones,
    writeExplosions,
    writeFullRecord,
    writeProjectiles,
} from "../src/index.ts";

const ctx = { width: 720, height: 720 };

function roundTrip<T>(write: (w: BitWriter) => void, read: (r: BitReader) => T): T {
    const w = new BitWriter();
    write(w);
    const r = new BitReader(w.getBuffer());
    const out = read(r);
    expect(r.bitIndex).toBe(w.getBuffer().length * 8);
    return out;
}

const near = (a: Vec2, b: Vec2) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.05);

describe("air strike variants on the wire", () => {
    it("schema 9 and later carry the variant of every zone", () => {
        expect(PROTOCOL_SCHEMA_VERSION).toBeGreaterThanOrEqual(9);
        const zones: AirstrikeZoneView[] = AIRSTRIKE_VARIANT_IDS.map((variant, i) => ({
            id: i + 1,
            variant,
            pos: { x: 100 + i * 50, y: 300 },
            // the 50v50 map's first circle: 60, 90 (heavy: + 47.5 - 17.5) and 130 (carpet: 84 + 46)
            rad: airstrikeZoneRad(variant, 60),
            duration: variant === "carpet" ? 12.5 : 9.5,
            zoneT: 0.4,
        }));
        const out = roundTrip(
            (w) => writeAirstrikeZones(w, ctx, zones),
            (r) => readAirstrikeZones(r, ctx),
        );
        expect(out.map((z) => [z.id, z.variant])).toEqual([
            [1, "normal"],
            [2, "heavy"],
            [3, "carpet"],
        ]);
        for (let i = 0; i < zones.length; i++) {
            near(out[i].pos, zones[i].pos);
            expect(out[i].rad).toBeCloseTo(zones[i].rad, 0);
            expect(out[i].duration).toBeCloseTo(zones[i].duration, 0);
        }
    });

    it("a zone without a variant goes out as normal", () => {
        const out = roundTrip(
            (w) => writeAirstrikeZones(w, ctx, [{ id: 9, pos: { x: 10, y: 10 }, rad: 40, duration: 8, zoneT: 0 }]),
            (r) => readAirstrikeZones(r, ctx),
        );
        expect(out[0].variant).toBe("normal");
    });

    it("rejects the unused variant index", () => {
        const w = new BitWriter();
        writeAirstrikeZones(w, ctx, [{ id: 1, pos: { x: 1, y: 1 }, rad: 1, duration: 1, zoneT: 0 }]);
        const bytes = w.getBuffer();
        // count u8, id u8, pos 16+16, rad 8, duration 8, zoneT 8: the variant is the low 2 bits of byte 9 (LSB first)
        expect(bytes.length).toBe(10);
        bytes[9] |= 0x03;
        expect(() => readAirstrikeZones(new BitReader(bytes), ctx)).toThrow(/unknown variant 3/);
    });

    it("the heavy shell and its explosion serialize through the registry, after every generated type", () => {
        // the shell and its explosion first; the rebirth's new guns follow them (newGuns.test.ts), then the variant
        // strobes (strobes.test.ts)
        expect(rebirthOnlyIds.slice(0, 2)).toEqual(["bomb_heavy", "explosion_bomb_heavy"]);
        const firstRebirthId = GameObjectRegistry.typeToId("bomb_heavy");
        expect(GameObjectRegistry.idToType(firstRebirthId - 1)).not.toBe("explosion_bomb_heavy");
        expect(GameObjectRegistry.typeToId("explosion_bomb_heavy")).toBe(firstRebirthId + 1);
        const proj = { id: 42, type: "bomb_heavy", pos: { x: 200, y: 210 }, posZ: 4.5, dir: { x: 1, y: 0 }, layer: 0 };
        const [p] = roundTrip(
            (w) => writeProjectiles(w, ctx, [proj]),
            (r) => readProjectiles(r, ctx),
        );
        expect([p.id, p.type, p.layer]).toEqual([42, "bomb_heavy", 0]);
        near(p.pos, proj.pos);
        const [e] = roundTrip(
            (w) => writeExplosions(w, ctx, [{ type: "explosion_bomb_heavy", pos: { x: 300, y: 310 }, layer: 0 }]),
            (r) => readExplosions(r, ctx),
        );
        expect(e.type).toBe("explosion_bomb_heavy");
        near(e.pos, { x: 300, y: 310 });
    });

    it("the rebirth scorch decals serialize through the map type registry, after every generated type", () => {
        // then the rebirth buildings (rebirth/buildings.ts)
        expect(rebirthOnlyMapObjectIds).toEqual([
            "decal_bomb_heavy_explosion",
            "decal_frag_large_explosion",
            ...AIRDROP_TIER_CRATES,
            CLUB_VAULT_BOX,
            "loot_tier_medical",
            "clinic_01",
            "outpost_01r",
            "outpost_01b",
            "firestation_01",
            "library_01",
            "radio_station_01",
            "arsenal_01",
            "blockhouse_01r",
            "blockhouse_01b",
            "military_infirmary_01",
            "military_armory_01",
            "military_storehouse_01",
            "military_garage_01",
            "military_gatehouse_01",
            "military_tower_01",
            "military_hq_01",
            "military_hq_01r",
            "military_hq_01b",
            "military_stand_01",
            "military_stand_01r",
            "military_stand_01b",
            "military_compound_01",
            "military_compound_01r",
            "military_compound_01b",
            "military_bunker_command_01",
            "military_bunker_magazine_01",
            "military_bunker_vault_01",
            "military_bunker_01",
            "military_base_01",
            "military_base_01r",
            "military_base_01b",
            // the Molotov's fire and the discarded launchers (schema 25, rebirth/discardDecals.ts)
            "decal_molotov_fire",
            "decal_nlaw_discard",
            "decal_bazooka_discard",
            "decal_pvg42_discard",
            "decal_m202_discard",
            "decal_panzerfaust_discard",
            // the breakable partitions (schema 26, rebirth/buildings/walls.ts)
            "rebirth_wall_int_1",
            "rebirth_wall_int_2",
            "rebirth_wall_int_2_5",
            "rebirth_wall_int_3",
            "rebirth_wall_int_4",
            "rebirth_wall_int_5",
            "rebirth_wall_int_6",
            "rebirth_wall_int_7",
            "rebirth_wall_int_8",
            "rebirth_wall_int_9",
            "rebirth_wall_int_10",
            "rebirth_wall_int_11",
            "rebirth_wall_int_12",
            "rebirth_wall_int_13",
            "rebirth_wall_int_14",
        ]);
        const first = MapObjectRegistry.typeToId("decal_bomb_heavy_explosion");
        expect(first).toBe(MapObjectRegistry.size - rebirthOnlyMapObjectIds.length);
        expect(MapObjectRegistry.typeToId("decal_frag_large_explosion")).toBe(first + 1);
        const codec = codecOf("decal");
        for (const type of rebirthOnlyMapObjectIds) {
            const view = { id: 7, kind: "decal", type, pos: { x: 250, y: 260 }, ori: 0, scale: 1, layer: 0 } as const;
            const vals: number[] = [];
            codec.quantize(view, ctx, vals);
            const w = new BitWriter();
            writeFullRecord(w, codec, view.id, vals);
            const r = new BitReader(w.getBuffer());
            expect(r.readBits(OBJECT_TYPE_BITS)).toBe(codec.code);
            expect(r.readUint16()).toBe(view.id);
            const out = codec.build(view.id, readFullFields(r, codec), ctx);
            expect(out).toMatchObject({ kind: "decal", type, layer: 0 });
            near(out.pos, view.pos);
        }
    });

    it("the air drop tier crates and the club's gun box (schema 19) serialize as obstacles after the decals", () => {
        const decals = MapObjectRegistry.typeToId("decal_frag_large_explosion");
        expect([...AIRDROP_TIER_CRATES, CLUB_VAULT_BOX].map((t) => MapObjectRegistry.typeToId(t))).toEqual([
            decals + 1,
            decals + 2,
            decals + 3,
            decals + 4,
            decals + 5,
        ]);
        expect(PROTOCOL_SCHEMA_VERSION).toBeGreaterThanOrEqual(19);
        const codec = codecOf("obstacle");
        for (const type of [...AIRDROP_TIER_CRATES, CLUB_VAULT_BOX]) {
            const view = {
                id: 9,
                kind: "obstacle",
                type,
                pos: { x: 300, y: 320 },
                ori: 0,
                scale: 1,
                layer: 0,
                healthT: 1,
                dead: false,
            } as const;
            const vals: number[] = [];
            codec.quantize(view, ctx, vals);
            const w = new BitWriter();
            writeFullRecord(w, codec, view.id, vals);
            const r = new BitReader(w.getBuffer());
            expect(r.readBits(OBJECT_TYPE_BITS)).toBe(codec.code);
            expect(r.readUint16()).toBe(view.id);
            const out = codec.build(view.id, readFullFields(r, codec), ctx);
            expect(out).toMatchObject({ kind: "obstacle", type, dead: false });
        }
    });

    it("a carpet zone's radius, as the client reads it, covers every blast on every 50v50 timing", () => {
        // a bomb's reach from its aim point, then its blast to a player's body
        const reach =
            airstrikeBombReach(AIRSTRIKE_VARIANTS.carpet) +
            getDefOfType("explosion", "explosion_bomb_iron").rad.max +
            GameConfig.player.radius;
        const radii = getMapDef("faction")
            .gameConfig.planes.timings.map((t) => t.options.airstrikeZoneRad)
            .filter((r): r is number => !!r);
        expect(radii).toEqual([60, 55, 50, 45, 40]);
        for (const mapRad of radii) {
            const rad = airstrikeZoneRad("carpet", mapRad);
            const [z] = roundTrip(
                (w) =>
                    writeAirstrikeZones(w, ctx, [
                        { id: 1, variant: "carpet", pos: { x: 1, y: 1 }, rad, duration: 12.5, zoneT: 0 },
                    ]),
                (r) => readAirstrikeZones(r, ctx),
            );
            expect(z.rad).toBeGreaterThanOrEqual(airstrikeAimRad("carpet", mapRad) + reach);
            expect(z.rad).toBeLessThan(256);
        }
        expect(radii.map((r) => airstrikeZoneRad("carpet", r))).toEqual([130, 123, 116, 109, 102]);
    });

    it("a heavy zone's radius, as the client reads it, grows by the shell's extra reach over an iron bomb", () => {
        const extra =
            getDefOfType("explosion", "explosion_bomb_heavy").rad.max -
            getDefOfType("explosion", "explosion_bomb_iron").rad.max;
        expect(extra).toBe(47.5 - 17.5);
        for (const mapRad of [60, 55, 50, 45, 40]) {
            const [z] = roundTrip(
                (w) =>
                    writeAirstrikeZones(w, ctx, [
                        {
                            id: 1,
                            variant: "heavy",
                            pos: { x: 1, y: 1 },
                            rad: airstrikeZoneRad("heavy", mapRad),
                            duration: 9.5,
                            zoneT: 0,
                        },
                    ]),
                (r) => readAirstrikeZones(r, ctx),
            );
            expect(Math.abs(z.rad - (mapRad + extra))).toBeLessThanOrEqual(0.5);
        }
    });
});
