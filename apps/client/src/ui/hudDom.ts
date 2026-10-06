// Small DOM helpers shared by the HUD modules (hud.ts, hudModes.ts, hudDrop.ts): element construction with HUD click
// handling, and the diff writer that only touches changed properties (the original UiManager2 diff/patch render).
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: { id?: string; cls?: string; click?: () => void } = {},
    ...children: Array<HTMLElement | SVGElement | string>
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (attrs.id) e.id = attrs.id;
    if (attrs.cls) e.className = attrs.cls;
    if (attrs.click) {
        e.setAttribute(HUD_INTERACTIVE_ATTR, "");
        e.addEventListener("click", (ev) => {
            ev.stopPropagation();
            attrs.click?.();
        });
        e.addEventListener("mousedown", (ev) => ev.stopPropagation());
    }
    for (const c of children) e.append(c);
    return e;
}

/** Writes a DOM property only when it changed (the original UiManager2 diff/patch render). */
export class Patcher {
    private readonly last = new Map<string, string | number | boolean>();
    set(key: string, value: string | number | boolean, write: () => void): void {
        if (this.last.get(key) === value) return;
        this.last.set(key, value);
        write();
    }
    clear(): void {
        this.last.clear();
    }
}

/** Replaces the children of `node` with the lines, separated by <br> (perk descriptions keep their line breaks). */
export function setLines(node: HTMLElement, lines: readonly string[]): void {
    node.replaceChildren();
    lines.forEach((line, i) => {
        if (i > 0) node.append(document.createElement("br"));
        node.append(line);
    });
}
