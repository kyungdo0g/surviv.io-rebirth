// Rebirth damage vignette (user/2026-10-07-hit-feedback): a red screen edge that pulses when the active player takes
// damage, its peak scaled by the damage (fx/hitFeedbackMath.ts vignettePeak), and a faint pulsing floor while it is
// below 25 HP (the original HUD's danger pulse threshold). It is a DOM layer right after the rebirth red-zone flash
// (#ui-gas-flash, ui/matchHud.ts) inside the HUD root, so Hide UI hides both. The opacity is written only when its
// rounded value changes. Not in v0.8.82.
import { lowHealthFloor, stackVignette, VIGNETTE_DECAY, VIGNETTE_HOLD, vignettePeak } from "../fx/hitFeedbackMath.ts";

export class HitVignette {
    private readonly el: HTMLDivElement | null;
    private level = 0;
    private hold = 0;
    private time = 0;
    private written = -1;
    /** opacity shown now, rounded to 0.01 (tests) */
    shown = 0;

    /** `root`: the HUD root (null in tests: state only). */
    constructor(root: HTMLElement | null) {
        if (!root) {
            this.el = null;
            return;
        }
        const el = document.createElement("div");
        el.id = "ui-hit-vignette";
        const gas = root.querySelector("#ui-gas-flash");
        if (gas) gas.after(el);
        else root.prepend(el);
        this.el = el;
    }

    /** A hit of intensity k landed on the active player. */
    hit(k: number): void {
        this.level = stackVignette(this.level, vignettePeak(k));
        this.hold = VIGNETTE_HOLD;
    }

    /** Per frame; `health` is the active player's while it is alive and standing, else null (no floor). */
    update(dt: number, health: number | null): void {
        this.time += dt;
        if (this.hold > 0) this.hold -= dt;
        else this.level = Math.max(0, this.level - dt * VIGNETTE_DECAY);
        const floor = health === null ? 0 : lowHealthFloor(health, this.time);
        this.shown = Math.round(Math.max(this.level, floor) * 100) / 100;
        if (this.shown === this.written || !this.el) return;
        this.written = this.shown;
        this.el.style.opacity = this.shown.toFixed(2);
        this.el.style.display = this.shown > 0 ? "block" : "none";
    }

    /** Clears the vignette (setting off, a new active player). */
    reset(): void {
        this.level = 0;
        this.hold = 0;
        this.update(0, null);
    }

    destroy(): void {
        this.el?.remove();
    }
}
