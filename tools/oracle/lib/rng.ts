// Deterministic replacements for Math.random while survev code runs.
//
// survev calls Math.random (directly or through util.random / util.randomInt, whose `rand = Math.random`
// default is evaluated on every call) for headshots, spread deviation, shotgun pellet jitter, the bullet
// distance jitter, gas circle placement and map generation. The oracle replaces the global for the whole run:
//
// - "seeded": mulberry32 PRNG. Used to create every game (map generation, spawn layout), so maps are identical
//   between runs, and for scenarios that want natural randomness.
// - "centered": Math.random() always returns 0.5. util.random(a, b) returns the midpoint (a + b) / 2, so
//     * spread deviation `util.random(-0.5, 0.5) * spread` is 0: every shot goes exactly along the aim direction,
//     * shotgun pellet start jitter `util.random(-jitter, jitter)` is 0: all pellets start at the barrel tip,
//     * bullet distance jitter `util.randomInt(0, 16)` gives index floor(0.5 * 17) = 8, i.e. distAdj = 0 m,
//     * the headshot roll `Math.random() < 0.15` fails (headshots are additionally controlled below).
// - "low": always 0 (smallest deviation and jitter, distAdj = -1 m). "high": always 1 - 2^-53 (largest, +1 m).
//
// Headshots are controlled independently of the random source by overwriting survev's
// GameConfig.player.headshotChance (Player.damage rolls `Math.random() < headshotChance`): "never" sets it to 0
// (no value in [0, 1) is below 0), "always" sets it to 1 (every value in [0, 1) is below 1), "random" restores
// the original 0.15.
//
// Constant modes are only installed after a game is created (map generation can loop on rejection sampling).

export type RandomSource =
    | { readonly kind: "seeded"; readonly seed: number }
    | { readonly kind: "constant"; readonly name: "centered" | "low" | "high"; readonly value: number };

export type HeadshotMode = "never" | "always" | "random";

export const CENTERED: RandomSource = { kind: "constant", name: "centered", value: 0.5 };
export const LOW: RandomSource = { kind: "constant", name: "low", value: 0 };
export const HIGH: RandomSource = { kind: "constant", name: "high", value: 1 - 2 ** -53 };

export function seeded(seed: number): RandomSource {
    return { kind: "seeded", seed };
}

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const nativeRandom = Math.random;

export function useRandom(source: RandomSource): void {
    if (source.kind === "seeded") {
        Math.random = mulberry32(source.seed);
    } else {
        const value = source.value;
        Math.random = () => value;
    }
}

export function restoreNativeRandom(): void {
    Math.random = nativeRandom;
}

/** Human readable description of every mode, copied into fixture metadata. */
export const RANDOM_MODE_DOCS = {
    seeded: "Math.random = mulberry32(seed); used for game creation (map generation) and natural-randomness runs",
    centered:
        "Math.random() = 0.5: zero spread deviation, zero shotgun pellet jitter, bullet distAdj index 8 (0 m), " +
        "headshot roll fails",
    low: "Math.random() = 0: deviation -spread/2, pellet jitter -jitter, bullet distAdj index 0 (-1 m)",
    high: "Math.random() = 1 - 2^-53: deviation +spread/2, pellet jitter +jitter, bullet distAdj index 16 (+1 m)",
    headshotNever: "GameConfig.player.headshotChance = 0 (Math.random() < 0 never holds)",
    headshotAlways: "GameConfig.player.headshotChance = 1 (Math.random() < 1 always holds)",
    headshotRandom: "GameConfig.player.headshotChance = 0.15 (survev default)",
} as const;
