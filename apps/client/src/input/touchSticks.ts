// Virtual stick geometry of the touch controls (M8; survev client/src/ui/touch.ts, docs/research/ui/controls.md
// "Mobile and touch controls"), kept free of the DOM so it can be tested: pad scale and range, the locked stick centres
// and reading one stick from a touch.
import type { Vec2 } from "@rebirth/core";

/** px the stick must be pulled before it counts (survev touch.ts deadZone) */
export const DEAD_ZONE = 2;
/** stick range at pad scale 1 (survev padPosBase) */
export const PAD_POS_BASE = 48;
/** the aim stick shoots beyond range / 1.075 (survev shotPadDetectMult) */
export const SHOT_PAD_DETECT_MULT = 1.075;
/** the move stick reaches full pull at range / 1 (survev movePadDetectMult) */
export const MOVE_PAD_DETECT_MULT = 1;
/** with only the move stick held, the aim turns to the walking direction after this many seconds (survev) */
export const TURN_DIR_COOLDOWN = 0.5;
/** pad sprite scales: the ring and the knob (survev padScaleDown / padScalePos) */
export const PAD_SCALE_DOWN = 0.6;
export const PAD_SCALE_POS = 0.25;

/** locked stick offsets from the screen side and bottom (survev lockedPadOffsetLandscape / Portrait) */
const LOCKED_LANDSCAPE = { x: 126, y: 100 };
const LOCKED_PORTRAIT = { x: 96, y: 160 };
/** iOS Safari raises the locked sticks (survev lockedPadOffsetY*Safari) */
const SAFARI_Y_LANDSCAPE = 120;
const SAFARI_Y_PORTRAIT = 240;
/** iPhone X (notch): 56 px further in, 0.9 x the height, landscape only (survev touch.ts resize) */
const IPHONEX_X = 56;
const IPHONEX_Y_MULT = 0.9;

export interface PadLayout {
    /** 1 landscape, 0.8 portrait (survev padScaleBase) */
    scale: number;
    /** stick range in px: 48 x scale (survev padPosRange) */
    range: number;
    left: Vec2;
    right: Vec2;
}

export interface DeviceInfo {
    /** iPhone / iPod (survev device.os == "ios") */
    ios: boolean;
    /** iPhone X class screen (survev device.model == "iphonex") */
    iphoneX: boolean;
}

/** Pad scale, range and locked centres for a screen (survev touch.ts resize). */
export function padLayout(width: number, height: number, device: DeviceInfo): PadLayout {
    const landscape = width > height;
    const scale = landscape ? 1 : 0.8;
    const off = landscape ? { ...LOCKED_LANDSCAPE } : { ...LOCKED_PORTRAIT };
    let leftX = off.x;
    let rightX = width - off.x;
    let y = off.y;
    if (device.ios) {
        if (device.iphoneX) {
            if (landscape) {
                leftX += IPHONEX_X;
                rightX -= IPHONEX_X;
                y *= IPHONEX_Y_MULT;
            }
        } else {
            y = landscape ? SAFARI_Y_LANDSCAPE : SAFARI_Y_PORTRAIT;
        }
    }
    return {
        scale,
        range: PAD_POS_BASE * scale,
        left: { x: leftX, y: height - y },
        right: { x: rightX, y: height - y },
    };
}

/** iPhone X class screens of survev device.ts detectiPhoneX. */
export function isIphoneX(ios: boolean, screenWidth: number, screenHeight: number): boolean {
    const dims = [screenWidth, screenHeight].sort((a, b) => a - b).join("x");
    return ios && (dims === "375x812" || dims === "414x896");
}

export interface StickReading {
    /** unit vector from the centre to the touch, screen space (+y down); null inside the dead zone */
    dir: Vec2 | null;
    /** distance from the centre to the touch (px, not clamped) */
    dist: number;
    /** where the knob is drawn: the touch, clamped to the range circle (survev getConstrainedPos) */
    knob: Vec2;
}

/** Reads a stick centred on `center` touched at `pos`. */
export function readStick(center: Vec2, pos: Vec2, range: number): StickReading {
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    const dist = Math.hypot(dx, dy);
    const dir = dist > DEAD_ZONE ? { x: dx / dist, y: dy / dist } : null;
    const knob =
        dist <= range
            ? { x: pos.x, y: pos.y }
            : { x: center.x + (dx / dist) * range, y: center.y + (dy / dist) * range };
    return { dir, dist, knob };
}

/** Move stick pull, 0-1 at full range (survev getMovement: (dist - deadZone) / (range / mult - deadZone)). */
export function movePull(dist: number, range: number): number {
    const len = (dist - DEAD_ZONE) / (range / MOVE_PAD_DETECT_MULT - DEAD_ZONE);
    return Math.min(1, Math.max(0, len));
}

/** The aim stick is pulled far enough to shoot (survev getAim). */
export function isShooting(aimDist: number, range: number): boolean {
    return aimDist > range / SHOT_PAD_DETECT_MULT;
}
