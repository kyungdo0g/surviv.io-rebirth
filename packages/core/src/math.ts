import type { Vec2 } from "./v2.ts";

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

function lerp(t: number, a: number, b: number): number {
    return a + (b - a) * t;
}

/** Inverse of `lerp`: where `v` lies between `a` and `b`, clamped to [0, 1]. */
function delerp(v: number, a: number, b: number): number {
    return clamp((v - a) / (b - a), 0, 1);
}

/** Maps `v` from [a, b] onto [x, y], clamping to the output range. */
function remap(v: number, a: number, b: number, x: number, y: number): number {
    return lerp(delerp(v, a, b), x, y);
}

function eqAbs(a: number, b: number, eps = 1e-5): boolean {
    return Math.abs(a - b) < eps;
}

/** Relative comparison; falls back to absolute tolerance for magnitudes below 1. */
function eqRel(a: number, b: number, eps = 1e-5): boolean {
    return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

function deg2rad(deg: number): number {
    return (deg * Math.PI) / 180;
}

function rad2deg(rad: number): number {
    return (rad * 180) / Math.PI;
}

/** Floored modulo: the result has the sign of `n` (always >= 0 for positive `n`). */
function fmod(v: number, n: number): number {
    return v - Math.floor(v / n) * n;
}

/** Shortest signed angle from `a` to `b`, in [-PI, PI). */
function angleDiff(a: number, b: number): number {
    return fmod(b - a + Math.PI, TWO_PI) - Math.PI;
}

/** Hermite smoothstep of `v` between edges `a` and `b`. */
function smoothstep(v: number, a: number, b: number): number {
    const t = delerp(v, a, b);
    return t * t * (3 - 2 * t);
}

/** Map orientation (0-3, quarter turns counter-clockwise) to radians. */
function oriToRad(ori: number): number {
    return (ori % 4) * 0.5 * Math.PI;
}

/** Nearest map orientation (0-3) for an angle in radians. */
function radToOri(rad: number): number {
    return Math.floor(fmod(rad + Math.PI * 0.25, TWO_PI) / HALF_PI) % 4;
}

/** Map orientation (0-3) to degrees. */
function oriToAngle(ori: number): number {
    return (ori % 4) * 90;
}

/** Adds `offset`, rotated by `ori` quarter turns counter-clockwise, to `base`. */
function addAdjust(base: Vec2, offset: Vec2, ori: number): Vec2 {
    switch (((ori % 4) + 4) % 4) {
        case 1:
            return { x: base.x - offset.y, y: base.y + offset.x };
        case 2:
            return { x: base.x - offset.x, y: base.y - offset.y };
        case 3:
            return { x: base.x + offset.y, y: base.y - offset.x };
        default:
            return { x: base.x + offset.x, y: base.y + offset.y };
    }
}

export const math = {
    clamp,
    lerp,
    delerp,
    remap,
    eqAbs,
    eqRel,
    deg2rad,
    rad2deg,
    fmod,
    angleDiff,
    smoothstep,
    oriToRad,
    radToOri,
    oriToAngle,
    addAdjust,
};
