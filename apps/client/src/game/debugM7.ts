// M7 test hooks on window.__rebirth (read by tests/e2e/m7*.spec.ts): perk slots, the role badge, faction counters and
// minimap members, the Cobalt class menu, the big map, per-player frozen / haste effects and tracer variants.
import { debugGlobals } from "../globals.ts";
import type { PlayerRender } from "../objects/player.ts";
import type { GameClient } from "./client.ts";

export function exposeM7(client: GameClient): void {
    const globals = debugGlobals();
    const modes = client.modes;
    globals.perks = {
        /** perk types shown in the HUD slots, left to right */
        get slots() {
            return client.ui.modes.perkTypes;
        },
    };
    globals.roleMenu = {
        get active() {
            return modes.roleMenu.active;
        },
        /** open and on screen (the in-game menu hides it, M8) */
        get shown() {
            return modes.roleMenu.shown;
        },
        get displayed() {
            return modes.roleMenu.displayed;
        },
        get confirmed() {
            return modes.roleMenu.confirmed;
        },
        get timeLeft() {
            return modes.roleMenu.timeLeft;
        },
    };
    globals.bigMap = {
        get open() {
            return modes.bigMap;
        },
        /** screen rectangle of the (big) map */
        get rect() {
            return client.minimap?.rect ?? null;
        },
    };
    globals.faction = {
        /** [Red, Blue] alive counts last received */
        get alive() {
            return client.match.teamAliveCounts;
        },
        get members() {
            return modes.factionStatus.length;
        },
        get minimapDots() {
            return client.minimap?.faction.count ?? 0;
        },
        get minimapRoleIcons() {
            return client.minimap?.faction.roleIcons ?? [];
        },
    };
    /** event-mode effects of a player's view: frozen overlay shown, haste emitter running, Mass Medicate aura */
    globals.playerFx = (id: number) => {
        const render = client.world?.renderOf(id) as PlayerRender | undefined;
        if (!render || !("mode" in render)) return null;
        return { frozen: render.mode.frozenShown, haste: render.mode.hasteActive, aura: render.aura.shown };
    };
    globals.tracerVariants = () => ({ ...client.bullets.variants });
}
