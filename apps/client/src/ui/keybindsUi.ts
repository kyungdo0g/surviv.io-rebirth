// The keybind screen (M8), shown in the main page's keybind modal and the in-game menu's Keybinds tab (survev
// inputBinds.ts InputBindUi, ui/menu.ts keybind modal; docs/research/ui/controls.md "Rebinding and bind sharing"):
// one row per action (name button + bound key); click a row, then press a key, a mouse button or turn the wheel.
// Escape cancels, Backspace clears the bind; Ctrl, Alt, Windows / Meta, ContextMenu and F1-F12 are refused (the screen
// keeps waiting). Binding a code another action uses unbinds that action (keybinds.ts). "Restore Defaults" reloads the
// default table. The share section shows the table's code (click to copy) and loads a pasted code; a code with a bad
// CRC shows "Invalid code!". The capture listens on window in the capture phase, so the press never reaches the game.

import { canonicalCode, isBindable } from "../input/bindCodec.ts";
import { BIND_DEFS, type BindCode, bindLabel, binds } from "../input/keybinds.ts";
import { t } from "../l10n/index.ts";
import { applyL10n, h } from "../menu/dom.ts";
import { showToast } from "./toast.ts";
import "./settings.css";

/** survev InputBindUi disallowKeys: Control, Alt, Windows, ContextMenu, F1-F12 */
const REFUSED = new Set([
    "ControlLeft",
    "AltLeft",
    "MetaLeft",
    "MetaRight",
    "ContextMenu",
    ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

export class KeybindsUi {
    readonly root: HTMLDivElement;
    private readonly list: HTMLDivElement;
    private readonly share: HTMLDivElement;
    private readonly link: HTMLDivElement;
    private readonly codeInput: HTMLInputElement;
    private readonly warning: HTMLDivElement;
    private capturing: { action: number; button: HTMLElement } | null = null;
    private readonly unsubscribe: () => void;

    /** `shareOpen`: the share section starts visible (else the Share button toggles it). */
    constructor(opts: { shareOpen?: boolean } = {}) {
        this.list = h("div", { cls: "ui-keybind-list js-keybind-list" });
        this.link = h("div", { cls: "keybind-link js-keybind-link", click: () => this.copyCode() });
        this.codeInput = h("input", { cls: "menu-option keybind-code-input js-keybind-code-input" });
        this.codeInput.type = "text";
        this.codeInput.dataset.l10nPlaceholder = "index-keybind-placeholder";
        this.codeInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") this.loadCode();
        });
        this.warning = h("div", { cls: "keybind-warning js-keybind-warning", l10n: "index-keybind-invalid" });
        this.warning.hidden = true;
        this.share = h(
            "div",
            { cls: "ui-keybind-share js-keybind-share" },
            h("div", { cls: "keybind-share-label" }, h("span", { l10n: "index-keybind-link" }), ":"),
            h(
                "div",
                { cls: "keybind-link-text" },
                this.link,
                h("span", { cls: "keybind-copy copy-item btn-darken", click: () => this.copyCode() }),
            ),
            h("div", { cls: "keybind-share-label" }, h("span", { l10n: "index-keybind-paste" }), ":"),
            this.warning,
            h(
                "div",
                { cls: "keybind-share-row" },
                this.codeInput,
                h("a", {
                    cls: "btn-game-menu btn-darken js-btn-keybind-code-load",
                    l10n: "index-keybind-apply",
                    click: () => this.loadCode(),
                }),
            ),
        );
        this.share.hidden = !opts.shareOpen;
        const footer = h(
            "div",
            { cls: "ui-keybind-footer" },
            h("a", {
                cls: "btn-game-menu btn-darken js-btn-keybind-share",
                l10n: "game-share",
                click: () => {
                    this.share.hidden = !this.share.hidden;
                },
            }),
            h("a", {
                cls: "btn-game-menu btn-darken btn-keybind-restore js-btn-keybind-restore",
                l10n: "game-restore-defaults",
                click: () => {
                    this.cancelCapture();
                    binds().restoreDefaults();
                },
            }),
        );
        this.root = h("div", { cls: "ui-keybinds" }, this.list, this.share, footer);
        this.root.addEventListener("contextmenu", (ev) => ev.preventDefault());
        this.unsubscribe = binds().onChange(() => this.refresh());
        this.refresh();
    }

    /** Rebuilds the rows and the share code from the bind table. */
    refresh(): void {
        const table = binds();
        this.list.replaceChildren();
        for (const def of BIND_DEFS) {
            const button = h("a", {
                cls: "btn-game-menu btn-darken btn-keybind-desc",
                text: t(def.key),
                click: () => this.startCapture(def.action, button),
            });
            button.dataset.action = String(def.action);
            if (this.capturing?.action === def.action) {
                button.classList.add("btn-keybind-desc-selected");
                this.capturing.button = button;
            }
            const value = h("div", { cls: "btn-keybind-display", text: bindLabel(table.get(def.action)) });
            const row = h("div", { cls: "ui-keybind-container" }, button, value);
            row.dataset.action = String(def.action);
            this.list.append(row);
        }
        this.link.textContent = table.toShareCode();
    }

    applyStrings(): void {
        applyL10n(this.root);
        this.refresh();
    }

    /** the action waiting for a key, or -1 */
    get capturingAction(): number {
        return this.capturing?.action ?? -1;
    }

    private startCapture(action: number, button: HTMLElement): void {
        this.cancelCapture();
        this.capturing = { action, button };
        button.classList.add("btn-keybind-desc-selected");
        window.addEventListener("keydown", this.onKey, true);
        window.addEventListener("mousedown", this.onMouse, true);
        window.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
    }

    cancelCapture(): void {
        if (!this.capturing) return;
        this.capturing.button.classList.remove("btn-keybind-desc-selected");
        this.capturing = null;
        window.removeEventListener("keydown", this.onKey, true);
        window.removeEventListener("mousedown", this.onMouse, true);
        window.removeEventListener("wheel", this.onWheel, true);
    }

    private readonly onKey = (ev: KeyboardEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.repeat) return;
        this.captured(canonicalCode(ev.code));
    };

    private readonly onMouse = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.captured(`Mouse${ev.button}`);
    };

    private readonly onWheel = (ev: WheelEvent): void => {
        if (ev.deltaY === 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.captured(ev.deltaY < 0 ? "WheelUp" : "WheelDown");
    };

    /** A press while waiting: refused keys keep waiting, Escape cancels, Backspace clears, anything else binds. */
    private captured(code: BindCode): void {
        const capture = this.capturing;
        if (!capture || REFUSED.has(code)) return;
        if (code !== "Escape" && code !== "Backspace" && !isBindable(code)) return;
        this.cancelCapture();
        if (code === "Escape") return;
        binds().set(capture.action, code === "Backspace" ? null : code);
    }

    private copyCode(): void {
        const code = this.link.textContent ?? "";
        navigator.clipboard?.writeText(code).catch(() => {});
        showToast(t("index-copied"));
    }

    private loadCode(): void {
        const code = this.codeInput.value.trim();
        this.codeInput.value = "";
        const ok = !!code && binds().loadShareCode(code);
        this.warning.hidden = ok;
        if (ok) showToast(t("index-keybind-loaded"));
    }

    destroy(): void {
        this.cancelCapture();
        this.unsubscribe();
        this.root.remove();
    }
}
