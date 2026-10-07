import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    chooseSprites,
    collectNames,
    formatManifest,
    type OriginalFrame,
    posixRelative,
    type Size,
    SURVEV_PUBLIC,
    scaleSize,
    survevAtlasScales,
} from "./sources.ts";

describe("sprite sources", () => {
    it("lists survev's files with / separators on Windows too (the manifest, URLs and patterns use /)", () => {
        const pub = "C:\\rebirth\\.survev\\client\\public";
        expect(posixRelative(pub, `${pub}\\img\\map\\map-tree-01.svg`, path.win32)).toBe("img/map/map-tree-01.svg");
        expect(posixRelative(pub, `${pub}\\audio\\sfx\\frag_01.mp3`, path.win32)).toBe("audio/sfx/frag_01.mp3");
        expect(posixRelative("/r/public", "/r/public/img/map/a.svg", path.posix)).toBe("img/map/a.svg");
    });

    it("scales by the original frame's logical size unless the vector has other proportions", () => {
        // a ceiling the original stored at 0.75: the defs' scale is relative to the shrunk size
        expect(scaleSize([960, 864], [720, 648], true)).toEqual([720, 648]);
        // a few pixels of padding either way, same proportions within 3%
        expect(scaleSize([738, 706], [724, 692], true)).toEqual([724, 692]);
        // another crop of the canvas: the vector keeps its own size
        expect(scaleSize([1088, 448], [864, 448], true)).toEqual([1088, 448]);
        expect(scaleSize([110.08, 110.08], undefined, true)).toEqual([110, 110]);
        // a raster gap fill always takes the original size
        expect(scaleSize([129, 129], [128, 128], false)).toEqual([128, 128]);
    });

    it("prefers the original frame unless kept on survev", () => {
        const survev = new Map<string, { file: string; size: Size | undefined }>([
            ["a.img", { file: "img/loot/a.svg", size: [140, 140] }],
            ["b.img", { file: "img/map/b.svg", size: [1088, 448] }],
            ["c.img", { file: "img/map/c.svg", size: [64, 64] }],
        ]);
        const originals: Record<string, OriginalFrame> = {
            "a.img": { file: "a.png", logicalSize: [128, 128] },
            "b.img": { file: "b.png", logicalSize: [864, 448] },
            "d.img": { file: "d@0.5x.png", logicalSize: [144, 144] },
        };
        const none = new Set<string>();
        const m = chooseSprites(survev, originals, { keepSurvev: new Set(["b.img"]), ownCanvas: none, redrawn: none });
        expect(m["a.img"]).toEqual({
            source: "original-0.8.82",
            path: "img/original/a.png",
            size: [128, 128],
            svg: "img/loot/a.svg",
        });
        expect(m["b.img"]).toEqual({ source: "survev", path: "img/map/b.svg", size: [1088, 448] });
        expect(m["c.img"]).toEqual({ source: "survev", path: "img/map/c.svg", size: [64, 64] });
        // original only (a half-resolution page keeps the full logical size); world-only sprites get no svg
        expect(m["d.img"]).toEqual({ source: "original-0.8.82", path: "img/original/d@0.5x.png", size: [144, 144] });
    });

    it("draws a kept file at its own size when the original frame is another canvas", () => {
        // the relaunch's hatchet chamber floor is our 738x706 canvas cut 14 px short at the right and bottom: the same
        // proportions within 3%, but scaling ours to 724x692 would shrink the art by 2% instead of uncutting it
        const survev = new Map<string, { file: string; size: Size | undefined }>([
            ["cut.img", { file: "img/map/cut.svg", size: [738, 706] }],
            ["same.img", { file: "img/map/same.svg", size: [738, 706] }],
        ]);
        const originals: Record<string, OriginalFrame> = {
            "cut.img": { file: "cut.png", logicalSize: [724, 692] },
            "same.img": { file: "same.png", logicalSize: [724, 692] },
        };
        const keepSurvev = new Set(["cut.img", "same.img"]);
        const m = chooseSprites(survev, originals, { keepSurvev, ownCanvas: new Set(["cut.img"]), redrawn: new Set() });
        expect(m["cut.img"]!.size).toEqual([738, 706]);
        expect(m["same.img"]!.size).toEqual([724, 692]);
    });

    it("gives an original frame survev's SVG for the DOM unless survev redrew it", () => {
        const survev = new Map<string, { file: string; size: Size | undefined }>([
            ["a.img", { file: "img/loot/a.svg", size: [128, 128] }],
            ["r.img", { file: "img/loot/r.svg", size: [128, 128] }],
        ]);
        const originals: Record<string, OriginalFrame> = {
            "a.img": { file: "a.png", logicalSize: [128, 128] },
            "r.img": { file: "r.png", logicalSize: [128, 128] },
        };
        const m = chooseSprites(survev, originals, {
            keepSurvev: new Set(),
            ownCanvas: new Set(),
            redrawn: new Set(["r.img"]),
        });
        expect(m["a.img"]!.svg).toBe("img/loot/a.svg");
        expect(m["r.img"]).toEqual({ source: "original-0.8.82", path: "img/original/r.png", size: [128, 128] });
    });

    it("reads survev's atlas scales when the survev clone is present", () => {
        if (!existsSync(SURVEV_PUBLIC)) return;
        const scales = survevAtlasScales();
        expect(scales.get("img/map/map-bunker-hydra-compartment-ceiling-02.svg")).toBe(0.5);
        expect(scales.get("img/map/map-building-police-ceiling-01.svg")).toBe(0.75);
        expect(scales.has("img/map/map-bunker-hatchet-chamber-floor-01a.svg")).toBe(false);
    });

    it("writes one sorted entry per line", () => {
        const text = formatManifest({
            "z.img": { source: "none" },
            "a.img": { source: "survev", path: "img/a.svg", size: [1, 2] },
        });
        expect(text).toBe(
            '{\n "a.img": {"path":"img/a.svg","source":"survev","size":[1,2]},\n "z.img": {"source":"none"}\n}\n',
        );
        expect(JSON.parse(text)["a.img"].size).toEqual([1, 2]);
    });
});

describe("unspawned defs (tools/assets/unspawned-defs.json)", () => {
    const listed = Object.keys(JSON.parse(readFileSync("tools/assets/unspawned-defs.json", "utf8"))).filter(
        (k) => k !== "$comment",
    );
    const defs = (name: string) => JSON.parse(readFileSync(`packages/defs/src/generated/${name}`, "utf8"));

    it("lists defs that no map, map object or game object names", () => {
        const mapObjects = defs("mapObjects.json") as Record<string, unknown>;
        const named = new Set<string>();
        collectNames(defs("maps.json"), named);
        collectNames(defs("gameObjects.json"), named);
        for (const [id, def] of Object.entries(mapObjects)) if (!listed.includes(id)) collectNames(def, named);
        expect(listed.length).toBeGreaterThan(0);
        for (const id of listed) {
            expect(mapObjects[id], id).toBeDefined();
            expect(named.has(id), id).toBe(false);
        }
    });

    it("and that no simulation, server or rebirth defs source spawns", () => {
        const sources = ["packages/sim/src", "apps/server/src", "packages/defs/src/rebirth"].flatMap((dir) =>
            readdirSync(dir, { recursive: true, encoding: "utf8" })
                .filter((f) => f.endsWith(".ts"))
                .map((f) => readFileSync(path.join(dir, f), "utf8")),
        );
        for (const id of listed) for (const text of sources) expect(text.includes(`"${id}"`), id).toBe(false);
    });
});
