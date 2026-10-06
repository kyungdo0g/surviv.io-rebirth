// Bind values and the original client's bind share code (docs/research/ui/controls.md "Rebinding and bind sharing";
// survev client/src/inputBinds.ts:75-146 toArray / fromArray, client/src/lib/crc.ts, client/src/input.ts Key /
// MouseButton / MouseWheel / InputType / InputValue.toString). Rebirth binds are KeyboardEvent.code strings ("KeyR", so
// they do not depend on the keyboard layout), "Mouse0".."Mouse4" and "WheelUp" / "WheelDown"; the share code stores the
// original's {type, code} pairs, so keys go through the legacy keyCode of their US-layout position and codes are
// interchangeable with the original's. Code format: byte version (1), then per action 2 bits type + 8 bits code (bits
// packed LSB-first like the original's BitStream), then a CRC-16 of those bytes, big-endian, all base64.
import { BitReader, BitWriter } from "@rebirth/core";

export type BindCode = string;

/** survev input.ts InputType */
export const BindType = { None: 0, Key: 1, MouseButton: 2, MouseWheel: 3 } as const;

export const BIND_CODE_VERSION = 1;

/** KeyboardEvent.code -> legacy keyCode; the first code of a keyCode is its canonical bind code. */
const KEY_CODES: ReadonlyArray<readonly [string, number]> = [
    ["Backspace", 8],
    ["Tab", 9],
    ["Enter", 13],
    ["NumpadEnter", 13],
    ["ShiftLeft", 16],
    ["ShiftRight", 16],
    ["ControlLeft", 17],
    ["ControlRight", 17],
    ["AltLeft", 18],
    ["AltRight", 18],
    ["Pause", 19],
    ["CapsLock", 20],
    ["Escape", 27],
    ["Space", 32],
    ["PageUp", 33],
    ["PageDown", 34],
    ["End", 35],
    ["Home", 36],
    ["ArrowLeft", 37],
    ["ArrowUp", 38],
    ["ArrowRight", 39],
    ["ArrowDown", 40],
    ["PrintScreen", 44],
    ["Insert", 45],
    ["Delete", 46],
    ...Array.from({ length: 10 }, (_, i) => [`Digit${i}`, 48 + i] as const),
    ...Array.from({ length: 26 }, (_, i) => [`Key${String.fromCharCode(65 + i)}`, 65 + i] as const),
    ["MetaLeft", 91],
    ["MetaRight", 92],
    ["ContextMenu", 93],
    ...Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, 96 + i] as const),
    ["NumpadMultiply", 106],
    ["NumpadAdd", 107],
    ["NumpadSubtract", 109],
    ["NumpadDecimal", 110],
    ["NumpadDivide", 111],
    ...Array.from({ length: 24 }, (_, i) => [`F${i + 1}`, 112 + i] as const),
    ["NumLock", 144],
    ["ScrollLock", 145],
    ["Semicolon", 186],
    ["Equal", 187],
    ["Comma", 188],
    ["Minus", 189],
    ["Period", 190],
    ["Slash", 191],
    ["Backquote", 192],
    ["BracketLeft", 219],
    ["Backslash", 220],
    ["BracketRight", 221],
    ["Quote", 222],
    ["IntlBackslash", 226],
];

const CODE_TO_KEY = new Map<string, number>(KEY_CODES);
const KEY_TO_CODE = new Map<number, string>();
for (const [code, key] of KEY_CODES) if (!KEY_TO_CODE.has(key)) KEY_TO_CODE.set(key, code);

/** Display names that differ from the code (the original KeyNames table where it had one). */
const KEY_NAMES: Readonly<Record<string, string>> = {
    Enter: "Enter",
    ShiftLeft: "Shift",
    ControlLeft: "Control",
    AltLeft: "Alt",
    CapsLock: "Capslock",
    Escape: "ESC",
    PageUp: "Page Up",
    PageDown: "Page Down",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowRight: "→",
    ArrowDown: "↓",
    MetaLeft: "Windows Key",
    MetaRight: "Windows Key",
    ContextMenu: "Context Menu",
    NumpadMultiply: "*",
    NumpadAdd: "+",
    NumpadSubtract: "-",
    NumpadDecimal: ".",
    NumpadDivide: "/",
    NumLock: "Num Lock",
    ScrollLock: "Scroll Lock",
    Semicolon: ";",
    Equal: "=",
    Comma: ",",
    Minus: "-",
    Period: ".",
    Slash: "/",
    Backquote: "Backquote",
    BracketLeft: "[",
    Backslash: "\\",
    BracketRight: "]",
    Quote: "'",
    IntlBackslash: "\\",
};

/**
 * Mouse and wheel names: l10n keys of the original's ko.json ("Left Mouse" -> "왼쪽 마우스 버튼"), shown through t()
 * (survev input.ts MouseButtonNames / MouseWheelNames).
 */
export const MOUSE_NAMES: Readonly<Record<string, string>> = {
    Mouse0: "Left Mouse",
    Mouse1: "Middle Mouse",
    Mouse2: "Right Mouse",
    Mouse3: "Thumb Mouse 1",
    Mouse4: "Thumb Mouse 2",
    WheelUp: "Mouse Wheel Up",
    WheelDown: "Mouse Wheel Down",
};

/** One code per physical key the original could not tell apart (left / right Shift, Ctrl, Alt; both Enters). */
export function canonicalCode(code: string): string {
    const key = CODE_TO_KEY.get(code);
    return key === undefined ? code : (KEY_TO_CODE.get(key) ?? code);
}

/** The original's {type, code} pair of a bind, or null for codes it has no value for. */
export function bindValue(bind: BindCode): { type: number; code: number } | null {
    const mouse = /^Mouse([0-4])$/.exec(bind);
    if (mouse) return { type: BindType.MouseButton, code: Number(mouse[1]) };
    if (bind === "WheelUp") return { type: BindType.MouseWheel, code: 1 };
    if (bind === "WheelDown") return { type: BindType.MouseWheel, code: 2 };
    const key = CODE_TO_KEY.get(bind);
    return key === undefined ? null : { type: BindType.Key, code: key };
}

/** The bind for an original {type, code} pair, or null when there is none. */
export function bindFromValue(type: number, code: number): BindCode | null {
    switch (type) {
        case BindType.Key:
            return KEY_TO_CODE.get(code) ?? null;
        case BindType.MouseButton:
            return code >= 0 && code <= 4 ? `Mouse${code}` : null;
        case BindType.MouseWheel:
            return code === 1 ? "WheelUp" : code === 2 ? "WheelDown" : null;
        default:
            return null;
    }
}

/** Whether a code can be bound (it has a share-code value). */
export function isBindable(bind: BindCode): boolean {
    return bindValue(bind) !== null;
}

/** English display name of a key ("R", "Space", "←"); mouse binds return their l10n key (MOUSE_NAMES). */
export function bindName(bind: BindCode | null): string {
    if (!bind) return "";
    if (MOUSE_NAMES[bind]) return MOUSE_NAMES[bind];
    if (KEY_NAMES[bind]) return KEY_NAMES[bind];
    if (/^Key[A-Z]$/.test(bind)) return bind.slice(3);
    if (/^Digit\d$/.test(bind)) return bind.slice(5);
    if (/^Numpad\d$/.test(bind)) return `Numpad ${bind.slice(6)}`;
    return bind;
}

let crcTable: Uint16Array | null = null;

/** CRC-16/ARC (reflected polynomial 0xA001, init 0), the table of survev client/src/lib/crc.ts. */
export function crc16(bytes: Uint8Array): number {
    if (!crcTable) {
        crcTable = new Uint16Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1;
            crcTable[i] = c;
        }
    }
    let crc = 0;
    for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)) & 0xffff;
    return crc;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

/** The share code of a bind table (index = defs `Input` id; codes without an original value are written unbound). */
export function encodeBinds(binds: ReadonlyArray<BindCode | null>): string {
    const w = new BitWriter(binds.length * 2 + 1);
    w.writeBits(BIND_CODE_VERSION, 8);
    for (const bind of binds) {
        const v = bind ? bindValue(bind) : null;
        w.writeBits(v ? v.type & 3 : 0, 2);
        w.writeBits(v ? v.code & 255 : 0, 8);
    }
    const data = w.getBuffer();
    const crc = crc16(data);
    const out = new Uint8Array(data.length + 2);
    out.set(data);
    out[out.length - 2] = (crc >> 8) & 255;
    out[out.length - 1] = crc & 255;
    return bytesToBase64(out);
}

/**
 * The bind table of a share code (`count` actions; actions the code does not cover are unbound), or null when the code
 * is not base64, too short or fails its CRC (survev fromArray).
 */
export function decodeBinds(code: string, count: number): Array<BindCode | null> | null {
    let bytes: Uint8Array;
    try {
        bytes = base64ToBytes(code.trim());
    } catch {
        return null;
    }
    if (bytes.length < 3) return null;
    const data = bytes.subarray(0, bytes.length - 2);
    const crc = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
    if (crc16(data) !== crc) return null;
    const r = new BitReader(data);
    r.readBits(8); // version: 1 is the only one there ever was
    const binds: Array<BindCode | null> = Array.from({ length: count }, () => null);
    for (let i = 0; r.bitsLeft >= 10; i++) {
        const type = r.readBits(2);
        const value = r.readBits(8);
        if (i < count && type !== BindType.None) binds[i] = bindFromValue(type, value);
    }
    return binds;
}
