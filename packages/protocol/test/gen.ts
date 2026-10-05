// Random value generators for the round-trip property tests (seeded, so failures reproduce) and the quantization
// tolerances of every field.
import type { Rng, Vec2 } from "@rebirth/core";
import { GameObjectRegistry, MapObjectRegistry } from "@rebirth/defs";
import type { BulletEvent, LocalPlayerState, MapData, ObjectView, PlayerInput, Snapshot } from "@rebirth/sim";
import { BAG_ITEMS, type NetCtx } from "../src/index.ts";
import { type TolFn, tolTable } from "./close.ts";

export const GAME_TYPES = GameObjectRegistry.types;
export const MAP_TYPES = MapObjectRegistry.types;

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.!?éü日本";

export function randString(rng: Rng, maxBytes: number): string {
    const enc = new TextEncoder();
    let s = "";
    const len = rng.int(0, maxBytes);
    for (let i = 0; i < len; i++) {
        const next = s + rng.pick(CHARS.split(""));
        if (enc.encode(next).length > maxBytes) break;
        s = next;
    }
    return s;
}

export function randUnit(rng: Rng): Vec2 {
    const a = rng.range(0, Math.PI * 2);
    return { x: Math.cos(a), y: Math.sin(a) };
}

export function randPos(rng: Rng, ctx: NetCtx): Vec2 {
    return { x: rng.range(0, ctx.width), y: rng.range(0, ctx.height) };
}

export function randCtx(rng: Rng): NetCtx {
    return { width: rng.pick([128, 720, 768, 880, 1024]), height: rng.pick([128, 720, 768, 880, 1024]) };
}

export function randGameType(rng: Rng): string {
    return rng.pick(GAME_TYPES);
}

export function randMapType(rng: Rng): string {
    return rng.pick(MAP_TYPES);
}

export function randView(rng: Rng, ctx: NetCtx, id: number, kind = rng.pick(KINDS)): ObjectView {
    const pos = randPos(rng, ctx);
    const layer = rng.int(0, 3);
    switch (kind) {
        case "player":
            return {
                id,
                kind,
                type: "player",
                pos,
                layer,
                dir: randUnit(rng),
                dead: rng.bool(0.2),
                downed: rng.bool(0.2),
                activeWeapon: randGameType(rng),
                outfit: randGameType(rng),
                helmet: randGameType(rng),
                chest: randGameType(rng),
                backpack: randGameType(rng),
                scale: rng.range(0.75, 2),
                anim: { type: rng.pick(["none", "melee", "cook", "throw"] as const), seq: rng.int(0, 65535) },
                action: {
                    type: rng.pick(["none", "reload", "use"] as const),
                    seq: rng.int(0, 65535),
                    item: randGameType(rng),
                    duration: rng.range(0, 8.5),
                },
                shot: { seq: rng.int(0, 65535), offHand: rng.bool() },
                wearingPan: rng.bool(),
            };
        case "obstacle": {
            const view: ObjectView = {
                id,
                kind,
                type: randMapType(rng),
                pos,
                layer,
                ori: rng.int(0, 3),
                scale: rng.range(0.125, 2.5),
                healthT: rng.next(),
                dead: rng.bool(0.2),
            };
            if (rng.bool(0.3)) view.door = { open: rng.bool(), locked: rng.bool(), canUse: rng.bool() };
            return view;
        }
        case "building":
            return {
                id,
                kind,
                type: randMapType(rng),
                pos,
                layer,
                ori: rng.int(0, 3),
                occupied: rng.bool(),
                ceilingDead: rng.bool(),
                ceilingDamaged: rng.bool(),
            };
        case "structure":
            return { id, kind, type: randMapType(rng), pos, layer, ori: rng.int(0, 3) };
        case "decal":
            return { id, kind, type: randMapType(rng), pos, layer, ori: rng.int(0, 3), scale: rng.range(0.125, 2.5) };
        case "loot":
            return { id, kind, type: randGameType(rng), pos, layer, count: rng.int(0, 65535) };
    }
}

export const KINDS = ["player", "obstacle", "building", "structure", "decal", "loot"] as const;

/** A view with some fields changed (same id and kind; static fields change rarely). */
export function mutateView(rng: Rng, ctx: NetCtx, view: ObjectView): ObjectView {
    if (rng.bool(0.1)) return randView(rng, ctx, view.id, view.kind);
    const fresh = randView(rng, ctx, view.id, view.kind) as unknown as Record<string, unknown>;
    const out = structuredClone(view) as unknown as Record<string, unknown>;
    const keys = Object.keys(fresh).filter((k) => k !== "id" && k !== "kind" && k !== "type");
    for (let n = rng.int(0, 3); n > 0; n--) {
        const k = rng.pick(keys);
        out[k] = fresh[k];
    }
    if (view.kind === "obstacle" && rng.bool(0.5)) out.door = (view as { door?: unknown }).door;
    return out as unknown as ObjectView;
}

export function randLocal(rng: Rng): LocalPlayerState {
    const inventory: Record<string, number> = {};
    for (const item of BAG_ITEMS) inventory[item] = rng.bool(0.5) ? 0 : rng.int(1, 511);
    const nWeapons = rng.bool(0.9) ? 4 : rng.int(0, 7);
    return {
        health: rng.range(0, 100),
        boost: rng.range(0, 100),
        zoom: rng.int(0, 255),
        layer: rng.int(0, 3),
        weapons: Array.from({ length: nWeapons }, () => ({ type: randGameType(rng), ammo: rng.int(0, 255) })),
        curWeapIdx: rng.int(0, 3),
        inventory,
        scope: randGameType(rng),
        outfit: randGameType(rng),
        helmet: randGameType(rng),
        chest: randGameType(rng),
        backpack: randGameType(rng),
        action: {
            type: rng.pick(["none", "reload", "use"] as const),
            item: randGameType(rng),
            time: rng.range(0, 8.5),
            duration: rng.range(0, 8.5),
        },
        cooldowns: {
            weapons: Array.from({ length: rng.int(0, 7) }, () => rng.range(0, 4)),
            freeSwitch: rng.range(0, 4),
        },
        kills: rng.int(0, 255),
        dead: rng.bool(),
        killedBy: rng.int(0, 65535),
    };
}

/** Changes some sections of a local state. */
export function mutateLocal(rng: Rng, s: LocalPlayerState): LocalPlayerState {
    const fresh = randLocal(rng) as unknown as Record<string, unknown>;
    const out = structuredClone(s) as unknown as Record<string, unknown>;
    const keys = Object.keys(fresh);
    for (let n = rng.int(0, 4); n > 0; n--) {
        const k = rng.pick(keys);
        out[k] = fresh[k];
    }
    return out as unknown as LocalPlayerState;
}

export function randBullets(rng: Rng, ctx: NetCtx): BulletEvent[] {
    const out: BulletEvent[] = [];
    let id = rng.int(0, 2 ** 24 - 100);
    for (let n = rng.bool(0.3) ? 0 : rng.int(1, 30); n > 0; n--) {
        id = rng.bool(0.7) ? id + rng.int(1, 3) : rng.int(0, 2 ** 24 - 1);
        const b: BulletEvent = {
            id,
            shooterId: rng.int(0, 65535),
            bulletType: randGameType(rng),
            sourceType: randGameType(rng),
            pos: randPos(rng, ctx),
            dir: randUnit(rng),
            layer: rng.int(0, 3),
            maxDist: rng.range(0, 1024),
            reflectCount: rng.int(0, 3),
            hitPlayer: rng.bool(),
            shotFx: rng.bool(),
            offHand: rng.bool(),
        };
        if (rng.bool(0.4)) b.endDist = rng.range(0, 1024);
        out.push(b);
    }
    return out;
}

export function randInput(rng: Rng): PlayerInput {
    return {
        seq: rng.int(0, 255),
        moveLeft: rng.bool(),
        moveRight: rng.bool(),
        moveUp: rng.bool(),
        moveDown: rng.bool(),
        toMouseDir: randUnit(rng),
        toMouseLen: rng.range(0, 64),
        shootStart: rng.bool(),
        shootHold: rng.bool(),
        actions: Array.from({ length: rng.int(0, 15) }, () => rng.int(0, 255)),
    };
}

export function randMap(rng: Rng): MapData {
    const ctx = randCtx(rng);
    let id = rng.int(0, 100);
    return {
        mapName: randString(rng, 24),
        seed: rng.int(0, 2 ** 32 - 1),
        width: ctx.width,
        height: ctx.height,
        shoreInset: rng.int(-2, 80),
        grassInset: rng.int(0, 50),
        rivers: Array.from({ length: rng.int(0, 3) }, () => ({
            width: rng.pick([4, 8, 12, 16, 3.5]),
            looped: rng.bool(),
            points: Array.from({ length: rng.int(0, 40) }, () => randPos(rng, ctx)),
        })),
        places: Array.from({ length: rng.int(0, 8) }, () => ({
            name: randString(rng, 30),
            pos: { x: rng.next(), y: rng.next() },
        })),
        groundPatches: Array.from({ length: rng.int(0, 5) }, () => ({
            min: randPos(rng, ctx),
            max: randPos(rng, ctx),
            color: rng.int(0, 2 ** 32 - 1),
            roughness: rng.pick([0, 0.05, 0.1]),
            offsetDist: rng.pick([0, 0.5, 1.5]),
            order: rng.int(0, 127),
            useAsMapShape: rng.bool(),
        })),
        objects: Array.from({ length: rng.int(0, 40) }, () => {
            id = rng.bool(0.8) ? id + 1 : id + rng.int(2, 500);
            return {
                id: id & 0xffff,
                type: randMapType(rng),
                pos: randPos(rng, ctx),
                ori: rng.int(0, 3),
                scale: rng.range(0.125, 2.5),
                layer: rng.int(0, 3),
            };
        }),
    };
}

/** Quantization tolerances (half a quantization step, rounded up) for maps whose extent is at most `maxExtent`. */
export function netTolerances(maxExtent = 1024): TolFn {
    const pos = maxExtent / 65535 / 2 + 1e-9;
    return tolTable({
        "pos.x": pos,
        "pos.y": pos,
        "min.x": pos,
        "min.y": pos,
        "max.x": pos,
        "max.y": pos,
        "points.x": pos,
        "points.y": pos,
        "places.pos.x": 1 / 65535 / 2 + 1e-12,
        "places.pos.y": 1 / 65535 / 2 + 1e-12,
        "dir.x": 0.006,
        "dir.y": 0.006,
        "toMouseDir.x": 0.0015,
        "toMouseDir.y": 0.0015,
        "bullets.dir.x": 0.0015,
        "bullets.dir.y": 0.0015,
        toMouseLen: 64 / 255 / 2 + 1e-9,
        scale: 2.375 / 255 / 2 + 1e-9,
        healthT: 1 / 255 / 2 + 1e-9,
        duration: 8.5 / 255 / 2 + 1e-9,
        time: 8.5 / 255 / 2 + 1e-9,
        health: 100 / 255 / 2 + 1e-9,
        boost: 100 / 255 / 2 + 1e-9,
        "cooldowns.weapons": 4 / 255 / 2 + 1e-9,
        freeSwitch: 4 / 255 / 2 + 1e-9,
        maxDist: 1024 / 65535 / 2 + 1e-9,
        endDist: 1024 / 65535 / 2 + 1e-9,
        width: 1e-5,
        roughness: 1e-6,
        offsetDist: 1e-6,
    });
}

/** Snapshot tolerance: like netTolerances, plus the snapshot-level `time` derived from the tick. */
export function snapshotTolerances(maxExtent = 1024): TolFn {
    const base = netTolerances(maxExtent);
    return (path) => (path.length === 1 && path[0] === "time" ? 1e-9 : base(path));
}

export type { Snapshot };
