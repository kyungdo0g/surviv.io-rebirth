// Start-page music (M8): `menu_music` (menu_music_01.mp3, the original's only music track) on the music channel, so the
// Music volume and the Sound toggle apply (docs/research/ui/audiovisual-style.md "Ambience and music": menu music plays
// on the main menu and stops when a match starts). Browsers only allow audio after a user gesture, so the track starts
// with the first click, key or touch on the page (the engine unlocks itself on the same gesture). It loops here; the
// original played it once and faded into the wind track (survev ambiance.ts introMusic). A starting game fades it out.
import type { AudioEngine, SoundHandle } from "./audio.ts";

const TRACK = "menu_music";
const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

export class MenuMusic {
    private readonly audio: AudioEngine;
    private handle: SoundHandle | null = null;
    private wanted = false;
    private readonly onGesture = () => this.tryStart();

    constructor(audio: AudioEngine) {
        this.audio = audio;
        // bubble phase: the engine's own (capture phase) unlock listener has created the AudioContext by then
        for (const type of GESTURES) window.addEventListener(type, this.onGesture);
    }

    /** the track is playing (or loading to play) */
    get playing(): boolean {
        return !!this.handle && !this.handle.stopped;
    }

    /** Plays the track as soon as audio is allowed (now, or at the next user gesture). */
    start(): void {
        this.wanted = true;
        this.tryStart();
    }

    /** Fades the track out (a game starts). */
    stop(fadeSeconds = 1): void {
        this.wanted = false;
        this.audio.fadeOut(this.handle, fadeSeconds);
        this.handle = null;
    }

    /** The Sound setting changed: a track muted at its start has never played. */
    refresh(): void {
        this.tryStart();
    }

    private tryStart(): void {
        if (!this.wanted || this.playing || !this.audio.unlocked || this.audio.isMuted) return;
        this.handle = this.audio.playSound(TRACK, { channel: "music", loop: true, late: true });
    }

    destroy(): void {
        this.stop(0);
        for (const type of GESTURES) window.removeEventListener(type, this.onGesture);
    }
}
