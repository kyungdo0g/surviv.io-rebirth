// Right-click drops from the HUD (survev client/src/ui/ui2.ts addItemAction "drop" and game.ts DropItemMsg;
// docs/research/ui/controls.md "HUD mouse actions", hud.md "Weapon slots", "Inventory, gear and perks"): pressing and
// releasing the right mouse button on a weapon slot, a bag item, a scope (not 1x), a worn helmet or vest, or a droppable
// perk sends a DropItem message. What drops is the server's rule (a gun to the ground, half a bag stack, small ammo
// stacks whole, one scope). The press never reaches the game input, so it opens no emote wheel.
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";

/** What a right click drops: an item type and, for weapons, the slot (the DropItem message fields). */
export interface DropRequest {
    item: string;
    weapIdx: number;
}

/** survev ui2.ts isRmb */
const RIGHT_BUTTON = 2;

/**
 * Makes `div` drop what `request()` names (null: nothing to drop) on a right click: the right button goes down and up
 * on it (leaving the element cancels, like the original's clearQueuedItemActions).
 */
export function bindDrop(div: HTMLElement, request: () => DropRequest | null, drop: (r: DropRequest) => void): void {
    div.setAttribute(HUD_INTERACTIVE_ATTR, "");
    let queued = false;
    div.addEventListener("mousedown", (ev) => {
        if (ev.button !== RIGHT_BUTTON) return;
        ev.stopPropagation();
        queued = true;
    });
    div.addEventListener("mouseup", (ev) => {
        if (ev.button !== RIGHT_BUTTON || !queued) return;
        ev.stopPropagation();
        queued = false;
        const r = request();
        if (r?.item) drop(r);
    });
    div.addEventListener("mouseleave", () => {
        queued = false;
    });
}
