// Touch controls (M8; survev client/src/input.ts touches, ui/touch.ts Touch, game.ts update touch branch;
// docs/research/ui/controls.md "Mobile and touch controls"): touches that start on the game canvas drive two virtual
// sticks, the left half of the screen the move stick and the right half the aim stick. Each stick is "anywhere"
// (centred where the finger went down) or "locked" (fixed centre, touchSticks.ts padLayout), per the settings. Range is
// 48 px x pad scale (1 landscape, 0.8 portrait), the dead zone 2 px, and the knob stays inside the range circle. The
// pads are the original's `pad.img` sprites at alpha 0.2 (circles when the sprite is missing).
// Output per frame (TouchSample): the move stick's world direction and pull (touchMoveDir, touchMoveLen 0-255, sent with
// touchMoveActive); the aim direction and toMouseLen = pull / range x throwableMaxMouseDist (18); shooting while the aim
// stick is beyond range / 1.075 (shootStart every frame: semi-automatic guns auto-fire); a throwable that started
// cooking stays held until the finger lifts, which throws it. With only the move stick held the aim turns to the
// walking direction 0.5 s after the aim stick was last touched. A tap on the minimap (or the open big map) toggles it.
import type { Vec2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { Container, Graphics, Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { config } from "../config.ts";
import manifestJson from "../generated/sprite-manifest.json";
import type { TouchSample } from "./input.ts";
import {
    isIphoneX,
    isShooting,
    movePull,
    PAD_SCALE_DOWN,
    PAD_SCALE_POS,
    type PadLayout,
    padLayout,
    readStick,
    TURN_DIR_COOLDOWN,
} from "./touchSticks.ts";

const PAD_SPRITE = "pad.img";
const PAD_ALPHA = 0.2;
/** pad.img is 208 px across */
const PAD_SIZE = 208;
/** a touch that moved less than this is a tap (minimap) */
const TAP_SLOP = 20;

interface TrackedTouch {
    id: number;
    pos: Vec2;
    posDown: Vec2;
    dead: boolean;
    /** started on the minimap / big map: a tap, not a stick */
    map: boolean;
}

interface Pad {
    ring: Container;
    knob: Container;
    touched: boolean;
}

export interface TouchControlsDeps {
    textures: TextureStore;
    /** element whose touches drive the sticks (the game canvas) */
    target: HTMLElement;
    /** screen rect of the minimap, or of the big map while it is open */
    mapRect(): { x: number; y: number; width: number; height: number } | null;
    /** the minimap or the big map was tapped */
    mapTapped(): void;
}

export interface TouchFrame {
    dt: number;
    width: number;
    height: number;
    /** the throwable slot is equipped (cooking survives dragging back into the circle) */
    holdingThrowable: boolean;
}

export class TouchControls {
    /** the pads, screen space (renderer.overlay) */
    readonly container = new Container({ label: "touch-pads" });
    private readonly deps: TouchControlsDeps;
    private readonly pads: [Pad, Pad];
    private readonly touches: TrackedTouch[] = [];
    private readonly listeners: Array<[EventTarget, string, EventListener]> = [];
    private layout: PadLayout = padLayout(1, 1, { ios: false, iphoneX: false });
    private readonly ios = /iPhone|iPod/i.test(navigator.userAgent);
    private moveDir: Vec2 = { x: 1, y: 0 };
    private moveLen = 0;
    private aimDir: Vec2 = { x: 1, y: 0 };
    /** last aim stick pull in px (kept after the finger lifts: the throw uses it) */
    private aimDist = 0;
    private shot = false;
    private turnDirTicker = 0;
    /** this frame's state (tests) */
    moveDetected = false;
    aimTouched = false;

    constructor(deps: TouchControlsDeps) {
        this.deps = deps;
        this.pads = [this.createPad(), this.createPad()];
        const on = (t: EventTarget, type: string, fn: (e: TouchEvent) => void) => {
            t.addEventListener(type, fn as EventListener, { passive: false });
            this.listeners.push([t, type, fn as EventListener]);
        };
        // starts only count on the canvas (survev input.ts onTouchShared); moves and ends anywhere
        on(deps.target, "touchstart", (e) => {
            e.preventDefault();
            this.onTouch(e, "start");
        });
        on(window, "touchmove", (e) => this.onTouch(e, "move"));
        on(window, "touchend", (e) => this.onTouch(e, "end"));
        on(window, "touchcancel", (e) => this.onTouch(e, "end"));
        on(window, "blur", () => {
            this.touches.length = 0;
        });
    }

    private createPad(): Pad {
        const make = (tint: number) => {
            let node: Container;
            if (PAD_SPRITE in manifestJson) {
                const sprite = new Sprite();
                sprite.anchor.set(0.5);
                this.deps.textures.apply(sprite, PAD_SPRITE);
                sprite.tint = tint;
                node = sprite;
            } else {
                node = new Graphics().circle(0, 0, PAD_SIZE / 2).fill(tint === 0 ? 0x000000 : 0xffffff);
            }
            node.alpha = PAD_ALPHA;
            this.container.addChild(node);
            return node;
        };
        return { ring: make(0x000000), knob: make(0xffffff), touched: false };
    }

    private onTouch(e: TouchEvent, type: "start" | "move" | "end"): void {
        for (const t of Array.from(e.changedTouches)) {
            const pos = { x: t.clientX, y: t.clientY };
            let tracked = this.touches.find((x) => x.id === t.identifier && !x.dead);
            if (type === "start" && !tracked) {
                const r = this.deps.mapRect();
                const onMap = !!r && pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height;
                tracked = { id: t.identifier, pos, posDown: { ...pos }, dead: false, map: onMap };
                this.touches.push(tracked);
            }
            if (!tracked) continue;
            tracked.pos = pos;
            if (type === "end") {
                tracked.dead = true;
                const moved = Math.hypot(pos.x - tracked.posDown.x, pos.y - tracked.posDown.y);
                if (tracked.map && moved < TAP_SLOP) this.deps.mapTapped();
            }
        }
    }

    /** live touches on one half of the screen (posDown decides, like the original) */
    private stickTouch(left: boolean, width: number): TrackedTouch | undefined {
        return this.touches.find((t) => !t.dead && !t.map && t.posDown.x < width * 0.5 === left);
    }

    /** Reads both sticks, moves the pads and returns this frame's touch input (survev getMovement / getAim). */
    update(frame: TouchFrame): TouchSample {
        const cfg = config();
        this.layout = padLayout(frame.width, frame.height, {
            ios: this.ios,
            iphoneX: isIphoneX(this.ios, screen.width, screen.height),
        });
        const { range } = this.layout;

        // move stick
        const moveTouch = this.stickTouch(true, frame.width);
        this.moveDetected = false;
        const moveCenter = moveTouch && cfg.get("touchMoveStyle") === "anywhere" ? moveTouch.posDown : this.layout.left;
        let moveKnob = this.layout.left;
        if (moveTouch) {
            const stick = readStick(moveCenter, moveTouch.pos, range);
            if (stick.dir) {
                this.moveDir = { x: stick.dir.x, y: -stick.dir.y };
                this.moveLen = movePull(stick.dist, range);
                this.moveDetected = true;
            }
            moveKnob = stick.knob;
        }
        this.placePad(this.pads[0], moveTouch ? moveCenter : this.layout.left, moveKnob, !!moveTouch);

        // aim stick
        const aimTouch = this.stickTouch(false, frame.width);
        const aimCenter = aimTouch && cfg.get("touchAimStyle") === "anywhere" ? aimTouch.posDown : this.layout.right;
        let aimKnob = this.layout.right;
        if (aimTouch) {
            const stick = readStick(aimCenter, aimTouch.pos, range);
            if (stick.dir) {
                this.aimDir = { x: stick.dir.x, y: -stick.dir.y };
                this.aimDist = stick.dist;
            } else {
                this.aimDist = 0;
            }
            aimKnob = stick.knob;
        }
        this.placePad(this.pads[1], aimTouch ? aimCenter : this.layout.right, aimKnob, !!aimTouch);
        const wasShooting = this.shot;
        this.shot = !!aimTouch && isShooting(this.aimDist, range);
        // a cooking throwable is only thrown when the finger lifts (survev touch.ts getAim)
        if (frame.holdingThrowable && wasShooting && aimTouch) this.shot = true;
        this.aimTouched = !!aimTouch;

        // turn towards the walking direction (survev game.ts turnDirTicker)
        this.turnDirTicker -= frame.dt;
        if (this.moveDetected && !aimTouch && this.turnDirTicker < 0) this.aimDir = { ...this.moveDir };
        if (aimTouch) this.turnDirTicker = TURN_DIR_COOLDOWN;

        this.flush();
        return {
            moveActive: true,
            moveDir: { ...this.moveDir },
            moveLen: this.moveDetected ? Math.round(this.moveLen * 255) : 0,
            aimDir: { ...this.aimDir },
            aimLen: Math.min(1, Math.max(0, this.aimDist / range)) * GameConfig.player.throwableMaxMouseDist,
            shoot: this.shot,
        };
    }

    /** the current aim direction, world space (the aim line) */
    get aim(): Vec2 {
        return this.aimDir;
    }

    /** stick range in px (tests) */
    get range(): number {
        return this.layout.range;
    }

    /** locked stick centres in px (tests) */
    get lockedCenters(): { left: Vec2; right: Vec2 } {
        return { left: this.layout.left, right: this.layout.right };
    }

    private placePad(pad: Pad, center: Vec2, knob: Vec2, touched: boolean): void {
        const s = this.layout.scale;
        pad.touched = touched;
        pad.ring.position.set(center.x, center.y);
        pad.ring.scale.set(s * PAD_SCALE_DOWN);
        pad.knob.position.set(knob.x, knob.y);
        pad.knob.scale.set(s * PAD_SCALE_POS);
    }

    /** Drops the touches that ended (survev input.ts flush). */
    private flush(): void {
        for (let i = this.touches.length - 1; i >= 0; i--) if (this.touches[i].dead) this.touches.splice(i, 1);
    }

    destroy(): void {
        for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
        this.listeners.length = 0;
        this.container.destroy({ children: true });
    }
}
