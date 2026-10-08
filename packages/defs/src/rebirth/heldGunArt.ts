// Top-down held sprites drawn for the rebirth (the owner, 2026-10-08: "draw only 5 first", then the snipers and DMRs,
// then the SMGs and machine pistols): our own art, minimal hand-written SVGs committed under
// apps/client/public/rebirth/guns/gun-<id>-01.svg and served at /rebirth/guns/, like the rebirth buildings' images
// (buildings.ts rebirthBuildingArt). Each is the gun seen from straight above, barrel up, butt flush with the bottom
// edge, drawn at worldImg.scale 0.5 in its own colours (tint white): the rifles and SMGs 48 px wide like the original
// rifle and SMG sprites (gun-m4a1-01, gun-famas-01, gun-vector-01), the bolt snipers and the sniper bullpups 60 like
// gun-awc-01 and gun-scarssr-01, the pistol class 40, centre line x 20 (the original pistol frames are 56 wide, their
// art at most 40). The width moves nothing in game: the anchor is the bottom centre.
// The client's sprite manifest lists them (apps/client assets/rebirthSprites.ts); a beta new gun switches to its own
// sprite as soon as the manifest has it (apps/client objects/heldGun.ts), and the AK-47, an original gun, gets it here
// as a presentation deviation of its worldImg. A dual pistol is never listed: it holds its single's sprite in each hand
// (heldGun.ts ownHeldSprite strips "_dual", so tec9_dual draws gun-tec9-01 through the tec9 entry). Hands and recoil
// stay as they were: the sprites are drawn to sit under the existing grips; only the bullpups' own sprites get survev's
// bullpup gun offset (HELD_GUN_ART_GUN_OFFSET), the P90's is held with the hands under it
// (HELD_GUN_ART_HANDS_BELOW) and the AS Val's left hand moves back onto its forend (HELD_GUN_ART_LEFT_HAND_OFFSET).
// Bars on purpose (owner, 2026-10-08), never add them here: the Mk 14 EBR ("Mk 14 EBR만 막대기로"), the Thompson M1928
// ("Thompson M1928 막대기") and the Škorpion vz. 61 and its dual ("Škorpion vz. 61 막대기").
// docs/research/rebirth-deviations.md "Top-down held sprites".
import type { GameObjectDef, GunDef } from "../types/index.ts";
import type { DefDeviation } from "./deviations.ts";

/** The drawn guns and their sprites' logical size (the SVG's width and height; drawn at scale 0.5). */
export const HELD_GUN_ART = {
    ak47: [48, 172],
    g36c: [48, 136],
    m16a4: [48, 220],
    sig550: [48, 188],
    g3: [48, 190],
    fal: [48, 196],
    wa2000: [60, 192],
    m200: [60, 226],
    hecate: [60, 232],
    lynx: [60, 192],
    boys: [60, 238],
    bizon: [48, 140],
    asval: [48, 152],
    p90: [48, 116],
    tec9: [40, 116],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

export type HeldGunArtId = keyof typeof HELD_GUN_ART;

/**
 * The gun offset (body px) an own sprite is held with where it differs from the def's: the bullpups WA2000, Lynx and
 * P90, whose sprites are drawn for survev's bullpup offset (-8, 0) (.survev/shared/defs/gameObjects/gunDefs.ts famas,
 * qbb97, groza, grozas); the balance sheet gave them none, which would float the butt in front of the body and put the
 * right hand on the butt plate (the P90's 116 px sprite would end 10 body px past the bullet origin instead of 2).
 * Client-only, like all of worldImg (objects/playerGun.ts); rebirth/newGuns.json and its bar keep the sheet's values.
 * Keyed by gun id: the client applies an entry to the own sprite only, so it acts once the gun is in HELD_GUN_ART.
 */
export const HELD_GUN_ART_GUN_OFFSET: Readonly<Partial<Record<string, { x: number; y: number }>>> = {
    wa2000: { x: -8, y: 0 },
    lynx: { x: -8, y: 0 },
    p90: { x: -8, y: 0 },
};

/**
 * Own sprites held with both hands under the gun (survev's worldImg.handsBelow, the potato cannon's; client
 * objects/player.ts updateWeapon): the P90, whose hands grip under the shell (thumbhole and front grip). Drawn over
 * it, the two hand discs (only 44 sprite px apart on its right half) would cover its identity, the magazine lying on
 * top, the sight housing and the flash hider. Keyed by gun id like HELD_GUN_ART_GUN_OFFSET; client-only.
 */
export const HELD_GUN_ART_HANDS_BELOW: Readonly<Partial<Record<string, boolean>>> = {
    p90: true,
};

/**
 * The left-hand offset (body px) an own sprite is held with where it differs from the def's: the AS Val, whose sheet
 * offset (9, 0) (the VSS's, on a 208 px sprite) puts the left hand on the front of its 152 px sprite's integral
 * suppressor and hides all but its tip; at (4, 0) the hand holds the forend, as on the real gun, and the whole fat can
 * shows in front of it. Keyed by gun id like HELD_GUN_ART_GUN_OFFSET; client-only (objects/player.ts placeBones), so
 * rebirth/newGuns.json and its bar keep (9, 0).
 */
export const HELD_GUN_ART_LEFT_HAND_OFFSET: Readonly<Partial<Record<string, { x: number; y: number }>>> = {
    asval: { x: 4, y: 0 },
};

export interface HeldGunArt {
    id: HeldGunArtId;
    /** sprite id, gun-<id>-01.img (the client serves it from /rebirth/guns/gun-<id>-01.svg) */
    sprite: string;
    size: readonly [number, number];
}

/** The world image scale every own top-down sprite is drawn at (survev's own-art guns; heldGun.ts for the new guns). */
export const HELD_GUN_ART_SCALE = { x: 0.5, y: 0.5 } as const;

/** Sprite id of a drawn gun's held image. */
export function heldGunArtSprite(id: string): string {
    return `gun-${id}-01.img`;
}

/** Every drawn held sprite with its size (the client's sprite manifest entries). */
export function heldGunArt(): HeldGunArt[] {
    return (Object.keys(HELD_GUN_ART) as HeldGunArtId[]).map((id) => ({
        id,
        sprite: heldGunArtSprite(id),
        size: HELD_GUN_ART[id],
    }));
}

/**
 * Points the original (generated) guns among HELD_GUN_ART at their drawn sprite: today only the AK-47, whose
 * gun-long-01 bar tinted 0x622a12 at 0.5 x 0.435 becomes gun-ak47-01 at 0.5 x 0.5 in its own colours; its left hand
 * (2.8, 0) and recoil 1.33 stay. The beta new guns need no def change (the client switches them, heldGun.ts), so
 * rebirth/newGuns.json keeps the balance sheet's values (its bars, and the Hécate II and Lynx's borrowed gun-awc-01).
 * Returns what changed.
 */
export function applyHeldGunArt(defs: Record<string, GameObjectDef>): DefDeviation[] {
    const ak47 = defs.ak47;
    if (ak47?.type !== "gun") throw new Error('held gun art: "ak47" is not a gun');
    const worldImg: GunDef["worldImg"] = {
        ...ak47.worldImg,
        sprite: heldGunArtSprite("ak47"),
        scale: { ...HELD_GUN_ART_SCALE },
        tint: 0xffffff,
    };
    defs.ak47 = { ...ak47, worldImg };
    return [
        {
            id: "ak47",
            field: "worldImg",
            original: { sprite: ak47.worldImg.sprite, scale: ak47.worldImg.scale, tint: ak47.worldImg.tint },
            rebirth: { sprite: worldImg.sprite, scale: worldImg.scale, tint: worldImg.tint },
            reason: "owner: own top-down held sprite instead of the tinted bar (presentation only)",
        },
    ];
}
