// The M5 world effects driven by snapshot sections rather than objects: explosions, flying projectiles, smoke clouds,
// recorders, fading decals, the ambience tracks with the structures' interior music, and the underground state of
// the listener (reverb, ground cover). The client creates one per map and feeds it every snapshot and frame.
// Rebirth: the rain of a rainy match (fx/weather.ts, user/2026-10-08-rain), decided by the client from the map seed.
import type { Vec2 } from "@rebirth/core";
import type { MapDef } from "@rebirth/defs";
import type { Snapshot, Terrain, TerrainShape } from "@rebirth/sim";
import { terrainSurfaceAt } from "@rebirth/sim";
import type { TextureStore } from "../assets/textures.ts";
import { Ambience } from "../audio/ambience.ts";
import type { AudioEngine } from "../audio/audio.ts";
import { InteriorSounds } from "../audio/interior.ts";
import { ExplosionSystem, explosionSounds } from "../fx/explosions.ts";
import type { ParticleSystem } from "../fx/particles.ts";
import { SmokeSystem } from "../fx/smoke.ts";
import { RainFx } from "../fx/weather.ts";
import type { FadingSprites } from "../objects/fading.ts";
import { ProjectileSystem } from "../objects/projectiles.ts";
import type { ObjectWorld } from "../objects/world.ts";
import type { GroundSurface } from "../objects/worldQuery.ts";
import type { Camera } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";

export interface WorldFxDeps {
    renderer: Renderer;
    textures: TextureStore;
    audio: AudioEngine;
    particles: ParticleSystem;
    camera: Camera;
    world: ObjectWorld;
    mapDef: MapDef;
    terrain: Terrain;
    terrainShape: TerrainShape;
    fading: FadingSprites;
    /** the match rains (rebirth isRainyMatch, or the sandbox's ?rain= override) */
    rainy?: boolean;
    /**
     * the surface on the ground floor at a point, building floors and decals included (WorldQuery.groundSurface): the
     * rain's ripples land on water, never on the bridge decks and docks over it
     */
    groundSurface: (pos: Vec2) => GroundSurface;
}

export interface WorldFxFrame {
    dt: number;
    /** position and layer of the followed player as drawn */
    viewerPos: Vec2;
    viewerLayer: number;
}

/** Ground surface for effects: the terrain on the ground floor, "bunker" underground. */
export function surfaceAt(terrain: Terrain, pos: Vec2, layer: number): string {
    return layer & 1 ? "bunker" : terrainSurfaceAt(terrain, pos);
}

export class WorldFx {
    private readonly deps: WorldFxDeps;
    readonly explosions: ExplosionSystem;
    readonly projectiles: ProjectileSystem;
    readonly smokes: SmokeSystem;
    readonly ambience: Ambience;
    /** the rain of a rainy match, else null */
    readonly rain: RainFx | null;
    private readonly interior = new InteriorSounds();
    /** recorder sounds played (tests) */
    recorders = 0;
    private lastTime = -1;
    private interval = 0.03;

    constructor(deps: WorldFxDeps) {
        this.deps = deps;
        const rippleColor = deps.mapDef.biome.colors.waterRipple ?? 0xb3f0ff;
        const surface = (pos: Vec2, layer: number) => surfaceAt(deps.terrain, pos, layer);
        this.explosions = new ExplosionSystem({
            particles: deps.particles,
            audio: deps.audio,
            addShake: (pos, intensity, rangeMult) => deps.camera.addShake(pos, intensity, rangeMult),
            isWater: (pos) => surface(pos, 0) === "water",
            rippleColor,
            insideCeiling: (pos) => deps.world.insideCeiling(pos),
        });
        this.projectiles = new ProjectileSystem({
            renderer: deps.renderer,
            textures: deps.textures,
            audio: deps.audio,
            particles: deps.particles,
            surfaceAt: surface,
            insideCeiling: (pos) => deps.world.insideCeiling(pos),
            insideStairs: (pos, rad) => deps.world.insideStructureStairs(pos, rad),
            insideStairMask: (pos, rad) => deps.world.insideStructureMask(pos, rad),
            rippleColor,
        });
        this.smokes = new SmokeSystem({ renderer: deps.renderer, textures: deps.textures });
        this.ambience = new Ambience(deps.audio);
        this.rain = deps.rainy
            ? new RainFx({
                  renderer: deps.renderer,
                  particles: deps.particles,
                  insideCeiling: (pos) => deps.world.insideCeiling(pos),
                  waterAt: (pos) => {
                      const ground = deps.groundSurface(pos);
                      return ground.type === "water" ? ground.rippleColor : null;
                  },
              })
            : null;
        deps.audio.preload(explosionSounds(), "sfx");
        deps.audio.preload(["frag_pin_01", "frag_throw_01", "strobe_click_01", "ceiling_break_01"], "sfx");
        deps.audio.preload(["door_open_01", "door_close_01", "door_open_02", "door_close_02", "door_error_01"], "sfx");
        deps.audio.preload(["frag_grass_01", "frag_sand_01", "frag_water_01"], "hits");
    }

    apply(s: Snapshot): void {
        if (this.lastTime >= 0 && s.time > this.lastTime) {
            this.interval = Math.min(0.25, Math.max(0.005, s.time - this.lastTime));
        }
        this.lastTime = s.time;
        if (s.explosions?.length) this.explosions.add(s.explosions);
        this.projectiles.apply(s.projectiles ?? [], this.interval);
        this.smokes.apply(s.smokes ?? []);
        for (const r of s.recorders ?? []) {
            this.deps.audio.playSound(r.sound, { channel: "sfx", pos: r.pos, layer: r.layer });
            this.recorders++;
        }
    }

    update(f: WorldFxFrame): void {
        const { audio, world, renderer } = this.deps;
        const underground = world.isUnderground(f.viewerPos, f.viewerLayer);
        renderer.underground = underground;
        audio.underground = underground;
        audio.updateListener();
        this.explosions.update(f.dt);
        this.projectiles.update(f.dt, f.viewerLayer);
        this.smokes.update(f.dt);
        this.deps.fading.update(f.dt);
        this.ambience.updateEnvironment(f.viewerPos, f.viewerLayer, this.deps.terrainShape);
        this.interior.update(f.dt, world, f.viewerPos, f.viewerLayer, this.ambience);
        this.ambience.update(f.dt);
        const camera = this.deps.camera;
        this.rain?.update({
            dt: f.dt,
            cameraPos: camera.pos,
            layer: f.viewerLayer,
            roofs: world.localRoofs(),
            view: camera.viewBounds(),
        });
    }

    /** Drops everything in flight (sandbox respawn, new game). */
    clear(): void {
        this.explosions.clear();
        this.projectiles.clear();
        this.smokes.clear();
        this.deps.fading.clear();
        this.interior.clear();
        this.lastTime = -1;
    }

    destroy(): void {
        this.clear();
        this.ambience.stop();
        this.rain?.destroy();
    }
}
