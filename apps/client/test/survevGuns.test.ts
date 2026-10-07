// The survev-only guns on the client (tools/port-survev/policy.json): their loot icons, held sprites and the PMG-134
// projectile draw from files in the sprite manifest (survev's art, which pnpm assets copies from
// .survev/client/public), every sound a gun names resolves in the sound defs (the survev ones from survev's
// soundDefs.ts, apps/client/scripts/sound-defs.ts) and has its mp3, the Barrett and the ASh-12 drop survev's .50
// casing, the PMG-134 shot has survev's explosion effect and the PMG-134 is held in the minigun pose.
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
    GameObjectDefs,
    type GunDef,
    getDefOfType,
    SURVEV_GUN_SKINS,
    SURVEV_ONLY_GUNS,
    type ThrowableDef,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import { soundDef } from "../src/audio/soundDefs.ts";
import { explosionVisual } from "../src/fx/explosions.ts";
import { ALL_PARTICLE_DEFS } from "../src/fx/particleDefsAll.ts";
import soundDefsJson from "../src/generated/sound-defs.json";
import { idlePoseName } from "../src/objects/player.ts";

const ASSETS = join(import.meta.dirname, "../public/assets");
const HAVE_ASSETS = existsSync(join(ASSETS, "audio"));
const GUNS = [...SURVEV_ONLY_GUNS, ...Object.keys(SURVEV_GUN_SKINS)];
const gun = (id: string) => GameObjectDefs[id] as GunDef;

describe("survev-only guns on the client", () => {
    it("loot icons, held sprites and the potato shot draw from survev's files in the manifest", () => {
        for (const id of GUNS) {
            for (const sprite of [gun(id).lootImg.sprite, gun(id).worldImg.sprite]) {
                expect(SPRITES[sprite]?.path, `${id}: ${sprite}`).toBeDefined();
                if (HAVE_ASSETS) expect(existsSync(join(ASSETS, SPRITES[sprite]!.path!)), sprite).toBe(true);
            }
        }
        for (const id of SURVEV_ONLY_GUNS) expect(SPRITES[gun(id).worldImg.sprite]?.source, id).toBe("survev");
        const shot = getDefOfType("throwable", "potato_lmgshot") as ThrowableDef;
        expect(SPRITES[shot.worldImg.sprite]?.path).toBeDefined();
    });

    it("every sound a gun names plays: the survev ones come from survev's list, with their mp3", () => {
        const lists = soundDefsJson.lists as Record<string, Record<string, { path: string; source?: string }>>;
        for (const id of GUNS) {
            for (const [field, name] of Object.entries(gun(id).sound)) {
                if (typeof name !== "string" || !name) continue;
                // pickup sounds play on the ui channel (fx/effects.ts), the others on the player channels
                const def = soundDef(name, field === "pickup" ? "ui" : "activePlayer");
                expect(def, `${id}.sound.${field}: ${name}`).toBeDefined();
                if (HAVE_ASSETS) expect(existsSync(join(ASSETS, def!.path)), def!.path).toBe(true);
            }
        }
        const survev = Object.entries(lists.players)
            .filter(([, d]) => d.source === "survev")
            .map(([name]) => name);
        expect(survev.sort()).toEqual(
            SURVEV_ONLY_GUNS.flatMap((id) => [`${id}_01`, `${id}_reload_01`, `${id}_switch_01`]).sort(),
        );
    });

    it("the Barrett and the ASh-12 drop survev's .50 casing", () => {
        expect(gun("barrett").particle.casing).toBe("50cal");
        expect(gun("ash12").particle.casing).toBe("50cal");
        expect(ALL_PARTICLE_DEFS["50cal"]?.image).toEqual(["part-shell-06.img"]);
        expect(SPRITES["part-shell-06.img"]?.path).toBeDefined();
    });

    it("the PMG-134 shot bursts with survev's potato_lmgshot effect; the PMG-134 is held in the minigun pose", () => {
        const visual = explosionVisual("explosion_potato_lmgshot");
        expect(visual?.effectType).toBe("potato_lmgshot");
        expect(visual?.effect.burst).toMatchObject({ grass: "potato_01", water: "potato_02", detune: 400 });
        expect(idlePoseName(gun("potato_lmg"), false)).toBe("minigun");
        expect(idlePoseName(gun("barrett"), false)).toBe("rifle");
        expect(idlePoseName(gun("sw500"), false)).toBe("pistol");
    });
});
