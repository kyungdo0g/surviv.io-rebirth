// Player name filter (M8): names containing a banned word become "Player". The list is a text file (NAME_FILTER_FILE,
// default apps/server/data/name-filter.txt): one entry per line, "#" comments. Names and entries are compared after
// normalization, so the usual dodges still match:
// - case, accents and full-width letters (NFKD, combining marks dropped), Cyrillic/Greek look-alikes (а -> a);
// - spaces, digits and punctuation are ignored ("f u c k", "f.u.c.k"), and in a second pass leetspeak is read as
//   letters ("n1gg3r": 0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b, 9 g, @ a, $ s, ! i, | l, + t);
// - repeated letters ("niiiggggerrr"): every letter of an entry matches one or more copies of itself;
// - Hangul typed jamo by jamo is recomposed into syllables ("ㅅㅣㅂㅏㄹ" = "시발"), letters mixed into Hangul are
//   ignored in a Hangul-only pass ("시a발"); entries made of bare consonants ("ㅅㅂ") match those consonants typed on
//   their own (syllables are never split into jamo, which would make "조조" contain "좆").
// An entry prefixed with "=" must be the whole (normalized) name: short words that occur inside innocent names.
// survev's badWords list was read for the approach only; the shipped list is our own and deliberately short.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    conjoiningToCompat,
    containsHangul,
    hangulOnly,
    isCompatJamo,
    isConjoiningJamo,
    isHangulSyllable,
    recomposeJamo,
} from "./hangul.ts";

/** The list shipped with the server. */
export const DEFAULT_NAME_FILTER_FILE = fileURLToPath(new URL("../../data/name-filter.txt", import.meta.url));

/** Replacement for a filtered name (the original default name). */
export const FILTERED_NAME = "Player";

const LEET: Readonly<Record<string, string>> = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "8": "b",
    "9": "g",
    "@": "a",
    $: "s",
    "!": "i",
    "|": "l",
    "+": "t",
};

/** Cyrillic and Greek letters that look like Latin ones (NFKD does not fold scripts). */
const CONFUSABLES: Readonly<Record<string, string>> = {
    а: "a",
    в: "b",
    е: "e",
    ё: "e",
    і: "i",
    ј: "j",
    к: "k",
    м: "m",
    н: "h",
    о: "o",
    р: "p",
    с: "c",
    т: "t",
    у: "y",
    х: "x",
    α: "a",
    β: "b",
    ε: "e",
    ι: "i",
    κ: "k",
    ν: "v",
    ο: "o",
    ρ: "p",
    τ: "t",
    υ: "u",
    χ: "x",
};

/** Lower-case letters of `name` (Hangul kept as syllables / compatibility jamo), optionally reading leetspeak. */
export function foldName(name: string, leet: boolean): string {
    let out = "";
    for (const ch of name) {
        const cp = ch.codePointAt(0)!;
        if (isHangulSyllable(cp) || isCompatJamo(cp)) {
            out += ch;
            continue;
        }
        if (isConjoiningJamo(cp)) {
            out += conjoiningToCompat(cp);
            continue;
        }
        for (const c of ch.normalize("NFKD").toLowerCase()) {
            const folded = CONFUSABLES[c] ?? c;
            out += leet ? (LEET[folded] ?? folded) : folded;
        }
    }
    // letters only: spaces, digits, punctuation, symbols, combining marks and invisible characters go
    return out.replace(/[^\p{L}]/gu, "");
}

/** The normalized forms a name is checked in (see the header). */
export function nameForms(name: string): string[] {
    const plain = recomposeJamo(foldName(name, false));
    const forms = new Set([plain, recomposeJamo(foldName(name, true))]);
    if (containsHangul(plain)) forms.add(recomposeJamo(hangulOnly(plain)));
    forms.delete("");
    return [...forms];
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A normalized entry as a pattern where each letter run of length n matches n or more copies. */
function entryPattern(entry: string, whole: boolean): RegExp | null {
    const norm = recomposeJamo(foldName(entry, false));
    if (!norm) return null;
    let body = "";
    const chars = [...norm];
    for (let i = 0; i < chars.length; ) {
        let j = i;
        while (j < chars.length && chars[j] === chars[i]) j++;
        const n = j - i;
        body += `(?:${escapeRegex(chars[i])}){${n},}`;
        i = j;
    }
    return new RegExp(whole ? `^${body}$` : body, "u");
}

export interface NameFilterEntry {
    /** the line as written */
    source: string;
    pattern: RegExp;
}

export class NameFilter {
    readonly entries: readonly NameFilterEntry[];

    constructor(lines: readonly string[]) {
        const entries: NameFilterEntry[] = [];
        for (const raw of lines) {
            const line = raw.replace(/#.*$/, "").trim();
            if (!line) continue;
            const whole = line.startsWith("=");
            const pattern = entryPattern(whole ? line.slice(1) : line, whole);
            if (pattern) entries.push({ source: line, pattern });
        }
        this.entries = entries;
    }

    /** A filter from a list file (throws when the file cannot be read). */
    static fromFile(file: string): NameFilter {
        return new NameFilter(readFileSync(file, "utf8").split(/\r?\n/));
    }

    /** The first entry `name` matches, or null. */
    match(name: string): NameFilterEntry | null {
        if (this.entries.length === 0) return null;
        const forms = nameForms(name);
        for (const e of this.entries) if (forms.some((f) => e.pattern.test(f))) return e;
        return null;
    }

    /** `name`, or FILTERED_NAME when it contains a banned word. */
    filter(name: string): string {
        return this.match(name) ? FILTERED_NAME : name;
    }
}

/** A filter that lets every name through (NAME_FILTER=0). */
export const NO_NAME_FILTER = new NameFilter([]);
