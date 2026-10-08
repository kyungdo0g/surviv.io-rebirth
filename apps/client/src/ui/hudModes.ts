// Event-mode HUD parts inside #ui-game (M7; survev client/index.html #ui-bottom-center-left, ui2.ts perk state and
// render, ui.ts faction flair; docs/research/ui/hud.md "Inventory, gear and perks", "Health bar"):
// - perk slots `#ui-perk-0..2` left of the health bar, mirrored like the gear slots on the right: the perk's loot image,
//   a hover tooltip with its name and description, a green hover outline on the droppable (loot) perk and none on perks
//   a role, helmet or mode grants (`ui-perk-no-drop`); a new perk pulses for 4 s (not on mobile, M8); right click drops
//   the droppable one.
//   Three slots, the original 0.8.82 count (survev's fourth slot is a fork addition: CONFLICT perk-slot-count). The
//   perks are the followed player's, so a spectator sees the spectated player's perks;
// - the faction arm patches (`#ui-health-flair-left/right`, player-patch-red|blue) beside the health bar on faction maps;
// - rebirth addition (ROLE_BADGE): the held role's icon and title above the perk slots.
import { GameConfig, GameObjectDefs, type RoleDef } from "@rebirth/defs";
import type { LocalPlayerState } from "@rebirth/sim";
import { lootImageUrl, spriteUrl } from "../assets/hudImages.ts";
import { itemName, perkDesc, roleName } from "../l10n/index.ts";
import { el, Patcher, setLines } from "./hudDom.ts";
import { bindDrop, type DropRequest } from "./hudDrop.ts";
import "./modes.css";

/** perk slots of the original 0.8.82 HUD (perkUiCount 3, hud.md CONFLICT perk-slot-count) */
export const PERK_SLOTS = 3;
/** a new perk's slot pulses this long on desktop (survev ui2.ts: perkState.pulse while ticker < 4) */
const PERK_PULSE_TIME = 4;
/**
 * Rebirth addition, not in the original client (which shows roles only through their perks, helmets and map icons): a
 * badge with the held role's icon and title above the perk slots. Set to false for the original look.
 */
export const ROLE_BADGE = true;

interface PerkSlot {
    div: HTMLDivElement;
    image: HTMLImageElement;
    title: HTMLDivElement;
    desc: HTMLDivElement;
    ticker: number;
}

export interface ModeHudFrame {
    dt: number;
    local: LocalPlayerState;
    /** the followed player (its perks pulse only when they are new to it) */
    activeId: number;
    /** the followed player's faction on faction maps (1 Red, 2 Blue), else 0 */
    faction: number;
}

/** Image of a role for the badge: the class image, the map icon, the indicator, else its first perk's loot image. */
export function roleIconUrl(role: string, helmet: string): string {
    const def = GameObjectDefs[role] as RoleDef | undefined;
    if (!def) return "";
    if (def.guiImg) return `/assets/${def.guiImg}`;
    const sprite = def.mapIcon?.alive ?? def.mapIndicator?.sprite;
    if (sprite) return spriteUrl(sprite);
    // a role's fixed perks (survev's Lone Survivr also rolls weighted ones)
    const perk = def.perks?.find((p): p is string => typeof p === "string");
    return (perk && lootImageUrl(perk)) || (helmet ? lootImageUrl(helmet) : "");
}

function cssColor(c: number): string {
    return `#${c.toString(16).padStart(6, "0")}`;
}

export class ModeHud {
    readonly perkRoot = el("div", { id: "ui-bottom-center-left" });
    private readonly slots: PerkSlot[] = [];
    private readonly badge = el("div", { id: "ui-role-badge" });
    private readonly badgeIcon = el("img", { cls: "ui-role-badge-icon" });
    private readonly badgeName = el("div", { cls: "ui-role-badge-name" });
    private readonly flairs: HTMLDivElement[];
    private readonly p = new Patcher();
    private lastLocal: LocalPlayerState | null = null;
    private prevTypes: Set<string> | null = null;
    private prevActive = -1;
    /** phones and tablets: new perks do not pulse (M8) */
    mobile = false;

    constructor(root: HTMLElement, healthCounter: HTMLElement, drop: (r: DropRequest) => void) {
        for (let i = 0; i < PERK_SLOTS; i++) {
            const image = el("img", { cls: "ui-armor-image ui-loot-image" });
            image.draggable = false;
            const title = el("div", { cls: "tooltip-title" });
            const desc = el("div", { cls: "tooltip-desc" });
            const div = el(
                "div",
                { id: `ui-perk-${i}`, cls: "ui-armor-counter tooltip-perk ui-outline-hover" },
                el("div", { cls: "tooltip-text" }, title, desc),
                image,
            );
            div.style.display = "none";
            bindDrop(div, () => this.perkDrop(i), drop);
            this.slots.push({ div, image, title, desc, ticker: PERK_PULSE_TIME });
            this.perkRoot.append(div);
        }
        this.badgeIcon.draggable = false;
        this.badge.append(this.badgeIcon, this.badgeName);
        this.badge.style.display = "none";
        this.perkRoot.append(this.badge);
        this.flairs = ["left", "right"].map((side) =>
            el("div", { id: `ui-health-flair-${side}`, cls: "ui-health-flair" }),
        );
        healthCounter.prepend(...this.flairs);
        root.append(this.perkRoot);
    }

    /** Perk types shown in the slots, slot 0 (next to the health bar) first (tests). */
    get perkTypes(): string[] {
        return this.slots.map((s) => s.div.dataset.type ?? "").filter(Boolean);
    }

    private perkDrop(slot: number): DropRequest | null {
        const perk = this.lastLocal?.perks?.[slot];
        return perk?.droppable ? { item: perk.type, weapIdx: 0 } : null;
    }

    update(frame: ModeHudFrame): void {
        const local = frame.local;
        this.lastLocal = local;
        const perks = local.perks ?? [];
        const sameTarget = frame.activeId === this.prevActive;
        const types = new Set(perks.map((p) => p.type));
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            const perk = local.dead ? undefined : perks[i];
            const type = perk?.type ?? "";
            this.p.set(`perk${i}`, type, () => {
                slot.div.dataset.type = type;
                slot.div.style.display = type ? "block" : "none";
                slot.image.src = type ? lootImageUrl(type) : "";
                slot.title.textContent = type ? itemName(type) : "";
                setLines(slot.desc, type ? perkDesc(type) : []);
            });
            if (type && sameTarget && this.prevTypes && !this.prevTypes.has(type)) slot.ticker = 0;
            if (!type || !sameTarget) slot.ticker = PERK_PULSE_TIME;
            slot.ticker += frame.dt;
            const droppable = !!perk?.droppable;
            this.p.set(`perkDrop${i}`, droppable, () => {
                slot.div.classList.toggle("ui-outline-hover", droppable);
                slot.div.classList.toggle("ui-perk-no-drop", !droppable);
                slot.div.dataset.droppable = String(droppable);
            });
            // desktop only (survev ui2.ts: !device.mobile)
            const pulse = !this.mobile && slot.ticker < PERK_PULSE_TIME;
            this.p.set(`perkPulse${i}`, pulse, () => slot.div.classList.toggle("ui-perk-pulse", pulse));
        }
        this.prevTypes = types;
        this.prevActive = frame.activeId;
        this.updateBadge(local, frame.faction);
        this.p.set("flair", frame.faction, () => {
            const color = frame.faction === 1 ? "red" : "blue";
            for (const f of this.flairs) {
                f.style.display = frame.faction ? "block" : "none";
                f.style.backgroundImage = frame.faction ? `url(${spriteUrl(`player-patch-${color}.img`)})` : "";
            }
        });
    }

    private updateBadge(local: LocalPlayerState, faction: number): void {
        const role = ROLE_BADGE && !local.dead ? (local.role ?? "") : "";
        const icon = role ? roleIconUrl(role, local.helmet ?? "") : "";
        this.p.set("badge", `${role}|${faction}|${icon}`, () => {
            this.badge.style.display = role ? "flex" : "none";
            this.badge.dataset.role = role;
            if (!role) return;
            this.badgeIcon.src = icon;
            this.badgeIcon.style.display = icon ? "block" : "none";
            this.badgeName.textContent = roleName(role, faction);
            const def = GameObjectDefs[role] as RoleDef | undefined;
            const team = faction ? GameConfig.teamColors[faction - 1] : undefined;
            const color = def?.color ?? team;
            this.badge.style.borderColor = color !== undefined ? cssColor(color) : "";
        });
    }

    clear(): void {
        this.p.clear();
        this.prevTypes = null;
        this.prevActive = -1;
        for (const s of this.slots) s.div.style.display = "none";
        this.badge.style.display = "none";
    }
}
