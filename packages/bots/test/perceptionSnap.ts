// Synthetic snapshots for the perception tests: a WorldModel on the main 12345 map fed hand-made snapshots (the bot
// itself, other players, bullets, explosions, kill feed, indicators) exactly as the simulation would describe them.
import type { Vec2 } from "@rebirth/core";
import type {
    BulletEvent,
    ObjectView,
    ObstacleView,
    PlayerAction,
    PlayerView,
    Snapshot,
    TeamMemberView,
} from "@rebirth/sim";
import { WorldModel } from "../src/perception/world.ts";
import { cachedMap } from "./helpers.ts";

export const SELF = 7;
export const ORIGIN: Vec2 = { x: 360, y: 360 };

export function newModel(): WorldModel {
    return new WorldModel(cachedMap("main", 12345).mapData);
}

export function player(id: number, pos: Vec2, extra: Partial<PlayerView> = {}): PlayerView {
    return {
        id,
        kind: "player",
        type: "player",
        pos,
        layer: 0,
        dir: { x: 1, y: 0 },
        dead: false,
        downed: false,
        activeWeapon: "m9",
        outfit: "outfitBase",
        helmet: "",
        chest: "",
        backpack: "",
        scale: 1,
        ...extra,
    };
}

export function action(type: PlayerAction["type"], item = "", duration = 0, seq = 1): PlayerAction {
    return { type, item, duration, seq };
}

let bulletIds = 1000;

export function bullet(shooterId: number, pos: Vec2, dir: Vec2, extra: Partial<BulletEvent> = {}): BulletEvent {
    return {
        id: bulletIds++,
        shooterId,
        bulletType: "bullet_m9",
        sourceType: "m9",
        pos,
        dir,
        layer: 0,
        maxDist: 100,
        reflectCount: 0,
        hitPlayer: false,
        shotFx: true,
        offHand: false,
        ...extra,
    };
}

export function crate(id: number, pos: Vec2, canUse = true): ObstacleView {
    return {
        id,
        kind: "obstacle",
        type: "airdrop_crate_01",
        pos,
        layer: 0,
        ori: 0,
        scale: 1,
        healthT: 1,
        dead: false,
        button: { onOff: false, canUse, seq: 0 },
    };
}

export interface SnapOptions extends Partial<Omit<Snapshot, "objects">> {
    objects?: ObjectView[];
    self?: Partial<PlayerView>;
    team?: TeamMemberView[];
    weapons?: Array<{ type: string; ammo: number }>;
}

/** A snapshot at `time` of the bot standing at ORIGIN, plus `opts`. */
export function snap(time: number, opts: SnapOptions = {}): Snapshot {
    const { objects = [], self = {}, team, weapons, ...rest } = opts;
    return {
        tick: Math.round(time * 100),
        time,
        localPlayerId: SELF,
        local: {
            health: 100,
            boost: 0,
            zoom: 28,
            layer: 0,
            weapons: weapons ?? [
                { type: "m9", ammo: 15 },
                { type: "", ammo: 0 },
                { type: "fists", ammo: 0 },
                { type: "", ammo: 0 },
            ],
            curWeapIdx: 0,
            inventory: {},
            ...(team ? { team } : {}),
        },
        objects: [player(SELF, ORIGIN, self), ...objects],
        deletedIds: [],
        ...rest,
    };
}

export function member(playerId: number, pos: Vec2): TeamMemberView {
    return { playerId, name: `p${playerId}`, health: 100, downed: false, dead: false, disconnected: false, pos };
}
