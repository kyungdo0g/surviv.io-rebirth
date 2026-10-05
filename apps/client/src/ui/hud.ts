// DOM HUD over the canvas, laid out like the original desktop HUD (survev client/index.html + ui2.ts render; see
// hud.css): scopes, medical and ammo counts, interaction prompt, reload/use pie timer, clip and reserve ammo,
// boost and health bars, gear levels and the four weapon slots. The battle-royale parts (alive counter, kill
// leader, kill feed, red-zone timer, spectating) are in matchHud.ts and the death / win screen in gameOver.ts.
// `update` diffs against what is on screen and only touches changed properties.
import { GameConfig, GameObjectDefs, type GunDef, Input } from "@rebirth/defs";
import type { LocalPlayerState } from "@rebirth/sim";
import { lootImageUrl } from "../assets/hudImages.ts";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import { hudItemName, isSov, itemName, t } from "../l10n/index.ts";
import "./hud.css";
import "./tooltip.css";
import { healthBarColor } from "./hudColors.ts";

export interface HudCallbacks {
    /** queue a one-shot input action (defs `Input` value) */
    action(action: number): void;
    /** use a bag item with the next input (item clicks; the original InputMsg.useItem) */
    useItem?(item: string): void;
}

export interface HudFrame {
    dt: number;
    local: LocalPlayerState | null;
    /** interaction prompt ("[F] AK-47"), null when there is nothing to interact with */
    interaction: { key: string; text: string } | null;
    /**
     * Client-side timed object use shown on the pie timer while no reload or item use runs (rebirth: the opening
     * of an air drop crate, `button.useDelay`).
     */
    objectAction?: { label: string; time: number; duration: number } | null;
    /** the followed player is knocked down: its health bar is red (M6) */
    downed?: boolean;
    /** name of the teammate being revived, shown in the revive pie label ("" on the downed side) (M6) */
    actionTarget?: string;
}

const MEDICAL = ["bandage", "healthkit", "soda", "painkiller"] as const;
/** tooltip lines of the medical items (index.html: boosts add the adrenaline line) */
const MEDICAL_TOOLTIP: Record<string, string[]> = {
    bandage: ["game-bandage-tooltip"],
    healthkit: ["game-healthkit-tooltip"],
    soda: ["game-soda-tooltip", "game-adrenaline-tooltip"],
    painkiller: ["game-painkiller-tooltip", "game-adrenaline-tooltip"],
};
const MEDICAL_INPUT: Record<string, number> = {
    bandage: Input.UseBandage,
    healthkit: Input.UseHealthKit,
    soda: Input.UseSoda,
    painkiller: Input.UsePainkiller,
};
/** ammo column order and overlay colours of the original index.html */
const AMMO: ReadonlyArray<readonly [string, string]> = [
    ["50AE", "rgba(30, 30, 30, 0.75)"],
    ["9mm", "rgba(255, 153, 0, 0.75)"],
    ["308sub", "rgba(49, 56, 0, 0.75)"],
    ["12gauge", "rgba(255, 0, 0, 0.75)"],
    ["flare", "rgba(255, 85, 0, 0.75)"],
    ["762mm", "rgba(0, 102, 255, 0.75)"],
    ["45acp", "rgba(121, 0, 255, 0.75)"],
    ["556mm", "rgba(3, 123, 0, 0.75)"],
];
const SCOPES = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"] as const;
const SLOT_INPUTS = [Input.EquipPrimary, Input.EquipSecondary, Input.EquipMelee, Input.EquipThrowable];
const GEAR = ["helmet", "chest", "backpack"] as const;

function el<K extends keyof HTMLElementTagNameMap>(
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
class Patcher {
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

interface SlotDom {
    div: HTMLDivElement;
    name: HTMLDivElement;
    image: HTMLImageElement;
    ammo: HTMLDivElement;
}

export class Hud {
    readonly root: HTMLDivElement;
    private readonly cb: HudCallbacks;
    private readonly p = new Patcher();
    private readonly scopes = new Map<string, HTMLDivElement>();
    private readonly items = new Map<string, { div: HTMLDivElement; count: HTMLDivElement }>();
    private readonly slots: SlotDom[] = [];
    private readonly gear = new Map<
        (typeof GEAR)[number],
        { div: HTMLDivElement; image: HTMLImageElement; level: HTMLDivElement }
    >();
    private readonly interaction = el("div", { id: "ui-interaction" });
    private readonly interactionKey = el("div", { id: "ui-interaction-press" });
    private readonly interactionText = el("div", { id: "ui-interaction-description" });
    private readonly clip = el("div", { id: "ui-current-clip" }, "0");
    private readonly reserve = el("div", { id: "ui-remaining-ammo" }, "0");
    private readonly boost = el("div", { id: "ui-boost-counter" });
    private readonly boostBars: HTMLDivElement[] = [];
    private readonly health = el("div", { id: "ui-health-actual", cls: "ui-bar-inner" });
    private readonly healthDepleted = el("div", { id: "ui-health-depleted", cls: "ui-bar-inner" });
    private readonly pie = el("div", { id: "ui-pie-timer" });
    private readonly pieArc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    private readonly pieCount = el("div", { cls: "ui-pie-count" });
    private readonly pieLabel = el("div", { cls: "ui-pie-label" });
    /** local copy of the running action, advanced between snapshots */
    private action = { key: "", time: 0, duration: 0 };
    private lastLocal: LocalPlayerState | null = null;

    constructor(parent: HTMLElement, cb: HudCallbacks) {
        this.cb = cb;
        this.root = el("div", { id: "ui-game" });
        this.root.append(
            this.buildScopes(),
            this.buildRightCenter(),
            el("div", { id: "ui-lower-center" }, this.buildInteraction()),
            this.buildPie(),
            el(
                "div",
                { id: "ui-equipped-ammo-wrapper" },
                el("div", { id: "ui-bullet-counter" }, this.clip, this.reserve),
            ),
            this.buildBars(),
            this.buildGear(),
            this.buildWeapons(),
        );
        parent.append(this.root);
        this.applyStrings();
    }

    /** Re-reads the static strings (after a language change). */
    applyStrings(): void {
        for (const node of this.root.querySelectorAll<HTMLElement>("[data-l10n]")) {
            node.textContent = t(node.dataset.l10n ?? "");
        }
        for (const node of this.root.querySelectorAll<HTMLElement>("[data-item-name]")) {
            node.textContent = itemName(node.dataset.itemName ?? "");
        }
        this.p.clear();
    }

    private buildScopes(): HTMLDivElement {
        const wrap = el("div", { id: "ui-top-center-scopes" });
        for (const scope of SCOPES) {
            const level = scope.replace("xscope", "");
            const div = el(
                "div",
                {
                    id: `ui-scope-${scope}`,
                    cls: "ui-zoom ui-zoom-inactive ui-hidden",
                    click: () => this.selectScope(scope),
                },
                el("div", { cls: "ui-zoom-level" }, level, el("span", { cls: "ui-zoom-append" }, "x")),
            );
            this.scopes.set(scope, div);
            wrap.append(div);
        }
        return wrap;
    }

    private buildRightCenter(): HTMLDivElement {
        const medical = el("div", { id: "ui-medical-interactive" });
        for (const item of MEDICAL) {
            const count = el("div", { cls: "ui-loot-count" }, "0");
            const img = el("img", { cls: "ui-loot-image" });
            img.src = lootImageUrl(item);
            img.draggable = false;
            const description = el("div", { cls: "tooltip-description" });
            MEDICAL_TOOLTIP[item].forEach((key, i) => {
                if (i > 0) description.append(document.createElement("br"));
                const line = el("span");
                line.dataset.l10n = key;
                description.append(line);
            });
            const title = el("div", { cls: "tooltip-title" });
            title.dataset.itemName = item;
            const tooltip = el("div", { cls: "tooltip-text" }, title, description);
            const div = el(
                "div",
                {
                    id: `ui-loot-${item}`,
                    cls: "ui-loot ui-outline-hover tooltip",
                    click: () => this.useMedical(item),
                },
                tooltip,
                count,
                img,
            );
            this.items.set(item, { div, count });
            medical.append(div);
        }
        const ammo = el("div", { id: "ui-ammo-interactive" });
        for (const [item, color] of AMMO) {
            const count = el("div", { cls: "ui-loot-count" }, "0");
            const img = el("img", { cls: "ui-loot-image" });
            img.src = lootImageUrl(item);
            img.draggable = false;
            const overlay = el("div", { cls: "ui-loot-overlay" });
            overlay.style.background = color;
            const div = el("div", { id: `ui-loot-${item}`, cls: "ui-ammo" }, count, img, overlay);
            this.items.set(item, { div, count });
            ammo.append(div);
        }
        return el("div", { id: "ui-right-center" }, medical, ammo);
    }

    private buildInteraction(): HTMLDivElement {
        this.interaction.append(this.interactionKey, el("div", { id: "ui-interaction-outer" }, this.interactionText));
        this.interaction.style.display = "none";
        return this.interaction;
    }

    private buildPie(): HTMLDivElement {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 72 72");
        const bg = document.createElementNS(ns, "circle");
        for (const [k, v] of Object.entries({ cx: "36", cy: "36", r: "36", fill: "rgba(0, 0, 0, 0.27)" })) {
            bg.setAttribute(k, v);
        }
        const arc = this.pieArc;
        const attrs = { cx: "36", cy: "36", r: "35", fill: "none", stroke: "#ffffff", "stroke-width": "6" };
        for (const [k, v] of Object.entries(attrs)) arc.setAttribute(k, v);
        arc.setAttribute("transform", "rotate(-90 36 36)");
        arc.setAttribute("stroke-dasharray", String(2 * Math.PI * 35));
        svg.append(bg, arc);
        this.pie.append(svg, this.pieCount, this.pieLabel);
        this.pie.style.display = "none";
        return this.pie;
    }

    private buildBars(): HTMLDivElement {
        for (let i = 0; i < 4; i++) {
            const inner = el("div", { cls: "ui-bar-inner" });
            this.boostBars.push(inner);
            this.boost.append(el("div", { id: `ui-boost-counter-${i}`, cls: "ui-boost-base" }, inner));
        }
        const healthBar = el(
            "div",
            { id: "ui-health-counter" },
            el("div", { id: "ui-health-container" }, this.health, this.healthDepleted),
        );
        return el("div", { id: "ui-bottom-center-0" }, this.boost, healthBar);
    }

    private buildGear(): HTMLDivElement {
        const wrap = el("div", { id: "ui-bottom-center-right" });
        for (const slot of GEAR) {
            const image = el("img", { cls: "ui-armor-image" });
            image.draggable = false;
            const level = el("div", { cls: "ui-armor-level" });
            const div = el("div", { id: `ui-armor-${slot}`, cls: "ui-armor-counter ui-hidden" }, image, level);
            this.gear.set(slot, { div, image, level });
            wrap.append(div);
        }
        return wrap;
    }

    private buildWeapons(): HTMLDivElement {
        const container = el("div", { id: "ui-weapon-container" });
        for (let i = 0; i < 4; i++) {
            const name = el("div", { cls: "ui-weapon-name" });
            const image = el("img", { cls: "ui-weapon-image" });
            image.draggable = false;
            const ammo = el("div", { cls: "ui-weapon-ammo" });
            const div = el(
                "div",
                { id: `ui-weapon-id-${i + 1}`, cls: "ui-weapon-switch", click: () => this.cb.action(SLOT_INPUTS[i]) },
                image,
                el("div", { cls: "ui-weapon-number" }, String(i + 1)),
                name,
                ammo,
            );
            div.dataset.slot = String(i);
            this.slots.push({ div, name, image, ammo });
            container.append(div);
        }
        return el("div", { id: "ui-bottom-right" }, container);
    }

    /**
     * A medical item click sends InputMsg.useItem like the original, together with the item's Use action: the network
     * input throttle (packages/protocol) neither treats useItem as a change nor merges it, so the action makes sure
     * the message goes out; the simulation ignores the second request while the first use runs.
     */
    private useMedical(item: string): void {
        this.cb.useItem?.(item);
        this.cb.action(MEDICAL_INPUT[item]);
    }

    /** Scope buttons only step through owned scopes, so send as many next/prev scope inputs as needed. */
    private selectScope(scope: string): void {
        const local = this.lastLocal;
        if (!local?.scope) return;
        const owned = SCOPES.filter((s) => (local.inventory[s] ?? 0) > 0);
        const from = owned.indexOf(local.scope as (typeof SCOPES)[number]);
        const to = owned.indexOf(scope as (typeof SCOPES)[number]);
        if (from < 0 || to < 0) return;
        const input = to > from ? Input.EquipNextScope : Input.EquipPrevScope;
        for (let i = 0; i < Math.abs(to - from); i++) this.cb.action(input);
    }

    update(frame: HudFrame): void {
        const local = frame.local;
        this.lastLocal = local;
        this.p.set("root", !!local, () => {
            this.root.style.display = local ? "" : "none";
        });
        if (!local) return;
        this.updateBars(local, !!frame.downed);
        this.updateWeapons(local);
        this.updateItems(local);
        this.updateGear(local);
        this.updateAction(local, frame.dt, frame.objectAction ?? null, frame.actionTarget ?? "");
        this.updateInteraction(local.dead ? null : frame.interaction);
    }

    private updateBars(local: LocalPlayerState, downed: boolean): void {
        const health = local.dead ? 0 : Math.max(local.health, 1);
        const hKey = `${health.toFixed(1)}|${downed}`;
        this.p.set("health", hKey, () => {
            const [r, g, b] = healthBarColor(health, downed);
            this.health.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            this.health.style.width = `${health}%`;
            this.healthDepleted.style.width = `${health}%`;
            this.healthDepleted.style.display = health > 0 ? "block" : "none";
            this.health.classList.toggle("ui-bar-danger", health <= 25);
        });
        const boost = Math.max(0, Math.min(100, local.boost));
        this.p.set("boost", boost.toFixed(1), () => {
            const breakpoints = GameConfig.player.boostBreakpoints;
            const total = breakpoints.reduce((a, b) => a + b, 0);
            let rest = boost / 100;
            for (let i = 0; i < this.boostBars.length; i++) {
                const part = breakpoints[i] / total;
                this.boostBars[i].style.width = `${Math.min(1, Math.max(0, rest / part)) * 100}%`;
                rest = Math.max(rest - part, 0);
            }
            this.boost.style.opacity = boost === 0 ? "0" : "1";
        });
    }

    private updateWeapons(local: LocalPlayerState): void {
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            const type = local.weapons[i]?.type ?? "";
            const def = type ? GameObjectDefs[type] : undefined;
            this.p.set(`slot${i}`, type, () => {
                slot.name.textContent = def ? hudItemName(type) : "";
                slot.image.style.display = def ? "block" : "none";
                const img = (def as { lootImg?: { rot?: number; mirror?: boolean } } | undefined)?.lootImg;
                if (img) {
                    slot.image.src = lootImageUrl(type);
                    slot.image.style.transform = `rotate(${img.rot ?? 0}rad) scaleX(${img.mirror ? -1 : 1})`;
                }
                slot.div.classList.toggle("ui-weapon-empty", !def);
                slot.div.dataset.type = type;
            });
            const equipped = i === local.curWeapIdx;
            this.p.set(`slotEq${i}`, equipped, () => slot.div.classList.toggle("ui-weapon-equipped", equipped));
            const count = def?.type === "throwable" ? (local.inventory[type] ?? 0) : 0;
            this.p.set(`slotAmmo${i}`, count, () => {
                slot.ammo.textContent = String(count);
                slot.ammo.style.display = count > 0 ? "block" : "none";
            });
        }
        // clip and reserve of the equipped weapon (survev ui2.ts: hidden for melee, reserve only when > 0)
        const cur = local.weapons[local.curWeapIdx];
        const def = cur?.type ? GameObjectDefs[cur.type] : undefined;
        const gun = def?.type === "gun" ? (def as GunDef) : undefined;
        const clip = def?.type === "throwable" ? (local.inventory[cur.type] ?? 0) : (cur?.ammo ?? 0);
        const reserve = gun ? (gun.ammoInfinite ? Number.POSITIVE_INFINITY : (local.inventory[gun.ammo] ?? 0)) : 0;
        const showClip = !!def && def.type !== "melee";
        this.p.set("clip", `${clip}|${showClip}`, () => {
            this.clip.textContent = String(clip);
            this.clip.style.color = clip > 0 ? "white" : "red";
            this.clip.style.opacity = showClip ? "1" : "0";
        });
        this.p.set("reserve", reserve, () => {
            this.reserve.textContent = reserve === Number.POSITIVE_INFINITY ? "∞" : String(reserve);
            this.reserve.style.opacity = reserve > 0 ? "1" : "0";
        });
    }

    private updateItems(local: LocalPlayerState): void {
        const bagLevel = (GameObjectDefs[local.backpack ?? ""] as { level?: number } | undefined)?.level ?? 0;
        for (const [item, dom] of this.items) {
            const count = local.inventory[item] ?? 0;
            const sizes = GameConfig.bagSizes[item];
            const max = sizes ? sizes[Math.min(bagLevel, sizes.length - 1)] : Number.POSITIVE_INFINITY;
            const special = !!(GameObjectDefs[item] as { special?: boolean } | undefined)?.special;
            this.p.set(`item-${item}`, `${count}|${max}`, () => {
                dom.count.textContent = String(count);
                dom.div.style.opacity = special && count === 0 ? "0" : count > 0 ? "1" : "0.25";
                dom.div.style.color = count === max ? "#ff9900" : "#ffffff";
                dom.div.style.pointerEvents = count > 0 ? "" : "none";
            });
        }
        for (const [scope, div] of this.scopes) {
            const owned = (local.inventory[scope] ?? 0) > 0;
            const active = local.scope === scope;
            this.p.set(`scope-${scope}`, `${owned}|${active}`, () => {
                div.classList.toggle("ui-hidden", !owned);
                div.classList.toggle("ui-zoom-active", active);
                div.classList.toggle("ui-zoom-inactive", !active);
            });
        }
    }

    private updateGear(local: LocalPlayerState): void {
        for (const [slot, dom] of this.gear) {
            const item = local[slot] ?? "";
            const level = (GameObjectDefs[item] as { level?: number } | undefined)?.level ?? 0;
            this.p.set(`gear-${slot}`, item, () => {
                dom.div.classList.toggle("ui-hidden", level === 0);
                if (level === 0) return;
                dom.image.src = lootImageUrl(item);
                dom.level.textContent = t(`game-level-${level}`);
                dom.level.style.color = level === 4 ? "#b30000" : level === 3 ? "#ff9900" : "#ffffff";
                dom.div.title = itemName(item);
            });
        }
    }

    /** Reload / item-use pie timer: label, arc and countdown (survev pieTimer.ts, ui.ts updateActionTimer). */
    private updateAction(
        local: LocalPlayerState,
        dt: number,
        objectAction: { label: string; time: number; duration: number } | null,
        actionTarget: string,
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
            this.pie.style.display = running ? "block" : "none";
        });
        if (!running) return;
        // a third of the way down, scaled by the HUD scale factor (survev pieTimer.ts update, ui.ts resize)
        const w = window.innerWidth;
        const h = window.innerHeight;
        const clamp = (v: number) => Math.min(1, Math.max(0.75, v));
        const top = Math.round((h / 3) * Math.min(1, clamp(w / 1280) * clamp(h / 1024)));
        this.p.set("pieTop", top, () => {
            this.pie.style.top = `${top}px`;
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
            this.pieLabel.textContent = label;
        });
        const frac = Math.min(1, this.action.time / this.action.duration);
        const circumference = 2 * Math.PI * 35;
        const offset = (circumference * (1 - frac)).toFixed(1);
        this.p.set("pieArc", offset, () => this.pieArc.setAttribute("stroke-dashoffset", offset));
        const remaining = Math.max(0, this.action.duration - this.action.time).toFixed(1);
        this.p.set("pieCount", remaining, () => {
            this.pieCount.textContent = remaining;
        });
    }

    private updateInteraction(interaction: HudFrame["interaction"]): void {
        const key = interaction ? `${interaction.key}|${interaction.text}` : "";
        this.p.set("interaction", key, () => {
            this.interaction.style.display = interaction ? "flex" : "none";
            if (!interaction) return;
            this.interactionKey.textContent = interaction.key;
            this.interactionText.textContent = interaction.text;
        });
    }

    destroy(): void {
        this.root.remove();
    }
}
