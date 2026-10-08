// Particle coverage (M9): every particle and emitter the generated game data names has a client definition (a missing
// one silently drew nothing, e.g. obstacle break debris), every definition's sprites are in the sprite manifest, and
// every emitter spawns a defined particle; every explosion has an effect whose scattered pieces are defined, and every
// heal / boost effect resolves to defined emitters.
import { type ExplosionDef, GameObjectDefs, MapDefs, MapObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { explosionVisual } from "../src/fx/explosions.ts";
import { ALL_EMITTER_DEFS, ALL_PARTICLE_DEFS } from "../src/fx/particleDefsAll.ts";
import manifest from "../src/generated/sprite-manifest.json";
import { effectEmitters } from "../src/objects/playerEmitters.ts";

/** referenced emitters the client deliberately does not define */
const EMITTER_ALLOWLIST: Readonly<Record<string, string>> = {
    // heal / boost items name a generic effect: the client runs the player's loadout heal / boost effect emitter
    heal: "item placeholder, resolved to the loadout's heal_effect emitter",
    boost: "item placeholder, resolved to the loadout's boost_effect emitter",
    // XP loot was removed from rebirth (no xp emitters or particles)
    xp_common: "XP loot removed",
    xp_rare: "XP loot removed",
    xp_mythic: "XP loot removed",
};

/** sprites of particle defs that are not in the manifest (none today) */
const SPRITE_ALLOWLIST: Readonly<Record<string, string>> = {};

type Refs = { particles: Map<string, string>; emitters: Map<string, string> };

/** Walks a def tree collecting particle / emitter names by the keys that hold them, with where they were found. */
function collect(node: unknown, path: string, refs: Refs): void {
    if (Array.isArray(node)) {
        node.forEach((v, i) => {
            collect(v, `${path}[${i}]`, refs);
        });
        return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
        const at = `${path}.${key}`;
        const names = (typeof value === "string" ? [value] : Array.isArray(value) ? value : []).filter(
            (v): v is string => typeof v === "string" && v !== "",
        );
        if (["hitParticle", "explodeParticle", "useParticle"].includes(key)) {
            for (const n of names) refs.particles.set(n, at);
        } else if (key === "particle" && typeof value === "string") {
            refs.particles.set(value, at);
        } else if (key === "emitter" || key === "camera") {
            for (const n of names) refs.emitters.set(n, at);
        } else if (key === "occupiedEmitters" && Array.isArray(value)) {
            for (const e of value) refs.emitters.set((e as { type: string }).type, at);
        }
        collect(value, at, refs);
    }
}

function references(): Refs {
    const refs: Refs = { particles: new Map(), emitters: new Map() };
    collect(GameObjectDefs, "gameObjects", refs);
    collect(MapObjectDefs, "mapObjects", refs);
    collect(MapDefs, "maps", refs);
    // guns eject a casing particle named after their ammo (survev shot.ts createCasingParticle)
    for (const [id, def] of Object.entries(GameObjectDefs)) {
        if (def.type === "gun") refs.particles.set(def.ammo, `gameObjects.${id}.ammo`);
    }
    return refs;
}

describe("particle coverage", () => {
    const refs = references();

    it("finds the references it checks", () => {
        expect(refs.particles.size).toBeGreaterThan(60);
        expect(refs.particles.get("woodPlank")).toBeDefined();
        expect(refs.emitters.get("falling_leaf")).toBeDefined();
        expect(refs.emitters.get("cabin_smoke_parent")).toBeDefined();
    });

    it("defines every particle the game data names", () => {
        const missing = [...refs.particles].filter(([n]) => !ALL_PARTICLE_DEFS[n]).map(([n, at]) => `${n} (${at})`);
        expect(missing).toEqual([]);
    });

    it("defines every emitter the game data names", () => {
        const missing = [...refs.emitters]
            .filter(([n]) => !ALL_EMITTER_DEFS[n] && !EMITTER_ALLOWLIST[n])
            .map(([n, at]) => `${n} (${at})`);
        expect(missing).toEqual([]);
    });

    it("emits only defined particles", () => {
        const bad = Object.entries(ALL_EMITTER_DEFS)
            .filter(([, e]) => !ALL_PARTICLE_DEFS[e.particle])
            .map(([n, e]) => `${n} -> ${e.particle}`);
        expect(bad).toEqual([]);
    });

    it("draws every particle with a sprite of the manifest", () => {
        const sprites = manifest as Record<string, unknown>;
        const missing: string[] = [];
        for (const [name, def] of Object.entries(ALL_PARTICLE_DEFS)) {
            expect(def.image.length, name).toBeGreaterThan(0);
            for (const img of def.image) {
                if (!sprites[img] && !SPRITE_ALLOWLIST[img]) missing.push(`${name}: ${img}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it("plays an effect for every explosion, scattering defined particles", () => {
        const bad: string[] = [];
        for (const [id, def] of Object.entries(GameObjectDefs)) {
            if (def.type !== "explosion") continue;
            const visual = explosionVisual(id);
            if (!visual) bad.push(`${id}: no effect "${(def as ExplosionDef).explosionEffectType}"`);
            else if (visual.effect.scatter && !ALL_PARTICLE_DEFS[visual.effect.scatter.particle]) {
                bad.push(`${id}: scatter ${visual.effect.scatter.particle}`);
            }
        }
        expect(bad).toEqual([]);
        // survev's coconut and tomato splats (survev client explosion.ts:672-715)
        expect(explosionVisual("explosion_coconut")?.effect.scatter).toMatchObject({ particle: "coconut_impact" });
        expect(explosionVisual("explosion_tomato")?.effect.burst.grass).toBe("tomato_01");
    });

    it("resolves every heal / boost effect to defined emitters, the default for an unknown one", () => {
        for (const [id, def] of Object.entries(GameObjectDefs)) {
            if (def.type !== "heal_effect" && def.type !== "boost_effect") continue;
            for (const e of effectEmitters(id, def.type)) expect(ALL_EMITTER_DEFS[e], `${id}: ${e}`).toBeDefined();
        }
        expect(effectEmitters("boost_gearshift", "boost_effect")).toEqual(["boost_gearshift_01", "boost_gearshift_02"]);
        expect(effectEmitters("heal_diamond", "heal_effect")).toEqual(["heal_diamond"]);
        expect(effectEmitters("", "heal_effect")).toEqual(["heal_basic"]);
        expect(effectEmitters("heal_diamond", "boost_effect")).toEqual(["boost_basic"]);
    });

    it("keeps definitions sane", () => {
        for (const [name, def] of Object.entries(ALL_PARTICLE_DEFS)) {
            const life = typeof def.life === "number" ? [def.life, def.life] : def.life;
            expect(life[0], name).toBeGreaterThan(0);
            expect(def.alphaLerp[0], name).toBeLessThanOrEqual(def.alphaLerp[1]);
        }
        for (const [name, e] of Object.entries(ALL_EMITTER_DEFS)) {
            const rate = typeof e.rate === "number" ? [e.rate, e.rate] : e.rate;
            expect(rate[0], name).toBeGreaterThan(0);
        }
    });
});
