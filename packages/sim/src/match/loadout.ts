// Player loadouts (survev content wave stage 4b). The original and survev let a guest pick only the `unlock_default`
// items; the rebirth has no accounts, so every loadout item is unlocked (the lead's decision, 2026-10-07). A loadout
// arrives in Join and is validated against the defs like survev's shared/utils/loadout.ts validate: an unknown id or
// one of the wrong type falls back to the default. Kept out of the menu (and refused here): role uniforms (outfits
// with `noDrop`), loot melee weapons (only fists and the `noDropOnDeath` loadout melees, the original's melee skins) and
// emotes marked `noCustom` (ammo pings, perk emotes). The crosshair never leaves the client.
import { GameConfig, GameObjectDefs, hasDef } from "@rebirth/defs";

/** survev loadout.ts Crosshair: a crosshair def, an RGB colour and the size and stroke sliders. */
export interface Crosshair {
    type: string;
    color: number;
    size: number;
    stroke: number;
}

/** A validated loadout: every id is a def of its kind. */
export interface Loadout {
    outfit: string;
    melee: string;
    heal: string;
    boost: string;
    /** EmoteSlot order: Top, Right, Bottom, Left, Win, Death ("" for none) */
    emotes: string[];
    crosshair: Crosshair;
}

/** The part of a loadout the client sends in Join (survev JoinMsg.loadout). */
export type JoinLoadout = Pick<Loadout, "outfit" | "melee" | "heal" | "boost" | "emotes">;

export type LoadoutKind = "outfit" | "melee" | "heal" | "boost" | "emote" | "crosshair";

const DEF_TYPE: Readonly<Record<LoadoutKind, string>> = {
    outfit: "outfit",
    melee: "melee",
    heal: "heal_effect",
    boost: "boost_effect",
    emote: "emote",
    crosshair: "crosshair",
};

/** survev index.html #crosshair-size (0.25-1) and #crosshair-stroke (0-1.5) sliders; loadout.ts default size 1 */
export const CROSSHAIR_SIZE = { min: 0.25, max: 1, default: 1 } as const;
export const CROSSHAIR_STROKE = { min: 0, max: 1.5, default: 0 } as const;

interface LoadoutDefLike {
    type: string;
    noDrop?: boolean;
    noDropOnDeath?: boolean;
    noCustom?: boolean;
}

/** Whether `id` can be picked as a `kind` loadout item. */
export function isLoadoutItem(kind: LoadoutKind, id: string): boolean {
    if (typeof id !== "string" || !hasDef(id)) return false;
    const def = GameObjectDefs[id] as LoadoutDefLike;
    if (def.type !== DEF_TYPE[kind]) return false;
    if (kind === "outfit") return !def.noDrop;
    if (kind === "melee") return id === "fists" || !!def.noDropOnDeath;
    if (kind === "emote") return !def.noCustom;
    return true;
}

/** Every pickable item of `kind`, in definition order. */
export function loadoutChoices(kind: LoadoutKind): string[] {
    return Object.keys(GameObjectDefs).filter((id) => isLoadoutItem(kind, id));
}

/** survev loadout.ts defaultLoadout: the standard-issue items and the default emote wheel. */
export function defaultLoadout(): Loadout {
    return {
        outfit: "outfitBase",
        melee: "fists",
        heal: "heal_basic",
        boost: "boost_basic",
        emotes: [...GameConfig.defaultEmoteLoadout],
        crosshair: {
            type: "crosshair_default",
            color: 0xffffff,
            size: CROSSHAIR_SIZE.default,
            stroke: CROSSHAIR_STROKE.default,
        },
    };
}

function pick(kind: LoadoutKind, value: unknown, fallback: string): string {
    return typeof value === "string" && isLoadoutItem(kind, value) ? value : fallback;
}

function num(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

/** A loadout from untrusted input (Join, localStorage); anything invalid takes the default (survev loadout.validate). */
export function validateLoadout(input: unknown): Loadout {
    const base = defaultLoadout();
    const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
    const emotes = Array.isArray(v.emotes) ? v.emotes : [];
    const cross = (typeof v.crosshair === "object" && v.crosshair !== null ? v.crosshair : {}) as Record<
        string,
        unknown
    >;
    const color = typeof cross.color === "number" ? cross.color : Number.parseInt(String(cross.color), 10);
    return {
        outfit: pick("outfit", v.outfit, base.outfit),
        melee: pick("melee", v.melee, base.melee),
        heal: pick("heal", v.heal, base.heal),
        boost: pick("boost", v.boost, base.boost),
        // the win and death slots default to none
        emotes: base.emotes.map((fallback, i) => pick("emote", emotes[i], fallback)),
        crosshair: {
            type: pick("crosshair", cross.type, base.crosshair.type),
            color: Number.isInteger(color) && color >= 0 && color <= 0xffffff ? color : base.crosshair.color,
            size: num(cross.size, CROSSHAIR_SIZE.min, CROSSHAIR_SIZE.max, base.crosshair.size),
            stroke: num(cross.stroke, CROSSHAIR_STROKE.min, CROSSHAIR_STROKE.max, base.crosshair.stroke),
        },
    };
}
