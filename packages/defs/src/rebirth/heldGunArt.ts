// Top-down held sprites drawn for the rebirth (the owner, 2026-10-08: "draw only 5 first", then the snipers and DMRs,
// then the SMGs and machine pistols, then two shotguns and three machine guns, the MG 42 and the DShK "menacing", then
// the six launchers, the RPG-7 also empty and the Panzerfaust and M202 thrown away after their shot): our
// own art, minimal hand-written SVGs committed under apps/client/public/rebirth/guns/gun-<id>-01.svg and served at
// /rebirth/guns/, like the rebirth buildings' images (buildings.ts rebirthBuildingArt). Each is the gun seen from
// straight above, barrel up, butt flush with the bottom edge, drawn at worldImg.scale 0.5 in its own colours (tint
// white). The frame width follows the class: the rifles, SMGs and shotguns 48 px like the original rifle, SMG and
// shotgun sprites (gun-m4a1-01, gun-famas-01, gun-vector-01, gun-saiga-01), the bolt snipers and the sniper bullpups 60
// like gun-awc-01 and gun-scarssr-01, the pistol class 40, centre line x 20 (the original pistol frames are 56 wide,
// their art at most 40), the M60 and MG 42 80 and the DShK 88, centre line x 40 / 44, so the ammo box or belt on the
// left, the bipod and the DShK's spade grips fit on both sides of the centre line, the launchers 56 like
// gun-potato-cannon-01 (the MGL's cylinder, the RPG-7's optic and the M202's box 64). The width moves nothing in game: the
// anchor is the bottom centre, and the client rasterises each sprite at its logical size.
// The belt guns draw their box and belt into the one sprite, under the receiver's outline: the original belt guns'
// bottom sprite (worldImg.magImg, gun-pkp-bot-01) is drawn at the same 0.25 body px per sprite px under the gun and
// both hands, so it would look the same; an own sprite carries no magImg (apps/client objects/heldGun.ts), which also
// keeps the balance sheet's borrowed gun-pkp-bot-01 off them.
// The client's sprite manifest lists them (apps/client assets/rebirthSprites.ts); a beta new gun switches to its own
// sprite as soon as the manifest has it (apps/client objects/heldGun.ts), and the AK-47, an original gun, gets it here
// as a presentation deviation of its worldImg. A dual pistol is never listed: it holds its single's sprite in each hand
// (heldGun.ts ownHeldSprite strips "_dual", so tec9_dual draws gun-tec9-01 through the tec9 entry). Hands and recoil
// stay as they were: the sprites are drawn to sit under the existing grips (the machine guns keep the PKP's left hand
// 12.5 the sheet gave them); only the bullpups' own sprites get survev's bullpup gun offset (HELD_GUN_ART_GUN_OFFSET),
// the P90's is held with the hands under it (HELD_GUN_ART_HANDS_BELOW) and the AS Val's and RPG-7's left hands move
// back onto the forend and the tube (HELD_GUN_ART_LEFT_HAND_OFFSET). The RPG-7, Panzerfaust and M202 keep the sheet's
// launcher hold (the potato cannon's: hands under the gun); the M79, GL-06 and MGL are held like a rifle (owner,
// 2026-10-08: GunDef.handHeld, with their rifle hands and gun offset (-8, 0) in the sheet), their sprites drawn short
// enough for the rifle pose: the right hand on the grip, the left on the fore-end, the muzzle 3.4-3.8 body px past the
// bullet origin. The RPG-7 also has an empty sprite (HELD_GUN_ART_EMPTY), and the rounds the launchers fire have their
// own sprites (launcherRoundArt.ts).
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
    dp12: [48, 140],
    aa12: [48, 194],
    m60: [80, 212],
    mg42: [80, 218],
    dshk: [88, 250],
    m79: [56, 138],
    gl06: [56, 130],
    mgl: [64, 144],
    rpg7: [64, 204],
    panzerfaust: [56, 210],
    m202: [64, 196],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

export type HeldGunArtId = keyof typeof HELD_GUN_ART;

/**
 * The gun offset (body px) an own sprite is held with where it differs from the def's: the bullpups WA2000, Lynx, P90
 * and DP-12, whose sprites are drawn for survev's bullpup offset (-8, 0) (.survev/shared/defs/gameObjects/gunDefs.ts
 * famas, qbb97, groza, grozas); the balance sheet gave them none, which would float the butt in front of the body and
 * put the right hand on the butt plate (the P90's 116 px sprite would end 10 body px past the bullet origin instead
 * of 2).
 * Client-only, like all of worldImg (objects/playerGun.ts); rebirth/newGuns.json and its bar keep the sheet's values.
 * Keyed by gun id: the client applies an entry to the own sprite only, so it acts once the gun is in HELD_GUN_ART.
 */
export const HELD_GUN_ART_GUN_OFFSET: Readonly<Partial<Record<string, { x: number; y: number }>>> = {
    wa2000: { x: -8, y: 0 },
    lynx: { x: -8, y: 0 },
    p90: { x: -8, y: 0 },
    dp12: { x: -8, y: 0 },
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
    // the launchers' shared (7, 2) (the potato cannon's) puts it 13 sprite px in front of the empty RPG-7's muzzle
    // (gun-rpg7-empty-01: no warhead); at (-2, 2) it holds the front grip on the steel tube
    rpg7: { x: -2, y: 2 },
};

/**
 * Own sprites drawn with an empty variant, gun-<id>-empty-01.img at the same size: the RPG-7 without its warhead,
 * shown while its one round is fired and not yet reloaded (owner, 2026-10-08: "RPG-7 발사시에는 탄두가 안
 * 꽂혀있는모습으로"; apps/client objects/gunLoad.ts decides). Client-only like the other overrides.
 */
export const HELD_GUN_ART_EMPTY: readonly HeldGunArtId[] = ["rpg7"];

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

/** Sprite id of a drawn gun's empty held image (HELD_GUN_ART_EMPTY). */
export function heldGunArtEmptySprite(id: string): string {
    return `gun-${id}-empty-01.img`;
}

/** Every drawn held sprite with its size (the client's sprite manifest entries; the empty variants: heldGunArtEmpty). */
export function heldGunArt(): HeldGunArt[] {
    return (Object.keys(HELD_GUN_ART) as HeldGunArtId[]).map((id) => ({
        id,
        sprite: heldGunArtSprite(id),
        size: HELD_GUN_ART[id],
    }));
}

/** The drawn empty variants with their size (the same as the loaded sprite's). */
export function heldGunArtEmpty(): HeldGunArt[] {
    return HELD_GUN_ART_EMPTY.map((id) => ({ id, sprite: heldGunArtEmptySprite(id), size: HELD_GUN_ART[id] }));
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
