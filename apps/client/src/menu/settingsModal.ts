// Main page modals (M8; survev index.html #modal-settings and #ui-modal-keybind, ui/menu.ts MenuModal; docs/research/
// ui/menus.md "Settings modal (main menu)", "Keybind modal (main menu)"). Settings: language, screen shake, anonymize
// player names and the Master / SFX / Music sliders (High resolution is left out: the client always renders at the
// device's resolution). Keybinds: the rebinding screen with its share section (ui/keybindsUi.ts). A click on the
// backdrop, the close button or Escape closes a modal.
import { getLang, type Lang } from "../l10n/index.ts";
import { KeybindsUi } from "../ui/keybindsUi.ts";
import { SettingControls } from "../ui/settingsControls.ts";
import "../ui/settings.css";
import { applyL10n, h } from "./dom.ts";

class Modal {
    readonly root: HTMLDivElement;
    protected readonly body: HTMLDivElement;
    private readonly onEsc = (ev: KeyboardEvent) => {
        if (ev.key === "Escape" && this.visible) this.hide();
    };

    constructor(parent: HTMLElement, id: string, titleKey: string) {
        this.body = h("div", { cls: "modal-body" });
        const content = h(
            "div",
            { cls: "modal-content" },
            h(
                "div",
                { cls: "modal-header" },
                h("span", { cls: "close close-corner", click: () => this.hide() }),
                h("h2", { l10n: titleKey }),
            ),
            this.body,
        );
        this.root = h("div", { id, cls: "modal" }, content);
        this.root.hidden = true;
        this.root.addEventListener("click", (ev) => {
            if (ev.target === this.root) this.hide();
        });
        window.addEventListener("keydown", this.onEsc);
        parent.append(this.root);
    }

    get visible(): boolean {
        return !this.root.hidden;
    }

    show(): void {
        applyL10n(this.root);
        this.root.hidden = false;
    }

    hide(): void {
        this.root.hidden = true;
    }

    destroy(): void {
        window.removeEventListener("keydown", this.onEsc);
        this.root.remove();
    }
}

const LANGS: ReadonlyArray<readonly [Lang, string]> = [
    ["en", "English"],
    ["ko", "한국어"],
];

export class SettingsModal extends Modal {
    private readonly controls = new SettingControls();
    private readonly langSelect: HTMLSelectElement;

    constructor(parent: HTMLElement, setLang: (lang: Lang) => void) {
        super(parent, "modal-settings", "index-settings");
        this.langSelect = h("select", { cls: "language-select" });
        for (const [lang, label] of LANGS) {
            const option = h("option", { text: label });
            option.value = lang;
            this.langSelect.append(option);
        }
        this.langSelect.addEventListener("change", () => setLang(this.langSelect.value as Lang));
        const c = this.controls;
        this.body.append(
            h("div", { cls: "modal-settings-item" }, this.langSelect),
            c.checkbox("screenShake", "index-screen-shake", "screenShake"),
            c.checkbox("anonPlayerNames", "index-anon-player-names", "anonPlayerNames"),
            c.slider("masterVolume", "modal-settings-item slider-container main-volume-slider"),
            c.slider("soundVolume", "modal-settings-item slider-container main-volume-slider"),
            c.slider("musicVolume", "modal-settings-item slider-container main-volume-slider"),
        );
    }

    override show(): void {
        this.langSelect.value = getLang();
        super.show();
    }

    override destroy(): void {
        this.controls.dispose();
        super.destroy();
    }
}

export class KeybindModal extends Modal {
    readonly keybinds = new KeybindsUi({ shareOpen: false });

    constructor(parent: HTMLElement) {
        super(parent, "ui-modal-keybind", "index-customize-keybinds");
        this.body.append(this.keybinds.root);
    }

    override show(): void {
        super.show();
        this.keybinds.applyStrings();
    }

    override hide(): void {
        this.keybinds.cancelCapture();
        super.hide();
    }

    override destroy(): void {
        this.keybinds.destroy();
        super.destroy();
    }
}
