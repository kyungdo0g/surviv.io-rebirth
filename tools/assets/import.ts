// Builds the client's art and audio (apps/client/public/assets, gitignored) and the sprite manifest mapping the defs'
// "<name>.img" sprite ids to a file, its source and the size the client scales it by:
// 1. copies survev's art and audio (the original surviv.io files, .survev/client/public);
// 2. cuts the original v0.8.82 atlas frames out of the original client's atlases (atlas.ts, into research-cache/atlas;
//    the pages are downloaded once), unless they are already cut from the same bundle;
// 3. uses the original frame (as PNG under img/original/) for every sprite the original atlases hold, except the ones
//    tools/assets/keep-survev.json keeps on survev's SVG (relaunch atlas defects, frames on another canvas); survev's
//    file for the rest. The DOM HUD gets survev's SVG of an original frame unless tools/assets/survev-redrawn.json
//    names it (survev's later redraws);
// 4. fills sprites the definitions reference without any file from the fandom image dump; ids the original client also
//    names without shipping an image are recorded as source "none" (the original drew nothing for them).
// Usage: pnpm assets [--check-only] [--atlas-out research-cache/atlas] (behind a proxy it restarts itself with
// NODE_USE_ENV_PROXY=1, tools/envProxy.ts, so the script runs the same in cmd.exe, PowerShell and POSIX shells)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ensureEnvProxy } from "../envProxy.ts";
import type { SpriteIndex } from "./atlasInventory.ts";
import { pngSize } from "./png.ts";
import {
    ASSET_DEST,
    chooseSprites,
    collectSpriteRefs,
    formatManifest,
    type ManifestEntry,
    nominalSize,
    ORIGINAL_DIR,
    type SpriteSource,
    SURVEV_PUBLIC,
    survevAtlasScales,
    survevFiles,
    survevSprites,
} from "./sources.ts";

const MANIFEST = "apps/client/src/generated/sprite-manifest.json";
const DEFS = "packages/defs/src/generated";
const LIVE = "research-cache/live";
const KEEP_SURVEV = "tools/assets/keep-survev.json";
const SURVEV_REDRAWN = "tools/assets/survev-redrawn.json";
const FANDOM_IMAGES = "research-cache/fandom/images.json";
const FANDOM_GAPFILL = "assets/fandom-gapfill.json";

ensureEnvProxy();

const { values: args } = parseArgs({
    options: {
        "check-only": { type: "boolean", default: false },
        "atlas-out": { type: "string", default: "research-cache/atlas" },
    },
});
const checkOnly = args["check-only"]!;
const atlasOut = args["atlas-out"]!;
if (!existsSync(SURVEV_PUBLIC)) throw new Error(`${SURVEV_PUBLIC} missing: run pnpm survev:fetch first`);

// 1. survev's files
const files = survevFiles();
if (!checkOnly) {
    rmSync(ASSET_DEST, { recursive: true, force: true });
    for (const f of files) {
        mkdirSync(join(ASSET_DEST, f, ".."), { recursive: true });
        cpSync(join(SURVEV_PUBLIC, f), join(ASSET_DEST, f));
    }
}

// 2. the original atlas frames
const bundle = existsSync(LIVE) ? readdirSync(LIVE).find((f) => /^app\.[0-9a-f]+\.js$/.test(f)) : undefined;
const indexPath = join(atlasOut, "sprites", "index.json");
const readIndex = () => JSON.parse(readFileSync(indexPath, "utf8")) as SpriteIndex;
if (bundle && (!existsSync(indexPath) || readIndex().bundle !== bundle) && !checkOnly) {
    console.log(`cutting the original atlases of ${bundle} into ${atlasOut}`);
    execFileSync(process.execPath, ["tools/assets/atlas.ts", "--bundle", join(LIVE, bundle), "--out", atlasOut], {
        stdio: "inherit",
        env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
    });
}
const index: SpriteIndex | undefined = existsSync(indexPath) ? readIndex() : undefined;
if (!index) {
    console.warn(
        `WARNING: no original atlas frames (${indexPath}); the original client bundle (${LIVE}/app.<hash>.js) is ` +
            "needed to cut them. The manifest falls back to survev's files.",
    );
}

// 3. pick a source per sprite
const keep = JSON.parse(readFileSync(KEEP_SURVEV, "utf8")) as { sprites: object; ownCanvas: string[] };
const keepSurvev = new Set(Object.keys(keep.sprites));
const ownCanvas = new Set(keep.ownCanvas);
const redrawn = new Set(Object.keys((JSON.parse(readFileSync(SURVEV_REDRAWN, "utf8")) as { sprites: object }).sprites));
const { sprites: survev, clashes } = survevSprites(files);
// survev's logical size: the file's size x the scale survev's atlas builder draws it at
const atlasScales = survevAtlasScales();
const survevSized = new Map(
    [...survev].map(([id, file]) => {
        const size = nominalSize(file);
        const k = atlasScales.get(file) ?? 1;
        return [id, { file, size: size && ([size[0] * k, size[1] * k] as [number, number]) }];
    }),
);
const manifest: Record<string, ManifestEntry> = chooseSprites(survevSized, index?.sprites ?? {}, {
    keepSurvev,
    ownCanvas,
    redrawn,
});
const unusedKeeps = [...keepSurvev].filter((id) => manifest[id]?.source !== "survev");
if (unusedKeeps.length) console.warn(`WARNING: ${KEEP_SURVEV} names sprites not drawn from survev: ${unusedKeeps}`);
const strayOwnCanvas = [...ownCanvas].filter((id) => !keepSurvev.has(id));
if (strayOwnCanvas.length)
    throw new Error(`${KEEP_SURVEV} ownCanvas names sprites it does not keep: ${strayOwnCanvas}`);
const unusedRedrawn = [...redrawn].filter((id) => manifest[id]?.source !== "original-0.8.82");
if (unusedRedrawn.length)
    console.warn(`WARNING: ${SURVEV_REDRAWN} names sprites not drawn from an original frame: ${unusedRedrawn}`);

if (!checkOnly && index) {
    for (const [id, entry] of Object.entries(manifest)) {
        if (entry.source !== "original-0.8.82") continue;
        const dest = join(ASSET_DEST, entry.path!);
        mkdirSync(join(dest, ".."), { recursive: true });
        cpSync(join(atlasOut, "sprites", index.sprites[id]!.file), dest);
    }
}

// 4. gaps: sprites the definitions reference without a file
const refs = new Set<string>();
for (const name of ["gameObjects.json", "mapObjects.json", "maps.json"]) {
    const p = join(DEFS, name);
    if (existsSync(p)) collectSpriteRefs(JSON.parse(readFileSync(p, "utf8")), refs);
}
for (const empty of ["none.img", ".img"]) refs.delete(empty);
let missing = [...refs].filter((r) => !manifest[r]).sort();

// fandom image dump: original-game PNG renders uploaded to the wiki
const gapFill: { sprite: string; file: string; url: string }[] = [];
if (missing.length && existsSync(FANDOM_IMAGES)) {
    const images: { name: string; url: string }[] = JSON.parse(readFileSync(FANDOM_IMAGES, "utf8"));
    const byName = new Map(images.map((i) => [i.name.toLowerCase().replace(/_/g, "-"), i]));
    for (const sprite of missing) {
        const stem = sprite.replace(/\.img$/, "").toLowerCase();
        const hit = byName.get(`${stem}.img.png`) ?? byName.get(`${stem}.png`);
        if (!hit) continue;
        const file = `img/fandom/${sprite.replace(/\.img$/, "")}.png`;
        let size: [number, number] | undefined;
        if (!checkOnly) {
            const res = await fetch(hit.url.replace(/\/revision\/latest.*$/, "/revision/latest?format=original"));
            if (!res.ok) continue;
            const buf = Buffer.from(await res.arrayBuffer());
            mkdirSync(join(ASSET_DEST, "img/fandom"), { recursive: true });
            writeFileSync(join(ASSET_DEST, file), buf);
            const { width, height } = pngSize(buf);
            size = [width, height];
        }
        manifest[sprite] = { source: "fandom", path: file, ...(size ? { size } : {}) };
        gapFill.push({ sprite, file, url: hit.url });
    }
    missing = missing.filter((m) => !manifest[m]);
}
writeFileSync(FANDOM_GAPFILL, `${JSON.stringify(gapFill, null, 1)}\n`);

// ids the original client names too without any atlas frame: it drew nothing for them (Texture.from of an unknown id)
const originalText = bundle ? readFileSync(join(LIVE, bundle), "utf8") : "";
const absent = missing.filter((id) => originalText.includes(`"${id}"`));
for (const id of absent) manifest[id] = { source: "none" };
missing = missing.filter((m) => !manifest[m]);

mkdirSync(join(MANIFEST, ".."), { recursive: true });
writeFileSync(MANIFEST, formatManifest(manifest));

const counts: Record<SpriteSource, number> = { "original-0.8.82": 0, survev: 0, fandom: 0, none: 0 };
for (const e of Object.values(manifest)) counts[e.source]++;
const audio = files.filter((f) => f.startsWith("audio/")).length;
console.log(`assets: ${files.length - audio} survev images, ${audio} audio files -> ${ASSET_DEST}`);
console.log(
    `manifest: ${Object.keys(manifest).length} sprites: ${counts["original-0.8.82"]} original-0.8.82 ` +
        `(${ORIGINAL_DIR}), ${counts.survev} survev (${keepSurvev.size} kept over an original frame), ` +
        `${counts.fandom} fandom, ${counts.none} none; ${clashes.length} name clashes resolved to svg`,
);
console.log(`defs reference ${refs.size} sprites; without a file: ${absent.length} absent in the original too`);
if (absent.length) console.log(`absent in the original too: ${absent.join(", ")}`);
if (missing.length) console.log(`MISSING: ${missing.join(", ")}`);
