// Particle definitions used by M2 effects: shell casings per ammo type, blood splats and the bullet-hit chips named
// by obstacle defs (`hitParticle`). Values are the original client's particle data (survev
// client/src/objects/particles.ts ParticleDefs, same numbers as the 0.8.82 bundle), ported as data.

/** [min, max] picked uniformly, or a constant */
export type Range = number | readonly [number, number];

export interface ParticleDef {
    image: readonly string[];
    life: Range;
    drag: Range;
    rotVel: Range;
    scaleStart: Range;
    scaleEnd: Range;
    /** alpha goes from alphaStart to 0 over this part of the life (0..1) */
    alphaLerp: readonly [number, number];
    alphaStart?: number;
    /** a tint, or a function picking one per particle */
    color: number | (() => number);
    zOrd?: number;
}

export function pick(r: Range): number {
    return typeof r === "number" ? r : r[0] + Math.random() * (r[1] - r[0]);
}

/** HSV (all 0..1) to a 0xRRGGBB tint (survev util.hsvToRgb + rgbToInt). */
export function hsv(h: number, s: number, v: number): number {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const rgb = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q],
    ][((i % 6) + 6) % 6];
    return (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PI = Math.PI;

function shell(image: string, life: Range, drag: Range, rotVel: number, start: number, end: number, alpha: number) {
    return {
        image: [image],
        life,
        drag,
        rotVel: [rotVel, rotVel],
        scaleStart: start,
        scaleEnd: end,
        alphaLerp: [alpha, 1],
        color: () => hsv(0, 0, rnd(0.9, 0.95)),
    } satisfies ParticleDef;
}

/** small debris knocked off an obstacle by a bullet or melee hit */
function chip(image: string, color: number | (() => number), opts: Partial<ParticleDef> = {}): ParticleDef {
    return {
        image: [image],
        life: 0.5,
        drag: [1, 10],
        rotVel: 0,
        scaleStart: [0.04, 0.08],
        scaleEnd: [0.01, 0.02],
        alphaLerp: [0.95, 1],
        color,
        ...opts,
    };
}

/** debris that tumbles (wood chips, leaves) */
const tumbling = { life: [0.5, 1], drag: [1, 5], rotVel: [PI * 3, PI * 3], alphaLerp: [0.9, 1] } as const;
const shard = { drag: [1, 5], rotVel: [PI, PI * 6] } as const;

export const PARTICLE_DEFS: Readonly<Record<string, ParticleDef>> = {
    "9mm": shell("part-shell-01.img", [0.5, 0.75], [3, 4], PI * 3, 0.0625, 0.0325, 0.95),
    "762mm": shell("part-shell-02.img", [0.75, 1], [1.5, 2.5], PI * 2.5, 0.075, 0.045, 0.925),
    "556mm": shell("part-shell-04.img", [0.75, 1], [1.5, 2.5], PI * 2.5, 0.075, 0.045, 0.925),
    "12gauge": shell("part-shell-03.img", [0.5, 0.75], [1, 2], PI * 3, 0.1, 0.05, 0.95),
    "50AE": shell("part-shell-01.img", [0.5, 0.75], [3, 4], PI * 3, 0.0625, 0.0325, 0.95),
    "308sub": shell("part-shell-05.img", [0.5, 0.75], [3, 4], PI * 3, 0.0625, 0.0325, 0.95),
    flare: shell("part-shell-03.img", [0.5, 0.75], [1, 2], PI * 3, 0.1, 0.05, 0.95),
    "45acp": shell("part-shell-01.img", [0.5, 0.75], [3, 4], PI * 3, 0.07, 0.04, 0.95),
    bloodSplat: {
        image: ["part-splat-01.img", "part-splat-02.img", "part-splat-03.img"],
        life: 0.5,
        drag: 1,
        rotVel: 0,
        scaleStart: 0.04,
        scaleEnd: [0.15, 0.2],
        alphaLerp: [0.75, 1],
        // the original passes 0xff0000 as the hue, which hsvToRgb folds to pure red
        color: () => hsv(0, 1, rnd(0.45, 0.8)),
    },
    barrelChip: chip("part-spark-02.img", () => hsv(0.01, 0.02, rnd(0.38, 0.41))),
    woodChip: chip("part-woodchip-01.img", () => hsv(0.05, 1, rnd(0.35, 0.45)), tumbling),
    outhouseChip: chip("part-woodchip-01.img", () => hsv(0.08, 0.57, rnd(0.4, 0.46)), tumbling),
    blackChip: chip("part-woodchip-01.img", () => hsv(0, 0.08, rnd(0.16, 0.18)), tumbling),
    tanChip: chip("part-woodchip-01.img", () => hsv(0.1, 0.35, rnd(0.48, 0.52)), tumbling),
    ltgreenChip: chip("part-woodchip-01.img", () => hsv(0.2, 0.42, rnd(0.38, 0.42)), tumbling),
    leaf: chip("part-leaf-01.img", () => hsv(0.29, 1, rnd(0.5, 0.75)), tumbling),
    leafPrickly: chip("part-leaf-01sv.img", () => hsv(0, 0, rnd(0.8, 0.85)), tumbling),
    leafRiver: chip("part-leaf-02.img", () => hsv(0, 0, rnd(0.5, 0.75)), tumbling),
    clothHit: chip("part-cloth-01.img", () => hsv(0, 0, rnd(0.95, 1))),
    glassChip: chip("part-spark-02.img", 0x80d9ff, shard),
    bottleBrownChip: chip("part-spark-02.img", 0x783808, { ...shard, scaleStart: [0.02, 0.04] }),
    bottleBlueChip: chip("part-spark-02.img", 0x004c58, { ...shard, scaleStart: [0.02, 0.04] }),
    bottleWhiteChip: chip("part-spark-02.img", 0xffffff, { ...shard, scaleStart: [0.02, 0.04], alphaStart: 0.75 }),
    greenChip: chip("part-spark-02.img", () => hsv(0.4, 0.18, rnd(0.5, 0.62))),
    goldChip: chip("part-spark-02.img", () => hsv(0.11, 0.84, rnd(0.88, 0.9))),
    redChip: chip("part-spark-02.img", () => hsv(0.98, 1, rnd(0.52, 0.54))),
    potChip: chip("part-spark-02.img", () => hsv(0.06, 0.84, rnd(0.73, 0.77))),
    potatoChip: chip("part-spark-02.img", () => hsv(0.075, 0.43, rnd(0.48, 0.5))),
    pumpkinChip: chip("part-spark-02.img", () => hsv(0.07, 1, rnd(0.98, 1))),
    squashChip: chip("part-spark-02.img", () => hsv(0.31, 0.86, rnd(0.35, 0.36))),
    rockChip: chip("map-stone-01.img", () => hsv(0, 0, rnd(0.5, 0.75))),
    rockEyeChip: chip("map-stone-01.img", 0x292421, { scaleStart: [0.03, 0.06] }),
    whiteChip: chip("part-spark-02.img", () => hsv(0.97, 0, rnd(0.95, 0.97))),
    blueChip: chip("part-spark-02.img", () => hsv(0.64, 1, rnd(0.83, 0.85))),
    brickChip: chip("part-spark-02.img", () => hsv(0, 0.71, rnd(0.32, 0.34))),
    tomatoChip_01: chip("part-spark-02.img", () => hsv(0, rnd(0.43, 0.64), 0.7)),
    tomatoChip_02: chip("part-spark-02.img", () => hsv(0.26, rnd(0.53, 0.63), 0.55)),
    pinkChip: chip("part-spark-02.img", () => hsv(0, 0.52, rnd(0.98, 1)), tumbling),
    ltblueChip: chip("part-spark-02.img", () => hsv(0.5, 0.65, rnd(0.98, 1)), tumbling),
    yellowChip: chip("part-spark-02.img", () => hsv(0.16, 0.73, rnd(0.98, 1)), tumbling),
};
