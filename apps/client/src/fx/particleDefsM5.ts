// M5 particle and emitter definitions: explosion bursts and impacts, water ripples, the pin and lever of a thrown
// grenade, heal/boost effects (every loadout variant of the 0.8.82 client, M9), chimney smoke, bathhouse steam, bunker
// bubbles and the roof debris of collapsing buildings. Values are the original client's particle data (survev
// client/src/objects/particles.ts ParticleDefs and EmitterDefs, checked against the 0.8.82 bundle), ported as data.
import { hsv, type ParticleDef, type Range } from "./particleDefs.ts";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PI = Math.PI;

/** an expanding explosion flash (survev explosionBurst & co: scale 1 -> 4, fades over the last quarter) */
function burst(image: string, color: number | (() => number)): ParticleDef {
    return {
        image: [image],
        life: 0.5,
        drag: 0,
        rotVel: 0,
        scaleStart: 1,
        scaleEnd: 4,
        alphaLerp: [0.75, 1],
        color,
    };
}

/** snowball / potato pieces thrown off an impact */
function impact(image: string, color: number | (() => number)): ParticleDef {
    return {
        image: [image],
        life: [0.5, 1],
        drag: 0,
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: [0.13, 0.23],
        scaleEnd: [0.07, 0.14],
        alphaLerp: [0.9, 1],
        color,
    };
}

/** roof panels flying off a collapsing ceiling (survev shackBreak & co) */
function roofBreak(color: number | (() => number), opts: Partial<ParticleDef> = {}): ParticleDef {
    return {
        image: ["part-panel-01.img"],
        life: [0.5, 1.5],
        drag: [1, 5],
        rotVel: [0, PI * 3],
        scaleStart: [0.25, 0.55],
        scaleEnd: [0.08, 0.18],
        alphaLerp: [0.9, 1],
        color,
        ...opts,
    };
}

/** heal / boost effect particles: fade in over the first 5 %, out over the last 30 % */
function effect(image: string, color: () => number, rotVel: Range, drag: number, start: Range, end: Range) {
    return {
        image: [image],
        life: [0.75, 1],
        drag,
        rotVel,
        scaleStart: start,
        scaleEnd: end,
        alphaLerp: [0.7, 1],
        alphaIn: { start: 0, end: 1, lerp: [0, 0.05] },
        color,
        ignoreValueAdjust: true,
    } satisfies ParticleDef;
}

const healColor = () => hsv(0, 1, rnd(0.7, 1));
const boostColor = () => hsv(0.3, 1, rnd(0.7, 1));

export const PARTICLE_DEFS_M5: Readonly<Record<string, ParticleDef>> = {
    explosionBurst: burst("part-frag-burst-01.img", () => hsv(0.065, 1, rnd(0.98, 0.99))),
    explosionMIRV: burst("part-frag-burst-01.img", () => hsv(0, 1, rnd(0.82, 0.84))),
    explosionUSAS: burst("part-frag-burst-01.img", () => hsv(0.08, 1, rnd(0.98, 0.99))),
    explosionRounds: burst("part-frag-burst-03.img", () => hsv(0.08, 0.7, rnd(0.75, 0.8))),
    explosionBomb: burst("part-frag-burst-02.img", 0xffffff),
    explosionPotato: burst("part-frag-burst-01.img", 0xad661a),
    explosionPotatoSMG: burst("part-frag-burst-01.img", 0xc4a80a),
    explosionSmoke: {
        image: ["part-smoke-01.img"],
        life: [2, 3],
        drag: 0,
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: [0.07, 0.12],
        scaleEnd: [0.05, 0.1],
        alphaLerp: [0.9, 1],
        color: () => hsv(0, 0, rnd(0.9, 0.95)),
    },
    snowball_impact: impact("part-snow-01.img", () => hsv(0, 0, rnd(0.9, 0.95))),
    potato_impact: impact("part-potato-01.img", () => hsv(0, 0, rnd(0.9, 0.95))),
    potato_smg_impact: impact("part-potato-01.img", 0xffe585),
    waterRipple: {
        image: ["player-ripple-01.img"],
        zOrd: 10,
        life: 1.75,
        drag: 0,
        rotVel: 0,
        scaleStart: 0.15,
        scaleEnd: 0.15,
        scaleExp: 0.5,
        alphaLerp: [0, 1],
        alphaExp: -1,
        color: 0xb3f0ff,
    },
    fragPin: {
        image: ["part-frag-pin-01.img"],
        life: 0.5,
        drag: [0.9, 1],
        rotVel: 0,
        scaleStart: 0.18,
        scaleEnd: 0.14,
        alphaLerp: [0.5, 1],
        color: 0xffffff,
    },
    fragLever: {
        image: ["part-frag-lever-01.img"],
        life: 0.5,
        drag: [0.9, 1],
        rotVel: PI * 9,
        scaleStart: 0.18,
        scaleEnd: 0.14,
        alphaLerp: [0.5, 1],
        color: 0xffffff,
    },
    heal_basic: effect("part-heal-basic.img", healColor, 0, 0.25, [0.1, 0.12], [0.05, 0.07]),
    heal_heart: effect("part-heal-heart.img", healColor, 0, 0.25, [0.1, 0.12], [0.05, 0.07]),
    heal_moon: effect("part-heal-moon.img", healColor, [PI * 0.25, PI * 0.5], 0.25, [0.1, 0.12], [0.05, 0.07]),
    heal_tomoe: effect("part-heal-tomoe.img", healColor, [PI * 0.5, PI], 0.25, [0.1, 0.12], [0.05, 0.07]),
    boost_basic: effect("part-boost-basic.img", boostColor, [PI * 0.25, PI * 0.5], 0, [0.12, 0.14], [0.06, 0.08]),
    boost_star: effect("part-boost-star.img", boostColor, [PI * 0.25, PI * 0.5], 0, [0.12, 0.14], [0.06, 0.08]),
    boost_naturalize: effect(
        "part-boost-naturalize.img",
        boostColor,
        [PI * 0.35, PI * 0.7],
        0,
        [0.12, 0.14],
        [0.06, 0.08],
    ),
    boost_shuriken: effect("part-boost-shuriken.img", boostColor, [PI, PI * 2], 0, [0.12, 0.14], [0.06, 0.08]),
    // purple crosses around a downed player being revived (0.8.82 updateActionEffect: Revive while downed)
    revive_basic: effect("part-heal-basic.img", () => hsv(0.83, 1, rnd(0.7, 1)), 0, 0.25, [0.1, 0.12], [0.05, 0.07]),
    cabinSmoke: {
        image: ["part-smoke-02.img", "part-smoke-03.img"],
        life: [3, 3.25],
        drag: [0.2, 0.22],
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: [0.2, 0.25],
        scaleEnd: [0.6, 0.65],
        alphaStart: 0.7,
        alphaLerp: [0.9, 1],
        alphaIn: { start: 0, end: 0.7, lerp: [0, 0.1] },
        color: () => hsv(0, 0, rnd(0.69, 0.695)),
    },
    bathhouseSteam: {
        image: ["part-smoke-02.img", "part-smoke-03.img"],
        life: [10, 12],
        drag: [0.04, 0.06],
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: [0.2, 0.25],
        scaleEnd: [0.9, 0.95],
        alphaStart: 0.5,
        alphaLerp: [0.9, 1],
        alphaIn: { start: 0, end: 0.5, lerp: [0, 0.1] },
        color: () => hsv(0, 0, rnd(0.99, 0.995)),
    },
    bunkerBubbles: {
        image: ["player-ripple-01.img"],
        zOrd: 10,
        life: [2.25, 2.5],
        drag: [1.85, 2.15],
        rotVel: [PI * 0.25, PI * 0.5],
        scaleStart: [0.2, 0.25],
        scaleEnd: [0.65, 0.7],
        alphaStart: 0.25,
        alphaLerp: [0.9, 1],
        color: () => hsv(0, 0, rnd(0.95, 1)),
    },
    archwayBreak: roofBreak(() => hsv(0.06, 0.84, rnd(0.46, 0.48)), {
        scaleStart: [0.2, 0.35],
        scaleEnd: [0.08, 0.12],
    }),
    greenhouseBreak: roofBreak(0x80d9ff, {
        image: ["part-spark-02.img", "part-plate-01.img", "part-panel-01.img"],
        rotVel: [PI, PI * 6],
        alphaStart: 0.8,
        alphaLerp: [0.75, 1],
    }),
    hutBreak: roofBreak(() => hsv(0.1, 0.81, rnd(0.78, 0.82))),
    outhouseBreak: roofBreak(() => hsv(0.08, 0.79, rnd(0.52, 0.54))),
    shackBreak: roofBreak(() => hsv(0.1, 0.24, rnd(0.38, 0.41))),
    shackGreenBreak: roofBreak(0x577066),
    teahouseBreak: roofBreak(() => hsv(0.6, 0.31, rnd(0.42, 0.45))),
    teapavilionBreak: roofBreak(() => hsv(0, 0.8, rnd(0.6, 0.62))),
};

/** A continuous particle source (survev EmitterDefs). `rate` is the delay between spawns in seconds. */
export interface EmitterDef {
    particle: string;
    rate: Range;
    /** spawn radius around the emitter (world units, times the emitter scale) */
    radius: number;
    speed: Range;
    /** spread of the spawn direction around the emitter direction (radians) */
    angle: number;
    rot?: Range;
    maxCount?: number;
    zOrd?: number;
    /** the delay eases from `rate` towards `maxRate` over `maxElapsed` seconds (easeInExpo; heavy snowfall) */
    maxRate?: Range;
    maxElapsed?: number;
}

/** a heal / boost effect emitter around a player: 1.5 units wide, rising at 1-1.5 units/s */
function effectEmitter(particle: string, rate: Range, rot: Range): EmitterDef {
    return { particle, rate, radius: 1.5, speed: [1, 1.5], angle: 0, rot };
}

export const EMITTER_DEFS: Readonly<Record<string, EmitterDef>> = {
    smoke_barrel: {
        particle: "explosionSmoke",
        rate: [0.2, 0.3],
        radius: 0,
        speed: [2, 3],
        angle: PI * 0.1,
        rot: [0, PI * 2],
    },
    // speeds are in the chimney sprite's local pixels in the original (parentToCeiling); the occupied emitter
    // converts them to world units with the ceiling image scale
    cabin_smoke_parent: {
        particle: "cabinSmoke",
        rate: [0.72, 0.83],
        radius: 0,
        speed: [64, 96],
        angle: PI * 0.1,
        rot: [0, PI * 2],
    },
    bathhouse_steam: {
        particle: "bathhouseSteam",
        rate: [2, 3],
        radius: 1,
        speed: [1.5, 2],
        angle: PI * 0.1,
    },
    bunker_bubbles_01: {
        particle: "bunkerBubbles",
        rate: [0.3, 0.325],
        radius: 0,
        speed: [1.6, 1.8],
        angle: PI * -2.2,
        rot: [0, PI * 2],
    },
    bunker_bubbles_02: {
        particle: "bunkerBubbles",
        rate: [0.4, 0.425],
        radius: 0,
        speed: [1.6, 1.8],
        angle: PI * -2.2,
        rot: [0, PI * 2],
    },
    heal_basic: effectEmitter("heal_basic", [0.3, 0.35], 0),
    heal_heart: effectEmitter("heal_heart", [0.3, 0.35], 0),
    heal_moon: effectEmitter("heal_moon", [0.3, 0.35], 0),
    heal_tomoe: effectEmitter("heal_tomoe", [0.3, 0.35], 0),
    boost_basic: effectEmitter("boost_basic", [0.3, 0.35], [0, PI * 2]),
    boost_star: effectEmitter("boost_star", [0.3, 0.35], [0, PI * 2]),
    boost_naturalize: effectEmitter("boost_naturalize", [0.3, 0.35], [0, PI * 2]),
    boost_shuriken: effectEmitter("boost_shuriken", [0.3, 0.35], [0, PI * 2]),
    revive_basic: effectEmitter("revive_basic", [0.5, 0.55], 0),
};
