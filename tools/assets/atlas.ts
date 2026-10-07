// Cuts the original v0.8.82 sprites out of the original client's texture atlases, and compares them with ours.
// 1. parses the TexturePacker sheets inlined in the original bundle (research-cache/live/app.<hash>.js);
// 2. downloads the chosen atlas pages (full resolution "-100" where the bundle has them, else "-50") from the
//    relaunch's asset host into research-cache/live/atlases/ (skipped when present);
// 3. cuts every frame into <out>/sprites/<id without .img>.png at its untrimmed sourceSize (pages below scale 1
//    get a Pixi-style "@0.5x" suffix; a copy of a frame on another page that is different art, not just another
//    dithering of it, also goes to <out>/sprites/variants/<family>/), indexed in <out>/sprites/index.json;
// 4. writes <out>/inventory.json comparing them with survev's files and the fandom gap fills (see atlasInventory.ts).
// `pnpm assets` (import.ts) runs this when the frames are missing or were cut from another bundle.
// The art is copyrighted: every output stays in gitignored or scratch directories.
// Usage: pnpm assets:atlas [--bundle research-cache/live/app.<hash>.js] [--out research-cache/atlas] [--no-cut]
// (behind a proxy it restarts itself with NODE_USE_ENV_PROXY=1, tools/envProxy.ts)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { parseArgs } from "node:util";
import { ensureEnvProxy } from "../envProxy.ts";
import { buildInventory, type SpriteIndex, type SpriteIndexEntry } from "./atlasInventory.ts";
import {
    choosePages,
    cutFrame,
    familyRank,
    findSheets,
    imageDiff,
    parsePageName,
    type Sheet,
    type SheetFrame,
    sheetScale,
    VARIANT_DIFF,
} from "./atlasSheets.ts";
import { decodePng, encodePng, pngSize, type RgbaImage } from "./png.ts";

ensureEnvProxy();

const LIVE = "research-cache/live";
const PAGES_DIR = join(LIVE, "atlases");
const ASSET_HOST = "https://surviv.io/assets/";

const { values: args } = parseArgs({
    options: {
        bundle: { type: "string" },
        out: { type: "string", default: "research-cache/atlas" },
        "no-cut": { type: "boolean", default: false },
    },
});
const bundlePath = args.bundle ?? join(LIVE, readdirSync(LIVE).find((f) => /^app\.[0-9a-f]+\.js$/.test(f)) ?? "");
const outDir = args.out!;
const spritesDir = join(outDir, "sprites");

const bundleText = readFileSync(bundlePath, "utf8");
const allSheets = findSheets(bundleText);
if (!allSheets.length) throw new Error(`no spritesheets found in ${bundlePath}`);
const bundleOrder = new Map(allSheets.map((s, i) => [s, i]));
// highest scale first, then the always-loaded families, then bundle order: the first page holding a frame wins
const pages = choosePages(allSheets).sort(
    (a, b) =>
        sheetScale(b) - sheetScale(a) ||
        familyRank(a.meta.image) - familyRank(b.meta.image) ||
        bundleOrder.get(a)! - bundleOrder.get(b)!,
);
console.log(
    `${allSheets.length} sheets in ${basename(bundlePath)}; using ${pages.length}: ${pages.map((p) => p.meta.image).join(", ")}`,
);

async function download(image: string, size: { w: number; h: number }): Promise<boolean> {
    const file = join(PAGES_DIR, image);
    if (existsSync(file)) return false;
    const res = await fetch(ASSET_HOST + image);
    if (!res.ok) throw new Error(`${ASSET_HOST + image}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = pngSize(buf);
    if (got.width !== size.w || got.height !== size.h)
        throw new Error(`${image}: ${got.width}x${got.height}, sheet says ${size.w}x${size.h}`);
    mkdirSync(PAGES_DIR, { recursive: true });
    writeFileSync(file, buf);
    return true;
}

const downloaded = new Set<string>();
for (const page of pages) {
    if (await download(page.meta.image, page.meta.size)) {
        downloaded.add(page.meta.image);
        console.log(`downloaded ${page.meta.image}`);
    }
}

/** frame id -> every chosen page that holds it, best first */
const holders = new Map<string, { sheet: Sheet; frame: SheetFrame }[]>();
for (const sheet of pages) {
    for (const [id, frame] of Object.entries(sheet.frames)) {
        const list = holders.get(id) ?? [];
        list.push({ sheet, frame });
        holders.set(id, list);
    }
}

const stem = (id: string) => id.replace(/\.img$/, "").replace(/[\\/:*?"<>|]/g, "_");
const fileName = (id: string, scale: number) => `${stem(id)}${scale === 1 ? "" : `@${scale}x`}.png`;
const family = (image: string) => parsePageName(image)?.family ?? basename(image, ".png");

const index: SpriteIndex = {
    bundle: basename(bundlePath),
    pages: pages.map((p) => ({
        image: p.meta.image,
        family: family(p.meta.image),
        scale: sheetScale(p),
        size: [p.meta.size.w, p.meta.size.h] as [number, number],
        frames: Object.keys(p.frames).length,
        downloaded: downloaded.has(p.meta.image),
    })),
    sprites: {},
};
for (const [id, list] of [...holders].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const { sheet, frame } = list[0]!;
    const scale = sheetScale(sheet);
    const entry: SpriteIndexEntry = {
        file: fileName(id, scale),
        atlas: sheet.meta.image,
        scale,
        sourceSize: [frame.sourceSize.w, frame.sourceSize.h],
        logicalSize: [Math.round(frame.sourceSize.w / scale), Math.round(frame.sourceSize.h / scale)],
        trimmed: frame.trimmed,
        rotated: frame.rotated,
    };
    if (list.length > 1)
        entry.alsoIn = list.slice(1).map((h) => ({ atlas: h.sheet.meta.image, scale: sheetScale(h.sheet) }));
    index.sprites[id] = entry;
}

if (!args["no-cut"]) {
    rmSync(spritesDir, { recursive: true, force: true });
    mkdirSync(spritesDir, { recursive: true });
    /** canonical cuts of frames that other pages also hold, to compare their copies against */
    const canonical = new Map<string, RgbaImage>();
    let written = 0;
    for (const sheet of pages) {
        const page = decodePng(readFileSync(join(PAGES_DIR, sheet.meta.image)));
        for (const [id, frame] of Object.entries(sheet.frames)) {
            const list = holders.get(id)!;
            const rank = list.findIndex((h) => h.sheet === sheet);
            const img = cutFrame(page, frame);
            if (rank === 0) {
                writeFileSync(join(spritesDir, index.sprites[id]!.file), encodePng(img));
                written++;
                if (list.length > 1) canonical.set(id, img);
                continue;
            }
            // a copy on another page: keep it only when it is different art at the same scale
            if (sheetScale(sheet) !== sheetScale(list[0]!.sheet)) continue;
            const copy = index.sprites[id]!.alsoIn![rank - 1]!;
            copy.diff = imageDiff(canonical.get(id)!, img);
            if (copy.diff.mean <= VARIANT_DIFF.mean && copy.diff.max <= VARIANT_DIFF.max) continue;
            // "/" on every OS: index.json and inventory.json read the same everywhere (Windows accepts it in paths)
            copy.file = posix.join("variants", family(sheet.meta.image), fileName(id, sheetScale(sheet)));
            mkdirSync(dirname(join(spritesDir, copy.file)), { recursive: true });
            writeFileSync(join(spritesDir, copy.file), encodePng(img));
            written++;
        }
        console.log(`cut ${sheet.meta.image} (${Object.keys(sheet.frames).length} frames)`);
    }
    console.log(`${written} sprite files -> ${spritesDir}`);
}
mkdirSync(spritesDir, { recursive: true });
writeFileSync(join(spritesDir, "index.json"), `${JSON.stringify(index, null, 1)}\n`);

const indexHtml = join(dirname(bundlePath), "index.html");
const inventory = buildInventory(index, bundleText + (existsSync(indexHtml) ? readFileSync(indexHtml, "utf8") : ""));
writeFileSync(join(outDir, "inventory.json"), `${JSON.stringify(inventory, null, 1)}\n`);
const c = inventory.counts;
console.log(
    `inventory: original ${c.original}, ours ${c.ours}; both ${c.both} (${c.sizeMismatch} size mismatches), ` +
        `original only ${c.originalOnly} (${c.originalOnlyReferencedByDefs} referenced by defs), ours only ${c.oursOnly} ` +
        `(${c.oursOnlyMatched} matched by name), fandom gap fills ${c.fandomGapFills} -> ${join(outDir, "inventory.json")}`,
);
