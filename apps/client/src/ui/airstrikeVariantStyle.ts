// How the client tells the rebirth air strike variants apart (deliberate rebirth addition requested by the user,
// docs/research/rebirth-deviations.md "Client presentation"; defs AIRSTRIKE_VARIANTS): the zone marker on the map and
// on the ground, the "ping_airstrike" map marker and edge indicator, and the HUD announcement when a heavy or carpet
// zone appears (a normal zone stays silent, as in v0.8.82).
// `normal` keeps the original look (survev client/src/objects/plane.ts AirstrikeZone: 0xeaff00, 1.5 px outline, 20 %
// fill on the map); `heavy` is red with a thicker outline and an inner ring at the planes' aim radius (the outer ring
// is the heavy shells' reach); `carpet` is magenta with a double outline that blinks, for its longer six-plane run.
import { AIRSTRIKE_VARIANTS, type AirstrikeVariant, isAirstrikeVariant } from "@rebirth/defs";
import { t } from "../l10n/index.ts";

export interface AirstrikeZoneStyle {
    color: number;
    /** minimap outline width (px) and fill alpha */
    mapLineWidth: number;
    mapFillAlpha: number;
    /** in-world outline width (world units), outline and fill alpha */
    worldLineWidth: number;
    worldLineAlpha: number;
    worldFillAlpha: number;
    /** second, thinner ring inside the outline: the planes' aim radius, a double outline, or none (innerRingRad) */
    innerRing: "aim" | "double" | null;
    /** marker alpha blink period in seconds (0: steady) */
    blink: number;
}

/** original (normal) zone colour, also ping_airstrike's tint (0xeaff00) */
export const NORMAL_ZONE_COLOR = 0xeaff00;
export const HEAVY_ZONE_COLOR = 0xff3c1e;
export const CARPET_ZONE_COLOR = 0xe040ff;

export const AIRSTRIKE_ZONE_STYLES: Readonly<Record<AirstrikeVariant, AirstrikeZoneStyle>> = {
    normal: {
        color: NORMAL_ZONE_COLOR,
        mapLineWidth: 1.5,
        mapFillAlpha: 0.2,
        worldLineWidth: 0.2,
        worldLineAlpha: 0.55,
        worldFillAlpha: 0.07,
        innerRing: null,
        blink: 0,
    },
    heavy: {
        color: HEAVY_ZONE_COLOR,
        mapLineWidth: 3,
        mapFillAlpha: 0.28,
        worldLineWidth: 0.5,
        worldLineAlpha: 0.8,
        worldFillAlpha: 0.12,
        innerRing: "aim",
        blink: 0,
    },
    carpet: {
        color: CARPET_ZONE_COLOR,
        mapLineWidth: 2.5,
        mapFillAlpha: 0.24,
        worldLineWidth: 0.4,
        worldLineAlpha: 0.75,
        worldFillAlpha: 0.1,
        innerRing: "double",
        blink: 0.8,
    },
};

/** A zone view's variant; absent or unknown is normal (AirstrikeZoneView.variant is optional). */
export function zoneVariant(variant: string | undefined): AirstrikeVariant {
    return variant && isAirstrikeVariant(variant) ? variant : "normal";
}

export function zoneStyle(variant: string | undefined): AirstrikeZoneStyle {
    return AIRSTRIKE_ZONE_STYLES[zoneVariant(variant)];
}

/**
 * Radius of the inner ring of a zone of `rad`, or 0: the heavy zone's aim radius (rad minus the variant's zoneRadAdd,
 * where the planes aim; the outer ring is the shells' reach), or a ring just inside the outline for the double outline.
 */
export function innerRingRad(variant: string | undefined, rad: number): number {
    const v = zoneVariant(variant);
    const style = AIRSTRIKE_ZONE_STYLES[v];
    if (style.innerRing === "aim") return Math.max(0, rad - AIRSTRIKE_VARIANTS[v].zoneRadAdd);
    if (style.innerRing === "double") return rad * 0.9;
    return 0;
}

/** Alpha multiplier of a blinking zone `ticker` seconds in (1 when it does not blink): 0.35..1. */
export function blinkAlpha(style: AirstrikeZoneStyle, ticker: number): number {
    if (style.blink <= 0) return 1;
    return 0.675 + 0.325 * Math.cos((ticker / style.blink) * Math.PI * 2);
}

/**
 * HUD announcement when a zone of `variant` appears (rebirth keys, l10n/modes.ts), or null: only the rebirth variants
 * are announced, so players can tell them apart; a normal zone stays silent as in v0.8.82.
 */
export function airstrikeAnnouncement(variant: string | undefined): string | null {
    switch (zoneVariant(variant)) {
        case "heavy":
            return t("game-airstrike-heavy-incoming");
        case "carpet":
            return t("game-airstrike-carpet-incoming");
        default:
            return null;
    }
}
