// l10n coverage (M8): every English UI string has a Korean one (an identical value only for the allowlisted keys), and
// every string key the client source passes literally to t("…") / tryT("…") or as a `l10n: "…"` / `dataset.l10n = "…"`
// element key exists in the English tables.
import { GameObjectDefs, SURVEV_GUN_SKINS, SURVEV_ONLY_GUNS } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { enItems } from "../src/l10n/en.ts";
import { EN_UI, hudItemName, itemName, KO_UI, setLang } from "../src/l10n/index.ts";
import { koItems } from "../src/l10n/ko.ts";

/** Korean values that are intentionally the same as the English ones, with the reason. */
const SAME_IN_KOREAN: Readonly<Record<string, string>> = {
    "index-movement-ctrl": "key names (W, A, S, D) are not translated (ko.json keeps them)",
    "index-pickup-ctrl": "key name F",
    "index-reload-ctrl": "key name R",
    "index-cancel-action-ctrl": "key name X",
};

const sources = import.meta.glob("../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
>;

const KEY_PATTERNS = [
    /\b(?:t|tryT)\(\s*"([^"]+)"\s*\)/g,
    /\bl10n:\s*"([^"]+)"/g,
    /\.dataset\.l10n(?:Placeholder|Title)?\s*=\s*"([^"]+)"/g,
];

function literalKeys(): Map<string, string> {
    const keys = new Map<string, string>();
    for (const [file, text] of Object.entries(sources)) {
        for (const pattern of KEY_PATTERNS) {
            for (const m of text.matchAll(pattern)) if (!keys.has(m[1])) keys.set(m[1], file);
        }
    }
    return keys;
}

describe("l10n tables", () => {
    it("has a Korean value for every English UI key", () => {
        const missing = Object.keys(EN_UI).filter((key) => !(key in KO_UI));
        expect(missing).toEqual([]);
    });

    it("translates every key unless it is allowlisted as identical", () => {
        const same = Object.keys(EN_UI).filter((key) => KO_UI[key] === EN_UI[key] && !(key in SAME_IN_KOREAN));
        expect(same).toEqual([]);
    });

    it("has no Korean key without an English one", () => {
        expect(Object.keys(KO_UI).filter((key) => !(key in EN_UI))).toEqual([]);
    });

    it("keeps the allowlist current", () => {
        for (const key of Object.keys(SAME_IN_KOREAN)) expect(KO_UI[key]).toBe(EN_UI[key]);
    });

    it("defines every key the client source uses literally", () => {
        const keys = literalKeys();
        expect(keys.size).toBeGreaterThan(50);
        const undefinedKeys = [...keys].filter(([key]) => !(key in EN_UI)).map(([key, file]) => `${key} (${file})`);
        expect(undefinedKeys).toEqual([]);
    });
});

describe("item names", () => {
    it("names every gun in English and in Korean, the survev-only guns included", () => {
        const guns = Object.keys(GameObjectDefs).filter((id) => GameObjectDefs[id].type === "gun");
        expect(guns.filter((id) => !enItems[id])).toEqual([]);
        expect(guns.filter((id) => !koItems[id])).toEqual([]);
    });

    it("the survev-only guns take survev's English names (en.json) and the KB's Korean ones (l10n-ko.md)", () => {
        const ids = [...SURVEV_ONLY_GUNS, ...Object.keys(SURVEV_GUN_SKINS), "potato_lmgshot", "50AE"];
        const names = (lang: "en" | "ko") => {
            setLang(lang);
            return Object.fromEntries(ids.map((id) => [id, itemName(id)]));
        };
        try {
            expect(names("en")).toEqual({
                imbel: "IMD-2",
                spas16: "SPAS-16",
                barrett: "Barrett M107",
                sw500: "S&W 500",
                ash12: "ASh-12",
                potato_lmg: "PMG-134",
                svd_winter: "SVD-63",
                sv98_winter: "SV-98",
                awc_winter: "AWM-S",
                potato_lmgshot: "PMG-134",
                "50AE": ".50 Caliber",
            });
            expect(names("ko")).toEqual({
                imbel: "IMD-2",
                spas16: "SPAS-16",
                barrett: "바렛 M107",
                sw500: "S&W 500",
                ash12: "ASh-12",
                potato_lmg: "PMG-134",
                svd_winter: "SVD-63",
                sv98_winter: "SV-98",
                awc_winter: "AWM-S",
                potato_lmgshot: "PMG-134",
                "50AE": ".50 구경",
            });
            expect(hudItemName("barrett")).toBe("바렛 M107");
        } finally {
            setLang("en");
        }
    });
});
