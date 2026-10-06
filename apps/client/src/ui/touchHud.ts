// Touch HUD actions (M8; survev ui/ui.ts "Touch specific buttons", index.html #ui-menu-display / #big-map-close /
// #ui-emote-button / #ui-reload-button-container, emote.ts touch listeners; docs/research/ui/controls.md "Touch HUD
// actions", hud.md "Pings and emote wheel"): on touch devices the clip, the reserve and the reload button reload when
// tapped (survev reloadElems), the interaction prompt becomes a button (pick up / revive / open, and Cancel during an
// action: it sends Interact and Cancel like the original's interactionTouched), the cog over the minimap opens the
// in-game menu, the "surviv icon" emote button opens the emote wheel and the big map gets a close button. Weapon slots,
// scopes and medical items already take taps (their click handlers) and drop after a 0.75 s hold (hudDrop.ts); a tap on
// the minimap opens the big map and a tap on the big map opens the ping wheel (touch.ts, clientControls.ts).
// Positions: hudSm.css (touch always plays the small layout); the menu button falls back to the minimap's right side.
import { Input } from "@rebirth/defs";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import "./touch.css";

export interface TouchHudCallbacks {
    action(action: number): void;
    openMenu(): void;
    closeBigMap(): void;
    /** the emote button: open the emote wheel */
    openEmoteWheel(): void;
}

type Rect = { x: number; y: number; width: number; height: number };

function button(id: string, cls: string): HTMLDivElement {
    const b = document.createElement("div");
    b.id = id;
    b.className = cls;
    b.setAttribute(HUD_INTERACTIVE_ATTR, "");
    return b;
}

export class TouchHud {
    private readonly hudRoot: HTMLElement;
    private readonly menuButton: HTMLDivElement;
    private readonly closeButton: HTMLDivElement;
    readonly emoteButton: HTMLDivElement;
    private readonly cleanups: Array<() => void> = [];
    private lastRect = "";

    constructor(hudRoot: HTMLElement, cb: TouchHudCallbacks) {
        this.hudRoot = hudRoot;
        hudRoot.classList.add("ui-touch");
        for (const id of ["#ui-current-clip", "#ui-remaining-ammo", "#ui-reload-button-container"]) {
            this.tappable(hudRoot.querySelector<HTMLElement>(id), "click", () => cb.action(Input.Reload));
        }
        this.tappable(hudRoot.querySelector<HTMLElement>("#ui-interaction"), "click", () => {
            cb.action(Input.Interact);
            cb.action(Input.Cancel);
        });
        this.menuButton = button("ui-menu-display", "ui-touch-button");
        this.closeButton = button("big-map-close", "ui-touch-button");
        this.emoteButton = button("ui-emote-button", "ui-touch-button");
        this.tappable(this.menuButton, "click", () => cb.openMenu());
        this.tappable(this.closeButton, "click", () => cb.closeBigMap());
        // the wheel opens on touchstart, which must not reach the wheel's own "tap elsewhere closes" listener
        this.tappable(this.emoteButton, "touchstart", () => cb.openEmoteWheel());
        this.closeButton.hidden = true;
        hudRoot.append(this.menuButton, this.closeButton, this.emoteButton);
    }

    /** Makes a HUD element take taps (the original sets pointer-events: auto on touch). */
    private tappable(el: HTMLElement | null, type: "click" | "touchstart", onTap: () => void): void {
        if (!el) return;
        el.setAttribute(HUD_INTERACTIVE_ATTR, "");
        const handler = (ev: Event) => {
            ev.stopPropagation();
            onTap();
        };
        el.addEventListener(type, handler, { passive: true });
        this.cleanups.push(() => {
            el.removeEventListener(type, handler);
            el.removeAttribute(HUD_INTERACTIVE_ATTR);
        });
    }

    /**
     * Shows the big map's close button while it is open and hides the menu button meanwhile; on the large layout the
     * menu button sits right of the minimap (the small layout places it with CSS, over the minimap's corner).
     */
    update(minimap: Rect | null, bigMap: boolean, small: boolean): void {
        this.closeButton.hidden = !bigMap;
        this.menuButton.hidden = bigMap || !minimap;
        const key = small || !minimap ? "sm" : `${minimap.x}|${minimap.y}|${minimap.width}`;
        if (key === this.lastRect) return;
        this.lastRect = key;
        this.menuButton.style.left = small || !minimap ? "" : `${Math.round(minimap.x + minimap.width + 8)}px`;
        this.menuButton.style.top = small || !minimap ? "" : `${Math.round(minimap.y)}px`;
    }

    destroy(): void {
        for (const fn of this.cleanups.splice(0)) fn();
        this.menuButton.remove();
        this.closeButton.remove();
        this.emoteButton.remove();
        this.hudRoot.classList.remove("ui-touch");
    }
}
