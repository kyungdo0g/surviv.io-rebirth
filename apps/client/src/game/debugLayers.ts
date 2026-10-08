// Layer visibility test hooks on window.__rebirth (read by tests/e2e/underground-fx.spec.ts): for every kind of thing
// drawn over the floor (planes, falling air drops and their landing smoke, smoke clouds, flares, the in-world air strike
// circles, emote bubbles), how many exist, how many are drawn this frame and on which render layers.
import type { Container } from "pixi.js";
import { debugGlobals } from "../globals.ts";
import type { GameClient } from "./client.ts";

/** Display objects of one kind: how many exist, how many are drawn, and the render layer of each drawn one. */
export interface LayerFxKind {
    live: number;
    drawn: number;
    /** render layer index (0-3) of each drawn object, -1 outside the render layers (screen space) */
    layers: number[];
    /** render layer index of every live object, drawn or not */
    liveLayers: number[];
}

export function exposeLayerFx(client: GameClient): void {
    const renderer = client.renderer;
    const layerOf = (o: Container) => (o.parent ? renderer.layers.indexOf(o.parent) : -1);
    const describe = (objs: readonly Container[]): LayerFxKind => {
        const drawn = objs.filter((o) => renderer.drawn(o));
        return { live: objs.length, drawn: drawn.length, layers: drawn.map(layerOf), liveLayers: objs.map(layerOf) };
    };
    debugGlobals().layerFx = {
        get kinds(): Record<string, LayerFxKind> {
            const air = client.air?.sprites ?? { planes: [], airdrops: [] };
            return {
                planes: describe(air.planes),
                airdrops: describe(air.airdrops),
                airdropSmoke: describe(client.particles.spritesOf("airdropSmoke")),
                smokes: describe(client.worldFx?.smokes.sprites ?? []),
                flares: describe(client.bullets.flares.containers),
                zones: describe(client.minimap?.airstrikeZones.worldGraphics ?? []),
                emotes: describe(client.teamPlay.emotes.bubbleContainers),
            };
        },
        /** the renderer's active layer, its underground flag and fade */
        get view() {
            return { layer: renderer.activeLayer, underground: renderer.underground, fade: renderer.layerFade };
        },
    };
}
