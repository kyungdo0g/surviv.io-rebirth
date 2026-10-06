// Touch aim line (M8; survev client/src/ui/touch.ts LineSprites, docs/research/ui/controls.md "Aim line"): while the
// aim stick is touched and the Aim Line setting is on, dots (`dot.img`, 0.3 alpha) run from 3.5 units in front of the
// player every 1.5 units up to the held gun's barrel length + bullet range (30 for anything else), cut at the camera
// radius and at the first obstacle that would stop a bullet (or, for throwables, one taller than a projectile flies).
import { collider, math, type Vec2, v2 } from "@rebirth/core";
import {
    type BulletDef,
    GameConfig,
    GameObjectDefs,
    type GunDef,
    MapObjectDefs,
    type ObstacleDef,
} from "@rebirth/defs";
import { sameLayer } from "@rebirth/sim";
import { Container, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { ObjectWorld } from "../objects/world.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";

const START_OFFSET = 3.5;
const INCREMENT = 1.5;
const DEFAULT_RANGE = 30;
/** dot.img is 36 px; the original draws it at 1/32 x 0.375 world units per px, 16 px per unit here */
const DOT_SCALE = (1 / 32) * 0.375 * 16;
const ALPHA = 0.3;
/** just over the players (survev renderer zOrd 19) */
const Z_ORD = 19;

/** Max length of the aim line for the held weapon (survev LineSprites.update). */
export function aimLineRange(weapon: string): number {
    const def = GameObjectDefs[weapon];
    if (def?.type !== "gun") return DEFAULT_RANGE;
    const gun = def as GunDef;
    const bullet = GameObjectDefs[gun.bulletType] as BulletDef | undefined;
    return gun.barrelLength + (bullet?.distance ?? 0);
}

export interface AimLineFrame {
    visible: boolean;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    weapon: string;
    /** the scope's zoom radius (survev clamps the line to sqrt(zoom * 1.414 * zoom), 1.414 ~ sqrt 2) */
    zoom: number;
}

export class AimLine {
    private readonly container = new Container({ label: "aim-line" });
    private readonly dots: Sprite[] = [];
    private readonly renderer: Renderer;
    private readonly textures: TextureStore;
    /** dots shown this frame (tests) */
    shown = 0;

    constructor(renderer: Renderer, textures: TextureStore) {
        this.renderer = renderer;
        this.textures = textures;
        this.container.alpha = ALPHA;
        this.container.visible = false;
    }

    update(frame: AimLineFrame, world: ObjectWorld | null): void {
        this.container.visible = frame.visible;
        this.shown = 0;
        if (!frame.visible) return;
        const def = GameObjectDefs[frame.weapon];
        let range = Math.min(aimLineRange(frame.weapon), Math.sqrt(frame.zoom * Math.SQRT2 * frame.zoom));
        const start = frame.pos;
        const end = v2.add(start, v2.mul(frame.dir, range));
        world?.forEachView("obstacle", (o) => {
            if (o.dead || !sameLayer(o.layer, frame.layer)) return;
            const od = MapObjectDefs[o.type] as ObstacleDef | undefined;
            if (!od?.collidable || od.isWindow || od.height < GameConfig.bullet.height) return;
            if (def?.type === "throwable" && od.height <= GameConfig.projectile.maxHeight) return;
            const col = collider.transform(od.collision, o.pos, math.oriToRad(o.ori), o.scale);
            const hit = collider.intersectSegment(col, start, end);
            if (hit) range = Math.min(range, v2.distance(hit.point, start));
        });
        const count = Math.max(Math.ceil((range - START_OFFSET) / INCREMENT), 0);
        while (this.dots.length < count) {
            const dot = new Sprite();
            dot.anchor.set(0.5);
            dot.scale.set(DOT_SCALE);
            this.textures.apply(dot, "dot.img");
            this.container.addChild(dot);
            this.dots.push(dot);
        }
        this.dots.forEach((dot, i) => {
            const p = toLocal(v2.add(start, v2.mul(frame.dir, START_OFFSET + i * INCREMENT)));
            dot.position.set(p.x, p.y);
            dot.visible = i < count;
        });
        this.shown = count;
        this.renderer.add(this.container, frame.layer, Z_ORD, 0);
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }
}
