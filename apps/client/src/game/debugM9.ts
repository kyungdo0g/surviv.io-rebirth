// M9 test hooks on window.__rebirth (read by tests/e2e/m9-hit.spec.ts): flares, bullet and melee hit effects, the kill
// frame's hit sound and the dead bodies drawn; the visual-diff fixes (tests/e2e/m9-visual.spec.ts): the map texture
// and its place-name size, and the teammate name font sizes; where doors, their casings and building floors and
// ceilings sit in the scene (tests/e2e/m9-doors.spec.ts).
import type { DeadBodyView } from "@rebirth/sim";
import type { Container } from "pixi.js";
import { debugGlobals } from "../globals.ts";
import { BuildingRender } from "../objects/building.ts";
import { DeadBodyRender } from "../objects/deadBody.ts";
import { ObstacleRender } from "../objects/obstacle.ts";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import type { GameClient } from "./client.ts";

/** A display object's place in the scene: drawn after everything with a smaller (stage, zIndex). */
interface DrawnPart {
    part: "panel" | "casing" | "floor" | "ceiling";
    /** render layer (0 ground, 1 underground, 2/3 stairs and tall objects), -1 when not in one */
    layer: number;
    /** index of that layer among the world root's children (later = drawn on top) */
    stage: number;
    zIndex: number;
    alpha: number;
    visible: boolean;
    /** position in world units */
    pos: { x: number; y: number };
    /** drawn size in world units, unrotated */
    size: { w: number; h: number };
}

export function exposeM9(client: GameClient): void {
    const globals = debugGlobals();
    const bullets = client.bullets;
    globals.hits = {
        /** flares drawn now, spawned since boot, and the newest one's scale */
        get flares() {
            return { count: bullets.flares.count, spawned: bullets.flares.spawned, scale: bullets.flares.newestScale };
        },
        /** blood splats on players, pan chips, flesh-hit sounds and tracers moved to the stairs layer since boot */
        get bullets() {
            return { ...bullets.hits };
        },
        get killSounds() {
            return client.effects.killHitSounds;
        },
        /** live particles drawn inside a player's view (blood splats that follow it) */
        on(id: number): number {
            const container = client.world?.playerContainer(id);
            return container ? client.particles.spritesIn(container).length : 0;
        },
        /** screen positions of a player's view and of the particles inside it, null when it is not in view */
        splats(id: number): { player: { x: number; y: number }; splats: Array<{ x: number; y: number }> } | null {
            const container = client.world?.playerContainer(id);
            if (!container) return null;
            const at = (c: { getGlobalPosition(): { x: number; y: number } }) => {
                const p = c.getGlobalPosition();
                return { x: p.x, y: p.y };
            };
            return { player: at(container), splats: client.particles.spritesIn(container).map(at) };
        },
    };
    globals.visual = {
        /** pixel size of the minimap / big map texture and the place names' font size in it */
        get mapTextureSize() {
            return client.minimap?.textureSize ?? 0;
        },
        get mapLabelPx() {
            return client.minimap?.placeLabelPx ?? 0;
        },
        /** font sizes of the teammate names drawn */
        get nameFontSizes() {
            return client.teamPlay.names.fontSizes;
        },
    };
    /** dead bodies in view with what they draw */
    globals.deadBodies = () => {
        const out: Array<{
            id: number;
            playerId: number;
            pos: { x: number; y: number };
            name: string;
            skull: boolean;
        }> = [];
        client.world?.forEachView("deadBody", (view: DeadBodyView) => {
            const render = client.world?.renderOf(view.id);
            const shown = render instanceof DeadBodyRender ? render.shown : { name: "", skull: false };
            out.push({ id: view.id, playerId: view.playerId, pos: { ...view.pos }, ...shown });
        });
        return out;
    };
    /** an obstacle's panel and casing or a building's floors and ceilings as placed in the scene, null out of view */
    globals.drawOrder = (id: number): DrawnPart[] | null => {
        const render = client.world?.renderOf(id);
        const renderer = client.renderer;
        const at = (sprite: Container, part: DrawnPart["part"]): DrawnPart => {
            const parent = sprite.parent as Container | null;
            return {
                part,
                layer: parent ? renderer.layers.indexOf(parent) : -1,
                stage: parent ? renderer.world.children.indexOf(parent) : -1,
                zIndex: sprite.zIndex,
                alpha: sprite.alpha,
                visible: sprite.visible,
                pos: { x: sprite.position.x / PIXELS_PER_UNIT, y: -sprite.position.y / PIXELS_PER_UNIT },
                size: { w: Math.abs(sprite.width) / PIXELS_PER_UNIT, h: Math.abs(sprite.height) / PIXELS_PER_UNIT },
            };
        };
        if (render instanceof ObstacleRender) {
            const { sprite, casing } = render.drawn;
            return casing ? [at(sprite, "panel"), at(casing, "casing")] : [at(sprite, "panel")];
        }
        if (render instanceof BuildingRender) {
            return render.drawnImgs.map((img) => at(img.sprite, img.isCeiling ? "ceiling" : "floor"));
        }
        return null;
    };
}
