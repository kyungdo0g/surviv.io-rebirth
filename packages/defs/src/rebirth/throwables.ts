// The owner's new throwables (2026-10-10, "second-wave decals" sheet; deliberate rebirth additions, not in v0.8.82 nor
// survev): the Molotov and the M84-style flashbang. docs/research/rebirth-deviations.md "Molotov and flashbang".
// - Molotov: no fuse; it bursts as soon as it touches the ground, a wall or a player (explodeOnImpact +
//   playerCollision, the potato cannonball's flight rules) into a burning area (ExplosionDef.fire, sim world/fires.ts).
//   survev has no fire: the area reuses the gas and bleeding damage plumbing (fixed damage per tick that armour does
//   not reduce), credited to the thrower like his grenade, and keeps burning a player who walks out for `afterburn`.
//   Over water it only splashes.
// - Flashbang: cooked and thrown like a frag (same throw physics and cook rules) with a 2.5 s fuse; the bang deals no
//   damage but blinds and deafens the players who see it (ExplosionDef.flash, sim combat/flash.ts): full strength
//   within `fullRad`, fading to nothing at `rad`; a wall between the bang and a player blocks the white-out and leaves
//   part of the deafening. The client fades a white screen and muffles its audio for the strength's share of
//   blindTime / deafTime.
// Both are drawn with the owner's art cut from the sheet at install time (tools/assets/decalSheet.ts), with our own
// committed SVGs (apps/client/public/rebirth/throwables/) as fallback, and use original sounds.
import type { ExplosionDef, LootTableEntry, MapDef, ThrowableDef } from "../types/index.ts";

export const MOLOTOV = "molotov";
export const FLASHBANG = "flashbang";
/** The rebirth throwables in registry order (game objects and bag rows). */
export const REBIRTH_THROWABLE_TYPES = [MOLOTOV, FLASHBANG] as const;
/** The decal of burning ground (rebirth map object, rebirth/discardDecals.ts builds it with the launcher decals). */
export const FIRE_DECAL_TYPE = "decal_molotov_fire";

/**
 * The Molotov's fire: 4.5 u across (a frag's inner radius is 5 x 1.3), burning 7 s; 2 HP every 0.25 s (8 HP/s, about
 * 4x the last zone's gas) to whoever stands in it and 1.5 s more after leaving, so running straight through costs
 * 15-20 HP and staying in the whole time is lethal from about 60 HP.
 */
export const MOLOTOV_FIRE = {
    rad: 4.5,
    duration: 7,
    damage: 2,
    tickInterval: 0.25,
    afterburn: 1.5,
    decalType: FIRE_DECAL_TYPE,
} as const;

/**
 * The flashbang's flash: blinding up to 20 u (about the 1x scope's view), full strength within 6 u; 4 s of white at
 * full strength and 6 s of muffled hearing; a third of the deafening still comes through a wall.
 */
export const FLASHBANG_FLASH = {
    rad: 20,
    fullRad: 6,
    blindTime: 4,
    deafTime: 6,
    deafThroughWalls: 0.35,
} as const;

/** Flashbang fuse: the M84's 1-2.3 s is too short to throw around a corner, a frag's 4 s lets everyone walk away. */
export const FLASHBANG_FUSE = 2.5;

/** The sprite each throwable is drawn with in the hand, in flight and as loot (one picture per item). */
export const REBIRTH_THROWABLE_SPRITES: Readonly<Record<(typeof REBIRTH_THROWABLE_TYPES)[number], string>> = {
    molotov: "proj-molotov-01.img",
    flashbang: "proj-flashbang-01.img",
};
/** Logical size of the throwable sprites: the original proj-frag-*.img frames are 128 x 128. */
export const REBIRTH_THROWABLE_SPRITE_SIZE = [128, 128] as const;
/** The committed fallback drawing of a throwable sprite (ours, served from /rebirth/throwables/). */
export function drawnThrowableSprite(sprite: string): string {
    return sprite.replace(/\.img$/, "-drawn.img");
}
/** Served URL of the committed fallback drawing of a throwable sprite. */
export function drawnThrowableUrl(sprite: string): string {
    return `/rebirth/throwables/${sprite.replace(/\.img$/, "")}.svg`;
}

/** Display names (the client's en / ko tables name them too). */
const NAMES = { molotov: "Molotov Cocktail", flashbang: "Flashbang" } as const;

/** Inventory order after the strobe (3): the throwable slot cycles frag, MIRV, smoke, strobe, Molotov, flashbang. */
const INVENTORY_ORDER = { molotov: 4, flashbang: 5 } as const;

const hand = (sprite: string, scale = 0.14) => ({ sprite, pos: { x: 4.2, y: 4.2 }, scale });
const NONE = { sprite: "none" };

/**
 * The two throwables and their explosions, built from the frag (its throw physics, loot border and sounds):
 * - molotov: not cookable, bursts on impact or on a player, a little slower and lower than a frag (speed 18);
 *   explosion_molotov deals no blast damage, leaves a small scorch and its fire (MOLOTOV_FIRE);
 * - flashbang: the frag's cook and throw with FLASHBANG_FUSE; explosion_flashbang deals no damage and flashes
 *   (FLASHBANG_FLASH). The pulled pin in the other hand is the frag's.
 * Neither is handed out by potato swaps (noPotatoSwap): they stay loot.
 */
export function rebirthThrowableDefs(frag: ThrowableDef): Record<string, ThrowableDef | ExplosionDef> {
    const molotovSprite = REBIRTH_THROWABLE_SPRITES.molotov;
    const flashSprite = REBIRTH_THROWABLE_SPRITES.flashbang;
    const loot = (sprite: string) => ({ ...frag.lootImg, sprite, tint: 0xffffff });
    const molotov: ThrowableDef = {
        ...frag,
        name: NAMES.molotov,
        explosionType: "explosion_molotov",
        inventoryOrder: INVENTORY_ORDER.molotov,
        cookable: false,
        explodeOnImpact: true,
        playerCollision: true,
        // a Molotov that never lands (it cannot: it falls in about a second) still bursts
        fuseTime: 5,
        throwPhysics: { ...frag.throwPhysics, speed: 18 },
        noPotatoSwap: true,
        lootImg: loot(molotovSprite),
        worldImg: { sprite: molotovSprite, scale: 0.13, tint: 0xffffff },
        handImg: {
            equip: { right: hand(molotovSprite), left: NONE },
            cook: { right: hand(molotovSprite), left: NONE },
            throwing: { right: NONE, left: NONE },
        },
        sound: { ...frag.sound, pullPin: "strobe_click_01" },
    };
    const flashbang: ThrowableDef = {
        ...frag,
        name: NAMES.flashbang,
        explosionType: "explosion_flashbang",
        inventoryOrder: INVENTORY_ORDER.flashbang,
        fuseTime: FLASHBANG_FUSE,
        noPotatoSwap: true,
        lootImg: loot(flashSprite),
        worldImg: { sprite: flashSprite, scale: 0.13, tint: 0xffffff },
        handImg: {
            equip: { right: hand(flashSprite), left: NONE },
            cook: { right: hand(flashSprite), left: hand("proj-frag-pin-part.img") },
            throwing: { right: NONE, left: NONE },
        },
    };
    const quiet = { obstacleDamage: 0, shrapnelCount: 0, shrapnelType: "" };
    const explosionMolotov: ExplosionDef = {
        type: "explosion",
        damage: 0,
        ...quiet,
        rad: { min: 1, max: MOLOTOV_FIRE.rad },
        explosionEffectType: "molotov",
        decalType: "decal_frag_small_explosion",
        fire: { ...MOLOTOV_FIRE },
    };
    const explosionFlashbang: ExplosionDef = {
        type: "explosion",
        damage: 0,
        ...quiet,
        rad: { min: FLASHBANG_FLASH.fullRad, max: FLASHBANG_FLASH.rad },
        explosionEffectType: "flashbang",
        decalType: "",
        flash: { ...FLASHBANG_FLASH },
    };
    return {
        molotov,
        flashbang,
        explosion_molotov: explosionMolotov,
        explosion_flashbang: explosionFlashbang,
    };
}

/**
 * Bag rows (after every other bag item: the Local message's inventory order): the Molotov the MIRV's 2 / 4 / 6 / 8 /
 * 10 (a damaging special grenade), the flashbang the smoke's 3 / 6 / 9 / 12 / 15 (a harmless utility grenade).
 */
export function rebirthThrowableBagSizes(bagSizes: Readonly<Record<string, number[]>>): Record<string, number[]> {
    const mirv = bagSizes.mirv;
    const smoke = bagSizes.smoke;
    if (!mirv || !smoke) throw new Error("bagSizes.mirv / bagSizes.smoke are missing");
    return { molotov: [...mirv], flashbang: [...smoke] };
}

/**
 * Loot rows (owner: "rarer than frags"). A floor throwable roll (tier_throwables, the crates', the barrels' and the
 * floor spawners' grenade table) picks frag x2 at weight 1 and smoke at 1, so the Molotov at 0.25 (x1) comes a quarter
 * as often as a frag pair, an eighth as many grenades: it denies a doorway or a room for 7 s, a stronger hold than a
 * frag's one blast. The flashbang at 0.4 (x1) is less rare, since it deals no damage, but still comes in fewer than
 * half as many rolls as frags. The MIRV keeps its 0.05: it stays the rare one. The air drops keep their own throwable
 * tables (frags, MIRVs, strobes and the rare crates' variant strobes, rebirth/strobeLoot.ts). Every map with a floor
 * throwable table gets them (event and potato maps included: the potato swap never hands them out).
 */
export const REBIRTH_THROWABLE_LOOT: Readonly<Record<string, readonly LootTableEntry[]>> = {
    tier_throwables: [
        { name: MOLOTOV, count: 1, weight: 0.25 },
        { name: FLASHBANG, count: 1, weight: 0.4 },
    ],
};

/** The maps with REBIRTH_THROWABLE_LOOT's rows added to copies of their throwable tables (other tables untouched). */
export function applyRebirthThrowableLoot(maps: Readonly<Record<string, MapDef>>): Record<string, MapDef> {
    const out: Record<string, MapDef> = {};
    for (const [name, def] of Object.entries(maps)) {
        let lootTable = def.lootTable;
        for (const [tier, rows] of Object.entries(REBIRTH_THROWABLE_LOOT)) {
            const table = lootTable[tier];
            if (!table) continue;
            if (table.some((e) => rows.some((r) => r.name === e.name))) throw new Error(`${name}: ${tier} has them`);
            lootTable = { ...lootTable, [tier]: [...table, ...rows.map((r) => ({ ...r }))] };
        }
        out[name] = lootTable === def.lootTable ? def : { ...def, lootTable };
    }
    return out;
}
