// Reload / item use / revive pie timer of the HUD (survev client/src/ui/pieTimer.ts, ui.ts updateActionTimer;
// docs/research/ui/hud.md "Interaction prompt and action timer"): label, a white arc on a dark disc and the countdown
// with one decimal, a third of the way down the screen times the HUD scale factor. Split out of hud.ts (M8): on the
// small layout the original draws it at half size, 25 px (landscape) / 100 px (portrait) lower (survev pieTimer.ts
// resize, touch.ts mobileOffsetLandscape / Portrait); the half size is in hudSm.css.
import type { LocalPlayerState } from "@rebirth/sim";
import { isSov, itemName, t } from "../l10n/index.ts";
import { el, Patcher } from "./hudDom.ts";
import { hudScale, type LayoutState, UiLayout } from "./uiLayout.ts";

/** survev touch.ts mobileOffsetLandscape / mobileOffsetPortrait */
const SM_OFFSET_LANDSCAPE = 25;
const SM_OFFSET_PORTRAIT = 100;
const ARC_RADIUS = 35;

export interface ObjectAction {
    label: string;
    time: number;
    duration: number;
}

export class PieTimer {
    readonly root = el("div", { id: "ui-pie-timer" });
    private readonly arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    private readonly count = el("div", { cls: "ui-pie-count" });
    private readonly label = el("div", { cls: "ui-pie-label" });
    private readonly p = new Patcher();
    /** local copy of the running action, advanced between snapshots */
    private action = { key: "", time: 0, duration: 0 };

    constructor() {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 72 72");
        const bg = document.createElementNS(ns, "circle");
        for (const [k, v] of Object.entries({ cx: "36", cy: "36", r: "36", fill: "rgba(0, 0, 0, 0.27)" })) {
            bg.setAttribute(k, v);
        }
        const attrs = {
            cx: "36",
            cy: "36",
            r: String(ARC_RADIUS),
            fill: "none",
            stroke: "#ffffff",
            "stroke-width": "6",
        };
        for (const [k, v] of Object.entries(attrs)) this.arc.setAttribute(k, v);
        this.arc.setAttribute("transform", "rotate(-90 36 36)");
        this.arc.setAttribute("stroke-dasharray", String(2 * Math.PI * ARC_RADIUS));
        svg.append(bg, this.arc);
        this.root.append(svg, this.count, this.label);
        this.root.style.display = "none";
    }

    /** Re-applies every property next frame (language change). */
    clear(): void {
        this.p.clear();
    }

    update(
        local: LocalPlayerState,
        dt: number,
        objectAction: ObjectAction | null,
        actionTarget: string,
        layout: LayoutState,
    ): void {
        const a = local.action;
        const playerAction = !local.dead && !!a && a.type !== "none" && a.duration > 0;
        const objectRunning = !playerAction && !local.dead && !!objectAction && objectAction.duration > 0;
        const running = playerAction || objectRunning;
        if (objectRunning && objectAction) {
            this.action = {
                key: `object|${objectAction.label}`,
                time: objectAction.time,
                duration: objectAction.duration,
            };
        } else {
            const key = playerAction ? `${a.type}|${a.item}|${a.duration}` : "";
            if (key !== this.action.key || (playerAction && Math.abs(a.time - this.action.time) > 0.25)) {
                this.action = { key, time: playerAction ? a.time : 0, duration: playerAction ? a.duration : 0 };
            } else if (playerAction) {
                this.action.time = Math.min(this.action.time + dt, this.action.duration);
            }
        }
        this.p.set("pie", running, () => {
            this.root.style.display = running ? "block" : "none";
        });
        if (!running) return;
        // a third of the way down times the HUD scale factor, lower on the small layout (survev pieTimer.ts update)
        const offset =
            layout.layout === UiLayout.Sm ? (layout.landscape ? SM_OFFSET_LANDSCAPE : SM_OFFSET_PORTRAIT) : 0;
        const top = Math.round((layout.height / 3) * hudScale(layout) + offset);
        this.p.set("pieTop", top, () => {
            this.root.style.top = `${top}px`;
        });
        let label = "";
        if (objectRunning && objectAction) label = objectAction.label;
        else if (a?.type === "reload") label = t("game-reloading");
        else if (a?.type === "revive") {
            // survev ui.ts updateActionTimer: "Reviving <name>", the name left out on the downed side
            const verb = t("game-reviving");
            label = actionTarget ? (isSov() ? `${actionTarget} ${verb}` : `${verb} ${actionTarget}`) : verb;
        } else if (a)
            label = isSov() ? `${itemName(a.item)} ${t("game-using")}` : `${t("game-using")} ${itemName(a.item)}`;
        this.p.set("pieLabel", label, () => {
            this.label.textContent = label;
        });
        const frac = Math.min(1, this.action.time / this.action.duration);
        const circumference = 2 * Math.PI * ARC_RADIUS;
        const dashOffset = (circumference * (1 - frac)).toFixed(1);
        this.p.set("pieArc", dashOffset, () => this.arc.setAttribute("stroke-dashoffset", dashOffset));
        const remaining = Math.max(0, this.action.duration - this.action.time).toFixed(1);
        this.p.set("pieCount", remaining, () => {
            this.count.textContent = remaining;
        });
    }
}
