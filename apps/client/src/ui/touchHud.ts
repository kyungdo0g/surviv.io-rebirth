// Touch HUD actions (M8; survev ui/ui.ts "Touch specific buttons", index.html #ui-menu-display / #big-map-close;
// docs/research/ui/controls.md "Touch HUD actions"): on touch devices the equipped ammo counter reloads when tapped,
// the interaction prompt becomes a button (pick up / revive / open, and Cancel during an action: it sends Interact and
// Cancel like the original's interactionTouched), a menu button beside the minimap opens the in-game menu and the big
// map gets a close button. Weapon slots, scopes and medical items already take taps (their click handlers) and drop
// after a 0.75 s hold (hudDrop.ts); a tap on the minimap opens the big map (touch.ts).
import { Input } from "@rebirth/defs";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import "./touch.css";

export interface TouchHudCallbacks {
    action(action: number): void;
    openMenu(): void;
    closeBigMap(): void;
}

function button(id: string, cls: string, onTap: () => void): HTMLDivElement {
    const b = document.createElement("div");
    b.id = id;
    b.className = cls;
    b.setAttribute(HUD_INTERACTIVE_ATTR, "");
    b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onTap();
    });
    return b;
}

export class TouchHud {
    private readonly hudRoot: HTMLElement;
    private readonly menuButton: HTMLDivElement;
    private readonly closeButton: HTMLDivElement;
    private readonly cleanups: Array<() => void> = [];
    private lastRect = "";

    constructor(hudRoot: HTMLElement, cb: TouchHudCallbacks) {
        this.hudRoot = hudRoot;
        hudRoot.classList.add("ui-touch");
        this.tappable("#ui-bullet-counter", () => cb.action(Input.Reload));
        this.tappable("#ui-interaction", () => {
            cb.action(Input.Interact);
            cb.action(Input.Cancel);
        });
        this.menuButton = button("ui-menu-display", "ui-touch-button", () => cb.openMenu());
        this.closeButton = button("big-map-close", "ui-touch-button", () => cb.closeBigMap());
        this.closeButton.hidden = true;
        hudRoot.append(this.menuButton, this.closeButton);
    }

    /** Makes a HUD element take taps (the original sets pointer-events: auto on touch). */
    private tappable(selector: string, onTap: () => void): void {
        const el = this.hudRoot.querySelector<HTMLElement>(selector);
        if (!el) return;
        el.setAttribute(HUD_INTERACTIVE_ATTR, "");
        const handler = (ev: Event) => {
            ev.stopPropagation();
            onTap();
        };
        el.addEventListener("click", handler);
        this.cleanups.push(() => {
            el.removeEventListener("click", handler);
            el.removeAttribute(HUD_INTERACTIVE_ATTR);
        });
    }

    /** Places the menu button next to the minimap and shows the big map's close button while it is open. */
    update(minimap: { x: number; y: number; width: number; height: number } | null, bigMap: boolean): void {
        this.closeButton.hidden = !bigMap;
        this.menuButton.hidden = bigMap || !minimap;
        if (!minimap) return;
        const key = `${minimap.x}|${minimap.y}|${minimap.width}`;
        if (key === this.lastRect) return;
        this.lastRect = key;
        this.menuButton.style.left = `${Math.round(minimap.x + minimap.width + 8)}px`;
        this.menuButton.style.top = `${Math.round(minimap.y)}px`;
    }

    destroy(): void {
        for (const fn of this.cleanups.splice(0)) fn();
        this.menuButton.remove();
        this.closeButton.remove();
        this.hudRoot.classList.remove("ui-touch");
    }
}
