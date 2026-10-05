// Extracts the logical size of every sprite in the original v0.8.82 atlases (the spritesheet JSON embedded in
// the original client bundle) into src/generated/sprite-sizes.json. The definitions' sprite scales are relative to
// these sizes: some images (large ceilings) were stored shrunk, by factors that differ from survev's atlas.
// Usage (repo root): node apps/client/scripts/sprite-sizes.ts [research-cache/live/app.<hash>.js]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIVE = "research-cache/live";
const OUT = "apps/client/src/generated/sprite-sizes.json";

interface Sheet {
    meta: { image: string; scale: number | string };
    frames: Record<string, { sourceSize: { w: number; h: number } }>;
}

/** Every `{"meta":{...},"frames":{...}}` object literal in the bundle, parsed by bracket matching. */
function findSheets(src: string): Sheet[] {
    const sheets: Sheet[] = [];
    for (let i = src.indexOf('{"meta":'); i >= 0; i = src.indexOf('{"meta":', i + 1)) {
        let depth = 0;
        let inString = false;
        for (let j = i; j < src.length; j++) {
            const c = src[j];
            if (inString) {
                if (c === "\\") j++;
                else if (c === '"') inString = false;
            } else if (c === '"') inString = true;
            else if (c === "{") depth++;
            else if (c === "}" && --depth === 0) {
                const sheet = JSON.parse(src.slice(i, j + 1)) as Sheet;
                if (sheet.frames) sheets.push(sheet);
                break;
            }
        }
    }
    return sheets;
}

const bundle = process.argv[2] ?? join(LIVE, readdirSync(LIVE).find((f) => /^app\..*\.js$/.test(f))!);
const sheets = findSheets(readFileSync(bundle, "utf8"));
const sizes: Record<string, [number, number]> = {};
const conflicts: string[] = [];
for (const sheet of sheets) {
    const scale = Number(sheet.meta.scale) || 1;
    for (const [id, frame] of Object.entries(sheet.frames)) {
        const size: [number, number] = [Math.round(frame.sourceSize.w / scale), Math.round(frame.sourceSize.h / scale)];
        const prev = sizes[id];
        // half-resolution sheets round odd sizes; prefer the full-resolution value
        if (prev && scale !== 1) continue;
        if (prev && (prev[0] !== size[0] || prev[1] !== size[1])) conflicts.push(`${id}: ${prev} vs ${size}`);
        sizes[id] = size;
    }
}
const sorted = Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => (a < b ? -1 : 1)));
const lines = Object.entries(sorted).map(([id, [w, h]]) => `    ${JSON.stringify(id)}: [${w}, ${h}]`);
writeFileSync(OUT, `{\n${lines.join(",\n")}\n}\n`);
console.log(`${sheets.length} sheets, ${Object.keys(sorted).length} sprites -> ${OUT}`);
if (conflicts.length) console.log(`size conflicts between sheets:\n${conflicts.join("\n")}`);
