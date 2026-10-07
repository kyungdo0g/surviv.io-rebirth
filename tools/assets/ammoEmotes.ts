// Ping emote icons of the beta's new ammo (40mm, rocket, 5.7x28; defs NEW_AMMO_EMOTES, texture ammo-<id>.img), drawn
// like the original ammo emotes (ammo-9mm.img ... ammo-45acp.img, survev img/emotes/ammo-*.svg): three nested rounded
// squares in the ammo's colour, a near-black frame, a mid square and a bright inner one. The colour is the ammo's loot
// tint (teal, brown, pink); the shades are the originals' (12 gauge: #330000 / #b30000 / #f20000 = 0.21 / 0.74 / 1).
import type { RgbaImage } from "./png.ts";

/** Frame of an original ammo emote. */
export const AMMO_EMOTE_SIZE = 128;

interface Square {
    x: number;
    y: number;
    w: number;
    h: number;
    /** corner radius */
    r: number;
    /** share of the tint */
    shade: number;
}

/** The original ammo emotes' squares (survev img/emotes/ammo-9mm.svg), back to front. */
const SQUARES: readonly Square[] = [
    { x: 8, y: 8, w: 112, h: 112, r: 2.655, shade: 0.21 },
    { x: 24.398, y: 24.399, w: 79.202, h: 79.202, r: 2.177, shade: 0.74 },
    { x: 48.763, y: 36, w: 41.487, h: 37.715, r: 2.592, shade: 1 },
];

/** Sub-samples per pixel side (smooth edges). */
const SUPERSAMPLE = 4;

function inside(s: Square, px: number, py: number): boolean {
    if (px < s.x || px > s.x + s.w || py < s.y || py > s.y + s.h) return false;
    const dx = Math.max(s.x + s.r - px, 0, px - (s.x + s.w - s.r));
    const dy = Math.max(s.y + s.r - py, 0, py - (s.y + s.h - s.r));
    return dx * dx + dy * dy <= s.r * s.r;
}

/** The emote icon of an ammo whose loot tint is `tint` (0xRRGGBB), 128 x 128 with a transparent outside. */
export function ammoEmoteIcon(tint: number): RgbaImage {
    const size = AMMO_EMOTE_SIZE;
    const data = new Uint8Array(size * size * 4);
    const rgb = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
    const n = SUPERSAMPLE * SUPERSAMPLE;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const sum = [0, 0, 0];
            let covered = 0;
            for (let sy = 0; sy < SUPERSAMPLE; sy++) {
                for (let sx = 0; sx < SUPERSAMPLE; sx++) {
                    const px = x + (sx + 0.5) / SUPERSAMPLE;
                    const py = y + (sy + 0.5) / SUPERSAMPLE;
                    let top: Square | undefined;
                    for (const s of SQUARES) if (inside(s, px, py)) top = s;
                    if (!top) continue;
                    covered++;
                    for (let c = 0; c < 3; c++) sum[c] += rgb[c] * top.shade;
                }
            }
            if (covered === 0) continue;
            const i = (y * size + x) * 4;
            for (let c = 0; c < 3; c++) data[i + c] = Math.round(sum[c] / covered);
            data[i + 3] = Math.round((covered / n) * 255);
        }
    }
    return { width: size, height: size, data };
}
