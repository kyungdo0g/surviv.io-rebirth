// Schema 25 (the owner, 2026-10-10): the Molotov and flashbang ids and bag rows, the discarded launchers' and the
// fire's decal map types, the decals' free rotation and the Flash section round-trip, alone and through a real game.
import { BitReader, BitWriter, v2 } from "@rebirth/core";
import {
    DamageType,
    DISCARD_DECALS,
    FIRE_DECAL_TYPE,
    GameObjectRegistry,
    MapObjectRegistry,
    PROTOCOL_SCHEMA_VERSION,
    REBIRTH_THROWABLE_TYPES,
} from "@rebirth/defs";
import { BAG_ITEMS, type DecalView, Game, type Snapshot } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    ClientEncoder,
    DecalCodec,
    dequantizeDecalRot,
    emptyLocalState,
    ObjectCache,
    quantizeDecalRot,
    readFlash,
    UpdateDecoder,
    UpdateExtFlag,
    writeFlash,
} from "../src/index.ts";

const ctx = { width: 720, height: 720 };
const STEP = (Math.PI * 2) / 256;

function angleErr(a: number, b: number): number {
    const d = Math.abs(((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return d;
}

describe("schema 25 ids", () => {
    it("adds the throwables as the last game types and bag rows, the decals as the last map types", () => {
        expect(PROTOCOL_SCHEMA_VERSION).toBeGreaterThanOrEqual(25);
        expect(BAG_ITEMS.slice(-2)).toEqual([...REBIRTH_THROWABLE_TYPES]);
        const decals = [FIRE_DECAL_TYPE, ...Object.values(DISCARD_DECALS).map((d) => d.decal)];
        for (const id of [...REBIRTH_THROWABLE_TYPES, "explosion_molotov", "explosion_flashbang"]) {
            expect(GameObjectRegistry.idToType(GameObjectRegistry.typeToId(id))).toBe(id);
        }
        for (const id of decals) expect(MapObjectRegistry.idToType(MapObjectRegistry.typeToId(id))).toBe(id);
        expect(MapObjectRegistry.typeToId(FIRE_DECAL_TYPE)).toBeGreaterThan(
            MapObjectRegistry.typeToId("military_base_01b"),
        );
    });
});

describe("decal rotation", () => {
    it("quantizes to 256 steps over a full turn and wraps", () => {
        for (const rot of [0, 0.3, -0.3, Math.PI, -Math.PI / 2, 7, -12.5]) {
            expect(angleErr(dequantizeDecalRot(quantizeDecalRot(rot)), rot)).toBeLessThanOrEqual(STEP / 2 + 1e-9);
        }
        expect(quantizeDecalRot(Math.PI * 2 - 1e-6)).toBe(0);
    });

    it("rides in the decal's full record; map decals without one decode without it", () => {
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const turned: DecalView = {
            id: 5,
            kind: "decal",
            type: "decal_nlaw_discard",
            pos: { x: 100, y: 200 },
            layer: 0,
            ori: 0,
            scale: 1,
            goreKills: 0,
            rot: -2.2,
        };
        const plain: DecalView = { ...turned, id: 6, type: "decal_frag_explosion", rot: undefined };
        delete plain.rot;
        const snap: Snapshot = {
            tick: 1,
            time: 0,
            localPlayerId: 1,
            local: emptyLocalState(),
            objects: [turned, plain],
            deletedIds: [],
        };
        const out = decoder.decode(encoder.encode(snap, 0)).snapshot.objects as DecalView[];
        expect(out[0].type).toBe("decal_nlaw_discard");
        expect(angleErr(out[0].rot!, -2.2)).toBeLessThanOrEqual(STEP / 2 + 1e-9);
        expect(out[1].rot).toBeUndefined();
        expect(DecalCodec.fields.length).toBe(8);
    });
});

describe("Flash section", () => {
    it("is extended flag bit 10, two bytes after the Hits section", () => {
        expect(UpdateExtFlag.Flash).toBe(1 << 10);
        expect(UpdateExtFlag.Reserved & UpdateExtFlag.Flash).toBe(0);
        const w = new BitWriter();
        writeFlash(w, { blind: 0.5, deaf: 1 });
        expect(w.getBuffer().length).toBe(2);
        const out = readFlash(new BitReader(w.getBuffer()));
        expect(out.blind).toBeCloseTo(0.5, 2);
        expect(out.deaf).toBe(1);
    });

    it("carries a real game's flash and turned decal to the client", () => {
        const game = new Game({ mapName: "main", seed: 7 }, { sandbox: true, spawnLoot: false });
        const id = game.addPlayer("flashed");
        const p = game.getPlayer(id)!;
        game.step();
        const net = { width: game.mapData.width, height: game.mapData.height };
        const encoder = new ClientEncoder(new ObjectCache(net));
        const decoder = new UpdateDecoder(net);
        decoder.decode(encoder.encode(game.getSnapshot(id), 0));
        game.explosions.add("explosion_flashbang", v2.add(p.pos, { x: 1, y: 0 }), p.layer, {
            damageType: DamageType.Player,
            sourceId: 0,
        });
        game.decals.spawn("decal_bazooka_discard", p.pos, p.layer, { rot: 1.25 });
        game.step();
        const snap = game.getSnapshot(id);
        expect(snap.flash).toBeDefined();
        const out = decoder.decode(encoder.encode(snap, 0)).snapshot;
        expect(out.flash!.blind).toBeCloseTo(snap.flash!.blind, 2);
        expect(out.flash!.deaf).toBeCloseTo(snap.flash!.deaf, 2);
        const decal = out.objects.find((o) => o.type === "decal_bazooka_discard") as DecalView;
        expect(angleErr(decal.rot!, 1.25)).toBeLessThanOrEqual(STEP / 2 + 1e-9);
        game.step();
        expect(decoder.decode(encoder.encode(game.getSnapshot(id), 0)).snapshot.flash).toBeUndefined();
    });
});
