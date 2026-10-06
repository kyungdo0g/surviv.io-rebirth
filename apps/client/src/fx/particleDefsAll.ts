// Every particle and emitter definition of the client in one registry (ParticleSystem and the coverage test read it).
import { MapObjectDefs } from "@rebirth/defs";
import { PARTICLE_DEFS, type ParticleDef } from "./particleDefs.ts";
import { EMITTER_DEFS_AMBIENT, PARTICLE_DEFS_AMBIENT } from "./particleDefsAmbient.ts";
import { PARTICLE_DEFS_BREAK } from "./particleDefsBreak.ts";
import { EMITTER_DEFS as EMITTER_DEFS_M5, type EmitterDef, PARTICLE_DEFS_M5 } from "./particleDefsM5.ts";
import { EMITTER_DEFS_M7, PARTICLE_DEFS_M7 } from "./particleDefsM7.ts";

export const ALL_PARTICLE_DEFS: Readonly<Record<string, ParticleDef>> = {
    ...PARTICLE_DEFS,
    ...PARTICLE_DEFS_M5,
    ...PARTICLE_DEFS_M7,
    ...PARTICLE_DEFS_BREAK,
    ...PARTICLE_DEFS_AMBIENT,
};

export const ALL_EMITTER_DEFS: Readonly<Record<string, EmitterDef>> = {
    ...EMITTER_DEFS_M5,
    ...EMITTER_DEFS_M7,
    ...EMITTER_DEFS_AMBIENT,
};

const maxOf = (r: number | readonly [number, number]) => (typeof r === "number" ? r : Math.max(r[0], r[1]));

/**
 * Adds the sprites of the particles a map can show to `out` (id -> raster scale): the break debris and hit chips of
 * its obstacles (through building children), roof debris and its camera particles, so the first break is not drawn
 * with textures still loading.
 */
export function mapParticleSprites(
    objectTypes: Iterable<string>,
    cameraEmitter: string,
    out: Map<string, number>,
): void {
    const types = new Set<string>();
    const seen = new Set<string>();
    const visit = (type: string): void => {
        if (seen.has(type)) return;
        seen.add(type);
        const def = MapObjectDefs[type] as
            | {
                  hitParticle?: string;
                  explodeParticle?: string | string[];
                  ceiling?: { destroy?: { particle?: string } };
                  mapObjects?: Array<{ type: string }>;
              }
            | undefined;
        if (!def) return;
        if (def.hitParticle) types.add(def.hitParticle);
        for (const p of [def.explodeParticle ?? []].flat()) types.add(p);
        if (def.ceiling?.destroy?.particle) types.add(def.ceiling.destroy.particle);
        for (const child of def.mapObjects ?? []) visit(child.type);
    };
    for (const type of objectTypes) visit(type);
    const camera = ALL_EMITTER_DEFS[cameraEmitter];
    if (camera) types.add(camera.particle);
    for (const type of types) {
        const def = ALL_PARTICLE_DEFS[type];
        if (!def) continue;
        const scale = Math.max(maxOf(def.scaleStart), maxOf(def.scaleEnd), 0.25);
        for (const img of def.image) out.set(img, Math.max(out.get(img) ?? 0, scale));
    }
}
