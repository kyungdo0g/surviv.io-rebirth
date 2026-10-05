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
