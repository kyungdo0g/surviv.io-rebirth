// Strobes: survev master's strobe (the gameplay baseline since docs/adr/0003-survev-baseline.md) and the rebirth
// variant strobes.
// - survev: `strikeDelay` 3 s instead of the original client's 2.5 (survev throwableDefs.ts:367 "Changed this from 2.5
//   to 3"; survev.wiki.gg Strobe: "three seconds after it is thrown"), applied here to the generated def; the strike
//   pattern (first line in front, then sideways offsets 0 / 5 / 5 / 10 / 10 on alternating sides from a random side,
//   Broken Arrow counted at the throw) is the sim's (combat/projectiles.ts, rules.ts strobe* knobs).
// - rebirth (deliberate addition requested by the user, 2026-10-07; not in v0.8.82): `strobe_heavy` calls the heavy
//   shell air strike variant and `strobe_carpet` carpet bombing (rebirth/airstrikeVariants.ts). Both are thrown like a
//   strobe, drawn in their variant's colour and marked on the map by their own air strike ping in that colour. They are
//   loot only (rebirth/strobeLoot.ts): no server knob, the server's AIRSTRIKE_VARIANTS only weighs the 50v50 zones.
// docs/research/rebirth-deviations.md "Variant strobes" lists them; docs/research/conflicts.md the survev resolutions.
import type { GameObjectDef, PingDef, ThrowableDef, ThrowableHandImg } from "../types/index.ts";
import { AIRSTRIKE_VARIANT_COLORS, type AirstrikeVariant, CARPET_AIM_RAD_MULT } from "./airstrikeVariants.ts";
import type { DefDeviation } from "./deviations.ts";

/** survev master's strobe strikeDelay (survev/shared/defs/gameObjects/throwableDefs.ts:367, wikigg/Strobe). */
export const STROBE_STRIKE_DELAY = 3;

/** How a thrown strobe's air strike goes (sim combat/projectiles.ts). */
export interface StrobeStrikeDef {
    /** air strike variant of every strike line (the plane's bombs: AIRSTRIKE_VARIANTS) */
    variant: AirstrikeVariant;
    /** strike lines (one plane each) */
    strikes: number;
    /** extra lines with Broken Arrow (survev perkDefs.ts:64-66 broken_arrow.bonusAirstrikes) */
    brokenArrowBonus: number;
    /** sideways spacing between the lines in units of rules.strobeAirstrikeOffset (survev's 5 u) */
    offsetMult: number;
    /** map marker of the strike (a mapEvent ping def) */
    ping: string;
}

/** Map ping of a strike of each variant: the original ping_airstrike, and rebirth-only copies in the variant colour. */
export const AIRSTRIKE_PINGS: Readonly<Record<AirstrikeVariant, string>> = {
    normal: "ping_airstrike",
    heavy: "ping_airstrike_heavy",
    carpet: "ping_airstrike_carpet",
};

/** Survev's Broken Arrow bonus: 2 more strikes (survev/shared/defs/gameObjects/perkDefs.ts:64-66). */
const BROKEN_ARROW_BONUS = 2;

/**
 * Every strobe: the original 3 lines of iron bombs (survev weaponManager.ts:1337-1362); the heavy strobe 3 lines of
 * heavy shells (the user: "3 strike lines of bomb_heavy, 5 with Broken Arrow"); the carpet strobe 6 lines (the
 * carpet strike's 6 passes) of iron bombs spaced 1.4x wider (CARPET_AIM_RAD_MULT, as the carpet zone's larger area),
 * 0 / 7 / 7 / 14 / 14 / 21 u to the sides, 8 with Broken Arrow. Every strobe packs its lines into the same 3 s.
 */
export const STROBE_STRIKES: Readonly<Record<string, StrobeStrikeDef>> = {
    strobe: {
        variant: "normal",
        strikes: 3,
        brokenArrowBonus: BROKEN_ARROW_BONUS,
        offsetMult: 1,
        ping: AIRSTRIKE_PINGS.normal,
    },
    strobe_heavy: {
        variant: "heavy",
        strikes: 3,
        brokenArrowBonus: BROKEN_ARROW_BONUS,
        offsetMult: 1,
        ping: AIRSTRIKE_PINGS.heavy,
    },
    strobe_carpet: {
        variant: "carpet",
        strikes: 6,
        brokenArrowBonus: BROKEN_ARROW_BONUS,
        offsetMult: CARPET_AIM_RAD_MULT,
        ping: AIRSTRIKE_PINGS.carpet,
    },
};

/** The rebirth variant strobes, in registry order. */
export const STROBE_VARIANT_TYPES = ["strobe_heavy", "strobe_carpet"] as const;

/** Strike of a strobe type, undefined for anything else. */
export function strobeStrikeOf(type: string): StrobeStrikeDef | undefined {
    return Object.hasOwn(STROBE_STRIKES, type) ? STROBE_STRIKES[type] : undefined;
}

/** Whether `type` is a strobe (the original or a rebirth variant): thrown, it calls an air strike. */
export function isStrobe(type: string): boolean {
    return Object.hasOwn(STROBE_STRIKES, type);
}

/** Variant of an air strike map ping (ping_airstrike and its rebirth copies), undefined for other types. */
export function airstrikePingVariant(type: string): AirstrikeVariant | undefined {
    for (const [variant, ping] of Object.entries(AIRSTRIKE_PINGS))
        if (ping === type) return variant as AirstrikeVariant;
    return undefined;
}

export function isAirstrikePing(type: string): boolean {
    return airstrikePingVariant(type) !== undefined;
}

/**
 * Applies survev's strobe strikeDelay to `defs` (a mutable copy of the generated record; the generated strobe keeps
 * the original client's 2.5). Returns what changed.
 */
export function applySurvevStrobe(defs: Record<string, GameObjectDef>): DefDeviation[] {
    const strobe = defs.strobe as ThrowableDef;
    defs.strobe = { ...strobe, strikeDelay: STROBE_STRIKE_DELAY };
    return [
        {
            id: "strobe",
            field: "strikeDelay",
            original: strobe.strikeDelay,
            rebirth: STROBE_STRIKE_DELAY,
            reason:
                "survev master is the gameplay baseline (ADR 0003): survev/shared/defs/gameObjects/throwableDefs.ts:367 " +
                "and wikigg/Strobe give 3 s (conflicts.md strobe-strike-delay)",
        },
    ];
}

/** Display names of the variant strobes (the client's en / ko tables name them too). */
const VARIANT_NAMES: Readonly<Record<(typeof STROBE_VARIANT_TYPES)[number], string>> = {
    strobe_heavy: "Heavy Shell Strobe",
    strobe_carpet: "Carpet Bombing Strobe",
};

/** `img` tinted and recoloured (an empty or "none" image stays as it is). */
function tintedHand(img: ThrowableHandImg, tint: number): ThrowableHandImg {
    if (!img.sprite || img.sprite === "none") return { ...img };
    return { ...img, tint, recolor: true };
}

/**
 * The variant strobes, built from `strobe` (the strobe with survev's strikeDelay): same throw physics, fuse, explosion
 * (explosion_strobe), sounds and sprites, with
 * - the variant colour (AIRSTRIKE_VARIANT_COLORS, the zone marker's): the loot icon (lootImg.tint over the grey loot
 *   art, hudTint in the DOM HUD), the thrown strobe and the strobe in the hand (recoloured: their art is yellow-green);
 * - noPotatoSwap: potato kills never hand them out, they stay air drop loot (rebirth/strobeLoot.ts).
 */
export function strobeVariantDefs(strobe: ThrowableDef): Record<string, ThrowableDef> {
    const out: Record<string, ThrowableDef> = {};
    for (const id of STROBE_VARIANT_TYPES) {
        const tint = AIRSTRIKE_VARIANT_COLORS[STROBE_STRIKES[id].variant];
        const handImg: ThrowableDef["handImg"] = {};
        for (const [state, imgs] of Object.entries(strobe.handImg ?? {})) {
            handImg[state as keyof typeof handImg] = {
                right: tintedHand(imgs.right, tint),
                left: tintedHand(imgs.left, tint),
            };
        }
        out[id] = {
            ...strobe,
            name: VARIANT_NAMES[id],
            noPotatoSwap: true,
            lootImg: { ...strobe.lootImg, tint, hudTint: tint },
            worldImg: { ...strobe.worldImg, tint, recolor: true },
            handImg,
        };
    }
    return out;
}

/** The variant air strike pings: ping_airstrike (sprites, sound, 2 s life, mapEvent) in the variant colour. */
export function airstrikePingDefs(pingAirstrike: PingDef): Record<string, PingDef> {
    return {
        [AIRSTRIKE_PINGS.heavy]: { ...pingAirstrike, tint: AIRSTRIKE_VARIANT_COLORS.heavy },
        [AIRSTRIKE_PINGS.carpet]: { ...pingAirstrike, tint: AIRSTRIKE_VARIANT_COLORS.carpet },
    };
}

/**
 * Bag capacity rows of the variant strobes: the strobe's (GameConfig.bagSizes.strobe 2 / 3 / 4 / 5). They follow every
 * original bag item (their protocol order: the Local message's inventory section).
 */
export function strobeVariantBagSizes(bagSizes: Readonly<Record<string, number[]>>): Record<string, number[]> {
    const row = bagSizes.strobe;
    if (!row) throw new Error("bagSizes.strobe is missing");
    return Object.fromEntries(STROBE_VARIANT_TYPES.map((id) => [id, [...row]]));
}
