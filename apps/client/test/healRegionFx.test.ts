// The rebirth buildings' heal region effect (objects/healRegionFx.ts; the owner, 2026-10-08): crosses rise inside the
// clinic's treatment rooms once the roof is open, a ring pulse starts at each room's bed, the glow brightens while the
// followed player stands in a room, and nothing spawns under a closed roof.
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import { type BuildingDef, MapObjectDefs, REBIRTH_HEAL_FX_BUILDINGS } from "@rebirth/defs";
import type { BuildingView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import type { ParticleSystem } from "../src/fx/particles.ts";
import { HealRegionFx } from "../src/objects/healRegionFx.ts";
import type { FrameContext, ViewDeps } from "../src/objects/types.ts";
import type { Renderer } from "../src/render/renderer.ts";

interface Spawn {
    type: string;
    pos: Vec2;
    vel: Vec2;
}

function setup(ori = 1) {
    const spawns: Spawn[] = [];
    const deps = {
        renderer: { add: () => {} } as unknown as Renderer,
        textures: { preload: async () => {} } as unknown as TextureStore,
        particles: {
            add: (type: string, _layer: number, pos: Vec2, vel: Vec2) => spawns.push({ type, pos: { ...pos }, vel }),
        } as unknown as ParticleSystem,
    } as unknown as ViewDeps;
    const def = MapObjectDefs.clinic_01 as BuildingDef;
    const view = { id: 7, kind: "building", type: "clinic_01", pos: { x: 300, y: 200 }, layer: 0, ori } as BuildingView;
    const regions = (def.healRegions ?? []).map((r) =>
        collider.transform(r.collision, view.pos, math.oriToRad(ori), 1),
    );
    return { spawns, fx: new HealRegionFx(deps, def, view), regions, view };
}

const frame = (localPos: Vec2, dt = 0.05): FrameContext => ({ dt, localPos, localLayer: 0, localId: 1 });

describe("heal region effect", () => {
    it("is on for the clinic", () => {
        expect(REBIRTH_HEAL_FX_BUILDINGS.has("clinic_01")).toBe(true);
        expect((MapObjectDefs.clinic_01 as BuildingDef).healRegions?.length).toBe(2);
    });

    it("raises crosses inside the treatment rooms and pulses from the beds once the roof is open", () => {
        const { spawns, fx, regions } = setup();
        const outside = { x: 0, y: 0 };
        for (let t = 0; t < 4; t += 0.05) fx.update(frame(outside), 0, 1, 0);
        const crosses = spawns.filter((s) => s.type === "heal_basic");
        const pulses = spawns.filter((s) => s.type === "waterRipple");
        expect(crosses.length).toBeGreaterThan(8);
        for (const c of crosses) {
            expect(regions.some((r) => collider.contains(r, c.pos))).toBe(true);
            expect(c.vel.y).toBeGreaterThan(0);
        }
        // two rooms, one pulse each every 1.8 s, centred on the room's bed (bed_sm_01 children)
        expect(pulses.length).toBeGreaterThanOrEqual(4);
        const def = MapObjectDefs.clinic_01 as BuildingDef;
        const beds = def.mapObjects
            .filter((c) => c.type === "bed_sm_01")
            .map((c) => v2.add({ x: 300, y: 200 }, v2.rotate(c.pos, math.oriToRad(1))));
        for (const p of pulses) expect(beds.some((b) => v2.length(v2.sub(b, p.pos)) < 1e-6)).toBe(true);
    });

    it("spawns nothing under a closed roof", () => {
        const { spawns, fx } = setup();
        for (let t = 0; t < 4; t += 0.05) fx.update(frame({ x: 0, y: 0 }), 1, 1, 0);
        expect(spawns).toEqual([]);
        expect(fx.spawned).toBe(0);
    });

    it("brightens and raises crosses faster while the followed player stands in a room", () => {
        const idle = setup();
        const healing = setup();
        const room = collider.toAabb(healing.regions[0]);
        const inRoom = v2.mul(v2.add(room.min, room.max), 0.5);
        const glowOf = (fx: HealRegionFx) => (fx as unknown as { glow: { alpha: number } }).glow.alpha;
        let idleMax = 0;
        let inMin = 1;
        for (let t = 0; t < 6; t += 0.05) {
            idle.fx.update(frame({ x: 0, y: 0 }), 0, 1, 0);
            healing.fx.update(frame(inRoom), 0, 1, 0);
            idleMax = Math.max(idleMax, glowOf(idle.fx));
            inMin = Math.min(inMin, glowOf(healing.fx));
        }
        expect(inMin).toBeGreaterThan(0.85);
        expect(idleMax).toBeLessThanOrEqual(0.9 + 1e-9);
        const count = (s: Spawn[]) => s.filter((x) => x.type === "heal_basic").length;
        expect(count(healing.spawns)).toBeGreaterThan(count(idle.spawns) * 1.4);
    });
});
