// Right-click drops from the HUD (survev client/src/ui/ui2.ts addItemAction "drop" and game.ts DropItemMsg;
// docs/research/ui/controls.md "HUD mouse actions", hud.md "Weapon slots", "Inventory, gear and perks"): pressing and
// releasing the right mouse button on a weapon slot, a bag item, a scope (not 1x), a worn helmet or vest, or a droppable
// perk sends a DropItem message. What drops is the server's rule (a gun to the ground, half a bag stack, small ammo
// stacks whole, one scope). The press never reaches the game input, so it opens no emote wheel.
// M8 touch: touching and holding the element for 0.75 s drops it instead (survev ui2.ts touchHoldDuration; controls.md
// "Touch HUD actions"); a shorter tap stays a click (use / equip).
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";

/** What a right click drops: an item type and, for weapons, the slot (the DropItem message fields). */
export interface DropRequest {
    item: string;
    weapIdx: number;
}

/** survev ui2.ts isRmb */
const RIGHT_BUTTON = 2;
/** touch-and-hold time that drops an item (survev ui2.ts touchHoldDuration) */
export const TOUCH_HOLD_DROP_MS = 750;
/** a finger that wanders this far (px) is not holding the item */
const HOLD_SLOP = 16;

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
    bindHoldDrop(div, request, drop);
}

/** Touch-and-hold drop: a hold of TOUCH_HOLD_DROP_MS drops, and the tap's click that would follow is suppressed. */
function bindHoldDrop(div: HTMLElement, request: () => DropRequest | null, drop: (r: DropRequest) => void): void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let fired = false;
    let start = { x: 0, y: 0 };
    const cancel = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };
    div.addEventListener(
        "touchstart",
        (ev) => {
            const touch = ev.changedTouches[0];
            if (!touch) return;
            ev.stopPropagation();
            cancel();
            fired = false;
            start = { x: touch.clientX, y: touch.clientY };
            timer = setTimeout(() => {
                timer = null;
                fired = true;
                const r = request();
                if (r?.item) drop(r);
            }, TOUCH_HOLD_DROP_MS);
        },
        { passive: true },
    );
    div.addEventListener(
        "touchmove",
        (ev) => {
            const touch = ev.changedTouches[0];
            if (touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > HOLD_SLOP) cancel();
        },
        { passive: true },
    );
    div.addEventListener("touchend", (ev) => {
        cancel();
        // the hold dropped the item: no click (use) for this touch
        if (fired && ev.cancelable) ev.preventDefault();
        fired = false;
    });
    div.addEventListener("touchcancel", () => {
        cancel();
        fired = false;
    });
}
