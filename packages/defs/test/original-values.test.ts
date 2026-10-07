// Spot checks of values only the original v0.8.82 client has (survev's fork changed them), and a full comparison
// against the extracted client defs when research-cache/live/defs.json is available. The survev-only ids the port
// takes (tools/port-survev/policy.json) follow the original ones and are checked in survevGuns.test.ts. Under survev
// balance (policy survevBalance, design option B) the original ids keep the original presentation and take survev's
// gameplay fields, each listed in provenance.survevValues with the original value it replaced.
import { describe, expect, it } from "vitest";
import { getDefOfType } from "../src/index.ts";
import { gameObjects, mapObjects, maps, portPolicy, provenance, readOptionalJson } from "./helpers.ts";

const live = readOptionalJson("research-cache/live/defs.json");
const liveVsSurvev = readOptionalJson("docs/research/data/live-vs-survev.json");

/** survev balance: the original value of a field the port replaced with survev's (provenance survevValues). */
function originalOf(id: string, field: string): unknown {
    const c = (provenance.survevValues ?? []).find((v: any) => v.id === id && v.field === field);
    return c ? c.original : undefined;
}

describe("original client values", () => {
    it("AN-94 bullet: survev's 20 damage and 120 speed, the original's 17.5 / 110 on record", () => {
        const b = getDefOfType("bullet", "bullet_an94");
        // survev bulletDefs.ts:67; balance.txt line 6
        expect([b.damage, b.speed]).toEqual(portPolicy.survevBalance ? [20, 120] : [17.5, 110]);
        if (portPolicy.survevBalance)
            expect([originalOf("bullet_an94", "damage"), originalOf("bullet_an94", "speed")]).toEqual([17.5, 110]);
    });

    it("Mosin-Nagant: the original barrel (presentation), survev's headshot x1.25", () => {
        const g = getDefOfType("gun", "mosin");
        expect(g.headshotMult).toBe(portPolicy.survevBalance ? 1.25 : 1.5);
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
        // survev map generation: survev's faction sides and placement rules (provenance survevMapGenFields)
        const mapGenFields = new Set(provenance.survevMapGenFields.map((c: any) => `${c.id}.${c.field}`));
        // survev balance: survev's gameplay fields (provenance survevValues)
        const gameplay = new Set((provenance.survevValues ?? []).map((c: any) => `${c.id}.${c.field}`));
        for (const [defs, list] of [
            [gameObjects, liveVsSurvev.gameObjects],
            [mapObjects, liveVsSurvev.mapObjects],
        ] as const) {
            for (const entry of list) {
                if (entry.status !== "both") continue;
                // structure overrides take survev's whole def (policy.json survevMapObjects, survev content wave)
                if (defs === mapObjects && provenance.mapObjects[entry.id] === "survev-override") continue;
                for (const diff of entry.diffs ?? []) {
                    if (diff.live === undefined) continue;
                    if (defs === mapObjects && mapGenFields.has(`${entry.id}.${diff.field.split(/[.[]/)[0]}`)) continue;
                    if (defs === gameObjects && gameplay.has(`${entry.id}.${diff.field.split(/[.[]/)[0]}`)) continue;
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

    it("game objects: original ids first in client order (the survev-only ones after them), same values", () => {
        const ids = Object.keys(live.gameObjects);
        expect(Object.keys(gameObjects).slice(0, ids.length)).toEqual(ids);
        for (const id of Object.keys(gameObjects).slice(ids.length))
            expect(provenance.gameObjects[id], id).toBe("survev-only");
        // survev balance: survev's gameplay fields, each logged with the original value it replaced
        const gameplay = new Map<string, any[]>();
        for (const c of provenance.survevValues ?? []) gameplay.set(c.id, [...(gameplay.get(c.id) ?? []), c]);
        for (const [id, def] of Object.entries<any>(live.gameObjects)) {
            const expected = { ...def };
            for (const c of gameplay.get(id) ?? []) {
                expect(expected[c.field] ?? "absent", `${id}.${c.field}`).toEqual(c.original);
                expected[c.field] = c.survev;
            }
            expect(withoutFixups(id, gameObjects[id]), id).toEqual(expected);
        }
    });

    it("map objects: original ids first in client order, same values but the policy's structure overrides", () => {
        const ids = Object.keys(live.mapObjects);
        expect(Object.keys(mapObjects).slice(0, ids.length)).toEqual(ids);
        const overrides = new Set<string>(portPolicy.survevMapObjects);
        // survev map generation: survev's `teamId` / `terrain` (provenance survevMapGenFields), else the original's
        const mapGen = new Map<string, any[]>();
        for (const c of provenance.survevMapGenFields) mapGen.set(c.id, [...(mapGen.get(c.id) ?? []), c]);
        for (const id of ids) {
            if (overrides.has(id)) {
                expect(provenance.mapObjects[id], id).toBe("survev-override");
                continue;
            }
            const expected = { ...live.mapObjects[id] };
            for (const c of mapGen.get(id) ?? []) {
                expect(expected[c.field] ?? "absent", `${id}.${c.field}`).toEqual(c.original);
                expected[c.field] = c.survev;
            }
            expect(mapObjects[id], id).toEqual(expected);
        }
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
