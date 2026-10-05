// Building effects (survev client/src/objects/building.ts; docs/research/mechanics/doors-layers-ceilings.md,
// maps/puzzles.md): the roof collapse when `ceilingDead` turns on in view (roof panels flying off the first floor
// surface and the def's break sound; the residue sprite on the floor stays), puzzle sounds (a failed attempt plays
// `puzzle.sound.fail` at the piece nearest the viewer, solving plays `puzzle.sound.complete`), the occupied emitters
// (chimney smoke and bathhouse steam while a player is inside; never again once a `disableBuildingOccupied` obstacle
// died) and the looping sound emitters (steam, oasis waves) whose volume follows the camera distance and the roof.
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import type { BuildingDef } from "@rebirth/defs";
import type { BuildingView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { SoundHandle } from "../audio/audio.ts";
import type { Emitter } from "../fx/particles.ts";
import type { ViewDeps } from "./types.ts";

const SOUND_UPDATE_INTERVAL = 0.1;

interface SoundEmitter {
    sound: string;
    channel: string;
    pos: Vec2;
    range: { min: number; max: number };
    falloff: number;
    volume: number;
    handle: SoundHandle | null;
}

interface OccupiedEmitter {
    emitter: Emitter;
    /** follows the chimney's ceiling image (fades and layers with the roof) */
    parentToCeiling: boolean;
}

/** layers 0/1 are the ground/underground; stairs (2, 3) hear both (survev util.sameAudioLayer) */
function sameAudioLayer(a: number, b: number): boolean {
    return a === b || (a & 2) !== 0 || (b & 2) !== 0;
}

export interface BuildingFxFrame {
    dt: number;
    cameraPos: Vec2;
    localPos: Vec2;
    localLayer: number;
    /** 1 = roof drawn, 0 = hidden */
    ceilingAlpha: number;
    /** render layer and zOrd of the ceiling images this frame */
    ceilingLayer: number;
    ceilingZOrd: number;
}

export class BuildingFx {
    private readonly deps: ViewDeps;
    private readonly def: BuildingDef;
    private readonly pos: Vec2;
    private readonly rot: number;
    private readonly layer: number;
    private readonly occupied: OccupiedEmitter[] = [];
    private readonly sounds: SoundEmitter[] = [];
    private soundTicker = 0;
    private ceilingDead = false;
    private puzzleSolved = false;
    private errSeq = 0;
    /** residue sprite of a collapsed roof */
    residue: Sprite | null = null;
    /** roof collapses, puzzle failures and completions played in view (tests) */
    collapses = 0;
    puzzleFails = 0;
    puzzleSolves = 0;

    constructor(deps: ViewDeps, def: BuildingDef, view: BuildingView) {
        this.deps = deps;
        this.def = def;
        this.pos = v2.copy(view.pos);
        this.rot = math.oriToRad(view.ori);
        this.layer = view.layer;
        this.ceilingDead = view.ceilingDead;
        this.puzzleSolved = !!view.puzzle?.solved;
        this.errSeq = view.puzzle?.errSeq ?? 0;
        this.createEmitters();
        for (const s of def.soundEmitters ?? []) {
            this.sounds.push({
                sound: s.sound,
                channel: s.channel,
                pos: v2.add(this.pos, v2.rotate(s.pos, this.rot)),
                range: s.range,
                falloff: s.falloff,
                volume: s.volume,
                handle: null,
            });
        }
    }

    private createEmitters(): void {
        const particles = this.deps.particles;
        if (!particles) return;
        const ceilings = this.def.ceiling.imgs;
        const chimney = ceilings[ceilings.length - 1];
        for (const e of this.def.occupiedEmitters ?? []) {
            const rot = this.rot + (e.rot ?? 0);
            let pos = v2.add(this.pos, v2.rotate(e.pos, rot));
            let dir = v2.rotate(e.dir ?? { x: 1, y: 0 }, rot);
            let speedMult = 1;
            const parentToCeiling = !!e.parentToCeiling && !!chimney;
            if (parentToCeiling && chimney) {
                // the original parents these particles to the last ceiling image and measures them in its pixels:
                // convert to world units (pixels x image scale / 16) at the image's place and rotation
                const imgRot = math.oriToRad(chimney.rot ?? 0);
                pos = v2.add(this.pos, v2.rotate(chimney.pos ?? { x: 0, y: 0 }, this.rot));
                pos = v2.add(pos, v2.mul(v2.rotate(e.pos, this.rot - imgRot), 2 * chimney.scale));
                dir = v2.rotate({ x: 1, y: 0 }, this.rot - imgRot - (e.rot ?? 0));
                speedMult = chimney.scale / 16;
            }
            const emitter = particles.addEmitter(e.type, {
                pos,
                dir,
                scale: parentToCeiling ? 1 : e.scale,
                layer: e.layer,
                speedMult,
            });
            emitter.enabled = false;
            this.occupied.push({ emitter, parentToCeiling });
        }
    }

    /** A snapshot of the building; `isNew` when it just entered the view (no one-shot effects then). */
    setData(view: BuildingView, isNew: boolean): void {
        const audio = this.deps.audio;
        if (view.ceilingDead && !this.ceilingDead && !isNew) this.collapse();
        this.ceilingDead = view.ceilingDead;
        const puzzle = this.def.puzzle;
        if (puzzle && view.puzzle) {
            if (view.puzzle.errSeq !== this.errSeq && !isNew) {
                const at = this.nearestPiece() ?? { pos: this.pos, layer: this.layer };
                this.puzzleFails++;
                audio?.playSound(puzzle.sound.fail, {
                    channel: "sfx",
                    pos: at.pos,
                    layer: at.layer,
                    filter: "muffled",
                });
            }
            if (view.puzzle.solved && !this.puzzleSolved && !isNew) this.puzzleSolves++;
            if (view.puzzle.solved && !this.puzzleSolved && !isNew && puzzle.sound.complete !== "none") {
                audio?.playSound(puzzle.sound.complete, {
                    channel: "sfx",
                    pos: this.pos,
                    layer: this.layer,
                    filter: "muffled",
                });
            }
            this.errSeq = view.puzzle.errSeq;
            this.puzzleSolved = view.puzzle.solved;
        }
        const enabled = view.occupied && !view.occupiedDisabled;
        for (const o of this.occupied) o.emitter.enabled = enabled;
    }

    /** the puzzle piece of this building nearest the viewer (survev: the fail sound plays there) */
    private nearestPiece(): { pos: Vec2; layer: number } | null {
        const viewer = this.deps.viewerPos?.() ?? this.pos;
        let best: Vec2 | null = null;
        let bestDist = v2.distance(viewer, this.pos);
        for (const child of this.def.mapObjects) {
            if (!child.puzzlePiece) continue;
            const pos = v2.add(this.pos, v2.rotate(child.pos, this.rot));
            const d = v2.distance(viewer, pos);
            if (d < bestDist) {
                best = pos;
                bestDist = d;
            }
        }
        return best ? { pos: best, layer: this.layer } : null;
    }

    /** Roof collapse: panels from random points of the first floor surface and the break sound. */
    private collapse(): void {
        const destroy = this.def.ceiling.destroy;
        if (!destroy) return;
        this.collapses++;
        const surface = this.def.floor.surfaces[0];
        const box = surface?.collision[0];
        const particles = this.deps.particles;
        if (box && particles) {
            const aabb = collider.toAabb(collider.transform(box, this.pos, this.rot, 1));
            for (let i = 0; i < destroy.particleCount; i++) {
                const pos = {
                    x: aabb.min.x + Math.random() * (aabb.max.x - aabb.min.x),
                    y: aabb.min.y + Math.random() * (aabb.max.y - aabb.min.y),
                };
                const ang = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15;
                particles.add(destroy.particle, this.layer, pos, {
                    x: Math.cos(ang) * speed,
                    y: Math.sin(ang) * speed,
                });
            }
        }
        this.deps.audio?.playSound(destroy.sound || "ceiling_break_01", { channel: "sfx", pos: this.pos });
    }

    update(f: BuildingFxFrame): void {
        for (const o of this.occupied) {
            if (!o.parentToCeiling) continue;
            o.emitter.alpha = f.ceilingAlpha;
            o.emitter.layer = f.ceilingLayer;
            o.emitter.zOrd = f.ceilingZOrd + 0.5;
        }
        const audio = this.deps.audio;
        if (!audio || !this.sounds.length) return;
        this.soundTicker += f.dt;
        if (this.soundTicker < SOUND_UPDATE_INTERVAL) return;
        this.soundTicker = 0;
        for (const s of this.sounds) {
            if (!s.handle) {
                if (!audio.isLoaded(s.sound, s.channel)) {
                    audio.preload([s.sound], s.channel);
                    continue;
                }
                s.handle = audio.playSound(s.sound, { channel: s.channel, loop: true, startSilent: true });
                if (!s.handle) continue;
            }
            const dist = v2.distance(f.cameraPos, s.pos);
            const distT = math.clamp(math.remap(dist, s.range.min, s.range.max, 1, 0), 0, 1);
            const visibility = math.lerp(f.ceilingAlpha, 1, 0.25);
            let volume = s.volume * distT ** s.falloff * visibility;
            if (!sameAudioLayer(this.layer, f.localLayer) || volume < 0.003) volume = 0;
            audio.setVolume(s.handle, s.channel, volume);
        }
    }

    /** Mutes the sound emitters while the building is culled (they are only updated in view). */
    silence(): void {
        for (const s of this.sounds) this.deps.audio?.setVolume(s.handle, s.channel, 0);
    }

    destroy(): void {
        for (const o of this.occupied) o.emitter.stop();
        this.occupied.length = 0;
        for (const s of this.sounds) this.deps.audio?.stop(s.handle);
        this.sounds.length = 0;
    }
}
