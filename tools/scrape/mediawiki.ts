// Dumps a MediaWiki site (fandom, wiki.gg, wikipedia) through api.php into research-cache/.
// Usage: NODE_USE_ENV_PROXY=1 node tools/scrape/mediawiki.ts <name> <apiBase> [--titles A|B] [--no-images]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = "surviv-rebirth-research/0.1 (+https://github.com/kyungdo0g/surviv.io-rebirth)";

type Json = Record<string, any>;

async function api(base: string, params: Record<string, string>): Promise<Json> {
    const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await fetch(url, { headers: { "User-Agent": UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return (await res.json()) as Json;
        } catch (err) {
            if (attempt >= 4) throw new Error(`${url}: ${err}`);
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
    }
}

async function listAll(base: string, list: string, params: Record<string, string>): Promise<Json[]> {
    const out: Json[] = [];
    let cont: Record<string, string> = {};
    for (;;) {
        const data = await api(base, { action: "query", list, ...params, ...cont });
        out.push(...(data.query?.[list] ?? []));
        if (!data.continue) return out;
        cont = data.continue;
    }
}

async function fetchContents(base: string, titles: string[]): Promise<Json[]> {
    const pages: Json[] = [];
    for (let i = 0; i < titles.length; i += 50) {
        const data = await api(base, {
            action: "query",
            prop: "revisions|categories",
            rvprop: "content|timestamp|ids",
            rvslots: "main",
            cllimit: "max",
            titles: titles.slice(i, i + 50).join("|"),
        });
        for (const p of data.query?.pages ?? []) {
            if (p.missing) continue;
            const rev = p.revisions?.[0];
            pages.push({
                title: p.title,
                pageid: p.pageid,
                ns: p.ns,
                revid: rev?.revid,
                timestamp: rev?.timestamp,
                categories: (p.categories ?? []).map((c: Json) => c.title),
                wikitext: rev?.slots?.main?.content ?? "",
            });
        }
        process.stdout.write(`\r  ${Math.min(i + 50, titles.length)}/${titles.length}`);
    }
    process.stdout.write("\n");
    return pages;
}

const safeName = (t: string) => t.replace(/[\/\\:*?"<>|\s]+/g, "_").slice(0, 150);

async function main() {
    const [name, base, ...rest] = process.argv.slice(2);
    if (!name || !base) throw new Error("usage: mediawiki.ts <name> <apiBase> [--titles A|B] [--no-images]");
    const titlesArg = rest.includes("--titles") ? rest[rest.indexOf("--titles") + 1] : undefined;
    const withImages = !rest.includes("--no-images") && !titlesArg;
    const out = join("research-cache", name);
    mkdirSync(join(out, "pages"), { recursive: true });

    const site = await api(base, { action: "query", meta: "siteinfo", siprop: "general|statistics" });
    let titles: string[];
    let redirects: Json[] = [];
    if (titlesArg) {
        titles = titlesArg.split("|");
    } else {
        const nsList = ["0", "14"]; // articles + categories
        titles = [];
        for (const ns of nsList) {
            const pages = await listAll(base, "allpages", { apnamespace: ns, aplimit: "max", apfilterredir: "nonredirects" });
            titles.push(...pages.map((p) => p.title));
        }
        redirects = await listAll(base, "allpages", { apnamespace: "0", aplimit: "max", apfilterredir: "redirects" });
    }
    console.log(`${name}: ${titles.length} pages`);
    const pages = await fetchContents(base, titles);
    for (const p of pages) writeFileSync(join(out, "pages", `${safeName(p.title)}.json`), JSON.stringify(p, null, 1));

    let images: Json[] = [];
    if (withImages) {
        images = await listAll(base, "allimages", { ailimit: "max", aiprop: "url|size|mime|timestamp" });
        writeFileSync(join(out, "images.json"), JSON.stringify(images, null, 1));
    }
    writeFileSync(
        join(out, "index.json"),
        JSON.stringify(
            {
                name,
                api: base,
                fetchedAt: new Date().toISOString(),
                site: site.query?.general?.sitename,
                statistics: site.query?.statistics,
                pages: pages.map((p) => ({ title: p.title, file: `pages/${safeName(p.title)}.json`, revid: p.revid, bytes: p.wikitext.length, categories: p.categories })),
                redirects: redirects.map((r) => r.title),
                imageCount: images.length,
            },
            null,
            1,
        ),
    );
    console.log(`${name}: wrote ${pages.length} pages, ${images.length} image records`);
}

await main();
