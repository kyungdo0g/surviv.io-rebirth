// Human movement keys (motor/keys.ts): 8-way keys with hysteresis and minimum holds, quick reversals only in fights,
// commitment against a flip-flopping heading, sliding round a blocking obstacle, and the path carrot that makes 8-way
// walking converge on a diagonal leg (zig-zagging like a person tapping two keys) without spamming key changes.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { dirOf } from "../src/geom.ts";
import { KeyStick, octantDir, octantFree, PathCarrot } from "../src/motor/keys.ts";

const DEG = Math.PI / 180;
const TICK = 0.01;

/** Drives a stick at 100 Hz with a heading function; returns the times of its key changes. */
function changes(stick: KeyStick, ticks: number, heading: (t: number) => Vec2 | null, fight = false): number[] {
    const out: number[] = [];
    let last = stick.octant;
    for (let i = 1; i <= ticks; i++) {
        const t = i * TICK;
        const o = stick.update(heading(t), t, fight);
        if (o !== last) out.push(t);
        last = o;
    }
    return out;
}

describe("human movement keys", () => {
    it("keeps an octant until the heading is 10 degrees past its edge", () => {
        const stick = new KeyStick(createRng(1));
        expect(stick.update(dirOf(0), 0)).toBe(0);
        // 22.5 degrees is the edge between right and up-right: 30 stays, 33 goes (after the minimum hold)
        expect(stick.update(dirOf(30 * DEG), 1)).toBe(0);
        expect(stick.update(dirOf(33 * DEG), 2)).toBe(1);
        expect(stick.update(dirOf(14 * DEG), 3)).toBe(1);
        expect(stick.update(dirOf(11 * DEG), 4)).toBe(0);
        expect(stick.update(null, 5)).toBe(-1);
    });

    it("holds every key state at least 80 ms however fast the heading changes", () => {
        const stick = new KeyStick(createRng(2));
        // the wanted heading jumps between right and up every tick
        const times = changes(stick, 300, (t) => dirOf(Math.round(t / TICK) % 2 ? 0 : 90 * DEG));
        expect(times.length).toBeGreaterThan(5);
        for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(0.08 - 1e-9);
    });

    it("reverses within ~100 ms in a fight, but not for a heading that flips every decision", () => {
        // left-right every 90 ms: a strafe flip in a fight is followed, a dithering brain outside fights is not
        const flip = (t: number) => dirOf(Math.floor(t / 0.09) % 2 ? Math.PI : 0);
        const fight = changes(new KeyStick(createRng(3)), 200, flip, true);
        expect(fight.length).toBeGreaterThanOrEqual(15);
        for (let i = 1; i < fight.length; i++) expect(fight[i] - fight[i - 1]).toBeGreaterThanOrEqual(0.07 - 1e-9);
        const walk = changes(new KeyStick(createRng(3)), 200, flip, false);
        expect(walk.length).toBeLessThanOrEqual(1);
        // a reversal that is meant (kept for half a second) still happens
        const meant = changes(new KeyStick(createRng(4)), 200, (t) => dirOf(t < 1 ? 0 : Math.PI));
        expect(meant.length).toBe(2);
        expect(meant[1] - 1).toBeLessThan(0.31);
    });

    it("slides round an obstacle it presses into", () => {
        const stick = new KeyStick(createRng(5));
        const pos = { x: 0, y: 0 };
        // a wall just above the player (radius 1): up is blocked, sliding left or right is not
        const wall = [{ type: 1 as const, min: { x: -10, y: 1 }, max: { x: 10, y: 3 } }];
        expect(octantFree(pos, 2, wall)).toBe(false);
        expect(octantFree(pos, 0, wall)).toBe(true);
        const free = (o: number) => octantFree(pos, o, wall);
        expect(stick.update(dirOf(90 * DEG), 0, false, free)).toBe(2);
        // the wanted heading leans left of up: after the quick hold (70-120 ms) the stick slides left along the wall
        expect(stick.update(dirOf(100 * DEG), 0.125, false, free)).toBe(4);
    });

    it("follows a long diagonal leg by zig-zagging two keys, close to the line, without key spam", () => {
        for (const angle of [30, 60, 15, 160]) {
            const stick = new KeyStick(createRng(angle));
            const carrot = new PathCarrot();
            const start = { x: 0, y: 0 };
            const wp = v2.mul(dirOf(angle * DEG), 40);
            const u = v2.normalize(wp);
            let pos = v2.copy(start);
            let maxOff = 0;
            let arrived = -1;
            const times: number[] = [];
            let last = -1;
            for (let i = 1; i <= 600 && arrived < 0; i++) {
                const t = i * TICK;
                // like the follower: straight at the waypoint, seen at snapshot rate
                const dir = v2.normalize(v2.sub(wp, pos));
                const o = stick.update(carrot.heading(pos, [wp], dir), t);
                if (o !== last && last >= 0) times.push(t);
                last = o;
                pos = v2.add(pos, v2.mul(octantDir(o), 12 * TICK));
                maxOff = Math.max(maxOff, Math.abs(v2.det(u, pos)));
                if (v2.distance(pos, wp) < 1) arrived = t;
            }
            // 40 units at 12 u/s along 8 directions: a little over 3.3 s
            expect(arrived).toBeGreaterThan(3.3);
            expect(arrived).toBeLessThan(4);
            expect(maxOff).toBeLessThan(1.5);
            // a diagonal off the octants alternates two keys; never more than ~12 changes a second
            if (angle % 45 !== 0) expect(times.length).toBeGreaterThan(2);
            expect(times.length / arrived).toBeLessThan(12.5);
        }
    });
});
