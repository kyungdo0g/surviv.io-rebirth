// Setting widgets shared by the main page's settings modal and the in-game menu (M8; survev index.html
// .slider-container / .modal-settings-item, main.ts slider and checkbox handlers): volume sliders (0-100 on screen,
// 0-1 stored) and checkboxes bound to config keys. Every widget follows the config, so a change in one menu shows in
// the other; `dispose` drops the subscriptions when the menu goes away.
import { type ConfigKey, type ConfigValues, config } from "../config.ts";
import { h } from "../menu/dom.ts";

type VolumeKey = "masterVolume" | "soundVolume" | "musicVolume";
type BoolKey = { [K in ConfigKey]: ConfigValues[K] extends boolean ? K : never }[ConfigKey];

/** CSS class of each slider, as in the original (.sl-master-volume, .sl-sound-volume, .sl-music-volume) */
const SLIDER_CLASS: Record<VolumeKey, string> = {
    masterVolume: "sl-master-volume",
    soundVolume: "sl-sound-volume",
    musicVolume: "sl-music-volume",
};
const SLIDER_LABEL: Record<VolumeKey, string> = {
    masterVolume: "index-master-volume",
    soundVolume: "index-sfx-volume",
    musicVolume: "index-music-volume",
};

export class SettingControls {
    private readonly subs: Array<() => void> = [];

    /** Re-runs `render` whenever one of `keys` changes (and once now). */
    watch(keys: readonly ConfigKey[], render: () => void): void {
        render();
        this.subs.push(
            config().onChange((key) => {
                if (keys.includes(key)) render();
            }),
        );
    }

    /** A labelled volume slider. */
    slider(key: VolumeKey, cls = "slider-container"): HTMLDivElement {
        const input = h("input", { cls: `slider ${SLIDER_CLASS[key]}` });
        input.type = "range";
        input.min = "0";
        input.max = "100";
        input.addEventListener("input", () => config().set(key, Number(input.value) / 100));
        this.watch([key], () => {
            input.value = String(Math.round(config().get(key) * 100));
        });
        return h("div", { cls }, h("p", { cls: "slider-text", l10n: SLIDER_LABEL[key] }), input);
    }

    /** A labelled checkbox (`id` like the original's #screenShake / #anonPlayerNames). */
    checkbox(key: BoolKey, labelKey: string, id: string): HTMLDivElement {
        const input = h("input", { id });
        input.type = "checkbox";
        input.addEventListener("change", () => config().set(key, input.checked));
        this.watch([key], () => {
            input.checked = config().get(key);
        });
        const label = h("p", {
            cls: "modal-settings-checkbox-text",
            l10n: labelKey,
            click: () => config().set(key, !config().get(key)),
        });
        return h("div", { cls: "modal-settings-item" }, input, label);
    }

    dispose(): void {
        for (const unsub of this.subs.splice(0)) unsub();
    }
}

/** Toggles the page's full screen (the original's Full Screen buttons and L bind; changelog 0.1.76). */
export function toggleFullscreen(): void {
    try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen().catch(() => {});
    } catch {
        // full screen unavailable (iframes, old browsers)
    }
}
