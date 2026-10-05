// Random value generators for the round-trip property tests (seeded, so failures reproduce) and the quantization
// tolerances of every field.
import type { Rng, Vec2 } from "@rebirth/core";
import { GameObjectRegistry, MapObjectRegistry } from "@rebirth/defs";
import {
    type AirdropView,
    type AirstrikeZoneView,
    type BulletEvent,
    damageSourceOf,
    type ExplosionEvent,
    type GameOverEvent,
    type GasView,
    type KillEvent,
    type LocalPlayerState,
    type MapData,
    type MapIndicatorView,
    type ObjectView,
    type PlaneView,
    type PlayerInfoView,
    type PlayerInput,
    type PlayerStatsView,
    type ProjectileView,
    type RecorderEvent,
    type RoleAnnouncementEvent,
    type SmokeView,
    type Snapshot,
} from "@rebirth/sim";
import { BAG_ITEMS, type NetCtx, recorderSound } from "../src/index.ts";
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
                anim: { type: rng.pick(["none", "melee", "cook", "throw", "revive"] as const), seq: rng.int(0, 65535) },
                action: {
                    type: rng.pick(["none", "reload", "use", "revive"] as const),
                    seq: rng.int(0, 65535),
                    item: randGameType(rng),
                    duration: rng.range(0, 8.5),
                },
                shot: { seq: rng.int(0, 65535), offHand: rng.bool() },
                wearingPan: rng.bool(),
                healEffect: rng.bool(0.2),
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
            if (rng.bool(0.3)) {
                view.door = { open: rng.bool(), locked: rng.bool(), canUse: rng.bool(), seq: rng.int(0, 65535) };
            }
            if (rng.bool(0.2)) view.button = { onOff: rng.bool(), canUse: rng.bool(), seq: rng.int(0, 65535) };
            return view;
        }
        case "building": {
            const view: ObjectView = {
                id,
                kind,
                type: randMapType(rng),
                pos,
                layer,
                ori: rng.int(0, 3),
                occupied: rng.bool(),
                ceilingDead: rng.bool(),
                ceilingDamaged: rng.bool(),
                occupiedDisabled: rng.bool(0.2),
            };
            if (rng.bool(0.3)) view.puzzle = { solved: rng.bool(), errSeq: rng.int(0, 65535) };
            return view;
        }
        case "structure":
            return { id, kind, type: randMapType(rng), pos, layer, ori: rng.int(0, 3), interiorSoundAlt: rng.bool() };
        case "decal":
            return {
                id,
                kind,
                type: randMapType(rng),
                pos,
                layer,
                ori: rng.int(0, 3),
                scale: rng.range(0.125, 2.5),
                goreKills: rng.bool(0.8) ? 0 : rng.int(0, 255),
            };
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
    if (view.kind === "obstacle" && rng.bool(0.5)) out.button = (view as { button?: unknown }).button;
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
            type: rng.pick(["none", "reload", "use", "revive"] as const),
            item: randGameType(rng),
            time: rng.range(0, 8.5),
            duration: rng.range(0, 8.5),
            targetId: rng.bool(0.7) ? 0 : rng.int(1, 65535),
        },
        cooldowns: {
            weapons: Array.from({ length: rng.int(0, 7) }, () => rng.range(0, 4)),
            freeSwitch: rng.range(0, 4),
        },
        kills: rng.int(0, 255),
        dead: rng.bool(),
        killedBy: rng.int(0, 65535),
        stats: {
            kills: rng.int(0, 255),
            damageDealt: rng.int(0, 65535),
            damageTaken: rng.int(0, 65535),
            timeAlive: rng.int(0, 65535),
        },
        spectatorCount: rng.int(0, 255),
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

// M4 match state and events

export function randGas(rng: Rng, ctx: NetCtx): GasView {
    return {
        mode: rng.pick(["inactive", "waiting", "moving"] as const),
        stage: rng.int(0, 17),
        circleIdx: rng.int(-1, 7),
        duration: rng.pick([0, 80, 30, 65, 25, 50, 20, 40, 15, 10, 5, 6]),
        gasT: rng.next(),
        posOld: randPos(rng, ctx),
        posNew: randPos(rng, ctx),
        radOld: rng.range(0, 1000),
        radNew: rng.range(0, 1000),
        damage: rng.pick([0, 1.4, 2.2, 3.5, 7.5, 10, 14, 22]),
    };
}

export function randPlanes(rng: Rng): PlaneView[] {
    return Array.from({ length: rng.bool(0.6) ? 0 : rng.int(1, 4) }, () => ({
        id: rng.int(1, 255),
        pos: { x: rng.range(-256, 1280), y: rng.range(-256, 1280) },
        dir: randUnit(rng),
        planeType: rng.pick(["airdrop", "airstrike"] as const),
        actionComplete: rng.bool(),
    }));
}

export function randAirdrops(rng: Rng, ctx: NetCtx, ids: { v: number }): AirdropView[] {
    return Array.from({ length: rng.bool(0.6) ? 0 : rng.int(1, 3) }, () => ({
        id: ids.v++ & 0xffff,
        pos: randPos(rng, ctx),
        fallT: rng.next(),
        landed: rng.bool(0.2),
    }));
}

export function randIndicator(rng: Rng, ctx: NetCtx, id: number): MapIndicatorView {
    return { id, type: randGameType(rng), pos: randPos(rng, ctx), dead: false, equipped: rng.bool(0.2) };
}

/**
 * Next indicator list from the live ones (`live`, updated in place): some die (listed dead once), some move, some
 * appear with a free id.
 */
export function evolveIndicators(rng: Rng, ctx: NetCtx, live: Map<number, MapIndicatorView>): MapIndicatorView[] {
    const out: MapIndicatorView[] = [];
    for (const [id, ind] of live) {
        if (rng.bool(0.2)) {
            out.push({ ...ind, dead: true });
            live.delete(id);
        } else if (rng.bool(0.3)) {
            live.set(id, { ...ind, pos: randPos(rng, ctx), equipped: rng.bool(0.2) });
        }
    }
    for (let n = rng.int(0, 2); n > 0; n--) {
        const free = Array.from({ length: 16 }, (_, i) => i).filter(
            (i) => !live.has(i) && !out.some((o) => o.id === i),
        );
        if (free.length === 0) break;
        const id = rng.pick(free);
        live.set(id, randIndicator(rng, ctx, id));
    }
    out.push(...live.values());
    return out.map((m) => ({ ...m, pos: { ...m.pos } })).sort((a, b) => a.id - b.id);
}

export function randKills(rng: Rng): KillEvent[] {
    return Array.from({ length: rng.bool(0.7) ? 0 : rng.int(1, 4) }, () => {
        const damageType = rng.int(0, 4);
        const itemSourceType = rng.bool(0.3) ? "" : randGameType(rng);
        const mapSourceType = rng.bool(0.8) ? "" : randMapType(rng);
        return {
            targetId: rng.int(1, 65535),
            killerId: rng.int(0, 65535),
            killCreditId: rng.int(0, 65535),
            killerKills: rng.int(0, 255),
            damageType,
            source: damageSourceOf(damageType, itemSourceType, mapSourceType),
            itemSourceType,
            mapSourceType,
            downed: rng.bool(0.2),
            killed: rng.bool(0.8),
        };
    });
}

export function randRoles(rng: Rng): RoleAnnouncementEvent[] {
    return Array.from({ length: rng.bool(0.8) ? 0 : rng.int(1, 2) }, () => ({
        playerId: rng.int(1, 65535),
        killerId: rng.int(0, 65535),
        role: rng.pick(["kill_leader", "the_hunted", "leader"]),
        assigned: rng.bool(),
        killed: rng.bool(),
    }));
}

export function randStats(rng: Rng): PlayerStatsView {
    return {
        playerId: rng.int(1, 65535),
        timeAlive: rng.int(0, 65535),
        kills: rng.int(0, 255),
        dead: rng.bool(),
        damageDealt: rng.int(0, 65535),
        damageTaken: rng.int(0, 65535),
    };
}

export function randGameOver(rng: Rng): GameOverEvent {
    return {
        teamId: rng.int(1, 255),
        teamRank: rng.int(1, 80),
        gameOver: rng.bool(),
        winningTeamId: rng.int(0, 255),
        playerStats: Array.from({ length: rng.int(1, 4) }, () => randStats(rng)),
    };
}

export function randPlayerInfos(rng: Rng): PlayerInfoView[] {
    return Array.from({ length: rng.bool(0.7) ? 0 : rng.int(1, 5) }, () => ({
        playerId: rng.int(1, 65535),
        teamId: rng.int(0, 255),
        groupId: rng.int(0, 255),
        name: randString(rng, 16),
    }));
}

// M5 effects

export function randExplosions(rng: Rng, ctx: NetCtx): ExplosionEvent[] {
    return Array.from({ length: rng.bool(0.7) ? 0 : rng.int(1, 6) }, () => ({
        type: randGameType(rng),
        pos: randPos(rng, ctx),
        layer: rng.int(0, 3),
    }));
}

export function randProjectiles(rng: Rng, ctx: NetCtx): ProjectileView[] {
    return Array.from({ length: rng.bool(0.6) ? 0 : rng.int(1, 12) }, () => ({
        id: rng.int(1, 65535),
        type: randGameType(rng),
        pos: randPos(rng, ctx),
        posZ: rng.range(0, 5),
        dir: randUnit(rng),
        layer: rng.int(0, 3),
    }));
}

export function randSmokes(rng: Rng, ctx: NetCtx): SmokeView[] {
    return Array.from({ length: rng.bool(0.6) ? 0 : rng.int(1, 11) }, () => ({
        id: rng.int(1, 65535),
        pos: randPos(rng, ctx),
        rad: rng.range(0, 6.5),
        layer: rng.int(0, 3),
        interior: rng.bool(0.3),
    }));
}

export function randZones(rng: Rng, ctx: NetCtx): AirstrikeZoneView[] {
    return Array.from({ length: rng.bool(0.8) ? 0 : rng.int(1, 3) }, () => ({
        id: rng.int(1, 255),
        pos: randPos(rng, ctx),
        rad: rng.range(0, 256),
        duration: rng.range(0, 60),
        zoneT: rng.next(),
    }));
}

/** Recorder events: map types that are recorders, so the decoder's sound lookup matches (M5b). */
export function randRecorders(rng: Rng, ctx: NetCtx): RecorderEvent[] {
    const recorders = MAP_TYPES.filter((t) => t.startsWith("recorder_"));
    return Array.from({ length: rng.bool(0.8) ? 0 : rng.int(1, 3) }, () => {
        const type = rng.pick(recorders);
        return {
            id: rng.int(1, 65535),
            type,
            sound: recorderSound(type),
            pos: randPos(rng, ctx),
            layer: rng.int(0, 3),
        };
    });
}

export function randInput(rng: Rng): PlayerInput {
    const input: PlayerInput = {
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
    if (rng.bool(0.3)) input.useItem = rng.pick(GAME_TYPES.filter((t) => t !== ""));
    return input;
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
        "posOld.x": pos,
        "posOld.y": pos,
        "posNew.x": pos,
        "posNew.y": pos,
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
        "gas.duration": 1e-5,
        "gas.damage": 1e-5,
        "gas.gasT": 1 / 65535 / 2 + 1e-9,
        radOld: 2048 / 65535 / 2 + 1e-9,
        radNew: 2048 / 65535 / 2 + 1e-9,
        "planes.pos.x": 2048 / 1023 / 2 + 1e-9,
        "planes.pos.y": 2048 / 1023 / 2 + 1e-9,
        "planes.dir.x": 0.006,
        "planes.dir.y": 0.006,
        // team status (M6a): 11-bit positions over the map extent, 7-bit health
        "team.pos.x": maxExtent / 2047 / 2 + 1e-9,
        "team.pos.y": maxExtent / 2047 / 2 + 1e-9,
        "team.health": 100 / 127 / 2 + 1e-9,
        fallT: 1 / 127 / 2 + 1e-9,
        posZ: 5 / 1023 / 2 + 1e-9,
        "projectiles.dir.x": 0.012,
        "projectiles.dir.y": 0.012,
        "smokes.rad": 10 / 255 / 2 + 1e-9,
        "airstrikeZones.rad": 256 / 255 / 2 + 1e-9,
        "airstrikeZones.duration": 60 / 255 / 2 + 1e-9,
        zoneT: 1 / 255 / 2 + 1e-9,
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
