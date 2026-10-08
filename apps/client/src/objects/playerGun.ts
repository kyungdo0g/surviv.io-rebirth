// A gun held in one hand: barrel sprite from GunDef.worldImg (anchored at its butt, pointing forward) plus the
// optional magazine sprite drawn under or over it, offset from the hand like the original client
// (survev client/src/objects/player.ts class Gun: hand offset (-4.25, -1.75), dual guns (-5.95, 0), + gunOffset).
// The rebirth's beta new guns without top-down art hold a plain bar sized by their barrel length (heldGun.ts).
import type { GunDef } from "@rebirth/defs";
import { Container, type Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { SpritePool } from "../render/pool.ts";
import { heldGunImage } from "./heldGun.ts";

const HAND_OFFSET = { x: -4.25, y: -1.75 };
const DUAL_HAND_OFFSET = { x: -5.95, y: 0 };
const MAG_SCALE = 0.25;

export class GunSprites {
    readonly container = new Container({ label: "gun" });
    private readonly barrel: Sprite;
    private readonly mag: Sprite;
    /** the magazine is drawn over the barrel and the left hand goes under the gun */
    magTop = false;

    constructor(pool: SpritePool) {
        this.barrel = pool.acquire();
        this.mag = pool.acquire();
        this.container.addChild(this.barrel, this.mag);
        // sprites are drawn barrel-up; a quarter turn points them along the player's facing (+x)
        this.container.rotation = Math.PI * 0.5;
        this.container.visible = false;
    }

    set visible(v: boolean) {
        this.container.visible = v;
    }

    /**
     * Shows `def`'s world image (its empty variant when `empty`, heldGun.ts); `bodyScale` undoes the body container's
     * scale so guns keep their size.
     */
    setType(def: GunDef, bodyScale: number, textures: TextureStore, empty = false): void {
        const img = heldGunImage(def, empty);
        const sx = (img.scale.x * 0.5) / bodyScale;
        const sy = (img.scale.y * 0.5) / bodyScale;
        textures.apply(this.barrel, img.sprite, Math.max(sx, sy));
        this.barrel.anchor.set(0.5, 1);
        this.barrel.position.set(0, 0);
        this.barrel.scale.set(sx, sy);
        this.barrel.tint = img.tint;
        this.barrel.visible = true;

        const magImg = img.magImg;
        this.magTop = !!magImg?.top;
        if (magImg) {
            textures.apply(this.mag, magImg.sprite, MAG_SCALE);
            this.mag.anchor.set(0.5, 0.5);
            this.mag.position.set(magImg.pos.x / bodyScale, magImg.pos.y / bodyScale);
            this.mag.scale.set(MAG_SCALE / bodyScale);
            this.mag.tint = 0xffffff;
            this.mag.visible = true;
            this.container.setChildIndex(this.mag, magImg.top ? 1 : 0);
        } else {
            this.mag.visible = false;
        }
        const base = def.isDual ? DUAL_HAND_OFFSET : HAND_OFFSET;
        this.container.position.set(base.x + (img.gunOffset?.x ?? 0), base.y + (img.gunOffset?.y ?? 0));
    }

    release(pool: SpritePool): void {
        pool.release(this.barrel);
        pool.release(this.mag);
    }
}
