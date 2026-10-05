import { describe, expect, it } from "vitest";
import { BitReader, BitWriter, createRng, type Rng, type Vec2, v2 } from "../src/index.ts";

const utf8Length = (s: string) => new TextEncoder().encode(s).length;

function roundTrip(write: (w: BitWriter) => void): BitReader {
    const w = new BitWriter();
    write(w);
    return new BitReader(w.getBuffer(), w.bitLength);
}

describe("BitWriter / BitReader layout", () => {
    it("packs bits LSB-first within each byte", () => {
        const w = new BitWriter();
        w.writeBits(1, 1);
        w.writeBits(0b10, 2);
        w.writeBits(0b11111, 5);
        w.writeUint16(0x1234);
        expect([...w.getBuffer()]).toEqual([0b11111101, 0x34, 0x12]);
        expect(w.bitLength).toBe(24);
        expect(w.byteLength).toBe(3);
    });

    it("splits values across byte boundaries", () => {
        const w = new BitWriter();
        w.writeBits(0b101, 3);
        w.writeBits(0x3ff, 10);
        expect([...w.getBuffer()]).toEqual([0b11111101, 0b00011111]);
        const r = new BitReader(w.getBuffer());
        expect(r.readBits(3)).toBe(0b101);
        expect(r.readBits(10)).toBe(0x3ff);
    });

    it("round-trips every fixed-width type", () => {
        const r = roundTrip((w) => {
            w.writeBoolean(true);
            w.writeUint8(255);
            w.writeUint16(65535);
            w.writeUint32(0xffffffff);
            w.writeInt8(-128);
            w.writeInt16(-12345);
            w.writeInt32(-2147483648);
            w.writeInt32(2147483647);
            w.writeFloat32(Math.PI);
            w.writeFloat64(-Math.E);
            w.writeFloat64(Number.MIN_VALUE);
        });
        expect(r.readBoolean()).toBe(true);
        expect(r.readUint8()).toBe(255);
        expect(r.readUint16()).toBe(65535);
        expect(r.readUint32()).toBe(0xffffffff);
        expect(r.readInt8()).toBe(-128);
        expect(r.readInt16()).toBe(-12345);
        expect(r.readInt32()).toBe(-2147483648);
        expect(r.readInt32()).toBe(2147483647);
        expect(r.readFloat32()).toBe(Math.fround(Math.PI));
        expect(r.readFloat64()).toBe(-Math.E);
        expect(r.readFloat64()).toBe(Number.MIN_VALUE);
        expect(r.bitsLeft).toBe(0);
    });

    it("clamps and quantizes floats", () => {
        const r = roundTrip((w) => {
            w.writeFloat(5, 0, 1, 8);
            w.writeFloat(-3, 0, 1, 8);
            w.writeFloat(Number.NaN, 2, 4, 8);
            w.writeFloat(0.5, 0, 1, 1);
            w.writeUnitVec(v2.create(1, -1), 10);
            w.writeVec(v2.create(512, 256), 0, 0, 1024, 1024, 16);
        });
        expect(r.readFloat(0, 1, 8)).toBe(1);
        expect(r.readFloat(0, 1, 8)).toBe(0);
        expect(r.readFloat(2, 4, 8)).toBe(2);
        expect(r.readFloat(0, 1, 1)).toBe(1);
        const unit = r.readUnitVec(10);
        expect(unit.x).toBeCloseTo(1, 2);
        expect(unit.y).toBeCloseTo(-1, 2);
        const pos = r.readVec(0, 0, 1024, 1024, 16);
        expect(Math.abs(pos.x - 512)).toBeLessThan(1024 / 65535);
        expect(Math.abs(pos.y - 256)).toBeLessThan(1024 / 65535);
    });

    it("aligns to byte boundaries", () => {
        const w = new BitWriter();
        w.writeBits(0b101, 3);
        w.alignToNextByte();
        w.alignToNextByte();
        w.writeUint8(0xab);
        w.writeBytes(new Uint8Array([1, 2, 3]));
        expect(w.bitLength).toBe(40);
        expect([...w.getBuffer()]).toEqual([0b101, 0xab, 1, 2, 3]);
        const r = new BitReader(w.getBuffer());
        expect(r.readBits(3)).toBe(0b101);
        r.alignToNextByte();
        expect(r.bitIndex).toBe(8);
        expect(r.readUint8()).toBe(0xab);
        expect([...r.readBytes(3)]).toEqual([1, 2, 3]);
    });

    it("writes raw bytes at unaligned offsets", () => {
        const r = roundTrip((w) => {
            w.writeBits(1, 1);
            w.writeBytes(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
        });
        expect(r.readBits(1)).toBe(1);
        expect([...r.readBytes(4)]).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });

    it("grows past its initial capacity", () => {
        const w = new BitWriter(1);
        for (let i = 0; i < 10000; i++) {
            w.writeBits(i & 0x7ff, 11);
        }
        const r = new BitReader(w.getBuffer());
        for (let i = 0; i < 10000; i++) {
            expect(r.readBits(11)).toBe(i & 0x7ff);
        }
    });
});

describe("strings", () => {
    it("round-trips UTF-8 text including Korean and emoji", () => {
        const samples = ["", "hello", "안녕하세요", "생존자 🎯 #1", "Ünïcödé — ok"];
        const r = roundTrip((w) => {
            for (const s of samples) {
                w.writeString(s, 64);
            }
        });
        for (const s of samples) {
            expect(r.readString(64)).toBe(s);
        }
    });

    it("truncates on character boundaries", () => {
        const r = roundTrip((w) => {
            w.writeString("안녕하세요", 7);
            w.writeString("안녕하세요", 15);
            w.writeString("a😀b", 4);
            w.writeString("a😀b", 5);
            w.writeString("abcdef", 3);
            w.writeString("ab\0cd", 16);
        });
        expect(r.readString(7)).toBe("안녕");
        expect(r.readString(15)).toBe("안녕하세요");
        expect(r.readString(4)).toBe("a");
        expect(r.readString(5)).toBe("a😀");
        expect(r.readString(3)).toBe("abc");
        expect(r.readString(16)).toBe("ab");
    });

    it("rejects strings longer than the reader's limit or missing a terminator", () => {
        const long = roundTrip((w) => w.writeString("abcdef", 16));
        expect(() => long.readString(3)).toThrow(RangeError);

        const w = new BitWriter();
        w.writeBytes(new Uint8Array([104, 105]));
        expect(() => new BitReader(w.getBuffer()).readString(16)).toThrow(RangeError);
    });
});

describe("bounds checking", () => {
    it("throws RangeError when reading past the end", () => {
        const w = new BitWriter();
        w.writeBits(0x155, 10);
        const exact = new BitReader(w.getBuffer(), w.bitLength);
        expect(exact.bitsLeft).toBe(10);
        expect(exact.readBits(10)).toBe(0x155);
        expect(exact.bitsLeft).toBe(0);
        expect(() => exact.readBoolean()).toThrow(RangeError);

        const padded = new BitReader(w.getBuffer());
        padded.readBits(10);
        expect(padded.bitsLeft).toBe(6);
        expect(() => padded.readUint8()).toThrow(RangeError);
        expect(() => padded.readBytes(1)).toThrow(RangeError);
        expect(padded.readBits(6)).toBe(0);
        expect(() => new BitReader(new Uint8Array(0)).readUint32()).toThrow(RangeError);
    });

    it("validates bit counts and lengths", () => {
        const w = new BitWriter();
        expect(() => w.writeBits(1, 0)).toThrow(RangeError);
        expect(() => w.writeBits(1, 33)).toThrow(RangeError);
        expect(() => w.writeFloat(1, 2, 2, 8)).toThrow(RangeError);
        expect(() => new BitReader(new Uint8Array(1), 9)).toThrow(RangeError);
    });
});

type Op =
    | { kind: "bits"; value: number; bits: number }
    | { kind: "bool"; value: boolean }
    | { kind: "int"; value: number; width: 8 | 16 | 32; signed: boolean }
    | { kind: "f32" | "f64"; value: number }
    | { kind: "float"; value: number; min: number; max: number; bits: number }
    | { kind: "vec"; value: Vec2; min: Vec2; max: Vec2; bits: number }
    | { kind: "unitVec"; value: Vec2; bits: number }
    | { kind: "string"; value: string; maxBytes: number }
    | { kind: "bytes"; value: Uint8Array }
    | { kind: "align" };

const STRING_PIECES = ["a", "Z", "7", " ", "é", "ß", "한", "국", "어", "😀", "—", "\u0000"];

function randomOp(rng: Rng): Op {
    const intWidths = [8, 16, 32] as const;
    switch (rng.int(0, 9)) {
        case 0: {
            const bits = rng.int(1, 32);
            return { kind: "bits", bits, value: Math.floor(rng.next() * 2 ** bits) };
        }
        case 1:
            return { kind: "bool", value: rng.bool() };
        case 2: {
            const width = rng.pick(intWidths);
            const signed = rng.bool();
            const value = Math.floor(rng.next() * 2 ** width) - (signed ? 2 ** (width - 1) : 0);
            return { kind: "int", width, signed, value };
        }
        case 3:
            return { kind: rng.bool() ? "f32" : "f64", value: rng.range(-1e6, 1e6) };
        case 4: {
            const min = rng.range(-100, 100);
            const max = min + rng.range(0.1, 500);
            return { kind: "float", min, max, bits: rng.int(1, 24), value: rng.range(min - 10, max + 10) };
        }
        case 5: {
            const min = v2.create(rng.range(-50, 0), rng.range(-50, 0));
            const max = v2.add(min, v2.create(rng.range(1, 1024), rng.range(1, 1024)));
            const value = v2.create(rng.range(min.x, max.x), rng.range(min.y, max.y));
            return { kind: "vec", value, min, max, bits: rng.int(4, 20) };
        }
        case 6:
            return { kind: "unitVec", value: v2.randomUnit(rng), bits: rng.int(6, 16) };
        case 7: {
            const pieces = Array.from({ length: rng.int(0, 16) }, () => rng.pick(STRING_PIECES));
            return { kind: "string", value: pieces.join(""), maxBytes: rng.int(0, 40) };
        }
        case 8:
            return { kind: "bytes", value: Uint8Array.from({ length: rng.int(0, 8) }, () => rng.int(0, 255)) };
        default:
            return { kind: "align" };
    }
}

function writeOp(w: BitWriter, op: Op): void {
    switch (op.kind) {
        case "bits":
            w.writeBits(op.value, op.bits);
            break;
        case "bool":
            w.writeBoolean(op.value);
            break;
        case "int": {
            const writers = op.signed
                ? {
                      8: (v: number) => w.writeInt8(v),
                      16: (v: number) => w.writeInt16(v),
                      32: (v: number) => w.writeInt32(v),
                  }
                : {
                      8: (v: number) => w.writeUint8(v),
                      16: (v: number) => w.writeUint16(v),
                      32: (v: number) => w.writeUint32(v),
                  };
            writers[op.width](op.value);
            break;
        }
        case "f32":
            w.writeFloat32(op.value);
            break;
        case "f64":
            w.writeFloat64(op.value);
            break;
        case "float":
            w.writeFloat(op.value, op.min, op.max, op.bits);
            break;
        case "vec":
            w.writeVec(op.value, op.min.x, op.min.y, op.max.x, op.max.y, op.bits);
            break;
        case "unitVec":
            w.writeUnitVec(op.value, op.bits);
            break;
        case "string":
            w.writeString(op.value, op.maxBytes);
            break;
        case "bytes":
            w.writeBytes(op.value);
            break;
        case "align":
            w.alignToNextByte();
            break;
    }
}

/** Largest error allowed by quantizing [min, max] into `bits` bits: half a step, plus float slack. */
const quantTolerance = (min: number, max: number, bits: number) => (max - min) / (2 ** bits - 1) / 2 + 1e-9;

function checkOp(r: BitReader, op: Op): void {
    switch (op.kind) {
        case "bits":
            expect(r.readBits(op.bits)).toBe(op.value);
            return;
        case "bool":
            expect(r.readBoolean()).toBe(op.value);
            return;
        case "int": {
            const readers = op.signed
                ? { 8: () => r.readInt8(), 16: () => r.readInt16(), 32: () => r.readInt32() }
                : { 8: () => r.readUint8(), 16: () => r.readUint16(), 32: () => r.readUint32() };
            expect(readers[op.width]()).toBe(op.value);
            return;
        }
        case "f32":
            expect(r.readFloat32()).toBe(Math.fround(op.value));
            return;
        case "f64":
            expect(r.readFloat64()).toBe(op.value);
            return;
        case "float": {
            const expected = Math.min(Math.max(op.value, op.min), op.max);
            const actual = r.readFloat(op.min, op.max, op.bits);
            expect(Math.abs(actual - expected)).toBeLessThanOrEqual(quantTolerance(op.min, op.max, op.bits));
            return;
        }
        case "vec": {
            const actual = r.readVec(op.min.x, op.min.y, op.max.x, op.max.y, op.bits);
            expect(Math.abs(actual.x - op.value.x)).toBeLessThanOrEqual(quantTolerance(op.min.x, op.max.x, op.bits));
            expect(Math.abs(actual.y - op.value.y)).toBeLessThanOrEqual(quantTolerance(op.min.y, op.max.y, op.bits));
            return;
        }
        case "unitVec": {
            const actual = r.readUnitVec(op.bits);
            const tolerance = quantTolerance(-1.0001, 1.0001, op.bits);
            expect(Math.abs(actual.x - op.value.x)).toBeLessThanOrEqual(tolerance);
            expect(Math.abs(actual.y - op.value.y)).toBeLessThanOrEqual(tolerance);
            return;
        }
        case "string": {
            const actual = r.readString(op.maxBytes);
            const source = op.value.split("\u0000")[0];
            expect(source.startsWith(actual)).toBe(true);
            expect(utf8Length(actual)).toBeLessThanOrEqual(op.maxBytes);
            if (actual.length < source.length) {
                // Truncation must keep as many whole characters as fit.
                const nextChar = String.fromCodePoint(source.codePointAt(actual.length)!);
                expect(utf8Length(actual + nextChar)).toBeGreaterThan(op.maxBytes);
            }
            return;
        }
        case "bytes":
            expect([...r.readBytes(op.value.length)]).toEqual([...op.value]);
            return;
        case "align":
            r.alignToNextByte();
            expect(r.bitIndex % 8).toBe(0);
            return;
    }
}

describe("bitstream property test", () => {
    it("round-trips 2000 random mixed writes", () => {
        const rng = createRng(0xb175);
        const ops = Array.from({ length: 2000 }, () => randomOp(rng));
        const w = new BitWriter(4);
        for (const op of ops) {
            writeOp(w, op);
        }
        const r = new BitReader(w.getBuffer(), w.bitLength);
        for (const op of ops) {
            checkOp(r, op);
        }
        expect(r.bitsLeft).toBe(0);
        expect(() => r.readBits(1)).toThrow(RangeError);
    });
});
