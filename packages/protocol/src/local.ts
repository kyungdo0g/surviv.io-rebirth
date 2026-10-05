// LocalPlayerState (the original "active player data"): a 12-bit dirty mask followed by the changed sections.
// Each section is quantized into integers so the per-client encoder sends a section only when its wire values
// changed since the last update it sent to that client.
//
// Sections (bit: layout):
//   0 health   float 0..100 8 bits            1 boost  float 0..100 8 bits      2 zoom   u8 (radius)
//   3 layer    2 bits                         4 weapons curWeapIdx 2 bits, count 3 bits, count x {type 10, ammo u8}
//   5 inventory for each GameConfig.bagSizes item: has bit [+ count 9 bits] (original layout)
//   6 gear     scope, outfit, helmet, chest, backpack (10 bits each)
//   7 action   type 3 bits, item 10 bits, time and duration float 0..8.5 8 bits each
//   8 cooldowns count 3 bits, count x float 0..4 8 bits, freeSwitch float 0..4 8 bits
//   9 kills u8   10 dead bit   11 killedBy u16
//  12 stats (M4) kills u8, damageDealt u16, damageTaken u16, timeAlive u16 (integers, like the PlayerStats record)
//  13 spectatorCount u8 (M4; the original active player data carries it too)
import type { BitReader, BitWriter } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import type { ActionType, LocalPlayerState } from "@rebirth/sim";
import { NetLimits } from "./constants.ts";
import { clampUint, dequantize, gameTypeId, gameTypeOf, quantize } from "./quant.ts";

/** Bag items in protocol order (GameConfig.bagSizes key order, like the original). */
export const BAG_ITEMS: readonly string[] = Object.keys(GameConfig.bagSizes);

const SECTION_COUNT = 14;
export const LOCAL_ALL_DIRTY = (1 << SECTION_COUNT) - 1;
const ACTION_TYPES: readonly ActionType[] = ["none", "reload", "use"];
const STAT_BITS = 8;
const TIME_BITS = 8;
const COUNT_BITS = 9;

/** Wire values of every section of a LocalPlayerState. */
export type LocalQuant = number[][];

function q8(v: number, max: number): number {
    return quantize(v, 0, max, STAT_BITS);
}

export function quantizeLocal(s: LocalPlayerState): LocalQuant {
    const weapons = [s.curWeapIdx & 3, Math.min(s.weapons.length, 7)];
    for (let i = 0; i < weapons[1]; i++) {
        weapons.push(gameTypeId(s.weapons[i].type), clampUint(s.weapons[i].ammo, 8));
    }
    const action = s.action;
    const actionType = Math.max(0, ACTION_TYPES.indexOf(action?.type ?? "none"));
    const cd = s.cooldowns?.weapons ?? [];
    const cooldowns = [Math.min(cd.length, 7)];
    for (let i = 0; i < cooldowns[0]; i++) cooldowns.push(quantize(cd[i], 0, NetLimits.CooldownMax, TIME_BITS));
    cooldowns.push(quantize(s.cooldowns?.freeSwitch ?? 0, 0, NetLimits.CooldownMax, TIME_BITS));
    return [
        [q8(s.health, 100)],
        [q8(s.boost, 100)],
        [clampUint(Math.round(s.zoom), 8)],
        [s.layer & 3],
        weapons,
        BAG_ITEMS.map((item) => clampUint(s.inventory[item] ?? 0, COUNT_BITS)),
        [s.scope ?? "", s.outfit ?? "", s.helmet ?? "", s.chest ?? "", s.backpack ?? ""].map(gameTypeId),
        [
            actionType,
            gameTypeId(action?.item ?? ""),
            quantize(action?.time ?? 0, 0, NetLimits.ActionMaxDuration, TIME_BITS),
            quantize(action?.duration ?? 0, 0, NetLimits.ActionMaxDuration, TIME_BITS),
        ],
        cooldowns,
        [clampUint(s.kills ?? 0, 8)],
        [s.dead ? 1 : 0],
        [clampUint(s.killedBy ?? 0, 16)],
        [
            clampUint(s.stats?.kills ?? 0, 8),
            clampUint(s.stats?.damageDealt ?? 0, 16),
            clampUint(s.stats?.damageTaken ?? 0, 16),
            clampUint(s.stats?.timeAlive ?? 0, 16),
        ],
        [clampUint(s.spectatorCount ?? 0, 8)],
    ];
}

function sameSection(a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/** Dirty mask of `cur` against the last sent values (all sections when nothing was sent yet). */
export function localDirtyMask(prev: LocalQuant | null, cur: LocalQuant): number {
    if (!prev) return LOCAL_ALL_DIRTY;
    let mask = 0;
    for (let i = 0; i < SECTION_COUNT; i++) if (!sameSection(prev[i], cur[i])) mask |= 1 << i;
    return mask;
}

export function writeLocal(w: BitWriter, q: LocalQuant, mask: number): void {
    w.writeBits(mask, SECTION_COUNT);
    if (mask & 1) w.writeBits(q[0][0], STAT_BITS);
    if (mask & 2) w.writeBits(q[1][0], STAT_BITS);
    if (mask & 4) w.writeBits(q[2][0], 8);
    if (mask & 8) w.writeBits(q[3][0], 2);
    if (mask & 16) {
        const s = q[4];
        w.writeBits(s[0], 2);
        w.writeBits(s[1], 3);
        for (let i = 2; i < s.length; i += 2) {
            w.writeBits(s[i], 10);
            w.writeBits(s[i + 1], 8);
        }
    }
    if (mask & 32) {
        for (const count of q[5]) {
            w.writeBoolean(count > 0);
            if (count > 0) w.writeBits(count, COUNT_BITS);
        }
    }
    if (mask & 64) for (const t of q[6]) w.writeBits(t, 10);
    if (mask & 128) {
        const a = q[7];
        w.writeBits(a[0], 3);
        w.writeBits(a[1], 10);
        w.writeBits(a[2], TIME_BITS);
        w.writeBits(a[3], TIME_BITS);
    }
    if (mask & 256) {
        const c = q[8];
        w.writeBits(c[0], 3);
        for (let i = 1; i < c.length; i++) w.writeBits(c[i], TIME_BITS);
    }
    if (mask & 512) w.writeBits(q[9][0], 8);
    if (mask & 1024) w.writeBits(q[10][0], 1);
    if (mask & 2048) w.writeBits(q[11][0], 16);
    if (mask & 4096) {
        const st = q[12];
        w.writeBits(st[0], 8);
        w.writeBits(st[1], 16);
        w.writeBits(st[2], 16);
        w.writeBits(st[3], 16);
    }
    if (mask & 8192) w.writeBits(q[13][0], 8);
}

/** Default local state before the first update (every section is sent in the first update anyway). */
export function emptyLocalState(): LocalPlayerState {
    const inventory: Record<string, number> = {};
    for (const item of BAG_ITEMS) inventory[item] = 0;
    return {
        health: 0,
        boost: 0,
        zoom: 0,
        layer: 0,
        weapons: [],
        curWeapIdx: 0,
        inventory,
        scope: "",
        outfit: "",
        helmet: "",
        chest: "",
        backpack: "",
        action: { type: "none", item: "", time: 0, duration: 0 },
        cooldowns: { weapons: [], freeSwitch: 0 },
        kills: 0,
        dead: false,
        killedBy: 0,
        stats: { kills: 0, damageDealt: 0, damageTaken: 0, timeAlive: 0 },
        spectatorCount: 0,
    };
}

/** Applies the changed sections to `s` in place. */
export function readLocal(r: BitReader, s: LocalPlayerState): void {
    const mask = r.readBits(SECTION_COUNT);
    if (mask & 1) s.health = dequantize(r.readBits(STAT_BITS), 0, 100, STAT_BITS);
    if (mask & 2) s.boost = dequantize(r.readBits(STAT_BITS), 0, 100, STAT_BITS);
    if (mask & 4) s.zoom = r.readBits(8);
    if (mask & 8) s.layer = r.readBits(2);
    if (mask & 16) {
        s.curWeapIdx = r.readBits(2);
        const weapons: Array<{ type: string; ammo: number }> = [];
        for (let n = r.readBits(3); n > 0; n--) {
            const type = gameTypeOf(r.readBits(10));
            weapons.push({ type, ammo: r.readBits(8) });
        }
        s.weapons = weapons;
    }
    if (mask & 32) {
        const inventory: Record<string, number> = {};
        for (const item of BAG_ITEMS) inventory[item] = r.readBoolean() ? r.readBits(COUNT_BITS) : 0;
        s.inventory = inventory;
    }
    if (mask & 64) {
        s.scope = gameTypeOf(r.readBits(10));
        s.outfit = gameTypeOf(r.readBits(10));
        s.helmet = gameTypeOf(r.readBits(10));
        s.chest = gameTypeOf(r.readBits(10));
        s.backpack = gameTypeOf(r.readBits(10));
    }
    if (mask & 128) {
        const code = r.readBits(3);
        const type = ACTION_TYPES[code];
        if (type === undefined) throw new RangeError(`unknown action code ${code}`);
        const item = gameTypeOf(r.readBits(10));
        const time = dequantize(r.readBits(TIME_BITS), 0, NetLimits.ActionMaxDuration, TIME_BITS);
        const duration = dequantize(r.readBits(TIME_BITS), 0, NetLimits.ActionMaxDuration, TIME_BITS);
        s.action = { type, item, time, duration };
    }
    if (mask & 256) {
        const weapons: number[] = [];
        for (let n = r.readBits(3); n > 0; n--) {
            weapons.push(dequantize(r.readBits(TIME_BITS), 0, NetLimits.CooldownMax, TIME_BITS));
        }
        s.cooldowns = { weapons, freeSwitch: dequantize(r.readBits(TIME_BITS), 0, NetLimits.CooldownMax, TIME_BITS) };
    }
    if (mask & 512) s.kills = r.readBits(8);
    if (mask & 1024) s.dead = r.readBits(1) === 1;
    if (mask & 2048) s.killedBy = r.readBits(16);
    if (mask & 4096) {
        const kills = r.readBits(8);
        const damageDealt = r.readBits(16);
        const damageTaken = r.readBits(16);
        s.stats = { kills, damageDealt, damageTaken, timeAlive: r.readBits(16) };
    }
    if (mask & 8192) s.spectatorCount = r.readBits(8);
}

/** Deep copy (decoders hand out copies so callers can never corrupt the decoder state). */
export function cloneLocal(s: LocalPlayerState): LocalPlayerState {
    return {
        ...s,
        weapons: s.weapons.map((w) => ({ type: w.type, ammo: w.ammo })),
        inventory: { ...s.inventory },
        action: s.action ? { ...s.action } : undefined,
        cooldowns: s.cooldowns ? { weapons: [...s.cooldowns.weapons], freeSwitch: s.cooldowns.freeSwitch } : undefined,
        stats: s.stats ? { ...s.stats } : undefined,
    };
}
