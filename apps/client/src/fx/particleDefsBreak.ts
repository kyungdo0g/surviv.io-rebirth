// M9 obstacle break debris: the `explodeParticle` pieces a destroyed obstacle throws out (planks, logs, shards,
// glass, metal plates, books, feathers), plus the remaining pieces of air drop crates and Cobalt class crates named by
// `button.useParticle` / `explodeParticle`. Values are the 0.8.82 client's particle module (the original bundle,
// same numbers as survev client/src/objects/particles.ts ParticleDefs), ported as data; tomatoBreak_01/02 exist only in
// survev (its faction_potato tomatoes, which our generated map objects include), so do toiletGoldBreak and
// depositBoxSilverBreak (survev buildings).
import { crateShell, hsv, type ParticleDef } from "./particleDefs.ts";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PI = Math.PI;

/** chunks of a broken obstacle (survev barrelBreak & co): 0.8-1 s, not spinning */
function chunk(image: string, color: number | (() => number), opts: Partial<ParticleDef> = {}): ParticleDef {
    return {
        image: [image],
        life: [0.8, 1],
        drag: [1, 5],
        rotVel: 0,
        scaleStart: [0.07, 0.12],
        scaleEnd: [0.05, 0.1],
        alphaLerp: [0.9, 1],
        color,
        ...opts,
    };
}

/** planks and logs (survev woodPlank & co): 1-1.5 s, spinning at 3 pi rad/s */
function plank(image: string, color: number | (() => number), opts: Partial<ParticleDef> = {}): ParticleDef {
    return {
        image: [image],
        life: [1, 1.5],
        drag: [1, 5],
        rotVel: [PI * 3, PI * 3],
        scaleStart: [0.1, 0.2],
        scaleEnd: [0.08, 0.18],
        alphaLerp: [0.9, 1],
        color,
        ...opts,
    };
}

/** glass shards of windows and bottles: short-lived, see-through, spinning fast */
function glass(color: number, opts: Partial<ParticleDef> = {}): ParticleDef {
    return {
        image: ["part-spark-02.img"],
        life: [0.4, 0.8],
        drag: [1, 4],
        rotVel: [PI, PI * 6],
        scaleStart: [0.07, 0.12],
        scaleEnd: [0.05, 0.1],
        alphaStart: 0.8,
        alphaLerp: [0.75, 1],
        color,
        ...opts,
    };
}

/** metal plates of lockers and deposit boxes: heavy drag */
function plate(color: () => number, start: readonly [number, number], end: readonly [number, number]): ParticleDef {
    return {
        image: ["part-plate-01.img"],
        life: [0.5, 1],
        drag: [7, 8],
        rotVel: [0, PI * 3],
        scaleStart: start,
        scaleEnd: end,
        alphaLerp: [0.9, 1],
        color,
    };
}

function feathers(start: readonly [number, number], end: readonly [number, number]): ParticleDef {
    return {
        image: ["part-feather-01.img", "part-feather-02.img"],
        life: [1, 1.5],
        drag: [1, 10],
        rotVel: [0, PI * 3],
        scaleStart: start,
        scaleEnd: end,
        alphaLerp: [0.95, 1],
        color: 0xffffff,
    };
}

/** crate pieces: the "a" half spins faster than the "b" half (survev airdropCrate01 / airdropCrate02) */
const crateA = (image: string) => crateShell(image, [2, 2.25], [PI, PI * 2]);
const crateB = (image: string) => crateShell(image, [1.85, 2.15], [0, PI * 2]);

const woodColor = () => hsv(0.05, 1, rnd(0.25, 0.35));
const metalColor = () => hsv(0.01, 0.02, rnd(0.38, 0.41));
const porcelainColor = () => hsv(0.97, 0, rnd(0.95, 0.97));

export const PARTICLE_DEFS_BREAK: Readonly<Record<string, ParticleDef>> = {
    woodPlank: plank("part-plank-01.img", woodColor),
    woodShard: plank("part-spark-02.img", woodColor, {
        drag: [3, 5],
        scaleStart: [0.06, 0.15],
        scaleEnd: [0.02, 0.1],
    }),
    woodLog: plank("part-log-01.img", () => hsv(0.05, 1, rnd(0.35, 0.45))),
    barrelPlank: plank("part-plank-01.img", () => hsv(0.09, 0.8, rnd(0.66, 0.68)), {
        drag: [3, 5],
        scaleStart: [0.08, 0.18],
        scaleEnd: [0.07, 0.17],
    }),
    book: plank("part-book-01.img", () => hsv(0.08, 0.42, rnd(0.72, 0.74)), {
        drag: [3, 5],
        scaleStart: [0.09, 0.19],
        scaleEnd: [0.07, 0.17],
    }),
    glassPlank: plank("part-plank-01.img", 0x80d9ff),
    greenPlank: plank("part-plank-01.img", 0x3b452f, { scaleStart: [0.08, 0.16], scaleEnd: [0.05, 0.1] }),
    outhousePlank: plank("part-plank-01.img", () => hsv(0.08, 0.57, rnd(0.4, 0.46))),
    redPlank: plank("part-plank-01.img", () => hsv(0.02, 1, rnd(0.26, 0.28))),
    whitePlank: plank("part-plank-01.img", porcelainColor),
    barrelBreak: chunk("part-spark-02.img", metalColor),
    clothBreak: chunk("part-cloth-01.img", () => hsv(0, 0, rnd(0.95, 1))),
    potBreak: chunk("part-pot-01.img", () => hsv(0.06, 0.84, rnd(0.73, 0.77))),
    potatoBreak: chunk("part-pumpkin-01.img", () => hsv(0.075, 0.43, rnd(0.48, 0.5))),
    pumpkinBreak: chunk("part-pumpkin-01.img", () => hsv(0.08, 1, rnd(0.95, 0.97))),
    squashBreak: chunk("part-pumpkin-01.img", () => hsv(0.31, 0.86, rnd(0.35, 0.36))),
    tomatoBreak_01: chunk("part-pumpkin-01.img", () => hsv(0, rnd(0.43, 0.64), 0.7)),
    tomatoBreak_02: chunk("part-pumpkin-01.img", () => hsv(0.26, rnd(0.53, 0.63), 0.55)),
    redBreak: chunk("part-spark-02.img", () => hsv(0.98, 1, rnd(0.52, 0.54))),
    rockBreak: chunk("map-stone-01.img", () => hsv(0, 0, rnd(0.5, 0.75))),
    rockEyeBreak: chunk("map-stone-01.img", 0x292421, {
        drag: [4, 12],
        scaleStart: [0.05, 0.1],
        scaleEnd: [0.03, 0.06],
    }),
    toiletBreak: chunk("part-spark-02.img", porcelainColor),
    toiletMetalBreak: chunk("part-spark-02.img", metalColor, { drag: [4, 5] }),
    // survev-only: the Reserve's gold toilet (survev particles.ts:1632)
    toiletGoldBreak: chunk("part-spark-02.img", () => hsv(0.14, rnd(0.72, 0.86), rnd(0.71, 0.85)), { drag: [4, 5] }),
    windowBreak: glass(0x80d9ff),
    bottleBrownBreak: glass(0x783808, { scaleStart: [0.03, 0.06] }),
    bottleBlueBreak: glass(0x004c58, { scaleStart: [0.03, 0.06] }),
    bottleWhiteBreak: glass(0xffffff, { scaleStart: [0.03, 0.06], alphaStart: 0.75 }),
    lockerBreak: plate(() => hsv(0.1, 0.23, rnd(0.51, 0.53)), [0.15, 0.2], [0.12, 0.15]),
    depositBoxGreyBreak: plate(() => hsv(0, 0, rnd(0.36, 0.38)), [0.15, 0.25], [0.12, 0.2]),
    depositBoxGoldBreak: {
        ...plate(() => hsv(0.11, 0.84, rnd(0.64, 0.66)), [0.2, 0.35], [0.18, 0.25]),
        drag: [6, 8],
    },
    // survev-only: the Reserve's silver deposit boxes (survev particles.ts:772)
    depositBoxSilverBreak: {
        ...plate(() => hsv(0, 0, rnd(0.68, 0.72)), [0.2, 0.35], [0.18, 0.25]),
        drag: [6, 8],
    },
    turkeyFeathersHit: feathers([0.1, 0.2], [0.08, 0.12]),
    turkeyFeathersDeath: feathers([0.15, 0.25], [0.12, 0.2]),
    airdropCrate01h: crateA("part-airdrop-01h.img"),
    airdropCrate02h: crateB("part-airdrop-02h.img"),
    airdropCrate03: crateA("part-airdrop-03.img"),
    airdropCrate04: crateB("part-airdrop-04.img"),
    classShell01a: crateA("part-class-shell-01a.img"),
    classShell01b: crateB("part-class-shell-01b.img"),
    classShell02a: crateA("part-class-shell-02a.img"),
    classShell02b: crateB("part-class-shell-02b.img"),
    classShell03a: crateA("part-class-shell-03a.img"),
    classShell03b: crateB("part-class-shell-03b.img"),
};
