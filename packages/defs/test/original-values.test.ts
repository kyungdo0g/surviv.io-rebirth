// Spot checks of values only the original v0.8.82 client has (survev's fork changed them), and a full comparison
// against the extracted client defs when research-cache/live/defs.json is available.
import { describe, expect, it } from "vitest";
import { getDefOfType } from "../src/index.ts";
import { gameObjects, mapObjects, maps, provenance, readOptionalJson } from "./helpers.ts";

const live = readOptionalJson("research-cache/live/defs.json");
const liveVsSurvev = readOptionalJson("docs/research/data/live-vs-survev.json");

describe("original client values", () => {
    it("AN-94 bullet", () => {
        const b = getDefOfType("bullet", "bullet_an94");
        expect(b.damage).toBe(17.5);
        expect(b.speed).toBe(110);
    });

    it("Mosin-Nagant", () => {
        const g = getDefOfType("gun", "mosin");
        expect(g.headshotMult).toBe(1.5);
        expect(g.barrelLength).toBe(3.75);
    });

    it("AK-47 and M870", () => {
        const ak = getDefOfType("gun", "ak47");
        expect(ak.fireDelay).toBe(0.1);
        expect(ak.maxClip).toBe(30);
        expect(getDefOfType("gun", "m870").bulletCount).toBe(9);
    });

    it("helmet damage reduction", () => {
        const values = ["helmet01", "helmet02", "helmet03"].map((id) => getDefOfType("helmet", id).damageReduction);
        expect(values).toEqual([0.25, 0.4, 0.55]);
    });

    it.skipIf(!liveVsSurvev)("helmets agree with the original values listed in live-vs-survev.json", () => {
        for (const id of ["helmet01", "helmet02", "helmet03"]) {
            const entry = liveVsSurvev.gameObjects.find((e: any) => e.id === id);
            const diff = entry?.diffs?.find((d: any) => d.field === "damageReduction");
            if (diff?.live !== undefined)
                expect(getDefOfType("helmet", id).damageReduction).toBe(JSON.parse(diff.live));
        }
    });

    it.skipIf(!liveVsSurvev)("every original value listed in live-vs-survev.json is the ported value", () => {
        const get = (o: any, path: string) =>
            path
                .split(/[.[\]]+/)
                .filter(Boolean)
                .reduce((a, k) => (a == null ? undefined : a[k]), o);
        let checked = 0;
        for (const [defs, list] of [
            [gameObjects, liveVsSurvev.gameObjects],
            [mapObjects, liveVsSurvev.mapObjects],
        ] as const) {
            for (const entry of list) {
                if (entry.status !== "both") continue;
                for (const diff of entry.diffs ?? []) {
                    if (diff.live === undefined) continue;
                    expect(get(defs[entry.id], diff.field), `${entry.id}.${diff.field}`).toEqual(JSON.parse(diff.live));
                    checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});

describe.skipIf(!live)("generated defs equal the original client defs", () => {
    const fixups = new Set(provenance.fixups.map((f: any) => `${f.id}.${f.field}`));
    const withoutFixups = (id: string, def: any) => {
        const out = { ...def };
        for (const k of Object.keys(out)) if (fixups.has(`${id}.${k}`)) delete out[k];
        return out;
    };

    it("game objects: same ids, same order, same values", () => {
        expect(Object.keys(gameObjects)).toEqual(Object.keys(live.gameObjects));
        for (const [id, def] of Object.entries(live.gameObjects)) {
            expect(withoutFixups(id, gameObjects[id]), id).toEqual(def);
        }
    });

    it("map objects: original ids first in client order, same values", () => {
        const ids = Object.keys(live.mapObjects);
        expect(Object.keys(mapObjects).slice(0, ids.length)).toEqual(ids);
        for (const id of ids) expect(mapObjects[id], id).toEqual(live.mapObjects[id]);
    });

    it("client-visible map parts come from the original client", () => {
        for (const def of Object.values<any>(live.mapDefCandidates)) {
            const name = Object.keys(maps).find(
                (k) => provenance.maps[k].inOriginalClient && maps[k].mapId === def.mapId,
            );
            expect(name, `mapId ${def.mapId}`).toBeDefined();
            const map = maps[name!];
            expect(map.desc).toMatchObject(def.desc);
            expect(map.assets).toEqual(def.assets);
            expect(map.biome).toMatchObject(def.biome);
            expect(map.gameMode).toMatchObject(def.gameMode);
        }
    });
});
