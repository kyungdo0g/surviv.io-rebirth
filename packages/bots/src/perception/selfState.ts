// The bot's own state as its snapshots give it (WorldModel.self): position, health, weapons, bag, action. Split out of
// perception/world.ts (bot overhaul round 3, to keep that file small); world.ts re-exports the type.
import type { Vec2 } from "@rebirth/core";

export interface SelfState {
    id: number;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    health: number;
    boost: number;
    zoom: number;
    dead: boolean;
    downed: boolean;
    weapons: Array<{ type: string; ammo: number }>;
    curWeapIdx: number;
    inventory: Record<string, number>;
    scope: string;
    helmet: string;
    chest: string;
    backpack: string;
    /** worn outfit (GameObjectDefs id, from the bot's own PlayerView; LOOT2 outfits) */
    outfit: string;
    action: { type: string; item: string; time: number; duration: number; targetId: number };
    cooldowns: number[];
    kills: number;
}

/** The state before the first snapshot. */
export function emptySelf(): SelfState {
    return {
        id: 0,
        pos: { x: 0, y: 0 },
        dir: { x: 1, y: 0 },
        layer: 0,
        health: 100,
        boost: 0,
        zoom: 28,
        dead: false,
        downed: false,
        weapons: [],
        curWeapIdx: 2,
        inventory: {},
        scope: "1xscope",
        helmet: "",
        chest: "",
        backpack: "",
        outfit: "",
        action: { type: "none", item: "", time: 0, duration: 0, targetId: 0 },
        cooldowns: [0, 0, 0, 0],
        kills: 0,
    };
}
