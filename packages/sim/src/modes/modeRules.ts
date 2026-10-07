// Event-mode knobs (M7b). Values follow docs/research/modes/*.md with their conflict resolutions, cited per field;
// `game.rules.modes` is a mutable copy.

/** What a snowball / potato hit does to a non-teammate besides its damage (survev explosion.ts). */
export interface ThrowableHitRule {
    /** seconds the target is slowed by GameConfig.player.frozenSpeedPenalty and shows the frozen pose */
    freeze: number;
    /** random items the target drops (survev dropRandomLoot: a bag item, gun, melee, droppable perk or armour) */
    dropRandomLoot: number;
    /** zoom radius each hit takes off the target's view, summed up to `viewShrink.max` (survev PMG-134 shots) */
    viewShrink?: number;
}

/** How the PMG-134's view shrink adds up and wears off (survev server player.ts decrementViewDistance). */
export interface ViewShrinkRule {
    /** largest summed shrink */
    max: number;
    /** seconds after the last hit until the full view comes back at once */
    duration: number;
}

export interface ModeRules {
    /**
     * Snowball and potato hits by explosion type (throwables.md "Snowball": a hit slows the target and makes it drop one
     * random item; the client defs show the frozen sprites but no duration, open-questions.md freeze-and-drop-effects).
     * Durations and drop counts are survev's pre-balance values (0.5 s light, 1 s heavy, 1 item; fork 0.2.1 raised the
     * heavy snowball to 2 s and the heavy potato to 2 items); Spud Gun shots slow for 1 s without a drop.
     */
    throwableHits: Readonly<Record<string, ThrowableHitRule>>;
    /**
     * PMG-134 view shrink: 1.5 per hit up to 32, gone 2.5 s after the last hit (survev player.ts:4592-4597,
     * 1911-1918)
     */
    viewShrink: ViewShrinkRule;
    /**
     * Potato maps replace every wheel, death and win emote with emote_potato (survev emoteFromSlot; potato.md "Core rule":
     * pings and team-only emotes still work)
     */
    potatoEmotes: boolean;
    /**
     * Cobalt: joining players wait at the Twins bunker (bunker_twins_sublevel_01, underground) while the class menu is
     * open and are moved to a normal spawn point once they have a class (cobalt.md "Class selection and spawning", survev
     * addPlayer / roleSelect). Off: they wait at their spawn point. Either way they cannot act or be hurt meanwhile.
     */
    cobaltWaitingRoom: boolean;
}

export function defaultModeRules(): ModeRules {
    return {
        throwableHits: {
            explosion_snowball: { freeze: 0.5, dropRandomLoot: 1 },
            explosion_snowball_heavy: { freeze: 1, dropRandomLoot: 1 },
            explosion_potato: { freeze: 0.5, dropRandomLoot: 1 },
            explosion_potato_heavy: { freeze: 1, dropRandomLoot: 1 },
            explosion_potato_smgshot: { freeze: 1, dropRandomLoot: 0 },
            // PMG-134 shot (survev-only): slows 0.25 s (wikigg/Petite_Potato "Slowdown duration = 0.25"; survev
            // explosionsDefs.ts:229 freezeDuration 0.25) and shrinks the view (survev explosion.ts:240-242)
            explosion_potato_lmgshot: { freeze: 0.25, dropRandomLoot: 0, viewShrink: 1.5 },
            // survev-only throwables: the coconut slows 1 s (wikigg/Coconut rev 7413 "Slowdown duration = 1"; survev
            // explosionsDefs.ts:247), the tomato 0.5 s and drops an item (wikigg/Tomato_(Throwable) rev 7178;
            // explosionsDefs.ts:268-270)
            explosion_coconut: { freeze: 1, dropRandomLoot: 0 },
            explosion_tomato: { freeze: 0.5, dropRandomLoot: 1 },
        },
        viewShrink: { max: 32, duration: 2.5 },
        potatoEmotes: true,
        cobaltWaitingRoom: true,
    };
}
