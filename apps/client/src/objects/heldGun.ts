// The held (top-down) image of a gun. The rebirth's beta new guns have no top-down art yet (owner, 2026-10-07: "if
// there's no texture, just hold a bar"): a new gun draws its own gun-<id>-01.img once the sprite manifest has it, else
// a plain bar, the original bar sprites (gun-short-01 / gun-med-01 / gun-long-01: a white capsule with a dark outline,
// tinted) stretched to the gun's barrel length the way the original bar guns are. The balance sheet's own bar entries
// (docs/design/new-gun-stats.json worldImg, already sized that way) are kept; the ones it borrowed from another gun's
// art (the potato cannon for the launchers, the AWM-S for the Hécate II and the Lynx, the PKP for the belt guns) become
// a long bar sized and tinted by gun class. Every other gun draws its def's worldImg unchanged.
import { GameObjectDefs, type GunDef, gunClass, NEW_GUN_IDS } from "@rebirth/defs";
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

/** The image `def` is held with (see the header). */
export function heldGunImage(def: GunDef): HeldGunImage {
    const id = gunId(def);
    const img = def.worldImg;
    if (!id || !NEW_GUNS.has(id)) return img;
    const own = ownHeldSprite(id);
    if (SPRITES[own]?.path) {
        return { ...img, sprite: own, scale: { x: 0.5, y: 0.5 }, tint: 0xffffff, magImg: undefined };
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

/** Length in sprite pixels of a held image drawn with the bar sprites (tests). */
export function barLength(img: HeldGunImage): number | undefined {
    return isBarSprite(img.sprite) ? BARS[img.sprite as keyof typeof BARS] * img.scale.y * 0.5 : undefined;
}
