// M9 test hooks on window.__rebirth (read by tests/e2e/m9-hit.spec.ts): flares, bullet and melee hit effects, the kill
// frame's hit sound and the dead bodies drawn; the visual-diff fixes (tests/e2e/m9-visual.spec.ts): the map texture
// and its place-name size, and the teammate name font sizes.
import type { DeadBodyView } from "@rebirth/sim";
import { debugGlobals } from "../globals.ts";
import { DeadBodyRender } from "../objects/deadBody.ts";
import type { GameClient } from "./client.ts";

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
}
