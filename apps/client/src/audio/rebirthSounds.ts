// Sound definitions of the rebirth's beta new guns (2026-10-07), merged into the original sound lists (soundDefs.ts):
// each sound a new gun names plays audio/rebirth/guns/<name>.mp3, which tools/assets/newGuns.ts installs from the
// owner's clips (assets-user/audio/guns, MANIFEST.md, levelled to the original guns of the same class) or, where the
// owner has none, as a copy of the donor gun's original (packages/defs rebirth/newGunAssets.ts NEW_GUN_SOUND_DONORS).
// Each joins its donor's list (the players list; the discard sounds, whose donor is the pickup sound, the ui list, so
// they play on the pickups' channel) with the donor's volume and instance cap. If the file is not installed at all,
// the audio engine plays the donor's original file instead (`fallback`). The original sounds the owner replaced (the
// AK-47 reload, MANIFEST.md round 1) get the same treatment over their original entry.
import { NEW_GUN_SOUND_DONORS, newGunSoundPath, REPLACED_ORIGINAL_SOUNDS } from "@rebirth/defs";

export interface RebirthSoundDef {
    path: string;
    volume: number;
    maxInstances?: number;
    /** the donor's original file, played when `path` cannot be loaded */
    fallback: string;
}

/** The new guns' sounds by list name, each in the original list (`lists`) its donor is found in. */
export function rebirthSoundDefs(
    lists: Readonly<Record<string, Readonly<Record<string, { path: string; volume: number; maxInstances?: number }>>>>,
): Record<string, Record<string, RebirthSoundDef>> {
    const find = (name: string) => {
        for (const [listName, list] of Object.entries(lists)) {
            if (Object.hasOwn(list, name)) return { listName, donor: list[name] };
        }
        return undefined;
    };
    const out: Record<string, Record<string, RebirthSoundDef>> = {};
    const entries: Array<[string, string]> = [
        ...Object.entries(NEW_GUN_SOUND_DONORS),
        ...REPLACED_ORIGINAL_SOUNDS.map((n): [string, string] => [n, n]),
    ];
    for (const [name, donorName] of entries) {
        const found = find(donorName);
        if (!found) continue;
        const { listName, donor } = found;
        const def: RebirthSoundDef = { path: newGunSoundPath(name), volume: donor.volume, fallback: donor.path };
        if (donor.maxInstances !== undefined) def.maxInstances = donor.maxInstances;
        out[listName] ??= {};
        out[listName][name] = def;
    }
    return out;
}
