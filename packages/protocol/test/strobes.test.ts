// The rebirth variant strobes on the wire (schema 12, defs rebirth/strobes.ts): their game types and their pings
// serialize through the registry after every other id, their bag counts are the last two items of the Local message's
// inventory section (the original items keep their order), and a kill credited to a variant strobe keeps its source.
import { BitReader, BitWriter } from "@rebirth/core";
import { DamageType, GameObjectRegistry, PROTOCOL_SCHEMA_VERSION, STROBE_VARIANT_TYPES } from "@rebirth/defs";
import type { MapIndicatorView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    BAG_ITEMS,
    emptyLocalState,
    LOCAL_ALL_DIRTY,
    MsgType,
    quantizeLocal,
    readKill,
    readLocal,
    readProjectiles,
    writeKill,
    writeLocal,
    writeProjectiles,
} from "../src/index.ts";
import { quantizeIndicator, readIndicators, writeIndicators } from "../src/match.ts";

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

describe("variant strobes on the wire", () => {
    it("schema 12: they are the last bag items and their types follow the other rebirth-only ones", () => {
        expect(PROTOCOL_SCHEMA_VERSION).toBeGreaterThanOrEqual(12);
        expect(BAG_ITEMS.slice(-2)).toEqual([...STROBE_VARIANT_TYPES]);
        expect(BAG_ITEMS.slice(0, 11)).toEqual([
            "9mm",
            "762mm",
            "556mm",
            "12gauge",
            "50AE",
            "308sub",
            "flare",
            "45acp",
            "frag",
            "smoke",
            "strobe",
        ]);
        for (const id of [...STROBE_VARIANT_TYPES, "ping_airstrike_heavy", "ping_airstrike_carpet"]) {
            expect(GameObjectRegistry.idToType(GameObjectRegistry.typeToId(id))).toBe(id);
            expect(GameObjectRegistry.typeToId(id)).toBeGreaterThan(GameObjectRegistry.typeToId("bomb_heavy"));
        }
    });

    it("the local player's throwable slot and bag counts round-trip", () => {
        const state = emptyLocalState();
        state.weapons = [
            { type: "", ammo: 0 },
            { type: "", ammo: 0 },
            { type: "fists", ammo: 0 },
            { type: "strobe_carpet", ammo: 0 },
        ];
        state.curWeapIdx = 3;
        state.inventory.strobe = 1;
        state.inventory.strobe_heavy = 2;
        state.inventory.strobe_carpet = 5;
        const out = emptyLocalState();
        roundTrip(
            (w) => writeLocal(w, quantizeLocal(state), LOCAL_ALL_DIRTY),
            (r) => readLocal(r, out),
        );
        expect(out.weapons[3].type).toBe("strobe_carpet");
        expect([out.inventory.strobe, out.inventory.strobe_heavy, out.inventory.strobe_carpet]).toEqual([1, 2, 5]);
    });

    it("thrown variant strobes, their pings and a kill credited to one round-trip", () => {
        const projs = STROBE_VARIANT_TYPES.map((type, i) => ({
            id: 20 + i,
            type,
            pos: { x: 300 + i, y: 310 },
            posZ: 0,
            dir: { x: 1, y: 0 },
            layer: 0,
        }));
        const read = roundTrip(
            (w) => writeProjectiles(w, ctx, projs),
            (r) => readProjectiles(r, ctx),
        );
        expect(read.map((p) => p.type)).toEqual([...STROBE_VARIANT_TYPES]);

        const pings: MapIndicatorView[] = ["ping_airstrike_heavy", "ping_airstrike_carpet"].map((type, i) => ({
            id: i,
            type,
            pos: { x: 100, y: 200 + i * 10 },
            dead: false,
            equipped: false,
        }));
        const readPings = roundTrip(
            (w) =>
                writeIndicators(
                    w,
                    pings.map((m) => quantizeIndicator(m, ctx)),
                ),
            (r) => readIndicators(r, ctx),
        );
        expect(readPings.map((m) => m.type)).toEqual(["ping_airstrike_heavy", "ping_airstrike_carpet"]);

        const kill = {
            type: MsgType.Kill,
            damageType: DamageType.Airstrike,
            itemSourceType: "strobe_heavy",
            mapSourceType: "",
            targetId: 5,
            killerId: 6,
            killCreditId: 6,
            killerKills: 2,
            downed: false,
            killed: true,
        } as const;
        expect(
            roundTrip(
                (w) => writeKill(w, kill),
                (r) => readKill(r),
            ),
        ).toEqual(kill);
    });
});
