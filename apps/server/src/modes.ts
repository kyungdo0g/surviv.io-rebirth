// Event maps and the play buttons (M7b). The original page had three fixed buttons (Solo, Duo, Squad; mode index 0-2)
// and the server chose which map each queue ran; an event replaced a queue (docs/research/modes/events.md "How events
// were run", ui/menus.md "Play buttons"). The server lists its three modes in /api/site_info (survev SiteInfoRes
// `modes`), find_game resolves a mode index to its map and team mode, and a request naming only a map plays that map's
// event queue.
import { MapDefs } from "@rebirth/defs";
import { effectiveTeamMode } from "./config.ts";

export type TeamModeValue = 1 | 2 | 4;

export interface ModeEntry {
    mapName: string;
    teamMode: TeamModeValue;
    enabled: boolean;
}

/**
 * Queue each event map ran in (events.md chronology, the last event up to 0.8.82): Desert and Woods events squads,
 * Woods Snow duos ("Two survivrs walk into a BAR"), Happy Spookiversary solo, 50v50 squads inside the factions, Main
 * Summer solo (squads got Desert), Free Fryer (potato) solo first. Maps not listed ran in every queue (or the queue is
 * not documented, e.g. Cobalt): solo by default.
 */
export const MAP_DEFAULT_TEAM_MODE: Readonly<Record<string, TeamModeValue>> = {
    desert: 4,
    woods: 4,
    woods_snow: 2,
    halloween: 1,
    faction: 4,
    faction_potato: 4,
    main_summer: 1,
    potato: 1,
};

/** Team mode of a request that names a map but no mode: the map's event queue (50v50 always squads). */
export function defaultTeamMode(mapName: string): TeamModeValue {
    return effectiveTeamMode(mapName, MAP_DEFAULT_TEAM_MODE[mapName] ?? 1);
}

/**
 * Parses MODES ("map:teamMode,map:teamMode,map:teamMode", e.g. "main:1,main:2,desert:4"); at most three buttons like
 * the original page. Throws on unknown maps or team modes.
 */
export function parseModes(text: string): ModeEntry[] {
    const out: ModeEntry[] = [];
    for (const part of text.split(",")) {
        const [mapName, team] = part.trim().split(":");
        if (!mapName) continue;
        if (!Object.hasOwn(MapDefs, mapName)) throw new Error(`MODES: unknown map ${mapName}`);
        const n = team === undefined ? defaultTeamMode(mapName) : Number(team);
        if (n !== 1 && n !== 2 && n !== 4) throw new Error(`MODES: bad team mode ${team} for ${mapName}`);
        out.push({ mapName, teamMode: effectiveTeamMode(mapName, n), enabled: true });
    }
    if (out.length === 0 || out.length > 3) throw new Error("MODES: one to three entries");
    return out;
}

/** The default buttons: Solo, Duo and Squad of `mapName` (a 50v50 map plays squads on every button). */
export function defaultModes(mapName: string): ModeEntry[] {
    return ([1, 2, 4] as const).map((t) => ({ mapName, teamMode: effectiveTeamMode(mapName, t), enabled: true }));
}

/**
 * Map and team mode of a find_game request: an explicit team mode wins, then the button `gameModeIdx` (its map too when
 * no map is named), then the named map's event queue, then the first button.
 */
export function resolveFindGame(
    modes: readonly ModeEntry[],
    req: { mapName?: string; teamMode?: TeamModeValue; gameModeIdx?: number },
): { mapName: string; teamMode: TeamModeValue } {
    const button = req.gameModeIdx !== undefined ? modes[Math.min(req.gameModeIdx, modes.length - 1)] : undefined;
    const mapName = req.mapName ?? button?.mapName ?? modes[0].mapName;
    let teamMode: TeamModeValue;
    if (req.teamMode !== undefined) teamMode = req.teamMode;
    else if (req.gameModeIdx !== undefined && req.mapName)
        teamMode = ([1, 2, 4] as const)[Math.min(req.gameModeIdx, 2)];
    else if (button) teamMode = button.teamMode;
    else teamMode = req.mapName ? defaultTeamMode(mapName) : modes[0].teamMode;
    return { mapName, teamMode: effectiveTeamMode(mapName, teamMode) };
}
