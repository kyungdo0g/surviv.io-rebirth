// Player: body, hands, feet (downed), backpack, chest armour, helmet, a worn pan and the held weapon, tinted from
// the outfit and gear definitions and rotated to face `dir`. The hands are bones posed by the weapon's idle pose
// and the keyframed attack animations (anims.ts), guns kick back on every shot, and dual guns sit in both hands.
// Sprite scales, offsets and layering follow survev client/src/objects/player.ts (updateVisuals, updateRotation,
// addRecoil), in pixel units.
import type { Vec2 } from "@rebirth/core";
import {
    type BackpackDef,
    type ChestDef,
    GameObjectDefs,
    type GunDef,
    type HelmetDef,
    type MeleeDef,
    type OutfitDef,
    type ThrowableDef,
} from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import { Container, type Sprite } from "pixi.js";
import type { ViewBounds } from "../render/camera.ts";
import { toLocal } from "../render/renderer.ts";
import { AnimPlayer, BONE_COUNT, Bone, IDENTITY_POSE, IDLE_POSES, type Pose } from "./anims.ts";
import { GunSprites } from "./playerGun.ts";
import { boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

/** backpack offsets behind the body per bag level 1..3 (survev player.ts) */
const BAG_OFFSETS = [10.25, 11.5, 12.75];
const PLAYER_Z_ORD = 18;
/** hands slide back by recoil x this many pixels (survev updateRotation) */
const RECOIL_PIXELS = 1.125;

type WeaponDef = GunDef | MeleeDef | ThrowableDef;

function weaponDef(id: string): WeaponDef | undefined {
    const def = id ? GameObjectDefs[id] : undefined;
    return def && (def.type === "gun" || def.type === "melee" || def.type === "throwable") ? def : undefined;
}

/** Idle pose name for the held weapon (survev player.ts selectIdlePose). */
export function idlePoseName(weapon: WeaponDef | undefined, downed: boolean): string {
    let name = "fists";
    if (downed) name = "downed";
    else if (weapon && "anim" in weapon && weapon.anim?.idlePose) name = weapon.anim.idlePose;
    else if (weapon?.type === "gun") {
        if (weapon.pistol) name = weapon.isDual ? "dualPistol" : "pistol";
        else if (weapon.isBullpup) name = "bullpup";
        else if (weapon.isLauncher) name = "launcher";
        else name = weapon.isDual ? "dualRifle" : "rifle";
    } else if (weapon?.type === "throwable") name = "throwable";
    return IDLE_POSES[name] ? name : "fists";
}

/** Attack animation for a melee swing; a lone "fists" anim is mirrored half the time (survev selectAnim). */
function meleeAnim(weapon: WeaponDef | undefined): { name: string; mirror: boolean } {
    const anims = weapon?.type === "melee" ? weapon.anim?.attackAnims : undefined;
    if (!anims?.length) return { name: "fists", mirror: Math.random() < 0.5 };
    const name = anims[Math.floor(Math.random() * anims.length)];
    return { name, mirror: name === "fists" && anims.length === 1 && Math.random() < 0.5 };
}

function newPose(): Pose {
    return { pivot: { x: 0, y: 0 }, rot: 0, pos: { x: 0, y: 0 } };
}

/** Applies a bone pose to a limb container: rotation about the body centre through the pivot. */
function applyPose(c: Container, p: Pose): void {
    c.position.set(p.pos.x, p.pos.y);
    c.pivot.set(-p.pivot.x, -p.pivot.y);
    c.rotation = p.rot;
}

export class PlayerRender implements ObjectRender<PlayerView> {
    readonly id: number;
    private readonly deps: ViewDeps;
    readonly container = new Container({ label: "player" });
    private readonly body = new Container();
    private readonly handL = new Container();
    private readonly handR = new Container();
    private readonly footL = new Container();
    private readonly footR = new Container();
    private readonly sprites: Sprite[] = [];
    private readonly bodySprite: Sprite;
    private readonly chestSprite: Sprite;
    private readonly helmetSprite: Sprite;
    private readonly backpackSprite: Sprite;
    private readonly hipSprite: Sprite;
    private readonly handLSprite: Sprite;
    private readonly handRSprite: Sprite;
    private readonly footLSprite: Sprite;
    private readonly footRSprite: Sprite;
    private readonly meleeSprite: Sprite;
    private readonly gunL: GunSprites;
    private readonly gunR: GunSprites;
    private data!: PlayerView;
    private visualsKey = "";
    private idlePose = "fists";
    private weapon: WeaponDef | undefined;
    private readonly anim = new AnimPlayer();
    private readonly bones: Pose[] = Array.from({ length: BONE_COUNT }, newPose);
    private animSeq = -1;
    private actionSeq = -1;
    private shotSeq = -1;
    /** gun kick of each hand in pixels, decaying every frame */
    recoilL = 0;
    recoilR = 0;

    constructor(deps: ViewDeps, id: number) {
        this.deps = deps;
        this.id = id;
        const sprite = () => {
            const s = deps.renderer.pool.acquire();
            this.sprites.push(s);
            return s;
        };
        this.bodySprite = sprite();
        this.chestSprite = sprite();
        this.helmetSprite = sprite();
        this.backpackSprite = sprite();
        this.hipSprite = sprite();
        this.handLSprite = sprite();
        this.handRSprite = sprite();
        this.footLSprite = sprite();
        this.footRSprite = sprite();
        this.meleeSprite = sprite();
        this.gunL = new GunSprites(deps.renderer.pool);
        this.gunR = new GunSprites(deps.renderer.pool);
        this.footL.addChild(this.footLSprite);
        this.footR.addChild(this.footRSprite);
        this.handL.addChild(this.gunL.container, this.handLSprite);
        this.handR.addChild(this.gunR.container, this.meleeSprite, this.handRSprite);
        this.body.addChild(
            this.footL,
            this.footR,
            this.backpackSprite,
            this.bodySprite,
            this.chestSprite,
            this.hipSprite,
            this.handL,
            this.handR,
            this.helmetSprite,
        );
        this.container.addChild(this.body);
    }

    /** name of the running animation ("none" when idle; tests) */
    get animName(): string {
        return this.anim.name;
    }

    setData(view: PlayerView, isNew: boolean): void {
        this.data = view;
        const key = [
            view.outfit,
            view.helmet,
            view.chest,
            view.backpack,
            view.activeWeapon,
            view.downed,
            view.scale,
            !!view.wearingPan,
        ].join();
        if (key !== this.visualsKey) {
            this.visualsKey = key;
            this.updateVisuals(view);
        }
        const anim = view.anim ?? { type: "none", seq: 0 };
        const action = view.action ?? { type: "none", seq: 0, item: "", duration: 0 };
        const shot = view.shot ?? { seq: 0, offHand: false };
        if (isNew) {
            this.animSeq = anim.seq;
            this.actionSeq = action.seq;
            this.shotSeq = shot.seq;
            return;
        }
        if (anim.seq !== this.animSeq) {
            this.animSeq = anim.seq;
            this.startAnim(anim.type);
        }
        if (action.seq !== this.actionSeq) {
            this.actionSeq = action.seq;
            this.deps.fx?.actionStart(view, view.pos, view.dir);
        }
        if (shot.seq !== this.shotSeq) {
            this.shotSeq = shot.seq;
            this.onShot(view, shot.offHand);
        }
    }

    private startAnim(type: string): void {
        if (type === "melee") {
            const a = meleeAnim(this.weapon);
            this.anim.play(a.name, a.mirror, this.bones);
        } else if (type === "cook" || type === "throw") {
            this.anim.play(type, false, this.bones);
        } else {
            this.anim.stop(this.bones);
        }
    }

    /** Hands and gun kick back (survev shot.ts: the firing hand, or both for a single gun). */
    private onShot(view: PlayerView, offHand: boolean): void {
        const gun = weaponDef(view.activeWeapon);
        if (gun?.type !== "gun") return;
        const left = offHand || !gun.isDual;
        const right = !offHand || !gun.isDual;
        if (left) this.recoilL += gun.worldImg.recoil;
        if (right) this.recoilR += gun.worldImg.recoil;
        // casings start from the networked position, like the original (shot.ts uses m_netData.m_pos)
        this.deps.fx?.shot(view, view.pos, view.dir);
    }

    private updateVisuals(view: PlayerView): void {
        const tex = this.deps.textures;
        const colors = this.deps.mapDef.biome.colors;
        const outfit = (GameObjectDefs[view.outfit] ?? GameObjectDefs.outfitBase) as OutfitDef;
        const skin = outfit.skinImg;
        const ghillie = !!outfit.ghillie;
        const bodyScale = view.scale || 1;

        tex.apply(this.bodySprite, skin.baseSprite, 0.25 * bodyScale);
        this.bodySprite.tint = ghillie ? colors.playerGhillie : skin.baseTint;
        this.bodySprite.scale.set(0.25);

        const handTint = ghillie ? colors.playerGhillie : skin.handTint;
        for (const hand of [this.handLSprite, this.handRSprite]) {
            tex.apply(hand, skin.handSprite, 0.175 * bodyScale);
            hand.scale.set(0.175);
            hand.tint = handTint;
        }
        const footTint = ghillie ? colors.playerGhillie : skin.footTint;
        for (const foot of [this.footLSprite, this.footRSprite]) {
            tex.apply(foot, skin.footSprite, 0.45 * bodyScale);
            foot.scale.set(0.45);
            foot.rotation = Math.PI * 0.5;
            foot.tint = footTint;
        }
        this.footL.visible = view.downed;
        this.footR.visible = view.downed;

        const chest = view.chest && !ghillie ? (GameObjectDefs[view.chest] as ChestDef | undefined) : undefined;
        this.chestSprite.visible = !!chest;
        if (chest) {
            tex.apply(this.chestSprite, chest.skinImg.baseSprite, 0.25 * bodyScale);
            this.chestSprite.scale.set(0.25);
            this.chestSprite.tint = chest.skinImg.baseTint;
        }

        const helmet = view.helmet && !ghillie ? (GameObjectDefs[view.helmet] as HelmetDef | undefined) : undefined;
        this.helmetSprite.visible = !!helmet;
        if (helmet) {
            const scale = helmet.skinImg.spriteScale ?? 0.15;
            tex.apply(this.helmetSprite, helmet.skinImg.baseSprite, scale * bodyScale);
            this.helmetSprite.position.set((view.downed ? 1 : -1) * 3.33, 0);
            this.helmetSprite.scale.set(scale);
            this.helmetSprite.tint = helmet.skinImg.baseTint;
        }

        const bag = view.backpack ? (GameObjectDefs[view.backpack] as BackpackDef | undefined) : undefined;
        const bagLevel = bag?.level ?? 0;
        this.backpackSprite.visible = bagLevel > 0 && !ghillie && !view.downed;
        if (this.backpackSprite.visible) {
            const scale = (0.4 + bagLevel * 0.03) * 0.5;
            tex.apply(this.backpackSprite, skin.backpackSprite, scale * bodyScale);
            this.backpackSprite.position.set(-BAG_OFFSETS[Math.min(bagLevel, BAG_OFFSETS.length) - 1], 0);
            this.backpackSprite.scale.set(scale);
            this.backpackSprite.tint = skin.backpackTint;
        }

        // a pan in the melee slot hangs on the hip while another weapon is out
        const hip = view.wearingPan ? (GameObjectDefs.pan as MeleeDef).hipImg : undefined;
        this.hipSprite.visible = !!hip;
        if (hip) {
            tex.apply(this.hipSprite, hip.sprite, Math.max(hip.scale.x, hip.scale.y));
            this.hipSprite.position.set(hip.pos.x, hip.pos.y);
            this.hipSprite.scale.set(hip.scale.x, hip.scale.y);
            this.hipSprite.rotation = hip.rot;
            this.hipSprite.tint = hip.tint;
        }

        const weapon = weaponDef(view.activeWeapon);
        if (weapon !== this.weapon && this.anim.active) this.anim.stop(this.bones);
        this.weapon = weapon;
        this.idlePose = idlePoseName(weapon, view.downed);
        this.updateWeapon(weapon, bodyScale, view.downed);
    }

    private updateWeapon(weapon: WeaponDef | undefined, bodyScale: number, downed: boolean): void {
        const tex = this.deps.textures;
        this.gunL.visible = false;
        this.gunR.visible = false;
        this.meleeSprite.visible = false;
        this.placeLeftHand(false);
        if (downed || !weapon) return;
        if (weapon.type === "gun") {
            this.gunR.setType(weapon, bodyScale, tex);
            this.gunR.visible = true;
            if (weapon.isDual) {
                this.gunL.setType(weapon, bodyScale, tex);
                this.gunL.visible = true;
            }
            const handsBelow = !!weapon.worldImg.handsBelow;
            // the gun is under the right hand unless the hands go below it; the left hand holds it from above
            // unless the magazine sits on top (survev updateVisuals)
            this.handR.setChildIndex(this.gunR.container, handsBelow ? this.handR.children.length - 1 : 0);
            this.placeLeftHand(!handsBelow && !this.gunR.magTop);
        } else if (weapon.type === "melee" && weapon.worldImg && weapon.baseType !== "fists") {
            const img = weapon.worldImg;
            tex.apply(this.meleeSprite, img.sprite, Math.max(img.scale.x, img.scale.y));
            this.meleeSprite.scale.set(img.scale.x / bodyScale, img.scale.y / bodyScale);
            this.meleeSprite.tint = img.tint;
            this.meleeSprite.visible = true;
            const handIdx = this.handR.getChildIndex(this.handRSprite);
            const meleeIdx = this.handR.getChildIndex(this.meleeSprite);
            const below = meleeIdx < handIdx;
            if (!!img.renderOnHand === below) this.handR.swapChildren(this.meleeSprite, this.handRSprite);
            this.placeLeftHand(!!img.leftHandOntop);
        }
    }

    /** Puts the left hand directly below (default) or above the right hand. */
    private placeLeftHand(above: boolean): void {
        this.body.removeChild(this.handL);
        const r = this.body.getChildIndex(this.handR);
        this.body.addChildAt(this.handL, above ? r + 1 : r);
    }

    update(ctx: FrameContext, pos: Vec2, dir?: Vec2): void {
        const view = this.data;
        const local = toLocal(pos);
        this.container.position.set(local.x, local.y);
        this.container.visible = !view.dead;
        const facing = dir ?? view.dir;
        this.body.rotation = -Math.atan2(facing.y, facing.x);
        this.body.scale.set(view.scale || 1);

        // survev player.ts: recoil decays proportionally plus a constant 1/s
        const dt = ctx.dt;
        this.recoilL = Math.max(0, this.recoilL - this.recoilL * dt * 5 - dt);
        this.recoilR = Math.max(0, this.recoilR - this.recoilR * dt * 5 - dt);
        this.anim.update(dt, this.bones, (effect) => this.deps.fx?.animEffect(view, pos, facing, effect));
        this.anim.blend(IDLE_POSES[this.idlePose] ?? IDLE_POSES.fists, this.bones);
        this.placeBones();

        // survev player.ts updateRenderLayer: players on stairs draw over the stairs when on the viewer's level
        let layer = view.layer;
        let zOrd = PLAYER_Z_ORD;
        if (layer & 2 && (layer & 1) === (ctx.localLayer & 1)) zOrd += 100;
        if (layer & 2) layer |= 2;
        const zIdx =
            view.id +
            (view.downed ? 0 : 262144) +
            (view.id === ctx.localId ? 65536 : 0) +
            (view.scale > 1 ? 131072 : 0);
        this.deps.renderer.add(this.container, layer, zOrd, zIdx);
    }

    /** Poses the limbs and the melee weapon from the blended bones (survev updateRotation). */
    private placeBones(): void {
        const view = this.data;
        applyPose(this.handL, this.bones[Bone.HandL]);
        applyPose(this.handR, this.bones[Bone.HandR]);
        applyPose(this.footL, this.bones[Bone.FootL]);
        applyPose(this.footR, this.bones[Bone.FootR]);
        const weapon = this.weapon;
        if (weapon?.type === "melee" && weapon.worldImg) {
            const bone = this.bones[Bone.MeleeR] ?? IDENTITY_POSE;
            const img = weapon.worldImg;
            this.meleeSprite.pivot.set(-(bone.pos.x + img.pos.x), -(bone.pos.y + img.pos.y));
            this.meleeSprite.rotation = img.rot + bone.rot;
            this.meleeSprite.position.set(-bone.pivot.x, -bone.pivot.y);
        }
        if (weapon?.type === "gun" && !view.downed && weapon.worldImg.leftHandOffset) {
            this.handL.position.x += weapon.worldImg.leftHandOffset.x;
            this.handL.position.y += weapon.worldImg.leftHandOffset.y;
        }
        this.handL.position.x -= this.recoilL * RECOIL_PIXELS;
        this.handR.position.x -= this.recoilR * RECOIL_PIXELS;
    }

    bounds(pos: Vec2): ViewBounds {
        return boxAround(pos, 4 * (this.data.scale || 1));
    }

    setVisible(visible: boolean): void {
        this.container.visible = visible && !this.data.dead;
    }

    destroy(): void {
        this.container.removeFromParent();
        for (const s of this.sprites) this.deps.renderer.pool.release(s);
        this.gunL.release(this.deps.renderer.pool);
        this.gunR.release(this.deps.renderer.pool);
        this.container.destroy({ children: true });
    }
}
