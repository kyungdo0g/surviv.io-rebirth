// The sprite manifest (tools/assets/import.ts) covers every sprite the game draws: the definitions' sprites, the
// particles', the HUD's loot images and the ids written in the client code. Original v0.8.82 atlas frames keep the
// atlas logical size (src/generated/sprite-sizes.json; also research-cache/atlas when it has been cut), survev's
// files replace an original frame only where tools/assets/keep-survev.json says so, and the DOM shows survev's SVG of an
// original frame unless tools/assets/survev-redrawn.json says survev's is different art.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GameObjectDefs, MapDefs, MapObjectDefs } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import keepSurvevJson from "../../../tools/assets/keep-survev.json";
import survevRedrawnJson from "../../../tools/assets/survev-redrawn.json";
import { lootImageUrl, spriteUrl } from "../src/assets/hudImages.ts";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import { ALL_PARTICLE_DEFS } from "../src/fx/particleDefsAll.ts";
import spriteSizesJson from "../src/generated/sprite-sizes.json";

const ORIGINAL_SIZES = spriteSizesJson as unknown as Readonly<Record<string, readonly [number, number]>>;
const KEEP_SURVEV = new Set(Object.keys(keepSurvevJson.sprites));
const OWN_CANVAS = new Set(keepSurvevJson.ownCanvas);
const REDRAWN = new Set(Object.keys(survevRedrawnJson.sprites));
const SRC = join(import.meta.dirname, "../src");
const ATLAS_INDEX = join(import.meta.dirname, "../../../research-cache/atlas/sprites/index.json");
const ASSETS = join(import.meta.dirname, "../public/assets");
const EMPTY = new Set(["", ".img", "none", "none.img"]);

/** ids written in the client code that are not sprites of the manifest on purpose */
const CODE_ALLOWLIST: Readonly<Record<string, string>> = {
    "none.img": "the definitions' 'no image' id",
};

function collectSprites(node: unknown, out: Set<string>): void {
    if (typeof node === "string") {
        if (node.endsWith(".img") && !EMPTY.has(node)) out.add(node);
    } else if (Array.isArray(node)) {
        for (const v of node) collectSprites(v, out);
    } else if (node && typeof node === "object") {
        for (const v of Object.values(node)) collectSprites(v, out);
    }
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

/** "<id>.img" string literals of the client code (template literals with ${} are not resolvable here) */
function codeSprites(): Map<string, string> {
    const out = new Map<string, string>();
    for (const file of walk(SRC).filter((f) => f.endsWith(".ts"))) {
        for (const m of readFileSync(file, "utf8").matchAll(/["'`]([A-Za-z0-9_-]+\.img)["'`]/g)) {
            if (!out.has(m[1]!)) out.set(m[1]!, file.slice(SRC.length + 1));
        }
    }
    return out;
}

function unresolved(ids: Iterable<string>): string[] {
    return [...ids].filter((id) => !SPRITES[id]).sort();
}

describe("sprite manifest", () => {
    it("has an entry for every sprite of the definitions", () => {
        const refs = new Set<string>();
        collectSprites(GameObjectDefs, refs);
        collectSprites(MapObjectDefs, refs);
        collectSprites(MapDefs, refs);
        expect(refs.size).toBeGreaterThan(1000);
        expect(unresolved(refs)).toEqual([]);
    });

    it("draws every particle, HUD loot image and sprite named in the client code from a file", () => {
        const particles = new Set(Object.values(ALL_PARTICLE_DEFS).flatMap((d) => d.image));
        const withoutFile = (ids: Iterable<string>) => [...ids].filter((id) => !SPRITES[id]?.path).sort();
        expect(withoutFile(particles)).toEqual([]);
        const code = [...codeSprites().keys()].filter((id) => !CODE_ALLOWLIST[id]);
        expect(code.length).toBeGreaterThan(50);
        expect(withoutFile(code)).toEqual([]);
        const lootless = Object.entries(GameObjectDefs)
            .filter(([, d]) => (d as { lootImg?: { sprite?: string } }).lootImg?.sprite)
            .filter(([id]) => !lootImageUrl(id))
            .map(([id]) => id);
        expect(lootless).toEqual([]);
    });

    it("leaves without an image only the sprites the original atlases lack too", () => {
        const none = Object.entries(SPRITES)
            .filter(([, e]) => e.source === "none")
            .map(([id]) => id);
        expect(none.filter((id) => ORIGINAL_SIZES[id])).toEqual([]);
        for (const id of none) expect(SPRITES[id]!.path, id).toBeUndefined();
    });

    it("draws an original frame at its atlas logical size wherever the original atlases have one", () => {
        const originals = Object.entries(SPRITES).filter(([, e]) => e.source === "original-0.8.82");
        expect(originals.length).toBeGreaterThan(1000);
        const bad = originals
            .filter(([id, e]) => {
                const size = ORIGINAL_SIZES[id];
                return (
                    !size ||
                    e.size?.[0] !== size[0] ||
                    e.size?.[1] !== size[1] ||
                    !/^img\/original\/.+\.png$/.test(e.path!)
                );
            })
            .map(([id, e]) => `${id}: ${e.path} ${e.size} vs atlas ${ORIGINAL_SIZES[id]}`);
        expect(bad).toEqual([]);
        // every other original frame is a decision of keep-survev.json, and every decision is in effect
        const survevOverOriginal = Object.entries(SPRITES)
            .filter(([id, e]) => ORIGINAL_SIZES[id] && e.source !== "original-0.8.82")
            .map(([id]) => id)
            .sort();
        expect(survevOverOriginal).toEqual([...KEEP_SURVEV].sort());
    });

    it("scales a kept survev vector by the original frame when it is the same picture", () => {
        for (const id of KEEP_SURVEV) {
            const e = SPRITES[id]!;
            const orig = ORIGINAL_SIZES[id]!;
            expect(e.source, id).toBe("survev");
            if (OWN_CANVAS.has(id)) continue;
            const [w, h] = e.size!;
            const fx = orig[0] / w;
            const fy = orig[1] / h;
            // the same proportions take the original size; other proportions (another crop) keep their own size
            if (w !== orig[0] || h !== orig[1]) expect(Math.abs(fx - fy), id).toBeGreaterThan(0.03 * Math.max(fx, fy));
        }
    });

    it("draws a kept sprite whose original frame is another canvas at survev's own size", () => {
        expect([...OWN_CANVAS].filter((id) => !KEEP_SURVEV.has(id))).toEqual([]);
        for (const id of OWN_CANVAS) expect(SPRITES[id]!.size, id).not.toEqual(ORIGINAL_SIZES[id]);
        // the relaunch frames are these canvases cut short at the right and bottom (795x767, 724x692, 1184x918): drawn
        // centred they moved the painted walls 5-18 px off the wall colliders
        expect(SPRITES["map-bunker-chrys-compartment-floor-01b.img"]!.size).toEqual([804, 804]);
        expect(SPRITES["map-bunker-chrys-compartment-floor-01c.img"]!.size).toEqual([804, 804]);
        expect(SPRITES["map-bunker-hatchet-chamber-floor-01a.img"]!.size).toEqual([738, 706]);
        expect(SPRITES["map-bunker-hatchet-compartment-floor-01.img"]!.size).toEqual([1184, 928]);
        // 1632x1440 at survev's atlas scale 0.5 (survev client/atlas-builder/atlasDefs.ts scaledSprites)
        expect(SPRITES["map-bunker-hydra-compartment-ceiling-02.img"]!.size).toEqual([816, 720]);
        expect(SPRITES["map-building-bank-floor-02.img"]!.size).toEqual([1088, 448]);
    });

    it("matches the cut atlas frames when research-cache/atlas is present", () => {
        if (!existsSync(ATLAS_INDEX)) return;
        const index = JSON.parse(readFileSync(ATLAS_INDEX, "utf8")) as {
            sprites: Record<
                string,
                { file: string; scale: number; sourceSize: [number, number]; logicalSize: [number, number] }
            >;
        };
        const bad: string[] = [];
        for (const [id, e] of Object.entries(SPRITES)) {
            if (e.source !== "original-0.8.82") continue;
            const frame = index.sprites[id];
            if (!frame) {
                bad.push(`${id}: not in the atlas index`);
                continue;
            }
            if (e.path !== `img/original/${frame.file}`) bad.push(`${id}: ${e.path} vs ${frame.file}`);
            if (e.size![0] !== frame.logicalSize[0] || e.size![1] !== frame.logicalSize[1])
                bad.push(`${id}: ${e.size} vs logical ${frame.logicalSize}`);
            // the PNG holds the frame at its atlas scale: sourceSize = logical size x scale
            const png = join(ASSETS, e.path!);
            if (existsSync(png)) {
                const buf = readFileSync(png);
                const size = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
                if (size[0] !== frame.sourceSize[0] || size[1] !== frame.sourceSize[1])
                    bad.push(`${id}: png ${size} vs sourceSize ${frame.sourceSize}`);
            }
        }
        expect(bad).toEqual([]);
    });

    it("gives the DOM HUD survev's vector file of an original sprite unless survev redrew it", () => {
        expect(spriteUrl("loot-weapon-ak.img")).toMatch(/^\/assets\/img\/loot\/loot-weapon-ak\.svg$/);
        expect(SPRITES["loot-weapon-ak.img"]!.path).toMatch(/^img\/original\//);
        expect(spriteUrl("map-tire-01.img")).toBe("");
        // survev redrew these: the HUD shows the original frame, the same picture as on the ground
        expect(REDRAWN.size).toBeGreaterThan(10);
        for (const id of REDRAWN) {
            const e = SPRITES[id]!;
            expect(e.source, id).toBe("original-0.8.82");
            expect(e.svg, id).toBeUndefined();
            expect(spriteUrl(id), id).toBe(`/assets/${e.path}`);
        }
        expect(lootImageUrl("m39")).toBe("/assets/img/original/loot-weapon-m39.png");
        expect(spriteUrl(undefined)).toBe("");
    });
});
