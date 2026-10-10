// Synthetic 50v50 worlds for the faction brain tests (bot round 6): the flat test terrain renamed to the faction map
// with one straight main river (x = RIVER_X, flowing +y), the bot (id 1) on its left bank in faction 1, squad 5, and
// the faction knowledge (perception/factionIntel.ts) fed from a stub snapshot with fresh boards (no sharing between
// tests).
import { type Vec2, v2 } from "@rebirth/core";
import type { FactionMemberView, MapData, Snapshot, TeamMemberView } from "@rebirth/sim";
import { FactionBoards } from "../src/perception/factionBoard.ts";
import { FactionIntel } from "../src/perception/factionIntel.ts";
import { giveGun, NOW, type TestWorld, testWorld } from "./brain-world.ts";

const base = testWorld();
/** The bot's spot; the river runs 40 u to its east. */
export const SPOT = base.spot;
export const RIVER_X = SPOT.x + 40;
export const RIVER_WIDTH = 20;
export const TEAM = 1;
export const GROUP = 5;

const riverPoints: Vec2[] = [];
for (let y = 0; y <= base.model.map.height; y += 40) riverPoints.push({ x: RIVER_X, y });

/** The faction test map (one MapData for the file: its navigation grid is built once). */
export const FACTION_MAP: MapData = {
    ...base.model.map,
    mapName: "faction",
    rivers: [{ width: RIVER_WIDTH, looped: false, points: riverPoints }],
};

export interface FactionWorld extends TestWorld {
    fi: FactionIntel;
    boards: FactionBoards;
}

export function member(id: number, pos: Vec2, over: Partial<TeamMemberView> = {}): TeamMemberView {
    return { playerId: id, name: `m${id}`, health: 100, downed: false, dead: false, disconnected: false, pos, ...over };
}

export function row(id: number, pos: Vec2, over: Partial<FactionMemberView> = {}): FactionMemberView {
    return { playerId: id, pos, dead: false, downed: false, role: "", ...over };
}

/** A stub snapshot with only what FactionIntel.ingest reads. */
export function stubSnap(over: Partial<Snapshot> & { role?: string; perks?: string[] } = {}): Snapshot {
    const { role, perks, ...rest } = over;
    return {
        tick: 0,
        time: NOW,
        localPlayerId: 1,
        local: {
            health: 100,
            boost: 0,
            zoom: 28,
            layer: 0,
            weapons: [],
            curWeapIdx: 0,
            inventory: {},
            role: role ?? "",
            perks: (perks ?? []).map((type) => ({ type, droppable: false })),
        },
        objects: [],
        deletedIds: [],
        ...rest,
    } as Snapshot;
}

/**
 * The bot in faction 1, squad 5, on the left bank, with squadmates at the given offsets (ids 10, 11, ...) and the
 * faction minimap rows of `allies` (offsets, ids 20, 21, ..., with their roles); `role` and `perks` are the bot's.
 */
export function factionWorld(
    opts: {
        mates?: Vec2[];
        allies?: Array<{ off: Vec2; downed?: boolean; role?: string }>;
        role?: string;
        perks?: string[];
        mateHealth?: number[];
    } = {},
): FactionWorld {
    const w = testWorld(FACTION_MAP, SPOT);
    const model = w.model;
    const boards = new FactionBoards();
    const fi = new FactionIntel(FACTION_MAP, boards);
    model.faction = fi;
    model.teamOf.set(1, TEAM);
    model.groupOf.set(1, GROUP);
    const team: TeamMemberView[] = [member(1, w.spot)];
    (opts.mates ?? []).forEach((off, i) => {
        const id = 10 + i;
        team.push(member(id, v2.add(w.spot, off), { health: opts.mateHealth?.[i] ?? 100 }));
        model.teammates.add(id);
        model.teamOf.set(id, TEAM);
        model.groupOf.set(id, GROUP);
    });
    model.team = team;
    const rows: FactionMemberView[] = team.map((m) => row(m.playerId, m.pos));
    (opts.allies ?? []).forEach((a, i) => {
        const id = 20 + i;
        rows.push(row(id, v2.add(w.spot, a.off), { downed: !!a.downed, role: a.role ?? "" }));
        model.teamOf.set(id, TEAM);
        model.groupOf.set(id, GROUP + 1 + i);
    });
    fi.ingest(stubSnap({ factionStatus: rows, role: opts.role, perks: opts.perks }), model);
    return { ...w, fi, boards };
}

/** Kits the bot for the front (factionCtx.ts kitted): an AK with three magazines, a helmet, bandages. */
export function kit(w: TestWorld): void {
    giveGun(w, 0, "ak47", 30, 90);
    w.model.self.helmet = "helmet01";
    w.model.self.inventory.bandage = 5;
}
