// Held (top-down) sprites from the owner's top-down sheets of 2026-10-10 (gitignored, assets-user/source/
// 2026-10-10-sheets/; packages/defs rebirth/heldGunArt.ts OWNER_HELD_GUN_ART): each drawing, barrel up, is found on its
// loose sheet (gunIcons.ts looseDrawings), cut from its background and fitted into its gun's frame: the length to the
// frame height (muzzle at the top, butt flush with the bottom edge, as the drawn sprites and the original ones), the
// bore (the muzzle's centre) on the frame's centre line, the width widened by the gun's factor (the owner's guns are
// drawn to real proportions, slimmer than surviv's chunky sprites; never past the frame, where it is narrowed
// instead). Written as img/rebirth/gun-<id>-owner-01.png at RES times the logical size. Where a gun has a drawing on
// more than one sheet, the first sheet of its `prefer` list that is installed wins.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
    OWNER_HELD_GUN_ART,
    type OwnerHeldGunArtId,
    ownerHeldGunArtPath,
} from "../../packages/defs/src/rebirth/heldGunArt.ts";
import { drawScaled, isolateGun, type LooseDrawing, opaqueBox } from "./gunIcons.ts";
import { createImage, encodePng, type RgbaImage } from "./png.ts";
import { type LooseSheetLayout, namedDrawings } from "./secondWaveSheets.ts";

/** Pixels per logical sprite pixel of an installed owner held sprite. */
export const OWNER_HELD_RES = 2;

/**
 * The owner's main top-down sheet: three per row (rows 1-3), two in row 4. The bulky black bullpup of row 1 is the
 * Jackhammer (coordinator, 2026-10-10); the PAW20 has no cell (its sprite is drawn, gun-paw20-01.svg).
 */
export const TOPDOWN_SHEET: LooseSheetLayout = {
    file: "second-wave-topdown.png",
    drawings: ["nlaw", "jackhammer", "pvg42", "rpd", "bren", "model94", "mg3", "maadi", "negev", "bazooka", "kpv"],
};

/** The owner's alternative top-down sheet: the Bren (wood and black, side knobs), the MG3 and the Negev. */
export const TOPDOWN_ALT_SHEET: LooseSheetLayout = {
    file: "second-wave-topdown-alt.webp",
    drawings: ["bren", "mg3", "negev"],
};

export interface OwnerHeldLayout {
    /** the sheets holding a drawing of it, in order of preference */
    prefer: readonly LooseSheetLayout[];
    /** width over length scale (1: the drawing's proportions) */
    widen: number;
}

/**
 * Per gun: where its drawing comes from and how much it is widened. The alternative sheet's Bren, MG3 and Negev were
 * checked in game (the main sheet is not here yet); the main sheet's widths are a first guess, to check when it
 * arrives.
 */
export const OWNER_HELD_LAYOUT: Readonly<Record<OwnerHeldGunArtId, OwnerHeldLayout>> = {
    nlaw: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    jackhammer: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    pvg42: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    rpd: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    bren: { prefer: [TOPDOWN_ALT_SHEET, TOPDOWN_SHEET], widen: 1.5 },
    model94: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    mg3: { prefer: [TOPDOWN_ALT_SHEET, TOPDOWN_SHEET], widen: 1.5 },
    maadi: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    negev: { prefer: [TOPDOWN_ALT_SHEET, TOPDOWN_SHEET], widen: 1.4 },
    bazooka: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
    kpv: { prefer: [TOPDOWN_SHEET], widen: 1.4 },
};

/** x of the bore in `img`: the mean x of the opaque pixels in the top 4 % of its opaque box (the muzzle). */
export function boreX(img: RgbaImage, box: { x0: number; y0: number; x1: number; y1: number }): number {
    const y1 = box.y0 + Math.max(1, Math.round((box.y1 - box.y0 + 1) * 0.04));
    let n = 0;
    let sx = 0;
    for (let y = box.y0; y < y1; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
            if (img.data[(y * img.width + x) * 4 + 3]! > 127) {
                n++;
                sx += x + 0.5;
            }
        }
    }
    return n ? sx / n : (box.x0 + box.x1 + 1) / 2;
}

/**
 * One drawing fitted into a `w` x `h` frame at `res` pixels per logical pixel: length to the frame (top margin 1
 * logical px), bore on the centre line, width x `widen` unless that crosses the frame edge (1 px margin), where the
 * widening is cut to fit. Returns the image and the width factor used (relative to the length's).
 */
export function fitHeldDrawing(
    drawing: RgbaImage,
    w: number,
    h: number,
    widen: number,
    res = OWNER_HELD_RES,
): { image: RgbaImage; widen: number } {
    const { image: gun } = isolateGun(drawing, { ink: 0, labelTop: 2, bgThreshold: 235 });
    const out = createImage(w * res, h * res);
    const box = opaqueBox(gun, 16);
    if (!box) return { image: out, widen };
    const ky = (h - 1) / (box.y1 - box.y0 + 1);
    const axis = boreX(gun, box);
    const half = Math.max(axis - box.x0, box.x1 + 1 - axis);
    const used = Math.min(widen, (w / 2 - 1) / (half * ky));
    const kx = ky * used;
    drawScaled(
        out,
        gun,
        { x: box.x0, y: box.y0, w: box.x1 + 1 - box.x0, h: box.y1 + 1 - box.y0 },
        {
            x: Math.round((w / 2 - (axis - box.x0) * kx) * res),
            y: res,
            w: Math.max(1, Math.round((box.x1 + 1 - box.x0) * kx * res)),
            h: (h - 1) * res,
        },
    );
    return { image: out, widen: used };
}

export interface OwnerHeldRow {
    file: string;
    from: string;
    /** the widening used, where the frame cut it */
    widen?: number;
}

/**
 * Installs every owner held sprite whose drawing is on an installed sheet in `dir` into `dest`; returns what came
 * from where (guns without a drawing keep their bar or drawn sprite and are left out). `readImage` reads the sheets
 * (newGunInstall.ts; the WebP needs ffmpeg).
 */
export function installOwnerHeldArt(
    dest: string,
    dir: string,
    readImage: (path: string) => RgbaImage,
    warnings: string[],
    ffmpeg: boolean,
): Record<string, OwnerHeldRow> {
    const sheets = new Map<LooseSheetLayout, Map<string, LooseDrawing>>();
    const drawingsOf = (layout: LooseSheetLayout): Map<string, LooseDrawing> => {
        let named = sheets.get(layout);
        if (!named) {
            const path = join(dir, layout.file);
            named = new Map();
            if (existsSync(path) && (path.endsWith(".png") || ffmpeg)) {
                named = namedDrawings(readImage(path), layout, warnings);
            } else if (existsSync(path)) {
                warnings.push(`${path}: ffmpeg / ffprobe are needed to read it, its held sprites not installed`);
            }
            sheets.set(layout, named);
        }
        return named;
    };
    const rows: Record<string, OwnerHeldRow> = {};
    for (const id of Object.keys(OWNER_HELD_GUN_ART) as OwnerHeldGunArtId[]) {
        const layout = OWNER_HELD_LAYOUT[id];
        const sheet = layout.prefer.find((s) => drawingsOf(s).has(id));
        if (!sheet) continue;
        const [w, h] = OWNER_HELD_GUN_ART[id];
        const fitted = fitHeldDrawing(drawingsOf(sheet).get(id)!.image, w, h, layout.widen);
        const file = ownerHeldGunArtPath(id);
        mkdirSync(dirname(join(dest, file)), { recursive: true });
        writeFileSync(join(dest, file), encodePng(fitted.image));
        rows[id] = { file, from: join(dir, sheet.file) };
        if (fitted.widen < layout.widen - 1e-6) rows[id].widen = Number(fitted.widen.toFixed(3));
    }
    if (!Object.keys(rows).length) {
        warnings.push(
            `${join(dir, TOPDOWN_SHEET.file)} / ${TOPDOWN_ALT_SHEET.file} missing: the owner's held sprites are not ` +
                "installed, the second-wave guns are held as bars",
        );
    }
    return rows;
}
