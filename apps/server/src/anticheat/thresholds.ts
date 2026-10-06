// Anti-cheat thresholds (M8). Every heuristic of the suspicion score has its knobs here; ANTICHEAT_CONFIG may name a
// JSON file overriding any of them (deep-merged over the defaults, validated with zod) and ANTICHEAT_FLAG_SCORE the
// flag threshold. docs/deploy.md "Anti-cheat" documents what each heuristic measures and why the defaults are what
// they are. The defaults are deliberately conservative: no single heuristic can reach the flag score on its own.
import { readFileSync } from "node:fs";
import { z } from "zod";

/** Weapon groups scored separately: the gun classes of @rebirth/defs gunClasses.ts folded by how they are aimed. */
export type AccuracyGroup = "auto" | "precision" | "shotgun";

export interface AccuracyThresholds {
    /** bullets (pellets for shotguns) fired with the group before its accuracy counts */
    minBullets: number;
    /** accuracy (bullets that hit a player / bullets fired) where the component starts rising from 0 */
    soft: number;
    /** accuracy where the component reaches 1 */
    hard: number;
}

export interface AntiCheatThresholds {
    /** a player is flagged when the score (0-100) reaches this */
    flagScore: number;
    /** a flagged player is flagged again (logged, listed) when its score rose by at least this much */
    reflagDelta: number;
    /** score weight of each heuristic (the score is the weighted sum of components in 0..1, capped at 100) */
    weights: { accuracy: number; snap: number; constantAim: number; inputRate: number; moveSpam: number };
    accuracy: Record<AccuracyGroup, AccuracyThresholds>;
    snap: {
        /** an aim change between two consecutive inputs at least this large (degrees) is a snap */
        angleDeg: number;
        /** the snap must be among this many inputs before the shot */
        windowInputs: number;
        /** ...and at most this long before it (ms) */
        windowMs: number;
        /** both inputs of the snap need the cursor at least this far from the player (world units) */
        minMouseLen: number;
        /** hits closer than this (shot origin to target, world units) are not scored: point-blank swings are normal */
        minTargetDist: number;
        /**
         * a shot fired at least this long after the previous one opens an engagement (ms). Only opening shots are
         * scored: a human acquires a new target over several inputs, an aimbot in one; follow-up shots just track.
         */
        openingGapMs: number;
        /** ranged opening hits needed before the ratio counts */
        minHits: number;
        /** ratio of ranged opening hits preceded by a snap: component 0 at `soft`, 1 at `hard` */
        soft: number;
        hard: number;
    };
    constantAim: {
        /** consecutive aim deltas that stay constant to make a run (a longer run counts once per minRun deltas) */
        minRun: number;
        /** smallest aim delta per input that counts (degrees; a still mouse is not a pattern) */
        minDeltaDeg: number;
        /** largest difference to the run's first delta (degrees; the wire quantizes directions to ~0.11 degrees) */
        toleranceDeg: number;
        /** runs where the component reaches 1 */
        hardRuns: number;
    };
    inputRate: {
        /** Input messages per wall-clock second above which the second counts as a spike (the client sends <= 60) */
        maxPerSecond: number;
        /** spike seconds where the component starts rising (a network stall delivers one burst) */
        soft: number;
        hard: number;
    };
    moveSpam: {
        /** movement key changes per second above which the second counts (humans stay well under 15) */
        maxTogglesPerSecond: number;
        soft: number;
        hard: number;
    };
}

export const DEFAULT_THRESHOLDS: AntiCheatThresholds = {
    flagScore: 60,
    reflagDelta: 10,
    weights: { accuracy: 30, snap: 45, constantAim: 25, inputRate: 15, moveSpam: 10 },
    accuracy: {
        // pistols, SMGs, assault rifles, LMGs: good human players land 30-45 % of their bullets over a match
        auto: { minBullets: 60, soft: 0.55, hard: 0.85 },
        // DMRs and snipers: one bullet per shot, aimed; humans rarely keep 70 % over 15 shots
        precision: { minBullets: 15, soft: 0.8, hard: 0.97 },
        // pellets: point-blank shots land most pellets, so the bar is high
        shotgun: { minBullets: 60, soft: 0.75, hard: 0.95 },
    },
    snap: {
        angleDeg: 45,
        windowInputs: 3,
        windowMs: 120,
        minMouseLen: 2.5,
        minTargetDist: 6,
        openingGapMs: 400,
        minHits: 5,
        soft: 0.3,
        hard: 0.7,
    },
    constantAim: { minRun: 30, minDeltaDeg: 1.5, toleranceDeg: 0.5, hardRuns: 3 },
    inputRate: { maxPerSecond: 120, soft: 3, hard: 15 },
    moveSpam: { maxTogglesPerSecond: 20, soft: 3, hard: 15 },
};

const nonNeg = z.number().min(0);
const ratio = z.number().min(0).max(1);
const Accuracy = z.object({ minBullets: nonNeg, soft: ratio, hard: ratio }).partial();
const Window = z.object({ soft: nonNeg, hard: nonNeg });

/** A partial thresholds object (the ANTICHEAT_CONFIG file). */
export const ThresholdOverrides = z
    .object({
        flagScore: z.number().min(1).max(100),
        reflagDelta: nonNeg,
        weights: z
            .object({ accuracy: nonNeg, snap: nonNeg, constantAim: nonNeg, inputRate: nonNeg, moveSpam: nonNeg })
            .partial(),
        accuracy: z.object({ auto: Accuracy, precision: Accuracy, shotgun: Accuracy }).partial(),
        snap: z
            .object({
                angleDeg: nonNeg,
                windowInputs: z.number().int().min(1).max(16),
                windowMs: nonNeg,
                minMouseLen: nonNeg,
                minTargetDist: nonNeg,
                openingGapMs: nonNeg,
                minHits: nonNeg,
                soft: ratio,
                hard: ratio,
            })
            .partial(),
        constantAim: z
            .object({ minRun: z.number().int().min(3), minDeltaDeg: nonNeg, toleranceDeg: nonNeg, hardRuns: nonNeg })
            .partial(),
        inputRate: Window.extend({ maxPerSecond: nonNeg }).partial(),
        moveSpam: Window.extend({ maxTogglesPerSecond: nonNeg }).partial(),
    })
    .partial()
    .strict();
export type ThresholdOverrides = z.infer<typeof ThresholdOverrides>;

/** Defaults with `overrides` deep-merged over them. */
export function mergeThresholds(overrides: ThresholdOverrides = {}): AntiCheatThresholds {
    const d = DEFAULT_THRESHOLDS;
    const acc = overrides.accuracy ?? {};
    return {
        flagScore: overrides.flagScore ?? d.flagScore,
        reflagDelta: overrides.reflagDelta ?? d.reflagDelta,
        weights: { ...d.weights, ...overrides.weights },
        accuracy: {
            auto: { ...d.accuracy.auto, ...acc.auto },
            precision: { ...d.accuracy.precision, ...acc.precision },
            shotgun: { ...d.accuracy.shotgun, ...acc.shotgun },
        },
        snap: { ...d.snap, ...overrides.snap },
        constantAim: { ...d.constantAim, ...overrides.constantAim },
        inputRate: { ...d.inputRate, ...overrides.inputRate },
        moveSpam: { ...d.moveSpam, ...overrides.moveSpam },
    };
}

/** Thresholds from an ANTICHEAT_CONFIG JSON file (throws with the file name on unreadable or invalid content). */
export function loadThresholds(file: string | undefined, flagScore?: number): AntiCheatThresholds {
    let overrides: ThresholdOverrides = {};
    if (file) {
        let raw: unknown;
        try {
            raw = JSON.parse(readFileSync(file, "utf8"));
        } catch (err) {
            throw new Error(`ANTICHEAT_CONFIG ${file}: ${(err as Error).message}`);
        }
        const parsed = ThresholdOverrides.safeParse(raw);
        if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
            throw new Error(`ANTICHEAT_CONFIG ${file}: ${issues}`);
        }
        overrides = parsed.data;
    }
    if (flagScore !== undefined) overrides = { ...overrides, flagScore };
    return mergeThresholds(overrides);
}
