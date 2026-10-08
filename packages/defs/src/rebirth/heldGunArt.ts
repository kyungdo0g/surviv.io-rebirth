// Top-down held sprites drawn for the rebirth (the owner, 2026-10-08: "draw only 5 first", then the snipers and DMRs):
// our own art, minimal hand-written SVGs committed under apps/client/public/rebirth/guns/gun-<id>-01.svg and served
// at /rebirth/guns/, like the rebirth buildings' images (buildings.ts rebirthBuildingArt). Each is the gun seen from
// straight above, barrel up, butt flush with the bottom edge, drawn at worldImg.scale 0.5 in its own colours (tint
// white): the rifles 48 px wide like the original rifle sprites (gun-m4a1-01, gun-famas-01), the bolt snipers and the
// bullpups 60 like gun-awc-01 and gun-scarssr-01 (the width moves nothing in game: the anchor is the bottom centre).
// The client's sprite manifest lists them (apps/client assets/rebirthSprites.ts); a beta new gun switches to its own
// sprite as soon as the manifest has it (apps/client objects/heldGun.ts), and the AK-47, an original gun, gets it here
// as a presentation deviation of its worldImg. Hands and recoil stay as they were: the sprites are drawn to sit under
// the existing grips; only the two bullpups' own sprites get survev's bullpup gun offset (HELD_GUN_ART_GUN_OFFSET).
// The Mk 14 EBR stays a bar on purpose (owner, 2026-10-08: "Mk 14 EBR만 막대기로"): never add it here.
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
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

export type HeldGunArtId = keyof typeof HELD_GUN_ART;

/**
 * The gun offset (body px) an own sprite is held with where it differs from the def's: the bullpups WA2000 and Lynx,
 * whose sprites are drawn for survev's bullpup offset (-8, 0) (.survev/shared/defs/gameObjects/gunDefs.ts famas, qbb97,
 * groza, grozas); the balance sheet gave them none, which would float the butt in front of the body and put the right
 * hand on the butt plate. Client-only, like all of worldImg (objects/playerGun.ts); rebirth/newGuns.json and its bar
 * keep the sheet's values.
 */
export const HELD_GUN_ART_GUN_OFFSET: Readonly<Partial<Record<HeldGunArtId, { x: number; y: number }>>> = {
    wa2000: { x: -8, y: 0 },
    lynx: { x: -8, y: 0 },
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
