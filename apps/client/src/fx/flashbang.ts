// The flashbang on the client (the owner, 2026-10-10; defs rebirth/throwables.ts FLASHBANG_FLASH): when the active
// player was flashed (Snapshot.flash, strengths 0..1 by distance and line of sight, sim combat/flash.ts), the screen
// goes white and fades back, and every sound but the music is muffled and comes back:
// - white: opacity min(1, 1.25 x blind), held for 40 % of blind x blindTime, then fading out over the rest (ease-in,
//   so the last of it lingers); a flash behind a wall (blind 0) shows nothing;
// - hearing: AudioEngine.setDeafness(deaf), easing back to 0 over deaf x deafTime.
// A stronger flash replaces a fading one; a weaker one keeps the stronger. A DOM layer over the world, under the HUD
// buttons (pointer-events none), inside the HUD root like the damage vignette; Hide UI does not hide it.
import { FLASHBANG_FLASH } from "@rebirth/defs";
import type { FlashEvent } from "@rebirth/sim";

/** Share of the white-out spent at full strength before it fades. */
const HOLD_SHARE = 0.4;
const WHITE_GAIN = 1.25;

export interface Deafenable {
    setDeafness(t: number): void;
}

/** Opacity of the white-out `t` seconds after a flash of strength `blind`. */
export function whiteAt(blind: number, t: number): number {
    const total = blind * FLASHBANG_FLASH.blindTime;
    if (blind <= 0 || t >= total) return 0;
    const peak = Math.min(1, blind * WHITE_GAIN);
    const hold = total * HOLD_SHARE;
    if (t <= hold) return peak;
    const k = 1 - (t - hold) / (total - hold);
    return peak * k * k * (3 - 2 * k);
}

/** Deafness `t` seconds after a flash of strength `deaf`. */
export function deafAt(deaf: number, t: number): number {
    const total = deaf * FLASHBANG_FLASH.deafTime;
    if (deaf <= 0 || t >= total) return 0;
    return deaf * Math.sqrt(1 - t / total);
}

export class FlashbangFx {
    private readonly el: HTMLDivElement | null;
    private readonly audio: Deafenable;
    private blind = 0;
    private deaf = 0;
    private blindT = 0;
    private deafT = 0;
    private written = -1;
    /** opacity of the white-out now, rounded to 0.01 (tests, e2e) */
    shown = 0;
    /** flashes received (tests, e2e) */
    count = 0;

    /** `root`: the HUD root (null in tests: state only). */
    constructor(root: HTMLElement | null, audio: Deafenable) {
        this.audio = audio;
        if (!root) {
            this.el = null;
            return;
        }
        const el = document.createElement("div");
        el.id = "ui-flashbang";
        el.style.cssText = "display:none;position:absolute;inset:0;opacity:0;pointer-events:none;background:#fff;";
        root.prepend(el);
        this.el = el;
    }

    /** A flash reached the active player. */
    flash(f: FlashEvent): void {
        this.count++;
        if (whiteAt(f.blind, 0) >= whiteAt(this.blind, this.blindT)) {
            this.blind = f.blind;
            this.blindT = 0;
        }
        if (f.deaf >= deafAt(this.deaf, this.deafT)) {
            this.deaf = f.deaf;
            this.deafT = 0;
        }
    }

    update(dt: number): void {
        this.blindT += dt;
        this.deafT += dt;
        this.audio.setDeafness(deafAt(this.deaf, this.deafT));
        this.shown = Math.round(whiteAt(this.blind, this.blindT) * 100) / 100;
        if (this.shown === this.written || !this.el) return;
        this.written = this.shown;
        this.el.style.opacity = this.shown.toFixed(2);
        this.el.style.display = this.shown > 0 ? "block" : "none";
    }

    /** Ends any flash (a new map, the game left). */
    reset(): void {
        this.blind = 0;
        this.deaf = 0;
        this.update(0);
    }

    destroy(): void {
        this.reset();
        this.el?.remove();
    }
}
