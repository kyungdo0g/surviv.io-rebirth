// The owner's 2026-10-10 additions on the client: the Molotov's and flashbang's sprites (the owner's cut, our committed
// drawings as fallback), the second-wave rounds and the discarded launchers' decals in the sprite manifest, their
// explosion effects, the flashbang's white-out and deafness curves, a decal's free rotation, and their names.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
    DISCARD_DECALS,
    FIRE_DECAL_SPRITE,
    FLASHBANG_FLASH,
    GameObjectDefs,
    getMapObjectDefOfType,
    launcherRound,
    OWNER_ROUND_ART,
    REBIRTH_THROWABLE_SPRITES,
    type ThrowableDef,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import { explosionVisual } from "../src/fx/explosions.ts";
import { deafAt, FlashbangFx, whiteAt } from "../src/fx/flashbang.ts";
import { enItems } from "../src/l10n/en.ts";
import { koHudItems, koItems } from "../src/l10n/ko.ts";

const PUBLIC = join(import.meta.dirname, "../public");

function svgSize(url: string): [number, number] {
    const text = readFileSync(join(PUBLIC, url), "utf8");
    const root = /<svg\b[^>]*>/.exec(text)?.[0] ?? "";
    const attr = (name: string) => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1]);
    return [attr("width"), attr("height")];
}

describe("sprites", () => {
    it("the throwables draw the owner's cut, else our committed drawing, in the hand, in flight and as loot", () => {
        for (const id of ["molotov", "flashbang"] as const) {
            const def = GameObjectDefs[id] as ThrowableDef;
            const sprite = REBIRTH_THROWABLE_SPRITES[id];
            for (const used of [def.worldImg.sprite, def.lootImg.sprite, def.handImg?.cook?.right.sprite]) {
                expect(used).toBe(sprite);
            }
            const entry = SPRITES[sprite];
            expect(entry.path).toBe(`img/rebirth/${sprite.replace(".img", ".png")}`);
            const fallback = SPRITES[entry.fallback!];
            expect(fallback.path).toMatch(/^\/rebirth\/throwables\/.*\.svg$/);
            expect(existsSync(join(PUBLIC, fallback.path!))).toBe(true);
            expect(svgSize(fallback.path!)).toEqual([...entry.size!]);
        }
    });

    it("the second-wave rounds and the launcher bodies fall back to committed sprites", () => {
        for (const bullet of ["bullet_nlaw", "bullet_bazooka", "bullet_pvg42"]) {
            const sprite = launcherRound(bullet)!.sprite;
            expect(SPRITES[sprite].fallback).toBe(OWNER_ROUND_ART[sprite as keyof typeof OWNER_ROUND_ART].fallback);
            expect(SPRITES[SPRITES[sprite].fallback!].path).toMatch(/\.svg$/);
        }
        for (const art of Object.values(DISCARD_DECALS)) {
            const decal = getMapObjectDefOfType("decal", art.decal);
            const entry = SPRITES[decal.img.sprite];
            expect(entry, art.decal).toBeDefined();
            if (art.fallback) {
                expect(entry.fallback).toBe(art.fallback);
                expect(SPRITES[art.fallback], art.fallback).toBeDefined();
            } else {
                expect(entry.path).toMatch(/^\/rebirth\/guns\/.*\.svg$/);
            }
        }
        const fire = SPRITES[FIRE_DECAL_SPRITE];
        expect(existsSync(join(PUBLIC, fire.path!))).toBe(true);
        expect(svgSize(fire.path!)).toEqual([...fire.size!]);
    });
});

describe("effects", () => {
    it("the Molotov and flashbang explosions play their own small effects", () => {
        const molotov = explosionVisual("explosion_molotov")!;
        expect(molotov.effectType).toBe("molotov");
        expect(molotov.burstScale).toBeCloseTo(4.5 / 12, 6);
        expect(molotov.effect.burst.grass).toBe("window_break_01");
        const flash = explosionVisual("explosion_flashbang")!;
        expect(flash.effectType).toBe("flashbang");
        expect(flash.burstScale).toBeCloseTo(0.35, 6);
    });

    it("whites the screen out, holds, then fades over blind x blindTime; a wall leaves it clear", () => {
        expect(whiteAt(1, 0)).toBe(1);
        expect(whiteAt(1, FLASHBANG_FLASH.blindTime * 0.39)).toBe(1);
        const mid = whiteAt(1, FLASHBANG_FLASH.blindTime * 0.7);
        expect(mid).toBeGreaterThan(0.2);
        expect(mid).toBeLessThan(0.8);
        expect(whiteAt(1, FLASHBANG_FLASH.blindTime)).toBe(0);
        expect(whiteAt(0.4, 0)).toBeCloseTo(0.5, 9);
        expect(whiteAt(0.4, FLASHBANG_FLASH.blindTime * 0.4)).toBe(0);
        expect(whiteAt(0, 0)).toBe(0);
        expect(deafAt(0.35, 0)).toBeCloseTo(0.35, 9);
        expect(deafAt(1, FLASHBANG_FLASH.deafTime)).toBe(0);
    });

    it("drives the overlay and the audio's deafness, keeping the stronger of two flashes", () => {
        const deafness: number[] = [];
        const fx = new FlashbangFx(null, { setDeafness: (t) => deafness.push(t) });
        fx.flash({ blind: 1, deaf: 1 });
        fx.update(0.1);
        expect(fx.shown).toBe(1);
        expect(deafness.at(-1)).toBeGreaterThan(0.9);
        fx.flash({ blind: 0.1, deaf: 0.1 });
        fx.update(0.1);
        expect(fx.shown).toBe(1);
        for (let i = 0; i < 70; i++) fx.update(0.1);
        expect(fx.shown).toBe(0);
        expect(deafness.at(-1)).toBe(0);
        expect(fx.count).toBe(2);
    });
});

describe("names", () => {
    it("names the throwables in English and Korean", () => {
        expect(enItems.molotov).toBe("Molotov Cocktail");
        expect(enItems.flashbang).toBe("Flashbang");
        expect([koItems.molotov, koItems.flashbang]).toEqual(["화염병", "섬광탄"]);
        expect([koHudItems.molotov, koHudItems.flashbang]).toEqual(["화염병", "섬광탄"]);
    });
});
