// Small WebAudio engine playing the original mp3s with the original mixing rules (survev
// client/src/audioManager.ts; docs/research/ui/audiovisual-style.md "Sound engine"):
//   volume = channel volume x sound volume x base 0.5 x the Master slider (1 by default), and for positional sounds on
//   any channel but the local player's x (1 - d / range)^(1 + 2 fallOff), pan = horizontal offset / range; other
//   layers x 0.5. The master gain feeds a default DynamicsCompressor before the speakers (survev lib/createJS.ts:457-460;
//   survev's CreateJS volume 0.5 of audioManager.ts:58 is replaced at startup by the config's masterVolume 1:
//   main.ts:408 onConfigModified -> :543 setMasterVolume, config.ts:105).
// Instances: at most `maxInstances` of a sound per channel play at once (survev audioManager.ts:148 registers each
// sound as name + channel); one more stops the instance that ends soonest and starts (createJS.ts:680-690 "kill the
// oldest instance"; 16 without a def value, :588), and at most 128 play in all (createJS.ts:27 kMaxInstances).
// The AudioContext is only created on the first user gesture (autoplay policy). Files load lazily on first use (or
// through `preload`) and are cached; a sound whose file is still loading plays only if it arrives promptly (or
// whenever it arrives, for `late` sounds such as loops). Looping and moving sources (planes, falling crates) keep
// their gain and pan nodes so `updateSound` can follow the source (survev audioManager.updateSound).
// M5: sounds from the other floor go through the "muffled" EQ, the club music through the "club" EQ, and positional
// sounds feed the cathedral reverb while the listener is underground (filters.ts); looping ambience tracks start
// silent and are driven by `setVolume`.
// M9: sounds marked canCoalesce (bullet and punch impacts, bush entries) merge into an instance of the same sound
// that ends within 30 ms instead of starting another: its volume becomes the equal-power sum and its pan the
// volume-weighted mean (survev lib/createJS.ts play), so a shotgun blast on a wall is one louder hit.
// M8: the settings' volume sliders (survev audioManager.ts setMasterVolume / setSoundVolume / setMusicVolume, 0-1 each):
// master scales the output, SFX every channel but music, Music the "music" type channel (menu and victory music);
// they sit on gain nodes, so playing sounds follow a slider at once.
import type { Vec2 } from "@rebirth/core";
import { AudioBuses } from "./filters.ts";
import { Channels, soundDef, soundFallback, soundGroup } from "./soundDefs.ts";

const ASSET_ROOT = "/assets/";
const BASE_VOLUME = 0.5;
/** quieter sounds are not started (survev AudioManagerMinAllowedVolume) */
const MIN_VOLUME = 0.003;
const DIFF_LAYER_MULT = 0.5;
/** a lazily loaded sound still plays if its file arrived within this many ms of the request */
const LATE_PLAY_MS = 200;
/** survev createJS kMaxInstances: sounds playing at once in all */
const MAX_INSTANCES = 128;
/** instances of one sound on one channel when its def names no maxInstances (survev createJS.ts:588) */
const DEFAULT_SOUND_INSTANCES = 16;
/** survev createJS kCoalesceTime: instances ending this close together merge */
const COALESCE_TIME = 0.03;

/** a playing instance of a sound, counted against its per-channel limit */
interface Instance {
    handle: SoundHandle;
    /** context time at which it ends (Infinity for a loop) */
    stopTime: number;
}

/** a playing instance of a canCoalesce sound */
interface CoalesceTarget {
    handle: SoundHandle;
    stopTime: number;
    volume: number;
    pan: number;
}

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
    /** loop until stopped */
    loop?: boolean;
    /** multiplies the channel's range for positional sounds (planes, air drops) */
    rangeMult?: number;
    /** start this many seconds into the file */
    offset?: number;
    /** start even when the positional volume is below the audible threshold (it is updated later) */
    ignoreMinAllowable?: boolean;
    /** start whenever the file finishes loading instead of dropping a sound that arrives late */
    late?: boolean;
    /**
     * EQ: "muffled" (the default for sounds with a `layer`) applies on another floor only, unless `forceFilter`;
     * "club" always; "none" disables muffling and reverb
     */
    filter?: string;
    forceFilter?: boolean;
    /** start at volume 0 (looping tracks whose volume is set later with `setVolume`) */
    startSilent?: boolean;
}

export interface SoundHandle {
    readonly name: string;
    source: AudioBufferSourceNode | null;
    stopped: boolean;
    gain?: GainNode;
    panner?: StereoPannerNode;
}

/** layers 0/1 are the ground/underground; stairs (2, 3) hear both (survev util.sameAudioLayer) */
function sameAudioLayer(a: number, b: number): boolean {
    return a === b || (a & 2) !== 0 || (b & 2) !== 0;
}

export interface Volumes {
    master: number;
    sound: number;
    music: number;
}

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    /** between the master gain and the speakers (survev createJS.ts:457-460) */
    private compressor: DynamicsCompressorNode | null = null;
    /** every channel but music (the SFX volume) */
    private soundBus: GainNode | null = null;
    /** the music channel (the Music volume) */
    private musicBus: GainNode | null = null;
    private volumes: Volumes = { master: 1, sound: 1, music: 1 };
    private buses: AudioBuses | null = null;
    private readonly buffers = new Map<string, AudioBuffer>();
    private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
    private readonly failed = new Set<string>();
    /** playing instances by sound name + channel (survev registers each sound per channel) */
    private readonly instances = new Map<string, Instance[]>();
    /** instances stopped to make room for a new play of the same sound (tests, debug) */
    evicted = 0;
    private readonly coalescing = new Map<string, CoalesceTarget[]>();
    /** plays merged into a playing instance (tests, debug) */
    coalesced = 0;
    private readonly pendingPreload = new Set<string>();
    private active = 0;
    private muted = false;
    /** listener position (the camera) and layer */
    cameraPos: Vec2 = { x: 0, y: 0 };
    activeLayer = 0;
    /** the listener is inside an underground structure layer (reverb) */
    underground = false;
    /** sounds started through the muffled EQ since boot (tests, debug) */
    muffledCount = 0;
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
        this.applyGains();
    }

    /** The settings' Master / SFX / Music volumes (0-1). */
    setVolumes(volumes: Volumes): void {
        const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);
        this.volumes = { master: clamp(volumes.master), sound: clamp(volumes.sound), music: clamp(volumes.music) };
        this.applyGains();
    }

    get currentVolumes(): Volumes {
        return { ...this.volumes };
    }

    private applyGains(): void {
        if (this.master) this.master.gain.value = this.muted ? 0 : this.volumes.master;
        if (this.soundBus) this.soundBus.gain.value = this.volumes.sound;
        if (this.musicBus) this.musicBus.gain.value = this.volumes.music;
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
                this.compressor = this.ctx.createDynamicsCompressor();
                this.master.connect(this.compressor);
                this.compressor.connect(this.ctx.destination);
                this.soundBus = this.ctx.createGain();
                this.soundBus.connect(this.master);
                this.musicBus = this.ctx.createGain();
                this.musicBus.connect(this.master);
                this.applyGains();
                this.buses = new AudioBuses(this.ctx, this.soundBus, ASSET_ROOT);
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
            const fetchDecode = (file: string) =>
                fetch(ASSET_ROOT + file)
                    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
                    .then((data) => ctx.decodeAudioData(data));
            // a rebirth sound whose file is not installed plays its donor's original (soundDefs.ts soundFallback)
            const fallback = soundFallback(path);
            promise = fetchDecode(path)
                .catch((err) => (fallback ? fetchDecode(fallback) : Promise.reject(err)))
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

    /** Whether the file of `name` (as played on `channel`) is decoded and ready. */
    isLoaded(name: string, channel: string): boolean {
        const def = soundDef(name, channel);
        return !!def && this.buffers.has(def.path);
    }

    /** Updates the reverb send for the listener layer (call every frame). */
    updateListener(): void {
        this.buses?.setUnderground(this.underground, this.activeLayer);
    }

    /** current reverb volume (tests) */
    get reverbVolume(): number {
        return this.buses?.reverbVolume ?? 0;
    }

    /** Sets the volume of a playing sound: `volume` x channel volume x sound volume x base (ambience tracks). */
    setVolume(handle: SoundHandle | null | undefined, channelName: string, volume: number): void {
        if (!handle?.gain || handle.stopped) return;
        const channel = Channels[channelName];
        const def = soundDef(handle.name, channelName);
        if (!channel || !def) return;
        handle.gain.gain.value = Math.max(0, volume) * channel.volume * def.volume * BASE_VOLUME;
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

        const mixed = this.mix(channelName, def.volume, opts);
        const pan = mixed.pan;
        const volume = opts.startSilent ? 0 : mixed.volume;
        if (volume <= MIN_VOLUME && !opts.ignoreMinAllowable && !opts.startSilent) return null;
        const buffer = this.buffers.get(def.path);
        if (buffer && def.canCoalesce && !opts.loop && this.coalesce(name, buffer, volume, pan)) return null;
        if (this.active >= MAX_INSTANCES) return null;

        const handle: SoundHandle = { name, source: null, stopped: false };
        if (buffer) {
            this.start(handle, buffer, volume, pan, opts);
        } else {
            const requestedAt = performance.now();
            void this.load(def.path).then((loaded) => {
                if (loaded && !handle.stopped && (opts.late || performance.now() - requestedAt < LATE_PLAY_MS)) {
                    this.start(handle, loaded, volume, pan, opts);
                }
            });
        }
        return handle;
    }

    /** Merges a play into an instance of `name` ending within COALESCE_TIME of it; false when there is none. */
    private coalesce(name: string, buffer: AudioBuffer, volume: number, pan: number): boolean {
        const list = this.coalescing.get(name);
        if (!list || !this.ctx) return false;
        const stopTime = this.ctx.currentTime + buffer.duration;
        for (const inst of list) {
            if (inst.handle.stopped || !inst.handle.gain || Math.abs(stopTime - inst.stopTime) > COALESCE_TIME)
                continue;
            const total = inst.volume + volume;
            inst.pan = (inst.volume * inst.pan + volume * pan) / Math.max(0.001, total);
            inst.volume = Math.sqrt(inst.volume * inst.volume + volume * volume);
            inst.handle.gain.gain.value = inst.volume;
            if (inst.handle.panner) inst.handle.panner.pan.value = inst.pan;
            this.coalesced++;
            return true;
        }
        return false;
    }

    /** Volume and stereo pan of a sound of `channelName` with definition volume `defVolume`. */
    private mix(channelName: string, defVolume: number, opts: PlayOptions): { volume: number; pan: number } {
        const channel = Channels[channelName];
        let volume = channel.volume * defVolume * BASE_VOLUME * (opts.volumeScale ?? 1);
        let pan = 0;
        if (opts.pos && channelName !== "activePlayer") {
            const dx = this.cameraPos.x - opts.pos.x;
            const dy = this.cameraPos.y - opts.pos.y;
            let range = channel.maxRange * (opts.rangeMult ?? 1);
            if (!(range > 0)) range = 1;
            const distNormal = Math.min(1, Math.hypot(dx, dy) / range);
            volume *= (1 - distNormal) ** (1 + (opts.fallOff ?? 0) * 2);
            pan = Math.max(-1, Math.min(1, -dx / range));
        }
        if (opts.layer !== undefined && !sameAudioLayer(opts.layer, this.activeLayer)) volume *= DIFF_LAYER_MULT;
        return { volume, pan };
    }

    /** Moves a playing positional sound: recomputes its volume and pan for `opts.pos` (survev updateSound). */
    updateSound(handle: SoundHandle | null | undefined, channelName: string, opts: PlayOptions): void {
        if (!handle || handle.stopped || !handle.gain || !handle.panner) return;
        const def = soundDef(handle.name, channelName);
        if (!def || !Channels[channelName]) return;
        const { volume, pan } = this.mix(channelName, def.volume, opts);
        if (volume <= MIN_VOLUME && !opts.ignoreMinAllowable) return;
        handle.gain.gain.value = volume;
        handle.panner.pan.value = pan;
    }

    private start(handle: SoundHandle, buffer: AudioBuffer, volume: number, pan: number, opts: PlayOptions): void {
        const ctx = this.ctx;
        if (!ctx || !this.master) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = !!opts.loop;
        if (opts.detune) source.detune.value = opts.detune;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        source.connect(gain).connect(panner).connect(this.output(opts));
        // positional world sounds ring in the bunker reverb while the listener is underground
        if (this.buses && opts.pos && opts.filter !== "none" && opts.channel !== "ambient")
            panner.connect(this.buses.reverb);
        const name = handle.name;
        const channelName = opts.channel ?? "activePlayer";
        const key = `${name}|${channelName}`;
        const delay = (opts.delay ?? 0) / 1000;
        const offset = opts.offset ? opts.offset % buffer.duration : 0;
        const rate = opts.detune ? 2 ** (opts.detune / 1200) : 1;
        const instance: Instance = {
            handle,
            stopTime: opts.loop
                ? Number.POSITIVE_INFINITY
                : ctx.currentTime + delay + (buffer.duration - offset) / rate,
        };
        const list = this.instances.get(key) ?? [];
        this.makeRoom(list, soundDef(name, channelName)?.maxInstances ?? DEFAULT_SOUND_INSTANCES);
        list.push(instance);
        this.instances.set(key, list);
        this.active++;
        let target: CoalesceTarget | null = null;
        if (soundDef(name, channelName)?.canCoalesce && !opts.loop) {
            target = { handle, stopTime: ctx.currentTime + buffer.duration, volume, pan };
            const targets = this.coalescing.get(name) ?? [];
            targets.push(target);
            this.coalescing.set(name, targets);
        }
        source.onended = () => {
            const at = list.indexOf(instance);
            if (at >= 0) list.splice(at, 1);
            this.active = Math.max(0, this.active - 1);
            source.disconnect();
            handle.source = null;
            if (target) {
                const targets = this.coalescing.get(name);
                const i = targets?.indexOf(target) ?? -1;
                if (targets && i >= 0) targets.splice(i, 1);
            }
        };
        source.start(ctx.currentTime + delay, Math.max(0, offset));
        handle.source = source;
        handle.gain = gain;
        handle.panner = panner;
        this.started++;
    }

    /**
     * Stops instances of a sound until fewer than `max` play: the one that ends soonest first (survev createJS.ts:680-690
     * stops the instance with the earliest stop time and plays the new one, where a full sound used to drop the play).
     */
    private makeRoom(list: Instance[], max: number): void {
        while (list.length >= Math.max(1, max)) {
            let soonest = 0;
            for (let i = 1; i < list.length; i++) if (list[i].stopTime < list[soonest].stopTime) soonest = i;
            const [inst] = list.splice(soonest, 1);
            this.evicted++;
            this.stop(inst.handle);
        }
    }

    /** Where a sound goes: the music bus, the club or muffled EQ, or straight to the SFX bus. */
    private output(opts: PlayOptions): AudioNode {
        if (Channels[opts.channel ?? "activePlayer"]?.type === "music" && this.musicBus) return this.musicBus;
        const master = (this.soundBus ?? this.master) as GainNode;
        const buses = this.buses;
        if (!buses || opts.filter === "none") return master;
        if (opts.filter === "club") return buses.club;
        const diffLayer = opts.layer !== undefined && !sameAudioLayer(opts.layer, this.activeLayer);
        if ((opts.filter === "muffled" && opts.forceFilter) || diffLayer) {
            this.muffledCount++;
            return buses.muffled;
        }
        return master;
    }

    /** Fades a playing sound to silence over `seconds`, then stops it (menu music when a game starts). */
    fadeOut(handle: SoundHandle | null | undefined, seconds: number): void {
        if (!handle || handle.stopped) return;
        const ctx = this.ctx;
        const gain = handle.gain;
        if (!ctx || !gain || seconds <= 0) {
            this.stop(handle);
            return;
        }
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
        handle.stopped = true;
        try {
            handle.source?.stop(ctx.currentTime + seconds);
        } catch {
            // already stopped
        }
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
