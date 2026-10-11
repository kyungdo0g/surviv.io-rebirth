// Floor and roof art of mall_01 (packages/defs rebirth/buildings/mall.ts): pale polished concourses with a darker inlay
// along their middles, the atrium's marble and the fountain's basin round the statue, a small-tile supermarket with
// coloured aisle bands, a checkered food court, a carpet per shop (the pharmacy's green cross, the toy shop's bright
// tiles), white toilet tiles, the security office and its steel vault with a hazard band in the vault's doorway, the
// keypad's steel panel with a digit tile before each button, a concrete loading dock with a hazard band at the truck
// bay, an asphalt truck apron and a paved entrance plaza with the fallen "SINCE 1987" sign (the keypad's hint). The roof: grey panels, glass barrel vaults over both
// concourses, a glass dome over the atrium, a red shopping-bag emblem over the supermarket, the entrance canopy, the
// loading dock's darker roof and AC units.
import {
    MALL_KEYPAD,
    MALL_LAYOUT,
    MALL_SIGN,
    MALL_VAULT_DOOR,
    REBIRTH_ART_PX_PER_UNIT as PX,
} from "../../../packages/defs/src/rebirth/buildings.ts";
import { lettering } from "./lettering.ts";
import {
    acUnit,
    circleAt,
    cross,
    type FloorPalette,
    type Frame,
    floor,
    floorFrameOf,
    frameOf,
    hazardBand,
    px,
    py,
    rect,
    roof,
} from "./svg.ts";

export const MALL_FLOORS: FloorPalette = {
    concourse: { base: "#ddd8cc", grid: "#cdc7ba", step: 2 },
    atrium: { base: "#e8e3d6", grid: "#d6cfbe", step: 4 },
    market: { base: "#e9e6de", grid: "#d8d4ca", step: 1 },
    stock: { base: "#9a9c96", grid: "#8b8d87", step: 4 },
    jewel: { base: "#5b3b62", grid: "#523559", step: 2 },
    phone: { base: "#b9c0c6", grid: "#aab1b8", step: 1 },
    hall: { base: "#c9c2b3", grid: "#b8b1a2", step: 2 },
    pharmacy: { base: "#eef1ee", grid: "#dde3de", step: 1 },
    hardware: { base: "#8e918c", grid: "#80837e", step: 2 },
    toys: { base: "#f0cf4f", grid: "#e2bf3c", step: 2 },
    clothing: { base: "#c48a8f", grid: "#b77e83", step: 2 },
    sports: { base: "#5f8a58", grid: "#557d4f", step: 2 },
    food: { base: "#efe9dc", grid: "#d9d1bf", step: 2 },
    electronics: { base: "#3f4d5f", grid: "#384556", step: 1 },
    toilets: { base: "#f2f4f5", grid: "#d4dade", step: 1 },
    cafe: { base: "#a9774c", grid: "#9a6b43", step: 1 },
    security: { base: "#6f7f8c", grid: "#64737f", step: 2 },
    vault: { base: "#59636b", grid: "#4f5960", step: 1 },
    music: { base: "#7c4f35", grid: "#70462f", step: 1 },
    dock: { base: "#8f918b", grid: "#80827c", step: 4 },
    apron: { base: "#4c4f53", grid: "#46494d", step: 8 },
    plaza: { base: "#b7b0a2", grid: "#a69f91", step: 2 },
};

const INK = "#22262a";

/** A checkerboard of `step`-unit squares in `dark` over the world box (the food court's tiles). */
function checker(fr: Frame, x0: number, y0: number, x1: number, y1: number, step: number, dark: string): string {
    const out: string[] = [];
    for (let x = x0, i = 0; x < x1 - 1e-6; x += step, i++) {
        for (let y = y0, j = 0; y < y1 - 1e-6; y += step, j++) {
            if ((i + j) % 2) out.push(rect(fr, x, y, Math.min(x + step, x1), Math.min(y + step, y1), `fill="${dark}"`));
        }
    }
    return out.join("");
}

/** A doormat across an open doorway: the world box in dark rubber. */
const mat = (fr: Frame, x0: number, y0: number, x1: number, y1: number) =>
    rect(fr, x0, y0, x1, y1, `fill="#3b3f43" fill-opacity="0.55"`);

/** The keypad on the security office's south wall: a steel panel, a pale plate per button, a digit tile before it. */
function keypad(fr: Frame): string {
    const xs = MALL_KEYPAD.map((k) => k.x);
    const face = 18.5;
    const out = [
        rect(
            fr,
            Math.min(...xs) - 0.5,
            face,
            Math.max(...xs) + 0.5,
            face + 1.45,
            `fill="#3d4349" stroke="${INK}" stroke-width="3"`,
        ),
    ];
    for (const k of MALL_KEYPAD) {
        out.push(rect(fr, k.x - 0.55, face, k.x + 0.55, face + 1.2, `fill="#9aa3ab" stroke="${INK}" stroke-width="2"`));
        const ty = k.y + 1.35;
        out.push(
            rect(
                fr,
                k.x - 0.5,
                ty - 0.5,
                k.x + 0.5,
                ty + 0.5,
                `fill="#f2efe6" stroke="${INK}" stroke-width="3" rx="5"`,
            ),
            lettering(k.label, px(fr, k.x), py(fr, ty), 0.62 * PX, `stroke="${INK}" stroke-width="4"`),
        );
    }
    return out.join("");
}

/**
 * The shop sign fallen on the entrance plaza (MALL_SIGN): a cream board with a red border and "SINCE 1987", its broken
 * posts beside it, a crack across one end, a shadow and a few chips of it on the paving.
 */
function fallenSign(fr: Frame): string {
    const { x, y, turn } = MALL_SIGN;
    const w = 8.8;
    const h = 1.9;
    const red = "#9d2b2b";
    const body = [
        rect(
            fr,
            x - w / 2 + 0.25,
            y - h / 2 - 0.25,
            x + w / 2 + 0.25,
            y + h / 2 - 0.25,
            `fill="#000" fill-opacity="0.25"`,
        ),
        rect(fr, x - w / 2, y - h / 2, x + w / 2, y + h / 2, `fill="#e9dfc6" stroke="#3a2f22" stroke-width="4"`),
        rect(
            fr,
            x - w / 2 + 0.22,
            y - h / 2 + 0.22,
            x + w / 2 - 0.22,
            y + h / 2 - 0.22,
            `fill="none" stroke="${red}" stroke-width="3"`,
        ),
        lettering("SINCE 1987", px(fr, x), py(fr, y), 0.9 * PX, `stroke="${red}" stroke-width="5"`),
        // a crack across the right end, a chipped corner
        `<path d="M${px(fr, x + 3.95)} ${py(fr, y + h / 2)}L${px(fr, x + 4.2)} ${py(fr, y + 0.3)}L${px(fr, x + 4.0)} ${py(fr, y - 0.2)}L${px(fr, x + 4.25)} ${py(fr, y - h / 2)}" fill="none" stroke="#3a2f22" stroke-width="3"/>`,
        `<path d="M${px(fr, x + w / 2)} ${py(fr, y - h / 2 + 0.55)}L${px(fr, x + w / 2 - 0.5)} ${py(fr, y - h / 2)}L${px(fr, x + w / 2)} ${py(fr, y - h / 2)}Z" fill="#b7b0a2"/>`,
        // the snapped posts it hung from, along its top edge
        rect(fr, x - 3, y + h / 2, x - 2.6, y + h / 2 + 0.9, `fill="#5d6166" stroke="${INK}" stroke-width="2"`),
        rect(fr, x + 2.6, y + h / 2, x + 3, y + h / 2 + 0.6, `fill="#5d6166" stroke="${INK}" stroke-width="2"`),
    ].join("");
    const chips = [
        [x + w / 2 + 0.5, y - 0.9],
        [x + w / 2 + 0.9, y - 0.3],
        [x + 2.2, y - h / 2 - 0.6],
    ]
        .map(([cx, cy]) =>
            rect(fr, cx - 0.15, cy - 0.12, cx + 0.15, cy + 0.12, `fill="#e9dfc6" stroke="#3a2f22" stroke-width="1.5"`),
        )
        .join("");
    return `<g transform="rotate(${turn} ${px(fr, x)} ${py(fr, y)})">${body}</g>${chips}`;
}

export function mallFloor(): string {
    const fr = floorFrameOf(MALL_LAYOUT);
    const extra = [
        // the concourses' inlay bands and the entrance hall's runner
        rect(fr, -26, -15.25, 46, -13.75, `fill="#b9b2a2" fill-opacity="0.7"`),
        rect(fr, -26, 13.75, 46, 15.25, `fill="#b9b2a2" fill-opacity="0.7"`),
        rect(fr, -1.5, -33.5, 1.5, -18, `fill="#9d2b2b" fill-opacity="0.5"`),
        // the atrium: a marble ring and the fountain's basin round the statue
        circleAt(fr, 0, 0, 9.5, `fill="none" stroke="#c9bfa8" stroke-width="10"`),
        circleAt(fr, 0, 0, 6.6, `fill="#bfb6a3" stroke="${INK}" stroke-width="4"`),
        circleAt(fr, 0, 0, 5.9, `fill="#4f9fc4"`),
        circleAt(fr, 0, 0, 5.2, `fill="none" stroke="#9fd3ea" stroke-width="3" stroke-dasharray="14 10"`),
        // the supermarket: coloured bands down its aisles (produce, dairy, bakery), the checkout lane
        rect(fr, -43.5, -27, -40.5, 12, `fill="#7fae5a" fill-opacity="0.25"`),
        rect(fr, -38.5, -27, -35.5, 12, `fill="#5a8fc0" fill-opacity="0.25"`),
        rect(fr, -33.5, -27, -26.5, 12, `fill="#d8a54a" fill-opacity="0.2"`),
        // the food court's checkered tiles
        checker(fr, 11.5, -10.5, 29.5, 10.5, 2, "#cfc4ad"),
        // the pharmacy's green cross, the toy shop's coloured squares, the sports shop's court lines
        cross(fr, 12, -24, 4, 1.4, `fill="#3f9b4b" fill-opacity="0.8"`),
        rect(fr, 38, -30, 40, -28, `fill="#e05a4f"`),
        rect(fr, 42, -26, 44, -24, `fill="#4f8fe0"`),
        rect(fr, 36, -22, 38, -20, `fill="#7fc65a"`),
        rect(fr, -23, 3, -14, 8, `fill="none" stroke="#e8efe4" stroke-width="4"`),
        // the stage of the music shop, the café's counter strip
        rect(fr, 14.5, 28.5, 25.5, 33.5, `fill="#5e3a26" fill-opacity="0.5"`),
        rect(fr, -13.5, 29, -2.5, 33.5, `fill="#7d5434" fill-opacity="0.5"`),
        // doormats at the main entrance and the concourses' outer doors
        mat(fr, -4, -33.5, 4, -31.5),
        mat(fr, 43.5, -16.5, 45.5, -12.5),
        mat(fr, 43.5, 12.5, 45.5, 16.5),
        // the vault: a hazard band in its doorway (the office side), a darker steel plate under the safe
        hazardBand(fr, MALL_VAULT_DOOR.pos.x - 4, 22.5, MALL_VAULT_DOOR.pos.x, 23.5, "mall-vault-hazard"),
        // the loading dock: a hazard band along the truck bay, bay numbers' blocks; the apron's bay lines
        hazardBand(fr, 31, 32.5, 41, 33.5, "mall-dock-hazard"),
        rect(fr, 30.8, 34, 31.2, 42, `fill="#e2b425"`),
        rect(fr, 35.8, 34, 36.2, 42, `fill="#e2b425"`),
        rect(fr, 40.8, 34, 41.2, 42, `fill="#e2b425"`),
        // the plaza's paving border
        rect(fr, -12, -40, 12, -34, `fill="none" stroke="#8f887a" stroke-width="6"`),
        // the keypad: its steel panel under the buttons and fins, a digit tile on the floor before each button
        keypad(fr),
        fallenSign(fr),
    ].join("");
    return floor(MALL_LAYOUT, MALL_FLOORS, "#c6c4bd", "#2b2d30", extra);
}

/** A glass barrel vault over the world box: a frame, blue glass, a ridge and ribs every 2 units across it. */
function glassVault(fr: Frame, x0: number, y0: number, x1: number, y1: number): string {
    const ribs: string[] = [];
    for (let x = x0 + 2; x < x1 - 0.5; x += 2) ribs.push(`M${px(fr, x)} ${py(fr, y1 - 0.3)}V${py(fr, y0 + 0.3)}`);
    const cy = (y0 + y1) / 2;
    return (
        rect(fr, x0, y0, x1, y1, `fill="#d8dcdf" stroke="${INK}" stroke-width="4"`) +
        rect(fr, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, `fill="#8fbcd2"`) +
        rect(fr, x0 + 0.3, cy, x1 - 0.3, y1 - 0.3, `fill="#a8cfe0"`) +
        `<path d="${ribs.join("")}" stroke="#e9eef1" stroke-width="3" fill="none"/>` +
        rect(fr, x0 + 0.3, cy - 0.12, x1 - 0.3, cy + 0.12, `fill="#f4f7f8"`)
    );
}

/** The atrium's glass dome: a rim, glass, eight ribs, a lantern cap. */
function dome(fr: Frame, x: number, y: number, r: number): string {
    const ribs: string[] = [];
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ribs.push(
            `M${px(fr, x + Math.cos(a) * 1.2)} ${py(fr, y + Math.sin(a) * 1.2)}L${px(fr, x + Math.cos(a) * (r - 0.3))} ${py(fr, y + Math.sin(a) * (r - 0.3))}`,
        );
    }
    return (
        circleAt(fr, x, y, r, `fill="#d8dcdf" stroke="${INK}" stroke-width="4"`) +
        circleAt(fr, x, y, r - 0.4, `fill="#8fbcd2"`) +
        circleAt(fr, x - r * 0.25, y + r * 0.25, r * 0.45, `fill="#b4d7e6"`) +
        `<path d="${ribs.join("")}" stroke="#e9eef1" stroke-width="4" fill="none"/>` +
        circleAt(fr, x, y, r * 0.55, `fill="none" stroke="#e9eef1" stroke-width="3"`) +
        circleAt(fr, x, y, 1.2, `fill="#c3c7ca" stroke="${INK}" stroke-width="3"`)
    );
}

/** The shopping-bag emblem centred on (x, y): a red bag with a white band and a dark handle. */
function bag(fr: Frame, x: number, y: number): string {
    const handle =
        `<path d="M${px(fr, x - 2)} ${py(fr, y + 3)}C${px(fr, x - 2)} ${py(fr, y + 6.2)} ${px(fr, x + 2)} ${py(fr, y + 6.2)} ` +
        `${px(fr, x + 2)} ${py(fr, y + 3)}" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>`;
    return (
        handle +
        rect(fr, x - 4, y - 4.5, x + 4, y + 3.5, `fill="#d2453b" stroke="${INK}" stroke-width="5"`) +
        rect(fr, x - 4, y - 1, x + 4, y + 0.6, `fill="#f4efe6"`) +
        circleAt(fr, x - 2, y + 2.4, 0.35, `fill="${INK}"`) +
        circleAt(fr, x + 2, y + 2.4, 0.35, `fill="${INK}"`)
    );
}

export function mallCeiling(): string {
    const fr = frameOf(MALL_LAYOUT);
    const top = [
        // the loading dock's darker roof with a hazard edge over the truck bay
        rect(fr, 26, 18, 45.5, 33.5, `fill="#7f858b" stroke="#6b7076" stroke-width="3"`),
        hazardBand(fr, 31, 32.5, 41, 33.5, "mall-roof-hazard"),
        glassVault(fr, -26, -17.5, 45.5, -11.5),
        glassVault(fr, -26, 11.5, 45.5, 17.5),
        // the entrance hall's skylight, the atrium's dome
        glassVault(fr, -3, -31, 3, -19),
        dome(fr, 0, 0, 9),
        bag(fr, -36, -4),
        // the red entrance canopy over the main doors
        rect(fr, -6.5, -34.5, 6.5, -32, `fill="#c0392b" stroke="${INK}" stroke-width="4"`),
        rect(fr, -6.5, -34.5, 6.5, -33.7, `fill="#e8e3d6"`),
        // AC units over the shops
        acUnit(fr, -20, -26),
        acUnit(fr, 13, -26),
        acUnit(fr, 27, -26),
        acUnit(fr, 40, -26),
        acUnit(fr, -19, 5),
        acUnit(fr, 20, 0),
        acUnit(fr, 38, 0),
        acUnit(fr, -20, 26),
        acUnit(fr, -8, 26),
        acUnit(fr, 6, 27),
        acUnit(fr, 20, 26),
        acUnit(fr, -36, 26),
    ].join("");
    return roof(MALL_LAYOUT, "#9aa0a6", "#c3c7ca", "#878d93", top);
}
