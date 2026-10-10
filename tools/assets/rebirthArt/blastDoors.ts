// Art of the explosion-gated doors (packages/defs rebirth/buildings/blastDoors.ts): top-down slabs seen from above, at
// the sprite sizes BLAST_DOOR_ART gives (64 px per world unit). Rebirth art, no original or survev file is used.
import { BLAST_DOOR_ART } from "../../../packages/defs/src/rebirth/buildings.ts";

const sizeOf = (sprite: string): readonly [number, number] => {
    const art = BLAST_DOOR_ART.find((a) => a.floor === sprite);
    if (!art) throw new Error(`blast door art: no ${sprite}`);
    return art.size;
};

const svg = (w: number, h: number, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;

/** blast_door_01: a dark steel slab with a hazard-striped band at both ends and two rows of rivets. */
export function blastDoorSvg(): string {
    const [w, h] = sizeOf("map-blast-door-01.img");
    const band = 40;
    const out: string[] = [
        `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" fill="#5b6168" stroke="#22262a" stroke-width="4"/>`,
        `<rect x="12" y="${band + 8}" width="${w - 24}" height="${h - 2 * band - 16}" rx="3" fill="#6c737b" stroke="#3a3f45" stroke-width="3"/>`,
        `<defs><pattern id="hz" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
            `<rect width="12" height="24" fill="#e2b11c"/><rect x="12" width="12" height="24" fill="#1d1d1d"/></pattern></defs>`,
        `<rect x="6" y="6" width="${w - 12}" height="${band}" fill="url(#hz)" stroke="#22262a" stroke-width="2"/>`,
        `<rect x="6" y="${h - 6 - band}" width="${w - 12}" height="${band}" fill="url(#hz)" stroke="#22262a" stroke-width="2"/>`,
    ];
    for (let y = band + 24; y <= h - band - 24; y += 28) {
        for (const x of [22, w - 22]) {
            out.push(`<circle cx="${x}" cy="${y}" r="5" fill="#9aa1a8" stroke="#2c3035" stroke-width="2"/>`);
        }
    }
    // the locking bar across the middle
    out.push(
        `<rect x="18" y="${h / 2 - 7}" width="${w - 36}" height="14" rx="4" fill="#3f454b" stroke="#1c1f22" stroke-width="2"/>`,
    );
    return svg(w, h, out.join(""));
}

/** subway_gate_01: a rusty corrugated shutter, ribbed across its length, with rust stains, between two guide rails. */
export function subwayGateSvg(): string {
    const [w, h] = sizeOf("map-subway-gate-01.img");
    const out: string[] = [
        `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="4" fill="#8a5a3b" stroke="#3b2417" stroke-width="4"/>`,
    ];
    for (let y = 12; y < h - 8; y += 12) {
        out.push(`<rect x="6" y="${y}" width="${w - 12}" height="5" fill="#6e4329"/>`);
        out.push(`<rect x="6" y="${y + 5}" width="${w - 12}" height="2" fill="#a8734f"/>`);
    }
    for (const [cx, cy, r] of [
        [20, 60, 10],
        [44, 150, 13],
        [24, 214, 8],
    ] as const) {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#a2461f" opacity="0.55"/>`);
    }
    // the rails on both long sides
    out.push(`<rect x="2" y="2" width="6" height="${h - 4}" fill="#4a4f54"/>`);
    out.push(`<rect x="${w - 8}" y="2" width="6" height="${h - 4}" fill="#4a4f54"/>`);
    return svg(w, h, out.join(""));
}

/** Sprite id -> SVG text of both doors. */
export function blastDoorSvgs(): Array<[string, string]> {
    return [
        ["map-blast-door-01.img", blastDoorSvg()],
        ["map-subway-gate-01.img", subwayGateSvg()],
    ];
}
