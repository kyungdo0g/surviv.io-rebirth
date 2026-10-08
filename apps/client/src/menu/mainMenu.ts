// Start page (M6), a minimal version of the original's (survev client/index.html #start-menu, main.ts; docs/research/
// ui/menus.md "Start menu"): splash background and logo, the name field (max 16 characters, kept in the config like
// the original config's playerName), Play Solo / Play Duo / Play Squad (find_game with the team mode), Join Team (the
// paste-a-link-or-code panel, the original #team-mobile-link) and Create Team (the team lobby, teamLobby.ts), How to
// Play (controls), a language toggle (English / 한국어) and the error line under the buttons (#server-warning).
// M8: the region select under the name (regionSelect.ts), and the original's bottom-right buttons: settings, keybinds
// and sound (settingsModal.ts; survev index.html #start-bottom-right); name and language live in the config (config.ts).
// Survev content wave stage 4b: the Loadout button opens the loadout menu (loadoutMenu.ts; everything unlocked).
import { toggleMute } from "../audio/shared.ts";
import { config } from "../config.ts";
import { getLang, type Lang, setLang, t } from "../l10n/index.ts";
import { parseRoomCode } from "../net/party.ts";
import { applyL10n, h } from "./dom.ts";
import { LoadoutMenu } from "./loadoutMenu.ts";
import "./menu.css";
import { RegionSelect } from "./regionSelect.ts";
import { KeybindModal, SettingsModal } from "./settingsModal.ts";

/** the protocol's PlayerNameMaxLen (menus.md "Start menu") */
export const NAME_MAX_LEN = 16;
const VERSION = "0.8.82";

export type MenuPanel = "start" | "join" | "lobby";

export interface MainMenuCallbacks {
    /** a quick-play button: 1 solo, 2 duo, 4 squad */
    play(teamMode: 1 | 2 | 4): void;
    createTeam(): void;
    /** join a room by code */
    joinTeam(code: string): void;
    /** the language changed (strings were re-read) */
    langChanged(): void;
    /** the region select changed (M8) */
    regionChanged(region: string): void;
}

/** The language the player chose (config), or null when it never chose one. */
export function storedLang(): Lang | null {
    const v = config().get("lang");
    return v === "ko" || v === "en" ? v : null;
}

/** Help rows: label key, desktop control key (menus.md "How to play"). */
const HELP_ROWS: ReadonlyArray<readonly [string, string]> = [
    ["index-movement", "index-movement-ctrl"],
    ["index-aim", "index-aim-ctrl"],
    ["index-shoot", "index-shoot-ctrl"],
    ["index-change-weapons", "index-change-weapons-ctrl"],
    ["index-reload", "index-reload-ctrl"],
    ["index-revive", "index-pickup-ctrl"],
    ["index-cancel-action", "index-cancel-action-ctrl"],
    ["index-use-ping", "index-use-ping-ctrl"],
    ["index-use-emote", "index-use-emote-ctrl"],
];

export class MainMenu {
    readonly root: HTMLDivElement;
    /** where the panels sit; the team lobby adds its own panel here */
    readonly center: HTMLDivElement;
    private readonly cb: MainMenuCallbacks;
    private readonly startPanel: HTMLDivElement;
    private readonly joinPanel: HTMLDivElement;
    private readonly nameInput: HTMLInputElement;
    private readonly linkInput: HTMLInputElement;
    private readonly warning: HTMLDivElement;
    private readonly help: HTMLDivElement;
    private readonly playButtons: HTMLAnchorElement[] = [];
    private readonly langButtons = new Map<Lang, HTMLAnchorElement>();
    readonly regionSelect: RegionSelect;
    readonly settings: SettingsModal;
    readonly keybinds: KeybindModal;
    readonly loadout: LoadoutMenu;
    private readonly muteButton: HTMLDivElement;
    private readonly unsubscribe: () => void;
    private panel: MenuPanel = "start";
    private lobbyPanel: HTMLElement | null = null;

    constructor(parent: HTMLElement, cb: MainMenuCallbacks) {
        this.cb = cb;
        this.nameInput = h("input", { id: "player-name-input-solo", cls: "menu-option player-name-input" });
        this.nameInput.type = "text";
        this.nameInput.maxLength = NAME_MAX_LEN;
        this.nameInput.dataset.l10nPlaceholder = "index-enter-name-here";
        this.nameInput.value = config().get("playerName");
        this.nameInput.addEventListener("input", () => config().set("playerName", this.nameInput.value));
        this.regionSelect = new RegionSelect("server-select-main", (region) => cb.regionChanged(region));

        const play = (id: string, key: string, mode: 1 | 2 | 4) => {
            const a = h("a", { id, cls: "btn-green btn-darken menu-option", l10n: key, click: () => cb.play(mode) });
            this.playButtons.push(a);
            return a;
        };
        this.help = h("div", { id: "start-help" }, h("h1", { l10n: "index-controls" }));
        for (const [label, key] of HELP_ROWS) {
            this.help.append(
                h(
                    "p",
                    {},
                    h("span", { cls: "help-label", l10n: label }),
                    ": ",
                    h("span", { cls: "help-key", l10n: key }),
                ),
            );
        }
        this.help.append(h("p", { l10n: "index-tips-1-desc" }));
        this.startPanel = h(
            "div",
            { id: "start-menu", cls: "menu-block" },
            this.nameInput,
            this.regionSelect.root,
            play("btn-start-mode-0", "index-play-solo", 1),
            h(
                "div",
                { id: "btns-quick-start", cls: "btns-double-row" },
                play("btn-start-mode-1", "index-play-duo", 2),
                play("btn-start-mode-2", "index-play-squad", 4),
            ),
            h(
                "div",
                { cls: "btns-double-row" },
                h("a", {
                    id: "btn-join-team",
                    cls: "btn-team-option btn-darken menu-option",
                    l10n: "index-join-team",
                    click: () => this.show("join"),
                }),
                h("a", {
                    id: "btn-create-team",
                    cls: "btn-team-option btn-darken menu-option",
                    l10n: "index-create-team",
                    click: () => cb.createTeam(),
                }),
            ),
            h("a", {
                id: "btn-customize",
                cls: "btn-grey btn-darken menu-option",
                l10n: "index-loadout",
                click: () => this.loadout.show(),
            }),
            h("a", {
                id: "btn-help",
                cls: "btn-grey btn-darken menu-option",
                l10n: "index-how-to-play",
                click: () => this.help.classList.toggle("open"),
            }),
            this.help,
        );

        this.linkInput = h("input", { id: "team-link-input", cls: "menu-option" });
        this.linkInput.type = "text";
        this.linkInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") this.submitJoin();
        });
        this.joinPanel = h(
            "div",
            { id: "team-join", cls: "menu-block" },
            h("div", { cls: "team-join-help", l10n: "index-join-team-help" }),
            this.linkInput,
            h("a", {
                id: "btn-team-link-join",
                cls: "btn-team-option btn-darken menu-option",
                l10n: "index-join-team",
                click: () => this.submitJoin(),
            }),
            h("a", {
                id: "btn-team-link-back",
                cls: "btn-grey btn-darken menu-option",
                l10n: "index-back-to-main",
                click: () => this.show("start"),
            }),
        );

        this.warning = h("div", { id: "server-warning" });
        this.center = h("div", { id: "start-main-center" }, this.startPanel, this.joinPanel, this.warning);
        const langs = h("div", { id: "start-top-right" });
        for (const [lang, label] of [
            ["en", "English"],
            ["ko", "한국어"],
        ] as const) {
            const a = h("a", {
                id: `btn-lang-${lang}`,
                cls: "lang-option",
                text: label,
                click: () => this.setLang(lang),
            });
            this.langButtons.set(lang, a);
            langs.append(a);
        }
        const option = (id: string, cls: string, titleKey: string, click: () => void) => {
            const b = h("div", { id, cls: `${cls} menu-option btn-darken btn-start-option`, click });
            b.dataset.l10nTitle = titleKey;
            return b;
        };
        this.muteButton = option("btn-start-mute", "btn-start-mute btn-sound-toggle", "game-sound", () => toggleMute());
        const bottomRight = h(
            "div",
            { id: "start-bottom-right" },
            option("btn-start-settings", "btn-settings", "index-settings", () => this.settings.show()),
            option("btn-start-keybind", "btn-keybind", "index-customize-keybinds", () => this.keybinds.show()),
            this.muteButton,
        );
        this.root = h(
            "div",
            { id: "start-menu-wrapper" },
            h("div", { id: "start-background" }),
            h("div", { id: "start-overlay" }),
            langs,
            h("div", { id: "start-main" }, h("div", { id: "start-row-header" }), this.center),
            h("div", { id: "start-bottom-left" }, h("span", { l10n: "index-version" }), ` ${VERSION}`),
            bottomRight,
        );
        parent.append(this.root);
        this.settings = new SettingsModal(this.root, (lang) => this.setLang(lang));
        this.keybinds = new KeybindModal(this.root);
        this.loadout = new LoadoutMenu(this.root);
        const renderMute = () => {
            const muted = config().get("muteAudio");
            this.muteButton.classList.toggle("audio-on-icon", !muted);
            this.muteButton.classList.toggle("audio-off-icon", muted);
        };
        renderMute();
        this.unsubscribe = config().onChange((key) => {
            if (key === "muteAudio") renderMute();
        });
        this.show("start");
        this.applyStrings();
    }

    /** The player's name as typed (trimmed, at most 16 characters); "" when empty. */
    get name(): string {
        return this.nameInput.value.trim().slice(0, NAME_MAX_LEN);
    }

    get visible(): boolean {
        return !this.root.hidden;
    }

    get currentPanel(): MenuPanel {
        return this.panel;
    }

    /** The lobby panel (teamLobby.ts) shown for `show("lobby")`. */
    setLobbyPanel(panel: HTMLElement): void {
        this.lobbyPanel = panel;
        this.center.insertBefore(panel, this.warning);
        panel.hidden = this.panel !== "lobby";
    }

    show(panel: MenuPanel = this.panel): void {
        this.panel = panel;
        this.root.hidden = false;
        this.startPanel.hidden = panel !== "start";
        this.joinPanel.hidden = panel !== "join";
        if (this.lobbyPanel) this.lobbyPanel.hidden = panel !== "lobby";
        if (panel === "join") {
            this.linkInput.value = "";
            this.linkInput.focus();
        }
    }

    hide(): void {
        this.root.hidden = true;
    }

    /** The error line under the panels ("" hides it). */
    setError(text: string): void {
        this.warning.textContent = text;
        this.warning.classList.toggle("shown", !!text);
    }

    get errorText(): string {
        return this.warning.textContent ?? "";
    }

    /** Play buttons wait while a game is being found (repeated clicks do nothing). */
    setBusy(busy: boolean): void {
        for (const b of this.playButtons) b.classList.toggle("btn-disabled", busy);
    }

    private submitJoin(): void {
        const code = parseRoomCode(this.linkInput.value);
        if (code) this.cb.joinTeam(code);
    }

    /** Switches the language (top-right toggle, settings modal) and remembers it. */
    setLang(lang: Lang): void {
        if (lang === getLang()) return;
        setLang(lang);
        config().set("lang", lang);
        this.applyStrings();
        this.cb.langChanged();
    }

    applyStrings(): void {
        applyL10n(this.root);
        for (const node of this.root.querySelectorAll<HTMLElement>("[data-l10n-title]")) {
            node.title = t(node.dataset.l10nTitle ?? "");
        }
        for (const [lang, a] of this.langButtons) a.classList.toggle("selected", lang === getLang());
        this.regionSelect.applyStrings();
        this.keybinds.keybinds.refresh();
    }

    destroy(): void {
        this.unsubscribe();
        this.settings.destroy();
        this.keybinds.destroy();
        this.loadout.destroy();
        this.root.remove();
    }
}
