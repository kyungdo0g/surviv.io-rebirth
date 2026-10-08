// The player's loadout (survev content wave stage 4b): one JSON object under localStorage "rebirth.loadout" (the
// original kept the account's loadout on the server; the rebirth has no accounts). Reads are validated against the defs
// (@rebirth/sim validateLoadout), so a stale or edited entry falls back item by item to the defaults; blocked storage
// keeps the loadout for the page's lifetime only.
import { type JoinLoadout, type Loadout, validateLoadout } from "@rebirth/sim";

const KEY = "rebirth.loadout";
let memory: Loadout | null = null;
const listeners = new Set<(loadout: Loadout) => void>();

export function loadLoadout(): Loadout {
    if (memory) return validateLoadout(memory);
    let raw: unknown;
    try {
        const text = localStorage.getItem(KEY);
        raw = text ? JSON.parse(text) : undefined;
    } catch {
        raw = undefined;
    }
    memory = validateLoadout(raw);
    return validateLoadout(memory);
}

export function saveLoadout(next: Loadout): Loadout {
    memory = validateLoadout(next);
    try {
        localStorage.setItem(KEY, JSON.stringify(memory));
    } catch {
        // blocked storage: kept in memory
    }
    for (const cb of listeners) cb(validateLoadout(memory));
    return validateLoadout(memory);
}

export function onLoadoutChange(cb: (loadout: Loadout) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

/** The part of the loadout sent in Join. */
export function joinLoadout(loadout: Loadout = loadLoadout()): JoinLoadout {
    const { outfit, melee, heal, boost, emotes } = loadout;
    return { outfit, melee, heal, boost, emotes: [...emotes] };
}
