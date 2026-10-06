// M7 particle and emitter definitions: the speed burst ("haste") effects of Windwalk (blossoms), Takedown and Inspiration
// (music notes) that run around a player while PlayerView.haste is set. Values are the original client's particle data
// (survev client/src/objects/particles.ts ParticleDefs leafStim / takedownStim / inspireStim and EmitterDefs windwalk /
// takedown / inspire, the same numbers as the 0.8.82 bundle), ported as data.
import { hsv, type ParticleDef } from "./particleDefs.ts";
import type { EmitterDef } from "./particleDefsM5.ts";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PI = Math.PI;

/** a haste particle: lives 4-5 s, shrinks, fades out over the last 30 % and in over the first 5 % */
function stim(image: readonly string[], color: number | (() => number)): ParticleDef {
    return {
        image,
        life: [4, 5],
        drag: 0,
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: [0.12, 0.14],
        scaleEnd: [0.06, 0.08],
        alphaLerp: [0.7, 1],
        alphaIn: { start: 0, end: 1, lerp: [0, 0.05] },
        color,
    };
}

export const PARTICLE_DEFS_M7: Readonly<Record<string, ParticleDef>> = {
    leafStim: stim(["part-blossom-01.img", "part-blossom-02.img", "part-blossom-03.img", "part-blossom-04.img"], () =>
        hsv(0.37, 1, rnd(0.95, 1)),
    ),
    takedownStim: stim(["part-takedown-01.img"], 0xc80000),
    inspireStim: stim(["part-note-01.img"], () => hsv(0.13, 1, rnd(0.98, 1))),
};

/** haste emitters by PlayerView.haste type (survev player.ts hasteEffects) */
export const EMITTER_DEFS_M7: Readonly<Record<string, EmitterDef>> = {
    windwalk: { particle: "leafStim", rate: [0.1, 0.12], radius: 1.5, speed: [1, 1.5], angle: 0, rot: 0 },
    takedown: { particle: "takedownStim", rate: [0.1, 0.12], radius: 1.5, speed: [1, 1.5], angle: 0, rot: 0 },
    inspire: { particle: "inspireStim", rate: [0.3, 0.35], radius: 1.5, speed: [1, 1.5], angle: 0, rot: 0 },
};
