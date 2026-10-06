// Minimal PNG codec on node:zlib, for the asset tools (no image library dependency).
// Decodes every non-interlaced PNG colour type (grey, RGB, palette, grey+alpha, RGBA; 1-16 bit, tRNS) to 8-bit RGBA
// and encodes 8-bit RGBA with per-row adaptive filtering. Spec: https://www.w3.org/TR/png-3/
import { crc32, deflateSync, inflateSync } from "node:zlib";

/** 8-bit straight-alpha RGBA pixels, row-major, 4 bytes per pixel. */
export interface RgbaImage {
    width: number;
    height: number;
    data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function createImage(width: number, height: number): RgbaImage {
    return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Width and height from the IHDR chunk, without decoding the pixels. */
export function pngSize(buf: Uint8Array): { width: number; height: number } {
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    if (b.length < 24 || !b.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Reverses the scanline filters in place; returns the unfiltered rows without their filter bytes. */
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
    const out = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
        const type = raw[y * (stride + 1)]!;
        const src = y * (stride + 1) + 1;
        const row = y * stride;
        const prev = row - stride;
        for (let x = 0; x < stride; x++) {
            const v = raw[src + x]!;
            const a = x >= bpp ? out[row + x - bpp]! : 0;
            const b = y > 0 ? out[prev + x]! : 0;
            const c = x >= bpp && y > 0 ? out[prev + x - bpp]! : 0;
            let r: number;
            if (type === 0) r = v;
            else if (type === 1) r = v + a;
            else if (type === 2) r = v + b;
            else if (type === 3) r = v + ((a + b) >> 1);
            else if (type === 4) r = v + paeth(a, b, c);
            else throw new Error(`bad PNG filter type ${type}`);
            out[row + x] = r & 0xff;
        }
    }
    return out;
}

export function decodePng(buf: Uint8Array): RgbaImage {
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    const { width, height } = pngSize(b);
    let depth = 0;
    let colorType = 0;
    let palette: Uint8Array | undefined;
    let trns: Uint8Array | undefined;
    const idat: Buffer[] = [];
    for (let p = 8; p + 8 <= b.length; ) {
        const len = b.readUInt32BE(p);
        const type = b.toString("latin1", p + 4, p + 8);
        const body = b.subarray(p + 8, p + 8 + len);
        if (type === "IHDR") {
            depth = body[8]!;
            colorType = body[9]!;
            if (body[12] !== 0) throw new Error("interlaced PNGs are not supported");
        } else if (type === "PLTE") palette = body;
        else if (type === "tRNS") trns = body;
        else if (type === "IDAT") idat.push(body);
        else if (type === "IEND") break;
        p += 12 + len;
    }
    const channels = CHANNELS[colorType];
    if (!channels || ![1, 2, 4, 8, 16].includes(depth)) throw new Error(`unsupported PNG ${colorType}/${depth}`);
    const bitsPerPixel = channels * depth;
    const stride = Math.ceil((width * bitsPerPixel) / 8);
    const px = unfilter(inflateSync(Buffer.concat(idat)), height, stride, Math.max(1, bitsPerPixel >> 3));

    const sample = (row: number, i: number): number => {
        if (depth === 8) return px[row + i]!;
        if (depth === 16) return (px[row + 2 * i]! << 8) | px[row + 2 * i + 1]!;
        const bit = i * depth;
        return (px[row + (bit >> 3)]! >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    };
    // samples -> 8 bit (palette indices stay indices)
    const to8 = (v: number): number => (depth === 16 ? v >> 8 : depth === 8 ? v : (v * 255) / ((1 << depth) - 1));
    const key = (i: number): number => (trns && trns.length >= 2 * i + 2 ? (trns[2 * i]! << 8) | trns[2 * i + 1]! : -1);

    const img = createImage(width, height);
    const d = img.data;
    for (let y = 0; y < height; y++) {
        const row = y * stride;
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            const s = x * channels;
            if (colorType === 3) {
                const idx = sample(row, s);
                d[o] = palette?.[idx * 3] ?? 0;
                d[o + 1] = palette?.[idx * 3 + 1] ?? 0;
                d[o + 2] = palette?.[idx * 3 + 2] ?? 0;
                d[o + 3] = trns && idx < trns.length ? trns[idx]! : 255;
            } else if (colorType === 0 || colorType === 4) {
                const g = sample(row, s);
                d[o] = d[o + 1] = d[o + 2] = to8(g);
                d[o + 3] = colorType === 4 ? to8(sample(row, s + 1)) : g === key(0) ? 0 : 255;
            } else {
                const r = sample(row, s);
                const g = sample(row, s + 1);
                const bl = sample(row, s + 2);
                d[o] = to8(r);
                d[o + 1] = to8(g);
                d[o + 2] = to8(bl);
                d[o + 3] =
                    colorType === 6 ? to8(sample(row, s + 3)) : r === key(0) && g === key(1) && bl === key(2) ? 0 : 255;
            }
        }
    }
    return img;
}

function chunk(type: string, body: Uint8Array): Buffer {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body, crc32(head.subarray(4))) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
}

/** RGBA PNG; each row takes the filter with the smallest sum of absolute residuals (the libpng heuristic). */
export function encodePng(img: RgbaImage): Buffer {
    const { width, height, data } = img;
    const stride = width * 4;
    const raw = new Uint8Array(height * (stride + 1));
    const trial = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
        const row = y * stride;
        let best = Number.POSITIVE_INFINITY;
        for (let type = 0; type <= 4; type++) {
            let sum = 0;
            for (let x = 0; x < stride; x++) {
                const v = data[row + x]!;
                const a = x >= 4 ? data[row + x - 4]! : 0;
                const b = y > 0 ? data[row - stride + x]! : 0;
                const c = x >= 4 && y > 0 ? data[row - stride + x - 4]! : 0;
                const pred =
                    type === 0 ? 0 : type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : paeth(a, b, c);
                const r = (v - pred) & 0xff;
                trial[x] = r;
                sum += r < 128 ? r : 256 - r;
                if (sum >= best) break;
            }
            if (sum < best) {
                best = sum;
                raw[y * (stride + 1)] = type;
                raw.set(trial, y * (stride + 1) + 1);
            }
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
        SIGNATURE,
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", new Uint8Array(0)),
    ]);
}
