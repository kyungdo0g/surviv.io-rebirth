// The hand-held grenade launchers' spent cases (GunDef.handHeld, owner 2026-10-08: held like a rifle). The M79 is a
// break action and the GL-06 a single shot: the case comes out when the breech is opened to reload, not on the shot;
// the MGL's revolver cylinder gives one case per chamber reloaded (maxReload 1), six for a full reload. The case
// starts at the breech of the rifle-pose sprite on the aim line (survev shot.ts createCasingParticle:
// pos + dir * (player radius + particle.shellOffset); survev player.ts playActionStartEffect: caseTiming "reload"
// throws maxReload cases back to the sides) and is a big brass case (fx/particleDefs.ts "40mm").
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, type GunDef, HELD_GUN_ART } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { AudioEngine } from "../src/audio/audio.ts";
import type { BulletSystem } from "../src/fx/bullets.ts";
import { GameEffects } from "../src/fx/effects.ts";
import { ALL_PARTICLE_DEFS } from "../src/fx/particleDefsAll.ts";
import type { ParticleSystem } from "../src/fx/particles.ts";
import manifest from "../src/generated/sprite-manifest.json";
import { Bone, IDLE_POSES } from "../src/objects/anims.ts";
import { heldGunImage } from "../src/objects/heldGun.ts";
import { PIXELS_PER_UNIT } from "../src/render/camera.ts";

const LAUNCHERS = ["m79", "gl06", "mgl"] as const;
const gun = (id: string) => GameObjectDefs[id] as GunDef;

/**
 * Rows (sprite px from the top of apps/client/public/rebirth/guns/gun-<id>-01.svg) between which the breech is drawn:
 * the M79's tube end over its receiver, the GL-06's likewise, the MGL's cylinder.
 */
const BREECH_ROWS: Record<(typeof LAUNCHERS)[number], [number, number]> = {
    m79: [70, 80],
    gl06: [72, 82],
    mgl: [56, 90],
};
/** the gun's offset from the right hand (objects/playerGun.ts HAND_OFFSET, survev player.ts Gun) */
const HAND_OFFSET_X = -4.25;
/** an own held sprite's pixels per body pixel at worldImg.scale 0.5 (objects/playerGun.ts setType) */
const BODY_PX_PER_SPRITE_PX = 0.25;

/** Distance from the body centre along the aim (world units) of a sprite row of a rifle-pose gun. */
function rowReach(id: (typeof LAUNCHERS)[number], row: number): number {
    const img = heldGunImage(gun(id));
    const butt = (IDLE_POSES.rifle[Bone.HandR]?.pivot.x ?? 0) + HAND_OFFSET_X + (img.gunOffset?.x ?? 0);
    const height = HELD_GUN_ART[id][1];
    return (butt + (height - row) * BODY_PX_PER_SPRITE_PX) / PIXELS_PER_UNIT;
}

interface Added {
    type: string;
    pos: Vec2;
    vel: Vec2;
}

function effects(): { fx: GameEffects; added: Added[] } {
    const added: Added[] = [];
    const particles = {
        add: (type: string, _layer: number, pos: Vec2, vel: Vec2) => {
            added.push({ type, pos: { ...pos }, vel: { ...vel } });
        },
    } as unknown as ParticleSystem;
    const audio = { playSound: () => null, stop: () => {} } as unknown as AudioEngine;
    return { fx: new GameEffects(audio, particles, {} as BulletSystem), added };
}

function player(id: string, action: "reload" | "none"): PlayerView {
    return {
        id: 7,
        layer: 0,
        activeWeapon: id,
        action: { type: action, item: action === "none" ? "" : id, seq: 1, duration: 1 },
    } as unknown as PlayerView;
}

describe("hand-held launcher casings", () => {
    it("eject on reload, at the breech of the rifle pose, with no side or forward shift", () => {
        for (const id of LAUNCHERS) {
            const def = gun(id);
            expect(def.handHeld, id).toBe(true);
            expect(def.caseTiming, id).toBe("reload");
            const p = def.particle;
            expect([p.shellScale, p.shellOffsetY, p.shellForward, p.shellReverse, p.casing], id).toEqual([
                1,
                undefined,
                undefined,
                undefined,
                undefined,
            ]);
            const reach = GameConfig.player.radius + p.shellOffset;
            const [top, bottom] = BREECH_ROWS[id];
            expect(reach, id).toBeGreaterThanOrEqual(rowReach(id, bottom));
            expect(reach, id).toBeLessThanOrEqual(rowReach(id, top));
            // in front of the right hand, well behind the muzzle
            expect(reach, id).toBeGreaterThan((IDLE_POSES.rifle[Bone.HandR]?.pivot.x ?? 0) / PIXELS_PER_UNIT);
            expect(reach, id).toBeLessThan(rowReach(id, 0) - 0.5);
        }
    });

    it("the reload drops the case from the breech on the aim line, thrown back beside the player", () => {
        const pos = { x: 10, y: 20 };
        const dir = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
        for (const id of LAUNCHERS) {
            const def = gun(id);
            const { fx, added } = effects();
            fx.actionStart(player(id, "reload"), pos, dir);
            const cases = added.filter((a) => a.type === def.ammo);
            expect(cases.length, id).toBe(def.maxReload);
            const reach = GameConfig.player.radius + def.particle.shellOffset;
            for (const c of cases) {
                const rel = { x: c.pos.x - pos.x, y: c.pos.y - pos.y };
                expect(rel.x * dir.x + rel.y * dir.y, id).toBeCloseTo(reach, 6);
                expect(Math.abs(rel.x * -dir.y + rel.y * dir.x), id).toBeLessThan(1e-6);
                expect(c.vel.x * dir.x + c.vel.y * dir.y, id).toBeLessThan(0);
            }
        }
    });

    it("no case on the shot (the M79 was the potato cannon's shoot timing at the player's right side)", () => {
        for (const id of LAUNCHERS) {
            const { fx, added } = effects();
            fx.shot(player(id, "none"), { x: 0, y: 0 }, { x: 1, y: 0 });
            expect(
                added.filter((a) => a.type === "40mm"),
                id,
            ).toEqual([]);
        }
    });

    it("the MGL gives one case per chamber: six reload actions for an empty cylinder", () => {
        const mgl = gun("mgl");
        expect([mgl.maxClip, mgl.maxReload]).toEqual([6, 1]);
        const { fx, added } = effects();
        for (let n = 0; n < mgl.maxClip; n++) fx.actionStart(player("mgl", "reload"), { x: 0, y: 0 }, { x: 0, y: 1 });
        expect(added.filter((a) => a.type === "40mm")).toHaveLength(6);
    });

    it("the 40 mm case is a big straight brass case that drops near the gun", () => {
        const def = ALL_PARTICLE_DEFS["40mm"];
        expect(def?.image).toEqual(["part-shell-01.img"]);
        expect((manifest as Record<string, unknown>)["part-shell-01.img"]).toBeDefined();
        const start = (d: typeof def) => (typeof d?.scaleStart === "number" ? d.scaleStart : 0);
        const width = (img: string) => (manifest as Record<string, { size?: number[] }>)[img]?.size?.[0] ?? 0;
        // bigger than the pistol case it reuses, as wide as the shotgun shell (part-shell-03); heavier than both
        expect(start(def)).toBeGreaterThan(start(ALL_PARTICLE_DEFS["50AE"]) * 1.5);
        expect(ALL_PARTICLE_DEFS["12gauge"]?.image).toEqual(["part-shell-03.img"]);
        expect(width("part-shell-01.img") * start(def)).toBeGreaterThanOrEqual(
            width("part-shell-03.img") * start(ALL_PARTICLE_DEFS["12gauge"]),
        );
        const minDrag = (d: typeof def) => (typeof d?.drag === "number" ? d.drag : (d?.drag[0] ?? 0));
        expect(minDrag(def)).toBeGreaterThan(minDrag(ALL_PARTICLE_DEFS["50AE"]));
    });
});
