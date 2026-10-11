// M9 wire additions: DeadBody objects (original ObjectType 5: full record layer + playerId, partial record pos) and the
// bullet tracer speed factor, against the simulation.
import { BitReader, BitWriter, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { type DeadBodyView, emptyInput, Game, type Snapshot } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    ClientEncoder,
    codecOf,
    DeadBodyCodec,
    ObjectCache,
    ObjectTypeCode,
    readBullets,
    UpdateDecoder,
    writeBullets,
} from "../src/index.ts";
import { assertClose } from "./close.ts";
import { snapshotTolerances } from "./gen.ts";

function deadBodies(s: Snapshot): DeadBodyView[] {
    return s.objects.filter((o): o is DeadBodyView => o.kind === "deadBody");
}

describe("DeadBody objects", () => {
    it("use the original object type code and layout", () => {
        expect(codecOf("deadBody")).toBe(DeadBodyCodec);
        expect(DeadBodyCodec.code).toBe(ObjectTypeCode.DeadBody);
        expect(ObjectTypeCode.DeadBody).toBe(5);
        // static layer + playerId, one dynamic group: the position
        expect(DeadBodyCodec.groupCount).toBe(1);
        expect(DeadBodyCodec.fields.filter((f) => f.group === 0).length).toBe(2);
    });

    it("round-trip from the simulation: full record once, then position-only partial records while sliding", () => {
        const game = new Game({ mapName: "main", seed: 9 }, { sandbox: true, spawnLoot: false });
        const viewer = game.addPlayer("viewer");
        const victim = game.addPlayer("victim");
        const pv = game.getPlayer(viewer)!;
        game.teleportPlayer(victim, v2.add(pv.pos, { x: 6, y: 0 }));
        game.setInput(viewer, emptyInput());
        game.step();
        const ctx = { width: game.mapData.width, height: game.mapData.height };
        const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const roundTrip = () => {
            const snap = game.getSnapshot(viewer);
            const bytes = encoder.encode(snap, 0);
            const decoded = decoder.decode(bytes).snapshot;
            assertClose(deadBodies(decoded), deadBodies(snap), tol, `tick ${snap.tick}`);
            return { snap, decoded };
        };
        roundTrip();
        const vp = game.getPlayer(victim)!;
        const at = v2.copy(vp.pos);
        game.damagePlayer(vp, { amount: 500, damageType: DamageType.Player, sourceId: viewer, dir: { x: 1, y: 0 } });
        game.step();
        const first = roundTrip();
        expect(encoder.last.full).toBeGreaterThanOrEqual(1);
        const [body] = deadBodies(first.decoded);
        expect(body).toMatchObject({ kind: "deadBody", type: "deadBody", playerId: victim, layer: 0 });
        let partials = 0;
        for (let i = 0; i < 20; i++) {
            game.step();
            const { snap } = roundTrip();
            if (deadBodies(snap).length && encoder.last.part > 0) partials++;
        }
        expect(partials).toBeGreaterThan(0);
        // at rest it costs nothing
        for (let i = 0; i < 300; i++) game.step();
        roundTrip();
        game.step();
        const rest = roundTrip();
        expect(encoder.last.full + encoder.last.part).toBe(0);
        // slid 2.5 units, give or take one 16-bit position step over the map (0.014 on the 915-unit main map)
        const step = ctx.width / 0xffff;
        expect(Math.abs(deadBodies(rest.decoded)[0].pos.x - at.x - 2.5)).toBeLessThanOrEqual(step);
    });
});

describe("bullet speed factor", () => {
    it("is sent only when it differs from 1 and decodes as 1 otherwise", () => {
        const ctx = { width: 720, height: 720 };
        const base = {
            shooterId: 3,
            bulletType: "shrapnel_frag",
            sourceType: "frag",
            pos: { x: 100, y: 100 },
            dir: { x: 1, y: 0 },
            layer: 0,
            maxDist: 8,
            reflectCount: 0,
            hitPlayer: false,
            shotFx: false,
            offHand: false,
            saturated: false,
            thick: false,
            splinter: false,
        };
        const size = (speedMult: number) => {
            const w = new BitWriter();
            writeBullets(w, ctx, [{ ...base, id: 1, speedMult }]);
            return w.bitLength;
        };
        expect(size(1.75) - size(1)).toBe(10);
        const w = new BitWriter();
        writeBullets(w, ctx, [
            { ...base, id: 1, speedMult: 1.75 },
            { ...base, id: 2, speedMult: 1 },
            { ...base, id: 3 },
        ]);
        const out = readBullets(new BitReader(w.getBuffer(), w.bitLength), ctx);
        expect(out[0].speedMult).toBeCloseTo(1.75, 2);
        expect(out[1].speedMult).toBe(1);
        expect(out[2].speedMult).toBe(1);
    });
});
