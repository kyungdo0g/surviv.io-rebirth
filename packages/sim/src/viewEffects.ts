// Contract types of the M5 effect sections (explosions, projectiles, smoke, air strike zones, recorders), re-exported
// from view.ts (whose header documents them); consumers import them from "@rebirth/sim".
import type { Vec2 } from "@rebirth/core";

/** A recorder obstacle was used: the client plays its recording (the def's `button.sound.on`) at `pos` (M5b). */
export interface RecorderEvent {
    /** object id of the recorder obstacle */
    id: number;
    /** MapObjectDefs id, e.g. "recorder_04" */
    type: string;
    /** sound id of the recording (the def's button.sound.on), e.g. "log_04" */
    sound: string;
    pos: Vec2;
    layer: number;
}

/** An explosion (the original UpdateMsg explosion record): the client plays its `explosionEffectType` (M5). */
export interface ExplosionEvent {
    /** GameObjectDefs explosion id, e.g. "explosion_frag" */
    type: string;
    pos: Vec2;
    layer: number;
}

/** A flying projectile (the original Projectile object) (M5). */
export interface ProjectileView {
    /** projectile id (1..65535, its own id space, reused after a while) */
    id: number;
    /** GameObjectDefs throwable id (drawn with its `worldImg`), e.g. "frag", "bomb_iron", "potato_cannonball" */
    type: string;
    pos: Vec2;
    /** height above the ground, 0..GameConfig.projectile.maxHeight (the client scales the sprite with it) */
    posZ: number;
    /** unit direction of travel */
    dir: Vec2;
    layer: number;
}

/** One smoke cloud (the original Smoke object): grows to its radius, drifts slowly, vanishes with its emitter (M5). */
export interface SmokeView {
    /** smoke id (1..65535, its own id space) */
    id: number;
    pos: Vec2;
    /** current radius (at most 6.5) */
    rad: number;
    layer: number;
    /** emitted inside a building (drawn below the roof) */
    interior: boolean;
}

/** A 50v50 air strike zone: a yellow circle on the map for its whole duration (M5). */
export interface AirstrikeZoneView {
    /** zone id (1..255) */
    id: number;
    pos: Vec2;
    rad: number;
    /** total duration in seconds (at most 60) */
    duration: number;
    /** progress 0..1 (the client fades the circle in and out over 0.5 s at each end) */
    zoneT: number;
}
