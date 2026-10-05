import { describe, expect, it } from "vitest";
import { type Collider, ColliderType, collider, createRng, math, type Rng, type Vec2, v2 } from "../src/index.ts";

const circle = (x: number, y: number, rad: number) => collider.createCircle(v2.create(x, y), rad);
const aabb = (x0: number, y0: number, x1: number, y1: number) =>
    collider.createAabb(v2.create(x0, y0), v2.create(x1, y1));

function expectVec(actual: Vec2, expected: Vec2, digits = 9): void {
    expect(actual.x).toBeCloseTo(expected.x, digits);
    expect(actual.y).toBeCloseTo(expected.y, digits);
}

function randomCollider(rng: Rng): Collider {
    if (rng.bool()) {
        return circle(rng.range(0, 20), rng.range(0, 20), rng.range(0.5, 5));
    }
    const center = v2.create(rng.range(0, 20), rng.range(0, 20));
    return collider.createAabbExtents(center, v2.create(rng.range(0.5, 5), rng.range(0.5, 5)));
}

function translate(col: Collider, offset: Vec2): Collider {
    return collider.transform(col, offset, 0, 1);
}

describe("collider construction", () => {
    it("uses the original data layout", () => {
        expect(circle(1, 2, 3)).toEqual({ type: 0, pos: { x: 1, y: 2 }, rad: 3 });
        expect(aabb(0, 1, 2, 3)).toEqual({ type: 1, min: { x: 0, y: 1 }, max: { x: 2, y: 3 } });
        expect(ColliderType).toEqual({ Circle: 0, Aabb: 1 });
        expect(collider.createAabbExtents(v2.create(5, 5), v2.create(1, 2))).toEqual(aabb(4, 3, 6, 7));
    });

    it("copies deeply", () => {
        const a = aabb(0, 0, 1, 1);
        const b = collider.copy(a);
        expect(b).toEqual(a);
        b.min.x = 5;
        expect(a.min.x).toBe(0);
    });

    it("converts to and bounds with aabbs", () => {
        expect(collider.toAabb(circle(5, 5, 2))).toEqual(aabb(3, 3, 7, 7));
        expect(collider.boundingAabb([circle(0, 0, 1), aabb(2, -3, 4, 0)])).toEqual(aabb(-1, -3, 4, 1));
        expect(() => collider.boundingAabb([])).toThrow(RangeError);
    });

    it("tests point containment inclusively", () => {
        expect(collider.contains(circle(0, 0, 1), v2.create(1, 0))).toBe(true);
        expect(collider.contains(circle(0, 0, 1), v2.create(0.8, 0.8))).toBe(false);
        expect(collider.contains(aabb(0, 0, 2, 2), v2.create(2, 1))).toBe(true);
        expect(collider.contains(aabb(0, 0, 2, 2), v2.create(2.1, 1))).toBe(false);
    });

    it("checks aabb overlap including touching edges", () => {
        expect(collider.aabbOverlap(aabb(0, 0, 2, 2), aabb(1, 1, 3, 3))).toBe(true);
        expect(collider.aabbOverlap(aabb(0, 0, 2, 2), aabb(2, 0, 3, 2))).toBe(true);
        expect(collider.aabbOverlap(aabb(0, 0, 2, 2), aabb(2.01, 0, 3, 2))).toBe(false);
    });
});

describe("collider.transform", () => {
    it("swaps aabb extents for ori 1", () => {
        const res = collider.transform(aabb(-1, -2, 1, 2), v2.create(10, 10), math.oriToRad(1), 1);
        expectVec(res.min, v2.create(8, 9));
        expectVec(res.max, v2.create(12, 11));
    });

    it("rotates an off-centre aabb about the origin, after scaling", () => {
        const res = collider.transform(aabb(0, 0, 4, 2), v2.create(1, 1), math.oriToRad(1), 2);
        expectVec(res.min, v2.create(-3, 1));
        expectVec(res.max, v2.create(1, 9));
        const flipped = collider.transform(aabb(0, 0, 4, 2), v2.create(0, 0), math.oriToRad(2), 1);
        expectVec(flipped.min, v2.create(-4, -2));
        expectVec(flipped.max, v2.create(0, 0));
    });

    it("rotates and scales circles", () => {
        const res = collider.transform(circle(1, 0, 1), v2.create(5, 5), Math.PI / 2, 2);
        expect(res.type).toBe(ColliderType.Circle);
        expectVec(res.pos, v2.create(5, 7));
        expect(res.rad).toBe(2);
    });
});

describe("collider.intersect", () => {
    const cases: { name: string; a: Collider; b: Collider; dir: Vec2 | null; pen?: number }[] = [
        { name: "circle-circle overlap", a: circle(0, 0, 1), b: circle(1.5, 0, 1), dir: v2.create(-1, 0), pen: 0.5 },
        { name: "circle-circle apart", a: circle(0, 0, 1), b: circle(3, 0, 1), dir: null },
        { name: "circle-circle touching", a: circle(0, 0, 1), b: circle(0, 2, 1), dir: null },
        { name: "circle-circle coincident", a: circle(2, 2, 1), b: circle(2, 2, 1), dir: v2.create(1, 0), pen: 2 },
        {
            name: "circle inside aabb, nearest bottom face",
            a: circle(3, 1, 0.5),
            b: aabb(0, 0, 10, 4),
            dir: v2.create(0, -1),
            pen: 1.5,
        },
        {
            name: "circle inside aabb, nearest right face",
            a: circle(9, 2, 0.5),
            b: aabb(0, 0, 10, 4),
            dir: v2.create(1, 0),
            pen: 1.5,
        },
        {
            name: "circle overlapping aabb corner",
            a: circle(11, 5, 2),
            b: aabb(0, 0, 10, 4),
            dir: v2.create(Math.SQRT1_2, Math.SQRT1_2),
            pen: 2 - Math.SQRT2,
        },
        {
            name: "circle overlapping aabb face",
            a: circle(5, -0.5, 1),
            b: aabb(0, 0, 10, 4),
            dir: v2.create(0, -1),
            pen: 0.5,
        },
        { name: "circle outside aabb", a: circle(12, 5, 1), b: aabb(0, 0, 10, 4), dir: null },
        {
            name: "aabb vs circle pushes the aabb away",
            a: aabb(0, 0, 10, 4),
            b: circle(5, -0.5, 1),
            dir: v2.create(0, 1),
            pen: 0.5,
        },
        {
            name: "aabb-aabb least penetration on x",
            a: aabb(0, 0, 4, 4),
            b: aabb(3, 1, 10, 3),
            dir: v2.create(-1, 0),
            pen: 1,
        },
        {
            name: "aabb-aabb least penetration on y",
            a: aabb(0, 0, 4, 4),
            b: aabb(1, 3.5, 3, 10),
            dir: v2.create(0, -1),
            pen: 0.5,
        },
        { name: "aabb-aabb containment", a: aabb(0, 0, 10, 10), b: aabb(2, 3, 4, 5), dir: v2.create(1, 0), pen: 4 },
        { name: "aabb-aabb apart", a: aabb(0, 0, 1, 1), b: aabb(2, 0, 3, 1), dir: null },
        { name: "aabb-aabb touching", a: aabb(0, 0, 1, 1), b: aabb(1, 0, 2, 1), dir: null },
    ];

    for (const { name, a, b, dir, pen } of cases) {
        it(name, () => {
            const res = collider.intersect(a, b);
            if (dir === null) {
                expect(res).toBeNull();
                return;
            }
            expect(res).not.toBeNull();
            expectVec(res!.dir, dir);
            expect(res!.pen).toBeCloseTo(pen!, 9);
        });
    }

    it("separates the pair when a moves by dir * pen, and pen equals -distance", () => {
        const rng = createRng(1234);
        let hits = 0;
        for (let i = 0; i < 2000; i++) {
            const a = randomCollider(rng);
            const b = randomCollider(rng);
            const res = collider.intersect(a, b);
            const dist = collider.distance(a, b);
            if (!res) {
                expect(dist).toBeGreaterThanOrEqual(-1e-9);
                continue;
            }
            hits++;
            expect(v2.length(res.dir)).toBeCloseTo(1, 9);
            expect(res.pen).toBeGreaterThan(0);
            expect(res.pen).toBeCloseTo(-dist, 9);
            const moved = translate(a, v2.mul(res.dir, res.pen + 1e-6));
            expect(collider.intersect(moved, b)).toBeNull();
        }
        expect(hits).toBeGreaterThan(200);
    });
});

describe("collider.distance", () => {
    it("measures gaps between surfaces", () => {
        expect(collider.distance(circle(0, 0, 1), circle(5, 0, 1))).toBeCloseTo(3);
        expect(collider.distance(aabb(0, 0, 1, 1), aabb(4, 5, 6, 6))).toBeCloseTo(5);
        expect(collider.distance(aabb(0, 0, 1, 1), aabb(3, 0, 4, 1))).toBeCloseTo(2);
        expect(collider.distance(circle(5, 4, 1), aabb(0, 0, 2, 2))).toBeCloseTo(Math.hypot(3, 2) - 1);
        expect(collider.distance(aabb(0, 0, 2, 2), circle(1, 1, 0.5))).toBeCloseTo(-1.5);
    });
});

describe("collider.intersectSegment", () => {
    it("hits a circle at the first crossing with an outward normal", () => {
        const hit = collider.intersectSegment(circle(5, 0, 1), v2.create(0, 0), v2.create(10, 0));
        expect(hit).not.toBeNull();
        expectVec(hit!.point, v2.create(4, 0));
        expectVec(hit!.normal, v2.create(-1, 0));
        expect(hit!.dist).toBeCloseTo(4);

        const back = collider.intersectSegment(circle(5, 0, 1), v2.create(10, 0), v2.create(0, 0));
        expectVec(back!.point, v2.create(6, 0));
        expectVec(back!.normal, v2.create(1, 0));
    });

    it("hits a circle off-centre", () => {
        const hit = collider.intersectSegment(circle(0, 0, 2), v2.create(-5, 1), v2.create(5, 1));
        expectVec(hit!.point, v2.create(-Math.sqrt(3), 1));
        expectVec(hit!.normal, v2.normalize(v2.create(-Math.sqrt(3), 1)));
    });

    it("misses circles that are off the line or out of reach", () => {
        expect(collider.intersectSegment(circle(5, 0, 1), v2.create(0, 2), v2.create(10, 2))).toBeNull();
        expect(collider.intersectSegment(circle(5, 0, 1), v2.create(0, 0), v2.create(3, 0))).toBeNull();
        expect(collider.intersectSegment(circle(5, 0, 1), v2.create(7, 0), v2.create(10, 0))).toBeNull();
    });

    it("hits aabb faces with face normals", () => {
        const box = aabb(2, -1, 4, 1);
        const fromLeft = collider.intersectSegment(box, v2.create(0, 0), v2.create(10, 0));
        expectVec(fromLeft!.point, v2.create(2, 0));
        expectVec(fromLeft!.normal, v2.create(-1, 0));

        const fromAbove = collider.intersectSegment(box, v2.create(3, 5), v2.create(3, -5));
        expectVec(fromAbove!.point, v2.create(3, 1));
        expectVec(fromAbove!.normal, v2.create(0, 1));

        const diagonal = collider.intersectSegment(box, v2.create(0, -2), v2.create(6, 4));
        expectVec(diagonal!.point, v2.create(2, 0));
        expectVec(diagonal!.normal, v2.create(-1, 0));
        expect(diagonal!.dist).toBeCloseTo(Math.hypot(2, 2));
    });

    it("misses aabbs that are off the line, behind, or out of reach", () => {
        const box = aabb(2, -1, 4, 1);
        expect(collider.intersectSegment(box, v2.create(0, 2), v2.create(10, 2))).toBeNull();
        expect(collider.intersectSegment(box, v2.create(0, 0), v2.create(1.5, 0))).toBeNull();
        expect(collider.intersectSegment(box, v2.create(5, 0), v2.create(10, 0))).toBeNull();
        expect(collider.intersectSegment(box, v2.create(0, -4), v2.create(6, 0))).toBeNull();
    });

    it("reports an immediate hit when starting inside", () => {
        for (const col of [circle(0, 0, 2), aabb(-2, -2, 2, 2)]) {
            const hit = collider.intersectSegment(col, v2.create(0.5, 0), v2.create(10, 0));
            expectVec(hit!.point, v2.create(0.5, 0));
            expectVec(hit!.normal, v2.create(-1, 0));
            expect(hit!.dist).toBe(0);
        }
    });

    it("supports unbounded rays", () => {
        const hit = collider.intersectRay(aabb(100, -1, 101, 1), v2.create(0, 0), v2.create(3, 0));
        expectVec(hit!.point, v2.create(100, 0));
        expect(collider.intersectRay(aabb(100, -1, 101, 1), v2.create(0, 0), v2.create(-1, 0))).toBeNull();
        expect(collider.intersectRay(aabb(100, -1, 101, 1), v2.create(0, 0), v2.create(1, 0), 50)).toBeNull();
    });

    it("agrees with point sampling along random segments", () => {
        const rng = createRng(99);
        for (let i = 0; i < 500; i++) {
            const col = randomCollider(rng);
            const a = v2.create(rng.range(-5, 25), rng.range(-5, 25));
            const b = v2.create(rng.range(-5, 25), rng.range(-5, 25));
            const hit = collider.intersectSegment(col, a, b);
            if (!hit) {
                for (let s = 0; s <= 200; s++) {
                    const p = v2.lerp(s / 200, a, b);
                    expect(collider.distance(collider.createCircle(p, 0), col)).toBeGreaterThan(-1e-6);
                }
                continue;
            }
            // Nothing before the reported hit may be inside the collider.
            for (let s = 0; s < 200 && hit.dist > 0; s++) {
                const p = v2.lerp(s / 200, a, hit.point);
                expect(collider.distance(collider.createCircle(p, 0), col)).toBeGreaterThan(-1e-6);
            }
            const surfaceDist = collider.distance(collider.createCircle(hit.point, 0), col);
            if (hit.dist > 0) {
                expect(Math.abs(surfaceDist)).toBeLessThan(1e-6);
                expect(v2.dot(hit.normal, v2.sub(b, a))).toBeLessThanOrEqual(1e-9);
            } else {
                expect(collider.contains(col, a)).toBe(true);
            }
        }
    });
});
