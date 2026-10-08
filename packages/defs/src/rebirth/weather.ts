// Rebirth rainy matches (user/2026-10-08-rain; docs/research/rebirth-deviations.md "Rainy matches"): 30 % of the classic
// and 50v50 matches are a little darker with rain falling from start to finish. Effects only: every client decides from
// the map name and the map seed the Map message already carries, so all players of a match see the same weather with no
// wire change, and neither the simulation nor the bots read it. The event maps keep their own looks (snow, desert,
// woods, the Halloween night...), and so do the classic and 50v50 variants with camera particles of their own
// (main_spring's blossoms, faction_potato's "Potato vs Tomato" potatoes and tomatoes).

/** maps whose matches can rain: the classic maps and the 50v50 map without camera particles of their own */
export const RAINY_MAPS: readonly string[] = ["main", "main_summer", "faction"];

/** share of their matches (seeds) that rain */
export const RAIN_CHANCE = 0.3;

/** salt of the weather roll, so it does not line up with any other use of the map seed */
const WEATHER_SALT = 0x7261696e; // "rain"

/** 32-bit integer hash with full avalanche (Wellons' lowbias32), so neighbouring seeds roll independently */
function hash32(x: number): number {
    let h = x >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
}

/** The weather roll of a map seed in [0, 1): pure and deterministic (no Math.random). */
export function weatherRoll(seed: number): number {
    return hash32(hash32(seed ^ WEATHER_SALT) + WEATHER_SALT) / 2 ** 32;
}

/** Whether the match on `mapName` with map seed `seed` rains (30 % of the RAINY_MAPS seeds, never elsewhere). */
export function isRainyMatch(mapName: string, seed: number): boolean {
    return RAINY_MAPS.includes(mapName) && weatherRoll(seed) < RAIN_CHANCE;
}
