// Planes and falling air drops (survev client/src/objects/plane.ts PlaneBarn and objects/airdrop.ts AirdropBarn;
// docs/research/mechanics/airdrop-airstrike.md):
// - a plane is its biome sprite (`biome.airdrop.planeImg`, a blurred black silhouette: the plane's shadow on the
//   ground) of radius planeRad, flying along `dir` at planeVel between snapshots, at alpha 0.75 (0.15 while the
//   viewer is indoors, 0 underground), growing to 1.25x and fading to 0.75x over 2 s after its drop, with its
//   looping positional sound (`biome.airdrop.planeSound`, range x2.5);
// - a falling crate is the chute sprite (`biome.airdrop.airdropImg`) whose radius shrinks from 12 to 5 over the
//   fall (lerp((1 - fallT)^1.1, 5, 12)), with the chute and falling sounds; on landing 10 smoke puffs and the
//   crash sound (the water variant on water).
// Both draw on the top layer (zOrd 1500 / 1501), below the red zone.
import type { Vec2 } from "@rebirth/core";
import { GameConfig, type MapDef } from "@rebirth/defs";
import type { AirdropView, PlaneView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine, SoundHandle } from "../audio/audio.ts";
import type { ParticleSystem } from "../fx/particles.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";

/** survev plane.ts constants */
const PLANE_ELEVATE_MULT = 1.25;
const PLANE_ALPHA = 0.75;
const PLANE_ALPHA_MULT = 0.75;
const PLANE_ELEVATE_TIME = 2;
/** a plane that left the view before its drop is forgotten after this long (s) */
const PLANE_UNSEEN_TIME = 2;
/** the client snaps a plane to the server position once they drift this far apart */
const PLANE_RECONCILE_DIST = 8;
const PLANE_Z_ORD = 1501;
const AIRDROP_Z_ORD = 1500;
/** both sprites are tinted yellow in the original (no visible change on the dark art) */
const AIR_TINT = 0xffff00;
const SOUND_UPDATE_INTERVAL = 0.1;
/** chute and falling sounds carry 1.75x the sfx range (survev airdrop.ts) */
const AIRDROP_SOUND_RANGE = 1.75;
const LANDING_SMOKE = 10;

interface PlaneState {
    id: number;
    sprite: Sprite;
    type: PlaneView["planeType"];
    pos: Vec2;
    dir: Vec2;
    actionComplete: boolean;
    rad: number;
    alpha: number;
    renderAlpha: number;
    elevateTime: number;
    sound: SoundHandle | null;
    soundThrottle: number;
    seen: boolean;
    /** seconds since the plane was last in a snapshot */
    unseen: number;
}

interface AirdropState {
    id: number;
    sprite: Sprite;
    pos: Vec2;
    fallTicker: number;
    landed: boolean;
    /** it was already on the ground when first seen: no landing effects */
    isNew: boolean;
    playedLandFx: boolean;
    chuteDeployed: boolean;
    fallSound: SoundHandle | null;
    soundThrottle: number;
    seen: boolean;
}

export interface AirDeps {
    renderer: Renderer;
    textures: TextureStore;
    audio: AudioEngine;
    particles: ParticleSystem;
    mapDef: MapDef;
    /** whether a position is water (landing splash sound) */
    isWater: (pos: Vec2) => boolean;
}

export interface AirFrame {
    dt: number;
    /** position and layer the camera follows */
    viewerPos: Vec2;
    viewerLayer: number;
    viewerIndoors: boolean;
}

function planeConfig(type: PlaneView["planeType"]) {
    return type === "airdrop" ? GameConfig.airdrop : GameConfig.airstrike;
}

export class AirSystem {
    private readonly deps: AirDeps;
    private readonly planes = new Map<number, PlaneState>();
    private readonly airdrops = new Map<number, AirdropState>();

    constructor(deps: AirDeps) {
        this.deps = deps;
        const airdrop = deps.mapDef.biome.airdrop;
        deps.audio.preload(
            [airdrop.planeSound, "airdrop_chute_01", "airdrop_fall_01", "airdrop_crash_01", "airdrop_crash_02"],
            "sfx",
        );
    }

    /** planes and falling crates drawn last frame (tests) */
    get counts(): { planes: number; airdrops: number } {
        let planes = 0;
        let airdrops = 0;
        for (const p of this.planes.values()) if (p.sprite.visible) planes++;
        for (const a of this.airdrops.values()) if (a.sprite.visible) airdrops++;
        return { planes, airdrops };
    }

    /** Applies a snapshot's planes and air drops (each list is complete for the view). */
    apply(planes: readonly PlaneView[], airdrops: readonly AirdropView[]): void {
        for (const p of this.planes.values()) p.seen = false;
        for (const data of planes) {
            let p = this.planes.get(data.id);
            if (!p || p.type !== data.planeType) {
                if (p) this.freePlane(p);
                p = this.createPlane(data);
                this.planes.set(data.id, p);
            }
            p.seen = true;
            p.unseen = 0;
            p.actionComplete = data.actionComplete;
            if (Math.hypot(p.pos.x - data.pos.x, p.pos.y - data.pos.y) > PLANE_RECONCILE_DIST) {
                p.pos = { x: data.pos.x, y: data.pos.y };
            }
        }
        // a plane that left the view is freed once fully elevated (survev Plane.m_free), or after a while
        for (const p of [...this.planes.values()]) {
            if (!p.seen && (p.elevateTime >= PLANE_ELEVATE_TIME || p.unseen > PLANE_UNSEEN_TIME)) this.freePlane(p);
        }

        for (const a of this.airdrops.values()) a.seen = false;
        for (const data of airdrops) {
            let a = this.airdrops.get(data.id);
            if (!a) {
                a = this.createAirdrop(data);
                this.airdrops.set(data.id, a);
            }
            a.seen = true;
            a.pos = { x: data.pos.x, y: data.pos.y };
            a.landed = data.landed;
        }
        for (const a of [...this.airdrops.values()]) if (!a.seen) this.freeAirdrop(a);
    }

    private createPlane(data: PlaneView): PlaneState {
        const sprite = this.deps.renderer.pool.acquire();
        const img = data.planeType === "airdrop" ? this.deps.mapDef.biome.airdrop.planeImg : "map-plane-02.img";
        this.deps.textures.apply(sprite, img, 2);
        sprite.tint = AIR_TINT;
        const config = planeConfig(data.planeType);
        return {
            id: data.id,
            sprite,
            type: data.planeType,
            pos: { x: data.pos.x, y: data.pos.y },
            dir: { x: data.dir.x, y: data.dir.y },
            actionComplete: data.actionComplete,
            rad: config.planeRad,
            alpha: PLANE_ALPHA,
            renderAlpha: 1,
            elevateTime: 0,
            sound: null,
            soundThrottle: 0,
            seen: true,
            unseen: 0,
        };
    }

    private createAirdrop(data: AirdropView): AirdropState {
        const sprite = this.deps.renderer.pool.acquire();
        this.deps.textures.apply(sprite, this.deps.mapDef.biome.airdrop.airdropImg, 1.5);
        sprite.tint = AIR_TINT;
        sprite.visible = false;
        return {
            id: data.id,
            sprite,
            pos: { x: data.pos.x, y: data.pos.y },
            fallTicker: data.fallT * GameConfig.airdrop.fallTime,
            landed: data.landed,
            isNew: true,
            playedLandFx: false,
            chuteDeployed: false,
            fallSound: null,
            soundThrottle: 0,
            seen: true,
        };
    }

    private freePlane(p: PlaneState): void {
        this.deps.audio.stop(p.sound);
        this.deps.renderer.pool.release(p.sprite);
        this.planes.delete(p.id);
    }

    private freeAirdrop(a: AirdropState): void {
        this.deps.audio.stop(a.fallSound);
        this.deps.renderer.pool.release(a.sprite);
        this.airdrops.delete(a.id);
    }

    update(f: AirFrame): void {
        // planes fly over everything; a viewer on stairs sees them too (survev: layer |= 2)
        const layer = 2;
        for (const p of this.planes.values()) this.updatePlane(p, f, layer);
        for (const a of this.airdrops.values()) this.updateAirdrop(a, f, layer);
    }

    private updatePlane(p: PlaneState, f: AirFrame, layer: number): void {
        const config = planeConfig(p.type);
        const audio = this.deps.audio;
        p.unseen += f.dt;
        p.pos = { x: p.pos.x + p.dir.x * f.dt * config.planeVel, y: p.pos.y + p.dir.y * f.dt * config.planeVel };
        let rangeMult = config.soundRangeMult;
        if (p.actionComplete) {
            // after the drop the plane climbs: bigger and fainter (survev PlaneBarn.m_update)
            p.elevateTime = Math.min(p.elevateTime + f.dt, PLANE_ELEVATE_TIME);
            const t = p.elevateTime;
            p.rad = config.planeRad + (config.planeRad * PLANE_ELEVATE_MULT - config.planeRad) * t;
            p.alpha = PLANE_ALPHA + (PLANE_ALPHA * PLANE_ALPHA_MULT - PLANE_ALPHA) * t;
            rangeMult = Math.max(0, config.soundRangeMult - config.soundRangeDelta * t);
        }
        if (p.sound) {
            p.soundThrottle -= f.dt;
            if (p.soundThrottle < 0) {
                p.soundThrottle = SOUND_UPDATE_INTERVAL;
                audio.updateSound(p.sound, "sfx", {
                    pos: p.pos,
                    layer,
                    rangeMult,
                    ignoreMinAllowable: true,
                    fallOff: config.fallOff,
                });
            }
        } else {
            const dist = Math.hypot(f.viewerPos.x - p.pos.x, f.viewerPos.y - p.pos.y);
            if (dist < config.soundRangeMax * config.soundRangeMult) {
                const sound = p.type === "airdrop" ? this.deps.mapDef.biome.airdrop.planeSound : "fighter_01";
                p.sound = audio.playSound(sound, {
                    channel: "sfx",
                    pos: p.pos,
                    layer,
                    loop: true,
                    rangeMult: 2.5,
                    ignoreMinAllowable: true,
                    fallOff: config.fallOff,
                    late: true,
                });
            }
        }
        let alphaTarget = p.alpha;
        if (f.viewerLayer === 1) alphaTarget = 0;
        else if (f.viewerIndoors || f.viewerLayer & 1) alphaTarget = 0.15;
        p.renderAlpha += (alphaTarget - p.renderAlpha) * Math.min(1, f.dt * 3);
        const s = p.sprite;
        const local = toLocal(p.pos);
        s.position.set(local.x, local.y);
        // survev: screen scale = rad / ppu, i.e. the 256 px art spans rad * 256 / 16 pixels at zoom 1
        s.scale.set(p.rad / PIXELS_PER_UNIT);
        s.rotation = Math.atan2(p.dir.x, p.dir.y);
        s.alpha = p.renderAlpha;
        s.visible = true;
        this.deps.renderer.add(s, layer, PLANE_Z_ORD, p.id);
    }

    private updateAirdrop(a: AirdropState, f: AirFrame, layer: number): void {
        const audio = this.deps.audio;
        a.fallTicker += f.dt;
        const fallT = Math.min(1, Math.max(0, a.fallTicker / GameConfig.airdrop.fallTime));
        if (a.landed && !a.playedLandFx) {
            a.playedLandFx = true;
            if (!a.isNew) {
                for (let i = 0; i < LANDING_SMOKE; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    this.deps.particles.add("airdropSmoke", layer, a.pos, { x: Math.cos(ang), y: Math.sin(ang) });
                }
                const water = this.deps.isWater(a.pos);
                audio.playSound(water ? "airdrop_crash_02" : "airdrop_crash_01", { channel: "sfx", pos: a.pos, layer });
                audio.stop(a.fallSound);
                a.fallSound = null;
            }
        }
        if (!a.chuteDeployed && fallT <= 0.1) {
            audio.playSound("airdrop_chute_01", { channel: "sfx", pos: a.pos, layer, rangeMult: AIRDROP_SOUND_RANGE });
            a.chuteDeployed = true;
        }
        if (!a.landed && !a.fallSound) {
            a.fallSound = audio.playSound("airdrop_fall_01", {
                channel: "sfx",
                pos: a.pos,
                layer,
                rangeMult: AIRDROP_SOUND_RANGE,
                ignoreMinAllowable: true,
                offset: a.fallTicker,
            });
        }
        if (a.fallSound) {
            a.soundThrottle -= f.dt;
            if (a.soundThrottle < 0) {
                a.soundThrottle = SOUND_UPDATE_INTERVAL;
                audio.updateSound(a.fallSound, "sfx", {
                    pos: a.pos,
                    layer,
                    rangeMult: AIRDROP_SOUND_RANGE,
                    ignoreMinAllowable: true,
                });
            }
        }
        const rad = 5 + (12 - 5) * (1 - fallT) ** 1.1;
        const s = a.sprite;
        const local = toLocal(a.pos);
        s.position.set(local.x, local.y);
        s.scale.set((2 * rad) / PIXELS_PER_UNIT);
        s.alpha = 1;
        s.visible = !a.landed;
        this.deps.renderer.add(s, layer, AIRDROP_Z_ORD, a.id);
        a.isNew = false;
    }

    clear(): void {
        for (const p of [...this.planes.values()]) this.freePlane(p);
        for (const a of [...this.airdrops.values()]) this.freeAirdrop(a);
    }
}
