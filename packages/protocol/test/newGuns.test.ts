// The rebirth's new guns on the wire (schema 11, defs rebirth/newGuns.ts): their game type ids follow the rebirth-only
// air strike shell, every record carrying a game type round-trips them (loot, the local player's weapon slots,
// bullets, the 40 mm grenade, explosions), and the three new ammo rows (40mm, rocket, 57mm after .45 ACP) round-trip
// in the inventory section with full level 3 bags.
import { BitReader, BitWriter } from "@rebirth/core";
import {
    GameConfig,
    GameObjectRegistry,
    NEW_AMMO_IDS,
    NEW_GUN_IDS,
    newGunDefs,
    PROTOCOL_SCHEMA_VERSION,
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

function roundTrip<T>(write: (w: BitWriter) => void, read: (r: BitReader) => T): T {
    const w = new BitWriter();
    write(w);
    const r = new BitReader(w.getBuffer());
    const out = read(r);
    const pad = w.getBuffer().length * 8 - r.bitIndex;
    expect(pad).toBeGreaterThanOrEqual(0);
    expect(pad).toBeLessThan(8);
    return out;
}

describe("new guns on the wire (schema 11)", () => {
    it("their game type ids follow the rebirth air strike shell; every id fits the 10 type bits", () => {
        expect(PROTOCOL_SCHEMA_VERSION).toBe(11);
        const after = GameObjectRegistry.typeToId("explosion_bomb_heavy");
        const ids = Object.keys(newGunDefs());
        for (const [i, id] of ids.entries()) expect(GameObjectRegistry.typeToId(id), id).toBe(after + 1 + i);
        expect(GameObjectRegistry.size).toBeLessThanOrEqual(1024);
    });

    it("the new ammo rows sit after .45 ACP in the bag order", () => {
        const at = BAG_ITEMS.indexOf("45acp");
        expect(BAG_ITEMS.slice(at + 1, at + 4)).toEqual([...NEW_AMMO_IDS]);
        expect(BAG_ITEMS).toEqual(Object.keys(GameConfig.bagSizes));
    });

    it("loot of every new gun and ammo round-trips with its type and count", () => {
        const codec = codecOf("loot");
        for (const [i, type] of [...NEW_GUN_IDS, ...NEW_AMMO_IDS].entries()) {
            const view: LootView = { id: 200 + i, kind: "loot", type, pos: { x: 100 + i, y: 300 }, layer: 0, count: 7 };
            const vals: number[] = [];
            codec.quantize(view, ctx, vals);
            const w = new BitWriter();
            writeFullRecord(w, codec, view.id, vals);
            const r = new BitReader(w.getBuffer());
            expect(r.readBits(OBJECT_TYPE_BITS)).toBe(codec.code);
            expect(r.readUint16()).toBe(view.id);
            expect(codec.build(view.id, readFullFields(r, codec), ctx)).toMatchObject({ kind: "loot", type, count: 7 });
        }
    });

    it("weapon slots (a Boys with its shots left, a DShK, a P90) and full bags of the new ammo round-trip", () => {
        const state = emptyLocalState();
        state.weapons = [
            { type: "boys", ammo: 5 },
            { type: "dshk", ammo: 30 },
            { type: "fists", ammo: 0 },
            { type: "", ammo: 0 },
        ];
        state.curWeapIdx = 0;
        for (const id of NEW_AMMO_IDS) state.inventory[id] = GameConfig.bagSizes[id][3];
        state.inventory["45acp"] = 300;
        state.inventory.frag = 12;
        const out = emptyLocalState();
        roundTrip(
            (w) => writeLocal(w, quantizeLocal(state), LOCAL_ALL_DIRTY),
            (r) => readLocal(r, out),
        );
        expect(out.weapons).toEqual(state.weapons);
        expect([out.inventory["40mm"], out.inventory.rocket, out.inventory["57mm"]]).toEqual([40, 10, 400]);
        expect([out.inventory["45acp"], out.inventory.frag]).toEqual([300, 12]);
        state.weapons[0] = { type: "p90", ammo: 60 };
        roundTrip(
            (w) => writeLocal(w, quantizeLocal(state), LOCAL_ALL_DIRTY),
            (r) => readLocal(r, out),
        );
        expect(out.weapons[0]).toEqual({ type: "p90", ammo: 60 });
    });

    it("rockets, the GL-06 round, the 40 mm grenade and their explosions round-trip", () => {
        const bullets: BulletEvent[] = ["rpg7", "panzerfaust", "m202", "gl06", "p90"].map((gun, i) => ({
            id: i + 1,
            shooterId: 3,
            bulletType: `bullet_${gun}`,
            sourceType: gun,
            pos: { x: 100, y: 100 + i },
            dir: { x: 1, y: 0 },
            layer: 0,
            maxDist: 100,
            reflectCount: 0,
            hitPlayer: false,
            shotFx: true,
            offHand: false,
        }));
        const read = roundTrip(
            (w) => writeBullets(w, ctx, bullets),
            (r) => readBullets(r, ctx),
        );
        expect(read.map((b) => [b.bulletType, b.sourceType])).toEqual(bullets.map((b) => [b.bulletType, b.sourceType]));
        const proj = { id: 4, type: "m79_grenade", pos: { x: 200, y: 210 }, posZ: 1.5, dir: { x: 1, y: 0 }, layer: 0 };
        const [p] = roundTrip(
            (w) => writeProjectiles(w, ctx, [proj]),
            (r) => readProjectiles(r, ctx),
        );
        expect(p.type).toBe("m79_grenade");
        const types = ["explosion_m79", "explosion_gl06", "explosion_rpg7", "explosion_panzerfaust", "explosion_m202"];
        const explosions = types.map((type, i) => ({ type, pos: { x: 300 + i, y: 310 }, layer: 0 }));
        const back = roundTrip(
            (w) => writeExplosions(w, ctx, explosions),
            (r) => readExplosions(r, ctx),
        );
        expect(back.map((e) => e.type)).toEqual(types);
    });
});
