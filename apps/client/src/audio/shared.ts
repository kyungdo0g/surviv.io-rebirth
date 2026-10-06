// The page's audio engine, shared by the menu (menu music) and every game (kept unlocked across games), with the
// settings applied live: Master / SFX / Music volumes and the Sound toggle (config.ts muteAudio, survev main.ts
// onConfigModified -> audioManager.setMute / setMasterVolume / setSoundVolume / setMusicVolume).
import { type ConfigKey, config } from "../config.ts";
import { AudioEngine } from "./audio.ts";

const AUDIO_KEYS: ReadonlySet<ConfigKey> = new Set(["muteAudio", "masterVolume", "soundVolume", "musicVolume"]);

let shared: AudioEngine | null = null;

/** Keeps `audio` in step with the audio settings; returns the unsubscribe function. */
export function bindAudioSettings(audio: AudioEngine): () => void {
    const cfg = config();
    const apply = () => {
        audio.setVolumes({
            master: cfg.get("masterVolume"),
            sound: cfg.get("soundVolume"),
            music: cfg.get("musicVolume"),
        });
        audio.setMuted(cfg.get("muteAudio"));
    };
    apply();
    return cfg.onChange((key) => {
        if (AUDIO_KEYS.has(key)) apply();
    });
}

export function sharedAudio(): AudioEngine {
    if (!shared) {
        shared = new AudioEngine();
        bindAudioSettings(shared);
    }
    return shared;
}

/** Flips the Sound setting (the in-game menu's Sound button, the main page's mute button, the N key). */
export function toggleMute(): boolean {
    const cfg = config();
    cfg.set("muteAudio", !cfg.get("muteAudio"));
    return cfg.get("muteAudio");
}
