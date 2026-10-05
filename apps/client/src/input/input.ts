// Keyboard and mouse state -> one PlayerInput per frame. Aim is converted to world space through the camera:
// toMouseDir is the unit vector from the player to the cursor (+y up) and toMouseLen the distance in world units.
import type { Vec2 } from "@rebirth/core";
import type { PlayerInput } from "@rebirth/sim";
import type { Camera } from "../render/camera.ts";
import { ActionBinds, type BindCode, FireBind, MovementBinds } from "./keybinds.ts";

/** HUD elements that take clicks (weapon slots, scopes, items) carry this attribute; presses on them do not fire */
export const HUD_INTERACTIVE_ATTR = "data-hud-click";

function onHud(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(`[${HUD_INTERACTIVE_ATTR}]`) !== null;
}

/** keys whose browser default (scrolling, find, focus change) would disturb the game */
const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "F3"]);

export class InputManager {
    private readonly down = new Set<BindCode>();
    private readonly pressed = new Set<BindCode>();
    /** cursor in screen pixels; starts at the screen center */
    mouse: Vec2 = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
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
            if (e.repeat) return;
            this.press(e.code);
        });
        on<KeyboardEvent>(target, "keyup", (e) => this.down.delete(e.code));
        on<MouseEvent>(target, "mousemove", (e) => {
            this.mouse = { x: e.clientX, y: e.clientY };
        });
        on<MouseEvent>(target, "mousedown", (e) => {
            this.mouse = { x: e.clientX, y: e.clientY };
            if (!onHud(e.target)) this.press(`Mouse${e.button}`);
        });
        on<MouseEvent>(target, "mouseup", (e) => this.down.delete(`Mouse${e.button}`));
        on<WheelEvent>(target, "wheel", (e) => {
            if (e.deltaY !== 0 && !onHud(e.target)) this.pressed.add(e.deltaY > 0 ? "WheelDown" : "WheelUp");
        });
        on<MouseEvent>(target, "contextmenu", (e) => e.preventDefault());
        on(target, "blur", () => this.down.clear());
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

    isDown(codes: readonly BindCode[]): boolean {
        return codes.some((c) => this.down.has(c));
    }

    /** true if `code` went down since the last `endFrame()` */
    wasPressed(code: BindCode): boolean {
        return this.pressed.has(code);
    }

    /** Builds this frame's input; `playerPos` is where the local player is drawn (world space). */
    sample(camera: Camera, playerPos: Vec2): PlayerInput {
        const mouseWorld = camera.screenToWorld(this.mouse);
        const dx = mouseWorld.x - playerPos.x;
        const dy = mouseWorld.y - playerPos.y;
        const len = Math.hypot(dx, dy);
        const actions: number[] = this.queued.splice(0);
        const useItem = this.useItem;
        this.useItem = "";
        for (const bind of ActionBinds) {
            if (bind.codes.some((c) => this.pressed.has(c))) actions.push(bind.action);
        }
        return {
            seq: ++this.seq,
            moveLeft: this.isDown(MovementBinds.moveLeft),
            moveRight: this.isDown(MovementBinds.moveRight),
            moveUp: this.isDown(MovementBinds.moveUp),
            moveDown: this.isDown(MovementBinds.moveDown),
            toMouseDir: len > 1e-5 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 },
            toMouseLen: len,
            shootStart: FireBind.some((c) => this.pressed.has(c)),
            shootHold: this.isDown(FireBind),
            actions,
            ...(useItem ? { useItem } : {}),
        };
    }

    /** Clears the one-frame "pressed" state; call once per frame after sampling. */
    endFrame(): void {
        this.pressed.clear();
    }

    destroy(): void {
        for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
        this.listeners.length = 0;
    }
}
