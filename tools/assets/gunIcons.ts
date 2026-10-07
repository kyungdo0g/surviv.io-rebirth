// Loot icons from the owner's line-art sheets (beta new guns, 2026-10-07): each sheet is a grid of cells, one gun per
// cell drawn diagonally in black lines with a white fill on a white background, its name printed in the cell's
// bottom-right corner. cutGunIcon separates the drawing from the background and the label, then fits it into a loot
// icon like the original ones (128 x 128, the gun diagonal, its long side about 120 px, dark outline and white fill;
// measured on img/original/loot-weapon-*.png). Pure functions on 8-bit RGBA images (png.ts), no image library.
import { createImage, type RgbaImage } from "./png.ts";

export interface IconOptions {
    /** pixels at least this light (0-255 luminance) reachable from the cell's border are background */
    bgThreshold?: number;
    /** a component wholly below this fraction of the cell height and right of `labelLeft` is label text */
    labelTop?: number;
    labelLeft?: number;
    /** components smaller than this fraction of the drawing's area are specks (compression noise, watermark) */
    speck?: number;
    /** output canvas size and the long side the drawing is fitted to */
    size?: number;
    fit?: number;
    /** turn the drawing so its long axis points up-right at this angle (degrees above the horizontal), at most `maxTurn` */
    angle?: number;
    maxTurn?: number;
    /** the original icons' outline colour: black ink is lifted to this grey */
    ink?: number;
}

const DEFAULTS: Required<IconOptions> = {
    bgThreshold: 200,
    labelTop: 0.7,
    labelLeft: 0.15,
    speck: 0.003,
    size: 128,
    fit: 120,
    angle: 45,
    maxTurn: 20,
    ink: 0x2b,
};

interface Component {
    area: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export interface IsolateResult {
    /** the drawing alone: kept pixels opaque, the rest transparent */
    image: RgbaImage;
    /** components dropped as label text and as specks */
    label: number;
    specks: number;
}

/** A copy of the w x h rectangle of `img` at (x, y), clipped to the image. */
export function crop(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
    const out = createImage(w, h);
    for (let row = 0; row < h; row++) {
        const sy = y + row;
        if (sy < 0 || sy >= img.height) continue;
        for (let col = 0; col < w; col++) {
            const sx = x + col;
            if (sx < 0 || sx >= img.width) continue;
            const s = (sy * img.width + sx) * 4;
            out.data.set(img.data.subarray(s, s + 4), (row * w + col) * 4);
        }
    }
    return out;
}

/** The cell at (`col`, `row`) of a `cols` x `rows` grid laid over the whole sheet. */
export function gridCell(sheet: RgbaImage, cols: number, rows: number, col: number, row: number): RgbaImage {
    const x0 = Math.round((sheet.width * col) / cols);
    const x1 = Math.round((sheet.width * (col + 1)) / cols);
    const y0 = Math.round((sheet.height * row) / rows);
    const y1 = Math.round((sheet.height * (row + 1)) / rows);
    return crop(sheet, x0, y0, x1 - x0, y1 - y0);
}

function luminance(d: Uint8Array, i: number): number {
    return 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
}

/**
 * The gun drawing of one sheet cell: the light pixels connected to the cell's border become transparent (the white
 * fill enclosed by the outline stays), the label's letters (small components in the bottom-right corner) and specks
 * are dropped, and the black ink is lifted to the original icons' dark grey.
 */
export function isolateGun(cell: RgbaImage, options: IconOptions = {}): IsolateResult {
    const o = { ...DEFAULTS, ...options };
    const { width: w, height: h, data } = cell;
    const n = w * h;
    // 1. background: light pixels flood-filled (4-connected) from the border
    const bg = new Uint8Array(n);
    const stack: number[] = [];
    const seed = (p: number) => {
        if (bg[p]) return;
        if (data[p * 4 + 3] === 0 || luminance(data, p * 4) >= o.bgThreshold) {
            bg[p] = 1;
            stack.push(p);
        }
    };
    for (let x = 0; x < w; x++) {
        seed(x);
        seed((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
        seed(y * w);
        seed(y * w + w - 1);
    }
    while (stack.length) {
        const p = stack.pop()!;
        const x = p % w;
        if (x > 0) seed(p - 1);
        if (x < w - 1) seed(p + 1);
        if (p >= w) seed(p - w);
        if (p < n - w) seed(p + w);
    }
    // 2. foreground components (8-connected)
    const label = new Int32Array(n).fill(-1);
    const comps: Component[] = [];
    for (let start = 0; start < n; start++) {
        if (bg[start] || label[start] >= 0) continue;
        const id = comps.length;
        const c: Component = { area: 0, x0: w, y0: h, x1: -1, y1: -1 };
        label[start] = id;
        stack.push(start);
        while (stack.length) {
            const p = stack.pop()!;
            const x = p % w;
            const y = (p - x) / w;
            c.area++;
            if (x < c.x0) c.x0 = x;
            if (x > c.x1) c.x1 = x;
            if (y < c.y0) c.y0 = y;
            if (y > c.y1) c.y1 = y;
            for (let dy = -1; dy <= 1; dy++) {
                const yy = y + dy;
                if (yy < 0 || yy >= h) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx;
                    if (xx < 0 || xx >= w) continue;
                    const q = yy * w + xx;
                    if (!bg[q] && label[q] < 0) {
                        label[q] = id;
                        stack.push(q);
                    }
                }
            }
        }
        comps.push(c);
    }
    // 3. the drawing: everything but the label's letters and specks
    const largest = comps.reduce((m, c) => Math.max(m, c.area), 0);
    let labelCount = 0;
    let specks = 0;
    const keep = comps.map((c) => {
        const isLabel =
            c.y0 >= o.labelTop * h && c.x0 >= o.labelLeft * w && c.y1 - c.y0 < 0.25 * h && c.area < 0.15 * largest;
        if (isLabel) labelCount++;
        else if (c.area < o.speck * largest) specks++;
        return !isLabel && c.area >= o.speck * largest;
    });
    const image = createImage(w, h);
    const lift = (v: number) => Math.round(o.ink + (v * (255 - o.ink)) / 255);
    for (let p = 0; p < n; p++) {
        const id = label[p]!;
        if (id < 0 || !keep[id]) continue;
        const i = p * 4;
        image.data[i] = lift(data[i]!);
        image.data[i + 1] = lift(data[i + 1]!);
        image.data[i + 2] = lift(data[i + 2]!);
        image.data[i + 3] = 255;
    }
    return { image, label: labelCount, specks };
}

/** Bounding box of the pixels with alpha above `min`, or null for an empty image. */
export function opaqueBox(img: RgbaImage, min = 0): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = img.width;
    let y0 = img.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (img.data[(y * img.width + x) * 4 + 3]! > min) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Angle of the drawing's long axis in degrees above the horizontal (principal axis of its opaque pixels), in
 * (-90, 90]: the sheets draw the guns pointing up-right, about 30-40 degrees.
 */
export function axisAngle(img: RgbaImage): number {
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (img.data[(y * img.width + x) * 4 + 3]! > 127) {
                n++;
                sx += x;
                sy += y;
            }
        }
    }
    if (n === 0) return 0;
    const mx = sx / n;
    const my = sy / n;
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (img.data[(y * img.width + x) * 4 + 3]! > 127) {
                const dx = x - mx;
                const dy = my - y; // y up
                xx += dx * dx;
                yy += dy * dy;
                xy += dx * dy;
            }
        }
    }
    let deg = (Math.atan2(2 * xy, xx - yy) / 2) * (180 / Math.PI);
    if (deg <= -90) deg += 180;
    if (deg > 90) deg -= 180;
    return deg;
}

/** Straight-alpha RGBA -> premultiplied floats. */
function premultiply(img: RgbaImage): Float32Array {
    const out = new Float32Array(img.data.length);
    for (let i = 0; i < img.data.length; i += 4) {
        const a = img.data[i + 3]! / 255;
        out[i] = img.data[i]! * a;
        out[i + 1] = img.data[i + 1]! * a;
        out[i + 2] = img.data[i + 2]! * a;
        out[i + 3] = a;
    }
    return out;
}

function unpremultiply(p: Float32Array, width: number, height: number): RgbaImage {
    const out = createImage(width, height);
    for (let i = 0; i < p.length; i += 4) {
        const a = p[i + 3]!;
        if (a <= 1 / 512) continue;
        out.data[i] = Math.min(255, Math.round(p[i]! / a));
        out.data[i + 1] = Math.min(255, Math.round(p[i + 1]! / a));
        out.data[i + 2] = Math.min(255, Math.round(p[i + 2]! / a));
        out.data[i + 3] = Math.min(255, Math.round(a * 255));
    }
    return out;
}

/** `img` turned counter-clockwise by `deg` degrees about its centre (bilinear), on a canvas that holds it all. */
export function rotate(img: RgbaImage, deg: number): RgbaImage {
    if (Math.abs(deg) < 1e-6) return img;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const w = Math.ceil(Math.abs(img.width * cos) + Math.abs(img.height * sin));
    const h = Math.ceil(Math.abs(img.width * sin) + Math.abs(img.height * cos));
    const src = premultiply(img);
    const out = new Float32Array(w * h * 4);
    const cx = img.width / 2;
    const cy = img.height / 2;
    const at = (x: number, y: number, c: number) =>
        x < 0 || y < 0 || x >= img.width || y >= img.height ? 0 : src[(y * img.width + x) * 4 + c]!;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // inverse map (y down: a counter-clockwise turn on screen)
            const dx = x + 0.5 - w / 2;
            const dy = y + 0.5 - h / 2;
            const sx = cx + dx * cos - dy * sin - 0.5;
            const sy = cy + dx * sin + dy * cos - 0.5;
            const x0 = Math.floor(sx);
            const y0 = Math.floor(sy);
            const fx = sx - x0;
            const fy = sy - y0;
            for (let c = 0; c < 4; c++) {
                const top = at(x0, y0, c) * (1 - fx) + at(x0 + 1, y0, c) * fx;
                const bot = at(x0, y0 + 1, c) * (1 - fx) + at(x0 + 1, y0 + 1, c) * fx;
                out[(y * w + x) * 4 + c] = top * (1 - fy) + bot * fy;
            }
        }
    }
    return unpremultiply(out, w, h);
}

/**
 * The `sw` x `sh` region of `img` at (sx, sy) resampled to `dw` x `dh` with an area (box) filter on premultiplied
 * alpha, drawn into `dest` at (dx, dy) over what is there.
 */
export function drawScaled(
    dest: RgbaImage,
    img: RgbaImage,
    src: { x: number; y: number; w: number; h: number },
    dst: { x: number; y: number; w: number; h: number },
    mirror = false,
): void {
    const p = premultiply(img);
    const kx = src.w / dst.w;
    const ky = src.h / dst.h;
    for (let oy = 0; oy < dst.h; oy++) {
        const ty = dst.y + oy;
        if (ty < 0 || ty >= dest.height) continue;
        const ya = src.y + oy * ky;
        const yb = ya + ky;
        for (let ox = 0; ox < dst.w; ox++) {
            const tx = dst.x + (mirror ? dst.w - 1 - ox : ox);
            if (tx < 0 || tx >= dest.width) continue;
            const xa = src.x + ox * kx;
            const xb = xa + kx;
            const acc = [0, 0, 0, 0];
            let wsum = 0;
            for (let y = Math.floor(ya); y < Math.ceil(yb); y++) {
                const wy = Math.min(yb, y + 1) - Math.max(ya, y);
                if (wy <= 0 || y < 0 || y >= img.height) continue;
                for (let x = Math.floor(xa); x < Math.ceil(xb); x++) {
                    const wx = Math.min(xb, x + 1) - Math.max(xa, x);
                    if (wx <= 0 || x < 0 || x >= img.width) continue;
                    const wgt = wx * wy;
                    const i = (y * img.width + x) * 4;
                    for (let c = 0; c < 4; c++) acc[c]! += p[i + c]! * wgt;
                    wsum += wgt;
                }
            }
            if (wsum <= 0) continue;
            const a = acc[3]! / wsum;
            if (a <= 0) continue;
            // source over destination (straight-alpha destination)
            const d = (ty * dest.width + tx) * 4;
            const da = dest.data[d + 3]! / 255;
            const outA = a + da * (1 - a);
            for (let c = 0; c < 3; c++) {
                const sc = acc[c]! / wsum; // premultiplied source
                const dc = dest.data[d + c]! * da;
                dest.data[d + c] = Math.min(255, Math.round((sc + dc * (1 - a)) / outA));
            }
            dest.data[d + 3] = Math.min(255, Math.round(outA * 255));
        }
    }
}

/** The drawing (transparent elsewhere) turned towards `angle` and fitted, centred, into a `size` x `size` icon. */
export function fitIcon(drawing: RgbaImage, options: IconOptions = {}): RgbaImage {
    const o = { ...DEFAULTS, ...options };
    const turn = Math.max(-o.maxTurn, Math.min(o.maxTurn, o.angle - axisAngle(drawing)));
    const turned = rotate(drawing, turn);
    const box = opaqueBox(turned, 8);
    const out = createImage(o.size, o.size);
    if (!box) return out;
    const bw = box.x1 - box.x0 + 1;
    const bh = box.y1 - box.y0 + 1;
    const k = o.fit / Math.max(bw, bh);
    const dw = Math.max(1, Math.round(bw * k));
    const dh = Math.max(1, Math.round(bh * k));
    drawScaled(
        out,
        turned,
        { x: box.x0, y: box.y0, w: bw, h: bh },
        { x: Math.round((o.size - dw) / 2), y: Math.round((o.size - dh) / 2), w: dw, h: dh },
    );
    return out;
}

/** Cuts the gun of one sheet cell into a loot icon (isolateGun, then fitIcon). */
export function cutGunIcon(cell: RgbaImage, options: IconOptions = {}): { icon: RgbaImage } & IsolateResult {
    const isolated = isolateGun(cell, options);
    return { ...isolated, icon: fitIcon(isolated.image, options) };
}

/**
 * The dual-pistol icon of a single pistol icon, like the original dual icons (loot-weapon-m9-dual): two copies at 72 %
 * crossing in the middle, the left one mirrored, both inside the canvas.
 */
export function dualIcon(single: RgbaImage, size = 128): RgbaImage {
    const out = createImage(size, size);
    const s = Math.round(size * 0.72);
    const y = Math.round((size - s) / 2);
    const src = { x: 0, y: 0, w: single.width, h: single.height };
    drawScaled(out, single, src, { x: 0, y, w: s, h: s }, true);
    drawScaled(out, single, src, { x: size - s, y, w: s, h: s });
    return out;
}
