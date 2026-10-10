// The held (top-down) image of a gun. Most of the rebirth's beta new guns have no top-down art yet (owner, 2026-10-07:
// "if there's no texture, just hold a bar"): a new gun draws its own gun-<id>-01.img once the sprite manifest has it
// (the drawn ones, packages/defs rebirth/heldGunArt.ts: the G36C, M16A4, SIG 550 and G3, then the FN FAL, WA2000, M200,
// Hécate II, Lynx and Boys, then the PP-19 Bizon, AS Val, P90 and TEC-9, then the DP-12, AA-12, M60, MG 42 and DShK,
// then the M79, GL-06, MGL, RPG-7, Panzerfaust and M202, all 2026-10-08, then the PAW20, 2026-10-10, committed SVGs
// under /rebirth/guns/; a dual
// pistol holds its single's sprite in each hand, ownHeldSprite; the RPG-7 draws gun-rpg7-empty-01, no warhead, while
// its round is fired and not yet reloaded, objects/gunLoad.ts), at scale 0.5 in its own colours with the sheet's hands
// and recoil and its gun offset, but for the rebirth's own-sprite overrides (the bullpups' own sprites take survev's
// (-8, 0), HELD_GUN_ART_GUN_OFFSET; the P90's is held with both hands under it, HELD_GUN_ART_HANDS_BELOW; the AS Val's
// left hand sits on its forend and the RPG-7's on its tube, HELD_GUN_ART_LEFT_HAND_OFFSET), and with no magazine
// sprite (the belt guns draw their box and belt into the one sprite, so the PKP bottom sprite the sheet borrowed for
// them never shows on it), else a plain bar, the original bar sprites (gun-short-01 / gun-med-01 / gun-long-01: a
// white capsule with a dark outline, tinted) stretched to the gun's barrel length the way the original bar guns are.
// The balance sheet's own bar entries (docs/design/new-gun-stats.json worldImg, already sized that way) are kept; the
// ones it borrowed from another gun's art (the potato cannon for the launchers; the PKP for the M60, MG 42 and DShK and
// the AWM-S for the Hécate II and the Lynx, all now drawn) become a long bar sized and tinted by gun class. The Mk 14
// EBR, the Thompson M1928 and the Škorpion vz. 61 (single and dual) stay bars on purpose (owner). Every other gun draws
// its def's worldImg unchanged (the AK-47's own drawn sprite comes with its def: heldGunArt.ts applyHeldGunArt).
// Rebirth, 2026-10-10: the guns of the owner's top-down sheets (OWNER_HELD_GUN_ART: the second wave and survev's Model
// 94) draw the owner's sprite, installed from assets-user/, in the same way, once assets/ownerHeldArt.ts has found it
// installed; without it they keep the above.
import {
    GameObjectDefs,
    type GunDef,
    gunClass,
    HELD_GUN_ART_EMPTY,
    HELD_GUN_ART_GUN_OFFSET,
    HELD_GUN_ART_HANDS_BELOW,
    HELD_GUN_ART_LEFT_HAND_OFFSET,
    heldGunArtEmptySprite,
    NEW_GUN_IDS,
    OWNER_HELD_GUN_ART,
    ownerHeldGunArtSprite,
} from "@rebirth/defs";
import { ownerHeldArtInstalled } from "../assets/ownerHeldArt.ts";
import { SPRITES } from "../assets/spriteManifest.ts";

export type HeldGunImage = GunDef["worldImg"];

/** The original bar sprites and their logical heights (sprite-manifest sizes 32 x 100 / 128 / 188). */
const BARS = {
    "gun-short-01.img": 100,
    "gun-med-01.img": 128,
    "gun-long-01.img": 188,
} as const;
const LONG_BAR = "gun-long-01.img";
/**
 * Bar length per unit of barrel length on gun-long-01, in sprite pixels (logical height x worldImg.scale.y x 0.5,
 * the draw scale of objects/playerGun.ts): 13.0-13.2 on the original long bar guns (ak47 3.15 -> 0.435, mosin 3.75 ->
 * 0.52, svd 4 -> 0.56; packages/defs generated gameObjects.json).
 */
const LONG_BAR_PX_PER_UNIT = 13.1;
/** Bar width (worldImg.scale.x) and tint of the classes whose sheet entry borrowed another gun's art. */
const CLASS_BAR: Readonly<Record<string, { width: number; tint: number }>> = {
    launcher: { width: 0.8, tint: 0x4b5320 },
    lmg: { width: 0.6, tint: 0x262626 },
    sniper: { width: 0.55, tint: 0x33362f },
};
const DEFAULT_BAR = { width: 0.5, tint: 0x2f2f2f };

const NEW_GUNS = new Set(NEW_GUN_IDS);
let idsByDef: Map<GunDef, string> | null = null;

/** The id of a gun def (defs are shared objects). */
function gunId(def: GunDef): string | undefined {
    if (!idsByDef) {
        idsByDef = new Map();
        for (const [id, d] of Object.entries(GameObjectDefs)) if (d.type === "gun") idsByDef.set(d, id);
    }
    return idsByDef.get(def);
}

/** The own top-down sprite a new gun would use (duals share the single's). */
export function ownHeldSprite(id: string): string {
    return `gun-${id.replace(/_dual$/, "")}-01.img`;
}

/** Whether `sprite` is one of the original plain bars. */
export function isBarSprite(sprite: string): boolean {
    return Object.hasOwn(BARS, sprite);
}

const EMPTY_ART = new Set<string>(HELD_GUN_ART_EMPTY);

/**
 * The image `def` is held with (see the header); `empty`: its magazine is empty (objects/gunLoad.ts), which draws
 * the own sprite's empty variant where one is drawn (HELD_GUN_ART_EMPTY: the RPG-7 without its warhead).
 */
export function heldGunImage(def: GunDef, empty = false): HeldGunImage {
    const id = gunId(def);
    const img = def.worldImg;
    const owner = !!id && Object.hasOwn(OWNER_HELD_GUN_ART, id) && ownerHeldArtInstalled(id);
    if (!id || (!NEW_GUNS.has(id) && !owner)) return img;
    const own = owner ? ownerHeldGunArtSprite(id) : ownHeldSprite(id);
    if (SPRITES[own]?.path) {
        const emptySprite = empty && EMPTY_ART.has(id) ? heldGunArtEmptySprite(id) : undefined;
        return {
            ...img,
            sprite: emptySprite && SPRITES[emptySprite]?.path ? emptySprite : own,
            scale: { x: 0.5, y: 0.5 },
            tint: 0xffffff,
            magImg: undefined,
            leftHandOffset: HELD_GUN_ART_LEFT_HAND_OFFSET[id] ?? img.leftHandOffset,
            gunOffset: HELD_GUN_ART_GUN_OFFSET[id] ?? img.gunOffset,
            handsBelow: HELD_GUN_ART_HANDS_BELOW[id] ?? img.handsBelow,
        };
    }
    if (isBarSprite(img.sprite)) return img;
    const style = CLASS_BAR[gunClass(id) ?? ""] ?? DEFAULT_BAR;
    // a gun held on the shoulder (gunOffset backwards: the launchers) gets the part behind the hand on top
    const rear = Math.max(0, -(img.gunOffset?.x ?? 0));
    const length = LONG_BAR_PX_PER_UNIT * def.barrelLength + rear;
    return {
        ...img,
        sprite: LONG_BAR,
        scale: { x: style.width, y: length / (BARS[LONG_BAR] * 0.5) },
        tint: img.tint === 0xffffff ? style.tint : img.tint,
        magImg: undefined,
    };
}

/** Whether `def`'s held image has an empty variant (objects/gunLoad.ts tracks only these). */
export function hasEmptyHeldImage(def: GunDef): boolean {
    const id = gunId(def);
    return !!id && EMPTY_ART.has(id);
}

/** Length in sprite pixels of a held image drawn with the bar sprites (tests). */
export function barLength(img: HeldGunImage): number | undefined {
    return isBarSprite(img.sprite) ? BARS[img.sprite as keyof typeof BARS] * img.scale.y * 0.5 : undefined;
}
