// Cobalt class selection (M7b; docs/research/modes/cobalt.md "Class selection and spawning", survev player.ts addPlayer /
// roleSelect / update). On a perkMode map a joining player has no class: it waits at the Twins bunker
// (bunker_twins_sublevel_01, underground) while the client shows the class menu, takes no damage and cannot act, emote
// or drop anything. Once it picks a class (Game.selectRole, the PerkModeRoleSelect message) or the 20 s timer gives it a
// random one, it is moved to a normal spawn point on the surface (next to its group in team modes).
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import { getMapDef } from "@rebirth/defs";
import type { Group } from "../match/teams.ts";
import type { Player } from "../world/player.ts";
import type { World } from "../world/world.ts";

/** The building whose centre and layer are the waiting room (survev map.ts perkModeTwinsBunker). */
export const TWINS_WAITING_ROOM = "bunker_twins_sublevel_01";

/** What class selection needs from the game. */
export interface ClassSelectHost {
    readonly world: World;
    readonly options: { mapName: string };
    readonly rules: { modes: { cobaltWaitingRoom: boolean } };
    readonly teams: { teamMode: number; spawnPos(group: Group, rng: Rng): Vec2 };
    teleportPlayer(id: number, pos: Vec2, layer?: number): void;
}

/** Players on a perkMode map start without a class. */
export function startsWithoutClass(mapName: string): boolean {
    return !!getMapDef(mapName).gameMode.perkMode;
}

/** Centre and layer of the Twins bunker waiting room, or null (rule off, other maps, no bunker generated). */
export function waitingRoom(host: ClassSelectHost): { pos: Vec2; layer: number } | null {
    if (!host.rules.modes.cobaltWaitingRoom || !startsWithoutClass(host.options.mapName)) return null;
    const room = host.world.buildings.find((b) => b.type === TWINS_WAITING_ROOM);
    return room ? { pos: v2.copy(room.pos), layer: room.layer } : null;
}

/**
 * A class was assigned: the player may act, and one that waited in the Twins bunker moves to a spawn point on the
 * surface; in team modes the first of its group to leave sets the group's spawn position (survev roleSelect).
 */
export function onClassChosen(host: ClassSelectHost, player: Player, waited: boolean, rng: Rng): void {
    player.awaitingClass = false;
    if (!waited || !player.group) return;
    const pos = host.teams.spawnPos(player.group, rng);
    host.teleportPlayer(player.id, pos, 0);
    if (host.teams.teamMode > 1 && !player.group.spawnPosition) player.group.spawnPosition = v2.copy(pos);
}
