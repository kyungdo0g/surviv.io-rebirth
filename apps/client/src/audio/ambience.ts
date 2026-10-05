// Ambience tracks (survev client/src/ambiance.ts and game.ts updateAmbience; docs/research/ui/audiovisual-style.md
// "Ambience and music"): looping wind, river and wave beds plus two "interior" tracks (a building's music heard
// inside, and the same track through the `filter` EQ from outside or underground), crossfaded by weight. Volumes are
// recomputed every 0.2 s from the last track down: each takes `weight` of the volume the tracks after it left over.
// Wind plays at weight 1 on land; waves grow within 50 units of the shore (and replace the wind at sea); the river
// bed grows within 30 units of a river, by the river's width, and is silent underground. Interior weights are
// set every frame by the structures (audio/interior.ts) and reset after each update ("immediate mode").
import type { Vec2 } from "@rebirth/core";
import type { TerrainShape } from "@rebirth/sim";
import type { AudioEngine, SoundHandle } from "./audio.ts";

const UPDATE_INTERVAL = 0.2;

interface Track {
    name: string;
    sound: string;
    channel: string;
    /** weight and sound are cleared after every update; the owner sets them each frame */
    immediate: boolean;
    handle: SoundHandle | null;
    handleSound: string;
    filter: string;
    weight: number;
    volume: number;
}

/** distance from `p` to the segment a-b */
function segmentDist(p: Vec2, a: Vec2, b: Vec2): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
    return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function polylineDist(p: Vec2, pts: readonly Vec2[], closed: boolean): number {
    let best = Number.POSITIVE_INFINITY;
    const n = pts.length;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) best = Math.min(best, segmentDist(p, pts[i], pts[(i + 1) % n]));
    return best;
}

function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

/** inverse lerp clamped to 0..1 (survev math.delerp) */
function delerp(v: number, from: number, to: number): number {
    return Math.min(1, Math.max(0, (v - from) / (to - from)));
}

export class Ambience {
    private readonly audio: AudioEngine;
    private readonly tracks: Track[] = [];
    private throttle = 0;

    constructor(audio: AudioEngine) {
        this.audio = audio;
        // ordered from the least to the most important (the mix gives later tracks priority)
        this.add("wind", "ambient_wind_01", false);
        this.add("river", "ambient_stream_01", false);
        this.add("waves", "ambient_waves_01", false);
        this.add("interior_0", "", true);
        this.add("interior_1", "", true);
    }

    private add(name: string, sound: string, immediate: boolean): void {
        this.tracks.push({
            name,
            sound,
            channel: "ambient",
            immediate,
            handle: null,
            handleSound: "",
            filter: "",
            weight: 0,
            volume: 0,
        });
    }

    track(name: string): Track | undefined {
        return this.tracks.find((t) => t.name === name);
    }

    /** current volume of each playing track (tests, debug) */
    get volumes(): Record<string, { sound: string; volume: number }> {
        const out: Record<string, { sound: string; volume: number }> = {};
        for (const t of this.tracks) if (t.handle) out[t.name] = { sound: t.handleSound, volume: t.volume };
        return out;
    }

    /** Sets an interior track for this frame (structures call it every frame). */
    setInterior(index: 0 | 1, sound: string, filter: string, weight: number): void {
        const t = this.tracks[3 + index];
        if (weight <= t.weight && t.sound) return;
        t.sound = sound;
        t.filter = filter;
        t.weight = sound ? weight : 0;
    }

    /** Wind, river and wave weights for a listener at `pos` (survev game.ts updateAmbience). */
    updateEnvironment(pos: Vec2, layer: number, terrain: TerrainShape | null): void {
        let waves = 0;
        let river = 0;
        let wind = 1;
        if (terrain) {
            if (!pointInPolygon(pos, terrain.shore)) {
                waves = 1;
                wind = 0;
            } else {
                waves = delerp(polylineDist(pos, terrain.shore, true), 50, 0);
                for (const r of terrain.rivers) {
                    if (r.center.length < 2) continue;
                    const width = r.width + 2;
                    const t = delerp(polylineDist(pos, r.center, r.looped), 30 + width, width);
                    river = Math.max(river, t * Math.min(1, Math.max(0.25, r.width / 8)));
                }
                if (layer === 1) river = 0;
            }
        }
        this.setWeight("wind", wind);
        this.setWeight("river", river);
        this.setWeight("waves", waves);
    }

    private setWeight(name: string, weight: number): void {
        const t = this.track(name);
        if (t) t.weight = weight;
    }

    update(dt: number): void {
        this.throttle -= dt;
        const updateVolume = this.throttle <= 0;
        if (updateVolume) this.throttle = UPDATE_INTERVAL;
        let total = 0;
        for (let i = this.tracks.length - 1; i >= 0; i--) {
            const t = this.tracks[i];
            if (t.handle && (t.handle.stopped || (t.sound && t.sound !== t.handleSound))) {
                this.audio.stop(t.handle);
                t.handle = null;
                t.handleSound = "";
            }
            if (!t.handle && t.sound && t.weight > 0 && !this.audio.isMuted) {
                if (this.audio.isLoaded(t.sound, t.channel)) {
                    t.handle = this.audio.playSound(t.sound, {
                        channel: t.channel,
                        loop: true,
                        startSilent: true,
                        filter: t.filter,
                        forceFilter: true,
                    });
                    t.handleSound = t.handle ? t.sound : "";
                } else {
                    this.audio.preload([t.sound], t.channel);
                }
            }
            if (t.handle && updateVolume) {
                const volume = t.weight * (1 - total);
                total += volume;
                t.volume = volume;
                this.audio.setVolume(t.handle, t.channel, volume);
            }
            // a track that went silent and has no sound any more stops
            if (t.handle && !t.sound && t.volume <= 0.001) {
                this.audio.stop(t.handle);
                t.handle = null;
                t.handleSound = "";
            }
            if (t.immediate) {
                t.sound = "";
                t.weight = 0;
            }
        }
    }

    /** Stops every track (game torn down or over). */
    stop(): void {
        for (const t of this.tracks) {
            this.audio.stop(t.handle);
            t.handle = null;
            t.handleSound = "";
            t.volume = 0;
            if (t.immediate) {
                t.sound = "";
                t.weight = 0;
            }
        }
    }
}
