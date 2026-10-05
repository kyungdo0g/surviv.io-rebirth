// Typed access to the original sound definitions (src/generated/sound-defs.json, scripts/sound-defs.ts): sound
// lists with per-sound volumes, the channels that play them, and the random sound groups (impacts, footsteps).
import defsJson from "../generated/sound-defs.json";

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

const DEFS = defsJson as SoundDefsFile;

export const Channels: Readonly<Record<string, ChannelDef>> = DEFS.channels;

/** The definition of `name` as played on `channel`, if that channel's list has it. */
export function soundDef(name: string, channel: string): SoundDef | undefined {
    const ch = DEFS.channels[channel];
    return ch ? DEFS.lists[ch.list]?.[name] : undefined;
}

export function soundGroup(name: string): SoundGroup | undefined {
    return DEFS.groups[name];
}
