// Referential integrity of the generated definitions.
import { describe, expect, it } from "vitest";
import {
    type Defs,
    gameConfig,
    gameObjects,
    mapObjects,
    maps,
    NOT_PORTED_IDS,
    PORTED_SURVEV_IDS,
    PSEUDO_AMMO,
    provenance,
    readGeneratedText,
} from "./helpers.ts";

/** Loot spawners the original client defines but no building or map spawns; their tiers exist nowhere. */
const DEAD_LOOT_SPAWNERS = new Set(["loot_tier_eye_01", "loot_tier_chrys_02b", "loot_tier_helmet_potato"]);

const perkModeRoles = [...new Set(Object.values(maps).flatMap((m: any) => m.gameMode.perkModeRoles ?? []))];

/** Map object ids a map object points at, written independently of src/refs.ts. */
function children(def: any): string[] {
    const out: string[] = [];
    for (const c of def.mapObjects ?? []) {
        if (typeof c.type === "string") out.push(c.type);
        else out.push(...Object.keys(c.type));
    }
    for (const l of def.layers ?? []) out.push(l.type);
    if (def.destroyType) {
        if (def.smartLoot) out.push(...perkModeRoles.map((r) => `${def.destroyType}_${r}`));
        else out.push(def.destroyType);
    }
    if (def.button?.useType) out.push(def.button.useType);
    if (def.puzzle?.completeUseType) out.push(def.puzzle.completeUseType);
    return out.filter((id) => id !== "");
}

function spawnIds(map: any): string[] {
    const g = map.mapGen;
    return [
        ...g.densitySpawns.flatMap((d: object) => Object.keys(d)),
        ...g.fixedSpawns.flatMap((d: object) => Object.keys(d)),
        ...g.randomSpawns.flatMap((r: any) => r.spawns),
        ...g.spawnReplacements.flatMap((d: object) => [...Object.keys(d), ...Object.values(d)]),
        ...g.customSpawnRules.locationSpawns.map((l: any) => l.type),
        ...g.customSpawnRules.placeSpawns,
        ...(g.importantSpawns ?? []),
        ...Object.values(g.bridgeTypes),
        ...g.map.rivers.lakes.map((l: any) => l.centerObj),
        ...map.gameConfig.planes.crates.map((c: any) => c.name),
        ...(map.gameConfig.unlocks?.timings ?? []).map((u: any) => u.type),
    ].filter((id) => typeof id === "string" && id !== "");
}

function reachable(roots: string[]): Set<string> {
    const seen = new Set<string>();
    const queue = [...roots];
    while (queue.length) {
        const id = queue.pop()!;
        if (seen.has(id) || !mapObjects[id]) continue;
        seen.add(id);
        queue.push(...children(mapObjects[id]));
    }
    return seen;
}

const ofType = (type: string) => Object.entries(gameObjects).filter(([, d]) => d.type === type);

function expectRef(owner: string, id: unknown, type?: string, defs: Defs = gameObjects) {
    expect(typeof id, `${owner}: ${String(id)}`).toBe("string");
    const def = defs[id as string];
    expect(def, `${owner} -> ${String(id)}`).toBeDefined();
    if (type) expect(def.type, `${owner} -> ${String(id)}`).toBe(type);
}

describe("ids", () => {
    it.each(["gameObjects.json", "mapObjects.json", "maps.json"])("%s has no duplicate top-level keys", (file) => {
        const keys = [...readGeneratedText(file).matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]);
        expect(keys.length).toBeGreaterThan(0);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("game object and map object ids do not collide and every def has a type", () => {
        expect(Object.keys(gameObjects).filter((id) => id in mapObjects)).toEqual([]);
        for (const [id, def] of [...Object.entries(gameObjects), ...Object.entries(mapObjects)]) {
            expect(typeof def.type, id).toBe("string");
        }
    });

    it("provenance covers every id", () => {
        expect(Object.keys(provenance.gameObjects)).toEqual(Object.keys(gameObjects));
        expect(new Set(Object.values(provenance.gameObjects))).toEqual(new Set(["original", "survev-only"]));
        // the survev-only ids are exactly the policy's, after every original id
        const survevOnly = Object.keys(provenance.gameObjects).filter(
            (id) => provenance.gameObjects[id] !== "original",
        );
        expect([...survevOnly].sort()).toEqual([...PORTED_SURVEV_IDS].sort());
        const first = Object.keys(gameObjects).indexOf(survevOnly[0]);
        expect(Object.keys(gameObjects).slice(first)).toEqual(survevOnly);
        expect(Object.keys(provenance.mapObjects)).toEqual(Object.keys(mapObjects));
        expect(Object.keys(provenance.maps)).toEqual(Object.keys(maps));
        const original = Object.entries(provenance.maps).filter(([, p]: any) => p.inOriginalClient);
        expect(original.map(([, p]: any) => p.mapId).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
});

describe("game object references", () => {
    it("guns", () => {
        for (const [id, gun] of ofType("gun")) {
            expectRef(`${id}.bulletType`, gun.bulletType, "bullet");
            if (gun.bulletTypeBonus) expectRef(`${id}.bulletTypeBonus`, gun.bulletTypeBonus, "bullet");
            if (!PSEUDO_AMMO.has(gun.ammo)) expectRef(`${id}.ammo`, gun.ammo, "ammo");
            if (gun.dualWieldType) expectRef(`${id}.dualWieldType`, gun.dualWieldType, "gun");
            if (gun.projType) expectRef(`${id}.projType`, gun.projType);
        }
    });

    it("throwables, explosions and bullets", () => {
        for (const [id, t] of ofType("throwable")) {
            expectRef(`${id}.explosionType`, t.explosionType, "explosion");
            if (t.heavyType) expectRef(`${id}.heavyType`, t.heavyType, "throwable");
            if (t.splitType) expectRef(`${id}.splitType`, t.splitType, "throwable");
        }
        for (const [id, e] of ofType("explosion")) {
            if (e.shrapnelType) expectRef(`${id}.shrapnelType`, e.shrapnelType, "bullet");
            if (e.decalType) expectRef(`${id}.decalType`, e.decalType, "decal", mapObjects);
        }
        for (const [id, b] of ofType("bullet")) if (b.onHit) expectRef(`${id}.onHit`, b.onHit, "explosion");
    });

    it("roles and perks", () => {
        for (const [id, role] of ofType("role")) {
            // survev balance: a role perk may be a weighted choice ({ $weighted: [{ type, weight }] }, Lone Survivr)
            for (const p of role.perks ?? []) {
                const choices = typeof p === "string" ? [p] : (p.$weighted ?? []).map((c: { type: string }) => c.type);
                expect(choices.length, `${id}.perks`).toBeGreaterThan(0);
                for (const c of choices) expectRef(`${id}.perks`, c, "perk");
            }
            // role kits (survev defaultItems), including $byTeam / $weighted alternatives
            JSON.stringify(role.defaultItems ?? {}, (key, value) => {
                const itemKey = ["type", "helmet", "chest", "backpack", "outfit"].includes(key);
                if (itemKey && typeof value === "string" && value !== "") expectRef(`${id}.defaultItems`, value);
                return value;
            });
        }
        for (const [id, def] of Object.entries(gameObjects)) {
            if (def.perk) expectRef(`${id}.perk`, def.perk, "perk");
            if (def.type === "helmet" && def.role) expectRef(`${id}.role`, def.role, "role");
        }
        for (const [name, map] of Object.entries(maps)) {
            for (const t of map.gameConfig.roles?.timings ?? []) expectRef(`${name} role timing`, t.role, "role");
            for (const r of Object.keys(map.gameConfig.roles?.roleOverrides ?? {})) expectRef(`${name}`, r, "role");
            for (const r of map.gameMode.perkModeRoles ?? []) expectRef(`${name} perkModeRoles`, r, "role");
            // role loadout items, including $byTeam / $weighted alternatives
            JSON.stringify(map.gameConfig.roles?.roleOverrides ?? {}, (key, value) => {
                const itemKey = ["type", "helmet", "chest", "backpack", "outfit"].includes(key);
                if (itemKey && typeof value === "string" && value !== "") expectRef(`${name} roleOverrides`, value);
                return value;
            });
        }
    });
});

describe("map object references", () => {
    it("building, structure and obstacle children resolve", () => {
        for (const [id, def] of Object.entries(mapObjects)) {
            for (const child of children(def)) expect(mapObjects[child], `${id} -> ${child}`).toBeDefined();
        }
    });

    it("every map def spawn id resolves", () => {
        for (const [name, map] of Object.entries(maps)) {
            for (const id of spawnIds(map)) expect(mapObjects[id], `${name} -> ${id}`).toBeDefined();
        }
    });

    it("autoLoot items and explosions resolve to game objects", () => {
        for (const [id, def] of Object.entries(mapObjects)) {
            for (const l of def.loot ?? []) if (l.type) expectRef(`${id} loot`, l.type);
            if (def.explosion) expectRef(`${id}.explosion`, def.explosion, "explosion");
        }
    });

    it("tierLoot tiers resolve in the loot table of every map that can spawn the object", () => {
        const spawned = new Set<string>();
        for (const [name, map] of Object.entries(maps)) {
            for (const id of reachable(spawnIds(map))) {
                spawned.add(id);
                for (const l of mapObjects[id].loot ?? []) {
                    if (l.tier) expect(map.lootTable[l.tier], `${name}: ${id} -> ${l.tier}`).toBeDefined();
                }
            }
        }
        const allTiers = new Set(Object.values(maps).flatMap((m: any) => Object.keys(m.lootTable)));
        const unresolved = Object.entries(mapObjects)
            .filter(([id]) => !spawned.has(id))
            .filter(([, def]) => (def.loot ?? []).some((l: any) => l.tier && !allTiers.has(l.tier)))
            .map(([id]) => id);
        expect(new Set(unresolved)).toEqual(DEAD_LOOT_SPAWNERS);
    });
});

describe("loot tables", () => {
    it("entries resolve to game objects or tier tables, without cycles", () => {
        for (const [name, map] of Object.entries(maps)) {
            const table: Record<string, any[]> = map.lootTable;
            for (const [tier, entries] of Object.entries(table)) {
                for (const e of entries) {
                    if (e.name === "") continue;
                    if (e.name.startsWith("tier_")) expect(table[e.name], `${name} ${tier} -> ${e.name}`).toBeDefined();
                    else expectRef(`${name} ${tier}`, e.name);
                    expect(e.count, `${name} ${tier} ${e.name}`).toBeGreaterThan(0);
                    expect(e.weight, `${name} ${tier} ${e.name}`).toBeGreaterThanOrEqual(0);
                }
            }
            const state = new Map<string, "visiting" | "done">();
            const visit = (tier: string, path: string[]) => {
                if (state.get(tier) === "done") return;
                expect(state.get(tier), `${name}: cycle ${[...path, tier].join(" -> ")}`).not.toBe("visiting");
                state.set(tier, "visiting");
                for (const e of table[tier] ?? []) if (e.name.startsWith("tier_")) visit(e.name, [...path, tier]);
                state.set(tier, "done");
            };
            for (const tier of Object.keys(table)) visit(tier, []);
        }
    });

    it("contain no xp drops", () => {
        for (const map of Object.values(maps)) {
            for (const entries of Object.values<any[]>(map.lootTable)) {
                expect(entries.filter((e) => e.name.startsWith("xp_"))).toEqual([]);
            }
        }
    });

    it("bagSizes covers every stackable item that can drop", () => {
        const stackable = new Set(["ammo", "heal", "boost", "throwable", "scope"]);
        for (const [name, map] of Object.entries(maps)) {
            for (const entries of Object.values<any[]>(map.lootTable)) {
                for (const e of entries) {
                    if (!stackable.has(gameObjects[e.name]?.type)) continue;
                    expect(gameConfig.bagSizes[e.name], `${name}: bagSizes.${e.name}`).toHaveLength(5);
                }
            }
        }
    });
});

describe("survev-only content", () => {
    it.each(["gameObjects.json", "mapObjects.json", "maps.json", "gameConfig.json"])(
        "%s has no survev-only item the policy leaves out",
        (f) => {
            const found: string[] = [];
            JSON.parse(readGeneratedText(f), (key, value) => {
                if (NOT_PORTED_IDS.includes(key) || NOT_PORTED_IDS.includes(value)) found.push(key || value);
                return value;
            });
            expect(found).toEqual([]);
        },
    );
});
