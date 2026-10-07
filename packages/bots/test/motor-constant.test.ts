// The human motor never turns the cursor at a constant rate (the server's anti-cheat constant-aim detector:
// apps/server/src/anticheat/aim.ts, 30 deltas of 1.5 degrees or more within 0.5 degrees of each other). A bot walking
// past a crate it aims at turned its cursor through the efference copy of its own motion at a perfectly steady rate;
// the copy's gain now wanders once the bearing turns fast (motor/human.ts SELF_COMP_SD). Fed at 100 Hz (the in-process
// controller) and 33 Hz (what a NetworkBot sends). Owner: COMBAT.
import { createRng, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { DIFFICULTIES, DIFFICULTY_PRESETS } from "../src/difficulty.ts";
import { HumanMotor } from "../src/motor/human.ts";

/** The longest run of constant aim deltas while walking past a fixed point the bot aims at. */
function longestRun(difficulty: (typeof DIFFICULTIES)[number], seed: number, every: number): number {
    const r = createRng(seed * 7);
    const motor = new HumanMotor(DIFFICULTY_PRESETS[difficulty], createRng(seed));
    const vel = { x: 9 + r.next() * 3, y: 0 };
    const point = { x: 4 + r.next() * 8, y: 2.5 + r.next() * (every === 3 ? 10 : 4) };
    let self = { x: 0, y: 0 };
    let prev: number | null = null;
    let run = 0;
    let first = 0;
    let longest = 0;
    for (let i = 1; i <= 240; i++) {
        const now = i * 0.01;
        self = v2.add(self, v2.mul(vel, 0.01));
        const rel = v2.sub(point, self);
        const goal = {
            kind: "target" as const,
            key: -1,
            rel,
            vel: { x: 0, y: 0 },
            at: now,
            firstSeen: 0,
            reaction: 0.3,
        };
        motor.update({ dt: 0.01, now, zoom: 28, goal, selfVel: vel, moveDir: { x: 1, y: 0 }, lookAt: null });
        if (i % every !== 0) continue;
        const a = Math.atan2(motor.mouseDir.y, motor.mouseDir.x);
        if (prev !== null && i > 30) {
            let d = ((a - prev) * 180) / Math.PI;
            d -= Math.round(d / 360) * 360;
            if (Math.abs(d) < 1.5) run = 0;
            else if (run > 0 && Math.abs(d - first) <= 0.5) run++;
            else {
                run = 1;
                first = d;
            }
            longest = Math.max(longest, run);
        }
        prev = a;
    }
    return longest;
}

describe("the human motor and the constant-aim detector", () => {
    it("walking past a point it aims at, no preset turns the cursor at a constant rate", () => {
        for (const difficulty of DIFFICULTIES) {
            for (const every of [1, 3]) {
                let worst = 0;
                for (let seed = 1; seed <= 80; seed++) worst = Math.max(worst, longestRun(difficulty, seed, every));
                expect(worst, `${difficulty} every ${every}`).toBeLessThan(30);
            }
        }
    });
});
