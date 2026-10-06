// Tiny DOM builders for the menus: an element with id / classes / a `data-l10n` key whose text is re-read on a language
// change (`applyL10n`). Settings storage lives in config.ts (M8).
import { t } from "../l10n/index.ts";

export interface ElOptions {
    id?: string;
    cls?: string;
    /** string table key: the element's text, refreshed by `applyL10n` */
    l10n?: string;
    text?: string;
    click?: (ev: MouseEvent) => void;
}

export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    opts: ElOptions = {},
    ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (opts.id) e.id = opts.id;
    if (opts.cls) e.className = opts.cls;
    if (opts.l10n) {
        e.dataset.l10n = opts.l10n;
        e.textContent = t(opts.l10n);
    } else if (opts.text !== undefined) {
        e.textContent = opts.text;
    }
    if (opts.click) {
        const click = opts.click;
        e.addEventListener("click", (ev) => {
            ev.preventDefault();
            click(ev as MouseEvent);
        });
    }
    for (const c of children) e.append(c);
    return e;
}

/** Re-reads every `data-l10n` text under `root` (after a language change). */
export function applyL10n(root: HTMLElement): void {
    for (const node of root.querySelectorAll<HTMLElement>("[data-l10n]")) {
        node.textContent = t(node.dataset.l10n ?? "");
    }
    for (const node of root.querySelectorAll<HTMLInputElement>("[data-l10n-placeholder]")) {
        node.placeholder = t(node.dataset.l10nPlaceholder ?? "");
    }
}
