// The rebirth's beta new guns on the client (2026-10-07): loot icons from the owner's sheets with an original fallback
// (assets/rebirthSprites.ts), held sprites as plain bars sized by the barrel length or, for the drawn ones, their own
// committed top-down SVG (objects/heldGun.ts, packages/defs rebirth/heldGunArt.ts), sounds from
// the owner's clips with the donor's original as fallback (audio/rebirthSounds.ts), the new ammo's HUD colours
// (ui/hudAmmo.ts) and the new-gun effects (fx/newGunFx.ts: DP-12 pump, discard, launch smoke and rocket trails).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BitReader, BitWriter } from "@rebirth/core";
import {
    GameObjectDefs,
    type GunDef,
    getDefOfType,
    gunClass,
    HELD_GUN_ART,
    HELD_GUN_ART_GUN_OFFSET,
    HELD_GUN_ART_HANDS_BELOW,
    HELD_GUN_ART_LEFT_HAND_OFFSET,
    type HeldGunArtId,
    Input,
    NEW_AMMO_EMOTES,
    NEW_AMMO_IDS,
    NEW_GUN_IDS,
    NEW_GUN_LOOT_FALLBACKS,
    NEW_GUN_SOUND_DONORS,
    WeaponSlot,
} from "@rebirth/defs";
import { emptyLocalState, LOCAL_ALL_DIRTY, quantizeLocal, readLocal, writeLocal } from "@rebirth/protocol";
import { type BulletEvent, emptyInput, Game, generateMap, type LocalPlayerState, type PlayerInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../src/assets/spriteManifest.ts";
import { soundDef, soundFallback } from "../src/audio/soundDefs.ts";
import { cycleSoundAfterShot, discardedGuns, LauncherFx, pumpedShot } from "../src/fx/newGunFx.ts";
import type { ParticleSystem } from "../src/fx/particles.ts";
import generatedSounds from "../src/generated/sound-defs.json";
import { barLength, heldGunImage, isBarSprite, ownHeldSprite } from "../src/objects/heldGun.ts";
import { AMMO_COLORS } from "../src/ui/hudAmmo.ts";

const ASSETS = join(import.meta.dirname, "../public/assets");
const HAVE_ASSETS = existsSync(join(ASSETS, "audio"));
const gun = (id: string) => GameObjectDefs[id] as GunDef;
/** Guns with a drawn top-down held sprite (packages/defs rebirth/heldGunArt.ts). */
const DRAWN = new Set<string>(Object.keys(HELD_GUN_ART));
/** Whether a gun holds a drawn sprite: its own, or a dual pistol its single's (heldGun.ts ownHeldSprite). */
const holdsDrawn = (id: string) => DRAWN.has(id.replace(/_dual$/, ""));
const ORIGINAL_PLAYERS = (generatedSounds.lists as Record<string, Record<string, { path: string }>>).players;

describe("new guns: loot icons", () => {
    it("each is the owner's icon under img/rebirth, falling back to an original gun's icon", () => {
        for (const id of NEW_GUN_IDS) {
            const sprite = gun(id).lootImg.sprite;
            const entry = SPRITES[sprite];
            expect(entry, `${id}: ${sprite}`).toMatchObject({ source: "rebirth", size: [128, 128] });
            expect(entry?.path).toBe(`img/rebirth/${sprite.replace(".img", "")}.png`);
            expect(entry?.fallback).toBe(NEW_GUN_LOOT_FALLBACKS[id]);
            const fallback = SPRITES[entry!.fallback!];
            expect(fallback?.source, entry!.fallback).toBe("original-0.8.82");
            // tools/assets/newGuns.ts installs a file for every icon (the owner's cut, or a copy of the fallback)
            if (HAVE_ASSETS && existsSync(join(ASSETS, "img/rebirth"))) {
                expect(existsSync(join(ASSETS, entry!.path!)), entry!.path).toBe(true);
            }
        }
    });
});

describe("new guns: held sprites", () => {
    it("without own art, every new gun holds a bar drawn from an original bar sprite, as long as its barrel", () => {
        for (const id of NEW_GUN_IDS) {
            if (holdsDrawn(id)) continue;
            const def = gun(id);
            const img = heldGunImage(def);
            expect(SPRITES[ownHeldSprite(id)], id).toBeUndefined();
            expect(isBarSprite(img.sprite), `${id}: ${img.sprite}`).toBe(true);
            expect(SPRITES[img.sprite]?.source, id).toBe("original-0.8.82");
            expect(img.magImg, id).toBeUndefined();
            // the original bar guns: 11-13.2 sprite px per unit of barrel length (ak47 13.0, mp5 12.0, glock 11.1);
            // a bar made from borrowed art adds the part held behind the hand (the launchers' gunOffset)
            const rear = isBarSprite(def.worldImg.sprite) ? 0 : Math.max(0, -(img.gunOffset?.x ?? 0));
            const perUnit = (barLength(img)! - rear) / def.barrelLength;
            expect(perUnit, id).toBeGreaterThan(10.9);
            expect(perUnit, id).toBeLessThan(14.7);
            expect(img.tint, id).not.toBe(0xffffff);
        }
    });

    it("a drawn new gun holds its own top-down sprite at 0.5 in its own colours, with the sheet's hands", () => {
        const drawnNew = NEW_GUN_IDS.filter((id) => DRAWN.has(id));
        expect(drawnNew).toEqual([
            "g36c",
            "m16a4",
            "sig550",
            "g3",
            "fal",
            "wa2000",
            "tec9",
            "bizon",
            "asval",
            "p90",
            "m200",
            "hecate",
            "lynx",
            "boys",
        ]);
        // the bullpups' own sprites are drawn for survev's bullpup gun offset; the sheet gave them none
        const gunOffset: Record<string, { x: number; y: number }> = {
            wa2000: { x: -8, y: 0 },
            lynx: { x: -8, y: 0 },
            p90: { x: -8, y: 0 },
        };
        expect(HELD_GUN_ART_GUN_OFFSET).toEqual(gunOffset);
        // the P90's own sprite is held with both hands under it (its top magazine is its identity)
        expect(HELD_GUN_ART_HANDS_BELOW).toEqual({ p90: true });
        // the AS Val's left hand moves back from its suppressor onto its forend (the sheet's (9, 0) is the VSS's)
        const leftHandOffset: Record<string, { x: number; y: number }> = { asval: { x: 4, y: 0 } };
        expect(HELD_GUN_ART_LEFT_HAND_OFFSET).toEqual(leftHandOffset);
        for (const id of drawnNew) {
            const def = gun(id);
            const img = heldGunImage(def);
            const sprite = `gun-${id}-01.img`;
            expect(ownHeldSprite(id)).toBe(sprite);
            expect(img, id).toEqual({
                ...def.worldImg,
                sprite,
                scale: { x: 0.5, y: 0.5 },
                tint: 0xffffff,
                magImg: undefined,
                leftHandOffset: leftHandOffset[id] ?? def.worldImg.leftHandOffset,
                gunOffset: gunOffset[id] ?? def.worldImg.gunOffset,
                handsBelow: HELD_GUN_ART_HANDS_BELOW[id] ?? def.worldImg.handsBelow,
            });
            // the balance sheet's held image stays in the def (rebirth/newGuns.json): its bar, or the AWM-S art it
            // borrowed for the Hecate II and the Lynx; recoil is kept, and the hands and gun offset but the overrides
            if (id === "hecate" || id === "lynx") expect(def.worldImg.sprite, id).toBe("gun-awc-01.img");
            else expect(isBarSprite(def.worldImg.sprite), id).toBe(true);
            expect(img.leftHandOffset, id).toEqual(leftHandOffset[id] ?? def.worldImg.leftHandOffset);
            expect(img.gunOffset, id).toEqual(gunOffset[id] ?? def.worldImg.gunOffset);
            expect(img.recoil, id).toBe(def.worldImg.recoil);
            expect(SPRITES[sprite], id).toEqual({
                source: "rebirth",
                path: `/rebirth/guns/gun-${id}-01.svg`,
                size: HELD_GUN_ART[id as keyof typeof HELD_GUN_ART],
            });
        }
        expect(gun("m16a4").worldImg).toMatchObject({ leftHandOffset: { x: 12, y: 0 }, gunOffset: { x: -8, y: 0 } });
        for (const id of ["wa2000", "lynx", "p90"]) {
            expect(gun(id).isBullpup, id).toBe(true);
            expect(gun(id).worldImg.gunOffset, id).toBeUndefined();
            expect(heldGunImage(gun(id)).gunOffset, id).toEqual(HELD_GUN_ART_GUN_OFFSET[id as HeldGunArtId]);
        }
        expect(gun("p90").worldImg.handsBelow).toBeUndefined();
        expect(heldGunImage(gun("p90")).handsBelow).toBe(true);
        expect(gun("asval").worldImg.leftHandOffset).toEqual({ x: 9, y: 0 });
    });

    it("the dual TEC-9 holds the TEC-9's drawn sprite in each hand, with its own hands", () => {
        const dual = gun("tec9_dual");
        expect(dual.isDual).toBe(true);
        expect(DRAWN.has("tec9_dual")).toBe(false);
        expect(ownHeldSprite("tec9_dual")).toBe("gun-tec9-01.img");
        expect(heldGunImage(dual)).toEqual({
            ...dual.worldImg,
            sprite: "gun-tec9-01.img",
            scale: { x: 0.5, y: 0.5 },
            tint: 0xffffff,
            magImg: undefined,
        });
        expect(heldGunImage(dual).leftHandOffset).toEqual({ x: 0, y: 0 });
    });

    it('the Thompson M1928 and the Škorpion vz. 61 stay bars on purpose (owner: "막대기")', () => {
        for (const id of ["m1928", "vz61", "vz61_dual"]) {
            expect(holdsDrawn(id), id).toBe(false);
            expect(SPRITES[ownHeldSprite(id)], id).toBeUndefined();
            expect(heldGunImage(gun(id)), id).toBe(gun(id).worldImg);
            expect(isBarSprite(gun(id).worldImg.sprite), id).toBe(true);
        }
    });

    it('the Mk 14 EBR stays a bar on purpose (owner: "Mk 14 EBR만 막대기로")', () => {
        expect(DRAWN.has("mk14")).toBe(false);
        expect(SPRITES[ownHeldSprite("mk14")]).toBeUndefined();
        expect(heldGunImage(gun("mk14"))).toBe(gun("mk14").worldImg);
        expect(gun("mk14").worldImg).toMatchObject({
            sprite: "gun-long-01.img",
            scale: { x: 0.5, y: 0.47 },
            tint: 0xa08c6a,
        });
    });

    it("the AK-47 holds its drawn sprite through its def (a presentation deviation), hands and recoil unchanged", () => {
        const ak47 = gun("ak47");
        expect(heldGunImage(ak47)).toBe(ak47.worldImg);
        expect(ak47.worldImg).toEqual({
            sprite: "gun-ak47-01.img",
            scale: { x: 0.5, y: 0.5 },
            tint: 0xffffff,
            leftHandOffset: { x: 2.8, y: 0 },
            recoil: 1.33,
        });
        expect(SPRITES["gun-ak47-01.img"]).toEqual({
            source: "rebirth",
            path: "/rebirth/guns/gun-ak47-01.svg",
            size: [48, 172],
        });
        // the other original guns keep their own sprites
        expect(gun("ak74").worldImg.sprite).toBe("gun-long-01.img");
        expect(gun("mosin").worldImg.sprite).toBe("gun-long-01.img");
    });

    it("keeps the sheet's own bars, turns borrowed art into a long bar by class, leaves other guns alone", () => {
        expect(heldGunImage(gun("ak74"))).toBe(gun("ak74").worldImg);
        expect(heldGunImage(gun("ak47"))).toBe(gun("ak47").worldImg);
        expect(heldGunImage(gun("ak47")).sprite).toBe("gun-ak47-01.img");
        expect(heldGunImage(gun("barrett"))).toBe(gun("barrett").worldImg);
        const rpg = heldGunImage(gun("rpg7"));
        expect(gun("rpg7").worldImg.sprite).toBe("gun-potato-cannon-01.img");
        expect(rpg).toMatchObject({ sprite: "gun-long-01.img", scale: { x: 0.8 }, gunOffset: { x: -10, y: -4 } });
        // 13.1 px per unit of barrel and the 10 px held behind the hand
        expect(barLength(rpg)).toBeCloseTo(13.1 * 2.3 + 10, 6);
        expect(heldGunImage(gun("dshk")).scale.x).toBe(0.6);
        expect(gunClass("m202")).toBe("launcher");
        expect(gun("m202").worldImg.sprite).toBe("gun-potato-cannon-01.img");
        expect(heldGunImage(gun("m202")).scale.x).toBe(0.8);
    });
});

describe("new guns: sounds", () => {
    it("every sound a new gun names plays its installed file, with the donor's original as the fallback", () => {
        for (const id of NEW_GUN_IDS) {
            for (const [field, name] of Object.entries(gun(id).sound)) {
                if (typeof name !== "string" || !name) continue;
                const def = soundDef(name, field === "pickup" ? "ui" : "activePlayer");
                expect(def, `${id}.sound.${field}: ${name}`).toBeDefined();
                if (field === "pickup" || name.startsWith("empty_fire")) continue;
                expect(def!.path).toBe(`audio/rebirth/guns/${name}.mp3`);
                const donor = NEW_GUN_SOUND_DONORS[name]!;
                const original = ORIGINAL_PLAYERS[donor] ?? soundDef(donor, "ui");
                expect(def!.fallback, name).toBe(original!.path);
                expect(soundFallback(def!.path)).toBe(original!.path);
                if (HAVE_ASSETS) expect(existsSync(join(ASSETS, def!.fallback!)), def!.fallback).toBe(true);
            }
        }
    });

    it("the AK-47 reload is the owner's (the AK-74 reload), the original file as fallback; others untouched", () => {
        expect(soundDef("ak47_reload_01", "activePlayer")).toMatchObject({
            path: "audio/rebirth/guns/ak47_reload_01.mp3",
            fallback: ORIGINAL_PLAYERS.ak47_reload_01!.path,
        });
        expect(soundDef("ak47_01", "activePlayer")?.path).toBe(ORIGINAL_PLAYERS.ak47_01!.path);
        expect(soundDef("mk14_01", "activePlayer")?.fallback).toBe(ORIGINAL_PLAYERS.mk12_01!.path);
        expect(soundDef("tec9_reload_01", "activePlayer")?.fallback).toBe(ORIGINAL_PLAYERS.glock_reload_01!.path);
    });
});

describe("new ammo on the HUD", () => {
    it("teal, brown and pink overlays: the ammo defs' loot tints", () => {
        for (const id of NEW_AMMO_IDS) {
            const tint = getDefOfType("ammo", id).lootImg.tint;
            const rgb = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
            expect(AMMO_COLORS[id], id).toBe(`rgba(${rgb.join(", ")}, 0.75)`);
        }
    });

    it("each pings its own emote: drawn under img/rebirth, the generic ammo emote as fallback", () => {
        for (const id of NEW_AMMO_IDS) {
            const texture = String(getDefOfType("emote", NEW_AMMO_EMOTES[id]).texture);
            expect(SPRITES[texture], texture).toEqual({
                source: "rebirth",
                path: `img/rebirth/ammo-${id}.png`,
                size: [128, 128],
                fallback: "ammo-box.img",
            });
            expect(SPRITES["ammo-box.img"]?.path).toBeDefined();
            if (HAVE_ASSETS) expect(existsSync(join(ASSETS, `img/rebirth/ammo-${id}.png`)), id).toBe(true);
        }
    });
});

/** The local state as the client gets it over the wire (8-bit cooldowns). */
function overWire(s: LocalPlayerState): LocalPlayerState {
    const w = new BitWriter();
    writeLocal(w, quantizeLocal(s), LOCAL_ALL_DIRTY);
    const out = emptyLocalState();
    readLocal(new BitReader(w.getBuffer()), out);
    return out;
}

/** A player with a DP-12 on an empty map, and a shot helper comparing the client's pump guess with the sim's pump. */
function dp12Range() {
    const gen = generateMap("main", 12345, 1);
    const generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    const game = new Game({ mapName: "main", seed: 1 }, { generation, spawnLoot: false, sandbox: true });
    const id = game.addPlayer("p");
    game.teleportPlayer(id, { x: gen.mapData.width / 2, y: gen.mapData.height / 2 });
    const p = game.getPlayer(id)!;
    const wm = p.weaponManager;
    p.backpack = "backpack03";
    p.inv.set("12gauge", 60);
    wm.setWeapon(WeaponSlot.Primary, "dp12", gun("dp12").maxClip);
    wm.setCurWeapIndex(WeaponSlot.Primary, true);
    const send = (input: Partial<PlayerInput> = {}) =>
        game.setInput(id, { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, ...input });
    const steps = (n: number) => {
        for (let i = 0; i < n; i++) {
            send();
            game.step();
        }
    };
    /** Waits until the held gun may fire, fires once; [client guess, sim truth] for that shot. */
    const shoot = (): [boolean, boolean] => {
        while (wm.activeSlot.cooldown > 0) steps(1);
        const before = p.shotSeq;
        send({ shootStart: true, shootHold: true });
        game.step();
        expect(p.shotSeq).toBe(before + 1);
        const local = overWire(game.getSnapshot(id).local);
        const pumped = pumpedShot(gun("dp12"), local.cooldowns?.weapons[local.curWeapIdx] ?? 0);
        return [pumped, (wm.activeSlot.pumpShots ?? 0) === 0];
    };
    return { game, p, wm, send, steps, shoot };
}

describe("new-gun effects", () => {
    it("the DP-12 pumps after the pumped shots only; single-use guns neither cycle nor pull on their last shot", () => {
        const dp12 = gun("dp12");
        // a pumped shot leaves the 0.7 s pump to wait, the others the 0.2 s between the barrels
        expect(pumpedShot(dp12, dp12.pumpDelay! - 0.04)).toBe(true);
        expect(pumpedShot(dp12, dp12.fireDelay)).toBe(false);
        expect(pumpedShot(dp12, 0)).toBe(false);
        expect(cycleSoundAfterShot(dp12, 12, false)).toBeUndefined();
        expect(cycleSoundAfterShot(dp12, 12, true)).toBe("dp12_cycle_01");
        expect(cycleSoundAfterShot(dp12, 0, true)).toBe("dp12_pull_01");
        expect(pumpedShot(gun("m870"), 0)).toBe(true);
        expect(cycleSoundAfterShot(gun("m870"), 4, true)).toBe("m870_cycle_01");
        expect(cycleSoundAfterShot(gun("boys"), 3, true)).toBe("boys_cycle_01");
        expect(cycleSoundAfterShot(gun("boys"), 0, true)).toBeUndefined();
    });

    it("the DP-12 pump sound follows the sim through a cancelled reload, a slot swap and a fresh pickup", () => {
        const { wm, send, steps, shoot } = dp12Range();
        const shots: Array<[boolean, boolean]> = [shoot(), shoot(), shoot()];
        // R after an odd shot, cancelled by a switch: the sim keeps its count (only a finished reload resets it)
        while (wm.activeSlot.cooldown > 0) steps(1);
        send({ actions: [Input.Reload] });
        steps(2);
        expect(wm.player.action.type).toBe("reload");
        send({ actions: [Input.EquipMelee] });
        steps(2);
        send({ actions: [Input.EquipPrimary] });
        steps(2);
        shots.push(shoot(), shoot());
        // the slots swapped: the DP-12 takes its count along
        wm.swapWeaponSlots();
        shots.push(shoot(), shoot());
        // a fresh DP-12 picked up into the slot after an odd shot starts a new pair
        wm.setWeapon(wm.curWeapIdx, "dp12", gun("dp12").maxClip);
        steps(60);
        shots.push(shoot(), shoot());
        const truth = shots.map(([, sim]) => sim);
        expect(truth).toEqual([false, true, false, true, false, true, false, false, true]);
        expect(shots.map(([client]) => client)).toEqual(truth);
    });

    it("a spent single-use gun leaving its slot is a discard; a loaded one dropped is not", () => {
        const state = (type: string, ammo: number) =>
            ({
                weapons: [
                    { type, ammo },
                    { type: "", ammo: 0 },
                ],
            }) as unknown as LocalPlayerState;
        expect(discardedGuns(state("boys", 0), state("", 0)).map((d) => d.sound.discard)).toEqual(["boys_discard_01"]);
        expect(discardedGuns(state("boys", 3), state("", 0))).toEqual([]);
        expect(discardedGuns(state("m202", 0), state("", 0))).toHaveLength(1);
        expect(discardedGuns(state("ak74", 0), state("", 0))).toEqual([]);
    });

    it("launchers puff smoke; rockets blast behind and trail smoke until they stop", () => {
        const added: string[] = [];
        const particles = { add: (type: string) => added.push(type) } as unknown as ParticleSystem;
        const fx = new LauncherFx(particles);
        const pos = { x: 0, y: 0 };
        const dir = { x: 1, y: 0 };
        fx.shot(gun("ak74"), 0, pos, dir);
        expect(added).toHaveLength(0);
        fx.shot(gun("m79"), 0, pos, dir);
        const muzzle = added.length;
        expect(muzzle).toBeGreaterThan(0);
        fx.shot(gun("rpg7"), 0, pos, dir);
        expect(added.length).toBeGreaterThan(muzzle * 2);
        expect(new Set(added)).toEqual(new Set(["airdropSmoke"]));
        const rocket = {
            id: 7,
            bulletType: "bullet_rpg7",
            pos,
            dir,
            layer: 0,
            maxDist: 120,
            reflectCount: 0,
        } as unknown as BulletEvent;
        fx.addBullets([rocket, { ...rocket, id: 8, bulletType: "bullet_ak74" }]);
        expect(fx.activeRockets).toBe(1);
        const before = fx.puffs;
        fx.update(0.5);
        expect(fx.puffs - before).toBeGreaterThan(10);
        // it stopped at 20 u (a re-report): gone once past that
        fx.addBullets([{ ...rocket, endDist: 20 }]);
        fx.update(0.1);
        expect(fx.activeRockets).toBe(0);
    });
});
