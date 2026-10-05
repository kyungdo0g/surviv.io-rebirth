// Extracts {{Item/<Kind> ...}} infobox templates (datamined item stats) from the fandom dump.
// Usage: node tools/research/fandom-infobox.ts  -> research-cache/fandom-infobox.json
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Infobox {
    kind: string;
    page: string;
    revid: number;
    timestamp: string;
    params: Record<string, string | number | boolean | null>;
}

function findTemplateEnd(text: string, start: number): number {
    let depth = 0;
    for (let i = start; i < text.length - 1; i++) {
        if (text[i] === "{" && text[i + 1] === "{") {
            depth++;
            i++;
        } else if (text[i] === "}" && text[i + 1] === "}") {
            depth--;
            i++;
            if (depth === 0) return i + 1;
        }
    }
    return text.length;
}

function splitTopLevel(body: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let cur = "";
    for (let i = 0; i < body.length; i++) {
        const two = body.slice(i, i + 2);
        if (two === "{{" || two === "[[") {
            depth++;
            cur += two;
            i++;
            continue;
        }
        if (two === "}}" || two === "]]") {
            depth--;
            cur += two;
            i++;
            continue;
        }
        if (body[i] === "|" && depth === 0) {
            parts.push(cur);
            cur = "";
            continue;
        }
        cur += body[i];
    }
    parts.push(cur);
    return parts;
}

export function parseValue(raw: string): string | number | boolean | null {
    const v = raw.trim();
    if (v === "") return null;
    if (v === "True" || v === "true") return true;
    if (v === "False" || v === "false") return false;
    if (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(v)) return Number(v);
    return v;
}

export function extractInfoboxes(page: {
    title: string;
    revid: number;
    timestamp: string;
    wikitext: string;
}): Infobox[] {
    const text = page.wikitext.replace(/<!--[\s\S]*?-->/g, "");
    const out: Infobox[] = [];
    const re = /\{\{\s*Item\/([A-Za-z]+)\s*\|/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
        const end = findTemplateEnd(text, m.index);
        const body = text.slice(m.index + 2, end - 2);
        const [, ...params] = splitTopLevel(body);
        const record: Infobox["params"] = {};
        for (const p of params) {
            const eq = p.indexOf("=");
            if (eq === -1) continue;
            record[p.slice(0, eq).trim()] = parseValue(p.slice(eq + 1));
        }
        out.push({ kind: m[1], page: page.title, revid: page.revid, timestamp: page.timestamp, params: record });
        re.lastIndex = end;
    }
    return out;
}

if (import.meta.main) {
    const dir = "research-cache/fandom/pages";
    const all: Infobox[] = [];
    for (const f of readdirSync(dir)) all.push(...extractInfoboxes(JSON.parse(readFileSync(join(dir, f), "utf8"))));
    writeFileSync("research-cache/fandom-infobox.json", JSON.stringify(all, null, 1));
    const byKind: Record<string, Set<string>> = {};
    for (const ib of all) for (const k of Object.keys(ib.params)) (byKind[ib.kind] ??= new Set()).add(k);
    for (const [kind, keys] of Object.entries(byKind)) {
        console.log(`${kind} (${all.filter((x) => x.kind === kind).length}): ${[...keys].join(" ")}`);
    }
}
