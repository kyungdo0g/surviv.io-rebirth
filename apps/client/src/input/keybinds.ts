// Key bindings (M8 rebinding; docs/research/ui/controls.md "Default keybinds", "Rebinding and bind sharing"): the
// original's bind table, one bind per action, indexed by the defs `Input` id (survev client/src/inputBinds.ts BindDefs:
// same names, defaults and unbound actions as the 0.8.82 client). Binds are KeyboardEvent.code strings, mouse buttons
// "Mouse0".."Mouse4" and the wheel "WheelUp" / "WheelDown" (bindCodec.ts). The table is mutable: the keybind screens
// (ui/keybindsUi.ts) change it, `InputManager` and the other bind users read it live, and every change is saved in the
// config's `binds` key as the original's share code. Binding a code that another action uses unbinds that action
// (survev setBind). EquipFragGrenade / EquipSmokeGrenade (15, 16) have no bind def and stay unbound.
// Hard-coded keys outside the table: the arrows move while unbound and G toggles the map while unbound (survev
// game.ts), Escape opens the in-game menu or closes the big map, Left / Right pick the spectate target, F3 toggles the
// debug HUD and N mutes while unbound (rebirth keys; the original had no mute key, only the menus' Sound toggles).
import { Input } from "@rebirth/defs";
import { config } from "../config.ts";
import { t } from "../l10n/index.ts";
import { type BindCode, bindName, decodeBinds, encodeBinds, MOUSE_NAMES } from "./bindCodec.ts";

export type { BindCode } from "./bindCodec.ts";

export interface BindDef {
    /** defs `Input` id */
    action: number;
    /** the original's English name (survev BindDefs) */
    name: string;
    /** l10n key of the name: "bind-" + the name in lower case with dashes (survev InputBindUi.refresh) */
    key: string;
    default: BindCode | null;
}

function def(action: number, name: string, defaultBind: BindCode | null): BindDef {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return { action, name, key: `bind-${slug}`, default: defaultBind };
}

/** Rebindable actions in the original's list order (ascending `Input` id). */
export const BIND_DEFS: readonly BindDef[] = [
    def(Input.MoveLeft, "Move Left", "KeyA"),
    def(Input.MoveRight, "Move Right", "KeyD"),
    def(Input.MoveUp, "Move Up", "KeyW"),
    def(Input.MoveDown, "Move Down", "KeyS"),
    def(Input.Fire, "Fire", "Mouse0"),
    def(Input.Reload, "Reload", "KeyR"),
    def(Input.Cancel, "Cancel", "KeyX"),
    def(Input.Interact, "Interact", "KeyF"),
    def(Input.Revive, "Revive", null),
    def(Input.Use, "Open/Use", null),
    def(Input.Loot, "Loot", null),
    def(Input.EquipPrimary, "Equip Primary", "Digit1"),
    def(Input.EquipSecondary, "Equip Secondary", "Digit2"),
    def(Input.EquipMelee, "Equip Melee", "Digit3"),
    def(Input.EquipThrowable, "Equip Throwable", "Digit4"),
    def(Input.EquipNextWeap, "Equip Next Weapon", "WheelDown"),
    def(Input.EquipPrevWeap, "Equip Previous Weapon", "WheelUp"),
    def(Input.EquipLastWeap, "Equip Last Weapon", "KeyQ"),
    def(Input.EquipOtherGun, "Equip Other Gun", null),
    def(Input.EquipPrevScope, "Equip Previous Scope", null),
    def(Input.EquipNextScope, "Equip Next Scope", null),
    def(Input.UseBandage, "Use Bandage", "Digit7"),
    def(Input.UseHealthKit, "Use Med Kit", "Digit8"),
    def(Input.UseSoda, "Use Soda", "Digit9"),
    def(Input.UsePainkiller, "Use Pills", "Digit0"),
    def(Input.StowWeapons, "Stow Weapons", "KeyE"),
    def(Input.SwapWeapSlots, "Switch Gun Slots", "KeyT"),
    def(Input.ToggleMap, "Toggle Map", "KeyM"),
    def(Input.CycleUIMode, "Toggle Minimap", "KeyV"),
    def(Input.EmoteMenu, "Emote Menu", "Mouse2"),
    def(Input.TeamPingMenu, "Team Ping Hold", "KeyC"),
    def(Input.Fullscreen, "Full Screen", "KeyL"),
    def(Input.HideUI, "Hide UI", null),
    def(Input.TeamPingSingle, "Team Ping Menu", null),
];

/** entries of the table (the original's array spans every Input id) */
export const BIND_COUNT: number = Input.Count;

/** Movement keys that work while nothing is bound to them (survev game.ts). */
export const ARROW_MOVES = {
    [Input.MoveLeft]: "ArrowLeft",
    [Input.MoveRight]: "ArrowRight",
    [Input.MoveUp]: "ArrowUp",
    [Input.MoveDown]: "ArrowDown",
} as const satisfies Record<number, BindCode>;
/** G toggles the map while unbound (survev game.ts; hud.md CONFLICT minimap-toggle-keys) */
export const MAP_FALLBACK: BindCode = "KeyG";
/** opens / closes the in-game menu; closes the big map first (survev game.ts, ui.ts toggleEscMenu) */
export const MENU_KEY: BindCode = "Escape";
/** client-only debug HUD toggle */
export const DebugHudBind: BindCode = "F3";
/** Sound on / off while unbound (rebirth key; the original's Toggle Map bind M opens the big map since M7) */
export const MuteBind: BindCode = "KeyN";
/** spectate next / previous player (survev game.ts, hard-coded arrows) */
export const SPECTATE_NEXT: BindCode = "ArrowRight";
export const SPECTATE_PREV: BindCode = "ArrowLeft";

/** One-shot actions sent in PlayerInput.actions when their bind is pressed (survev game.ts checkInputs). */
export const SENT_ACTIONS: readonly number[] = [
    Input.Reload,
    Input.Revive,
    Input.Use,
    Input.Loot,
    Input.Cancel,
    Input.EquipPrimary,
    Input.EquipSecondary,
    Input.EquipThrowable,
    Input.EquipMelee,
    Input.EquipNextWeap,
    Input.EquipPrevWeap,
    Input.EquipLastWeap,
    Input.EquipOtherGun,
    Input.EquipPrevScope,
    Input.EquipNextScope,
    Input.StowWeapons,
    Input.SwapWeapSlots,
    // the simulation also starts heals from these actions (the original sent InputMsg.useItem for 7-0)
    Input.UseBandage,
    Input.UseHealthKit,
    Input.UseSoda,
    Input.UsePainkiller,
];

/** Display name of a bind: the key's name ("R", "Space"), mouse buttons and wheel localized ("Left Mouse"). */
export function bindLabel(code: BindCode | null): string {
    if (!code) return "";
    return MOUSE_NAMES[code] ? t(MOUSE_NAMES[code]) : bindName(code);
}

export function defaultBinds(): Array<BindCode | null> {
    const binds: Array<BindCode | null> = Array.from({ length: BIND_COUNT }, () => null);
    for (const d of BIND_DEFS) binds[d.action] = d.default;
    return binds;
}

export class BindTable {
    private readonly binds: Array<BindCode | null> = Array.from({ length: BIND_COUNT }, () => null);
    private readonly listeners = new Set<() => void>();

    /** A table from a share code; the defaults when `code` is empty or invalid. */
    constructor(code = "") {
        if (!code || !this.loadShareCode(code, false)) this.assign(defaultBinds());
    }

    get(action: number): BindCode | null {
        return this.binds[action] ?? null;
    }

    /** the whole table, by `Input` id */
    list(): ReadonlyArray<BindCode | null> {
        return this.binds;
    }

    /** Whether any action is bound to `code`. */
    isBound(code: BindCode): boolean {
        return this.binds.includes(code);
    }

    /** The action bound to `code`, or -1. */
    actionOf(code: BindCode): number {
        return this.binds.indexOf(code);
    }

    /** Binds `action` to `code` (null clears it); the action that had `code` before loses it (survev setBind). */
    set(action: number, code: BindCode | null): void {
        if (action < 0 || action >= BIND_COUNT) return;
        if (code) {
            for (let i = 0; i < this.binds.length; i++) if (this.binds[i] === code) this.binds[i] = null;
        }
        this.binds[action] = code;
        this.changed();
    }

    restoreDefaults(): void {
        this.assign(defaultBinds());
        this.changed();
    }

    /** The original's base64 share code of the table. */
    toShareCode(): string {
        return encodeBinds(this.binds);
    }

    /** Loads a share code; false (and nothing changes) when it is invalid (bad base64 or CRC). */
    loadShareCode(code: string, notify = true): boolean {
        const decoded = decodeBinds(code, BIND_COUNT);
        if (!decoded) return false;
        this.assign(decoded);
        if (notify) this.changed();
        return true;
    }

    onChange(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    /** Replaces the table, unbinding duplicates the way successive setBind calls do. */
    private assign(binds: ReadonlyArray<BindCode | null>): void {
        this.binds.fill(null);
        binds.forEach((code, action) => {
            if (action >= BIND_COUNT || !code) return;
            const prev = this.binds.indexOf(code);
            if (prev >= 0) this.binds[prev] = null;
            this.binds[action] = code;
        });
    }

    private changed(): void {
        for (const fn of [...this.listeners]) fn();
    }
}

let shared: BindTable | null = null;

/** The page's bind table, loaded from (and saved to) the config's `binds` share code. */
export function binds(): BindTable {
    if (!shared) {
        const cfg = config();
        const table = new BindTable(cfg.get("binds"));
        table.onChange(() => cfg.set("binds", table.toShareCode()));
        shared = table;
    }
    return shared;
}
