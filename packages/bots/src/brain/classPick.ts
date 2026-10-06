// Cobalt class choice of a bot (M7b): on a perkMode map a player without a class waits in the class menu (Twins
// bunker) and cannot act, so a bot picks one of the map's perkModeRoles after a short, human-like think (0.5 to 4 s),
// well inside the 20 s menu timer (cobalt.md "Class selection and spawning").
import type { Rng } from "@rebirth/core";
import { getMapDef, MapDefs } from "@rebirth/defs";
import type { Snapshot } from "@rebirth/sim";

const THINK_MIN = 0.5;
const THINK_MAX = 4;

export class ClassPicker {
    private readonly rng: Rng;
    private readonly classes: readonly string[];
    private pickAt = -1;
    private picked = false;

    constructor(mapName: string, rng: Rng) {
        this.rng = rng;
        const mode = Object.hasOwn(MapDefs, mapName) ? getMapDef(mapName).gameMode : undefined;
        this.classes = mode?.perkMode ? (mode.perkModeRoles ?? []) : [];
    }

    /** The class to send now (once), or null. */
    update(snap: Snapshot): string | null {
        if (this.picked || this.classes.length === 0) return null;
        if (snap.local.role || snap.local.dead) {
            this.picked = true;
            return null;
        }
        if (this.pickAt < 0) this.pickAt = snap.time + this.rng.range(THINK_MIN, THINK_MAX);
        if (snap.time < this.pickAt) return null;
        this.picked = true;
        return this.rng.pick(this.classes);
    }
}
