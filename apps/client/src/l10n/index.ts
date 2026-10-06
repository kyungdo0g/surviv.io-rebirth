// Tiny string table lookup for the HUD and the menus (menu.ts, M6): `?lang=ko` switches to Korean, anything else is
// English. Missing Korean strings fall back to English, missing English strings to the key (like the original
// Localization.translate). M7: perk and role names are item names ("game-<id>"), perk descriptions have their own table
// (perkDesc) and role titles go through roleName (the faction Commander is "Red Commander" / "Blue Commander").
// M8: settings, keybinds, regions, reports and disconnect texts (settings.ts).
import { GameObjectDefs } from "@rebirth/defs";
import { en, enHudItems, enItems, enPerkDesc } from "./en.ts";
import { ko, koHudItems, koItems } from "./ko.ts";
import { getLang, type Lang, setCurrentLang } from "./lang.ts";
import { enMenu, koMenu } from "./menu.ts";
import { enModes, koModes, koPerkDesc, koPerkNames, koRoleNames } from "./modes.ts";
import { enSettings, koSettings } from "./settings.ts";

export { getLang, type Lang } from "./lang.ts";

/** every English UI string (HUD, menus, event modes, M8 settings / keybinds / reports) */
export const EN_UI: Readonly<Record<string, string>> = { ...en, ...enMenu, ...enModes, ...enSettings };
/** every Korean UI string */
export const KO_UI: Readonly<Record<string, string>> = { ...ko, ...koMenu, ...koModes, ...koSettings };
const KO_ITEMS: Readonly<Record<string, string>> = { ...koItems, ...koPerkNames, ...koRoleNames };
const TABLES = {
    en: { ui: EN_UI, items: enItems, hud: enHudItems, desc: enPerkDesc },
    ko: {
        ui: KO_UI,
        items: KO_ITEMS,
        hud: koHudItems,
        desc: koPerkDesc,
    },
} as const;

export function parseLang(value: string | null | undefined): Lang {
    return value?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function setLang(next: Lang): void {
    setCurrentLang(next);
    if (typeof document !== "undefined") document.documentElement.lang = next;
}

/** UI string by key ("game-reloading"). */
export function t(key: string): string {
    return TABLES[getLang()].ui[key] ?? EN_UI[key] ?? key;
}

/** UI string by key, or "" when no table has it (the original's translate() for optional parts). */
export function tryT(key: string): string {
    return TABLES[getLang()].ui[key] ?? EN_UI[key] ?? "";
}

/** Localized item name (the original "game-<id>"), falling back to the definition name, then the id. */
export function itemName(id: string): string {
    if (!id) return "";
    const def = GameObjectDefs[id] as { name?: string } | undefined;
    return TABLES[getLang()].items[id] ?? enItems[id] ?? def?.name ?? id;
}

/** Short weapon-slot name (the original "game-hud-<id>", else the item name). */
export function hudItemName(id: string): string {
    if (!id) return "";
    return TABLES[getLang()].hud[id] ?? itemName(id);
}

/** Lines of a perk's description (the original "game-<id>-desc", "</br>" separated), [] when there is none. */
export function perkDesc(id: string): string[] {
    const text = TABLES[getLang()].desc[id] ?? enPerkDesc[id] ?? "";
    return text ? text.split(/<\/?br\s*\/?>/i).map((line) => line.trim()) : [];
}

/** Faction team ids (GameConfig.FactionTeam) */
const RED_TEAM = 1;

/**
 * Title of a role (survev ui2.ts getRoleTranslation): the role's item name, except the faction Commander, which is the
 * "Red Commander" / "Blue Commander" of the holder's team when `teamId` is a faction (1 Red, 2 Blue).
 */
export function roleName(role: string, teamId = 0): string {
    if (role === "leader" && (teamId === 1 || teamId === 2)) {
        return t(teamId === RED_TEAM ? "game-red-leader" : "game-blue-leader");
    }
    return itemName(role);
}

/** Subject-object-verb languages put the verb last in assembled phrases ("<item> 사용 중"). */
export function isSov(): boolean {
    return t("word-order").toLowerCase() === "sov";
}
