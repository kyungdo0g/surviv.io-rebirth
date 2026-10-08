// Debug/test surface exposed on `window.__rebirth` (read by the Playwright specs).

export interface RebirthDebug {
    /** sprite ids that had no file or failed to load (rendered as placeholders) */
    missingSprites?: string[];
    [key: string]: unknown;
}

declare global {
    interface Window {
        __rebirth: RebirthDebug;
    }
}

export function debugGlobals(): RebirthDebug {
    if (!window.__rebirth) window.__rebirth = {};
    return window.__rebirth;
}

/**
 * Test hook: with `window.__rebirth.hideRoofs = true` every building's ceiling stays open, so a showcase screenshot
 * shows the whole floor plan of a complex (tests/e2e/survev-building-parity.spec.ts).
 */
export function roofsHidden(): boolean {
    return typeof window !== "undefined" && window.__rebirth?.hideRoofs === true;
}

/** Test hook: `window.__rebirth.cameraAt = { x, y }` centres the camera there instead of on the followed player. */
export function debugCameraAt(): { x: number; y: number } | undefined {
    if (typeof window === "undefined") return undefined;
    const at = window.__rebirth?.cameraAt as { x: number; y: number } | undefined;
    return at && Number.isFinite(at.x) && Number.isFinite(at.y) ? at : undefined;
}
