// Imports the original surviv.io art and audio from the survev reference clone into the client,
// and writes a sprite manifest mapping the defs' "<name>.img" sprite ids to files.
// Usage: NODE_USE_ENV_PROXY=1 node tools/assets/import.ts [--check-only]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const SRC = ".survev/client/public";
const DEST = "apps/client/public/assets";
const MANIFEST = "apps/client/src/generated/sprite-manifest.json";
const DEFS = "packages/defs/src/generated";

// survev's own branding, promos and social icons are not original game art
const EXCLUDE =
    /^img\/(survev[-_].*|discord-promo\..*|icon_(kofi|discord|discord_sm|facebook|facebook_reverse|google|instagram|reddit|twitch|twitter|youtube|wiki|app|apple)\..*|template_.*|hof_splash\.png|stats_title\.png|surviv_shirts_.*|yt_icon_rgb\.png)$/;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

function collectSpriteRefs(value: unknown, out: Set<string>) {
    if (typeof value === "string") {
        if (value.endsWith(".img")) out.add(value);
    } else if (Array.isArray(value)) {
        for (const v of value) collectSpriteRefs(v, out);
    } else if (value && typeof value === "object") {
        for (const v of Object.values(value)) collectSpriteRefs(v, out);
    }
}

const checkOnly = process.argv.includes("--check-only");
if (!existsSync(SRC)) throw new Error(`${SRC} missing: run sh tools/port-survev/fetch.sh first`);

const files = [...walk(join(SRC, "img")), ...walk(join(SRC, "audio"))]
    .map((p) => relative(SRC, p).replaceAll("\\", "/")) // posix separators (Windows)
    .filter((p) => !EXCLUDE.test(p));

if (!checkOnly) {
    rmSync(DEST, { recursive: true, force: true });
    for (const f of files) {
        mkdirSync(join(DEST, f, ".."), { recursive: true });
        cpSync(join(SRC, f), join(DEST, f));
    }
}

const manifest: Record<string, string> = {};
const duplicates: string[] = [];
for (const f of files.filter((p) => p.startsWith("img/") && /\.(svg|png)$/.test(p)).sort()) {
    const key = `${basename(f, extname(f))}.img`;
    if (manifest[key]?.endsWith(".svg")) {
        duplicates.push(`${key}: ${manifest[key]} / ${f}`);
        continue;
    }
    manifest[key] = f;
}
mkdirSync(join(MANIFEST, ".."), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);

const refs = new Set<string>();
for (const name of ["gameObjects.json", "mapObjects.json", "maps.json"]) {
    const p = join(DEFS, name);
    if (existsSync(p)) collectSpriteRefs(JSON.parse(readFileSync(p, "utf8")), refs);
}
let missing = [...refs].filter((r) => !manifest[r] && r !== "none.img" && r !== ".img").sort();

// Fill gaps from the fandom image dump (original-game PNG renders uploaded to the wiki).
const FANDOM_IMAGES = "research-cache/fandom/images.json";
const gapFill: { sprite: string; file: string; url: string }[] = [];
if (missing.length && existsSync(FANDOM_IMAGES)) {
    const images: { name: string; url: string }[] = JSON.parse(readFileSync(FANDOM_IMAGES, "utf8"));
    const byName = new Map(images.map((i) => [i.name.toLowerCase().replace(/_/g, "-"), i]));
    for (const sprite of missing) {
        const stem = sprite.replace(/\.img$/, "").toLowerCase();
        const hit = byName.get(`${stem}.img.png`) ?? byName.get(`${stem}.png`);
        if (!hit) continue;
        const file = `img/fandom/${sprite.replace(/\.img$/, "")}.png`;
        if (!checkOnly) {
            const res = await fetch(hit.url.replace(/\/revision\/latest.*$/, "/revision/latest?format=original"));
            if (!res.ok) continue;
            mkdirSync(join(DEST, "img/fandom"), { recursive: true });
            writeFileSync(join(DEST, file), Buffer.from(await res.arrayBuffer()));
        }
        manifest[sprite] = file;
        gapFill.push({ sprite, file, url: hit.url });
    }
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
    writeFileSync("assets/fandom-gapfill.json", `${JSON.stringify(gapFill, null, 1)}\n`);
    missing = missing.filter((m) => !manifest[m]);
}

const audio = files.filter((f) => f.startsWith("audio/")).length;
console.log(`assets: ${files.length - audio} images, ${audio} audio files -> ${DEST}`);
console.log(`manifest: ${Object.keys(manifest).length} sprites (${duplicates.length} name clashes resolved to svg)`);
console.log(
    `defs reference ${refs.size} sprites, ${gapFill.length} filled from fandom, ${missing.length} without a file`,
);
if (missing.length) console.log(`missing: ${missing.join(", ")}`);
