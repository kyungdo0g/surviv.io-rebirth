// Free-list of Pixi sprites shared by every object view, so objects streaming in and out of view do not
// allocate (and later garbage collect) display objects.
import { Sprite, Texture } from "pixi.js";

export class SpritePool {
    private readonly free: Sprite[] = [];
    created = 0;

    acquire(): Sprite {
        let sprite = this.free.pop();
        if (!sprite) {
            sprite = new Sprite(Texture.EMPTY);
            this.created++;
        }
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(0, 0);
        sprite.pivot.set(0, 0);
        sprite.scale.set(1, 1);
        sprite.rotation = 0;
        sprite.tint = 0xffffff;
        sprite.alpha = 1;
        sprite.visible = true;
        sprite.zIndex = 0;
        return sprite;
    }

    /** Destroys the pooled sprites (textures are shared and stay alive). */
    clear(): void {
        for (const sprite of this.free.splice(0)) sprite.destroy();
    }

    release(sprite: Sprite): void {
        sprite.removeFromParent();
        sprite.texture = Texture.EMPTY;
        sprite.visible = false;
        this.free.push(sprite);
    }
}
