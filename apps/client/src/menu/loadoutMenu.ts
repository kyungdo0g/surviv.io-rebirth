// Loadout menu (survev content wave stage 4b; survev client/src/ui/loadoutMenu.ts, index.html #modal-customize): tabs
// for the outfit, melee skin, emotes, heal and boost particles and the crosshair, each a grid of every unlocked item
// (the rebirth has no accounts: everything is unlocked, the lead's decision 2026-10-07). The emote tab picks a slot
// (the wheel's top, right, bottom and left, then win and death) and fills it; the crosshair tab adds the colour and
// survev's size and stroke sliders. Every change is saved at once (loadoutStore.ts) and goes out with the next Join.
import { GameObjectDefs } from "@rebirth/defs";
import { CROSSHAIR_SIZE, CROSSHAIR_STROKE, type Loadout, type LoadoutKind, loadoutChoices } from "@rebirth/sim";
import { spriteUrl } from "../assets/hudImages.ts";
import { itemName, t } from "../l10n/index.ts";
import "../ui/settings.css";
import { crosshairUrl } from "./crosshair.ts";
import { applyL10n, h } from "./dom.ts";
import "./loadoutMenu.css";
import { loadLoadout, saveLoadout } from "./loadoutStore.ts";

const TABS: ReadonlyArray<readonly [LoadoutKind, string]> = [
    ["outfit", "loadout-title-outfit"],
    ["melee", "loadout-title-melee"],
    ["emote", "loadout-title-emote"],
    ["heal", "loadout-title-heal"],
    ["boost", "loadout-title-boost"],
    ["crosshair", "loadout-title-crosshair"],
];

/** EmoteSlot order: the wheel's four wedges, then the win and death emotes */
const EMOTE_SLOTS = [
    "loadout-emote-top",
    "loadout-emote-right",
    "loadout-emote-bottom",
    "loadout-emote-left",
    "loadout-emote-win",
    "loadout-emote-death",
] as const;
/** the win and death slots may stay empty */
const FIRST_OPTIONAL_SLOT = 4;

interface ItemDefLike {
    name?: string;
    rarity?: number;
    texture?: string;
    lootImg?: { sprite: string };
    skinImg?: { baseTint: number; handTint: number };
}

function hex(color: number): string {
    return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** An item's picture: the outfit's skin colours, the crosshair's SVG, else its texture or loot image. */
function itemImage(kind: LoadoutKind, id: string, loadout: Loadout): HTMLElement {
    const def = GameObjectDefs[id] as ItemDefLike | undefined;
    const img = h("div", { cls: "loadout-item-img" });
    if (kind === "outfit" && def?.skinImg) {
        img.classList.add("loadout-outfit-swatch");
        img.style.background = hex(def.skinImg.baseTint);
        img.style.borderColor = hex(def.skinImg.handTint);
    } else if (kind === "crosshair") {
        img.style.backgroundImage = crosshairUrl({ ...loadout.crosshair, type: id, size: 1 });
    } else {
        const url = spriteUrl(kind === "melee" ? def?.lootImg?.sprite : def?.texture);
        if (url) img.style.backgroundImage = `url("${url}")`;
    }
    return img;
}

export class LoadoutMenu {
    readonly root: HTMLDivElement;
    private readonly tabs = new Map<LoadoutKind, HTMLAnchorElement>();
    private readonly slotRow: HTMLDivElement;
    private readonly crosshairRow: HTMLDivElement;
    private readonly grid: HTMLDivElement;
    private tab: LoadoutKind = "outfit";
    private emoteSlot = 0;
    private loadout: Loadout = loadLoadout();
    private readonly onEsc = (ev: KeyboardEvent) => {
        if (ev.key === "Escape" && this.visible) this.hide();
    };

    constructor(parent: HTMLElement) {
        const tabRow = h("div", { cls: "loadout-tabs" });
        for (const [kind, key] of TABS) {
            const a = h("a", { id: `loadout-tab-${kind}`, cls: "loadout-tab btn-darken", l10n: key });
            a.addEventListener("click", (ev) => {
                ev.preventDefault();
                this.select(kind);
            });
            this.tabs.set(kind, a);
            tabRow.append(a);
        }
        this.slotRow = h("div", { cls: "loadout-slots" });
        this.crosshairRow = h("div", { cls: "loadout-crosshair-row" });
        this.grid = h("div", { id: "loadout-grid", cls: "loadout-grid" });
        this.root = h(
            "div",
            { id: "modal-customize", cls: "modal" },
            h(
                "div",
                { cls: "modal-content loadout-content" },
                h(
                    "div",
                    { cls: "modal-header" },
                    h("span", { cls: "close close-corner", click: () => this.hide() }),
                    h("h2", { l10n: "index-loadout" }),
                ),
                h("div", { cls: "modal-body" }, tabRow, this.slotRow, this.crosshairRow, this.grid),
            ),
        );
        this.root.hidden = true;
        this.root.addEventListener("click", (ev) => {
            if (ev.target === this.root) this.hide();
        });
        window.addEventListener("keydown", this.onEsc);
        parent.append(this.root);
    }

    get visible(): boolean {
        return !this.root.hidden;
    }

    show(): void {
        this.loadout = loadLoadout();
        this.root.hidden = false;
        this.render();
    }

    hide(): void {
        this.root.hidden = true;
    }

    select(kind: LoadoutKind): void {
        this.tab = kind;
        this.render();
    }

    /** Picks an emote slot (0-5, EmoteSlot order) on the emote tab. */
    selectEmoteSlot(slot: number): void {
        this.emoteSlot = slot;
        this.select("emote");
    }

    destroy(): void {
        window.removeEventListener("keydown", this.onEsc);
        this.root.remove();
    }

    private current(kind: LoadoutKind): string {
        const l = this.loadout;
        switch (kind) {
            case "emote":
                return l.emotes[this.emoteSlot] ?? "";
            case "crosshair":
                return l.crosshair.type;
            default:
                return l[kind];
        }
    }

    private pick(kind: LoadoutKind, id: string): void {
        const l = structuredClone(this.loadout);
        if (kind === "emote") l.emotes[this.emoteSlot] = id;
        else if (kind === "crosshair") l.crosshair.type = id;
        else l[kind] = id;
        this.loadout = saveLoadout(l);
        this.render();
    }

    private render(): void {
        for (const [kind, a] of this.tabs) a.classList.toggle("selected", kind === this.tab);
        this.renderSlots();
        this.renderCrosshairControls();
        this.grid.replaceChildren();
        const ids = loadoutChoices(this.tab);
        if (this.tab === "emote" && this.emoteSlot >= FIRST_OPTIONAL_SLOT) ids.unshift("");
        const selected = this.current(this.tab);
        for (const id of ids) {
            const def = GameObjectDefs[id] as ItemDefLike | undefined;
            const item = h(
                "div",
                { cls: `loadout-item rarity-${def?.rarity ?? 0}` },
                id ? itemImage(this.tab, id, this.loadout) : h("div", { cls: "loadout-item-img loadout-none" }),
                h("span", { cls: "loadout-item-name", text: id ? itemName(id) : t("loadout-none") }),
            );
            item.dataset.id = id;
            item.classList.toggle("selected", id === selected);
            item.addEventListener("click", () => this.pick(this.tab, id));
            this.grid.append(item);
        }
        applyL10n(this.root);
    }

    private renderSlots(): void {
        this.slotRow.hidden = this.tab !== "emote";
        if (this.slotRow.hidden) return;
        this.slotRow.replaceChildren();
        EMOTE_SLOTS.forEach((key, slot) => {
            const id = this.loadout.emotes[slot] ?? "";
            const b = h(
                "div",
                { id: `loadout-emote-slot-${slot}`, cls: "loadout-slot" },
                id ? itemImage("emote", id, this.loadout) : h("div", { cls: "loadout-item-img loadout-none" }),
                h("span", { l10n: key }),
            );
            b.classList.toggle("selected", slot === this.emoteSlot);
            b.addEventListener("click", () => this.selectEmoteSlot(slot));
            this.slotRow.append(b);
        });
    }

    private renderCrosshairControls(): void {
        this.crosshairRow.hidden = this.tab !== "crosshair";
        if (this.crosshairRow.hidden) return;
        this.crosshairRow.replaceChildren();
        const c = this.loadout.crosshair;
        const update = (patch: Partial<Loadout["crosshair"]>) => {
            const l = structuredClone(this.loadout);
            l.crosshair = { ...l.crosshair, ...patch };
            this.loadout = saveLoadout(l);
            preview.style.backgroundImage = crosshairUrl(this.loadout.crosshair);
        };
        const preview = h("div", { id: "loadout-crosshair-preview", cls: "loadout-crosshair-preview" });
        preview.style.backgroundImage = crosshairUrl(c);
        const color = h("input", { id: "loadout-crosshair-color" });
        color.type = "color";
        color.value = hex(c.color);
        color.addEventListener("input", () => update({ color: Number.parseInt(color.value.slice(1), 16) }));
        const slider = (id: string, key: string, range: { min: number; max: number }, value: number, f: string) => {
            const input = h("input", { id });
            input.type = "range";
            input.min = String(range.min);
            input.max = String(range.max);
            // survev index.html: step 0.025
            input.step = "0.025";
            input.value = String(value);
            input.addEventListener("input", () => update({ [f]: Number(input.value) }));
            return h("label", { cls: "loadout-slider" }, h("span", { l10n: key }), input);
        };
        this.crosshairRow.append(
            preview,
            h("label", { cls: "loadout-slider" }, h("span", { l10n: "loadout-color" }), color),
            slider("loadout-crosshair-size", "loadout-size", CROSSHAIR_SIZE, c.size, "size"),
            slider("loadout-crosshair-stroke", "loadout-stroked", CROSSHAIR_STROKE, c.stroke, "stroke"),
        );
    }
}
