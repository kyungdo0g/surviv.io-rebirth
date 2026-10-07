// DOM HUD over the canvas, laid out like the original desktop HUD (survev client/index.html + ui2.ts render; see
// hud.css): scopes, medical and ammo counts, interaction prompt, reload/use pie timer, clip and reserve ammo,
// boost and health bars, gear levels and the four weapon slots. The battle-royale parts (alive counter, kill
// leader, kill feed, red-zone timer, spectating) are in matchHud.ts and the death / win screen in gameOver.ts.
// `update` diffs against what is on screen and only touches changed properties.
// M7: right click drops a weapon, bag item, scope, helmet, vest or the droppable perk (hudDrop.ts, DropItem); the perk
// slots, faction arm patches and role badge are in hudModes.ts; item maxima use the map's bag sizes (Woods: 6/12/15/18
// frags and smokes, sim mapBagSizes).
// M8: the small (phone) layout (uiLayout.ts, hudSm.css) reorders the ammo column for portrait screens (survev touch.ts
// setMobileStyling); touch devices get the reload button beside the clip (#ui-reload-button-container, survev ui2.ts
// render touch); item images pop to 1.33x when their count goes up, except on mobile (survev ui2.ts
// updateAnimationWidth); Hide UI hides the whole HUD (`setHidden`). The pie timer moved to pieTimer.ts.
import { GameConfig, GameObjectDefs, type GunDef, Input } from "@rebirth/defs";
import { type LocalPlayerState, mapBagSizes } from "@rebirth/sim";
import { lootImageUrl } from "../assets/hudImages.ts";
import { hudItemName, itemName, t } from "../l10n/index.ts";
import "./hud.css";
import "./hudSm.css";
import "./hudSmBottom.css";
import "./hudSmPortrait.css";
import "./tooltip.css";
import { healthBarColor } from "./hudColors.ts";
import { el, Patcher } from "./hudDom.ts";
import { bindDrop, type DropRequest } from "./hudDrop.ts";
import { ModeHud } from "./hudModes.ts";
import { PieTimer } from "./pieTimer.ts";
import {
    AMMO_ORDER_LANDSCAPE,
    ammoOrder,
    itemPopScale,
    type LayoutState,
    layoutState,
    slotPulseWidth,
    UiLayout,
} from "./uiLayout.ts";

export interface HudCallbacks {
    /** queue a one-shot input action (defs `Input` value) */
    action(action: number): void;
    /** use a bag item with the next input (item clicks; the original InputMsg.useItem) */
    useItem?(item: string): void;
    /** right click on a HUD item: the DropItem message (M7) */
    drop?(item: string, weapIdx: number): void;
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
    /** the followed player's id (perk slot pulses) (M7) */
    activeId?: number;
    /** the followed player's faction on faction maps (1 Red, 2 Blue), else 0 (M7) */
    faction?: number;
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
/** ammo overlay colours of the original index.html (column order: uiLayout.ts ammoOrder) */
const AMMO_COLORS: Readonly<Record<string, string>> = {
    "50AE": "rgba(30, 30, 30, 0.75)",
    "9mm": "rgba(255, 153, 0, 0.75)",
    "308sub": "rgba(49, 56, 0, 0.75)",
    "12gauge": "rgba(255, 0, 0, 0.75)",
    flare: "rgba(255, 85, 0, 0.75)",
    "762mm": "rgba(0, 102, 255, 0.75)",
    "45acp": "rgba(121, 0, 255, 0.75)",
    "556mm": "rgba(3, 123, 0, 0.75)",
};
const SCOPES = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"] as const;
const SLOT_INPUTS = [Input.EquipPrimary, Input.EquipSecondary, Input.EquipMelee, Input.EquipThrowable];
const GEAR = ["helmet", "chest", "backpack"] as const;

interface ItemDom {
    div: HTMLDivElement;
    count: HTMLDivElement;
    /** the image and the ammo colour overlay pop when the count goes up */
    pop: HTMLElement[];
    lastCount: number;
    /** seconds since the count last went up */
    ticker: number;
}

interface SlotDom {
    div: HTMLDivElement;
    name: HTMLDivElement;
    image: HTMLImageElement;
    ammo: HTMLDivElement;
    /** equipped last frame, and seconds since it was equipped (the width pulse) */
    equipped: boolean;
    ticker: number;
}

export class Hud {
    readonly root: HTMLDivElement;
    /** perk slots, faction patches, role badge (M7) */
    readonly modes: ModeHud;
    private readonly cb: HudCallbacks;
    private readonly p = new Patcher();
    /** bag capacities of the map (GameConfig.bagSizes with the map's rows, M7) */
    private bagSizes: Readonly<Record<string, readonly number[]>> = GameConfig.bagSizes;
    private readonly scopes = new Map<string, HTMLDivElement>();
    private readonly items = new Map<string, ItemDom>();
    private readonly ammoColumn = el("div", { id: "ui-ammo-interactive" });
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
    /** touch only (hudSm.css / touch.css show it); tapping it reloads (touchHud.ts) */
    private readonly reloadButton = el(
        "div",
        { id: "ui-reload-button-container" },
        el("div", { id: "ui-reload-button" }),
    );
    private readonly boost = el("div", { id: "ui-boost-counter" });
    private readonly boostBars: HTMLDivElement[] = [];
    private readonly health = el("div", { id: "ui-health-actual", cls: "ui-bar-inner" });
    private readonly healthDepleted = el("div", { id: "ui-health-depleted", cls: "ui-bar-inner" });
    private readonly pie = new PieTimer();
    private lastLocal: LocalPlayerState | null = null;
    private layout: LayoutState = layoutState(1280, 720, 1, false);
    /** Hide UI hid the HUD (M8) */
    private hidden = false;
    /** frames drawn with a player (the first ones never pop item counts, survev frameCount < 2) */
    private frames = 0;

    constructor(parent: HTMLElement, cb: HudCallbacks) {
        this.cb = cb;
        this.root = el("div", { id: "ui-game" });
        this.root.append(
            this.buildScopes(),
            this.buildRightCenter(),
            el("div", { id: "ui-lower-center" }, this.buildInteraction()),
            this.pie.root,
            el(
                "div",
                { id: "ui-equipped-ammo-wrapper" },
                el("div", { id: "ui-bullet-counter" }, this.clip, this.reserve, this.reloadButton),
            ),
            this.buildBars(),
            this.buildGear(),
            this.buildWeapons(),
        );
        const healthCounter = this.root.querySelector<HTMLElement>("#ui-health-counter") ?? this.root;
        this.modes = new ModeHud(this.root, healthCounter, (r) => this.drop(r));
        parent.append(this.root);
        this.applyStrings();
    }

    /** The map's bag capacities for the item maxima (M7: Woods maps carry more frags and smokes). */
    setMap(mapName: string): void {
        this.bagSizes = mapBagSizes(mapName);
        this.p.clear();
    }

    private drop(r: DropRequest): void {
        this.cb.drop?.(r.item, r.weapIdx);
    }

    /** A bag item dropped by a right click: the item while the player has some (M7). */
    private itemDrop(item: string): DropRequest | null {
        return (this.lastLocal?.inventory[item] ?? 0) > 0 ? { item, weapIdx: 0 } : null;
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
        this.pie.clear();
    }

    /**
     * The HUD layout (M8): the ammo column order (portrait phones list the common calibres first); no perk pulse and no
     * item pop on mobile.
     */
    setLayout(layout: LayoutState): void {
        this.layout = layout;
        this.modes.mobile = layout.mobile;
        for (const type of ammoOrder(layout)) {
            const item = this.items.get(type);
            if (item) this.ammoColumn.append(item.div);
        }
    }

    /** Hide UI: hides the whole HUD until shown again (survev ui.ts cycleHud). */
    setHidden(hidden: boolean): void {
        this.hidden = hidden;
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
            if (scope !== "1xscope")
                bindDrop(
                    div,
                    () => this.itemDrop(scope),
                    (r) => this.drop(r),
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
            bindDrop(
                div,
                () => this.itemDrop(item),
                (r) => this.drop(r),
            );
            this.items.set(item, { div, count, pop: [img], lastCount: 0, ticker: 1 });
            medical.append(div);
        }
        const ammo = this.ammoColumn;
        for (const item of AMMO_ORDER_LANDSCAPE) {
            const color = AMMO_COLORS[item];
            const count = el("div", { cls: "ui-loot-count" }, "0");
            const img = el("img", { cls: "ui-loot-image" });
            img.src = lootImageUrl(item);
            img.draggable = false;
            const overlay = el("div", { cls: "ui-loot-overlay" });
            overlay.style.background = color;
            const div = el("div", { id: `ui-loot-${item}`, cls: "ui-ammo" }, count, img, overlay);
            bindDrop(
                div,
                () => this.itemDrop(item),
                (r) => this.drop(r),
            );
            this.items.set(item, { div, count, pop: [img, overlay], lastCount: 0, ticker: 1 });
            ammo.append(div);
        }
        return el("div", { id: "ui-right-center" }, medical, ammo);
    }

    private buildInteraction(): HTMLDivElement {
        this.interaction.append(this.interactionKey, el("div", { id: "ui-interaction-outer" }, this.interactionText));
        this.interaction.style.display = "none";
        return this.interaction;
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
            // helmet and chest take the green hover outline (2 px border) like the original markup; the backpack has a
            // transparent border of the same width (game.css)
            const cls =
                slot === "backpack" ? "ui-armor-counter ui-hidden" : "ui-armor-counter ui-outline-hover ui-hidden";
            const div = el("div", { id: `ui-armor-${slot}`, cls }, image, level);
            // the backpack cannot be dropped (survev ui2.ts: no drop action for the backpack)
            if (slot !== "backpack") {
                bindDrop(
                    div,
                    () => ({ item: this.lastLocal?.[slot] ?? "", weapIdx: 0 }),
                    (r) => this.drop(r),
                );
            }
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
            bindDrop(
                div,
                () => this.weaponDrop(i),
                (r) => this.drop(r),
            );
            this.slots.push({ div, name, image, ammo, equipped: false, ticker: 1 });
            container.append(div);
        }
        return el("div", { id: "ui-bottom-right" }, container);
    }

    /** The weapon of slot `i` (survev game.ts: DropItemMsg item + weapIdx); fists drop nothing. */
    private weaponDrop(i: number): DropRequest | null {
        const type = this.lastLocal?.weapons[i]?.type ?? "";
        return type && type !== "fists" ? { item: type, weapIdx: i } : null;
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
        const shown = !!local && !this.hidden;
        this.p.set("root", shown, () => {
            this.root.style.display = shown ? "" : "none";
        });
        if (!local) {
            this.frames = 0;
            return;
        }
        this.frames++;
        this.updateBars(local, !!frame.downed);
        this.updateWeapons(local, frame.dt);
        this.updateItems(local, frame.dt);
        this.updateGear(local);
        this.pie.update(local, frame.dt, frame.objectAction ?? null, frame.actionTarget ?? "", this.layout);
        this.updateInteraction(local.dead ? null : frame.interaction);
        this.modes.update({ dt: frame.dt, local, activeId: frame.activeId ?? -1, faction: frame.faction ?? 0 });
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

    private updateWeapons(local: LocalPlayerState, dt: number): void {
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            const type = local.weapons[i]?.type ?? "";
            const def = type ? GameObjectDefs[type] : undefined;
            this.p.set(`slot${i}`, type, () => {
                slot.name.textContent = def ? hudItemName(type) : "";
                // `hidden`, not an inline display: the small layout hides slot images altogether (hudSm.css)
                slot.image.hidden = !def;
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
            // a newly equipped slot widens from 83.33 % to 100 % and back over 0.09 x pi s, else stays at 83.33 %
            // (160 px) (survev ui2.ts updateAnimationWidth + render weapons width; provenance/visual-diff.md)
            slot.ticker += dt;
            if (!equipped || !slot.equipped) slot.ticker = 0;
            if (this.frames < 2) slot.ticker = 1;
            slot.equipped = equipped;
            // the small layout keeps its fixed 68 px slots (hudSmBottom.css)
            const width =
                this.layout.layout === UiLayout.Sm
                    ? ""
                    : `${slotPulseWidth(slot.ticker, this.layout.mobile).toFixed(2)}%`;
            this.p.set(`slotW${i}`, width, () => {
                slot.div.style.width = width;
            });
            const count = def?.type === "throwable" ? (local.inventory[type] ?? 0) : 0;
            this.p.set(`slotAmmo${i}`, count, () => {
                slot.ammo.textContent = String(count);
                slot.ammo.hidden = count <= 0;
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
            // survev ui2.ts render: the reload button shows with the reserve
            this.reloadButton.style.opacity = reserve > 0 ? "1" : "0";
        });
    }

    private updateItems(local: LocalPlayerState, dt: number): void {
        const bagLevel = (GameObjectDefs[local.backpack ?? ""] as { level?: number } | undefined)?.level ?? 0;
        for (const [item, dom] of this.items) {
            const count = local.inventory[item] ?? 0;
            // the image pops when the count goes up (survev ui2.ts: not in the first frames, not on mobile)
            if (count > dom.lastCount) dom.ticker = 0;
            if (this.frames < 2) dom.ticker = 1;
            dom.lastCount = count;
            dom.ticker += dt;
            const pop = itemPopScale(dom.ticker, this.layout.mobile);
            this.p.set(`pop-${item}`, pop.toFixed(3), () => {
                for (const node of dom.pop) node.style.transform = pop === 1 ? "" : `scale(${pop.toFixed(3)})`;
            });
            const sizes = this.bagSizes[item];
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
