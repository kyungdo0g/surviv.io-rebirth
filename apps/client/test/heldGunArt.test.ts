// The drawn top-down held sprites (packages/defs rebirth/heldGunArt.ts): our own minimal SVGs, committed under
// apps/client/public/rebirth/guns/ and served at /rebirth/guns/ (Vite serves public/ at the site root and copies it into
// the build). Each gun's held image resolves to its file through the client's sprite manifest, at the declared size.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
    GameObjectDefs,
    type GunDef,
    HELD_GUN_ART,
    heldGunArt,
    heldGunArtEmpty,
    LAUNCHER_ROUND_ART,
    type LauncherRoundSprite,
    NEW_GUN_IDS,
    OWNER_HELD_GUN_ART,
    ownerHeldGunArt,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { ownerHeldArtInstalled, setOwnerHeldArtInstalled } from "../src/assets/ownerHeldArt.ts";
import { rebirthHeldGunUrl } from "../src/assets/rebirthSprites.ts";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import { heldGunImage } from "../src/objects/heldGun.ts";

const PUBLIC = join(import.meta.dirname, "../public");
const MAX_BYTES = 8 * 1024;
/** Markup a minimal hand-written sprite never needs (editor metadata, raster or text content, effects, scripts). */
const FORBIDDEN =
    /<(text|image|linearGradient|radialGradient|filter|script|foreignObject|style|mask|use)\b|sodipodi|inkscape|xlink:href/i;

describe("drawn top-down held sprites", () => {
    it("the drawn guns: the AK-47 and 26 beta rifles, snipers, DMRs, SMGs, machine pistols, shotguns, MGs, launchers", () => {
        expect(Object.keys(HELD_GUN_ART)).toEqual([
            "ak47",
            "ak74",
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
            "bizon",
            "asval",
            "p90",
            "tec9",
            "dp12",
            "aa12",
            "m60",
            "mg42",
            "dshk",
            "m79",
            "gl06",
            "mgl",
            "rpg7",
            "panzerfaust",
            "m202",
        ]);
        // bars on purpose (owner); a dual pistol is never listed, it shares its single's sprite
        for (const id of ["mk14", "m1928", "vz61", "vz61_dual", "tec9_dual"]) {
            expect(Object.hasOwn(HELD_GUN_ART, id), id).toBe(false);
        }
    });

    it("the dual TEC-9 holds the TEC-9's committed sprite in each hand (heldGun.ts ownHeldSprite strips _dual)", () => {
        const dual = GameObjectDefs.tec9_dual as GunDef;
        expect(dual.isDual).toBe(true);
        const img = heldGunImage(dual);
        expect(img.sprite).toBe("gun-tec9-01.img");
        expect(img).toMatchObject({ scale: { x: 0.5, y: 0.5 }, tint: 0xffffff });
        // the dual's own hands: no gun offset, left hand (0, 0)
        expect(img.gunOffset).toBeUndefined();
        expect(img.leftHandOffset).toEqual({ x: 0, y: 0 });
        expect(SPRITES[img.sprite]?.path).toBe("/rebirth/guns/gun-tec9-01.svg");
        expect(SPRITES["gun-tec9_dual-01.img"]).toBeUndefined();
    });

    it("the belt guns draw box and belt into their one sprite: no magImg, the sheet's PKP bottom sprite left off", () => {
        for (const id of ["m60", "mg42", "dshk"]) {
            const def = GameObjectDefs[id] as GunDef;
            // the balance sheet borrowed the PKP's top and bottom sprites (rebirth/newGuns.json)
            expect(def.worldImg.magImg?.sprite, id).toBe("gun-pkp-bot-01.img");
            const img = heldGunImage(def);
            expect(img.sprite, id).toBe(`gun-${id}-01.img`);
            expect(img.magImg, id).toBeUndefined();
            expect(img.leftHandOffset, id).toEqual({ x: 12.5, y: 0 });
            // no bottom sprite of our own (STYLE 12.2: a later one would be a gun-<id>-bot-01 entry and file)
            expect(SPRITES[`gun-${id}-bot-01.img`], id).toBeUndefined();
            expect(existsSync(join(PUBLIC, `rebirth/guns/gun-${id}-bot-01.svg`)), id).toBe(false);
        }
        // the frames hold the box or belt, the bipod and the spade grips on both sides of the centre line
        expect([HELD_GUN_ART.m60[0], HELD_GUN_ART.mg42[0], HELD_GUN_ART.dshk[0]]).toEqual([80, 80, 88]);
        expect([HELD_GUN_ART.dp12[0], HELD_GUN_ART.aa12[0]]).toEqual([48, 48]);
    });

    it("each committed SVG exists at its served path, at its declared size, minimal and small", () => {
        const rounds = (Object.keys(LAUNCHER_ROUND_ART) as LauncherRoundSprite[]).map((sprite) => ({
            sprite,
            size: LAUNCHER_ROUND_ART[sprite],
        }));
        // the held sprites, the RPG-7's empty one and the launcher rounds in flight
        for (const art of [...heldGunArt(), ...heldGunArtEmpty(), ...rounds]) {
            const url = rebirthHeldGunUrl(art.sprite);
            expect(url).toBe(`/rebirth/guns/${art.sprite.replace(/\.img$/, ".svg")}`);
            expect(SPRITES[art.sprite], art.sprite).toEqual({ source: "rebirth", path: url, size: art.size });
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

    it("the owner's held sprites: installed PNGs under img/rebirth, drawn only once found installed", () => {
        // the second wave and survev's Model 94; never a gun with a committed drawing
        for (const art of ownerHeldGunArt()) {
            expect(Object.hasOwn(HELD_GUN_ART, art.id), art.id).toBe(false);
            expect(NEW_GUN_IDS.includes(art.id) || art.id === "model94", art.id).toBe(true);
            expect(SPRITES[art.sprite], art.id).toEqual({
                source: "rebirth",
                path: `img/rebirth/gun-${art.id}-owner-01.png`,
                size: OWNER_HELD_GUN_ART[art.id],
            });
        }
        for (const id of ["bren", "model94", "nlaw"]) {
            const def = GameObjectDefs[id] as GunDef;
            expect(ownerHeldArtInstalled(id), id).toBe(false);
            // not installed: the bar (the Model 94 its def's own bar)
            const bar = heldGunImage(def);
            expect(bar.sprite, id).toBe(id === "model94" ? def.worldImg.sprite : "gun-long-01.img");
            setOwnerHeldArtInstalled(id, true);
            try {
                const img = heldGunImage(def);
                expect(img).toMatchObject({
                    sprite: `gun-${id}-owner-01.img`,
                    scale: { x: 0.5, y: 0.5 },
                    tint: 0xffffff,
                });
                expect(img.magImg, id).toBeUndefined();
                // the def's hands: the launchers keep their shoulder hold, hands under the gun
                expect(img.leftHandOffset, id).toEqual(def.worldImg.leftHandOffset);
                expect(img.gunOffset, id).toEqual(def.worldImg.gunOffset);
                expect(!!img.handsBelow, id).toBe(!!def.worldImg.handsBelow);
            } finally {
                setOwnerHeldArtInstalled(id, false);
            }
        }
    });
});
