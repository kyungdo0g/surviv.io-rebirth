// The area a snapshot covers (survev client.ts camera): split out of game.ts, which re-exports it.
import type { Bounds, Vec2 } from "@rebirth/core";
import type { ObjectView } from "./view.ts";
import type { Entity } from "./world/world.ts";

/** Visible area margin around the camera, in world units (survev client.ts adds 4 to the zoom). */
export const VIEW_MARGIN = 4;
/** The client camera keeps a 16:9 aspect: `zoom` is half the larger screen dimension (survev client.ts). */
export const VIEW_ASPECT = 16 / 9;

/** World-space rectangle a player with camera radius `zoom` at `pos` can see, margin included. */
export function viewBounds(pos: Vec2, zoom: number): Bounds {
    const halfW = zoom + VIEW_MARGIN;
    const halfH = zoom / VIEW_ASPECT + VIEW_MARGIN;
    return { min: { x: pos.x - halfW, y: pos.y - halfH }, max: { x: pos.x + halfW, y: pos.y + halfH } };
}

export function entityView(entity: Entity): ObjectView {
    return entity.toView();
}
