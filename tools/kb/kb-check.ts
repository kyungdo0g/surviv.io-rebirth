// Citation lint for docs/research. Every factual line must carry a source id and a confidence tag.
// Usage: node tools/kb/kb-check.ts [--strict]   (--strict also fails on unresolvable wiki/survev refs)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "docs/research";
const EXEMPT = new Set(["README.md", "sources.md"]);
export const SOURCE_PREFIXES = [
    "survev", // survev @ pinned commit: survev/<path>[:line]
    "fandom", // survivio.fandom.com page: fandom/<Page_Title>
    "wikigg", // survev.wiki.gg page: wikigg/<Page_Title>
    "wp-en", // en.wikipedia.org: wp-en/<Page_Title>
    "wp-ko", // ko.wikipedia.org
    "namu", // namu.wiki via search snippet only: namu/<문서명>
    "changelog", // original surviv changelog bundled in survev: changelog/<version>
    "balance", // survev balance.txt (fork balance log): balance/<line>
    "l10n", // official localization files: l10n/<lang>:<key>
    "kong", // observation on the 2026 Kongregate relaunch (v0.8.82)
    "web", // any other URL: web/<url>
    "derived", // computed from other cited facts: derived/<short note>
    "user", // the project owner's request for a deliberate rebirth deviation: user/<yyyy-mm-dd>-<topic>
] as const;

const SNIPPET_ONLY = new Set(["namu", "web"]);
const strict = process.argv.includes("--strict");

function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
    });
}

function wikiTitles(name: string): Set<string> | undefined {
    const idx = join("research-cache", name, "index.json");
    if (!existsSync(idx)) return undefined;
    const data = JSON.parse(readFileSync(idx, "utf8"));
    const norm = (t: string) => t.replace(/_/g, " ").toLowerCase();
    return new Set([...data.pages.map((p: { title: string }) => norm(p.title)), ...(data.redirects ?? []).map(norm)]);
}

const titles: Record<string, Set<string> | undefined> = { fandom: wikiTitles("fandom"), wikigg: wikiTitles("wikigg") };
const survevRoot = existsSync(".survev") ? ".survev" : undefined;

const errors: string[] = [];
const warnings: string[] = [];
let factLines = 0;

for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file);
    if (EXEMPT.has(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    let inFence = false;
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        const at = `${file}:${i + 1}`;
        if (line.startsWith("```")) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (inComment || line.startsWith("<!--")) {
            inComment = !line.includes("-->");
            continue;
        }
        if (!line || line.startsWith("#") || line.startsWith(">") || /^-{3,}$/.test(line)) continue;
        if (line.startsWith("|")) {
            if (/^\|[\s:|-]+\|?$/.test(line)) continue; // separator
            const next = lines[i + 1]?.trim() ?? "";
            if (/^\|[\s:|-]+\|?$/.test(next)) continue; // header row
        }
        factLines++;
        const srcs = [...line.matchAll(/\[src:([^\]]+)\]/g)].flatMap((m) => m[1].split(/\s*,\s*/));
        const conf = line.match(/\[(H|M|L)\]/)?.[1];
        if (srcs.length === 0) {
            errors.push(`${at}: no [src:...]: ${line.slice(0, 90)}`);
            continue;
        }
        if (!conf) errors.push(`${at}: no confidence tag [H|M|L]`);
        const prefixes = new Set<string>();
        for (const s of srcs) {
            const slash = s.indexOf("/");
            const prefix = slash === -1 ? s : s.slice(0, slash);
            const rest = slash === -1 ? "" : s.slice(slash + 1);
            if (!(SOURCE_PREFIXES as readonly string[]).includes(prefix)) {
                errors.push(`${at}: unknown source prefix "${prefix}"`);
                continue;
            }
            prefixes.add(prefix);
            if ((prefix === "fandom" || prefix === "wikigg") && titles[prefix]) {
                const t = rest.split("#")[0].replace(/_/g, " ").toLowerCase();
                if (!titles[prefix]!.has(t))
                    (strict ? errors : warnings).push(`${at}: ${prefix} page not in dump: "${rest}"`);
            }
            if (prefix === "survev" && survevRoot) {
                const path = rest.replace(/:\d+(-\d+)?$/, "");
                if (!existsSync(join(survevRoot, path)))
                    (strict ? errors : warnings).push(`${at}: survev path missing: ${path}`);
            }
        }
        if (conf === "H" && [...prefixes].every((p) => SNIPPET_ONLY.has(p))) {
            errors.push(`${at}: snippet-only sources (namu/web) cannot be [H]`);
        }
    }
}

for (const w of warnings.slice(0, 50)) console.warn(`warn  ${w}`);
if (warnings.length > 50) console.warn(`warn  ... ${warnings.length - 50} more`);
for (const e of errors.slice(0, 200)) console.error(`error ${e}`);
console.log(`kb-check: ${factLines} fact lines, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
