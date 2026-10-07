// Sound definitions of the rebirth's beta new guns (2026-10-07), merged into the "players" list (soundDefs.ts): each
// sound a new gun names plays audio/rebirth/guns/<name>.mp3, which tools/assets/newGuns.ts installs from the owner's
// clips (assets-user/audio/guns, MANIFEST.md) or, where the owner has none, as a copy of the donor gun's original
// (packages/defs rebirth/newGunAssets.ts NEW_GUN_SOUND_DONORS). Volume and instance cap are the donor's. If the file
// is not installed at all, the audio engine plays the donor's original file instead (`fallback`). The original
// sounds the owner replaced (the AK-47 reload, MANIFEST.md round 1) get the same treatment over their original entry.
import { NEW_GUN_SOUND_DONORS, newGunSoundPath, REPLACED_ORIGINAL_SOUNDS } from "@rebirth/defs";

export interface RebirthSoundDef {
    path: string;
    volume: number;
    maxInstances?: number;
    /** the donor's original file, played when `path` cannot be loaded */
    fallback: string;
}

/** The new guns' sounds for the "players" list, from the original lists (`lists`) the donors are found in. */
export function rebirthSoundDefs(
    lists: Readonly<Record<string, Readonly<Record<string, { path: string; volume: number; maxInstances?: number }>>>>,
): Record<string, RebirthSoundDef> {
    const find = (name: string) => {
        for (const list of Object.values(lists)) if (Object.hasOwn(list, name)) return list[name];
        return undefined;
    };
    const out: Record<string, RebirthSoundDef> = {};
    const entries: Array<[string, string]> = [
        ...Object.entries(NEW_GUN_SOUND_DONORS),
        ...REPLACED_ORIGINAL_SOUNDS.map((n): [string, string] => [n, n]),
    ];
    for (const [name, donorName] of entries) {
        const donor = find(donorName);
        if (!donor) continue;
        out[name] = { path: newGunSoundPath(name), volume: donor.volume, fallback: donor.path };
        if (donor.maxInstances !== undefined) out[name].maxInstances = donor.maxInstances;
    }
    return out;
}
