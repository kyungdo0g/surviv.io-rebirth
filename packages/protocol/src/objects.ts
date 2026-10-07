// Object serialization: every ObjectView kind is described by a field table. A view is first quantized into one
// integer per field (the wire values), which lets the encoder detect changes by comparing integers and lets the
// decoder rebuild the full view from its cached values plus the changed fields.
//
// Fields are either static (group -1: only in full records; a change forces a full record) or belong to one of the
// kind's dynamic groups (sent in partial records when any field of the group changed). A field gated by `when` is
// only written when that earlier static field is non-zero (door state only for doors).
//
// Record layouts (each record starts and ends byte aligned, so servers cache them as bytes):
//   full:    type code 4 bits, id u16, every field in table order
//   partial: id u16, changed-group mask (groupCount bits; omitted when the kind has one group), the fields of the
//            changed groups in table order. Like 0.8.82 there is no type byte: the decoder knows the object.
// Compared with the original fixed partial/full split (netcode.md "Object serialization"), groups make a partial
// record carry only what changed (a moving player: 9 bytes; a gun shot: 6 bytes).
// M9: DeadBody (original ObjectType 5).
import type { BitReader, BitWriter } from "@rebirth/core";
import type {
    ActionType,
    AnimType,
    BuildingView,
    DeadBodyView,
    DecalView,
    HasteName,
    LootView,
    ObjectKind,
    ObjectView,
    ObstacleView,
    PerkView,
    PlayerView,
    StructureView,
} from "@rebirth/sim";
import { NetLimits, OBJECT_TYPE_BITS, ObjectTypeCode } from "./constants.ts";
import {
    dequantize,
    dequantizePos,
    dequantizeUnitVec,
    gameTypeId,
    gameTypeOf,
    MAP_POS_BITS,
    mapTypeId,
    mapTypeOf,
    type NetCtx,
    quantize,
    quantizeUnit,
    quantizeX,
    quantizeY,
} from "./quant.ts";

export interface FieldSpec {
    bits: number;
    /** -1: static (full records only); otherwise the dynamic group index */
    group: number;
    /** index of a static field that must be non-zero for this field to be written, or -1 */
    when: number;
}

export interface ObjectCodec<V extends ObjectView = ObjectView> {
    readonly kind: ObjectKind;
    readonly code: number;
    readonly fields: readonly FieldSpec[];
    readonly groupCount: number;
    /** writes the wire value of every field into `out` */
    quantize(view: V, ctx: NetCtx, out: number[]): void;
    /** rebuilds a view from wire values */
    build(id: number, vals: readonly number[], ctx: NetCtx): V;
}

function f(bits: number, group: number, when = -1): FieldSpec {
    return { bits, group, when };
}

const S = -1;
const P = MAP_POS_BITS;
const GT = 10;
const MT = 12;
const SEQ_BITS = 16;
const SEQ_MASK = 0xffff;
const PLAYER_DIR_BITS = 8;
const SCALE_BITS = 8;
const HEALTH_BITS = 8;
const DURATION_BITS = 8;
const LOOT_COUNT_BITS = 16;
const GORE_BITS = 8;

// "revive" (M6a): code 4 / 3 (the original Anim.Revive is 6 and Action.Revive 4; our codes are list indices)
const ANIM_TYPES: readonly AnimType[] = ["none", "melee", "cook", "throw", "revive"];
const ACTION_TYPES: readonly ActionType[] = ["none", "reload", "use", "revive"];
// original HasteType numbering (None 0, Windwalk 1, Takedown 2, Inspire 3), 2 bits like survev (3 in 0.8.82)
const HASTE_TYPES: readonly HasteName[] = ["none", "windwalk", "takedown", "inspire"];
/** perks per player on the wire (net.ts MaxPerks 8) */
export const MAX_NET_PERKS = 8;
/** index of the first perk field of the player table (role at PERK_FIELD - 1) */
const PERK_FIELD = 26;
/** frozen flag and pose (M7b), after the perk chain */
const FROZEN_FIELD = PERK_FIELD + 2 * MAX_NET_PERKS;
/** the action's alternate-reload bit (visual diff: the original Action.ReloadAlt), in the action group */
const ACTION_ALT_FIELD = FROZEN_FIELD + 2;

function codeOf<T extends string>(list: readonly T[], value: T | undefined): number {
    const i = list.indexOf(value ?? list[0]);
    return i < 0 ? 0 : i;
}

function fromCode<T>(list: readonly T[], code: number, what: string): T {
    const v = list[code];
    if (v === undefined) throw new RangeError(`unknown ${what} code ${code}`);
    return v;
}

const b = (v: boolean | undefined): number => (v ? 1 : 0);
const mapScale = (v: number): number =>
    quantize(v, NetLimits.MapObjectMinScale, NetLimits.MapObjectMaxScale, SCALE_BITS);
const mapScaleOf = (n: number): number =>
    dequantize(n, NetLimits.MapObjectMinScale, NetLimits.MapObjectMaxScale, SCALE_BITS);

/**
 * Player. Groups: 0 movement (pos, dir), 1 status (layer, dead, downed, wearingPan, healEffect (M5b), haste type and
 * seq (M7a), frozen + frozenOri (M7b; the original `frozen b, frozenOri 2 bits`)), 2 active weapon, 3 gear (role and
 * perks (M7a)), 4 scale, 5 animation, 6 action (its alternate-reload bit, the original Action.ReloadAlt, is the
 * table's last field), 7 last shot. Seq counters are sent mod 2^16 (the original used 3 bits). Perks (the original
 * `perks b + array of {type, droppable}`) are a chain of up to 8 slots: a slot's type is written only when the previous
 * slot holds a perk, its droppable bit only when it holds one itself, so a perkless player costs one empty 10-bit type.
 */
export const PlayerCodec: ObjectCodec<PlayerView> = {
    kind: "player",
    code: ObjectTypeCode.Player,
    // biome-ignore format: one field per wire value, grouped as in quantize()
    fields: [
        f(P, 0), f(P, 0), f(PLAYER_DIR_BITS, 0), f(PLAYER_DIR_BITS, 0),
        f(2, 1), f(1, 1), f(1, 1), f(1, 1),
        f(GT, 2),
        f(GT, 3), f(GT, 3), f(GT, 3), f(GT, 3),
        f(SCALE_BITS, 4),
        f(3, 5), f(SEQ_BITS, 5),
        f(3, 6), f(SEQ_BITS, 6), f(GT, 6), f(DURATION_BITS, 6),
        f(SEQ_BITS, 7), f(1, 7),
        f(1, 1),
        f(2, 1), f(SEQ_BITS, 1),
        f(GT, 3),
        ...perkFields(),
        f(1, 1), f(2, 1, FROZEN_FIELD),
        f(1, 6),
    ],
    groupCount: 8,
    quantize(v, ctx, out) {
        out[0] = quantizeX(ctx, v.pos.x);
        out[1] = quantizeY(ctx, v.pos.y);
        out[2] = quantizeUnit(v.dir.x, PLAYER_DIR_BITS);
        out[3] = quantizeUnit(v.dir.y, PLAYER_DIR_BITS);
        out[4] = v.layer & 3;
        out[5] = b(v.dead);
        out[6] = b(v.downed);
        out[7] = b(v.wearingPan);
        out[8] = gameTypeId(v.activeWeapon);
        out[9] = gameTypeId(v.outfit);
        out[10] = gameTypeId(v.helmet);
        out[11] = gameTypeId(v.chest);
        out[12] = gameTypeId(v.backpack);
        out[13] = quantize(v.scale, NetLimits.PlayerMinScale, NetLimits.PlayerMaxScale, SCALE_BITS);
        out[14] = codeOf(ANIM_TYPES, v.anim?.type);
        out[15] = (v.anim?.seq ?? 0) & SEQ_MASK;
        out[16] = codeOf(ACTION_TYPES, v.action?.type);
        out[17] = (v.action?.seq ?? 0) & SEQ_MASK;
        out[18] = gameTypeId(v.action?.item ?? "");
        out[19] = quantize(v.action?.duration ?? 0, 0, NetLimits.ActionMaxDuration, DURATION_BITS);
        out[20] = (v.shot?.seq ?? 0) & SEQ_MASK;
        out[21] = b(v.shot?.offHand);
        out[22] = b(v.healEffect);
        out[23] = codeOf(HASTE_TYPES, v.haste?.type);
        out[24] = (v.haste?.seq ?? 0) & SEQ_MASK;
        out[25] = gameTypeId(v.role ?? "");
        const perks = v.perks ?? [];
        for (let k = 0; k < MAX_NET_PERKS; k++) {
            const perk = k < perks.length ? perks[k] : undefined;
            out[PERK_FIELD + 2 * k] = perk ? gameTypeId(perk.type) : 0;
            out[PERK_FIELD + 2 * k + 1] = b(perk?.droppable);
        }
        out[FROZEN_FIELD] = b(v.frozen);
        out[FROZEN_FIELD + 1] = v.frozen ? (v.frozenOri ?? 0) & 3 : 0;
        out[ACTION_ALT_FIELD] = b(v.action?.alt);
    },
    build(id, v, ctx) {
        return {
            id,
            kind: "player",
            type: "player",
            pos: dequantizePos(ctx, v[0], v[1]),
            layer: v[4],
            dir: dequantizeUnitVec(v[2], v[3], PLAYER_DIR_BITS),
            dead: v[5] === 1,
            downed: v[6] === 1,
            activeWeapon: gameTypeOf(v[8]),
            outfit: gameTypeOf(v[9]),
            helmet: gameTypeOf(v[10]),
            chest: gameTypeOf(v[11]),
            backpack: gameTypeOf(v[12]),
            scale: dequantize(v[13], NetLimits.PlayerMinScale, NetLimits.PlayerMaxScale, SCALE_BITS),
            anim: { type: fromCode(ANIM_TYPES, v[14], "anim"), seq: v[15] },
            action: {
                type: fromCode(ACTION_TYPES, v[16], "action"),
                seq: v[17],
                item: gameTypeOf(v[18]),
                duration: dequantize(v[19], 0, NetLimits.ActionMaxDuration, DURATION_BITS),
                alt: v[ACTION_ALT_FIELD] === 1,
            },
            shot: { seq: v[20], offHand: v[21] === 1 },
            wearingPan: v[7] === 1,
            healEffect: v[22] === 1,
            role: gameTypeOf(v[25]),
            perks: perksOf(v),
            haste: { type: fromCode(HASTE_TYPES, v[23], "haste"), seq: v[24] },
            frozen: v[FROZEN_FIELD] === 1,
            frozenOri: v[FROZEN_FIELD + 1],
        };
    },
};

/** The perk slot chain of the player table: type gated by the previous slot's type, droppable by its own type. */
function perkFields(): FieldSpec[] {
    const out: FieldSpec[] = [];
    for (let k = 0; k < MAX_NET_PERKS; k++) {
        const type = PERK_FIELD + 2 * k;
        out.push(f(GT, 3, k === 0 ? -1 : type - 2), f(1, 3, type));
    }
    return out;
}

function perksOf(v: readonly number[]): PerkView[] {
    const out: PerkView[] = [];
    for (let k = 0; k < MAX_NET_PERKS; k++) {
        const id = v[PERK_FIELD + 2 * k];
        if (id === 0) break;
        out.push({ type: gameTypeOf(id), droppable: v[PERK_FIELD + 2 * k + 1] === 1 });
    }
    return out;
}

/**
 * Obstacle. Static: type, pos, ori, layer, isDoor, isButton, isSkin [+ skinPlayerId u16] (the original full record's
 * disguise bit and wearer id; survev content wave). Groups: 0 scale, 1 health (healthT, dead), 2 door state (open,
 * locked, canUse, seq mod 2^16 (M5b)), 3 button state (onOff, canUse, seq mod 2^16; M4). A door that opens or closes
 * and a disguise that follows its wearer move, which changes static fields: they are sent as a full record (like
 * survev's setDirty).
 */
export const ObstacleCodec: ObjectCodec<ObstacleView> = {
    kind: "obstacle",
    code: ObjectTypeCode.Obstacle,
    // biome-ignore format: one field per wire value
    fields: [
        f(MT, S), f(P, S), f(P, S), f(2, S), f(2, S), f(1, S),
        f(SCALE_BITS, 0),
        f(HEALTH_BITS, 1), f(1, 1),
        f(1, 2, 5), f(1, 2, 5), f(1, 2, 5),
        f(1, S),
        f(1, 3, 12), f(1, 3, 12), f(SEQ_BITS, 3, 12),
        f(SEQ_BITS, 2, 5),
        f(1, S), f(16, S, 17),
    ],
    groupCount: 4,
    quantize(v, ctx, out) {
        out[0] = mapTypeId(v.type);
        out[1] = quantizeX(ctx, v.pos.x);
        out[2] = quantizeY(ctx, v.pos.y);
        out[3] = v.ori & 3;
        out[4] = v.layer & 3;
        out[5] = b(v.door !== undefined);
        out[6] = mapScale(v.scale);
        out[7] = quantize(v.healthT, 0, 1, HEALTH_BITS);
        out[8] = b(v.dead);
        out[9] = b(v.door?.open);
        out[10] = b(v.door?.locked);
        out[11] = b(v.door?.canUse);
        out[12] = b(v.button !== undefined);
        out[13] = b(v.button?.onOff);
        out[14] = b(v.button?.canUse);
        out[15] = (v.button?.seq ?? 0) & SEQ_MASK;
        out[16] = (v.door?.seq ?? 0) & SEQ_MASK;
        out[17] = b(v.skinPlayerId !== undefined);
        out[18] = (v.skinPlayerId ?? 0) & 0xffff;
    },
    build(id, v, ctx) {
        const view: ObstacleView = {
            id,
            kind: "obstacle",
            type: mapTypeOf(v[0]),
            pos: dequantizePos(ctx, v[1], v[2]),
            layer: v[4],
            ori: v[3],
            scale: mapScaleOf(v[6]),
            healthT: dequantize(v[7], 0, 1, HEALTH_BITS),
            dead: v[8] === 1,
        };
        if (v[5] === 1) view.door = { open: v[9] === 1, locked: v[10] === 1, canUse: v[11] === 1, seq: v[16] };
        if (v[12] === 1) view.button = { onOff: v[13] === 1, canUse: v[14] === 1, seq: v[15] };
        if (v[17] === 1) view.skinPlayerId = v[18];
        return view;
    },
};

/**
 * Building. Static: type, pos, ori, layer, hasPuzzle. Group 0: occupied, ceilingDead, ceilingDamaged,
 * occupiedDisabled (M5b). Group 1 (buildings with a puzzle, M5b): solved, errSeq mod 2^16 (the original sent the
 * same puzzle pair).
 */
export const BuildingCodec: ObjectCodec<BuildingView> = {
    kind: "building",
    code: ObjectTypeCode.Building,
    // biome-ignore format: one field per wire value
    fields: [
        f(MT, S), f(P, S), f(P, S), f(2, S), f(2, S),
        f(1, 0), f(1, 0), f(1, 0), f(1, 0),
        f(1, S), f(1, 1, 9), f(SEQ_BITS, 1, 9),
    ],
    groupCount: 2,
    quantize(v, ctx, out) {
        out[0] = mapTypeId(v.type);
        out[1] = quantizeX(ctx, v.pos.x);
        out[2] = quantizeY(ctx, v.pos.y);
        out[3] = v.ori & 3;
        out[4] = v.layer & 3;
        out[5] = b(v.occupied);
        out[6] = b(v.ceilingDead);
        out[7] = b(v.ceilingDamaged);
        out[8] = b(v.occupiedDisabled);
        out[9] = b(v.puzzle !== undefined);
        out[10] = b(v.puzzle?.solved);
        out[11] = (v.puzzle?.errSeq ?? 0) & SEQ_MASK;
    },
    build(id, v, ctx) {
        const view: BuildingView = {
            id,
            kind: "building",
            type: mapTypeOf(v[0]),
            pos: dequantizePos(ctx, v[1], v[2]),
            layer: v[4],
            ori: v[3],
            occupied: v[5] === 1,
            ceilingDead: v[6] === 1,
            ceilingDamaged: v[7] === 1,
            occupiedDisabled: v[8] === 1,
        };
        if (v[9] === 1) view.puzzle = { solved: v[10] === 1, errSeq: v[11] };
        return view;
    },
};

/** Structure. Static: type, pos, ori, layer. Group 0: interiorSoundAlt (M5b; the original sent it too). */
export const StructureCodec: ObjectCodec<StructureView> = {
    kind: "structure",
    code: ObjectTypeCode.Structure,
    fields: [f(MT, S), f(P, S), f(P, S), f(2, S), f(2, S), f(1, 0)],
    groupCount: 1,
    quantize(v, ctx, out) {
        out[0] = mapTypeId(v.type);
        out[1] = quantizeX(ctx, v.pos.x);
        out[2] = quantizeY(ctx, v.pos.y);
        out[3] = v.ori & 3;
        out[4] = v.layer & 3;
        out[5] = b(v.interiorSoundAlt);
    },
    build(id, v, ctx) {
        return {
            id,
            kind: "structure",
            type: mapTypeOf(v[0]),
            pos: dequantizePos(ctx, v[1], v[2]),
            layer: v[4],
            ori: v[3],
            interiorSoundAlt: v[5] === 1,
        };
    },
};

/** Decal. Static: type, pos, ori, layer, scale. Group 0: goreKills u8 (M5b; the original sent it too). */
export const DecalCodec: ObjectCodec<DecalView> = {
    kind: "decal",
    code: ObjectTypeCode.Decal,
    fields: [f(MT, S), f(P, S), f(P, S), f(2, S), f(2, S), f(SCALE_BITS, S), f(GORE_BITS, 0)],
    groupCount: 1,
    quantize(v, ctx, out) {
        out[0] = mapTypeId(v.type);
        out[1] = quantizeX(ctx, v.pos.x);
        out[2] = quantizeY(ctx, v.pos.y);
        out[3] = v.ori & 3;
        out[4] = v.layer & 3;
        out[5] = mapScale(v.scale);
        out[6] = Math.min(Math.max(Math.round(v.goreKills ?? 0), 0), 2 ** GORE_BITS - 1);
    },
    build(id, v, ctx) {
        return {
            id,
            kind: "decal",
            type: mapTypeOf(v[0]),
            pos: dequantizePos(ctx, v[1], v[2]),
            layer: v[4],
            ori: v[3],
            scale: mapScaleOf(v[5]),
            goreKills: v[6],
        };
    },
};

/**
 * Loot. Static: type, isPreloadedGun (M9; the original LootMsg bit). Groups: 0 pos, 1 count and layer (count is u16:
 * dropped ammo stacks exceed 255).
 */
export const LootCodec: ObjectCodec<LootView> = {
    kind: "loot",
    code: ObjectTypeCode.Loot,
    fields: [f(GT, S), f(P, 0), f(P, 0), f(LOOT_COUNT_BITS, 1), f(2, 1), f(1, S)],
    groupCount: 2,
    quantize(v, ctx, out) {
        out[0] = gameTypeId(v.type);
        out[1] = quantizeX(ctx, v.pos.x);
        out[2] = quantizeY(ctx, v.pos.y);
        out[3] = Math.min(Math.max(Math.round(v.count), 0), 2 ** LOOT_COUNT_BITS - 1);
        out[4] = v.layer & 3;
        out[5] = v.isPreloadedGun ? 1 : 0;
    },
    build(id, v, ctx) {
        return {
            id,
            kind: "loot",
            type: gameTypeOf(v[0]),
            pos: dequantizePos(ctx, v[1], v[2]),
            layer: v[4],
            count: v[3],
            ...(v[5] === 1 ? { isPreloadedGun: true } : {}),
        };
    },
};

/**
 * Dead body (M9). Static: layer, playerId u16 (the original full record: layer u8, playerId u16; a layer change on
 * stairs is a full record, like survev's setDirty). Group 0: pos (the original partial record).
 */
export const DeadBodyCodec: ObjectCodec<DeadBodyView> = {
    kind: "deadBody",
    code: ObjectTypeCode.DeadBody,
    fields: [f(P, 0), f(P, 0), f(2, S), f(16, S)],
    groupCount: 1,
    quantize(v, ctx, out) {
        out[0] = quantizeX(ctx, v.pos.x);
        out[1] = quantizeY(ctx, v.pos.y);
        out[2] = v.layer & 3;
        out[3] = v.playerId & 0xffff;
    },
    build(id, v, ctx) {
        return {
            id,
            kind: "deadBody",
            type: "deadBody",
            pos: dequantizePos(ctx, v[0], v[1]),
            layer: v[2],
            playerId: v[3],
        };
    },
};

export const CODECS: Readonly<Record<ObjectKind, ObjectCodec>> = {
    player: PlayerCodec as ObjectCodec,
    obstacle: ObstacleCodec as ObjectCodec,
    building: BuildingCodec as ObjectCodec,
    structure: StructureCodec as ObjectCodec,
    decal: DecalCodec as ObjectCodec,
    loot: LootCodec as ObjectCodec,
    deadBody: DeadBodyCodec as ObjectCodec,
};

const BY_CODE = new Map<number, ObjectCodec>(Object.values(CODECS).map((c) => [c.code, c]));

export function codecOf(kind: ObjectKind): ObjectCodec {
    const c = CODECS[kind];
    if (!c) throw new RangeError(`unknown object kind "${kind}"`);
    return c;
}

export function codecByCode(code: number): ObjectCodec {
    const c = BY_CODE.get(code);
    if (!c) throw new RangeError(`unknown object type code ${code}`);
    return c;
}

function writeFields(w: BitWriter, codec: ObjectCodec, vals: readonly number[], mask: number): void {
    const fields = codec.fields;
    for (let i = 0; i < fields.length; i++) {
        const fs = fields[i];
        if (fs.group < 0 ? mask !== -1 : mask !== -1 && (mask & (1 << fs.group)) === 0) continue;
        if (fs.when >= 0 && vals[fs.when] === 0) continue;
        w.writeBits(vals[i], fs.bits);
    }
}

function readFields(r: BitReader, codec: ObjectCodec, vals: number[], mask: number): void {
    const fields = codec.fields;
    for (let i = 0; i < fields.length; i++) {
        const fs = fields[i];
        if (fs.group < 0 ? mask !== -1 : mask !== -1 && (mask & (1 << fs.group)) === 0) continue;
        if (fs.when >= 0 && vals[fs.when] === 0) {
            vals[i] = 0;
            continue;
        }
        vals[i] = r.readBits(fs.bits);
    }
}

/** Full record (type code, id, all fields), unaligned; callers align. */
export function writeFullRecord(w: BitWriter, codec: ObjectCodec, id: number, vals: readonly number[]): void {
    w.writeBits(codec.code, OBJECT_TYPE_BITS);
    w.writeUint16(id);
    writeFields(w, codec, vals, -1);
}

/** Partial record (id, group mask, changed groups); `mask` must be non-zero. */
export function writePartRecord(w: BitWriter, codec: ObjectCodec, id: number, vals: readonly number[], mask: number) {
    w.writeUint16(id);
    if (codec.groupCount > 1) w.writeBits(mask, codec.groupCount);
    writeFields(w, codec, vals, mask);
}

/** Reads a full record after its type code and id; returns the wire values. */
export function readFullFields(r: BitReader, codec: ObjectCodec): number[] {
    const vals: number[] = new Array(codec.fields.length).fill(0);
    readFields(r, codec, vals, -1);
    return vals;
}

/** Reads a partial record's mask and fields into `vals` (after the id). */
export function readPartFields(r: BitReader, codec: ObjectCodec, vals: number[]): void {
    if (codec.groupCount === 0) throw new RangeError(`partial record for ${codec.kind}, which has no dynamic fields`);
    const mask = codec.groupCount > 1 ? r.readBits(codec.groupCount) : 1;
    if (mask === 0) throw new RangeError(`empty partial record for ${codec.kind}`);
    readFields(r, codec, vals, mask);
}

/** Mask of the groups whose values differ, or -1 when a static field differs (a full record is needed). */
export function diffMask(codec: ObjectCodec, prev: readonly number[], cur: readonly number[]): number {
    let mask = 0;
    const fields = codec.fields;
    for (let i = 0; i < fields.length; i++) {
        if (prev[i] === cur[i]) continue;
        const g = fields[i].group;
        if (g < 0) return -1;
        mask |= 1 << g;
    }
    return mask;
}
