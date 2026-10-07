import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { choosePages, cutFrame, findSheets, imageDiff, parsePageName, type SheetFrame } from "./atlasSheets.ts";
import { createImage, decodePng, encodePng, pngSize, type RgbaImage } from "./png.ts";

function pixel(img: RgbaImage, x: number, y: number): number[] {
    const i = (y * img.width + x) * 4;
    return [...img.data.subarray(i, i + 4)];
}

function setPixel(img: RgbaImage, x: number, y: number, rgba: number[]): void {
    img.data.set(rgba, (y * img.width + x) * 4);
}

/** 90 degrees clockwise: the top row becomes the right column. */
function rotateCw(img: RgbaImage): RgbaImage {
    const out = createImage(img.height, img.width);
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) setPixel(out, img.height - 1 - y, x, pixel(img, x, y));
    }
    return out;
}

function chunk(type: string, body: Uint8Array): Buffer {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body, crc32(head.subarray(4))) >>> 0);
    return Buffer.concat([head, body, crc]);
}

describe("png", () => {
    it("round-trips RGBA", () => {
        const img = createImage(7, 5);
        for (let i = 0; i < img.data.length; i++) img.data[i] = (i * 37) & 0xff;
        const png = encodePng(img);
        expect(pngSize(png)).toEqual({ width: 7, height: 5 });
        expect(decodePng(png)).toEqual(img);
    });

    it("decodes 2-bit palette images with tRNS", () => {
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(3, 0);
        ihdr.writeUInt32BE(1, 4);
        ihdr[8] = 2; // bit depth
        ihdr[9] = 3; // palette
        // one row, filter 0, indices 2, 0, 1 packed into one byte: 10 00 01 00
        const raw = Buffer.from([0, 0b10000100]);
        const png = Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk("IHDR", ihdr),
            chunk("PLTE", Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255])),
            chunk("tRNS", Buffer.from([0, 128])),
            chunk("IDAT", deflateSync(raw)),
            chunk("IEND", Buffer.alloc(0)),
        ]);
        const img = decodePng(png);
        expect([pixel(img, 0, 0), pixel(img, 1, 0), pixel(img, 2, 0)]).toEqual([
            [0, 0, 255, 255],
            [255, 0, 0, 0],
            [0, 255, 0, 128],
        ]);
    });
});

describe("atlas sheets", () => {
    it("finds sheets whatever the key order, and prefers full resolution pages", () => {
        const frame = { frame: { x: 0, y: 0, w: 1, h: 1 }, rotated: false, trimmed: false };
        const sheet = (image: string, scale: number) =>
            JSON.stringify({ meta: { image, size: { w: 8, h: 8 }, scale }, frames: { "a.img": frame } });
        const flipped = `{"frames":{"b.img":${JSON.stringify(frame)}},"meta":{"image":"main-0-100-ab.png","size":{"w":8,"h":8},"scale":1}}`;
        const src = `var a=[${sheet("shared-0-100-12.png", 1)},${sheet("shared-0-50-34.png", 0.5)}];x(${sheet("shared-3-50-56.png", "0.5" as never)});y=${flipped};`;
        const sheets = findSheets(src);
        expect(sheets.map((s) => s.meta.image)).toEqual([
            "shared-0-100-12.png",
            "shared-0-50-34.png",
            "shared-3-50-56.png",
            "main-0-100-ab.png",
        ]);
        expect(choosePages(sheets).map((s) => s.meta.image)).toEqual([
            "shared-0-100-12.png",
            "shared-3-50-56.png",
            "main-0-100-ab.png",
        ]);
        expect(parsePageName("shared-3-50-07d4fb83.png")).toEqual({
            family: "shared",
            page: 3,
            percent: 50,
            hash: "07d4fb83",
        });
    });

    it("places trimmed pixels at spriteSourceSize and turns rotated frames back", () => {
        const sprite = createImage(3, 2);
        for (let i = 0; i < 6; i++) setPixel(sprite, i % 3, Math.floor(i / 3), [10 * i, 1, 2, 255]);
        const stored = rotateCw(sprite); // 2 wide, 3 tall
        const page = createImage(8, 8);
        for (let y = 0; y < stored.height; y++) {
            for (let x = 0; x < stored.width; x++) setPixel(page, 4 + x, 1 + y, pixel(stored, x, y));
        }
        const f: SheetFrame = {
            frame: { x: 4, y: 1, w: 3, h: 2 },
            rotated: true,
            trimmed: true,
            spriteSourceSize: { x: 1, y: 2, w: 3, h: 2 },
            sourceSize: { w: 5, h: 5 },
        };
        const cut = cutFrame(page, f);
        expect([cut.width, cut.height]).toEqual([5, 5]);
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 3; x++) expect(pixel(cut, 1 + x, 2 + y)).toEqual(pixel(sprite, x, y));
        }
        expect(pixel(cut, 0, 0)).toEqual([0, 0, 0, 0]);
        expect(pixel(cut, 4, 4)).toEqual([0, 0, 0, 0]);
    });

    it("measures dithering as a small difference and other art as a large one", () => {
        const a = createImage(8, 8);
        const b = createImage(8, 8);
        for (let i = 0; i < 64; i++) {
            const x = i % 8;
            const y = Math.floor(i / 8);
            setPixel(a, x, y, [100, 100, 100, 255]);
            setPixel(b, x, y, (x + y) % 2 ? [90, 90, 90, 255] : [110, 110, 110, 255]);
        }
        expect(imageDiff(a, b).max).toBe(0);
        const c = createImage(8, 8);
        c.data.fill(255);
        expect(imageDiff(a, c).max).toBeGreaterThan(64);
    });
});
