// Touch mode (M8; docs/research/ui/controls.md "Mobile and touch controls"): on for phones and tablets like the
// original (survev device.ts: Android / iOS user agents, iPads reporting a desktop Mac), and for any primary coarse
// pointer; `?touch=1` forces it on (desktop testing) and `?touch=0` off. Decided once per page.

let touch: boolean | null = null;

/** Touch mode from the route and the device. */
export function detectTouch(search: string, coarsePointer: boolean, userAgent: string, maxTouchPoints = 0): boolean {
    const forced = new URLSearchParams(search).get("touch");
    if (forced === "1") return true;
    if (forced === "0") return false;
    if (coarsePointer) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(userAgent)) return true;
    // iPadOS reports a desktop Mac user agent
    return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Whether this page plays with the touch controls. */
export function isTouchMode(): boolean {
    if (touch === null) {
        let coarse = false;
        try {
            coarse = window.matchMedia("(pointer: coarse)").matches;
        } catch {
            coarse = false;
        }
        touch = detectTouch(location.search, coarse, navigator.userAgent, navigator.maxTouchPoints ?? 0);
    }
    return touch;
}
