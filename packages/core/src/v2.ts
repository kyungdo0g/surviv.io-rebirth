import type { Rng } from "./rng.ts";

export interface Vec2 {
    x: number;
    y: number;
}

const NORMALIZE_EPS = 1e-6;

function create(x: number, y: number = x): Vec2 {
    return { x, y };
}

function copy(a: Vec2): Vec2 {
    return { x: a.x, y: a.y };
}

/** Copies `a` into `out` in place (the only mutating helper). */
function set(out: Vec2, a: Vec2): Vec2 {
    out.x = a.x;
    out.y = a.y;
    return out;
}

function add(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

function mul(a: Vec2, s: number): Vec2 {
    return { x: a.x * s, y: a.y * s };
}

function mulElems(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x * b.x, y: a.y * b.y };
}

function div(a: Vec2, s: number): Vec2 {
    return { x: a.x / s, y: a.y / s };
}

function neg(a: Vec2): Vec2 {
    return { x: -a.x, y: -a.y };
}

function lengthSqr(a: Vec2): number {
    return a.x * a.x + a.y * a.y;
}

function length(a: Vec2): number {
    return Math.sqrt(a.x * a.x + a.y * a.y);
}

function distanceSqr(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function distance(a: Vec2, b: Vec2): number {
    return Math.sqrt(distanceSqr(a, b));
}

/** Unit vector in the direction of `a`, or `fallback` when `a` is (near) zero. */
function normalizeSafe(a: Vec2, fallback: Vec2 = { x: 1, y: 0 }): Vec2 {
    const len = length(a);
    return len > NORMALIZE_EPS ? { x: a.x / len, y: a.y / len } : copy(fallback);
}

/** Unit vector in the direction of `a`; (1, 0) for the zero vector. */
function normalize(a: Vec2): Vec2 {
    return normalizeSafe(a);
}

function dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
}

/** 2D cross product (z component of the 3D cross product). */
function det(a: Vec2, b: Vec2): number {
    return a.x * b.y - a.y * b.x;
}

/** `a` rotated 90 degrees counter-clockwise. */
function perp(a: Vec2): Vec2 {
    return { x: -a.y, y: a.x };
}

/** Counter-clockwise rotation by `rad` radians. */
function rotate(a: Vec2, rad: number): Vec2 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

function lerp(t: number, a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function eq(a: Vec2, b: Vec2, eps = 1e-4): boolean {
    return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

/** Component-wise minimum. */
function min(a: Vec2, b: Vec2): Vec2 {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
}

/** Component-wise maximum. */
function max(a: Vec2, b: Vec2): Vec2 {
    return { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
}

function abs(a: Vec2): Vec2 {
    return { x: Math.abs(a.x), y: Math.abs(a.y) };
}

function floor(a: Vec2): Vec2 {
    return { x: Math.floor(a.x), y: Math.floor(a.y) };
}

/** Uniformly distributed unit vector drawn from the given deterministic rng. */
function randomUnit(rng: Pick<Rng, "next">): Vec2 {
    const rad = rng.next() * Math.PI * 2;
    return { x: Math.cos(rad), y: Math.sin(rad) };
}

/** Angle of `a` in radians, measured counter-clockwise from +x, in (-PI, PI]. */
function angle(a: Vec2): number {
    return Math.atan2(a.y, a.x);
}

export const v2 = {
    create,
    copy,
    set,
    add,
    sub,
    mul,
    mulElems,
    div,
    neg,
    length,
    lengthSqr,
    distance,
    distanceSqr,
    normalize,
    normalizeSafe,
    dot,
    det,
    perp,
    rotate,
    lerp,
    eq,
    min,
    max,
    abs,
    floor,
    randomUnit,
    angle,
};
