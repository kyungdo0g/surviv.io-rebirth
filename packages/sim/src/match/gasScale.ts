// The gas and the schedules on a map grown by the game's player cap (defs data.ts mapDefForPlayers; docs/research/
// rebirth-deviations.md "Maps follow the player cap"). The gas's radii are fractions of the map size, so on a map s
// times wider every circle would close s times faster in units per second: every stage's duration is stretched by s
// instead, and so are the waits counted from a circle's start (air drops and strikes, unlocks, promotions, the 50v50
// gold drop: Gas.timeScale), which keeps every gas speed and the time per unit of rotation at the design map's.
import { type GasStage, type MapDef, mapWidth } from "@rebirth/defs";
import { TICK_HZ } from "../api.ts";

/**
 * How much the map a game plays on (`playedWidth`, its generation's) is wider than its design map (the map's own def)
 * in the scale variant the game generates (squads play the large one): 1 for a map no wider than the design, so a
 * design-size generation keeps the design gas whatever the cap.
 */
export function gasTimeScale(playedWidth: number, design: MapDef, teamMode: 1 | 2 | 4): number {
    const s = playedWidth / mapWidth(design, teamMode > 2 ? "large" : "small");
    return s > 1 + 1e-9 ? s : 1;
}

/**
 * The gas stages with every duration stretched by `s`, each rounded to whole ticks (the stage machine counts ticks); `s`
 * = 1 returns `stages` itself.
 */
export function stretchGasStages(stages: readonly GasStage[], s: number): readonly GasStage[] {
    if (s === 1) return stages;
    return stages.map((stage) => ({ ...stage, duration: Math.round(stage.duration * s * TICK_HZ) / TICK_HZ }));
}
