// Tiny string table lookup for the HUD and the menus (menu.ts, M6): `?lang=ko` switches to Korean, anything else is
// English. Missing Korean strings fall back to English, missing English strings to the key (like the original
// Localization.translate).
import { GameObjectDefs } from "@rebirth/defs";
import { en, enHudItems, enItems } from "./en.ts";
import { ko, koHudItems, koItems } from "./ko.ts";
import { enMenu, koMenu } from "./menu.ts";

export type Lang = "en" | "ko";

const EN_UI: Readonly<Record<string, string>> = { ...en, ...enMenu };
const TABLES = {
    en: { ui: EN_UI, items: enItems, hud: enHudItems },
    ko: { ui: { ...ko, ...koMenu } as Readonly<Record<string, string>>, items: koItems, hud: koHudItems },
} as const;

let lang: Lang = "en";

export function parseLang(value: string | null | undefined): Lang {
    return value?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function setLang(next: Lang): void {
    lang = next;
    if (typeof document !== "undefined") document.documentElement.lang = next;
}

export function getLang(): Lang {
    return lang;
}

/** UI string by key ("game-reloading"). */
export function t(key: string): string {
    return TABLES[lang].ui[key] ?? EN_UI[key] ?? key;
}

/** UI string by key, or "" when no table has it (the original's translate() for optional parts). */
export function tryT(key: string): string {
    return TABLES[lang].ui[key] ?? EN_UI[key] ?? "";
}

/** Localized item name (the original "game-<id>"), falling back to the definition name, then the id. */
export function itemName(id: string): string {
    if (!id) return "";
    const def = GameObjectDefs[id] as { name?: string } | undefined;
    return TABLES[lang].items[id] ?? enItems[id] ?? def?.name ?? id;
}

/** Short weapon-slot name (the original "game-hud-<id>", else the item name). */
export function hudItemName(id: string): string {
    if (!id) return "";
    return TABLES[lang].hud[id] ?? itemName(id);
}

/** Subject-object-verb languages put the verb last in assembled phrases ("<item> 사용 중"). */
export function isSov(): boolean {
    return t("word-order").toLowerCase() === "sov";
}
