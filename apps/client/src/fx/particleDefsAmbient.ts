// M9 ambient particles: the leaves, blossoms, potatoes and snowflakes drifting over the screen on the event maps
// (MapDef biome.particles.camera names the emitter; fx/cameraEmitters.ts runs it around the camera). Values are the
// 0.8.82 client's particle module (the original bundle, same numbers as survev client/src/objects/particles.ts
// ParticleDefs / EmitterDefs), ported as data; falling_pvt and potato_factions exist only in survev (its
// faction_potato map, which our generated maps include).
import { hsv, type ParticleDef } from "./particleDefs.ts";
import type { EmitterDef } from "./particleDefsM5.ts";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PI = Math.PI;

const BLOSSOMS = ["part-blossom-01.img", "part-blossom-02.img", "part-blossom-03.img", "part-blossom-04.img"];
const LEAVES = ["part-leaf-03.img", "part-leaf-04.img", "part-leaf-05.img", "part-leaf-06.img"];

/** a drifting particle: 10-15 s, slowly turning, fading in over the first 5 % and out over the last 10 % */
function falling(
    image: readonly string[],
    start: readonly [number, number],
    color: () => number,
    opts: Partial<ParticleDef> = {},
): ParticleDef {
    return {
        image,
        life: [10, 15],
        drag: 0,
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: start,
        scaleEnd: [0.08, 0.11],
        alphaLerp: [0.9, 1],
        alphaIn: { start: 0, end: 1, lerp: [0, 0.05] },
        color,
        ...opts,
    };
}

const pale = () => hsv(0, 0, rnd(0.9, 0.95));

export const PARTICLE_DEFS_AMBIENT: Readonly<Record<string, ParticleDef>> = {
    leafAutumn: falling(LEAVES, [0.12, 0.15], pale),
    // Halloween keeps its own darkened tint instead of the biome valueAdjust
    leafHalloween: falling(LEAVES, [0.12, 0.15], () => hsv(0, 0, rnd(0.5, 0.55)), { ignoreValueAdjust: true }),
    leafSpring: falling(BLOSSOMS, [0.13, 0.15], pale),
    leafSummer: falling(["part-leaf-06.img"], [0.12, 0.15], () => hsv(0, 0, rnd(0.7, 0.95)), {
        ignoreValueAdjust: true,
    }),
    leafPotato: falling([...BLOSSOMS, "part-potato-02.img"], [0.13, 0.15], pale),
    potato: falling(["part-potato-02.img"], [0.13, 0.15], pale),
    potato_factions: falling(["part-potato-02.img", "part-tomato-02.img"], [0.13, 0.15], pale),
    snow: falling(["part-snow-01.img"], [0.07, 0.12], pale, { scaleEnd: [0.05, 0.1] }),
};

/** camera emitter: spawns within `radius` of the camera, drifting along the emitter direction (down-right) */
function camera(particle: string, rate: readonly [number, number], opts: Partial<EmitterDef> = {}): EmitterDef {
    return {
        particle,
        rate,
        radius: 120,
        speed: [2, 3],
        angle: PI * 0.2,
        rot: [0, PI * 2],
        zOrd: 999,
        ...opts,
    };
}

export const EMITTER_DEFS_AMBIENT: Readonly<Record<string, EmitterDef>> = {
    falling_leaf: camera("leafAutumn", [0.08, 0.12]),
    falling_leaf_halloween: camera("leafHalloween", [0.08, 0.12]),
    falling_leaf_spring: camera("leafSpring", [0.1, 0.14]),
    falling_leaf_summer: camera("leafSummer", [0.18, 0.24], { speed: [1.4, 2.4], rot: undefined }),
    falling_leaf_potato: camera("leafPotato", [0.1, 0.14]),
    falling_potato: camera("potato", [0.2, 0.24]),
    falling_pvt: camera("potato_factions", [0.2, 0.24]),
    // the snow storm thickens over the first 4 minutes
    falling_snow_fast: camera("snow", [0.12, 0.17], {
        radius: 70,
        speed: [1, 1.5],
        maxRate: [0.05, 0.07],
        maxElapsed: 240,
    }),
    falling_snow_slow: camera("snow", [0.08, 0.12], { radius: 70, speed: [1, 1.5] }),
};
