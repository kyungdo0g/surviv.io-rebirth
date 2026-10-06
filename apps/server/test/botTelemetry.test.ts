// Bots with the human cursor motor model (packages/bots motor/human.ts) must look human to the server's anti-cheat
// telemetry (src/anticheat): whole bot matches per difficulty, every bot's inputs fed to PlayerTelemetry at their
// 100 Hz tick rate and again downsampled to 33 Hz (what a NetworkBot sends), shots and hits from the simulation. No
// bot may reach the flag score, snap onto its targets (snap ratio of opening hits) or turn its aim at a constant rate.
// The test lives here because packages cannot import apps.
import {
    DIFFICULTIES,
    DIFFICULTY_PRESETS,
    type Difficulty,
    type DifficultyParams,
    runMatch,
    scaledGas,
} from "@rebirth/bots";
import type { Bullet, CombatObserver, DamageParams, Game, Player, PlayerInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { MatchTelemetry } from "../src/anticheat/match.ts";
import type { TelemetrySnapshot } from "../src/anticheat/player.ts";
import { DEFAULT_THRESHOLDS } from "../src/anticheat/thresholds.ts";

const BOTS = 20;
/** One tick of the simulation, in telemetry milliseconds. */
const TICK_MS = 10;

function humanPreset(d: Difficulty): DifficultyParams {
    const p = DIFFICULTY_PRESETS[d];
    return { ...p, motor: { ...p.motor, model: "human" } };
}

interface Variant {
    telemetry: MatchTelemetry;
    /** feed every `every`-th input of a bot (1: 100 Hz, 3: ~33 Hz) */
    every: number;
}

/** Runs a bot match with every bot tracked by the telemetry variants; returns their snapshots per variant. */
function telemetryMatch(difficulty: Difficulty, seed: number): TelemetrySnapshot[][] {
    let game: Game | null = null;
    const view = { getPlayer: (id: number) => game?.getPlayer(id) };
    const clock = () => (game?.tick ?? 0) * TICK_MS;
    const variants: Variant[] = [1, 3].map((every) => ({
        every,
        telemetry: new MatchTelemetry(view, {
            gameId: `bots-${difficulty}-${every}`,
            mapName: "main",
            teamMode: 1,
            thresholds: DEFAULT_THRESHOLDS,
            clock,
        }),
    }));
    const observer: CombatObserver = {
        onShotFired: (p: Player, w: string, b: readonly Bullet[]) => {
            for (const v of variants) v.telemetry.onShotFired(p, w, b);
        },
        onBulletHitPlayer: (b: Bullet, t: Player) => {
            for (const v of variants) v.telemetry.onBulletHitPlayer(b, t);
        },
        onPlayerDamaged: (t: Player, params: DamageParams, amount: number, headshot: boolean) => {
            for (const v of variants) v.telemetry.onPlayerDamaged(t, params, amount, headshot);
        },
        onPlayerKilled: (victim: Player, params: DamageParams, credit: Player | undefined) => {
            for (const v of variants) v.telemetry.onPlayerKilled(victim, params, credit);
        },
    };
    const ids: number[] = [];
    const report = runMatch({
        bots: BOTS,
        seed,
        difficulty: humanPreset(difficulty),
        gasStages: scaledGas(4),
        maxTicks: 15000,
        observer,
        onTick: (g, bots) => {
            if (game) return;
            // first tick: track every bot, and see their inputs from now on as the room would (before each step)
            game = g;
            for (const b of bots) {
                ids.push(b.playerId);
                for (const v of variants) v.telemetry.track(b.playerId, `bot${b.playerId}`, "");
            }
            const setInput = g.setInput.bind(g);
            g.setInput = (id: number, input: PlayerInput) => {
                for (const v of variants) if ((g.tick + id) % v.every === 0) v.telemetry.onInput(id, input);
                setInput(id, input);
            };
        },
    });
    expect(report.exceptions).toBe(0);
    return variants.map((v) => ids.map((id) => v.telemetry.snapshot(id) as TelemetrySnapshot));
}

describe("bots under the anti-cheat telemetry (human motor)", () => {
    for (const [i, difficulty] of DIFFICULTIES.entries()) {
        it(`${difficulty}: no bot is flagged, snaps onto targets or aims at a constant rate (100 Hz and 33 Hz)`, () => {
            const [full, down] = telemetryMatch(difficulty, 31 + i);
            // the bots fought: enough ranged opening hits for the snap measure to mean something
            const openingHits = full.reduce((a, s) => a + s.aim.openingHits, 0);
            expect(full.reduce((a, s) => a + s.shots, 0)).toBeGreaterThan(100);
            expect(openingHits).toBeGreaterThan(10);
            for (const s of [...full, ...down]) {
                expect(s.score, `${s.name}: ${JSON.stringify(s.components)}`).toBeLessThan(
                    DEFAULT_THRESHOLDS.flagScore,
                );
                expect(s.aim.snapRatio, `${s.name} snaps`).toBeLessThan(0.3);
                expect(s.aim.constantAimRuns, `${s.name} constant aim`).toBe(0);
            }
            // the downsampled stream really is ~33 Hz
            const msgs =
                full.reduce((a, s) => a + s.input.messages, 0) / down.reduce((a, s) => a + s.input.messages, 0);
            expect(msgs).toBeGreaterThan(2.5);
        }, 240_000);
    }
});
