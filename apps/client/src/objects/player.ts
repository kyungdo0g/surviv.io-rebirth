// Player: body, hands, feet (downed), backpack, chest armor, helmet and the held weapon, tinted from the outfit
// and gear definitions and rotated to face `dir`. Sprite scales, offsets and idle hand poses follow survev
// client/src/objects/player.ts (updateVisuals) and client/src/animData.ts (IdlePoses), in pixel units.
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
import { boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

type Pose = { l: Vec2; r: Vec2 };
const p = (x: number, y: number): Vec2 => ({ x, y });
/** idle hand positions per pose (survev animData.ts IdlePoses) */
const IDLE_POSES: Record<string, Pose> = {
    fists: { l: p(14, -12.25), r: p(14, 12.25) },
    slash: { l: p(18, -8.25), r: p(6, 20.25) },
    meleeTwoHanded: { l: p(10.5, -14.25), r: p(18, 6.25) },
    meleeKatana: { l: p(8.5, 13.25), r: p(-3, 17.75) },
    meleeNaginata: { l: p(19, -7.25), r: p(8.5, 24.25) },
    machete: { l: p(14, -12.25), r: p(1, 17.75) },
    cutlass: { l: p(14, -12.25), r: p(6, 16) },
    rifle: { l: p(28, 5.25), r: p(14, 1.75) },
    dualRifle: { l: p(5.75, -16), r: p(5.75, 16) },
    bullpup: { l: p(28, 5.25), r: p(24, 1.75) },
    minigun: { l: p(18, 7.25), r: p(54, 0) },
    launcher: { l: p(20, 10), r: p(2, 22) },
    pistol: { l: p(14, 1.75), r: p(14, 1.75) },
    dualPistol: { l: p(15.75, -8.75), r: p(15.75, 8.75) },
    throwable: { l: p(15.75, -9.625), r: p(15.75, 9.625) },
    downed: { l: p(14, -12.25), r: p(14, 12.25) },
};
const DOWNED_FEET = { l: p(-15.75, -9), r: p(-15.75, 9) };
/** backpack offsets behind the body per bag level 1..3 (survev player.ts) */
const BAG_OFFSETS = [10.25, 11.5, 12.75];
const PLAYER_Z_ORD = 18;

type WeaponDef = GunDef | MeleeDef | ThrowableDef;

function idlePose(weapon: WeaponDef | undefined, downed: boolean): Pose {
    if (downed) return IDLE_POSES.downed;
    if (!weapon) return IDLE_POSES.fists;
    if ("anim" in weapon && weapon.anim?.idlePose) return IDLE_POSES[weapon.anim.idlePose] ?? IDLE_POSES.fists;
    if (weapon.type === "gun") {
        if (weapon.pistol) return weapon.isDual ? IDLE_POSES.dualPistol : IDLE_POSES.pistol;
        if (weapon.isBullpup) return IDLE_POSES.bullpup;
        if (weapon.isLauncher) return IDLE_POSES.launcher;
        return weapon.isDual ? IDLE_POSES.dualRifle : IDLE_POSES.rifle;
    }
    return weapon.type === "throwable" ? IDLE_POSES.throwable : IDLE_POSES.fists;
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
    private readonly gun = new Container();
    private readonly sprites: Sprite[] = [];
    private readonly bodySprite: Sprite;
    private readonly chestSprite: Sprite;
    private readonly helmetSprite: Sprite;
    private readonly backpackSprite: Sprite;
    private readonly handLSprite: Sprite;
    private readonly handRSprite: Sprite;
    private readonly footLSprite: Sprite;
    private readonly footRSprite: Sprite;
    private readonly gunSprite: Sprite;
    private readonly meleeSprite: Sprite;
    private data!: PlayerView;
    private visualsKey = "";
    private pose: Pose = IDLE_POSES.fists;

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
        this.handLSprite = sprite();
        this.handRSprite = sprite();
        this.footLSprite = sprite();
        this.footRSprite = sprite();
        this.gunSprite = sprite();
        this.meleeSprite = sprite();
        this.footL.addChild(this.footLSprite);
        this.footR.addChild(this.footRSprite);
        this.handL.addChild(this.handLSprite);
        this.gun.addChild(this.gunSprite);
        this.gun.rotation = Math.PI * 0.5;
        this.handR.addChild(this.gun, this.meleeSprite, this.handRSprite);
        this.body.addChild(
            this.footL,
            this.footR,
            this.backpackSprite,
            this.bodySprite,
            this.chestSprite,
            this.handL,
            this.handR,
            this.helmetSprite,
        );
        this.container.addChild(this.body);
    }

    setData(view: PlayerView, _isNew: boolean): void {
        this.data = view;
        const key = [
            view.outfit,
            view.helmet,
            view.chest,
            view.backpack,
            view.activeWeapon,
            view.downed,
            view.scale,
        ].join();
        if (key !== this.visualsKey) {
            this.visualsKey = key;
            this.updateVisuals(view);
        }
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

        const weapon = view.activeWeapon ? (GameObjectDefs[view.activeWeapon] as WeaponDef | undefined) : undefined;
        this.pose = idlePose(weapon, view.downed);
        this.updateWeapon(weapon, bodyScale, view.downed);
    }

    private updateWeapon(weapon: WeaponDef | undefined, bodyScale: number, downed: boolean): void {
        const tex = this.deps.textures;
        this.gun.visible = false;
        this.meleeSprite.visible = false;
        this.placeLeftHand(false);
        if (downed || !weapon) return;
        if (weapon.type === "gun") {
            const img = weapon.worldImg;
            tex.apply(this.gunSprite, img.sprite, img.scale.y * 0.5);
            this.gunSprite.anchor.set(0.5, 1);
            this.gunSprite.scale.set((img.scale.x * 0.5) / bodyScale, (img.scale.y * 0.5) / bodyScale);
            this.gunSprite.tint = img.tint;
            const offset = weapon.isDual ? p(-5.95, 0) : p(-4.25, -1.75);
            this.gun.position.set(offset.x + (img.gunOffset?.x ?? 0), offset.y + (img.gunOffset?.y ?? 0));
            this.gun.visible = true;
            // the gun is under the right hand unless the hands go below it; the left hand holds it from above
            this.handR.setChildIndex(this.gun, img.handsBelow ? this.handR.children.length - 1 : 0);
            this.placeLeftHand(!img.handsBelow && !img.magImg?.top);
        } else if (weapon.type === "melee" && weapon.worldImg && weapon.baseType !== "fists") {
            const img = weapon.worldImg;
            tex.apply(this.meleeSprite, img.sprite, Math.max(img.scale.x, img.scale.y));
            this.meleeSprite.pivot.set(-img.pos.x, -img.pos.y);
            this.meleeSprite.rotation = img.rot;
            this.meleeSprite.scale.set(img.scale.x / bodyScale, img.scale.y / bodyScale);
            this.meleeSprite.tint = img.tint;
            this.meleeSprite.visible = true;
            const handIdx = this.handR.getChildIndex(this.handRSprite);
            this.handR.setChildIndex(this.meleeSprite, img.renderOnHand ? handIdx : Math.max(handIdx - 1, 0));
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
        this.handL.position.set(this.pose.l.x, this.pose.l.y);
        this.handR.position.set(this.pose.r.x, this.pose.r.y);
        const weapon = GameObjectDefs[view.activeWeapon] as WeaponDef | undefined;
        if (weapon?.type === "gun" && weapon.worldImg.leftHandOffset && !view.downed) {
            this.handL.position.x += weapon.worldImg.leftHandOffset.x;
            this.handL.position.y += weapon.worldImg.leftHandOffset.y;
        }
        this.footL.position.set(DOWNED_FEET.l.x, DOWNED_FEET.l.y);
        this.footR.position.set(DOWNED_FEET.r.x, DOWNED_FEET.r.y);

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

    bounds(pos: Vec2): ViewBounds {
        return boxAround(pos, 4 * (this.data.scale || 1));
    }

    setVisible(visible: boolean): void {
        this.container.visible = visible && !this.data.dead;
    }

    destroy(): void {
        this.container.removeFromParent();
        for (const s of this.sprites) {
            s.pivot.set(0, 0);
            this.deps.renderer.pool.release(s);
        }
        this.container.destroy({ children: true });
    }
}
