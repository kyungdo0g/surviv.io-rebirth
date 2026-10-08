// Which sprites (and at what definition scale) a map or a player outfit needs, for batched preloading.
import { GameObjectDefs, MapObjectDefs, type OutfitDef } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";

export type SpriteRequest = readonly [id: string, scale: number];

/** Sprites of one map object type, recursing into building children and structure layers. */
export function mapObjectSprites(type: string, out: Map<string, number>, seen = new Set<string>()): void {
    if (seen.has(type)) return;
    seen.add(type);
    const def = MapObjectDefs[type];
    if (!def) return;
    const add = (id: string | undefined, scale = 1) => {
        if (id) out.set(id, Math.max(out.get(id) ?? 0, scale));
    };
    switch (def.type) {
        case "obstacle": {
            const scale = def.img.scale ?? 1;
            add(def.img.sprite, scale);
            add(def.img.residue, scale);
            add(def.door?.casingImg?.sprite, def.door?.casingImg?.scale);
            add(def.button?.useImg, scale);
            add(def.button?.offImg, scale);
            break;
        }
        case "building":
            for (const img of [...def.floor.imgs, ...def.ceiling.imgs]) add(img.sprite, img.scale);
            for (const child of def.mapObjects) {
                const types = typeof child.type === "string" ? [child.type] : Object.keys(child.type);
                for (const t of types) if (t) mapObjectSprites(t, out, seen);
            }
            break;
        case "structure":
            for (const layer of def.layers) mapObjectSprites(layer.type, out, seen);
            break;
        case "decal":
            add(def.img.sprite, def.img.scale);
            break;
        default:
            break;
    }
}

/** Every sprite the map objects of `map` can show. */
export function mapSprites(map: MapData): Map<string, number> {
    const out = new Map<string, number>();
    const seen = new Set<string>();
    for (const obj of map.objects) mapObjectSprites(obj.type, out, seen);
    return out;
}

/** Body, hands, feet and backpack sprites of an outfit (scales from survev player.ts updateVisuals). */
export function outfitSprites(outfitId: string, out: Map<string, number>): void {
    const def = GameObjectDefs[outfitId] as OutfitDef | undefined;
    if (def?.type !== "outfit") return;
    const add = (id: string, scale: number) => out.set(id, Math.max(out.get(id) ?? 0, scale));
    add(def.skinImg.baseSprite, 0.25);
    // survev's Aurora and Spring Tree outfits name a left and a right hand (survev player.ts:1530-1532)
    const hands = def.skinImg.handSprite;
    if (typeof hands === "string") add(hands, 0.175);
    else for (const hand of [hands.left, hands.right]) add(hand, 0.175);
    add(def.skinImg.footSprite, 0.45);
    add(def.skinImg.backpackSprite, 0.25);
}
