// Interior music of structures (survev client/src/objects/structure.ts updateInteriorSounds; docs/research/maps/
// puzzles.md): the club's music and the saloon's piano are heard inside their building at full volume (the normal
// track), from outside through the def's `filter` EQ at `outsideVolume` (the filtered track), both fading out over
// `outsideMaxDist` units from the building, and underground (the club's cellar) through the filter at
// `undergroundVolume`. How much of each is heard follows the roof: an open roof plays the normal track, a closed one
// the filtered one. When the structure's puzzle is solved (`interiorSoundAlt`) the track crossfades to `soundAlt`
// over `transitionTime` seconds (dipping to silence at the switch); an empty `soundAlt` stops the music.
import type { Vec2 } from "@rebirth/core";
import { MapObjectDefs, type StructureDef } from "@rebirth/defs";
import type { StructureView } from "@rebirth/sim";
import type { Ambience } from "./ambience.ts";

/** What the interior logic needs from a structure's layer buildings. */
export interface InteriorBuilding {
    /** 1 = roof drawn, 0 = roof hidden (the viewer sees inside) */
    readonly ceilingAlpha: number;
    /** distance from `pos` to the building's ceiling regions, capped at `maxDist` (0 inside) */
    distanceToCeiling(pos: Vec2, maxDist: number): number;
}

export interface InteriorWorld {
    forEachView(kind: "structure", cb: (view: StructureView) => void): void;
    /** the layer building `index` (0 ground, 1 underground) of a structure */
    structureLayer(structure: StructureView, index: number): InteriorBuilding | null;
}

export class InteriorSounds {
    /** per structure id: crossfade progress towards soundAlt (0..1) */
    private readonly transition = new Map<number, number>();

    /** Sets this frame's interior tracks for a listener at `pos` on `layer`. */
    update(dt: number, world: InteriorWorld, pos: Vec2, layer: number, ambience: Ambience): void {
        const seen = new Set<number>();
        world.forEachView("structure", (s) => {
            const def = MapObjectDefs[s.type] as StructureDef | undefined;
            const sound = def?.interiorSound;
            if (!sound) return;
            seen.add(s.id);
            let t = this.transition.get(s.id);
            if (t === undefined) t = s.interiorSoundAlt ? 1 : 0;
            if (s.interiorSoundAlt) t = Math.min(1, t + dt / (sound.transitionTime || 1));
            this.transition.set(s.id, t);

            const maxDist = sound.outsideMaxDist ?? 10;
            const outsideVol = sound.outsideVolume ?? 0;
            const undergroundVol = sound.undergroundVolume ?? 1;
            let normal = 0;
            let filtered = 0;
            if (layer !== 1) {
                const b0 = world.structureLayer(s, 0);
                if (b0) {
                    const weight = 1 - b0.distanceToCeiling(pos, maxDist) / maxDist;
                    const vision = b0.ceilingAlpha;
                    normal = weight * (1 - vision);
                    filtered = weight * vision * (layer & 2 ? undergroundVol : outsideVol);
                }
            } else {
                const b1 = world.structureLayer(s, 1);
                if (b1) filtered = (1 - b1.distanceToCeiling(pos, maxDist) / maxDist) * undergroundVol;
            }
            const transitionWeight = Math.abs(t - 0.5) * 2;
            const track = t > 0.5 ? sound.soundAlt : sound.sound;
            if (!track) return;
            ambience.setInterior(0, track, "", normal * transitionWeight);
            ambience.setInterior(1, track, sound.filter ?? "", filtered * transitionWeight);
        });
        for (const id of [...this.transition.keys()]) if (!seen.has(id)) this.transition.delete(id);
    }

    clear(): void {
        this.transition.clear();
    }
}
