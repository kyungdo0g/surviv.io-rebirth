// The desktop minimap's two buttons (survev index.html #ui-settings-container-desktop: #ui-map-expand-desktop with
// img/gui/mag-glass.svg and #ui-map-minimize with img/gui/minimize.svg; css/game.css .ui-settings-button,
// #ui-settings-container-desktop, #ui-map-minimize; ui.ts click handlers and displayMapLarge; seen in every desktop
// recording, docs/research/provenance/visual-diff.md): 48 px squares at 50 % opacity over the minimap's bottom corners,
// inside #ui-map-container, which is 52 px above the map wrapper (12 px from the screen's bottom left) and scaled by
// the HUD scale. The magnifier opens or closes the big map; the minimize button toggles the minimap (like the Toggle
// Minimap key). The original hides `.js-ui-map-hidden` elements while the big map is open, which takes the minimize
// button, but its desktop selector "js-ui-desktop-map-hidden" lacks the dot, so the magnifier stays and closes the big
// map again. Not drawn on the small layout and on touch devices (the touch HUD has its own controls).
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import "./minimapButtons.css";

export interface MinimapButtonsCallbacks {
    toggleBigMap(): void;
    toggleMinimap(): void;
}

export interface MinimapButtonsFrame {
    /** HUD scale factor (survev screenScaleFactor) */
    scale: number;
    /** the small layout or a touch device: no desktop buttons */
    hidden: boolean;
    bigMap: boolean;
}

function button(id: string, img: string, onClick: () => void): HTMLDivElement {
    const b = document.createElement("div");
    b.id = id;
    b.className = "ui-settings-button";
    b.setAttribute(HUD_INTERACTIVE_ATTR, "");
    const image = document.createElement("img");
    image.src = `/assets/img/gui/${img}`;
    image.draggable = false;
    b.append(image);
    // survev ui.ts: mousedown stops here so it does not shoot or open the emote wheel
    b.addEventListener("mousedown", (ev) => ev.stopPropagation());
    b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onClick();
    });
    return b;
}

export class MinimapButtons {
    readonly root = document.createElement("div");
    private readonly minimize: HTMLDivElement;
    private last = "";

    constructor(hudRoot: HTMLElement, cb: MinimapButtonsCallbacks) {
        this.root.id = "ui-settings-container-desktop";
        const expand = button("ui-map-expand-desktop", "mag-glass.svg", () => cb.toggleBigMap());
        this.minimize = button("ui-map-minimize", "minimize.svg", () => cb.toggleMinimap());
        this.root.append(expand, this.minimize);
        hudRoot.append(this.root);
    }

    update(frame: MinimapButtonsFrame): void {
        const key = `${frame.scale}|${frame.hidden}|${frame.bigMap}`;
        if (key === this.last) return;
        this.last = key;
        this.root.hidden = frame.hidden;
        this.minimize.hidden = frame.bigMap;
        // the container point: 12 px from the left, 12 + 52 x scale px from the bottom (#ui-map-container bottom 52)
        this.root.style.bottom = `${12 + 52 * frame.scale}px`;
        this.root.style.transform = `scale(${frame.scale})`;
    }

    destroy(): void {
        this.root.remove();
    }
}
