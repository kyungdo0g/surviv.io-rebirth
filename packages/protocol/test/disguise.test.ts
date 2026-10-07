// Obstacle disguises on the wire (survev content wave): the obstacle record's static isSkin bit and wearer id (the
// original full record's isSkin [+ skinPlayerId u16]), round-tripped from the simulation while the wearer walks.
import { v2 } from "@rebirth/core";
import { emptyInput, Game, type ObstacleView, type Snapshot, setOutfit } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { ClientEncoder, ObjectCache, ObstacleCodec, UpdateDecoder } from "../src/index.ts";

function skins(s: Snapshot): ObstacleView[] {
    return s.objects.filter((o): o is ObstacleView => o.kind === "obstacle" && o.skinPlayerId !== undefined);
}

describe("obstacle disguises", () => {
    it("carry the wearer's id and follow it", () => {
        // isSkin is static and gates the u16 wearer id
        const isSkin = ObstacleCodec.fields.length - 2;
        expect(ObstacleCodec.fields[isSkin]).toEqual({ bits: 1, group: -1, when: -1 });
        expect(ObstacleCodec.fields[isSkin + 1]).toEqual({ bits: 16, group: -1, when: isSkin });

        const game = new Game({ mapName: "main", seed: 9 }, { sandbox: true, spawnLoot: false });
        const id = game.addPlayer("wearer");
        const p = game.getPlayer(id)!;
        setOutfit(game, p, "outfitWoodBarrel");
        game.setInput(id, emptyInput());
        game.step();
        const ctx = { width: game.mapData.width, height: game.mapData.height };
        const encoder = new ClientEncoder(new ObjectCache(ctx));
        const decoder = new UpdateDecoder(ctx);
        const roundTrip = () => decoder.decode(encoder.encode(game.getSnapshot(id), 0)).snapshot;
        const [first] = skins(roundTrip());
        expect(first).toMatchObject({ type: "barrel_02", skinPlayerId: id, dead: false });
        game.setInput(id, { ...emptyInput(), moveRight: true });
        for (let i = 0; i < 20; i++) game.step();
        const moved = roundTrip();
        expect(v2.distance(skins(moved)[0].pos, p.pos)).toBeLessThan(0.1);
        // map obstacles carry no wearer
        const others = moved.objects.filter((o) => o.kind === "obstacle" && o.id !== first.id);
        expect(others.length).toBeGreaterThan(0);
        for (const o of others) expect((o as ObstacleView).skinPlayerId).toBeUndefined();
    });
});
