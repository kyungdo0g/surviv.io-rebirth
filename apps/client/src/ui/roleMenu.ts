// Cobalt class menu (M7; survev client/index.html #ui-role-menu, ui/ui.ts setRoleMenuActive / setRoleMenuOptions /
// setRoleMenuInfo and the role menu ticker, css/game.css; docs/research/ui/hud.md "Faction role menu (perk mode,
// Cobalt)", modes/cobalt.md "Class selection and spawning"): a dimmed full-screen layer over the waiting room with the
// map's classes as large images in the header; the highlighted class shows its name, image and perks (perk icon in the
// loot circle and name); the footer reads "SELECT A CLASS" and "ENTER GAME (20)". Clicking a class highlights it,
// ENTER GAME confirms it (the PerkModeRoleSelect message) and closes the menu; after 20 s
// (GameConfig.player.perkModeRoleSelectDuration) the highlighted class is confirmed like the original. The menu border
// takes the class colour, `ambient_lab_01` plays while it is open and the last choice is remembered (the original
// `perkModeRole` config). Rebirth additions: each perk's description under its name and the class's starting items.
import { GameConfig, GameObjectDefs, getMapDef, type OutfitDef, type RoleDef } from "@rebirth/defs";
import { roleLoadout } from "@rebirth/sim";
import { lootImageUrl } from "../assets/hudImages.ts";
import type { AudioEngine, SoundHandle } from "../audio/audio.ts";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import { itemName, perkDesc, t } from "../l10n/index.ts";
import { el, setLines } from "./hudDom.ts";
import "./roleMenu.css";

const AMBIENT = "ambient_lab_01";
/** local storage key of the last class (the original config's perkModeRole) */
const STORAGE_KEY = "rebirth.perkModeRole";
/** the menu is laid out for 1200 x 900 and scaled down on smaller screens (survev ui.ts resize) */
const MENU_WIDTH = 1200;
const MENU_HEIGHT = 900;

function storedRole(): string {
    try {
        return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
        return "";
    }
}

function storeRole(role: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, role);
    } catch {
        // storage blocked: the menu starts on the first class next time
    }
}

function cssColor(c: number): string {
    return `#${c.toString(16).padStart(6, "0")}`;
}

/** A class's starting items for the preview: [item, count] in slot order, then bag items (sim role loadouts). */
export function classItems(role: string, mapName: string): Array<{ item: string; count: number }> {
    const kit = roleLoadout(role, getMapDef(mapName));
    if (!kit) return [];
    const items: Array<{ item: string; count: number }> = [];
    const add = (item: unknown, count = 1) => {
        if (typeof item === "string" && item && GameObjectDefs[item]) items.push({ item, count });
    };
    add(kit.outfit);
    add(kit.helmet);
    add(kit.chest);
    add(kit.backpack);
    for (const w of kit.weapons) add((w as { type?: string }).type);
    for (const [item, count] of Object.entries(kit.inventory ?? {})) add(item, count);
    return items;
}

export interface RoleMenuOptions {
    /** where the full-screen layer goes (next to #ui-game) */
    parent: HTMLElement;
    audio: AudioEngine;
    /** the class was confirmed: send the PerkModeRoleSelect message */
    select(role: string): void;
}

export class RoleMenu {
    readonly root = el("div", { id: "ui-role-menu-wrapper" });
    private readonly menu = el("div", { id: "ui-role-menu" });
    private readonly header = el("div", { id: "ui-role-header" });
    private readonly body = el("div", { id: "ui-role-body" });
    private readonly enter = el("div", { id: "ui-role-footer-enter" });
    private readonly desc = el("div", { id: "ui-role-footer-desc" });
    private readonly opts: RoleMenuOptions;
    private roles: string[] = [];
    private mapName = "";
    /** the menu is open (survev roleMenuActive) */
    active = false;
    /** the class shown in the body (survev roleDisplayed) */
    displayed = "";
    /** the class confirmed with ENTER GAME or the timeout, "" before */
    confirmed = "";
    private ticker = 0;
    private enterText = "";
    private ambient: SoundHandle | null = null;
    private scale = -1;

    constructor(opts: RoleMenuOptions) {
        this.opts = opts;
        const footer = el("div", { id: "ui-role-footer" }, this.desc, this.enter);
        this.menu.append(this.header, this.body, footer);
        this.root.append(this.menu);
        // presses on the menu never reach the game input (no shots, no emote wheel)
        this.root.setAttribute(HUD_INTERACTIVE_ATTR, "");
        this.root.addEventListener("mousedown", (ev) => ev.stopPropagation());
        this.enter.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.confirm();
        });
        this.root.style.display = "none";
        opts.parent.append(this.root);
    }

    /** Opens the menu with the map's classes (survev setRoleMenuOptions + setRoleMenuActive(true)). */
    open(roles: readonly string[], mapName: string): void {
        this.roles = roles.filter((r) => (GameObjectDefs[r] as RoleDef | undefined)?.type === "role");
        this.mapName = mapName;
        this.header.replaceChildren(
            ...this.roles.map((role) => {
                const option = el("div", { cls: "ui-role-option" });
                option.dataset.role = role;
                const img = (GameObjectDefs[role] as RoleDef).guiImg;
                if (img) option.style.backgroundImage = `url('/assets/${img}')`;
                option.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    this.show(role);
                });
                return option;
            }),
        );
        const saved = storedRole();
        this.show(this.roles.includes(saved) ? saved : (this.roles[0] ?? ""));
        this.desc.textContent = t("game-select-class");
        this.ticker = GameConfig.player.perkModeRoleSelectDuration;
        this.enterText = "";
        this.confirmed = "";
        this.active = true;
        this.root.style.display = "block";
        this.opts.audio.preload([AMBIENT], "ambient");
    }

    /** Closes the menu without a choice (the class arrived from the server, or the game ended). */
    close(): void {
        if (!this.active) return;
        this.active = false;
        this.root.style.display = "none";
        this.opts.audio.stop(this.ambient);
        this.ambient = null;
    }

    /** Highlights `role` and shows its name, image and perks (survev setRoleMenuInfo). */
    show(role: string): void {
        const def = GameObjectDefs[role] as RoleDef | undefined;
        if (!def) return;
        this.displayed = role;
        for (const option of this.header.children) {
            option.classList.toggle("ui-role-option-selected", (option as HTMLElement).dataset.role === role);
        }
        this.menu.style.borderColor = def.color !== undefined ? cssColor(def.color) : "";
        const image = el("div", { cls: "ui-role-body-image" });
        if (def.guiImg) image.style.backgroundImage = `url('/assets/${def.guiImg}')`;
        const left = el(
            "div",
            { cls: "ui-role-body-left" },
            el("div", { cls: "ui-role-body-name" }, itemName(role)),
            image,
        );
        const right = el("div", { cls: "ui-role-body-right" });
        for (const perk of def.perks ?? []) {
            const icon = el("div", { cls: "ui-role-body-perk-image-icon" });
            icon.style.backgroundImage = `url('${lootImageUrl(perk)}')`;
            const desc = el("div", { cls: "ui-role-body-perk-desc" });
            setLines(desc, perkDesc(perk));
            const text = el(
                "div",
                { cls: "ui-role-body-perk-text" },
                el("div", { cls: "ui-role-body-perk-name" }, itemName(perk)),
                desc,
            );
            const row = el(
                "div",
                { cls: "ui-role-body-perk" },
                el("div", { cls: "ui-role-body-perk-image-wrapper" }, icon),
                text,
            );
            row.dataset.perk = perk;
            right.append(row);
        }
        right.append(this.loadoutRow(role));
        this.body.replaceChildren(left, right);
    }

    private loadoutRow(role: string): HTMLDivElement {
        const row = el("div", { cls: "ui-role-loadout" });
        for (const { item, count } of classItems(role, this.mapName)) {
            const def = GameObjectDefs[item];
            const cell = el("div", { cls: "ui-role-loadout-item" });
            cell.dataset.item = item;
            cell.title = itemName(item);
            if (def?.type === "outfit") {
                // outfits share the white shirt icon: show the body colour instead
                const swatch = el("div", { cls: "ui-role-loadout-outfit" });
                swatch.style.backgroundColor = cssColor((def as OutfitDef).skinImg.baseTint);
                cell.append(swatch);
            } else {
                const img = el("img");
                img.src = lootImageUrl(item);
                img.draggable = false;
                cell.append(img);
            }
            if (count > 1) cell.append(el("div", { cls: "ui-role-loadout-count" }, String(count)));
            row.append(cell);
        }
        return row;
    }

    /** ENTER GAME (or the timeout): send the highlighted class and close (survev roleSelected = roleDisplayed). */
    confirm(): void {
        if (!this.active || !this.displayed) return;
        this.confirmed = this.displayed;
        storeRole(this.displayed);
        this.opts.select(this.displayed);
        this.close();
    }

    /** Seconds left on the countdown (tests). */
    get timeLeft(): number {
        return this.active ? Math.max(0, this.ticker) : 0;
    }

    /** Countdown, footer text, ambience and the menu scale (survev ui.ts update + resize). */
    update(dt: number, screenWidth: number, screenHeight: number): void {
        if (!this.active) return;
        const scale = Math.min(1, Math.min(screenWidth / MENU_WIDTH, screenHeight / MENU_HEIGHT));
        if (scale !== this.scale) {
            this.scale = scale;
            this.menu.style.transform = `translateX(-50%) translateY(-50%) scale(${scale})`;
        }
        this.ticker -= dt;
        const text = `${t("game-enter-game")} (${Math.max(0, Math.ceil(this.ticker))})`;
        if (text !== this.enterText) {
            this.enterText = text;
            this.enter.textContent = text;
        }
        if (!this.ambient && this.opts.audio.isLoaded(AMBIENT, "ambient")) {
            this.ambient = this.opts.audio.playSound(AMBIENT, { channel: "ambient" });
        }
        if (this.ticker <= 0) this.confirm();
    }

    destroy(): void {
        this.close();
        this.root.remove();
    }
}
