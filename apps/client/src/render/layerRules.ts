// Which render layer shows what to the viewer: the original client's layer rules (docs/research/mechanics/
// doors-layers-ceilings.md "Layers"). Map layers: 0 ground, 1 underground, 2/3 the stairs between them (bit 1 says
// which floor the stairs belong to, bit 2 that they are stairs). The renderer hides render layer 0 under the
// underground fill while the viewer is underground and fades render layer 1 out while the viewer is not on it
// (renderer.ts update); render layers 2 and 3 (the stairs and tall objects) are always drawn, so only what can be seen
// from the viewer's floor may be lifted onto them.

/** Whether two map layers see each other: same floor, or both on stairs (survev shared/utils/util.ts:47-51). */
export function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

/**
 * Map layer to draw something that stands over the floor of map layer `layer` (smoke clouds, flares, planes, falling
 * air drops and their landing smoke): lifted onto the stairs layers (bit 2, over the stairs and everything on both
 * floors) when it can be seen from the viewer's layer, except under a structure's stair mask while the viewer stands
 * on stairs; otherwise left on its own layer, where the renderer hides it with that floor (a surface air drop seen
 * from a bunker, a bunker smoke seen from the surface).
 * survev client/src/objects/smoke.ts:145-159; the same rule for objects on the ground in airdrop.ts:108-115,
 * plane.ts:268-276 and flare.ts:158-168. `insideStairMask` is only asked when it matters.
 */
export function overgroundLayer(layer: number, viewerLayer: number, insideStairMask: () => boolean): number {
    const onStairs = (viewerLayer & 2) !== 0;
    if ((sameLayer(layer, viewerLayer) || onStairs) && (layer === 1 || !onStairs || !insideStairMask())) {
        return layer | 2;
    }
    return layer;
}

/** Fade state of the renderer: underground layer alpha and ground cover (underground fill) alpha. */
export interface LayerFade {
    layer: number;
    ground: number;
}

/**
 * How much of an object on map layer `layer` the viewer sees (0-1) when it is drawn on the top layer while it shares
 * the viewer's layer and on its own layer otherwise, as the original draws emotes (survev client/src/emote.ts:
 * 1088-1092): stairs always show, the underground layer with its fade, the ground as far as the underground fill
 * leaves it uncovered.
 */
export function layerVisibility(layer: number, viewerLayer: number, fade: LayerFade): number {
    if (sameLayer(layer, viewerLayer) || layer & 2) return 1;
    return layer & 1 ? fade.layer : 1 - fade.ground;
}
