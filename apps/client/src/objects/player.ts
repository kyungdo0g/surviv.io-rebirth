// Player: body, hands, feet (downed), backpack, chest armour, helmet, a worn pan and the held weapon, tinted from
// the outfit and gear definitions and rotated to face `dir`. The hands are bones posed by the weapon's idle pose
// and the keyframed attack animations (anims.ts), guns kick back on every shot, and dual guns sit in both hands.
// Sprite scales, offsets and layering follow survev client/src/objects/player.ts (updateVisuals, updateRotation,
// addRecoil), in pixel units. M5: a held throwable shows its `handImg` for the current throwable state (equip, then
// cook once the pin is pulled, nothing while throwing), and heal/boost effect particles run while an item is used.
// M6: downed players crawl (crawl_forward / crawl_backward every 3 units moved, the survev server's rule played on the
// client), keep their hands under the body and bleed (a blood splat and a hit sound every second while no revive
// runs, survev player.ts "Take bleeding damage"); a reviver plays the revive animation with its weapon hidden.
// M7: class visors, faction patches and helmet tints, Flak Jacket / Cast Ironskin sprites, the frozen overlay and the
// haste particles (playerMode.ts), the Mass Medicate aura (playerAura.ts); the body scale follows PlayerView.scale (perks,
// Spud Gun hits).
// M9 (playerSteps.ts): footsteps per surface, water ripples and wading, bush enter / exit effects; every shot fired
// since the last snapshot kicks the gun back (snapshots carry the shot counter, not each shot); the left hand keeps
// its gun grip offset only while a gun is out and no revive runs (survev updateRotation).
import type { Vec2 } from "@rebirth/core";
import {
    type BackpackDef,
    type ChestDef,
    GameConfig,
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
import { MedicAura } from "./playerAura.ts";
import { PlayerEmitters } from "./playerEmitters.ts";
import { GunSprites } from "./playerGun.ts";
import { factionOf, helmetTint, PlayerModeSprites } from "./playerMode.ts";
import { PlayerSteps } from "./playerSteps.ts";
import { boxAround, type FrameContext, type ObjectRender, type ViewDeps } from "./types.ts";

/** backpack offsets behind the body per bag level 1..3 (survev player.ts) */
const BAG_OFFSETS = [10.25, 11.5, 12.75];
const PLAYER_Z_ORD = 18;
/** hands slide back by recoil x this many pixels (survev updateRotation) */
const RECOIL_PIXELS = 1.125;
/** a downed player crawls every this many units moved (survev server player.ts distSinceLastCrawl) */
const CRAWL_DIST = 3;
const BLEED_SOUND = "player_bullet_hit_02";
/** shot counters wrap at 16 bits on the wire (protocol SEQ_MASK) */
const SEQ_MOD = 0x10000;
/** at most this many kicks for one snapshot (a counter jump after a long gap is not replayed) */
const MAX_SHOTS_PER_SNAPSHOT = 4;

/** Shots fired between two snapshots' shot counters, bounded. */
export function shotsSince(prevSeq: number, seq: number): number {
    const n = (((seq - prevSeq) % SEQ_MOD) + SEQ_MOD) % SEQ_MOD;
    return Math.min(n, MAX_SHOTS_PER_SNAPSHOT);
}

type WeaponDef = GunDef | MeleeDef | ThrowableDef;
type ThrowableState = "equip" | "cook" | "throwing";

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
        else if (weapon.isMinigun) name = "minigun";
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
    /** throwable held in each hand (survev objectLSprite / objectRSprite) */
    private readonly objectLSprite: Sprite;
    private readonly objectRSprite: Sprite;
    private throwableState: ThrowableState = "equip";
    private readonly emitters: PlayerEmitters | null;
    /** footsteps, wading and bush effects (M9) */
    readonly steps: PlayerSteps;
    private firstFrame = true;
    /** event-mode sprites and effects (M7) */
    readonly mode: PlayerModeSprites;
    /** Mass Medicate circle under the player (M7) */
    readonly aura: MedicAura;
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
    /** weapon sprites hidden (downed or reviving) */
    private weaponHidden = false;
    private handsDowned = false;
    /** last snapshot position and the distance crawled since the last crawl animation */
    private lastPos: Vec2 | null = null;
    private crawlDist = 0;
    private bleedTicker = 0;
    /** bleed splats spawned (tests) */
    bleeds = 0;
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
        this.objectLSprite = sprite();
        this.objectRSprite = sprite();
        this.gunL = new GunSprites(deps.renderer.pool);
        this.gunR = new GunSprites(deps.renderer.pool);
        this.emitters = deps.particles ? new PlayerEmitters(deps.particles) : null;
        this.mode = new PlayerModeSprites(deps, sprite);
        this.aura = new MedicAura(deps.textures, sprite());
        const mode = this.mode;
        this.footL.addChild(this.footLSprite);
        this.footR.addChild(this.footRSprite);
        this.handL.addChild(this.gunL.container, this.handLSprite, this.objectLSprite);
        this.handR.addChild(this.gunR.container, this.meleeSprite, this.handRSprite, this.objectRSprite);
        this.body.addChild(
            this.footL,
            this.footR,
            this.backpackSprite,
            this.bodySprite,
            this.chestSprite,
            mode.flak,
            mode.steelskin,
            this.hipSprite,
            mode.patch,
            mode.frozen,
            this.handL,
            this.handR,
            mode.visor,
            this.helmetSprite,
        );
        this.container.addChild(this.body);
        this.steps = new PlayerSteps(deps, sprite, this.body, this.bodySprite, [
            { parent: this.handL, sprite: this.handLSprite, image: "player-hands-01.img" },
            { parent: this.handR, sprite: this.handRSprite, image: "player-hands-01.img" },
            { parent: this.footL, sprite: this.footLSprite, image: "player-feet-01.img" },
            { parent: this.footR, sprite: this.footRSprite, image: "player-feet-01.img" },
        ]);
    }

    /** name of the running animation ("none" when idle; tests) */
    get animName(): string {
        return this.anim.name;
    }

    /** sprites drawn in the hands for the held throwable (tests) */
    get throwableSprites(): { state: string; left: boolean; right: boolean } {
        return {
            state: this.throwableState,
            left: this.objectLSprite.visible,
            right: this.objectRSprite.visible,
        };
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
            this.mode.visualsKey(view),
        ].join();
        if (key !== this.visualsKey) {
            this.visualsKey = key;
            this.updateVisuals(view);
        }
        const anim = view.anim ?? { type: "none", seq: 0 };
        const action = view.action ?? { type: "none", seq: 0, item: "", duration: 0 };
        const shot = view.shot ?? { seq: 0, offHand: false };
        this.trackCrawl(view);
        if (isNew) {
            this.animSeq = anim.seq;
            this.actionSeq = action.seq;
            this.shotSeq = shot.seq;
            if (anim.type === "revive") this.startAnim(anim.type);
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
            const shots = shotsSince(this.shotSeq, shot.seq);
            this.shotSeq = shot.seq;
            // dual guns alternate hands: the latest shot was `offHand`, the one before it the other hand
            for (let i = shots - 1; i >= 0; i--) this.onShot(view, i % 2 === 0 ? shot.offHand : !shot.offHand);
        }
    }

    private startAnim(type: string): void {
        if (type === "melee") {
            const a = meleeAnim(this.weapon);
            this.anim.play(a.name, a.mirror, this.bones);
        } else if (type === "cook" || type === "throw" || type === "revive") {
            this.anim.play(type, false, this.bones);
        } else {
            this.anim.stop(this.bones);
        }
    }

    /**
     * Downed players crawl (survev server: every 3 units moved while no animation runs; forward when the movement is
     * within 1 of the facing direction on both axes, else backward; the mirror is random, survev selectAnim).
     */
    private trackCrawl(view: PlayerView): void {
        const last = this.lastPos;
        this.lastPos = { x: view.pos.x, y: view.pos.y };
        if (!view.downed || view.dead || !last) {
            this.crawlDist = 0;
            return;
        }
        const dx = view.pos.x - last.x;
        const dy = view.pos.y - last.y;
        const len = Math.hypot(dx, dy);
        this.crawlDist += len;
        if (this.anim.active || this.crawlDist <= CRAWL_DIST || len < 1e-6) return;
        const forward = Math.abs(view.dir.x - dx / len) <= 1 && Math.abs(view.dir.y - dy / len) <= 1;
        this.anim.play(forward ? "crawl_forward" : "crawl_backward", Math.random() < 0.5, this.bones);
        this.crawlDist = 0;
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
            this.helmetSprite.tint = helmetTint(helmet, factionOf(this.deps, view.id));
        }
        this.mode.updateVisuals(view, ghillie, bodyScale);

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
        if (weapon !== this.weapon && this.anim.active && this.anim.name !== "revive") this.anim.stop(this.bones);
        this.weapon = weapon;
        this.idlePose = idlePoseName(weapon, view.downed);
        this.placeHands(view.downed);
        this.weaponHidden = view.downed || this.anim.name === "revive";
        this.updateWeapon(weapon, bodyScale, this.weaponHidden);
    }

    /** Hands go under the body (below the feet) while downed (survev updateVisuals wasDowned). */
    private placeHands(downed: boolean): void {
        if (downed === this.handsDowned) return;
        this.handsDowned = downed;
        this.body.removeChild(this.handL);
        this.body.removeChild(this.handR);
        const idx = downed ? this.body.getChildIndex(this.footL) : this.body.getChildIndex(this.mode.frozen) + 1;
        this.body.addChildAt(this.handR, idx);
        this.body.addChildAt(this.handL, idx);
    }

    private updateWeapon(weapon: WeaponDef | undefined, bodyScale: number, downed: boolean): void {
        const tex = this.deps.textures;
        this.gunL.visible = false;
        this.gunR.visible = false;
        this.meleeSprite.visible = false;
        this.objectLSprite.visible = false;
        this.objectRSprite.visible = false;
        this.placeLeftHand(false);
        if (downed || !weapon) return;
        if (weapon.type === "throwable") {
            this.updateThrowableSprites();
            return;
        }
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

    /** Hand images of the held throwable for the current state (survev updateVisuals setThrowableSprite). */
    private updateThrowableSprites(): void {
        const weapon = this.weapon;
        const imgs = weapon?.type === "throwable" ? weapon.handImg?.[this.throwableState] : undefined;
        const set = (sprite: Sprite, img: { sprite: string; pos?: Vec2; scale?: number } | undefined) => {
            const visible = !!img?.sprite && img.sprite !== "none" && !this.data.downed;
            sprite.visible = visible;
            if (!visible || !img) return;
            const scale = img.scale ?? 1;
            this.deps.textures.apply(sprite, img.sprite, scale);
            sprite.position.set(img.pos?.x ?? 0, img.pos?.y ?? 0);
            sprite.scale.set(scale);
            sprite.rotation = Math.PI * 0.5;
            sprite.tint = 0xffffff;
        };
        set(this.objectLSprite, imgs?.left);
        set(this.objectRSprite, imgs?.right);
    }

    private setThrowableState(state: ThrowableState): void {
        if (state === this.throwableState) return;
        this.throwableState = state;
        if (this.weapon?.type === "throwable") this.updateThrowableSprites();
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
        this.anim.update(dt, this.bones, (effect) => {
            if (effect.kind === "throwableState") this.setThrowableState(effect.state);
            else this.deps.fx?.animEffect(view, pos, facing, effect);
        });
        // cooking and throwing only make sense with a throwable out (survev player.ts update)
        if ((this.anim.name === "cook" || this.anim.name === "throw") && this.weapon?.type !== "throwable") {
            this.anim.stop(this.bones);
        }
        if (!this.anim.active) this.setThrowableState("equip");
        // weapons are hidden while downed or reviving (survev updateVisuals)
        const hideWeapon = view.downed || this.anim.name === "revive";
        if (hideWeapon !== this.weaponHidden) {
            this.weaponHidden = hideWeapon;
            this.updateWeapon(this.weapon, view.scale || 1, hideWeapon);
        }
        this.anim.blend(IDLE_POSES[this.idlePose] ?? IDLE_POSES.fists, this.bones);
        this.placeBones();
        this.updateBleed(view, pos, dt, facing);
        this.steps.update(view, pos, dt, this.firstFrame);
        this.firstFrame = false;

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
        this.emitters?.update(view, pos, layer, zOrd + 1);
        this.mode.update(view, pos, layer, zOrd, dt);
        this.aura.update(view, local, this.deps.renderer, layer, zOrd, zIdx, ctx.localLayer, dt);
    }

    /**
     * Bleeding (survev player.ts "Take bleeding damage"): every bleedTickRate seconds while downed and not in an action
     * (a revive pauses it), a blood splat flies backwards and a muffled hit sound plays at the player.
     */
    private updateBleed(view: PlayerView, pos: Vec2, dt: number, facing: Vec2): void {
        this.bleedTicker -= dt;
        const bleeding = view.downed && !view.dead && (view.action?.type ?? "none") === "none";
        if (!bleeding || this.bleedTicker >= 0) return;
        this.bleedTicker = GameConfig.player.bleedTickRate;
        this.bleeds++;
        const ang = ((Math.random() - 0.5) * Math.PI) / 3;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const vel = { x: -(facing.x * c - facing.y * s), y: -(facing.x * s + facing.y * c) };
        this.deps.particles?.add("bloodSplat", view.layer, { x: pos.x, y: pos.y }, vel, { zOrd: PLAYER_Z_ORD + 1 });
        this.deps.audio?.playSound(BLEED_SOUND, {
            channel: "hits",
            pos,
            fallOff: 3,
            layer: view.layer,
            filter: "muffled",
        });
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
        if (weapon?.type === "gun" && !view.downed && this.anim.name !== "revive" && weapon.worldImg.leftHandOffset) {
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
        if (!visible) this.steps.suspend();
        this.container.visible = visible && !this.data.dead;
        if (!visible) this.aura.container.visible = false;
    }

    destroy(): void {
        this.emitters?.stop();
        this.mode.stop();
        this.steps.destroy();
        this.container.removeFromParent();
        for (const s of this.sprites) this.deps.renderer.pool.release(s);
        this.aura.destroy();
        this.gunL.release(this.deps.renderer.pool);
        this.gunR.release(this.deps.renderer.pool);
        this.container.destroy({ children: true });
    }
}
