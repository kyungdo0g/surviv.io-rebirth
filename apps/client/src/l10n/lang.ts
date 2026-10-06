// The current language, kept apart from the string tables (index.ts) so DOM-free modules that only need a few strings
// (net/ws.ts, also imported by the server's tests) can follow the language without pulling the HUD tables in.

export type Lang = "en" | "ko";

let lang: Lang = "en";

export function getLang(): Lang {
    return lang;
}

/** Sets the language; index.ts setLang also tags the document. */
export function setCurrentLang(next: Lang): void {
    lang = next;
}
