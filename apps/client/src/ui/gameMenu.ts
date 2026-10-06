// In-game (Esc) menu (M8; survev index.html #ui-game-menu, ui/ui.ts toggleEscMenu, touch.ts setMobileStyling;
// docs/research/ui/menus.md "In-game (Esc) menu"): two tabs on desktop, Settings and Keybinds. Settings: Full Screen,
// on touch devices the move / aim stick style toggles ("anywhere" / "locked") and Aim Line, Sound (mute toggle) with
// the Master / SFX / Music sliders, and Quit Game; "Return to Game" closes the menu (desktop only). Keybinds: the
// rebinding screen with Restore Defaults and the share code (keybindsUi.ts). Escape toggles it (after closing the big
// map, client.ts); on touch the menu button opens it and a tap outside closes it. Presses on the menu never reach the
// game (data-hud-click), like the original's menuHovered.
import { config } from "../config.ts";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import { t } from "../l10n/index.ts";
import { applyL10n, h } from "../menu/dom.ts";
import { KeybindsUi } from "./keybindsUi.ts";
import { SettingControls, toggleFullscreen } from "./settingsControls.ts";
import "./settings.css";
import { toggleMute } from "../audio/shared.ts";

export interface GameMenuCallbacks {
    /** Quit Game: leave the game */
    quit(): void;
}

type Tab = "settings" | "keybinds";

export class GameMenu {
    readonly root: HTMLDivElement;
    private readonly panel: HTMLDivElement;
    private readonly controls = new SettingControls();
    private readonly keybinds: KeybindsUi;
    private readonly tabs = new Map<Tab, { button: HTMLAnchorElement; body: HTMLDivElement }>();
    private readonly touch: boolean;
    private tab: Tab = "settings";
    private open = false;
    private readonly onPointerDown = (ev: PointerEvent) => {
        if (this.open && !this.panel.contains(ev.target as Node)) this.close();
    };

    constructor(parent: HTMLElement, cb: GameMenuCallbacks, touch: boolean) {
        this.touch = touch;
        this.keybinds = new KeybindsUi({ shareOpen: false });
        const settings = this.buildSettings(cb);
        const keybindsTab = h("div", { id: "ui-game-tab-keybinds", cls: "ui-game-tab" }, this.keybinds.root);
        const tabButton = (tab: Tab, id: string, key: string, icon: string) => {
            const button = h("a", {
                id,
                cls: `btn-game-tab-select btn-game-menu btn-darken ${icon}`,
                l10n: key,
                click: () => this.selectTab(tab),
            });
            return button;
        };
        const settingsBtn = tabButton("settings", "btn-game-settings", "index-settings", "settings-icon");
        const keybindsBtn = tabButton("keybinds", "btn-game-keybinds", "game-keybinds", "keybind-icon");
        this.tabs.set("settings", { button: settingsBtn, body: settings });
        this.tabs.set("keybinds", { button: keybindsBtn, body: keybindsTab });
        const tabRow = h("div", { id: "btn-game-tabs", cls: "btns-game-double-row" }, settingsBtn, keybindsBtn);
        // the small (touch) layout has no tabs and no Resume button (survev touch.ts setMobileStyling)
        tabRow.hidden = touch;
        const resume = h("a", {
            id: "btn-game-resume",
            cls: "btn-game-menu btn-darken resume-icon",
            l10n: "game-return-to-game",
            click: () => this.close(),
        });
        resume.hidden = touch;
        this.panel = h("div", { id: "ui-game-menu" }, tabRow, settings, keybindsTab, resume);
        this.panel.setAttribute(HUD_INTERACTIVE_ATTR, "");
        this.root = h("div", { id: "ui-game-menu-wrapper" }, this.panel);
        this.root.hidden = true;
        // a tap on the game (outside the panel) closes the menu on touch devices (survev ui.ts)
        if (touch) window.addEventListener("pointerdown", this.onPointerDown, true);
        parent.append(this.root);
        this.selectTab("settings");
    }

    private buildSettings(cb: GameMenuCallbacks): HTMLDivElement {
        const c = this.controls;
        const fullscreen = h("a", {
            id: "btn-game-fullscreen",
            cls: "btn-game-menu btn-darken fullscreen-icon",
            l10n: "game-full-screen",
            click: () => toggleFullscreen(),
        });
        const style = (id: string, label: string, key: "touchMoveStyle" | "touchAimStyle") => {
            const a = h("a", {
                id,
                cls: "btn-game-menu btn-darken btn-game-touch-style",
                click: () => config().set(key, config().get(key) === "locked" ? "anywhere" : "locked"),
            });
            c.watch([key], () => {
                const locked = config().get(key) === "locked";
                a.textContent = `${t(label)}: ${t(locked ? "game-touch-locked" : "game-touch-anywhere")}`;
                a.classList.toggle("locked-on-icon", locked);
                a.classList.toggle("unlocked-on-icon", !locked);
                a.dataset.style = locked ? "locked" : "anywhere";
            });
            return a;
        };
        const touchStyles = h(
            "div",
            { id: "btn-touch-styles" },
            style("btn-game-move-style", "game-touch-move-style", "touchMoveStyle"),
            style("btn-game-aim-style", "game-touch-aim-style", "touchAimStyle"),
        );
        const aimLine = h("a", {
            id: "btn-game-aim-line",
            cls: "btn-game-menu btn-darken",
            l10n: "game-aim-line",
            click: () => config().set("touchAimLine", !config().get("touchAimLine")),
        });
        c.watch(["touchAimLine"], () => {
            const on = config().get("touchAimLine");
            aimLine.classList.toggle("aim-line-on-icon", on);
            aimLine.classList.toggle("aim-line-off-icon", !on);
            aimLine.dataset.on = String(on);
        });
        touchStyles.hidden = !this.touch;
        aimLine.hidden = !this.touch;
        const sound = h("a", {
            id: "btn-game-sound",
            cls: "btn-sound-toggle btn-game-menu btn-darken",
            l10n: "game-sound",
            click: () => toggleMute(),
        });
        c.watch(["muteAudio"], () => {
            const muted = config().get("muteAudio");
            sound.classList.toggle("audio-on-icon", !muted);
            sound.classList.toggle("audio-off-icon", muted);
            sound.dataset.muted = String(muted);
        });
        const quit = h("a", {
            id: "btn-game-quit",
            cls: "btn-quit btn-game-menu btn-darken quit-icon",
            l10n: "game-quit-game",
            click: () => {
                this.close();
                cb.quit();
            },
        });
        return h(
            "div",
            { id: "ui-game-tab-settings", cls: "ui-game-tab" },
            fullscreen,
            touchStyles,
            aimLine,
            sound,
            c.slider("masterVolume", "slider-container ui-slider-container"),
            c.slider("soundVolume", "slider-container ui-slider-container"),
            c.slider("musicVolume", "slider-container ui-slider-container"),
            quit,
        );
    }

    get visible(): boolean {
        return this.open;
    }

    get currentTab(): Tab {
        return this.tab;
    }

    selectTab(tab: Tab): void {
        if (this.touch) tab = "settings";
        this.tab = tab;
        for (const [name, { button, body }] of this.tabs) {
            button.classList.toggle("btn-game-menu-selected", name === tab);
            body.hidden = name !== tab;
        }
        if (tab === "keybinds") this.keybinds.refresh();
        else this.keybinds.cancelCapture();
    }

    toggle(): void {
        if (this.open) this.close();
        else this.show();
    }

    show(): void {
        this.open = true;
        applyL10n(this.root);
        this.selectTab(this.tab);
        this.root.hidden = false;
    }

    close(): void {
        this.open = false;
        this.keybinds.cancelCapture();
        this.root.hidden = true;
    }

    destroy(): void {
        window.removeEventListener("pointerdown", this.onPointerDown, true);
        this.controls.dispose();
        this.keybinds.destroy();
        this.root.remove();
    }
}
