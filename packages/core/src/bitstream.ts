import type { Vec2 } from "./v2.ts";

/** Quantization range for unit vectors; slightly over 1 so +-1 survive rounding. */
const UNIT_VEC_RANGE = 1.0001;

// Shared scratch space for float <-> bit-pattern conversion (always little-endian).
const scratch = new DataView(new ArrayBuffer(8));
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function checkBitCount(bits: number): void {
    if (!Number.isInteger(bits) || bits < 1 || bits > 32) {
        throw new RangeError(`bit count must be an integer in [1, 32], got ${bits}`);
    }
}

function checkFloatRange(min: number, max: number): void {
    if (!(max > min)) {
        throw new RangeError(`invalid quantization range [${min}, ${max}]`);
    }
}

/**
 * Append-only bit writer over a growable byte buffer. Bits are packed
 * LSB-first within each byte, and multi-byte values are little-endian.
 */
export class BitWriter {
    private bytes: Uint8Array<ArrayBuffer>;
    private index = 0;

    constructor(initialCapacity = 64) {
        this.bytes = new Uint8Array(Math.max(1, initialCapacity));
    }

    get bitLength(): number {
        return this.index;
    }

    get byteLength(): number {
        return Math.ceil(this.index / 8);
    }

    /** View of the written bytes; it is invalidated by further writes. */
    getBuffer(): Uint8Array<ArrayBuffer> {
        return this.bytes.subarray(0, this.byteLength);
    }

    /** Writes the low `bits` bits of `value` (negative values use two's complement). */
    writeBits(value: number, bits: number): void {
        checkBitCount(bits);
        this.reserve(bits);
        const v = value >>> 0;
        let written = 0;
        while (written < bits) {
            const bitOffset = this.index & 7;
            const n = Math.min(8 - bitOffset, bits - written);
            const chunk = (v >>> written) & ((1 << n) - 1);
            // Unwritten bytes are always zero, so OR-ing is enough.
            this.bytes[this.index >>> 3] |= chunk << bitOffset;
            this.index += n;
            written += n;
        }
    }

    writeBoolean(value: boolean): void {
        this.writeBits(value ? 1 : 0, 1);
    }

    writeUint8(value: number): void {
        this.writeBits(value, 8);
    }

    writeUint16(value: number): void {
        this.writeBits(value, 16);
    }

    writeUint32(value: number): void {
        this.writeBits(value, 32);
    }

    writeInt8(value: number): void {
        this.writeBits(value, 8);
    }

    writeInt16(value: number): void {
        this.writeBits(value, 16);
    }

    writeInt32(value: number): void {
        this.writeBits(value, 32);
    }

    writeFloat32(value: number): void {
        scratch.setFloat32(0, value, true);
        this.writeBits(scratch.getUint32(0, true), 32);
    }

    writeFloat64(value: number): void {
        scratch.setFloat64(0, value, true);
        this.writeBits(scratch.getUint32(0, true), 32);
        this.writeBits(scratch.getUint32(4, true), 32);
    }

    /** Clamps `value` to [min, max] and quantizes it to `bits` bits (NaN encodes as `min`). */
    writeFloat(value: number, min: number, max: number, bits: number): void {
        checkBitCount(bits);
        checkFloatRange(min, max);
        const clamped = value > min ? (value < max ? value : max) : min;
        const steps = 2 ** bits - 1;
        this.writeBits(Math.round(((clamped - min) / (max - min)) * steps), bits);
    }

    writeVec(v: Vec2, minX: number, minY: number, maxX: number, maxY: number, bits: number): void {
        this.writeFloat(v.x, minX, maxX, bits);
        this.writeFloat(v.y, minY, maxY, bits);
    }

    writeUnitVec(v: Vec2, bits: number): void {
        this.writeVec(v, -UNIT_VEC_RANGE, -UNIT_VEC_RANGE, UNIT_VEC_RANGE, UNIT_VEC_RANGE, bits);
    }

    /**
     * Writes UTF-8 text followed by a NUL terminator. The text is cut at the
     * first embedded NUL and truncated, on a character boundary, to at most
     * `maxBytes` bytes (the terminator is not counted).
     */
    writeString(str: string, maxBytes: number): void {
        let encoded = utf8Encoder.encode(str);
        const nul = encoded.indexOf(0);
        if (nul >= 0) {
            encoded = encoded.subarray(0, nul);
        }
        let len = Math.min(encoded.length, Math.max(0, Math.floor(maxBytes)));
        // Back off while the first dropped byte is a continuation byte (0b10xxxxxx).
        while (len > 0 && len < encoded.length && (encoded[len] & 0xc0) === 0x80) {
            len--;
        }
        this.writeBytes(encoded.subarray(0, len));
        this.writeUint8(0);
    }

    writeBytes(src: Uint8Array): void {
        if ((this.index & 7) === 0) {
            this.reserve(src.length * 8);
            this.bytes.set(src, this.index >>> 3);
            this.index += src.length * 8;
            return;
        }
        for (const byte of src) {
            this.writeBits(byte, 8);
        }
    }

    /** Pads with zero bits up to the next byte boundary. */
    alignToNextByte(): void {
        const pad = (8 - (this.index & 7)) & 7;
        if (pad > 0) {
            this.writeBits(0, pad);
        }
    }

    private reserve(bits: number): void {
        const needed = Math.ceil((this.index + bits) / 8);
        if (needed <= this.bytes.length) {
            return;
        }
        let capacity = this.bytes.length * 2;
        while (capacity < needed) {
            capacity *= 2;
        }
        const grown = new Uint8Array(capacity);
        grown.set(this.bytes);
        this.bytes = grown;
    }
}

/** Reader mirroring `BitWriter`; every read past the end throws a `RangeError`. */
export class BitReader {
    readonly bitLength: number;
    private readonly bytes: Uint8Array;
    private index = 0;

    /** `bitLength` defaults to the whole buffer; pass the writer's exact length to reject trailing padding. */
    constructor(bytes: Uint8Array, bitLength = bytes.length * 8) {
        if (!Number.isInteger(bitLength) || bitLength < 0 || bitLength > bytes.length * 8) {
            throw new RangeError(`BitReader: bitLength ${bitLength} does not fit a ${bytes.length}-byte buffer`);
        }
        this.bytes = bytes;
        this.bitLength = bitLength;
    }

    get bitIndex(): number {
        return this.index;
    }

    get bitsLeft(): number {
        return this.bitLength - this.index;
    }

    /** Reads `bits` bits as an unsigned integer. */
    readBits(bits: number): number {
        checkBitCount(bits);
        this.ensureAvailable(bits);
        let result = 0;
        let read = 0;
        while (read < bits) {
            const bitOffset = this.index & 7;
            const n = Math.min(8 - bitOffset, bits - read);
            const chunk = (this.bytes[this.index >>> 3] >>> bitOffset) & ((1 << n) - 1);
            result |= chunk << read;
            this.index += n;
            read += n;
        }
        return result >>> 0;
    }

    readBoolean(): boolean {
        return this.readBits(1) === 1;
    }

    readUint8(): number {
        return this.readBits(8);
    }

    readUint16(): number {
        return this.readBits(16);
    }

    readUint32(): number {
        return this.readBits(32);
    }

    readInt8(): number {
        return (this.readBits(8) << 24) >> 24;
    }

    readInt16(): number {
        return (this.readBits(16) << 16) >> 16;
    }

    readInt32(): number {
        return this.readBits(32) | 0;
    }

    readFloat32(): number {
        scratch.setUint32(0, this.readBits(32), true);
        return scratch.getFloat32(0, true);
    }

    readFloat64(): number {
        const lo = this.readBits(32);
        const hi = this.readBits(32);
        scratch.setUint32(0, lo, true);
        scratch.setUint32(4, hi, true);
        return scratch.getFloat64(0, true);
    }

    readFloat(min: number, max: number, bits: number): number {
        checkBitCount(bits);
        checkFloatRange(min, max);
        const steps = 2 ** bits - 1;
        return min + (this.readBits(bits) / steps) * (max - min);
    }

    readVec(minX: number, minY: number, maxX: number, maxY: number, bits: number): Vec2 {
        const x = this.readFloat(minX, maxX, bits);
        const y = this.readFloat(minY, maxY, bits);
        return { x, y };
    }

    readUnitVec(bits: number): Vec2 {
        return this.readVec(-UNIT_VEC_RANGE, -UNIT_VEC_RANGE, UNIT_VEC_RANGE, UNIT_VEC_RANGE, bits);
    }

    /** Reads a NUL-terminated UTF-8 string; throws if it holds more than `maxBytes` bytes. */
    readString(maxBytes: number): string {
        const bytes: number[] = [];
        for (;;) {
            const byte = this.readUint8();
            if (byte === 0) {
                break;
            }
            if (bytes.length >= maxBytes) {
                throw new RangeError(`readString: string exceeds ${maxBytes} bytes`);
            }
            bytes.push(byte);
        }
        return utf8Decoder.decode(new Uint8Array(bytes));
    }

    /** Reads `length` raw bytes into a new array. */
    readBytes(length: number): Uint8Array<ArrayBuffer> {
        if (!Number.isInteger(length) || length < 0) {
            throw new RangeError(`readBytes: invalid length ${length}`);
        }
        this.ensureAvailable(length * 8);
        if ((this.index & 7) === 0) {
            const start = this.index >>> 3;
            this.index += length * 8;
            return this.bytes.slice(start, start + length);
        }
        const out = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            out[i] = this.readBits(8);
        }
        return out;
    }

    /** Skips the padding written by `BitWriter.alignToNextByte`. */
    alignToNextByte(): void {
        const pad = (8 - (this.index & 7)) & 7;
        if (pad > 0) {
            this.readBits(pad);
        }
    }

    private ensureAvailable(bits: number): void {
        if (this.index + bits > this.bitLength) {
            throw new RangeError(`BitReader: read of ${bits} bits at ${this.index} exceeds length ${this.bitLength}`);
        }
    }
}
