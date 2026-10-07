// Typed access to the original sound definitions (src/generated/sound-defs.json, scripts/sound-defs.ts): sound
// lists with per-sound volumes, the channels that play them, and the random sound groups (impacts, footsteps).
// The rebirth's beta new guns add their sounds to the "players" list (rebirthSounds.ts), each with the donor's original
// file as a `fallback`.
import defsJson from "../generated/sound-defs.json";
import { rebirthSoundDefs } from "./rebirthSounds.ts";

export interface ChannelDef {
    volume: number;
    /** distance in world units at which a positional sound fades to silence */
    maxRange: number;
    /** sound list the channel plays from */
    list: string;
    type: string;
}

export interface SoundDef {
    path: string;
    volume: number;
    maxInstances?: number;
    /** a play ending within 30 ms of a playing instance merges into it (survev createJS canCoalesce; impacts) */
    canCoalesce?: boolean;
    /** file played instead when `path` cannot be loaded (rebirth sounds not installed: the donor's original) */
    fallback?: string;
}

export interface SoundGroup {
    channel: string;
    sounds: string[];
}

interface SoundDefsFile {
    channels: Record<string, ChannelDef>;
    lists: Record<string, Record<string, SoundDef>>;
    groups: Record<string, SoundGroup>;
}

const GENERATED = defsJson as SoundDefsFile;
const DEFS: SoundDefsFile = {
    ...GENERATED,
    lists: { ...GENERATED.lists, players: { ...GENERATED.lists.players, ...rebirthSoundDefs(GENERATED.lists) } },
};
const FALLBACKS = new Map<string, string>();
for (const list of Object.values(DEFS.lists)) {
    for (const def of Object.values(list)) if (def.fallback) FALLBACKS.set(def.path, def.fallback);
}

export const Channels: Readonly<Record<string, ChannelDef>> = DEFS.channels;

/** The definition of `name` as played on `channel`, if that channel's list has it. */
export function soundDef(name: string, channel: string): SoundDef | undefined {
    const ch = DEFS.channels[channel];
    return ch ? DEFS.lists[ch.list]?.[name] : undefined;
}

export function soundGroup(name: string): SoundGroup | undefined {
    return DEFS.groups[name];
}

/** The file to play instead of `path` when it cannot be loaded, if any (rebirth sounds: the donor's original). */
export function soundFallback(path: string): string | undefined {
    return FALLBACKS.get(path);
}
