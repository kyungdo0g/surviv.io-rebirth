// The survev-only guns on the wire (schema 10, tools/port-survev/policy.json): their game type ids follow the
// original ones, and every record that carries a game type (loot, the local player's weapon slots, bullets,
// projectiles, explosions) round-trips them; the .50 bag count of a full level 3 bag (200) still fits the 9-bit
// inventory counts.
import { BitReader, BitWriter } from "@rebirth/core";
import {
    GameConfig,
    GameObjectRegistry,
    PROTOCOL_SCHEMA_VERSION,
    rebirthOnlyIds,
    SURVEV_GUN_SKINS,
    SURVEV_ONLY_GUNS,
} from "@rebirth/defs";
import type { BulletEvent, LootView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    BAG_ITEMS,
    codecOf,
    emptyLocalState,
    LOCAL_ALL_DIRTY,
    OBJECT_TYPE_BITS,
    quantizeLocal,
    readBullets,
    readExplosions,
    readFullFields,
    readLocal,
    readProjectiles,
    writeBullets,
    writeExplosions,
    writeFullRecord,
    writeLocal,
    writeProjectiles,
} from "../src/index.ts";

const ctx = { width: 720, height: 720 };
const GUNS = [...SURVEV_ONLY_GUNS, ...Object.keys(SURVEV_GUN_SKINS)];

function roundTrip<T>(write: (w: BitWriter) => void, read: (r: BitReader) => T): T {
    const w = new BitWriter();
    write(w);
    const r = new BitReader(w.getBuffer());
    const out = read(r);
    // everything written is read back, up to the padding of the last byte
    const pad = w.getBuffer().length * 8 - r.bitIndex;
    expect(pad).toBeGreaterThanOrEqual(0);
    expect(pad).toBeLessThan(8);
    return out;
}

describe("survev-only guns on the wire", () => {
    it("schema 10: their game type ids come after every original one, before the rebirth-only ones", () => {
        expect(PROTOCOL_SCHEMA_VERSION).toBe(10);
        const firstRebirth = GameObjectRegistry.typeToId(rebirthOnlyIds[0]);
        for (const id of [...GUNS, "bullet_barrett", "potato_lmgshot", "explosion_potato_lmgshot"]) {
            const n = GameObjectRegistry.typeToId(id);
            expect(n, id).toBeLessThan(firstRebirth);
            expect(n, id).toBeGreaterThan(GameObjectRegistry.typeToId("xp_donut"));
            expect(GameObjectRegistry.idToType(n)).toBe(id);
        }
    });

    it("loot of every gun round-trips with its type, count and preloaded flag", () => {
        const codec = codecOf("loot");
        for (const [i, type] of GUNS.entries()) {
            const view: LootView = {
                id: 100 + i,
                kind: "loot",
                type,
                pos: { x: 200 + i, y: 300 },
                layer: 0,
                count: 1,
                isPreloadedGun: true,
            };
            const vals: number[] = [];
            codec.quantize(view, ctx, vals);
            const w = new BitWriter();
            writeFullRecord(w, codec, view.id, vals);
            const r = new BitReader(w.getBuffer());
            expect(r.readBits(OBJECT_TYPE_BITS)).toBe(codec.code);
            expect(r.readUint16()).toBe(view.id);
            expect(codec.build(view.id, readFullFields(r, codec), ctx)).toMatchObject({
                kind: "loot",
                type,
                count: 1,
                isPreloadedGun: true,
            });
        }
    });

    it("the local player's weapon slots and a full .50 bag round-trip", () => {
        const state = emptyLocalState();
        state.weapons = [
            { type: "barrett", ammo: 12 },
            { type: "potato_lmg", ammo: 250 },
            { type: "fists", ammo: 0 },
            { type: "", ammo: 0 },
        ];
        state.curWeapIdx = 1;
        state.inventory["50AE"] = GameConfig.bagSizes["50AE"][3];
        expect(BAG_ITEMS).toContain("50AE");
        const out = emptyLocalState();
        roundTrip(
            (w) => writeLocal(w, quantizeLocal(state), LOCAL_ALL_DIRTY),
            (r) => readLocal(r, out),
        );
        expect(out.weapons).toEqual(state.weapons);
        expect(out.curWeapIdx).toBe(1);
        expect(out.inventory["50AE"]).toBe(200);
    });

    it("bullets, the PMG-134's projectile and its explosion round-trip", () => {
        const bullets: BulletEvent[] = (["barrett", "ash12", "sw500", "imbel"] as const).map((gun, i) => ({
            id: i + 1,
            shooterId: 7,
            bulletType: `bullet_${gun}`,
            sourceType: gun,
            pos: { x: 100, y: 100 + i },
            dir: { x: 1, y: 0 },
            layer: 0,
            maxDist: 400,
            reflectCount: 0,
            hitPlayer: false,
            shotFx: true,
            offHand: false,
        }));
        bullets.push({ ...bullets[0], id: 5, bulletType: "bullet_invis", sourceType: "potato_lmg" });
        const read = roundTrip(
            (w) => writeBullets(w, ctx, bullets),
            (r) => readBullets(r, ctx),
        );
        expect(read.map((b) => [b.bulletType, b.sourceType])).toEqual(bullets.map((b) => [b.bulletType, b.sourceType]));
        const proj = {
            id: 9,
            type: "potato_lmgshot",
            pos: { x: 200, y: 210 },
            posZ: 0.5,
            dir: { x: 1, y: 0 },
            layer: 0,
        };
        const [p] = roundTrip(
            (w) => writeProjectiles(w, ctx, [proj]),
            (r) => readProjectiles(r, ctx),
        );
        expect(p.type).toBe("potato_lmgshot");
        const [e] = roundTrip(
            (w) => writeExplosions(w, ctx, [{ type: "explosion_potato_lmgshot", pos: { x: 300, y: 310 }, layer: 0 }]),
            (r) => readExplosions(r, ctx),
        );
        expect(e.type).toBe("explosion_potato_lmgshot");
    });
});
