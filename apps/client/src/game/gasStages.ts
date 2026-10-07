// Shortened red-zone stage table for the sandbox (`&gas=fast`): the original circles (radius fractions and damage
// of GameConfig.gas.stages, docs/research/mechanics/gas.md "Stage table") with every wait and move cut to a few
// seconds, so a whole match of closing circles fits in about a minute. Client-only: passed to the loopback
// simulation through GameInit.gasStages.
import { GameConfig, GasMode, type GasStage } from "@rebirth/defs";

/** [wait, move] seconds per circle (the original: 80/30, 65/25, 50/20, 40/15, 30/10, 25/5, 20/6, 15/15) */
const FAST_DURATIONS: ReadonlyArray<readonly [number, number]> = [
    [8, 5],
    [6, 4],
    [5, 3],
    [4, 3],
    [4, 2],
    [3, 2],
    [3, 2],
    [3, 3],
];

/** The original stage table with the fast durations. */
export function fastGasStages(): GasStage[] {
    const original = GameConfig.gas.stages;
    return original.map((stage, i) => {
        if (stage.mode === GasMode.Inactive || i === 0) return { ...stage };
        const circle = Math.floor((i - 1) / 2);
        const durations = FAST_DURATIONS[Math.min(circle, FAST_DURATIONS.length - 1)];
        return { ...stage, duration: stage.mode === GasMode.Waiting ? durations[0] : durations[1] };
    });
}

/** A red zone that never starts (the building showcase): one inactive stage, no damage. */
export function noGasStages(): GasStage[] {
    return [{ ...GameConfig.gas.stages[0], mode: GasMode.Inactive, duration: 0, rad: 1, damage: 0 }];
}

/** Gas stage table for the `gas` URL parameter: "fast", or undefined for the original table. */
export function gasStagesFor(param: string | null | undefined): GasStage[] | undefined {
    return param === "fast" ? fastGasStages() : undefined;
}
