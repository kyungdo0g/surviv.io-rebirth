// The military base's images (packages/defs rebirth/buildings/military/): each part's images drawn by the drawer of
// its sprite (compound.ts the yard's markings and perimeter strips, axis.ts the HQ, stand, gatehouse and towers,
// wings.ts the infirmary, armory, storehouse and garage, bunker.ts the basement), each in its own frame (the image's
// box in its part's frame, at REBIRTH_ART_PX_PER_UNIT; svg() writes it at the image's `ppu`). A faction image is drawn
// once per base (main, red, blue).
import {
    imagePpu,
    MILITARY_BASES,
    MILITARY_PARTS,
    type MilitaryBase,
    type MilitaryPart,
    militarySprite,
    type PartImage,
} from "../../../../packages/defs/src/rebirth/buildings.ts";
import { boxFrame, type Frame } from "../svg.ts";
import { AXIS_ART } from "./axis.ts";
import { BUNKER_ART } from "./bunker.ts";
import { COMPOUND_ART } from "./compound.ts";
import { WINGS_ART } from "./wings.ts";

/** What a drawer gets: the part, the image (its frame in the part's frame), the base, the pixels per unit to write. */
export interface MilitaryArtContext {
    readonly part: MilitaryPart;
    readonly img: PartImage;
    readonly base: MilitaryBase;
    readonly fr: Frame;
    readonly ppu: number;
}

/** Draws one image: the SVG text (svg(ctx.fr, body, ctx.ppu)). */
export type MilitaryDrawer = (ctx: MilitaryArtContext) => string;

/** The drawers by sprite id (a faction image's main id). */
export const MILITARY_DRAWERS: Readonly<Record<string, MilitaryDrawer>> = {
    ...COMPOUND_ART,
    ...AXIS_ART,
    ...WINGS_ART,
    ...BUNKER_ART,
};

/** Every military base image: sprite id -> SVG text (an image placed several times is drawn at its first place). */
export function militarySvgs(): Map<string, string> {
    const out = new Map<string, string>();
    for (const part of MILITARY_PARTS) {
        for (const img of part.images) {
            const draw = MILITARY_DRAWERS[img.sprite];
            if (!draw) throw new Error(`military base art: no drawer for ${img.sprite}`);
            for (const base of part.factionVariants && img.faction ? MILITARY_BASES : [MILITARY_BASES[0]]) {
                const sprite = militarySprite(img, base);
                if (out.has(sprite)) continue;
                const fr = boxFrame(img.centre.x, img.centre.y, img.size[0], img.size[1]);
                out.set(sprite, draw({ part, img, base, fr, ppu: imagePpu(img) }));
            }
        }
    }
    return out;
}
