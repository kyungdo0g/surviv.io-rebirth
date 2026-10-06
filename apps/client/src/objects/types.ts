// Shared shapes of the per-object views that turn snapshot ObjectViews into Pixi display objects.
import type { Vec2 } from "@rebirth/core";
import type { MapDef } from "@rebirth/defs";
import type { ObjectView, ObstacleView, PlayerView } from "@rebirth/sim";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import type { ParticleSystem } from "../fx/particles.ts";
import type { ViewBounds } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";
import type { AnimEffect } from "./anims.ts";
import type { FadingSprites } from "./fading.ts";

/** Hooks the player view calls for sounds and particles (implemented by fx/effects.ts). */
export interface PlayerFx {
    /** an animation reached a sound or melee-hit keyframe */
    animEffect(player: PlayerView, pos: Vec2, dir: Vec2, effect: AnimEffect): void;
    /** a reload or item use started or was cancelled (`player.action.seq` changed) */
    actionStart(player: PlayerView, pos: Vec2, dir: Vec2): void;
    /** a gun fired (`player.shot.seq` changed) */
    shot(player: PlayerView, pos: Vec2, dir: Vec2): void;
}

/** Hooks the obstacle view calls for sounds and particles (implemented by fx/effects.ts) (M4). */
export interface ObstacleFx {
    /** a button was used (`button.seq` changed): use particle and on/off sound */
    obstacleButton(view: ObstacleView, center: Vec2): void;
    /** the obstacle was destroyed while in view: explode particles and sound */
    obstacleDestroyed(view: ObstacleView, center: Vec2): void;
}

/** Long-lived services every view needs. */
export interface ViewDeps {
    renderer: Renderer;
    textures: TextureStore;
    mapDef: MapDef;
    fx?: PlayerFx & Partial<ObstacleFx>;
    /** particles and emitters (M5: heal effects, chimney smoke, roof collapses) */
    particles?: ParticleSystem;
    /** sounds of map objects (M5: doors, puzzles, roof collapses, sound emitters) */
    audio?: AudioEngine;
    /** where the camera's player is drawn (puzzle sounds play at the piece nearest to it) */
    viewerPos?: () => Vec2;
    /** sprites fading out after their object was removed (decals with a lifetime) */
    fading?: FadingSprites;
    /** ground surface at a position ("water" for decals drawn faint in water) */
    surfaceAt?: (pos: Vec2, layer: number) => string;
    /** team of a player (PlayerInfoView.teamId; faction maps: 1 Red, 2 Blue), 0 when unknown (M7) */
    teamOf?: (playerId: number) => number;
}

/** Per-frame state handed to every view. */
export interface FrameContext {
    dt: number;
    /** interpolated local player position */
    localPos: Vec2;
    /** map layer of the local player */
    localLayer: number;
    localId: number;
}

export interface ObjectRender<V extends ObjectView = ObjectView> {
    readonly id: number;
    /** Applies the latest snapshot state. */
    setData(view: V, isNew: boolean): void;
    /** Positions and orders the display objects; `pos` is the interpolated position. */
    update(ctx: FrameContext, pos: Vec2): void;
    /** World-space box around everything the view draws, at `pos`. */
    bounds(pos: Vec2): ViewBounds;
    setVisible(visible: boolean): void;
    /** Releases pooled display objects. */
    destroy(): void;
}

/** Multiplies the HSV value of `tint` by `factor` (biome valueAdjust; survev util.adjustValue). */
export function adjustValue(tint: number, factor: number): number {
    if (factor >= 1) return tint;
    const r = ((tint >> 16) & 0xff) * factor;
    const g = ((tint >> 8) & 0xff) * factor;
    const b = (tint & 0xff) * factor;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function boxAround(pos: Vec2, rad: number): ViewBounds {
    return { min: { x: pos.x - rad, y: pos.y - rad }, max: { x: pos.x + rad, y: pos.y + rad } };
}
