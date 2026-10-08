// The drawn top-down held sprites (packages/defs rebirth/heldGunArt.ts): our own minimal SVGs, committed under
// apps/client/public/rebirth/guns/ and served at /rebirth/guns/ (Vite serves public/ at the site root and copies it into
// the build). Each gun's held image resolves to its file through the client's sprite manifest, at the declared size.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GameObjectDefs, type GunDef, HELD_GUN_ART, heldGunArt } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rebirthHeldGunUrl } from "../src/assets/rebirthSprites.ts";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import { heldGunImage } from "../src/objects/heldGun.ts";

const PUBLIC = join(import.meta.dirname, "../public");
const MAX_BYTES = 8 * 1024;
/** Markup a minimal hand-written sprite never needs (editor metadata, raster or text content, effects, scripts). */
const FORBIDDEN =
    /<(text|image|linearGradient|radialGradient|filter|script|foreignObject|style|mask|use)\b|sodipodi|inkscape|xlink:href/i;

describe("drawn top-down held sprites", () => {
    it("the drawn guns: the AK-47, four beta rifles and six beta snipers and DMRs (the Mk 14 EBR stays a bar)", () => {
        expect(Object.keys(HELD_GUN_ART)).toEqual([
            "ak47",
            "g36c",
            "m16a4",
            "sig550",
            "g3",
            "fal",
            "wa2000",
            "m200",
            "hecate",
            "lynx",
            "boys",
        ]);
        expect(Object.hasOwn(HELD_GUN_ART, "mk14")).toBe(false);
    });

    it("each committed SVG exists at its served path, at its declared size, minimal and small", () => {
        for (const art of heldGunArt()) {
            const url = rebirthHeldGunUrl(art.sprite);
            expect(url).toBe(`/rebirth/guns/gun-${art.id}-01.svg`);
            const file = join(PUBLIC, url);
            expect(existsSync(file), file).toBe(true);
            const text = readFileSync(file, "utf8");
            const root = /<svg\b[^>]*>/.exec(text)?.[0] ?? "";
            const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1];
            const [w, h] = art.size;
            expect(attr("xmlns"), file).toBe("http://www.w3.org/2000/svg");
            expect([attr("width"), attr("height"), attr("viewBox")], file).toEqual([`${w}`, `${h}`, `0 0 ${w} ${h}`]);
            expect(text.match(FORBIDDEN)?.[0], file).toBeUndefined();
            expect(text, file).toMatch(/own art/);
            expect(statSync(file).size, file).toBeLessThan(MAX_BYTES);
        }
    });

    it("each gun's held image resolves to its committed file through the sprite manifest", () => {
        for (const art of heldGunArt()) {
            const img = heldGunImage(GameObjectDefs[art.id] as GunDef);
            expect(img.sprite, art.id).toBe(art.sprite);
            expect(img.scale, art.id).toEqual({ x: 0.5, y: 0.5 });
            expect(img.tint, art.id).toBe(0xffffff);
            const entry = SPRITES[img.sprite];
            expect(entry, art.id).toEqual({ source: "rebirth", path: rebirthHeldGunUrl(art.sprite), size: art.size });
            expect(entry?.fallback, art.id).toBeUndefined();
            expect(existsSync(join(PUBLIC, entry!.path!)), entry!.path).toBe(true);
        }
    });
});
