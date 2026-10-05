// Small WebAudio engine playing the original mp3s with the original mixing rules (survev
// client/src/audioManager.ts; docs/research/ui/audiovisual-style.md "Sound engine"):
//   volume = channel volume x sound volume x base 0.5 x master 0.5, and for positional sounds on any channel but
//   the local player's x (1 - d / range)^(1 + 2 fallOff), pan = horizontal offset / range; other layers x 0.5.
// The AudioContext is only created on the first user gesture (autoplay policy). Files load lazily on first use (or
// through `preload`) and are cached; a sound whose file is still loading plays only if it arrives promptly.
import type { Vec2 } from "@rebirth/core";
import { Channels, soundDef, soundGroup } from "./soundDefs.ts";

const ASSET_ROOT = "/assets/";
const BASE_VOLUME = 0.5;
const MASTER_VOLUME = 0.5;
/** quieter sounds are not started (survev AudioManagerMinAllowedVolume) */
const MIN_VOLUME = 0.003;
const DIFF_LAYER_MULT = 0.5;
/** a lazily loaded sound still plays if its file arrived within this many ms of the request */
const LATE_PLAY_MS = 200;
const MAX_INSTANCES = 64;

export interface PlayOptions {
    /** sound channel (activePlayer, otherPlayers, hits, sfx, ui...); default activePlayer */
    channel?: string;
    /** world position of the source; omitted or channel activePlayer = not positional */
    pos?: Vec2;
    fallOff?: number;
    /** map layer of the source; sounds from another layer are halved */
    layer?: number;
    volumeScale?: number;
    /** pitch shift in cents */
    detune?: number;
    /** start delay in milliseconds */
    delay?: number;
}

export interface SoundHandle {
    readonly name: string;
    source: AudioBufferSourceNode | null;
    stopped: boolean;
}

/** layers 0/1 are the ground/underground; stairs (2, 3) hear both (survev util.sameAudioLayer) */
function sameAudioLayer(a: number, b: number): boolean {
    return a === b || (a & 2) !== 0 || (b & 2) !== 0;
}

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private readonly buffers = new Map<string, AudioBuffer>();
    private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
    private readonly failed = new Set<string>();
    private readonly playing = new Map<string, number>();
    private readonly pendingPreload = new Set<string>();
    private active = 0;
    private muted = false;
    /** listener position (the camera) and layer */
    cameraPos: Vec2 = { x: 0, y: 0 };
    activeLayer = 0;
    /** sounds started / requested since boot (tests, debug) */
    started = 0;
    requested = 0;
    private readonly unlockEvents = ["pointerdown", "mousedown", "keydown", "touchstart"];

    constructor() {
        for (const type of this.unlockEvents) window.addEventListener(type, this.unlock, { capture: true });
    }

    get unlocked(): boolean {
        return this.ctx !== null;
    }

    get isMuted(): boolean {
        return this.muted;
    }

    get loadedCount(): number {
        return this.buffers.size;
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        if (this.master) this.master.gain.value = muted ? 0 : MASTER_VOLUME;
    }

    toggleMute(): boolean {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /** Creates the AudioContext on the first user gesture; later calls only resume it. */
    private readonly unlock = (): void => {
        if (!this.ctx) {
            try {
                this.ctx = new AudioContext();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
                this.master.connect(this.ctx.destination);
            } catch {
                this.ctx = null;
                return;
            }
            for (const path of this.pendingPreload) void this.load(path);
            this.pendingPreload.clear();
        }
        if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    };

    private load(path: string): Promise<AudioBuffer | null> {
        const cached = this.buffers.get(path);
        if (cached) return Promise.resolve(cached);
        if (this.failed.has(path) || !this.ctx) return Promise.resolve(null);
        let promise = this.loading.get(path);
        if (!promise) {
            const ctx = this.ctx;
            promise = fetch(ASSET_ROOT + path)
                .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
                .then((data) => ctx.decodeAudioData(data))
                .then((buffer) => {
                    this.buffers.set(path, buffer);
                    return buffer;
                })
                .catch((err) => {
                    this.failed.add(path);
                    console.warn(`audio ${path}: ${err}`);
                    return null;
                })
                .finally(() => this.loading.delete(path));
            this.loading.set(path, promise);
        }
        return promise;
    }

    /** Starts loading the files of `names` (as played on `channel`) so their first play is not dropped. */
    preload(names: Iterable<string | undefined>, channel = "activePlayer"): void {
        for (const name of names) {
            const def = name ? soundDef(name, channel) : undefined;
            if (!def || this.buffers.has(def.path)) continue;
            if (this.ctx) void this.load(def.path);
            else this.pendingPreload.add(def.path);
        }
    }

    /** Plays a random sound of a group on the group's channel. */
    playGroup(group: string, opts: PlayOptions = {}): SoundHandle | null {
        const g = soundGroup(group);
        if (!g || g.sounds.length === 0) return null;
        const name = g.sounds[Math.floor(Math.random() * g.sounds.length)];
        return this.playSound(name, { ...opts, channel: g.channel });
    }

    playSound(name: string | undefined, opts: PlayOptions = {}): SoundHandle | null {
        if (!name || name === "none") return null;
        const channelName = opts.channel ?? "activePlayer";
        const channel = Channels[channelName];
        const def = soundDef(name, channelName);
        if (!channel || !def) return null;
        this.requested++;
        if (this.muted || !this.ctx) return null;

        let volume = channel.volume * def.volume * BASE_VOLUME * (opts.volumeScale ?? 1);
        let pan = 0;
        if (opts.pos && channelName !== "activePlayer") {
            const dx = this.cameraPos.x - opts.pos.x;
            const dy = this.cameraPos.y - opts.pos.y;
            const range = channel.maxRange > 0 ? channel.maxRange : 1;
            const distNormal = Math.min(1, Math.hypot(dx, dy) / range);
            volume *= (1 - distNormal) ** (1 + (opts.fallOff ?? 0) * 2);
            pan = Math.max(-1, Math.min(1, -dx / range));
        }
        if (opts.layer !== undefined && !sameAudioLayer(opts.layer, this.activeLayer)) volume *= DIFF_LAYER_MULT;
        if (volume <= MIN_VOLUME) return null;
        if ((this.playing.get(name) ?? 0) >= (def.maxInstances ?? MAX_INSTANCES) || this.active >= MAX_INSTANCES) {
            return null;
        }

        const handle: SoundHandle = { name, source: null, stopped: false };
        const buffer = this.buffers.get(def.path);
        if (buffer) {
            this.start(handle, buffer, volume, pan, opts);
        } else {
            const requestedAt = performance.now();
            void this.load(def.path).then((loaded) => {
                if (loaded && !handle.stopped && performance.now() - requestedAt < LATE_PLAY_MS) {
                    this.start(handle, loaded, volume, pan, opts);
                }
            });
        }
        return handle;
    }

    private start(handle: SoundHandle, buffer: AudioBuffer, volume: number, pan: number, opts: PlayOptions): void {
        const ctx = this.ctx;
        if (!ctx || !this.master) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        if (opts.detune) source.detune.value = opts.detune;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        source.connect(gain).connect(panner).connect(this.master);
        const name = handle.name;
        this.playing.set(name, (this.playing.get(name) ?? 0) + 1);
        this.active++;
        source.onended = () => {
            this.playing.set(name, Math.max(0, (this.playing.get(name) ?? 1) - 1));
            this.active = Math.max(0, this.active - 1);
            source.disconnect();
            handle.source = null;
        };
        source.start(ctx.currentTime + (opts.delay ?? 0) / 1000);
        handle.source = source;
        this.started++;
    }

    stop(handle: SoundHandle | null | undefined): void {
        if (!handle) return;
        handle.stopped = true;
        try {
            handle.source?.stop();
        } catch {
            // already stopped
        }
    }

    destroy(): void {
        for (const type of this.unlockEvents) window.removeEventListener(type, this.unlock, { capture: true });
        void this.ctx?.close().catch(() => {});
        this.ctx = null;
    }
}
