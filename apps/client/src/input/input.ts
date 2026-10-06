// Keyboard and mouse state -> one PlayerInput per frame. Aim is converted to world space through the camera:
// toMouseDir is the unit vector from the player to the cursor (+y up) and toMouseLen the distance in world units.
// M8: actions come from the live bind table (keybinds.ts `binds()`, rebindable); keys are tracked by canonical code
// (left / right modifiers are one key, like the original's keyCodes). On touch devices the frame's touch sticks
// (touch.ts) replace the aim and add the analog movement (touchMoveActive / touchMoveDir / touchMoveLen) and the stick
// shooting (survev game.ts update: touch branch).
import type { Vec2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import type { PlayerInput } from "@rebirth/sim";
import type { Camera } from "../render/camera.ts";
import { canonicalCode } from "./bindCodec.ts";
import { ARROW_MOVES, type BindCode, binds, SENT_ACTIONS } from "./keybinds.ts";

/** HUD elements that take clicks (weapon slots, scopes, items) carry this attribute; presses on them do not fire */
export const HUD_INTERACTIVE_ATTR = "data-hud-click";

function onHud(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(`[${HUD_INTERACTIVE_ATTR}]`) !== null;
}

/** keys whose browser default (scrolling, find, focus change) would disturb the game */
const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "F3"]);

/** The touch sticks of one frame (touch.ts), in world space. */
export interface TouchSample {
    /** the player walks with the move stick (survev sends touchMoveActive on every touch input) */
    moveActive: boolean;
    /** unit vector of the move stick (+y up) */
    moveDir: Vec2;
    /** pull of the move stick, 0-255 */
    moveLen: number;
    /** unit aim vector (+y up) */
    aimDir: Vec2;
    /** toMouseLen: aim stick pull / range x throwableMaxMouseDist (survev game.ts) */
    aimLen: number;
    /** the aim stick is pulled past its shooting threshold: shootStart and shootHold every frame */
    shoot: boolean;
}

export class InputManager {
    private readonly down = new Set<BindCode>();
    private readonly pressed = new Set<BindCode>();
    private readonly released = new Set<BindCode>();
    /** cursor in screen pixels; starts at the screen center */
    mouse: Vec2 = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    /** aim at this screen point instead of the cursor (the aim freezes while an emote wheel is open, M6) */
    aimOverride: Vec2 | null = null;
    /** the window lost focus since the last `endFrame()` (every held key and button was released) */
    lostFocus = false;
    /** the input built by the last `sample()` (tests) */
    last: PlayerInput | null = null;
    private seq = 0;
    /** one-shot actions queued by the HUD (slot and scope clicks), sent with the next input */
    private readonly queued: number[] = [];
    /** bag item to use with the next input (HUD item clicks; the original InputMsg.useItem) */
    private useItem = "";
    private readonly listeners: Array<[EventTarget, string, EventListener]> = [];

    constructor(target: Window = window) {
        const on = <E extends Event>(t: EventTarget, type: string, fn: (e: E) => void) => {
            t.addEventListener(type, fn as EventListener, { passive: false });
            this.listeners.push([t, type, fn as EventListener]);
        };
        on<KeyboardEvent>(target, "keydown", (e) => {
            if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
            if (e.repeat || isTyping(e.target)) return;
            this.press(canonicalCode(e.code));
        });
        on<KeyboardEvent>(target, "keyup", (e) => this.release(canonicalCode(e.code)));
        on<MouseEvent>(target, "mousemove", (e) => {
            this.mouse = { x: e.clientX, y: e.clientY };
        });
        on<MouseEvent>(target, "mousedown", (e) => {
            this.mouse = { x: e.clientX, y: e.clientY };
            if (!onHud(e.target)) this.press(`Mouse${e.button}`);
        });
        on<MouseEvent>(target, "mouseup", (e) => {
            this.release(`Mouse${e.button}`);
            // most mice put "back" / "forward" on the thumb buttons (survev input.ts onMouseUp)
            if (e.button === 3 || e.button === 4) e.preventDefault();
        });
        on<WheelEvent>(target, "wheel", (e) => {
            if (e.deltaY !== 0 && !onHud(e.target)) this.pressed.add(e.deltaY > 0 ? "WheelDown" : "WheelUp");
        });
        on<MouseEvent>(target, "contextmenu", (e) => e.preventDefault());
        on(target, "blur", () => {
            for (const code of this.down) this.released.add(code);
            this.down.clear();
            this.lostFocus = true;
        });
    }

    /** Sends `action` (a defs `Input` value) with the next sampled input. */
    queueAction(action: number): void {
        this.queued.push(action);
    }

    /** Uses a bag item (heal, boost, scope, throwable) with the next sampled input. */
    queueUseItem(item: string): void {
        this.useItem = item;
    }

    private press(code: BindCode): void {
        this.down.add(code);
        this.pressed.add(code);
    }

    private release(code: BindCode): void {
        if (this.down.delete(code)) this.released.add(code);
    }

    isDown(codes: readonly BindCode[]): boolean {
        return codes.some((c) => this.down.has(c));
    }

    /** true if `code` went down since the last `endFrame()` */
    wasPressed(code: BindCode): boolean {
        return this.pressed.has(code);
    }

    /** true if `code` went up since the last `endFrame()` */
    wasReleased(code: BindCode): boolean {
        return this.released.has(code);
    }

    /** The bind of `action` (defs `Input`) went down this frame. */
    wasBindPressed(action: number): boolean {
        const code = binds().get(action);
        return !!code && this.pressed.has(code);
    }

    /** The bind of `action` went up this frame (wheel binds count as released the frame they turn). */
    wasBindReleased(action: number): boolean {
        const code = binds().get(action);
        return !!code && (this.released.has(code) || (code.startsWith("Wheel") && this.pressed.has(code)));
    }

    isBindDown(action: number): boolean {
        const code = binds().get(action);
        return !!code && (this.down.has(code) || (code.startsWith("Wheel") && this.pressed.has(code)));
    }

    /** A hard-coded key (arrows, G, N) that only works while no action is bound to it went down. */
    wasFreeKeyPressed(code: BindCode): boolean {
        return this.pressed.has(code) && !binds().isBound(code);
    }

    private moving(action: keyof typeof ARROW_MOVES): boolean {
        const arrow = ARROW_MOVES[action];
        return this.isBindDown(action) || (this.down.has(arrow) && !binds().isBound(arrow));
    }

    /**
     * Builds this frame's input; `playerPos` is where the local player is drawn (world space). `touch` (touch devices)
     * replaces the mouse aim and adds the move stick and stick shooting.
     */
    sample(camera: Camera, playerPos: Vec2, touch: TouchSample | null = null): PlayerInput {
        let toMouseDir: Vec2;
        let toMouseLen: number;
        if (touch) {
            toMouseDir = touch.aimDir;
            toMouseLen = touch.aimLen;
        } else {
            const mouseWorld = camera.screenToWorld(this.aimOverride ?? this.mouse);
            const dx = mouseWorld.x - playerPos.x;
            const dy = mouseWorld.y - playerPos.y;
            toMouseLen = Math.hypot(dx, dy);
            toMouseDir = toMouseLen > 1e-5 ? { x: dx / toMouseLen, y: dy / toMouseLen } : { x: 1, y: 0 };
        }
        const actions: number[] = this.queued.splice(0);
        const useItem = this.useItem;
        this.useItem = "";
        for (const action of SENT_ACTIONS) if (this.wasBindPressed(action)) actions.push(action);
        // Interact does not trigger Revive, Use or Loot when those have their own binds (survev game.ts)
        if (this.wasBindPressed(Input.Interact)) {
            const table = binds();
            const unbound = [Input.Revive, Input.Use, Input.Loot].filter((a) => !table.get(a));
            if (unbound.length === 3) actions.push(Input.Interact);
            else actions.push(...unbound);
        }
        const input: PlayerInput = {
            seq: ++this.seq,
            moveLeft: this.moving(Input.MoveLeft),
            moveRight: this.moving(Input.MoveRight),
            moveUp: this.moving(Input.MoveUp),
            moveDown: this.moving(Input.MoveDown),
            toMouseDir,
            toMouseLen,
            shootStart: this.wasBindPressed(Input.Fire) || !!touch?.shoot,
            shootHold: this.isBindDown(Input.Fire) || !!touch?.shoot,
            actions,
            ...(useItem ? { useItem } : {}),
            ...(touch
                ? { touchMoveActive: touch.moveActive, touchMoveDir: touch.moveDir, touchMoveLen: touch.moveLen }
                : {}),
        };
        this.last = input;
        return input;
    }

    /** Clears the one-frame "pressed" state; call once per frame after sampling. */
    endFrame(): void {
        this.pressed.clear();
        this.released.clear();
        this.lostFocus = false;
    }

    destroy(): void {
        for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
        this.listeners.length = 0;
    }
}

/** Keys typed into a text field (report text, keybind code) never reach the game. */
function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
}
