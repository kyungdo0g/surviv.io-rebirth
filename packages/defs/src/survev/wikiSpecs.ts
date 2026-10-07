// survev.wiki.gg specs of the survev-only melee weapons and throwables of wave 1 (docs/adr/0003-survev-baseline.md
// point 4: where the wiki and survev's source differ, the wiki wins). tools/port-survev ports these items as survev
// master c6185e31 ships them (tools/port-survev/policy.json); this module holds the fields the wiki changes on top,
// each with both sources. Every other infobox field equals the source (packages/defs/test/survevContent.test.ts pins
// them). Applied by data.ts before the rebirth layer.
import type { GameObjectDef } from "../types/index.ts";

/** survev-only melee weapons ported in wave 1 (survev order is the port's business; this is the test list). */
export const SURVEV_ONLY_MELEE = ["iceaxe", "cutlass", "cutlass_gold"] as const;
/** survev reskins of original melee weapons: the base's own def with survev's loot and world image. */
export const SURVEV_MELEE_SKINS: Readonly<Record<string, string>> = {
    naginata_daemon: "naginata",
    karambit_borealis: "karambit",
};
/** survev-only throwables ported in wave 1, with the explosion each one makes. */
export const SURVEV_ONLY_THROWABLES: Readonly<Record<string, string>> = {
    coconut: "explosion_coconut",
    tomato: "explosion_tomato",
};

export interface WikiSpecOverride {
    id: string;
    field: string;
    /** survev's source value */
    survev: unknown;
    /** survev.wiki.gg value (applied) */
    wiki: unknown;
    wikiRef: string;
    survevRef: string;
}

// The owner: the Coconut and the Tomato both cook (user/2026-10-07-cookable). The Coconut takes the wiki's true; the Tomato keeps
// survev's true (its wiki page says False).
export const WIKI_SPEC_OVERRIDES: readonly WikiSpecOverride[] = [
    {
        id: "coconut",
        field: "cookable",
        survev: false,
        wiki: true,
        wikiRef: "wikigg/Coconut (rev 7413): Cookable = True",
        survevRef: "survev/shared/defs/gameObjects/throwableDefs.ts:846",
    },
];

/**
 * Applies WIKI_SPEC_OVERRIDES to `defs` (a mutable copy of the generated record; changed defs are replaced by new
 * objects). Throws when a def is missing or no longer holds survev's value, so a port change cannot slip past.
 */
export function applySurvevWikiSpecs(defs: Record<string, GameObjectDef>): readonly WikiSpecOverride[] {
    for (const o of WIKI_SPEC_OVERRIDES) {
        const def = defs[o.id] as unknown as Record<string, unknown> | undefined;
        if (!def) throw new Error(`survev wiki spec: ${o.id} is not ported`);
        if (def[o.field] !== o.survev)
            throw new Error(`survev wiki spec: ${o.id}.${o.field} is not survev's ${o.survev}`);
        defs[o.id] = { ...def, [o.field]: o.wiki } as unknown as GameObjectDef;
    }
    return WIKI_SPEC_OVERRIDES;
}
