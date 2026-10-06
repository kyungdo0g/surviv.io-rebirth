// Key binds (M8): the original's share code (survev inputBinds.ts toArray / fromArray: version byte, 2-bit type +
// 8-bit code per action, CRC-16 big-endian, base64), CRC rejection, conflict unbinding and the settings store.
import { Input } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { ConfigStore, type StorageLike } from "../src/config.ts";
import { bindFromValue, bindValue, canonicalCode, crc16, decodeBinds, encodeBinds } from "../src/input/bindCodec.ts";
import { BIND_COUNT, BIND_DEFS, BindTable, defaultBinds } from "../src/input/keybinds.ts";

function memoryStorage(init: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
    const data = new Map(Object.entries(init));
    return {
        data,
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => void data.set(k, v),
        removeItem: (k) => void data.delete(k),
    };
}

describe("bind share code", () => {
    it("uses the CRC-16/ARC table of the original (survev lib/crc.ts)", () => {
        expect(crc16(new TextEncoder().encode("123456789"))).toBe(0xbb3d);
        expect(crc16(new Uint8Array([]))).toBe(0);
    });

    it("maps binds to the original's {type, code} values and back", () => {
        expect(bindValue("KeyR")).toEqual({ type: 1, code: 82 });
        expect(bindValue("Digit0")).toEqual({ type: 1, code: 48 });
        expect(bindValue("Mouse2")).toEqual({ type: 2, code: 2 });
        expect(bindValue("WheelDown")).toEqual({ type: 3, code: 2 });
        expect(bindFromValue(1, 32)).toBe("Space");
        expect(bindFromValue(3, 1)).toBe("WheelUp");
        expect(canonicalCode("ShiftRight")).toBe("ShiftLeft");
        expect(canonicalCode("NumpadEnter")).toBe("Enter");
    });

    it("round-trips the default table", () => {
        const code = encodeBinds(defaultBinds());
        // 8 + 36 x 10 bits = 46 bytes + 2 CRC bytes -> 64 base64 characters
        expect(code).toHaveLength(64);
        expect(decodeBinds(code, BIND_COUNT)).toEqual(defaultBinds());
    });

    it("writes the original's layout: version 1, then type/code pairs LSB-first", () => {
        const binds: Array<string | null> = Array.from({ length: BIND_COUNT }, () => null);
        binds[0] = "KeyA";
        const bytes = Uint8Array.from(atob(encodeBinds(binds)), (c) => c.charCodeAt(0));
        expect(bytes[0]).toBe(1);
        // type 1 in bits 0-1 of byte 1, code 65 in the next 8 bits: (65 << 2 | 1) = 0x105
        expect(bytes[1]).toBe(0x05);
        expect(bytes[2] & 0x03).toBe(0x01);
        const crc = crc16(bytes.subarray(0, bytes.length - 2));
        expect((bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1]).toBe(crc);
    });

    it("round-trips a custom table", () => {
        const table = new BindTable();
        table.set(Input.Reload, "KeyG");
        table.set(Input.EquipOtherGun, "Space");
        table.set(Input.Fire, "Mouse4");
        const copy = new BindTable(table.toShareCode());
        expect(copy.list()).toEqual(table.list());
        expect(copy.get(Input.Reload)).toBe("KeyG");
        expect(copy.get(Input.EquipOtherGun)).toBe("Space");
    });

    it("rejects a code with a bad CRC or bad base64", () => {
        const code = encodeBinds(defaultBinds());
        const bytes = Uint8Array.from(atob(code), (c) => c.charCodeAt(0));
        bytes[5] ^= 0x10;
        let corrupted = "";
        for (const b of bytes) corrupted += String.fromCharCode(b);
        expect(decodeBinds(btoa(corrupted), BIND_COUNT)).toBeNull();
        expect(decodeBinds("not base64!", BIND_COUNT)).toBeNull();
        expect(decodeBinds("AA==", BIND_COUNT)).toBeNull();
        const table = new BindTable();
        table.set(Input.Reload, "KeyG");
        expect(table.loadShareCode(btoa(corrupted))).toBe(false);
        expect(table.get(Input.Reload)).toBe("KeyG");
    });
});

describe("bind table", () => {
    it("starts with the original defaults", () => {
        const table = new BindTable();
        expect(table.get(Input.Reload)).toBe("KeyR");
        expect(table.get(Input.Fire)).toBe("Mouse0");
        expect(table.get(Input.EquipNextWeap)).toBe("WheelDown");
        expect(table.get(Input.Loot)).toBeNull();
        expect(table.get(Input.EquipFragGrenade)).toBeNull();
        expect(BIND_DEFS.map((d) => d.key)).toContain("bind-open-use");
        expect(BIND_DEFS.map((d) => d.key)).toContain("bind-use-med-kit");
    });

    it("unbinds the action that had a code before", () => {
        const table = new BindTable();
        let changes = 0;
        table.onChange(() => changes++);
        table.set(Input.Reload, "KeyE");
        expect(table.get(Input.Reload)).toBe("KeyE");
        expect(table.get(Input.StowWeapons)).toBeNull();
        expect(table.actionOf("KeyE")).toBe(Input.Reload);
        expect(table.isBound("KeyR")).toBe(false);
        table.set(Input.Reload, null);
        expect(table.isBound("KeyE")).toBe(false);
        table.restoreDefaults();
        expect(table.get(Input.Reload)).toBe("KeyR");
        expect(table.get(Input.StowWeapons)).toBe("KeyE");
        expect(changes).toBe(3);
    });
});

describe("config store", () => {
    it("persists settings and validates them", () => {
        const storage = memoryStorage();
        const a = new ConfigStore(() => storage);
        expect(a.get("musicVolume")).toBe(1);
        expect(a.get("screenShake")).toBe(true);
        a.set("musicVolume", 0.25);
        a.set("screenShake", false);
        a.set("touchMoveStyle", "bogus" as never);
        const b = new ConfigStore(() => storage);
        expect(b.get("musicVolume")).toBe(0.25);
        expect(b.get("screenShake")).toBe(false);
        expect(b.get("touchMoveStyle")).toBe("anywhere");
    });

    it("imports the M6 / M7 keys once", () => {
        const storage = memoryStorage({
            "rebirth.playerName": "Alice",
            "rebirth.lang": "ko",
            "rebirth.gameModeIdx": "1",
            "rebirth.teamAutoFill": "false",
        });
        const c = new ConfigStore(() => storage);
        expect(c.get("playerName")).toBe("Alice");
        expect(c.get("lang")).toBe("ko");
        expect(c.get("gameModeIdx")).toBe(1);
        expect(c.get("teamAutoFill")).toBe(false);
        expect(storage.data.has("rebirth.playerName")).toBe(false);
        expect(new ConfigStore(() => storage).get("playerName")).toBe("Alice");
    });

    it("works without storage", () => {
        const c = new ConfigStore(() => {
            throw new Error("blocked");
        });
        c.set("anonPlayerNames", true);
        expect(c.get("anonPlayerNames")).toBe(true);
    });
});
